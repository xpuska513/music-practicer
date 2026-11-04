/**
 * Tiny dependency-free synthesized drum kit (Web Audio).
 *
 * `triggerDrum` schedules a short percussive sound for a given voice at an
 * AudioContext time, scaled by the hit's dynamic level (ghost / normal /
 * accent). Every node created for a hit is disconnected once it finishes so
 * nothing accumulates over a long session.
 */

import { HIT_ACCENT, HIT_GHOST, HIT_NORMAL, HIT_OFF } from '../theory/drums'
import type { DrumVoiceId, HitLevel } from '../theory/drums'

/**
 * Gain per hit level, relative to each voice's peak below (which is the
 * accent): ghosts are a quiet tap, normal hits sit a notch under an accent.
 */
const LEVEL_GAIN: Record<HitLevel, number> = {
  [HIT_OFF]: 0,
  [HIT_GHOST]: 0.28,
  [HIT_NORMAL]: 0.7,
  [HIT_ACCENT]: 1,
}

/** Noise voices ring a little shorter when soft and longer when accented. */
const LEVEL_DECAY: Record<HitLevel, number> = {
  [HIT_OFF]: 1,
  [HIT_GHOST]: 0.8,
  [HIT_NORMAL]: 1,
  [HIT_ACCENT]: 1.15,
}

/**
 * Cache of white-noise buffers, one per AudioContext. Buffers are immutable
 * and reusable across hits, so we generate them lazily and keep them keyed by
 * the context they belong to.
 */
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()

/** ~1s of mono white noise, suitable as a source for snare/hat/cymbal hits. */
function getNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx)
  if (cached) return cached

  const length = Math.floor(ctx.sampleRate) // ~1 second
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  noiseCache.set(ctx, buffer)
  return buffer
}

/**
 * Run `sources` until they end, then disconnect everything. Each source must
 * be started by the caller; we only schedule the stops and the cleanup (once
 * the last source has ended, so shared nodes outlive every input).
 */
function autoStop(
  sources: AudioScheduledSourceNode[],
  nodes: AudioNode[],
  time: number,
  duration: number,
): void {
  let playing = sources.length
  for (const source of sources) {
    source.stop(time + duration)
    source.onended = () => {
      source.disconnect()
      if (--playing === 0) for (const node of nodes) node.disconnect()
    }
  }
}

/** A gain node holding `peak` at `time`, then decaying exponentially. */
function envelope(ctx: BaseAudioContext, time: number, peak: number, decay: number): GainNode {
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(peak, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + decay)
  return gain
}

/** A looping noise source started at a random point, so repeats don't sound
 *  machine-gunned. */
function noiseSource(ctx: BaseAudioContext, time: number): AudioBufferSourceNode {
  const buffer = getNoiseBuffer(ctx)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  source.start(time, Math.random() * buffer.duration)
  return source
}

/** Noise through one filter, shaped by a decaying gain. */
function noiseBurst(
  ctx: BaseAudioContext,
  time: number,
  type: BiquadFilterType,
  freq: number,
  peak: number,
  decay: number,
  q = 1,
): void {
  const source = noiseSource(ctx, time)

  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.setValueAtTime(freq, time)
  filter.Q.setValueAtTime(q, time)

  const gain = envelope(ctx, time, peak, decay)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  autoStop([source], [filter, gain], time, decay + 0.02)
}

/** A pitched body: an oscillator gliding `from` → `to` over `glide` seconds. */
function pitchedBody(
  ctx: BaseAudioContext,
  time: number,
  type: OscillatorType,
  from: number,
  to: number,
  glide: number,
  peak: number,
  decay: number,
): void {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(from, time)
  osc.frequency.exponentialRampToValueAtTime(to, time + glide)

  const gain = envelope(ctx, time, peak, decay)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(time)
  autoStop([osc], [gain], time, decay + 0.02)
}

function triggerKick(ctx: BaseAudioContext, time: number, g: number): void {
  pitchedBody(ctx, time, 'sine', 150, 50, 0.08, 0.9 * g, 0.18)
}

function triggerSnare(ctx: BaseAudioContext, time: number, level: HitLevel): void {
  const g = LEVEL_GAIN[level]
  const decay = 0.15 * LEVEL_DECAY[level]

  // Noise body through a highpass for the "crack"; a ghost stroke is softer
  // and darker, so it also loses the top end.
  const noise = noiseSource(ctx, time)

  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.setValueAtTime(1500, time)

  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.setValueAtTime(level === HIT_GHOST ? 3200 : 16000, time)

  const noiseGain = envelope(ctx, time, 0.5 * g, decay)

  noise.connect(highpass)
  highpass.connect(tone)
  tone.connect(noiseGain)
  noiseGain.connect(ctx.destination)
  autoStop([noise], [highpass, tone, noiseGain], time, decay + 0.02)

  // Short tonal body.
  pitchedBody(ctx, time, 'triangle', 180, 180, 0.01, 0.35 * g, 0.1)
}

/**
 * A tom: a sine body gliding down in pitch, its first inharmonic membrane
 * mode (≈1.59×, short), and a tick of stick noise so even the floor tom reads
 * on small speakers.
 */
function triggerTom(
  ctx: BaseAudioContext,
  time: number,
  g: number,
  from: number,
  to: number,
  decay: number,
): void {
  pitchedBody(ctx, time, 'sine', from, to, decay * 0.8, 0.75 * g, decay)
  pitchedBody(ctx, time, 'sine', from * 1.59, to * 1.59, decay * 0.5, 0.18 * g, decay * 0.4)
  noiseBurst(ctx, time, 'bandpass', 2500, 0.12 * g, 0.015, 0.8)
}

/**
 * Ride: a long, bandpassed noise wash plus a couple of inharmonic square
 * partials (highpassed down to their metallic upper harmonics) for the "ping".
 * Quieter than the crash, but it rings for about a second.
 */
function triggerRide(ctx: BaseAudioContext, time: number, level: HitLevel): void {
  const g = LEVEL_GAIN[level]
  const decay = 1.05 * LEVEL_DECAY[level]
  noiseBurst(ctx, time, 'bandpass', 7000, 0.11 * g, decay, 0.7)

  const partials = [540, 803].map((freq) => {
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(freq, time)
    return osc
  })
  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.setValueAtTime(3000, time)
  const pingDecay = 0.8 * decay
  const gain = envelope(ctx, time, 0.035 * g, pingDecay)

  for (const osc of partials) {
    osc.connect(highpass)
    osc.start(time)
  }
  highpass.connect(gain)
  gain.connect(ctx.destination)
  autoStop(partials, [highpass, gain], time, pingDecay + 0.02)
}

/**
 * Schedule a short percussive sound for `voice` at AudioContext time `time`,
 * at the given dynamic level (a silent level schedules nothing).
 */
export function triggerDrum(
  ctx: BaseAudioContext,
  voice: DrumVoiceId,
  time: number,
  level: HitLevel = HIT_NORMAL,
): void {
  if (level === HIT_OFF) return
  const g = LEVEL_GAIN[level]
  const d = LEVEL_DECAY[level]
  switch (voice) {
    case 'kick':
      triggerKick(ctx, time, g)
      break
    case 'snare':
      triggerSnare(ctx, time, level)
      break
    case 'tom': // high tom
      triggerTom(ctx, time, g, 210, 140, 0.26)
      break
    case 'midtom':
      triggerTom(ctx, time, g, 150, 100, 0.32)
      break
    case 'floortom':
      triggerTom(ctx, time, g, 90, 60, 0.48)
      break
    case 'hihat':
      noiseBurst(ctx, time, 'highpass', 7000, 0.4 * g, 0.04 * d)
      break
    case 'openhh':
      noiseBurst(ctx, time, 'highpass', 7000, 0.4 * g, 0.3 * d)
      break
    case 'hhfoot':
      // The pedal "chick": hats clapped shut — short, soft, less sizzle.
      noiseBurst(ctx, time, 'bandpass', 3800, 0.3 * g, 0.03 * d, 0.9)
      break
    case 'crash':
      noiseBurst(ctx, time, 'highpass', 5000, 0.25 * g, 0.8 * d)
      break
    case 'ride':
      triggerRide(ctx, time, level)
      break
  }
}
