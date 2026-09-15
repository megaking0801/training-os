import { useEffect, useState } from 'react'
import { formatDuration } from '../engine/units'

export interface RestState {
  /** 這次休息原本設定幾秒。 */
  total: number
  /** 倒數結束的時間戳。暫停時為 null。 */
  endsAt: number | null
  /** 暫停時剩下幾秒。 */
  paused: number
}

export function remainingSeconds(rest: RestState, now: number): number {
  if (rest.endsAt === null) return rest.paused
  return Math.max(0, (rest.endsAt - now) / 1000)
}

interface Props {
  rest: RestState
  onAdd30: () => void
  onTogglePause: () => void
  onSkip: () => void
}

/**
 * 休息倒數。Handoff §19。
 *
 * 倒數是用結束時間戳算的，不是每秒扣一，
 * 這樣切到別的 App 再切回來時間才不會慢掉。
 */
export function RestTimer({ rest, onAdd30, onTogglePause, onSkip }: Props) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (rest.endsAt === null) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [rest.endsAt])

  const remaining = remainingSeconds(rest, now)
  const done = remaining <= 0

  return (
    <div className="rest" role="timer" aria-live="off">
      <div className={`rest__time${done ? ' rest__done' : ''}`}>
        {done ? '休息結束' : formatDuration(remaining)}
      </div>
      <div className="row grow" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn--sm" onClick={onAdd30}>
          +30 秒
        </button>
        <button className="btn btn--sm" onClick={onTogglePause}>
          {rest.endsAt === null ? '繼續' : '暫停'}
        </button>
        <button className="btn btn--sm" onClick={onSkip}>
          跳過
        </button>
      </div>
    </div>
  )
}
