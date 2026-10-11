import { requireUser, userClient } from '../_shared/auth.ts';
import { buildFxUrl, isCurrencyCode, parseFxResponse } from '../_shared/fx.ts';
import { corsHeaders, fail, HttpError, json } from '../_shared/http.ts';

// 1 {base} = ? KRW via Frankfurter (no key). Unsupported currency -> { rate: null } so the client asks for a manual rate.
Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'), Deno.env.get('APP_BASE_URL'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    await requireUser(userClient(req));
    const body = await req.json().catch(() => null);
    const base = (body as { base?: unknown } | null)?.base;
    if (!isCurrencyCode(base)) throw new HttpError(400, 'BAD_REQUEST', 'base must be an ISO 4217 code');
    if (base === 'KRW') return json(200, { data: { rate: 1, date: null } }, cors);

    const res = await fetch(buildFxUrl(base), { signal: AbortSignal.timeout(15_000) });
    if (res.status === 404)
      return json(
        200,
        { data: { rate: null, date: null } },
        { ...cors, 'Cache-Control': 'public, max-age=43200' },
      );
    if (!res.ok) throw new HttpError(502, 'FX_UPSTREAM', 'Exchange rate service failed');
    return json(
      200,
      { data: parseFxResponse(await res.json()) },
      { ...cors, 'Cache-Control': 'public, max-age=43200' },
    );
  } catch (e) {
    return fail(e, cors);
  }
});
