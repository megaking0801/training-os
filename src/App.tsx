import { lazy, Suspense, useState } from 'react'
import { HomeScreen } from './ui/HomeScreen'
import { SessionScreen } from './ui/SessionScreen'
import { HistoryScreen } from './ui/HistoryScreen'
import { SettingsScreen } from './ui/SettingsScreen'
import { useAppData } from './ui/store'

// 圖表庫佔了大半個 bundle，但健身房裡只會用到首頁與訓練畫面，
// 所以進度頁等到真的打開才載。
const ProgressScreen = lazy(() =>
  import('./ui/ProgressScreen').then((m) => ({ default: m.ProgressScreen })),
)

type Tab = 'home' | 'history' | 'progress' | 'settings'

const TABS: { id: Tab; label: string; glyph: string }[] = [
  { id: 'home', label: '今天', glyph: '🏋️' },
  { id: 'history', label: '紀錄', glyph: '📋' },
  { id: 'progress', label: '進度', glyph: '📈' },
  { id: 'settings', label: '設定', glyph: '⚙️' },
]

export function App() {
  const { ready, draft } = useAppData()
  const [tab, setTab] = useState<Tab>('home')
  const [inSession, setInSession] = useState(false)

  if (!ready) return <div className="spinner">載入中…</div>

  // 訓練畫面佔滿整頁，避免在健身房誤觸切到別的分頁。
  const showSession = inSession && draft !== null

  return (
    <div className="app">
      <main className="app__main">
        {showSession ? (
          <SessionScreen
            onDone={() => {
              setInSession(false)
              setTab('home')
            }}
          />
        ) : (
          <>
            {tab === 'home' && <HomeScreen onStart={() => setInSession(true)} />}
            {tab === 'history' && <HistoryScreen />}
            {tab === 'progress' && (
              <Suspense fallback={<div className="empty">載入圖表…</div>}>
                <ProgressScreen />
              </Suspense>
            )}
            {tab === 'settings' && <SettingsScreen />}
          </>
        )}
      </main>

      {!showSession && (
        <nav className="tabbar">
          {TABS.map((item) => (
            <button
              key={item.id}
              className={`tabbar__item${tab === item.id ? ' tabbar__item--active' : ''}`}
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? 'page' : undefined}
            >
              <span className="tabbar__glyph" aria-hidden>
                {item.glyph}
              </span>
              {item.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
