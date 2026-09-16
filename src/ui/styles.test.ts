import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 沒有真機可以跑各種機型，所以把版面上跟機型有關的規則直接對 CSS 斷言。
 *
 * index.html 用 viewport-fit=cover 加 black-translucent 狀態列，所以在
 * 「加入主畫面」模式下畫面會一路鋪到瀏海／Dynamic Island 底下。
 */

// 先把註解拿掉，免得選擇器前面的說明擋住比對。
const css = readFileSync(join(process.cwd(), 'src/ui/styles.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** 取出某個選擇器的宣告區塊。 */
function ruleBody(selector: string): string {
  const match = css.match(new RegExp(`(^|\\})\\s*${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`))
  if (!match?.[2]) throw new Error(`找不到 CSS 規則：${selector}`)
  return match[2]
}

describe('safe area', () => {
  it.each(['.app__main', '.app__main--session'])(
    '%s 的上方留白有加 safe-area-inset-top',
    (selector) => {
      expect(ruleBody(selector)).toContain('env(safe-area-inset-top')
    },
  )

  // 不支援 env() 的瀏覽器會讓整條宣告失效，連 16px 的基本留白都不見。
  // 補上第二個參數就會退回 0px，而不是整條規則作廢。
  it('每個 env(safe-area-inset-*) 都有備用值', () => {
    const missing = css.match(/env\(\s*safe-area-inset-(top|bottom|left|right)\s*\)/g)
    expect(missing).toBeNull()
  })

  it('左右留白會避開橫放時的瀏海', () => {
    expect(ruleBody('.app__main')).toContain('safe-area-inset-left')
    expect(ruleBody('.app__main')).toContain('safe-area-inset-right')
  })
})

describe('視窗高度', () => {
  // dvh 是 iOS 15.4 以後才有的，舊機要先給 vh 版本墊著。
  it('每個 100dvh 前面都有 100vh 備援', () => {
    const lines = css.split('\n')
    const offenders = lines
      .map((line, i) => ({ line: line.trim(), prev: (lines[i - 1] ?? '').trim(), no: i + 1 }))
      .filter((row) => row.line.includes('100dvh'))
      .filter((row) => !row.prev.includes('100vh'))
      .map((row) => `第 ${row.no} 行：${row.line}`)
    expect(offenders).toEqual([])
  })
})
