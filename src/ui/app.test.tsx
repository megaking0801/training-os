// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from '../App'
import { AppDataProvider } from './store'
import * as db from '../store/db'

/**
 * 端對端煙霧測試：真的把 App 掛起來、開始一堂訓練、記一組、完成，
 * 再確認資料有寫進 IndexedDB、課表有往下移一堂。
 *
 * 這是在沒有 iPhone 的情況下唯一能驗證整條流程接得起來的方式。
 */

vi.mock('virtual:pwa-register', () => ({ registerSW: () => () => {} }))

afterEach(cleanup)

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
    fireEvent.change(screen.getByLabelText(`${bench} 本組保留次數`), { target: { value: '1' } })
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
    // 把課表轉回推日 A。
    await waitFor(() => expect(screen.getByText('拉日 A')).toBeTruthy())
    for (const expected of ['拉日 A', '腿部日', '上肢 B']) {
      expect(screen.getByText(expected)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: '開始今天訓練' }))
      fireEvent.click(await screen.findByRole('button', { name: '結束訓練' }))
      fireEvent.click(screen.getByRole('button', { name: '儲存並完成' }))
      await waitFor(() => expect(screen.queryByRole('button', { name: '結束訓練' })).toBeNull())
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
