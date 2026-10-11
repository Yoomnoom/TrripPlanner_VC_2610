export interface SavedLike {
  id: string;
  google_place_id: string;
  name: string;
  category: string;
  country_code: string | null;
  city: string | null;
}

/**
 * Dedup key for a place. Google places use their id; manual ones (no id) fall back to a normalized name so the
 * same hand-typed place cannot be saved twice (saved_places is unique per user + google_place_id).
 */
export const savedKey = (p: { google_place_id?: string | null; name: string }) =>
  p.google_place_id ? p.google_place_id : `manual:${p.name.replace(/\s+/g, '').toLowerCase()}`;

export interface SavedGroup<T> {
  country: string | null;
  city: string | null;
  items: T[];
}

/** Groups by country then city; the "no location" group goes last. Items keep their incoming order. */
export function groupSaved<T extends SavedLike>(
  list: readonly T[],
  category: string | null = null,
): SavedGroup<T>[] {
  const map = new Map<string, SavedGroup<T>>();
  for (const s of list) {
    if (category && s.category !== category) continue;
    const key = `${s.country_code ?? ''}|${s.city ?? ''}`;
    const g = map.get(key) ?? { country: s.country_code, city: s.city, items: [] };
    g.items.push(s);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => {
    if (!a.country !== !b.country) return a.country ? -1 : 1;
    return (a.country ?? '').localeCompare(b.country ?? '') || (a.city ?? '').localeCompare(b.city ?? '');
  });
}

/** Saved places not yet in a trip's idea list (matched by name, ignoring spaces/case). */
export function notInIdeas<T extends { name: string }>(saved: readonly T[], ideaNames: readonly string[]) {
  const have = new Set(ideaNames.map((n) => n.replace(/\s+/g, '').toLowerCase()));
  return saved.filter((s) => !have.has(s.name.replace(/\s+/g, '').toLowerCase()));
}
