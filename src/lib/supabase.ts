import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/types/db';

export const supabase = env
  ? createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

/** User id of a session saved on this device (used when the network is down and no refresh is possible). */
function storedUserId(): string | null {
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith('sb-') || !k.endsWith('-auth-token')) continue;
      const id = (JSON.parse(localStorage.getItem(k) ?? 'null') as { user?: { id?: string } } | null)?.user
        ?.id;
      if (id) return id;
    }
  } catch {
    // unreadable storage: no fallback
  }
  return null;
}

let pending: Promise<string> | null = null;

/** Returns the current user id, creating an anonymous session on first run. Concurrent calls share one request. */
export function ensureSession(): Promise<string> {
  if (!supabase) return Promise.reject(new Error('ENV_MISSING'));
  const client = supabase;
  pending ??= (async () => {
    try {
      const { data } = await client.auth.getSession();
      if (data.session) return data.session.user.id;
      const { data: created, error } = await client.auth.signInAnonymously();
      if (error || !created.user) throw error ?? new Error('ANON_SIGNIN_FAILED');
      return created.user.id;
    } catch (e) {
      // Offline start: the saved session still identifies me, so the cached trips can be opened.
      const saved = typeof navigator !== 'undefined' && !navigator.onLine ? storedUserId() : null;
      if (saved) return saved;
      throw e;
    }
  })().catch((e: unknown) => {
    pending = null;
    throw e;
  });
  return pending;
}
