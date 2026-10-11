import { PLACE_CATEGORIES } from '../../supabase/functions/_shared/domain.ts';

export { PLACE_CATEGORIES };
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const EXPENSE_CATEGORIES = ['transport', 'lodging', 'food', 'shopping', 'ticket', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type TravelMode = 'walk' | 'transit' | 'drive';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';

export const LABELS_KO = {
  food: '식사',
  cafe: '카페',
  sightseeing: '관광',
  shopping: '쇼핑',
  activity: '액티비티',
  lodging: '숙소',
  transport: '이동',
  other: '기타',
  ticket: '입장료',
} as const;
