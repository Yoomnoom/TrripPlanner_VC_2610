import { estimateLeg, type LatLng } from '@/lib/geo';
import type { TravelMode } from '@/types/domain';

export interface Leg {
  durationS: number;
  distanceM: number;
  /** Encoded polyline when the provider has a real route. */
  polyline?: string;
  /** True for straight-line estimates (shown with a ~ prefix). */
  estimated: boolean;
}

/**
 * Travel time/distance between two points. Implementations may throw or return null when they have
 * no route; callers fall back to `estimateRoutesProvider` (see `getLeg`).
 */
export interface RoutesProvider {
  readonly id: 'estimate' | 'google';
  getLeg(from: LatLng, to: LatLng, mode: TravelMode, signal?: AbortSignal): Promise<Leg | null>;
}

/** Straight-line distance x1.3 and per-mode speed (src/lib/geo.ts). Needs no key or network. */
export const estimateRoutesProvider: RoutesProvider = {
  id: 'estimate',
  async getLeg(from, to, mode) {
    const { distanceM, durationS } = estimateLeg(from, to, mode);
    return { distanceM, durationS, estimated: true };
  },
};

/** Swap point: return a Google (Edge Function `routes-leg`) provider here, wrapped by `withFallback`. */
export function getRoutesProvider(): RoutesProvider {
  return estimateRoutesProvider;
}

/** Primary provider first; any failure or empty answer falls back to the estimate. */
export function withFallback(
  primary: RoutesProvider,
  fallback: RoutesProvider = estimateRoutesProvider,
): RoutesProvider {
  return {
    id: primary.id,
    async getLeg(from, to, mode, signal) {
      try {
        const leg = await primary.getLeg(from, to, mode, signal);
        if (leg) return leg;
      } catch {
        // route lookup failed (quota, unsupported region, network): use the estimate
      }
      return fallback.getLeg(from, to, mode, signal);
    },
  };
}
