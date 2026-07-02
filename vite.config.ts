import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { alphaTab } from '@coderline/alphatab-vite'

// 100% client-side static build. `npm run build` -> dist/ can be hosted anywhere.
// `base: './'` makes the build work from any path (file://, GitHub Pages subpath, etc.)
//
// The alphaTab plugin wires up alphaTab's Web Workers / Audio Worklets for Vite.
// We DON'T let it copy the font/soundfont into publicDir (assetOutputDir: false);
// instead the Songs viewer imports Bravura + the soundfont through Vite's own
// `?url` asset pipeline, so those URLs stay correct under `base: './'`.
export default defineConfig({
  base: './',
  plugins: [react(), alphaTab({ assetOutputDir: false })],
  // alphaTab's worker/worklet rely on `import.meta.url` to locate resources,
  // which is only valid in ES-module workers (the default `iife` collapses it
  // to `{}`). Emit module workers so those references survive.
  worker: { format: 'es' },
})
