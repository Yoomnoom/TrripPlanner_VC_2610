import { useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CircleDollarSign, Home, MessageCircle, Menu } from 'lucide-react';
import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';
import { ErrorState, Skeleton } from '@/components/ui-kit';
import { btn } from '@/components/styles';
import { ensureSession } from '@/lib/supabase';
import { useTrip, useTripRealtime, type Trip } from './api';

export type TripContext = { trip: Trip; me: string };

const MAIN_TABS = [
  { to: '', label: copy.nav.home, icon: Home, end: true },
  { to: 'plan', label: copy.nav.plan, icon: CalendarDays, end: false },
  { to: 'chat', label: copy.nav.chat, icon: MessageCircle, end: false },
  { to: 'expenses', label: copy.nav.expenses, icon: CircleDollarSign, end: false },
] as const;

const MORE_LINKS = [
  { to: 'explore', label: copy.routes.explore },
  { to: 'reservations', label: copy.routes.reservations },
  { to: 'files', label: copy.routes.files },
  { to: 'checklist', label: copy.routes.checklist },
  { to: 'members', label: copy.routes.members },
] as const;

const tabCls = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs ${isActive ? 'font-bold text-primary' : 'text-muted'}`;

/** Loads the trip, subscribes to Realtime, and renders the nav: bottom tabs on mobile, sidebar on >=1024px. */
export function TripLayout() {
  const { tripId = '' } = useParams();
  const qc = useQueryClient();
  const trip = useTrip(tripId);
  const me = useQuery({ queryKey: ['me'], queryFn: ensureSession, staleTime: Infinity });
  const [moreOpen, setMoreOpen] = useState(false);
  useTripRealtime(tripId, qc);

  if (trip.isPending || me.isPending) {
    return (
      <main className="mx-auto max-w-xl p-4" aria-busy>
        <Skeleton className="h-40" />
      </main>
    );
  }
  if (trip.isError || me.isError) {
    return (
      <main className="mx-auto max-w-xl p-4">
        <ErrorState
          message={copy.common.loadFailed}
          onRetry={() => {
            void trip.refetch();
            void me.refetch();
          }}
          retryLabel={copy.common.retry}
        />
      </main>
    );
  }
  if (!trip.data) {
    return (
      <main className="mx-auto grid max-w-md gap-3 p-8 text-center">
        <h1 className="text-xl font-bold">{copy.tripHome.notFound}</h1>
        <p className="text-muted">{copy.tripHome.notFoundBody}</p>
        <Link to="/" className={`${btn.ghost} mx-auto`}>
          {copy.join.goHome}
        </Link>
      </main>
    );
  }

  const ctx: TripContext = { trip: trip.data, me: me.data };
  const base = `/t/${tripId}`;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl">
      <aside
        className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-1 p-4 lg:flex"
        aria-label={copy.nav.menu}
      >
        <Link to="/" className="mb-2 truncate px-3 py-2 text-sm text-muted hover:text-ink">
          ← {copy.list.title}
        </Link>
        {[
          ...MAIN_TABS.map((t) => ({ to: t.to, label: t.label, end: t.end })),
          ...MORE_LINKS.map((l) => ({ ...l, end: false })),
        ].map((l) => (
          <NavLink
            key={l.to}
            to={l.to ? `${base}/${l.to}` : base}
            end={l.end}
            className={({ isActive }) =>
              `flex min-h-11 items-center rounded-input px-3 ${isActive ? 'bg-primary-soft font-bold text-primary' : 'hover:bg-surface'}`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </aside>

      <div className="min-w-0 flex-1 pb-20 lg:pb-6">
        <Outlet context={ctx} />
      </div>

      <nav
        aria-label={copy.nav.menu}
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {MAIN_TABS.map((t) => (
          <NavLink key={t.label} to={t.to ? `${base}/${t.to}` : base} end={t.end} className={tabCls}>
            <t.icon className="size-5" aria-hidden />
            {t.label}
          </NavLink>
        ))}
        <button type="button" className={tabCls({ isActive: false })} onClick={() => setMoreOpen(true)}>
          <Menu className="size-5" aria-hidden />
          {copy.nav.more}
        </button>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={copy.nav.more}>
        <ul className="grid gap-1">
          {[
            ...MORE_LINKS.map((l) => ({ to: `${base}/${l.to}`, label: l.label })),
            { to: '/footprints', label: copy.routes.footprints },
            { to: '/settings', label: copy.routes.settings },
          ].map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                onClick={() => setMoreOpen(false)}
                className="flex min-h-11 items-center rounded-input px-3 hover:bg-bg"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
