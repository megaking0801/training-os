import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AppState, BodyWeightRecord, DraftSession, Session } from './types'

/**
 * 本機資料庫。
 *
 * 用 IndexedDB 而不是 localStorage：容量大、不阻塞畫面，而且搭配
 * navigator.storage.persist() 之後 iOS 比較不會把資料清掉。
 */

const DB_NAME = 'training-os'
const DB_VERSION = 1

interface TrainingDB extends DBSchema {
  kv: {
    key: string
    value: { key: string; value: unknown }
  }
  sessions: {
    key: string
    value: Session
    indexes: { byDate: string }
  }
  bodyWeight: {
    key: string
    value: BodyWeightRecord
  }
}

const KEY_STATE = 'state'
const KEY_DRAFT = 'draft'

let dbPromise: Promise<IDBPDatabase<TrainingDB>> | null = null

function getDb(): Promise<IDBPDatabase<TrainingDB>> {
  dbPromise ??= openDB<TrainingDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const store = db.createObjectStore('sessions', { keyPath: 'id' })
        store.createIndex('byDate', 'date')
      }
      if (!db.objectStoreNames.contains('bodyWeight')) {
        db.createObjectStore('bodyWeight', { keyPath: 'date' })
      }
    },
  })
  return dbPromise
}

async function readKv<T>(key: string): Promise<T | undefined> {
  const row = await (await getDb()).get('kv', key)
  return row?.value as T | undefined
}

async function writeKv(key: string, value: unknown): Promise<void> {
  await (await getDb()).put('kv', { key, value })
}

export async function loadState(): Promise<AppState | undefined> {
  return readKv<AppState>(KEY_STATE)
}

export async function saveState(state: AppState): Promise<void> {
  await writeKv(KEY_STATE, state)
}

export async function loadDraft(): Promise<DraftSession | undefined> {
  return readKv<DraftSession>(KEY_DRAFT)
}

export async function saveDraft(draft: DraftSession): Promise<void> {
  await writeKv(KEY_DRAFT, draft)
}

export async function clearDraft(): Promise<void> {
  await (await getDb()).delete('kv', KEY_DRAFT)
}

/** 全部訓練紀錄，新的在前面。 */
export async function loadSessions(): Promise<Session[]> {
  const all = await (await getDb()).getAll('sessions')
  return all.sort((a, b) => b.completedAt - a.completedAt)
}

export async function putSession(session: Session): Promise<void> {
  await (await getDb()).put('sessions', session)
}

export async function deleteSession(id: string): Promise<void> {
  await (await getDb()).delete('sessions', id)
}

/** 體重紀錄，舊的在前面，方便直接畫趨勢圖。 */
export async function loadBodyWeight(): Promise<BodyWeightRecord[]> {
  const all = await (await getDb()).getAll('bodyWeight')
  return all.sort((a, b) => a.date.localeCompare(b.date))
}

export async function putBodyWeight(record: BodyWeightRecord): Promise<void> {
  await (await getDb()).put('bodyWeight', record)
}

export async function deleteBodyWeight(date: string): Promise<void> {
  await (await getDb()).delete('bodyWeight', date)
}

/** 匯入備份時整個蓋掉。 */
export async function replaceAll(payload: {
  state: AppState
  sessions: Session[]
  bodyWeight: BodyWeightRecord[]
}): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['kv', 'sessions', 'bodyWeight'], 'readwrite')
  await Promise.all([
    tx.objectStore('sessions').clear(),
    tx.objectStore('bodyWeight').clear(),
    tx.objectStore('kv').put({ key: KEY_STATE, value: payload.state }),
    tx.objectStore('kv').delete(KEY_DRAFT),
    ...payload.sessions.map((s) => tx.objectStore('sessions').put(s)),
    ...payload.bodyWeight.map((w) => tx.objectStore('bodyWeight').put(w)),
  ])
  await tx.done
}

/**
 * 請瀏覽器不要回收這個網站的資料。
 *
 * iOS 會清掉長期沒開的網站儲存空間；加入主畫面並取得 persisted 之後
 * 風險小很多。拿不到權限也不該讓 App 掛掉，所以只回傳結果。
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
