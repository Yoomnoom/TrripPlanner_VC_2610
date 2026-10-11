export type Section = 'before' | 'packing';
export const SECTIONS: readonly Section[] = ['before', 'packing'];

export interface ChecklistLike {
  id: string;
  section: string;
  title: string;
  checked: boolean;
  position: number;
}

/** Suggested starter items (SPEC 4-11). All start unchecked and are added only when the user picks them. */
export const TEMPLATES: Record<Section, readonly string[]> = {
  before: ['여권 유효기간 확인', '항공권 확인', '숙소 예약 확인', '환전', '보험 확인', '날씨 확인'],
  packing: ['운전면허증', '신분증', '충전기', '보조배터리', '선크림', '가벼운 겉옷', '카메라'],
};

export interface Progress {
  done: number;
  total: number;
  /** Whole percent, 0 when there are no items. */
  pct: number;
}

export function progress(items: readonly ChecklistLike[], section?: Section): Progress {
  const list = section ? items.filter((i) => i.section === section) : items;
  const done = list.filter((i) => i.checked).length;
  return { done, total: list.length, pct: list.length === 0 ? 0 : Math.round((done / list.length) * 100) };
}

export const inSection = <T extends ChecklistLike>(items: readonly T[], section: Section) =>
  items
    .filter((i) => i.section === section)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));

/** Template titles not already present (case/space-insensitive), so applying twice never duplicates. */
export function missingTemplates(
  items: readonly ChecklistLike[],
  section: Section,
  picked: readonly string[],
) {
  const have = new Set(items.filter((i) => i.section === section).map((i) => i.title.trim().toLowerCase()));
  return picked.filter((t) => !have.has(t.trim().toLowerCase()));
}

/** Up to `n` unchecked items, "before departure" first, for the home preview. */
export function pendingPreview<T extends ChecklistLike>(items: readonly T[], n = 3): T[] {
  return [...inSection(items, 'before'), ...inSection(items, 'packing')]
    .filter((i) => !i.checked)
    .slice(0, n);
}

/** New positions (1000 apart) after moving `id` to `index` within an ordered list. */
export function reorderPositions<T extends { id: string }>(ordered: readonly T[], id: string, index: number) {
  const item = ordered.find((x) => x.id === id);
  if (!item) return [];
  const rest = ordered.filter((x) => x.id !== id);
  const i = Math.max(0, Math.min(index, rest.length));
  const next = [...rest.slice(0, i), item, ...rest.slice(i)];
  return next.map((x, k) => ({ id: x.id, position: (k + 1) * 1000 }));
}
