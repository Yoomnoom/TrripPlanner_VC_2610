import { aiEnv } from '../_shared/ai/env.ts';
import { runAi } from '../_shared/ai/index.ts';
import { AiError, type Provider } from '../_shared/ai/types.ts';
import { bumpUsage, limitFromEnv, requireUser, userClient } from '../_shared/auth.ts';
import { corsHeaders, fail, HttpError, json, ok } from '../_shared/http.ts';
import { INDOOR_JSON_SCHEMA, INDOOR_SYSTEM, buildIndoorUser } from '../_shared/prompts.ts';
import { mapLimit } from '../_shared/places.ts';
import { makeResolver } from '../_shared/resolve.ts';
import { IndoorAlternatives } from '../_shared/schemas.ts';

// Suggests 3 indoor alternatives near a place (rainy-day swap). The app replaces the place itself.
Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'), Deno.env.get('APP_BASE_URL'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const client = userClient(req);
    const userId = await requireUser(client);
    const body = (await req.json().catch(() => null)) as { tripId?: unknown; placeId?: unknown } | null;
    const tripId = typeof body?.tripId === 'string' ? body.tripId : '';
    const placeId = typeof body?.placeId === 'string' ? body.placeId : '';
    const uuid = /^[0-9a-f-]{36}$/i;
    if (!uuid.test(tripId) || !uuid.test(placeId))
      throw new HttpError(400, 'BAD_REQUEST', 'tripId and placeId are required');

    const { data: trip } = await client.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (!trip) throw new HttpError(403, 'FORBIDDEN', 'Not a member of this trip');
    const { data: place } = await client
      .from('places')
      .select('*')
      .eq('id', placeId)
      .eq('trip_id', tripId)
      .maybeSingle();
    if (!place) throw new HttpError(404, 'NOT_FOUND', 'Place not found');

    const env = await aiEnv();
    if (!env.keys.gemini && !env.keys.openrouter && !env.keys.fake)
      throw new HttpError(503, 'AI_NO_KEY', 'AI 키가 설정되지 않았어요');
    await bumpUsage(userId, 'ai', limitFromEnv('DAILY_LIMIT_AI', 60));

    const result = await runAi({
      clients: env.clients,
      models: { ...env.models, ...(trip.ai_model ? { [trip.ai_provider as Provider]: trip.ai_model } : {}) },
      provider: trip.ai_provider as Provider,
      fallback: trip.ai_fallback,
      req: {
        system: INDOOR_SYSTEM,
        user: buildIndoorUser({
          name: place.name,
          category: place.category,
          address: place.address,
          startTime: place.start_time?.slice(0, 5) ?? null,
        }),
        jsonSchema: INDOOR_JSON_SCHEMA,
        temperature: 0.7,
      },
      schema: IndoorAlternatives,
    });

    const center = place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null;
    const resolve = makeResolver(center, env.keys.fake);
    const alternatives = await mapLimit(result.data.alternatives.slice(0, 3), 3, async (a) => {
      const r = await resolve(a.searchQuery);
      return {
        ...a,
        resolved: !!r,
        googlePlaceId: r?.googlePlaceId ?? null,
        address: r?.address ?? null,
        lat: r?.lat ?? null,
        lng: r?.lng ?? null,
      };
    });
    return ok({ alternatives, provider: result.provider, model: result.model }, cors);
  } catch (e) {
    if (e instanceof AiError) {
      console.error(`ai-indoor-swap ${e.code}: ${e.message}`);
      return json(
        e.code === 'AI_NO_KEY' ? 503 : 502,
        { error: { code: e.code, message: 'AI 응답을 받지 못했어요' } },
        cors,
      );
    }
    return fail(e, cors);
  }
});
