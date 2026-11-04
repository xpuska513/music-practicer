import { useEffect, useRef } from 'react'
import type { ExternalMedia } from './AlphaTabViewer'
import { createYouTubePlayer, YT_STATE } from './youtube'
import type { YTPlayer } from './youtube'

interface Props {
  videoId: string
  /** The player as an ExternalMedia clock once it's ready (null on teardown). */
  onMedia: (media: ExternalMedia | null) => void
  onError: (message: string) => void
}

/** Player error codes → something a person can act on. */
function errorText(code: number): string {
  if (code === 100) return 'That video was removed or is private.'
  if (code === 101 || code === 150) {
    return 'The owner doesn’t allow this video to be embedded — try another upload of the song.'
  }
  return 'YouTube couldn’t play that video.'
}

/**
 * Embedded YouTube player exposed to the score viewer as an `ExternalMedia`
 * clock. Buffering doesn't count as a pause (so a slow connection never stops
 * playback), but the clock only advances while the video actually plays.
 */
export default function VideoPane({ videoId, onMedia, onError }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const cbRef = useRef({ onMedia, onError })
  cbRef.current = { onMedia, onError }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let alive = true
    let player: YTPlayer | null = null
    let state: number = YT_STATE.UNSTARTED
    let rate = 1
    // A smoothed media clock: it runs on performance.now() at the playback
    // rate and eases toward each new time the player reports, so the cursor
    // and the click don't jitter with the player's coarse updates.
    let lastRaw = -1
    let clockMs = 0
    let clockAt = 0
    const listeners = new Set<(playing: boolean) => void>()

    // The API replaces this element with its iframe.
    const target = document.createElement('div')
    host.appendChild(target)

    const media: ExternalMedia = {
      currentTimeMs() {
        if (!player) return 0
        const raw = player.getCurrentTime() * 1000
        const now = performance.now()
        if (state !== YT_STATE.PLAYING) {
          lastRaw = raw
          clockMs = raw
          clockAt = now
          return raw
        }
        const predicted = clockMs + (now - clockAt) * rate
        clockAt = now
        if (raw !== lastRaw) {
          lastRaw = raw
          const err = raw - predicted
          // Snap on a real jump (seek / stall), otherwise ease toward it.
          clockMs = Math.abs(err) > 250 ? raw : predicted + err * 0.3
        } else {
          clockMs = predicted
        }
        return clockMs
      },
      durationMs: () => (player ? player.getDuration() * 1000 : 0),
      isPlaying: () => state === YT_STATE.PLAYING,
      rate: () => rate,
      play: () => player?.playVideo(),
      pause: () => player?.pauseVideo(),
      seekToMs(ms) {
        player?.seekTo(ms / 1000, true)
        clockMs = ms
        clockAt = performance.now()
      },
      setRate: (r) => player?.setPlaybackRate(r),
      setVolume(v) {
        if (!player) return
        player.setVolume(Math.round(Math.min(1, Math.max(0, v)) * 100))
        if (v > 0 && player.isMuted()) player.unMute()
      },
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    }

    createYouTubePlayer(target, videoId, {
      onReady: (e) => {
        if (!alive) return
        player = e.target
        rate = player.getPlaybackRate() || 1
        cbRef.current.onMedia(media)
      },
      onStateChange: (e) => {
        const was = state
        state = e.data
        // Only real play/pause/end transitions — not buffering or cueing.
        if (state === YT_STATE.PLAYING && was !== YT_STATE.PLAYING) listeners.forEach((l) => l(true))
        else if (state === YT_STATE.PAUSED || state === YT_STATE.ENDED) listeners.forEach((l) => l(false))
      },
      onPlaybackRateChange: (e) => {
        rate = e.data || 1
      },
      onError: (e) => cbRef.current.onError(errorText(e.data)),
    }).catch(() => {
      if (alive) cbRef.current.onError('Could not load YouTube — check your connection.')
    })

    return () => {
      alive = false
      listeners.clear()
      cbRef.current.onMedia(null)
      try {
        player?.destroy()
      } catch {
        /* already gone */
      }
      host.replaceChildren()
    }
  }, [videoId])

  return (
    <div className="video-pane">
      <div ref={hostRef} className="video-pane__frame" />
    </div>
  )
}
