# 🎸 Music Practicer

### jfyi

At current state most of the code was written using AI, so do expect bad code quality and such. I will try to redo or fix most of the things when I have some free time

---

A **client-side** guitar practice app. No server, no accounts, no backend —
everything runs in your browser. Builds to plain static files you can host
anywhere (or open from disk). The only network use is fetching the guitar
sound samples on first play (see Audio below); everything else works offline.

Six practice tools:

- **🎯 Chord Trainer** — a Rocksmith-style minigame. Chords come up driven by the
  metronome (random, or a chord **progression** — ii–V–I, 12-bar blues, 王道
  Royal Road, …), each
  shown as a fretboard diagram with the exact frets/fingers (root highlighted)
  plus the "up next" chord. Strum styles (down/up/arpeggio/per-beat), an optional
  count-in bar, and a loop-this-chord toggle. Includes a dedicated **🎌 J-Rock**
  set (~55 maj7 / m7 / add9 / sus / 6 / 9 / slash / dim voicings).
- **🎼 Scale Explorer** — every popular scale/mode, transposable to any root
  (E thru E), drawn across the neck — **6-, 7- or 8-string** (follows the header
  tuning). Toggle note names ↔ scale degrees, play the scale up and down.
- **🥁 Metronome** — accurate Web Audio metronome (lookahead scheduler), tap
  tempo, time signature, and **subdivisions** (8ths / triplets / 16ths) for a
  picking guide. Visual beat indicator.
- **🤘 Technique** — a metronome speed-trainer for techniques (tremolo, alternate
  picking, legato, palm muting, sweeps, tapping…): tips, a tiny exercise, an
  audible subdivision guide, and an auto tempo-ramp (+BPM every N bars to a goal).
- **🎚 Tuner** — microphone tuner using the McLeod Pitch Method
  ([`pitchy`](https://github.com/ianprime0509/pitchy)). Auto-detects the nearest
  string or lock to one, with a cents meter. Supports **6-, 7- and 8-string**
  (the low B / low F#). Needs mic permission and a secure page (localhost / https).
- **🛠 Editor** — build your own **custom chords** by clicking on the chart
  (anywhere on the neck, optional finger numbers) and **custom scales** by
  clicking notes against a root, with live preview + playback. Saved to
  `localStorage`, and they appear in the Trainer / Explorer next to the built-ins.

A global **tuning** selector in the header (6 / 7 / 8-string standard) drives the
Tuner and the Scale Explorer; the chord views can adopt it next.

Most settings (tempo, mode, last tab, tuning, …) persist across sessions in
`localStorage`.

### Audio

Playback uses a **real recorded acoustic steel-string** guitar (a MusyngKite
soundfont loaded via [`smplr`](https://github.com/danigb/smplr)). The samples
(~2 MB) are fetched from a public CDN the first time you play and then cached by
the browser. Until they finish loading — or if you're offline — playback falls
back automatically to a hand-rolled **Karplus-Strong** synth (zero dependencies,
fully offline), so there's never a silent first click. The metronome click is
always synthesized locally.

## Run it

This project uses **pnpm** (pinned via the `packageManager` field — run
`corepack enable pnpm` if you don't have it).

```bash
pnpm install     # see "Dependency safety" below
pnpm dev         # local dev server (Vite)
```

Then open the printed URL. To produce the static build:

```bash
pnpm build       # outputs static files to dist/
pnpm preview     # serve the built dist/ locally to check it
```

`dist/` is fully static — drop it on GitHub Pages, Netlify, an S3 bucket, or
just open `dist/index.html`. It even installs as a PWA (add to home screen) on
mobile.

## Dependency safety

This project deliberately uses **only first-party / reputable packages**:

| Package | Maintained by | Why |
| --- | --- | --- |
| `react`, `react-dom` | Meta | UI |
| `vite`, `@vitejs/plugin-react` | Vite team | dev server + static build |
| `typescript` | Microsoft | type checking |
| `@types/react`, `@types/react-dom` | DefinitelyTyped | React types |
| `smplr` | danigb (author of `tonal`) | guitar soundfont playback — **zero runtime dependencies** |
| `pitchy` | ianprime0509 | tuner pitch detection (McLeod Pitch Method); 1 tiny dep (`fft.js`) |

No obscure utility packages, no analytics, no telemetry.

- **pnpm blocks dependency build scripts by default** (the main supply-chain
  vector — malicious `postinstall` scripts). Only packages explicitly listed in
  `pnpm.onlyBuiltDependencies` in `package.json` may run install scripts. Here
  that list is exactly one entry — `esbuild` — which legitimately needs its
  script to link Vite's native bundler binary. Everything else is inert on
  install.
- A committed `pnpm-lock.yaml` pins exact versions + integrity hashes, so you
  can't silently pull a freshly-published malicious patch.
- Dependencies are pinned to current, audited versions; `pnpm audit` reports
  **no known vulnerabilities**. Run it any time to re-check.

## Project structure

```
src/
  types.ts                 shared contract: notes, frets, chords, scales, metronome
  theory/
    notes.ts               pitch-class math, note names, tuning, root options
    scales.ts              scale definitions + fretboard mark generation
    chords.ts              chord library (shapes/fingerings) + render helper
    chordsJrock.ts         J-Rock chord set (maj7/m7/add9/sus/slash/…) — own filter
    progressions.ts        preset chord progressions (ii–V–I, 12-bar blues, …)
    techniques.ts          technique definitions (tips, exercises, tempos)
    customScales.ts        load/save user scales to localStorage
    useCustomScales.ts     React hook syncing custom scales across views
    customChords.ts        load/save user chords to localStorage
    useCustomChords.ts     React hook syncing custom chords across views
    tuning.ts              tuning model + 6/7/8-string presets
    useTuning.tsx          global tuning context (persisted)
  audio/
    useMetronome.ts        Web Audio lookahead scheduler (with subdivisions)
    synth.ts               guitar playback: smplr soundfont + Karplus-Strong fallback
    pitchDetect.ts         note/string helpers for the tuner
    useTuner.ts            mic + pitch-detection hook (pitchy)
  lib/
    usePersistentState.ts  validated localStorage-backed useState
  components/
    Fretboard.tsx          SVG 6-string fretboard (interactive, H & V)
    Metronome.tsx          standalone metronome panel
  features/
    ChordTrainer.tsx       the chord minigame
    ScaleExplorer.tsx      the scale visualizer
    TechniqueTrainer.tsx   technique speed-trainer
    Tuner.tsx              microphone tuner (6/7/8-string)
    ChordEditor.tsx        build + save custom chords (anywhere on the neck)
    ScaleEditor.tsx        build + save custom scales
    Editor.tsx             wrapper hosting both editors
  App.tsx                  tab shell (Chords / Scales / Metronome / Technique / Tuner / Editor)
  index.css                design tokens + shared UI classes
```

### Conventions (see `src/types.ts`)

- **Strings** are indexed `0..5`: `0` = low E (6th/thickest), `5` = high E (1st).
- **Frets**: `0` = open, `≥1` = fretted, `null` = muted (in chord shapes).
- **Pitch classes**: `0..11`, C=0 … B=11.
