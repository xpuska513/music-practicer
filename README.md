# 🎸 Music Practicer

### jfyi

At current state most of the code was written using AI, so do expect bad code quality and such. I will try to redo or fix most of the things when I have some free time

---

A **client-side** guitar, bass + drums practice app. No server, no accounts, no
backend — everything runs in your browser. Builds to plain static files you can
host anywhere (or open from disk). The only network use is fetching the guitar
sound samples on first play (see Audio below); everything else works offline.

A 🎸 **Guitar** / 𝄢 **Bass** / 🥁 **Drums** switch in the header swaps between
the three toolsets (it remembers your section + last tab; the Metronome is
shared).

### 🎸 Guitar tools

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
  Each technique shows an **animated motion diagram** that demonstrates the
  stroke (↓↑, hammer/pull, …) in time with your current tempo, plus a "watch a
  real demo" link.
- **🎚 Tuner** — microphone tuner using the McLeod Pitch Method
  ([`pitchy`](https://github.com/ianprime0509/pitchy)). Auto-detects the nearest
  string or lock to one, with a cents meter. Supports **6-, 7- and 8-string**
  (the low B / low F#). Needs mic permission and a secure page (localhost / https).
- **🛠 Editor** — build your own **custom chords** by clicking on the chart
  (anywhere on the neck, optional finger numbers) and **custom scales** by
  clicking notes against a root, with live preview + playback. Saved to
  `localStorage`, and they appear in the Trainer / Explorer next to the built-ins.

### 𝄢 Bass tools

A 4-string **bass** section (E A D G, an octave below a guitar's bottom four
strings) with its own neck and tuning — independent of the guitar header tuning.

- **🎼 Scale Explorer** — the same scale/mode browser drawn on a 4-string bass
  neck (transposable root, note names ↔ degrees, play up/down).
- **🤘 Technique** — the speed-trainer with a **bass-specific** set: fingerstyle
  (two-finger), slap & pop, ghost notes & muting, octaves, walking basslines,
  hammer-ons/pull-offs, and a fretting-hand 1-2-3-4 drill — each with tips, a
  tiny exercise, a subdivision guide, an animated motion diagram (slap/pop,
  ghost notes, walking, …), a demo link, and the auto tempo-ramp.
- **🎚 Tuner** — the McLeod-Pitch-Method mic tuner fixed to the 4-string bass
  (auto-detect or lock a string, cents meter), reaching down to the low E.
- **⏱ Metronome** — the same shared metronome.

### 🥁 Drums tools

- **🥁 Beat Editor** — sketch a beat on a touch **grid** (kick / snare / hi-hat /
  toms / cymbals × steps), or flip to a read-only **notation** view of the same
  pattern; a playhead sweeps across on playback. Subdivision (8ths / triplets /
  16ths), 1–2 bars, tempo, a synthesized kit (instant + offline), starter
  grooves, and save/load to `localStorage`.
- **⏱ Metronome** — the same shared metronome.

A global **tuning** selector in the header (6 / 7 / 8-string standard) drives
every fretboard view — Tuner, Scale Explorer, Chord Trainer, and both editors.
6-string chords show on a 7/8 neck with the extra low strings muted, and there's
a set of native 7/8 voicings (power chords on the low B / F#) that appear only on
those tunings.

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
    chordsExtended.ts      native 7/8-string voicings (low B / F# power chords)
    progressions.ts        preset chord progressions (ii–V–I, 12-bar blues, …)
    techniques.ts          guitar technique defs (tips, exercises, motion specs)
    bassTechniques.ts      bass technique set (fingerstyle, slap/pop, walking, …)
    customScales.ts        load/save user scales to localStorage
    useCustomScales.ts     React hook syncing custom scales across views
    customChords.ts        load/save user chords to localStorage
    useCustomChords.ts     React hook syncing custom chords across views
    tuning.ts              tuning model + 6/7/8-string + 4-string bass presets
    useTuning.tsx          global tuning context (persisted)
    drums.ts               drum voices + pattern model + preset grooves
    useDrumPatterns.ts     localStorage store for user drum patterns
  audio/
    useMetronome.ts        Web Audio lookahead scheduler (with subdivisions)
    synth.ts               guitar playback: smplr soundfont + Karplus-Strong fallback
    pitchDetect.ts         note/string helpers for the tuner
    useTuner.ts            mic + pitch-detection hook (pitchy)
    drumKit.ts             synthesized drum voices (Web Audio)
    useDrumSequencer.ts    step-sequencer playback hook (+ playhead)
  lib/
    usePersistentState.ts  validated localStorage-backed useState
  components/
    Fretboard.tsx          SVG fretboard, any string count (interactive, H & V)
    Metronome.tsx          standalone metronome panel
    DrumGrid.tsx           editable step grid (voices × steps)
    DrumNotation.tsx       read-only drum-notation view (SVG)
    TechniqueMotion.tsx    animated, BPM-synced technique motion diagram (SVG)
  features/
    ChordTrainer.tsx       the chord minigame
    ScaleExplorer.tsx      the scale visualizer (guitar or bass neck)
    TechniqueTrainer.tsx   technique speed-trainer (guitar or bass set)
    Tuner.tsx              microphone tuner (6/7/8-string guitar or 4-string bass)
    ChordEditor.tsx        build + save custom chords (anywhere on the neck)
    ScaleEditor.tsx        build + save custom scales
    Editor.tsx             wrapper hosting both editors
    DrumEditor.tsx         beat editor (grid ⇄ notation) + playback + save
  App.tsx                  🎸/𝄢/🥁 section switch + per-section tab shell
  index.css                design tokens + shared UI classes
```

### Conventions (see `src/types.ts`)

- **Strings** are indexed `0..5`: `0` = low E (6th/thickest), `5` = high E (1st).
- **Frets**: `0` = open, `≥1` = fretted, `null` = muted (in chord shapes).
- **Pitch classes**: `0..11`, C=0 … B=11.
