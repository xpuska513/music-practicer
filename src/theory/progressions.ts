/**
 * Preset chord progressions for the trainer's "Progression" mode.
 *
 * Each `chordIds` entry references an id in the built-in chord library
 * (src/theory/chords.ts), realised in a specific key so every chord is a
 * playable open/standard shape that already exists. The trainer cycles through
 * them in order, looping.
 */
export interface Progression {
  id: string
  name: string
  /** Chord ids in play order (one per chord window). */
  chordIds: string[]
}

export const PROGRESSIONS: Progression[] = [
  { id: 'ii-V-I-C', name: 'ii–V–I (C major)', chordIds: ['Dm7', 'G7', 'Cmaj7'] },
  { id: 'I-V-vi-IV-C', name: 'I–V–vi–IV (C)', chordIds: ['C', 'G', 'Am', 'F'] },
  { id: 'I-V-vi-IV-G', name: 'I–V–vi–IV (G)', chordIds: ['G', 'D', 'Em', 'C'] },
  { id: '50s-C', name: '50s · I–vi–IV–V (C)', chordIds: ['C', 'Am', 'F', 'G'] },
  { id: 'I-IV-V-A', name: 'I–IV–V (A)', chordIds: ['A', 'D', 'E'] },
  { id: 'I-IV-V-E', name: 'I–IV–V (E)', chordIds: ['E', 'A', 'B'] },
  {
    id: 'blues-A',
    name: '12-bar blues (A)',
    chordIds: ['A7', 'A7', 'A7', 'A7', 'D7', 'D7', 'A7', 'A7', 'E7', 'D7', 'A7', 'E7'],
  },
  {
    id: 'blues-E',
    name: '12-bar blues (E)',
    chordIds: ['E7', 'E7', 'E7', 'E7', 'A7', 'A7', 'E7', 'E7', 'B7', 'A7', 'E7', 'B7'],
  },
]
