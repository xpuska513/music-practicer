/**
 * Metronome click for video playback. With a YouTube video driving the score,
 * alphaTab's synth is silent (and its external-media player emits no metronome
 * events), so the viewer finds the beats itself and sounds them here — the
 * same short sine "tick" as the app's Metronome (accented on beat 1).
 */

let ctx: AudioContext | null = null
/** Click level, 0..1.5 (above 1 helps it cut through a loud recording). */
let level = 1

export function setClickVolume(volume: number): void {
  level = Math.min(1.5, Math.max(0, volume))
}

/** Create/resume the shared context — call from a user gesture (Play). */
export function primeClick(): void {
  try {
    if (!ctx) ctx = new AudioContext()
    void ctx.resume()
  } catch {
    ctx = null
  }
}

/** Sound one tick `inSeconds` from now (a small lookahead keeps it on time). */
export function playClick(accent: boolean, inSeconds = 0): void {
  if (!ctx || ctx.state !== 'running' || level <= 0) return
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
