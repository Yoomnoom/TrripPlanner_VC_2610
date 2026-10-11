import { describe, expect, it } from 'vitest';
import { canReview, stars, summarize, unreviewed } from '@/lib/reviews';
import { parseRecap } from '@/lib/recap';
import { viewUrl } from '@/lib/external';
import { buildRecapContext, topRated } from '../supabase/functions/_shared/recap';
import { SharedTrip } from '@/features/share/api';
import { RECAP_JSON_SCHEMA, RECAP_SYSTEM } from '../supabase/functions/_shared/prompts';
import { RecapResult } from '@/schemas/ai';
import { createFakeClient } from '../supabase/functions/_shared/ai/fake';

describe('reviews', () => {
  const reviews = [
    { place_id: 'a', member_id: 'm1', rating: 5 },
    { place_id: 'a', member_id: 'm2', rating: 4 },
    { place_id: 'b', member_id: 'm1', rating: 3 },
  ];
  it('averages per place and counts', () => {
    const s = summarize(reviews);
    expect(s.get('a')).toEqual({ avg: 4.5, count: 2, members: ['m1', 'm2'] });
    expect(s.get('b')?.avg).toBe(3);
    expect(s.has('c')).toBe(false);
  });
  it('lists scheduled places I have not reviewed', () => {
    const places = [
      { id: 'a', day_index: 0 },
      { id: 'b', day_index: 1 },
      { id: 'c', day_index: 1 },
      { id: 'i', day_index: null },
    ];
    expect(unreviewed(places, reviews, 'm1').map((p) => p.id)).toEqual(['c']);
    expect(unreviewed(places, reviews, 'm2').map((p) => p.id)).toEqual(['b', 'c']);
    expect(unreviewed(places, reviews, null)).toEqual([]);
  });
  it('renders stars and gates writing on the start date', () => {
    expect(stars(4.4)).toBe('★★★★☆');
    expect(stars(0)).toBe('☆☆☆☆☆');
    expect(canReview('2026-10-09', '2026-10-08')).toBe(false);
    expect(canReview('2026-10-09', '2026-10-09')).toBe(true);
  });
});

describe('recap', () => {
  it('builds a context without money, ids of people or confirmation data', () => {
    const c = buildRecapContext({
      title: '도쿄',
      dayCount: 2,
      destinations: [{ country_code: 'JP', city: '도쿄' }],
      places: [
        { id: 'p1', name: '센소지', day_index: 0, category: 'sightseeing' },
        { id: 'p2', name: '아이디어', day_index: null, category: 'other' },
      ],
      reviews: [
        { place_id: 'p1', rating: 5, comment: '좋았어요' },
        { place_id: 'p1', rating: 4, comment: '  ' },
      ],
    });
    expect(c.stats).toEqual({ places: 1, days: 2, reviewed: 1 });
    expect(c.days[0].places[0]).toMatchObject({ name: '센소지', avgRating: 4.5, comments: ['좋았어요'] });
    expect(c.days[1].places).toEqual([]);
    expect(JSON.stringify(c)).not.toMatch(/member|amount|confirmation|krw/i);
  });
  it('ranks top places by average, then review count, then name', () => {
    const places = [
      { id: 'a', name: '가' },
      { id: 'b', name: '나' },
      { id: 'c', name: '다' },
      { id: 'd', name: '라' },
    ];
    const rv = [
      { place_id: 'a', rating: 4 },
      { place_id: 'b', rating: 5 },
      { place_id: 'c', rating: 5 },
      { place_id: 'c', rating: 5 },
    ];
    expect(topRated(places, rv, 3).map((t) => t.place.id)).toEqual(['c', 'b', 'a']);
  });
  it('shows only schema-valid recaps and the prompt forbids private data', async () => {
    const raw = await createFakeClient().call({ system: '', user: '', jsonSchema: RECAP_JSON_SCHEMA }, 'x');
    const ok = JSON.parse(raw);
    expect(RecapResult.safeParse(ok).success).toBe(true);
    expect(parseRecap(ok)?.title).toBe('테스트 여행 회고');
    expect(parseRecap({ ...ok, highlights: ['only one'] })).toBeNull();
    expect(parseRecap(null)).toBeNull();
    expect(RECAP_SYSTEM).toContain('개인정보');
    expect(RECAP_JSON_SCHEMA.required.sort()).toEqual(Object.keys(RecapResult.shape).sort());
  });
});

describe('shared trip payload', () => {
  const base = {
    title: 'T',
    startDate: '2026-10-09',
    endDate: '2026-10-12',
    destinations: [{ countryCode: 'JP', city: '도쿄', lat: null, lng: null }],
    places: [
      {
        dayIndex: 0,
        startTime: '09:00:00',
        endTime: '10:00:00',
        name: 'A',
        category: 'food',
        address: null,
        lat: null,
        lng: null,
        note: null,
      },
    ],
    recap: null,
  };
  it('parses the RPC shape and ignores a broken recap instead of failing the page', () => {
    expect(SharedTrip.safeParse(base).success).toBe(true);
    const broken = SharedTrip.parse({ ...base, recap: { title: 1 } });
    expect(broken.recap).toBeNull();
  });
  it('rejects a payload missing the schedule', () => {
    expect(SharedTrip.safeParse({ title: 'T' }).success).toBe(false);
  });
  it('builds the view link', () => {
    expect(viewUrl('https://app.example/', 'tok')).toBe('https://app.example/v/tok');
  });
});
