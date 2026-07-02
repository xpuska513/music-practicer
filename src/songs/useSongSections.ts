import { useCallback, useEffect, useState } from 'react'

/**
 * localStorage-backed store for saved song sections (a named bar-range of one
 * track in an imported song, to loop for practice). Mirrors the custom-chords /
 * drum-patterns stores: owns its key/event, a validated load/save layer, id
 * minting, and a hook that stays in sync across instances + tabs. Section
 * metadata is tiny; the heavy Guitar Pro bytes live in IndexedDB (songStore).
 */

const SECTIONS_KEY = 'music-practicer:song-sections:v1'
const SECTIONS_EVENT = 'music-practicer:song-sections-changed'

export interface SongSection {
  id: string
  /** Id of the imported song (songStore) this section belongs to. */
  songId: string
  name: string
  /** Track index within the score. */
  trackIndex: number
  /** Track name at save time (for display without loading the score). */
  trackName: string
  /** 1-based, inclusive bar range. */
  barStart: number
  barEnd: number
  createdAt: number
}

export type SongSectionInput = Omit<SongSection, 'id' | 'createdAt'>

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v)
}

function parseSection(raw: unknown): SongSection | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || o.id.length === 0) return null
  if (typeof o.songId !== 'string' || o.songId.length === 0) return null
  if (typeof o.name !== 'string') return null
  if (typeof o.trackName !== 'string') return null
  if (!isInt(o.trackIndex) || o.trackIndex < 0) return null
  if (!isInt(o.barStart) || o.barStart < 1) return null
  if (!isInt(o.barEnd) || o.barEnd < o.barStart) return null
  if (!isInt(o.createdAt)) return null
  return {
    id: o.id,
    songId: o.songId,
    name: o.name,
    trackIndex: o.trackIndex,
    trackName: o.trackName,
    barStart: o.barStart,
    barEnd: o.barEnd,
    createdAt: o.createdAt,
  }
}

function loadSections(): SongSection[] {
  try {
    const raw = window.localStorage.getItem(SECTIONS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const out: SongSection[] = []
    for (const entry of parsed) {
      const s = parseSection(entry)
      if (s) out.push(s)
    }
    return out
  } catch {
    return []
  }
}

function saveSections(sections: SongSection[]): void {
  try {
    window.localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections))
  } catch {
    /* quota / private mode — degrade gracefully */
  }
}

function makeSectionId(): string {
  return `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export interface SongSectionsApi {
  sections: SongSection[]
  addSection(input: SongSectionInput): SongSection
  removeSection(id: string): void
  removeBySong(songId: string): void
}

export function useSongSections(): SongSectionsApi {
  const [sections, setSections] = useState<SongSection[]>(loadSections)

  const persist = useCallback((next: SongSection[]) => {
    saveSections(next)
    setSections(next)
    try {
      window.dispatchEvent(new Event(SECTIONS_EVENT))
    } catch {
      /* no window/Event — state already updated */
    }
  }, [])

  useEffect(() => {
    const resync = () => setSections(loadSections())
    const onStorage = (e: StorageEvent) => {
      if (e.key === SECTIONS_KEY) resync()
    }
    window.addEventListener(SECTIONS_EVENT, resync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(SECTIONS_EVENT, resync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const addSection = useCallback(
    (input: SongSectionInput): SongSection => {
      const section: SongSection = {
        ...input,
        id: makeSectionId(),
        createdAt: Date.now(),
      }
      persist([...loadSections(), section])
      return section
    },
    [persist],
  )

  const removeSection = useCallback(
    (id: string) => {
      persist(loadSections().filter((s) => s.id !== id))
    },
    [persist],
  )

  const removeBySong = useCallback(
    (songId: string) => {
      persist(loadSections().filter((s) => s.songId !== songId))
    },
    [persist],
  )

  return { sections, addSection, removeSection, removeBySong }
}
