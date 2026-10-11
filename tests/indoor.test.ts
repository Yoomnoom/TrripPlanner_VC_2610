import { describe, expect, it } from 'vitest';
import { asAlternatives, isOutdoor, swapPatch } from '@/lib/indoor';

describe('isOutdoor', () => {
  it('flags explicit outdoor, unknown outdoor-ish categories, never indoor or ideas', () => {
    expect(isOutdoor({ day_index: 0, is_indoor: false, category: 'food' })).toBe(true);
    expect(isOutdoor({ day_index: 0, is_indoor: null, category: 'sightseeing' })).toBe(true);
    expect(isOutdoor({ day_index: 0, is_indoor: null, category: 'activity' })).toBe(true);
    expect(isOutdoor({ day_index: 0, is_indoor: null, category: 'food' })).toBe(false);
    expect(isOutdoor({ day_index: 0, is_indoor: true, category: 'sightseeing' })).toBe(false);
    expect(isOutdoor({ day_index: null, is_indoor: false, category: 'sightseeing' })).toBe(false);
  });
});

describe('alternatives', () => {
  const alt = {
    name: '박물관',
    category: 'sightseeing',
    searchQuery: 'q',
    reason: '비를 피해요',
    resolved: true,
    googlePlaceId: 'g',
    address: 'a',
    lat: 1,
    lng: 2,
  };
  it('parses defensively', () => {
    expect(asAlternatives({ alternatives: [alt, { bad: 1 }] })).toEqual([alt]);
    expect(asAlternatives(null)).toEqual([]);
    expect(asAlternatives({ alternatives: 'x' })).toEqual([]);
  });
  it('builds the swap patch marking the place indoor and keeping the reason as the note', () => {
    expect(swapPatch(alt)).toEqual({
      name: '박물관',
      category: 'sightseeing',
      google_place_id: 'g',
      address: 'a',
      lat: 1,
      lng: 2,
      is_indoor: true,
      note: '비를 피해요',
    });
  });
});
