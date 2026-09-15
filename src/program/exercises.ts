import type { Exercise } from './types'

/**
 * 動作字典。key 就是 exerciseId。
 *
 * 肌群標記只用 Handoff §22 列出的十個群組，所以前三角肌不單獨統計；
 * 肩推歸在側三角肌下面，是刻意的近似。
 */
export const EXERCISES = {
  barbellBench: {
    id: 'barbellBench',
    name: '槓鈴臥推',
    equipment: 'barbell',
    primary: ['chest'],
    secondary: ['triceps'],
  },
  inclineDbPress: {
    id: 'inclineDbPress',
    name: '上斜啞鈴臥推',
    equipment: 'dumbbell',
    primary: ['chest'],
    secondary: ['triceps'],
  },
  machineInclinePress: {
    id: 'machineInclinePress',
    name: '機械式上胸推',
    equipment: 'machine',
    primary: ['chest'],
    secondary: ['triceps'],
  },
  cableFly: {
    id: 'cableFly',
    name: '滑輪夾胸',
    equipment: 'cable',
    primary: ['chest'],
  },
  lateralRaise: {
    id: 'lateralRaise',
    name: '側平舉',
    equipment: 'dumbbell',
    primary: ['sideDelt'],
  },
  seatedDbShoulderPress: {
    id: 'seatedDbShoulderPress',
    name: '坐姿啞鈴肩推',
    equipment: 'dumbbell',
    primary: ['sideDelt'],
    secondary: ['triceps'],
  },
  cableTricepsPushdown: {
    id: 'cableTricepsPushdown',
    name: '繩索三頭下壓',
    equipment: 'cable',
    primary: ['triceps'],
  },
  overheadTricepsExt: {
    id: 'overheadTricepsExt',
    name: '過頭滑輪三頭伸展',
    equipment: 'cable',
    primary: ['triceps'],
  },
  pullUp: {
    id: 'pullUp',
    name: '引體向上',
    equipment: 'bodyweight',
    primary: ['back'],
    secondary: ['biceps'],
  },
  chestSupportedRow: {
    id: 'chestSupportedRow',
    name: '胸部支撐划船',
    equipment: 'machine',
    primary: ['back'],
    secondary: ['biceps', 'rearDelt'],
  },
  machineSeatedRow: {
    id: 'machineSeatedRow',
    name: '機械式水平划船',
    equipment: 'machine',
    primary: ['back'],
    secondary: ['biceps', 'rearDelt'],
  },
  neutralLatPulldown: {
    id: 'neutralLatPulldown',
    name: '中立握高位下拉',
    equipment: 'cable',
    primary: ['back'],
    secondary: ['biceps'],
  },
  singleArmLatPulldown: {
    id: 'singleArmLatPulldown',
    name: '單手滑輪下拉',
    equipment: 'cable',
    primary: ['back'],
    secondary: ['biceps'],
  },
  reversePecDeck: {
    id: 'reversePecDeck',
    name: '反向蝴蝶機',
    equipment: 'machine',
    primary: ['rearDelt'],
  },
  ezBarCurl: {
    id: 'ezBarCurl',
    name: 'W 槓二頭彎舉',
    equipment: 'barbell',
    primary: ['biceps'],
  },
  dumbbellCurl: {
    id: 'dumbbellCurl',
    name: '二頭彎舉',
    equipment: 'dumbbell',
    primary: ['biceps'],
  },
  hackSquat: {
    id: 'hackSquat',
    name: '哈克深蹲',
    equipment: 'machine',
    primary: ['quads'],
    secondary: ['glutes'],
  },
  singleLegPress: {
    id: 'singleLegPress',
    name: '單腳腿推',
    equipment: 'machine',
    primary: ['quads'],
    secondary: ['glutes'],
  },
  seatedLegCurl: {
    id: 'seatedLegCurl',
    name: '坐姿腿彎舉',
    equipment: 'machine',
    primary: ['hamstrings'],
  },
  hipThrust: {
    id: 'hipThrust',
    name: '史密斯機臀推',
    equipment: 'smith',
    primary: ['glutes'],
    secondary: ['hamstrings'],
  },
  legExtension: {
    id: 'legExtension',
    name: '腿伸展',
    equipment: 'machine',
    primary: ['quads'],
  },
  calfRaise: {
    id: 'calfRaise',
    name: '提踵',
    equipment: 'machine',
    primary: ['calves'],
  },
} as const satisfies Record<string, Exercise>

export type ExerciseId = keyof typeof EXERCISES

export function getExercise(id: string): Exercise {
  const found = (EXERCISES as Record<string, Exercise>)[id]
  if (!found) throw new Error(`未知的動作 ID：${id}`)
  return found
}
