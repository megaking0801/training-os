/** 重量與數字的共用處理。所有重量單位都是公斤。 */

/** 捨入到該器材的最小可用重量。 */
export function roundToIncrement(weight: number, increment: number): number {
  if (increment <= 0) return round2(weight)
  return round2(Math.round(weight / increment) * increment)
}

/** 避免 0.1 + 0.2 這類浮點誤差滲進顯示的重量。 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 去掉沒有意義的小數點尾巴：72.50 顯示成 72.5、70.00 顯示成 70。 */
export function formatWeight(weight: number): string {
  return String(round2(weight))
}

/** 秒數轉成 3:05 這種顯示。 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
