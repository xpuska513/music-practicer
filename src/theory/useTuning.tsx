import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { usePersistentState } from '../lib/usePersistentState'
import { DEFAULT_TUNING_ID, TUNINGS, tuningById } from './tuning'
import type { Tuning } from './tuning'

interface TuningContextValue {
  tuning: Tuning
  tuningId: string
  setTuningId: (id: string) => void
}

const TuningContext = createContext<TuningContextValue | null>(null)

const isTuningId = (v: unknown): v is string =>
  typeof v === 'string' && TUNINGS.some((t) => t.id === v)

/** Provides the app-wide active tuning (persisted), shared by every view. */
export function TuningProvider({ children }: { children: ReactNode }) {
  const [tuningId, setTuningId] = usePersistentState<string>(
    'tuning:id',
    DEFAULT_TUNING_ID,
    isTuningId,
  )
  const tuning = tuningById(tuningId)
  return (
    <TuningContext.Provider value={{ tuning, tuningId, setTuningId }}>
      {children}
    </TuningContext.Provider>
  )
}

export function useTuning(): TuningContextValue {
  const ctx = useContext(TuningContext)
  if (!ctx) throw new Error('useTuning must be used within a TuningProvider')
  return ctx
}
