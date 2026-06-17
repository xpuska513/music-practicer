/**
 * Curated guitar techniques for the metronome-driven technique trainer.
 *
 * Each technique carries a short description, practice tips, a tiny exercise
 * (shown monospaced), a default + allowed subdivisions (the picking-guide rate),
 * and a suggested start/goal tempo for the speed trainer.
 */
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
  },
]
