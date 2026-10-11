import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './http.ts';

/** User-scoped client (RLS applies) built from the request's JWT. */
export function userClient(req: Request): SupabaseClient {
  const auth = req.headers.get('Authorization');
  if (!auth) throw new HttpError(401, 'UNAUTHORIZED', 'Missing Authorization header');
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
}

export async function requireUser(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError(401, 'UNAUTHORIZED', 'Invalid session');
  return data.user.id;
}

/** service_role is used ONLY for bump_usage and chat_messages inserts (CLAUDE.md rule 6). */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

export async function bumpUsage(userId: string, kind: string, limit: number): Promise<void> {
  const { data, error } = await adminClient().rpc('bump_usage', {
    p_user: userId,
    p_kind: kind,
    p_limit: limit,
  });
  if (error) throw new HttpError(500, 'USAGE_FAILED', 'Usage check failed');
  if (data === false) throw new HttpError(429, 'LIMIT_REACHED', '오늘 사용 한도에 도달했어요');
}

export const limitFromEnv = (name: string, fallback: number) => {
  const n = Number(Deno.env.get(name));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
