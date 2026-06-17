/**
 * Pure music-theory helpers for pitch classes, note names, and the fretboard.
 *
 * Conventions follow ../types.ts exactly:
 *   - pitch class 0..11, C=0 .. B=11
 *   - string index 0 = low E (6th), 5 = high E (1st)
 *   - fret 0 = open
 */

import {
  NOTE_NAMES,
  STANDARD_TUNING,
  type NoteName,
  type PitchClass,
} from '../types'

/** Pitch class -> canonical sharp note name. Wraps any integer into 0..11. */
export function noteName(pc: PitchClass): NoteName {
  return NOTE_NAMES[((pc % 12) + 12) % 12]
}

/** Canonical note name -> pitch class 0..11. */
export function pitchClassOf(name: NoteName): PitchClass {
  return NOTE_NAMES.indexOf(name)
}

/** Shift a pitch class by a (possibly negative) number of semitones, mod 12. */
export function transpose(pc: PitchClass, semitones: number): PitchClass {
  return (((pc + semitones) % 12) + 12) % 12
}

/** Pitch class sounding at a given string/fret in standard tuning. */
export function noteAt(stringIndex: number, fret: number): PitchClass {
  return transpose(STANDARD_TUNING[stringIndex], fret)
}

/**
 * The 12 chromatic roots starting at E ascending, so the scale selector reads
 * "E thru E": E, F, F#, G, G#, A, A#, B, C, C#, D, D#.
 */
export const ROOT_OPTIONS: NoteName[] = Array.from({ length: 12 }, (_, i) =>
  noteName(transpose(pitchClassOf('E'), i)),
)

/** Scale-degree labels indexed by semitone distance from the root (0..11). */
const DEGREE_LABELS: readonly string[] = [
  '1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7',
]

/** Map a semitone interval from the root to its scale-degree text (e.g. 3 => "b3"). */
export function degreeLabel(intervalFromRoot: number): string {
  return DEGREE_LABELS[((intervalFromRoot % 12) + 12) % 12]
}
