import { aiEnv } from '../_shared/ai/env.ts';
import { runAi } from '../_shared/ai/index.ts';
import { AiError, type Provider } from '../_shared/ai/types.ts';
import { bumpUsage, limitFromEnv, requireUser, userClient } from '../_shared/auth.ts';
import { corsHeaders, fail, HttpError, json, ok } from '../_shared/http.ts';
import { buildRecapContext } from '../_shared/recap.ts';
import { RECAP_JSON_SCHEMA, RECAP_SYSTEM } from '../_shared/prompts.ts';
import { RecapResult } from '../_shared/schemas.ts';

// Writes a short trip recap from places, reviews and day structure. The result is stored in trips.recap
// (a member-writable column) and may later appear on a public read-only link, so the prompt forbids money,
// confirmation numbers and personal data.
Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'), Deno.env.get('APP_BASE_URL'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const client = userClient(req);
    const userId = await requireUser(client);
    const body = (await req.json().catch(() => null)) as { tripId?: unknown } | null;
    const tripId = typeof body?.tripId === 'string' ? body.tripId : '';
    if (!/^[0-9a-f-]{36}$/i.test(tripId)) throw new HttpError(400, 'BAD_REQUEST', 'tripId is required');

    const { data: trip } = await client.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (!trip) throw new HttpError(403, 'FORBIDDEN', 'Not a member of this trip');

    const env = await aiEnv();
    if (!env.keys.gemini && !env.keys.openrouter && !env.keys.fake)
      throw new HttpError(503, 'AI_NO_KEY', 'AI 키가 설정되지 않았어요');

    const [places, reviews, dests] = await Promise.all([
      client
        .from('places')
        .select('id, name, day_index, category')
        .eq('trip_id', tripId)
        .not('day_index', 'is', null),
      client.from('place_reviews').select('place_id, rating, comment').eq('trip_id', tripId),
      client.from('trip_destinations').select('country_code, city').eq('trip_id', tripId).order('position'),
    ]);
    const dayCount = Math.round((Date.parse(trip.end_date) - Date.parse(trip.start_date)) / 86_400_000) + 1;
    const context = buildRecapContext({
      title: trip.title,
      dayCount,
      destinations: dests.data ?? [],
      places: places.data ?? [],
      reviews: reviews.data ?? [],
    });

    await bumpUsage(userId, 'recap', limitFromEnv('DAILY_LIMIT_RECAP', 10));
    const result = await runAi({
      clients: env.clients,
      models: { ...env.models, ...(trip.ai_model ? { [trip.ai_provider as Provider]: trip.ai_model } : {}) },
      provider: trip.ai_provider as Provider,
      fallback: trip.ai_fallback,
      req: {
        system: RECAP_SYSTEM,
        user: `CONTEXT: ${JSON.stringify(context)}`,
        jsonSchema: RECAP_JSON_SCHEMA,
        temperature: 0.7,
      },
      schema: RecapResult,
    });

    // keep only day notes inside the trip
    const recap = { ...result.data, dayNotes: result.data.dayNotes.filter((n) => n.dayIndex < dayCount) };
    const { error } = await client.from('trips').update({ recap }).eq('id', tripId);
    if (error) throw new HttpError(500, 'SAVE_FAILED', 'Could not save the recap');
    return ok({ recap, provider: result.provider, model: result.model }, cors);
  } catch (e) {
    if (e instanceof AiError) {
      console.error(`ai-recap ${e.code}: ${e.message}`);
      return json(
        e.code === 'AI_NO_KEY' ? 503 : 502,
        { error: { code: e.code, message: '회고를 만들지 못했어요' } },
        cors,
      );
    }
    return fail(e, cors);
  }
});
