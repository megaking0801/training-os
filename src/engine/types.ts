/**
 * Engine 層的輸入／輸出型別。
 *
 * 這一層是 pure function，不 import store，也不 import React。
 * store 存的紀錄型別會相容於這裡的 `LoggedSet`。
 */

export interface LoggedSet {
  /** 公斤。自體重動作填額外負重，沒加就是 0。 */
  weight: number
  /** 單側動作填的是「每側」次數。 */
  reps: number
  /** 保留次數。 */
  rir: number
}

/** 某條進展軌道最近一次完成的紀錄。 */
export interface TrackEntry {
  /** ISO 日期，例如 2026-09-15。 */
  date: string
  sets: LoggedSet[]
}

export type SuggestionAction =
  /** 沒有歷史紀錄，這次要自己抓重量。 */
  | 'start'
  /** 維持重量，先把次數推上去。 */
  | 'hold'
  /** 達標，加一級重量。 */
  | 'increase'
  /** 重量由另一條軌道推導出來（降重工作組）。 */
  | 'derived'

export interface Suggestion {
  action: SuggestionAction
  /** 建議的本次重量。`start` 時為 undefined。 */
  weight?: number
  /** `derived` 專用：建議的重量區間。 */
  weightRange?: [number, number]
  /** 介面直接顯示的中文說明。 */
  message: string
}
