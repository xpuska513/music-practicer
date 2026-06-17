import type { ChordDef, ChordShape, NoteName } from '../types'

/**
 * Persistence for user-created chord shapes.
 *
 * Pure module (no React): owns the localStorage key/event names, the
 * load/save helpers, and id minting. All reads are validated and degrade to an
 * empty list on any error so a corrupt/private-mode store never crashes the app.
 */

/** localStorage key holding the JSON-serialised array of custom chords. */
export const CUSTOM_CHORDS_KEY = 'music-practicer:custom-chords:v1'

/** Window event dispatched after a successful save so hooks can re-sync. */
export const CUSTOM_CHORDS_EVENT = 'music-practicer:custom-chords-changed'

/** Build a URL/id-safe slug from arbitrary user text. */
function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** True when `v` is a finite integer within [min, max] (inclusive). */
function isIntInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
}

/** Narrow + validate one raw entry into a ChordDef, or return null if invalid. */
function parseChord(raw: unknown): ChordDef | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>

  if (typeof obj.id !== 'string' || obj.id.length === 0) return null
  if (typeof obj.name !== 'string') return null
  if (typeof obj.root !== 'string') return null
  if (typeof obj.quality !== 'string') return null

  const rawShape = obj.shape
  if (typeof rawShape !== 'object' || rawShape === null) return null
  const shapeObj = rawShape as Record<string, unknown>

  const rawFrets = shapeObj.frets
  if (!Array.isArray(rawFrets) || rawFrets.length !== 6) return null
  const frets: (number | null)[] = []
  for (const f of rawFrets) {
    if (f !== null && !isIntInRange(f, 0, 24)) return null
    frets.push(f === null ? null : (f as number))
  }

  let fingers: (number | null)[] | undefined
  if (shapeObj.fingers !== undefined) {
    const rawFingers = shapeObj.fingers
    if (!Array.isArray(rawFingers) || rawFingers.length !== 6) return null
    const out: (number | null)[] = []
    for (const f of rawFingers) {
      if (f !== null && !isIntInRange(f, 1, 4)) return null
      out.push(f === null ? null : (f as number))
    }
    fingers = out
  }

  let baseFret: number | undefined
  if (shapeObj.baseFret !== undefined) {
    if (!isIntInRange(shapeObj.baseFret, 1, 24)) return null
    baseFret = shapeObj.baseFret
  }

  const shape: ChordShape = { frets }
  if (fingers) shape.fingers = fingers
  if (baseFret !== undefined) shape.baseFret = baseFret

  return {
    id: obj.id,
    name: obj.name,
    root: obj.root as NoteName,
    quality: obj.quality,
    difficulty: 'custom',
    shape,
  }
}

/**
 * Read and validate all custom chords from localStorage.
 * Invalid individual entries are dropped; on ANY error returns [].
 */
export function loadCustomChords(): ChordDef[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_CHORDS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const out: ChordDef[] = []
    for (const entry of parsed) {
      const chord = parseChord(entry)
      if (chord) out.push(chord)
    }
    return out
  } catch {
    return []
  }
}

/** Persist the given chords to localStorage; swallows quota/access errors. */
export function saveCustomChords(chords: ChordDef[]): void {
  try {
    window.localStorage.setItem(CUSTOM_CHORDS_KEY, JSON.stringify(chords))
  } catch {
    /* private mode / quota exceeded — degrade gracefully */
  }
}

/** Mint a stable, reasonably-unique id for a freshly created chord. */
export function makeChordId(name: string): string {
  return `custom-chord-${slug(name)}-${Date.now().toString(36)}`
}
