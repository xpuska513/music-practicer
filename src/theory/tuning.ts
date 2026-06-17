/**
 * Instrument tuning model. A tuning is just the list of open-string MIDI notes
 * (low string → high string); the number of strings is the array length, so
 * 6-, 7-, and 8-string guitars all fall out of the same structure.
 */
import { noteName } from './notes'

export interface Tuning {
  id: string
  name: string
  /** Open-string MIDI notes, low → high. Length = number of strings. */
  strings: number[]
}

export const TUNINGS: Tuning[] = [
  { id: '6-standard', name: '6-string · E A D G B E', strings: [40, 45, 50, 55, 59, 64] },
  { id: '7-standard', name: '7-string · B E A D G B E', strings: [35, 40, 45, 50, 55, 59, 64] },
  {
    id: '8-standard',
    name: '8-string · F# B E A D G B E',
    strings: [30, 35, 40, 45, 50, 55, 59, 64],
  },
]

export const DEFAULT_TUNING_ID = '6-standard'

export function tuningById(id: string): Tuning {
  return TUNINGS.find((t) => t.id === id) ?? TUNINGS[0]
}

/** Per-string note-name labels, low → high (e.g. ['B','E','A','D','G','B','E']). */
export function stringLabels(tuning: Tuning): string[] {
  return tuning.strings.map((m) => noteName(((m % 12) + 12) % 12))
}

/** Ordinal name for string index `i` (0 = lowest = highest-numbered string). */
export function stringOrdinal(tuning: Tuning, i: number): string {
  const n = tuning.strings.length - i
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}
