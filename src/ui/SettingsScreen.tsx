import { useRef, useState } from 'react'
import { EXERCISES } from '../program/exercises'
import { DEFAULT_INCREMENT, EQUIPMENT_LABEL } from '../program/types'
import { formatWeight } from '../engine/units'
import { formatShortDate } from '../engine/dates'
import { backupFileName } from '../store/backup'
import { reloadApp } from './appUpdate'
import { useAppData } from './store'

type Status = { kind: 'ok' | 'error'; text: string } | null

/**
 * 介面上會出現、但看字面猜不出意思的詞。定義沿用 Handoff §4、§10、§11、§17。
 */
const GLOSSARY: { term: string; meaning: string }[] = [
  {
    term: '保留次數',
    meaning:
      '做完這組時，在維持正常動作的前提下，你估計自己還能再做幾下。保留 2 下就是做完第 10 下之後，感覺最多還能再擠 2 下；保留 0 就是力竭。大部分工作組的目標是保留 1–2 下，大型複合動作不需要每組做到完全力竭。這格是所有加重建議的關卡：次數到了上限、而且保留次數仍然達標，才會建議你加重量。',
  },
  {
    term: '主力重組',
    meaning:
      '推日 A 的第一組槓鈴臥推，1 組 4–6 下、保留約 1 下。這是當天最重的一組，但不是在測最大重量。做到 6 下而且保留次數在 1 以內，下次就加 2–2.5 kg。',
  },
  {
    term: '降重工作組',
    meaning:
      '主力重組之後的 3 組，重量降到主力的 90–93%（大約少 7–10%），做 5–7 下。重量跟著主力重組走，不會自己演進，所以你今天主力推多少，它就自動換算多少。',
  },
  {
    term: '雙進展',
    meaning:
      '除了主力重組以外，大部分動作用的加重方式。重量先不動，把次數從區間下限一路推到上限（例如 8/8/8 推到 12/12/12）；三組都到上限而且保留次數達標，才加最小一級重量，然後次數回到低點重新往上推。',
  },
  {
    term: '推估單次最大重量',
    meaning:
      '用這組的重量與次數換算出「大概能做 1 下的重量」，只拿來看長期趨勢，不需要真的去測。次數越高誤差越大，所以超過 12 下就不換算。',
  },
]

/** build 時間戳轉成本機時區的「9/15 19:50」。 */
function formatBuildTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '未知'
  const time = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${date.getMonth() + 1}/${date.getDate()} ${time}`
}

export function SettingsScreen() {
  const {
    state,
    bodyWeight,
    sessions,
    persisted,
    setIncrement,
    exportJson,
    importJson,
    removeBodyWeight,
  } = useAppData()
  const [status, setStatus] = useState<Status>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function handleExport() {
    const json = exportJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = backupFileName()
    link.click()
    // 立刻 revoke 會讓 iOS 來不及開檔，延後一點再收。
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    setStatus({ kind: 'ok', text: '已產生備份檔。' })
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(exportJson())
      setStatus({ kind: 'ok', text: '備份 JSON 已複製到剪貼簿。' })
    } catch {
      setStatus({ kind: 'error', text: '複製失敗，請改用「下載備份檔」。' })
    }
  }

  async function handleImportFile(file: File) {
    if (!window.confirm('匯入會覆蓋目前手機上的所有資料。確定嗎？')) return
    try {
      await importJson(await file.text())
      setStatus({ kind: 'ok', text: '匯入完成。' })
    } catch (error) {
      setStatus({ kind: 'error', text: error instanceof Error ? error.message : '匯入失敗。' })
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <>
      <div className="section-title">App</div>
      <div className="card">
        <div className="row row--between">
          <span className="small muted">目前版本</span>
          <span className="small">{formatBuildTime(__APP_BUILT_AT__)}</span>
        </div>
        <button className="btn" style={{ marginTop: 12 }} onClick={() => void reloadApp()}>
          重新載入 App
        </button>
        <div className="small muted" style={{ marginTop: 10 }}>
          {'加到主畫面之後沒有網址列可以重新整理。畫面卡住、或想馬上拿到新版時按這裡。按完再回來看上面的版本時間有沒有變。'}
        </div>
      </div>

      <div className="section-title">資料備份</div>
      <div className="card">
        <div className="small muted" style={{ marginBottom: 12 }}>
          資料只存在這支手機上。目前有 {sessions.length} 筆訓練紀錄、{bodyWeight.length} 筆體重。換手機或清掉 Safari 資料之前一定要先匯出。
        </div>
        <button className="btn" onClick={handleExport}>
          下載備份檔
        </button>
        <button className="btn" style={{ marginTop: 8 }} onClick={handleCopy}>
          複製備份 JSON
        </button>
        <button
          className="btn"
          style={{ marginTop: 8 }}
          onClick={() => fileInput.current?.click()}
        >
          匯入備份檔
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleImportFile(file)
          }}
        />
        {status && (
          <div
            className={`banner ${status.kind === 'ok' ? 'banner--info' : 'banner--danger'} small`}
            style={{ marginTop: 12, marginBottom: 0 }}
          >
            {status.text}
          </div>
        )}
        <div className="small muted" style={{ marginTop: 12 }}>
          儲存空間保護：{persisted ? '已開啟' : '未開啟（把網站加入主畫面比較容易拿到）'}
        </div>
      </div>

      <div className="section-title">加重級距</div>
      <div className="card">
        <div className="small muted" style={{ marginBottom: 12 }}>
          「建議加重」會加這個數字。預設依器材類型，去健身房實際量過之後可以改。
        </div>
        {Object.values(EXERCISES).map((exercise) => {
          const fallback = DEFAULT_INCREMENT[exercise.equipment]
          const override = state.incrementOverrides[exercise.id]
          return (
            <div className="row row--between" key={exercise.id} style={{ padding: '8px 0' }}>
              <div className="grow">
                <div>{exercise.name}</div>
                <div className="small muted">
                  {EQUIPMENT_LABEL[exercise.equipment]}．預設 {formatWeight(fallback)} kg
                </div>
              </div>
              <input
                type="number"
                inputMode="decimal"
                step={0.5}
                min={0}
                aria-label={`${exercise.name} 加重級距`}
                placeholder={String(fallback)}
                value={override ?? ''}
                onChange={(e) =>
                  void setIncrement(exercise.id, e.target.value === '' ? null : Number(e.target.value))
                }
                style={{ width: 92, minHeight: 44, textAlign: 'center' }}
              />
            </div>
          )
        })}
      </div>

      <div className="section-title">名詞說明</div>
      <div className="card">
        {GLOSSARY.map((item) => (
          <div key={item.term} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontWeight: 600 }}>{item.term}</div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {item.meaning}
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">體重紀錄</div>
      <div className="card">
        {bodyWeight.length === 0 ? (
          <div className="empty" style={{ padding: '20px 0' }}>
            還沒有體重紀錄。
          </div>
        ) : (
          [...bodyWeight].reverse().map((record) => (
            <div className="kv" key={record.date}>
              <span>{formatShortDate(record.date)}</span>
              <span className="row" style={{ gap: 12 }}>
                <span>{formatWeight(record.weight)} kg</span>
                <button
                  className="muted"
                  aria-label={`刪除 ${record.date} 的體重`}
                  onClick={() => void removeBodyWeight(record.date)}
                >
                  ✕
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </>
  )
}
