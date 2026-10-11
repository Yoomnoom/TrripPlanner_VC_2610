import { dateIn } from '@/lib/tz';
import { dayIndexOf, tripDays, tripPhase, type TripPhase } from '@/lib/trip';
import { timeToMin, sortDay, type Schedulable } from '@/lib/plan';

/** The destination's wall clock "now": local date plus minutes since midnight. */
export function localNow(tz: string, now: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')!.value);
  const m = Number(parts.find((p) => p.type === 'minute')!.value);
  return { date: dateIn(tz, now), minutes: h * 60 + m };
}

/** Before / during / after judged on the DESTINATION's local date (SPEC F-3-9), so a time-zone jump never shifts the day. */
export function tripPhaseInTz(trip: { start: string; end: string }, tz: string, now: Date): TripPhase {
  return tripPhase(trip.start, trip.end, localNow(tz, now).date);
}

export type NextPlace<T> =
  { kind: 'next'; place: T; minutesUntil: number } | { kind: 'done'; tomorrowFirst: T | null };

/**
 * The place starting soonest at or after `nowMin` among today's timed places. When every start has passed the answer
 * is "done" plus the first place of tomorrow (if any).
 */
export function nextPlace<T extends Schedulable>(
  places: readonly T[],
  todayIndex: number,
  nowMin: number,
): NextPlace<T> {
  const today = sortDay(places.filter((p) => p.day_index === todayIndex && p.start_time));
  for (const p of today) {
    const start = timeToMin(p.start_time)!;
    if (start >= nowMin) return { kind: 'next', place: p, minutesUntil: start - nowMin };
  }
  const tomorrow = sortDay(places.filter((p) => p.day_index === todayIndex + 1));
  return { kind: 'done', tomorrowFirst: tomorrow[0] ?? null };
}

/** Today's Day index (0-based) from the destination's local date, or null outside the trip. */
export const todayIndexOf = (trip: { start: string; end: string }, localDate: string) =>
  dayIndexOf(trip.start, localDate, tripDays(trip.start, trip.end));

/** "30분 후" / "1시간 30분 후" / "지금". */
export function untilLabel(minutes: number): string {
  if (minutes <= 0) return '지금';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h > 0 ? `${h}시간` : ''}${h > 0 && m > 0 ? ' ' : ''}${m > 0 ? `${m}분` : ''} 후`;
}

/** Upcoming reservations (local wall-clock compare), soonest first. */
export function upcomingReservations<T extends { starts_at: string | null }>(
  list: readonly T[],
  nowLocal: string,
  n = 3,
): T[] {
  return list
    .filter((r) => r.starts_at && r.starts_at.slice(0, 16) >= nowLocal.slice(0, 16))
    .sort((a, b) => a.starts_at!.localeCompare(b.starts_at!))
    .slice(0, n);
}

/** 'YYYY-MM-DDTHH:mm' wall clock of a destination. */
export function localStamp(tz: string, now: Date): string {
  const n = localNow(tz, now);
  return `${n.date}T${String(Math.floor(n.minutes / 60)).padStart(2, '0')}:${String(n.minutes % 60).padStart(2, '0')}`;
}
