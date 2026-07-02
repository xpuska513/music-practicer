import { lazy, Suspense, useEffect, useState } from 'react'
import ChordTrainer from './features/ChordTrainer'
import ScaleExplorer from './features/ScaleExplorer'
import Metronome from './components/Metronome'
import Editor from './features/Editor'
import TechniqueTrainer from './features/TechniqueTrainer'
import Tuner from './features/Tuner'
import DrumEditor from './features/DrumEditor'
import { usePersistentState } from './lib/usePersistentState'
import { preloadGuitar, isGuitarReady } from './audio/synth'
import { useTuning } from './theory/useTuning'
import { TUNINGS, BASS_TUNING } from './theory/tuning'
import { BASS_TECHNIQUES } from './theory/bassTechniques'

// The Songs looper pulls in alphaTab (a few MB), so load it only when opened.
const SongLooper = lazy(() => import('./features/SongLooper'))

type GuitarStatus = 'loading' | 'ready' | 'fallback'

type Section = 'guitar' | 'bass' | 'drums' | 'songs'
type GuitarTab = 'chords' | 'scales' | 'metronome' | 'technique' | 'tuner' | 'editor'
type BassTab = 'scales' | 'technique' | 'tuner' | 'metronome'
type DrumTab = 'beat' | 'metronome'

const GUITAR_TABS: { id: GuitarTab; label: string }[] = [
  { id: 'chords', label: '🎯 Chords' },
  { id: 'scales', label: '🎼 Scales' },
  { id: 'metronome', label: '⏱ Metro' },
  { id: 'technique', label: '🤘 Technique' },
  { id: 'tuner', label: '🎚 Tuner' },
  { id: 'editor', label: '🛠 Editor' },
]

const BASS_TABS: { id: BassTab; label: string }[] = [
  { id: 'scales', label: '🎼 Scales' },
  { id: 'technique', label: '🤘 Technique' },
  { id: 'tuner', label: '🎚 Tuner' },
  { id: 'metronome', label: '⏱ Metro' },
]

const DRUM_TABS: { id: DrumTab; label: string }[] = [
  { id: 'beat', label: '🥁 Beat Editor' },
  { id: 'metronome', label: '⏱ Metronome' },
]

const isSection = (v: unknown): v is Section =>
  v === 'guitar' || v === 'bass' || v === 'drums' || v === 'songs'
const isGuitarTab = (v: unknown): v is GuitarTab =>
  GUITAR_TABS.some((t) => t.id === v)
const isBassTab = (v: unknown): v is BassTab => BASS_TABS.some((t) => t.id === v)
const isDrumTab = (v: unknown): v is DrumTab => DRUM_TABS.some((t) => t.id === v)

export default function App() {
  const [section, setSection] = usePersistentState<Section>(
    'app:section',
    'guitar',
    isSection,
  )
  const [guitarTab, setGuitarTab] = usePersistentState<GuitarTab>(
    'app:tab',
    'chords',
    isGuitarTab,
  )
  const [bassTab, setBassTab] = usePersistentState<BassTab>(
    'app:basstab',
    'scales',
    isBassTab,
  )
  const [drumTab, setDrumTab] = usePersistentState<DrumTab>(
    'app:drumtab',
    'beat',
    isDrumTab,
  )
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

  const isGuitar = section === 'guitar'
  const isBass = section === 'bass'
  const isDrums = section === 'drums'
  const tabs = isGuitar
    ? GUITAR_TABS
    : isBass
      ? BASS_TABS
      : isDrums
        ? DRUM_TABS
        : []
  const activeTab = isGuitar ? guitarTab : isBass ? bassTab : isDrums ? drumTab : ''
  const setTab = (id: GuitarTab | BassTab | DrumTab) => {
    if (isGuitar) {
      if (isGuitarTab(id)) setGuitarTab(id)
    } else if (isBass) {
      if (isBassTab(id)) setBassTab(id)
    } else if (isDrumTab(id)) {
      setDrumTab(id)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="mark">♪</span> Music Practicer
          {isGuitar && guitarStatus === 'loading' ? (
            <span className="app-sound-status" title="Loading the real guitar samples…">
              🎸 loading sound…
            </span>
          ) : isGuitar && guitarStatus === 'fallback' ? (
            <span className="app-sound-status" title="Couldn't load guitar samples — using the built-in synth.">
              🎸 synth
            </span>
          ) : null}
        </div>

        {/* Instrument switch */}
        <div className="app-instrument chip-row" role="group" aria-label="Instrument">
          <button
            type="button"
            className="chip"
            aria-pressed={section === 'guitar'}
            onClick={() => setSection('guitar')}
          >
            🎸 Guitar
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={section === 'bass'}
            onClick={() => setSection('bass')}
          >
            𝄢 Bass
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={section === 'drums'}
            onClick={() => setSection('drums')}
          >
            🥁 Drums
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={section === 'songs'}
            onClick={() => setSection('songs')}
          >
            🎼 Songs
          </button>
        </div>

        {isGuitar ? (
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
        ) : null}

        {tabs.length > 0 ? (
          <nav className="tabbar" role="tablist" aria-label="Practice modes">
            {tabs.map((t) => (
              <button
                key={t.id}
                className="tab"
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="app-main">
        {/* Shared metronome at a stable position so a running click survives a
            Guitar↔Drums switch instead of unmounting into a different branch. */}
        {activeTab === 'metronome' && <Metronome />}
        {isGuitar ? (
          <>
            {guitarTab === 'chords' && <ChordTrainer />}
            {guitarTab === 'scales' && <ScaleExplorer />}
            {guitarTab === 'technique' && <TechniqueTrainer />}
            {guitarTab === 'tuner' && <Tuner />}
            {guitarTab === 'editor' && <Editor />}
          </>
        ) : isBass ? (
          <>
            {bassTab === 'scales' && <ScaleExplorer tuning={BASS_TUNING} />}
            {bassTab === 'technique' && (
              <TechniqueTrainer techniques={BASS_TECHNIQUES} storagePrefix="bass-" />
            )}
            {bassTab === 'tuner' && <Tuner tuning={BASS_TUNING} />}
          </>
        ) : isDrums ? (
          <>{drumTab === 'beat' && <DrumEditor />}</>
        ) : (
          <Suspense fallback={<p className="muted" style={{ padding: 16 }}>Loading the song player…</p>}>
            <SongLooper />
          </Suspense>
        )}
      </main>
    </div>
  )
}
