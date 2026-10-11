// Pure context builder for ai-recap. Only names, day numbers, ratings and review comments go to the model: never
// amounts, confirmation numbers, member names or ids.

export interface RecapInput {
  title: string;
  dayCount: number;
  destinations: { country_code: string; city: string | null }[];
  places: { id: string; name: string; day_index: number | null; category: string }[];
  reviews: { place_id: string; rating: number; comment: string | null }[];
}

export function buildRecapContext(i: RecapInput) {
  const byPlace = new Map<string, { sum: number; n: number; comments: string[] }>();
  for (const r of i.reviews) {
    const cur = byPlace.get(r.place_id) ?? { sum: 0, n: 0, comments: [] };
    cur.sum += r.rating;
    cur.n += 1;
    if (r.comment?.trim()) cur.comments.push(r.comment.trim().slice(0, 120));
    byPlace.set(r.place_id, cur);
  }
  const days = Array.from({ length: i.dayCount }, (_, d) => ({
    dayIndex: d,
    places: i.places
      .filter((p) => p.day_index === d)
      .map((p) => {
        const r = byPlace.get(p.id);
        return {
          name: p.name,
          category: p.category,
          ...(r ? { avgRating: Math.round((r.sum / r.n) * 10) / 10, comments: r.comments.slice(0, 3) } : {}),
        };
      }),
  }));
  return {
    title: i.title,
    dayCount: i.dayCount,
    destinations: i.destinations.map((d) => ({ country: d.country_code, city: d.city })),
    stats: {
      places: i.places.filter((p) => p.day_index !== null).length,
      days: i.dayCount,
      reviewed: byPlace.size,
    },
    days,
  };
}

/** Top-N places by average rating (ties: more reviews, then name), used for the recap screen. */
export function topRated<T extends { id: string; name: string }>(
  places: readonly T[],
  reviews: readonly { place_id: string; rating: number }[],
  n = 3,
) {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const r of reviews) {
    const cur = acc.get(r.place_id) ?? { sum: 0, n: 0 };
    cur.sum += r.rating;
    cur.n += 1;
    acc.set(r.place_id, cur);
  }
  return places
    .filter((p) => acc.has(p.id))
    .map((p) => ({ place: p, avg: acc.get(p.id)!.sum / acc.get(p.id)!.n, count: acc.get(p.id)!.n }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count || a.place.name.localeCompare(b.place.name))
    .slice(0, n);
}
