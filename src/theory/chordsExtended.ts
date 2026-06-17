import type { ChordDef } from '../types'

/**
 * Extended-range (7/8-string) chord voicings.
 *
 * Unlike the core {@link ./chords} and {@link ./chordsJrock} catalogues whose
 * shape arrays are length 6, every shape here has a `frets`/`fingers` array of
 * length 7 or 8 — index 0 = lowest string .. last index = highest string.
 * `null` = muted string, `0` = open, `>=1` = fretted. Finger numbers are 1..4
 * (or null for open/muted). `baseFret` is only set when the diagram window
 * starts above the nut. Ids here are deduped against the core CHORDS and
 * JROCK_CHORDS catalogues.
 */
export const EXTENDED_CHORDS: ChordDef[] = [
  // ── Power chords (7-string) ──────────────────────────────────────────────
  {
    id: 'B5',
    name: 'B5 (Power Chord)',
    root: 'B',
    quality: '5',
    difficulty: 'advanced',
    shape: {
      frets: [0, 2, 2, null, null, null, null],
      fingers: [null, 1, 2, null, null, null, null],
    },
  },
  {
    id: 'C5',
    name: 'C5 (Power Chord)',
    root: 'C',
    quality: '5',
    difficulty: 'advanced',
    shape: {
      frets: [1, 3, 3, null, null, null, null],
      fingers: [1, 3, 4, null, null, null, null],
    },
  },
  {
    id: 'D5',
    name: 'D5 (Power Chord)',
    root: 'D',
    quality: '5',
    difficulty: 'advanced',
    shape: {
      frets: [3, 5, 5, null, null, null, null],
      fingers: [1, 3, 4, null, null, null, null],
      baseFret: 3,
    },
  },
  {
    id: 'E5',
    name: 'E5 (Power Chord)',
    root: 'E',
    quality: '5',
    difficulty: 'advanced',
    shape: {
      frets: [5, 7, 7, null, null, null, null],
      fingers: [1, 3, 4, null, null, null, null],
      baseFret: 5,
    },
  },

  // ── Triads / sevenths / added tones (7-string) ───────────────────────────
  {
    id: 'Badd9',
    name: 'B add9',
    root: 'B',
    quality: 'add9',
    difficulty: 'advanced',
    shape: {
      frets: [0, 2, 4, 1, null, null, 2],
      fingers: [null, 2, 4, 1, null, null, 3],
    },
  },
  {
    id: 'Bsus4',
    name: 'B sus4',
    root: 'B',
    quality: 'sus4',
    difficulty: 'advanced',
    shape: {
      frets: [0, 2, 2, 2, null, null, null],
      fingers: [null, 1, 1, 1, null, null, null],
    },
  },

  // ── Power chords (8-string) ──────────────────────────────────────────────
  {
    id: 'F#5',
    name: 'F# Power Chord (5)',
    root: 'F#',
    quality: '5',
    difficulty: 'advanced',
    shape: {
      frets: [0, 2, 2, null, null, null, null, null],
      fingers: [null, 1, 1, null, null, null, null, null],
    },
  },
  {
    id: 'G5',
    name: 'G Power Chord (5)',
    root: 'G',
    quality: '5',
    difficulty: 'advanced',
    shape: {
      frets: [1, 3, 3, null, null, null, null, null],
      fingers: [1, 3, 4, null, null, null, null, null],
    },
  },
  {
    id: 'A5',
    name: 'A Power Chord (5)',
    root: 'A',
    quality: '5',
    difficulty: 'advanced',
    shape: {
      frets: [3, 5, 5, null, null, null, null, null],
      fingers: [1, 3, 4, null, null, null, null, null],
      baseFret: 3,
    },
  },

  // ── Triads / sevenths (8-string) ─────────────────────────────────────────
  {
    id: 'F#',
    name: 'F# Major',
    root: 'F#',
    quality: 'major',
    difficulty: 'advanced',
    shape: {
      frets: [0, 2, 2, 1, null, null, null, null],
      fingers: [null, 2, 3, 1, null, null, null, null],
    },
  },
]
