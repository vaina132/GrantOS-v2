/**
 * DraftKeeper — public surface.
 *
 * Forms import from `@/lib/draftKeeper`; everything else is internal.
 * The tab-lifecycle and auth-store modules reach for the lower-level
 * registry / storage helpers directly.
 */
export { useDraftKeeper } from './useDraftKeeper'
export {
  flushAllDrafts,
  isAnyDraftDirty,
  clearAllRegisteredDrafts,
  registeredCount,
} from './registry'
export {
  clearAllDraftsFor,
  clearAllDraftsForScope,
  pruneExpired,
  isStorageAvailable,
  listAllDrafts,
} from './storage'
export { buildKey, parseKey, listAllKeys, KEY_PREFIX } from './key'
export { isDraftKeeperEnabled } from './flag'
export type {
  DraftKey,
  DraftEnvelope,
  DraftStatus,
  DraftConflict,
  DraftMigrate,
  DraftEquals,
  UseDraftKeeperArgs,
  UseDraftKeeperResult,
  FlusherHandle,
} from './types'
