// Google Places API (New) Text Search helpers. UNVERIFIED against the live API (docs/HUMAN_TODO.md).

export const PLACES_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
export const PLACES_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.types';

export interface Center {
  lat: number;
  lng: number;
}

export interface ResolvedPlace {
  googlePlaceId: string;
  address: string | null;
  lat: number;
  lng: number;
}

export function buildTextSearchBody(query: string, center: Center | null) {
  return {
    textQuery: query,
    languageCode: 'ko',
    ...(center
      ? {
          locationBias: {
            circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 30000 },
          },
        }
      : {}),
  };
}

/** First usable hit, or null (unresolved places stay name-only in the app). */
export function parseTextSearch(json: unknown): ResolvedPlace | null {
  const p = (json as { places?: unknown[] } | null)?.places?.[0] as
    | { id?: unknown; formattedAddress?: unknown; location?: { latitude?: unknown; longitude?: unknown } }
    | undefined;
  if (!p || typeof p.id !== 'string') return null;
  const lat = p.location?.latitude;
  const lng = p.location?.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return {
    googlePlaceId: p.id,
    address: typeof p.formattedAddress === 'string' ? p.formattedAddress : null,
    lat,
    lng,
  };
}

/** Runs `fn` over `items` with at most `limit` in flight, keeping result order. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (t: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
