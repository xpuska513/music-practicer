import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import * as alphaTab from '@coderline/alphatab'
// Load Bravura + the soundfont through Vite's asset pipeline so the URLs stay
// correct under `base: './'` (the alphaTab-vite plugin only wires the workers).
// FluidR3 GM (a real recorded General MIDI soundfont, MIT-licensed) instead of
// alphaTab's tiny default SONiVOX, so full-band playback sounds far less "MIDI".
// It's ~14 MB but lazy-loaded with this (already lazy) viewer, then cached.
import soundFontUrl from './assets/FluidR3Mono_GM.sf3?url'
import bravuraWoff2 from '@coderline/alphatab/font/Bravura.woff2?url'
import bravuraWoff from '@coderline/alphatab/font/Bravura.woff?url'
import { playClick, primeClick, setClickVolume } from './click'
import { clickTimes, lineUpBars, nearestIndex } from './beats/barMap'
import type { Click, PlayedBar } from './beats/barMap'
import type { PlaybackSource, SyncPoint } from './useSongExtras'
import './AlphaTabViewer.css'

export interface TrackInfo {
  index: number
  name: string
  /** GM program 32–39 → bass. */
  isBass: boolean
  isPercussion: boolean
  /** First bar (1-based) where this track actually plays a note. */
  firstBar: number
}

export interface ScoreInfo {
  title: string
  artist: string
  /** Total number of bars (master bars) in the song. */
  barCount: number
  tracks: TrackInfo[]
  /** Section/rehearsal markers, with their 1-based bar number. */
  markers: { bar: number; text: string }[]
}

/**
 * An external clock (a YouTube video or an audio file) that drives playback
 * in video / audio mode. alphaTab follows its position; the synth stays silent.
 */
export interface ExternalMedia {
  /** Current media position in ms. */
  currentTimeMs(): number
  durationMs(): number
  isPlaying(): boolean
  /** Actual playback rate (the player may round what it was asked for). */
  rate(): number
  play(): void
  pause(): void
  seekToMs(ms: number): void
  setRate(rate: number): void
  /** 0..1 */
  setVolume(volume: number): void
  /** Notified on play / pause / end (true = playing). */
  subscribe(listener: (playing: boolean) => void): () => void
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
  /** One track's mix volume, 0..1. */
  setTrackVolume(trackIndex: number, volume: number): void
  /** Turn the metronome click on/off during playback. */
  setMetronome(on: boolean): void
  /** Click level, 0..1.5. */
  setClickVolume(volume: number): void
  /** The bar (1-based) whose start is nearest the cursor — "the 1" a player
   *  just heard, even if the tab runs a little early or late. */
  nearestBar(): number | null
}

/** Beat and downbeat times (ms into the media) found by the beat finder. */
export interface BeatGrid {
  beats: number[]
  downbeats: number[]
}

interface FlatSync {
  barIndex: number
  barOccurence: number
  barPosition: number
  millisecondOffset: number
}

interface Props {
  /** Raw Guitar Pro file bytes. */
  data: ArrayBuffer
  /** Which track to render (null = leave default until chosen). */
  trackIndex: number | null
  /** 'video' / 'audio' = `media` is the clock and the audio; the synth is silent. */
  source: PlaybackSource
  media: ExternalMedia | null
  /**
   * The media's sync points ("bar N starts here"). Empty = bar 1 at 0:00. With
   * `beats`, they're anchors and every other bar is lined up with the beats.
   */
  syncPoints: SyncPoint[]
  /** Beats found in the media: line all bars up with them, click on them. */
  beats?: BeatGrid | null
  /** How many played bars the beats lined up (of how many). */
  onLinedUp?: (bars: number, total: number) => void
  onScoreLoaded: (info: ScoreInfo) => void
  onReadyChange: (ready: boolean) => void
  onPlayingChange: (playing: boolean) => void
  onError: (message: string) => void
  /** 1-based bar under the cursor. */
  onBarChange?: (bar: number) => void
  /** While set, a tap on the score reports its bar instead of seeking. */
  onPickBar?: ((bar: number) => void) | null
}

/** A media jump bigger than this (ms) is a user seek, not playback. */
const JUMP_MS = 400

const AlphaTabViewer = forwardRef<AlphaTabHandle, Props>(function AlphaTabViewer(
  {
    data,
    trackIndex,
    source,
    media,
    syncPoints,
    beats,
    onLinedUp,
    onScoreLoaded,
    onReadyChange,
    onPlayingChange,
    onError,
    onBarChange,
    onPickBar,
  },
  ref,
) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null)
  const scoreRef = useRef<alphaTab.model.Score | null>(null)

  const trackIndexRef = useRef(trackIndex)
  trackIndexRef.current = trackIndex
  const mediaRef = useRef(media)
  mediaRef.current = media
  const syncRef = useRef(syncPoints)
  syncRef.current = syncPoints
  const beatsRef = useRef(beats ?? null)
  beatsRef.current = beats ?? null
  /** With found beats: when to click (ms into the media), in order. */
  const clicksRef = useRef<{ ms: number[]; accent: boolean[] } | null>(null)
  /** Metronome on? (video / audio mode sounds it here; synth mode via alphaTab). */
  const clickOnRef = useRef(false)
  /** alphaTab echoes our own re-seeks back through handler.seekTo — ignore
   *  them until this time (performance.now()). */
  const ignoreSeekRef = useRef(0)
  const clickLevelRef = useRef(1)

  // Keep the latest callbacks in a ref so the api is created exactly once.
  const cbRef = useRef({ onScoreLoaded, onReadyChange, onPlayingChange, onError, onBarChange, onLinedUp })
  cbRef.current = { onScoreLoaded, onReadyChange, onPlayingChange, onError, onBarChange, onLinedUp }

  const isExternal = source !== 'synth'

  const renderSelected = () => {
    const api = apiRef.current
    const score = scoreRef.current
    const idx = trackIndexRef.current
    if (!api || !score || idx == null) return
    const track = score.tracks[idx]
    if (track) api.renderTracks([track])
  }

  /** The bars in playback order (repeats unrolled), once the MIDI exists. */
  const playedBars = (): PlayedBar[] | null => {
    const bars = apiRef.current?.tickCache?.masterBars
    if (!bars?.length) return null
    const seen = new Map<number, number>()
    return bars.map((b) => {
      const index = b.masterBar.index
      const occurrence = seen.get(index) ?? 0
      seen.set(index, occurrence + 1)
      // Its length at the score's tempo (quarter = 960 ticks).
      let ms = 0
      b.tempoChanges.forEach((c, i) => {
        const end = b.tempoChanges[i + 1]?.tick ?? b.end
        ms += ((end - c.tick) / 960) * (60000 / (c.tempo || 120))
      })
      return { bar: index + 1, occurrence, ms, beats: b.masterBar.timeSignatureNumerator }
    })
  }

  /** Every played bar's start, lined up with the beats from the anchors. */
  const linedUpSync = (): FlatSync[] => {
    const grid = beatsRef.current
    const played = grid ? playedBars() : null
    const setClicks = (clicks: Click[]) => {
      clicksRef.current = { ms: clicks.map((c) => c.ms), accent: clicks.map((c) => c.accent) }
    }
    if (!grid) clicksRef.current = null
    // Until the bars are known: the detected beats as they are.
    else if (!played) setClicks(grid.beats.map((ms) => ({ ms, accent: grid.downbeats.includes(ms) })))
    if (!grid || !played) return []
    const times = lineUpBars(played, grid.beats, grid.downbeats, syncRef.current)
    const points: FlatSync[] = []
    played.forEach((p, k) => {
      if (!Number.isFinite(times[k])) return
      points.push({ barIndex: p.bar - 1, barOccurence: p.occurrence, barPosition: 0, millisecondOffset: Math.round(times[k]) })
    })
    setClicks(clickTimes(played, times, grid.beats))
    cbRef.current.onLinedUp?.(points.length, played.length)
    return points
  }

  /** Push the sync points into the score model and the running player. */
  const applySync = (reloadPlayer: boolean) => {
    const api = apiRef.current
    const score = scoreRef.current
    if (!api || !score || !isExternal) return
    const bars = score.masterBars.length
    let points = linedUpSync()
    if (points.length === 0) {
      points = syncRef.current
        .filter((p) => p.bar <= bars)
        .map((p) => ({ barIndex: p.bar - 1, barOccurence: 0, barPosition: 0, millisecondOffset: p.ms }))
    }
    if (points.length === 0) points.push({ barIndex: 0, barOccurence: 0, barPosition: 0, millisecondOffset: 0 })
    score.applyFlatSyncPoints(points)
    if (!reloadPlayer) return
    const media = mediaRef.current
    const output = api.player?.output as alphaTab.synth.IExternalMediaSynthOutput | undefined
    if (!media || !output) {
      api.updateSyncPoints()
      return
    }
    // Re-syncing keeps the video where it is and moves the cursor (alphaTab
    // would otherwise keep the score position and jump the video).
    ignoreSeekRef.current = performance.now() + 300
    api.updateSyncPoints()
    output.updatePosition(media.currentTimeMs())
    api.timePosition = api.timePosition
  }

  // Create the alphaTab api once (the parent remounts us to switch source).
  useEffect(() => {
    if (!mainRef.current) return

    const settings = new alphaTab.Settings()
    settings.core.smuflFontSources = new Map([
      [alphaTab.FontFileFormat.Woff2, bravuraWoff2],
      [alphaTab.FontFileFormat.Woff, bravuraWoff],
    ])
    settings.player.enablePlayer = true
    if (isExternal) {
      // The media is the clock and the audio — no soundfont download needed.
      settings.player.playerMode = alphaTab.PlayerMode.EnabledExternalMedia
    } else {
      settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer
      settings.player.soundFont = soundFontUrl
    }
    settings.player.enableCursor = true
    settings.player.scrollElement = viewportRef.current ?? mainRef.current
    // Turn the page only when the cursor leaves the view (no jump on load, so
    // the title stays visible, and less motion to read against while playing).
    settings.player.scrollMode = alphaTab.ScrollMode.OffScreen
    // Tighter engraving on phones so a couple of bars fit per row.
    if (window.matchMedia('(max-width: 600px)').matches) settings.display.scale = 0.8

    const api = new alphaTab.AlphaTabApi(mainRef.current, settings)
    apiRef.current = api

    api.scoreLoaded.on((score) => {
      scoreRef.current = score
      const tracks: TrackInfo[] = score.tracks.map((t) => ({
        index: t.index,
        name: t.name?.trim() || `Track ${t.index + 1}`,
        isBass: t.playbackInfo.program >= 32 && t.playbackInfo.program <= 39,
        isPercussion: t.isPercussion,
        firstBar:
          (t.staves[0]?.bars ?? []).findIndex((bar) =>
            bar.voices.some((v) => v.beats.some((b) => !b.isRest && b.notes.length > 0)),
          ) + 1 || 1,
      }))
      const markers: { bar: number; text: string }[] = []
      score.masterBars.forEach((mb, i) => {
        const label = mb.section?.text?.trim() || mb.section?.marker?.trim()
        if (label) markers.push({ bar: i + 1, text: label })
      })
      cbRef.current.onScoreLoaded({
        title: score.title?.trim() || '',
        artist: score.artist?.trim() || '',
        barCount: score.masterBars.length,
        tracks,
        markers,
      })
      // Before the MIDI is generated, so the player starts with them.
      applySync(false)
      renderSelected()
    })

    api.playerReady.on(() => {
      if (isExternal) applySync(true)
      cbRef.current.onReadyChange(true)
    })
    // Lining bars up with beats needs the played-bar map from the MIDI. (Only
    // subscribe with external media: subscribing reads the player's
    // loadedMidiInfo, which recurses forever in alphaTab 1.8's synth worker.)
    if (isExternal) {
      api.midiLoaded.on(() => {
        if (beatsRef.current) applySync(true)
      })
    }
    api.playerStateChanged.on((args) =>
      cbRef.current.onPlayingChange(args.state === alphaTab.synth.PlayerState.Playing),
    )
    api.error.on((err) =>
      cbRef.current.onError(err?.message || 'alphaTab ran into an error.'),
    )

    let lastBar = 0
    api.playedBeatChanged.on((beat) => {
      const bar = beat.voice.bar.masterBar.index + 1
      if (bar !== lastBar) {
        lastBar = bar
        cbRef.current.onBarChange?.(bar)
      }
    })

    let raf = 0
    if (isExternal) {
      const output = api.player?.output as alphaTab.synth.IExternalMediaSynthOutput | undefined
      // The media position we last reported, and when (for jump detection).
      let lastMs = -1
      let lastAt = 0
      // Click scheduling: score ticks per ms of real time (smoothed), the tick
      // seen last frame, and the beat (tick) whose click is already queued.
      let ticksPerMs = 0
      let prevTick = -1
      let prevAt = 0
      let clicked = -1
      /** The detected beat (ms) whose click is already queued. */
      let clickedBeat = -1

      /** The beat around `tick` and the one after it, from the tick map. */
      const beatsAt = (tick: number) => {
        const bars = api.tickCache?.masterBars
        if (!bars?.length || tick < bars[0].start) return null
        let lo = 0
        let hi = bars.length - 1
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1
          if (bars[mid].start <= tick) lo = mid
          else hi = mid - 1
        }
        const bar = bars[lo]
        const beatTicks = 3840 / bar.masterBar.timeSignatureDenominator // quarter = 960
        const index = Math.floor((tick - bar.start) / beatTicks)
        const start = bar.start + index * beatTicks
        const following = start + beatTicks < bar.end ? start + beatTicks : (bars[lo + 1]?.start ?? -1)
        return { start, accent: index === 0, next: following, nextAccent: following === bars[lo + 1]?.start }
      }

      /** Queue the click for any beat starting within the next ~50 ms. */
      const scheduleClicks = (now: number) => {
        const tick = api.tickPosition
        if (prevTick >= 0 && tick > prevTick && now > prevAt) {
          const rate = (tick - prevTick) / (now - prevAt)
          ticksPerMs = ticksPerMs ? ticksPerMs * 0.85 + rate * 0.15 : rate
        }
        prevTick = tick
        prevAt = now
        const beats = beatsAt(tick)
        if (!beats || ticksPerMs <= 0) return
        // A beat we're just past (e.g. playback started right on it)…
        if (beats.start !== clicked && (tick - beats.start) / ticksPerMs < 30) {
          playClick(beats.accent)
          clicked = beats.start
        }
        // …and the next one, queued slightly ahead on the audio clock.
        const ahead = (beats.next - tick) / ticksPerMs
        if (beats.next >= 0 && beats.next !== clicked && ahead <= 50) {
          playClick(beats.nextAccent, ahead / 1000)
          clicked = beats.next
        }
      }

      /** With found beats: queue the click due within ~50 ms. */
      const scheduleBeatClicks = (t: number, rate: number, clicks: { ms: number[]; accent: boolean[] }) => {
        const list = clicks.ms
        let i = nearestIndex(list, t)
        if (i < 0) return
        // A beat we're just past (e.g. playback started right on it)…
        if (list[i] < t - 30) i++
        // …or the next one, queued slightly ahead on the audio clock.
        for (let j = i; j < list.length && j <= i + 1; j++) {
          const ahead = (list[j] - t) / (rate || 1)
          if (ahead > 50) break
          if (list[j] === clickedBeat) continue
          playClick(clicks.accent[j], Math.max(0, ahead) / 1000)
          clickedBeat = list[j]
        }
      }

      if (output) {
        output.handler = {
          get backingTrackDuration() {
            return mediaRef.current?.durationMs() || 0
          },
          get playbackRate() {
            return mediaRef.current?.rate() ?? 1
          },
          set playbackRate(value: number) {
            mediaRef.current?.setRate(value)
          },
          // The video's own volume control stays in charge.
          masterVolume: 1,
          seekTo(time: number) {
            if (performance.now() < ignoreSeekRef.current) return
            mediaRef.current?.seekToMs(time)
            lastMs = time
            lastAt = performance.now()
            clickedBeat = -1
          },
          play() {
            mediaRef.current?.play()
          },
          pause() {
            mediaRef.current?.pause()
          },
        }

        // Follow the video clock every frame.
        const tick = () => {
          const m = mediaRef.current
          if (m && apiRef.current === api) {
            const t = m.currentTimeMs()
            const now = performance.now()
            const playing = m.isPlaying()
            const expected = lastMs < 0 ? t : playing ? lastMs + (now - lastAt) * m.rate() : lastMs
            if (lastMs >= 0 && Math.abs(t - expected) > JUMP_MS) {
              // The user scrubbed the video: move the cursor there, then
              // re-seek alphaTab at that spot so its event queue restarts
              // cleanly instead of replaying/skipping a burst.
              output.updatePosition(t)
              ignoreSeekRef.current = now + 300
              api.timePosition = api.timePosition
              prevTick = -1
              clicked = -1
              clickedBeat = -1
            } else if (playing || t !== lastMs) {
              output.updatePosition(t)
              const clicks = clicksRef.current
              if (playing && clickOnRef.current && clicks) scheduleBeatClicks(t, m.rate(), clicks)
              else if (playing && clickOnRef.current) scheduleClicks(now)
              else prevTick = -1
            }
            lastMs = t
            lastAt = now
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      }

    }

    return () => {
      cancelAnimationFrame(raf)
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

  // Keep alphaTab's play state in step with the video's own controls. The
  // speed may have been set before the video player was ready — hand it over.
  useEffect(() => {
    if (!isExternal || !media) return
    if (apiRef.current) media.setRate(apiRef.current.playbackSpeed)
    return media.subscribe((playing) => {
      const api = apiRef.current
      if (!api) return
      // Started from YouTube's own controls: the tap inside the player still
      // counts as a page interaction, so the click's audio can wake up now.
      if (playing) primeClick()
      const atPlaying = api.playerState === alphaTab.synth.PlayerState.Playing
      if (playing && !atPlaying) api.play()
      else if (!playing && atPlaying) api.pause()
    })
  }, [isExternal, media])

  // Bar picking (video sync): swallow taps before alphaTab sees them, so the
  // score doesn't seek, and resolve which bar was tapped.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !onPickBar) return
    const swallow = (e: Event) => e.stopPropagation()
    const pick = (e: MouseEvent) => {
      e.stopPropagation()
      const api = apiRef.current
      const surface = mainRef.current?.querySelector('.at-surface')
      const lookup = api?.boundsLookup
      if (!surface || !lookup) return
      const rect = surface.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      let index = lookup.getBeatAtPos(x, y)?.voice.bar.masterBar.index ?? -1
      if (index < 0) {
        // Between notes: fall back to whichever bar's area holds the point.
        for (const system of lookup.staffSystems) {
          for (const bar of system.bars) {
            const b = bar.lineAlignedBounds
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) index = bar.index
          }
        }
      }
      if (index >= 0) onPickBar(index + 1)
    }
    const kinds = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'] as const
    for (const k of kinds) viewport.addEventListener(k, swallow, true)
    viewport.addEventListener('click', pick, true)
    return () => {
      for (const k of kinds) viewport.removeEventListener(k, swallow, true)
      viewport.removeEventListener('click', pick, true)
    }
  }, [onPickBar])

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

  // Re-apply edited sync points / newly found beats.
  useEffect(() => {
    applySync(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncPoints, beats])

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
    setTrackVolume(trackIndex: number, volume: number) {
      const api = apiRef.current
      const track = scoreRef.current?.tracks[trackIndex]
      if (api && track) api.changeTrackVolume([track], volume)
    },
    setMetronome(on: boolean) {
      clickOnRef.current = on
      const api = apiRef.current
      if (api && !isExternal) api.metronomeVolume = on ? clickLevelRef.current : 0
    },
    nearestBar(): number | null {
      const api = apiRef.current
      const bars = api?.tickCache?.masterBars
      if (!api || !bars?.length) return null
      const tick = api.tickPosition
      const i = bars.findIndex((b) => tick >= b.start && tick < b.end)
      if (i < 0) return tick < bars[0].start ? 1 : bars[bars.length - 1].masterBar.index + 1
      const bar = bars[i]
      const pick = tick - bar.start > (bar.end - bar.start) / 2 && bars[i + 1] ? bars[i + 1] : bar
      return pick.masterBar.index + 1
    },
    setClickVolume(volume: number) {
      clickLevelRef.current = volume
      setClickVolume(volume)
      const api = apiRef.current
      if (api && !isExternal && clickOnRef.current) api.metronomeVolume = volume
    },
  }))

  return (
    <div className={'atv-viewport' + (onPickBar ? ' is-picking' : '')} ref={viewportRef}>
      <div className="atv-main" ref={mainRef} />
    </div>
  )
})

export default AlphaTabViewer
