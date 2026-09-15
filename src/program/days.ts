import type { DayId, TrainingDay, WeekMode } from './types'

/**
 * 六堂課表。對應 Handoff §4–§9。
 *
 * 休息秒數依 Handoff §19：重臥推與哈克深蹲 3–4 分鐘、一般複合動作 2–3 分鐘、
 * 側平舉／手臂／飛鳥 60–90 秒。
 */

const pushA: TrainingDay = {
  id: 'pushA',
  name: '推日 A',
  subtitle: '臥推力量',
  slots: [
    {
      trackId: 'benchTopSet',
      exerciseId: 'barbellBench',
      label: '槓鈴臥推－主力重組',
      sets: 1,
      reps: [4, 6],
      rir: [1, 1],
      restSeconds: 240,
      progression: 'benchTopSet',
      note: '這一組不是測最大重量。維持動作品質，保留約 1 下。',
    },
    {
      trackId: 'benchBackoff',
      exerciseId: 'barbellBench',
      label: '槓鈴臥推－降重工作組',
      sets: 3,
      reps: [5, 7],
      rir: [1, 2],
      restSeconds: 180,
      progression: 'backoff',
      derivedFrom: { trackId: 'benchTopSet', percent: [90, 93] },
    },
    {
      trackId: 'inclineDbPress',
      exerciseId: 'inclineDbPress',
      sets: 3,
      reps: [6, 10],
      rir: [1, 2],
      restSeconds: 150,
      progression: 'double',
    },
    {
      trackId: 'lateralRaise',
      exerciseId: 'lateralRaise',
      sets: 3,
      reps: [12, 20],
      rir: [1, 2],
      restSeconds: 90,
      progression: 'double',
    },
    {
      trackId: 'cableTricepsPushdown',
      exerciseId: 'cableTricepsPushdown',
      sets: 2,
      reps: [8, 12],
      rir: [1, 2],
      restSeconds: 90,
      progression: 'double',
    },
  ],
}

const pullA: TrainingDay = {
  id: 'pullA',
  name: '拉日 A',
  subtitle: '背部主力',
  slots: [
    {
      trackId: 'pullUp',
      exerciseId: 'pullUp',
      sets: 3,
      reps: [6, 10],
      rir: [1, 2],
      restSeconds: 150,
      progression: 'bodyweightReps',
      note: '重量欄填額外負重，沒有加負重就填 0。',
    },
    {
      trackId: 'chestSupportedRow',
      exerciseId: 'chestSupportedRow',
      sets: 3,
      reps: [8, 12],
      rir: [1, 2],
      restSeconds: 150,
      progression: 'double',
    },
    {
      trackId: 'singleArmLatPulldown',
      exerciseId: 'singleArmLatPulldown',
      sets: 2,
      reps: [8, 12],
      rir: [1, 2],
      restSeconds: 120,
      progression: 'double',
      perSide: true,
    },
    {
      trackId: 'reversePecDeck',
      exerciseId: 'reversePecDeck',
      sets: 3,
      reps: [12, 20],
      rir: [1, 2],
      restSeconds: 90,
      progression: 'double',
    },
    {
      trackId: 'ezBarCurl',
      exerciseId: 'ezBarCurl',
      sets: 3,
      reps: [8, 12],
      rir: [1, 2],
      restSeconds: 90,
      progression: 'double',
    },
  ],
}

const legs: TrainingDay = {
  id: 'legs',
  name: '腿部日',
  subtitle: '下肢',
  slots: [
    {
      trackId: 'hackSquat',
      exerciseId: 'hackSquat',
      sets: 3,
      reps: [6, 10],
      rir: [1, 2],
      restSeconds: 240,
      progression: 'double',
    },
    {
      trackId: 'singleLegPress',
      exerciseId: 'singleLegPress',
      sets: 2,
      reps: [8, 12],
      rir: [1, 2],
      restSeconds: 150,
      progression: 'double',
      perSide: true,
      note: '底部若骨盆捲起、屁股離開靠墊或腰明顯緊繃，就縮短下放深度。',
    },
    {
      trackId: 'seatedLegCurl',
      exerciseId: 'seatedLegCurl',
      sets: 4,
      reps: [8, 12],
      rir: [1, 2],
      restSeconds: 120,
      progression: 'double',
    },
    {
      trackId: 'hipThrust',
      exerciseId: 'hipThrust',
      sets: 3,
      reps: [6, 10],
      rir: [1, 2],
      restSeconds: 150,
      progression: 'double',
    },
    {
      trackId: 'legExtension',
      exerciseId: 'legExtension',
      sets: 2,
      reps: [10, 15],
      rir: [1, 2],
      restSeconds: 90,
      progression: 'double',
    },
    {
      trackId: 'calfRaise',
      exerciseId: 'calfRaise',
      sets: 3,
      reps: [10, 15],
      rir: [1, 2],
      restSeconds: 90,
      progression: 'double',
    },
  ],
}

const upperB: TrainingDay = {
  id: 'upperB',
  name: '上肢 B',
  subtitle: '胸背第二刺激',
  slots: [
    {
      trackId: 'benchPaused',
      exerciseId: 'barbellBench',
      label: '暫停槓鈴臥推',
      sets: 3,
      reps: [6, 8],
      rir: [2, 2],
      restSeconds: 180,
      progression: 'double',
      note: '胸口停約 1 秒。這是第二次胸部刺激與臥推技術，不是第二個重臥推日。',
    },
    {
      trackId: 'machineInclinePress',
      exerciseId: 'machineInclinePress',
      sets: 2,
      reps: [8, 12],
      rir: [1, 2],
      restSeconds: 150,
      progression: 'double',
    },
    {
      trackId: 'neutralLatPulldown',
      exerciseId: 'neutralLatPulldown',
      sets: 3,
      reps: [8, 12],
      rir: [1, 2],
      restSeconds: 150,
      progression: 'double',
    },
    {
      trackId: 'machineSeatedRow',
      exerciseId: 'machineSeatedRow',
      sets: 3,
      reps: [8, 12],
      rir: [1, 2],
      restSeconds: 150,
      progression: 'double',
    },
    {
      trackId: 'lateralRaise',
      exerciseId: 'lateralRaise',
      sets: 3,
      reps: [12, 20],
      rir: [1, 2],
      restSeconds: 90,
      progression: 'double',
    },
    {
      trackId: 'reversePecDeck',
      exerciseId: 'reversePecDeck',
      sets: 2,
      reps: [12, 20],
      rir: [1, 2],
      restSeconds: 90,
      progression: 'double',
    },
    {
      trackId: 'dumbbellCurl',
      exerciseId: 'dumbbellCurl',
      sets: 2,
      reps: [8, 12],
      rir: [1, 2],
      restSeconds: 90,
      progression: 'double',
    },
    {
      trackId: 'overheadTricepsExt',
      exerciseId: 'overheadTricepsExt',
      sets: 2,
      reps: [10, 15],
      rir: [1, 2],
      restSeconds: 90,
      progression: 'double',
    },
  ],
}

const pushB: TrainingDay = {
  id: 'pushB',
  name: '推日 B',
  subtitle: '胸肩增肌',
  slots: [
    {
      trackId: 'benchPaused',
      exerciseId: 'barbellBench',
      label: '暫停槓鈴臥推',
      sets: 3,
      reps: [6, 8],
      rir: [2, 2],
      restSeconds: 180,
      progression: 'double',
      note: '胸口停約 1 秒。',
    },
    {
      trackId: 'machineInclinePress',
      exerciseId: 'machineInclinePress',
      sets: 2,
      reps: [8, 12],
      rir: [1, 2],
      restSeconds: 150,
      progression: 'double',
    },
    {
      trackId: 'cableFly',
      exerciseId: 'cableFly',
      sets: 2,
      reps: [10, 15],
      rir: [1, 2],
      restSeconds: 90,
      progression: 'double',
    },
    {
      trackId: 'seatedDbShoulderPress',
      exerciseId: 'seatedDbShoulderPress',
      sets: 2,
      reps: [6, 10],
      rir: [2, 2],
      restSeconds: 150,
      progression: 'double',
    },
    {
      trackId: 'lateralRaise',
      exerciseId: 'lateralRaise',
      sets: 4,
      reps: [12, 20],
      rir: [1, 2],
      restSeconds: 90,
      progression: 'double',
    },
    {
      trackId: 'overheadTricepsExt',
      exerciseId: 'overheadTricepsExt',
      sets: 3,
      reps: [10, 15],
      rir: [1, 2],
      restSeconds: 90,
      progression: 'double',
    },
  ],
}

const pullB: TrainingDay = {
  id: 'pullB',
  name: '拉日 B',
  subtitle: '背部增肌',
  slots: [
    {
      trackId: 'neutralLatPulldown',
      exerciseId: 'neutralLatPulldown',
      sets: 3,
      reps: [8, 12],
      rir: [1, 2],
      restSeconds: 150,
      progression: 'double',
    },
    {
      trackId: 'singleArmLatPulldown',
      exerciseId: 'singleArmLatPulldown',
      sets: 2,
      reps: [8, 12],
      rir: [1, 2],
      restSeconds: 120,
      progression: 'double',
      perSide: true,
    },
    {
      trackId: 'machineSeatedRow',
      exerciseId: 'machineSeatedRow',
      sets: 3,
      reps: [8, 12],
      rir: [1, 2],
      restSeconds: 150,
      progression: 'double',
    },
    {
      trackId: 'reversePecDeck',
      exerciseId: 'reversePecDeck',
      sets: 3,
      reps: [12, 20],
      rir: [1, 2],
      restSeconds: 90,
      progression: 'double',
    },
    {
      trackId: 'ezBarCurl',
      exerciseId: 'ezBarCurl',
      sets: 3,
      reps: [8, 12],
      rir: [1, 2],
      restSeconds: 90,
      progression: 'double',
    },
  ],
}

export const DAYS: Record<DayId, TrainingDay> = { pushA, pullA, legs, upperB, pushB, pullB }

/**
 * 課表循環順序。Handoff §3。
 *
 * 四天：把第二次推＋拉合併成上肢 B。
 * 五天：把上肢 B 拆成完整的推日 B ＋ 拉日 B。
 */
export const SEQUENCES: Record<WeekMode, DayId[]> = {
  4: ['pushA', 'pullA', 'legs', 'upperB'],
  5: ['pushA', 'pullA', 'legs', 'pushB', 'pullB'],
}

export function getDay(id: DayId): TrainingDay {
  return DAYS[id]
}
