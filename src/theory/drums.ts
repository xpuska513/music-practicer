/**
 * Shared contract for the drum editor: voices, the pattern model, and presets.
 * A pattern is a step grid — per voice, a boolean per step — where
 * stepCount = bars * BEATS_PER_BAR * subdivision.
 */

/** Drum voices, ordered top → bottom for both the grid and notation. */
export type DrumVoiceId = 'crash' | 'hihat' | 'openhh' | 'tom' | 'snare' | 'kick'

export interface DrumVoice {
  id: DrumVoiceId
  /** Full name, e.g. "Hi-Hat". */
  name: string
  /** Short label for narrow rows, e.g. "HH". */
  short: string
  /** Notehead style in notation: 'x' = cymbal, 'o' = open hi-hat, 'dot' = drum. */
  glyph: 'x' | 'o' | 'dot'
}

/** Top → bottom order (highest-pitched/cymbals first, kick last). */
export const DRUM_VOICES: readonly DrumVoice[] = [
  { id: 'crash', name: 'Crash', short: 'Cr', glyph: 'x' },
  { id: 'hihat', name: 'Hi-Hat', short: 'HH', glyph: 'x' },
  { id: 'openhh', name: 'Open Hi-Hat', short: 'oHH', glyph: 'o' },
  { id: 'tom', name: 'Tom', short: 'Tom', glyph: 'dot' },
  { id: 'snare', name: 'Snare', short: 'Sn', glyph: 'dot' },
  { id: 'kick', name: 'Kick', short: 'Kick', glyph: 'dot' },
]

export const BEATS_PER_BAR = 4

/** Allowed subdivisions (steps per beat). */
export const SUBDIVISIONS = [2, 3, 4] as const // 8ths, triplets, 16ths

export interface DrumPattern {
  id: string
  name: string
  /** Number of bars (1 or 2). */
  bars: number
  /** Steps per beat: 2 = 8ths, 3 = triplets, 4 = 16ths. */
  subdivision: number
  bpm: number
  /** Per-voice hit flags; each array has length stepCount(pattern). */
  hits: Record<DrumVoiceId, boolean[]>
}

/** Total number of steps in a pattern. */
export function stepCount(p: { bars: number; subdivision: number }): number {
  return p.bars * BEATS_PER_BAR * p.subdivision
}

/** Fresh all-off hit map for `steps` steps. */
export function emptyHits(steps: number): Record<DrumVoiceId, boolean[]> {
  const make = (): boolean[] => new Array<boolean>(steps).fill(false)
  return {
    crash: make(),
    hihat: make(),
    openhh: make(),
    tom: make(),
    snare: make(),
    kick: make(),
  }
}

/**
 * Resize every voice's hit array to `steps` (preserving overlapping steps).
 * Used when bars/subdivision change.
 */
export function resizeHits(
  hits: Record<DrumVoiceId, boolean[]>,
  steps: number,
): Record<DrumVoiceId, boolean[]> {
  const out = emptyHits(steps)
  for (const voice of DRUM_VOICES) {
    const src = hits[voice.id]
    const dst = out[voice.id]
    for (let i = 0; i < steps && i < src.length; i++) dst[i] = src[i]
  }
  return out
}

function patternFrom(
  id: string,
  name: string,
  subdivision: number,
  rows: Partial<Record<DrumVoiceId, number[]>>,
  bars = 1,
  bpm = 90,
): DrumPattern {
  const steps = bars * BEATS_PER_BAR * subdivision
  const hits = emptyHits(steps)
  for (const [voice, onSteps] of Object.entries(rows)) {
    for (const s of onSteps ?? []) {
      if (s >= 0 && s < steps) hits[voice as DrumVoiceId][s] = true
    }
  }
  return { id, name, bars, subdivision, bpm, hits }
}

/** Starter grooves (16th-note grid, 1 bar). Steps 0..15: beats land on 0,4,8,12. */
export const DRUM_PRESETS: DrumPattern[] = [
  patternFrom('rock', 'Basic Rock Beat', 4, {
    hihat: [0, 2, 4, 6, 8, 10, 12, 14],
    snare: [4, 12],
    kick: [0, 8],
  }),
  patternFrom('rock-busy', 'Rock w/ Off-beat Kick', 4, {
    hihat: [0, 2, 4, 6, 8, 10, 12, 14],
    snare: [4, 12],
    kick: [0, 6, 8, 14],
  }),
  patternFrom('four-floor', 'Four-on-the-Floor', 4, {
    hihat: [2, 6, 10, 14],
    snare: [4, 12],
    kick: [0, 4, 8, 12],
  }),
]
