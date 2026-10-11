import { describe, expect, it } from 'vitest';
import {
  buildComputeRoutesBody,
  parseComputeRoutesResponse,
  parseDurationSeconds,
  parseLegRequest,
} from '../supabase/functions/_shared/routes';
import { corsHeaders } from '../supabase/functions/_shared/http';
import { boundsOf, buildPaths, buildPins, dayColor, directionsUrl } from '@/lib/mapdata';
import { decodePolyline } from '@/lib/polyline';

const a = { lat: 35.68, lng: 139.76 };
const b = { lat: 35.66, lng: 139.7 };

describe('routes-leg request/response', () => {
  it('validates the request', () => {
    expect(parseLegRequest({ from: a, to: b, mode: 'walk' })).toEqual({ from: a, to: b, mode: 'walk' });
    expect(parseLegRequest({ from: a, to: b, mode: 'fly' })).toBeNull();
    expect(parseLegRequest({ from: { lat: 200, lng: 0 }, to: b, mode: 'walk' })).toBeNull();
    expect(parseLegRequest(null)).toBeNull();
  });
  it('builds the computeRoutes body', () => {
    expect(buildComputeRoutesBody(a, b, 'transit')).toMatchObject({
      travelMode: 'TRANSIT',
      origin: { location: { latLng: { latitude: 35.68, longitude: 139.76 } } },
    });
  });
  it('parses duration strings', () => {
    expect(parseDurationSeconds('1380s')).toBe(1380);
    expect(parseDurationSeconds('12.6s')).toBe(13);
    expect(parseDurationSeconds('abc')).toBeNull();
  });
  it('parses a route, and returns null when empty or incomplete (Korea walk/drive)', () => {
    expect(
      parseComputeRoutesResponse({
        routes: [{ duration: '600s', distanceMeters: 1234, polyline: { encodedPolyline: '_p~iF~ps|U' } }],
      }),
    ).toEqual({ durationS: 600, distanceM: 1234, polyline: '_p~iF~ps|U' });
    expect(parseComputeRoutesResponse({})).toBeNull();
    expect(parseComputeRoutesResponse({ routes: [] })).toBeNull();
    expect(parseComputeRoutesResponse({ routes: [{ duration: '5s' }] })).toBeNull();
  });
});

describe('cors', () => {
  it('allows listed and local origins only', () => {
    expect(corsHeaders('http://localhost:5173', undefined)['Access-Control-Allow-Origin']).toBe(
      'http://localhost:5173',
    );
    expect(corsHeaders('https://a.app', 'https://a.app/')['Access-Control-Allow-Origin']).toBe(
      'https://a.app',
    );
    expect(corsHeaders('https://evil.app', 'https://a.app')['Access-Control-Allow-Origin']).toBe(
      'https://a.app',
    );
  });
});

describe('polyline + map data', () => {
  it('decodes the canonical example', () => {
    const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ lat: 38.5, lng: -120.2 });
    expect(pts[2].lat).toBeCloseTo(43.252, 3);
  });
  const days = [
    [
      { id: 'a', name: 'A', lat: 1, lng: 1 },
      { id: 'x', name: 'X', lat: null, lng: null },
      { id: 'b', name: 'B', lat: 2, lng: 2, leg_from_place_id: 'a', leg_polyline: '_p~iF~ps|U_ulLnnqC' },
    ],
    [
      { id: 'c', name: 'C', lat: 3, lng: 3 },
      { id: 'd', name: 'D', lat: 4, lng: 4, leg_from_place_id: 'zzz', leg_polyline: '_p~iF~ps|U' },
    ],
  ];
  it('numbers pins per day, skipping places without coordinates, and filters by day', () => {
    expect(buildPins(days, null).map((p) => `${p.day}:${p.order}`)).toEqual(['0:1', '0:2', '1:1', '1:2']);
    expect(buildPins(days, 1).map((p) => p.id)).toEqual(['c', 'd']);
  });
  it('uses the real polyline only for the exact previous place, else a straight line', () => {
    const paths = buildPaths(days, null);
    expect(paths).toHaveLength(2);
    expect(paths[0].straight).toBe(false);
    expect(paths[1].straight).toBe(true);
    expect(paths[1].path).toEqual([
      { lat: 3, lng: 3 },
      { lat: 4, lng: 4 },
    ]);
  });
  it('computes bounds and colors', () => {
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([a, b])).toEqual({ south: 35.66, north: 35.68, west: 139.7, east: 139.76 });
    expect(dayColor(0)).toBe(dayColor(8));
  });
  it('builds a directions deep link', () => {
    expect(directionsUrl(a)).toBe('https://www.google.com/maps/dir/?api=1&destination=35.68,139.76');
  });
});
