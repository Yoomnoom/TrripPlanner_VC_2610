import { describe, expect, it } from 'vitest';
import {
  isEmptyPrefs,
  labelOf,
  mergePrefs,
  prefsToText,
  readPrefs,
  PlanningPrefs,
} from '../supabase/functions/_shared/prefs';
import { AiPlanResponse } from '../supabase/functions/_shared/schemas';
import { PLAN_JSON_SCHEMA, PLAN_SYSTEM } from '../supabase/functions/_shared/prompts';
import { buildContext } from '../supabase/functions/_shared/itinerary';

describe('planning prefs', () => {
  it('reads stored jsonb defensively', () => {
    expect(readPrefs(null)).toEqual({});
    expect(readPrefs('x')).toEqual({});
    expect(readPrefs({ pace: 'warp' })).toEqual({});
    expect(readPrefs({ pace: 'relaxed', themes: ['food'] })).toEqual({ pace: 'relaxed', themes: ['food'] });
  });
  it('merges a patch: nulls keep the old value, set fields replace it', () => {
    const base = { pace: 'busy', themes: ['food'], avoid: ['waiting'] } as const;
    const merged = mergePrefs(
      { ...base, themes: [...base.themes], avoid: [...base.avoid] },
      { pace: 'relaxed', themes: null, avoid: [], transport: 'car' },
    );
    expect(merged).toEqual({ pace: 'relaxed', themes: ['food'], avoid: [], transport: 'car' });
    expect(mergePrefs({ pace: 'busy' }, null)).toEqual({ pace: 'busy' });
  });
  it('detects empty prefs', () => {
    expect(isEmptyPrefs({})).toBe(true);
    expect(isEmptyPrefs({ pace: null, themes: [] })).toBe(true);
    expect(isEmptyPrefs({ pace: 'normal' })).toBe(false);
  });
  it('describes prefs in one Korean sentence', () => {
    expect(prefsToText({})).toBe('일정을 만들어줘');
    const t = prefsToText({
      companions: 'couple',
      pace: 'relaxed',
      themes: ['food', 'night'],
      transport: 'public',
      avoid: ['waiting'],
      mustInclude: ['시부야 스카이'],
    });
    expect(t).toContain('연인과');
    expect(t).toContain('맛집, 야경');
    expect(t).toContain('긴 웨이팅');
    expect(t).toContain('시부야 스카이');
    expect(t.endsWith('일정을 만들어줘')).toBe(true);
    expect(labelOf('unknown-key')).toBe('unknown-key');
  });
  it('limits sizes', () => {
    expect(PlanningPrefs.safeParse({ themes: Array.from({ length: 9 }, () => 'a') }).success).toBe(false);
    expect(PlanningPrefs.safeParse({ mustInclude: ['x'.repeat(81)] }).success).toBe(false);
  });
});

describe('plan response with prefsPatch', () => {
  const base = { reply: 'r', intent: 'chat', itinerary: null };
  it('accepts a missing, null or partial patch, and rejects an invalid one', () => {
    expect(AiPlanResponse.safeParse(base).success).toBe(true);
    expect(AiPlanResponse.safeParse({ ...base, prefsPatch: null }).success).toBe(true);
    expect(AiPlanResponse.safeParse({ ...base, prefsPatch: { pace: 'relaxed', themes: null } }).success).toBe(
      true,
    );
    expect(AiPlanResponse.safeParse({ ...base, prefsPatch: { pace: 'slow' } }).success).toBe(false);
  });
  it('the JSON schema requires prefsPatch and the prompt carries the new rules', () => {
    expect(PLAN_JSON_SCHEMA.required).toContain('prefsPatch');
    expect(PLAN_SYSTEM).toContain('planningPrefs');
    expect(PLAN_SYSTEM).toContain('mustInclude');
    expect(PLAN_SYSTEM).toContain('prefsPatch');
  });
  it('puts prefs and mustInclude into the context only when present', () => {
    const input = {
      trip: {
        title: 'T',
        start_date: '2026-10-09',
        end_date: '2026-10-10',
        headcount: null,
        budget_krw: null,
      },
      dayCount: 2,
      destinations: [],
      places: [],
    };
    expect(buildContext(input)).not.toHaveProperty('planningPrefs');
    expect(buildContext(input)).not.toHaveProperty('mustInclude');
    const c = buildContext({ ...input, prefs: { pace: 'relaxed' }, mustInclude: ['A'] });
    expect(c).toMatchObject({ planningPrefs: { pace: 'relaxed' }, mustInclude: ['A'] });
  });
});
