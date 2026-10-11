import { describe, expect, it } from 'vitest';
import { asProposal, diffItinerary, proposalToRows, unresolvedCount, type Proposal } from '@/lib/itinerary';

const item = (name: string, s = '09:00', e = '10:00', extra = {}) => ({
  name,
  category: 'food',
  startTime: s,
  endTime: e,
  isIndoor: null,
  note: null,
  searchQuery: name,
  resolved: true,
  googlePlaceId: 'g',
  address: 'a',
  lat: 1,
  lng: 2,
  ...extra,
});
const proposal: Proposal = {
  days: [
    {
      dayIndex: 0,
      title: 'd1',
      items: [
        item('이치란 라멘', '12:00', '13:00'),
        item('시부야 스카이', '15:00', '16:00', {
          resolved: false,
          lat: null,
          lng: null,
          googlePlaceId: null,
        }),
      ],
    },
    { dayIndex: 1, title: 'd2', items: [item('센소지')] },
  ],
};

describe('asProposal', () => {
  it('accepts a well-formed proposal and rejects junk', () => {
    expect(asProposal(proposal)).toBe(proposal);
    expect(asProposal(null)).toBeNull();
    expect(asProposal({ days: 'x' })).toBeNull();
    expect(asProposal({ days: [{ dayIndex: 0, items: [{ name: 1 }] }] })).toBeNull();
  });
});

describe('diffItinerary', () => {
  it('reports added, removed, changed and unchanged by name', () => {
    const current = [
      { day_index: 0, name: '이치란라멘', start_time: '12:00:00', end_time: '13:00:00' }, // same (spaces ignored)
      { day_index: 0, name: '센소지', start_time: '09:00:00', end_time: '10:00:00' }, // moved to day 2
      { day_index: 0, name: '옛 장소', start_time: '18:00:00', end_time: '19:00:00' }, // removed
      { day_index: null, name: '아이디어', start_time: null, end_time: null }, // ideas are ignored
    ];
    const d = diffItinerary(current, proposal);
    expect(d.unchanged).toBe(1);
    expect(d.added).toEqual([{ day: 0, name: '시부야 스카이' }]);
    expect(d.removed).toEqual([{ day: 0, name: '옛 장소' }]);
    expect(d.changed).toEqual([
      { day: 1, name: '센소지', from: 'Day 1 09:00–10:00', to: 'Day 2 09:00–10:00' },
    ]);
  });
  it('treats everything as added against an empty schedule', () => {
    expect(diffItinerary([], proposal).added).toHaveLength(3);
  });
});

describe('proposalToRows', () => {
  it('creates rows with positions, skips days outside the trip, and continues after existing places', () => {
    let n = 0;
    const rows = proposalToRows(proposal, 't1', 1, { 0: 5000 }, () => `id${++n}`);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => [r.id, r.position, r.source])).toEqual([
      ['id1', 6000, 'ai'],
      ['id2', 7000, 'ai'],
    ]);
    expect(rows[0]).toMatchObject({ trip_id: 't1', day_index: 0, start_time: '12:00', google_place_id: 'g' });
  });
  it('counts unresolved items', () => {
    expect(unresolvedCount(proposal)).toBe(1);
  });
});
