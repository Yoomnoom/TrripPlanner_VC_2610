/** Proposal shape stored in chat_messages.proposal (output of ai-plan after resolution). */
export interface ProposalItem {
  name: string;
  category: string;
  startTime: string;
  endTime: string;
  isIndoor: boolean | null;
  note: string | null;
  searchQuery: string;
  resolved: boolean;
  googlePlaceId: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}
export interface ProposalDay {
  dayIndex: number;
  title: string;
  items: ProposalItem[];
}
export interface Proposal {
  days: ProposalDay[];
}

/** Defensive check: chat_messages.proposal is jsonb, so never trust its shape in the UI. */
export function asProposal(v: unknown): Proposal | null {
  const days = (v as { days?: unknown } | null)?.days;
  if (!Array.isArray(days)) return null;
  const ok = days.every(
    (d) =>
      d &&
      typeof d.dayIndex === 'number' &&
      Array.isArray(d.items) &&
      d.items.every(
        (i: ProposalItem) =>
          i && typeof i.name === 'string' && typeof i.startTime === 'string' && typeof i.endTime === 'string',
      ),
  );
  return ok ? (v as Proposal) : null;
}

export interface CurrentItem {
  day_index: number | null;
  name: string;
  start_time: string | null;
  end_time: string | null;
}

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
const hm = (t: string | null) => (t ? t.slice(0, 5) : '');

export interface ItineraryDiff {
  added: { day: number; name: string }[];
  removed: { day: number; name: string }[];
  changed: { day: number; name: string; from: string; to: string }[];
  unchanged: number;
}

/** What applying `proposal` over the current schedule would change (matched by name, ignoring spaces/case). */
export function diffItinerary(current: readonly CurrentItem[], proposal: Proposal): ItineraryDiff {
  const cur = current.filter((c) => c.day_index !== null);
  const used = new Set<number>();
  const diff: ItineraryDiff = { added: [], removed: [], changed: [], unchanged: 0 };
  for (const d of proposal.days) {
    for (const it of d.items) {
      const idx = cur.findIndex((c, i) => !used.has(i) && norm(c.name) === norm(it.name));
      if (idx < 0) {
        diff.added.push({ day: d.dayIndex, name: it.name });
        continue;
      }
      used.add(idx);
      const c = cur[idx];
      const from = `Day ${c.day_index! + 1} ${hm(c.start_time)}–${hm(c.end_time)}`;
      const to = `Day ${d.dayIndex + 1} ${it.startTime}–${it.endTime}`;
      if (from === to) diff.unchanged++;
      else diff.changed.push({ day: d.dayIndex, name: it.name, from, to });
    }
  }
  cur.forEach((c, i) => {
    if (!used.has(i)) diff.removed.push({ day: c.day_index!, name: c.name });
  });
  return diff;
}

export interface PlaceRow {
  id: string;
  trip_id: string;
  name: string;
  category: string;
  day_index: number;
  start_time: string;
  end_time: string;
  position: number;
  google_place_id: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  is_indoor: boolean | null;
  note: string | null;
  source: 'ai';
}

/**
 * Rows to insert for a proposal. Days outside `dayCount` are skipped. `positionStart` lets "append" mode continue
 * after existing places of that day (map dayIndex → last position).
 */
export function proposalToRows(
  proposal: Proposal,
  tripId: string,
  dayCount: number,
  lastPosition: Record<number, number> = {},
  newId: () => string = () => crypto.randomUUID(),
): PlaceRow[] {
  return proposal.days
    .filter((d) => d.dayIndex >= 0 && d.dayIndex < dayCount)
    .flatMap((d) =>
      d.items.map((it, i) => ({
        id: newId(),
        trip_id: tripId,
        name: it.name,
        category: it.category,
        day_index: d.dayIndex,
        start_time: it.startTime,
        end_time: it.endTime,
        position: (lastPosition[d.dayIndex] ?? 0) + (i + 1) * 1000,
        google_place_id: it.googlePlaceId,
        address: it.address,
        lat: it.lat,
        lng: it.lng,
        is_indoor: it.isIndoor,
        note: it.note,
        source: 'ai' as const,
      })),
    );
}

export const unresolvedCount = (p: Proposal) =>
  p.days.reduce((n, d) => n + d.items.filter((i) => !i.resolved).length, 0);
