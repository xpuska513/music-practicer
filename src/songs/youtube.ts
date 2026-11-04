/**
 * YouTube support for the Songs looper: link parsing, a lazy loader for the
 * official IFrame Player API, and the small slice of its types we use.
 *
 * The API script is fetched from youtube.com only when a song with a video is
 * opened, and the player itself runs in youtube-nocookie.com's sandboxed
 * iframe — nothing is loaded for songs without a video.
 */

/** The slice of `YT.Player` the looper drives. */
export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  setPlaybackRate(rate: number): void
  getPlaybackRate(): number
  getAvailablePlaybackRates(): number[]
  setVolume(volume: number): void
  isMuted(): boolean
  unMute(): void
  destroy(): void
}

interface YTEvent {
  target: YTPlayer
  data: number
}

interface YTPlayerOptions {
  host?: string
  videoId: string
  width?: string | number
  height?: string | number
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (e: YTEvent) => void
    onStateChange?: (e: YTEvent) => void
    onPlaybackRateChange?: (e: YTEvent) => void
    onError?: (e: YTEvent) => void
  }
}

interface YTNamespace {
  Player: new (el: HTMLElement, options: YTPlayerOptions) => YTPlayer
}

interface YTWindow {
  YT?: YTNamespace
  onYouTubeIframeAPIReady?: () => void
}

/** `YT.PlayerState` values. */
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const

const ID_RE = /^[A-Za-z0-9_-]{11}$/

/** Parse "1m23.5s", "83", "1:23" style timestamps into milliseconds. */
function parseStart(raw: string | null): number {
  if (!raw) return 0
  if (/^\d+(\.\d+)?$/.test(raw)) return Math.round(Number(raw) * 1000)
  const hms = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/)
  if (hms && raw) {
    const [, h = '0', m = '0', s = '0'] = hms
    return Math.round((Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000)
  }
  return 0
}

/**
 * Pull the video id (and any `t=` start time) out of a YouTube link or a bare
 * 11-character id. Accepts watch / youtu.be / shorts / embed / live / music
 * links. Returns null for anything that isn't recognisably YouTube.
 */
export function parseYouTubeUrl(input: string): { id: string; startMs: number } | null {
  const text = input.trim()
  if (ID_RE.test(text)) return { id: text, startMs: 0 }
  let url: URL
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '')
  let id: string | null = null
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0]
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, kind, rest] = url.pathname.split('/')
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else if (kind === 'shorts' || kind === 'embed' || kind === 'live' || kind === 'v') id = rest ?? null
  }
  if (!id || !ID_RE.test(id)) return null
  return { id, startMs: parseStart(url.searchParams.get('t') ?? url.searchParams.get('start')) }
}

let apiPromise: Promise<YTNamespace> | null = null

/** Load the IFrame Player API once per page (resolves with `window.YT`). */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (!apiPromise) {
    apiPromise = new Promise<YTNamespace>((resolve, reject) => {
      const w = window as unknown as YTWindow
      if (w.YT?.Player) {
        resolve(w.YT)
        return
      }
      const previous = w.onYouTubeIframeAPIReady
      w.onYouTubeIframeAPIReady = () => {
        previous?.()
        if (w.YT) resolve(w.YT)
      }
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => {
        apiPromise = null // allow a retry later (e.g. back online)
        reject(new Error('Could not load YouTube.'))
      }
      document.head.appendChild(script)
    })
  }
  return apiPromise
}

/** Create a player inside `el` (privacy-enhanced host, inline on iOS). */
export async function createYouTubePlayer(
  el: HTMLElement,
  videoId: string,
  events: NonNullable<YTPlayerOptions['events']>,
): Promise<YTPlayer> {
  const YT = await loadYouTubeApi()
  return new YT.Player(el, {
    host: 'https://www.youtube-nocookie.com',
    videoId,
    width: '100%',
    height: '100%',
    playerVars: {
      playsinline: 1,
      rel: 0,
      origin: window.location.origin,
    },
    events,
  })
}

/** "83450" → "1:23.45" */
export function formatMs(ms: number): string {
  const total = Math.max(0, ms) / 1000
  const m = Math.floor(total / 60)
  const s = total - m * 60
  return `${m}:${s.toFixed(2).padStart(5, '0')}`
}
