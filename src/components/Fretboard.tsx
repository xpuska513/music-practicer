import React from 'react'
import type { FretboardProps, FretMark } from '../types'
import './Fretboard.css'

/**
 * Shared SVG fretboard.
 *
 * Coordinate system: everything is computed in an internal "neck space" where
 * one axis runs ALONG the neck (string-direction, 6 strings) and the other runs
 * ACROSS the frets (fretCount cells). We lay the neck out horizontally first,
 * then — for vertical orientation — swap (x, y) at the very end so all of the
 * geometry math only has to be written once.
 *
 * In horizontal neck space:
 *   x = position along the frets   (nut on the left, higher frets to the right)
 *   y = position across the strings
 * For HORIZONTAL output we keep this as-is but flip the string axis so that
 * high E (index 5) is on top and low E (index 0) on the bottom (tab view).
 * For VERTICAL output we transpose: frets run top->bottom, and low E (index 0)
 * is on the left, high E (index 5) on the right (chord-diagram view).
 */

/** Geometry constants (in SVG user units; the viewBox scales them to fit). */
const PAD = 28 // outer margin, leaves room for fret numbers / muted "x"
const CELL = 42 // length of one fret cell along the neck
const STRING_GAP = 26 // distance between adjacent strings
const STRING_COUNT = 6
const DOT_R = 11 // radius of a fretted-note dot
const OPEN_R = 8 // radius of an open-string ring
const INLAY_R = 5 // radius of an inlay position marker

/** Frets (relative to absolute fret number) that carry inlay markers. */
const SINGLE_INLAYS = new Set([3, 5, 7, 9])
const DOUBLE_INLAY = 12

const Fretboard: React.FC<FretboardProps> = ({
  marks,
  startFret = 0,
  fretCount = 15,
  orientation = 'horizontal',
  mutedStrings = [],
  showLabels = true,
  showFretNumbers = true,
  onCellClick,
}) => {
  const isVertical = orientation === 'vertical'

  // ── Neck-space extents ────────────────────────────────────────────────────
  // Along-axis spans the fret cells; across-axis spans the strings.
  const neckLength = fretCount * CELL // along the frets
  const neckWidth = (STRING_COUNT - 1) * STRING_GAP // across the strings

  // ── Mappers from "neck space" to SVG coordinates ──────────────────────────
  // `alongAt(fret)` -> distance from the nut for an absolute fret number.
  // The nut sits at startFret; cell n is centered half a cell into the window.
  const alongOffset = (absFret: number) => (absFret - startFret) * CELL
  // Center of the fret CELL between wire (fret-1) and wire (fret).
  const cellCenter = (absFret: number) => alongOffset(absFret) - CELL / 2

  // `acrossAt(stringIndex)` -> distance across the neck for a string index,
  // using the orientation-correct ordering.
  const acrossOffset = (stringIndex: number) => {
    // Horizontal: high E (5) on top -> smallest offset; low E (0) bottom.
    // Vertical:   low E (0) on left -> smallest offset; high E (5) right.
    const ordered = isVertical ? stringIndex : STRING_COUNT - 1 - stringIndex
    return ordered * STRING_GAP
  }

  /** Final SVG point: (alongNut + along, acrossNut + across), transposed if vertical. */
  const toXY = (along: number, across: number): { x: number; y: number } => {
    if (isVertical) {
      // frets run top->bottom, strings run left->right
      return { x: PAD + across, y: PAD + along }
    }
    // frets run left->right, strings run top->bottom
    return { x: PAD + along, y: PAD + across }
  }

  // ── Overall SVG size (viewBox) ────────────────────────────────────────────
  const innerLong = neckLength
  const innerShort = neckWidth
  const viewW = (isVertical ? innerShort : innerLong) + PAD * 2
  const viewH = (isVertical ? innerLong : innerShort) + PAD * 2

  const nutThickness = startFret === 0 ? 6 : 3

  // ── Fret wires (the lines between cells, including the nut at startFret) ───
  const fretWires: React.ReactElement[] = []
  for (let f = 0; f <= fretCount; f += 1) {
    const absFret = startFret + f
    const along = alongOffset(absFret)
    const a = toXY(along, 0)
    const b = toXY(along, neckWidth)
    const isNut = absFret === startFret && startFret === 0
    fretWires.push(
      <line
        key={`fret-${f}`}
        className={isNut ? 'fretboard__nut' : 'fretboard__fret'}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        strokeWidth={isNut ? nutThickness : 2}
      />,
    )
  }

  // ── String lines ──────────────────────────────────────────────────────────
  const stringLines: React.ReactElement[] = []
  for (let s = 0; s < STRING_COUNT; s += 1) {
    const across = acrossOffset(s)
    const a = toXY(0, across)
    const b = toXY(neckLength, across)
    // Thicker strings (low E) draw slightly heavier for legibility.
    const weight = 1 + (STRING_COUNT - 1 - s) * 0.22
    stringLines.push(
      <line
        key={`string-${s}`}
        className="fretboard__string"
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        strokeWidth={weight}
      />,
    )
  }

  // ── Inlay markers (centered in the cell, on the neck centerline) ──────────
  const inlays: React.ReactElement[] = []
  const neckCenterAcross = neckWidth / 2
  for (let f = 1; f <= fretCount; f += 1) {
    const absFret = startFret + f
    const along = cellCenter(absFret)
    if (absFret === DOUBLE_INLAY) {
      // Two dots straddling the centerline.
      const d1 = toXY(along, neckCenterAcross - STRING_GAP)
      const d2 = toXY(along, neckCenterAcross + STRING_GAP)
      inlays.push(
        <circle key={`inlay-${f}-a`} className="fretboard__inlay" cx={d1.x} cy={d1.y} r={INLAY_R} />,
        <circle key={`inlay-${f}-b`} className="fretboard__inlay" cx={d2.x} cy={d2.y} r={INLAY_R} />,
      )
    } else if (SINGLE_INLAYS.has(absFret)) {
      const d = toXY(along, neckCenterAcross)
      inlays.push(
        <circle key={`inlay-${f}`} className="fretboard__inlay" cx={d.x} cy={d.y} r={INLAY_R} />,
      )
    }
  }

  // ── Fret-number axis ──────────────────────────────────────────────────────
  const fretNumbers: React.ReactElement[] = []
  if (showFretNumbers) {
    for (let f = 1; f <= fretCount; f += 1) {
      const absFret = startFret + f
      const along = cellCenter(absFret)
      // Place numbers just beyond the far edge of the neck (bottom/right).
      const labelAcross = isVertical ? -PAD * 0.55 : neckWidth + PAD * 0.55
      const p = toXY(along, labelAcross)
      fretNumbers.push(
        <text key={`fnum-${f}`} className="fretboard__fretnum" x={p.x} y={p.y} fontSize={12}>
          {absFret}
        </text>,
      )
    }
  }

  // ── Starting-fret marker when the window doesn't begin at the nut ─────────
  let startFretLabel: React.ReactElement | null = null
  if (startFret > 0) {
    const along = cellCenter(startFret + 1)
    const acrossEdge = isVertical ? neckWidth + PAD * 0.55 : -PAD * 0.55
    const p = toXY(along, acrossEdge)
    startFretLabel = (
      <text className="fretboard__startfret" x={p.x} y={p.y} fontSize={13}>
        {`${startFret + 1}fr`}
      </text>
    )
  }

  // ── Muted-string "x" markers at the nut end ───────────────────────────────
  const mutedMarks: React.ReactElement[] = []
  for (const s of mutedStrings) {
    if (s < 0 || s >= STRING_COUNT) continue
    const across = acrossOffset(s)
    // Sit just outside the nut edge (the "open" side of the neck).
    const p = toXY(-PAD * 0.5, across)
    mutedMarks.push(
      <text key={`mute-${s}`} className="fretboard__muted" x={p.x} y={p.y} fontSize={15}>
        ×
      </text>,
    )
  }

  // ── Note marks (fretted dots + open rings) ────────────────────────────────
  const dots: React.ReactElement[] = []
  marks.forEach((mark: FretMark, i: number) => {
    if (mark.string < 0 || mark.string >= STRING_COUNT) return

    const absFret = mark.fret
    // Skip marks outside the visible window.
    if (absFret < startFret || absFret > startFret + fretCount) return

    const across = acrossOffset(mark.string)
    const fill = mark.color ?? (mark.isRoot ? 'var(--dot-root)' : 'var(--dot)')

    if (absFret === 0) {
      // Open string: hollow ring sitting at the nut edge of that string.
      const along = alongOffset(startFret) - OPEN_R - 4
      const p = toXY(along, across)
      dots.push(
        <circle
          key={`mark-${i}`}
          className="fretboard__dot-ring"
          cx={p.x}
          cy={p.y}
          r={OPEN_R}
          stroke={fill}
        />,
      )
    } else {
      // Fretted note: filled dot centered in its fret cell.
      const along = cellCenter(absFret)
      const p = toXY(along, across)
      dots.push(
        <g key={`mark-${i}`}>
          <circle cx={p.x} cy={p.y} r={DOT_R} fill={fill} />
          {showLabels && mark.label ? (
            <text className="fretboard__label" x={p.x} y={p.y} fontSize={11}>
              {mark.label}
            </text>
          ) : null}
        </g>,
      )
    }
  })

  // ── Interactive hit targets (one transparent rect per clickable cell) ─────
  const hitTargets: React.ReactElement[] = []
  if (onCellClick) {
    for (let s = 0; s < STRING_COUNT; s += 1) {
      const acrossCenter = acrossOffset(s)
      const across0 = acrossCenter - STRING_GAP / 2
      const across1 = acrossCenter + STRING_GAP / 2

      const pushHit = (along0: number, along1: number, fret: number) => {
        const a = toXY(along0, across0)
        const b = toXY(along1, across1)
        hitTargets.push(
          <rect
            key={`hit-${s}-${fret}`}
            className="fretboard__hit"
            x={Math.min(a.x, b.x)}
            y={Math.min(a.y, b.y)}
            width={Math.abs(b.x - a.x)}
            height={Math.abs(b.y - a.y)}
            onClick={() => onCellClick(s, fret)}
          >
            <title>{`string ${s + 1}, ${fret === 0 ? 'open' : `fret ${fret}`}`}</title>
          </rect>,
        )
      }

      // Open-string / nut cell, only when the nut is in view.
      if (startFret === 0) pushHit(-PAD, 0, 0)
      // One hit target per visible fret cell.
      for (let f = 1; f <= fretCount; f += 1) {
        const absFret = startFret + f
        pushHit(alongOffset(absFret - 1), alongOffset(absFret), absFret)
      }
    }
  }

  return (
    <svg
      className={`fretboard${onCellClick ? ' fretboard--interactive' : ''}`}
      viewBox={`0 0 ${viewW} ${viewH}`}
      role="img"
      aria-label="Guitar fretboard diagram"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Neck background spanning the playable window. */}
      {(() => {
        const a = toXY(0, 0)
        const b = toXY(neckLength, neckWidth)
        return (
          <rect
            className="fretboard__wood"
            x={Math.min(a.x, b.x)}
            y={Math.min(a.y, b.y)}
            width={Math.abs(b.x - a.x)}
            height={Math.abs(b.y - a.y)}
            rx={4}
          />
        )
      })()}

      {inlays}
      {fretWires}
      {stringLines}
      {fretNumbers}
      {startFretLabel}
      {mutedMarks}
      {dots}
      {hitTargets}
    </svg>
  )
}

export default Fretboard
