import { useEffect, useMemo, useRef, useState } from 'react'
import type { MotionAction, TechniqueMotion as Motion } from '../theory/techniques'
import './TechniqueMotion.css'

/**
 * A small, data-driven SVG that animates a technique's motion in time with the
 * trainer's BPM. The `motion.steps` list is one loop; the active step advances
 * `motion.stepsPerBeat` steps per beat, so the diagram re-paces live as the
 * tempo changes. The active note pulses ("strikes") each step and carries a
 * glyph (↓ ↑ h p ✕ …) describing the stroke. Respects `prefers-reduced-motion`
 * by freezing on the first step.
 */

// ── Geometry (SVG user units; the viewBox scales to the container) ──────────
const PAD_L = 26 // room for the string labels on the left
const PAD_R = 30 // room for the "P.M." bracket / glyphs on the right
const PAD_T = 22 // room for the glyph above the top string
const PAD_B = 14
const CELL = 34 // width of one fret cell
const ROW = 26 // distance between strings
const DOT_R = 9

/** Symbol drawn on the active note for each action. */
const ACTION_GLYPH: Record<MotionAction, string> = {
  down: '↓',
  up: '↑',
  i: 'i',
  m: 'm',
  hammer: 'h',
  pull: 'p',
  slap: 'T',
  pop: 'P',
  mute: '✕',
  bend: '↗',
  tap: 't',
}

interface TechniqueMotionProps {
  motion: Motion
  bpm: number
}

export default function TechniqueMotion({ motion, bpm }: TechniqueMotionProps) {
  const { strings, frets, steps, stepsPerBeat, palmMute } = motion
  const stepCount = steps.length

  // Honour the OS "reduce motion" setting — freeze on step 0 instead of looping.
  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // `tick` = cumulative steps elapsed; the active step is tick % stepCount, and
  // `tick` (not the index) keys the active overlay so the strike animation
  // re-fires every step — even for single-step loops like a bend.
  const [tick, setTick] = useState(0)
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm

  useEffect(() => {
    if (reduceMotion || stepCount === 0) return
    let raf = 0
    let last: number | null = null
    let accum = 0 // fractional steps elapsed since mount
    let shown = -1

    const loop = (now: number) => {
      if (last === null) last = now
      const dt = now - last
      last = now
      // Steps-per-millisecond at the current tempo; advance the phase by dt.
      const stepMs = 60000 / Math.max(1, bpmRef.current) / stepsPerBeat
      accum += dt / stepMs
      const t = Math.floor(accum)
      if (t !== shown) {
        shown = t
        setTick(t)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // Restart the loop when the pattern changes (technique switch); tempo is
    // read live via bpmRef, so a BPM change does NOT restart it.
  }, [reduceMotion, stepCount, stepsPerBeat])

  const active = stepCount > 0 ? ((tick % stepCount) + stepCount) % stepCount : 0

  // ── Layout maths ───────────────────────────────────────────────────────────
  const cols = Math.max(frets, 1)
  const boardLeft = PAD_L
  const boardRight = boardLeft + cols * CELL
  // Open notes sit just inside the nut (clear of the string label); fretted
  // notes are centered in their cell. The inset stays < half a cell so it never
  // collides with a fret-1 dot.
  const xForFret = (fret: number) =>
    fret === 0 ? boardLeft + 14 : boardLeft + (fret - 0.5) * CELL
  const yForString = (s: number) => PAD_T + s * ROW
  const width = boardRight + PAD_R
  const height = PAD_T + (strings.length - 1) * ROW + PAD_B + 8

  const fretWires = useMemo(() => {
    const wires: number[] = []
    for (let f = 0; f <= frets; f++) wires.push(f)
    return wires
  }, [frets])

  const topY = yForString(0)
  const bottomY = yForString(strings.length - 1)

  const activeStep = steps[active]
  const activeGlyph = activeStep ? ACTION_GLYPH[activeStep.action] : ''
  const activeIsMute = activeStep?.action === 'mute'
  const activeIsBend = activeStep?.action === 'bend'
  const stepMs = 60000 / Math.max(1, bpm) / stepsPerBeat

  return (
    <svg
      className="tm"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Motion diagram: ${motion.caption}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Nut + fret wires */}
      {fretWires.map((f) => {
        const x = boardLeft + f * CELL
        return (
          <line
            key={`wire-${f}`}
            className={f === 0 ? 'tm-nut' : 'tm-fret'}
            x1={x}
            y1={topY}
            x2={x}
            y2={bottomY}
          />
        )
      })}

      {/* Strings + labels */}
      {strings.map((label, s) => {
        const y = yForString(s)
        return (
          <g key={`string-${s}`}>
            <line
              className="tm-string"
              x1={boardLeft}
              y1={y}
              x2={boardRight}
              y2={y}
              strokeWidth={1 + (strings.length - 1 - s) * 0.3}
            />
            <text className="tm-string-label" x={boardLeft - 8} y={y}>
              {label}
            </text>
          </g>
        )
      })}

      {/* Palm-mute bracket at the bridge */}
      {palmMute ? (
        <g className="tm-pm">
          <line
            className="tm-pm-line"
            x1={boardRight + 4}
            y1={topY - 6}
            x2={boardRight + 4}
            y2={bottomY + 6}
          />
          <text className="tm-pm-label" x={boardRight + 8} y={topY - 10}>
            P.M.
          </text>
        </g>
      ) : null}

      {/* Faint "ghost" of every step so the whole shape is visible at once */}
      {steps.map((step, i) =>
        i === active ? null : (
          <circle
            key={`ghost-${i}`}
            className="tm-ghost"
            cx={xForFret(step.fret)}
            cy={yForString(step.string)}
            r={DOT_R - 3}
          />
        ),
      )}

      {/* Active note — re-keyed by tick so the strike animation re-fires. */}
      {activeStep ? (
        <g
          key={tick}
          className={
            'tm-active' +
            (activeIsBend ? ' tm-active--bend' : '') +
            (activeIsMute ? ' tm-active--mute' : '')
          }
          style={activeIsBend ? { animationDuration: `${stepMs}ms` } : undefined}
        >
          {activeIsMute ? (
            <text
              className="tm-mute-x"
              x={xForFret(activeStep.fret)}
              y={yForString(activeStep.string)}
            >
              ✕
            </text>
          ) : (
            <circle
              className="tm-dot"
              cx={xForFret(activeStep.fret)}
              cy={yForString(activeStep.string)}
              r={DOT_R}
            />
          )}
          {!activeIsMute && activeGlyph ? (
            <text
              className="tm-glyph"
              x={xForFret(activeStep.fret)}
              y={yForString(activeStep.string) - DOT_R - 5}
            >
              {activeGlyph}
            </text>
          ) : null}
        </g>
      ) : null}
    </svg>
  )
}
