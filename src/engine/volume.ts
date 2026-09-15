import type { MuscleGroup, WeekMode } from '../program/types'
import { MUSCLE_ORDER } from '../program/types'
import { getExercise } from '../program/exercises'
import { DAYS, SEQUENCES } from '../program/days'
import { round2 } from './units'

/**
 * 週訓練量統計。Handoff §22。
 *
 * 主要肌群記整組，次要肌群記半組。這是為了讓二頭、後三角這種
 * 大量來自複合動作的部位不會被低估，不是把「組數越多越好」當目標。
 */

export type VolumeByMuscle = Record<MuscleGroup, number>

export function emptyVolume(): VolumeByMuscle {
  return Object.fromEntries(MUSCLE_ORDER.map((m) => [m, 0])) as VolumeByMuscle
}

function addSets(into: VolumeByMuscle, exerciseId: string, setCount: number): void {
  const exercise = getExercise(exerciseId)
  for (const muscle of exercise.primary) into[muscle] += setCount
  for (const muscle of exercise.secondary ?? []) into[muscle] += setCount * 0.5
}

/** 課表排定的週訓練量（還沒做，只是計畫）。 */
export function plannedWeeklyVolume(mode: WeekMode): VolumeByMuscle {
  const total = emptyVolume()
  for (const dayId of SEQUENCES[mode]) {
    for (const slot of DAYS[dayId].slots) addSets(total, slot.exerciseId, slot.sets)
  }
  for (const muscle of MUSCLE_ORDER) total[muscle] = round2(total[muscle])
  return total
}

/** 實際做完的紀錄要餵進來的最小形狀。 */
export interface VolumeEntry {
  exerciseId: string
  /** 這個動作實際完成的組數。 */
  setCount: number
}

/** 已完成訓練的實際訓練量。 */
export function actualVolume(entries: VolumeEntry[]): VolumeByMuscle {
  const total = emptyVolume()
  for (const entry of entries) addSets(total, entry.exerciseId, entry.setCount)
  for (const muscle of MUSCLE_ORDER) total[muscle] = round2(total[muscle])
  return total
}
