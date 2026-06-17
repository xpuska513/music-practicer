import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 100% client-side static build. `npm run build` -> dist/ can be hosted anywhere.
// `base: './'` makes the build work from any path (file://, GitHub Pages subpath, etc.)
export default defineConfig({
  base: './',
  plugins: [react()],
})
