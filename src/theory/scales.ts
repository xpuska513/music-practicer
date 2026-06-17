import { noteName, noteAt } from './notes'
import type { ScaleDef, FretMark, PitchClass } from '../types'

/**
 * Scale / mode catalogue. Intervals are semitone offsets from the root,
 * ascending and starting at 0.
 */
export const SCALES: ScaleDef[] = [
  {
    id: 'major',
    name: 'Major (Ionian)',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    category: 'major',
  },
  {
    id: 'natural-minor',
    name: 'Natural Minor (Aeolian)',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    category: 'minor',
  },
  {
    id: 'dorian',
    name: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    category: 'mode',
  },
  {
    id: 'phrygian',
    name: 'Phrygian',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    category: 'mode',
  },
  {
    id: 'lydian',
    name: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    category: 'mode',
  },
  {
    id: 'mixolydian',
    name: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    category: 'mode',
  },
  {
    id: 'locrian',
    name: 'Locrian',
    intervals: [0, 1, 3, 5, 6, 8, 10],
    category: 'mode',
  },
  {
    id: 'major-pentatonic',
    name: 'Major Pentatonic',
    intervals: [0, 2, 4, 7, 9],
    category: 'pentatonic',
  },
  {
    id: 'minor-pentatonic',
    name: 'Minor Pentatonic',
    intervals: [0, 3, 5, 7, 10],
    category: 'pentatonic',
  },
  {
    id: 'blues',
    name: 'Blues',
    intervals: [0, 3, 5, 6, 7, 10],
    category: 'blues',
  },
  {
    id: 'harmonic-minor',
    name: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    category: 'minor',
  },
  {
    id: 'melodic-minor',
    name: 'Melodic Minor',
    intervals: [0, 2, 3, 5, 7, 9, 11],
    category: 'minor',
  },
]

/**
 * Compute every fretboard position (strings 0..5, frets 0..fretCount inclusive)
 * whose pitch belongs to `scale` rooted at `rootPc`.
 */
export function getScaleMarks(
  scale: ScaleDef,
  rootPc: PitchClass,
  fretCount: number,
): FretMark[] {
  const marks: FretMark[] = []

  for (let string = 0; string <= 5; string++) {
    for (let fret = 0; fret <= fretCount; fret++) {
      const pc = noteAt(string, fret)
      const degree = (((pc - rootPc) % 12) + 12) % 12

      if (scale.intervals.includes(degree)) {
        marks.push({
          string,
          fret,
          label: noteName(pc),
          isRoot: pc === rootPc,
        })
      }
    }
  }

  return marks
}
