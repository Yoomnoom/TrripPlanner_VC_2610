import { geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { NUMERIC_TO_ALPHA2 } from '@/data/countryNumeric';

let centroids: Promise<Map<string, [number, number]>> | null = null;

/** alpha-2 → [lng, lat] centroid, computed once from the bundled TopoJSON (used to move the map on search). */
export function loadCountryCentroids(): Promise<Map<string, [number, number]>> {
  centroids ??= fetch('/geo/countries-110m.json')
    .then((r) => r.json() as Promise<Topology>)
    .then((topo) => {
      const fc = feature(topo, topo.objects.countries as GeometryCollection);
      const map = new Map<string, [number, number]>();
      for (const f of fc.features) {
        const code = NUMERIC_TO_ALPHA2[String(f.id)];
        if (code) map.set(code, geoCentroid(f) as [number, number]);
      }
      return map;
    })
    .catch((e: unknown) => {
      centroids = null; // allow a retry
      throw e;
    });
  return centroids;
}

export interface Municipality {
  code: string;
  name: string;
}

/** Korean name of a country from the browser's ICU data (no name table to maintain). */
export function countryName(alpha2: string, locale = 'ko'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(alpha2) ?? alpha2;
  } catch {
    return alpha2;
  }
}

let regionNames: Promise<Map<string, string>> | null = null;

/** 5-digit 시·군·구 code → name, from the bundled KOSTAT TopoJSON (for the wish list). */
export function loadRegionNames(): Promise<Map<string, string>> {
  regionNames ??= fetch('/geo/kr-municipalities.json')
    .then((r) => r.json() as Promise<Topology>)
    .then((topo) => {
      const obj = Object.values(topo.objects)[0] as GeometryCollection<{ code: string; name: string }>;
      return new Map(
        obj.geometries.map((g) => {
          const p = g.properties as { code: string; name: string };
          return [String(p.code), String(p.name)] as const;
        }),
      );
    })
    .catch((e: unknown) => {
      regionNames = null;
      throw e;
    });
  return regionNames;
}
