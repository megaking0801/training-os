/**
 * 在 iPhone 尺寸下把每個畫面截圖出來。
 *
 * 這個專案沒有真機可以測，CSS 又全部是手寫的，所以用系統上的 Chrome
 * 把畫面真的畫出來看一遍，比對著 CSS 猜可靠。
 *
 *   node scripts/screenshot.mjs [http://localhost:4173/training-os/]
 */
import { mkdirSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = process.argv[2] ?? 'http://localhost:4173/training-os/'
const OUT = process.env.SHOT_DIR ?? join(process.cwd(), 'screenshots')

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]

function findBrowser() {
  const found = CHROME_CANDIDATES.find((path) => existsSync(path))
  if (!found) throw new Error('找不到 Chrome 或 Edge')
  return found
}

// iPhone 14 的邏輯解析度。這是這個 App 的主要目標尺寸。
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }

mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: findBrowser(),
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const page = await browser.newPage()
await page.setViewport(VIEWPORT)

// 真瀏覽器會被 window.confirm 擋住，一律按確定。
page.on('dialog', (dialog) => dialog.accept())

const shots = []
async function shot(name, { full = false } = {}) {
  const file = join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: full })
  shots.push(name)
  console.log(`  ${name}${full ? ' (full)' : ''}`)
}

/** 依可見文字點按鈕。 */
async function clickText(text) {
  const handle = await page.evaluateHandle((wanted) => {
    const buttons = [...document.querySelectorAll('button')]
    return buttons.find((b) => b.textContent?.trim().includes(wanted)) ?? null
  }, text)
  const element = handle.asElement()
  if (!element) {
    const available = await page.evaluate(() =>
      [...document.querySelectorAll('button')].map((b) => b.textContent?.trim().slice(0, 30)),
    )
    console.error('找不到按鈕：' + text)
    console.error('畫面上的按鈕：', available)
    throw new Error('找不到按鈕：' + text)
  }
  await element.click()
  await new Promise((r) => setTimeout(r, 350))
}

async function fill(label, value) {
  const handle = await page.evaluateHandle(
    (l) => document.querySelector(`[aria-label="${l}"]`),
    label,
  )
  const element = handle.asElement()
  if (!element) throw new Error(`找不到欄位：${label}`)
  await element.click({ clickCount: 3 })
  await element.type(String(value))
}

console.log(`看 ${BASE}`)
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.waitForSelector('.app__main')
await new Promise((r) => setTimeout(r, 500))

await shot('01-home')

await clickText('開始今天訓練')
await shot('02-session-top')
await shot('02-session-full', { full: true })

// 記一組，看休息計時器與已完成的列。
await fill('槓鈴臥推－主力重組 本組重量', '72.5')
await fill('槓鈴臥推－主力重組 本組次數', '5')
await clickText('還能 1 下')
await clickText('完成這一組')
await shot('03-after-set')
await shot('03-after-set-full', { full: true })

// 休息計時器是浮在最上層的，先收掉才點得到頁面底部的按鈕。
await clickText('跳過')
await clickText('結束訓練')
await shot('04-finish')

await clickText('再練一下')
await clickText('放棄這次訓練')
await new Promise((r) => setTimeout(r, 400))

for (const [tab, name] of [
  ['紀錄', '05-history'],
  ['進度', '06-progress'],
  ['設定', '07-settings'],
]) {
  await clickText(tab)
  await new Promise((r) => setTimeout(r, 700))
  await shot(name)
  await shot(`${name}-full`, { full: true })
}

await browser.close()
console.log(`\n${shots.length} 張，存在 ${OUT}`)
