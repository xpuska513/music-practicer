import { useState } from 'react'
import ChordEditor from './ChordEditor'
import ScaleEditor from './ScaleEditor'
import './Editor.css'

type EditorTab = 'chords' | 'scales'

/** Wrapper that hosts both custom editors behind a small segmented switch. */
export default function Editor() {
  const [tab, setTab] = useState<EditorTab>('chords')

  return (
    <div className="editor col">
      <div className="editor-switch chip-row" role="tablist" aria-label="Editor type">
        <button
          type="button"
          className="chip"
          role="tab"
          aria-selected={tab === 'chords'}
          aria-pressed={tab === 'chords'}
          onClick={() => setTab('chords')}
        >
          🎯 Chord editor
        </button>
        <button
          type="button"
          className="chip"
          role="tab"
          aria-selected={tab === 'scales'}
          aria-pressed={tab === 'scales'}
          onClick={() => setTab('scales')}
        >
          🎼 Scale editor
        </button>
      </div>

      {tab === 'chords' ? <ChordEditor /> : <ScaleEditor />}
    </div>
  )
}
