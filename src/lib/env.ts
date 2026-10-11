import { z } from 'zod';

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
});

const parsed = EnvSchema.safeParse(import.meta.env);

/** Public client env only. `null` when .env.local is missing or incomplete. */
export const env = parsed.success ? parsed.data : null;

const optional = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/**
 * Optional public Google settings. Features switch on by detecting these (no code change needed):
 * with a browser key the map, Places provider and Routes provider turn on.
 */
export const googleEnv = {
  browserKey: optional(import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY),
  mapId: optional(import.meta.env.VITE_GOOGLE_MAP_ID),
};

export const googleEnabled = googleEnv.browserKey !== null;
