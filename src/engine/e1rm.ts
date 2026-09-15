import { round2 } from './units'

/**
 * 推估單次最大重量（Epley）。Handoff §17。
 *
 * 只用來看趨勢，不是要使用者去測真正的最大重量。
 * 次數越高誤差越大，所以超過 12 下就不再推估。
 */
export const E1RM_MAX_REPS = 12

export function estimateOneRepMax(weight: number, reps: number): number | null {
  if (weight <= 0 || reps <= 0 || reps > E1RM_MAX_REPS) return null
  if (reps === 1) return round2(weight)
  return round2(weight * (1 + reps / 30))
}
