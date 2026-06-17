/**
 * Persistence + validation for user-created scales.
 *
 * Pure module (no React). Stores custom ScaleDef entries in localStorage and
 * provides defensive load/save plus helpers for building/normalizing scales.
 */
import type { ScaleDef } from '../types'

/** localStorage key holding the JSON array of custom scales. */
export const CUSTOM_SCALES_KEY = 'music-practicer:custom-scales:v1'

/** Window event dispatched after custom scales change (for live refresh). */
export const CUSTOM_SCALES_EVENT = 'music-practicer:custom-scales-changed'

/** True for an integer in the pitch-class range 0..11. */
function isValidInterval(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 11
}

/** Type guard: a parsed entry is a well-formed custom ScaleDef. */
function isValidScaleEntry(value: unknown): value is ScaleDef {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || typeof v.name !== 'string') return false
  const intervals = v.intervals
  if (!Array.isArray(intervals) || intervals.length === 0) return false
  if (!intervals.every(isValidInterval)) return false
  // sorted ascending, unique, includes 0
  if (!intervals.includes(0)) return false
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i] <= intervals[i - 1]) return false
  }
  return true
}

/**
 * Read and validate custom scales from localStorage.
 * Drops invalid entries; returns [] on any error.
 */
export function loadCustomScales(): ScaleDef[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SCALES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const result: ScaleDef[] = []
    for (const entry of parsed) {
      if (isValidScaleEntry(entry)) {
        result.push({
          id: entry.id,
          name: entry.name,
          intervals: entry.intervals.slice(),
          category: 'custom',
        })
      }
    }
    return result
  } catch {
    return []
  }
}

/** Persist custom scales to localStorage (defensive). */
export function saveCustomScales(scales: ScaleDef[]): void {
  try {
    localStorage.setItem(CUSTOM_SCALES_KEY, JSON.stringify(scales))
  } catch {
    // Ignore quota / private-mode / serialization errors.
  }
}

/** Build a reasonably unique id from a scale name. */
export function makeScaleId(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `custom-scale-${slug}-${Date.now().toString(36)}`
}

/**
 * Normalize a raw interval list: keep only 0..11 integers, dedupe,
 * ensure 0 is present, and sort ascending.
 */
export function normalizeIntervals(intervals: number[]): number[] {
  const set = new Set<number>()
  set.add(0)
  for (const n of intervals) {
    if (Number.isInteger(n) && n >= 0 && n <= 11) set.add(n)
  }
  return Array.from(set).sort((a, b) => a - b)
}
