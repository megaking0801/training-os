import { describe, expect, it } from 'vitest'
import { buildBackup, parseBackup, serializeBackup } from './backup'
import { benchTopSetTrend, exerciseHistory, lastEntryByTrack, weeklyVolumeTrend } from './selectors'
import { DEFAULT_STATE, type Session } from './types'

function session(
  id: string,
  date: string,
  completedAt: number,
  entries: Session['entries'],
): Session {
  return {
    id,
    date,
    dayId: 'pushA',
    mode: 4,
    startedAt: completedAt - 5_400_000,
    completedAt,
    durationSec: 5400,
    entries,
  }
}

// 由新到舊，跟 loadSessions() 的回傳順序一致。
const SESSIONS: Session[] = [
  session('s3', '2026-09-15', new Date(2026, 8, 15, 20).getTime(), [
    { trackId: 'benchTopSet', exerciseId: 'barbellBench', sets: [{ weight: 72.5, reps: 5, rir: 1 }] },
    {
      trackId: 'lateralRaise',
      exerciseId: 'lateralRaise',
      sets: [
        { weight: 10, reps: 15, rir: 2 },
        { weight: 10, reps: 14, rir: 1 },
      ],
    },
  ]),
  session('s2', '2026-09-10', new Date(2026, 8, 10, 20).getTime(), [
    { trackId: 'benchTopSet', exerciseId: 'barbellBench', sets: [{ weight: 70, reps: 6, rir: 1 }] },
    {
      trackId: 'benchPaused',
      exerciseId: 'barbellBench',
      sets: [{ weight: 60, reps: 8, rir: 2 }],
    },
  ]),
  session('s1', '2026-09-05', new Date(2026, 8, 5, 20).getTime(), [
    { trackId: 'benchTopSet', exerciseId: 'barbellBench', sets: [{ weight: 67.5, reps: 6, rir: 1 }] },
  ]),
]

describe('上次紀錄', () => {
  it('每條軌道取最近一次', () => {
    const last = lastEntryByTrack(SESSIONS)
    expect(last.benchTopSet?.date).toBe('2026-09-15')
    expect(last.benchTopSet?.sets[0]?.weight).toBe(72.5)
  })

  it('主力重組與暫停臥推是兩條互不干擾的軌道', () => {
    const last = lastEntryByTrack(SESSIONS)
    expect(last.benchTopSet?.sets[0]?.weight).toBe(72.5)
    expect(last.benchPaused?.sets[0]?.weight).toBe(60)
  })

  it('同一個動作的歷史會把所有軌道都收進來', () => {
    const history = exerciseHistory(SESSIONS, 'barbellBench')
    expect(history).toHaveLength(4)
    expect(new Set(history.map((h) => h.trackId))).toEqual(new Set(['benchTopSet', 'benchPaused']))
  })
})

describe('臥推趨勢', () => {
  it('舊的在前面，並附上推估單次最大重量', () => {
    const trend = benchTopSetTrend(SESSIONS)
    expect(trend.map((p) => p.date)).toEqual(['2026-09-05', '2026-09-10', '2026-09-15'])
    expect(trend[1]?.e1rm).toBe(84) // 70 × (1 + 6/30)
  })
})

describe('週訓練量', () => {
  it('依自然週分桶', () => {
    const weeks = weeklyVolumeTrend(SESSIONS)
    // 09-05 是週六 → 08-31 那一週；09-10 與 09-15 分屬 09-07、09-14 兩週。
    expect(weeks.map((w) => w.week)).toEqual(['2026-08-31', '2026-09-07', '2026-09-14'])
  })

  it('次要肌群記半組', () => {
    const weeks = weeklyVolumeTrend(SESSIONS)
    const latest = weeks[weeks.length - 1]!
    expect(latest.volume.chest).toBe(1) // 主力重組 1 組
    expect(latest.volume.triceps).toBe(0.5) // 臥推的次要肌群
    expect(latest.volume.sideDelt).toBe(2) // 側平舉 2 組
  })
})

describe('備份', () => {
  const backup = buildBackup(DEFAULT_STATE, SESSIONS, [{ date: '2026-09-15', weight: 78.2 }])

  it('匯出再匯入之後資料一致', () => {
    const parsed = parseBackup(serializeBackup(backup))
    expect(parsed.sessions).toEqual(SESSIONS)
    expect(parsed.bodyWeight).toEqual([{ date: '2026-09-15', weight: 78.2 }])
    expect(parsed.state).toEqual(DEFAULT_STATE)
  })

  it('壞掉的 JSON 會被擋下來', () => {
    expect(() => parseBackup('{')).toThrow(/不是有效的 JSON/)
  })

  it('別的 App 的 JSON 會被擋下來', () => {
    expect(() => parseBackup('{"format":"other"}')).toThrow(/不是 Training OS/)
  })

  it('版本比 App 新就拒絕匯入', () => {
    expect(() => parseBackup('{"format":"training-os-backup","version":99}')).toThrow(/比這個 App 還新/)
  })

  it('訓練紀錄缺欄位會被擋下來', () => {
    const broken = JSON.stringify({
      format: 'training-os-backup',
      version: 1,
      sessions: [{ id: 'x' }],
    })
    expect(() => parseBackup(broken)).toThrow(/備份檔格式不正確/)
  })
})
