import { describe, expect, it } from 'vitest'
import { DAYS, SEQUENCES } from './days'
import { EXERCISES } from './exercises'
import type { DayId } from './types'
import { plannedWeeklyVolume } from '../engine/volume'

const ALL_DAYS = Object.values(DAYS)

describe('課表資料完整性', () => {
  it('每個 slot 的 exerciseId 都存在於動作字典', () => {
    for (const day of ALL_DAYS) {
      for (const slot of day.slots) {
        expect(EXERCISES, `${day.id} / ${slot.trackId}`).toHaveProperty(slot.exerciseId)
      }
    }
  })

  it('同一堂課裡 trackId 不重複', () => {
    for (const day of ALL_DAYS) {
      const ids = day.slots.map((s) => s.trackId)
      expect(new Set(ids).size, day.id).toBe(ids.length)
    }
  })

  it('同一個 trackId 在不同堂裡一定對應同一個動作', () => {
    const exerciseByTrack = new Map<string, string>()
    for (const day of ALL_DAYS) {
      for (const slot of day.slots) {
        const seen = exerciseByTrack.get(slot.trackId)
        if (seen) expect(seen, slot.trackId).toBe(slot.exerciseId)
        else exerciseByTrack.set(slot.trackId, slot.exerciseId)
      }
    }
  })

  it('槓鈴臥推的三個角色是三條獨立軌道', () => {
    const benchTracks = ALL_DAYS.flatMap((d) => d.slots)
      .filter((s) => s.exerciseId === 'barbellBench')
      .map((s) => s.trackId)
    expect(new Set(benchTracks)).toEqual(new Set(['benchTopSet', 'benchBackoff', 'benchPaused']))
  })

  it('側平舉在三堂課裡共用同一條軌道', () => {
    const lateralTracks = ALL_DAYS.flatMap((d) => d.slots)
      .filter((s) => s.exerciseId === 'lateralRaise')
      .map((s) => s.trackId)
    expect(lateralTracks.length).toBe(3)
    expect(new Set(lateralTracks).size).toBe(1)
  })

  it('次數區間與保留次數區間都是遞增的', () => {
    for (const day of ALL_DAYS) {
      for (const slot of day.slots) {
        expect(slot.reps[0], `${day.id}/${slot.trackId} reps`).toBeLessThanOrEqual(slot.reps[1])
        expect(slot.rir[0], `${day.id}/${slot.trackId} rir`).toBeLessThanOrEqual(slot.rir[1])
        expect(slot.sets).toBeGreaterThan(0)
        expect(slot.restSeconds).toBeGreaterThan(0)
      }
    }
  })

  it('降重工作組指向的軌道存在於同一堂課', () => {
    for (const day of ALL_DAYS) {
      for (const slot of day.slots) {
        if (!slot.derivedFrom) continue
        const target = day.slots.find((s) => s.trackId === slot.derivedFrom!.trackId)
        expect(target, `${day.id}/${slot.trackId}`).toBeDefined()
      }
    }
  })

  it('循環順序只用到已定義的課表', () => {
    for (const mode of [4, 5] as const) {
      expect(SEQUENCES[mode].length).toBe(mode)
      for (const dayId of SEQUENCES[mode]) expect(DAYS).toHaveProperty(dayId)
    }
  })

  it('沒有孤兒課表：六堂都被某個循環用到', () => {
    const used = new Set<DayId>([...SEQUENCES[4], ...SEQUENCES[5]])
    expect(used.size).toBe(Object.keys(DAYS).length)
  })
})

describe('週訓練量符合 Handoff §22 的目標', () => {
  it('四天：胸 12 組、背 14 組', () => {
    const volume = plannedWeeklyVolume(4)
    expect(volume.chest).toBe(12)
    expect(volume.back).toBe(14)
  })

  it('五天：胸 14 組、背 16 組', () => {
    const volume = plannedWeeklyVolume(5)
    expect(volume.chest).toBe(14)
    expect(volume.back).toBe(16)
  })

  it('五天的每個肌群都不少於四天', () => {
    const four = plannedWeeklyVolume(4)
    const five = plannedWeeklyVolume(5)
    for (const muscle of Object.keys(four) as (keyof typeof four)[]) {
      expect(five[muscle], muscle).toBeGreaterThanOrEqual(four[muscle])
    }
  })
})
