import { bumpUsage, limitFromEnv, requireUser, userClient } from '../_shared/auth.ts';
import { corsHeaders, fail, HttpError, json, ok } from '../_shared/http.ts';
import {
  buildComputeRoutesBody,
  parseComputeRoutesResponse,
  parseLegRequest,
  ROUTES_FIELD_MASK,
  ROUTES_URL,
} from '../_shared/routes.ts';

// Travel time/distance for one leg. Returns { data: { leg: null } } when there is no key or no route so the
// client falls back to its straight-line estimate (SPEC 4-7). UNVERIFIED against the live API.
Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'), Deno.env.get('APP_BASE_URL'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const client = userClient(req);
    const userId = await requireUser(client);
    const parsed = parseLegRequest(await req.json().catch(() => null));
    if (!parsed) throw new HttpError(400, 'BAD_REQUEST', 'from, to, mode are required');

    const key = Deno.env.get('GOOGLE_SERVER_KEY');
    if (!key) return ok({ leg: null, reason: 'NO_KEY' }, cors);

    await bumpUsage(userId, 'routes', limitFromEnv('DAILY_LIMIT_ROUTES', 400));

    const res = await fetch(ROUTES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': ROUTES_FIELD_MASK,
      },
      body: JSON.stringify(buildComputeRoutesBody(parsed.from, parsed.to, parsed.mode)),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return ok({ leg: null, reason: `UPSTREAM_${res.status}` }, cors);
    const leg = parseComputeRoutesResponse(await res.json());
    return ok({ leg, reason: leg ? null : 'NO_ROUTE' }, cors);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      return json(504, { error: { code: 'TIMEOUT', message: 'Timed out' } }, cors);
    }
    return fail(e, cors);
  }
});
