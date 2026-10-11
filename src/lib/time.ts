export const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const toHHmm = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** 순서 변경 후 재배치. 소요시간 유지, 사이에 이동시간(없으면 15분) 삽입. */
export function reflow(
  items: { id: string; durationMin: number; legMinFromPrev?: number }[],
  firstStartMin: number,
): { id: string; startMin: number; endMin: number }[] {
  let cursor = firstStartMin;
  return items.map((it, idx) => {
    if (idx > 0) cursor += it.legMinFromPrev ?? 15;
    const start = cursor;
    const end = start + it.durationMin;
    cursor = end;
    return { id: it.id, startMin: start, endMin: end };
  });
}
