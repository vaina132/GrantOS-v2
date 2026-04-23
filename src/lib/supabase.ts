import { createClient, processLock } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

// Swap the default `navigatorLock` for `processLock`. The default lock uses
// `navigator.locks`, which Edge/Chromium can leave orphaned when a tab is
// suspended/resumed or when React Strict Mode double-mounts — the observable
// symptom is that every query wedges on a "Lock was not released within
// 5000ms" warning and skeletons never resolve until a full refresh.
// `processLock` is a pure-JS mutex that doesn't depend on navigator.locks.
//
// The `globalThis.__grantos_supabase__` guard prevents Strict Mode from
// creating two clients that would race each other on the same auth token.
declare global {
  // eslint-disable-next-line no-var
  var __grantos_supabase__: ReturnType<typeof createClient<Database>> | undefined
}

export const supabase =
  globalThis.__grantos_supabase__ ??
  createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      lock: processLock,
      storageKey: 'grantos-auth',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })

if (import.meta.env.DEV) globalThis.__grantos_supabase__ = supabase
