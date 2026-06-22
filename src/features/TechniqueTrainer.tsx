import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useMetronome from '../audio/useMetronome'
import { usePersistentState } from '../lib/usePersistentState'
import { TECHNIQUES } from '../theory/techniques'
import type { Technique } from '../theory/techniques'
import './TechniqueTrainer.css'

const BEATS_PER_MEASURE = 4
const MIN_BPM = 40
const MAX_BPM = 280

/** "+BPM per bump" options for the speed trainer. */
const STEP_OPTIONS = [2, 5, 10] as const
/** "every N bars" options for the speed trainer. */
const EVERY_OPTIONS = [1, 2, 4] as const

/** Human labels for subdivision (ticks per beat). */
const SUB_LABELS: Record<number, string> = {
  1: '¼ notes',
  2: '8ths',
  3: 'Triplets',
  4: '16ths',
  6: 'Sextuplets',
}
const subLabel = (n: number): string => SUB_LABELS[n] ?? `${n}/beat`

// Validators for persisted settings.
const isBpm = (v: unknown): v is number =>
  typeof v === 'number' && v >= MIN_BPM && v <= MAX_BPM
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isStep = (v: unknown): v is number =>
  typeof v === 'number' && (STEP_OPTIONS as readonly number[]).includes(v)
const isEvery = (v: unknown): v is number =>
  typeof v === 'number' && (EVERY_OPTIONS as readonly number[]).includes(v)

/**
 * Metronome-driven technique speed-trainer. Defaults to the guitar
 * {@link TECHNIQUES}; pass a different `techniques` set (e.g. bass) plus a
 * `storagePrefix` to run an independent, separately-persisted instance.
 */
export default function TechniqueTrainer({
  techniques = TECHNIQUES,
  storagePrefix = '',
}: {
  techniques?: Technique[]
  storagePrefix?: string
} = {}) {
  // Validate a persisted technique id against THIS instance's set, so a guitar
  // id can't leak into the bass trainer (or vice versa).
  const isTechniqueId = (v: unknown): v is string =>
    typeof v === 'string' && techniques.some((t) => t.id === v)

  // ── Persisted setup ───────────────────────────────────────────────────────
  const [techniqueId, setTechniqueId] = usePersistentState<string>(
    `${storagePrefix}tt:technique`,
    techniques[0].id,
    isTechniqueId,
  )
  const [bpm, setBpm] = usePersistentState<number>(`${storagePrefix}tt:bpm`, 80, isBpm)
  const [goalBpm, setGoalBpm] = usePersistentState<number>(
    `${storagePrefix}tt:goal`,
    160,
    isBpm,
  )
  const [speedEnabled, setSpeedEnabled] = usePersistentState<boolean>(
    `${storagePrefix}tt:speed`,
    false,
    isBool,
  )
  const [stepBpm, setStepBpm] = usePersistentState<number>(
    `${storagePrefix}tt:step`,
    5,
    isStep,
  )
  const [everyBars, setEveryBars] = usePersistentState<number>(
    `${storagePrefix}tt:every`,
    2,
    isEvery,
  )

  const technique = useMemo(
    () => techniques.find((t) => t.id === techniqueId) ?? techniques[0],
    [techniques, techniqueId],
  )

  // Subdivision is transient: it follows the technique's default and can be
  // tweaked per session, but isn't persisted across technique switches.
  const [subdivision, setSubdivision] = useState(technique.defaultSubdivision)
  useEffect(() => {
    setSubdivision(technique.defaultSubdivision)
  }, [technique])

  const [barsElapsed, setBarsElapsed] = useState(0)

  const { isPlaying, currentBeat, toggle, setBpm: setMetroBpm } = useMetronome({
    bpm,
    beatsPerMeasure: BEATS_PER_MEASURE,
    subdivision,
  })

  // Keep the engine tempo in sync with the slider / speed-trainer.
  useEffect(() => {
    setMetroBpm(bpm)
  }, [bpm, setMetroBpm])

  // ── Refs for the bar-driven speed trainer (avoid stale closures) ───────────
  const prevBeatRef = useRef(-1)
  const barCountRef = useRef(0)
  const bpmRef = useRef(bpm)
  const goalRef = useRef(goalBpm)
  const stepRef = useRef(stepBpm)
  const everyRef = useRef(everyBars)
  const speedRef = useRef(speedEnabled)

  bpmRef.current = bpm
  goalRef.current = goalBpm
  stepRef.current = stepBpm
  everyRef.current = everyBars
  speedRef.current = speedEnabled

  // Watch bar boundaries: count bars and ramp the tempo when enabled.
  useEffect(() => {
    if (!isPlaying) return
    if (currentBeat < 0) return
    const prev = prevBeatRef.current
    prevBeatRef.current = currentBeat

    // A bar completes when the beat returns to 0 from a later beat.
    if (currentBeat === 0 && prev > 0) {
      setBarsElapsed((b) => b + 1)
      if (speedRef.current) {
        barCountRef.current += 1
        if (barCountRef.current >= everyRef.current) {
          barCountRef.current = 0
          const cur = bpmRef.current
          if (cur < goalRef.current) {
            setBpm(Math.min(goalRef.current, cur + stepRef.current))
          }
        }
      }
    }
  }, [currentBeat, isPlaying, setBpm])

  const handleToggle = useCallback(() => {
    if (!isPlaying) {
      prevBeatRef.current = -1
      barCountRef.current = 0
      setBarsElapsed(0)
    }
    toggle()
  }, [isPlaying, toggle])

  /** Apply this technique's suggested speed-trainer range in one click. */
  const useSuggested = useCallback(() => {
    setBpm(technique.startBpm)
    setGoalBpm(technique.goalBpm)
    setSpeedEnabled(true)
  }, [technique, setBpm, setGoalBpm, setSpeedEnabled])

  // ── Derived display values ─────────────────────────────────────────────────
  const notesPerSecond = ((bpm / 60) * subdivision).toFixed(1)
  const atGoal = speedEnabled && bpm >= goalBpm
  const goalProgress = Math.min(1, Math.max(0, bpm / Math.max(goalBpm, 1)))

  return (
    <div className="technique-trainer col">
      {/* ── Setup ────────────────────────────────────────────────────────── */}
      <section className="panel col">
        <div className="control">
          <label htmlFor="tt-technique">Technique</label>
          <select
            id="tt-technique"
            value={technique.id}
            onChange={(e) => setTechniqueId(e.target.value)}
          >
            {techniques.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>
        </div>

        <p className="tt-summary">{technique.summary}</p>

        <div className="tt-tips">
          <span className="muted tt-section-label">Tips</span>
          <ul>
            {technique.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>

        <div className="tt-exercise">
          <span className="muted tt-section-label">Exercise</span>
          <pre className="mono">{technique.exercise}</pre>
        </div>

        <div className="control">
          <label id="tt-sub-label">
            Picking guide{' '}
            <span className="muted">· {subLabel(subdivision)}</span>
          </label>
          <div className="chip-row" role="group" aria-labelledby="tt-sub-label">
            {technique.subdivisions.map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                aria-pressed={subdivision === s}
                onClick={() => setSubdivision(s)}
              >
                {subLabel(s)}
              </button>
            ))}
          </div>
        </div>

        <div className="control">
          <label htmlFor="tt-bpm">
            Tempo <span className="mono tt-bpm-readout">{bpm} BPM</span>
          </label>
          <input
            id="tt-bpm"
            type="range"
            min={MIN_BPM}
            max={MAX_BPM}
            step={1}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
        </div>

        {/* ── Speed trainer ──────────────────────────────────────────────── */}
        <div className="control tt-speed">
          <div className="chip-row" role="group" aria-label="Speed trainer">
            <button
              type="button"
              className="chip"
              aria-pressed={speedEnabled}
              onClick={() => setSpeedEnabled((v) => !v)}
            >
              🚀 Speed trainer
            </button>
            <button
              type="button"
              className="chip"
              onClick={useSuggested}
              title={`Set ${technique.startBpm}→${technique.goalBpm} BPM`}
            >
              Suggested {technique.startBpm}→{technique.goalBpm}
            </button>
          </div>

          {speedEnabled ? (
            <div className="tt-speed-config col">
              <label htmlFor="tt-goal">
                Goal <span className="mono">{goalBpm} BPM</span>
              </label>
              <input
                id="tt-goal"
                type="range"
                min={MIN_BPM}
                max={MAX_BPM}
                step={1}
                value={goalBpm}
                onChange={(e) => setGoalBpm(Number(e.target.value))}
              />
              <div className="tt-speed-row">
                <span className="muted">+BPM</span>
                <div className="chip-row">
                  {STEP_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="chip"
                      aria-pressed={stepBpm === s}
                      onClick={() => setStepBpm(s)}
                    >
                      +{s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="tt-speed-row">
                <span className="muted">every</span>
                <div className="chip-row">
                  {EVERY_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="chip"
                      aria-pressed={everyBars === n}
                      onClick={() => setEveryBars(n)}
                    >
                      {n} {n === 1 ? 'bar' : 'bars'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className={`btn ${isPlaying ? '' : 'btn-primary'} tt-start`}
          onClick={handleToggle}
        >
          {isPlaying ? 'Stop' : 'Start'}
        </button>
      </section>

      {/* ── Live readout ─────────────────────────────────────────────────── */}
      <section className="panel tt-stage col">
        <div className="tt-live">
          <div className="tt-bpm-big">
            <span className="mono">{bpm}</span>
            <span className="muted tt-bpm-big-unit">BPM</span>
          </div>
          <div className="tt-rate muted">
            {subLabel(subdivision)} · <span className="mono">{notesPerSecond}</span> notes/sec
          </div>
        </div>

        <div className="tt-beats" aria-hidden="true">
          {Array.from({ length: BEATS_PER_MEASURE }, (_, b) => (
            <span
              key={b}
              className={
                'tt-beat-dot' +
                (isPlaying && b === currentBeat ? ' is-active' : '') +
                (b === 0 ? ' is-accent' : '')
              }
            />
          ))}
        </div>

        {speedEnabled ? (
          <div className="tt-speed-status col">
            <div className="tt-speed-line">
              <span className="muted">Speed trainer</span>
              <span className="mono">
                {atGoal ? '🎯 Goal reached' : `${bpm} → ${goalBpm} BPM`}
              </span>
            </div>
            <div
              className="tt-goal-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={Number(goalProgress.toFixed(2))}
            >
              <div className="tt-goal-fill" style={{ width: `${goalProgress * 100}%` }} />
            </div>
            <span className="muted tt-bars">
              {barsElapsed} {barsElapsed === 1 ? 'bar' : 'bars'} · +{stepBpm} BPM every{' '}
              {everyBars} {everyBars === 1 ? 'bar' : 'bars'}
            </span>
          </div>
        ) : (
          <span className="muted tt-bars">{barsElapsed} {barsElapsed === 1 ? 'bar' : 'bars'} elapsed</span>
        )}
      </section>
    </div>
  )
}
