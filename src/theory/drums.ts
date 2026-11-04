/**
 * Shared contract for the drum editor: voices, the pattern model, and presets.
 * A pattern is a step grid — per voice, a hit level per step (0 = silent) —
 * where stepCount = bars * BEATS_PER_BAR * subdivision.
 */

/** Drum voices, ordered top → bottom for both the grid and notation. */
export type DrumVoiceId =
  | 'crash'
  | 'ride'
  | 'hihat'
  | 'openhh'
  | 'tom'
  | 'midtom'
  | 'snare'
  | 'floortom'
  | 'kick'
  | 'hhfoot'

export interface DrumVoice {
  id: DrumVoiceId
  /** Full name, e.g. "Hi-Hat". */
  name: string
  /** Short label for narrow rows, e.g. "HH". */
  short: string
  /** Notehead style in notation: 'x' = cymbal, 'o' = open hi-hat, 'dot' = drum. */
  glyph: 'x' | 'o' | 'dot'
}

/** Top → bottom order (cymbals first, then the drums high → low, feet last). */
export const DRUM_VOICES: readonly DrumVoice[] = [
  { id: 'crash', name: 'Crash', short: 'Cr', glyph: 'x' },
  { id: 'ride', name: 'Ride', short: 'Rd', glyph: 'x' },
  { id: 'hihat', name: 'Hi-Hat', short: 'HH', glyph: 'x' },
  { id: 'openhh', name: 'Open Hi-Hat', short: 'oHH', glyph: 'o' },
  // The id stays 'tom' (it predates the extra toms) so saved beats stay valid.
  { id: 'tom', name: 'High Tom', short: 'T1', glyph: 'dot' },
  { id: 'midtom', name: 'Mid Tom', short: 'T2', glyph: 'dot' },
  { id: 'snare', name: 'Snare', short: 'Sn', glyph: 'dot' },
  { id: 'floortom', name: 'Floor Tom', short: 'FT', glyph: 'dot' },
  { id: 'kick', name: 'Kick', short: 'Kick', glyph: 'dot' },
  { id: 'hhfoot', name: 'Hi-Hat Foot', short: 'HF', glyph: 'x' },
]

/** How hard a step is played: 0 = silent, 1 = ghost, 2 = normal, 3 = accent. */
export type HitLevel = 0 | 1 | 2 | 3

export const HIT_OFF = 0
export const HIT_GHOST = 1
export const HIT_NORMAL = 2
export const HIT_ACCENT = 3

/** True when `v` is a valid HitLevel (an integer 0..3). */
export function isHitLevel(v: unknown): v is HitLevel {
  return v === HIT_OFF || v === HIT_GHOST || v === HIT_NORMAL || v === HIT_ACCENT
}

/**
 * Grid "brush" tap: an empty cell (or one at another level) takes the brush's
 * level; tapping a cell that already has the brush's level clears it.
 */
export function paintHit(current: HitLevel, brush: HitLevel): HitLevel {
  return current === brush ? HIT_OFF : brush
}

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
  /** Per-voice hit levels; each array has length stepCount(pattern). */
  hits: Record<DrumVoiceId, HitLevel[]>
}

/** Total number of steps in a pattern. */
export function stepCount(p: { bars: number; subdivision: number }): number {
  return p.bars * BEATS_PER_BAR * p.subdivision
}

/** Fresh all-off hit map for `steps` steps. */
export function emptyHits(steps: number): Record<DrumVoiceId, HitLevel[]> {
  const make = (): HitLevel[] => new Array<HitLevel>(steps).fill(HIT_OFF)
  return {
    crash: make(),
    ride: make(),
    hihat: make(),
    openhh: make(),
    tom: make(),
    midtom: make(),
    snare: make(),
    floortom: make(),
    kick: make(),
    hhfoot: make(),
  }
}

/**
 * Resize every voice's hit array to `steps` (preserving overlapping steps).
 * Used when bars/subdivision change, and to deep-copy a pattern's hits. A
 * voice row that's missing (older data) comes back as all rests.
 */
export function resizeHits(
  hits: Record<DrumVoiceId, HitLevel[]>,
  steps: number,
): Record<DrumVoiceId, HitLevel[]> {
  const out = emptyHits(steps)
  for (const voice of DRUM_VOICES) {
    const src = hits[voice.id] ?? []
    const dst = out[voice.id]
    for (let i = 0; i < steps && i < src.length; i++) dst[i] = src[i]
  }
  return out
}

/**
 * Preset rows read like drum tab, one character per step: '-' rest,
 * 'g' ghost, 'x' normal, 'X' accent. Spaces and '|' are ignored, so beats
 * and bars can be grouped for readability ("x-x- x-x- … | …").
 */
const TAB_LEVEL: Record<string, HitLevel> = {
  '-': HIT_OFF,
  g: HIT_GHOST,
  x: HIT_NORMAL,
  X: HIT_ACCENT,
}

function patternFrom(
  id: string,
  name: string,
  subdivision: number,
  rows: Partial<Record<DrumVoiceId, string>>,
  bars = 1,
  bpm = 90,
): DrumPattern {
  const steps = bars * BEATS_PER_BAR * subdivision
  const hits = emptyHits(steps)
  for (const [voice, tab] of Object.entries(rows)) {
    const cells = (tab ?? '').replace(/[\s|]+/g, '')
    for (let s = 0; s < steps && s < cells.length; s++) {
      hits[voice as DrumVoiceId][s] = TAB_LEVEL[cells[s]] ?? HIT_OFF
    }
  }
  return { id, name, bars, subdivision, bpm, hits }
}

/** Starter grooves. On the 16th grid each beat is "1 e & a" (4 steps). */
export const DRUM_PRESETS: DrumPattern[] = [
  patternFrom('rock', 'Basic Rock Beat', 4, {
    hihat: 'x-x- x-x- x-x- x-x-',
    snare: '---- x--- ---- x---',
    kick:  'x--- ---- x--- ----',
  }),
  patternFrom('rock-busy', 'Rock w/ Off-beat Kick', 4, {
    hihat: 'x-x- x-x- x-x- x-x-',
    snare: '---- x--- ---- x---',
    kick:  'x--- --x- x--- --x-',
  }),
  patternFrom('four-floor', 'Four-on-the-Floor', 4, {
    hihat: '--x- --x- --x- --x-',
    snare: '---- x--- ---- x---',
    kick:  'x--- x--- x--- x---',
  }),
  // Quiet ghost strokes around a cracking, accented backbeat.
  patternFrom('funk-ghost', 'Funk w/ Ghost Notes', 4, {
    hihat: 'x-x- x-x- x-x- x-x-',
    snare: '---- X--g -g-- X--g',
    kick:  'x--x ---- --x- ----',
  }, 1, 92),
  // Swing: "spang-a-lang" ride, hi-hat foot on 2 & 4, feathered (ghost) kick.
  patternFrom('swing-ride', 'Swing Ride + HH Foot', 3, {
    ride:   'x-- x-x x-- x-x',
    snare:  '--- --- --- --g',
    kick:   'g-- g-- g-- g--',
    hhfoot: '--- x-- --- x--',
  }, 1, 120),
  // A bar of groove, then a 16th fill down the toms back into the crash.
  patternFrom('tom-fill', 'Groove + Tom Fill', 4, {
    crash:    'X--- ---- ---- ---- | ---- ---- ---- ----',
    hihat:    '--x- x-x- x-x- x-x- | x-x- x-x- ---- ----',
    snare:    '---- x--- ---- x--- | ---- x--- Xx-- ----',
    tom:      '---- ---- ---- ---- | ---- ---- --xx ----',
    midtom:   '---- ---- ---- ---- | ---- ---- ---- Xx--',
    floortom: '---- ---- ---- ---- | ---- ---- ---- --xx',
    kick:     'x--- ---- x-x- ---- | x--- ---- x--- x---',
  }, 2, 96),
]
