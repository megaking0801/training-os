import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { AppDataProvider } from './ui/store'
import './ui/styles.css'

// 有新版就直接換掉。健身房裡不適合跳「要不要更新」的對話框。
registerSW({ immediate: true })

const container = document.getElementById('root')
if (!container) throw new Error('找不到 #root')

createRoot(container).render(
  <StrictMode>
    <AppDataProvider>
      <App />
    </AppDataProvider>
  </StrictMode>,
)
