import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Share2, UserPlus } from 'lucide-react';
import { copy } from '@/copy';
import { Avatar, Skeleton } from '@/components/ui-kit';
import { btn } from '@/components/styles';
import { formatDuration, formatRange, inviteUrl, todayYmd, tripPhase } from '@/lib/trip';
import { useMembers, useTripCounts } from './api';
import { InviteSheet } from './InviteSheet';
import { copyInvite } from './invite';
import type { TripContext } from './TripLayout';

export function TripHomePage() {
  const { trip, me } = useOutletContext<TripContext>();
  const members = useMembers(trip.id);
  const counts = useTripCounts(trip.id);
  const [inviteOpen, setInviteOpen] = useState(false);

  const isOwner = members.data?.some((m) => m.user_id === me && m.role === 'owner') ?? false;
  const phase = tripPhase(trip.start_date, trip.end_date, todayYmd());
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
    { to: 'plan', label: copy.tripHome.cards.plan, n: c && `${c.places}${copy.tripHome.unit.places}` },
    { to: 'explore', label: copy.tripHome.cards.explore, n: undefined },
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
      n: c && `${c.checklistDone}/${c.checklistTotal}`,
    },
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

      <InviteSheet trip={trip} isOwner={isOwner} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
