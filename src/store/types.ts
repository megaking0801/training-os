import type { DayId, WeekMode } from '../program/types'
import type { LoggedSet } from '../engine/types'

/** 一個動作在某次訓練裡的紀錄。 */
export interface SessionEntry {
  trackId: string
  exerciseId: string
  sets: LoggedSet[]
}

/** 訓練後的今日狀態。Handoff §24。 */
export type Condition = 'normal' | 'fatigued' | 'lowBack' | 'shoulder' | 'elbow' | 'other'

export const CONDITION_LABEL: Record<Condition, string> = {
  normal: '正常',
  fatigued: '疲勞',
  lowBack: '腰緊',
  shoulder: '肩不舒服',
  elbow: '肘不舒服',
  other: '其他',
}

/** 需要系統放慢加重的狀態。 */
export const CAUTION_CONDITIONS: Condition[] = ['lowBack', 'shoulder', 'elbow']

/** 已完成的訓練。Handoff §25。 */
export interface Session {
  id: string
  /** 本機時區的 YYYY-MM-DD。 */
  date: string
  dayId: DayId
  mode: WeekMode
  startedAt: number
  completedAt: number
  durationSec: number
  entries: SessionEntry[]
  condition?: Condition
  note?: string
}

/**
 * 進行中的訓練。
 *
 * 在健身房中途切換 App 或關掉 Safari 很常見，所以每記完一組就寫回硬碟，
 * 下次打開直接接續。
 */
export interface DraftSession {
  id: string
  date: string
  dayId: DayId
  mode: WeekMode
  startedAt: number
  entries: SessionEntry[]
}

export interface BodyWeightRecord {
  /** YYYY-MM-DD，同一天只留一筆。 */
  date: string
  weight: number
}

export interface AppState {
  mode: WeekMode
  /** 本循環已完成幾堂。 */
  cursor: number
  /** 使用者覆寫的加重級距，key 是 exerciseId。 */
  incrementOverrides: Record<string, number>
}

export const DEFAULT_STATE: AppState = {
  mode: 4,
  cursor: 0,
  incrementOverrides: {},
}

/** JSON 備份檔的格式。Handoff §29。 */
export interface BackupFile {
  format: 'training-os-backup'
  version: number
  exportedAt: string
  state: AppState
  sessions: Session[]
  bodyWeight: BodyWeightRecord[]
}

export const BACKUP_VERSION = 1
