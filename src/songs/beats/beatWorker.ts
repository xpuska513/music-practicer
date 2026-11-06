/**
 * Runs Beat This! (small0) off the main thread: the log-mel front end in
 * TypeScript (logMel.ts), the beat/downbeat network as an ONNX model on a
 * vendored onnxruntime-web (WASM), then the official chunking + minimal
 * postprocessing (postprocess.ts).
 *
 * The runtime and models are static files under public/ (see their README);
 * nothing is fetched from anywhere but our own origin.
 */
import { aggregatePrediction, chunkRows, postprocessMinimal, splitPiece } from './postprocess'
import { logMelSpectrogram } from './logMel'

interface OrtTensor {
  data: Float32Array
  dims: readonly number[]
}
interface OrtSession {
  readonly inputNames: readonly string[]
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>
  release(): Promise<void>
}
interface Ort {
  env: { wasm: { wasmPaths: string; numThreads: number } }
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => OrtTensor
  InferenceSession: { create(url: string): Promise<OrtSession> }
}

export interface BeatRequest {
  /** Mono audio at 22050 Hz. */
  audio: Float32Array
  /** Absolute URL of the app's root (where vendor/ and models/ live). */
  base: string
}

export type BeatProgress = { stage: 'loading' | 'spectrogram' | 'beats'; done: number; total: number }

export type BeatMessage =
  | ({ type: 'progress' } & BeatProgress)
  | { type: 'done'; beats: number[]; downbeats: number[]; ms: number }
  | { type: 'error'; message: string }

const BINS = 128

// (Typed against the DOM lib like the rest of the app; this runs in a worker.)
const post = (msg: BeatMessage) => (self as unknown as { postMessage(m: BeatMessage): void }).postMessage(msg)

self.onmessage = async (e: MessageEvent<BeatRequest>) => {
  const t0 = performance.now()
  const { audio, base } = e.data
  let net: OrtSession | null = null
  try {
    post({ type: 'progress', stage: 'loading', done: 0, total: 1 })
    const runtime = new URL('vendor/onnxruntime-web/', base).href
    const ort = (await import(/* @vite-ignore */ `${runtime}ort.wasm.min.mjs`)) as Ort
    ort.env.wasm.wasmPaths = runtime
    // Threads need a cross-origin-isolated page; otherwise stay single-threaded.
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1
    const models = new URL('models/beat-this/', base).href
    net = await ort.InferenceSession.create(`${models}beat_this_small0.onnx`)
    const input = net.inputNames[0]

    post({ type: 'progress', stage: 'spectrogram', done: 0, total: 1 })
    const { data: spect, frames } = logMelSpectrogram(audio)

    const chunks = splitPiece(frames)
    const beatPreds: Float32Array[] = []
    const downbeatPreds: Float32Array[] = []
    for (let c = 0; c < chunks.length; c++) {
      post({ type: 'progress', stage: 'beats', done: c, total: chunks.length })
      const rows = chunkRows(spect, BINS, chunks[c])
      const out = await net.run({ [input]: new ort.Tensor('float32', rows.data, [1, rows.length, BINS]) })
      beatPreds.push(new Float32Array(out.beat.data))
      downbeatPreds.push(new Float32Array(out.downbeat.data))
    }
    const { beats, downbeats } = postprocessMinimal(
      aggregatePrediction(beatPreds, chunks, frames),
      aggregatePrediction(downbeatPreds, chunks, frames),
    )
    post({ type: 'done', beats, downbeats, ms: Math.round(performance.now() - t0) })
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  } finally {
    void net?.release()
  }
}
