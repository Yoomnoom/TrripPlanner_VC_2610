import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Share2, UserPlus } from 'lucide-react';
import { copy } from '@/copy';
import { Avatar, Skeleton } from '@/components/ui-kit';
import { btn } from '@/components/styles';
import { formatDuration, formatRange, inviteUrl } from '@/lib/trip';
import { Gauge } from '@/components/Gauge';
import { useChecklist, useUpdateItems } from '@/features/checklist/api';
import { pendingPreview, progress } from '@/lib/checklist';
import { DriverCard } from '@/features/home/DriverCard';
import { loadCards } from '@/features/offline/prepare';
import { nameForDriver } from '@/lib/offline';
import { useQuery } from '@tanstack/react-query';
import { AfterBlock, DuringBlock, UpcomingReservations } from '@/features/home/PhaseBlocks';
import { QuickExpenseSheet } from '@/features/home/QuickExpenseSheet';
import { useDestinations, useTripWeather } from '@/features/info/api';
import { usePlaces } from '@/features/plan/api';
import { useExpenses, useSettlements, toRows } from '@/features/expenses/api';
import { useReservations } from '@/features/reservations/api';
import { infoOf } from '@/data/country-info';
import {
  localNow,
  localStamp,
  nextPlace,
  todayIndexOf,
  tripPhaseInTz,
  upcomingReservations,
} from '@/lib/phase';
import { computeBalances, minimizeTransfers } from '@/lib/settlement';
import type { Place } from '@/features/plan/api';
import { useMembers, useTripCounts } from './api';
import { InviteSheet } from './InviteSheet';
import { copyInvite } from './invite';
import type { TripContext } from './TripLayout';

export function TripHomePage() {
  const { trip, me } = useOutletContext<TripContext>();
  const members = useMembers(trip.id);
  const counts = useTripCounts(trip.id);
  const checklist = useChecklist(trip.id);
  const updateItems = useUpdateItems(trip.id);
  const items = checklist.data ?? [];
  const pAll = progress(items);
  const pBefore = progress(items, 'before');
  const myMemberId = members.data?.find((m) => m.user_id === me)?.id ?? null;
  const [inviteOpen, setInviteOpen] = useState(false);

  const isOwner = members.data?.some((m) => m.user_id === me && m.role === 'owner') ?? false;
  // Phase is judged on the destination's local clock (falls back to this device's zone without a destination).
  const dests = useDestinations(trip.id);
  const tz =
    infoOf(dests.list[0]?.countryCode)?.timezones[0].tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const range = { start: trip.start_date, end: trip.end_date };
  const phase = tripPhaseInTz(range, tz, now);
  const local = localNow(tz, now);
  const localMinutes = local.minutes;

  const places = usePlaces(trip.id);
  const reservations = useReservations(trip.id);
  const expenses = useExpenses(trip.id);
  const settlements = useSettlements(trip.id);
  const weather = useTripWeather(trip, dests.list[0]);
  const todayIdx = phase.kind === 'during' ? todayIndexOf(range, local.date) : null;
  const next = todayIdx === null ? null : nextPlace(places.data ?? [], todayIdx, localMinutes);
  const unsettled = (() => {
    if (!expenses.data || !settlements.data || !members.data) return 0;
    const { expenses: rows, splits } = toRows(expenses.data);
    const bal = computeBalances(
      members.data.map((m) => m.id),
      rows.map((e) => ({ id: e.id, paidBy: e.paidBy, amountKrw: e.amountKrw })),
      splits,
      settlements.data.map((s) => ({
        fromMember: s.from_member,
        toMember: s.to_member,
        amountKrw: Number(s.amount_krw),
      })),
    );
    return minimizeTransfers(bal).length;
  })();
  const [quickOpen, setQuickOpen] = useState(false);
  const [driver, setDriver] = useState<Place | null>(null);
  const offlineCards = useQuery({
    queryKey: ['offline-cards', trip.id],
    queryFn: () => loadCards(trip.id),
    networkMode: 'always',
  });
  const dLabel =
    phase.kind === 'before'
      ? copy.tripHome.dBefore(phase.daysLeft)
      : phase.kind === 'during'
        ? copy.tripHome.dDuring(phase.day, phase.total)
        : copy.tripHome.dAfter;

  const share = async () => {
    const token = trip.invite_token;
    if (!token) return setInviteOpen(true);
    const url = inviteUrl(window.location.origin, token);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: trip.title, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return; // user closed the share sheet
      }
    }
    await copyInvite(token);
  };

  const c = counts.data;
  const cards = [
    { to: 'plan', label: copy.tripHome.cards.plan, n: c && `${c.scheduled}${copy.tripHome.unit.places}` },
    { to: 'explore', label: copy.tripHome.cards.explore, n: c && `${c.ideas}${copy.tripHome.unit.places}` },
    {
      to: 'reservations',
      label: copy.tripHome.cards.reservations,
      n: c && `${c.reservations}${copy.tripHome.unit.reservations}`,
    },
    { to: 'files', label: copy.tripHome.cards.files, n: c && `${c.files}${copy.tripHome.unit.files}` },
    {
      to: 'expenses',
      label: copy.tripHome.cards.expenses,
      n: c && `${c.expenses}${copy.tripHome.unit.expenses}`,
    },
    {
      to: 'checklist',
      label: copy.tripHome.cards.checklist,
      n: checklist.data && `${pAll.done}/${pAll.total}`,
    },
    { to: 'info', label: copy.tripHome.cards.info, n: undefined },
    {
      to: 'members',
      label: copy.tripHome.cards.members,
      n: members.data && `${members.data.length}${copy.tripHome.unit.members}`,
    },
  ];

  return (
    <div className="p-4">
      <section className="rounded-card bg-hero p-5 text-white shadow-card">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p aria-hidden className="text-3xl">
              {trip.cover_emoji ?? '✈️'}
            </p>
            <h1 className="mt-1 truncate text-2xl font-bold">{trip.title}</h1>
            <p className="mt-1 text-sm text-white/80">
              {formatRange(trip.start_date, trip.end_date)} · {formatDuration(trip.start_date, trip.end_date)}
            </p>
          </div>
          <button
            type="button"
            aria-label={copy.tripHome.share}
            onClick={() => void share()}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <Share2 className="size-5" aria-hidden />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {c && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
              {copy.tripHome.places(c.places)}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex -space-x-2" aria-hidden>
              {members.data?.slice(0, 5).map((m) => (
                <Avatar
                  key={m.id}
                  nickname={m.nickname}
                  color={m.color}
                  className="size-8 text-xs ring-2 ring-hero"
                />
              ))}
            </div>
            <button
              type="button"
              className={`${btn.ghost} !min-h-11 text-ink`}
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus className="size-4" aria-hidden />
              {copy.tripHome.invite}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-3 rounded-card bg-surface p-4 shadow-card" aria-label="D-day">
        <p className="text-sm text-muted">{formatRange(trip.start_date, trip.end_date)}</p>
        <p className="tabular text-3xl font-extrabold text-primary">{dLabel}</p>
      </section>

      {phase.kind === 'before' && (
        <>
          <section
            className="mt-3 rounded-card bg-surface p-4 shadow-card"
            aria-label={copy.checklist.heading}
          >
            <div className="flex justify-around">
              <Gauge pct={pBefore.pct} label={copy.checklist.gaugeBefore} />
              <Gauge pct={pAll.pct} label={copy.checklist.gaugeAll} />
            </div>
            <h2 className="mt-3 text-sm font-bold">{copy.checklist.homePreview}</h2>
            {checklist.data && pendingPreview(items).length === 0 ? (
              <p className="mt-1 text-sm text-muted">
                {items.length === 0 ? copy.list.emptyHint : copy.checklist.homeAllDone}
              </p>
            ) : (
              <ul className="mt-1">
                {pendingPreview(items).map((i) => (
                  <li key={i.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={i.checked}
                        onChange={() =>
                          updateItems.mutate([{ id: i.id, patch: { checked: true, checked_by: myMemberId } }])
                        }
                        className="size-5 accent-[var(--color-primary)]"
                      />
                      <span>{i.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <UpcomingReservations
            tripId={trip.id}
            items={upcomingReservations(reservations.data ?? [], localStamp(tz, now), 3)}
          />
        </>
      )}
      {phase.kind === 'during' && next && todayIdx !== null && (
        <DuringBlock
          tripId={trip.id}
          day={phase.day}
          total={phase.total}
          tripStart={trip.start_date}
          todayPlaces={(places.data ?? []).filter((p) => p.day_index === todayIdx)}
          next={next}
          weather={weather.data?.byDay.get(todayIdx)}
          onQuickExpense={() => setQuickOpen(true)}
          onDriver={setDriver}
        />
      )}
      {phase.kind === 'after' && <AfterBlock tripId={trip.id} unsettled={unsettled} />}

      <ul className="mt-3 grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <li key={card.to}>
            <Link
              to={`/t/${trip.id}/${card.to}`}
              className="flex min-h-20 flex-col justify-between rounded-card bg-surface p-4 shadow-card"
            >
              <span className="font-semibold">{card.label}</span>
              {counts.isPending && card.n === undefined && card.to !== 'explore' ? (
                <Skeleton className="h-5 w-10" />
              ) : (
                <span className="tabular text-sm font-bold text-primary">{card.n ?? ''}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <QuickExpenseSheet
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        tripId={trip.id}
        tripStart={trip.start_date}
        dayIndex={todayIdx}
        members={members.data ?? []}
        meId={myMemberId}
        defaultCurrency={infoOf(dests.list[0]?.countryCode)?.currency ?? 'KRW'}
      />
      <DriverCard
        place={
          driver
            ? nameForDriver(
                offlineCards.data?.find((c) => c.id === driver.id),
                driver,
              )
            : null
        }
        onClose={() => setDriver(null)}
      />
      <InviteSheet trip={trip} isOwner={isOwner} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
