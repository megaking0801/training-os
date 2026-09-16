import { EMPTY_BAR_KG } from './progression'
import { roundToIncrement } from './units'

/**
 * 暖身階梯。Handoff §18。
 *
 * 暖身組不算正式工作組，也不應該做到疲勞，所以不記錄、不計入訓練量。
 */

export interface WarmupStep {
  weight: number
  reps: number
  /** 空槓那一組在介面上直接寫「空槓」。 */
  isEmptyBar: boolean
}

export interface WarmupOptions {
  /** 這個動作的最小可用重量，決定階梯要捨入到哪一級。 */
  increment?: number
  /**
   * 固定的空槓重量。槓鈴給數字，第一階就是空槓。
   *
   * 掛片式機器傳 null：空機多重沒人知道，而且空機通常太輕，
   * 所以不給空機那一階，直接從掛一半的片開始。
   */
  emptyBarKg?: number | null
}

const STEPS: { percent: number; reps: number }[] = [
  { percent: 50, reps: 5 },
  { percent: 70, reps: 3 },
  { percent: 85, reps: 1 },
]

/**
 * 依今天預計的主力重量產生暖身組。
 *
 * 只保留比下限重的階梯；主力重量本身太輕時就只剩下限那一階。
 */
export function buildWarmup(topWeight: number, options: WarmupOptions = {}): WarmupStep[] {
  const { increment = 2.5, emptyBarKg = EMPTY_BAR_KG } = options

  const steps: WarmupStep[] = []
  // 有固定空槓就從空槓起跳，掛片式則是最輕的一級片。
  const floor = emptyBarKg ?? increment
  if (emptyBarKg !== null) steps.push({ weight: emptyBarKg, reps: 10, isEmptyBar: true })

  if (!topWeight || topWeight <= floor) return steps

  for (const step of STEPS) {
    const weight = roundToIncrement((topWeight * step.percent) / 100, increment)
    if (weight < floor) continue
    if (weight >= topWeight) continue
    const previous = steps[steps.length - 1]
    if (previous && weight <= previous.weight) continue
    steps.push({ weight, reps: step.reps, isEmptyBar: false })
  }

  return steps
}
