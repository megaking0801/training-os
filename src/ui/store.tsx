import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { DayId, WeekMode } from '../program/types'
import { DAYS } from '../program/days'
import { advanceCursor, nextDay } from '../engine/sequence'
import { toDateKey } from '../engine/dates'
import * as db from '../store/db'
import { buildBackup, parseBackup, serializeBackup } from '../store/backup'
import { toSessionEntries } from '../store/selectors'
import {
  DEFAULT_STATE,
  type AppState,
  type BodyWeightRecord,
  type Condition,
  type DraftSession,
  type Session,
  type SessionEntry,
} from '../store/types'

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export interface AppData {
  ready: boolean
  state: AppState
  sessions: Session[]
  bodyWeight: BodyWeightRecord[]
  draft: DraftSession | null
  /** 瀏覽器是否答應不回收這個網站的資料。 */
  persisted: boolean
  setMode: (mode: WeekMode) => Promise<void>
  startSession: (dayId?: DayId) => Promise<void>
  updateEntry: (entry: SessionEntry) => Promise<void>
  /** 一組都沒記時不會留下紀錄，課表也不往前走。 */
  finishSession: (options: { condition?: Condition; note?: string }) => Promise<void>
  /** 這堂不做了，課表直接移到下一堂。不留紀錄。 */
  skipDay: () => Promise<void>
  discardDraft: () => Promise<void>
  recordBodyWeight: (date: string, weight: number) => Promise<void>
  removeBodyWeight: (date: string) => Promise<void>
  setIncrement: (exerciseId: string, increment: number | null) => Promise<void>
  setEmptyBarKg: (weight: number) => Promise<void>
  exportJson: () => string
  importJson: (text: string) => Promise<void>
  deleteSession: (id: string) => Promise<void>
}

const AppDataContext = createContext<AppData | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<AppState>(DEFAULT_STATE)
  const [sessions, setSessions] = useState<Session[]>([])
  const [bodyWeight, setBodyWeight] = useState<BodyWeightRecord[]>([])
  const [draft, setDraft] = useState<DraftSession | null>(null)
  const [persisted, setPersisted] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [loadedState, loadedSessions, loadedWeight, loadedDraft, isPersisted] =
        await Promise.all([
          db.loadState(),
          db.loadSessions(),
          db.loadBodyWeight(),
          db.loadDraft(),
          db.requestPersistentStorage(),
        ])
      if (cancelled) return
      setState(loadedState ?? DEFAULT_STATE)
      setSessions(loadedSessions)
      setBodyWeight(loadedWeight)
      setDraft(loadedDraft ?? null)
      setPersisted(isPersisted)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const persistState = useCallback(async (next: AppState) => {
    setState(next)
    await db.saveState(next)
  }, [])

  const setMode = useCallback(
    async (mode: WeekMode) => {
      await persistState({ ...state, mode })
    },
    [persistState, state],
  )

  const setIncrement = useCallback(
    async (exerciseId: string, increment: number | null) => {
      const overrides = { ...state.incrementOverrides }
      if (increment && increment > 0) overrides[exerciseId] = increment
      else delete overrides[exerciseId]
      await persistState({ ...state, incrementOverrides: overrides })
    },
    [persistState, state],
  )

  const setEmptyBarKg = useCallback(
    async (weight: number) => {
      if (!(weight > 0)) return
      await persistState({ ...state, emptyBarKg: weight })
    },
    [persistState, state],
  )

  const startSession = useCallback(
    async (dayId?: DayId) => {
      const target = dayId ?? nextDay(state.mode, state.cursor)
      const next: DraftSession = {
        id: newId(),
        date: toDateKey(),
        dayId: target,
        mode: state.mode,
        startedAt: Date.now(),
        entries: DAYS[target].slots.map((slot) => ({
          trackId: slot.trackId,
          exerciseId: slot.exerciseId,
          sets: [],
        })),
      }
      setDraft(next)
      await db.saveDraft(next)
    },
    [state.cursor, state.mode],
  )

  const updateEntry = useCallback(
    async (entry: SessionEntry) => {
      setDraft((current) => {
        if (!current) return current
        const next: DraftSession = {
          ...current,
          entries: current.entries.map((e) => (e.trackId === entry.trackId ? entry : e)),
        }
        void db.saveDraft(next)
        return next
      })
    },
    [],
  )

  const finishSession = useCallback(
    async ({ condition, note }: { condition?: Condition; note?: string }) => {
      if (!draft) return

      // 一組都沒記的動作不留空殼，熱身組也不進歷史，否則訓練量會被灌水。
      const entries = toSessionEntries(draft.entries)

      // 整堂一組都沒記，就當這次沒練成：不留紀錄，課表也不往前走，
      // 下次打開還是同一堂。想直接不做這堂請用首頁的「跳過這堂」。
      if (entries.length === 0) {
        await db.clearDraft()
        setDraft(null)
        return
      }

      const completedAt = Date.now()
      const session: Session = {
        id: draft.id,
        date: draft.date,
        dayId: draft.dayId,
        mode: draft.mode,
        startedAt: draft.startedAt,
        completedAt,
        durationSec: Math.round((completedAt - draft.startedAt) / 1000),
        entries,
        ...(condition ? { condition } : {}),
        ...(note ? { note } : {}),
      }
      await db.putSession(session)
      await db.clearDraft()
      const nextState: AppState = { ...state, cursor: advanceCursor(state.mode, state.cursor) }
      await db.saveState(nextState)
      setState(nextState)
      setSessions(await db.loadSessions())
      setDraft(null)
    },
    [draft, state],
  )

  /**
   * 這堂不做了，直接跳到下一堂。
   *
   * 已經開始但還沒完成的訓練會一起丟掉，否則 cursor 會指到下一堂、
   * draft 卻還停在被跳過的那堂，兩邊對不上。
   */
  const skipDay = useCallback(async () => {
    if (draft) {
      await db.clearDraft()
      setDraft(null)
    }
    const nextState: AppState = { ...state, cursor: advanceCursor(state.mode, state.cursor) }
    await db.saveState(nextState)
    setState(nextState)
  }, [draft, state])

  const discardDraft = useCallback(async () => {
    await db.clearDraft()
    setDraft(null)
  }, [])

  const recordBodyWeight = useCallback(async (date: string, weight: number) => {
    await db.putBodyWeight({ date, weight })
    setBodyWeight(await db.loadBodyWeight())
  }, [])

  const removeBodyWeight = useCallback(async (date: string) => {
    await db.deleteBodyWeight(date)
    setBodyWeight(await db.loadBodyWeight())
  }, [])

  const deleteSession = useCallback(async (id: string) => {
    await db.deleteSession(id)
    setSessions(await db.loadSessions())
  }, [])

  const exportJson = useCallback(
    () => serializeBackup(buildBackup(state, sessions, bodyWeight)),
    [bodyWeight, sessions, state],
  )

  const importJson = useCallback(async (text: string) => {
    const backup = parseBackup(text)
    await db.replaceAll({
      state: backup.state,
      sessions: backup.sessions,
      bodyWeight: backup.bodyWeight,
    })
    setState(backup.state)
    setSessions(await db.loadSessions())
    setBodyWeight(await db.loadBodyWeight())
    setDraft(null)
  }, [])

  const value = useMemo<AppData>(
    () => ({
      ready,
      state,
      sessions,
      bodyWeight,
      draft,
      persisted,
      setMode,
      startSession,
      updateEntry,
      finishSession,
      skipDay,
      discardDraft,
      recordBodyWeight,
      removeBodyWeight,
      setIncrement,
      setEmptyBarKg,
      exportJson,
      importJson,
      deleteSession,
    }),
    [
      ready,
      state,
      sessions,
      bodyWeight,
      draft,
      persisted,
      setMode,
      startSession,
      updateEntry,
      finishSession,
      skipDay,
      discardDraft,
      recordBodyWeight,
      removeBodyWeight,
      setIncrement,
      setEmptyBarKg,
      exportJson,
      importJson,
      deleteSession,
    ],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppData {
  const value = useContext(AppDataContext)
  if (!value) throw new Error('useAppData 必須在 AppDataProvider 裡使用')
  return value
}
