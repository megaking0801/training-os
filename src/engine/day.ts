import type { TrainingDay } from '../program/types'
import { suggest } from './progression'
import type { Suggestion, TrackEntry } from './types'

/** 使用者對某個動作覆寫的加重級距，key 是 exerciseId。 */
export type IncrementOverrides = Record<string, number | undefined>

/** 每條軌道上一次的紀錄，key 是 trackId。 */
export type LastByTrack = Record<string, TrackEntry | undefined>

/**
 * 算出一整堂課每個動作的建議重量。
 *
 * 降重工作組的重量取自主力重組，所以要先算完其他軌道再算它，
 * 否則 baseWeight 會拿不到值。
 */
export function suggestForDay(
  day: TrainingDay,
  lastByTrack: LastByTrack,
  increments: IncrementOverrides = {},
): Record<string, Suggestion> {
  const result: Record<string, Suggestion> = {}

  for (const slot of day.slots) {
    if (slot.progression === 'backoff') continue
    result[slot.trackId] = suggest({
      slot,
      lastEntry: lastByTrack[slot.trackId],
      incrementOverride: increments[slot.exerciseId],
    })
  }

  for (const slot of day.slots) {
    if (slot.progression !== 'backoff') continue
    const baseTrack = slot.derivedFrom?.trackId
    const base = baseTrack ? result[baseTrack]?.weight : undefined
    result[slot.trackId] = suggest({
      slot,
      lastEntry: lastByTrack[slot.trackId],
      incrementOverride: increments[slot.exerciseId],
      baseWeight: base,
    })
  }

  return result
}
