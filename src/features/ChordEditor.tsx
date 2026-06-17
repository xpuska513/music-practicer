import { useState } from 'react'
import { useCustomChords } from '../theory/useCustomChords'
import { ROOT_OPTIONS, pitchClassOf, noteAt } from '../theory/notes'
import Fretboard from '../components/Fretboard'
import { chordMidis, playChord, resumeAudio } from '../audio/synth'
import type { ChordShape, NoteName, FretMark } from '../types'
import './ChordEditor.css'

/** Display labels per string index (0 = low E .. 5 = high E). */
const STRING_LABELS = ['low E', 'A', 'D', 'G', 'B', 'high E'] as const

const EMPTY_FRETS: (number | null)[] = [null, null, null, null, null, null]
const EMPTY_FINGERS: (number | null)[] = [null, null, null, null, null, null]

/** Number of fret cells shown in the editor window. */
const EDITOR_FRET_COUNT = 5
/** Highest window start, so the top visible fret stays within ~22. */
const MAX_START_FRET = 17

/**
 * ChordEditor — build a custom chord shape by clicking directly on the shared
 * Fretboard chart, preview/hear it, and save it to the custom-chord store.
 *
 * The board is locked to the fixed window startFret=0, fretCount=5 so that a
 * click's (string, fret) maps predictably onto the state arrays.
 */
export default function ChordEditor() {
  const { customChords, addChord, updateChord, removeChord } = useCustomChords()

  const [name, setName] = useState('')
  const [root, setRoot] = useState<NoteName>('C')
  const [quality, setQuality] = useState('')
  const [frets, setFrets] = useState<(number | null)[]>(EMPTY_FRETS)
  const [fingers, setFingers] = useState<(number | null)[]>(EMPTY_FINGERS)
  const [editingId, setEditingId] = useState<string | null>(null)
  // Lowest fret of the visible window — lets you build chords up the neck.
  const [startFret, setStartFret] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  /**
   * Handle a click on a board cell.
   *   fret 0 (open row) -> toggle string between open (0) and muted (null).
   *   fret > 0          -> set that fret, or clear to muted if already set there.
   * Whenever the string ends up null or 0, its finger is cleared too.
   */
  const handleCellClick = (stringIndex: number, fret: number) => {
    setError(null)
    setConfirmation(null)
    // Derive the next fret value once so both updaters agree.
    const current = frets[stringIndex]
    const nextFret =
      fret === 0
        ? current === 0
          ? null
          : 0
        : current === fret
        ? null
        : fret
    setFrets((prev) => {
      const next = [...prev]
      next[stringIndex] = nextFret
      return next
    })
    setFingers((prev) => {
      // A finger only makes sense on a fretted (>0) note; clear it otherwise.
      if (nextFret !== null && nextFret > 0) return prev
      const next = [...prev]
      next[stringIndex] = null
      return next
    })
  }

  /** Mute a string (used by the per-string readout, works at any position). */
  const muteString = (i: number) => {
    setError(null)
    setConfirmation(null)
    setFrets((prev) => {
      const next = [...prev]
      next[i] = null
      return next
    })
    setFingers((prev) => {
      const next = [...prev]
      next[i] = null
      return next
    })
  }

  /** Cycle the finger for string `i` through 1 -> 2 -> 3 -> 4 -> none. */
  const cycleFinger = (i: number) => {
    setError(null)
    setConfirmation(null)
    setFingers((prev) => {
      const next = [...prev]
      const cur = prev[i]
      next[i] = cur === null ? 1 : cur >= 4 ? null : cur + 1
      return next
    })
  }

  const clearShape = () => {
    setError(null)
    setConfirmation(null)
    setFrets(EMPTY_FRETS)
    setFingers(EMPTY_FINGERS)
    setStartFret(0)
  }

  const resetForm = () => {
    setName('')
    setRoot('C')
    setQuality('')
    setFrets(EMPTY_FRETS)
    setFingers(EMPTY_FINGERS)
    setStartFret(0)
    setEditingId(null)
  }

  const handleHearCurrent = () => {
    resumeAudio()
    playChord(chordMidis(frets))
  }

  const handleSave = () => {
    if (name.trim().length === 0) {
      setError('Please enter a name for this chord.')
      return
    }
    if (!frets.some((f) => f !== null)) {
      setError('Play at least one string (tap a fret or the open row) before saving.')
      return
    }
    const shape: ChordShape = {
      frets: [...frets],
      fingers: fingers.some((f) => f != null) ? [...fingers] : undefined,
    }
    const input = {
      name,
      root,
      quality: quality || undefined,
      shape,
    }
    if (editingId) {
      updateChord(editingId, input)
      setConfirmation('Chord updated.')
    } else {
      addChord(input)
      setConfirmation('Chord saved.')
    }
    resetForm()
  }

  const handleEdit = (id: string) => {
    const chord = customChords.find((c) => c.id === id)
    if (!chord) return
    setError(null)
    setConfirmation(null)
    setName(chord.name)
    setRoot(chord.root)
    setQuality(chord.quality)
    setFrets([...chord.shape.frets])
    setFingers(
      chord.shape.fingers ? [...chord.shape.fingers] : [...EMPTY_FINGERS],
    )
    // Move the window so the loaded chord's notes are visible.
    const fretted = chord.shape.frets.filter(
      (f): f is number => f !== null && f > 0,
    )
    const maxF = fretted.length ? Math.max(...fretted) : 0
    const minF = fretted.length ? Math.min(...fretted) : 0
    setStartFret(
      maxF <= EDITOR_FRET_COUNT ? 0 : Math.min(MAX_START_FRET, Math.max(0, minF - 1)),
    )
    setEditingId(chord.id)
  }

  const handleDelete = (id: string) => {
    removeChord(id)
    if (editingId === id) resetForm()
  }

  const handleHearChord = (chordFrets: (number | null)[]) => {
    resumeAudio()
    playChord(chordMidis(chordFrets))
  }

  // ── Marks built directly from state (fixed 0..5 window) ───────────────────
  const rootPc = pitchClassOf(root)
  const marks: FretMark[] = []
  const mutedStrings: number[] = []
  for (let i = 0; i < 6; i += 1) {
    const fret = frets[i]
    if (fret === null) {
      mutedStrings.push(i)
      continue
    }
    marks.push({
      string: i,
      fret,
      label: fingers[i] != null ? String(fingers[i]) : undefined,
      isRoot: noteAt(i, fret) === rootPc,
    })
  }
  const hasPlayed = frets.some((f) => f !== null)
  // Strings currently fretted (>0) need a finger cycler.
  const fingeredStrings = STRING_LABELS.map((_, i) => i).filter(
    (i) => frets[i] !== null && (frets[i] as number) > 0,
  )

  return (
    <div className="chord-editor col">
      <div className="panel col">
        <h2>{editingId ? 'Edit custom chord' : 'New custom chord'}</h2>

        {/* ── Metadata fields ──────────────────────────────────────────── */}
        <div className="control">
          <label htmlFor="chord-name">Name</label>
          <input
            id="chord-name"
            type="text"
            value={name}
            placeholder="e.g. Cadd9"
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
              setConfirmation(null)
            }}
          />
        </div>

        <div className="control">
          <label>Root</label>
          <div className="chip-row" role="group" aria-label="Root note">
            {ROOT_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                className="chip"
                aria-pressed={root === r}
                onClick={() => {
                  setRoot(r)
                  setConfirmation(null)
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="control">
          <label htmlFor="chord-quality">Quality (optional)</label>
          <input
            id="chord-quality"
            type="text"
            value={quality}
            placeholder="e.g. add9, sus4, m7"
            onChange={(e) => {
              setQuality(e.target.value)
              setConfirmation(null)
            }}
          />
        </div>

        {/* ── Interactive board ────────────────────────────────────────── */}
        <div className="control">
          <div className="chord-editor__shape-head">
            <label>Shape</label>
            <button
              type="button"
              className="btn chord-editor__clear"
              onClick={clearShape}
              disabled={!hasPlayed}
            >
              Clear
            </button>
          </div>
          <p className="muted chord-editor__hint">
            Tap a string at a fret to place a note. Use ◀ ▶ to move up the neck
            for higher frets. At the lowest position, tap above the nut for an
            open string; tap a placed note again to mute it.
          </p>

          <div
            className="chord-editor__position"
            role="group"
            aria-label="Fret position"
          >
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setStartFret((f) => Math.max(0, f - 1))}
              disabled={startFret <= 0}
              aria-label="Move position toward the nut"
            >
              ◀
            </button>
            <span className="mono chord-editor__position-label">
              {startFret === 0
                ? 'Open · frets 1–5'
                : `Frets ${startFret + 1}–${startFret + EDITOR_FRET_COUNT}`}
            </span>
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setStartFret((f) => Math.min(MAX_START_FRET, f + 1))}
              disabled={startFret >= MAX_START_FRET}
              aria-label="Move position up the neck"
            >
              ▶
            </button>
          </div>

          <div className="chord-editor__board">
            <Fretboard
              marks={marks}
              mutedStrings={mutedStrings}
              startFret={startFret}
              fretCount={EDITOR_FRET_COUNT}
              orientation="vertical"
              showLabels
              showFretNumbers
              onCellClick={handleCellClick}
            />
          </div>

          {/* Per-string readout — shows every string (even off-window) + mute. */}
          <div className="chord-editor__strings" role="group" aria-label="Strings (tap to mute)">
            {STRING_LABELS.map((lbl, i) => {
              const f = frets[i]
              const val = f === null ? '✕' : f === 0 ? 'O' : String(f)
              const state = f === null ? 'muted' : f === 0 ? 'open' : `fret ${f}`
              return (
                <button
                  key={i}
                  type="button"
                  className="chip chord-editor__string-chip"
                  onClick={() => muteString(i)}
                  aria-label={`${lbl}: ${state}. Tap to mute.`}
                >
                  <span className="muted mono chord-editor__string-name">{lbl}</span>
                  <span className="mono chord-editor__string-val">{val}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Finger assignment (only for fretted strings) ─────────────── */}
        {fingeredStrings.length > 0 ? (
          <div className="control">
            <label>Fingers (optional)</label>
            <div className="chord-editor__fingers">
              {fingeredStrings.map((i) => (
                <button
                  key={i}
                  type="button"
                  className="chip chord-editor__finger"
                  onClick={() => cycleFinger(i)}
                  aria-label={`${STRING_LABELS[i]} finger`}
                >
                  <span className="mono chord-editor__finger-string">
                    {STRING_LABELS[i]}
                  </span>
                  <span className="chord-editor__finger-val">
                    {fingers[i] != null ? fingers[i] : '–'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={handleHearCurrent}
            disabled={!hasPlayed}
          >
            {'▶'} Hear it
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

        {error ? (
          <p className="chord-editor__msg chord-editor__msg--error" role="alert">
            {error}
          </p>
        ) : null}
        {confirmation ? (
          <p className="chord-editor__msg chord-editor__msg--ok" role="status">
            {confirmation}
          </p>
        ) : null}
      </div>

      {/* ── Saved custom chords ────────────────────────────────────────── */}
      <div className="panel col">
        <h2>Your custom chords</h2>
        {customChords.length === 0 ? (
          <p className="muted">
            No custom chords yet. Tap a shape on the board above and hit Save to
            add one.
          </p>
        ) : (
          <ul className="chord-editor__list">
            {customChords.map((chord) => (
              <li className="chord-editor__list-item" key={chord.id}>
                <div className="chord-editor__list-info">
                  <span className="chord-editor__list-name">{chord.name}</span>
                  <span className="muted mono">
                    {chord.root}
                    {chord.quality ? ` ${chord.quality}` : ''}
                  </span>
                </div>
                <div className="row chord-editor__list-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleHearChord(chord.shape.frets)}
                    aria-label={`Hear ${chord.name}`}
                  >
                    {'▶'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleEdit(chord.id)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleDelete(chord.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
