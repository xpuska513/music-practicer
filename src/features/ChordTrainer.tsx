import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CHORDS, chordShapeToRender } from '../theory/chords'
import { PROGRESSIONS } from '../theory/progressions'
import Fretboard from '../components/Fretboard'
import { useMetronome } from '../audio/useMetronome'
import { useCustomChords } from '../theory/useCustomChords'
import { usePersistentState } from '../lib/usePersistentState'
import { chordMidis, playChord, resumeAudio } from '../audio/synth'
import { noteAt, pitchClassOf } from '../theory/notes'
import type { ChordDef } from '../types'
import './ChordTrainer.css'

/** Difficulty filter options shown as chips. */
type DifficultyFilter = 'all' | ChordDef['difficulty']

const DIFFICULTY_FILTERS: { id: DifficultyFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'custom', label: 'Custom' },
]

type Mode = 'random' | 'progression'

/** How the chord is voiced when auto-played. */
type StrumStyle = 'down' | 'up' | 'arp' | 'beat'
const STRUM_OPTIONS: { id: StrumStyle; label: string }[] = [
  { id: 'down', label: 'Strum ↓' },
  { id: 'up', label: 'Strum ↑' },
  { id: 'arp', label: 'Arpeggio' },
  { id: 'beat', label: 'Per-beat ↓↑' },
]

/** Selectable "measures per chord" values. */
const MEASURES_OPTIONS = [1, 2, 4] as const

const BEATS_PER_MEASURE = 4
const MIN_BPM = 40
const MAX_BPM = 200
const STRUM_SPREAD = 0.035 // seconds between strummed notes
const ARP_SPREAD = 0.16 // wider spacing for arpeggios

type Phase = 'idle' | 'countin' | 'playing'

// Validators so a stale/corrupt persisted value can't poison the UI state.
const isMode = (v: unknown): v is Mode => v === 'random' || v === 'progression'
const isDifficulty = (v: unknown): v is DifficultyFilter =>
  typeof v === 'string' && DIFFICULTY_FILTERS.some((d) => d.id === v)
const isStrum = (v: unknown): v is StrumStyle => STRUM_OPTIONS.some((s) => s.id === v)
const isProgressionId = (v: unknown): v is string =>
  typeof v === 'string' && PROGRESSIONS.some((p) => p.id === v)
const isBpm = (v: unknown): v is number =>
  typeof v === 'number' && v >= MIN_BPM && v <= MAX_BPM
const isMeasures = (v: unknown): v is number =>
  typeof v === 'number' && (MEASURES_OPTIONS as readonly number[]).includes(v)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'

/** Pick a random chord from the pool, avoiding `exceptId` when possible. */
function pickNextChord(pool: ChordDef[], exceptId: string | null): ChordDef | null {
  if (pool.length === 0) return null
  if (pool.length === 1) return pool[0]
  const candidates = exceptId ? pool.filter((c) => c.id !== exceptId) : pool
  const source = candidates.length > 0 ? candidates : pool
  return source[Math.floor(Math.random() * source.length)]
}

/** A compact chord diagram backed by the shared Fretboard component. */
function ChordDiagram({ chord, showLabels }: { chord: ChordDef; showLabels: boolean }) {
  const render = useMemo(() => chordShapeToRender(chord.shape), [chord.shape])
  // chordShapeToRender doesn't know the chord's root, so highlight it here.
  const marks = useMemo(() => {
    const rootPc = pitchClassOf(chord.root)
    return render.marks.map((m) => ({
      ...m,
      isRoot: noteAt(m.string, m.fret) === rootPc,
    }))
  }, [render.marks, chord.root])
  return (
    <Fretboard
      marks={marks}
      mutedStrings={render.mutedStrings}
      startFret={render.startFret}
      fretCount={render.fretCount}
      orientation="vertical"
      showLabels={showLabels}
      showFretNumbers
    />
  )
}

export default function ChordTrainer() {
  const { customChords } = useCustomChords()

  // ── Persisted setup ───────────────────────────────────────────────────────
  const [mode, setMode] = usePersistentState<Mode>('ct:mode', 'random', isMode)
  const [progressionId, setProgressionId] = usePersistentState<string>(
    'ct:progression',
    PROGRESSIONS[0].id,
    isProgressionId,
  )
  const [difficulty, setDifficulty] = usePersistentState<DifficultyFilter>(
    'ct:difficulty',
    'all',
    isDifficulty,
  )
  const [bpm, setBpm] = usePersistentState<number>('ct:bpm', 90, isBpm)
  const [measuresPerChord, setMeasuresPerChord] = usePersistentState<number>(
    'ct:measures',
    2,
    isMeasures,
  )
  const [autoPlay, setAutoPlay] = usePersistentState<boolean>('ct:autoplay', true, isBool)
  const [strumStyle, setStrumStyle] = usePersistentState<StrumStyle>(
    'ct:strum',
    'down',
    isStrum,
  )
  const [countIn, setCountIn] = usePersistentState<boolean>('ct:countin', true, isBool)

  // ── Runtime session state ──────────────────────────────────────────────────
  const [loop, setLoop] = useState(false) // transient practice aid, not persisted
  const [phase, setPhase] = useState<Phase>('idle')
  const [current, setCurrent] = useState<ChordDef | null>(null)
  const [next, setNext] = useState<ChordDef | null>(null)
  const [practicedCount, setPracticedCount] = useState(0)
  // Completed measures within the current chord's window (drives the bar).
  const [measuresDone, setMeasuresDone] = useState(0)

  // Built-in chords plus any the user created in the editor.
  const allChords = useMemo<ChordDef[]>(
    () => [...CHORDS, ...customChords],
    [customChords],
  )

  // Random-mode pool (difficulty filtered).
  const pool = useMemo<ChordDef[]>(
    () =>
      difficulty === 'all'
        ? allChords
        : allChords.filter((c) => c.difficulty === difficulty),
    [allChords, difficulty],
  )

  // Resolve the selected progression's ids to real chord definitions.
  const selectedProgression = useMemo(
    () => PROGRESSIONS.find((p) => p.id === progressionId) ?? PROGRESSIONS[0],
    [progressionId],
  )
  const progressionChords = useMemo<ChordDef[]>(() => {
    const byId = new Map(allChords.map((c) => [c.id, c]))
    return selectedProgression.chordIds
      .map((id) => byId.get(id))
      .filter((c): c is ChordDef => Boolean(c))
  }, [selectedProgression, allChords])

  const metronome = useMetronome({ bpm, beatsPerMeasure: BEATS_PER_MEASURE })
  const { isPlaying, currentBeat, toggle, stop, setBpm: setMetronomeBpm } = metronome

  // Keep the metronome tempo synced with the slider.
  useEffect(() => {
    setMetronomeBpm(bpm)
  }, [bpm, setMetronomeBpm])

  // ── Refs mirroring state for the beat-driven logic (avoid stale closures) ──
  const poolRef = useRef(pool)
  const progressionChordsRef = useRef(progressionChords)
  const progIndexRef = useRef(0)
  const measuresPerChordRef = useRef(measuresPerChord)
  const measureCountRef = useRef(0)
  const prevBeatRef = useRef(-1)
  const currentIdRef = useRef<string | null>(null)
  const currentChordRef = useRef<ChordDef | null>(null)
  const nextRef = useRef<ChordDef | null>(null)
  const modeRef = useRef(mode)
  const autoPlayRef = useRef(autoPlay)
  const strumRef = useRef(strumStyle)
  const loopRef = useRef(loop)
  const phaseRef = useRef<Phase>(phase)

  poolRef.current = pool
  progressionChordsRef.current = progressionChords
  measuresPerChordRef.current = measuresPerChord
  currentIdRef.current = current?.id ?? null
  currentChordRef.current = current
  nextRef.current = next
  modeRef.current = mode
  autoPlayRef.current = autoPlay
  strumRef.current = strumStyle
  loopRef.current = loop
  phaseRef.current = phase

  // Restart the progression from the top whenever the selection changes.
  useEffect(() => {
    progIndexRef.current = 0
  }, [progressionId])

  /** Strum a chord in a given direction, honouring the current style's spread. */
  const strum = useCallback((chord: ChordDef | null, direction: 'down' | 'up') => {
    if (!chord || !autoPlayRef.current) return
    resumeAudio()
    const spread = strumRef.current === 'arp' ? ARP_SPREAD : STRUM_SPREAD
    playChord(chordMidis(chord.shape.frets), { direction, strum: spread })
  }, [])

  /** Strum once, picking the direction from the current style. */
  const strumOnce = useCallback(
    (chord: ChordDef | null) => {
      strum(chord, strumRef.current === 'up' ? 'up' : 'down')
    },
    [strum],
  )

  /** Manual "Hear it" — always sounds regardless of the auto-play toggle. */
  const hearChord = useCallback((chord: ChordDef | null) => {
    if (!chord) return
    resumeAudio()
    const spread = strumRef.current === 'arp' ? ARP_SPREAD : STRUM_SPREAD
    const direction = strumRef.current === 'up' ? 'up' : 'down'
    playChord(chordMidis(chord.shape.frets), { direction, strum: spread })
  }, [])

  /** Advance to the next chord (or re-trigger the current one when looping). */
  const advanceOrLoop = useCallback(() => {
    if (loopRef.current) {
      // Stay on the same chord; re-strum it for another window.
      if (strumRef.current !== 'beat') strumOnce(currentChordRef.current)
      return
    }
    let queued: ChordDef | null
    let upcoming: ChordDef | null
    if (modeRef.current === 'progression') {
      const prog = progressionChordsRef.current
      if (prog.length === 0) return
      const idx = (progIndexRef.current + 1) % prog.length
      progIndexRef.current = idx
      queued = prog[idx]
      upcoming = prog[(idx + 1) % prog.length]
    } else {
      // Reuse the previewed "next" only if it's still in the current pool
      // (the difficulty filter may have changed since it was queued).
      const preview = nextRef.current
      queued =
        preview && poolRef.current.some((c) => c.id === preview.id)
          ? preview
          : pickNextChord(poolRef.current, currentIdRef.current)
      if (!queued) return
      upcoming = pickNextChord(poolRef.current, queued.id)
    }
    // Update synchronous refs so a same-tick per-beat strum sees the new chord.
    currentChordRef.current = queued
    currentIdRef.current = queued.id
    setCurrent(queued)
    setNext(upcoming)
    setPracticedCount((n) => n + 1)
    if (strumRef.current !== 'beat') strumOnce(queued)
  }, [strumOnce])

  // Beat watcher: drives count-in, chord advancement, and per-beat strumming.
  useEffect(() => {
    if (!isPlaying) return
    if (currentBeat < 0) return // only record real (>=0) beats
    const prev = prevBeatRef.current
    prevBeatRef.current = currentBeat
    const newBeat = currentBeat !== prev

    // 1) Measure boundary FIRST, so `current` is up to date before we strum.
    //    A measure completes when the beat returns to 0 from a *later* beat
    //    (1/2/3); the opening downbeat (prev = -1) must NOT count.
    if (currentBeat === 0 && prev > 0) {
      if (phaseRef.current === 'countin') {
        // The count-in bar just finished — start practising now.
        phaseRef.current = 'playing'
        setPhase('playing')
        measureCountRef.current = 0
        setMeasuresDone(0)
        if (strumRef.current !== 'beat') strumOnce(currentChordRef.current)
      } else {
        const completed = measureCountRef.current + 1
        if (completed >= measuresPerChordRef.current) {
          measureCountRef.current = 0
          setMeasuresDone(0)
          advanceOrLoop() // updates currentChordRef synchronously
        } else {
          measureCountRef.current = completed
          setMeasuresDone(completed)
        }
      }
    }

    // 2) Per-beat strumming uses the now-current chord, so a new chord gets a
    //    down-strum on its own downbeat (phaseRef is already 'playing' above).
    if (newBeat && phaseRef.current === 'playing' && strumRef.current === 'beat') {
      strum(currentChordRef.current, currentBeat % 2 === 0 ? 'down' : 'up')
    }
  }, [currentBeat, isPlaying, strum, strumOnce, advanceOrLoop])

  // Reset the chord window if the user changes measures-per-chord mid-session,
  // so the progress bar can't jump past 100%.
  useEffect(() => {
    measureCountRef.current = 0
    setMeasuresDone(0)
  }, [measuresPerChord])

  const progressionEmpty = progressionChords.length === 0
  const poolEmpty = pool.length === 0
  const canStart = mode === 'progression' ? !progressionEmpty : !poolEmpty

  /** Start a fresh practice run (or stop the current one). */
  const handleToggle = useCallback(() => {
    if (isPlaying) {
      stop()
      setPhase('idle')
      phaseRef.current = 'idle'
      return
    }

    let first: ChordDef | null
    let second: ChordDef | null
    if (mode === 'progression') {
      if (progressionChords.length === 0) return
      progIndexRef.current = 0
      first = progressionChords[0]
      second = progressionChords[1 % progressionChords.length]
    } else {
      if (pool.length === 0) return
      first = pickNextChord(pool, null)
      second = pickNextChord(pool, first?.id ?? null)
    }

    setCurrent(first)
    setNext(second)
    setPracticedCount(first ? 1 : 0)
    setMeasuresDone(0)
    measureCountRef.current = 0
    prevBeatRef.current = -1

    const startPhase: Phase = countIn ? 'countin' : 'playing'
    phaseRef.current = startPhase
    setPhase(startPhase)

    resumeAudio()
    // When there's no count-in we're already "playing", so strum the first
    // chord now (unless per-beat, which strums on each beat instead).
    if (startPhase === 'playing' && strumStyle !== 'beat') strumOnce(first)
    toggle()
  }, [
    isPlaying,
    mode,
    progressionChords,
    pool,
    countIn,
    strumStyle,
    strumOnce,
    stop,
    toggle,
  ])

  // If the random-mode pool empties while playing, stop gracefully.
  useEffect(() => {
    if (isPlaying && mode === 'random' && pool.length === 0) {
      stop()
      setPhase('idle')
      phaseRef.current = 'idle'
    }
  }, [isPlaying, mode, pool.length, stop])

  // ── Derived UI values ──────────────────────────────────────────────────────
  const beatInMeasure = currentBeat < 0 ? -1 : currentBeat
  const beatProgress = beatInMeasure < 0 ? 0 : (beatInMeasure + 1) / BEATS_PER_MEASURE
  const windowProgress = !isPlaying
    ? 0
    : phase === 'countin'
      ? beatProgress
      : Math.min(1, (measuresDone + beatProgress) / measuresPerChord)

  return (
    <div className="chord-trainer col">
      {/* ── Setup / controls ─────────────────────────────────────────────── */}
      <section className="panel ct-setup col">
        <div className="control">
          <label id="ct-mode-label">Mode</label>
          <div className="chip-row" role="group" aria-labelledby="ct-mode-label">
            <button
              type="button"
              className="chip"
              aria-pressed={mode === 'random'}
              onClick={() => setMode('random')}
            >
              🎲 Random
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={mode === 'progression'}
              onClick={() => setMode('progression')}
            >
              🎶 Progression
            </button>
          </div>
        </div>

        {mode === 'random' ? (
          <div className="control">
            <label id="ct-difficulty-label">Difficulty</label>
            <div className="chip-row" role="group" aria-labelledby="ct-difficulty-label">
              {DIFFICULTY_FILTERS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className="chip"
                  aria-pressed={difficulty === opt.id}
                  onClick={() => setDifficulty(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="control">
            <label htmlFor="ct-progression">Progression</label>
            <select
              id="ct-progression"
              value={selectedProgression.id}
              onChange={(e) => setProgressionId(e.target.value)}
            >
              {PROGRESSIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="control">
          <label htmlFor="ct-bpm">
            Tempo <span className="mono ct-bpm-readout">{bpm} BPM</span>
          </label>
          <input
            id="ct-bpm"
            type="range"
            min={MIN_BPM}
            max={MAX_BPM}
            step={1}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
        </div>

        <div className="control">
          <label id="ct-measures-label">Measures per chord</label>
          <div className="chip-row" role="group" aria-labelledby="ct-measures-label">
            {MEASURES_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                className="chip"
                aria-pressed={measuresPerChord === m}
                onClick={() => setMeasuresPerChord(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="control">
          <label id="ct-strum-label">Strum</label>
          <div className="chip-row" role="group" aria-labelledby="ct-strum-label">
            {STRUM_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="chip"
                aria-pressed={strumStyle === opt.id}
                onClick={() => setStrumStyle(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="control">
          <label id="ct-options-label">Options</label>
          <div className="chip-row" role="group" aria-labelledby="ct-options-label">
            <button
              type="button"
              className="chip"
              aria-pressed={autoPlay}
              onClick={() => setAutoPlay((v) => !v)}
            >
              🔊 Sound
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={countIn}
              onClick={() => setCountIn((v) => !v)}
            >
              ⏱ Count-in
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={loop}
              onClick={() => setLoop((v) => !v)}
            >
              🔁 Loop chord
            </button>
          </div>
        </div>

        <button
          type="button"
          className={`btn ${isPlaying ? '' : 'btn-primary'} ct-start`}
          onClick={handleToggle}
          disabled={!canStart}
        >
          {isPlaying ? 'Stop' : 'Start practice'}
        </button>

        {!canStart ? (
          <p className="muted ct-empty">
            {mode === 'progression'
              ? 'This progression needs chords that are missing.'
              : difficulty === 'custom'
                ? 'No custom chords yet — make some in the 🛠 Editor tab.'
                : 'No chords match this filter. Pick another to start.'}
          </p>
        ) : null}
      </section>

      {/* ── Practice stage ───────────────────────────────────────────────── */}
      <section className="ct-stage row">
        <div className="panel ct-current col">
          <header className="ct-current-head">
            <span className="muted ct-eyebrow">
              {phase === 'countin'
                ? 'Get ready…'
                : loop && isPlaying
                  ? 'Looping'
                  : 'Now playing'}
            </span>
            <h2 className="ct-current-name">{current ? current.name : '—'}</h2>
            {current ? (
              <span className="muted mono ct-current-meta">{current.quality}</span>
            ) : (
              <span className="muted ct-current-meta">Press start to begin</span>
            )}
            {current ? (
              <button
                type="button"
                className="btn ct-hear"
                onClick={() => hearChord(current)}
              >
                🔊 Hear it
              </button>
            ) : null}
          </header>

          <div className="ct-diagram ct-diagram--big">
            {current ? (
              <ChordDiagram chord={current} showLabels />
            ) : (
              <div className="ct-diagram-placeholder muted">No chord</div>
            )}
          </div>

          {/* Per-measure progress bar / count-in countdown. */}
          <div
            className={`ct-progress${phase === 'countin' ? ' is-countin' : ''}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={Number(windowProgress.toFixed(2))}
          >
            <div className="ct-progress-fill" style={{ width: `${windowProgress * 100}%` }} />
          </div>

          {/* Beat-dot indicator, like the metronome. */}
          <div className="ct-beats" aria-hidden="true">
            {Array.from({ length: BEATS_PER_MEASURE }, (_, b) => (
              <span
                key={b}
                className={
                  'ct-beat-dot' +
                  (b === beatInMeasure ? ' is-active' : '') +
                  (b === 0 ? ' is-accent' : '')
                }
              />
            ))}
          </div>
        </div>

        <div className="panel ct-next col">
          <span className="muted ct-eyebrow">{loop && isPlaying ? 'After loop' : 'Up next'}</span>
          <h3 className="ct-next-name">{next ? next.name : '—'}</h3>
          <div className="ct-diagram ct-diagram--small">
            {next ? (
              <ChordDiagram chord={next} showLabels={false} />
            ) : (
              <div className="ct-diagram-placeholder muted">—</div>
            )}
          </div>
        </div>
      </section>

      {/* ── Session counters ─────────────────────────────────────────────── */}
      <section className="panel ct-stats row">
        <div className="ct-stat">
          <span className="ct-stat-value mono">{practicedCount}</span>
          <span className="muted ct-stat-label">Chords practiced</span>
        </div>
        <div className="ct-stat">
          <span className="ct-stat-value mono">
            {mode === 'progression' ? progressionChords.length : pool.length}
          </span>
          <span className="muted ct-stat-label">
            {mode === 'progression' ? 'In progression' : 'In pool'}
          </span>
        </div>
      </section>
    </div>
  )
}
