import { useMemo, useState } from 'react'
import { DAYS } from '../program/days'
import { EXERCISES, getExercise } from '../program/exercises'
import { formatDuration, formatWeight } from '../engine/units'
import { formatShortDate, formatRelativeDay } from '../engine/dates'
import { exerciseHistory } from '../store/selectors'
import { CONDITION_LABEL } from '../store/types'
import { useAppData } from './store'

type Tab = 'sessions' | 'exercise'

export function HistoryScreen() {
  const { sessions, deleteSession } = useAppData()
  const [tab, setTab] = useState<Tab>('sessions')
  const [openId, setOpenId] = useState<string | null>(null)
  const [exerciseId, setExerciseId] = useState<string>('barbellBench')

  const history = useMemo(
    () => exerciseHistory(sessions, exerciseId),
    [exerciseId, sessions],
  )

  async function handleDelete(id: string) {
    if (!window.confirm('刪除這筆訓練紀錄？刪掉之後「上次」與趨勢圖都會跟著變。')) return
    await deleteSession(id)
  }

  return (
    <>
      <div className="segmented" style={{ marginBottom: 16 }}>
        <button
          className={`segmented__item${tab === 'sessions' ? ' segmented__item--active' : ''}`}
          onClick={() => setTab('sessions')}
        >
          訓練紀錄
        </button>
        <button
          className={`segmented__item${tab === 'exercise' ? ' segmented__item--active' : ''}`}
          onClick={() => setTab('exercise')}
        >
          單一動作
        </button>
      </div>

      {tab === 'sessions' &&
        (sessions.length === 0 ? (
          <div className="empty">還沒有訓練紀錄。</div>
        ) : (
          sessions.map((session) => {
            const open = openId === session.id
            const day = DAYS[session.dayId]
            const setCount = session.entries.reduce((sum, e) => sum + e.sets.length, 0)
            return (
              <section key={session.id} className="exercise">
                <button
                  className="exercise__head"
                  onClick={() => setOpenId(open ? null : session.id)}
                  aria-expanded={open}
                >
                  <span className="grow">
                    <span className="exercise__name">
                      {formatShortDate(session.date)}　{day.name}
                    </span>
                    <span className="exercise__meta">
                      {setCount} 組．{formatDuration(session.durationSec)}
                      {session.condition && `．${CONDITION_LABEL[session.condition]}`}
                    </span>
                  </span>
                  <span className="muted" aria-hidden>
                    {open ? '▾' : '▸'}
                  </span>
                </button>
                {open && (
                  <div className="exercise__body">
                    {session.entries.map((entry) => (
                      <div key={entry.trackId} className="kv" style={{ alignItems: 'flex-start' }}>
                        <span>{getExercise(entry.exerciseId).name}</span>
                        <span style={{ textAlign: 'right' }}>
                          {entry.sets.map((set, i) => (
                            <span key={i} style={{ display: 'block' }}>
                              {formatWeight(set.weight)} × {set.reps}
                              <span className="muted small">　保留 {set.rir}</span>
                            </span>
                          ))}
                        </span>
                      </div>
                    ))}
                    {session.note && (
                      <div className="small muted" style={{ marginTop: 10 }}>
                        備註：{session.note}
                      </div>
                    )}
                    <button
                      className="btn btn--ghost btn--danger btn--sm"
                      style={{ marginTop: 12, width: '100%' }}
                      onClick={() => handleDelete(session.id)}
                    >
                      刪除這筆
                    </button>
                  </div>
                )}
              </section>
            )
          })
        ))}

      {tab === 'exercise' && (
        <>
          <select
            aria-label="選擇動作"
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            style={{ minHeight: 48, marginBottom: 12 }}
          >
            {Object.values(EXERCISES).map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>

          {history.length === 0 ? (
            <div className="empty">這個動作還沒有紀錄。</div>
          ) : (
            <div className="card">
              {history.map((item, index) => (
                <div key={`${item.date}-${item.trackId}-${index}`} className="kv">
                  <span>
                    {formatShortDate(item.date)}
                    <span className="muted small">　{formatRelativeDay(item.date)}</span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    {item.sets.map((set, i) => (
                      <span key={i} style={{ display: 'block' }}>
                        {formatWeight(set.weight)} × {set.reps}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
