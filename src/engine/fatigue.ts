/**
 * 疲勞／疼痛提醒。Handoff §24。
 *
 * 只看使用者自己回報的狀態與主要動作的趨勢，給的是訓練建議，
 * 不做任何醫療判斷，也不阻止使用者加重量。
 */

export type FatigueLevel = 'none' | 'caution'

export interface FatigueAdvice {
  level: FatigueLevel
  /** 觸發提醒的原因，直接顯示給使用者看。 */
  reasons: string[]
  message: string
}

export interface FatigueInput {
  /** 最近幾次訓練回報的狀態，新的在前面。 */
  recentConditions: (string | undefined)[]
  /** 臥推推估單次最大重量，舊的在前面。 */
  benchTrend: (number | null)[]
}

/** 最近三次裡出現兩次以上就算反覆。 */
const WINDOW = 3
const THRESHOLD = 2

function countIn(conditions: (string | undefined)[], wanted: string[]): number {
  return conditions.slice(0, WINDOW).filter((c) => c !== undefined && wanted.includes(c)).length
}

/** 最近連續兩次下滑才算退步，單次波動不算。 */
function isRegressing(trend: (number | null)[]): boolean {
  const points = trend.filter((n): n is number => n !== null)
  if (points.length < 3) return false
  const [a, b, c] = points.slice(-3) as [number, number, number]
  return b < a && c < b
}

export function assessFatigue(input: FatigueInput): FatigueAdvice {
  const reasons: string[] = []

  if (countIn(input.recentConditions, ['lowBack']) >= THRESHOLD) {
    reasons.push('最近腰部不適重複出現')
  }
  if (countIn(input.recentConditions, ['shoulder', 'elbow']) >= THRESHOLD) {
    reasons.push('最近肩或肘的不適重複出現')
  }
  if (countIn(input.recentConditions, ['fatigued']) >= THRESHOLD) {
    reasons.push('最近連續回報疲勞')
  }
  if (isRegressing(input.benchTrend)) {
    reasons.push('臥推推估成績連續下滑')
  }

  if (reasons.length === 0) {
    return { level: 'none', reasons, message: '' }
  }

  return {
    level: 'caution',
    reasons,
    message: '這幾次的狀態不太好。這次可以先維持重量，或減少一到兩組，把動作品質顧好。',
  }
}
