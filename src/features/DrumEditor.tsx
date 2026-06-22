import { useState } from 'react'
import {
  DRUM_PRESETS,
  emptyHits,
  resizeHits,
  stepCount,
} from '../theory/drums'
import type { DrumPattern, DrumVoiceId } from '../theory/drums'
import { useDrumPatterns } from '../theory/useDrumPatterns'
import { useDrumSequencer } from '../audio/useDrumSequencer'
import { usePersistentState } from '../lib/usePersistentState'
import DrumGrid from '../components/DrumGrid'
import DrumNotation from '../components/DrumNotation'
import './DrumEditor.css'

const MIN_BPM = 40
const MAX_BPM = 240

const SUBDIVISION_OPTIONS: { value: number; label: string }[] = [
  { value: 2, label: '8ths' },
  { value: 3, label: 'Triplets' },
  { value: 4, label: '16ths' },
]
const BARS_OPTIONS = [1, 2] as const

type View = 'grid' | 'notation'
const isView = (v: unknown): v is View => v === 'grid' || v === 'notation'
const isBpm = (v: unknown): v is number =>
  typeof v === 'number' && v >= MIN_BPM && v <= MAX_BPM

/** A fresh draft seeded from the basic rock groove (hits deep-copied so the
 *  working pattern never aliases the shared preset arrays). */
function draftPattern(): DrumPattern {
  const base = DRUM_PRESETS[0]
  return {
    ...base,
    id: '__draft',
    name: '',
    hits: resizeHits(base.hits, stepCount(base)),
  }
}

export default function DrumEditor() {
  const { patterns, addPattern, updatePattern, removePattern } = useDrumPatterns()
  const [view, setView] = usePersistentState<View>('drum:view', 'grid', isView)
  const [storedBpm, setStoredBpm] = usePersistentState<number>('drum:bpm', 90, isBpm)

  const [pattern, setPattern] = useState<DrumPattern>(() => ({
    ...draftPattern(),
    bpm: storedBpm,
  }))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const { isPlaying, currentStep, toggle, stop } = useDrumSequencer(pattern)

  const toggleHit = (voice: DrumVoiceId, step: number) => {
    setPattern((p) => ({
      ...p,
      hits: {
        ...p.hits,
        [voice]: p.hits[voice].map((h, i) => (i === step ? !h : h)),
      },
    }))
  }

  const setBpm = (bpm: number) => {
    setStoredBpm(bpm)
    setPattern((p) => ({ ...p, bpm }))
  }

  const setSubdivision = (subdivision: number) => {
    setPattern((p) => {
      const steps = stepCount({ bars: p.bars, subdivision })
      return { ...p, subdivision, hits: resizeHits(p.hits, steps) }
    })
  }

  const setBars = (bars: number) => {
    setPattern((p) => {
      const steps = stepCount({ bars, subdivision: p.subdivision })
      return { ...p, bars, hits: resizeHits(p.hits, steps) }
    })
  }

  const clearHits = () => {
    setFeedback(null)
    setPattern((p) => ({ ...p, hits: emptyHits(stepCount(p)) }))
  }

  const loadPattern = (src: DrumPattern, asEditOf: string | null) => {
    stop()
    setFeedback(null)
    setEditingId(asEditOf)
    setPattern({
      ...src,
      id: '__draft',
      hits: resizeHits(src.hits, stepCount(src)),
    })
    // Note: the loaded pattern's bpm drives playback via setPattern; we don't
    // overwrite the persisted `drum:bpm` preference (that follows the slider).
  }

  const newPattern = () => {
    loadPattern({ ...draftPattern(), bpm: storedBpm }, null)
  }

  const handleSave = () => {
    const name = pattern.name.trim()
    if (!name) {
      setFeedback('Give your beat a name first.')
      return
    }
    const input = {
      name,
      bars: pattern.bars,
      subdivision: pattern.subdivision,
      bpm: pattern.bpm,
      hits: pattern.hits,
    }
    // Only update if the edit target still exists (it may have been deleted in
    // another tab/instance); otherwise save as a new beat instead of silently
    // no-opping.
    if (editingId !== null && patterns.some((p) => p.id === editingId)) {
      updatePattern(editingId, input)
      setFeedback('Beat updated.')
    } else {
      const saved = addPattern(input)
      setEditingId(saved.id)
      setFeedback('Beat saved.')
    }
  }

  const handleDelete = (id: string) => {
    removePattern(id)
    if (editingId === id) {
      setEditingId(null)
      setFeedback(null)
    }
  }

  return (
    <div className="drum-editor col">
      {/* ── Setup ────────────────────────────────────────────────────────── */}
      <section className="panel drum-editor__setup col">
        <div className="control">
          <label htmlFor="drum-name">Beat name</label>
          <input
            id="drum-name"
            type="text"
            value={pattern.name}
            placeholder="e.g. My groove"
            onChange={(e) => {
              setPattern((p) => ({ ...p, name: e.target.value }))
              setFeedback(null)
            }}
          />
        </div>

        <div className="row drum-editor__controls">
          <div className="control">
            <label id="drum-sub-label">Subdivision</label>
            <div className="chip-row" role="group" aria-labelledby="drum-sub-label">
              {SUBDIVISION_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className="chip"
                  aria-pressed={pattern.subdivision === s.value}
                  onClick={() => setSubdivision(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="control">
            <label id="drum-bars-label">Bars</label>
            <div className="chip-row" role="group" aria-labelledby="drum-bars-label">
              {BARS_OPTIONS.map((b) => (
                <button
                  key={b}
                  type="button"
                  className="chip"
                  aria-pressed={pattern.bars === b}
                  onClick={() => setBars(b)}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="control">
            <label id="drum-view-label">View</label>
            <div className="chip-row" role="group" aria-labelledby="drum-view-label">
              <button
                type="button"
                className="chip"
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
              >
                Grid
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={view === 'notation'}
                onClick={() => setView('notation')}
              >
                Notation
              </button>
            </div>
          </div>
        </div>

        <div className="control">
          <label htmlFor="drum-bpm">
            Tempo <span className="mono drum-editor__bpm">{pattern.bpm} BPM</span>
          </label>
          <input
            id="drum-bpm"
            type="range"
            min={MIN_BPM}
            max={MAX_BPM}
            step={1}
            value={pattern.bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
        </div>

        <div className="row drum-editor__transport">
          <button
            type="button"
            className={`btn ${isPlaying ? '' : 'btn-primary'}`}
            onClick={toggle}
          >
            {isPlaying ? '■ Stop' : '▶ Play'}
          </button>
          <button type="button" className="btn" onClick={clearHits}>
            Clear
          </button>
          <button type="button" className="btn" onClick={newPattern}>
            New
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            {editingId ? 'Update' : 'Save'}
          </button>
        </div>

        {feedback ? (
          <p className="muted drum-editor__feedback" role="status">
            {feedback}
          </p>
        ) : null}
      </section>

      {/* ── Editor surface ───────────────────────────────────────────────── */}
      <section className="panel drum-editor__surface">
        {view === 'grid' ? (
          <DrumGrid pattern={pattern} currentStep={currentStep} onToggle={toggleHit} />
        ) : (
          <DrumNotation pattern={pattern} currentStep={currentStep} />
        )}
      </section>

      {/* ── Presets + saved beats ────────────────────────────────────────── */}
      <section className="panel col">
        <div className="control">
          <label id="drum-preset-label">Starter grooves</label>
          <div className="chip-row" role="group" aria-labelledby="drum-preset-label">
            {DRUM_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="chip"
                onClick={() => loadPattern(preset, null)}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <h3 className="drum-editor__saved-title">Your beats</h3>
        {patterns.length === 0 ? (
          <p className="muted">
            No saved beats yet. Tap out a pattern above, name it, and hit Save.
          </p>
        ) : (
          <ul className="drum-editor__list">
            {patterns.map((p) => (
              <li key={p.id} className="drum-editor__list-item">
                <div className="drum-editor__list-info">
                  <span className="drum-editor__list-name">{p.name}</span>
                  <span className="muted mono">
                    {p.bpm} BPM · {p.bars} bar{p.bars > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="row drum-editor__list-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => loadPattern(p, p.id)}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleDelete(p.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
