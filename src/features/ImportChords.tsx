import { useEffect, useState } from 'react'
import {
  decodeChords,
  readShareHash,
  clearShareHash,
} from '../theory/chordShare'
import type { SharedChord } from '../theory/chordShare'
import './ImportChords.css'

/** Compact display of a shape's frets, e.g. "x32010" (or dash-joined if 2-digit). */
function fretsLabel(frets: (number | null)[]): string {
  const twoDigit = frets.some((f) => f !== null && f >= 10)
  return frets.map((f) => (f === null ? 'x' : String(f))).join(twoDigit ? '-' : '')
}

interface Props {
  /** Add the imported chords; returns how many were added. */
  onImport: (chords: SharedChord[]) => number
}

/**
 * Import custom chords from a share link or code. Also auto-detects a
 * `#chords=…` token in the URL on mount (someone opened a share link) and
 * offers to add those chords.
 */
export default function ImportChords({ onImport }: Props) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<SharedChord[] | null>(null)
  const [fromLink, setFromLink] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    const token = readShareHash()
    if (!token) return
    const chords = decodeChords(token)
    clearShareHash() // don't re-prompt on refresh
    if (chords) {
      setPreview(chords)
      setFromLink(true)
    } else {
      setMsg('The chord link in your URL wasn’t valid.')
    }
  }, [])

  const handlePreview = () => {
    const chords = decodeChords(text)
    if (!chords) {
      setPreview(null)
      setMsg('That doesn’t look like a valid chord share link or code.')
      return
    }
    setPreview(chords)
    setFromLink(false)
    setMsg(null)
  }

  const handleAdd = () => {
    if (!preview) return
    const n = onImport(preview)
    setMsg(`Added ${n} chord${n === 1 ? '' : 's'} to your custom chords.`)
    setPreview(null)
    setText('')
    setFromLink(false)
  }

  const handleDismiss = () => {
    setPreview(null)
    setFromLink(false)
    setMsg(null)
  }

  const count = preview?.length ?? 0

  return (
    <div className="import-chords panel col">
      <h2>Import a shared chord</h2>
      <p className="muted">Paste a chord share link or code someone sent you.</p>

      <div className="control">
        <textarea
          className="import-chords__input"
          value={text}
          rows={2}
          placeholder="Paste a link or code…"
          onChange={(e) => {
            setText(e.target.value)
            setMsg(null)
          }}
        />
      </div>
      <div className="row">
        <button
          type="button"
          className="btn"
          onClick={handlePreview}
          disabled={!text.trim()}
        >
          Preview
        </button>
      </div>

      {preview ? (
        <div className="import-chords__preview">
          <p className="import-chords__preview-title">
            {fromLink ? 'Someone shared ' : 'Ready to add '}
            {count} chord{count === 1 ? '' : 's'}:
          </p>
          <ul className="import-chords__list">
            {preview.map((c, i) => (
              <li key={i}>
                <span className="import-chords__name">{c.name}</span>{' '}
                <span className="muted mono">
                  {c.root}
                  {c.quality ? ` ${c.quality}` : ''} · {fretsLabel(c.shape.frets)}
                </span>
              </li>
            ))}
          </ul>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={handleAdd}>
              Add {count} chord{count === 1 ? '' : 's'}
            </button>
            <button type="button" className="btn" onClick={handleDismiss}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {msg ? (
        <p className="import-chords__msg" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  )
}
