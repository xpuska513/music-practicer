/**
 * Drum-notation "spelling": turns a step-grid DrumPattern into readable
 * two-voice drum notation — hands (cymbals / snare / toms) stems-up, feet
 * (kick / hi-hat pedal) stems-down — with real note values per beat, beams,
 * and rests. Each note carries its voices' hit levels, so a renderer can
 * parenthesise ghost notes and accent a stem.
 *
 * Pure data, no rendering: DrumNotation.tsx lays the result out as SVG.
 */
import { BEATS_PER_BAR, DRUM_VOICES, HIT_OFF } from './drums'
import type { DrumPattern, DrumVoiceId, HitLevel } from './drums'

export type StemDir = 'up' | 'down'

/**
 * Staff position per voice, in half staff-spaces below the top staff line
 * (0 = top line, 8 = bottom line, negative = above the staff). This is the
 * common drum key on a percussion clef (PAS / Weinberg).
 */
export const DRUM_STAFF_POS: Record<DrumVoiceId, number> = {
  crash: -2, // A5 — ledger line above the staff
  ride: 0, // F5 — top line (x head)
  hihat: -1, // G5 — the space just above the staff
  openhh: -1, // G5, marked open with a small "o"
  tom: 1, // E5 — top space (high tom)
  midtom: 2, // D5 — fourth line
  snare: 3, // C5 — third space
  floortom: 5, // A4 — second space
  kick: 7, // F4 — bottom space
  hhfoot: 9, // D4 — the space below the staff (x head)
}

/** Hands play stems-up, feet (kick, hi-hat pedal) stems-down. */
export const DRUM_STEM: Record<DrumVoiceId, StemDir> = {
  crash: 'up',
  ride: 'up',
  hihat: 'up',
  openhh: 'up',
  tom: 'up',
  midtom: 'up',
  snare: 'up',
  floortom: 'up',
  kick: 'down',
  hhfoot: 'down',
}

export type NoteValue = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'

export interface NotationEvent {
  /** Absolute grid step where the event starts. */
  step: number
  /** Length in grid steps. */
  length: number
  value: NoteValue
  dotted: boolean
  /** Voices struck together on this stem; empty = a rest. */
  voices: DrumVoiceId[]
  /** Hit level of each struck voice (ghost / normal / accent); {} for a rest. */
  levels: Partial<Record<DrumVoiceId, HitLevel>>
}

/** One voice's beat (or a merged half-/whole-bar rest). */
export interface NotationGroup {
  stem: StemDir
  bar: number
  events: NotationEvent[]
  /** Join the group's notes with a beam (2+ notes shorter than a quarter). */
  beamed: boolean
  /** 3 for a triplet beat, else null. */
  tuplet: number | null
}

export interface SpelledPattern {
  groups: NotationGroup[]
  /** False when no foot voice (kick / hi-hat pedal) plays — the hands' rests
   *  then sit mid-staff. */
  hasFeet: boolean
}

/** Note value for `len` grid steps at `subdivision` steps per beat. */
function valueFor(len: number, subdivision: number): [NoteValue, boolean] {
  if (subdivision === 4) {
    if (len === 1) return ['sixteenth', false]
    if (len === 2) return ['eighth', false]
    if (len === 3) return ['eighth', true]
    return ['quarter', false]
  }
  if (subdivision === 2) return len === 1 ? ['eighth', false] : ['quarter', false]
  // Triplets: one step is a triplet 8th; a whole beat is a plain quarter.
  return len === 3 ? ['quarter', false] : ['eighth', false]
}

export function spellDrumPattern(pattern: DrumPattern): SpelledPattern {
  const sub = pattern.subdivision
  const perBar = BEATS_PER_BAR * sub
  const steps = pattern.bars * perBar

  /** A voice's level at `step` (a missing row or cell reads as silent). */
  const level = (voice: DrumVoiceId, step: number): HitLevel => pattern.hits[voice]?.[step] ?? HIT_OFF

  /** Voices on one stem struck at `step`, in staff order (top → bottom). */
  const struck = (step: number, stem: StemDir): DrumVoiceId[] =>
    DRUM_VOICES.filter((v) => DRUM_STEM[v.id] === stem && level(v.id, step) > HIT_OFF).map(
      (v) => v.id,
    )

  const hasFeet = DRUM_VOICES.some(
    (v) =>
      DRUM_STEM[v.id] === 'down' &&
      Array.from({ length: steps }, (_, step) => level(v.id, step)).some((l) => l > HIT_OFF),
  )

  /** A note (or, with no voices, a rest) carrying each struck voice's level. */
  const event = (
    step: number,
    length: number,
    value: NoteValue,
    dotted: boolean,
    voices: DrumVoiceId[],
  ): NotationEvent => {
    const levels: NotationEvent['levels'] = {}
    for (const v of voices) levels[v] = level(v, step)
    return { step, length, value, dotted, voices, levels }
  }

  const rest = (step: number, length: number, value: NoteValue, dotted = false): NotationEvent =>
    event(step, length, value, dotted, [])

  const spellBeat = (start: number, stem: StemDir, bar: number): NotationGroup => {
    const slots = Array.from({ length: sub }, (_, k) => struck(start + k, stem))
    const onsets = slots.flatMap((v, k) => (v.length > 0 ? [k] : []))
    const group = (events: NotationEvent[], tuplet: number | null): NotationGroup => ({
      stem,
      bar,
      events,
      beamed: events.filter((e) => e.voices.length > 0).length >= 2,
      tuplet,
    })

    if (onsets.length === 0) return group([rest(start, sub, 'quarter')], null)

    // Triplets read best one slot per event: 8ths and 8th rests under a "3" —
    // unless the beat is a single hit on the downbeat (a plain quarter).
    if (sub === 3 && !(onsets.length === 1 && onsets[0] === 0)) {
      return group(
        slots.map((voices, k) => event(start + k, 1, 'eighth', false, voices)),
        3,
      )
    }

    // Otherwise each hit lasts until the next one (drums don't sustain, so this
    // only chooses the clearest spelling): 16th / 8th / dotted 8th / quarter.
    const events: NotationEvent[] = []
    if (onsets[0] > 0) {
      const [value, dotted] = valueFor(onsets[0], sub)
      events.push(rest(start, onsets[0], value, dotted))
    }
    onsets.forEach((k, i) => {
      const length = (onsets[i + 1] ?? sub) - k
      const [value, dotted] = valueFor(length, sub)
      events.push(event(start + k, length, value, dotted, slots[k]))
    })
    return group(events, null)
  }

  const groups: NotationGroup[] = []
  for (const stem of ['up', 'down'] as const) {
    if (stem === 'down' && !hasFeet) continue
    for (let bar = 0; bar < pattern.bars; bar++) {
      const barStart = bar * perBar
      const silent = (beat: number) =>
        Array.from({ length: sub }, (_, k) => barStart + beat * sub + k).every(
          (step) => struck(step, stem).length === 0,
        )

      if ([0, 1, 2, 3].every(silent)) {
        groups.push({ stem, bar, events: [rest(barStart, perBar, 'whole')], beamed: false, tuplet: null })
        continue
      }
      for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
        const start = barStart + beat * sub
        // Two silent beats in the same half of the bar merge into a half rest.
        if (beat % 2 === 0 && silent(beat) && silent(beat + 1)) {
          groups.push({ stem, bar, events: [rest(start, 2 * sub, 'half')], beamed: false, tuplet: null })
          beat++
          continue
        }
        groups.push(spellBeat(start, stem, bar))
      }
    }
  }
  return { groups, hasFeet }
}
