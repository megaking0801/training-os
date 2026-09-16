import { describe, expect, it } from 'vitest'
import type { Slot } from '../program/types'
import { DAYS } from '../program/days'
import { suggest } from './progression'
import { suggestForDay } from './day'
import { buildWarmup } from './warmup'
import { estimateOneRepMax } from './e1rm'
import { advanceCursor, countThisWeek, nextDay } from './sequence'
import { startOfWeek, toDateKey, daysAgo } from './dates'
import { roundToIncrement } from './units'
import type { TrackEntry } from './types'

const pushA = DAYS.pushA
const slotOf = (trackId: string): Slot => {
  for (const day of Object.values(DAYS)) {
    const found = day.slots.find((s) => s.trackId === trackId)
    if (found) return found
  }
  throw new Error(`找不到 ${trackId}`)
}

const entry = (sets: { weight: number; reps: number; rir: number }[]): TrackEntry => ({
  date: '2026-09-10',
  sets,
})

describe('雙進展', () => {
  const slot = slotOf('inclineDbPress') // 3 組 × 6–10 下，保留 1–2

  it('沒有紀錄時要求自己抓重量', () => {
    const s = suggest({ slot })
    expect(s.action).toBe('start')
    expect(s.weight).toBeUndefined()
  })

  it('三組都達上限且保留次數達標就加一級', () => {
    const s = suggest({
      slot,
      lastEntry: entry([
        { weight: 30, reps: 10, rir: 2 },
        { weight: 30, reps: 10, rir: 1 },
        { weight: 30, reps: 10, rir: 1 },
      ]),
    })
    expect(s.action).toBe('increase')
    expect(s.weight).toBe(32) // 啞鈴級距 2 kg
  })

  it('次數沒推滿就維持重量', () => {
    const s = suggest({
      slot,
      lastEntry: entry([
        { weight: 30, reps: 10, rir: 1 },
        { weight: 30, reps: 9, rir: 1 },
        { weight: 30, reps: 8, rir: 1 },
      ]),
    })
    expect(s.action).toBe('hold')
    expect(s.weight).toBe(30)
  })

  it('次數達標但保留次數不足就不加重', () => {
    const s = suggest({
      slot,
      lastEntry: entry([
        { weight: 30, reps: 10, rir: 0 },
        { weight: 30, reps: 10, rir: 1 },
        { weight: 30, reps: 10, rir: 1 },
      ]),
    })
    expect(s.action).toBe('hold')
  })

  it('組數沒做滿就不加重', () => {
    const s = suggest({
      slot,
      lastEntry: entry([
        { weight: 30, reps: 10, rir: 2 },
        { weight: 30, reps: 10, rir: 2 },
      ]),
    })
    expect(s.action).toBe('hold')
  })

  it('中途掉重量就不加重，並以最重那組為目標', () => {
    const s = suggest({
      slot,
      lastEntry: entry([
        { weight: 30, reps: 10, rir: 2 },
        { weight: 30, reps: 10, rir: 2 },
        { weight: 27.5, reps: 10, rir: 2 },
      ]),
    })
    expect(s.action).toBe('hold')
    expect(s.weight).toBe(30)
  })

  it('使用者覆寫的級距優先於器材預設', () => {
    const s = suggest({
      slot,
      incrementOverride: 5,
      lastEntry: entry([
        { weight: 30, reps: 10, rir: 2 },
        { weight: 30, reps: 10, rir: 2 },
        { weight: 30, reps: 10, rir: 2 },
      ]),
    })
    expect(s.weight).toBe(35)
  })
})

describe('臥推主力重組（Handoff §16）', () => {
  const slot = slotOf('benchTopSet') // 1 組 × 4–6 下，保留 1

  it('做到 6 下且保留 1 下就加 2.5 kg', () => {
    const s = suggest({ slot, lastEntry: entry([{ weight: 70, reps: 6, rir: 1 }]) })
    expect(s.action).toBe('increase')
    expect(s.weight).toBe(72.5)
  })

  it('做到 6 下、保留 0 下也算達標（規則是保留次數 ≤1）', () => {
    const s = suggest({ slot, lastEntry: entry([{ weight: 70, reps: 6, rir: 0 }]) })
    expect(s.action).toBe('increase')
  })

  it('只做到 5 下就維持重量', () => {
    const s = suggest({ slot, lastEntry: entry([{ weight: 70, reps: 5, rir: 1 }]) })
    expect(s.action).toBe('hold')
    expect(s.weight).toBe(70)
  })

  // Handoff §16 的規則是「≥6 下且保留次數 ≤1」才加重。保留 3 下代表這組
  // 沒有照 §4 的目標強度做，規則刻意不把它當達標。
  it('保留次數遠超目標時不加重', () => {
    const s = suggest({ slot, lastEntry: entry([{ weight: 70, reps: 6, rir: 3 }]) })
    expect(s.action).toBe('hold')
  })
})

describe('降重工作組（Handoff §4）', () => {
  const slot = slotOf('benchBackoff')

  it('依主力重量換算出 90–93% 的區間', () => {
    const s = suggest({ slot, baseWeight: 72.5 })
    expect(s.action).toBe('derived')
    expect(s.weightRange).toEqual([65, 67.5])
  })

  it('沒有主力重量時不給建議', () => {
    expect(suggest({ slot }).action).toBe('start')
  })
})

describe('自體重動作（Handoff §5）', () => {
  const slot = slotOf('pullUp') // 3 組 × 6–10 下

  it('還沒做到 10/10/10 就不要求加負重', () => {
    const s = suggest({
      slot,
      lastEntry: entry([
        { weight: 0, reps: 10, rir: 1 },
        { weight: 0, reps: 9, rir: 1 },
        { weight: 0, reps: 8, rir: 1 },
      ]),
    })
    expect(s.action).toBe('hold')
    expect(s.weight).toBe(0)
  })

  it('穩定 10/10/10 就建議加負重', () => {
    const s = suggest({
      slot,
      lastEntry: entry([
        { weight: 0, reps: 10, rir: 1 },
        { weight: 0, reps: 10, rir: 1 },
        { weight: 0, reps: 10, rir: 2 },
      ]),
    })
    expect(s.action).toBe('increase')
    expect(s.weight).toBe(2.5)
  })
})

describe('整堂建議', () => {
  it('降重工作組會接到主力重組算出來的新重量', () => {
    const result = suggestForDay(pushA, {
      benchTopSet: entry([{ weight: 70, reps: 6, rir: 1 }]),
    })
    expect(result.benchTopSet?.weight).toBe(72.5)
    expect(result.benchBackoff?.weightRange).toEqual([65, 67.5])
  })

  it('每個動作都拿到建議', () => {
    const result = suggestForDay(pushA, {})
    for (const slot of pushA.slots) expect(result).toHaveProperty(slot.trackId)
  })
})

describe('臥推暖身（Handoff §18）', () => {
  it('72.5 kg 主力重量產生文件裡的那組階梯', () => {
    const steps = buildWarmup(72.5)
    expect(steps.map((s) => [s.weight, s.reps])).toEqual([
      [20, 10],
      [37.5, 5],
      [50, 3],
      [62.5, 1],
    ])
    expect(steps[0]!.isEmptyBar).toBe(true)
  })

  it('主力重量接近空槓時只做空槓', () => {
    expect(buildWarmup(20)).toHaveLength(1)
  })

  it('每一階都比前一階重，且都輕於主力重量', () => {
    const steps = buildWarmup(100)
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.weight).toBeGreaterThan(steps[i - 1]!.weight)
      expect(steps[i]!.weight).toBeLessThan(100)
    }
  })

  it('空槓重量可以改成自己健身房的槓', () => {
    const steps = buildWarmup(72.5, { emptyBarKg: 15 })
    expect(steps[0]!.weight).toBe(15)
    expect(steps[0]!.isEmptyBar).toBe(true)
  })
})

describe('第一次做某個動作的提示', () => {
  /**
   * 機器上常常只標格數或只標磅，掛片式更是連空機多重都不知道。
   * 這個 App 比的是上次跟這次，所以記法一致就好 —— 要在使用者
   * 卡住的當下講，不是藏在設定頁。
   */
  it('機械動作會提醒記法一致就好', () => {
    const s = suggest({ slot: slotOf('machineInclinePress') })
    expect(s.action).toBe('start')
    expect(s.message).toContain('記法一致')
  })

  it('史密斯機也算機器', () => {
    const s = suggest({ slot: slotOf('hipThrust') })
    expect(s.message).toContain('記法一致')
  })

  it('自由重量不囉唆這件事', () => {
    const s = suggest({ slot: slotOf('inclineDbPress') })
    expect(s.message).not.toContain('記法一致')
  })
})

describe('掛片式機器的暖身', () => {
  /**
   * 掛片式機器空機多重沒人知道，而且空機通常太輕，
   * 所以不給「空機」那一階，直接從掛一半的片開始。
   */
  it('沒有空機那一階', () => {
    const steps = buildWarmup(60, { emptyBarKg: null })
    expect(steps.some((s) => s.isEmptyBar)).toBe(false)
    expect(steps.map((s) => [s.weight, s.reps])).toEqual([
      [30, 5],
      [42.5, 3],
      [50, 1],
    ])
  })

  it('目標很輕時，階梯從最輕的一級片重起跳', () => {
    const steps = buildWarmup(5, { emptyBarKg: null, increment: 2.5 })
    expect(steps.map((s) => s.weight)).toEqual([2.5])
  })

  it('還沒填今天要推多少就不給階梯', () => {
    expect(buildWarmup(0, { emptyBarKg: null })).toEqual([])
  })
})

describe('推估單次最大重量', () => {
  it('用 Epley 公式', () => {
    expect(estimateOneRepMax(70, 6)).toBe(84)
    expect(estimateOneRepMax(80, 2)).toBeCloseTo(85.33, 2)
  })

  it('單下就是本身重量', () => {
    expect(estimateOneRepMax(90, 1)).toBe(90)
  })

  it('次數太高就不推估', () => {
    expect(estimateOneRepMax(40, 20)).toBeNull()
    expect(estimateOneRepMax(0, 5)).toBeNull()
  })
})

describe('課表循環（Handoff §20、§21）', () => {
  it('四天循環依序輪替', () => {
    expect(nextDay(4, 0)).toBe('pushA')
    expect(nextDay(4, 1)).toBe('pullA')
    expect(nextDay(4, 2)).toBe('legs')
    expect(nextDay(4, 3)).toBe('upperB')
    expect(nextDay(4, 4)).toBe('pushA')
  })

  it('五天把上肢 B 拆成推日 B 與拉日 B', () => {
    expect(nextDay(5, 3)).toBe('pushB')
    expect(nextDay(5, 4)).toBe('pullB')
  })

  it('做完三堂後切成五天，下一堂變推日 B', () => {
    let cursor = 0
    for (let i = 0; i < 3; i++) cursor = advanceCursor(4, cursor)
    expect(cursor).toBe(3)
    expect(nextDay(5, cursor)).toBe('pushB')
  })

  it('五天做完四堂後切成四天，循環視為結束', () => {
    let cursor = 0
    for (let i = 0; i < 4; i++) cursor = advanceCursor(5, cursor)
    expect(cursor).toBe(4)
    expect(nextDay(4, cursor)).toBe('pushA')
  })

  it('完成最後一堂之後 cursor 歸零', () => {
    expect(advanceCursor(4, 3)).toBe(0)
    expect(advanceCursor(5, 4)).toBe(0)
  })
})

describe('自然週', () => {
  it('週一起算', () => {
    // 2026-09-15 是星期二
    expect(toDateKey(startOfWeek(new Date(2026, 8, 15)))).toBe('2026-09-14')
    // 2026-09-20 是星期日，仍屬於 09-14 那一週
    expect(toDateKey(startOfWeek(new Date(2026, 8, 20)))).toBe('2026-09-14')
    // 2026-09-21 是下一個星期一
    expect(toDateKey(startOfWeek(new Date(2026, 8, 21)))).toBe('2026-09-21')
  })

  it('只數本週的紀錄', () => {
    const now = new Date(2026, 8, 17)
    expect(countThisWeek(['2026-09-13', '2026-09-14', '2026-09-16'], now)).toBe(2)
  })

  it('距今天數', () => {
    expect(daysAgo('2026-09-15', new Date(2026, 8, 15))).toBe(0)
    expect(daysAgo('2026-09-13', new Date(2026, 8, 15))).toBe(2)
  })
})

describe('重量捨入', () => {
  it('捨入到器材的最小級距', () => {
    expect(roundToIncrement(36.25, 2.5)).toBe(37.5)
    expect(roundToIncrement(50.75, 2.5)).toBe(50)
    expect(roundToIncrement(61.6, 2.5)).toBe(62.5)
    expect(roundToIncrement(31, 2)).toBe(32)
  })
})
