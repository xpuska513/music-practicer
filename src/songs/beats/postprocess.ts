/**
 * Beat This! inference plumbing that isn't the network itself — a faithful
 * TypeScript port of the official `beat_this` package (CPJKU, MIT):
 *
 * - `splitPiece` / `aggregatePrediction` — inference.py `split_piece` and
 *   `aggregate_prediction` (1500-frame chunks, 6-frame borders, keep_first),
 * - `postprocessMinimal` — model/postprocessor.py "minimal": max-pool peak
 *   picking (±3 frames, logit > 0), `deduplicate_peaks`, and snapping each
 *   downbeat to its nearest beat.
 *
 * Pure (no DOM / runtime) so it's easy to test and to reuse on iOS.
 */

/** Frames per second of the model's input/output (hop 441 @ 22050 Hz). */
export const FPS = 50
export const CHUNK_SIZE = 1500
export const BORDER_SIZE = 6

export interface Chunk {
  /** Piece frame the chunk starts at (can be negative: zero-padded). */
  start: number
  /** Copy frames [from, to) of the piece… */
  from: number
  to: number
  /** …between this many zero frames before and after. */
  padLeft: number
  padRight: number
}

/** `split_piece(spect, chunk_size, border_size, avoid_short_end=True)`. */
export function splitPiece(frames: number, chunkSize = CHUNK_SIZE, borderSize = BORDER_SIZE): Chunk[] {
  const step = chunkSize - 2 * borderSize
  const starts: number[] = []
  for (let s = -borderSize; s < frames - borderSize; s += step) starts.push(s)
  if (starts.length > 0 && frames > step) starts[starts.length - 1] = frames - (chunkSize - borderSize)
  return starts.map((start) => ({
    start,
    from: Math.max(start, 0),
    to: Math.min(start + chunkSize, frames),
    padLeft: Math.max(0, -start),
    padRight: Math.max(0, Math.min(borderSize, start + chunkSize - frames)),
  }))
}

/** One chunk's rows of a (frames × bins) matrix, zero-padded as split_piece does. */
export function chunkRows(spect: Float32Array, bins: number, chunk: Chunk): { data: Float32Array; length: number } {
  const length = chunk.padLeft + (chunk.to - chunk.from) + chunk.padRight
  const data = new Float32Array(length * bins)
  data.set(spect.subarray(chunk.from * bins, chunk.to * bins), chunk.padLeft * bins)
  return { data, length }
}

/**
 * `aggregate_prediction(..., overlap_mode="keep_first")`: drop each chunk's
 * borders and write it into the piece, earlier chunks winning overlaps.
 */
export function aggregatePrediction(
  preds: Float32Array[],
  chunks: Chunk[],
  frames: number,
  chunkSize = CHUNK_SIZE,
  borderSize = BORDER_SIZE,
): Float32Array {
  const piece = new Float32Array(frames).fill(-1000)
  for (let c = chunks.length - 1; c >= 0; c--) {
    const pred = preds[c]
    const kept = pred.subarray(borderSize, pred.length - borderSize)
    const at = chunks[c].start + borderSize
    const end = Math.min(chunks[c].start + chunkSize - borderSize, frames)
    for (let j = 0; at + j < end && j < kept.length; j++) {
      if (at + j >= 0) piece[at + j] = kept[j]
    }
  }
  return piece
}

/** Frames that are the maximum of their ±3 neighbourhood with logit > 0. */
function pickPeaks(logits: Float32Array): number[] {
  const out: number[] = []
  for (let i = 0; i < logits.length; i++) {
    const v = logits[i]
    if (!(v > 0)) continue
    let max = -Infinity
    for (let k = Math.max(0, i - 3); k <= Math.min(logits.length - 1, i + 3); k++) {
      if (logits[k] > max) max = logits[k]
    }
    if (v === max) out.push(i)
  }
  return out
}

/** `deduplicate_peaks(peaks, width=1)` — including its running-mean update. */
export function deduplicatePeaks(peaks: number[], width = 1): number[] {
  if (peaks.length === 0) return []
  const result: number[] = []
  let p = peaks[0]
  let c = 1
  for (let i = 1; i < peaks.length; i++) {
    const p2 = peaks[i]
    if (p2 - p <= width) {
      c += 1
      p += (p2 - p) / c
    } else {
      result.push(p)
      p = p2
      c = 1
    }
  }
  result.push(p)
  return result
}

export interface BeatTimes {
  /** Seconds. */
  beats: number[]
  /** Seconds; each is one of `beats`. */
  downbeats: number[]
}

/** The "minimal" postprocessor: logits → beat / downbeat times in seconds. */
export function postprocessMinimal(beatLogits: Float32Array, downbeatLogits: Float32Array, fps = FPS): BeatTimes {
  const beats = deduplicatePeaks(pickPeaks(beatLogits)).map((f) => f / fps)
  let downbeats = deduplicatePeaks(pickPeaks(downbeatLogits)).map((f) => f / fps)
  if (beats.length > 0) {
    downbeats = downbeats.map((d) => {
      let best = beats[0]
      for (const b of beats) if (Math.abs(b - d) < Math.abs(best - d)) best = b
      return best
    })
  }
  downbeats = [...new Set(downbeats)].sort((a, b) => a - b)
  return { beats, downbeats }
}
