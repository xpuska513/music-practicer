/**
 * Metronome click for video playback. With a YouTube video driving the score,
 * alphaTab's synth is silent (and its external-media player emits no metronome
 * events), so the viewer finds the beats itself and sounds them here — the
 * same short sine "tick" as the app's Metronome (accented on beat 1).
 *
 * iOS needs extra care: web audio counts as an "ambient" sound effect there —
 * muted by the silent switch / Control Center bell even while the video plays —
 * and an AudioContext only unlocks inside a real tap (touchend / click, not
 * touchstart / pointerdown).
 */

let ctx: AudioContext | null = null
let unlocked = false
/** Click level, 0..1.5 (above 1 helps it cut through a loud recording). */
let level = 1

interface AudioSessionNavigator {
  audioSession?: { type: string }
}

export function setClickVolume(volume: number): void {
  level = Math.min(1.5, Math.max(0, volume))
}

/** Can a click sound right now? (false until a tap has unlocked audio on iOS). */
export function clickReady(): boolean {
  return ctx?.state === 'running'
}

/** Create/resume the shared context — call from a user gesture (Play). */
export function primeClick(): void {
  try {
    // Safari 16.4+: play as media, like the video, so a muted ringer doesn't
    // silence the click alone.
    const session = (navigator as AudioSessionNavigator).audioSession
    if (session && session.type !== 'playback') session.type = 'playback'
    if (!ctx) ctx = new AudioContext()
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined)
    if (!unlocked) {
      // Older iOS only unlocks once something actually starts inside the tap.
      const source = ctx.createBufferSource()
      source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
      source.connect(ctx.destination)
      source.start()
      unlocked = true
    }
  } catch {
    ctx = null
  }
}

let unlockInstalled = false

/**
 * Unlock audio on the first real tap anywhere on the page (and again after
 * iOS interrupts it, e.g. a call or Siri) — taps inside the YouTube player
 * don't reach us, but any tap on our UI does.
 */
export function installClickUnlock(): void {
  if (unlockInstalled || typeof window === 'undefined') return
  unlockInstalled = true
  const unlock = () => {
    if (!clickReady()) primeClick()
  }
  for (const type of ['touchend', 'click', 'keydown'] as const) {
    window.addEventListener(type, unlock, { capture: true, passive: true })
  }
}

/** Sound one tick `inSeconds` from now (a small lookahead keeps it on time). */
export function playClick(accent: boolean, inSeconds = 0): void {
  if (!ctx || level <= 0) return
  if (ctx.state !== 'running') {
    // Suspended / iOS "interrupted": try to recover (works once a tap has
    // unlocked audio); the UI shows a "tap to enable" hint meanwhile.
    void ctx.resume().catch(() => undefined)
    return
  }
  const time = ctx.currentTime + Math.max(0, inSeconds)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = accent ? 1500 : 1000
  gain.gain.setValueAtTime(Math.min(0.98, (accent ? 0.9 : 0.55) * level), time)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(time)
  osc.stop(time + 0.05)
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
}
