import { useMemo } from 'react'
import { SCALES, getScaleMarks } from '../theory/scales'
import {
  ROOT_OPTIONS,
  pitchClassOf,
  noteName,
  noteAt,
  degreeLabel,
} from '../theory/notes'
import Fretboard from '../components/Fretboard'
import { useCustomScales } from '../theory/useCustomScales'
import { scaleMidis, playSequence, resumeAudio, stopAll } from '../audio/synth'
import { usePersistentState } from '../lib/usePersistentState'
import type { FretMark, NoteName, ScaleDef } from '../types'
import './ScaleExplorer.css'

/** Number of frets rendered across the whole neck. */
const FRET_COUNT = 15

/** How marks are labelled inside the fretboard dots. */
type LabelMode = 'notes' | 'degrees'

const isLabelMode = (v: unknown): v is LabelMode => v === 'notes' || v === 'degrees'
const isRoot = (v: unknown): v is NoteName => ROOT_OPTIONS.includes(v as NoteName)

/** Human-readable headings for the grouped scale selector. */
const CATEGORY_LABELS: Record<ScaleDef['category'], string> = {
  major: 'Major',
  minor: 'Minor',
  mode: 'Modes',
  pentatonic: 'Pentatonic',
  blues: 'Blues',
  other: 'Other',
  custom: 'Custom',
}

/** Order categories appear in the selector. */
const CATEGORY_ORDER: ScaleDef['category'][] = [
  'major',
  'minor',
  'mode',
  'pentatonic',
  'blues',
  'other',
  'custom',
]

/**
 * Interactive scale/mode browser: pick a root and a scale, then see every
 * matching position across the whole neck, plus the scale spelling.
 */
function ScaleExplorer() {
  const { customScales } = useCustomScales()
  const [root, setRoot] = usePersistentState<NoteName>('se:root', 'E', isRoot)
  const [scaleId, setScaleId] = usePersistentState<string>('se:scale', SCALES[0].id)
  const [labelMode, setLabelMode] = usePersistentState<LabelMode>(
    'se:labels',
    'notes',
    isLabelMode,
  )

  // Built-in scales plus any the user created in the editor.
  const allScales = useMemo<ScaleDef[]>(
    () => [...SCALES, ...customScales],
    [customScales],
  )

  const rootPc = pitchClassOf(root)
  const scale = useMemo(
    () => allScales.find((s) => s.id === scaleId) ?? SCALES[0],
    [allScales, scaleId],
  )

  /** Play the current scale up then back down. */
  const handlePlay = () => {
    resumeAudio()
    const up = scaleMidis(rootPc, scale.intervals)
    const updown = [...up, ...up.slice(0, -1).reverse()]
    playSequence(updown)
  }

  // Scale spelling: the note names in order from the root.
  const spelling = useMemo(
    () =>
      scale.intervals.map((interval) => noteName((rootPc + interval) % 12)),
    [scale, rootPc],
  )

  // Fretboard marks: note names by default, scale degrees when toggled.
  const marks = useMemo<FretMark[]>(() => {
    const base = getScaleMarks(scale, rootPc, FRET_COUNT)
    if (labelMode === 'notes') return base
    return base.map((mark) => {
      // Derive the interval from the actual fretted pitch rather than parsing
      // the note-name label back into a pitch class.
      const interval = (((noteAt(mark.string, mark.fret) - rootPc) % 12) + 12) % 12
      return { ...mark, label: degreeLabel(interval) }
    })
  }, [scale, rootPc, labelMode])

  // Scales grouped under their category headings for the <select>.
  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      scales: allScales.filter((s) => s.category === category),
    })).filter((group) => group.scales.length > 0)
  }, [allScales])

  return (
    <section className="scale-explorer col">
      <div className="panel col">
        <div className="row scale-explorer__controls">
          <div className="control scale-explorer__root">
            <label id="se-root-label">Root</label>
            <div className="chip-row" role="group" aria-labelledby="se-root-label">
              {ROOT_OPTIONS.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="chip"
                  aria-pressed={name === root}
                  onClick={() => setRoot(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="control">
            <label htmlFor="se-scale">Scale</label>
            <select
              id="se-scale"
              value={scaleId}
              onChange={(e) => setScaleId(e.target.value)}
            >
              {grouped.map((group) => (
                <optgroup
                  key={group.category}
                  label={CATEGORY_LABELS[group.category]}
                >
                  {group.scales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="control">
            <label id="se-mode-label">Labels</label>
            <div className="chip-row" role="group" aria-labelledby="se-mode-label">
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
        </div>

        <div className="scale-explorer__spelling">
          <div
            className="row"
            style={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span className="muted scale-explorer__spelling-title">
              {root} {scale.name}
            </span>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn-primary" onClick={handlePlay}>
                ▶ Play
              </button>
              <button type="button" className="btn" onClick={stopAll}>
                ■ Stop
              </button>
            </div>
          </div>
          <div className="chip-row" aria-label="Scale spelling">
            {spelling.map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="chip mono"
                aria-pressed={i === 0}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="panel scale-explorer__board">
        <div className="scale-explorer__board-scroll">
          <Fretboard
            orientation="horizontal"
            startFret={0}
            fretCount={FRET_COUNT}
            marks={marks}
            showLabels
          />
        </div>
      </div>
    </section>
  )
}

export default ScaleExplorer
