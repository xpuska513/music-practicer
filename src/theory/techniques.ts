/**
 * Curated guitar techniques for the metronome-driven technique trainer.
 *
 * Each technique carries a short description, practice tips, a tiny exercise
 * (shown monospaced), a default + allowed subdivisions (the picking-guide rate),
 * a suggested start/goal tempo for the speed trainer, an optional animated
 * {@link TechniqueMotion} diagram, and a search query for an optional
 * "watch a real demo" link.
 */

/** A single plucking/fretting event in a {@link TechniqueMotion} loop. */
export type MotionAction =
  | 'down' // pick downstroke
  | 'up' // pick upstroke
  | 'i' // pluck with index finger
  | 'm' // pluck with middle finger
  | 'hammer' // hammer-on
  | 'pull' // pull-off
  | 'slap' // thumb slap (bass)
  | 'pop' // finger pop (bass)
  | 'mute' // dead / ghost note
  | 'bend' // bend up to pitch
  | 'tap' // picking-hand tap

export interface MotionStep {
  /** Row index into {@link TechniqueMotion.strings} (0 = top row). */
  string: number
  /** Fret number (0 = open). */
  fret: number
  /** What happens on this step (drives the glyph + animation). */
  action: MotionAction
}

/**
 * A compact, data-driven animation spec. The {@link MotionStep} list is one
 * full loop; the diagram advances `stepsPerBeat` steps per beat, so the whole
 * thing stays locked to the trainer's current BPM.
 */
export interface TechniqueMotion {
  /** String labels shown top→bottom (e.g. ['G'] or ['G','D','A','E']). */
  strings: string[]
  /** Highest fret drawn (window 0..frets); use 0 for an open-string drill. */
  frets: number
  /** One loop of motion, advanced left→right then repeated. */
  steps: MotionStep[]
  /** Steps per beat — paces the loop against the trainer BPM. */
  stepsPerBeat: number
  /** One-line caption under the diagram. */
  caption: string
  /** Draw a "P.M." palm-mute bracket at the bridge. */
  palmMute?: boolean
}

export interface Technique {
  id: string
  name: string
  icon: string
  summary: string
  tips: string[]
  /** Short, monospaced exercise/pattern. */
  exercise: string
  /** Default subdivision (ticks per beat) for this technique. */
  defaultSubdivision: number
  /** Subdivisions the user can pick for this technique. */
  subdivisions: number[]
  /** Suggested speed-trainer range. */
  startBpm: number
  goalBpm: number
  /** Animated motion diagram (paced to the trainer BPM). */
  motion?: TechniqueMotion
  /** YouTube search query for the optional "watch a real demo" link. */
  demoQuery?: string
}

export const TECHNIQUES: Technique[] = [
  {
    id: 'tremolo',
    name: 'Tremolo picking',
    icon: '🌀',
    summary: 'Rapid, even repeated picking of a single note.',
    tips: [
      'Pick from a relaxed wrist, not the elbow — keep the motion small.',
      'Evenness beats raw speed: every note the same volume and spacing.',
      'Anchor lightly; let the pick barely clear the string.',
    ],
    exercise: 'One note (e.g. G string, 8th fret):\nG|-8-8-8-8-8-8-8-8-|\n   ↓ ↑ ↓ ↑ ↓ ↑ ↓ ↑',
    defaultSubdivision: 4,
    subdivisions: [2, 3, 4, 6],
    startBpm: 60,
    goalBpm: 180,
    motion: {
      strings: ['G'],
      frets: 4,
      steps: [
        { string: 0, fret: 2, action: 'down' },
        { string: 0, fret: 2, action: 'up' },
      ],
      stepsPerBeat: 4,
      caption: 'Rapid, even down–up on one note.',
    },
    demoQuery: 'tremolo picking guitar technique lesson',
  },
  {
    id: 'alternate',
    name: 'Alternate picking',
    icon: '✋',
    summary: 'Strict down-up-down-up picking on a single string.',
    tips: [
      'Never two downstrokes in a row — keep it strictly alternating.',
      'Start slow enough that it stays clean, then ramp.',
      'Keep the pick angle consistent on both strokes.',
    ],
    exercise: 'Chromatic on the A string:\nA|-5-6-7-8-|\n   ↓ ↑ ↓ ↑',
    defaultSubdivision: 4,
    subdivisions: [2, 4, 6],
    startBpm: 60,
    goalBpm: 160,
    motion: {
      strings: ['A'],
      frets: 5,
      steps: [
        { string: 0, fret: 2, action: 'down' },
        { string: 0, fret: 3, action: 'up' },
        { string: 0, fret: 4, action: 'down' },
        { string: 0, fret: 5, action: 'up' },
      ],
      stepsPerBeat: 4,
      caption: 'Strict down–up, one note per stroke.',
    },
    demoQuery: 'alternate picking guitar lesson beginner',
  },
  {
    id: 'spider',
    name: 'Spider (1-2-3-4)',
    icon: '🕷️',
    summary: 'Finger-independence and synchronisation drill.',
    tips: [
      'One finger per fret; keep fingers close to the strings.',
      'Sync the fretting and picking hand exactly to each tick.',
      'Move across all six strings, then back down.',
    ],
    exercise: 'Per string, ascending:\nE|-1-2-3-4-|  then A, D, G, B, e',
    defaultSubdivision: 4,
    subdivisions: [2, 4],
    startBpm: 50,
    goalBpm: 140,
    motion: {
      strings: ['E'],
      frets: 4,
      steps: [
        { string: 0, fret: 1, action: 'down' },
        { string: 0, fret: 2, action: 'up' },
        { string: 0, fret: 3, action: 'down' },
        { string: 0, fret: 4, action: 'up' },
      ],
      stepsPerBeat: 4,
      caption: 'Fingers 1-2-3-4, one per fret, alternate picking.',
    },
    demoQuery: 'spider walk 1234 finger exercise guitar',
  },
  {
    id: 'legato',
    name: 'Legato (hammer/pull)',
    icon: '🔗',
    summary: 'Hammer-ons and pull-offs — pick once, let the fingers do the rest.',
    tips: [
      'Pick only the first note of each group; hammer/pull the rest.',
      'Hammer with force from the knuckle; pull slightly sideways.',
      'Aim for even volume between picked and slurred notes.',
    ],
    exercise: 'G string:\nG|-5h7h9p7p5-|\n(h = hammer-on, p = pull-off)',
    defaultSubdivision: 3,
    subdivisions: [2, 3, 4],
    startBpm: 60,
    goalBpm: 150,
    motion: {
      strings: ['G'],
      frets: 5,
      steps: [
        { string: 0, fret: 2, action: 'down' },
        { string: 0, fret: 4, action: 'hammer' },
        { string: 0, fret: 2, action: 'pull' },
      ],
      stepsPerBeat: 3,
      caption: 'Pick once, then hammer-on and pull-off.',
    },
    demoQuery: 'legato hammer on pull off guitar lesson',
  },
  {
    id: 'palm-mute',
    name: 'Palm muting',
    icon: '✊',
    summary: 'Muted, percussive downstrokes — tight rhythm chugs.',
    tips: [
      'Rest the edge of your palm right at the bridge saddles.',
      'Too far forward kills the note; find the “chug” sweet spot.',
      'Keep downstrokes even and locked to the click.',
    ],
    exercise: 'Low E chugs (P.M.):\nE|-0-0-0-0-|\n   ↓ ↓ ↓ ↓',
    defaultSubdivision: 2,
    subdivisions: [1, 2, 4],
    startBpm: 80,
    goalBpm: 200,
    motion: {
      strings: ['E'],
      frets: 0,
      steps: [
        { string: 0, fret: 0, action: 'down' },
        { string: 0, fret: 0, action: 'down' },
      ],
      stepsPerBeat: 2,
      caption: 'Muted “chug” downstrokes at the bridge.',
      palmMute: true,
    },
    demoQuery: 'palm muting guitar technique lesson',
  },
  {
    id: 'string-skip',
    name: 'String skipping',
    icon: '⤴️',
    summary: 'Accuracy jumping over a string between notes.',
    tips: [
      'Skip cleanly — mute the skipped string so it stays silent.',
      'Lead with the picking hand; visualise the target string.',
      'Slow and accurate first; speed is a by-product of accuracy.',
    ],
    exercise: 'Skip A string:\nE|-5-------5-|\nD|----7-7----|',
    defaultSubdivision: 2,
    subdivisions: [2, 4],
    startBpm: 60,
    goalBpm: 140,
    motion: {
      strings: ['D', 'A', 'E'],
      frets: 6,
      steps: [
        { string: 2, fret: 3, action: 'down' },
        { string: 0, fret: 5, action: 'up' },
      ],
      stepsPerBeat: 2,
      caption: 'Jump over the middle (muted) string cleanly.',
    },
    demoQuery: 'string skipping guitar exercise lesson',
  },
  {
    id: 'bends',
    name: 'Bends & release',
    icon: '↗️',
    summary: 'Bend up to pitch in time, then release in time.',
    tips: [
      'Use multiple fingers to push; support from the wrist.',
      'Check the target pitch against the un-bent note — bend in tune.',
      'Bend on a tick, release on a tick: keep it rhythmic.',
    ],
    exercise: 'G string, whole-step bend:\nG|-7b(9)r7-|\n(b = bend, r = release)',
    defaultSubdivision: 1,
    subdivisions: [1, 2],
    startBpm: 50,
    goalBpm: 100,
    motion: {
      strings: ['G'],
      frets: 5,
      steps: [{ string: 0, fret: 4, action: 'bend' }],
      stepsPerBeat: 1,
      caption: 'Bend up to pitch, then release — in time.',
    },
    demoQuery: 'string bending guitar technique in tune lesson',
  },
  {
    id: 'sweep',
    name: 'Sweep picking',
    icon: '🧹',
    summary: 'One fluid pick-stroke across several strings.',
    tips: [
      'One continuous motion per direction — not separate picks.',
      'Mute each note as you leave it so they don’t ring together.',
      'Sync the rolling fretting hand with the sweep.',
    ],
    exercise: 'Small A-minor shape:\nG|-----5-----|\nB|---5---5---|\ne|-8-------8-|',
    defaultSubdivision: 3,
    subdivisions: [3, 4, 6],
    startBpm: 60,
    goalBpm: 150,
    motion: {
      strings: ['e', 'B', 'G'],
      frets: 8,
      steps: [
        { string: 2, fret: 5, action: 'down' },
        { string: 1, fret: 5, action: 'down' },
        { string: 0, fret: 8, action: 'down' },
        { string: 0, fret: 8, action: 'up' },
        { string: 1, fret: 5, action: 'up' },
        { string: 2, fret: 5, action: 'up' },
      ],
      stepsPerBeat: 3,
      caption: 'One fluid stroke up the strings, then back down.',
    },
    demoQuery: 'sweep picking guitar lesson beginner',
  },
  {
    id: 'tapping',
    name: 'Two-hand tapping',
    icon: '🖐️',
    summary: 'Tap with the picking hand, combine with hammers and pull-offs.',
    tips: [
      'Tap firmly with the tip of a finger, then pull off sideways.',
      'Keep the fretting-hand notes fretted and ready.',
      'Mute idle strings — tapping is noisy if you don’t.',
    ],
    exercise: 'E minor (e string):\ne|-12t-5p-8h-|\n(t = tap, h = hammer, p = pull)',
    defaultSubdivision: 4,
    subdivisions: [3, 4, 6],
    startBpm: 70,
    goalBpm: 160,
    motion: {
      strings: ['e'],
      frets: 12,
      steps: [
        { string: 0, fret: 12, action: 'tap' },
        { string: 0, fret: 5, action: 'pull' },
        { string: 0, fret: 8, action: 'hammer' },
      ],
      stepsPerBeat: 3,
      caption: 'Tap with the picking hand, then pull-off and hammer-on.',
    },
    demoQuery: 'two hand tapping guitar lesson beginner',
  },
]
