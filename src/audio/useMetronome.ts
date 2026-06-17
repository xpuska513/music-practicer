import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  BeatInfo,
  MetronomeControls,
  MetronomeOptions,
} from '../types'

/** Lower/upper bounds for tempo. */
const MIN_BPM = 30
const MAX_BPM = 300

/** How often (ms) the scheduler wakes up to look ahead. */
const LOOKAHEAD_MS = 25
/** How far (seconds) ahead of the audio clock we schedule clicks. */
const SCHEDULE_AHEAD_TIME = 0.1

/** Click envelope timing (seconds). */
const CLICK_DURATION = 0.05
/** Frequencies (Hz) for accented vs. normal beats. */
const ACCENT_FREQ = 1500
const NORMAL_FREQ = 1000
/** Peak gain for accented vs. normal beats. */
const ACCENT_GAIN = 0.6
const NORMAL_GAIN = 0.5
/** Subdivision "tick": higher-pitched and quieter than the main beat. */
const SUB_FREQ = 2000
const SUB_GAIN = 0.22

const clampBpm = (bpm: number): number =>
  Math.min(MAX_BPM, Math.max(MIN_BPM, bpm))

const clampBeats = (n: number): number => Math.max(1, Math.round(n))

/**
 * A precise metronome built on the Web Audio API using the "A Tale of Two
 * Clocks" lookahead scheduler: a coarse setInterval timer schedules sample-
 * accurate clicks slightly ahead of the audio clock, so timing never drifts.
 *
 * bpm / beatsPerMeasure / onBeat can all be changed live without restarting.
 */
export default function useMetronome(
  options: MetronomeOptions = {},
): MetronomeControls {
  const {
    bpm: initialBpm = 120,
    beatsPerMeasure: initialBeatsPerMeasure = 4,
    accentFirst: initialAccentFirst = true,
    subdivision: subdivisionOption = 1,
    onBeat: initialOnBeat,
  } = options

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentBeat, setCurrentBeat] = useState(-1)
  const [bpm, setBpmState] = useState(() => clampBpm(initialBpm))
  const [beatsPerMeasure, setBeatsPerMeasureState] = useState(() =>
    clampBeats(initialBeatsPerMeasure),
  )

  // Live values kept in refs so the long-lived scheduler closure never reads
  // stale state.
  const bpmRef = useRef(bpm)
  const beatsPerMeasureRef = useRef(beatsPerMeasure)
  const accentFirstRef = useRef(initialAccentFirst)
  const subdivisionRef = useRef(1)
  const onBeatRef = useRef<MetronomeOptions['onBeat']>(initialOnBeat)

  bpmRef.current = bpm
  beatsPerMeasureRef.current = beatsPerMeasure
  accentFirstRef.current = initialAccentFirst
  subdivisionRef.current = Math.max(1, Math.round(subdivisionOption))
  onBeatRef.current = initialOnBeat

  // Audio + scheduling state.
  const audioCtxRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextNoteTimeRef = useRef(0)
  const beatRef = useRef(0)
  const measureRef = useRef(0)
  /** Pending UI timeouts so we can cancel them on stop/unmount. */
  const uiTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([])

  /** Emit a single percussive click at the given audio-context time. */
  const scheduleClick = useCallback(
    (audioCtx: AudioContext, time: number, freq: number, peak: number): void => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()

      osc.frequency.value = freq

      gain.gain.setValueAtTime(peak, time)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + CLICK_DURATION)

      osc.connect(gain)
      gain.connect(audioCtx.destination)

      osc.start(time)
      osc.stop(time + CLICK_DURATION)
    },
    [],
  )

  /** The scheduler tick: schedule every beat falling inside the lookahead. */
  const scheduler = useCallback((): void => {
    const audioCtx = audioCtxRef.current
    if (!audioCtx) return

    while (
      nextNoteTimeRef.current <
      audioCtx.currentTime + SCHEDULE_AHEAD_TIME
    ) {
      const noteTime = nextNoteTimeRef.current
      const beat = beatRef.current
      const measure = measureRef.current
      const isAccent = accentFirstRef.current && beat === 0

      // 1) Sample-accurate audio click for the main beat.
      scheduleClick(
        audioCtx,
        noteTime,
        isAccent ? ACCENT_FREQ : NORMAL_FREQ,
        isAccent ? ACCENT_GAIN : NORMAL_GAIN,
      )

      // 2) onBeat callback (consumer decides what to do with audio time).
      onBeatRef.current?.({ beat, measure, time: noteTime } satisfies BeatInfo)

      // 3) UI state update aligned with the audible click.
      const delayMs = (noteTime - audioCtx.currentTime) * 1000
      const handle = setTimeout(
        () => {
          setCurrentBeat(beat)
          uiTimeoutsRef.current = uiTimeoutsRef.current.filter(
            (h) => h !== handle,
          )
        },
        Math.max(0, delayMs),
      )
      uiTimeoutsRef.current.push(handle)

      // 4) Subdivision ticks spaced evenly until the next beat.
      const secondsPerBeat = 60 / bpmRef.current
      const subdivision = subdivisionRef.current
      if (subdivision > 1) {
        const subInterval = secondsPerBeat / subdivision
        for (let k = 1; k < subdivision; k += 1) {
          scheduleClick(audioCtx, noteTime + k * subInterval, SUB_FREQ, SUB_GAIN)
        }
      }

      // 5) Advance to the next beat / measure.
      nextNoteTimeRef.current = noteTime + secondsPerBeat

      const nextBeat = beat + 1
      if (nextBeat >= beatsPerMeasureRef.current) {
        beatRef.current = 0
        measureRef.current = measure + 1
      } else {
        beatRef.current = nextBeat
      }
    }
  }, [scheduleClick])

  const clearUiTimeouts = useCallback((): void => {
    for (const handle of uiTimeoutsRef.current) clearTimeout(handle)
    uiTimeoutsRef.current = []
  }, [])

  const start = useCallback((): void => {
    if (intervalRef.current !== null) return

    // Lazily create the single AudioContext; resume to satisfy autoplay policy.
    let audioCtx = audioCtxRef.current
    if (!audioCtx) {
      audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
    }
    void audioCtx.resume()

    beatRef.current = 0
    measureRef.current = 0
    nextNoteTimeRef.current = audioCtx.currentTime + 0.1

    setIsPlaying(true)
    intervalRef.current = setInterval(scheduler, LOOKAHEAD_MS)
  }, [scheduler])

  const stop = useCallback((): void => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    clearUiTimeouts()
    setIsPlaying(false)
    setCurrentBeat(-1)
  }, [clearUiTimeouts])

  const toggle = useCallback((): void => {
    if (intervalRef.current !== null) stop()
    else start()
  }, [start, stop])

  const setBpm = useCallback((next: number): void => {
    setBpmState(clampBpm(next))
  }, [])

  const setBeatsPerMeasure = useCallback((next: number): void => {
    setBeatsPerMeasureState(clampBeats(next))
  }, [])

  // Tear down timers (and any pending UI updates) on unmount.
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      clearUiTimeouts()
    }
  }, [clearUiTimeouts])

  return {
    isPlaying,
    currentBeat,
    bpm,
    beatsPerMeasure,
    start,
    stop,
    toggle,
    setBpm,
    setBeatsPerMeasure,
  }
}

export { useMetronome }
