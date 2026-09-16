import { toDateKey } from '../engine/dates'
import {
  BACKUP_VERSION,
  DEFAULT_STATE,
  type AppState,
  type BackupFile,
  type BodyWeightRecord,
  type Session,
} from './types'

/**
 * JSON 匯出／匯入。Handoff §29。
 *
 * 第一版資料只存在手機上，備份就是唯一的保險，所以匯入要嚴格檢查，
 * 壞檔案不能把現有紀錄蓋掉。
 */

export function buildBackup(
  state: AppState,
  sessions: Session[],
  bodyWeight: BodyWeightRecord[],
): BackupFile {
  return {
    format: 'training-os-backup',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state,
    sessions,
    bodyWeight,
  }
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2)
}

export function backupFileName(now: Date = new Date()): string {
  return `training-os-${toDateKey(now)}.json`
}

function fail(reason: string): never {
  throw new Error(`備份檔格式不正確：${reason}`)
}

function asNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} 不是數字`)
  return value
}

function asString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} 不是文字`)
  return value
}

function parseSession(raw: unknown, index: number): Session {
  if (typeof raw !== 'object' || raw === null) fail(`第 ${index + 1} 筆訓練紀錄不是物件`)
  const r = raw as Record<string, unknown>
  const entries = Array.isArray(r.entries) ? r.entries : fail(`第 ${index + 1} 筆缺少動作紀錄`)

  return {
    id: asString(r.id, `第 ${index + 1} 筆的 id`),
    date: asString(r.date, `第 ${index + 1} 筆的日期`),
    dayId: asString(r.dayId, `第 ${index + 1} 筆的課表`) as Session['dayId'],
    mode: (asNumber(r.mode, `第 ${index + 1} 筆的週模式`) === 5 ? 5 : 4) as Session['mode'],
    startedAt: asNumber(r.startedAt, `第 ${index + 1} 筆的開始時間`),
    completedAt: asNumber(r.completedAt, `第 ${index + 1} 筆的完成時間`),
    durationSec: asNumber(r.durationSec, `第 ${index + 1} 筆的訓練時間`),
    entries: entries.map((entry, entryIndex) => {
      if (typeof entry !== 'object' || entry === null) fail(`第 ${index + 1} 筆的動作紀錄壞掉`)
      const e = entry as Record<string, unknown>
      const sets = Array.isArray(e.sets) ? e.sets : fail(`第 ${index + 1} 筆缺少組數資料`)
      return {
        trackId: asString(e.trackId, `第 ${index + 1} 筆第 ${entryIndex + 1} 個動作的軌道`),
        exerciseId: asString(e.exerciseId, `第 ${index + 1} 筆第 ${entryIndex + 1} 個動作`),
        sets: sets.map((set) => {
          const s = set as Record<string, unknown>
          return {
            weight: asNumber(s.weight, '重量'),
            reps: asNumber(s.reps, '次數'),
            rir: asNumber(s.rir, '保留次數'),
          }
        }),
      }
    }),
    ...(typeof r.condition === 'string' ? { condition: r.condition as Session['condition'] } : {}),
    ...(typeof r.note === 'string' ? { note: r.note } : {}),
  }
}

export function parseBackup(text: string): BackupFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    fail('不是有效的 JSON')
  }
  if (typeof raw !== 'object' || raw === null) fail('內容不是物件')
  const r = raw as Record<string, unknown>
  if (r.format !== 'training-os-backup') fail('這不是 Training OS 的備份檔')
  const version = asNumber(r.version, '版本')
  if (version > BACKUP_VERSION) fail(`版本 ${version} 比這個 App 還新，請先更新 App`)

  const rawState = (typeof r.state === 'object' && r.state !== null ? r.state : {}) as Record<
    string,
    unknown
  >
  const overrides =
    typeof rawState.incrementOverrides === 'object' && rawState.incrementOverrides !== null
      ? (rawState.incrementOverrides as Record<string, number>)
      : {}

  const state: AppState = {
    mode: rawState.mode === 5 ? 5 : DEFAULT_STATE.mode,
    cursor: typeof rawState.cursor === 'number' ? rawState.cursor : 0,
    incrementOverrides: Object.fromEntries(
      Object.entries(overrides).filter(([, v]) => typeof v === 'number' && v > 0),
    ),
    // 這個欄位是後來才加的，舊備份沒有。
    emptyBarKg:
      typeof rawState.emptyBarKg === 'number' && rawState.emptyBarKg > 0
        ? rawState.emptyBarKg
        : DEFAULT_STATE.emptyBarKg,
  }

  const sessions = Array.isArray(r.sessions) ? r.sessions.map(parseSession) : fail('缺少訓練紀錄')

  const bodyWeight: BodyWeightRecord[] = Array.isArray(r.bodyWeight)
    ? r.bodyWeight.map((item, i) => {
        const w = item as Record<string, unknown>
        return {
          date: asString(w.date, `第 ${i + 1} 筆體重的日期`),
          weight: asNumber(w.weight, `第 ${i + 1} 筆體重`),
        }
      })
    : []

  return { format: 'training-os-backup', version, exportedAt: String(r.exportedAt ?? ''), state, sessions, bodyWeight }
}
