import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { AppDataProvider } from './ui/store'
import { watchForUpdatesOnForeground } from './ui/appUpdate'
import './ui/styles.css'

// 有新版就直接換掉。健身房裡不適合跳「要不要更新」的對話框。
//
// 冷啟動本來就會檢查 sw.js，但 iOS 常常只是把 PWA 從記憶體還原，
// 那時不會有導航、也就不會檢查。補一個回前景時的節流檢查。
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (registration) watchForUpdatesOnForeground(registration)
  },
})

const container = document.getElementById('root')
if (!container) throw new Error('找不到 #root')

createRoot(container).render(
  <StrictMode>
    <AppDataProvider>
      <App />
    </AppDataProvider>
  </StrictMode>,
)
