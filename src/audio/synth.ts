/**
 * Guitar playback engine.
 *
 * Primary voice: a real recorded **acoustic steel-string** soundfont streamed
 * via `smplr` (samples fetched from a CDN on first use, then cached by the
 * browser). Fallback voice: a tiny dependency-free Karplus-Strong synth that
 * plays instantly and works fully offline — used while the samples are still
 * loading, or forever if they can't be fetched (e.g. no network).
 *
 * Conventions (mirroring src/types.ts):
 *   - String index 0 = low E (6th), 5 = high E (1st).
 *   - Pitch class 0..11 (C=0 .. B=11).
 *
 * Call resumeAudio() from a user gesture before playing (browser autoplay
 * policies require the AudioContext to be resumed by a user interaction); it
 * also kicks off loading the guitar samples.
 */

import { Soundfont } from 'smplr'

/** Open-string MIDI notes, low E .. high E (index 0..5). */
const STRING_MIDI: readonly number[] = [40, 45, 50, 55, 59, 64]

/** Soundfont instrument + kit (MusyngKite = higher-quality samples). */
const SF_INSTRUMENT = 'acoustic_guitar_steel'
const SF_KIT = 'MusyngKite'
/** MIDI velocity used for sampled playback (0..127). */
const SF_VELOCITY = 92

/** Lowest MIDI note used as the scale root base (C3). */
const SCALE_ROOT_BASE = 48

/** Karplus-Strong decay factor per delay-line step (~0.996 = warm sustain). */
const KS_DECAY = 0.996

/**
 * Window augmented with both AudioContext constructors. The standard
 * `AudioContext` is a global var (not a Window property in lib.dom.d.ts), so we
 * declare it here to reach it as a property alongside the legacy webkit one.
 */
interface WebAudioWindow extends Window {
  AudioContext?: typeof AudioContext
  webkitAudioContext?: typeof AudioContext
}

/** Lazily-created singleton AudioContext. */
let ctx: AudioContext | null = null

/** Active sources, tracked so stopAll() can stop everything. */
const activeSources = new Set<AudioBufferSourceNode>()

/** Get (or lazily create) the shared AudioContext, handling the webkit prefix. */
function getCtx(): AudioContext {
  if (!ctx) {
    const w = window as WebAudioWindow
    const Ctor = w.AudioContext ?? w.webkitAudioContext
    if (!Ctor) {
      throw new Error('Web Audio API is not supported in this environment')
    }
    ctx = new Ctor()
  }
  return ctx
}

/** getCtx() that never throws — returns null when Web Audio is unavailable, so
 *  the playback/click path stays silent-but-stable (mirrors ensureSoundfont). */
function tryGetCtx(): AudioContext | null {
  try {
    return getCtx()
  } catch {
    return null
  }
}

// ── Sampled-guitar soundfont (primary voice) ───────────────────────────────
type SoundfontInstrument = ReturnType<typeof Soundfont>

let soundfont: SoundfontInstrument | null = null
let soundfontReady = false
let soundfontLoad: Promise<boolean> | null = null

/**
 * Begin loading the guitar soundfont (idempotent). Resolves true once the
 * samples are playable, false if they failed to load (we then stay on the
 * synth fallback). Safe to call repeatedly.
 */
function ensureSoundfont(): Promise<boolean> {
  if (soundfontLoad) return soundfontLoad
  try {
    const ac = getCtx()
    const sf = Soundfont(ac, { instrument: SF_INSTRUMENT, kit: SF_KIT })
    soundfont = sf
    soundfontLoad = sf.ready
      .then(() => {
        soundfontReady = true
        return true
      })
      .catch((err: unknown) => {
        // Offline / blocked / CDN down: keep using the synth fallback.
        console.warn('Guitar samples unavailable; using synth fallback.', err)
        soundfont = null
        soundfontReady = false
        return false
      })
  } catch (err) {
    // No Web Audio at all (e.g. unsupported environment) — never throw to the
    // caller; resolve false so preloadGuitar() at mount can't crash the app.
    console.warn('Web Audio unavailable; playback disabled.', err)
    soundfontLoad = Promise.resolve(false)
  }
  return soundfontLoad
}

/** True once the sampled guitar is ready (otherwise calls use the synth). */
export function isGuitarReady(): boolean {
  return soundfontReady
}

/**
 * Begin fetching + decoding the guitar samples ahead of time (e.g. on app
 * mount) so the first played chord already uses the real guitar instead of the
 * synth fallback. Idempotent. Resolves true when the samples are ready, or
 * false if they couldn't load (offline / blocked) — then the synth is used.
 *
 * Note: this creates a (suspended) AudioContext to decode into; it is only
 * resumed later by resumeAudio() on a user gesture, per autoplay policy.
 */
export function preloadGuitar(): Promise<boolean> {
  return ensureSoundfont()
}

/** MIDI note number -> frequency in Hz. */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/**
 * Convert a chord shape (per-string frets) into the MIDI notes that sound.
 * frets[i] === null means the string is muted and is skipped.
 */
export function chordMidis(frets: (number | null)[]): number[] {
  const out: number[] = []
  for (let i = 0; i < frets.length; i++) {
    const fret = frets[i]
    if (fret !== null && i < STRING_MIDI.length) {
      out.push(STRING_MIDI[i] + fret)
    }
  }
  return out
}

/**
 * Build ascending, sorted, unique scale MIDI notes from a root pitch class
 * and semitone intervals, spanning `octaves` (default 1) plus the top root.
 */
export function scaleMidis(
  rootPc: number,
  intervals: number[],
  opts?: { octaves?: number },
): number[] {
  const octaves = opts?.octaves ?? 1
  const rootMidi = SCALE_ROOT_BASE + rootPc
  const set = new Set<number>()
  for (let o = 0; o < octaves; o++) {
    for (const interval of intervals) {
      set.add(rootMidi + 12 * o + interval)
    }
  }
  // Append the final top root so the run resolves an octave up.
  set.add(rootMidi + 12 * octaves)
  return Array.from(set).sort((a, b) => a - b)
}

/**
 * Resume the AudioContext (call from a user gesture before playing) and start
 * loading the guitar samples so they're ready for subsequent notes.
 */
export function resumeAudio(): void {
  const ac = tryGetCtx()
  if (!ac) return
  if (ac.state === 'suspended') {
    // Fire-and-forget; ignore rejection (e.g. no user gesture yet).
    void ac.resume().catch(() => undefined)
  }
  void ensureSoundfont()
}

/**
 * Render a single Karplus-Strong plucked note into an AudioBuffer.
 */
function renderNote(
  ac: AudioContext,
  freq: number,
  duration: number,
): AudioBuffer {
  const sampleRate = ac.sampleRate
  const frameCount = Math.max(1, Math.floor(duration * sampleRate))
  const buffer = ac.createBuffer(1, frameCount, sampleRate)
  const data = buffer.getChannelData(0)

  // Delay line length sets the pitch: longer line = lower note.
  const n = Math.max(2, Math.round(sampleRate / freq))
  const line = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    line[i] = Math.random() * 2 - 1 // initial white-noise excitation (the pluck)
  }

  // Karplus-Strong loop: emit line[idx], then low-pass + decay by averaging the
  // current sample with the next one. This progressively smooths the noise into
  // a pitched, gently-decaying string tone.
  let idx = 0
  for (let i = 0; i < frameCount; i++) {
    data[i] = line[idx]
    const next = (idx + 1) % n
    line[idx] = 0.5 * (line[idx] + line[next]) * KS_DECAY
    idx = next
  }

  // ~20ms linear fade-out to avoid an end-of-buffer click.
  const fade = Math.min(frameCount, Math.floor(sampleRate * 0.02))
  for (let i = 0; i < fade; i++) {
    data[frameCount - 1 - i] *= i / fade
  }

  return buffer
}

/** Play a pre-rendered buffer through gain -> destination at an absolute time. */
function playBuffer(
  ac: AudioContext,
  buffer: AudioBuffer,
  startTime: number,
  gain: number,
): void {
  const src = ac.createBufferSource()
  src.buffer = buffer
  const gainNode = ac.createGain()
  gainNode.gain.value = gain
  src.connect(gainNode)
  gainNode.connect(ac.destination)

  activeSources.add(src)
  src.onended = () => {
    activeSources.delete(src)
    try {
      src.disconnect()
      gainNode.disconnect()
    } catch {
      // Node may already be disconnected; ignore.
    }
  }
  src.start(startTime)
}

/** Synth-fallback single note (Karplus-Strong), relative to ac.currentTime. */
function synthNote(
  ac: AudioContext,
  midi: number,
  when: number,
  duration: number,
  gain: number,
): void {
  const buffer = renderNote(ac, midiToFreq(midi), duration)
  playBuffer(ac, buffer, ac.currentTime + when, gain)
}

/** Play a single MIDI note. Defaults: when=0, duration=1.5, gain=0.26. */
export function playNote(
  midi: number,
  when = 0,
  duration = 1.5,
  gain = 0.26,
): void {
  const ac = tryGetCtx()
  if (!ac) return
  if (soundfontReady && soundfont) {
    soundfont.start({ note: midi, time: ac.currentTime + when, duration, velocity: SF_VELOCITY })
  } else {
    void ensureSoundfont()
    synthNote(ac, midi, when, duration, gain)
  }
}

/**
 * Play a strummed chord. Notes are offset by `strum` seconds each (use a larger
 * value to arpeggiate). `direction` "down" sounds low→high (default), "up"
 * sounds high→low.
 */
export function playChord(
  midis: number[],
  opts?: { strum?: number; gain?: number; direction?: 'down' | 'up' },
): void {
  const strum = opts?.strum ?? 0.035
  const gain = opts?.gain ?? 0.22 // modest per-note gain so stacks don't clip
  const direction = opts?.direction ?? 'down'
  const ac = tryGetCtx()
  if (!ac) return
  const sorted = [...midis].sort((a, b) => (direction === 'up' ? b - a : a - b))
  const base = ac.currentTime
  if (soundfontReady && soundfont) {
    const sf = soundfont
    sorted.forEach((midi, i) =>
      sf.start({ note: midi, time: base + i * strum, duration: 2.5, velocity: SF_VELOCITY }),
    )
  } else {
    void ensureSoundfont()
    for (let i = 0; i < sorted.length; i++) {
      synthNote(ac, sorted[i], i * strum, 1.5, gain)
    }
  }
}

/** Play a sequence of notes, one per `step` seconds. */
export function playSequence(
  midis: number[],
  opts?: { step?: number; gain?: number },
): void {
  const step = opts?.step ?? 0.26
  const gain = opts?.gain ?? 0.26
  const ac = tryGetCtx()
  if (!ac) return
  const base = ac.currentTime
  if (soundfontReady && soundfont) {
    const sf = soundfont
    midis.forEach((midi, i) =>
      sf.start({
        note: midi,
        time: base + i * step,
        duration: Math.max(step * 1.4, 0.6),
        velocity: SF_VELOCITY,
      }),
    )
  } else {
    void ensureSoundfont()
    const duration = Math.max(step * 1.5, 0.4)
    for (let i = 0; i < midis.length; i++) {
      synthNote(ac, midis[i], i * step, duration, gain)
    }
  }
}

/** Stop everything currently sounding (both sampled and synth voices). */
export function stopAll(): void {
  soundfont?.stop()
  for (const src of activeSources) {
    try {
      src.stop()
    } catch {
      // Source may not have started or already stopped; ignore.
    }
  }
  activeSources.clear()
}
