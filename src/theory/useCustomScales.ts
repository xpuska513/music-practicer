/**
 * React hook for managing user-created scales backed by localStorage.
 *
 * Keeps multiple mounted instances (and other tabs) in sync via a custom
 * window event and the native "storage" event.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScaleDef } from '../types'
import {
  CUSTOM_SCALES_EVENT,
  CUSTOM_SCALES_KEY,
  loadCustomScales,
  makeScaleId,
  normalizeIntervals,
  saveCustomScales,
} from './customScales'

/** Input shape for creating/updating a custom scale. */
interface ScaleInput {
  name: string
  intervals: number[]
}

/** Public API returned by useCustomScales. */
export interface CustomScalesApi {
  customScales: ScaleDef[]
  addScale(input: ScaleInput): ScaleDef
  updateScale(id: string, input: ScaleInput): void
  removeScale(id: string): void
}

export function useCustomScales(): CustomScalesApi {
  const [customScales, setCustomScales] = useState<ScaleDef[]>(() =>
    loadCustomScales(),
  )

  // Mirror of state so mutations can compute the next list from the latest
  // value without depending on a re-created callback.
  const scalesRef = useRef<ScaleDef[]>(customScales)
  scalesRef.current = customScales

  const persist = useCallback((next: ScaleDef[]) => {
    saveCustomScales(next)
    setCustomScales(next)
    try {
      window.dispatchEvent(new Event(CUSTOM_SCALES_EVENT))
    } catch {
      // Environments without window/Event support: state still updated.
    }
  }, [])

  useEffect(() => {
    const reload = () => setCustomScales(loadCustomScales())
    const onStorage = (e: StorageEvent) => {
      if (e.key === CUSTOM_SCALES_KEY) reload()
    }
    window.addEventListener(CUSTOM_SCALES_EVENT, reload)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(CUSTOM_SCALES_EVENT, reload)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const addScale = useCallback(
    (input: ScaleInput): ScaleDef => {
      const scale: ScaleDef = {
        id: makeScaleId(input.name),
        name: input.name.trim(),
        intervals: normalizeIntervals(input.intervals),
        category: 'custom',
      }
      persist([...scalesRef.current, scale])
      return scale
    },
    [persist],
  )

  const updateScale = useCallback(
    (id: string, input: ScaleInput): void => {
      const next = scalesRef.current.map((s) =>
        s.id === id
          ? {
              ...s,
              name: input.name.trim(),
              intervals: normalizeIntervals(input.intervals),
            }
          : s,
      )
      persist(next)
    },
    [persist],
  )

  const removeScale = useCallback(
    (id: string): void => {
      persist(scalesRef.current.filter((s) => s.id !== id))
    },
    [persist],
  )

  return { customScales, addScale, updateScale, removeScale }
}
