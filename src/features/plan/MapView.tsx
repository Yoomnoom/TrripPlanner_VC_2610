import { useEffect, useMemo, useRef, useState } from 'react';
import { AdvancedMarker, APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { Expand, LocateFixed, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { googleEnv } from '@/lib/env';
import { boundsOf, buildPaths, buildPins, dayColor, directionsUrl, type Pin } from '@/lib/mapdata';
import { hm } from '@/lib/plan';
import type { Place } from './api';

/** Google map view (UNVERIFIED without a key: see docs/HUMAN_TODO.md). Only rendered when a browser key exists. */
export default function MapView({ days }: { days: Place[][] }) {
  const [filter, setFilter] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [me, setMe] = useState<google.maps.LatLngLiteral | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const pins = useMemo(() => buildPins(days, filter), [days, filter]);
  const paths = useMemo(() => buildPaths(days, filter), [days, filter]);
  const picked = pins.find((p) => p.id === selected) ?? null;
  const placeById = useMemo(() => new window.Map(days.flat().map((p) => [p.id, p])), [days]);

  const locate = () => {
    if (!navigator.geolocation) return void toast.error(copy.map.locateFailed);
    navigator.geolocation.getCurrentPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast.error(copy.map.locateDenied),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.current?.requestFullscreen?.().catch(() => toast.error(copy.map.fullscreenFailed));
  };

  return (
    <div ref={box} className="relative overflow-hidden rounded-card bg-surface shadow-card">
      <div className="flex gap-1.5 overflow-x-auto p-2" role="group" aria-label={copy.map.dayFilter}>
        {[null, ...days.map((_, i) => i)].map((d) => (
          <button
            key={d ?? 'all'}
            type="button"
            aria-pressed={filter === d}
            onClick={() => setFilter(d)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${filter === d ? 'border-ink bg-ink text-white' : 'border-line'}`}
          >
            {d !== null && (
              <span
                aria-hidden
                className="mr-1.5 inline-block size-2.5 rounded-full"
                style={{ backgroundColor: dayColor(d) }}
              />
            )}
            {d === null ? copy.map.all : copy.plan.dayTitle(d + 1)}
          </button>
        ))}
      </div>

      <div className="relative h-[60vh] min-h-80">
        <APIProvider apiKey={googleEnv.browserKey!} language="ko">
          <Map
            mapId={googleEnv.mapId ?? 'DEMO_MAP_ID'}
            defaultCenter={{ lat: 37.5665, lng: 126.978 }}
            defaultZoom={11}
            gestureHandling="greedy"
            disableDefaultUI
            onClick={() => setSelected(null)}
          >
            <Fit points={[...pins, ...(me ? [me] : [])]} />
            {paths.map((p, i) => (
              <Line key={i} path={p.path} color={dayColor(p.day)} dashed={p.straight} />
            ))}
            {pins.map((p) => (
              <AdvancedMarker key={p.id} position={p} onClick={() => setSelected(p.id)} title={p.name}>
                <PinDot pin={p} active={p.id === selected} />
              </AdvancedMarker>
            ))}
            {me && (
              <AdvancedMarker position={me} title={copy.map.me}>
                <span className="block size-4 rounded-full border-2 border-white bg-blue-600 shadow" />
              </AdvancedMarker>
            )}
          </Map>
        </APIProvider>

        <div className="absolute right-2 top-2 grid gap-2">
          <MapButton label={copy.map.locate} onClick={locate}>
            <LocateFixed className="size-5" aria-hidden />
          </MapButton>
          <MapButton label={copy.map.fullscreen} onClick={fullscreen}>
            <Maximize2 className="size-5" aria-hidden />
          </MapButton>
          <FitButton points={[...pins, ...(me ? [me] : [])]} />
        </div>

        {picked && (
          <div className="absolute inset-x-2 bottom-2 rounded-input bg-surface p-3 shadow-card">
            <p className="font-bold">
              {picked.order}. {picked.name}
            </p>
            <p className="tabular text-sm text-muted">
              {hm(placeById.get(picked.id)?.start_time)} – {hm(placeById.get(picked.id)?.end_time)}
            </p>
            <a
              href={directionsUrl(picked)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-11 items-center rounded-full bg-hero px-4 text-sm font-semibold text-white"
            >
              {copy.map.directions}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function PinDot({ pin, active }: { pin: Pin; active: boolean }) {
  return (
    <span
      style={{ backgroundColor: dayColor(pin.day) }}
      className={`grid place-items-center rounded-full border-2 border-white font-bold text-white shadow ${active ? 'size-10 text-base' : 'size-8 text-sm'}`}
    >
      {pin.order}
    </span>
  );
}

function MapButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full bg-surface shadow-card"
    >
      {children}
    </button>
  );
}

/** Fits the viewport to the points whenever the set of points changes. */
function Fit({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat},${p.lng}`).join('|');
  useEffect(() => {
    if (map) fitTo(map, points);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the points' identity
  }, [map, key]);
  return null;
}

function FitButton({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  return (
    <MapButton label={copy.map.fitAll} onClick={() => map && fitTo(map, points)}>
      <Expand className="size-5" aria-hidden />
    </MapButton>
  );
}

function fitTo(map: google.maps.Map, points: { lat: number; lng: number }[]) {
  const b = boundsOf(points);
  if (!b) return;
  if (points.length === 1) {
    map.setCenter(points[0]);
    map.setZoom(15);
  } else map.fitBounds(b, 48);
}

/** Polyline drawn imperatively (the library has no polyline component). Straight estimates are dashed. */
function Line({
  path,
  color,
  dashed,
}: {
  path: google.maps.LatLngLiteral[];
  color: string;
  dashed: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const line = new google.maps.Polyline({
      path,
      map,
      strokeColor: color,
      strokeOpacity: dashed ? 0 : 0.9,
      strokeWeight: 4,
      icons: dashed
        ? [
            {
              icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeColor: color, scale: 3 },
              offset: '0',
              repeat: '14px',
            },
          ]
        : undefined,
    });
    return () => line.setMap(null);
  }, [map, path, color, dashed]);
  return null;
}
