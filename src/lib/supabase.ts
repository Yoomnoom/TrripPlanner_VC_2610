import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/types/db';

export const supabase = env
  ? createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

let pending: Promise<string> | null = null;

/** Returns the current user id, creating an anonymous session on first run. Concurrent calls share one request. */
export function ensureSession(): Promise<string> {
  if (!supabase) return Promise.reject(new Error('ENV_MISSING'));
  const client = supabase;
  pending ??= (async () => {
    const { data } = await client.auth.getSession();
    if (data.session) return data.session.user.id;
    const { data: created, error } = await client.auth.signInAnonymously();
    if (error || !created.user) throw error ?? new Error('ANON_SIGNIN_FAILED');
    return created.user.id;
  })().catch((e: unknown) => {
    pending = null;
    throw e;
  });
  return pending;
}
