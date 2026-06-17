/**
 * Note/string helpers for the tuner. Pitch *detection* is handled by the
 * `pitchy` library (McLeod Pitch Method) in useTuner; this module just maps a
 * detected frequency onto note names and standard-tuning strings.
 */
import { noteName } from '../theory/notes'

/** Open-string MIDI notes for standard tuning, low E .. high E (index 0..5). */
export const TUNING_MIDI: readonly number[] = [40, 45, 50, 55, 59, 64]
/** Display labels per string (low E .. high E). */
export const STRING_LABELS: readonly string[] = ['E', 'A', 'D', 'G', 'B', 'e']

/** Continuous (fractional) MIDI value for a frequency. */
export function midiFloatOf(frequency: number): number {
  return 12 * Math.log2(frequency / 440) + 69
}

export interface PitchInfo {
  frequency: number
  /** Nearest chromatic note name (e.g. "E", "F#"). */
  note: string
  octave: number
}

/** Nearest chromatic note + octave for a frequency. */
export function analysePitch(frequency: number): PitchInfo {
  const midi = Math.round(midiFloatOf(frequency))
  return {
    frequency,
    note: noteName(((midi % 12) + 12) % 12),
    octave: Math.floor(midi / 12) - 1,
  }
}

/** Index (0..5) of the standard-tuning string closest to a frequency. */
export function nearestString(frequency: number): number {
  const m = midiFloatOf(frequency)
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < TUNING_MIDI.length; i++) {
    const dist = Math.abs(m - TUNING_MIDI[i])
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best
}

/** Cents the frequency is off from a specific string's target pitch (±). */
export function centsFromString(frequency: number, stringIndex: number): number {
  return Math.round((midiFloatOf(frequency) - TUNING_MIDI[stringIndex]) * 100)
}
