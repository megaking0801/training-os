// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from '../App'
import { AppDataProvider } from './store'
import * as db from '../store/db'
import { DAYS } from '../program/days'
import { advanceCursor, nextDay } from '../engine/sequence'
import { DEFAULT_STATE } from '../store/types'

/**
 * 端對端煙霧測試：真的把 App 掛起來、開始一堂訓練、記一組、完成，
 * 再確認資料有寫進 IndexedDB、課表有往下移一堂。
 *
 * 這是在沒有 iPhone 的情況下唯一能驗證整條流程接得起來的方式。
 */

vi.mock('virtual:pwa-register', () => ({ registerSW: () => () => {} }))

// jsdom 沒有實作 window.confirm，不 stub 的話它回傳 undefined，
// 所有要確認的動作都會安靜地不執行。
beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** 目前課表停在哪一堂、跳過之後會變成哪一堂。 */
async function cycleState() {
  const state = (await db.loadState()) ?? DEFAULT_STATE
  return {
    current: DAYS[nextDay(state.mode, state.cursor)],
    afterSkip: DAYS[nextDay(state.mode, advanceCursor(state.mode, state.cursor))],
    cursor: state.cursor,
  }
}

function renderApp() {
  return render(
    <AppDataProvider>
      <App />
    </AppDataProvider>,
  )
}

async function waitForReady() {
  await waitFor(() => expect(screen.queryByText('載入中…')).toBeNull(), { timeout: 4000 })
}

describe('App 主流程', () => {
  it('從首頁開始一堂訓練、記一組、完成，紀錄會存進資料庫', async () => {
    renderApp()
    await waitForReady()

    // 第一次打開，下一堂是推日 A。
    expect(screen.getByText('推日 A')).toBeTruthy()
    expect(screen.getByText(/循環第 1 \/ 4 堂/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '開始今天訓練' }))

    const topSet = await screen.findByText('槓鈴臥推－主力重組')
    expect(topSet).toBeTruthy()
    // 沒有歷史紀錄時要提示自己抓重量。
    expect(screen.getAllByText(/第一次做這個動作/).length).toBeGreaterThan(0)

    const bench = '槓鈴臥推－主力重組'
    fireEvent.change(screen.getByLabelText(`${bench} 本組重量`), { target: { value: '70' } })
    fireEvent.change(screen.getByLabelText(`${bench} 本組次數`), { target: { value: '6' } })
    // 保留次數是一鍵選，按鈕上寫的是意思不是數字。
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: `${bench} 本組保留次數` })).getByRole('radio', {
        name: '還能 1 下',
      }),
    )
    fireEvent.click(screen.getByLabelText(`${bench} 完成這一組`))

    // 記完一組要自動開始休息倒數。
    expect(await screen.findByRole('timer')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '結束訓練' }))
    fireEvent.click(screen.getByRole('button', { name: '儲存並完成' }))

    await waitFor(async () => {
      const saved = await db.loadSessions()
      expect(saved).toHaveLength(1)
      expect(saved[0]?.dayId).toBe('pushA')
      expect(saved[0]?.entries[0]?.sets[0]).toEqual({ weight: 70, reps: 6, rir: 1 })
    })

    // 完成之後回首頁，下一堂變拉日 A。
    await waitFor(() => expect(screen.getByText('拉日 A')).toBeTruthy())
    expect(screen.getByText(/循環第 2 \/ 4 堂/)).toBeTruthy()
    expect((await db.loadDraft()) ?? null).toBeNull()
  })

  it('第二次做推日 A 時會看到上次紀錄與加重建議', async () => {
    renderApp()
    await waitForReady()

    // 上一個測試留下的紀錄還在同一個 fake IndexedDB 裡，
    // 用「跳過這堂」把課表轉回推日 A。
    for (const expected of ['拉日 A', '腿部日', '上肢 B']) {
      await waitFor(() => expect(screen.getByText(expected)).toBeTruthy())
      fireEvent.click(screen.getByRole('button', { name: '跳過這堂' }))
    }

    await waitFor(() => expect(screen.getByText('推日 A')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '開始今天訓練' }))

    // 主力重組是這堂的第一個動作，預設就展開。
    const card = (await screen.findByText('槓鈴臥推－主力重組')).closest('section')!
    // 上次 70 × 6 保留 1 → Handoff §16 規則要建議加到 72.5。
    expect(within(card).getByText(/70 × 6/)).toBeTruthy()
    expect(within(card).getByText(/建議增加到 72.5 kg/)).toBeTruthy()

    // 後面的動作預設收起來，要點開才看得到內容。
    const backoff = screen.getByText('槓鈴臥推－降重工作組').closest('section')!
    expect(within(backoff).queryByText(/約 65–67.5 kg/)).toBeNull()
    fireEvent.click(within(backoff).getByRole('button', { expanded: false }))
    // 降重工作組要跟著主力重組換算出 90–93%。
    expect(within(backoff).getByText(/約 65–67.5 kg/)).toBeTruthy()
  })
})

describe('動作層級的「今天不做這個」', () => {
  beforeEach(async () => {
    await db.clearDraft()
  })

  it('標成今天沒做，進度分母跟著扣掉，下一個動作接手', async () => {
    renderApp()
    await waitForReady()
    fireEvent.click(screen.getByRole('button', { name: '開始今天訓練' }))

    // 推日 A 排定 1 + 3 + 3 + 3 + 2 = 12 組。
    expect(await screen.findByText('0 / 12 組')).toBeTruthy()

    const topSet = (await screen.findByText('槓鈴臥推－主力重組')).closest('section')!
    fireEvent.click(within(topSet).getByRole('button', { name: '今天不做這個' }))

    // 主力重組 1 組被扣掉。
    expect(await screen.findByText('0 / 11 組')).toBeTruthy()
    expect(within(topSet).getByText('今天沒做')).toBeTruthy()

    // 下一個動作接手成為展開中的那張卡。
    const backoff = screen.getByText('槓鈴臥推－降重工作組').closest('section')!
    expect(within(backoff).getByRole('button', { expanded: true })).toBeTruthy()
  })

  it('可以反悔', async () => {
    renderApp()
    await waitForReady()
    fireEvent.click(screen.getByRole('button', { name: '開始今天訓練' }))

    const topSet = (await screen.findByText('槓鈴臥推－主力重組')).closest('section')!
    fireEvent.click(within(topSet).getByRole('button', { name: '今天不做這個' }))
    await screen.findByText('0 / 11 組')

    fireEvent.click(within(topSet).getByRole('button', { expanded: false }))
    fireEvent.click(within(topSet).getByRole('button', { name: '其實要做' }))

    expect(await screen.findByText('0 / 12 組')).toBeTruthy()
  })

  it('已經記了組數就不給跳過，因為那不是跳過', async () => {
    renderApp()
    await waitForReady()
    fireEvent.click(screen.getByRole('button', { name: '開始今天訓練' }))

    const bench = '槓鈴臥推－主力重組'
    await screen.findByLabelText(`${bench} 本組重量`)
    fireEvent.change(screen.getByLabelText(`${bench} 本組重量`), { target: { value: '70' } })
    fireEvent.click(screen.getByLabelText(`${bench} 完成這一組`))

    // 記滿之後卡片會自動收起來，所以要重新展開才問得準 ——
    // 否則按鈕不見只是因為整個 body 被收掉了。
    const topSet = screen.getByText(bench).closest('section')!
    await waitFor(() => expect(within(topSet).getByRole('button', { expanded: false })).toBeTruthy())
    fireEvent.click(within(topSet).getByRole('button', { expanded: false }))

    expect(within(topSet).getByRole('button', { expanded: true })).toBeTruthy()
    expect(within(topSet).getByLabelText(`${bench} 本組重量`)).toBeTruthy()
    expect(within(topSet).queryByRole('button', { name: '今天不做這個' })).toBeNull()
  })
})

describe('跳過這堂', () => {
  // 前面的測試可能留下沒完成的訓練，會讓首頁變成「繼續這次訓練」。
  beforeEach(async () => {
    await db.clearDraft()
  })

  it('直接移到下一堂，不留紀錄', async () => {
    const { current, afterSkip } = await cycleState()
    const sessionsBefore = (await db.loadSessions()).length

    renderApp()
    await waitForReady()
    expect(screen.getByText(current.name)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '跳過這堂' }))

    await waitFor(() => expect(screen.getByText(afterSkip.name)).toBeTruthy())
    expect((await db.loadSessions()).length).toBe(sessionsBefore)
  })

  it('確認視窗按取消就什麼都不做', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { current, cursor } = await cycleState()

    renderApp()
    await waitForReady()
    fireEvent.click(screen.getByRole('button', { name: '跳過這堂' }))

    expect(screen.getByText(current.name)).toBeTruthy()
    expect((await db.loadState())?.cursor).toBe(cursor)
  })

  // 訓練中 tabbar 是收起來的，所以中途回不了首頁。會同時看到「繼續這次訓練」
  // 和「跳過這堂」的情況只有一種：開始之後把 App 關掉再打開。
  it('關掉 App 再打開時跳過，會一起清掉沒完成的訓練', async () => {
    renderApp()
    await waitForReady()
    fireEvent.click(screen.getByRole('button', { name: '開始今天訓練' }))
    await screen.findByRole('button', { name: /結束/ })
    await waitFor(async () => expect(await db.loadDraft()).toBeTruthy())

    cleanup()
    renderApp()
    await waitForReady()
    expect(screen.getByRole('button', { name: '繼續這次訓練' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '跳過這堂' }))

    await waitFor(async () => expect((await db.loadDraft()) ?? null).toBeNull())
    expect(await screen.findByRole('button', { name: '開始今天訓練' })).toBeTruthy()
  })
})

describe('一組都沒記就結束', () => {
  beforeEach(async () => {
    await db.clearDraft()
  })

  it('不留紀錄，課表也不往前走', async () => {
    const { current, cursor } = await cycleState()
    const sessionsBefore = (await db.loadSessions()).length

    renderApp()
    await waitForReady()
    fireEvent.click(screen.getByRole('button', { name: '開始今天訓練' }))

    fireEvent.click(await screen.findByRole('button', { name: '結束（這次沒有紀錄）' }))
    fireEvent.click(await screen.findByRole('button', { name: '結束，不留紀錄' }))

    await screen.findByRole('button', { name: '開始今天訓練' })
    expect((await db.loadSessions()).length).toBe(sessionsBefore)
    expect((await db.loadState())?.cursor).toBe(cursor)
    expect(screen.getByText(current.name)).toBeTruthy()
    expect((await db.loadDraft()) ?? null).toBeNull()
  })
})

describe('分頁切換', () => {
  it('四個分頁都打得開', async () => {
    renderApp()
    await waitForReady()

    fireEvent.click(screen.getByRole('button', { name: /紀錄/ }))
    expect(await screen.findByRole('button', { name: '訓練紀錄' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /進度/ }))
    expect(await screen.findByText('臥推主力重組')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /設定/ }))
    expect(await screen.findByRole('button', { name: '下載備份檔' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /今天/ }))
    expect(await screen.findByRole('button', { name: /開始今天訓練|繼續這次訓練/ })).toBeTruthy()
  })
})
