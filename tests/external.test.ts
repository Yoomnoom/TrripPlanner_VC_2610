import { describe, expect, it } from 'vitest';
import { externalLinks, googleMapsSearchUrl, naverMapSearchUrl } from '@/lib/external';

describe('external search links', () => {
  it('encodes the query (no raw spaces, ampersands or hashes)', () => {
    expect(googleMapsSearchUrl(' 이치란 라멘 & #1 ')).toBe(
      'https://www.google.com/maps/search/?api=1&query=%EC%9D%B4%EC%B9%98%EB%9E%80%20%EB%9D%BC%EB%A9%98%20%26%20%231',
    );
    expect(naverMapSearchUrl('a b')).toBe('https://map.naver.com/p/search/a%20b');
  });
  it('lists three providers over https', () => {
    const l = externalLinks('도쿄역');
    expect(l.map((x) => x.id)).toEqual(['google', 'naver', 'kakao']);
    expect(l.every((x) => x.url.startsWith('https://'))).toBe(true);
  });
});
