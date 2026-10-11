import type { z } from 'zod';
import { RecapResult } from '@/schemas/ai';

export type Recap = z.infer<typeof RecapResult>;

/** `trips.recap` is jsonb: only a schema-valid recap is ever shown. */
export const parseRecap = (v: unknown): Recap | null => {
  const r = RecapResult.safeParse(v);
  return r.success ? r.data : null;
};
