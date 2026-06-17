import type { ChordDef } from '../types'

/**
 * Extended chord catalogue flavoured for J-Rock progressions.
 *
 * Same project convention as {@link ./chords}: shape arrays are length 6,
 * index 0 = low E (6th string) .. index 5 = high E (1st string). `null` = muted
 * string, `0` = open, `>=1` = fretted. Finger numbers are 1..4 (or null for
 * open/muted). `baseFret` is only set when the diagram window starts above the
 * nut. Ids here are deduped against the core CHORDS catalogue.
 */
export const JROCK_CHORDS: ChordDef[] = [
  // ── Major 7 ──────────────────────────────────────────────────────────────
  {
    id: 'Dmaj7',
    name: 'D Major 7',
    root: 'D',
    quality: 'maj7',
    difficulty: 'jrock',
    shape: {
      frets: [null, null, 0, 2, 2, 2],
      fingers: [null, null, null, 1, 2, 3],
    },
  },
  {
    id: 'Emaj7',
    name: 'E Major 7',
    root: 'E',
    quality: 'maj7',
    difficulty: 'jrock',
    shape: {
      frets: [0, 2, 1, 1, 0, 0],
      fingers: [null, 3, 1, 2, null, null],
    },
  },
  {
    id: 'Gmaj7',
    name: 'G Major 7',
    root: 'G',
    quality: 'maj7',
    difficulty: 'jrock',
    shape: {
      frets: [3, 2, 0, 0, 0, 2],
      fingers: [3, 2, null, null, null, 1],
    },
  },
  {
    id: 'Amaj7',
    name: 'A Major 7',
    root: 'A',
    quality: 'maj7',
    difficulty: 'jrock',
    shape: {
      frets: [null, 0, 2, 1, 2, 0],
      fingers: [null, null, 2, 1, 3, null],
    },
  },

  // ── Minor 7 ──────────────────────────────────────────────────────────────
  {
    id: 'Bm7',
    name: 'B Minor 7',
    root: 'B',
    quality: 'm7',
    difficulty: 'jrock',
    shape: {
      frets: [null, 2, 0, 2, 0, 2],
      fingers: [null, 1, null, 2, null, 3],
    },
  },
  {
    id: 'Cm7',
    name: 'C Minor 7',
    root: 'C',
    quality: 'm7',
    difficulty: 'jrock',
    shape: {
      frets: [null, 3, 5, 3, 4, 3],
      fingers: [null, 1, 3, 1, 2, 1],
      baseFret: 3,
    },
  },
  {
    id: 'F#m7',
    name: 'F# Minor 7',
    root: 'F#',
    quality: 'm7',
    difficulty: 'jrock',
    shape: {
      frets: [2, 4, 2, 2, 2, 2],
      fingers: [1, 3, 1, 1, 1, 1],
      baseFret: 2,
    },
  },
  {
    id: 'Gm7',
    name: 'G Minor 7',
    root: 'G',
    quality: 'm7',
    difficulty: 'jrock',
    shape: {
      frets: [3, 5, 3, 3, 3, 3],
      fingers: [1, 3, 1, 1, 1, 1],
      baseFret: 3,
    },
  },

  // ── Dominant 9 ───────────────────────────────────────────────────────────
  {
    id: 'C9',
    name: 'C Dominant 9',
    root: 'C',
    quality: '9',
    difficulty: 'jrock',
    shape: {
      frets: [null, 3, 2, 3, 3, null],
      fingers: [null, 2, 1, 3, 4, null],
      baseFret: 2,
    },
  },
  {
    id: 'D9',
    name: 'D Dominant 9',
    root: 'D',
    quality: '9',
    difficulty: 'jrock',
    shape: {
      frets: [null, 5, 4, 5, 5, null],
      fingers: [null, 2, 1, 3, 4, null],
      baseFret: 4,
    },
  },
  {
    id: 'G9',
    name: 'G Dominant 9',
    root: 'G',
    quality: '9',
    difficulty: 'jrock',
    shape: {
      frets: [3, 5, 3, 4, 3, 5],
      fingers: [1, 3, 1, 2, 1, 4],
      baseFret: 3,
    },
  },
  {
    id: 'E9',
    name: 'E Dominant 9',
    root: 'E',
    quality: '9',
    difficulty: 'jrock',
    shape: {
      frets: [0, 2, 0, 1, 0, 2],
      fingers: [null, 2, null, 1, null, 3],
    },
  },

  // ── Major 9 ──────────────────────────────────────────────────────────────
  {
    id: 'Cmaj9',
    name: 'C Major 9',
    root: 'C',
    quality: 'maj9',
    difficulty: 'jrock',
    shape: {
      frets: [null, 3, 2, 4, 3, 0],
      fingers: [null, 2, 1, 4, 3, null],
    },
  },
  {
    id: 'Gmaj9',
    name: 'G Major 9',
    root: 'G',
    quality: 'maj9',
    difficulty: 'jrock',
    shape: {
      frets: [3, 2, 0, 2, 3, 2],
      fingers: [4, 2, null, 1, 3, 1],
    },
  },

  // ── Minor 9 ──────────────────────────────────────────────────────────────
  {
    id: 'Am9',
    name: 'A Minor 9',
    root: 'A',
    quality: 'm9',
    difficulty: 'jrock',
    shape: {
      frets: [null, 0, 2, 4, 1, 3],
      fingers: [null, null, 2, 4, 1, 3],
    },
  },
  {
    id: 'Dm9',
    name: 'D Minor 9',
    root: 'D',
    quality: 'm9',
    difficulty: 'jrock',
    shape: {
      frets: [null, 5, 3, 5, 5, null],
      fingers: [null, 3, 1, 4, 4, null],
      baseFret: 3,
    },
  },
  {
    id: 'Em9',
    name: 'E Minor 9',
    root: 'E',
    quality: 'm9',
    difficulty: 'jrock',
    shape: {
      frets: [0, 2, 0, 0, 0, 2],
      fingers: [null, 2, null, null, null, 3],
    },
  },

  // ── add9 ─────────────────────────────────────────────────────────────────
  {
    id: 'Cadd9',
    name: 'C add9',
    root: 'C',
    quality: 'add9',
    difficulty: 'jrock',
    shape: {
      frets: [null, 3, 2, 0, 3, 0],
      fingers: [null, 3, 2, null, 4, null],
    },
  },
  {
    id: 'Dadd9',
    name: 'D add9',
    root: 'D',
    quality: 'add9',
    difficulty: 'jrock',
    shape: {
      frets: [null, 5, 4, 2, 3, 0],
      fingers: [null, 4, 3, 1, 2, null],
      baseFret: 2,
    },
  },
  {
    id: 'Gadd9',
    name: 'G add9',
    root: 'G',
    quality: 'add9',
    difficulty: 'jrock',
    shape: {
      frets: [3, 2, 0, 2, 0, 3],
      fingers: [3, 1, null, 2, null, 4],
    },
  },
  {
    id: 'Aadd9',
    name: 'A add9',
    root: 'A',
    quality: 'add9',
    difficulty: 'jrock',
    shape: {
      frets: [null, 0, 2, 4, 2, 0],
      fingers: [null, null, 2, 4, 3, null],
    },
  },
  {
    id: 'Eadd9',
    name: 'E add9',
    root: 'E',
    quality: 'add9',
    difficulty: 'jrock',
    shape: {
      frets: [0, 2, 2, 1, 0, 2],
      fingers: [null, 2, 3, 1, null, 4],
    },
  },

  // ── Suspended ────────────────────────────────────────────────────────────
  {
    id: 'Esus4',
    name: 'E sus4',
    root: 'E',
    quality: 'sus4',
    difficulty: 'jrock',
    shape: {
      frets: [0, 2, 2, 2, 0, 0],
      fingers: [null, 1, 2, 3, null, null],
    },
  },
  {
    id: 'Csus2',
    name: 'C sus2',
    root: 'C',
    quality: 'sus2',
    difficulty: 'jrock',
    shape: {
      frets: [null, 3, 0, 0, 1, null],
      fingers: [null, 3, null, null, 1, null],
    },
  },
  {
    id: 'D7sus4',
    name: 'D7 sus4',
    root: 'D',
    quality: '7sus4',
    difficulty: 'jrock',
    shape: {
      frets: [null, null, 0, 2, 1, 3],
      fingers: [null, null, null, 2, 1, 3],
    },
  },
  {
    id: 'A7sus4',
    name: 'A7 sus4',
    root: 'A',
    quality: '7sus4',
    difficulty: 'jrock',
    shape: {
      frets: [null, 0, 2, 0, 3, 0],
      fingers: [null, null, 2, null, 3, null],
    },
  },
  {
    id: 'E7sus4',
    name: 'E7 sus4',
    root: 'E',
    quality: '7sus4',
    difficulty: 'jrock',
    shape: {
      frets: [0, 2, 0, 2, 0, 0],
      fingers: [null, 2, null, 3, null, null],
    },
  },
  {
    id: 'G7sus4',
    name: 'G7 sus4',
    root: 'G',
    quality: '7sus4',
    difficulty: 'jrock',
    shape: {
      frets: [3, 3, 0, 0, 1, 1],
      fingers: [3, 4, null, null, 1, 2],
    },
  },

  // ── Sixths ───────────────────────────────────────────────────────────────
  {
    id: 'C6',
    name: 'C6',
    root: 'C',
    quality: '6',
    difficulty: 'jrock',
    shape: {
      frets: [null, 3, 2, 2, 1, 0],
      fingers: [null, 4, 2, 3, 1, null],
    },
  },
  {
    id: 'G6',
    name: 'G6',
    root: 'G',
    quality: '6',
    difficulty: 'jrock',
    shape: {
      frets: [3, 2, 0, 0, 0, 0],
      fingers: [3, 2, null, null, null, null],
    },
  },
  {
    id: 'D6',
    name: 'D6',
    root: 'D',
    quality: '6',
    difficulty: 'jrock',
    shape: {
      frets: [null, null, 0, 2, 0, 2],
      fingers: [null, null, null, 2, null, 3],
    },
  },
  {
    id: 'Am6',
    name: 'Am6',
    root: 'A',
    quality: 'm6',
    difficulty: 'jrock',
    shape: {
      frets: [null, 0, 2, 2, 1, 2],
      fingers: [null, null, 2, 3, 1, 4],
    },
  },
  {
    id: 'Em6',
    name: 'Em6',
    root: 'E',
    quality: 'm6',
    difficulty: 'jrock',
    shape: {
      frets: [0, 2, 2, 0, 2, 0],
      fingers: [null, 2, 3, null, 4, null],
    },
  },
  {
    id: 'Dm6',
    name: 'Dm6',
    root: 'D',
    quality: 'm6',
    difficulty: 'jrock',
    shape: {
      frets: [null, null, 0, 2, 0, 1],
      fingers: [null, null, null, 2, null, 1],
    },
  },

  // ── Slash voicings ───────────────────────────────────────────────────────
  {
    id: 'D/F#',
    name: 'D over F#',
    root: 'D',
    quality: 'slash',
    difficulty: 'jrock',
    shape: {
      frets: [2, 0, 0, 2, 3, 2],
      fingers: [2, null, null, 1, 4, 3],
    },
  },
  {
    id: 'G/B',
    name: 'G over B',
    root: 'G',
    quality: 'slash',
    difficulty: 'jrock',
    shape: {
      frets: [null, 2, 0, 0, 3, 3],
      fingers: [null, 1, null, null, 3, 4],
    },
  },
  {
    id: 'C/E',
    name: 'C over E',
    root: 'C',
    quality: 'slash',
    difficulty: 'jrock',
    shape: {
      frets: [0, 3, 2, 0, 1, 0],
      fingers: [null, 3, 2, null, 1, null],
    },
  },
  {
    id: 'C/G',
    name: 'C over G',
    root: 'C',
    quality: 'slash',
    difficulty: 'jrock',
    shape: {
      frets: [3, 3, 2, 0, 1, 0],
      fingers: [3, 4, 2, null, 1, null],
    },
  },
  {
    id: 'G/D',
    name: 'G over D',
    root: 'G',
    quality: 'slash',
    difficulty: 'jrock',
    shape: {
      frets: [null, null, 0, 0, 0, 3],
      fingers: [null, null, null, null, null, 3],
    },
  },
  {
    id: 'A/C#',
    name: 'A over C#',
    root: 'A',
    quality: 'slash',
    difficulty: 'jrock',
    shape: {
      frets: [null, 4, 2, 2, 2, 0],
      fingers: [null, 4, 1, 2, 3, null],
    },
  },
  {
    id: 'E/G#',
    name: 'E over G#',
    root: 'E',
    quality: 'slash',
    difficulty: 'jrock',
    shape: {
      frets: [4, null, 2, 1, 0, 0],
      fingers: [4, null, 3, 2, null, null],
    },
  },
  {
    id: 'F/A',
    name: 'F over A',
    root: 'F',
    quality: 'slash',
    difficulty: 'jrock',
    shape: {
      frets: [null, 0, 3, 2, 1, 1],
      fingers: [null, null, 4, 3, 1, 2],
    },
  },
  {
    id: 'Em/G',
    name: 'Em over G',
    root: 'E',
    quality: 'slash',
    difficulty: 'jrock',
    shape: {
      frets: [3, 2, 2, 0, 0, 0],
      fingers: [3, 1, 2, null, null, null],
    },
  },
  {
    id: 'Am/C',
    name: 'Am over C',
    root: 'A',
    quality: 'slash',
    difficulty: 'jrock',
    shape: {
      frets: [null, 3, 2, 2, 1, 0],
      fingers: [null, 4, 2, 3, 1, null],
    },
  },
  {
    id: 'Fmaj7/G',
    name: 'Fmaj7 over G',
    root: 'F',
    quality: 'slash',
    difficulty: 'jrock',
    shape: {
      frets: [3, null, 3, 2, 1, 0],
      fingers: [3, null, 4, 2, 1, null],
    },
  },
  {
    id: 'Dm7/G',
    name: 'Dm7 over G',
    root: 'D',
    quality: 'slash',
    difficulty: 'jrock',
    shape: {
      frets: [3, null, 0, 2, 1, 1],
      fingers: [3, null, null, 2, 1, 1],
    },
  },
  {
    id: 'C/D',
    name: 'C over D',
    root: 'C',
    quality: 'slash',
    difficulty: 'jrock',
    shape: {
      frets: [null, null, 0, 0, 1, 0],
      fingers: [null, null, null, null, 1, null],
    },
  },

  // ── Diminished ───────────────────────────────────────────────────────────
  {
    id: 'Bdim',
    name: 'B Diminished',
    root: 'B',
    quality: 'dim',
    difficulty: 'jrock',
    shape: {
      frets: [null, 2, 0, null, null, 1],
      fingers: [null, 2, null, null, null, 1],
    },
  },
  {
    id: 'C#dim',
    name: 'C# Diminished',
    root: 'C#',
    quality: 'dim',
    difficulty: 'jrock',
    shape: {
      frets: [null, 4, 2, 0, null, null],
      fingers: [null, 3, 2, null, null, null],
    },
  },
  {
    id: 'F#dim',
    name: 'F# Diminished',
    root: 'F#',
    quality: 'dim',
    difficulty: 'jrock',
    shape: {
      frets: [2, 3, 4, 2, null, null],
      fingers: [1, 2, 4, 1, null, null],
    },
  },

  // ── Minor 7 flat 5 ───────────────────────────────────────────────────────
  {
    id: 'Bm7b5',
    name: 'B Minor 7 flat 5',
    root: 'B',
    quality: 'm7b5',
    difficulty: 'jrock',
    shape: {
      frets: [null, 2, 3, 2, 3, null],
      fingers: [null, 1, 3, 2, 4, null],
    },
  },
  {
    id: 'Am7b5',
    name: 'A Minor 7 flat 5',
    root: 'A',
    quality: 'm7b5',
    difficulty: 'jrock',
    shape: {
      frets: [5, null, 5, 5, 4, null],
      fingers: [2, null, 3, 4, 1, null],
      baseFret: 4,
    },
  },
  {
    id: 'Em7b5',
    name: 'E Minor 7 flat 5',
    root: 'E',
    quality: 'm7b5',
    difficulty: 'jrock',
    shape: {
      frets: [null, null, 2, 3, 3, 3],
      fingers: [null, null, 1, 2, 3, 4],
    },
  },

  // ── Augmented ────────────────────────────────────────────────────────────
  {
    id: 'Caug',
    name: 'C Augmented',
    root: 'C',
    quality: 'aug',
    difficulty: 'jrock',
    shape: {
      frets: [null, 3, 2, 1, 1, 0],
      fingers: [null, 4, 3, 1, 2, null],
    },
  },
  {
    id: 'Eaug',
    name: 'E Augmented',
    root: 'E',
    quality: 'aug',
    difficulty: 'jrock',
    shape: {
      frets: [0, 3, 2, 1, 1, 0],
      fingers: [null, 4, 3, 1, 2, null],
    },
  },
]
