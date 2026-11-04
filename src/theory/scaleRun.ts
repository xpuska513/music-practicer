/**
 * Where to play a scale run on the neck: one string/fret per note, so the
 * Scale Explorer can light up the note that's sounding. The same pitch lives in
 * several places, so we pick the path a player would use — one hand position
 * (a "box"), moving across the strings with the run — by trying each starting
 * spot and running a small shortest-path over the candidates.
 *
 * Pure (no imports) so it's easy to test and to port to the iOS app.
 */

export interface FretPos {
  /** 0 = lowest string. */
  string: number
  fret: number
}

/** Frets a hand covers without shifting (index … pinky, plus a stretch). */
const BOX_SPAN = 4

/** Cost of moving from `a` to `b` while the run climbs in pitch. */
function moveCost(a: FretPos, b: FretPos): number {
  let cost = Math.abs(b.fret - a.fret)
  const ds = b.string - a.string
  if (ds < 0) cost += 4 // crossing back against the run
  if (ds > 1) cost += 3 * (ds - 1) // skipping a string
  return cost
}

/** Penalty for leaving the box that starts at `anchor` (one fret below it to
 *  BOX_SPAN - 1 above). Open strings always fit. */
function boxCost(anchor: number, fret: number): number {
  if (fret === 0) return 0
  const low = Math.max(1, anchor - 1)
  const high = Math.max(anchor, 1) + BOX_SPAN - 1
  return fret < low ? (low - fret) * 3 : fret > high ? (fret - high) * 3 : 0
}

/**
 * One position per note of an ascending run (`midis`, low → high) on a neck
 * with the given open-string MIDI notes (low → high) and `fretCount` frets.
 * Notes that don't fit on the neck get null.
 */
export function scaleRunPositions(
  midis: readonly number[],
  tuning: readonly number[],
  fretCount: number,
): (FretPos | null)[] {
  const candidates = midis.map((midi) =>
    tuning.flatMap((open, string) => {
      const fret = midi - open
      return fret >= 0 && fret <= fretCount ? [{ string, fret }] : []
    }),
  )
  const first = candidates.findIndex((c) => c.length > 0)
  if (first < 0) return midis.map(() => null)

  let best: { cost: number; path: (FretPos | null)[] } | null = null
  for (const start of candidates[first]) {
    // Prefer lower positions and starting on a low string, as a tie-break.
    const anchor = start.fret
    let layer = [{ pos: start, cost: start.fret * 0.1 + start.string * 0.2, path: [start] as FretPos[] }]
    for (let i = first + 1; i < midis.length; i++) {
      if (candidates[i].length === 0) continue
      layer = candidates[i].map((pos) => {
        let pick = layer[0]
        let pickCost = Infinity
        for (const prev of layer) {
          const c = prev.cost + moveCost(prev.pos, pos)
          if (c < pickCost) {
            pickCost = c
            pick = prev
          }
        }
        return { pos, cost: pickCost + boxCost(anchor, pos.fret), path: [...pick.path, pos] }
      })
    }
    const end = layer.reduce((a, b) => (b.cost < a.cost ? b : a))
    if (!best || end.cost < best.cost) {
      // Re-insert nulls for notes that had nowhere to go.
      let k = 0
      const path = midis.map((_, i) => (i >= first && candidates[i].length > 0 ? end.path[k++] : null))
      best = { cost: end.cost, path }
    }
  }
  return best ? best.path : midis.map(() => null)
}
