import { useCallback, useEffect, useState } from 'react'
import {
  DRUM_VOICES,
  HIT_NORMAL,
  HIT_OFF,
  SUBDIVISIONS,
  isHitLevel,
  resizeHits,
  stepCount,
  type DrumPattern,
  type DrumVoiceId,
  type HitLevel,
} from './drums'

/**
 * localStorage-backed store for user-created drum patterns.
 *
 * Self-contained module mirroring the custom-chords store: owns the storage
 * key/event names, a validated load/save layer, id minting, and the hook. All
 * reads are validated defensively and degrade to an empty list on any error so
 * a corrupt or inaccessible store never crashes the app. Every mutation routes
 * through `persist`, which writes through, updates local state, and broadcasts
 * an in-page event so all hook instances re-sync.
 */

/** localStorage key holding the JSON-serialised array of drum patterns. */
const DRUM_PATTERNS_KEY = 'music-practicer:drum-patterns:v1'

/** Window event dispatched after a successful save so hooks can re-sync. */
const DRUM_PATTERNS_EVENT = 'music-practicer:drum-patterns-changed'

/** Build a URL/id-safe slug from arbitrary user text. */
function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** True when `v` is a finite number. */
function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/**
 * One stored cell → a HitLevel. Beats saved before dynamics existed hold
 * booleans (on = a normal hit); newer ones hold levels 0..3. Anything else is
 * invalid (null).
 */
function parseCell(cell: unknown): HitLevel | null {
  if (typeof cell === 'boolean') return cell ? HIT_NORMAL : HIT_OFF
  return isHitLevel(cell) ? cell : null
}

/**
 * Validate a raw `hits` value into a complete per-voice map of HitLevel[].
 * A voice missing from the object (saves made before that voice existed) gets
 * an empty row — `resizeHits` pads it to the grid — so adding voices never
 * drops existing beats. A present row must be an array of valid cells.
 */
function parseHits(raw: unknown): Record<DrumVoiceId, HitLevel[]> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const out = {} as Record<DrumVoiceId, HitLevel[]>
  for (const voice of DRUM_VOICES) {
    const row = obj[voice.id]
    if (row === undefined) {
      out[voice.id] = []
      continue
    }
    if (!Array.isArray(row)) return null
    const cells: HitLevel[] = []
    for (const cell of row) {
      const level = parseCell(cell)
      if (level === null) return null
      cells.push(level)
    }
    out[voice.id] = cells
  }
  return out
}

/** Narrow + validate one raw entry into a DrumPattern, or null if invalid. */
function parsePattern(raw: unknown): DrumPattern | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>

  if (typeof obj.id !== 'string' || obj.id.length === 0) return null
  if (typeof obj.name !== 'string') return null
  // Reject zero/negative/non-integer dimensions and tempos so a pattern can
  // never be played or rendered with a degenerate grid or Infinity tempo.
  if (!isNumber(obj.bars) || !Number.isInteger(obj.bars) || obj.bars < 1 || obj.bars > 2) {
    return null
  }
  if (
    !isNumber(obj.subdivision) ||
    !(SUBDIVISIONS as readonly number[]).includes(obj.subdivision)
  ) {
    return null
  }
  if (!isNumber(obj.bpm) || obj.bpm <= 0) return null

  const hits = parseHits(obj.hits)
  if (!hits) return null

  // Normalise hit-array lengths to the pattern's grid size, so what's stored
  // always matches what plays and renders (this also fills missing voices'
  // empty rows with zeros). Levels are written back as numbers on next save.
  const steps = stepCount({ bars: obj.bars, subdivision: obj.subdivision })
  return {
    id: obj.id,
    name: obj.name,
    bars: obj.bars,
    subdivision: obj.subdivision,
    bpm: obj.bpm,
    hits: resizeHits(hits, steps),
  }
}

/**
 * Read and validate all drum patterns from localStorage.
 * Invalid individual entries are dropped; on ANY error returns [].
 */
function loadPatterns(): DrumPattern[] {
  try {
    const raw = window.localStorage.getItem(DRUM_PATTERNS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const out: DrumPattern[] = []
    for (const entry of parsed) {
      const pattern = parsePattern(entry)
      if (pattern) out.push(pattern)
    }
    return out
  } catch {
    return []
  }
}

/** Persist the given patterns to localStorage; swallows quota/access errors. */
function savePatterns(patterns: DrumPattern[]): void {
  try {
    window.localStorage.setItem(DRUM_PATTERNS_KEY, JSON.stringify(patterns))
  } catch {
    /* private mode / quota exceeded — degrade gracefully */
  }
}

/** Mint a stable, reasonably-unique id for a freshly created pattern. */
function makePatternId(name: string): string {
  return `drum-${slug(name)}-${Date.now().toString(36)}`
}

/** Reactive + imperative surface returned by {@link useDrumPatterns}. */
export interface DrumPatternsApi {
  patterns: DrumPattern[]
  addPattern(input: Omit<DrumPattern, 'id'>): DrumPattern
  updatePattern(id: string, input: Omit<DrumPattern, 'id'>): void
  removePattern(id: string): void
}

/**
 * Stateful access to the user's drum patterns, kept in sync with localStorage
 * across hook instances (via {@link DRUM_PATTERNS_EVENT}) and other tabs (via
 * the native `storage` event). Every mutation routes through `persist`, which
 * writes through, updates local state, and broadcasts the in-page event.
 */
export function useDrumPatterns(): DrumPatternsApi {
  const [patterns, setPatterns] = useState<DrumPattern[]>(loadPatterns)

  const persist = useCallback((next: DrumPattern[]) => {
    savePatterns(next)
    setPatterns(next)
    try {
      window.dispatchEvent(new Event(DRUM_PATTERNS_EVENT))
    } catch {
      /* environments without window/Event — state already updated */
    }
  }, [])

  useEffect(() => {
    const resync = () => setPatterns(loadPatterns())
    const onStorage = (e: StorageEvent) => {
      if (e.key === DRUM_PATTERNS_KEY) resync()
    }
    window.addEventListener(DRUM_PATTERNS_EVENT, resync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(DRUM_PATTERNS_EVENT, resync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const addPattern = useCallback(
    (input: Omit<DrumPattern, 'id'>): DrumPattern => {
      const pattern: DrumPattern = { id: makePatternId(input.name), ...input }
      persist([...loadPatterns(), pattern])
      return pattern
    },
    [persist],
  )

  const updatePattern = useCallback(
    (id: string, input: Omit<DrumPattern, 'id'>) => {
      const next = loadPatterns().map((p) =>
        p.id === id ? { ...input, id } : p,
      )
      persist(next)
    },
    [persist],
  )

  const removePattern = useCallback(
    (id: string) => {
      persist(loadPatterns().filter((p) => p.id !== id))
    },
    [persist],
  )

  return { patterns, addPattern, updatePattern, removePattern }
}
