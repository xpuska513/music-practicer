/**
 * Tiny dependency-free synthesized drum kit (Web Audio).
 *
 * `triggerDrum` schedules a short percussive sound for a given voice at an
 * AudioContext time. Every node created for a hit is disconnected once it
 * finishes so nothing accumulates over a long session.
 */

import type { DrumVoiceId } from '../theory/drums'

/**
 * Cache of white-noise buffers, one per AudioContext. Buffers are immutable
 * and reusable across hits, so we generate them lazily and keep them keyed by
 * the context they belong to.
 */
const noiseCache = new WeakMap<AudioContext, AudioBuffer>()

/** ~1s of mono white noise, suitable as a source for snare/hat/crash hits. */
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
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
 * Run `nodes` until `source` ends, then disconnect everything. `source` must
 * be started by the caller; we only schedule its stop and cleanup.
 */
function autoStop(
  source: AudioScheduledSourceNode,
  nodes: AudioNode[],
  time: number,
  duration: number,
): void {
  source.stop(time + duration)
  source.onended = () => {
    source.disconnect()
    for (const node of nodes) node.disconnect()
  }
}

/** Create a noise source feeding a highpass filter, scaled by a gain node. */
function noiseThroughHighpass(
  ctx: AudioContext,
  cutoff: number,
  peak: number,
  time: number,
  decay: number,
): void {
  const source = ctx.createBufferSource()
  source.buffer = getNoiseBuffer(ctx)

  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.setValueAtTime(cutoff, time)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(peak, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + decay)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)

  source.start(time)
  autoStop(source, [filter, gain], time, decay + 0.02)
}

function triggerKick(ctx: AudioContext, time: number): void {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(150, time)
  osc.frequency.exponentialRampToValueAtTime(50, time + 0.08)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.9, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(time)
  autoStop(osc, [gain], time, 0.2)
}

function triggerSnare(ctx: AudioContext, time: number): void {
  const decay = 0.15

  // Noise body through a highpass for the "crack".
  const noise = ctx.createBufferSource()
  noise.buffer = getNoiseBuffer(ctx)

  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.setValueAtTime(1500, time)

  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.5, time)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + decay)

  noise.connect(highpass)
  highpass.connect(noiseGain)
  noiseGain.connect(ctx.destination)
  noise.start(time)
  autoStop(noise, [highpass, noiseGain], time, decay + 0.02)

  // Short tonal body.
  const body = ctx.createOscillator()
  body.type = 'triangle'
  body.frequency.setValueAtTime(180, time)

  const bodyGain = ctx.createGain()
  bodyGain.gain.setValueAtTime(0.35, time)
  bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1)

  body.connect(bodyGain)
  bodyGain.connect(ctx.destination)
  body.start(time)
  autoStop(body, [bodyGain], time, 0.12)
}

function triggerTom(ctx: AudioContext, time: number): void {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(120, time)
  osc.frequency.exponentialRampToValueAtTime(80, time + 0.2)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.7, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(time)
  autoStop(osc, [gain], time, 0.27)
}

/** Schedule a short percussive sound for `voice` at AudioContext time `time`. */
export function triggerDrum(
  ctx: AudioContext,
  voice: DrumVoiceId,
  time: number,
): void {
  switch (voice) {
    case 'kick':
      triggerKick(ctx, time)
      break
    case 'snare':
      triggerSnare(ctx, time)
      break
    case 'tom':
      triggerTom(ctx, time)
      break
    case 'hihat':
      noiseThroughHighpass(ctx, 7000, 0.4, time, 0.04)
      break
    case 'openhh':
      noiseThroughHighpass(ctx, 7000, 0.4, time, 0.3)
      break
    case 'crash':
      noiseThroughHighpass(ctx, 5000, 0.25, time, 0.8)
      break
  }
}
