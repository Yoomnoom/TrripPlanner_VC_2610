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

export type DirectionsMode = 'walk' | 'transit' | 'drive';
const TRAVEL_MODE: Record<DirectionsMode, string> = { walk: 'walking', transit: 'transit', drive: 'driving' };

/** Opens the maps app with directions to a place (SPEC F-3-4). The place id is skipped for non-Google ids. */
export function directionsLink(
  to: { lat: number; lng: number; googlePlaceId?: string | null },
  mode: DirectionsMode = 'walk',
) {
  const id =
    to.googlePlaceId && !to.googlePlaceId.startsWith('fake:')
      ? `&destination_place_id=${encodeURIComponent(to.googlePlaceId)}`
      : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}${id}&travelmode=${TRAVEL_MODE[mode]}`;
}

/** "Find nearby": a Google Maps search centered on a point. */
export const nearbyLink = (query: string, at: { lat: number; lng: number }) =>
  `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${at.lat},${at.lng},16z`;

/** Read-only share link: `https://{host}/v/{token}`. */
export const viewUrl = (origin: string, token: string) => `${origin.replace(/\/$/, '')}/v/${token}`;
