import { Link } from 'react-router-dom';
import { Plus, Plane, Settings, Globe2, Heart } from 'lucide-react';
import { copy } from '@/copy';
import { ErrorState, Skeleton } from '@/components/ui-kit';
import { btn } from '@/components/styles';
import { formatDuration, formatRange, todayYmd, tripPhase } from '@/lib/trip';
import { useMyTrips } from './api';

export function HomePage() {
  const { data, isPending, isError, refetch } = useMyTrips();
  const today = todayYmd();

  return (
    <main id="main" className="mx-auto max-w-xl p-4 pb-24">
      <header className="flex items-center justify-between py-2">
        <h1 className="text-2xl font-bold">{copy.list.title}</h1>
        <nav className="flex gap-1">
          <Link
            to="/footprints"
            aria-label={copy.list.footprints}
            className="grid size-11 place-items-center rounded-full hover:bg-surface"
          >
            <Globe2 className="size-5" aria-hidden />
          </Link>
          <Link
            to="/saved"
            aria-label={copy.saved.title}
            className="grid size-11 place-items-center rounded-full hover:bg-surface"
          >
            <Heart className="size-5" aria-hidden />
          </Link>
          <Link
            to="/settings"
            aria-label={copy.list.settings}
            className="grid size-11 place-items-center rounded-full hover:bg-surface"
          >
            <Settings className="size-5" aria-hidden />
          </Link>
        </nav>
      </header>

      {isPending && (
        <div className="mt-3 grid gap-3" aria-busy>
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}
      {isError && (
        <ErrorState
          message={copy.common.loadFailed}
          onRetry={() => void refetch()}
          retryLabel={copy.common.retry}
        />
      )}

      {data?.length === 0 && (
        <div className="mt-10 grid place-items-center gap-2 text-center">
          <Plane className="size-10 text-muted" aria-hidden />
          <p className="font-semibold">{copy.list.empty}</p>
          <p className="text-sm text-muted">{copy.list.emptyHint}</p>
          <Link to="/new" className={`${btn.primary} mt-2`}>
            {copy.list.newTrip}
          </Link>
        </div>
      )}

      <ul className="mt-3 grid gap-3">
        {data?.map(({ trip, memberCount }) => {
          const phase = tripPhase(trip.start_date, trip.end_date, today);
          const badge =
            phase.kind === 'before'
              ? copy.tripHome.dBefore(phase.daysLeft)
              : phase.kind === 'during'
                ? copy.tripHome.dDuring(phase.day, phase.total)
                : copy.tripHome.dAfter;
          return (
            <li key={trip.id}>
              <Link
                to={`/t/${trip.id}`}
                className="flex min-h-11 items-center gap-3 rounded-card bg-surface p-4 shadow-card"
              >
                <span aria-hidden className="text-3xl">
                  {trip.cover_emoji ?? '✈️'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{trip.title}</span>
                  <span className="block text-sm text-muted">
                    {formatRange(trip.start_date, trip.end_date)} ·{' '}
                    {formatDuration(trip.start_date, trip.end_date)} · {copy.common.people(memberCount)}
                  </span>
                </span>
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
                  {badge}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {data && data.length > 0 && (
        <Link to="/new" className={`${btn.dark} fixed bottom-6 left-1/2 -translate-x-1/2 shadow-card`}>
          <Plus className="size-5" aria-hidden />
          {copy.list.newTrip}
        </Link>
      )}
    </main>
  );
}
