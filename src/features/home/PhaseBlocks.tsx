import { Link } from 'react-router-dom';
import { Car, Footprints, TramFront } from 'lucide-react';
import { copy } from '@/copy';
import { btn } from '@/components/styles';
import { describeCode, type DayWeather } from '@/lib/weather';
import { directionsLink, nearbyLink, type DirectionsMode } from '@/lib/external';
import { hm, legLabel, sortDay } from '@/lib/plan';
import { untilLabel, type NextPlace } from '@/lib/phase';
import { formatMdWeekday, dayYmd } from '@/lib/trip';
import type { Place } from '@/features/plan/api';
import type { Reservation } from '@/features/reservations/api';
import { formatWhen } from '@/lib/reservations';
import type { TravelMode } from '@/types/domain';

const ICON = { walk: Footprints, transit: TramFront, drive: Car } as const;
const NEARBY = ['식당', '카페', '편의점', '약국', 'ATM'] as const;

/** "Now": today's timeline, the next place with directions / driver card / nearby search, quick expense, FX link. */
export function DuringBlock({
  tripId,
  day,
  total,
  tripStart,
  todayPlaces,
  next,
  weather,
  onQuickExpense,
  onDriver,
}: {
  tripId: string;
  day: number;
  total: number;
  tripStart: string;
  todayPlaces: Place[];
  next: NextPlace<Place>;
  weather: DayWeather | null | undefined;
  onQuickExpense: () => void;
  onDriver: (p: Place) => void;
}) {
  const list = sortDay(todayPlaces);
  const target = next.kind === 'next' ? next.place : null;
  const mode = ((target?.leg_mode as TravelMode | null) ?? 'walk') as DirectionsMode;
  const Icon = ICON[mode];
  const hasCoord = target && target.lat !== null && target.lng !== null;
  const w = weather ? describeCode(weather.code) : null;

  return (
    <section className="mt-3 grid gap-3" aria-label={copy.home.now}>
      <div className="rounded-card bg-surface p-4 shadow-card">
        <div className="flex items-center gap-2">
          <h2 className="font-bold">
            {copy.home.today(day, total)}{' '}
            <span className="text-sm font-normal text-muted">
              {formatMdWeekday(dayYmd(tripStart, day - 1))}
            </span>
          </h2>
          {w && weather && (
            <span className="tabular ml-auto rounded-full bg-bg px-2 py-0.5 text-xs font-semibold text-muted">
              <span aria-hidden>{w.icon}</span>
              <span className="sr-only">{w.label}</span>{' '}
              {weather.maxC !== null ? `${Math.round(weather.maxC)}°` : '–'}/
              {weather.minC !== null ? `${Math.round(weather.minC)}°` : '–'}
            </span>
          )}
        </div>

        {next.kind === 'next' ? (
          <div className="mt-3 rounded-input border border-primary/30 bg-primary-soft p-3">
            <p className="text-xs font-bold text-primary">
              {copy.home.next} · {untilLabel(next.minutesUntil)}
            </p>
            <p className="mt-0.5 text-lg font-extrabold">{next.place.name}</p>
            <p className="tabular text-sm text-muted">
              {hm(next.place.start_time)} – {hm(next.place.end_time)}
              {next.place.leg_duration_s !== null && next.place.leg_distance_m !== null && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Icon className="size-3.5" aria-hidden />
                  {legLabel(next.place.leg_duration_s, next.place.leg_distance_m, next.place.leg_estimated)}
                </span>
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {hasCoord && (
                <a
                  className={btn.dark}
                  href={directionsLink(
                    { lat: next.place.lat!, lng: next.place.lng!, googlePlaceId: next.place.google_place_id },
                    mode,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  {copy.home.directions}
                </a>
              )}
              <button type="button" className={btn.ghost} onClick={() => onDriver(next.place)}>
                {copy.home.driver}
              </button>
            </div>
            {hasCoord && (
              <div className="mt-2 flex gap-1.5 overflow-x-auto" role="group" aria-label={copy.home.nearby}>
                {NEARBY.map((q) => (
                  <a
                    key={q}
                    href={nearbyLink(q, { lat: next.place.lat!, lng: next.place.lng! })}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line bg-surface px-3 text-sm font-semibold"
                  >
                    {q}
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-input bg-bg p-3">
            <p className="font-semibold">{copy.home.todayDone}</p>
            {next.tomorrowFirst && (
              <p className="mt-1 text-sm text-muted">
                {copy.home.tomorrowFirst(hm(next.tomorrowFirst.start_time) || '–', next.tomorrowFirst.name)}
              </p>
            )}
          </div>
        )}

        {list.length > 0 && (
          <ol className="mt-3 grid gap-1">
            {list.map((p) => {
              const isNext = target?.id === p.id;
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-input px-2 py-1.5 text-sm ${isNext ? 'bg-primary-soft font-bold' : ''}`}
                >
                  <span className="tabular w-12 shrink-0 text-muted">{hm(p.start_time) || '–'}</span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {isNext && <span className="text-xs text-primary">{copy.home.next}</span>}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" className={`${btn.primary} min-h-14`} onClick={onQuickExpense}>
          {copy.quick.fab}
        </button>
        <Link to={`/t/${tripId}/info`} className={`${btn.ghost} min-h-14`}>
          {copy.home.fxLink}
        </Link>
      </div>
    </section>
  );
}

/** Before departure: the soonest reservations (flights, hotels, restaurants). */
export function UpcomingReservations({ tripId, items }: { tripId: string; items: Reservation[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-3 rounded-card bg-surface p-4 shadow-card" aria-label={copy.home.upcoming}>
      <h2 className="text-sm font-bold">{copy.home.upcoming}</h2>
      <ul className="mt-1 divide-y divide-line">
        {items.map((r) => (
          <li key={r.id}>
            <Link to={`/t/${tripId}/reservations`} className="flex min-h-12 items-center gap-2 py-1">
              <span className="min-w-0 flex-1 truncate font-semibold">{r.title}</span>
              <span className="tabular text-xs text-muted">{formatWhen(r.starts_at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** After the trip: unsettled money and the footprint suggestion. */
export function AfterBlock({
  tripId,
  unsettled,
  unreviewed,
}: {
  tripId: string;
  unsettled: number;
  unreviewed: number;
}) {
  return (
    <section className="mt-3 grid gap-2" aria-label={copy.home.after}>
      <Link
        to={`/t/${tripId}/recap`}
        className="rounded-card bg-hero p-4 font-semibold text-white shadow-card"
      >
        {copy.home.recap}
      </Link>
      {unreviewed > 0 && (
        <Link to={`/t/${tripId}/plan`} className="rounded-card bg-surface p-4 font-semibold shadow-card">
          {copy.home.unreviewed(unreviewed)}
        </Link>
      )}
      {unsettled > 0 && (
        <Link
          to={`/t/${tripId}/expenses?tab=settle`}
          className="rounded-card bg-amber-50 p-4 font-semibold text-amber-900 shadow-card"
        >
          {copy.home.unsettled(unsettled)}
        </Link>
      )}
      <Link
        to="/footprints"
        className="rounded-card bg-primary-soft p-4 font-semibold text-primary shadow-card"
      >
        {copy.home.footprintSuggest}
      </Link>
    </section>
  );
}
