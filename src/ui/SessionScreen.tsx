import { useEffect, useMemo, useRef, useState } from 'react'
import { DAYS } from '../program/days'
import { getExercise } from '../program/exercises'
import { suggestForDay } from '../engine/day'
import { suggest } from '../engine/progression'
import { assessFatigue } from '../engine/fatigue'
import { formatDuration } from '../engine/units'
import { benchTopSetTrend, lastEntryByTrack } from '../store/selectors'
import { CONDITION_LABEL, type Condition, type SessionEntry } from '../store/types'
import { RestTimer, remainingSeconds, type RestState } from './RestTimer'
import { ExerciseCard } from './ExerciseCard'
import { useAppData } from './store'

const CONDITIONS = Object.keys(CONDITION_LABEL) as Condition[]

export function SessionScreen({ onDone }: { onDone: () => void }) {
  const { draft, sessions, state, updateEntry, finishSession, discardDraft } = useAppData()
  const [rest, setRest] = useState<RestState | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [condition, setCondition] = useState<Condition>('normal')
  const [note, setNote] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const beeped = useRef(false)

  const startedAt = draft?.startedAt
  useEffect(() => {
    if (!startedAt) return
    const tick = () => setElapsed(Math.round((Date.now() - startedAt) / 1000))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [startedAt])

  // 休息結束震一下。iOS 不支援 vibrate 就靜靜略過。
  useEffect(() => {
    if (!rest || rest.endsAt === null) return
    beeped.current = false
    const id = window.setInterval(() => {
      if (beeped.current) return
      if (remainingSeconds(rest, Date.now()) > 0) return
      beeped.current = true
      navigator.vibrate?.([120, 60, 120])
    }, 300)
    return () => window.clearInterval(id)
  }, [rest])

  const lastByTrack = useMemo(() => lastEntryByTrack(sessions), [sessions])
  const fatigue = useMemo(
    () =>
      assessFatigue({
        recentConditions: sessions.slice(0, 3).map((s) => s.condition),
        benchTrend: benchTopSetTrend(sessions).map((p) => p.e1rm),
      }),
    [sessions],
  )

  const day = draft ? DAYS[draft.dayId] : null

  /**
   * 降重工作組的重量要跟著「今天實際推了多少」，不是跟著建議值，
   * 所以主力重組一記完就重算。
   */
  const suggestions = useMemo(() => {
    if (!day || !draft) return {}
    const base = suggestForDay(day, lastByTrack, state.incrementOverrides)
    for (const slot of day.slots) {
      if (slot.progression !== 'backoff' || !slot.derivedFrom) continue
      const source = draft.entries.find((e) => e.trackId === slot.derivedFrom!.trackId)
      if (!source || source.sets.length === 0) continue
      base[slot.trackId] = suggest({
        slot,
        baseWeight: Math.max(...source.sets.map((s) => s.weight)),
        incrementOverride: state.incrementOverrides[slot.exerciseId],
      })
    }
    return base
  }, [day, draft, lastByTrack, state.incrementOverrides])

  if (!draft || !day) return null

  const entryFor = (trackId: string) => draft.entries.find((e) => e.trackId === trackId)

  const loggedSets = draft.entries.reduce((sum, e) => sum + e.sets.length, 0)
  // 今天不做的動作要從分母扣掉，否則進度永遠看起來沒做完。
  const plannedSets = day.slots.reduce(
    (sum, slot) => (entryFor(slot.trackId)?.skipped ? sum : sum + slot.sets),
    0,
  )

  // 現在該做的動作：第一個還沒做滿組數、而且今天有要做的。全部做完就沒有。
  const activeTrackId = day.slots.find((slot) => {
    const entry = entryFor(slot.trackId)
    if (entry?.skipped) return false
    return (entry?.sets.length ?? 0) < slot.sets
  })?.trackId

  function startRest(seconds: number) {
    setRest({ total: seconds, endsAt: Date.now() + seconds * 1000, paused: seconds })
  }

  function add30() {
    setRest((current) => {
      if (!current) return current
      if (current.endsAt === null) return { ...current, paused: current.paused + 30 }
      return { ...current, endsAt: current.endsAt + 30_000 }
    })
  }

  function togglePause() {
    setRest((current) => {
      if (!current) return current
      if (current.endsAt === null) {
        return { ...current, endsAt: Date.now() + current.paused * 1000 }
      }
      return { ...current, endsAt: null, paused: remainingSeconds(current, Date.now()) }
    })
  }

  async function handleFinish() {
    await finishSession({ condition, ...(note.trim() ? { note: note.trim() } : {}) })
    onDone()
  }

  async function handleDiscard() {
    if (!window.confirm('要放棄這次訓練嗎？已經記的組數會全部刪掉。')) return
    await discardDraft()
    onDone()
  }

  return (
    <>
      <div className="row row--between" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="card__title" style={{ fontSize: 22 }}>
            {day.name}
          </h1>
          <div className="card__sub">{day.subtitle}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="big-number" style={{ fontSize: 22 }}>
            {formatDuration(elapsed)}
          </div>
          <div className="small muted">
            {loggedSets} / {plannedSets} 組
          </div>
        </div>
      </div>

      {fatigue.level === 'caution' && (
        <div className="banner banner--warn">
          <strong>{fatigue.message}</strong>
          <div className="small muted" style={{ marginTop: 4 }}>
            {fatigue.reasons.join('、')}
          </div>
        </div>
      )}

      {day.slots.map((slot) => {
        const entry =
          entryFor(slot.trackId) ??
          ({ trackId: slot.trackId, exerciseId: slot.exerciseId, sets: [] } as SessionEntry)
        return (
          <ExerciseCard
            key={slot.trackId}
            slot={slot}
            exercise={getExercise(slot.exerciseId)}
            suggestion={suggestions[slot.trackId] ?? { action: 'start', message: '' }}
            lastEntry={lastByTrack[slot.trackId]}
            entry={entry}
            cautious={fatigue.level === 'caution'}
            active={slot.trackId === activeTrackId}
            onChange={(next) => void updateEntry(next)}
            onSetLogged={startRest}
          />
        )
      })}

      {!finishing ? (
        <button
          className="btn btn--primary"
          style={{ marginTop: 16 }}
          onClick={() => setFinishing(true)}
        >
          {loggedSets === 0 ? '結束（這次沒有紀錄）' : '結束訓練'}
        </button>
      ) : loggedSets === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 className="card__title">這次一組都沒記</h2>
          <div className="card__sub" style={{ marginTop: 6 }}>
            不會留下紀錄，課表也不會往前走 — 下次打開還是{day.name}。 如果是這堂不想做了，請回首頁按「跳過這堂」。
          </div>
          <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={handleFinish}>
            結束，不留紀錄
          </button>
          <button
            className="btn btn--ghost"
            style={{ marginTop: 8 }}
            onClick={() => setFinishing(false)}
          >
            再練一下
          </button>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 className="card__title">今日狀態</h2>
          <div className="row row--wrap" style={{ margin: '10px 0 14px' }}>
            {CONDITIONS.map((key) => (
              <button
                key={key}
                className={`pill${condition === key ? ' pill--accent' : ''}`}
                onClick={() => setCondition(key)}
                style={{ minHeight: 40, padding: '0 14px' }}
              >
                {CONDITION_LABEL[key]}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            placeholder="備註（選填）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={handleFinish}>
            儲存並完成
          </button>
          <button
            className="btn btn--ghost"
            style={{ marginTop: 8 }}
            onClick={() => setFinishing(false)}
          >
            再練一下
          </button>
        </div>
      )}

      <button className="btn btn--ghost btn--danger" style={{ marginTop: 12 }} onClick={handleDiscard}>
        放棄這次訓練
      </button>

      {rest && (
        <RestTimer
          rest={rest}
          onAdd30={add30}
          onTogglePause={togglePause}
          onSkip={() => setRest(null)}
        />
      )}
    </>
  )
}
