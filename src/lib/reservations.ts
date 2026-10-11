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
