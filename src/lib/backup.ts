import { z } from 'zod';

export const BACKUP_VERSION = 1;

const FootprintBackup = z.object({
  kind: z.enum(['country', 'region']),
  code: z.string().min(1).max(10),
  status: z.enum(['visited', 'wish']),
  period: z.string().max(20).nullable(),
  memo: z.string().max(100).nullable(),
});

/** What "내 데이터 내보내기" writes and "가져오기" accepts (no secrets, no other people's data). */
export const BackupSchema = z.object({
  app: z.literal('trip-planner'),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  nickname: z.string().trim().max(20).nullable(),
  trips: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        role: z.string(),
      }),
    )
    .max(500),
  footprints: z.array(FootprintBackup).max(5000),
});
export type Backup = z.infer<typeof BackupSchema>;

export function buildBackup(input: {
  nickname: string | null;
  trips: { id: string; title: string; start_date: string; end_date: string; role?: string }[];
  footprints: { kind: string; code: string; status: string; period: string | null; memo: string | null }[];
  now?: Date;
}): Backup {
  return {
    app: 'trip-planner',
    version: BACKUP_VERSION,
    exportedAt: (input.now ?? new Date()).toISOString(),
    nickname: input.nickname?.trim() || null,
    trips: input.trips.map((t) => ({
      id: t.id,
      title: t.title,
      startDate: t.start_date,
      endDate: t.end_date,
      role: t.role ?? 'member',
    })),
    footprints: input.footprints.map((f) => FootprintBackup.parse(f)),
  };
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; reason: 'json' | 'shape' };

/** Imports are validated like any other external input. Trips are informational and never recreated. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'json' };
  }
  const r = BackupSchema.safeParse(raw);
  return r.success ? { ok: true, backup: r.data } : { ok: false, reason: 'shape' };
}
