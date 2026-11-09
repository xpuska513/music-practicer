import { useEffect, useRef, useState } from 'react'
import type { ExternalMedia } from './AlphaTabViewer'
import { getSongAudio } from './songStore'

/**
 * A song's attached audio file as the score viewer's `ExternalMedia` clock
 * (the "Audio" source): a plain <audio> element on a blob URL, so speed
 * changes keep the pitch and nothing leaves the device.
 */
function createAudioMedia(url: string): { media: ExternalMedia; element: HTMLAudioElement } {
  const el = new Audio()
  el.preload = 'auto'
  el.preservesPitch = true
  el.src = url
  const listeners = new Set<(playing: boolean) => void>()
  el.addEventListener('play', () => listeners.forEach((l) => l(true)))
  // (Ending playback pauses the element too.)
  el.addEventListener('pause', () => listeners.forEach((l) => l(false)))

  const media: ExternalMedia = {
    currentTimeMs: () => el.currentTime * 1000,
    durationMs: () => (Number.isFinite(el.duration) ? el.duration * 1000 : 0),
    isPlaying: () => !el.paused,
    rate: () => el.playbackRate,
    play() {
      void el.play().catch(() => undefined)
    },
    pause: () => el.pause(),
    seekToMs(ms) {
      el.currentTime = Math.max(0, ms) / 1000
    },
    setRate(rate) {
      el.playbackRate = rate
    },
    setVolume(volume) {
      el.volume = Math.min(1, Math.max(0, volume))
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return { media, element: el }
}

/**
 * Load song `songId`'s audio file and expose it as media (null while loading,
 * and while `songId` is null). A new `revision` (a replaced file) reloads it.
 */
export function useAudioMedia(
  songId: string | null,
  revision: string,
  onError: (message: string) => void,
): ExternalMedia | null {
  const [media, setMedia] = useState<ExternalMedia | null>(null)
  const errorRef = useRef(onError)
  errorRef.current = onError

  useEffect(() => {
    setMedia(null)
    if (!songId) return
    let alive = true
    let url = ''
    let element: HTMLAudioElement | null = null
    getSongAudio(songId)
      .then((file) => {
        if (!alive) return
        if (!file) {
          errorRef.current('That song’s audio file is missing — add it again.')
          return
        }
        url = URL.createObjectURL(new Blob([file.data], { type: file.type || 'audio/mpeg' }))
        const created = createAudioMedia(url)
        element = created.element
        element.addEventListener('error', () => alive && errorRef.current('This browser can’t play that audio file.'), {
          once: true,
        })
        // Ready now: iOS may not even read the metadata before the first play
        // (the duration only matters past the score's last bar).
        setMedia(created.media)
      })
      .catch(() => alive && errorRef.current('Could not load the audio file.'))
    return () => {
      alive = false
      if (element) {
        element.pause()
        element.removeAttribute('src')
        element.load()
      }
      if (url) URL.revokeObjectURL(url)
    }
  }, [songId, revision])

  return media
}
