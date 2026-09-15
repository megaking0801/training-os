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
  finishSession: (options: { condition?: Condition; note?: string }) => Promise<void>
  discardDraft: () => Promise<void>
  recordBodyWeight: (date: string, weight: number) => Promise<void>
  removeBodyWeight: (date: string) => Promise<void>
  setIncrement: (exerciseId: string, increment: number | null) => Promise<void>
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
      const completedAt = Date.now()
      const session: Session = {
        id: draft.id,
        date: draft.date,
        dayId: draft.dayId,
        mode: draft.mode,
        startedAt: draft.startedAt,
        completedAt,
        durationSec: Math.round((completedAt - draft.startedAt) / 1000),
        // 一組都沒記的動作不留空殼，否則歷史與訓練量都會被灌水。
        entries: draft.entries.filter((e) => e.sets.length > 0),
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
      discardDraft,
      recordBodyWeight,
      removeBodyWeight,
      setIncrement,
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
      discardDraft,
      recordBodyWeight,
      removeBodyWeight,
      setIncrement,
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
