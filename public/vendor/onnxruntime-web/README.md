# onnxruntime-web 1.31.1 (vendored)

The WebAssembly build of Microsoft's [ONNX Runtime Web](https://github.com/microsoft/onnxruntime),
which runs the Beat This! model in the Songs beat finder. It's vendored as
static files instead of installed from npm (no install scripts, no dependency
tree). The app loads it only when the beat finder runs, from its own origin.

Source: the official npm tarball
`https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-1.31.1.tgz`.
Its sha512 integrity matched the registry's
(`sha512-5GeH+bWQ+HxM10z7erGlsWqryrwMbSvm/1tkIsKTT48g0fI19VXVVC435t4t7VsPdSQeS7NmuZPXrQ73k82URw==`).
These three files are copied unchanged from its `dist/`:

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `ort.wasm.min.mjs` | 53,725 | `c21d9c326d453a4a61398270c804d5979e118540597cb0c07f7b3d64e6098234` |
| `ort-wasm-simd-threaded.mjs` | 24,738 | `30ed0b5cd1182ede931fea448afb567d4dc705ec957af09f108a2be5f770dac3` |
| `ort-wasm-simd-threaded.wasm` | 14,848,852 | `4b884c203b0fa48d057be3332c65513ff85aa3c5bddd6946acc0fab7ecda001d` |

`LICENSE`: ONNX Runtime's MIT license (Microsoft Corporation), from the
[onnxruntime repository](https://github.com/microsoft/onnxruntime/blob/main/LICENSE).
The npm package declares `"license": "MIT"` but ships no license file.

To update, download the new tarball, check its integrity against
`npm view onnxruntime-web@<version> dist.integrity`, and copy the same three
files from `package/dist/`.
