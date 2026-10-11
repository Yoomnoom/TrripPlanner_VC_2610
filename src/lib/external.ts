const enc = (s: string) => encodeURIComponent(s.trim());

/** Deep links to look a place up elsewhere (no API key, opened in a new tab). */
export const googleMapsSearchUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${enc(query)}`;
export const naverMapSearchUrl = (query: string) => `https://map.naver.com/p/search/${enc(query)}`;
export const kakaoMapSearchUrl = (query: string) => `https://map.kakao.com/?q=${enc(query)}`;

export const externalLinks = (query: string) => [
  { id: 'google', label: 'Google 지도', url: googleMapsSearchUrl(query) },
  { id: 'naver', label: '네이버 지도', url: naverMapSearchUrl(query) },
  { id: 'kakao', label: '카카오맵', url: kakaoMapSearchUrl(query) },
];
