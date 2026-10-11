/** Single source for values shared by the app and Edge Functions (Deno-safe, no imports). */
export const PLACE_CATEGORIES = [
  'food',
  'cafe',
  'sightseeing',
  'shopping',
  'activity',
  'lodging',
  'transport',
  'other',
] as const;
