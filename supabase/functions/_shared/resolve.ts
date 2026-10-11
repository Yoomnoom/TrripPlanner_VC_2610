import { fakeCoords } from './ai/fake.ts';
import {
  buildTextSearchBody,
  parseTextSearch,
  PLACES_FIELD_MASK,
  PLACES_TEXT_URL,
  type Center,
  type ResolvedPlace,
} from './places.ts';

const DEFAULT_CENTER: Center = { lat: 35.6812, lng: 139.7671 }; // only for the fake resolver when a trip has no coordinates

/**
 * Turns "상호명 + 지역" into a real place via Places Text Search (server key). With AI_FAKE=1 it returns
 * deterministic coordinates instead; without a key it returns null (the item stays name-only).
 */
export function makeResolver(center: Center | null, fake: boolean) {
  const serverKey = Deno.env.get('GOOGLE_SERVER_KEY');
  return async (query: string): Promise<ResolvedPlace | null> => {
    if (fake) {
      const c = fakeCoords(query, center ?? DEFAULT_CENTER);
      return { googlePlaceId: `fake:${query}`, address: null, lat: c.lat, lng: c.lng };
    }
    if (!serverKey) return null;
    try {
      const res = await fetch(PLACES_TEXT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': serverKey,
          'X-Goog-FieldMask': PLACES_FIELD_MASK,
        },
        body: JSON.stringify(buildTextSearchBody(query, center)),
        signal: AbortSignal.timeout(15_000),
      });
      return res.ok ? parseTextSearch(await res.json()) : null;
    } catch {
      return null;
    }
  };
}
