import { useEffect, useState } from 'react'
import ChordTrainer from './features/ChordTrainer'
import ScaleExplorer from './features/ScaleExplorer'
import Metronome from './components/Metronome'
import Editor from './features/Editor'
import TechniqueTrainer from './features/TechniqueTrainer'
import Tuner from './features/Tuner'
import { usePersistentState } from './lib/usePersistentState'
import { preloadGuitar, isGuitarReady } from './audio/synth'
import { useTuning } from './theory/useTuning'
import { TUNINGS } from './theory/tuning'

type GuitarStatus = 'loading' | 'ready' | 'fallback'

type Tab = 'chords' | 'scales' | 'metronome' | 'technique' | 'tuner' | 'editor'

const TABS: { id: Tab; label: string }[] = [
  { id: 'chords', label: '🎯 Chords' },
  { id: 'scales', label: '🎼 Scales' },
  { id: 'metronome', label: '🥁 Metro' },
  { id: 'technique', label: '🤘 Technique' },
  { id: 'tuner', label: '🎚 Tuner' },
  { id: 'editor', label: '🛠 Editor' },
]

const isTab = (v: unknown): v is Tab => TABS.some((t) => t.id === v)

export default function App() {
  const [tab, setTab] = usePersistentState<Tab>('app:tab', 'chords', isTab)
  const { tuningId, setTuningId } = useTuning()

  // Warm up the guitar samples on mount so the first played chord already uses
  // the real guitar rather than the synth fallback.
  const [guitarStatus, setGuitarStatus] = useState<GuitarStatus>(
    isGuitarReady() ? 'ready' : 'loading',
  )
  useEffect(() => {
    let alive = true
    preloadGuitar().then((ok) => {
      if (alive) setGuitarStatus(ok ? 'ready' : 'fallback')
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="mark">♪</span> Music Practicer
          {guitarStatus === 'loading' ? (
            <span className="app-sound-status" title="Loading the real guitar samples…">
              🎸 loading sound…
            </span>
          ) : guitarStatus === 'fallback' ? (
            <span className="app-sound-status" title="Couldn't load guitar samples — using the built-in synth.">
              🎸 synth
            </span>
          ) : null}
        </div>
        <select
          className="app-tuning"
          value={tuningId}
          onChange={(e) => setTuningId(e.target.value)}
          aria-label="Guitar tuning (applies across the app)"
          title="Guitar / tuning — applies across the app"
        >
          {TUNINGS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.strings.length}-string
            </option>
          ))}
        </select>
        <nav className="tabbar" role="tablist" aria-label="Practice modes">
          {TABS.map((t) => (
            <button
              key={t.id}
              className="tab"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {tab === 'chords' && <ChordTrainer />}
        {tab === 'scales' && <ScaleExplorer />}
        {tab === 'metronome' && <Metronome />}
        {tab === 'technique' && <TechniqueTrainer />}
        {tab === 'tuner' && <Tuner />}
        {tab === 'editor' && <Editor />}
      </main>
    </div>
  )
}
