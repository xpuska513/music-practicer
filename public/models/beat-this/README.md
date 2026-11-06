# Beat This! small0 (ONNX)

The beat and downbeat tracker behind the Songs beat finder:
[Beat This!](https://github.com/CPJKU/beat_this) by Francesco Foscarin,
Jan Schlüter and Gerhard Widmer (Institute of Computational Perception, JKU
Linz; ISMIR 2024). It's the `small0` checkpoint, exported to ONNX (fp32) by
[jenila-ai/beat-this-small0-onnx](https://huggingface.co/jenila-ai/beat-this-small0-onnx).
It runs in the browser on the vendored onnxruntime-web (`../../vendor/onnxruntime-web/`),
and the audio never leaves the device.

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `beat_this_small0.onnx` | 10,401,066 | `1dbbac9e2410debf083d4002f2c2b12b61a42b3cde9b0f6fb27cc9e1b61e7517` |

The checksum matches the one the repository publishes. Input: a log-mel
spectrogram `[1, frames, 128]`, computed by `src/songs/beats/logMel.ts`.
Outputs: `beat` and `downbeat` logits, `[1, frames]`, at 50 frames per second.
`src/songs/beats/postprocess.ts` ports the official chunking and the "minimal"
peak picking.

Checked here against known beat maps: a synthetic song with a tempo change and
a 2/4 bar, and an alphaTab render of a Guitar Pro file at 174 BPM. Both score
about 98% beat F-measure, within roughly 10–15 ms. (Another upload of small0,
`ashudesai/songbird-models`, gives flat, unusable output; that's why this
conversion is used.)

`LICENSE`: the upstream MIT license (Institute of Computational Perception,
JKU Linz), which covers the code and the published weights.
