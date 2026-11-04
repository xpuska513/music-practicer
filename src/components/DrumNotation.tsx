import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement, RefObject } from 'react'
// Bravura (SMuFL, SIL OFL) — the same self-hosted file the Songs viewer uses,
// so it's fetched once and shared. Only the URL lands in this bundle.
import bravuraWoff2 from '@coderline/alphatab/font/Bravura.woff2?url'
import { BEATS_PER_BAR, DRUM_VOICES, HIT_ACCENT, HIT_GHOST, HIT_OFF, stepCount } from '../theory/drums'
import type { DrumPattern, DrumVoiceId, HitLevel } from '../theory/drums'
import { DRUM_STAFF_POS, spellDrumPattern } from '../theory/drumNotation'
import type { NotationEvent, NotationGroup, NoteValue, StemDir } from '../theory/drumNotation'
import './DrumNotation.css'

interface DrumNotationProps {
  pattern: DrumPattern
  currentStep: number
}

/* ── Engraving constants (SVG px, drawn 1:1). One staff space = S; SMuFL
   glyphs are designed at 4 staff spaces per em. Proportions follow Bravura's
   engraving defaults (stem 0.12, beam 0.5, beam spacing 0.25 spaces). ── */
const S = 10
const FONT = 4 * S
const STEM_W = 0.12 * S
const STEM_LEN = 3.5 * S
const BEAM_H = 0.5 * S
const BEAM_STEP = 0.75 * S // primary → secondary beam (thickness + spacing)
const HEAD_W = 1.18 * S // noteheadBlack (X heads are 1.16)
const THIN = 0.16 * S
const THICK = 0.5 * S
const BAR_PAD_L = 0.8 * S // after a barline, before the first slot
const BAR_PAD_R = 0.4 * S
const FIRST_LEFT = 5.6 * S // clef + time signature
const LEFT = 2.8 * S // clef only (later systems)
const END = 1.9 * S // closing repeat barline
const SYSTEM_GAP = 1.5 * S
const MAX_BEAT = 14 * S
/** Narrowest readable beat: 16ths need ~1.6 spaces per slot — ~1.95 when two
 *  ghost notes' brackets face each other from neighbouring slots (the zoom
 *  floor then drops a touch, so a bar of 16ths still fits a 390px phone). */
const minBeat = (sub: number, ghostsTouch: boolean) =>
  Math.max(4.2 * S, (ghostsTouch ? 1.95 : 1.6) * S * sub)

/* ── Dynamics, and the marks stacked beyond the stem end. Ghost notes are
   bracketed with noteheadParenthesisLeft / Right; alphaTab's Bravura metadata
   omits those two, so their metrics come from the font's outlines: each
   advances 0.292 spaces, ink x 0…0.436 (left) / −0.144…0.292 (right), y ±0.724.
   Bravura's own noteheadParenthesis pairs them at notehead.left − 0.292 and
   notehead.left + the head's width, as we do. Accents (articAccentAbove /
   Below) are 1.356 × 0.98 spaces, sitting on / hanging from the baseline. ── */
const PAREN_W = 0.292 * S
const NEAR_PAD = 0.14 * S // brackets beside a head a third away
const SPLIT_PAD = 0.2 * S // brackets around a chord with heads both sides of the stem
const ACCENT_W = 1.356 * S
const ACCENT_H = 0.98 * S
const OPEN_R = 0.32 * S // open hi-hat "o"
const OPEN_STROKE = 0.13 * S
const OPEN_OUT = OPEN_R + OPEN_STROKE / 2 // the "o"'s outer radius
const MARK_GAP = 0.5 * S // stem end / beam → first mark
const STACK_GAP = 0.3 * S // between stacked marks
const TUPLET_SIZE = 3 * S // the tuplet "3" is set at ¾ size…
const TUPLET_ASCENT = 1.5 * (TUPLET_SIZE / 4) // …so tuplet3's 1.5-space height shrinks too
const TUPLET_GAP = 0.6 * S
const EDGE_PAD = S // air between the outermost mark and the system's edge

/** SMuFL code points. */
const GLYPH = {
  clef: '\uE069', // unpitchedPercussionClef1
  timeSig: (n: number) => String.fromCharCode(0xe080 + n),
  headBlack: '\uE0A4',
  headX: '\uE0A9',
  parenLeft: '\uE0F5', // noteheadParenthesisLeft
  parenRight: '\uE0F6', // noteheadParenthesisRight
  accentAbove: '\uE4A0',
  accentBelow: '\uE4A1',
  tuplet3: '\uE883',
}
const REST: Record<NoteValue, { ch: string; w: number }> = {
  whole: { ch: '\uE4E3', w: 1.128 * S },
  half: { ch: '\uE4E4', w: 1.128 * S },
  quarter: { ch: '\uE4E5', w: 1.08 * S },
  eighth: { ch: '\uE4E6', w: 0.988 * S },
  sixteenth: { ch: '\uE4E7', w: 1.28 * S },
}
/** Flags + their stem anchors (Bravura metadata: stemUpNW / stemDownSW, y). */
const FLAG = {
  up: { eighth: { ch: '\uE240', dy: -0.04 * S }, sixteenth: { ch: '\uE242', dy: -0.088 * S } },
  down: { eighth: { ch: '\uE241', dy: 0.132 * S }, sixteenth: { ch: '\uE243', dy: 0.128 * S } },
}

const IS_CYMBAL: Record<DrumVoiceId, boolean> = Object.fromEntries(
  DRUM_VOICES.map((v) => [v.id, v.glyph !== 'dot']),
) as Record<DrumVoiceId, boolean>

/* ── Music font loading (once per page) ── */
const MUSIC_FONT = 'MP Bravura'
let musicFont: Promise<boolean> | null = null
function loadMusicFont(): Promise<boolean> {
  if (!musicFont) {
    musicFont = new FontFace(MUSIC_FONT, `url(${bravuraWoff2}) format('woff2')`)
      .load()
      .then((face) => {
        document.fonts.add(face)
        return true
      })
      .catch(() => false)
  }
  return musicFont
}

function useMusicFont(): 'loading' | 'ready' | 'failed' {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  useEffect(() => {
    let alive = true
    loadMusicFont().then((ok) => alive && setState(ok ? 'ready' : 'failed'))
    return () => {
      alive = false
    }
  }, [])
  return state
}

function useWidth(ref: RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return width
}

/** Drawing scale: notation reads better a little larger on roomy screens. */
const zoomFor = (width: number) => (width >= 720 ? 1.3 : width >= 520 ? 1.15 : 1)

/* ── Vertical layout (pure; relative to the staff's top line) ── */

/** One notehead of a stem; voices that share a staff position share a head. */
interface Head {
  pos: number
  /** Centre y, relative to the staff's top line. */
  y: number
  cymbal: boolean
  /** Bracketed: the strongest stroke on this head is a ghost note. */
  ghost: boolean
}

/** A note's vertical layout. */
interface NoteLayout {
  e: NotationEvent
  /** Top → bottom. */
  heads: Head[]
  stemEnd: number
  /** Accent baseline beyond the stem end, or null when not accented. */
  accentY: number | null
  /** Centre of the open hi-hat "o", beyond any accent (stems up only). */
  openY: number | null
}

/** One voice-beat's vertical layout. It needs no x, so useGeometry sizes the
 *  systems from the same numbers the renderer draws with. */
interface GroupLayout {
  stem: StemDir
  notes: NoteLayout[]
  /** Outer edge of the shared beam (beamed groups only). */
  beamY: number
  /** Baseline of the tuplet "3", or null. */
  tupletY: number | null
  /** Outermost ink on the stem side (min y stems up, max y stems down), or
   *  null for a group of rests. */
  reach: number | null
}

/** A stem event's heads, top → bottom. Voices on one staff position (hi-hat +
 *  open hi-hat) merge into one head, at the strongest of their levels. */
function headsOf(e: NotationEvent): Head[] {
  const byPos = new Map<number, { cymbal: boolean; level: HitLevel }>()
  for (const v of e.voices) {
    const pos = DRUM_STAFF_POS[v]
    const level = e.levels[v] ?? HIT_OFF
    const seen = byPos.get(pos)
    if (!seen) byPos.set(pos, { cymbal: IS_CYMBAL[v], level })
    else if (level > seen.level) seen.level = level
  }
  return [...byPos.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pos, h]) => ({ pos, y: (pos * S) / 2, cymbal: h.cymbal, ghost: h.level === HIT_GHOST }))
}

/** Stems, beam, and the marks beyond the stem end — an accent, then the open
 *  hi-hat "o", then (per group) the tuplet "3" — each stacked further out. */
function layoutGroup(g: NotationGroup): GroupLayout {
  const up = g.stem === 'up'
  const out = up ? -1 : 1 // away from the staff, on the stem side
  const chords = g.events
    .filter((e) => e.voices.length > 0)
    .map((e) => ({ e, heads: headsOf(e) }))

  // Beamed groups share one horizontal beam; single notes get their own stem.
  const beamY = g.beamed
    ? up
      ? Math.min(...chords.map((c) => c.heads[0].y)) - STEM_LEN
      : Math.max(...chords.map((c) => c.heads[c.heads.length - 1].y)) + STEM_LEN
    : 0

  const notes: NoteLayout[] = []
  const edges: number[] = []
  for (const { e, heads } of chords) {
    const extra = !g.beamed && e.value === 'sixteenth' ? 0.5 * S : 0
    const stemEnd = g.beamed
      ? beamY
      : up
        ? heads[0].y - STEM_LEN - extra
        : heads[heads.length - 1].y + STEM_LEN + extra
    let edge = stemEnd
    let gap = MARK_GAP
    let accentY: number | null = null
    let openY: number | null = null
    if (e.voices.some((v) => e.levels[v] === HIT_ACCENT)) {
      accentY = edge + out * gap
      edge = accentY + out * ACCENT_H
      gap = STACK_GAP
    }
    if (up && e.voices.includes('openhh')) {
      openY = edge - gap - OPEN_OUT
      edge = openY - OPEN_OUT
    }
    notes.push({ e, heads, stemEnd, accentY, openY })
    edges.push(edge)
  }

  // The tuplet number clears every note's marks.
  let reach = edges.length === 0 ? null : up ? Math.min(...edges) : Math.max(...edges)
  let tupletY: number | null = null
  if (g.tuplet === 3 && reach !== null) {
    tupletY = up ? reach - TUPLET_GAP : reach + TUPLET_GAP + TUPLET_ASCENT
    reach = up ? tupletY - TUPLET_ASCENT : tupletY
  }
  return { stem: g.stem, notes, beamY, tupletY, reach }
}

/** True when ghost notes on one stem sit in neighbouring slots at nearby
 *  pitches — their brackets would touch at the usual spacing. */
function ghostsTouch(groups: NotationGroup[]): boolean {
  // Staff positions of ghost strokes, per stem and step.
  const ghosts: Record<StemDir, Map<number, number[]>> = { up: new Map(), down: new Map() }
  for (const g of groups) {
    for (const e of g.events) {
      for (const v of e.voices) {
        if (e.levels[v] !== HIT_GHOST) continue
        const at = ghosts[g.stem]
        at.set(e.step, [...(at.get(e.step) ?? []), DRUM_STAFF_POS[v]])
      }
    }
  }
  return (['up', 'down'] as const).some((stem) =>
    [...ghosts[stem]].some(([step, here]) =>
      (ghosts[stem].get(step + 1) ?? []).some((q) => here.some((p) => Math.abs(p - q) <= 2)),
    ),
  )
}

/** Horizontal + vertical layout of the pattern's systems (rows of bars). */
function useGeometry(
  pattern: DrumPattern,
  groups: NotationGroup[],
  layouts: GroupLayout[],
  width: number,
) {
  return useMemo(() => {
    const sub = pattern.subdivision
    const perBar = BEATS_PER_BAR * sub
    const zoom = zoomFor(width)
    const avail = Math.max(width, 0) / zoom
    const fit = (bars: number) =>
      (avail - FIRST_LEFT - END - bars * (BAR_PAD_L + BAR_PAD_R)) / (bars * BEATS_PER_BAR)
    const tight = ghostsTouch(groups)
    const narrowest = minBeat(sub, tight)

    // Keep both bars on one row when they fit; otherwise one bar per row.
    let perSystem = pattern.bars
    let beatW = fit(perSystem)
    if (beatW < narrowest && perSystem > 1) {
      perSystem = 1
      beatW = fit(1)
    }
    beatW = Math.min(Math.max(beatW, narrowest), MAX_BEAT)
    const barW = BAR_PAD_L + BEATS_PER_BAR * beatW + BAR_PAD_R
    const systems = Math.ceil(pattern.bars / perSystem)

    // Vertical room: the usual allowance for stems, beams, flags and marks —
    // or more, when stacked accents / "o" / tuplet numbers reach further.
    const ys = (stem: StemDir) =>
      groups
        .filter((g) => g.stem === stem)
        .flatMap((g) => g.events.flatMap((e) => e.voices.map((v) => (DRUM_STAFF_POS[v] * S) / 2)))
    const reach = (stem: StemDir) =>
      layouts.flatMap((l) => (l.stem === stem && l.reach !== null ? [l.reach] : []))
    const upYs = ys('up')
    const downYs = ys('down')
    const upReach = reach('up')
    const downReach = reach('down')
    const above = Math.max(
      2.5 * S,
      upYs.length ? -(Math.min(...upYs) - STEM_LEN - 2.4 * S) : 0,
      upReach.length ? EDGE_PAD - Math.min(...upReach) : 0,
    )
    const below = Math.max(
      5.5 * S,
      downYs.length ? Math.max(...downYs) + STEM_LEN + 2.4 * S : 0,
      downReach.length ? Math.max(...downReach) + EDGE_PAD : 0,
    )
    const systemH = above + below

    const contentX = (sys: number) => (sys === 0 ? FIRST_LEFT : LEFT)
    const systemOf = (bar: number) => Math.floor(bar / perSystem)
    const barsIn = (sys: number) => Math.min(perSystem, pattern.bars - sys * perSystem)
    const systemRight = (sys: number) =>
      contentX(sys) + barsIn(sys) * barW + (sys === systems - 1 ? END : 0)
    const barX = (bar: number) => contentX(systemOf(bar)) + (bar % perSystem) * barW
    const topY = (bar: number) => systemOf(bar) * (systemH + SYSTEM_GAP) + above
    const stepW = beatW / sub
    const stepX = (step: number) => {
      const bar = Math.floor(step / perBar)
      const inBar = step % perBar
      return barX(bar) + BAR_PAD_L + Math.floor(inBar / sub) * beatW + ((inBar % sub) + 0.5) * stepW
    }

    const totalW = Math.ceil(Math.max(...Array.from({ length: systems }, (_, s) => systemRight(s))))
    return {
      width: totalW,
      height: Math.ceil(systems * systemH + (systems - 1) * SYSTEM_GAP),
      // On very narrow screens shrink a touch (not below ~80%, or ~76% when
      // facing ghost brackets need the extra width) before scrolling.
      zoom: width > 0 && totalW * zoom > width ? Math.max(tight ? 0.76 : 0.8, width / totalW) : zoom,
      perSystem,
      systems,
      above,
      systemH,
      barW,
      stepW,
      contentX,
      systemRight,
      barX,
      topY,
      stepX,
    }
  }, [pattern.bars, pattern.subdivision, groups, layouts, width])
}

type Geometry = ReturnType<typeof useGeometry>

/** Notes, stems, beams, flags, rests, dynamics and tuplet marks for one voice-beat. */
function renderGroup(
  g: NotationGroup,
  lay: GroupLayout,
  key: string,
  geo: Geometry,
  twoVoices: boolean,
  now: number,
): ReactElement[] {
  const out: ReactElement[] = []
  const up = g.stem === 'up'
  const top = geo.topY(g.bar)

  // Stems run along the noteheads' right edge (stems up) or left edge (down).
  const info = lay.notes.map((n) => {
    const x = geo.stepX(n.e.step)
    return { ...n, stemLeft: up ? x + HEAD_W / 2 - STEM_W : x - HEAD_W / 2 }
  })

  for (const n of info) {
    const { e, heads, stemLeft } = n
    const isNow = e.step === now
    const cls = 'drum-notation__note' + (isNow ? ' is-now' : '')
    const stemEnd = top + n.stemEnd
    const stemX = stemLeft + STEM_W / 2 // marks beyond the stem end centre on it

    // Noteheads — in a second (crash over hi-hat) the note nearer the stem end
    // flips to the other side of the stem. Walk out from the note the stem
    // starts at (lowest for stems-up, highest for stems-down).
    let prevPos = Number.NaN
    let prevFlipped = false
    const placed = (up ? [...heads].reverse() : heads).map((h) => {
      const flipped: boolean = Math.abs(h.pos - prevPos) === 1 && !prevFlipped
      prevPos = h.pos
      prevFlipped = flipped
      const w = h.cymbal ? 1.16 * S : HEAD_W
      const left = up
        ? flipped
          ? stemLeft
          : stemLeft + STEM_W - w
        : flipped
          ? stemLeft - w + STEM_W
          : stemLeft
      return { ...h, y: top + h.y, w, left, flipped }
    })
    // Ghost brackets stand in one column each side of the chord: hugging the
    // head as usual; nudged out when another head sits within a third (the
    // bracket tips would graze it); and outside both columns, further out,
    // when a second puts heads on both sides of the stem.
    const crowded = placed.some(
      (h) => h.ghost && placed.some((o) => o !== h && Math.abs(o.pos - h.pos) <= 2),
    )
    const pad = placed.some((h) => h.flipped) ? SPLIT_PAD : crowded ? NEAR_PAD : 0
    const headsRight = Math.max(...placed.map((h) => h.left + h.w))
    const parenLeftX = Math.min(...placed.map((h) => h.left)) - pad - PAREN_W
    const parenRightX = headsRight + pad
    const hasGhost = placed.some((h) => h.ghost)
    // Augmentation dots clear every head, the brackets and the stem.
    const dotX =
      Math.max(headsRight, hasGhost ? parenRightX + PAREN_W : 0, stemLeft + STEM_W) + 0.45 * S
    for (const { pos, y, w, left, cymbal, ghost } of placed) {
      // Ledger lines above the staff (crash sits on the first one).
      for (let p = -2; p >= pos; p -= 2) {
        out.push(
          <rect
            key={`${key}-l${e.step}-${p}`}
            className="drum-notation__line"
            x={left - 0.4 * S}
            y={top + (p * S) / 2 - 0.08 * S}
            width={w + 0.8 * S}
            height={0.16 * S}
          />,
        )
      }
      out.push(
        <text key={`${key}-h${e.step}-${pos}`} className={`drum-notation__glyph ${cls}`} x={left} y={y} fontSize={FONT}>
          {cymbal ? GLYPH.headX : GLYPH.headBlack}
        </text>,
      )
      // Ghost note: the head in brackets.
      if (ghost) {
        out.push(
          <text key={`${key}-pl${e.step}-${pos}`} className={`drum-notation__glyph ${cls}`} x={parenLeftX} y={y} fontSize={FONT}>
            {GLYPH.parenLeft}
          </text>,
          <text key={`${key}-pr${e.step}-${pos}`} className={`drum-notation__glyph ${cls}`} x={parenRightX} y={y} fontSize={FONT}>
            {GLYPH.parenRight}
          </text>,
        )
      }
      if (e.dotted) {
        const dotY = pos % 2 !== 0 ? y : y - S / 2 // dots live in spaces
        out.push(<circle key={`${key}-d${e.step}-${pos}`} className={cls} cx={dotX} cy={dotY} r={0.2 * S} />)
      }
    }

    // Stem: from the far notehead's anchor (X heads attach at their corner).
    const far = up ? heads[heads.length - 1] : heads[0]
    const anchor = (far.cymbal ? 0.444 : 0.168) * S
    const y1 = top + (up ? far.y - anchor : far.y + anchor)
    out.push(
      <rect
        key={`${key}-s${e.step}`}
        className="drum-notation__line"
        x={stemLeft}
        y={Math.min(y1, stemEnd)}
        width={STEM_W}
        height={Math.abs(stemEnd - y1)}
      />,
    )

    // Flag on an unbeamed 8th / 16th.
    if (!g.beamed && (e.value === 'eighth' || e.value === 'sixteenth')) {
      const flag = FLAG[g.stem][e.value]
      out.push(
        <text key={`${key}-f${e.step}`} className="drum-notation__glyph" x={stemLeft} y={stemEnd + flag.dy} fontSize={FONT}>
          {flag.ch}
        </text>,
      )
    }

    // Accent: beyond the stem end / beam (above stems up, below stems down).
    if (n.accentY !== null) {
      out.push(
        <text key={`${key}-a${e.step}`} className={`drum-notation__glyph ${cls}`} x={stemX - ACCENT_W / 2} y={top + n.accentY} fontSize={FONT}>
          {up ? GLYPH.accentAbove : GLYPH.accentBelow}
        </text>,
      )
    }

    // Open hi-hat: a small "o", beyond any accent.
    if (n.openY !== null) {
      out.push(
        <circle
          key={`${key}-o${e.step}`}
          className="drum-notation__open"
          cx={stemX}
          cy={top + n.openY}
          r={OPEN_R}
          strokeWidth={OPEN_STROKE}
        />,
      )
    }
  }

  // Beams: primary across the group, secondary between 16ths (stubs when a
  // 16th stands next to a longer note).
  if (g.beamed && info.length > 1) {
    const beamY = top + lay.beamY
    const x1 = info[0].stemLeft
    const x2 = info[info.length - 1].stemLeft + STEM_W
    const y = up ? beamY : beamY - BEAM_H
    out.push(<rect key={`${key}-b`} className="drum-notation__line" x={x1} y={y} width={x2 - x1} height={BEAM_H} />)
    const y2 = up ? y + BEAM_STEP : y - BEAM_STEP
    info.forEach((n, i) => {
      if (n.e.value !== 'sixteenth') return
      const next = info[i + 1]
      if (next?.e.value === 'sixteenth') {
        out.push(
          <rect key={`${key}-b2${i}`} className="drum-notation__line" x={n.stemLeft} y={y2} width={next.stemLeft + STEM_W - n.stemLeft} height={BEAM_H} />,
        )
      } else if (info[i - 1]?.e.value !== 'sixteenth') {
        const toward = i === 0 ? info[1] : info[i - 1]
        const len = Math.min(1.1 * S, Math.abs(toward.stemLeft - n.stemLeft) / 2)
        const sx = i === 0 ? n.stemLeft : n.stemLeft + STEM_W - len
        out.push(<rect key={`${key}-b2${i}`} className="drum-notation__line" x={sx} y={y2} width={len} height={BEAM_H} />)
      }
    })
  }

  // Rests.
  for (const e of g.events) {
    if (e.voices.length > 0) continue
    const r = REST[e.value]
    // Baseline staff position: centred for one voice; pushed up (hands) or
    // down (feet) when both voices share the staff.
    const pos = !twoVoices ? (e.value === 'whole' ? 2 : 4) : up ? (e.value === 'whole' ? 0 : 2) : 8
    const cx =
      e.value === 'whole'
        ? geo.barX(g.bar) + geo.barW / 2
        : e.value === 'half'
          ? (geo.stepX(e.step) + geo.stepX(e.step + e.length - 1)) / 2
          : geo.stepX(e.step)
    const y = top + (pos * S) / 2
    out.push(
      <text key={`${key}-r${e.step}`} className="drum-notation__glyph drum-notation__rest" x={cx - r.w / 2} y={y} fontSize={FONT}>
        {r.ch}
      </text>,
    )
    if (e.dotted) {
      out.push(<circle key={`${key}-rd${e.step}`} className="drum-notation__rest" cx={cx + r.w / 2 + 0.35 * S} cy={y - S / 2} r={0.2 * S} />)
    }
  }

  // Triplet "3" over (hands) / under (feet) the group, beyond every mark —
  // centred on the beam, or over the beat when unbeamed.
  if (lay.tupletY !== null) {
    const xs =
      g.beamed && info.length > 1
        ? [info[0].stemLeft, info[info.length - 1].stemLeft + STEM_W]
        : g.events.map((e) => geo.stepX(e.step))
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    out.push(
      <text key={`${key}-t`} className="drum-notation__glyph drum-notation__tuplet" x={cx - 0.46 * S} y={top + lay.tupletY} fontSize={TUPLET_SIZE}>
        {GLYPH.tuplet3}
      </text>,
    )
  }
  return out
}

export default function DrumNotation({ pattern, currentStep }: DrumNotationProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const width = useWidth(wrapRef)
  const font = useMusicFont()
  const { groups, hasFeet } = useMemo(() => spellDrumPattern(pattern), [pattern])
  const layouts = useMemo(() => groups.map(layoutGroup), [groups])
  const geo = useGeometry(pattern, groups, layouts, width)
  const steps = stepCount(pattern)
  const ready = font === 'ready' && width > 0

  const staves: ReactElement[] = []
  for (let sys = 0; sys < geo.systems; sys++) {
    const top = geo.topY(sys * geo.perSystem)
    const right = geo.systemRight(sys)
    for (let i = 0; i < 5; i++) {
      staves.push(
        <rect key={`st-${sys}-${i}`} className="drum-notation__staff" x={0.3 * S} y={top + i * S - 0.065 * S} width={right - 0.3 * S} height={0.13 * S} />,
      )
    }
    if (!ready) continue
    staves.push(
      <text key={`clef-${sys}`} className="drum-notation__glyph" x={0.9 * S} y={top + 2 * S} fontSize={FONT}>
        {GLYPH.clef}
      </text>,
    )
    if (sys === 0) {
      staves.push(
        <text key="ts-top" className="drum-notation__glyph" x={3.1 * S} y={top + S} fontSize={FONT}>
          {GLYPH.timeSig(BEATS_PER_BAR)}
        </text>,
        <text key="ts-bottom" className="drum-notation__glyph" x={3.1 * S} y={top + 3 * S} fontSize={FONT}>
          {GLYPH.timeSig(4)}
        </text>,
      )
    }
  }

  // Barlines between bars, and a closing repeat (the pattern loops).
  const bars: ReactElement[] = []
  for (let bar = 0; bar < pattern.bars; bar++) {
    const top = geo.topY(bar)
    const x = geo.barX(bar) + geo.barW
    if (bar < pattern.bars - 1) {
      bars.push(<rect key={`bl-${bar}`} className="drum-notation__line" x={x - THIN / 2} y={top} width={THIN} height={4 * S} />)
      continue
    }
    const xe = geo.systemRight(geo.systems - 1)
    const thinX = xe - THICK - 0.4 * S - THIN
    bars.push(
      <rect key="end-thick" className="drum-notation__line" x={xe - THICK} y={top} width={THICK} height={4 * S} />,
      <rect key="end-thin" className="drum-notation__line" x={thinX} y={top} width={THIN} height={4 * S} />,
      <circle key="end-dot1" className="drum-notation__line" cx={thinX - 0.16 * S - 0.2 * S} cy={top + 1.5 * S} r={0.2 * S} />,
      <circle key="end-dot2" className="drum-notation__line" cx={thinX - 0.16 * S - 0.2 * S} cy={top + 2.5 * S} r={0.2 * S} />,
    )
  }

  const playing = currentStep >= 0 && currentStep < steps
  const playBar = Math.floor(currentStep / (BEATS_PER_BAR * pattern.subdivision))

  return (
    <div ref={wrapRef} className="drum-notation" role="img" aria-label={`Drum notation: ${pattern.name || 'current beat'}`}>
      {width > 0 ? (
        <svg
          className="drum-notation__svg"
          width={geo.width * geo.zoom}
          height={geo.height * geo.zoom}
          viewBox={`0 0 ${geo.width} ${geo.height}`}
        >
          {playing ? (
            <rect
              className="drum-notation__playhead"
              x={geo.stepX(currentStep) - geo.stepW / 2}
              y={geo.topY(playBar) - geo.above + S}
              width={geo.stepW}
              height={geo.systemH - 2 * S}
              rx={0.4 * S}
            />
          ) : null}
          {staves}
          {ready ? bars : null}
          {ready ? groups.flatMap((g, i) => renderGroup(g, layouts[i], `g${i}`, geo, hasFeet, playing ? currentStep : -1)) : null}
        </svg>
      ) : null}
      {font === 'failed' ? (
        <p className="muted drum-notation__fallback">Couldn’t load the music font — the Grid view still works.</p>
      ) : null}
    </div>
  )
}
