import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import * as alphaTab from '@coderline/alphatab'
// Load Bravura + the soundfont through Vite's asset pipeline so the URLs stay
// correct under `base: './'` (the alphaTab-vite plugin only wires the workers).
import soundFontUrl from '@coderline/alphatab/soundfont/sonivox.sf3?url'
import bravuraWoff2 from '@coderline/alphatab/font/Bravura.woff2?url'
import bravuraWoff from '@coderline/alphatab/font/Bravura.woff?url'
import './AlphaTabViewer.css'

export interface TrackInfo {
  index: number
  name: string
  /** GM program 32–39 → bass. */
  isBass: boolean
  isPercussion: boolean
}

export interface ScoreInfo {
  title: string
  /** Total number of bars (master bars) in the song. */
  barCount: number
  tracks: TrackInfo[]
  /** Section/rehearsal markers, with their 1-based bar number. */
  markers: { bar: number; text: string }[]
}

/** Imperative controls the parent drives on the viewer. */
export interface AlphaTabHandle {
  playPause(): void
  stop(): void
  setSpeed(speed: number): void
  /**
   * Loop bars [startBar..endBar] (1-based, inclusive) and start playing.
   * Returns false if the engine isn't ready to resolve the bar range yet (e.g.
   * the tick cache is still rebuilding right after a track switch), so the
   * caller can avoid showing a "looping" state for playback that didn't start.
   */
  loopBars(startBar: number, endBar: number): boolean
  clearLoop(): void
  /** Mute/unmute one track's audio (playback always covers the whole score). */
  setTrackMute(trackIndex: number, muted: boolean): void
  /** Solo/unsolo one track (alphaTab silences non-soloed tracks). */
  setTrackSolo(trackIndex: number, solo: boolean): void
  /** Turn the metronome click on/off during playback. */
  setMetronome(on: boolean): void
}

interface Props {
  /** Raw Guitar Pro file bytes. */
  data: ArrayBuffer
  /** Which track to render (null = leave default until chosen). */
  trackIndex: number | null
  onScoreLoaded: (info: ScoreInfo) => void
  onReadyChange: (ready: boolean) => void
  onPlayingChange: (playing: boolean) => void
  onError: (message: string) => void
}

const AlphaTabViewer = forwardRef<AlphaTabHandle, Props>(function AlphaTabViewer(
  { data, trackIndex, onScoreLoaded, onReadyChange, onPlayingChange, onError },
  ref,
) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null)
  const scoreRef = useRef<alphaTab.model.Score | null>(null)

  const trackIndexRef = useRef(trackIndex)
  trackIndexRef.current = trackIndex

  // Keep the latest callbacks in a ref so the api is created exactly once.
  const cbRef = useRef({ onScoreLoaded, onReadyChange, onPlayingChange, onError })
  cbRef.current = { onScoreLoaded, onReadyChange, onPlayingChange, onError }

  const renderSelected = () => {
    const api = apiRef.current
    const score = scoreRef.current
    const idx = trackIndexRef.current
    if (!api || !score || idx == null) return
    const track = score.tracks[idx]
    if (track) api.renderTracks([track])
  }

  // Create the alphaTab api once.
  useEffect(() => {
    if (!mainRef.current) return

    const settings = new alphaTab.Settings()
    settings.core.smuflFontSources = new Map([
      [alphaTab.FontFileFormat.Woff2, bravuraWoff2],
      [alphaTab.FontFileFormat.Woff, bravuraWoff],
    ])
    settings.player.enablePlayer = true
    settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer
    settings.player.soundFont = soundFontUrl
    settings.player.enableCursor = true
    settings.player.scrollElement = viewportRef.current ?? mainRef.current

    const api = new alphaTab.AlphaTabApi(mainRef.current, settings)
    apiRef.current = api

    api.scoreLoaded.on((score) => {
      scoreRef.current = score
      const tracks: TrackInfo[] = score.tracks.map((t) => ({
        index: t.index,
        name: t.name?.trim() || `Track ${t.index + 1}`,
        isBass: t.playbackInfo.program >= 32 && t.playbackInfo.program <= 39,
        isPercussion: t.isPercussion,
      }))
      const markers: { bar: number; text: string }[] = []
      score.masterBars.forEach((mb, i) => {
        const label = mb.section?.text?.trim() || mb.section?.marker?.trim()
        if (label) markers.push({ bar: i + 1, text: label })
      })
      cbRef.current.onScoreLoaded({
        title: score.title?.trim() || '',
        barCount: score.masterBars.length,
        tracks,
        markers,
      })
      renderSelected()
    })

    api.playerReady.on(() => cbRef.current.onReadyChange(true))
    api.playerStateChanged.on((args) =>
      cbRef.current.onPlayingChange(args.state === alphaTab.synth.PlayerState.Playing),
    )
    api.error.on((err) =>
      cbRef.current.onError(err?.message || 'alphaTab ran into an error.'),
    )

    return () => {
      try {
        api.destroy()
      } catch {
        /* already torn down */
      }
      apiRef.current = null
      scoreRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load the file bytes (once per mount; the parent keys this component by song
  // id, so a different song remounts with a fresh api).
  useEffect(() => {
    const api = apiRef.current
    if (!api) return
    cbRef.current.onReadyChange(false)
    try {
      api.load(new Uint8Array(data))
    } catch {
      cbRef.current.onError('Could not read that Guitar Pro file.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // Re-render when the chosen track changes.
  useEffect(() => {
    renderSelected()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIndex])

  useImperativeHandle(ref, () => ({
    playPause() {
      apiRef.current?.playPause()
    },
    stop() {
      apiRef.current?.stop()
    },
    setSpeed(speed: number) {
      const api = apiRef.current
      if (api) api.playbackSpeed = speed
    },
    loopBars(startBar: number, endBar: number): boolean {
      const api = apiRef.current
      const score = scoreRef.current
      const cache = api?.tickCache
      if (!api || !score || !cache) return false
      const n = score.masterBars.length
      if (n === 0) return false
      const i = Math.min(Math.max(startBar - 1, 0), n - 1)
      const j = Math.min(Math.max(endBar - 1, i), n - 1)
      const startTick = cache.getMasterBar(score.masterBars[i]).start
      const endTick = cache.getMasterBar(score.masterBars[j]).end
      api.playbackRange = { startTick, endTick }
      api.isLooping = true
      api.tickPosition = startTick
      api.play()
      return true
    },
    clearLoop() {
      const api = apiRef.current
      if (!api) return
      api.isLooping = false
      api.playbackRange = null
    },
    setTrackMute(trackIndex: number, muted: boolean) {
      const api = apiRef.current
      const track = scoreRef.current?.tracks[trackIndex]
      if (api && track) api.changeTrackMute([track], muted)
    },
    setTrackSolo(trackIndex: number, solo: boolean) {
      const api = apiRef.current
      const track = scoreRef.current?.tracks[trackIndex]
      if (api && track) api.changeTrackSolo([track], solo)
    },
    setMetronome(on: boolean) {
      const api = apiRef.current
      if (api) api.metronomeVolume = on ? 1 : 0
    },
  }))

  return (
    <div className="atv-viewport" ref={viewportRef}>
      <div className="atv-main" ref={mainRef} />
    </div>
  )
})

export default AlphaTabViewer
