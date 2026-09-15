import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the project site from /<repo>/ .
// Override with BASE_PATH=/ when deploying to a custom domain or user site.
const base = process.env.BASE_PATH ?? '/training-os/'

export default defineConfig({
  base,
  // 設定頁顯示這個時間，讓人看得出手機上跑的是不是最新版。
  define: {
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Training OS 健身管理',
        short_name: 'Training OS',
        description: '個人健身課表管理與訓練紀錄工具',
        lang: 'zh-Hant',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0e1116',
        theme_color: '#0e1116',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
