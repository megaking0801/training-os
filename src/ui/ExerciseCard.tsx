import { useMemo, useState } from 'react'
import type { Exercise, Slot } from '../program/types'
import type { LoggedSet, Suggestion, TrackEntry } from '../engine/types'
import { formatWeight } from '../engine/units'
import { formatRelativeDay } from '../engine/dates'
import { buildWarmup } from '../engine/warmup'
import type { SessionEntry } from '../store/types'

interface Props {
  slot: Slot
  exercise: Exercise
  suggestion: Suggestion
  lastEntry: TrackEntry | undefined
  entry: SessionEntry
  /** 疲勞提醒觸發時，加重建議旁邊多一句話。 */
  cautious: boolean
  /** 是不是現在該做的那個動作。只有它預設展開，其他收起來少捲一點。 */
  active: boolean
  onChange: (entry: SessionEntry) => void
  /** 記完一組之後開始休息倒數。 */
  onSetLogged: (restSeconds: number) => void
}

function rangeText([low, high]: [number, number]): string {
  return low === high ? `${low}` : `${low}–${high}`
}

/** 組成「30 × 10 保留 1」這種一行摘要。 */
function describeSets(sets: LoggedSet[]): string {
  return sets.map((s) => `${formatWeight(s.weight)} × ${s.reps}`).join('、')
}

/**
 * 下一組的預填值。Handoff §28：能不打字就不要打字。
 *
 * 優先用本次已經記過的那一組，其次用上次同一組的數字，最後才回到課表目標。
 */
function prefill(
  slot: Slot,
  suggestion: Suggestion,
  lastEntry: TrackEntry | undefined,
  logged: LoggedSet[],
): LoggedSet {
  const previousThisSession = logged[logged.length - 1]
  if (previousThisSession) return { ...previousThisSession }

  const lastSame = lastEntry?.sets[0]
  return {
    weight: suggestion.weight ?? lastSame?.weight ?? 0,
    reps: lastSame?.reps ?? slot.reps[0],
    rir: lastSame?.rir ?? slot.rir[1],
  }
}

function NumberField({
  label,
  value,
  step,
  onChange,
}: {
  label: string
  value: number
  step: number
  onChange: (n: number) => void
}) {
  return (
    <div className="setrow__field">
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        aria-label={label}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        onFocus={(e) => e.target.select()}
      />
    </div>
  )
}

export function ExerciseCard({
  slot,
  exercise,
  suggestion,
  lastEntry,
  entry,
  cautious,
  active,
  onChange,
  onSetLogged,
}: Props) {
  const complete = entry.sets.length >= slot.sets
  // 使用者手動開合之後就照他的意思，沒動過的卡片跟著「現在做到哪」走。
  const [manualOpen, setManualOpen] = useState<boolean | null>(null)
  const open = manualOpen ?? active
  const [nextSet, setNextSet] = useState<LoggedSet>(() =>
    prefill(slot, suggestion, lastEntry, entry.sets),
  )

  const warmup = useMemo(
    () =>
      slot.progression === 'benchTopSet' && entry.sets.length === 0
        ? buildWarmup(suggestion.weight ?? 0)
        : [],
    [entry.sets.length, slot.progression, suggestion.weight],
  )

  const title = slot.label ?? exercise.name
  const perSide = slot.perSide ? '每側 ' : ''

  function commitSet() {
    const sets = [...entry.sets, { ...nextSet }]
    onChange({ ...entry, sets })
    setNextSet({ ...nextSet })
    onSetLogged(slot.restSeconds)
  }

  function editSet(index: number, patch: Partial<LoggedSet>) {
    const sets = entry.sets.map((s, i) => (i === index ? { ...s, ...patch } : s))
    onChange({ ...entry, sets })
  }

  function removeSet(index: number) {
    onChange({ ...entry, sets: entry.sets.filter((_, i) => i !== index) })
  }

  return (
    <section className={`exercise${complete ? ' exercise--done' : ''}`}>
      <button className="exercise__head" onClick={() => setManualOpen(!open)} aria-expanded={open}>
        <span className={`exercise__check${complete ? ' exercise__check--done' : ''}`}>
          {complete ? '✓' : ''}
        </span>
        <span className="grow">
          <span className="exercise__name">{title}</span>
          <span className="exercise__meta">
            {slot.sets} 組 × {perSide}
            {rangeText(slot.reps)} 下．保留 {rangeText(slot.rir)} 下
            {entry.sets.length > 0 && ` ．已記 ${entry.sets.length} 組`}
          </span>
        </span>
        <span className="muted" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="exercise__body">
          <div className="laststat">
            上次：
            {lastEntry ? (
              <>
                <strong>{describeSets(lastEntry.sets)}</strong>{' '}
                <span className="small">（{formatRelativeDay(lastEntry.date)}）</span>
              </>
            ) : (
              <strong>沒有紀錄</strong>
            )}
          </div>

          {suggestion.message && (
            <div
              className={`suggestion${suggestion.action === 'increase' ? ' suggestion--increase' : ''}`}
            >
              {suggestion.message}
              {cautious && suggestion.action === 'increase' && (
                <div className="small muted" style={{ marginTop: 4 }}>
                  這幾次狀態不太好，維持原重量也可以。
                </div>
              )}
            </div>
          )}

          {slot.note && (
            <div className="suggestion small" style={{ color: 'var(--muted)' }}>
              {slot.note}
            </div>
          )}

          {warmup.length > 0 && (
            <div className="suggestion small">
              <div style={{ marginBottom: 4 }}>暖身（不算工作組）</div>
              {warmup.map((step, i) => (
                <div key={i} className="muted">
                  {step.isEmptyBar ? '空槓' : `${formatWeight(step.weight)} kg`} × {step.reps}
                </div>
              ))}
            </div>
          )}

          <div className="setrow__labels" aria-hidden>
            <span>組</span>
            <span>重量 kg</span>
            <span>{slot.perSide ? '每側次數' : '次數'}</span>
            <span>保留</span>
            <span />
          </div>

          <div className="setlist">
            {entry.sets.map((set, index) => (
              <div className="setrow" key={index}>
                <span className="setrow__index">{index + 1}</span>
                <NumberField
                  label={`${title} 第 ${index + 1} 組重量`}
                  value={set.weight}
                  step={0.5}
                  onChange={(weight) => editSet(index, { weight })}
                />
                <NumberField
                  label={`${title} 第 ${index + 1} 組次數`}
                  value={set.reps}
                  step={1}
                  onChange={(reps) => editSet(index, { reps })}
                />
                <NumberField
                  label={`${title} 第 ${index + 1} 組保留次數`}
                  value={set.rir}
                  step={1}
                  onChange={(rir) => editSet(index, { rir })}
                />
                <button
                  className="setrow__remove"
                  onClick={() => removeSet(index)}
                  aria-label={`${title} 刪除第 ${index + 1} 組`}
                >
                  ✕
                </button>
              </div>
            ))}

            <div className="setrow">
              <span className="setrow__index">{entry.sets.length + 1}</span>
              <NumberField
                label={`${title} 本組重量`}
                value={nextSet.weight}
                step={0.5}
                onChange={(weight) => setNextSet((s) => ({ ...s, weight }))}
              />
              <NumberField
                label={`${title} 本組次數`}
                value={nextSet.reps}
                step={1}
                onChange={(reps) => setNextSet((s) => ({ ...s, reps }))}
              />
              <NumberField
                label={`${title} 本組保留次數`}
                value={nextSet.rir}
                step={1}
                onChange={(rir) => setNextSet((s) => ({ ...s, rir }))}
              />
              <button
                className="setrow__remove"
                style={{ color: 'var(--accent)', fontSize: 22 }}
                onClick={commitSet}
                aria-label={`${title} 完成這一組`}
              >
                ✓
              </button>
            </div>
          </div>

          {complete && (
            <div className="small muted" style={{ marginTop: 10 }}>
              已完成 {entry.sets.length} 組。還想多做就直接再記一組。
            </div>
          )}
        </div>
      )}
    </section>
  )
}
