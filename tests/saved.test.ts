import { describe, expect, it } from 'vitest';
import { groupSaved, notInIdeas, savedKey } from '@/lib/saved';

const s = (id: string, name: string, country: string | null, city: string | null, category = 'food') => ({
  id,
  google_place_id: `g-${id}`,
  name,
  category,
  country_code: country,
  city,
});

describe('saved places', () => {
  it('builds a stable key, normalizing manual names', () => {
    expect(savedKey({ google_place_id: 'ChIJ1', name: 'A' })).toBe('ChIJ1');
    expect(savedKey({ google_place_id: null, name: ' 이치란  라멘 ' })).toBe('manual:이치란라멘');
    expect(savedKey({ name: 'Ichiran Ramen' })).toBe(savedKey({ name: 'ichiran ramen' }));
  });
  it('groups by country and city with the unknown location last, and filters by category', () => {
    const list = [
      s('1', 'a', null, null),
      s('2', 'b', 'JP', '오사카'),
      s('3', 'c', 'JP', '도쿄', 'cafe'),
      s('4', 'd', 'FR', '파리'),
    ];
    const g = groupSaved(list);
    expect(g.map((x) => `${x.country}/${x.city}`)).toEqual(['FR/파리', 'JP/도쿄', 'JP/오사카', 'null/null']);
    expect(groupSaved(list, 'cafe').map((x) => x.items.map((i) => i.id))).toEqual([['3']]);
  });
  it('finds saved places that are not already ideas', () => {
    const saved = [s('1', '이치란 라멘', 'JP', '도쿄'), s('2', '센소지', 'JP', '도쿄')];
    expect(notInIdeas(saved, ['이치란라멘']).map((x) => x.id)).toEqual(['2']);
  });
});
