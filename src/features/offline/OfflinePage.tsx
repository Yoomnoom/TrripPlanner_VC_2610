import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { copy } from '@/copy';
import { btn } from '@/components/styles';
import { Skeleton } from '@/components/ui-kit';
import { DriverCard } from '@/features/home/DriverCard';
import type { TripContext } from '@/features/trips/TripLayout';
import { directionsLink } from '@/lib/external';
import { nameForDriver, type OfflineCard } from '@/lib/offline';
import { formatMd } from '@/lib/trip';
import { loadCards } from './prepare';

/** Offline stand-in for the map: stored places with coordinates, directions and the driver card. Works without a network. */
export function OfflinePage() {
  const { trip } = useOutletContext<TripContext>();
  const cards = useQuery({
    queryKey: ['offline-cards', trip.id],
    queryFn: () => loadCards(trip.id),
    networkMode: 'always',
    staleTime: 0,
  });
  const [driver, setDriver] = useState<OfflineCard | null>(null);

  const savedAt = cards.data?.[0]?.savedAt;

  return (
    <div className="p-4 pb-24">
      <h1 className="py-2 text-xl font-bold">{copy.offline.title}</h1>
      <p className="text-sm text-muted">{copy.offline.mapNote}</p>
      {savedAt && (
        <p className="mt-1 text-xs text-muted">{copy.offline.savedAt(formatMd(savedAt.slice(0, 10)))}</p>
      )}

      {cards.isPending && <Skeleton className="mt-3 h-24" />}
      {cards.data?.length === 0 && <p className="py-10 text-center text-muted">{copy.offline.empty}</p>}

      <ul className="mt-3 grid gap-2">
        {cards.data?.map((c) => (
          <li key={c.id} className="rounded-card bg-surface p-3 shadow-card">
            <p className="font-bold">{c.localName ?? c.name}</p>
            {c.localName && c.localName !== c.name && <p className="text-sm text-muted">{c.name}</p>}
            {(c.localAddress ?? c.address) && <p className="text-sm">{c.localAddress ?? c.address}</p>}
            {c.lat !== null && c.lng !== null && (
              <p className="tabular text-xs text-muted">
                {copy.offline.coords} {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {c.lat !== null && c.lng !== null && (
                <a
                  className={btn.dark}
                  href={directionsLink({ lat: c.lat, lng: c.lng })}
                  target="_blank"
                  rel="noreferrer"
                >
                  {copy.offline.directions}
                </a>
              )}
              <button type="button" className={btn.ghost} onClick={() => setDriver(c)}>
                {copy.offline.driver}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <DriverCard place={driver ? nameForDriver(driver, driver) : null} onClose={() => setDriver(null)} />
    </div>
  );
}
