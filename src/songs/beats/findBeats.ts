/**
 * Find the beats and downbeats in an audio file, on the device: decode +
 * resample to 22050 Hz mono (as Beat This! expects), then run the model in a
 * worker so the UI stays responsive.
 */
import type { BeatMessage, BeatProgress, BeatRequest } from './beatWorker'
import type { BeatTimes } from './postprocess'

export type { BeatProgress, BeatTimes }

/** A progress report as 0..1 overall (the network's windows dominate). */
export function progressFraction(p: BeatProgress): number {
  if (p.stage === 'loading') return 0.02
  if (p.stage === 'spectrogram') return 0.08
  return 0.1 + (0.9 * p.done) / Math.max(1, p.total)
}

const SAMPLE_RATE = 22050

/**
 * Decode any browser-supported audio file to mono at 22050 Hz. Decoding with
 * an OfflineAudioContext resamples to its rate (and starts no audio output);
 * channels are averaged, as beat_this's loader does.
 */
export async function decodeForBeats(file: ArrayBuffer): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, 1, SAMPLE_RATE)
  const buffer = await ctx.decodeAudioData(file.slice(0))
  const mono = new Float32Array(buffer.length)
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < data.length; i++) mono[i] += data[i] / buffer.numberOfChannels
  }
  return mono
}

/** Run Beat This! on decoded mono 22050 Hz audio (`signal` stops it). */
export function findBeats(
  audio: Float32Array,
  onProgress?: (progress: BeatProgress) => void,
  signal?: AbortSignal,
): Promise<BeatTimes & { ms: number }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Stopped', 'AbortError'))
      return
    }
    const worker = new Worker(new URL('./beatWorker.ts', import.meta.url), { type: 'module' })
    signal?.addEventListener('abort', () => {
      worker.terminate()
      reject(new DOMException('Stopped', 'AbortError'))
    })
    worker.onmessage = (e: MessageEvent<BeatMessage>) => {
      const msg = e.data
      if (msg.type === 'progress') {
        onProgress?.(msg)
        return
      }
      worker.terminate()
      if (msg.type === 'done') resolve({ beats: msg.beats, downbeats: msg.downbeats, ms: msg.ms })
      else reject(new Error(msg.message))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'The beat finder crashed.'))
    }
    const base = new URL(import.meta.env.BASE_URL, document.baseURI).href
    const request: BeatRequest = { audio, base }
    worker.postMessage(request, [audio.buffer])
  })
}
