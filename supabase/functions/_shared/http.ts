// CORS + response helpers shared by all Edge Functions. Success: { data }, failure: { error: { code, message } }.

export function corsHeaders(origin: string | null, allowed: string | undefined): Record<string, string> {
  // APP_BASE_URL may hold several origins separated by commas; local dev origins are always allowed.
  const list = (allowed ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const local = origin !== null && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const ok = origin !== null && (local || list.includes(origin));
  return {
    'Access-Control-Allow-Origin': ok ? origin : (list[0] ?? 'null'),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    Vary: 'Origin',
  };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function json(status: number, body: unknown, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

export const ok = (data: unknown, headers: Record<string, string>) => json(200, { data }, headers);

export function fail(e: unknown, headers: Record<string, string>) {
  if (e instanceof HttpError) return json(e.status, { error: { code: e.code, message: e.message } }, headers);
  return json(500, { error: { code: 'INTERNAL', message: 'Unexpected error' } }, headers);
}
