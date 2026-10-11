import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  createGeminiClient,
  buildGeminiBody,
  extractGeminiText,
} from '../supabase/functions/_shared/ai/gemini';
import { createOpenRouterClient, buildOpenRouterBody } from '../supabase/functions/_shared/ai/openrouter';
import { runAi } from '../supabase/functions/_shared/ai/index';
import { parseJsonText } from '../supabase/functions/_shared/ai/parse';
import { createFakeClient } from '../supabase/functions/_shared/ai/fake';
import { AiError, AiHttpError, type AiClient, type AiRequest } from '../supabase/functions/_shared/ai/types';
import { PLAN_JSON_SCHEMA } from '../supabase/functions/_shared/prompts';
import {
  buildContext,
  fixItinerary,
  forecastInRange,
  LenientPlan,
  normalizeRawPlan,
  wantsFx,
  wantsWeather,
} from '../supabase/functions/_shared/itinerary';
import { buildTextSearchBody, mapLimit, parseTextSearch } from '../supabase/functions/_shared/places';
import { buildForecastUrl, parseForecast } from '../supabase/functions/_shared/weather';
import { PLACE_CATEGORIES } from '@/types/domain';

const req: AiRequest = {
  system: 'sys',
  user: 'hello',
  history: [
    { role: 'user', content: 'a' },
    { role: 'assistant', content: 'b' },
  ],
  images: [{ mimeType: 'image/jpeg', base64: 'AAAA' }],
  jsonSchema: { type: 'object' },
};

const jsonRes = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('parseJsonText', () => {
  it('handles fences and surrounding prose', () => {
    expect(parseJsonText('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonText('결과: {"a":2} 끝')).toEqual({ a: 2 });
    expect(() => parseJsonText('no json')).toThrow();
  });
});

describe('gemini adapter', () => {
  it('builds the request (system, roles, inlineData, schema)', () => {
    const b = buildGeminiBody(req, true);
    expect(b.systemInstruction.parts[0].text).toBe('sys');
    expect(b.contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);
    expect(b.contents[2].parts[1]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } });
    expect(b.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
      responseJsonSchema: { type: 'object' },
    });
    expect(buildGeminiBody(req, false).generationConfig).not.toHaveProperty('responseJsonSchema');
  });
  it('extracts text and rejects empty/blocked answers', () => {
    expect(
      extractGeminiText({ candidates: [{ content: { parts: [{ text: '{"x":' }, { text: '1}' }] } }] }),
    ).toBe('{"x":1}');
    expect(() => extractGeminiText({ candidates: [] })).toThrow(AiHttpError);
    expect(() => extractGeminiText({ promptFeedback: { blockReason: 'SAFETY' } })).toThrow(/blocked/);
  });
  it('sends the key in a header (not the URL) and retries once without the schema on 400', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({}, 400))
      .mockResolvedValueOnce(jsonRes({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }));
    const out = await createGeminiClient('SECRET', f).call(req, 'm1');
    expect(out).toBe('{"ok":true}');
    expect(f).toHaveBeenCalledTimes(2);
    const [url, init] = f.mock.calls[0];
    expect(url).toContain('/models/m1:generateContent');
    expect(url).not.toContain('SECRET');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('SECRET');
    expect(JSON.parse(f.mock.calls[1][1].body).generationConfig).not.toHaveProperty('responseJsonSchema');
  });
  it('does not retry other errors', async () => {
    const f = vi.fn().mockResolvedValue(jsonRes({}, 429));
    await expect(createGeminiClient('k', f).call(req, 'm')).rejects.toMatchObject({ status: 429 });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('openrouter adapter', () => {
  it('builds messages with images and strict json_schema', () => {
    const b = buildOpenRouterBody(req, 'vendor/model', true);
    expect(b.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(b.messages.at(-1)?.content).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } },
    ]);
    expect(b.response_format).toMatchObject({ type: 'json_schema', json_schema: { strict: true } });
    const plain = buildOpenRouterBody({ ...req, images: [] }, 'm', false);
    expect(plain).not.toHaveProperty('response_format');
    expect(plain.messages[0].content).toContain('JSON');
  });
  it('uses bearer auth and falls back to prompt-only JSON on 400', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({}, 400))
      .mockResolvedValueOnce(jsonRes({ choices: [{ message: { content: '{"ok":true}' } }] }));
    const out = await createOpenRouterClient('KEY', 'https://app.example', f).call(
      { ...req, images: [] },
      'm',
    );
    expect(out).toBe('{"ok":true}');
    const headers = f.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer KEY');
    expect(headers['HTTP-Referer']).toBe('https://app.example');
  });
});

describe('runAi', () => {
  const schema = z.object({ ok: z.boolean() });
  const ok: AiClient = { call: async () => '{"ok":true}' };
  const boom = (status?: number): AiClient => ({
    call: async () => {
      throw status ? new AiHttpError(status, 'x') : new Error('network');
    },
  });
  const models = { gemini: 'g', openrouter: 'o' };
  const base = { models, req, schema, fallback: true } as const;

  it('uses the chosen provider', async () => {
    const r = await runAi({ ...base, provider: 'openrouter', clients: { gemini: boom(), openrouter: ok } });
    expect(r).toMatchObject({ provider: 'openrouter', model: 'o', data: { ok: true } });
  });
  it('retries the same provider once with the validation error fed back', async () => {
    const calls: string[] = [];
    const flaky: AiClient = {
      call: async (r) => {
        calls.push(r.user);
        return calls.length === 1 ? '{"ok":"yes"}' : '{"ok":true}';
      },
    };
    const r = await runAi({ ...base, provider: 'gemini', clients: { gemini: flaky } });
    expect(r.data.ok).toBe(true);
    expect(calls[1]).toContain('이전 출력 오류');
  });
  it('falls back to the other provider when the first keeps failing', async () => {
    const r = await runAi({ ...base, provider: 'gemini', clients: { gemini: boom(500), openrouter: ok } });
    expect(r.provider).toBe('openrouter');
  });
  it('does not retry a 4xx (except 429) on the same provider', async () => {
    const spy = vi.fn().mockRejectedValue(new AiHttpError(401, 'bad key'));
    const r = await runAi({
      ...base,
      provider: 'gemini',
      clients: { gemini: { call: spy }, openrouter: ok },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(r.provider).toBe('openrouter');
  });
  it('starts with the other provider when the chosen key is missing and fallback is on', async () => {
    const r = await runAi({ ...base, provider: 'gemini', clients: { openrouter: ok } });
    expect(r.provider).toBe('openrouter');
  });
  it('fails with AI_NO_KEY / AI_FAILED', async () => {
    await expect(runAi({ ...base, provider: 'gemini', clients: {} })).rejects.toMatchObject({
      code: 'AI_NO_KEY',
    });
    await expect(
      runAi({ ...base, fallback: false, provider: 'gemini', clients: { gemini: boom(500), openrouter: ok } }),
    ).rejects.toBeInstanceOf(AiError);
    await expect(
      runAi({ ...base, provider: 'gemini', clients: { gemini: boom(500), openrouter: boom(500) } }),
    ).rejects.toMatchObject({ code: 'AI_FAILED' });
  });
});

describe('itinerary repair', () => {
  const item = (o = {}) => ({
    name: 'A',
    category: 'food',
    startTime: '09:00',
    endTime: '10:00',
    isIndoor: null,
    note: null,
    searchQuery: 'A 도쿄',
    ...o,
  });
  const raw = (days: unknown[], extra = {}) => ({
    reply: 'r',
    intent: 'itinerary',
    itinerary: { days },
    ...extra,
  });

  it('maps unknown categories to other and cuts >10 items before zod', () => {
    const parsed = LenientPlan.parse(
      raw([
        {
          dayIndex: 0,
          title: 't',
          items: Array.from({ length: 12 }, (_, i) => item({ category: i === 0 ? 'spa' : 'food' })),
        },
      ]),
    ) as { itinerary: { days: { items: { category: string }[] }[] } };
    expect(parsed.itinerary.days[0].items).toHaveLength(10);
    expect(parsed.itinerary.days[0].items[0].category).toBe('other');
    expect(normalizeRawPlan('x')).toBe('x');
  });
  it('fixes inverted times, sorts, and drops days outside the trip', () => {
    const plan = LenientPlan.parse(
      raw([
        {
          dayIndex: 0,
          title: 'd1',
          items: [
            item({ name: 'late', startTime: '15:00', endTime: '14:00' }),
            item({ name: 'early', startTime: '09:00', endTime: '10:00' }),
          ],
        },
        { dayIndex: 5, title: 'far', items: [item()] },
      ]),
    ) as Parameters<typeof fixItinerary>[0];
    const fixed = fixItinerary(plan, 3);
    expect(fixed.itinerary?.days).toHaveLength(1);
    expect(fixed.itinerary?.days[0].items.map((i) => [i.name, i.endTime])).toEqual([
      ['early', '10:00'],
      ['late', '16:00'],
    ]);
  });
  it('clamps a fixed end at 23:59', () => {
    const plan = LenientPlan.parse(
      raw([{ dayIndex: 0, title: 't', items: [item({ startTime: '23:30', endTime: '23:00' })] }]),
    ) as Parameters<typeof fixItinerary>[0];
    expect(fixItinerary(plan, 1).itinerary?.days[0].items[0].endTime).toBe('23:59');
  });
  it('rejects a response with the wrong shape', () => {
    expect(LenientPlan.safeParse({ reply: 'x' }).success).toBe(false);
  });
  it('keeps the JSON schema in sync with the category list', () => {
    const cats = (
      PLAN_JSON_SCHEMA.properties.itinerary.anyOf[1] as {
        properties: {
          days: {
            items: { properties: { items: { items: { properties: { category: { enum: string[] } } } } } };
          };
        };
      }
    ).properties.days.items.properties.items.items.properties.category.enum;
    expect(cats).toEqual([...PLACE_CATEGORIES]);
  });
});

describe('context and enrichment', () => {
  it('builds a compact context without ids', () => {
    const c = buildContext({
      trip: {
        title: 'T',
        start_date: '2026-10-09',
        end_date: '2026-10-12',
        headcount: 2,
        budget_krw: 1000000,
      },
      dayCount: 4,
      destinations: [{ country_code: 'JP', city: '도쿄' }],
      places: [
        { day_index: 0, name: 'A', category: 'food', start_time: '09:00:00', end_time: '10:00:00' },
        { day_index: null, name: 'idea', category: 'other', start_time: null, end_time: null },
      ],
      fx: { currency: 'JPY', rate: 8.4, date: '2026-10-09' },
    });
    expect(c.currentItinerary).toEqual([
      { dayIndex: 0, name: 'A', category: 'food', startTime: '09:00', endTime: '10:00' },
    ]);
    expect(c.fx).toBeDefined();
    expect(JSON.stringify(c)).not.toMatch(/uuid|trip_id/);
  });
  it('detects when fx/weather context is wanted and the forecast window', () => {
    expect(wantsFx('엔화 환율 알려줘')).toBe(true);
    expect(wantsFx('맛집 추천')).toBe(false);
    expect(wantsWeather('비 오면 어떡해?')).toBe(true);
    expect(wantsWeather('맛집 추천')).toBe(false);
    expect(wantsWeather('날씨 어때?')).toBe(true);
    expect(forecastInRange('2026-10-20', '2026-10-12')).toBe(true);
    expect(forecastInRange('2026-12-20', '2026-10-12')).toBe(false);
  });
  it('builds forecast urls and parses answers', () => {
    expect(buildForecastUrl(35.6, 139.7, '2026-10-09', '2026-10-12')).toContain('latitude=35.6');
    expect(
      parseForecast({
        daily: {
          time: ['2026-10-09'],
          temperature_2m_max: [20],
          temperature_2m_min: [12],
          precipitation_probability_max: [30],
        },
      }),
    ).toEqual([{ date: '2026-10-09', maxC: 20, minC: 12, rainPct: 30 }]);
    expect(parseForecast({})).toEqual([]);
  });
});

describe('places text search', () => {
  it('builds the body with a bias and parses the first hit', () => {
    expect(buildTextSearchBody('이치란', { lat: 35, lng: 139 })).toMatchObject({
      textQuery: '이치란',
      locationBias: { circle: { radius: 30000 } },
    });
    expect(buildTextSearchBody('이치란', null)).not.toHaveProperty('locationBias');
    expect(
      parseTextSearch({
        places: [{ id: 'abc', formattedAddress: 'addr', location: { latitude: 1, longitude: 2 } }],
      }),
    ).toEqual({
      googlePlaceId: 'abc',
      address: 'addr',
      lat: 1,
      lng: 2,
    });
    expect(parseTextSearch({ places: [] })).toBeNull();
    expect(parseTextSearch({ places: [{ id: 'x' }] })).toBeNull();
  });
  it('limits concurrency and keeps order', async () => {
    let active = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6, 7], 5, async (n) => {
      peak = Math.max(peak, ++active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBeLessThanOrEqual(5);
  });
});

describe('fake provider', () => {
  const fake = createFakeClient();
  const user = (msg: string, days = 3) =>
    `CONTEXT: ${JSON.stringify({ trip: { dayCount: days, destinations: [{ city: '도쿄' }] } })}\n\n요청: ${msg}`;
  it('returns a schema-valid itinerary with one day per trip day', async () => {
    const raw = await fake.call({ ...req, user: user('도쿄 3박4일 일정 만들어줘') }, 'x');
    const plan = LenientPlan.parse(JSON.parse(raw)) as { intent: string; itinerary: { days: unknown[] } };
    expect(plan.intent).toBe('itinerary');
    expect(plan.itinerary.days).toHaveLength(3);
  });
  it('chats for non-plan requests and answers ping', async () => {
    expect(JSON.parse(await fake.call({ ...req, user: user('안녕') }, 'x')).intent).toBe('chat');
    expect(JSON.parse(await fake.call({ ...req, jsonSchema: { required: ['ok'] } }, 'x'))).toEqual({
      ok: true,
    });
  });
});

describe('gemini model discovery', () => {
  it('picks the newest stable flash that supports generateContent', async () => {
    const { parseGeminiModels, pickGeminiFlash } = await import('../supabase/functions/_shared/ai/models');
    const models = parseGeminiModels({
      models: [
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3-flash-preview', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-4-flash', supportedGenerationMethods: ['embedContent'] },
        { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
      ],
    });
    expect(pickGeminiFlash(models)).toBe('gemini-3-flash');
    expect(pickGeminiFlash([])).toBeNull();
    expect(parseGeminiModels(null)).toEqual([]);
  });
});
