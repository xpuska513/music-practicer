import { useCallback, useEffect, useRef, useState } from 'react'
import { DRUM_VOICES, stepCount } from '../theory/drums'
import type { DrumPattern } from '../theory/drums'
import { triggerDrum } from './drumKit'

/** How often (ms) the scheduler wakes up to look ahead. */
const LOOKAHEAD_MS = 25
/** How far (seconds) ahead of the audio clock we schedule steps. */
const SCHEDULE_AHEAD_TIME = 0.1
/** Small delay (seconds) before the first step, easing in past resume(). */
const START_OFFSET = 0.1

/** Window's possibly-prefixed AudioContext constructor (no `any`). */
type AudioContextCtor = typeof AudioContext
interface WebkitWindow {
  webkitAudioContext?: AudioContextCtor
}

function createAudioContext(): AudioContext {
  const Ctor: AudioContextCtor =
    typeof AudioContext !== 'undefined'
      ? AudioContext
      : ((window as unknown as WebkitWindow).webkitAudioContext as AudioContextCtor)
  return new Ctor()
}

export interface DrumSequencerControls {
  isPlaying: boolean
  /** 0-based index of the currently sounding step, or -1 when stopped. */
  currentStep: number
  toggle: () => void
  stop: () => void
}

/**
 * Drives step-sequencer playback for a drum pattern using the same
 * "A Tale of Two Clocks" lookahead scheduler as the metronome: a coarse
 * setInterval schedules sample-accurate hits slightly ahead of the audio clock.
 *
 * The latest pattern is held in a ref refreshed every render, so tempo changes
 * and grid edits apply live without restarting playback.
 */
export default function useDrumSequencer(
  pattern: DrumPattern,
): DrumSequencerControls {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)

  // Latest pattern kept in a ref so the long-lived scheduler closure always
  // reads fresh bpm/subdivision/hits without restarting.
  const patternRef = useRef(pattern)
  patternRef.current = pattern

  // Audio + scheduling state.
  const audioCtxRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextNoteTimeRef = useRef(0)
  const stepRef = useRef(0)
  /** Pending UI timeouts so we can cancel them on stop/unmount. */
  const uiTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([])
  /** Playback generation — bumped on start/stop so already-queued playhead
   *  callbacks from an old session can't relight a cell after stopping. */
  const genRef = useRef(0)

  const clearUiTimeouts = useCallback((): void => {
    for (const handle of uiTimeoutsRef.current) clearTimeout(handle)
    uiTimeoutsRef.current = []
  }, [])

  /** The scheduler tick: schedule every step falling inside the lookahead. */
  const scheduler = useCallback((): void => {
    const audioCtx = audioCtxRef.current
    if (!audioCtx) return

    while (nextNoteTimeRef.current < audioCtx.currentTime + SCHEDULE_AHEAD_TIME) {
      const p = patternRef.current
      const steps = stepCount(p)

      // Guard against a 0-length pattern: nothing to schedule, bail to avoid
      // a busy loop / divide-by-zero.
      if (steps <= 0) return

      // Clamp the running step into range when the pattern shrinks.
      if (stepRef.current >= steps) stepRef.current = 0
      const step = stepRef.current
      const noteTime = nextNoteTimeRef.current

      // 1) Sample-accurate audio for every voice that hits this step.
      for (const voice of DRUM_VOICES) {
        if (p.hits[voice.id][step]) {
          triggerDrum(audioCtx, voice.id, noteTime)
        }
      }

      // 2) UI playhead aligned with the audible hit. Tag with the current
      //    playback generation so a queued callback can't fire after stop().
      const delayMs = (noteTime - audioCtx.currentTime) * 1000
      const gen = genRef.current
      const handle = setTimeout(
        () => {
          if (gen === genRef.current) setCurrentStep(step)
          uiTimeoutsRef.current = uiTimeoutsRef.current.filter(
            (h) => h !== handle,
          )
        },
        Math.max(0, delayMs),
      )
      uiTimeoutsRef.current.push(handle)

      // 3) Advance the clock and the step, using the LATEST tempo/subdivision.
      const stepInterval = 60 / p.bpm / p.subdivision
      nextNoteTimeRef.current = noteTime + stepInterval

      const nextStep = step + 1
      stepRef.current = nextStep >= steps ? 0 : nextStep
    }
  }, [])

  const start = useCallback((): void => {
    if (intervalRef.current !== null) return
    if (stepCount(patternRef.current) <= 0) return

    // Lazily create the single AudioContext; resume to satisfy autoplay policy.
    let audioCtx = audioCtxRef.current
    if (!audioCtx) {
      audioCtx = createAudioContext()
      audioCtxRef.current = audioCtx
    }
    void audioCtx.resume()

    stepRef.current = 0
    nextNoteTimeRef.current = audioCtx.currentTime + START_OFFSET

    genRef.current += 1
    setIsPlaying(true)
    intervalRef.current = setInterval(scheduler, LOOKAHEAD_MS)
  }, [scheduler])

  const stop = useCallback((): void => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    clearUiTimeouts()
    genRef.current += 1
    setIsPlaying(false)
    setCurrentStep(-1)
  }, [clearUiTimeouts])

  const toggle = useCallback((): void => {
    if (intervalRef.current !== null) stop()
    else start()
  }, [start, stop])

  // Tear down timers (and any pending UI updates) on unmount.
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      clearUiTimeouts()
      // Release the AudioContext so remounting screens don't exhaust the
      // browser's small concurrent-context limit. Re-created lazily on start().
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => undefined)
        audioCtxRef.current = null
      }
    }
  }, [clearUiTimeouts])

  return { isPlaying, currentStep, toggle, stop }
}

export { useDrumSequencer }
