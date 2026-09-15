/**
 * 日期處理。全部用本機時區，不要用 UTC，
 * 否則晚上十一點練完會被算到隔天。
 */

/** 本機時區的 YYYY-MM-DD。 */
export function toDateKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 把 YYYY-MM-DD 解析成本機時區的當天零點。 */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** 當週週一的零點。自然週從週一開始。 */
export function startOfWeek(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  // getDay()：週日是 0，要往回退 6 天而不是 -1 天。
  const daysSinceMonday = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - daysSinceMonday)
  return d
}

/** 該日期所屬自然週的 key，等於當週週一的 YYYY-MM-DD。 */
export function weekKey(date: Date = new Date()): string {
  return toDateKey(startOfWeek(date))
}

/** 顯示成 9/15 這種簡短格式。 */
export function formatShortDate(key: string): string {
  const d = fromDateKey(key)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 距今幾天。今天是 0。 */
export function daysAgo(key: string, now: Date = new Date()): number {
  const then = fromDateKey(key).getTime()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((today - then) / 86_400_000)
}

export function formatRelativeDay(key: string, now: Date = new Date()): string {
  const diff = daysAgo(key, now)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff < 0) return formatShortDate(key)
  return `${diff} 天前`
}
