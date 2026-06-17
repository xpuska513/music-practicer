import type { ChordDef, ChordShape, ChordRender, FretMark } from '../types'
import { JROCK_CHORDS } from './chordsJrock'
import { EXTENDED_CHORDS } from './chordsExtended'

/**
 * Catalogue of practiceable chord voicings.
 *
 * Every shape follows the project convention: arrays are length 6, index 0 =
 * low E (6th string) .. index 5 = high E (1st string). `null` = muted string,
 * `0` = open, `>=1` = fretted. Finger numbers are 1..4 (or null for open/muted).
 * Barre chords use absolute frets with `baseFret = 1`.
 */
export const CHORDS: ChordDef[] = [
  // ── Open major (beginner) ────────────────────────────────────────────────
  {
    id: 'C',
    name: 'C Major',
    root: 'C',
    quality: 'major',
    difficulty: 'beginner',
    shape: {
      frets: [null, 3, 2, 0, 1, 0],
      fingers: [null, 3, 2, null, 1, null],
    },
  },
  {
    id: 'A',
    name: 'A Major',
    root: 'A',
    quality: 'major',
    difficulty: 'beginner',
    shape: {
      frets: [null, 0, 2, 2, 2, 0],
      fingers: [null, null, 1, 2, 3, null],
    },
  },
  {
    id: 'G',
    name: 'G Major',
    root: 'G',
    quality: 'major',
    difficulty: 'beginner',
    shape: {
      frets: [3, 2, 0, 0, 0, 3],
      fingers: [2, 1, null, null, null, 3],
    },
  },
  {
    id: 'E',
    name: 'E Major',
    root: 'E',
    quality: 'major',
    difficulty: 'beginner',
    shape: {
      frets: [0, 2, 2, 1, 0, 0],
      fingers: [null, 2, 3, 1, null, null],
    },
  },
  {
    id: 'D',
    name: 'D Major',
    root: 'D',
    quality: 'major',
    difficulty: 'beginner',
    shape: {
      frets: [null, null, 0, 2, 3, 2],
      fingers: [null, null, null, 1, 3, 2],
    },
  },

  // ── Open minor (beginner) ────────────────────────────────────────────────
  {
    id: 'Am',
    name: 'A Minor',
    root: 'A',
    quality: 'minor',
    difficulty: 'beginner',
    shape: {
      frets: [null, 0, 2, 2, 1, 0],
      fingers: [null, null, 2, 3, 1, null],
    },
  },
  {
    id: 'Em',
    name: 'E Minor',
    root: 'E',
    quality: 'minor',
    difficulty: 'beginner',
    shape: {
      frets: [0, 2, 2, 0, 0, 0],
      fingers: [null, 2, 3, null, null, null],
    },
  },
  {
    id: 'Dm',
    name: 'D Minor',
    root: 'D',
    quality: 'minor',
    difficulty: 'beginner',
    shape: {
      frets: [null, null, 0, 2, 3, 1],
      fingers: [null, null, null, 2, 3, 1],
    },
  },

  // ── Dominant 7 (intermediate) ────────────────────────────────────────────
  {
    id: 'E7',
    name: 'E Dominant 7',
    root: 'E',
    quality: '7',
    difficulty: 'intermediate',
    shape: {
      frets: [0, 2, 0, 1, 0, 0],
    },
  },
  {
    id: 'A7',
    name: 'A Dominant 7',
    root: 'A',
    quality: '7',
    difficulty: 'intermediate',
    shape: {
      frets: [null, 0, 2, 0, 2, 0],
    },
  },
  {
    id: 'D7',
    name: 'D Dominant 7',
    root: 'D',
    quality: '7',
    difficulty: 'intermediate',
    shape: {
      frets: [null, null, 0, 2, 1, 2],
    },
  },
  {
    id: 'G7',
    name: 'G Dominant 7',
    root: 'G',
    quality: '7',
    difficulty: 'intermediate',
    shape: {
      frets: [3, 2, 0, 0, 0, 1],
    },
  },
  {
    id: 'C7',
    name: 'C Dominant 7',
    root: 'C',
    quality: '7',
    difficulty: 'intermediate',
    shape: {
      frets: [null, 3, 2, 3, 1, 0],
    },
  },
  {
    id: 'B7',
    name: 'B Dominant 7',
    root: 'B',
    quality: '7',
    difficulty: 'intermediate',
    shape: {
      frets: [null, 2, 1, 2, 0, 2],
    },
  },

  // ── Maj7 / Min7 (intermediate) ───────────────────────────────────────────
  {
    id: 'Cmaj7',
    name: 'C Major 7',
    root: 'C',
    quality: 'maj7',
    difficulty: 'intermediate',
    shape: {
      frets: [null, 3, 2, 0, 0, 0],
    },
  },
  {
    id: 'Fmaj7',
    name: 'F Major 7',
    root: 'F',
    quality: 'maj7',
    difficulty: 'intermediate',
    shape: {
      frets: [null, null, 3, 2, 1, 0],
    },
  },
  {
    id: 'Am7',
    name: 'A Minor 7',
    root: 'A',
    quality: 'm7',
    difficulty: 'intermediate',
    shape: {
      frets: [null, 0, 2, 0, 1, 0],
    },
  },
  {
    id: 'Dm7',
    name: 'D Minor 7',
    root: 'D',
    quality: 'm7',
    difficulty: 'intermediate',
    shape: {
      frets: [null, null, 0, 2, 1, 1],
    },
  },
  {
    id: 'Em7',
    name: 'E Minor 7',
    root: 'E',
    quality: 'm7',
    difficulty: 'intermediate',
    shape: {
      frets: [0, 2, 2, 0, 3, 0],
    },
  },

  // ── Suspended (intermediate) ─────────────────────────────────────────────
  {
    id: 'Asus2',
    name: 'A Suspended 2',
    root: 'A',
    quality: 'sus2',
    difficulty: 'intermediate',
    shape: {
      frets: [null, 0, 2, 2, 0, 0],
    },
  },
  {
    id: 'Asus4',
    name: 'A Suspended 4',
    root: 'A',
    quality: 'sus4',
    difficulty: 'intermediate',
    shape: {
      frets: [null, 0, 2, 2, 3, 0],
    },
  },
  {
    id: 'Dsus2',
    name: 'D Suspended 2',
    root: 'D',
    quality: 'sus2',
    difficulty: 'intermediate',
    shape: {
      frets: [null, null, 0, 2, 3, 0],
    },
  },
  {
    id: 'Dsus4',
    name: 'D Suspended 4',
    root: 'D',
    quality: 'sus4',
    difficulty: 'intermediate',
    shape: {
      frets: [null, null, 0, 2, 3, 3],
    },
  },

  // ── Barre (advanced, absolute frets, baseFret = 1) ───────────────────────
  {
    id: 'F',
    name: 'F Major',
    root: 'F',
    quality: 'major',
    difficulty: 'advanced',
    shape: {
      frets: [1, 3, 3, 2, 1, 1],
      fingers: [1, 3, 4, 2, 1, 1],
      baseFret: 1,
    },
  },
  {
    id: 'Bm',
    name: 'B Minor',
    root: 'B',
    quality: 'minor',
    difficulty: 'advanced',
    shape: {
      frets: [null, 2, 4, 4, 3, 2],
      fingers: [null, 1, 3, 4, 2, 1],
      baseFret: 1,
    },
  },
  {
    id: 'B',
    name: 'B Major',
    root: 'B',
    quality: 'major',
    difficulty: 'advanced',
    shape: {
      frets: [null, 2, 4, 4, 4, 2],
      fingers: [null, 1, 2, 3, 4, 1],
      baseFret: 1,
    },
  },
  {
    id: 'F#m',
    name: 'F# Minor',
    root: 'F#',
    quality: 'minor',
    difficulty: 'advanced',
    shape: {
      frets: [2, 4, 4, 2, 2, 2],
      fingers: [1, 3, 4, 1, 1, 1],
      baseFret: 1,
    },
  },
  // J-Rock / anime-flavoured extended voicings (own "🎌 J-Rock" filter).
  ...JROCK_CHORDS,
  // 7/8-string sample voicings (length-7/8 shapes; shown only on 7/8 tunings).
  ...EXTENDED_CHORDS,
]

/**
 * Convert a {@link ChordShape} into the geometry the Fretboard component needs
 * to draw a chord diagram.
 *
 * - Muted strings (`null`) are collected separately so they render as an "X".
 * - The visible fret window auto-fits: open-position shapes start at the nut
 *   (fret 0); higher voicings slide the window up to `baseFret` (or the lowest
 *   fretted note) so the dots stay in view.
 */
export function chordShapeToRender(shape: ChordShape): ChordRender {
  const { frets } = shape

  const mutedStrings: number[] = []
  for (let i = 0; i < frets.length; i++) {
    if (frets[i] === null) mutedStrings.push(i)
  }

  const fretted = frets.filter((f): f is number => f !== null && f > 0)

  let startFret: number
  if (fretted.length === 0) {
    startFret = 0
  } else {
    const minF = Math.min(...fretted)
    const maxF = Math.max(...fretted)
    // Open-position shapes (everything within the first 4 frets) start at the
    // nut. Higher voicings slide the window up so the lowest fretted note lands
    // in the FIRST visible cell — the Fretboard draws fret N in the cell BELOW
    // wire N, so the window's top wire must be one fret below minF.
    startFret = maxF <= 4 ? 0 : Math.max(0, minF - 1)
  }

  const maxF = fretted.length === 0 ? 0 : Math.max(...fretted)
  const fretCount = startFret === 0 ? 5 : Math.max(4, maxF - startFret)

  const marks: FretMark[] = []
  for (let i = 0; i < frets.length; i++) {
    const fret = frets[i]
    if (fret === null) continue
    const finger = shape.fingers ? shape.fingers[i] ?? undefined : undefined
    const label =
      shape.fingers && shape.fingers[i] ? String(shape.fingers[i]) : undefined
    marks.push({ string: i, fret, finger, label })
  }

  return { marks, mutedStrings, startFret, fretCount }
}

/**
 * Fit a chord shape to a target string count. Index 0 = lowest string, so a
 * shape with FEWER strings (e.g. a 6-string chord on a 7/8 neck) is padded with
 * muted low strings (prepended nulls), keeping its notes on the correct strings;
 * a shape with MORE strings than the neck drops the extra lowest strings.
 */
export function fitShape(shape: ChordShape, stringCount: number): ChordShape {
  const cur = shape.frets.length
  if (cur === stringCount) return shape
  if (cur < stringCount) {
    const pad = stringCount - cur
    const padFrets = new Array<number | null>(pad).fill(null)
    const padFingers = new Array<number | null>(pad).fill(null)
    return {
      frets: [...padFrets, ...shape.frets],
      fingers: shape.fingers ? [...padFingers, ...shape.fingers] : undefined,
      baseFret: shape.baseFret,
    }
  }
  const drop = cur - stringCount
  return {
    frets: shape.frets.slice(drop),
    fingers: shape.fingers ? shape.fingers.slice(drop) : undefined,
    baseFret: shape.baseFret,
  }
}
