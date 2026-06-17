import { useCallback, useEffect, useRef, useState } from 'react'
import { PitchDetector } from 'pitchy'
import { analysePitch, nearestString, centsFromString } from './pitchDetect'

export type TunerStatus =
  | 'idle'
  | 'requesting'
  | 'listening'
  | 'denied'
  | 'unsupported'
  | 'error'

export interface TunerReading {
  frequency: number
  /** Detected chromatic note (e.g. "E", "F#"). */
  note: string
  octave: number
  /** Standard-tuning string being tuned (0 = low E .. 5 = high E). */
  targetString: number
  /** Cents off from the target string (negative = flat, positive = sharp). */
  cents: number
  inTune: boolean
}

export interface AudioInputDevice {
  deviceId: string
  label: string
}

export interface TunerControls {
  status: TunerStatus
  reading: TunerReading | null
  devices: AudioInputDevice[]
  deviceId: string | null
  setDeviceId: (id: string | null) => void
  /** null = auto-detect nearest string; 0..5 = lock to that string. */
  lockedString: number | null
  setLockedString: (s: number | null) => void
  errorMsg: string | null
  start: () => void
  stop: () => void
}

const IN_TUNE_CENTS = 5
const FFT_SIZE = 4096
/** Pre-analyser gain to lift quietly-mic'd strings into the detector. */
const INPUT_GAIN = 2.5
/** Only accept readings at least this "clear" (MPM clarity 0..1). Lower =
 *  picks up softer / farther-away strings, at a small cost in stray readings. */
const CLARITY_THRESHOLD = 0.8
/** Auto-detect must see a new nearest string this many frames in a row before
 *  switching to it — filters the occasional single-frame octave blip. */
const TARGET_HYSTERESIS = 2
/** Plausible guitar fundamental range (Hz); rejects noise and octave errors. */
const MIN_FREQ = 60
const MAX_FREQ = 1400

interface WebAudioWindow extends Window {
  AudioContext?: typeof AudioContext
  webkitAudioContext?: typeof AudioContext
}

export function useTuner(): TunerControls {
  const [status, setStatus] = useState<TunerStatus>('idle')
  const [reading, setReading] = useState<TunerReading | null>(null)
  const [devices, setDevices] = useState<AudioInputDevice[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [lockedString, setLockedString] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const bufRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const detectorRef = useRef<PitchDetector<Float32Array> | null>(null)
  const lockedRef = useRef<number | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const centsSmoothRef = useRef(0)
  // Auto-detect target-string hysteresis state.
  const targetHoldRef = useRef(-1)
  const candRef = useRef(-1)
  const candCountRef = useRef(0)
  const lastTargetRef = useRef(-1)
  // Bumped by cleanupAudio so an in-flight async start() can detect it was
  // cancelled (stop / device-switch / unmount) and abandon after its awaits.
  const startGenRef = useRef(0)

  lockedRef.current = lockedString
  deviceIdRef.current = deviceId

  /** Tear down audio nodes/stream/loop without touching status. */
  const cleanupAudio = useCallback(() => {
    startGenRef.current++
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    analyserRef.current = null
    bufRef.current = null
    detectorRef.current = null
    if (ctxRef.current) {
      try {
        void ctxRef.current.close().catch(() => undefined)
      } catch {
        // Context may already be closed/closing; ignore.
      }
      ctxRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    cleanupAudio()
    setReading(null)
    setStatus('idle')
  }, [cleanupAudio])

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      const inputs = list
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Input ${i + 1}` }))
      setDevices(inputs)
    } catch {
      // enumerateDevices can fail before permission; ignore.
    }
  }, [])

  const tick = useCallback(() => {
    const analyser = analyserRef.current
    const ctx = ctxRef.current
    const buf = bufRef.current
    const detector = detectorRef.current
    if (!analyser || !ctx || !buf || !detector) return

    analyser.getFloatTimeDomainData(buf)
    const [freq, clarity] = detector.findPitch(buf, ctx.sampleRate)
    // Only trust clear, in-range readings — this kills the flaky jitter.
    if (clarity >= CLARITY_THRESHOLD && freq >= MIN_FREQ && freq <= MAX_FREQ) {
      const info = analysePitch(freq)

      // Resolve the target string. When auto-detecting, require a new nearest
      // string to persist a couple of frames before switching, so a one-frame
      // octave blip can't flip to the wrong string.
      let target: number
      if (lockedRef.current !== null) {
        target = lockedRef.current
        targetHoldRef.current = -1
        candCountRef.current = 0
      } else {
        const detected = nearestString(freq)
        if (targetHoldRef.current < 0 || detected === targetHoldRef.current) {
          targetHoldRef.current = detected
          candCountRef.current = 0
        } else {
          if (detected === candRef.current) candCountRef.current += 1
          else {
            candRef.current = detected
            candCountRef.current = 1
          }
          if (candCountRef.current >= TARGET_HYSTERESIS) {
            targetHoldRef.current = detected
            candCountRef.current = 0
          }
        }
        target = targetHoldRef.current
      }

      const cents = centsFromString(freq, target)
      // Snap (don't sweep) the needle when the target string changes; otherwise
      // smooth it. inTune uses the SAME smoothed value the needle shows.
      if (target !== lastTargetRef.current) {
        centsSmoothRef.current = cents
        lastTargetRef.current = target
      }
      centsSmoothRef.current = centsSmoothRef.current * 0.7 + cents * 0.3
      const shown = Math.round(centsSmoothRef.current)
      setReading({
        frequency: Math.round(freq * 10) / 10,
        note: info.note,
        octave: info.octave,
        targetString: target,
        cents: shown,
        inTune: Math.abs(shown) <= IN_TUNE_CENTS,
      })
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const start = useCallback(async () => {
    setErrorMsg(null)

    if (!window.isSecureContext) {
      setStatus('unsupported')
      setErrorMsg(
        'The mic needs a secure page (https:// or localhost) — it can’t run from a file:// page.',
      )
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      setErrorMsg('This browser doesn’t support microphone input.')
      return
    }

    setStatus('requesting')
    // Token for this start(); cleanupAudio() bumps the counter, so if we're
    // cancelled (stop / device-switch / unmount) mid-await we abandon below
    // instead of rebuilding a leaked context + zombie loop.
    const gen = ++startGenRef.current
    let stream: MediaStream | null = null
    try {
      const id = deviceIdRef.current
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: id ? { exact: id } : undefined,
          // Disable processing that would distort the raw pitch.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      if (gen !== startGenRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      const w = window as WebAudioWindow
      const Ctor = w.AudioContext ?? w.webkitAudioContext
      if (!Ctor) {
        stream.getTracks().forEach((t) => t.stop())
        setStatus('unsupported')
        setErrorMsg('This browser doesn’t support Web Audio.')
        return
      }
      const ctx = new Ctor()
      await ctx.resume()
      if (gen !== startGenRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        void ctx.close().catch(() => undefined)
        return
      }

      const source = ctx.createMediaStreamSource(stream)
      // Boost the mic into the analyser so quietly-recorded strings still clear
      // the detection gate (the analyser isn't routed to output, so no sound).
      const gain = ctx.createGain()
      gain.gain.value = INPUT_GAIN
      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      source.connect(gain)
      gain.connect(analyser)

      streamRef.current = stream
      ctxRef.current = ctx
      analyserRef.current = analyser
      bufRef.current = new Float32Array(analyser.fftSize)
      detectorRef.current = PitchDetector.forFloat32Array(analyser.fftSize)
      centsSmoothRef.current = 0
      targetHoldRef.current = -1
      candRef.current = -1
      candCountRef.current = 0
      lastTargetRef.current = -1

      setStatus('listening')
      void refreshDevices()
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      if (stream) stream.getTracks().forEach((t) => t.stop())
      const name = (err as DOMException)?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied')
        setErrorMsg(
          'Microphone permission was blocked. Allow it in your browser and try again.',
        )
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setStatus('error')
        setErrorMsg('No usable microphone / audio input was found.')
      } else {
        setStatus('error')
        setErrorMsg('Couldn’t start the microphone.')
      }
    }
  }, [cleanupAudio, refreshDevices, tick])

  // Restart with the new input when the device changes mid-session.
  const restartForDevice = useCallback(() => {
    cleanupAudio()
    setReading(null)
    void start()
  }, [cleanupAudio, start])

  const isListeningRef = useRef(false)
  isListeningRef.current = status === 'listening'
  useEffect(() => {
    // Restart with the new input only while actively listening (skips mount/idle).
    if (isListeningRef.current) restartForDevice()
  }, [deviceId, restartForDevice])

  // Populate the input list on mount and keep it fresh as devices come and go.
  useEffect(() => {
    void refreshDevices()
    const md = navigator.mediaDevices
    if (!md?.addEventListener) return
    const handler = () => void refreshDevices()
    md.addEventListener('devicechange', handler)
    return () => md.removeEventListener('devicechange', handler)
  }, [refreshDevices])

  // Stop everything on unmount.
  useEffect(() => cleanupAudio, [cleanupAudio])

  return {
    status,
    reading,
    devices,
    deviceId,
    setDeviceId,
    lockedString,
    setLockedString,
    errorMsg,
    start,
    stop,
  }
}
