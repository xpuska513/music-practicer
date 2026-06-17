import { useCallback, useEffect, useState } from 'react'
import type { ChordDef, ChordShape, NoteName } from '../types'
import {
  CUSTOM_CHORDS_EVENT,
  CUSTOM_CHORDS_KEY,
  loadCustomChords,
  makeChordId,
  saveCustomChords,
} from './customChords'

/** Fields supplied by the editor when creating or updating a custom chord. */
interface ChordInput {
  name: string
  root: NoteName
  quality?: string
  shape: ChordShape
}

/** Reactive + imperative surface returned by {@link useCustomChords}. */
export interface CustomChordsApi {
  customChords: ChordDef[]
  addChord(input: ChordInput): ChordDef
  updateChord(id: string, input: ChordInput): void
  removeChord(id: string): void
}

/**
 * Stateful access to the user's custom chords, kept in sync with localStorage
 * across hook instances (via {@link CUSTOM_CHORDS_EVENT}) and other tabs (via
 * the native `storage` event). Every mutation routes through `persist`, which
 * writes through, updates local state, and broadcasts the in-page event.
 */
export function useCustomChords(): CustomChordsApi {
  const [customChords, setCustomChords] = useState<ChordDef[]>(loadCustomChords)

  const persist = useCallback((next: ChordDef[]) => {
    saveCustomChords(next)
    setCustomChords(next)
    try {
      window.dispatchEvent(new Event(CUSTOM_CHORDS_EVENT))
    } catch {
      /* environments without window/Event — state already updated */
    }
  }, [])

  useEffect(() => {
    const resync = () => setCustomChords(loadCustomChords())
    const onStorage = (e: StorageEvent) => {
      if (e.key === CUSTOM_CHORDS_KEY) resync()
    }
    window.addEventListener(CUSTOM_CHORDS_EVENT, resync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(CUSTOM_CHORDS_EVENT, resync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const addChord = useCallback(
    (input: ChordInput): ChordDef => {
      const chord: ChordDef = {
        id: makeChordId(input.name),
        name: input.name.trim(),
        root: input.root,
        quality: input.quality ?? '',
        difficulty: 'custom',
        shape: input.shape,
      }
      persist([...loadCustomChords(), chord])
      return chord
    },
    [persist],
  )

  const updateChord = useCallback(
    (id: string, input: ChordInput) => {
      const next = loadCustomChords().map((c) =>
        c.id === id
          ? {
              ...c,
              name: input.name.trim(),
              root: input.root,
              quality: input.quality ?? '',
              difficulty: 'custom' as const,
              shape: input.shape,
            }
          : c,
      )
      persist(next)
    },
    [persist],
  )

  const removeChord = useCallback(
    (id: string) => {
      persist(loadCustomChords().filter((c) => c.id !== id))
    },
    [persist],
  )

  return { customChords, addChord, updateChord, removeChord }
}
