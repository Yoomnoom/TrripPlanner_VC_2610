import { z } from 'zod';
import { PLACE_CATEGORIES } from '../types/domain';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const AiItem = z.object({
  name: z.string().min(1).max(80),
  category: z.enum(PLACE_CATEGORIES),
  startTime: hhmm,
  endTime: hhmm,
  isIndoor: z.boolean().nullable(),
  note: z.string().max(200).nullable(),
  searchQuery: z.string().min(1).max(120),   // Places 검색용 "상호명 + 지역"
});
export const AiDay = z.object({
  dayIndex: z.number().int().min(0),
  title: z.string().max(60),
  items: z.array(AiItem).min(1).max(10),
});
export const AiPlanResponse = z.object({
  reply: z.string(),                          // 채팅에 보여줄 한국어 답변
  intent: z.enum(['chat', 'itinerary']),
  itinerary: z.object({ days: z.array(AiDay).min(1) }).nullable(),
});
export type AiPlanResponse = z.infer<typeof AiPlanResponse>;

export const ReceiptResult = z.object({
  merchant: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  total: z.number().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  categoryGuess: z.enum(['transport','lodging','food','shopping','ticket','other']),
  items: z.array(z.object({ name: z.string(), amount: z.number() })).max(50),
  confidence: z.number().min(0).max(1),
});

export const IndoorAlternatives = z.object({
  alternatives: z.array(z.object({
    name: z.string(), category: z.enum(PLACE_CATEGORIES),
    searchQuery: z.string(), reason: z.string().max(80),
  })).min(1).max(3),
});

export const ReservationParse = z.object({
    type: z.enum(['flight','lodging','transport','restaurant','ticket','other']),
    title: z.string().max(100),
    startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable(), // 현지 벽시계, tz 없음
    endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable(),
    confirmationNo: z.string().nullable(),
    locationName: z.string().nullable(),     // 숙소명/공항/식당
    amount: z.number().nonnegative().nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    note: z.string().max(300).nullable(),
    confidence: z.number().min(0).max(1),
  });

export const RecapResult = z.object({
    title: z.string().max(60),
    summary: z.string().max(500),
    highlights: z.array(z.string().max(80)).min(3).max(5),
    dayNotes: z.array(z.object({ dayIndex: z.number().int().min(0), line: z.string().max(120) })),
  });
