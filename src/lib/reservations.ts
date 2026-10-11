import { dayIndexOf } from '@/lib/trip';
import { toHHmm, toMin } from '@/lib/time';

export const RESERVATION_TYPES = ['flight', 'lodging', 'transport', 'restaurant', 'ticket', 'other'] as const;
export type ReservationType = (typeof RESERVATION_TYPES)[number];

export interface ReservationLike {
  id: string;
  type: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  amount: number | null;
  currency: string | null;
}

/** Timeline order: by start (undated last), then title. `starts_at` is a local wall-clock timestamp. */
export function sortReservations<T extends ReservationLike>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.starts_at && b.starts_at)
      return a.starts_at.localeCompare(b.starts_at) || a.title.localeCompare(b.title);
    if (a.starts_at) return -1;
    if (b.starts_at) return 1;
    return a.title.localeCompare(b.title);
  });
}

const pad = (n: number) => String(n).padStart(2, '0');

/** '2026-10-09T14:30:00' → '10월 9일 14:30' (local wall clock, no timezone math). */
export function formatWhen(ts: string | null) {
  if (!ts) return '';
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return ts;
  return `${Number(m[2])}월 ${Number(m[3])}일 ${pad(Number(m[4]))}:${m[5]}`;
}

export function formatRangeWhen(start: string | null, end: string | null) {
  if (!start) return '';
  const a = formatWhen(start);
  if (!end) return a;
  const sameDay = start.slice(0, 10) === end.slice(0, 10);
  return `${a} ~ ${sameDay ? formatWhen(end).split(' ').pop() : formatWhen(end)}`;
}

/** `datetime-local` value ('YYYY-MM-DDTHH:mm') ↔ DB timestamp. */
export const toInputValue = (ts: string | null) => (ts ? ts.slice(0, 16).replace(' ', 'T') : '');
export const fromInputValue = (v: string) => (v ? `${v}:00` : null);

/** Fields for the expense form when "비용으로 추가" is pressed on a reservation. */
export function toExpensePrefill(r: ReservationLike) {
  return {
    title: r.title,
    amount: r.amount ?? undefined,
    currency: r.currency ?? undefined,
    category: (r.type === 'lodging'
      ? 'lodging'
      : r.type === 'flight' || r.type === 'transport'
        ? 'transport'
        : r.type === 'ticket'
          ? 'ticket'
          : r.type === 'restaurant'
            ? 'food'
            : 'other') as 'lodging' | 'transport' | 'ticket' | 'food' | 'other',
    spent_on: r.starts_at ? r.starts_at.slice(0, 10) : undefined,
  };
}

/** Flights and lodging are shown as pinned items at the top of the schedule. */
export const isFixedItem = (r: { type: string }) => r.type === 'flight' || r.type === 'lodging';

// ---------------------------------------------------------------- auto-fill (ai-reservation) and follow-ups

export interface ParsedReservation {
  type: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  confirmationNo: string | null;
  locationName: string | null;
  amount: number | null;
  currency: string | null;
  note: string | null;
  confidence: number;
}

/** Form values (strings, as the inputs hold them) from an extraction. The user still checks and saves. */
export function fromParse(p: ParsedReservation) {
  return {
    type: (RESERVATION_TYPES as readonly string[]).includes(p.type) ? p.type : 'other',
    title: p.title,
    starts: p.startsAt ?? '',
    ends: p.endsAt ?? '',
    no: p.confirmationNo ?? '',
    amount: p.amount === null ? '' : String(p.amount),
    currency: p.currency ?? 'KRW',
    note: [p.locationName, p.note].filter(Boolean).join(' · '),
    locationName: p.locationName,
    confidence: p.confidence,
  };
}

export type FollowUp = { kind: 'lodging' | 'flight' | 'expense' };

/** Suggestions offered after saving (SPEC F-3-2). Schedule items only when the dates fall inside the trip. */
export function followUps(
  r: { type: string; starts_at: string | null; ends_at: string | null; amount: number | null },
  trip: { start: string; dayCount: number },
): FollowUp[] {
  const out: FollowUp[] = [];
  const inTrip = (ts: string | null) =>
    !!ts && dayIndexOf(trip.start, ts.slice(0, 10), trip.dayCount) !== null;
  if (r.type === 'lodging' && (inTrip(r.starts_at) || inTrip(r.ends_at))) out.push({ kind: 'lodging' });
  if (r.type === 'flight' && inTrip(r.starts_at)) out.push({ kind: 'flight' });
  if (r.amount !== null && r.amount > 0) out.push({ kind: 'expense' });
  return out;
}

export interface FollowUpPlace {
  name: string;
  category: 'lodging' | 'transport';
  day_index: number;
  start_time: string;
  end_time: string;
}

const hhmm = (ts: string | null, fallback: string) => (ts && ts.length >= 16 ? ts.slice(11, 16) : fallback);
const plus = (t: string, min: number) => toHHmm(Math.min(toMin(t) + min, 23 * 60 + 59));

/** Schedule items for a lodging (check-in / check-out) or flight (travel) reservation. */
export function followUpPlaces(
  kind: 'lodging' | 'flight',
  r: { title: string; starts_at: string | null; ends_at: string | null },
  trip: { start: string; dayCount: number },
  locationName?: string | null,
): FollowUpPlace[] {
  const day = (ts: string | null) => (ts ? dayIndexOf(trip.start, ts.slice(0, 10), trip.dayCount) : null);
  const name = locationName?.trim() || r.title;
  if (kind === 'flight') {
    const d = day(r.starts_at);
    if (d === null) return [];
    const s = hhmm(r.starts_at, '09:00');
    const e =
      r.ends_at && r.ends_at.slice(0, 10) === r.starts_at!.slice(0, 10)
        ? hhmm(r.ends_at, plus(s, 120))
        : plus(s, 120);
    return [
      {
        name: r.title,
        category: 'transport',
        day_index: d,
        start_time: s,
        end_time: e > s ? e : plus(s, 60),
      },
    ];
  }
  const out: FollowUpPlace[] = [];
  const di = day(r.starts_at);
  if (di !== null) {
    const s = hhmm(r.starts_at, '15:00');
    out.push({
      name: `${name} 체크인`,
      category: 'lodging',
      day_index: di,
      start_time: s,
      end_time: plus(s, 30),
    });
  }
  const do_ = day(r.ends_at);
  if (do_ !== null) {
    const s = hhmm(r.ends_at, '11:00');
    out.push({
      name: `${name} 체크아웃`,
      category: 'lodging',
      day_index: do_,
      start_time: s,
      end_time: plus(s, 30),
    });
  }
  return out;
}
