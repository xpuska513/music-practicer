import { useCallback, useEffect, useState } from 'react'

/**
 * IndexedDB-backed library of imported Guitar Pro files.
 *
 * Guitar Pro files can be several MB — too big for localStorage — so the raw
 * bytes live in IndexedDB. Metadata (name/size/date) is kept in a separate
 * object store so listing the library never has to deserialize every file's
 * bytes; the bytes are read on demand only when a song is opened.
 */

const DB_NAME = 'music-practicer'
const DB_VERSION = 1
const META_STORE = 'song_meta'
const DATA_STORE = 'song_data'

export interface SongMeta {
  id: string
  name: string
  /** File size in bytes. */
  size: number
  addedAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(DATA_STORE)) {
          db.createObjectStore(DATA_STORE) // key = song id, value = ArrayBuffer
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function reqResult<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function makeSongId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `song-${slug || 'file'}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`
}

export async function addSong(name: string, data: ArrayBuffer): Promise<SongMeta> {
  const meta: SongMeta = {
    id: makeSongId(name),
    name,
    size: data.byteLength,
    addedAt: Date.now(),
  }
  const db = await getDb()
  const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite')
  tx.objectStore(META_STORE).put(meta)
  tx.objectStore(DATA_STORE).put(data, meta.id)
  await txDone(tx)
  return meta
}

export async function listSongs(): Promise<SongMeta[]> {
  const db = await getDb()
  const tx = db.transaction(META_STORE, 'readonly')
  const all = await reqResult(
    tx.objectStore(META_STORE).getAll() as IDBRequest<SongMeta[]>,
  )
  return all.sort((a, b) => b.addedAt - a.addedAt)
}

export async function getSongData(id: string): Promise<ArrayBuffer | null> {
  const db = await getDb()
  const tx = db.transaction(DATA_STORE, 'readonly')
  const data = await reqResult(
    tx.objectStore(DATA_STORE).get(id) as IDBRequest<ArrayBuffer | undefined>,
  )
  return data ?? null
}

export async function deleteSong(id: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite')
  tx.objectStore(META_STORE).delete(id)
  tx.objectStore(DATA_STORE).delete(id)
  await txDone(tx)
}

export interface SongLibraryApi {
  songs: SongMeta[]
  loading: boolean
  error: string | null
  importFile: (file: File) => Promise<SongMeta | null>
  remove: (id: string) => Promise<void>
}

/** React access to the imported-song library, backed by IndexedDB. */
export function useSongLibrary(): SongLibraryApi {
  const [songs, setSongs] = useState<SongMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setSongs(await listSongs())
      setError(null)
    } catch {
      setError('Could not read your song library.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const importFile = useCallback(
    async (file: File): Promise<SongMeta | null> => {
      try {
        const data = await file.arrayBuffer()
        const meta = await addSong(file.name, data)
        await refresh()
        return meta
      } catch {
        setError('Could not import that file.')
        return null
      }
    },
    [refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteSong(id)
        await refresh()
      } catch {
        setError('Could not delete that song.')
      }
    },
    [refresh],
  )

  return { songs, loading, error, importFile, remove }
}
