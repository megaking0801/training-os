import type { LastByTrack } from '../engine/day'
import type { TrackEntry } from '../engine/types'
import { estimateOneRepMax } from '../engine/e1rm'
import { weekKey } from '../engine/dates'
import { actualVolume, type VolumeByMuscle } from '../engine/volume'
import type { Session, SessionEntry } from './types'

/**
 * 從訓練紀錄推導出畫面要的資料。
 *
 * `sessions` 一律假設已經照 completedAt 由新到舊排好（`loadSessions` 就是這樣回傳）。
 */

/** 每條軌道最近一次的紀錄，給加重建議與「上次」顯示用。 */
export function lastEntryByTrack(sessions: Session[]): LastByTrack {
  const result: LastByTrack = {}
  for (const session of sessions) {
    for (const entry of session.entries) {
      if (entry.sets.length === 0) continue
      if (result[entry.trackId]) continue
      result[entry.trackId] = { date: session.date, sets: entry.sets }
    }
  }
  return result
}

/** 單一軌道的完整歷史，新的在前面。 */
export function trackHistory(sessions: Session[], trackId: string): TrackEntry[] {
  const history: TrackEntry[] = []
  for (const session of sessions) {
    for (const entry of session.entries) {
      if (entry.trackId !== trackId || entry.sets.length === 0) continue
      history.push({ date: session.date, sets: entry.sets })
    }
  }
  return history
}

/** 單一動作的完整歷史，跨所有軌道。查「槓鈴臥推所有紀錄」用。 */
export function exerciseHistory(
  sessions: Session[],
  exerciseId: string,
): { date: string; trackId: string; sets: TrackEntry['sets'] }[] {
  const history: { date: string; trackId: string; sets: TrackEntry['sets'] }[] = []
  for (const session of sessions) {
    for (const entry of session.entries) {
      if (entry.exerciseId !== exerciseId || entry.sets.length === 0) continue
      history.push({ date: session.date, trackId: entry.trackId, sets: entry.sets })
    }
  }
  return history
}

export interface BenchPoint {
  date: string
  weight: number
  reps: number
  rir: number
  /** 推估單次最大重量。次數太高時為 null。 */
  e1rm: number | null
}

/** 臥推主力重組趨勢。Handoff §17、§26。舊的在前面，直接餵給圖表。 */
export function benchTopSetTrend(sessions: Session[]): BenchPoint[] {
  return trackHistory(sessions, 'benchTopSet')
    .flatMap((entry) => {
      const set = entry.sets[0]
      if (!set) return []
      return [
        {
          date: entry.date,
          weight: set.weight,
          reps: set.reps,
          rir: set.rir,
          e1rm: estimateOneRepMax(set.weight, set.reps),
        },
      ]
    })
    .reverse()
}

export interface WeekVolumePoint {
  /** 該自然週週一的 YYYY-MM-DD。 */
  week: string
  sessionCount: number
  volume: VolumeByMuscle
}

/** 每個自然週的實際訓練量。舊的在前面。 */
export function weeklyVolumeTrend(sessions: Session[]): WeekVolumePoint[] {
  const buckets = new Map<string, Session[]>()
  for (const session of sessions) {
    const key = weekKey(new Date(session.completedAt))
    const bucket = buckets.get(key)
    if (bucket) bucket.push(session)
    else buckets.set(key, [session])
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, weekSessions]) => ({
      week,
      sessionCount: weekSessions.length,
      volume: actualVolume(
        weekSessions.flatMap((s) =>
          s.entries.map((e) => ({ exerciseId: e.exerciseId, setCount: e.sets.length })),
        ),
      ),
    }))
}

/** 已完成訓練的日期，新的在前面。給「本週 x/y」用。 */
export function sessionDateKeys(sessions: Session[]): string[] {
  return sessions.map((s) => s.date)
}

/**
 * 把進行中的訓練整理成可以存進歷史的樣子。
 *
 * 熱身組與「今天不做」只在健身房當下有用：留著會灌水訓練量，
 * 也會讓「上次用多少」抓到暖身的輕重量。
 */
export function toSessionEntries(entries: SessionEntry[]): SessionEntry[] {
  return entries
    .filter((e) => e.sets.length > 0)
    .map(({ warmupSets: _warmupSets, skipped: _skipped, ...keep }) => keep)
}
