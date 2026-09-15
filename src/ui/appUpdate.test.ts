// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UPDATE_CHECK_INTERVAL_MS, reloadApp, watchForUpdatesOnForeground } from './appUpdate'

/** 裝一個假的 navigator.serviceWorker，回傳它的 update spy。 */
function stubServiceWorker(update: () => Promise<void>) {
  const registration = { update: vi.fn(update) }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: () => Promise.resolve(registration) },
  })
  return registration
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker')
  Reflect.deleteProperty(document, 'visibilityState')
  vi.restoreAllMocks()
})

describe('重新載入 App', () => {
  it('先問伺服器有沒有新版，再重整', async () => {
    const registration = stubServiceWorker(() => Promise.resolve())
    const reload = vi.fn()

    await reloadApp(reload)

    expect(registration.update).toHaveBeenCalledOnce()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('檢查更新失敗也照樣重整', async () => {
    stubServiceWorker(() => Promise.reject(new Error('離線')))
    const reload = vi.fn()

    await reloadApp(reload)

    expect(reload).toHaveBeenCalledOnce()
  })

  it('瀏覽器不支援 service worker 也照樣重整', async () => {
    const reload = vi.fn()

    await reloadApp(reload)

    expect(reload).toHaveBeenCalledOnce()
  })
})

describe('回到前景時檢查更新', () => {
  function setup() {
    const registration = { update: vi.fn(() => Promise.resolve()) }
    let now = 1_000_000
    const stop = watchForUpdatesOnForeground(
      registration as unknown as ServiceWorkerRegistration,
      () => now,
    )
    return {
      registration,
      stop,
      advance: (ms: number) => {
        now += ms
      },
      foreground: () => {
        setVisibility('visible')
        document.dispatchEvent(new Event('visibilitychange'))
      },
      background: () => {
        setVisibility('hidden')
        document.dispatchEvent(new Event('visibilitychange'))
      },
    }
  }

  it('間隔夠久才檢查', () => {
    const app = setup()

    app.foreground()
    expect(app.registration.update).not.toHaveBeenCalled()

    app.advance(UPDATE_CHECK_INTERVAL_MS + 1)
    app.foreground()
    expect(app.registration.update).toHaveBeenCalledOnce()

    app.stop()
  })

  it('連續切回前景不會一直打網路', () => {
    const app = setup()

    app.advance(UPDATE_CHECK_INTERVAL_MS + 1)
    app.foreground()
    app.foreground()
    app.foreground()

    expect(app.registration.update).toHaveBeenCalledOnce()
    app.stop()
  })

  it('切到背景不檢查', () => {
    const app = setup()

    app.advance(UPDATE_CHECK_INTERVAL_MS + 1)
    app.background()

    expect(app.registration.update).not.toHaveBeenCalled()
    app.stop()
  })

  it('取消監聽之後不再檢查', () => {
    const app = setup()

    app.stop()
    app.advance(UPDATE_CHECK_INTERVAL_MS + 1)
    app.foreground()

    expect(app.registration.update).not.toHaveBeenCalled()
  })
})
