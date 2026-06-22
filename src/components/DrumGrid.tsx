import {
  BEATS_PER_BAR,
  DRUM_VOICES,
  stepCount,
  type DrumPattern,
  type DrumVoiceId,
} from '../theory/drums'
import './DrumGrid.css'

interface DrumGridProps {
  pattern: DrumPattern
  /** Index of the step under the playhead, or < 0 when not playing. */
  currentStep: number
  onToggle: (voice: DrumVoiceId, step: number) => void
}

const GLYPH: Record<DrumVoice['glyph'], string> = {
  x: '✕', // ✕
  o: '○', // ○
  dot: '●', // ●
}

type DrumVoice = (typeof DRUM_VOICES)[number]

export default function DrumGrid({
  pattern,
  currentStep,
  onToggle,
}: DrumGridProps) {
  const steps = stepCount(pattern)
  const { subdivision } = pattern
  const beatSpan = subdivision
  const barSpan = BEATS_PER_BAR * subdivision
  const stepIndices = Array.from({ length: steps }, (_, i) => i)

  return (
    <div className="drumgrid-scroll panel">
      <div
        className="drumgrid"
        style={{ ['--steps' as string]: steps }}
        role="grid"
        aria-label={`Drum pattern: ${pattern.name}`}
      >
        {DRUM_VOICES.map((voice) => {
          const hits = pattern.hits[voice.id]
          return (
            <div className="drumgrid-row" role="row" key={voice.id}>
              <div
                className="drumgrid-label mono"
                role="rowheader"
                title={voice.name}
              >
                {voice.short}
              </div>
              {stepIndices.map((step) => {
                const active = hits[step] === true
                const isBeat = step % beatSpan === 0
                const isBar = step % barSpan === 0
                const isPlayhead = currentStep >= 0 && step === currentStep
                const className = [
                  'drumgrid-cell',
                  active && 'is-active',
                  isBar
                    ? 'is-bar-start'
                    : isBeat
                      ? 'is-beat-start'
                      : null,
                  isPlayhead && 'is-playhead',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button
                    type="button"
                    key={step}
                    className={className}
                    role="gridcell"
                    aria-pressed={active}
                    aria-label={`${voice.name} step ${step + 1}${
                      active ? ', on' : ''
                    }`}
                    onClick={() => onToggle(voice.id, step)}
                  >
                    {active ? (
                      <span className="drumgrid-glyph" aria-hidden="true">
                        {GLYPH[voice.glyph]}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
