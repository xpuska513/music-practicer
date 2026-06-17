/**
 * Shared type contract for Music Practicer.
 *
 * Every module imports from here so the pieces fit together. Read the
 * conventions below carefully — string/fret numbering is consistent everywhere.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * STRING NUMBERING (used by FretMark.string, ChordShape arrays, STANDARD_TUNING)
 *   Index 0 = low E  (6th string, thickest)
 *   Index 1 = A      (5th string)
 *   Index 2 = D      (4th string)
 *   Index 3 = G      (3rd string)
 *   Index 4 = B      (2nd string)
 *   Index 5 = high E (1st string, thinnest)
 *
 * FRET NUMBERING
 *   0   = open string (played, not fretted)
 *   1.. = fretted at that fret
 *   In ChordShape arrays, `null` means the string is MUTED / not played.
 *
 * PITCH CLASS
 *   Integer 0..11, where C = 0, C# = 1, D = 2, ... B = 11.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Pitch class: 0..11 (C=0, C#=1, ... B=11). */
export type PitchClass = number

/** Canonical note name (sharps). */
export type NoteName =
  | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F'
  | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B'

/** Standard tuning as pitch classes, low E -> high E (index 0..5). */
export const STANDARD_TUNING: readonly PitchClass[] = [4, 9, 2, 7, 11, 4]

/** Note names indexed by pitch class. */
export const NOTE_NAMES: readonly NoteName[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
]

/**
 * A single highlighted position on the fretboard.
 * Used by both the chord trainer and the scale explorer.
 */
export interface FretMark {
  /** String index 0..5 (0 = low E / 6th, 5 = high E / 1st). */
  string: number
  /** Fret number. 0 = open, >=1 fretted. */
  fret: number
  /** Optional text shown inside the dot (e.g. note name "C#" or scale degree). */
  label?: string
  /** Suggested fretting finger 1..4 (used by chord diagrams). */
  finger?: number
  /** Whether this position is the root note (rendered with accent color). */
  isRoot?: boolean
  /** Optional explicit dot color (overrides default/root coloring). */
  color?: string
}

/**
 * A concrete chord voicing/shape on the neck.
 * Arrays are length 6, indexed by string (0 = low E .. 5 = high E).
 */
export interface ChordShape {
  /** Per-string fret. null = muted, 0 = open, >=1 = fretted. Length 6. */
  frets: (number | null)[]
  /** Per-string suggested finger 1..4 (or null). Length 6. Optional. */
  fingers?: (number | null)[]
  /**
   * Lowest fret shown in the diagram window (for barre chords above the nut).
   * Defaults to 1. When > 1 the diagram should print this fret number.
   */
  baseFret?: number
}

/** A named chord with one or more practiceable shapes. */
export interface ChordDef {
  /** Stable id, e.g. "C", "Am", "G7", "Fmaj7". */
  id: string
  /** Display name, e.g. "C Major". */
  name: string
  /** Root note name. */
  root: NoteName
  /** Human-readable quality, e.g. "major", "minor", "7", "maj7", "m7", "sus4". */
  quality: string
  /** Bucket for filtering practice sessions (difficulty, or a named set). */
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'jrock' | 'custom'
  /** Playable shape on the neck. */
  shape: ChordShape
}

/** A scale/mode definition as semitone intervals from the root. */
export interface ScaleDef {
  /** Stable id, e.g. "major", "minor", "dorian", "minor-pentatonic". */
  id: string
  /** Display name, e.g. "Major (Ionian)". */
  name: string
  /** Semitone offsets from the root, ascending, starting at 0. e.g. [0,2,4,5,7,9,11]. */
  intervals: number[]
  /** Short category for grouping in the UI. */
  category: 'major' | 'minor' | 'mode' | 'pentatonic' | 'blues' | 'other' | 'custom'
}

/** Result of laying a chord shape onto the generic Fretboard component. */
export interface ChordRender {
  marks: FretMark[]
  /** String indices that are muted (render an "X" at the nut). */
  mutedStrings: number[]
  /** Lowest fret to display. */
  startFret: number
  /** Number of fret columns to display. */
  fretCount: number
}

/** Props for the shared <Fretboard /> component. */
export interface FretboardProps {
  /** Positions to highlight. */
  marks: FretMark[]
  /** Lowest fret rendered (0 shows the nut / open position). Default 0. */
  startFret?: number
  /** Number of fret columns to render. Default 15. */
  fretCount?: number
  /** Layout direction. "horizontal" = neck runs left-to-right (good for scales,
   *  desktop). "vertical" = neck runs top-to-bottom (good for chord diagrams,
   *  mobile). Default "horizontal". */
  orientation?: 'horizontal' | 'vertical'
  /** String indices (0..5) to mark as muted with an "X". */
  mutedStrings?: number[]
  /** Show note name / label text inside the dots. Default true. */
  showLabels?: boolean
  /** Show the fret-number axis. Default true. */
  showFretNumbers?: boolean
  /**
   * When provided, the board becomes interactive: a transparent hit-target is
   * drawn over every string/fret cell (and the open-string position when the
   * nut is visible), and clicking one calls this with (stringIndex 0..5, fret).
   * fret 0 means the open-string / nut cell.
   */
  onCellClick?: (stringIndex: number, fret: number) => void
}

/** Info passed to a metronome beat callback. */
export interface BeatInfo {
  /** 0-based beat index within the current measure. */
  beat: number
  /** 0-based measure counter since start. */
  measure: number
  /** AudioContext time (seconds) at which this beat sounds. */
  time: number
}

/** Options accepted by the useMetronome hook. */
export interface MetronomeOptions {
  bpm?: number
  /** Beats per measure (top number of the time signature). Default 4. */
  beatsPerMeasure?: number
  /** Accent the first beat of each measure. Default true. */
  accentFirst?: boolean
  /**
   * Subdivisions per beat. 1 = a click per beat (default). >1 adds that many
   * quieter "ticks" evenly between beats — e.g. 4 plays 16th-note ticks — to
   * guide picking speed. Does not affect beat/measure counting or onBeat.
   */
  subdivision?: number
  /** Called (slightly ahead of time) for every scheduled beat. */
  onBeat?: (info: BeatInfo) => void
}

/** Imperative + reactive controls returned by useMetronome. */
export interface MetronomeControls {
  isPlaying: boolean
  /** Current 0-based beat within the measure, or -1 when stopped. */
  currentBeat: number
  bpm: number
  beatsPerMeasure: number
  start: () => void
  stop: () => void
  toggle: () => void
  setBpm: (bpm: number) => void
  setBeatsPerMeasure: (n: number) => void
}
