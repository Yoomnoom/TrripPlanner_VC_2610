/** 현재 연 연속: thisYear 또는 thisYear-1에서 끝나는 연속 구간의 길이. 없으면 0. */
export function yearStreak(years: number[], thisYear: number): number {
  const set = new Set(years);
  let end: number;
  if (set.has(thisYear)) end = thisYear;
  else if (set.has(thisYear - 1)) end = thisYear - 1;
  else return 0;
  let n = 0;
  for (let y = end; set.has(y); y--) n++;
  return n;
}
