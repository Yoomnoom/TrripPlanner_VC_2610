export interface ReviewLike {
  place_id: string;
  member_id: string;
  rating: number;
}

/** Average rating (one decimal) and count per place. */
export function summarize(reviews: readonly ReviewLike[]) {
  const m = new Map<string, { sum: number; count: number; members: string[] }>();
  for (const r of reviews) {
    const cur = m.get(r.place_id) ?? { sum: 0, count: 0, members: [] };
    cur.sum += r.rating;
    cur.count += 1;
    cur.members.push(r.member_id);
    m.set(r.place_id, cur);
  }
  const out = new Map<string, { avg: number; count: number; members: string[] }>();
  for (const [id, v] of m)
    out.set(id, { avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count, members: v.members });
  return out;
}

/** Scheduled places with no review from me yet (the "후기 미작성 장소" count after a trip). */
export function unreviewed<T extends { id: string; day_index: number | null }>(
  places: readonly T[],
  reviews: readonly ReviewLike[],
  meMemberId: string | null,
): T[] {
  if (!meMemberId) return [];
  const mine = new Set(reviews.filter((r) => r.member_id === meMemberId).map((r) => r.place_id));
  return places.filter((p) => p.day_index !== null && !mine.has(p.id));
}

/** '★★★★☆' style text for 1..5 (the number is always shown next to it). */
export const stars = (n: number) =>
  '★'.repeat(Math.max(0, Math.min(5, Math.round(n)))) +
  '☆'.repeat(5 - Math.max(0, Math.min(5, Math.round(n))));

/** Whether reviews can be written yet: the trip has started on the destination's local date. */
export const canReview = (tripStart: string, localDate: string) => localDate >= tripStart;
