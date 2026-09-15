import { useMemo, useState } from 'react'
import { DAYS } from '../program/days'
import type { WeekMode } from '../program/types'
import { countThisWeek, nextDay, positionInCycle } from '../engine/sequence'
import { assessFatigue } from '../engine/fatigue'
import { formatRelativeDay, toDateKey } from '../engine/dates'
import { formatWeight } from '../engine/units'
import { benchTopSetTrend, sessionDateKeys } from '../store/selectors'
import { useAppData } from './store'

export function HomeScreen({ onStart }: { onStart: () => void }) {
  const {
    state,
    sessions,
    bodyWeight,
    draft,
    persisted,
    setMode,
    startSession,
    recordBodyWeight,
  } = useAppData()
  const [weightInput, setWeightInput] = useState('')

  const upcoming = draft ? DAYS[draft.dayId] : DAYS[nextDay(state.mode, state.cursor)]
  const lastSession = sessions[0]
  const doneThisWeek = useMemo(
    () => countThisWeek(sessionDateKeys(sessions)),
    [sessions],
  )
  const fatigue = useMemo(
    () =>
      assessFatigue({
        recentConditions: sessions.slice(0, 3).map((s) => s.condition),
        benchTrend: benchTopSetTrend(sessions).map((p) => p.e1rm),
      }),
    [sessions],
  )
  const latestWeight = bodyWeight[bodyWeight.length - 1]
  const todayKey = toDateKey()

  async function handleStart() {
    if (!draft) await startSession()
    onStart()
  }

  async function submitWeight() {
    const value = Number(weightInput)
    if (!Number.isFinite(value) || value <= 0) return
    await recordBodyWeight(todayKey, value)
    setWeightInput('')
  }

  return (
    <>
      <div className="section-title">今天</div>
      <div className="card">
        <h1 className="card__title" style={{ fontSize: 24 }}>
          {upcoming.name}
          <span className="muted" style={{ fontWeight: 400 }}>
            ｜{upcoming.subtitle}
          </span>
        </h1>
        <div className="card__sub">
          循環第 {positionInCycle(state.mode, state.cursor)} / {state.mode} 堂
          {draft && ' ．有一次訓練還沒結束'}
        </div>

        <div className="row row--between" style={{ marginTop: 14 }}>
          <div>
            <div className="small muted">上次</div>
            <div>
              {lastSession
                ? `${DAYS[lastSession.dayId].name}．${formatRelativeDay(lastSession.date)}`
                : '還沒有紀錄'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="small muted">本週</div>
            <div>
              {doneThisWeek} / {state.mode}
            </div>
          </div>
        </div>

        <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={handleStart}>
          {draft ? '繼續這次訓練' : '開始今天訓練'}
        </button>
      </div>

      {fatigue.level === 'caution' && (
        <div className="banner banner--warn">
          <strong>{fatigue.message}</strong>
          <div className="small muted" style={{ marginTop: 4 }}>
            {fatigue.reasons.join('、')}
          </div>
        </div>
      )}

      <div className="section-title">本週訓練幾天</div>
      <div className="segmented">
        {([4, 5] as WeekMode[]).map((mode) => (
          <button
            key={mode}
            className={`segmented__item${state.mode === mode ? ' segmented__item--active' : ''}`}
            onClick={() => void setMode(mode)}
          >
            {mode} 天
          </button>
        ))}
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>
        隨時可以改。已經做完的不動，只影響接下來的課表。
        {state.mode === 4
          ? '四天把第二次推＋拉合併成上肢 B。'
          : '五天把上肢 B 拆成推日 B ＋ 拉日 B。'}
      </div>

      <div className="section-title">體重</div>
      <div className="card">
        <div className="row row--between">
          <div>
            <div className="big-number">
              {latestWeight ? `${formatWeight(latestWeight.weight)} kg` : '—'}
            </div>
            <div className="small muted">
              {latestWeight ? formatRelativeDay(latestWeight.date) : '還沒有紀錄'}
            </div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <input
            type="number"
            inputMode="decimal"
            step={0.1}
            placeholder="今天體重 kg"
            aria-label="今天體重"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
          />
          <button className="btn btn--sm" onClick={submitWeight} style={{ minHeight: 48 }}>
            記錄
          </button>
        </div>
      </div>

      {!persisted && (
        <div className="banner banner--info small">
          把這個網站加入 iPhone 主畫面，資料才不容易被 Safari 清掉。
          記得定期到「設定」頁匯出 JSON 備份。
        </div>
      )}
    </>
  )
}
