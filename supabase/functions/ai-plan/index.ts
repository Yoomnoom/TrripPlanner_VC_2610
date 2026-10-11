import { aiEnv } from '../_shared/ai/env.ts';
import { fakeCoords } from '../_shared/ai/fake.ts';
import { runAi } from '../_shared/ai/index.ts';
import { AiError, type Provider } from '../_shared/ai/types.ts';
import { adminClient, bumpUsage, limitFromEnv, requireUser, userClient } from '../_shared/auth.ts';
import { corsHeaders, fail, HttpError, json, ok } from '../_shared/http.ts';
import {
  buildContext,
  fixItinerary,
  forecastInRange,
  LenientPlan,
  wantsFx,
  wantsWeather,
  type Plan,
} from '../_shared/itinerary.ts';
import {
  buildTextSearchBody,
  mapLimit,
  parseTextSearch,
  PLACES_FIELD_MASK,
  PLACES_TEXT_URL,
  type ResolvedPlace,
} from '../_shared/places.ts';
import { buildPlanUser, PLAN_JSON_SCHEMA, PLAN_SYSTEM } from '../_shared/prompts.ts';
import { buildFxUrl, parseFxResponse } from '../_shared/fx.ts';
import { buildForecastUrl, parseForecast } from '../_shared/weather.ts';

const DEFAULT_CENTER = { lat: 35.6812, lng: 139.7671 }; // only used by the fake resolver when a trip has no coordinates

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  return res.ok ? await res.json() : null;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'), Deno.env.get('APP_BASE_URL'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const client = userClient(req);
    const userId = await requireUser(client);
    const body = (await req.json().catch(() => null)) as { tripId?: unknown; message?: unknown } | null;
    const tripId = typeof body?.tripId === 'string' ? body.tripId : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!/^[0-9a-f-]{36}$/i.test(tripId) || message === '' || message.length > 2000) {
      throw new HttpError(400, 'BAD_REQUEST', 'tripId and message (<=2000 chars) are required');
    }

    // Membership check through RLS: a non-member simply cannot read the trip.
    const { data: trip } = await client.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (!trip) throw new HttpError(403, 'FORBIDDEN', 'Not a member of this trip');

    const env = await aiEnv();
    if (!env.keys.gemini && !env.keys.openrouter && !env.keys.fake) {
      throw new HttpError(503, 'AI_NO_KEY', 'AI 키가 설정되지 않았어요');
    }

    const [dests, places, hist, me] = await Promise.all([
      client
        .from('trip_destinations')
        .select('country_code, city, lat, lng')
        .eq('trip_id', tripId)
        .order('position'),
      client.from('places').select('day_index, name, category, start_time, end_time').eq('trip_id', tripId),
      client
        .from('chat_messages')
        .select('role, content')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
        .limit(12),
      client.from('members').select('id').eq('trip_id', tripId).eq('user_id', userId).maybeSingle(),
    ]);
    const destinations = dests.data ?? [];
    const dayCount = Math.round((Date.parse(trip.end_date) - Date.parse(trip.start_date)) / 86_400_000) + 1;

    // optional context: exchange rate / forecast, only when the message asks for it
    let fx: { currency: string; rate: number; date: string | null } | null = null;
    let weather: unknown = null;
    if (wantsFx(message) && trip.base_currency !== 'KRW') {
      const r = parseFxResponse(await getJson(buildFxUrl(trip.base_currency)).catch(() => null));
      if (r.rate) fx = { currency: trip.base_currency, rate: r.rate, date: r.date };
    }
    const d0 = destinations[0];
    if (
      wantsWeather(message) &&
      d0?.lat != null &&
      d0?.lng != null &&
      forecastInRange(trip.start_date, new Date().toISOString().slice(0, 10))
    ) {
      const f = parseForecast(
        await getJson(buildForecastUrl(d0.lat, d0.lng, trip.start_date, trip.end_date)).catch(() => null),
      );
      if (f.length) weather = f;
    }

    const context = buildContext({ trip, dayCount, destinations, places: places.data ?? [], fx, weather });
    const history = [...(hist.data ?? [])]
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    await bumpUsage(userId, 'ai', limitFromEnv('DAILY_LIMIT_AI', 60));

    const result = await runAi({
      clients: env.clients,
      models: { ...env.models, ...(trip.ai_model ? { [trip.ai_provider as Provider]: trip.ai_model } : {}) },
      provider: trip.ai_provider as Provider,
      fallback: trip.ai_fallback,
      req: {
        system: PLAN_SYSTEM,
        user: buildPlanUser(context, message),
        history,
        jsonSchema: PLAN_JSON_SCHEMA,
        temperature: 0.7,
      },
      schema: LenientPlan as never,
    });
    const plan = fixItinerary(result.data as Plan, dayCount);

    // Resolve each item to a real place (server key). Failures leave the item name-only (resolved:false).
    const serverKey = Deno.env.get('GOOGLE_SERVER_KEY');
    const center = d0?.lat != null && d0?.lng != null ? { lat: d0.lat, lng: d0.lng } : null;
    const resolve = async (query: string): Promise<ResolvedPlace | null> => {
      if (env.keys.fake) {
        const c = fakeCoords(query, center ?? DEFAULT_CENTER);
        return { googlePlaceId: `fake:${query}`, address: null, lat: c.lat, lng: c.lng };
      }
      if (!serverKey) return null;
      try {
        const j = await getJson(PLACES_TEXT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': serverKey,
            'X-Goog-FieldMask': PLACES_FIELD_MASK,
          },
          body: JSON.stringify(buildTextSearchBody(query, center)),
        });
        return parseTextSearch(j);
      } catch {
        return null;
      }
    };
    const proposal = plan.itinerary
      ? {
          days: await Promise.all(
            plan.itinerary.days.map(async (d) => ({
              ...d,
              items: await mapLimit(d.items, 5, async (it) => {
                const r = await resolve(it.searchQuery);
                return {
                  ...it,
                  resolved: !!r,
                  googlePlaceId: r?.googlePlaceId ?? null,
                  address: r?.address ?? null,
                  lat: r?.lat ?? null,
                  lng: r?.lng ?? null,
                };
              }),
            })),
          ),
        }
      : null;

    // service_role: chat_messages inserts only (CLAUDE.md rule 6)
    const admin = adminClient();
    const memberId = me.data?.id ?? null;
    const { error: insErr } = await admin.from('chat_messages').insert([
      { trip_id: tripId, role: 'user', content: message, member_id: memberId },
      {
        trip_id: tripId,
        role: 'assistant',
        content: plan.reply,
        proposal,
        member_id: null,
        provider: result.provider,
        model: result.model,
      },
    ]);
    if (insErr) throw new HttpError(500, 'SAVE_FAILED', 'Could not save the conversation');

    return ok({ message: plan.reply, proposal, provider: result.provider, model: result.model }, cors);
  } catch (e) {
    if (e instanceof AiError) {
      console.error(`ai-plan ${e.code}: ${e.message}`); // provider error text only, never keys
      const status = e.code === 'AI_NO_KEY' ? 503 : 502;
      return json(
        status,
        {
          error: {
            code: e.code,
            message:
              e.code === 'AI_NO_KEY'
                ? 'AI 키가 설정되지 않았어요'
                : 'AI 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요',
          },
        },
        cors,
      );
    }
    return fail(e, cors);
  }
});
