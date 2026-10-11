import { z } from 'zod';

export const COMPANIONS = ['solo', 'couple', 'friends', 'family', 'kids', 'parents'] as const;
export const PACES = ['relaxed', 'normal', 'busy'] as const;
export const THEMES = [
  'food',
  'cafe',
  'history',
  'nature',
  'shopping',
  'photo',
  'experience',
  'night',
] as const;
export const TRANSPORTS = ['public', 'car'] as const;
export const AVOIDS = ['waiting', 'walking', 'outdoor', 'early'] as const;

// Every field is nullish so the same shape works as a structured-output schema (all keys present, null = unset).
export const PlanningPrefs = z.object({
  companions: z.enum(COMPANIONS).nullish(),
  pace: z.enum(PACES).nullish(),
  themes: z.array(z.string().max(20)).max(8).nullish(),
  transport: z.enum(TRANSPORTS).nullish(),
  avoid: z.array(z.string().max(30)).max(6).nullish(),
  mustInclude: z.array(z.string().max(80)).max(20).nullish(),
});
export type PlanningPrefs = z.infer<typeof PlanningPrefs>;

/** Reads stored jsonb defensively: anything that is not valid prefs becomes `{}`. */
export function readPrefs(raw: unknown): PlanningPrefs {
  const r = PlanningPrefs.safeParse(raw);
  return r.success ? r.data : {};
}

/** Applies a patch: null/undefined fields keep the old value, everything else replaces it. */
export function mergePrefs(base: PlanningPrefs, patch: PlanningPrefs | null | undefined): PlanningPrefs {
  if (!patch) return base;
  const out: PlanningPrefs = { ...base };
  for (const k of Object.keys(patch) as (keyof PlanningPrefs)[]) {
    const v = patch[k];
    if (v !== null && v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** True when nothing is set (so the prompt can skip the section). */
export const isEmptyPrefs = (p: PlanningPrefs) =>
  Object.values(p).every((v) => v === null || v === undefined || (Array.isArray(v) && v.length === 0));

const KO: Record<string, string> = {
  solo: '혼자',
  couple: '연인과',
  friends: '친구와',
  family: '가족과',
  kids: '아이와 함께',
  parents: '부모님과',
  relaxed: '느긋하게(하루 3곳 안팎)',
  normal: '보통 속도(하루 4~5곳)',
  busy: '빡빡하게(하루 6곳 이상)',
  public: '도보·대중교통 위주',
  car: '택시·렌터카 포함',
  food: '맛집',
  cafe: '카페',
  history: '관광·역사',
  nature: '자연·산책',
  shopping: '쇼핑',
  photo: '사진',
  experience: '체험',
  night: '야경',
  waiting: '긴 웨이팅',
  walking: '많이 걷기',
  outdoor: '야외 위주',
  early: '이른 아침',
};

export const labelOf = (key: string) => KO[key] ?? key;

/** One Korean sentence describing the preferences (used as the generated chat request). */
export function prefsToText(p: PlanningPrefs): string {
  const parts: string[] = [];
  if (p.companions) parts.push(labelOf(p.companions));
  if (p.pace) parts.push(labelOf(p.pace));
  if (p.themes?.length) parts.push(`테마는 ${p.themes.map(labelOf).join(', ')}`);
  if (p.transport) parts.push(labelOf(p.transport));
  if (p.avoid?.length) parts.push(`피하고 싶은 것: ${p.avoid.map(labelOf).join(', ')}`);
  if (p.mustInclude?.length) parts.push(`꼭 가고 싶은 곳: ${p.mustInclude.join(', ')}`);
  return parts.length ? `${parts.join(' / ')} 조건으로 일정을 만들어줘` : '일정을 만들어줘';
}
