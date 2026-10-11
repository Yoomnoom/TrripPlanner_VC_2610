import { z } from 'zod';

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
});

const parsed = EnvSchema.safeParse(import.meta.env);

/** Public client env only. `null` when .env.local is missing or incomplete. */
export const env = parsed.success ? parsed.data : null;
