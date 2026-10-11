import type { LatLng } from '@/lib/geo';
import type { PlaceCategory } from '@/types/domain';

/** A place choice returned by a provider. Coordinates are optional: manual entry may not have them. */
export interface PlaceCandidate {
  /** Provider-scoped id (Google place id for the Google provider). */
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  category?: PlaceCategory;
  googlePlaceId?: string;
}

export interface SearchOptions {
  near?: LatLng;
  signal?: AbortSignal;
}

/**
 * Place lookup behind one seam. The UI only talks to this interface, so adding Google Places later
 * means writing one more implementation and returning it from `getPlacesProvider`.
 */
export interface PlacesProvider {
  readonly id: 'manual' | 'google';
  /** Candidates for what the user typed. */
  search(query: string, opts?: SearchOptions): Promise<PlaceCandidate[]>;
  /** Full details for a candidate id, or null when unknown. */
  details(id: string): Promise<PlaceCandidate | null>;
  /** Coordinates for a candidate id, or null when the provider cannot resolve them. */
  coords(id: string): Promise<LatLng | null>;
}

const MANUAL_PREFIX = 'manual:';

/** No external service: the typed text itself is the only candidate, and nothing can be geocoded. */
export const manualPlacesProvider: PlacesProvider = {
  id: 'manual',
  async search(query) {
    const name = query.trim();
    return name ? [{ id: MANUAL_PREFIX + name, name }] : [];
  },
  async details(id) {
    return id.startsWith(MANUAL_PREFIX) ? { id, name: id.slice(MANUAL_PREFIX.length) } : null;
  },
  async coords() {
    return null;
  },
};

/** Swap point: return the Google implementation here once a browser key exists. */
export function getPlacesProvider(): PlacesProvider {
  return manualPlacesProvider;
}
