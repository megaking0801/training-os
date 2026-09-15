import type { DayId, WeekMode } from '../program/types'
import { SEQUENCES } from '../program/days'
import { startOfWeek, fromDateKey } from './dates'

/**
 * 課表循環。Handoff §20、§21。
 *
 * 混合規則：
 * - 「下一堂是什麼」不綁星期幾，做完一堂就往下移一格。
 * - 「本週 x/y」與週訓練量用自然週（週一起算）。
 *
 * 4 天／5 天可以隨時切換，只影響還沒做的部分。cursor 是「本循環已完成幾堂」，
 * 取餘數之後自然適應新的循環長度：
 * 4 天做完三堂（cursor 3）切成 5 天，下一堂就是推日 B；
 * 5 天做完四堂（cursor 4）切成 4 天，循環視為結束，下一堂回推日 A。
 */

export function sequenceFor(mode: WeekMode): DayId[] {
  return SEQUENCES[mode]
}

/** 下一堂要練什麼。 */
export function nextDay(mode: WeekMode, cursor: number): DayId {
  const sequence = SEQUENCES[mode]
  const index = ((cursor % sequence.length) + sequence.length) % sequence.length
  return sequence[index]!
}

/** 完成一堂之後的新 cursor。 */
export function advanceCursor(mode: WeekMode, cursor: number): number {
  const sequence = SEQUENCES[mode]
  return (cursor + 1) % sequence.length
}

/** 這一堂在循環中的位置，從 1 開始，給「第 3 / 4 堂」這種顯示用。 */
export function positionInCycle(mode: WeekMode, cursor: number): number {
  const sequence = SEQUENCES[mode]
  return (((cursor % sequence.length) + sequence.length) % sequence.length) + 1
}

/** 本自然週已完成幾堂。 */
export function countThisWeek(dateKeys: string[], now: Date = new Date()): number {
  const weekStart = startOfWeek(now).getTime()
  return dateKeys.filter((key) => fromDateKey(key).getTime() >= weekStart).length
}
