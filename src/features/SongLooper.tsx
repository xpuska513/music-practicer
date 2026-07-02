import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSongLibrary, getSongData } from '../songs/songStore'
import { useSongSections } from '../songs/useSongSections'
import AlphaTabViewer from '../songs/AlphaTabViewer'
import type { AlphaTabHandle, ScoreInfo } from '../songs/AlphaTabViewer'
import { usePersistentState } from '../lib/usePersistentState'
import './SongLooper.css'

const MIN_SPEED = 25
const MAX_SPEED = 125
const isSpeed = (v: unknown): v is number =>
  typeof v === 'number' && v >= MIN_SPEED && v <= MAX_SPEED
const isStr = (v: unknown): v is string => typeof v === 'string'
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** Pick a sensible default track: first non-percussion, else the first track. */
function defaultTrack(info: ScoreInfo): number | null {
  if (info.tracks.length === 0) return null
  const melodic = info.tracks.find((t) => !t.isPercussion)
  return (melodic ?? info.tracks[0]).index
}

export default function SongLooper() {
  const { songs, loading, error: libError, importFile, remove } = useSongLibrary()
  const { sections, addSection, removeSection, removeBySong } = useSongSections()

  const [activeSongId, setActiveSongId] = usePersistentState<string>(
    'songs:active',
    '',
    isStr,
  )
  const [speed, setSpeed] = usePersistentState<number>('songs:speed', 100, isSpeed)
  const [metronomeOn, setMetronomeOn] = usePersistentState<boolean>(
    'songs:metro',
    false,
    isBool,
  )

  // Per-track mixer state (ephemeral — reset per song). Track indices.
  const [mutedTracks, setMutedTracks] = useState<Set<number>>(new Set())
  const [soloTracks, setSoloTracks] = useState<Set<number>>(new Set())
  const mutedRef = useRef(mutedTracks)
  mutedRef.current = mutedTracks
  const soloRef = useRef(soloTracks)
  soloRef.current = soloTracks

  const [bytes, setBytes] = useState<ArrayBuffer | null>(null)
  const [bytesLoading, setBytesLoading] = useState(false)
  const [scoreInfo, setScoreInfo] = useState<ScoreInfo | null>(null)
  const [trackIndex, setTrackIndex] = useState<number | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [activeLoopId, setActiveLoopId] = useState<string | null>(null)
  const [loopNote, setLoopNote] = useState<string | null>(null)

  // Section builder inputs (1-based bars).
  const [barStart, setBarStart] = useState(1)
  const [barEnd, setBarEnd] = useState(1)
  const [sectionName, setSectionName] = useState('')

  const viewerRef = useRef<AlphaTabHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeSong = useMemo(
    () => songs.find((s) => s.id === activeSongId) ?? null,
    [songs, activeSongId],
  )

  // Load the active song's bytes from IndexedDB whenever it changes.
  useEffect(() => {
    let alive = true
    // Clear the previous song's bytes immediately so the viewer (keyed by song
    // id) unmounts instead of briefly mounting the new id with stale data.
    setBytes(null)
    if (!activeSong) return
    setBytesLoading(true)
    setViewerError(null)
    getSongData(activeSong.id)
      .then((buf) => {
        if (!alive) return
        if (!buf) {
          setViewerError('That song’s data is missing — try re-importing it.')
          setBytes(null)
        } else {
          setBytes(buf)
        }
      })
      .catch(() => alive && setViewerError('Could not load that song.'))
      .finally(() => alive && setBytesLoading(false))
    return () => {
      alive = false
    }
  }, [activeSong])

  const openSong = useCallback(
    (id: string) => {
      setActiveSongId(id)
      setScoreInfo(null)
      setTrackIndex(null)
      setReady(false)
      setPlaying(false)
      setActiveLoopId(null)
      setLoopNote(null)
      setViewerError(null)
      // Fresh song = fresh engine (all tracks audible); clear the mixer.
      setMutedTracks(new Set())
      setSoloTracks(new Set())
    },
    [setActiveSongId],
  )

  const handleImport = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      const meta = await importFile(file)
      if (meta) openSong(meta.id)
    },
    [importFile, openSong],
  )

  const handleDeleteSong = useCallback(
    (id: string) => {
      removeBySong(id)
      void remove(id)
      if (id === activeSongId) openSong('')
    },
    [remove, removeBySong, activeSongId, openSong],
  )

  const onScoreLoaded = useCallback(
    (info: ScoreInfo) => {
      setScoreInfo(info)
      setViewerError(null)
      setTrackIndex((cur) =>
        cur != null && info.tracks.some((t) => t.index === cur)
          ? cur
          : defaultTrack(info),
      )
      setBarStart(1)
      setBarEnd(Math.max(1, info.barCount))
    },
    [],
  )

  // Choosing a track only changes which tab is DISPLAYED — playback covers the
  // whole score regardless, so this doesn't touch audio, the loop, or the mixer.
  const setDisplayTrack = useCallback((idx: number) => setTrackIndex(idx), [])

  const toggleMute = useCallback((ti: number) => {
    const willMute = !mutedRef.current.has(ti)
    viewerRef.current?.setTrackMute(ti, willMute)
    setMutedTracks((prev) => {
      const next = new Set(prev)
      if (willMute) next.add(ti)
      else next.delete(ti)
      return next
    })
  }, [])

  const toggleSolo = useCallback((ti: number) => {
    const willSolo = !soloRef.current.has(ti)
    viewerRef.current?.setTrackSolo(ti, willSolo)
    setSoloTracks((prev) => {
      const next = new Set(prev)
      if (willSolo) next.add(ti)
      else next.delete(ti)
      return next
    })
  }, [])

  const changeSpeed = useCallback(
    (value: number) => {
      setSpeed(value)
      viewerRef.current?.setSpeed(value / 100)
    },
    [setSpeed],
  )

  // Push the persisted speed + metronome to the engine once it's ready.
  useEffect(() => {
    if (ready) viewerRef.current?.setSpeed(speed / 100)
  }, [ready, speed])
  useEffect(() => {
    if (ready) viewerRef.current?.setMetronome(metronomeOn)
  }, [ready, metronomeOn])

  const barCount = scoreInfo?.barCount ?? 1
  const clampBar = (v: number) => Math.min(Math.max(1, Math.round(v) || 1), barCount)

  const applyMarker = useCallback(
    (markerIdx: number) => {
      const markers = scoreInfo?.markers ?? []
      const m = markers[markerIdx]
      if (!m) return
      const next = markers[markerIdx + 1]
      setBarStart(m.bar)
      setBarEnd(next ? Math.max(m.bar, next.bar - 1) : barCount)
      setSectionName(m.text)
    },
    [scoreInfo, barCount],
  )

  const currentTrackName =
    scoreInfo?.tracks.find((t) => t.index === trackIndex)?.name ?? ''

  const handleAddSection = useCallback(() => {
    if (!activeSong || trackIndex == null) return
    const start = clampBar(barStart)
    const end = Math.max(start, clampBar(barEnd))
    const name = sectionName.trim() || `Bars ${start}–${end}`
    addSection({
      songId: activeSong.id,
      name,
      trackIndex,
      trackName: currentTrackName,
      barStart: start,
      barEnd: end,
    })
    setSectionName('')
  }, [activeSong, trackIndex, barStart, barEnd, sectionName, currentTrackName, addSection, clampBar])

  const loopSection = useCallback(
    (id: string, start: number, end: number) => {
      const started = viewerRef.current?.loopBars(start, end) ?? false
      if (started) {
        setActiveLoopId(id)
        setLoopNote(null)
      } else {
        // Engine not ready to resolve the bar range yet; don't pretend to loop.
        setActiveLoopId(null)
        setLoopNote('Still preparing playback — tap Loop again in a moment.')
      }
    },
    [],
  )

  const stopPlayback = useCallback(() => {
    viewerRef.current?.stop()
    viewerRef.current?.clearLoop()
    setActiveLoopId(null)
    setLoopNote(null)
  }, [])

  // Saved sections for this song. Loops span the whole band (all un-muted
  // tracks), so sections are per-song bar ranges, not per-track.
  const songSections = useMemo(
    () =>
      sections
        .filter((s) => s.songId === activeSongId)
        .sort((a, b) => a.barStart - b.barStart),
    [sections, activeSongId],
  )

  return (
    <div className="song-looper col">
      {/* ── Library ─────────────────────────────────────────────────────── */}
      <section className="panel col">
        <div className="row song-looper__lib-head">
          <div>
            <h3 className="song-looper__h">🎼 Songs</h3>
            <p className="muted song-looper__sub">
              Import a Guitar Pro file, pick the guitar or bass track, and loop
              sections to practice.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            + Import file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gp,.gp3,.gp4,.gp5,.gpx"
            className="song-looper__file"
            onChange={(e) => {
              void handleImport(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>

        {libError ? <p className="song-looper__err" role="alert">{libError}</p> : null}

        {loading ? (
          <p className="muted">Loading your library…</p>
        ) : songs.length === 0 ? (
          <p className="muted">
            No songs yet. Import a <span className="mono">.gp / .gp5 / .gpx</span>{' '}
            file (e.g. exported from Songsterr) to get started.
          </p>
        ) : (
          <ul className="song-looper__songs">
            {songs.map((s) => (
              <li
                key={s.id}
                className={
                  'song-looper__song' + (s.id === activeSongId ? ' is-active' : '')
                }
              >
                <button
                  type="button"
                  className="song-looper__song-open"
                  onClick={() => openSong(s.id)}
                >
                  <span className="song-looper__song-name">{s.name}</span>
                  <span className="muted mono song-looper__song-meta">
                    {formatBytes(s.size)}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn song-looper__song-del"
                  onClick={() => handleDeleteSong(s.id)}
                  title="Remove from library"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Viewer + transport ──────────────────────────────────────────── */}
      {activeSong ? (
        <section className="panel col">
          <div className="row song-looper__viewer-head">
            <h3 className="song-looper__h">
              {scoreInfo?.title || activeSong.name}
            </h3>
            <span className="muted song-looper__status">
              {viewerError
                ? ''
                : bytesLoading
                  ? 'Reading file…'
                  : !scoreInfo
                    ? 'Parsing…'
                    : ready
                      ? 'Ready'
                      : 'Loading playback…'}
            </span>
          </div>

          {viewerError ? (
            <p className="song-looper__err" role="alert">{viewerError}</p>
          ) : null}

          {/* Track mixer: pick which track's tab is shown, and mute/solo the mix */}
          {scoreInfo && scoreInfo.tracks.length > 0 ? (
            <div className="control">
              <label id="song-track-label">Tracks</label>
              <ul className="song-looper__mixer" aria-labelledby="song-track-label">
                {scoreInfo.tracks.map((t) => {
                  const muted = mutedTracks.has(t.index)
                  const solo = soloTracks.has(t.index)
                  return (
                    <li
                      key={t.index}
                      className={
                        'song-looper__mix' +
                        (t.index === trackIndex ? ' is-viewing' : '')
                      }
                    >
                      <button
                        type="button"
                        className="song-looper__mix-name"
                        aria-pressed={t.index === trackIndex}
                        onClick={() => setDisplayTrack(t.index)}
                        title="Show this track's tab"
                      >
                        <span aria-hidden="true">
                          {t.isPercussion ? '🥁' : t.isBass ? '𝄢' : '🎸'}
                        </span>{' '}
                        {t.name}
                        {t.index === trackIndex ? (
                          <span className="muted song-looper__mix-view"> · viewing</span>
                        ) : null}
                      </button>
                      <div className="song-looper__mix-ctrls">
                        <button
                          type="button"
                          className={'chip song-looper__mix-btn' + (muted ? ' is-muted' : '')}
                          aria-pressed={muted}
                          disabled={!ready}
                          onClick={() => toggleMute(t.index)}
                          title={muted ? 'Unmute' : 'Mute'}
                        >
                          {muted ? '🔇' : '🔊'}
                        </button>
                        <button
                          type="button"
                          className={'chip song-looper__mix-btn' + (solo ? ' is-solo' : '')}
                          aria-pressed={solo}
                          disabled={!ready}
                          onClick={() => toggleSolo(t.index)}
                          title={solo ? 'Unsolo' : 'Solo (mute the rest)'}
                        >
                          S
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {bytes ? (
            <AlphaTabViewer
              key={activeSong.id}
              ref={viewerRef}
              data={bytes}
              trackIndex={trackIndex}
              onScoreLoaded={onScoreLoaded}
              onReadyChange={setReady}
              onPlayingChange={setPlaying}
              onError={setViewerError}
            />
          ) : null}

          {/* Transport */}
          <div className="row song-looper__transport">
            <button
              type="button"
              className={`btn ${playing ? '' : 'btn-primary'}`}
              disabled={!ready}
              onClick={() => viewerRef.current?.playPause()}
            >
              {playing ? '❚❚ Pause' : '▶ Play'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!ready}
              onClick={stopPlayback}
            >
              ■ Stop
            </button>
            <button
              type="button"
              className={`btn ${metronomeOn ? 'btn-primary' : ''}`}
              disabled={!ready}
              aria-pressed={metronomeOn}
              onClick={() => setMetronomeOn((v) => !v)}
              title="Metronome click during playback"
            >
              🎵 Metronome
            </button>
            <div className="control song-looper__speed">
              <label htmlFor="song-speed">
                Speed <span className="mono">{speed}%</span>
              </label>
              <input
                id="song-speed"
                type="range"
                min={MIN_SPEED}
                max={MAX_SPEED}
                step={5}
                value={speed}
                onChange={(e) => changeSpeed(Number(e.target.value))}
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Section builder + saved loops ───────────────────────────────── */}
      {activeSong && scoreInfo && trackIndex != null ? (
        <section className="panel col">
          <h3 className="song-looper__h">Loop sections</h3>
          <p className="muted song-looper__sub">
            Save any bar range and loop it — playback covers every un-muted
            track. {barCount} bars in this song.
          </p>

          <div className="row song-looper__builder">
            {scoreInfo.markers.length > 0 ? (
              <div className="control">
                <label htmlFor="song-marker">From marker</label>
                <select
                  id="song-marker"
                  value=""
                  onChange={(e) => {
                    if (e.target.value !== '') applyMarker(Number(e.target.value))
                    e.target.value = ''
                  }}
                >
                  <option value="">Choose…</option>
                  {scoreInfo.markers.map((m, i) => (
                    <option key={`${m.bar}-${i}`} value={i}>
                      {m.text} (bar {m.bar})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="control song-looper__bar">
              <label htmlFor="song-bar-start">From bar</label>
              <input
                id="song-bar-start"
                type="number"
                min={1}
                max={barCount}
                value={barStart}
                onChange={(e) => setBarStart(clampBar(Number(e.target.value)))}
              />
            </div>
            <div className="control song-looper__bar">
              <label htmlFor="song-bar-end">To bar</label>
              <input
                id="song-bar-end"
                type="number"
                min={1}
                max={barCount}
                value={barEnd}
                onChange={(e) => setBarEnd(clampBar(Number(e.target.value)))}
              />
            </div>
            <div className="control song-looper__name">
              <label htmlFor="song-sec-name">Name</label>
              <input
                id="song-sec-name"
                type="text"
                placeholder={`Bars ${clampBar(barStart)}–${Math.max(
                  clampBar(barStart),
                  clampBar(barEnd),
                )}`}
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
              />
            </div>
            <button type="button" className="btn btn-primary song-looper__add" onClick={handleAddSection}>
              Save section
            </button>
          </div>

          {loopNote ? (
            <p className="muted song-looper__loop-note" role="status">
              {loopNote}
            </p>
          ) : null}

          {songSections.length === 0 ? (
            <p className="muted">
              No saved sections yet. Pick a bar range above and save it.
            </p>
          ) : (
            <ul className="song-looper__sections">
              {songSections.map((sec) => (
                <li
                  key={sec.id}
                  className={
                    'song-looper__section' +
                    (sec.id === activeLoopId ? ' is-looping' : '')
                  }
                >
                  <div className="song-looper__section-info">
                    <span className="song-looper__section-name">{sec.name}</span>
                    <span className="muted mono">
                      bars {sec.barStart}–{sec.barEnd}
                      {sec.id === activeLoopId ? ' · looping ↺' : ''}
                    </span>
                  </div>
                  <div className="row song-looper__section-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!ready}
                      onClick={() => loopSection(sec.id, sec.barStart, sec.barEnd)}
                    >
                      ↺ Loop
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        if (sec.id === activeLoopId) stopPlayback()
                        removeSection(sec.id)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
