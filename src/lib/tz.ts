/** HH:mm of `now` in an IANA zone. */
export function timeIn(tz: string, now: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

/** YYYY-MM-DD of `now` in an IANA zone (the "local date" used for before/during/after decisions). */
export function dateIn(tz: string, now: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return p; // en-CA formats as YYYY-MM-DD
}

/** Offset of a zone from UTC at `at`, in minutes (positive = ahead of UTC). */
export function offsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - (at.getTime() - at.getMilliseconds())) / 60000);
}

/** Minutes the destination is ahead of Korea (negative = behind). */
export const diffFromKorea = (tz: string, at: Date) =>
  offsetMinutes(tz, at) - offsetMinutes('Asia/Seoul', at);

/** '한국과 시차 없음' / '한국보다 1시간 느려요' / '한국보다 1시간 30분 빨라요'. */
export function describeDiff(minutes: number): string {
  if (minutes === 0) return '한국과 시차 없음';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const span = `${h > 0 ? `${h}시간` : ''}${h > 0 && m > 0 ? ' ' : ''}${m > 0 ? `${m}분` : ''}`;
  return `한국보다 ${span} ${minutes < 0 ? '느려요' : '빨라요'}`;
}
