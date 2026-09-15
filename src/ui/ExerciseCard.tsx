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

/**
 * 保留次數的選項。按鈕直接寫意思，不寫數字，因為「保留 2」本身看不出是什麼。
 *
 * 「還能 3 下以上」一律存成 3。加重規則只看有沒有達到目標下限（1 或 2）
 * 以及臥推主力重組的 ≤1，所以 3 和 5 對演算法沒有差別。真的要記精確值，
 * 記完之後在上面那幾列的輸入框改就好。
 */
const RIR_CHOICES: { value: number; label: string }[] = [
  { value: 0, label: '力竭' },
  { value: 1, label: '還能 1 下' },
  { value: 2, label: '還能 2 下' },
  { value: 3, label: '還能 3 下以上' },
]

function rangeText([low, high]: [number, number]): string {
  return low === high ? `${low}` : `${low}–${high}`
}

/** 組成「30 × 10、30 × 9」這種一行摘要。 */
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
  const skipped = entry.skipped === true
  const complete = !skipped && entry.sets.length >= slot.sets
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
    onChange({ ...entry, sets: [...entry.sets, { ...nextSet }] })
    onSetLogged(slot.restSeconds)
  }

  function editSet(index: number, patch: Partial<LoggedSet>) {
    const sets = entry.sets.map((s, i) => (i === index ? { ...s, ...patch } : s))
    onChange({ ...entry, sets })
  }

  function removeSet(index: number) {
    onChange({ ...entry, sets: entry.sets.filter((_, i) => i !== index) })
  }

  function setSkipped(next: boolean) {
    onChange({ ...entry, skipped: next })
    // 跳過之後把卡片交還給「現在做到哪」的自動邏輯，不要卡在手動展開的狀態。
    setManualOpen(null)
  }

  const statusClass = skipped ? ' exercise--skipped' : complete ? ' exercise--done' : ''

  return (
    <section className={`exercise${statusClass}`}>
      <button className="exercise__head" onClick={() => setManualOpen(!open)} aria-expanded={open}>
        <span className={`exercise__check${complete ? ' exercise__check--done' : ''}`}>
          {complete ? '✓' : skipped ? '—' : ''}
        </span>
        <span className="grow">
          <span className="exercise__name">{title}</span>
          <span className="exercise__meta">
            {skipped ? (
              '今天沒做'
            ) : (
              <>
                {slot.sets} 組 × {perSide}
                {rangeText(slot.reps)} 下．保留 {rangeText(slot.rir)} 下
                {entry.sets.length > 0 && ` ．已記 ${entry.sets.length} 組`}
              </>
            )}
          </span>
        </span>
        <span className="muted" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && skipped && (
        <div className="exercise__body">
          <button className="btn" onClick={() => setSkipped(false)}>
            其實要做
          </button>
        </div>
      )}

      {open && !skipped && (
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

          {entry.sets.length > 0 && (
            <>
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
              </div>
            </>
          )}

          <div className="nextset">
            <div className="nextset__labels" aria-hidden>
              <span>組</span>
              <span>重量 kg</span>
              <span>{slot.perSide ? '每側次數' : '次數'}</span>
            </div>
            <div className="setrow setrow--next">
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
            </div>

            <div className="rir">
              <div className="rir__question">保留次數 —— 做完這組還能再做幾下？</div>
              <div
                className="rir__choices"
                role="radiogroup"
                aria-label={`${title} 本組保留次數`}
              >
                {RIR_CHOICES.map((choice) => {
                  const selected =
                    choice.value === 3 ? nextSet.rir >= 3 : nextSet.rir === choice.value
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`rir__choice${selected ? ' rir__choice--active' : ''}`}
                      onClick={() => setNextSet((s) => ({ ...s, rir: choice.value }))}
                    >
                      {choice.label}
                    </button>
                  )
                })}
              </div>
              <div className="rir__target small muted">
                這個動作的目標是保留 {rangeText(slot.rir)} 下
              </div>
            </div>

            <button
              className="btn btn--commit"
              onClick={commitSet}
              aria-label={`${title} 完成這一組`}
            >
              ✓ 完成這一組
            </button>
          </div>

          {entry.sets.length === 0 && (
            <button className="btn btn--ghost small" onClick={() => setSkipped(true)}>
              今天不做這個
            </button>
          )}

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
