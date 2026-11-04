import { useCallback, useEffect, useState } from 'react'

/**
 * localStorage-backed per-song extras: an attached YouTube video (+ the sync
 * points that line it up with the score), which source plays (synth / video),
 * and the track mixer (volume / mute / solo). Mirrors the sections store: one
 * validated key, an in-page change event, and a hook that stays in sync across
 * instances + tabs. The Guitar Pro bytes themselves stay in IndexedDB.
 */

const EXTRAS_KEY = 'music-practicer:song-extras:v1'
const EXTRAS_EVENT = 'music-practicer:song-extras-changed'

/** "Bar `bar` (1-based) starts at `ms` into the video." */
export interface SyncPoint {
  bar: number
  ms: number
}

export interface SongVideo {
  /** YouTube video id. */
  id: string
  /** Sorted by bar; empty = bar 1 at 0:00. */
  sync: SyncPoint[]
}

export interface TrackMix {
  /** 0..1 */
  volume: number
  muted: boolean
  solo: boolean
}

export type PlaybackSource = 'synth' | 'video'

export interface SongExtras {
  /** Title / artist read from the score the last time it was opened. */
  title?: string
  artist?: string
  video?: SongVideo
  source?: PlaybackSource
  /** Keyed by track index. */
  mix?: Record<number, TrackMix>
  /** The attached video's volume, 0..1 (absent = full). */
  videoVolume?: number
}

export const DEFAULT_MIX: TrackMix = { volume: 1, muted: false, solo: false }

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function parseSync(raw: unknown): SyncPoint[] {
  if (!Array.isArray(raw)) return []
  const out: SyncPoint[] = []
  for (const p of raw) {
    if (typeof p !== 'object' || p === null) continue
    const o = p as Record<string, unknown>
    if (!isNum(o.bar) || !Number.isInteger(o.bar) || o.bar < 1) continue
    if (!isNum(o.ms) || o.ms < 0) continue
    out.push({ bar: o.bar, ms: Math.round(o.ms) })
  }
  return out.sort((a, b) => a.bar - b.bar)
}

function parseExtras(raw: unknown): SongExtras | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const out: SongExtras = {}
  if (typeof o.title === 'string' && o.title) out.title = o.title.slice(0, 200)
  if (typeof o.artist === 'string' && o.artist) out.artist = o.artist.slice(0, 200)
  const v = o.video as Record<string, unknown> | undefined
  if (v && typeof v === 'object' && typeof v.id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(v.id)) {
    out.video = { id: v.id, sync: parseSync(v.sync) }
  }
  if (o.source === 'synth' || o.source === 'video') out.source = o.source
  if (isNum(o.videoVolume)) out.videoVolume = Math.min(1, Math.max(0, o.videoVolume))
  if (typeof o.mix === 'object' && o.mix !== null) {
    const mix: Record<number, TrackMix> = {}
    for (const [k, m] of Object.entries(o.mix as Record<string, unknown>)) {
      const idx = Number(k)
      if (!Number.isInteger(idx) || idx < 0 || typeof m !== 'object' || m === null) continue
      const t = m as Record<string, unknown>
      mix[idx] = {
        volume: isNum(t.volume) ? Math.min(1, Math.max(0, t.volume)) : 1,
        muted: t.muted === true,
        solo: t.solo === true,
      }
    }
    out.mix = mix
  }
  return out
}

function loadAll(): Record<string, SongExtras> {
  try {
    const raw = window.localStorage.getItem(EXTRAS_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const out: Record<string, SongExtras> = {}
    for (const [songId, entry] of Object.entries(parsed as Record<string, unknown>)) {
      const extras = parseExtras(entry)
      if (extras) out[songId] = extras
    }
    return out
  } catch {
    return {}
  }
}

function saveAll(all: Record<string, SongExtras>): void {
  try {
    window.localStorage.setItem(EXTRAS_KEY, JSON.stringify(all))
  } catch {
    /* quota / private mode — degrade gracefully */
  }
}

export interface SongExtrasApi {
  extras: SongExtras
  setVideo(video: SongVideo | null): void
  setSync(sync: SyncPoint[]): void
  setSource(source: PlaybackSource): void
  setTrackMix(trackIndex: number, mix: Partial<TrackMix>): void
  setMeta(title: string, artist: string): void
  setVideoVolume(volume: number): void
}

/** Extras for one song (empty object when none / no song). */
export function useSongExtras(songId: string): SongExtrasApi {
  const [all, setAll] = useState<Record<string, SongExtras>>(loadAll)

  useEffect(() => {
    const resync = () => setAll(loadAll())
    const onStorage = (e: StorageEvent) => {
      if (e.key === EXTRAS_KEY) resync()
    }
    window.addEventListener(EXTRAS_EVENT, resync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(EXTRAS_EVENT, resync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  /** Read-modify-write this song's entry against the freshest stored copy. */
  const update = useCallback(
    (fn: (current: SongExtras) => SongExtras) => {
      if (!songId) return
      const next = loadAll()
      next[songId] = fn(next[songId] ?? {})
      saveAll(next)
      setAll(next)
      try {
        window.dispatchEvent(new Event(EXTRAS_EVENT))
      } catch {
        /* no window/Event — state already updated */
      }
    },
    [songId],
  )

  const setVideo = useCallback(
    (video: SongVideo | null) =>
      update((cur) => {
        const next: SongExtras = { ...cur }
        delete next.video
        delete next.source
        return video ? { ...next, video, source: 'video' } : next
      }),
    [update],
  )
  const setSync = useCallback(
    (sync: SyncPoint[]) =>
      update((cur) => (cur.video ? { ...cur, video: { ...cur.video, sync: parseSync(sync) } } : cur)),
    [update],
  )
  const setSource = useCallback((source: PlaybackSource) => update((cur) => ({ ...cur, source })), [update])
  const setTrackMix = useCallback(
    (trackIndex: number, mix: Partial<TrackMix>) =>
      update((cur) => ({
        ...cur,
        mix: { ...cur.mix, [trackIndex]: { ...DEFAULT_MIX, ...cur.mix?.[trackIndex], ...mix } },
      })),
    [update],
  )
  const setMeta = useCallback(
    (title: string, artist: string) => {
      const cur = all[songId]
      if ((cur?.title ?? '') === title && (cur?.artist ?? '') === artist) return
      update((c) => ({ ...c, title, artist }))
    },
    [all, songId, update],
  )

  const setVideoVolume = useCallback(
    (volume: number) => update((cur) => ({ ...cur, videoVolume: Math.min(1, Math.max(0, volume)) })),
    [update],
  )

  return {
    extras: (songId && all[songId]) || {},
    setVideo,
    setSync,
    setSource,
    setTrackMix,
    setMeta,
    setVideoVolume,
  }
}

/** Drop a deleted song's extras. */
export function removeSongExtras(songId: string): void {
  const next = loadAll()
  if (!(songId in next)) return
  delete next[songId]
  saveAll(next)
  try {
    window.dispatchEvent(new Event(EXTRAS_EVENT))
  } catch {
    /* ignore */
  }
}
