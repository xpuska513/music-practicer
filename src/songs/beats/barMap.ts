/**
 * Line the tab's bars up with the beats Beat This! found in a recording.
 *
 * Bars are walked in playback order (repeats unrolled) out from an anchor —
 * "bar N starts here": the first detected downbeat, unless the player has
 * tapped bars themselves. Each next bar start is predicted from the score's
 * own bar length and the recording's running tempo, then moved onto a
 * detected beat near that guess — the one whose next two bars of beats best
 * match the detections, so a stray off-beat or a missed beat can't shift
 * every later bar. The running tempo follows a recording that drifts from
 * the score.
 */

export interface PlayedBar {
  /** 1-based bar number. */
  bar: number
  /** 0 the first time the bar plays, 1 on its first repeat, … */
  occurrence: number
  /** Length at the score's tempo, in ms. */
  ms: number
  /** Beats to click in it (its time signature's count). */
  beats: number
}

/** "Bar `bar` starts `ms` into the recording" (a player's sync point). */
export interface Anchor {
  bar: number
  ms: number
}

/** Snap a guess to a detected beat within this fraction of a beat. */
const SNAP = 0.45
/** Weight of each newly measured bar in the running tempo. */
const FOLLOW = 0.5

/** Index of the value in `sorted` closest to `t` (-1 if empty). */
export function nearestIndex(sorted: readonly number[], t: number): number {
  if (sorted.length === 0) return -1
  let lo = 0
  let hi = sorted.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] < t) lo = mid + 1
    else hi = mid
  }
  return lo > 0 && t - sorted[lo - 1] <= sorted[lo] - t ? lo - 1 : lo
}

function median(values: number[]): number {
  if (values.length === 0) return NaN
  const s = [...values].sort((a, b) => a - b)
  return s[s.length >> 1]
}

/** The beat length around `t`: the median of the nearby beat intervals. */
function beatLength(beats: readonly number[], t: number): number {
  const i = nearestIndex(beats, t)
  const gaps: number[] = []
  for (let j = Math.max(1, i - 2); j <= Math.min(beats.length - 1, i + 3); j++) gaps.push(beats[j] - beats[j - 1])
  return median(gaps) || 500
}

/** The detected beat within half a beat of `t`, if there is one. */
export function snapToBeat(beats: readonly number[], t: number): number | null {
  const i = nearestIndex(beats, t)
  if (i < 0) return null
  return Math.abs(beats[i] - t) <= SNAP * beatLength(beats, t) ? beats[i] : null
}

/** How many of `count` grid beats `gap` apart from `start` have a detection on them. */
function support(beats: readonly number[], start: number, gap: number, count: number): number {
  let hits = 0
  for (let j = 0; j < count; j++) {
    const g = start + j * gap
    const i = nearestIndex(beats, g)
    if (i >= 0 && Math.abs(beats[i] - g) <= gap / 5) hits++
  }
  return hits
}

/**
 * The bar start to use near `guess`: the guess itself or a detected beat
 * within half a beat of it, whichever starts the best-supported grid of
 * `count` beats `gap` apart (ties go to a detected beat, then the closest).
 */
function bestStart(beats: readonly number[], guess: number, gap: number, count: number): number | null {
  const reach = SNAP * beatLength(beats, guess)
  let best: number | null = null
  let bestScore = support(beats, guess, gap, count)
  let i = nearestIndex(beats, guess - reach)
  if (i >= 0 && beats[i] < guess - reach) i++
  for (; i >= 0 && i < beats.length && beats[i] <= guess + reach; i++) {
    const score = support(beats, beats[i], gap, count)
    const closer = best === null || Math.abs(beats[i] - guess) < Math.abs(best - guess)
    if (score > bestScore || (score === bestScore && (best !== null || score > 0) && closer)) {
      best = beats[i]
      bestScore = score
    }
  }
  return best
}

/**
 * Start time (ms into the recording) of every played bar; NaN where the
 * recording has nothing to line it up with (before its start, after its end).
 */
export function lineUpBars(
  played: readonly PlayedBar[],
  beats: readonly number[],
  downbeats: readonly number[],
  anchors: readonly Anchor[],
): Float64Array {
  const n = played.length
  const times = new Float64Array(n).fill(NaN)
  if (n === 0 || beats.length < 2) return times
  const lastBeat = beats[beats.length - 1]

  // The recording's tempo against the score's (recording ms per score ms),
  // from typical bar lengths. Scores are notated near the real tempo, so a
  // factor of two either way is a half/double-time reading — fold it back.
  let ratio = 1
  if (downbeats.length >= 4) {
    const gaps = downbeats.slice(1).map((d, i) => d - downbeats[i])
    ratio = median(gaps) / median(played.map((p) => p.ms))
    while (ratio > Math.SQRT2) ratio /= 2
    while (ratio < Math.SQRT1_2) ratio *= 2
    if (!Number.isFinite(ratio)) ratio = 1
  }

  /** Where bar `k` starts, given where its neighbour starts (dir ±1). */
  const step = (k: number, from: number, dir: 1 | -1, r: number) => {
    const bar = played[dir === 1 ? k - 1 : k]
    const length = bar.ms * r
    const guess = from + dir * length
    // Judge each candidate by the next two bars' beats from it.
    const gap = length / Math.max(1, bar.beats)
    const beat = bestStart(beats, guess, gap, 2 * Math.max(1, played[k].beats))
    // Never snap back onto (or past) the bar we came from.
    const ok = beat !== null && (beat - from) * dir > length / 2
    return { t: ok ? beat : guess, measured: ok ? Math.abs(beat - from) / bar.ms : 0 }
  }

  /** Fill bars k+1 … end-1 from bar k at `from`. */
  const walkForward = (k: number, from: number, end: number, r: number) => {
    let t = from
    for (let j = k + 1; j < end; j++) {
      const next = step(j, t, 1, r)
      // Past the music: leave the rest to the score's own tempo.
      if (next.t > lastBeat + played[j - 1].ms * r) break
      if (next.measured) r += FOLLOW * (next.measured - r)
      t = next.t
      times[j] = t
    }
  }

  // Resolve the anchors (in time order) to played bars. A repeated bar plays
  // more than once — take the pass that the bars lined up so far put
  // closest to the anchor.
  const resolved: { k: number; t: number }[] = []
  const sorted = [...anchors].sort((a, b) => a.ms - b.ms)
  if (sorted.length === 0) {
    const first = downbeats[0] ?? beats[0]
    resolved.push({ k: 0, t: first })
    times[0] = first
    walkForward(0, first, n, ratio)
  }
  // Provisional times for picking a repeat: a straight line at the score's
  // tempo from the first bar, until real walks replace them.
  const provisional = (k: number) => {
    if (Number.isFinite(times[k])) return times[k]
    let ms = 0
    for (let j = 0; j < k; j++) ms += played[j].ms
    return (downbeats[0] ?? beats[0]) + ms * ratio
  }
  for (const a of sorted) {
    const after = resolved.length ? resolved[resolved.length - 1] : null
    const t = snapToBeat(beats, a.ms) ?? a.ms
    if (after && t <= after.t) continue
    let best = -1
    for (let k = after ? after.k + 1 : 0; k < n; k++) {
      if (played[k].bar !== a.bar) continue
      if (best < 0 || Math.abs(provisional(k) - t) < Math.abs(provisional(best) - t)) best = k
    }
    if (best < 0) continue
    resolved.push({ k: best, t })
    times[best] = t
    walkForward(best, t, n, ratio)
  }
  if (resolved.length === 0) return times

  // The final map: back from the first anchor, then anchor to anchor.
  times.fill(NaN)
  for (const { k, t } of resolved) times[k] = t
  let r = ratio
  let t = resolved[0].t
  for (let k = resolved[0].k - 1; k >= 0; k--) {
    const prev = step(k, t, -1, r)
    if (prev.t < 0) break
    if (prev.measured) r += FOLLOW * (prev.measured - r)
    t = prev.t
    times[k] = t
  }
  resolved.forEach((a, i) => {
    const next = resolved[i + 1]
    // Between two anchors, start at their average tempo.
    let r = ratio
    if (next) {
      let ms = 0
      for (let j = a.k; j < next.k; j++) ms += played[j].ms
      r = (next.t - a.t) / ms
    }
    walkForward(a.k, a.t, next ? next.k : n, r)
  })
  return times
}

/** A click: when (ms into the recording), and whether it's a bar's first beat. */
export interface Click {
  ms: number
  accent: boolean
}

/**
 * The click for lined-up bars: each bar's beats spread evenly over it, each
 * moved onto a detected beat within a quarter beat — so the click keeps the
 * recording's feel, but a stray detection (an off-beat, a double-time patch)
 * can't drag it off the bar's grid.
 */
export function clickTimes(played: readonly PlayedBar[], times: Float64Array, beats: readonly number[]): Click[] {
  const out: Click[] = []
  for (let k = 0; k < played.length; k++) {
    const start = times[k]
    if (!Number.isFinite(start)) continue
    let end = times[k + 1]
    if (!Number.isFinite(end)) {
      // The last lined-up bar: at the previous bar's tempo.
      const prev = k > 0 ? times[k - 1] : NaN
      const ratio = Number.isFinite(prev) ? (start - prev) / played[k - 1].ms : 1
      end = start + played[k].ms * ratio
    }
    const n = Math.max(1, played[k].beats)
    const step = (end - start) / n
    out.push({ ms: start, accent: true })
    for (let j = 1; j < n; j++) {
      const guess = start + j * step
      const i = nearestIndex(beats, guess)
      out.push({ ms: i >= 0 && Math.abs(beats[i] - guess) <= step / 4 ? beats[i] : guess, accent: false })
    }
  }
  return out
}
