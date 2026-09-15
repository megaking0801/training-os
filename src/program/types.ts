/**
 * 課表定義的型別。
 *
 * 這一層是純資料，不依賴任何其他模組，也不寫入資料庫。
 * 課表要改版就改這裡的定義再重新部署，不需要資料庫 migration。
 *
 * 三種 ID 的分工（很重要，弄混會讓「上次紀錄」顯示錯誤的重量）：
 *
 * - `exerciseId`：實體動作。查歷史、畫趨勢圖用。
 *   例：主力重組、降重工作組、暫停臥推的 exerciseId 都是 barbellBench。
 *
 * - `trackId`：進展軌道。查「上次用多少」與算加重建議用。
 *   例：上面三者是三個不同的 trackId，因為它們的目標重量各自獨立演進。
 *   反過來，側平舉出現在推日 A／上肢 B／推日 B，共用同一個 trackId，
 *   因為它們本來就該是同一條進展軌道。
 *
 * - `dayId`：課表中的某一堂。
 */

/** 週訓練量統計的肌群。對應 Handoff §22。 */
export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'sideDelt'
  | 'rearDelt'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: '胸',
  back: '背',
  sideDelt: '側三角肌',
  rearDelt: '後三角肌',
  biceps: '二頭肌',
  triceps: '三頭肌',
  quads: '股四頭肌',
  hamstrings: '腿後側',
  glutes: '臀部',
  calves: '小腿',
}

/** 統計週訓練量時，肌群顯示的順序。 */
export const MUSCLE_ORDER: MuscleGroup[] = [
  'chest',
  'back',
  'sideDelt',
  'rearDelt',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
]

/**
 * 器材類型決定「增加最小可用重量」是多少。
 * 每個動作可以在設定裡個別覆寫（去健身工廠實際量過之後）。
 */
export type EquipmentType = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'smith' | 'bodyweight'

export const EQUIPMENT_LABEL: Record<EquipmentType, string> = {
  barbell: '槓鈴',
  dumbbell: '啞鈴',
  machine: '機械',
  cable: '滑輪',
  smith: '史密斯機',
  bodyweight: '自體重',
}

/** 各器材類型的預設加重級距（公斤）。 */
export const DEFAULT_INCREMENT: Record<EquipmentType, number> = {
  barbell: 2.5, // 一對 1.25 kg 槓片
  dumbbell: 2, // 啞鈴架常見跳階
  machine: 5, // 選重片一格
  cable: 2.5,
  smith: 2.5,
  bodyweight: 2.5, // 負重腰帶掛片
}

export interface Exercise {
  id: string
  /** 介面顯示用的中文名稱。 */
  name: string
  equipment: EquipmentType
  /** 完整計入週訓練量的肌群。 */
  primary: MuscleGroup[]
  /** 計入一半組數的肌群。 */
  secondary?: MuscleGroup[]
}

/**
 * 加重建議要用哪一套規則。
 *
 * - `double`：雙進展。先把次數推到區間上限，再加一級重量。Handoff §10。
 * - `benchTopSet`：臥推主力重組專屬。達標就加 2–2.5 kg。Handoff §16。
 * - `backoff`：降重工作組。重量由主力重組推導，不自己演進。Handoff §4。
 * - `bodyweightReps`：自體重動作。先把次數推滿，之後才建議加負重。Handoff §5。
 */
export type ProgressionKind = 'double' | 'benchTopSet' | 'backoff' | 'bodyweightReps'

/** 次數或保留次數的區間，`[下限, 上限]`。 */
export type Range = [number, number]

/** 某一堂課表裡的一個動作位置。 */
export interface Slot {
  trackId: string
  exerciseId: string
  /** 蓋掉動作的預設名稱，例如「槓鈴臥推－主力重組」。 */
  label?: string
  sets: number
  reps: Range
  /** 保留次數目標。 */
  rir: Range
  restSeconds: number
  progression: ProgressionKind
  /** 單側動作。次數欄填的是「每側」次數，一組記一筆。 */
  perSide?: boolean
  /** 卡片上顯示的動作提醒。 */
  note?: string
  /** `backoff` 專用：重量取自哪條軌道、打幾折。 */
  derivedFrom?: { trackId: string; percent: Range }
}

export type DayId = 'pushA' | 'pullA' | 'legs' | 'upperB' | 'pushB' | 'pullB'

export interface TrainingDay {
  id: DayId
  /** 例：推日 A */
  name: string
  /** 例：臥推力量 */
  subtitle: string
  slots: Slot[]
}

/** 每週訓練幾天。決定課表循環的長度。 */
export type WeekMode = 4 | 5
