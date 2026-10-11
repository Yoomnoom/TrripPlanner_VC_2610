import { toCsv } from '@/lib/csv';
import { hm, type Schedulable } from '@/lib/plan';
import { dayYmd, daysBetween } from '@/lib/trip';
import { LABELS_KO } from '@/types/domain';

/** Category colors (SPEC 7-2: background / border / icon-ish accent). */
export const CATEGORY_COLORS: Record<string, { bg: string; border: string }> = {
  food: { bg: '#FFF1E6', border: '#F97316' },
  cafe: { bg: '#FBEFE4', border: '#A16207' },
  sightseeing: { bg: '#EEEAFE', border: '#6D4AFF' },
  shopping: { bg: '#FDE8F3', border: '#DB2777' },
  activity: { bg: '#E6F7EC', border: '#16A34A' },
  lodging: { bg: '#E6F1FD', border: '#2563EB' },
  transport: { bg: '#EDEDF2', border: '#6B6B7B' },
  other: { bg: '#F1F1F5', border: '#6B6B7B' },
};

export interface CalPlace extends Schedulable {
  name: string;
  category: string;
  address?: string | null;
  note?: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymdLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hmLocal = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Timed day-places → FullCalendar events on real dates (trip start + day index). */
export function toEvents(places: readonly CalPlace[], tripStart: string) {
  return places
    .filter((p) => p.day_index !== null && p.start_time && p.end_time)
    .map((p) => {
      const date = dayYmd(tripStart, p.day_index!);
      const c = CATEGORY_COLORS[p.category] ?? CATEGORY_COLORS.other;
      return {
        id: p.id,
        title: p.name,
        start: `${date}T${hm(p.start_time)}:00`,
        end: `${date}T${hm(p.end_time)}:00`,
        backgroundColor: c.bg,
        borderColor: c.border,
        textColor: '#1A1A24',
      };
    });
}

/**
 * A dragged/resized event → day index + 'HH:MM' times. An end that rolls past midnight (or lands
 * before the start) is clamped to 23:59; the result is null when the day is outside the trip.
 */
export function slotFromDates(start: Date, end: Date | null, tripStart: string, dayCount: number) {
  const day = daysBetween(tripStart, ymdLocal(start));
  if (day < 0 || day >= dayCount) return null;
  const s = hmLocal(start);
  let e = end ? hmLocal(end) : null;
  if (!end || ymdLocal(end) !== ymdLocal(start) || !e || e <= s) {
    const [h, m] = s.split(':').map(Number);
    const plus = h * 60 + m + 60;
    e = plus >= 24 * 60 ? '23:59' : `${pad(Math.floor(plus / 60))}:${pad(plus % 60)}`;
    if (e <= s) e = '23:59';
  }
  return { day, start: s, end: e };
}

export const CSV_HEADER = ['Day', '시작', '종료', '이름', '카테고리', '주소', '메모'] as const;

/** Whole schedule (day places only), ordered Day → start time. */
export function scheduleToCsv(days: readonly (readonly CalPlace[])[]) {
  const rows = days.flatMap((list, i) =>
    list.map((p) => [
      `Day ${i + 1}`,
      hm(p.start_time),
      hm(p.end_time),
      p.name,
      LABELS_KO[p.category as keyof typeof LABELS_KO] ?? p.category,
      p.address ?? '',
      p.note ?? '',
    ]),
  );
  return toCsv(CSV_HEADER, rows);
}
