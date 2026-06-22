import {
  BEATS_PER_BAR,
  DRUM_VOICES,
  stepCount,
  type DrumPattern,
  type DrumVoiceId,
} from '../theory/drums'
import './DrumNotation.css'

interface DrumNotationProps {
  pattern: DrumPattern
  currentStep: number
}

/** Layout constants (SVG user units). */
const STEP_W = 26 // horizontal space per step
const LEFT_PAD = 24 // left margin before first step
const RIGHT_PAD = 24
const STAFF_GAP = 12 // vertical gap between staff lines
const TOP = 28 // y of the top staff line
const STAFF_LINES = 5
const STEM_LEN = 26
const HEAD_R = 5

const BOTTOM = TOP + (STAFF_LINES - 1) * STAFF_GAP

/**
 * Fixed vertical position (notehead centre y) per voice.
 * Cymbals sit above the top line, drums descend down the staff:
 * tom upper-middle, snare middle, kick lowest.
 */
const VOICE_Y: Record<DrumVoiceId, number> = {
  crash: TOP - STAFF_GAP * 1.5, // well above the top line
  hihat: TOP - STAFF_GAP, // above the top line
  openhh: TOP - STAFF_GAP, // above the top line (hollow ring)
  tom: TOP + STAFF_GAP, // upper-middle (2nd line)
  snare: TOP + STAFF_GAP * 2, // middle (3rd line)
  kick: BOTTOM, // lowest (bottom line)
}

function stepX(step: number): number {
  return LEFT_PAD + step * STEP_W + STEP_W / 2
}

export default function DrumNotation({ pattern, currentStep }: DrumNotationProps) {
  const steps = stepCount(pattern)
  const stepsPerBar = BEATS_PER_BAR * pattern.subdivision
  const width = LEFT_PAD + steps * STEP_W + RIGHT_PAD
  const height = BOTTOM + STEM_LEN + 16

  const staffLeft = LEFT_PAD - 8
  const staffRight = width - RIGHT_PAD + 8

  return (
    <div className="drum-notation" role="img" aria-label={`Drum notation: ${pattern.name}`}>
      <svg
        className="drum-notation__svg"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        preserveAspectRatio="xMinYMid meet"
      >
        {/* Staff lines */}
        {Array.from({ length: STAFF_LINES }, (_, i) => {
          const y = TOP + i * STAFF_GAP
          return (
            <line
              key={`staff-${i}`}
              className="drum-notation__staff-line"
              x1={staffLeft}
              y1={y}
              x2={staffRight}
              y2={y}
            />
          )
        })}

        {/* Beat lines (light) + bar lines (strong) */}
        {Array.from({ length: steps + 1 }, (_, step) => {
          const isBar = step % stepsPerBar === 0
          const isBeat = step % pattern.subdivision === 0
          if (!isBeat) return null
          const x = step === steps ? staffRight : LEFT_PAD + step * STEP_W
          return (
            <line
              key={`grid-${step}`}
              className={isBar ? 'drum-notation__barline' : 'drum-notation__beatline'}
              x1={x}
              y1={TOP}
              x2={x}
              y2={BOTTOM}
            />
          )
        })}

        {/* Time-signature-ish hint */}
        <text className="drum-notation__sig" x={LEFT_PAD - 14} y={TOP + STAFF_GAP * 1.4}>
          {BEATS_PER_BAR}
        </text>
        <text className="drum-notation__sig" x={LEFT_PAD - 14} y={TOP + STAFF_GAP * 3.4}>
          4
        </text>

        {/* Noteheads + stems */}
        {DRUM_VOICES.map((voice) => {
          const hits = pattern.hits[voice.id]
          const y = VOICE_Y[voice.id]
          return hits.map((on, step) => {
            if (!on) return null
            const x = stepX(step)
            const stemUp = y >= TOP + STAFF_GAP * 2 // lower voices: stem up
            const stemY2 = stemUp ? y - STEM_LEN : y + STEM_LEN
            const stemX = stemUp ? x + HEAD_R : x - HEAD_R
            const key = `${voice.id}-${step}`
            return (
              <g key={key} className="drum-notation__note">
                {voice.glyph === 'x' ? (
                  <>
                    <line
                      className="drum-notation__head-x"
                      x1={x - HEAD_R}
                      y1={y - HEAD_R}
                      x2={x + HEAD_R}
                      y2={y + HEAD_R}
                    />
                    <line
                      className="drum-notation__head-x"
                      x1={x - HEAD_R}
                      y1={y + HEAD_R}
                      x2={x + HEAD_R}
                      y2={y - HEAD_R}
                    />
                  </>
                ) : voice.glyph === 'o' ? (
                  <circle
                    className="drum-notation__head-open"
                    cx={x}
                    cy={y}
                    r={HEAD_R}
                  />
                ) : (
                  <circle
                    className="drum-notation__head-dot"
                    cx={x}
                    cy={y}
                    r={HEAD_R}
                  />
                )}
                <line
                  className="drum-notation__stem"
                  x1={stemX}
                  y1={y}
                  x2={stemX}
                  y2={stemY2}
                />
              </g>
            )
          })
        })}

        {/* Playhead */}
        {currentStep >= 0 && currentStep < steps && (
          <line
            className="drum-notation__playhead"
            x1={stepX(currentStep)}
            y1={TOP - STAFF_GAP * 2}
            x2={stepX(currentStep)}
            y2={BOTTOM + STEM_LEN + 4}
          />
        )}
      </svg>
    </div>
  )
}
