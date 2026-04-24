import type { FlusherHandle } from './types'

/**
 * In-memory registry of every mounted useDraftKeeper instance.
 *
 * Tab-lifecycle / beforeunload / sign-out handlers walk this registry to
 * flush or clear drafts without needing direct references to every form on
 * the page. The registry lives at module scope, not on React context, so
 * it's reachable from plain browser-event listeners.
 */

let nextId = 1
const handles = new Map<number, FlusherHandle>()

export function register(entry: Omit<FlusherHandle, 'id'>): FlusherHandle {
  const id = nextId++
  const handle: FlusherHandle = { id, ...entry }
  handles.set(id, handle)
  return handle
}

export function unregister(id: number): void {
  handles.delete(id)
}

/** Best-effort synchronous flush of every registered form. */
export function flushAllDrafts(): number {
  let flushed = 0
  for (const h of handles.values()) {
    try {
      if (h.isDirty()) {
        h.flushSync()
        flushed += 1
      }
    } catch {
      /* never let one bad flush take down the sweep */
    }
  }
  return flushed
}

/** Is any registered form currently holding unsaved edits? */
export function isAnyDraftDirty(): boolean {
  for (const h of handles.values()) {
    try {
      if (h.isDirty()) return true
    } catch {
      /* ignore */
    }
  }
  return false
}

/** Count of registered flushers — useful for tests / debug. */
export function registeredCount(): number {
  return handles.size
}

/** Clear drafts for every currently mounted form. Used on sign-out. */
export function clearAllRegisteredDrafts(): void {
  for (const h of handles.values()) {
    try {
      h.clear()
    } catch {
      /* ignore */
    }
  }
}
