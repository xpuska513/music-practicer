import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

/** All persisted keys live under this namespace in localStorage. */
const PREFIX = 'music-practicer:'

/** Whether a usable localStorage exists (false in SSR / disabled / private mode). */
const hasStorage: boolean = (() => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage
  } catch {
    return false
  }
})()

function read<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => value is T,
): T {
  if (!hasStorage) return fallback
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    const parsed: unknown = JSON.parse(raw)
    // Reject stale/corrupt values whose shape no longer matches.
    if (validate && !validate(parsed)) return fallback
    return parsed as T
  } catch {
    return fallback
  }
}

/**
 * Drop-in `useState` that persists to `localStorage` under
 * `music-practicer:<key>`. Defensive: skips entirely when storage is
 * unavailable, falls back to `initial` on read errors, and (optionally)
 * validates the stored value so a stale/corrupt entry can't poison state.
 *
 * Only use for small, JSON-serialisable settings (primitives, plain objects).
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  validate?: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => read(key, initial, validate))

  useEffect(() => {
    if (!hasStorage) return
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      // Ignore quota / disabled-storage errors.
    }
  }, [key, value])

  return [value, setValue]
}
