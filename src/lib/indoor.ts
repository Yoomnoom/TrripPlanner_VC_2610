/** Categories that are normally outdoors; used when `is_indoor` was not set. */
const OUTDOOR_CATEGORIES = new Set(['sightseeing', 'activity']);

/**
 * Whether a place gets the "indoor alternative" chip: an explicit `is_indoor=false` always does, an unknown
 * (`null`) one does only for typically outdoor categories, and `true` never does. Ideas (no day) are skipped.
 */
export function isOutdoor(p: { day_index: number | null; is_indoor: boolean | null; category: string }) {
  if (p.day_index === null || p.is_indoor === true) return false;
  return p.is_indoor === false || OUTDOOR_CATEGORIES.has(p.category);
}

export interface IndoorAlternative {
  name: string;
  category: string;
  searchQuery: string;
  reason: string;
  resolved: boolean;
  googlePlaceId: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

/** Defensive parse of the ai-indoor-swap answer. */
export function asAlternatives(v: unknown): IndoorAlternative[] {
  const list = (v as { alternatives?: unknown } | null)?.alternatives;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (a): a is IndoorAlternative =>
      !!a && typeof a.name === 'string' && typeof a.category === 'string' && typeof a.reason === 'string',
  );
}

/** Columns to write when swapping a place for an alternative (the schedule slot stays the same). */
export function swapPatch(alt: IndoorAlternative) {
  return {
    name: alt.name,
    category: alt.category,
    google_place_id: alt.googlePlaceId,
    address: alt.address,
    lat: alt.lat,
    lng: alt.lng,
    is_indoor: true,
    note: alt.reason,
  };
}
