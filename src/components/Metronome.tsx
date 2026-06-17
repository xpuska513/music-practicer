import { useCallback, useEffect, useRef } from 'react'
import useMetronome from '../audio/useMetronome'
import { usePersistentState } from '../lib/usePersistentState'
import './Metronome.css'

/** Tempo bounds (mirror the hook's clamp range). */
const MIN_BPM = 30
const MAX_BPM = 300

/** Quick-jump tempo presets. */
const BPM_PRESETS: readonly number[] = [60, 90, 120, 160]

/** Selectable time-signature top numbers. */
const BEAT_OPTIONS: readonly number[] = [2, 3, 4, 6]

/** Subdivision options: clicks per beat, with a friendly label. */
const SUBDIVISIONS: { value: number; label: string }[] = [
  { value: 1, label: 'None' },
  { value: 2, label: '8ths' },
  { value: 3, label: 'Triplets' },
  { value: 4, label: '16ths' },
]

/** Discard the tap history if the gap between taps exceeds this (ms). */
const TAP_RESET_MS = 2000
/** How many recent taps to average. */
const MAX_TAPS = 4

const clampBpm = (bpm: number): number =>
  Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)))

// Validators so a stale/corrupt persisted value can't poison the UI.
const isBpm = (v: unknown): v is number =>
  typeof v === 'number' && v >= MIN_BPM && v <= MAX_BPM
const isBeats = (v: unknown): v is number =>
  typeof v === 'number' && BEAT_OPTIONS.includes(v)
const isSubdivision = (v: unknown): v is number =>
  typeof v === 'number' && SUBDIVISIONS.some((s) => s.value === v)

/**
 * Standalone metronome panel: tempo control (readout, +/-, slider, presets,
 * tap tempo), time-signature + subdivision selectors, transport, and a live
 * beat indicator. All settings persist across sessions.
 */
export default function Metronome() {
  // Persisted settings own the source of truth; the hook is synced from them.
  const [bpm, setBpm] = usePersistentState('metro:bpm', 120, isBpm)
  const [beatsPerMeasure, setBeatsPerMeasure] = usePersistentState(
    'metro:beats',
    4,
    isBeats,
  )
  const [subdivision, setSubdivision] = usePersistentState('metro:sub', 1, isSubdivision)

  const {
    isPlaying,
    currentBeat,
    toggle,
    setBpm: setMetroBpm,
    setBeatsPerMeasure: setMetroBeats,
  } = useMetronome({ bpm, beatsPerMeasure, subdivision })

  // Keep the engine in sync with the persisted controls.
  useEffect(() => {
    setMetroBpm(bpm)
  }, [bpm, setMetroBpm])
  useEffect(() => {
    setMetroBeats(beatsPerMeasure)
  }, [beatsPerMeasure, setMetroBeats])

  /** Timestamps (performance.now()) of recent taps, newest last. */
  const tapTimesRef = useRef<number[]>([])

  const nudgeBpm = useCallback(
    (delta: number) => setBpm((b) => clampBpm(b + delta)),
    [setBpm],
  )

  const handleSlider = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setBpm(clampBpm(Number(event.target.value)))
    },
    [setBpm],
  )

  const handleTap = useCallback(() => {
    const now = performance.now()
    const taps = tapTimesRef.current
    const last = taps[taps.length - 1]

    if (last !== undefined && now - last > TAP_RESET_MS) {
      taps.length = 0
    }

    taps.push(now)
    if (taps.length > MAX_TAPS) taps.shift()

    if (taps.length >= 2) {
      let totalGap = 0
      for (let i = 1; i < taps.length; i += 1) {
        totalGap += taps[i] - taps[i - 1]
      }
      const avgGap = totalGap / (taps.length - 1)
      if (avgGap > 0) setBpm(clampBpm(60000 / avgGap))
    }
  }, [setBpm])

  return (
    <section className="panel metronome">
      <div className="metronome-tempo">
        <div className="metronome-bpm">
          <span className="mono metronome-bpm-value">{bpm}</span>
          <span className="metronome-bpm-unit">BPM</span>
        </div>

        <div className="metronome-nudge">
          <button
            type="button"
            className="btn btn-icon"
            aria-label="Decrease tempo"
            onClick={() => nudgeBpm(-1)}
            disabled={bpm <= MIN_BPM}
          >
            −
          </button>
          <button
            type="button"
            className="btn btn-icon"
            aria-label="Increase tempo"
            onClick={() => nudgeBpm(1)}
            disabled={bpm >= MAX_BPM}
          >
            +
          </button>
        </div>
      </div>

      <input
        className="metronome-slider"
        type="range"
        min={MIN_BPM}
        max={MAX_BPM}
        step={1}
        value={bpm}
        onChange={handleSlider}
        aria-label="Tempo in beats per minute"
      />

      <div className="control">
        <label>Presets</label>
        <div className="chip-row">
          {BPM_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="chip"
              aria-pressed={bpm === preset}
              onClick={() => setBpm(preset)}
            >
              {preset}
            </button>
          ))}
          <button type="button" className="chip metronome-tap" onClick={handleTap}>
            Tap
          </button>
        </div>
      </div>

      <div className="control">
        <label>Time signature</label>
        <div className="chip-row">
          {BEAT_OPTIONS.map((beats) => (
            <button
              key={beats}
              type="button"
              className="chip"
              aria-pressed={beatsPerMeasure === beats}
              onClick={() => setBeatsPerMeasure(beats)}
            >
              {beats}/4
            </button>
          ))}
        </div>
      </div>

      <div className="control">
        <label>Subdivision</label>
        <div className="chip-row">
          {SUBDIVISIONS.map((sub) => (
            <button
              key={sub.value}
              type="button"
              className="chip"
              aria-pressed={subdivision === sub.value}
              onClick={() => setSubdivision(sub.value)}
            >
              {sub.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="metronome-beats"
        role="img"
        aria-label={`Beat ${currentBeat >= 0 ? currentBeat + 1 : 0} of ${beatsPerMeasure}`}
      >
        {Array.from({ length: beatsPerMeasure }, (_, index) => {
          const active = isPlaying && index === currentBeat
          return (
            <span
              key={index}
              className={
                'metronome-dot' +
                (active ? ' is-active' : '') +
                (index === 0 ? ' is-downbeat' : '')
              }
            />
          )
        })}
      </div>

      <button
        type="button"
        className="btn btn-primary metronome-transport"
        onClick={toggle}
        aria-pressed={isPlaying}
      >
        {isPlaying ? 'Stop' : 'Start'}
      </button>
    </section>
  )
}
