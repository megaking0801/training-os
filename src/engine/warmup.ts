import { EMPTY_BAR_KG } from './progression'
import { roundToIncrement } from './units'

/**
 * 臥推暖身建議。Handoff §18。
 *
 * 暖身組不算正式工作組，也不應該做到疲勞，所以不記錄、不計入訓練量。
 */

export interface WarmupStep {
  weight: number
  reps: number
  /** 空槓那一組在介面上直接寫「空槓」。 */
  isEmptyBar: boolean
}

const STEPS: { percent: number; reps: number }[] = [
  { percent: 50, reps: 5 },
  { percent: 70, reps: 3 },
  { percent: 85, reps: 1 },
]

/**
 * 依今天預計的主力重量產生暖身組。
 *
 * 只保留比空槓重的階梯；主力重量本身太輕時就只做空槓。
 */
export function buildWarmup(topWeight: number, increment = 2.5): WarmupStep[] {
  const steps: WarmupStep[] = [{ weight: EMPTY_BAR_KG, reps: 10, isEmptyBar: true }]
  if (!topWeight || topWeight <= EMPTY_BAR_KG) return steps

  for (const step of STEPS) {
    const weight = roundToIncrement((topWeight * step.percent) / 100, increment)
    if (weight <= EMPTY_BAR_KG) continue
    if (weight >= topWeight) continue
    const previous = steps[steps.length - 1]!
    if (weight <= previous.weight) continue
    steps.push({ weight, reps: step.reps, isEmptyBar: false })
  }

  return steps
}
