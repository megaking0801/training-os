/**
 * 加到主畫面之後沒有網址列，也沒有下拉刷新，所以要自己提供重新載入的方法。
 *
 * 冷啟動（把 App 從切換器滑掉再打開、重開機）本來就會檢查 sw.js 並自動更新。
 * 這裡處理的是另外兩種情況：iOS 把 App 從記憶體還原時不會檢查更新，
 * 以及畫面卡住想直接重整。
 */

/** 前景檢查更新的最短間隔。訊號差的地方不要每次切回來都打網路。 */
export const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000

/**
 * 主動問伺服器有沒有新版。
 *
 * 失敗不往外拋：離線或伺服器掛掉都不該擋住使用者重整畫面。
 */
export async function checkForUpdate(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    await registration?.update()
  } catch {
    // 當作沒有新版，照樣往下走。
  }
}

/**
 * 檢查更新後重新載入。
 *
 * 如果真的有新版，vite-plugin-pwa 的 autoUpdate 會在新的 service worker
 * 啟用時自己呼叫一次 reload，跟這裡的 reload 可能都會觸發。結果仍然正確
 * ——最後一次載入一定由新的 service worker 接管——只是偶爾會連閃兩下。
 *
 * `reload` 可以注入，因為 jsdom 沒有實作 location.reload。
 */
export async function reloadApp(reload: () => void = () => window.location.reload()): Promise<void> {
  await checkForUpdate()
  reload()
}

/**
 * App 從背景回到前景時檢查更新，有節流。
 *
 * 回傳取消監聽的函式。
 */
export function watchForUpdatesOnForeground(
  registration: ServiceWorkerRegistration,
  now: () => number = Date.now,
): () => void {
  let lastChecked = now()

  const check = () => {
    if (document.visibilityState !== 'visible') return
    if (now() - lastChecked < UPDATE_CHECK_INTERVAL_MS) return
    lastChecked = now()
    void registration.update().catch(() => {})
  }

  document.addEventListener('visibilitychange', check)
  return () => document.removeEventListener('visibilitychange', check)
}
