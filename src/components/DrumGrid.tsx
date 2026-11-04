import {
  BEATS_PER_BAR,
  DRUM_VOICES,
  HIT_ACCENT,
  HIT_GHOST,
  HIT_NORMAL,
  HIT_OFF,
  isHitLevel,
  stepCount,
  type DrumPattern,
  type DrumVoice,
  type DrumVoiceId,
  type HitLevel,
} from '../theory/drums'
import './DrumGrid.css'

interface DrumGridProps {
  pattern: DrumPattern
  /** Index of the step under the playhead, or < 0 when not playing. */
  currentStep: number
  /** A cell was tapped; the editor decides its new level (the dynamics brush). */
  onTap: (voice: DrumVoiceId, step: number) => void
}

const GLYPH: Record<DrumVoice['glyph'], string> = {
  x: '✕', // ✕
  o: '○', // ○
  dot: '●', // ●
}

/** Per level: the cell's modifier class and how a screen reader hears it. */
const LEVEL: Record<HitLevel, { cls: string | null; label: string }> = {
  [HIT_OFF]: { cls: null, label: 'off' },
  [HIT_GHOST]: { cls: 'is-ghost', label: 'ghost note' },
  [HIT_NORMAL]: { cls: 'is-normal', label: 'on' },
  [HIT_ACCENT]: { cls: 'is-accent', label: 'accent' },
}

/** Rows that open a new instrument group (drums, then feet) get extra space. */
const GROUP_START: ReadonlySet<DrumVoiceId> = new Set<DrumVoiceId>(['tom', 'kick'])

/** The accent wedge (">") — drawn, not typed, so it stays crisp at ~10px.
 *  Also used by the editor's brush chip, so both read the same. */
export function AccentMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 8" width="12" height="8" aria-hidden="true" focusable="false">
      <path
        d="M1.5 1.3 10.5 4 1.5 6.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function DrumGrid({ pattern, currentStep, onTap }: DrumGridProps) {
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
          const hits = pattern.hits[voice.id] ?? []
          const groupStart = GROUP_START.has(voice.id) ? 'is-group-start' : null
          return (
            <div className="drumgrid-row" role="row" key={voice.id}>
              <div
                className={['drumgrid-label mono', groupStart].filter(Boolean).join(' ')}
                role="rowheader"
                aria-label={voice.name}
                title={voice.name}
              >
                {/* Full names where there's room, short ones on phones. */}
                <span className="drumgrid-label-full" aria-hidden="true">
                  {voice.name}
                </span>
                <span className="drumgrid-label-short" aria-hidden="true">
                  {voice.short}
                </span>
              </div>
              {stepIndices.map((step) => {
                const raw = hits[step]
                const level: HitLevel = isHitLevel(raw) ? raw : HIT_OFF
                const on = level !== HIT_OFF
                const isBeat = step % beatSpan === 0
                const isBar = step % barSpan === 0
                const isPlayhead = currentStep >= 0 && step === currentStep
                const className = [
                  'drumgrid-cell',
                  on && 'is-on',
                  LEVEL[level].cls,
                  isBar
                    ? 'is-bar-start'
                    : isBeat
                      ? 'is-beat-start'
                      : null,
                  groupStart,
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
                    aria-pressed={on}
                    aria-label={`${voice.name} step ${step + 1}${
                      on ? `, ${LEVEL[level].label}` : ''
                    }`}
                    onClick={() => onTap(voice.id, step)}
                  >
                    {on ? (
                      <span className="drumgrid-glyph" aria-hidden="true">
                        {GLYPH[voice.glyph]}
                      </span>
                    ) : null}
                    {level === HIT_ACCENT ? <AccentMark className="drumgrid-accent" /> : null}
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
