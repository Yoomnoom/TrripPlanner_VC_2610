import { z } from 'zod';

const DAY_MS = 86_400_000;

/** Parses 'YYYY-MM-DD' as a UTC midnight so day math ignores DST and the viewer's timezone. */
const toUtc = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export const todayYmd = (now: Date = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

export const daysBetween = (fromYmd: string, toYmd: string) =>
  Math.round((toUtc(toYmd) - toUtc(fromYmd)) / DAY_MS);

/** Number of trip days (start and end inclusive). */
export const tripDays = (start: string, end: string) => daysBetween(start, end) + 1;

export const tripNights = (start: string, end: string) => daysBetween(start, end);

export type TripPhase =
  { kind: 'before'; daysLeft: number } | { kind: 'during'; day: number; total: number } | { kind: 'after' };

export function tripPhase(start: string, end: string, today: string): TripPhase {
  if (today < start) return { kind: 'before', daysLeft: daysBetween(today, start) };
  if (today > end) return { kind: 'after' };
  return { kind: 'during', day: daysBetween(start, today) + 1, total: tripDays(start, end) };
}

/** '2026-10-09' → '10월 9일' */
export const formatMd = (ymd: string) => {
  const [, m, d] = ymd.split('-').map(Number);
  return `${m}월 ${d}일`;
};

export const formatRange = (start: string, end: string) => `${formatMd(start)} ~ ${formatMd(end)}`;

/** '3박 4일' (same-day trip is '당일치기'). */
export const formatDuration = (start: string, end: string) => {
  const nights = tripNights(start, end);
  return nights === 0 ? '당일치기' : `${nights}박 ${nights + 1}일`;
};

export const defaultTitle = (city: string, start: string, end: string) =>
  `${city.trim() || '내'} ${formatDuration(start, end)} 여행`;

export const inviteUrl = (origin: string, token: string) => `${origin.replace(/\/$/, '')}/join/${token}`;

export const nicknameSchema = z.string().trim().min(1).max(20);

/** Initial letter for avatars; falls back to '?'. */
export const initialOf = (nickname: string) => Array.from(nickname.trim())[0] ?? '?';

export const MEMBER_COLORS = [
  '#6D4AFF',
  '#F97316',
  '#0EA5E9',
  '#16A34A',
  '#E11D48',
  '#CA8A04',
  '#0D9488',
  '#9333EA',
] as const;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** Date string of trip day `idx` (0-based). */
export const dayYmd = (start: string, idx: number) => {
  const d = new Date(toUtc(start) + idx * DAY_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

/** '2026-10-09' → '10월 9일(금)' */
export const formatMdWeekday = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${formatMd(ymd)}(${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
};

/** Day index of `ymd` within the trip, or null when it falls outside it. */
export const dayIndexOf = (start: string, ymd: string, dayCount: number) => {
  const i = daysBetween(start, ymd);
  return i >= 0 && i < dayCount ? i : null;
};
