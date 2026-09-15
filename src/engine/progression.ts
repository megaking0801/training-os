import type { Slot } from '../program/types'
import { DEFAULT_INCREMENT } from '../program/types'
import { getExercise } from '../program/exercises'
import type { LoggedSet, Suggestion, TrackEntry } from './types'
import { formatWeight, roundToIncrement } from './units'

/** 空槓重量，用於暖身與臥推類動作的下限。 */
export const EMPTY_BAR_KG = 20

/** 臥推主力重組達標時的加重幅度。Handoff §16。 */
export const BENCH_TOP_SET_STEP = 2.5

export interface SuggestInput {
  slot: Slot
  /** 這條軌道上一次的紀錄。沒有就是第一次做。 */
  lastEntry?: TrackEntry | undefined
  /** 使用者對這個動作覆寫的加重級距。沒有就用器材類型預設。 */
  incrementOverride?: number | undefined
  /** `backoff` 專用：今天主力重組建議的重量。 */
  baseWeight?: number | undefined
}

/** 取得這個 slot 的加重級距。 */
export function incrementFor(slot: Slot, override?: number): number {
  if (override && override > 0) return override
  return DEFAULT_INCREMENT[getExercise(slot.exerciseId).equipment]
}

/**
 * 這一組的重量裡，哪一個算「本次的工作重量」。
 *
 * 取最大值：如果使用者中途掉重量，目標仍然是把最重那一組的組數補齊，
 * 而不是把整個動作降到最輕的那一組。
 */
function workingWeight(sets: LoggedSet[]): number {
  return Math.max(...sets.map((s) => s.weight))
}

/**
 * 是否達到加重門檻。
 *
 * 三個條件同時成立才算：
 * 1. 組數有做滿（少做的那次不算數）
 * 2. 每一組都同樣重量（中途掉重量代表還沒站穩）
 * 3. 每一組都達到次數上限，而且保留次數仍在目標之內
 */
function meetsIncreaseCriteria(slot: Slot, sets: LoggedSet[]): boolean {
  if (sets.length < slot.sets) return false
  const top = workingWeight(sets)
  const repTarget = slot.reps[1]
  const rirFloor = slot.rir[0]
  return sets.every((s) => s.weight === top && s.reps >= repTarget && s.rir >= rirFloor)
}

function rangeText(range: [number, number]): string {
  return range[0] === range[1] ? `${range[0]}` : `${range[0]}–${range[1]}`
}

function startMessage(slot: Slot): string {
  const reps = rangeText(slot.reps)
  const rir = rangeText(slot.rir)
  const perSide = slot.perSide ? '每側 ' : ''
  return `第一次做這個動作。選一個能在${perSide}${reps} 下停在保留 ${rir} 下的重量。`
}

/** 雙進展與自體重動作共用的加重判斷，差別只在建議文字。 */
function progressByReps(input: SuggestInput, addedLoad: boolean): Suggestion {
  const { slot, lastEntry } = input
  if (!lastEntry || lastEntry.sets.length === 0) {
    return { action: 'start', message: startMessage(slot) }
  }

  const increment = incrementFor(slot, input.incrementOverride)
  const current = workingWeight(lastEntry.sets)

  if (meetsIncreaseCriteria(slot, lastEntry.sets)) {
    const next = roundToIncrement(current + increment, increment)
    const label = addedLoad ? '負重' : '重量'
    return {
      action: 'increase',
      weight: next,
      message:
        `上次 ${slot.sets} 組都做到 ${slot.reps[1]} 下且保留次數達標。` +
        `建議${label}加到 ${formatWeight(next)} kg，次數回到 ${slot.reps[0]} 下附近重新往上推。`,
    }
  }

  if (addedLoad && current === 0) {
    return {
      action: 'hold',
      weight: 0,
      message: `先不加負重，把 ${slot.sets} 組都推到 ${slot.reps[1]} 下再說。`,
    }
  }

  return {
    action: 'hold',
    weight: current,
    message: `建議維持 ${formatWeight(current)} kg，這次嘗試增加次數。`,
  }
}

/** 臥推主力重組專屬邏輯。Handoff §16。 */
function progressBenchTopSet(input: SuggestInput): Suggestion {
  const { slot, lastEntry } = input
  if (!lastEntry || lastEntry.sets.length === 0) {
    return { action: 'start', message: startMessage(slot) }
  }

  const set = lastEntry.sets[0]!
  const current = set.weight
  const hitReps = set.reps >= slot.reps[1]
  const hadReserve = set.rir <= slot.rir[1]

  if (hitReps && hadReserve) {
    const next = roundToIncrement(current + BENCH_TOP_SET_STEP, BENCH_TOP_SET_STEP)
    return {
      action: 'increase',
      weight: next,
      message:
        `上次 ${formatWeight(current)} kg × ${set.reps} 下，保留 ${set.rir} 下。` +
        `建議增加到 ${formatWeight(next)} kg。`,
    }
  }

  return {
    action: 'hold',
    weight: current,
    message: `維持 ${formatWeight(current)} kg，先增加高品質次數。`,
  }
}

/** 降重工作組。重量跟著主力重組走，不自己演進。Handoff §4。 */
function progressBackoff(input: SuggestInput): Suggestion {
  const { slot, baseWeight } = input
  const percent = slot.derivedFrom?.percent ?? [90, 93]
  if (!baseWeight || baseWeight <= 0) {
    return { action: 'start', message: '先決定主力重組重量，降重工作組會自動換算。' }
  }

  const increment = incrementFor(slot, input.incrementOverride)
  const low = roundToIncrement((baseWeight * percent[0]) / 100, increment)
  const high = roundToIncrement((baseWeight * percent[1]) / 100, increment)
  const range: [number, number] = low <= high ? [low, high] : [high, low]

  return {
    action: 'derived',
    weight: range[1],
    weightRange: range,
    message:
      `主力重組 ${formatWeight(baseWeight)} kg 的 ${percent[0]}–${percent[1]}%，` +
      `約 ${formatWeight(range[0])}–${formatWeight(range[1])} kg。`,
  }
}

/** 算出某條軌道這次該用多少重量。 */
export function suggest(input: SuggestInput): Suggestion {
  switch (input.slot.progression) {
    case 'benchTopSet':
      return progressBenchTopSet(input)
    case 'backoff':
      return progressBackoff(input)
    case 'bodyweightReps':
      return progressByReps(input, true)
    case 'double':
      return progressByReps(input, false)
  }
}
