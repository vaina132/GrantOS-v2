/**
 * DraftKeeper — localStorage-backed autosave for every form in GrantLume.
 *
 * Goal: users never lose typed work. Every form that mutates server data
 * wraps its state with `useDraftKeeper`, which debounces writes to a
 * namespaced localStorage key. On reload, sign-in, or tab-resume the hook
 * surfaces a restore banner (or silently rehydrates unsaved work within a
 * short silentRestoreWindowMs, if the form opts in).
 *
 * Key shape: `gl.draft.v1:<orgId>:<userId>:<formKey>[:<recordId>]`
 *   - `orgId` scopes drafts to a tenant (collab-only users use `_collab`).
 *   - `userId` is a hard gate — sign-out sweep clears all keys for the
 *     previous user, so a shared browser never leaks drafts between users.
 *   - `formKey` is a stable id per form ("proposal-part-a", "budget", etc).
 *   - `recordId` is the server primary key, or `'new'` for unsaved records.
 */

/** High-level state the UI can render a pill for. */
export type DraftStatus =
  | 'idle' // Nothing to save (pristine, or matches server).
  | 'dirty' // User typed, debounce not yet fired.
  | 'saving' // Write in flight (async localStorage write chain).
  | 'saved' // Last write succeeded.
  | 'error' // Write failed (quota, JSON, etc) — see lastError.

/**
 * Stable identity for a draft. Every field except `recordId` is required.
 * `recordId` defaults to `'new'` when omitted (used for brand-new records
 * that have not yet received a server id).
 */
export interface DraftKey {
  orgId: string
  userId: string
  formKey: string
  recordId?: string
}

/**
 * Envelope wrapping the payload on disk. The envelope carries metadata so we
 * can detect stale/conflicted drafts, migrate schema versions, and expire
 * forgotten drafts without growing localStorage unbounded.
 */
export interface DraftEnvelope<T> {
  /** Storage schema version — increment if envelope shape changes. */
  v: 1
  /** Form payload schema version — form-owner bumps this to trigger migrate. */
  schemaVersion: number
  /** ISO timestamp of last successful write. */
  savedAt: string
  /**
   * Last known server-side mtime when the draft was taken. If the server's
   * current mtime is newer, the form has been edited elsewhere → conflict.
   */
  serverLastModified: string | null
  /** User-facing payload. */
  payload: T
}

/**
 * Result of comparing a loaded draft envelope to the current server state.
 * The form decides how to render this (banner, dialog, silent merge).
 */
export interface DraftConflict {
  /** Draft's view of server mtime when it was taken. */
  draftServerLastModified: string | null
  /** Server's current mtime (as supplied to the hook). */
  currentServerLastModified: string | null
}

/**
 * Migration hook for forms whose payload shape changes between releases.
 * Called when a loaded envelope's `schemaVersion` is older than the current.
 * Return the migrated payload, or `null` to discard the draft.
 */
export type DraftMigrate<T> = (
  oldPayload: unknown,
  fromSchemaVersion: number,
  toSchemaVersion: number,
) => T | null

/** Custom equality — used to avoid dirty-flagging on deep-equal updates. */
export type DraftEquals<T> = (a: T, b: T) => boolean

export interface UseDraftKeeperArgs<T> {
  /** Stable identity for this draft. */
  key: DraftKey
  /** Current in-memory value of the form. */
  value: T
  /** Setter used when the user accepts the restore banner. */
  setValue: (next: T) => void
  /** Global disable — e.g. feature flag off, or permission missing. */
  enabled?: boolean
  /** Server-side last-modified timestamp; used for conflict detection. */
  serverLastModified?: string | null
  /** Payload schema version; bump to trigger migrate. */
  schemaVersion?: number
  /** Migration fn for payloads with older schemaVersion. */
  migrate?: DraftMigrate<T>
  /** Debounce before writing to localStorage. Default 1500 ms. */
  debounceMs?: number
  /** Time after which a stored draft is ignored. Default 30 days. */
  ttlMs?: number
  /** Custom equality. Defaults to JSON-string comparison. */
  equals?: DraftEquals<T>
  /**
   * If a restored draft is fewer than this many ms old AND server-mtime
   * matches, silently rehydrate without showing a banner. Default 0
   * (always show banner). Narratives/budgets MUST keep this at 0 per
   * team vote A.
   */
  silentRestoreWindowMs?: number
  /**
   * Optional baseline for the "clean" state. When provided, DraftKeeper
   * compares the current value against this baseline instead of the last-
   * saved-draft to decide dirty/clean — so the moment a user reverts their
   * edits the draft is discarded. Forms typically pass the server-loaded
   * value here.
   */
  baseline?: T | null
}

export interface UseDraftKeeperResult<T> {
  /** High-level status for UI pill. */
  status: DraftStatus
  /** ISO string of last successful write, or null. */
  lastSavedAt: string | null
  /** True if a draft was loaded and is pending user action. */
  hasDraft: boolean
  /** How old the pending draft is, in ms. Null if no draft. */
  draftAge: number | null
  /** Conflict metadata if the draft's server-mtime differs from current. */
  conflict: DraftConflict | null
  /** Raw restored payload (set when hasDraft && !silently rehydrated). */
  draftPayload: T | null
  /** Apply the restored draft to the form state. */
  restore: () => void
  /** Delete the draft without applying. */
  discard: () => void
  /** Force-write the current value now, bypassing debounce. */
  flushNow: () => Promise<void>
  /** True if the current value differs from the last-saved draft. */
  isDirty: boolean
  /** Last error from a write, if any. */
  lastError: Error | null
}

/**
 * Registry entry — one per mounted useDraftKeeper instance. Lets the tab-
 * lifecycle / beforeunload / sign-out paths flush or clear every active
 * form in one sweep.
 */
export interface FlusherHandle {
  id: number
  key: DraftKey
  /** Returns true if the draft is dirty right now. */
  isDirty: () => boolean
  /** Writes any pending value synchronously (best-effort). */
  flushSync: () => void
  /** Clears the draft from storage. */
  clear: () => void
}
