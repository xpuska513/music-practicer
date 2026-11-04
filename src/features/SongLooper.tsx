import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useSongLibrary, getSongData } from '../songs/songStore'
import type { SongMeta } from '../songs/songStore'
import { useSongSections } from '../songs/useSongSections'
import type { SongSection } from '../songs/useSongSections'
import { DEFAULT_MIX, removeSongExtras, useSongExtras, withSyncPoint } from '../songs/useSongExtras'
import type { PlaybackSource, SongVideo, SyncPoint, TrackMix } from '../songs/useSongExtras'
import AlphaTabViewer from '../songs/AlphaTabViewer'
import type { AlphaTabHandle, ExternalMedia, ScoreInfo, TrackInfo } from '../songs/AlphaTabViewer'
import VideoPane from '../songs/VideoPane'
import { formatMs, parseYouTubeUrl } from '../songs/youtube'
import { clickReady, installClickUnlock, primeClick } from '../songs/click'
import Sheet from '../components/Sheet'
import { usePersistentState } from '../lib/usePersistentState'
import { useMediaQuery } from '../lib/useMediaQuery'
import './SongLooper.css'

const MIN_SPEED = 25
const MAX_SPEED = 125
const SPEED_STEP = 5
const isSpeed = (v: unknown): v is number =>
  typeof v === 'number' && v >= MIN_SPEED && v <= MAX_SPEED
const isStr = (v: unknown): v is string => typeof v === 'string'
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isClickLevel = (v: unknown): v is number => typeof v === 'number' && v >= 0 && v <= 1.5

/** iOS ignores programmatic media volume (the device buttons rule). */
const IS_IOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

const GP_EXT = /\.(gp|gp[345x])$/i

type SheetId = 'library' | 'mixer' | 'loops' | 'video'

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

const trackIcon = (t: TrackInfo) => (t.isPercussion ? '🥁' : t.isBass ? '𝄢' : '🎸')

/** Crisp transport glyphs (text ▶ / ❚❚ / ■ render inconsistently across fonts). */
function TransportIcon({ kind }: { kind: 'play' | 'pause' | 'stop' }) {
  return (
    <svg className="songs-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      {kind === 'play' ? (
        <path d="M4 2.5v11a.6.6 0 0 0 .9.5l8.6-5.5a.6.6 0 0 0 0-1L4.9 2a.6.6 0 0 0-.9.5z" />
      ) : kind === 'pause' ? (
        <>
          <rect x="3.5" y="2.5" width="3" height="11" rx="0.8" />
          <rect x="9.5" y="2.5" width="3" height="11" rx="0.8" />
        </>
      ) : (
        <rect x="3" y="3" width="10" height="10" rx="1.2" />
      )}
    </svg>
  )
}

/**
 * Size the score (and the side column) to fill the screen down to the sticky
 * transport, on any device: writes `--score-h` / `--side-h` onto `layout`.
 */
function useFillHeight(
  layout: RefObject<HTMLElement>,
  score: RefObject<HTMLElement>,
  side: RefObject<HTMLElement>,
  bar: RefObject<HTMLElement>,
  active: boolean,
): void {
  useLayoutEffect(() => {
    const host = layout.current
    const foot = bar.current
    if (!active || !host || !foot) return
    // Room from the element's top (in the document) down to the transport.
    const room = (el: HTMLElement | null) =>
      el ? window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - foot.offsetHeight - 12 : 0
    const fit = () => {
      // Measure from the score itself (a banner may sit above it).
      const viewport = score.current?.querySelector<HTMLElement>('.atv-viewport') ?? score.current
      host.style.setProperty('--score-h', `${Math.max(260, Math.round(room(viewport)))}px`)
      if (side.current) host.style.setProperty('--side-h', `${Math.max(200, Math.round(room(side.current)))}px`)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(foot)
    ro.observe(document.body)
    window.addEventListener('resize', fit)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [layout, score, side, bar, active])
}

/** Re-render every `ms` while `on` (for live readouts like the video time). */
function useTicker(on: boolean, ms = 200): void {
  const [, setN] = useState(0)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setN((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [on, ms])
}

export default function SongLooper() {
  const { songs, loading, error: libError, importFile, remove } = useSongLibrary()
  const { sections, addSection, removeSection, removeBySong } = useSongSections()

  const [activeSongId, setActiveSongId] = usePersistentState<string>('songs:active', '', isStr)
  const [speed, setSpeed] = usePersistentState<number>('songs:speed', 100, isSpeed)
  const [metronomeOn, setMetronomeOn] = usePersistentState<boolean>('songs:metro', false, isBool)
  const [clickVolume, setClickVolume] = usePersistentState<number>('songs:clickVol', 1, isClickLevel)

  const wide = useMediaQuery('(min-width: 960px)')
  const { extras, setVideo, setSync, setSource, setTrackMix, setMeta, setVideoVolume } =
    useSongExtras(activeSongId)
  const video = extras.video ?? null
  const source: PlaybackSource = video && extras.source !== 'synth' ? 'video' : 'synth'
  const mix = extras.mix ?? {}
  const videoVolume = extras.videoVolume ?? 1

  const [media, setMedia] = useState<ExternalMedia | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)

  const [bytes, setBytes] = useState<ArrayBuffer | null>(null)
  const [bytesLoading, setBytesLoading] = useState(false)
  const [scoreInfo, setScoreInfo] = useState<ScoreInfo | null>(null)
  const [trackIndex, setTrackIndex] = useState<number | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [activeLoopId, setActiveLoopId] = useState<string | null>(null)
  const [loopNote, setLoopNote] = useState<string | null>(null)
  const [currentBar, setCurrentBar] = useState(1)
  const [sheet, setSheet] = useState<SheetId | null>(null)
  /** Waiting for a tap on the score to sync that bar to the video's time. */
  const [picking, setPicking] = useState(false)
  const [dragging, setDragging] = useState(false)

  const viewerRef = useRef<AlphaTabHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const layoutRef = useRef<HTMLDivElement>(null)
  const scoreRef = useRef<HTMLDivElement>(null)
  const sideRef = useRef<HTMLElement>(null)
  const transportRef = useRef<HTMLDivElement>(null)

  const activeSong = useMemo(
    () => songs.find((s) => s.id === activeSongId) ?? null,
    [songs, activeSongId],
  )
  useFillHeight(layoutRef, scoreRef, sideRef, transportRef, !!activeSong)
  useEffect(() => installClickUnlock(), [])
  // While the video plays with the click on, keep an eye on whether the
  // browser actually lets it sound (iOS needs a tap first).
  const watchClick = metronomeOn && playing && source === 'video'
  useTicker(watchClick, 500)
  const clickBlocked = watchClick && !clickReady()

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

  /** Fresh engine state (the viewer remounts per song and per source). */
  const resetPlayback = useCallback(() => {
    setReady(false)
    setPlaying(false)
    setActiveLoopId(null)
    setLoopNote(null)
    setCurrentBar(1)
  }, [])

  const openSong = useCallback(
    (id: string) => {
      setActiveSongId(id)
      setScoreInfo(null)
      setTrackIndex(null)
      setViewerError(null)
      setVideoError(null)
      setMedia(null)
      resetPlayback()
      setSheet(null)
    },
    [setActiveSongId, resetPlayback],
  )

  const handleImport = useCallback(
    async (files: FileList | File[] | null | undefined) => {
      const list = Array.from(files ?? []).filter((f) => GP_EXT.test(f.name))
      let last: SongMeta | null = null
      for (const file of list) {
        // Re-importing the same export just opens the copy we already have.
        const dup = songs.find((s) => s.name === file.name && s.size === file.size)
        last = dup ?? (await importFile(file))
      }
      if (last) openSong(last.id)
    },
    [songs, importFile, openSong],
  )

  const handleDeleteSong = useCallback(
    (id: string) => {
      removeBySong(id)
      removeSongExtras(id)
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
        cur != null && info.tracks.some((t) => t.index === cur) ? cur : defaultTrack(info),
      )
      if (info.title || info.artist) setMeta(info.title, info.artist)
    },
    [setMeta],
  )

  // ── Mixer: persisted per song, pushed into each fresh engine when ready ──
  useEffect(() => {
    if (!ready || !scoreInfo || source !== 'synth') return
    for (const t of scoreInfo.tracks) {
      const m = mix[t.index]
      if (!m) continue
      viewerRef.current?.setTrackVolume(t.index, m.volume)
      if (m.muted) viewerRef.current?.setTrackMute(t.index, true)
      if (m.solo) viewerRef.current?.setTrackSolo(t.index, true)
    }
    // Only on a fresh engine; edits below push their own changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, scoreInfo, source])

  const changeMix = useCallback(
    (ti: number, patch: Partial<TrackMix>) => {
      const v = viewerRef.current
      if (patch.volume !== undefined) v?.setTrackVolume(ti, patch.volume)
      if (patch.muted !== undefined) v?.setTrackMute(ti, patch.muted)
      if (patch.solo !== undefined) v?.setTrackSolo(ti, patch.solo)
      setTrackMix(ti, patch)
    },
    [setTrackMix],
  )

  const changeSpeed = useCallback(
    (value: number) => {
      const next = Math.min(MAX_SPEED, Math.max(MIN_SPEED, value))
      setSpeed(next)
      viewerRef.current?.setSpeed(next / 100)
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
  useEffect(() => {
    if (ready) viewerRef.current?.setClickVolume(clickVolume)
  }, [ready, clickVolume])
  // The video's level (remembered per song).
  useEffect(() => {
    media?.setVolume(videoVolume)
  }, [media, videoVolume])

  const switchSource = useCallback(
    (next: PlaybackSource) => {
      if (next === source) return
      viewerRef.current?.stop()
      resetPlayback()
      setSource(next)
    },
    [source, resetPlayback, setSource],
  )

  const loopSection = useCallback((sec: SongSection) => {
    primeClick()
    const started = viewerRef.current?.loopBars(sec.barStart, sec.barEnd) ?? false
    if (started) {
      setActiveLoopId(sec.id)
      setLoopNote(null)
    } else {
      // Engine not ready to resolve the bar range yet; don't pretend to loop.
      setActiveLoopId(null)
      setLoopNote('Still preparing playback — tap Loop again in a moment.')
    }
  }, [])

  const clearLoop = useCallback(() => {
    viewerRef.current?.clearLoop()
    setActiveLoopId(null)
  }, [])

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
  const activeLoop = songSections.find((s) => s.id === activeLoopId) ?? null

  const canPlay = ready && (source === 'synth' || media != null)
  const status = viewerError
    ? ''
    : bytesLoading
      ? 'Reading file…'
      : !scoreInfo
        ? 'Parsing…'
        : source === 'video' && !media
          ? 'Loading video…'
          : ready
            ? ''
            : source === 'synth'
              ? 'Loading sounds…'
              : 'Preparing…'

  const title = scoreInfo?.title || extras.title || activeSong?.name || ''
  const artist = scoreInfo?.artist || extras.artist || ''

  // ── Panels (side column on wide screens, sheets on phones) ──
  const mixerPanel = scoreInfo ? (
    <Mixer
      tracks={scoreInfo.tracks}
      viewing={trackIndex}
      onView={setTrackIndex}
      mix={mix}
      onMix={changeMix}
      disabled={!ready}
      videoMode={source === 'video'}
      videoVolume={videoVolume}
      onVideoVolume={setVideoVolume}
      clickVolume={clickVolume}
      onClickVolume={setClickVolume}
    />
  ) : (
    <p className="muted">Load a song to see its tracks.</p>
  )

  const loopsPanel = scoreInfo ? (
    <Loops
      info={scoreInfo}
      sections={songSections}
      activeLoopId={activeLoopId}
      ready={canPlay}
      note={loopNote}
      onSave={(sec) =>
        activeSong &&
        trackIndex != null &&
        addSection({
          ...sec,
          songId: activeSong.id,
          trackIndex,
          trackName: scoreInfo.tracks.find((t) => t.index === trackIndex)?.name ?? '',
        })
      }
      onLoop={loopSection}
      onDelete={(sec) => {
        if (sec.id === activeLoopId) stopPlayback()
        removeSection(sec.id)
      }}
    />
  ) : null

  const pickBar = useCallback(
    (bar: number) => {
      if (!video || !media) return
      setSync(withSyncPoint(video.sync, bar, media.currentTimeMs()))
      setPicking(false)
    },
    [video, media, setSync],
  )
  const viewingTrack = scoreInfo?.tracks.find((t) => t.index === trackIndex) ?? null

  const videoPanel = activeSong ? (
    <VideoSettings
      video={video}
      source={source}
      media={media}
      error={videoError}
      barCount={scoreInfo?.barCount ?? 1}
      currentBar={currentBar}
      track={viewingTrack}
      picking={picking}
      onPick={() => {
        setPicking((p) => !p)
        setSheet(null) // phones: get the sheet out of the way of the score
      }}
      onAttach={(v) => {
        setVideoError(null)
        setMedia(null)
        viewerRef.current?.stop()
        resetPlayback()
        setVideo(v)
      }}
      onRemove={() => {
        viewerRef.current?.stop()
        resetPlayback()
        setMedia(null)
        setVideoError(null)
        setVideo(null)
      }}
      onSync={setSync}
      onSource={switchSource}
    />
  ) : null

  const library = (
    <Library
      songs={songs}
      loading={loading}
      activeId={activeSongId}
      titleOf={(s) => s.name}
      onOpen={openSong}
      onDelete={handleDeleteSong}
      onImport={() => fileInputRef.current?.click()}
    />
  )

  return (
    <div
      className={'songs' + (dragging ? ' is-dragging' : '')}
      onDragOver={(e) => {
        if (!Array.from(e.dataTransfer.types).includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        void handleImport(e.dataTransfer.files)
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".gp,.gp3,.gp4,.gp5,.gpx"
        className="songs__file"
        onChange={(e) => {
          void handleImport(e.target.files)
          e.target.value = ''
        }}
      />

      {libError ? <p className="songs__err" role="alert">{libError}</p> : null}

      {!activeSong ? (
        <section className="panel col songs-empty">
          <div className="row songs-empty__head">
            <div>
              <h3 className="songs__h">🎼 Songs</h3>
              <p className="muted songs__sub">
                Import a Guitar Pro file (e.g. a Songsterr export), pick the guitar or bass
                track, loop sections — or attach the YouTube video and play along to the real
                recording. You can also drop files here.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
              + Import file
            </button>
          </div>
          {songs.length > 0 || loading ? library : null}
        </section>
      ) : (
        <>
          {/* ── Song bar ───────────────────────────────────────────────── */}
          <div className="songs-bar">
            <button type="button" className="songs-bar__pick" onClick={() => setSheet('library')}>
              <span className="songs-bar__text">
                <span className="songs-bar__title">{title}</span>
                {artist ? <span className="songs-bar__artist">{artist}</span> : null}
              </span>
              <span className="songs-bar__chev" aria-hidden="true">▾</span>
            </button>
            {status ? <span className="muted songs-bar__status">{status}</span> : null}
            <button type="button" className="btn songs-bar__import" onClick={() => fileInputRef.current?.click()}>
              + Import
            </button>
          </div>

          {viewerError ? <p className="songs__err" role="alert">{viewerError}</p> : null}

          {/* ── Score (+ video / side panel) ──────────────────────────── */}
          <div ref={layoutRef} className={'songs-layout' + (source === 'video' ? ' has-video' : '')}>
            {source === 'video' && video ? (
              <div className="songs-video">
                <VideoPane
                  key={video.id}
                  videoId={video.id}
                  onMedia={setMedia}
                  onError={setVideoError}
                />
              </div>
            ) : null}

            <div ref={scoreRef} className="songs-score">
              {picking ? (
                <div className="songs-pick" role="status">
                  <span>
                    Tap the bar the video is at — pause right on its first beat
                    {media ? <span className="mono"> ({formatMs(media.currentTimeMs())})</span> : null}.
                  </span>
                  <button type="button" className="btn" onClick={() => setPicking(false)}>
                    Cancel
                  </button>
                </div>
              ) : null}
              {bytes ? (
                <AlphaTabViewer
                  key={`${activeSong.id}:${source}`}
                  ref={viewerRef}
                  data={bytes}
                  trackIndex={trackIndex}
                  source={source}
                  media={media}
                  syncPoints={video?.sync ?? []}
                  onScoreLoaded={onScoreLoaded}
                  onReadyChange={setReady}
                  onPlayingChange={setPlaying}
                  onError={setViewerError}
                  onBarChange={setCurrentBar}
                  onPickBar={picking && source === 'video' && media ? pickBar : null}
                />
              ) : (
                <div className="songs-score__placeholder muted">{status || ' '}</div>
              )}
            </div>

            {wide ? (
              <aside ref={sideRef} className="songs-side">
                <section className="songs-card">
                  <h4 className="songs-card__h">Video</h4>
                  {videoPanel}
                </section>
                <section className="songs-card">
                  <h4 className="songs-card__h">Mixer</h4>
                  {mixerPanel}
                </section>
                <section className="songs-card">
                  <h4 className="songs-card__h">Loop sections</h4>
                  {loopsPanel}
                </section>
              </aside>
            ) : null}
          </div>

          {/* ── Transport (sticky) ────────────────────────────────────── */}
          <div ref={transportRef} className="songs-transport" role="toolbar" aria-label="Playback">
            <div className="songs-transport__group">
              <button
                type="button"
                className={`btn songs-transport__play ${playing ? '' : 'btn-primary'}`}
                disabled={!canPlay}
                onClick={() => {
                  primeClick()
                  viewerRef.current?.playPause()
                }}
                aria-label={playing ? 'Pause' : 'Play'}
              >
                <TransportIcon kind={playing ? 'pause' : 'play'} />
              </button>
              <button type="button" className="btn songs-transport__stop" disabled={!canPlay} onClick={stopPlayback} aria-label="Stop">
                <TransportIcon kind="stop" />
              </button>
              <button
                type="button"
                className={`btn songs-transport__metro ${metronomeOn ? 'is-on' : ''}`}
                aria-pressed={metronomeOn}
                onClick={() => {
                  primeClick()
                  setMetronomeOn((v) => !v)
                }}
                title="Metronome click"
              >
                🎵<span className="songs-transport__label"> Click</span>
              </button>
              <div className="songs-speed" role="group" aria-label="Speed">
                <button type="button" className="btn" onClick={() => changeSpeed(speed - SPEED_STEP)} disabled={speed <= MIN_SPEED} aria-label="Slower">
                  −
                </button>
                <button
                  type="button"
                  className="btn songs-speed__value mono"
                  onClick={() => changeSpeed(100)}
                  title="Reset to 100%"
                >
                  {speed}%
                </button>
                <button type="button" className="btn" onClick={() => changeSpeed(speed + SPEED_STEP)} disabled={speed >= MAX_SPEED} aria-label="Faster">
                  +
                </button>
              </div>
            </div>

            <div className="songs-transport__group">
              {clickBlocked ? (
                <button type="button" className="btn songs-transport__unmute" onClick={primeClick}>
                  🔇 Tap to enable the click
                </button>
              ) : null}
              {activeLoop ? (
                <span className="songs-transport__loop">
                  ↺ {activeLoop.name}
                  <button type="button" onClick={clearLoop} aria-label="Stop looping">
                    ✕
                  </button>
                </span>
              ) : null}
              {video ? (
                <div className="songs-source" role="group" aria-label="Sound source">
                  <button type="button" className="chip" aria-pressed={source === 'synth'} onClick={() => switchSource('synth')}>
                    Synth
                  </button>
                  <button type="button" className="chip" aria-pressed={source === 'video'} onClick={() => switchSource('video')}>
                    Video
                  </button>
                </div>
              ) : null}
              {!wide ? (
                <>
                  <button type="button" className="btn songs-transport__sheet" onClick={() => setSheet('mixer')}>
                    Mixer
                  </button>
                  <button type="button" className="btn songs-transport__sheet" onClick={() => setSheet('loops')}>
                    Loops{songSections.length ? ` · ${songSections.length}` : ''}
                  </button>
                  <button type="button" className="btn songs-transport__sheet" onClick={() => setSheet('video')}>
                    {video ? 'Sync' : 'Video'}
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <Sheet open={sheet === 'library'} title="Your songs" onClose={() => setSheet(null)}>
            {library}
          </Sheet>
          <Sheet open={sheet === 'mixer'} title="Mixer" onClose={() => setSheet(null)}>
            {mixerPanel}
          </Sheet>
          <Sheet open={sheet === 'loops'} title="Loop sections" onClose={() => setSheet(null)}>
            {loopsPanel}
          </Sheet>
          <Sheet open={sheet === 'video'} title={video ? 'Video sync' : 'Video'} onClose={() => setSheet(null)}>
            {videoPanel}
          </Sheet>
        </>
      )}

      {dragging ? <div className="songs__drop" aria-hidden="true">Drop Guitar Pro files to import</div> : null}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */

function Library({
  songs,
  loading,
  activeId,
  titleOf,
  onOpen,
  onDelete,
  onImport,
}: {
  songs: SongMeta[]
  loading: boolean
  activeId: string
  titleOf: (s: SongMeta) => string
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onImport: () => void
}) {
  if (loading) return <p className="muted">Loading your library…</p>
  return (
    <div className="col songs-lib">
      <ul className="songs-lib__list">
        {songs.map((s) => (
          <li key={s.id} className={'songs-lib__item' + (s.id === activeId ? ' is-active' : '')}>
            <button type="button" className="songs-lib__open" onClick={() => onOpen(s.id)}>
              <SongLabel song={s} fallback={titleOf(s)} />
            </button>
            <button
              type="button"
              className="songs-lib__del"
              onClick={() => onDelete(s.id)}
              aria-label={`Delete ${s.name}`}
              title="Remove from library"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn" onClick={onImport}>
        + Import Guitar Pro file
      </button>
    </div>
  )
}

/** Title / artist from the score once a song has been opened, else the file name. */
function SongLabel({ song, fallback }: { song: SongMeta; fallback: string }) {
  const { extras } = useSongExtras(song.id)
  return (
    <>
      <span className="songs-lib__name">{extras.title || fallback}</span>
      <span className="muted songs-lib__meta">
        {extras.artist ? `${extras.artist} · ` : ''}
        {formatBytes(song.size)}
        {extras.video ? ' · ▶ video' : ''}
      </span>
    </>
  )
}

/** One labelled level slider (video / click). */
function LevelRow({
  icon,
  label,
  value,
  max,
  onChange,
}: {
  icon: string
  label: string
  value: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <label className="mixer__level">
      <span className="mixer__level-name">
        <span aria-hidden="true">{icon}</span> {label}
      </span>
      <input
        type="range"
        className="mixer__vol"
        min={0}
        max={Math.round(max * 100)}
        step={1}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <span className="mixer__pct mono" aria-hidden="true">
        {Math.round(value * 100)}
      </span>
    </label>
  )
}

function Mixer({
  tracks,
  viewing,
  onView,
  mix,
  onMix,
  disabled,
  videoMode,
  videoVolume,
  onVideoVolume,
  clickVolume,
  onClickVolume,
}: {
  tracks: TrackInfo[]
  viewing: number | null
  onView: (index: number) => void
  mix: Record<number, TrackMix>
  onMix: (index: number, patch: Partial<TrackMix>) => void
  disabled: boolean
  videoMode: boolean
  videoVolume: number
  onVideoVolume: (volume: number) => void
  clickVolume: number
  onClickVolume: (volume: number) => void
}) {
  return (
    <div className="col mixer">
      <div className="mixer__levels">
        {videoMode && !IS_IOS ? (
          <LevelRow icon="🎬" label="Video" value={videoVolume} max={1} onChange={onVideoVolume} />
        ) : null}
        <LevelRow icon="🎵" label="Click" value={clickVolume} max={1.5} onChange={onClickVolume} />
        {videoMode && IS_IOS ? (
          <p className="muted mixer__note">
            On iPhone / iPad the video follows the device volume — turn that down and use Click to
            balance.
          </p>
        ) : null}
      </div>
      {videoMode ? (
        <p className="muted mixer__note">
          Pick which track’s tab to follow — switch to Synth to mix the tracks themselves.
        </p>
      ) : null}
      <ul className="mixer__list">
        {tracks.map((t) => {
          const m = mix[t.index] ?? DEFAULT_MIX
          const isViewing = t.index === viewing
          return (
            <li key={t.index} className={'mixer__row' + (isViewing ? ' is-viewing' : '')}>
              <button
                type="button"
                className="mixer__name"
                aria-pressed={isViewing}
                onClick={() => onView(t.index)}
                title="Show this track’s tab"
              >
                <span aria-hidden="true">{trackIcon(t)}</span>
                <span className="mixer__label">{t.name}</span>
                {isViewing ? <span className="mixer__badge">tab</span> : null}
              </button>
              {!videoMode ? (
                <div className="mixer__ctrls">
                  <input
                    type="range"
                    className="mixer__vol"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(m.volume * 100)}
                    disabled={disabled}
                    aria-label={`${t.name} volume`}
                    onChange={(e) => onMix(t.index, { volume: Number(e.target.value) / 100 })}
                  />
                  <span className="mixer__pct mono" aria-hidden="true">
                    {Math.round(m.volume * 100)}
                  </span>
                  <button
                    type="button"
                    className={'mixer__btn' + (m.muted ? ' is-muted' : '')}
                    aria-pressed={m.muted}
                    disabled={disabled}
                    onClick={() => onMix(t.index, { muted: !m.muted })}
                    title={m.muted ? 'Unmute' : 'Mute'}
                  >
                    M
                  </button>
                  <button
                    type="button"
                    className={'mixer__btn' + (m.solo ? ' is-solo' : '')}
                    aria-pressed={m.solo}
                    disabled={disabled}
                    onClick={() => onMix(t.index, { solo: !m.solo })}
                    title={m.solo ? 'Unsolo' : 'Solo (mute the rest)'}
                  >
                    S
                  </button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Loops({
  info,
  sections,
  activeLoopId,
  ready,
  note,
  onSave,
  onLoop,
  onDelete,
}: {
  info: ScoreInfo
  sections: SongSection[]
  activeLoopId: string | null
  ready: boolean
  note: string | null
  onSave: (sec: { name: string; barStart: number; barEnd: number }) => void
  onLoop: (sec: SongSection) => void
  onDelete: (sec: SongSection) => void
}) {
  const barCount = info.barCount
  const [barStart, setBarStart] = useState(1)
  const [barEnd, setBarEnd] = useState(barCount)
  const [name, setName] = useState('')
  const clampBar = (v: number) => Math.min(Math.max(1, Math.round(v) || 1), barCount)

  const applyMarker = (i: number) => {
    const m = info.markers[i]
    if (!m) return
    const next = info.markers[i + 1]
    setBarStart(m.bar)
    setBarEnd(next ? Math.max(m.bar, next.bar - 1) : barCount)
    setName(m.text)
  }

  const save = () => {
    const start = clampBar(barStart)
    const end = Math.max(start, clampBar(barEnd))
    onSave({ name: name.trim() || `Bars ${start}–${end}`, barStart: start, barEnd: end })
    setName('')
  }

  return (
    <div className="col loops">
      {sections.length === 0 ? (
        <p className="muted loops__empty">No saved sections yet — pick a bar range below.</p>
      ) : (
        <ul className="loops__list">
          {sections.map((sec) => {
            const active = sec.id === activeLoopId
            return (
              <li key={sec.id} className={'loops__item' + (active ? ' is-looping' : '')}>
                <button
                  type="button"
                  className="loops__play"
                  disabled={!ready}
                  onClick={() => onLoop(sec)}
                  title="Loop this section"
                >
                  <span className="loops__icon" aria-hidden="true">↺</span>
                  <span className="loops__name">{sec.name}</span>
                  <span className="muted mono loops__bars">
                    {sec.barStart}–{sec.barEnd}
                  </span>
                </button>
                <button type="button" className="loops__del" onClick={() => onDelete(sec)} aria-label={`Delete ${sec.name}`}>
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {note ? (
        <p className="muted loops__note" role="status">
          {note}
        </p>
      ) : null}

      <div className="loops__builder">
        {info.markers.length > 0 ? (
          <select
            aria-label="From marker"
            value=""
            onChange={(e) => {
              if (e.target.value !== '') applyMarker(Number(e.target.value))
              e.target.value = ''
            }}
          >
            <option value="">From marker…</option>
            {info.markers.map((m, i) => (
              <option key={`${m.bar}-${i}`} value={i}>
                {m.text} (bar {m.bar})
              </option>
            ))}
          </select>
        ) : null}
        <div className="loops__range">
          <label className="loops__field">
            <span className="muted">Bars</span>
            <input type="number" min={1} max={barCount} value={barStart} onChange={(e) => setBarStart(clampBar(Number(e.target.value)))} />
          </label>
          <span className="muted">–</span>
          <label className="loops__field">
            <span className="sr-only">to</span>
            <input type="number" min={1} max={barCount} value={barEnd} onChange={(e) => setBarEnd(clampBar(Number(e.target.value)))} />
          </label>
          <span className="muted loops__of">of {barCount}</span>
        </div>
        <input
          type="text"
          aria-label="Section name"
          placeholder={`Bars ${clampBar(barStart)}–${Math.max(clampBar(barStart), clampBar(barEnd))}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="button" className="btn btn-primary" onClick={save}>
          Save section
        </button>
      </div>
    </div>
  )
}

function VideoSettings({
  video,
  source,
  media,
  error,
  barCount,
  currentBar,
  track,
  picking,
  onPick,
  onAttach,
  onRemove,
  onSync,
  onSource,
}: {
  video: SongVideo | null
  source: PlaybackSource
  media: ExternalMedia | null
  error: string | null
  barCount: number
  currentBar: number
  /** The track whose tab is shown (to say where it starts playing). */
  track: TrackInfo | null
  picking: boolean
  onPick: () => void
  onAttach: (video: SongVideo) => void
  onRemove: () => void
  onSync: (sync: SyncPoint[]) => void
  onSource: (source: PlaybackSource) => void
}) {
  const [link, setLink] = useState('')
  const [bar, setBar] = useState('')
  const parsed = parseYouTubeUrl(link)
  useTicker(!!media && source === 'video')

  if (!video) {
    return (
      <form
        className="col vsync"
        onSubmit={(e) => {
          e.preventDefault()
          if (!parsed) return
          onAttach({ id: parsed.id, sync: parsed.startMs ? [{ bar: 1, ms: parsed.startMs }] : [] })
          setLink('')
        }}
      >
        <p className="muted vsync__hint">
          Attach the song’s YouTube video to play along to the real recording — the tab follows
          the video, and the click keeps time.
        </p>
        <div className="vsync__attach">
          <input
            type="text"
            inputMode="url"
            placeholder="Paste a YouTube link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            aria-label="YouTube link"
          />
          <button type="submit" className="btn btn-primary" disabled={!parsed}>
            Attach
          </button>
        </div>
        {link && !parsed ? <p className="songs__err">That doesn’t look like a YouTube link.</p> : null}
      </form>
    )
  }

  const points = video.sync.length ? video.sync : [{ bar: 1, ms: 0 }]
  const nowMs = media ? media.currentTimeMs() : 0
  const targetBar = Math.min(Math.max(1, Number(bar) || currentBar), barCount)
  const setPoint = (b: number, ms: number) => onSync(withSyncPoint(video.sync, b, ms))

  return (
    <div className="col vsync">
      {error ? <p className="songs__err" role="alert">{error}</p> : null}
      {source !== 'video' ? (
        <div className="row vsync__row">
          <p className="muted vsync__hint">Playing the synth. Switch to the video to play along.</p>
          <button type="button" className="btn btn-primary" onClick={() => onSource('video')}>
            Use video
          </button>
        </div>
      ) : (
        <>
          <p className="muted vsync__hint">
            Sync: pause the video right on a hit you can hear, then tap that bar in the tab. Sync
            where your part plays
            {track && track.firstBar > 1 ? (
              <>
                {' '}— <strong>{track.name}</strong> starts in <strong>bar {track.firstBar}</strong>,
                so bar 1 is silence for it
              </>
            ) : null}
            . Add another point further in if it drifts.
          </p>
          <button
            type="button"
            className={`btn ${picking ? '' : 'btn-primary'} vsync__pick`}
            disabled={!media}
            onClick={onPick}
          >
            {picking ? 'Cancel picking' : '🎯 Tap the bar in the tab'}
          </button>
          <ul className="vsync__list">
            {points.map((p) => (
              <li key={p.bar} className="vsync__point">
                <span className="vsync__bar">Bar {p.bar}</span>
                <span className="mono vsync__time">{formatMs(p.ms)}</span>
                <button type="button" className="btn vsync__nudge" onClick={() => setPoint(p.bar, p.ms - 50)} title="50 ms earlier">
                  −
                </button>
                <button type="button" className="btn vsync__nudge" onClick={() => setPoint(p.bar, p.ms + 50)} title="50 ms later">
                  +
                </button>
                <button
                  type="button"
                  className="btn vsync__nudge"
                  onClick={() => media?.seekToMs(p.ms)}
                  disabled={!media}
                  title="Jump the video here"
                >
                  ⤺
                </button>
                {points.length > 1 ? (
                  <button
                    type="button"
                    className="vsync__del"
                    onClick={() => onSync(points.filter((q) => q.bar !== p.bar))}
                    aria-label={`Remove sync point for bar ${p.bar}`}
                  >
                    ✕
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="vsync__add">
            <label className="vsync__field">
              <span className="muted">Bar</span>
              <input
                type="number"
                min={1}
                max={barCount}
                placeholder={String(currentBar)}
                value={bar}
                onChange={(e) => setBar(e.target.value)}
              />
            </label>
            <button type="button" className="btn" disabled={!media} onClick={() => setPoint(targetBar, nowMs)}>
              starts now · <span className="mono">{formatMs(nowMs)}</span>
            </button>
          </div>
        </>
      )}
      <div className="row vsync__row">
        <a className="muted vsync__link" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer">
          Open on YouTube ↗
        </a>
        <button type="button" className="btn vsync__remove" onClick={onRemove}>
          Remove video
        </button>
      </div>
    </div>
  )
}
