import type { ChordDef, ChordShape, NoteName } from '../types'
import { ROOT_OPTIONS } from './notes'

/**
 * Share custom chords with no backend: a chord (or a whole set) is encoded into
 * a compact base64url token that rides in a URL hash (`#chords=…`) or as a
 * copy-paste code. The hash fragment is never sent to any server, so this stays
 * a 100%-client-side feature. Decoding validates strictly — the token is
 * untrusted input from someone else's browser.
 */

/** A custom chord without its local id (minted fresh on import). */
export interface SharedChord {
  name: string
  root: NoteName
  quality: string
  shape: ChordShape
}

const HASH_PREFIX = 'chords='
const CURRENT_VERSION = 1
/** Guard against absurd paste input before decoding. */
const MAX_TOKEN_LEN = 200_000

// ── base64url (unicode-safe) ────────────────────────────────────────────────
function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(token: string): string {
  const b64 = token.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

// ── Validation ──────────────────────────────────────────────────────────────
function isIntInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
}

function isRoot(v: unknown): v is NoteName {
  return typeof v === 'string' && (ROOT_OPTIONS as readonly string[]).includes(v)
}

/** Parse one wire chord (compact keys) into a validated SharedChord, or null. */
function parseWireChord(raw: unknown): SharedChord | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>

  const name = typeof o.n === 'string' ? o.n : null
  if (name === null) return null
  if (!isRoot(o.r)) return null
  const quality = typeof o.q === 'string' ? o.q : ''

  if (!Array.isArray(o.f) || o.f.length !== 6) return null
  const frets: (number | null)[] = []
  for (const f of o.f) {
    if (f !== null && !isIntInRange(f, 0, 24)) return null
    frets.push(f === null ? null : (f as number))
  }
  if (!frets.some((f) => f !== null)) return null // a chord must sound something

  const shape: ChordShape = { frets }

  if (o.g !== undefined) {
    if (!Array.isArray(o.g) || o.g.length !== 6) return null
    const fingers: (number | null)[] = []
    for (const f of o.g) {
      if (f !== null && !isIntInRange(f, 1, 4)) return null
      fingers.push(f === null ? null : (f as number))
    }
    shape.fingers = fingers
  }

  if (o.b !== undefined) {
    if (!isIntInRange(o.b, 1, 24)) return null
    shape.baseFret = o.b
  }

  return { name, root: o.r, quality, shape }
}

function toWireChord(c: SharedChord): Record<string, unknown> {
  const wire: Record<string, unknown> = {
    n: c.name,
    r: c.root,
    f: c.shape.frets,
  }
  if (c.quality) wire.q = c.quality
  if (c.shape.fingers) wire.g = c.shape.fingers
  if (c.shape.baseFret !== undefined) wire.b = c.shape.baseFret
  return wire
}

/** A local ChordDef → the shareable (id-less) form. */
export function chordToShared(chord: ChordDef): SharedChord {
  return {
    name: chord.name,
    root: chord.root,
    quality: chord.quality,
    shape: chord.shape,
  }
}

// ── Encode / decode ─────────────────────────────────────────────────────────
export function encodeChords(chords: SharedChord[]): string {
  const payload = { v: CURRENT_VERSION, c: chords.map(toWireChord) }
  return toBase64Url(JSON.stringify(payload))
}

/** Pull the bare token out of a full link/hash/code paste. */
function extractToken(input: string): string {
  const s = input.trim()
  const idx = s.indexOf(HASH_PREFIX)
  const raw = idx >= 0 ? s.slice(idx + HASH_PREFIX.length) : s
  // Keep only valid base64url characters (drops trailing &foo=…, whitespace, …).
  const m = raw.match(/^[A-Za-z0-9\-_]+/)
  return m ? m[0] : ''
}

/** Decode a link/code into validated chords, or null if it isn't valid. */
export function decodeChords(input: string): SharedChord[] | null {
  try {
    const token = extractToken(input)
    if (!token || token.length > MAX_TOKEN_LEN) return null
    const obj: unknown = JSON.parse(fromBase64Url(token))
    if (typeof obj !== 'object' || obj === null) return null
    const arr = (obj as Record<string, unknown>).c
    if (!Array.isArray(arr)) return null
    const out: SharedChord[] = []
    for (const entry of arr) {
      const chord = parseWireChord(entry)
      if (chord) out.push(chord)
    }
    return out.length > 0 ? out : null
  } catch {
    return null
  }
}

// ── URL helpers ─────────────────────────────────────────────────────────────
/** Build a shareable link for a token, based on the current app URL. */
export function buildShareLink(token: string): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#${HASH_PREFIX}${token}`
}

/** Read a share token from the current URL hash, or null. */
export function readShareHash(): string | null {
  const h = window.location.hash
  if (!h.startsWith(`#${HASH_PREFIX}`)) return null
  const m = h.slice(1 + HASH_PREFIX.length).match(/^[A-Za-z0-9\-_]+/)
  return m ? m[0] : null
}

/** Remove the share token from the URL so a refresh doesn't re-prompt. */
export function clearShareHash(): void {
  try {
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    )
  } catch {
    /* history unavailable — harmless */
  }
}
