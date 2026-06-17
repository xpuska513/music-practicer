import { useCallback, useMemo, useState } from 'react'
import { useCustomScales } from '../theory/useCustomScales'
import { getScaleMarks } from '../theory/scales'
import {
  ROOT_OPTIONS,
  pitchClassOf,
  noteName,
  degreeLabel,
  noteAt,
} from '../theory/notes'
import Fretboard from '../components/Fretboard'
import { scaleMidis, playSequence, resumeAudio, stopAll } from '../audio/synth'
import type { NoteName, ScaleDef, FretMark } from '../types'
import './ScaleEditor.css'

/** Number of frets rendered on the interactive neck. */
const FRET_COUNT = 15

/** How dot labels read on the board. */
type LabelMode = 'notes' | 'degrees'

/** Inline feedback shown after a save/validation attempt. */
interface Feedback {
  kind: 'error' | 'success'
  text: string
}

/** Semitone interval (0..11) from the root for a given string/fret. */
function intervalAt(stringIndex: number, fret: number, rootPc: number): number {
  return (((noteAt(stringIndex, fret) - rootPc) % 12) + 12) % 12
}

/**
 * Build & save custom scales by clicking notes directly on a full-neck
 * fretboard. The chosen root anchors the chromatic map; every matching position
 * lights up. Saved scales can be edited, played, or deleted.
 */
function ScaleEditor() {
  const { customScales, addScale, updateScale, removeScale } = useCustomScales()

  const [name, setName] = useState('')
  const [root, setRoot] = useState<NoteName>('E')
  // Semitone degrees relative to the root. Always contains 0 (the root).
  const [intervals, setIntervals] = useState<number[]>([0])
  const [labelMode, setLabelMode] = useState<LabelMode>('notes')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const rootPc = pitchClassOf(root)

  // Intervals sorted ascending, root always present.
  const sortedIntervals = useMemo(() => {
    const set = new Set<number>(intervals)
    set.add(0)
    return Array.from(set).sort((a, b) => a - b)
  }, [intervals])

  // Working scale used for both the board and the spelling.
  const draft = useMemo<ScaleDef>(
    () => ({
      id: '__draft',
      name: name || 'Custom scale',
      intervals: sortedIntervals,
      category: 'custom',
    }),
    [name, sortedIntervals],
  )

  // Every matching position on the neck, relabelled for the current mode.
  const marks = useMemo<FretMark[]>(() => {
    const base = getScaleMarks(draft, rootPc, FRET_COUNT)
    if (labelMode === 'notes') return base
    return base.map((mark) => ({
      ...mark,
      label: degreeLabel(intervalAt(mark.string, mark.fret, rootPc)),
    }))
  }, [draft, rootPc, labelMode])

  // Note-name spelling from the root, one entry per selected interval.
  const spelling = useMemo(
    () => sortedIntervals.map((interval) => noteName((rootPc + interval) % 12)),
    [sortedIntervals, rootPc],
  )

  const handleCellClick = useCallback(
    (stringIndex: number, fret: number) => {
      const interval = intervalAt(stringIndex, fret, rootPc)
      // The root is always part of the scale; ignore clicks on it.
      if (interval === 0) return
      setFeedback(null)
      setIntervals((prev) => {
        const set = new Set<number>(prev)
        set.add(0)
        if (set.has(interval)) set.delete(interval)
        else set.add(interval)
        return Array.from(set).sort((a, b) => a - b)
      })
    },
    [rootPc],
  )

  const resetForm = useCallback(() => {
    setName('')
    setIntervals([0])
    setEditingId(null)
  }, [])

  const play = useCallback(
    (atRootPc: number, scaleIntervals: number[]) => {
      resumeAudio()
      playSequence(scaleMidis(atRootPc, scaleIntervals))
    },
    [],
  )

  const handleClear = useCallback(() => {
    setIntervals([0])
    setFeedback(null)
  }, [])

  const handleSave = useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed) {
      setFeedback({ kind: 'error', text: 'Please enter a scale name.' })
      return
    }
    if (sortedIntervals.length < 2) {
      setFeedback({
        kind: 'error',
        text: 'Click at least one note besides the root.',
      })
      return
    }

    if (editingId) {
      updateScale(editingId, { name: trimmed, intervals: sortedIntervals })
    } else {
      addScale({ name: trimmed, intervals: sortedIntervals })
    }
    resetForm()
    setFeedback({
      kind: 'success',
      text: editingId ? 'Scale updated.' : 'Scale saved.',
    })
  }, [name, sortedIntervals, editingId, updateScale, addScale, resetForm])

  const handleEdit = useCallback((scale: ScaleDef) => {
    setEditingId(scale.id)
    setName(scale.name)
    setIntervals(scale.intervals.slice())
    setFeedback(null)
  }, [])

  const handleDelete = useCallback(
    (id: string) => {
      removeScale(id)
      // If we were editing the one we just deleted, drop back to a fresh form.
      setEditingId((current) => {
        if (current === id) {
          setName('')
          setIntervals([0])
          return null
        }
        return current
      })
    },
    [removeScale],
  )

  return (
    <section className="scale-editor col">
      <div className="panel col">
        <div className="control">
          <label htmlFor="sed-name">Name</label>
          <input
            id="sed-name"
            type="text"
            placeholder="e.g. My Dorian"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setFeedback(null)
            }}
          />
        </div>

        <div className="control">
          <label id="sed-root-label">Root</label>
          <div
            className="chip-row"
            role="group"
            aria-labelledby="sed-root-label"
          >
            {ROOT_OPTIONS.map((rootName) => (
              <button
                key={rootName}
                type="button"
                className="chip"
                aria-pressed={rootName === root}
                onClick={() => {
                  setRoot(rootName)
                  setFeedback(null)
                }}
              >
                {rootName}
              </button>
            ))}
          </div>
        </div>

        <div className="control">
          <label id="sed-labelmode-label">Dot labels</label>
          <div
            className="chip-row"
            role="group"
            aria-labelledby="sed-labelmode-label"
          >
            <button
              type="button"
              className="chip"
              aria-pressed={labelMode === 'notes'}
              onClick={() => setLabelMode('notes')}
            >
              Notes
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={labelMode === 'degrees'}
              onClick={() => setLabelMode('degrees')}
            >
              Degrees
            </button>
          </div>
        </div>

        <p className="muted scale-editor__hint">
          Pick a root, then click notes on the neck to add or remove them. Every
          matching position lights up. Click a lit note again to remove that
          degree.
        </p>
      </div>

      <div className="panel scale-editor__board">
        <div className="scale-editor__board-scroll">
          <Fretboard
            orientation="horizontal"
            startFret={0}
            fretCount={FRET_COUNT}
            marks={marks}
            showLabels
            onCellClick={handleCellClick}
          />
        </div>
      </div>

      <div className="panel col">
        <div className="scale-editor__spelling">
          <span className="muted scale-editor__spelling-title">
            {root} {name || 'Custom scale'} · {sortedIntervals.length} notes
          </span>
          <div className="chip-row" aria-label="Scale spelling">
            {sortedIntervals.map((interval, i) => (
              <span
                key={interval}
                className="chip mono scale-editor__spell-chip"
                aria-pressed={interval === 0}
              >
                {spelling[i]}
              </span>
            ))}
          </div>
        </div>

        <div className="row scale-editor__actions">
          <button
            type="button"
            className="btn"
            onClick={() => play(rootPc, sortedIntervals)}
          >
            ▶ Play
          </button>
          <button type="button" className="btn" onClick={() => stopAll()}>
            ■ Stop
          </button>
          <button type="button" className="btn" onClick={handleClear}>
            Clear
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            {editingId ? 'Update' : 'Save'}
          </button>
          {editingId ? (
            <button type="button" className="btn" onClick={resetForm}>
              Cancel
            </button>
          ) : null}
        </div>

        {feedback ? (
          <p
            className={`scale-editor__feedback scale-editor__feedback--${feedback.kind}`}
            role="status"
          >
            {feedback.text}
          </p>
        ) : null}
      </div>

      <div className="panel col">
        <h3>Saved scales</h3>
        {customScales.length === 0 ? (
          <p className="muted">
            No custom scales yet. Click some notes on the neck above, give it a
            name, and hit Save.
          </p>
        ) : (
          <ul className="scale-editor__list">
            {customScales.map((scale) => (
              <li key={scale.id} className="scale-editor__list-item">
                <div className="scale-editor__list-info">
                  <span className="scale-editor__list-name">{scale.name}</span>
                  <span className="muted mono scale-editor__list-meta">
                    {scale.intervals.length} notes ·{' '}
                    {scale.intervals
                      .map((interval) => noteName((rootPc + interval) % 12))
                      .join(' ')}
                  </span>
                </div>
                <div className="row scale-editor__list-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => play(rootPc, scale.intervals)}
                    aria-label={`Play ${scale.name}`}
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleEdit(scale)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleDelete(scale.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default ScaleEditor
