/**
 * Beat This!'s input features in plain TypeScript — a port of beat_this's
 * `LogMelSpect`, i.e. torchaudio's MelSpectrogram with
 *   sample_rate 22050, n_fft 1024, hop 441 (50 fps), periodic Hann window,
 *   center=True (reflect padding), normalized="frame_length" (÷√1024),
 *   power 1 (magnitude), 128 Slaney-scale mel bands from 30 Hz to 11 kHz
 *   (no area normalisation), then log1p(1000 · x).
 * Output: frames × 128, row-major.
 */

export const SAMPLE_RATE = 22050
const N_FFT = 1024
const HOP = 441
const N_FREQS = N_FFT / 2 + 1
export const N_MELS = 128
const F_MIN = 30
const F_MAX = 11000

// Slaney mel scale (torchaudio `_hz_to_mel` / `_mel_to_hz`, mel_scale="slaney").
const F_SP = 200 / 3
const MIN_LOG_HZ = 1000
const MIN_LOG_MEL = MIN_LOG_HZ / F_SP
const LOGSTEP = Math.log(6.4) / 27

const hzToMel = (hz: number) => (hz >= MIN_LOG_HZ ? MIN_LOG_MEL + Math.log(hz / MIN_LOG_HZ) / LOGSTEP : hz / F_SP)
const melToHz = (mel: number) => (mel >= MIN_LOG_MEL ? MIN_LOG_HZ * Math.exp(LOGSTEP * (mel - MIN_LOG_MEL)) : F_SP * mel)

/** torchaudio `melscale_fbanks(513, 30, 11000, 128, 22050, norm=None, "slaney")`: [513 × 128]. */
export function melFilterbank(): Float32Array {
  const allFreqs = Array.from({ length: N_FREQS }, (_, i) => (i * Math.floor(SAMPLE_RATE / 2)) / (N_FREQS - 1))
  const mMin = hzToMel(F_MIN)
  const mMax = hzToMel(F_MAX)
  const fPts = Array.from({ length: N_MELS + 2 }, (_, i) => melToHz(mMin + ((mMax - mMin) * i) / (N_MELS + 1)))
  const fb = new Float32Array(N_FREQS * N_MELS)
  for (let f = 0; f < N_FREQS; f++) {
    for (let m = 0; m < N_MELS; m++) {
      const down = (fPts[m] - allFreqs[f]) * -1 / (fPts[m + 1] - fPts[m])
      const up = (fPts[m + 2] - allFreqs[f]) / (fPts[m + 2] - fPts[m + 1])
      fb[f * N_MELS + m] = Math.max(0, Math.min(down, up))
    }
  }
  return fb
}

/** In-place iterative radix-2 FFT on (re, im) of length N_FFT. */
function makeFft() {
  const n = N_FFT
  const levels = Math.log2(n)
  const rev = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    let r = 0
    for (let b = 0; b < levels; b++) r |= ((i >> b) & 1) << (levels - 1 - b)
    rev[i] = r
  }
  const cos = new Float64Array(n / 2)
  const sin = new Float64Array(n / 2)
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n)
    sin[i] = Math.sin((2 * Math.PI * i) / n)
  }
  return (re: Float64Array, im: Float64Array) => {
    for (let i = 0; i < n; i++) {
      const j = rev[i]
      if (j > i) {
        let t = re[i]
        re[i] = re[j]
        re[j] = t
        t = im[i]
        im[i] = im[j]
        im[j] = t
      }
    }
    for (let size = 2; size <= n; size *= 2) {
      const half = size / 2
      const step = n / size
      for (let start = 0; start < n; start += size) {
        for (let k = 0; k < half; k++) {
          const wr = cos[k * step]
          const wi = -sin[k * step]
          const a = start + k
          const b = a + half
          const tr = re[b] * wr - im[b] * wi
          const ti = re[b] * wi + im[b] * wr
          re[b] = re[a] - tr
          im[b] = im[a] - ti
          re[a] += tr
          im[a] += ti
        }
      }
    }
  }
}

/** Log-mel spectrogram of mono 22050 Hz audio: { data: frames×128, frames }. */
export function logMelSpectrogram(audio: Float32Array, fb = melFilterbank()): { data: Float32Array; frames: number } {
  const pad = N_FFT / 2
  const len = audio.length
  // center=True with reflect padding (the edge sample itself isn't repeated).
  const at = (i: number) => {
    let j = i - pad
    if (j < 0) j = -j
    if (j >= len) j = 2 * (len - 1) - j
    return audio[Math.min(Math.max(j, 0), len - 1)]
  }
  const frames = 1 + Math.floor(len / HOP)
  const window = new Float64Array(N_FFT)
  for (let n = 0; n < N_FFT; n++) window[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N_FFT)
  const fft = makeFft()
  const re = new Float64Array(N_FFT)
  const im = new Float64Array(N_FFT)
  const mag = new Float64Array(N_FREQS)
  const norm = 1 / Math.sqrt(N_FFT)
  const out = new Float32Array(frames * N_MELS)
  // Each band only covers a few FFT bins — skip the zeros.
  const lo = new Int32Array(N_MELS).fill(N_FREQS)
  const hi = new Int32Array(N_MELS)
  for (let k = 0; k < N_FREQS; k++) {
    for (let m = 0; m < N_MELS; m++) {
      if (fb[k * N_MELS + m] === 0) continue
      lo[m] = Math.min(lo[m], k)
      hi[m] = k + 1
    }
  }
  for (let t = 0; t < frames; t++) {
    const s0 = t * HOP
    for (let n = 0; n < N_FFT; n++) {
      re[n] = at(s0 + n) * window[n]
      im[n] = 0
    }
    fft(re, im)
    for (let k = 0; k < N_FREQS; k++) mag[k] = Math.hypot(re[k], im[k]) * norm
    for (let m = 0; m < N_MELS; m++) {
      let sum = 0
      for (let k = lo[m]; k < hi[m]; k++) sum += mag[k] * fb[k * N_MELS + m]
      out[t * N_MELS + m] = Math.log1p(1000 * sum)
    }
  }
  return { data: out, frames }
}
