import { describe, it, expect } from 'vitest';
import { AiPlanResponse, ReceiptResult, IndoorAlternatives, ReservationParse, RecapResult } from '../src/schemas/ai';

const item = {
  name: '센소지', category: 'sightseeing', startTime: '09:00', endTime: '10:30',
  isIndoor: false, note: null, searchQuery: '센소지 아사쿠사',
};

describe('AI schemas', () => {
  it('정상 일정 응답', () => {
    const r = AiPlanResponse.safeParse({
      reply: '만들었어요', intent: 'itinerary',
      itinerary: { days: [{ dayIndex: 0, title: '아사쿠사', items: [item] }] },
    });
    expect(r.success).toBe(true);
  });
  it('chat 응답은 itinerary null 허용', () => {
    expect(AiPlanResponse.safeParse({ reply: '네', intent: 'chat', itinerary: null }).success).toBe(true);
  });
  it('시간 형식 오류 거부', () => {
    const bad = { ...item, startTime: '9:00' };
    expect(AiPlanResponse.safeParse({
      reply: 'x', intent: 'itinerary', itinerary: { days: [{ dayIndex: 0, title: 't', items: [bad] }] },
    }).success).toBe(false);
  });
  it('알 수 없는 카테고리 거부', () => {
    const bad = { ...item, category: 'spa' };
    expect(AiPlanResponse.safeParse({
      reply: 'x', intent: 'itinerary', itinerary: { days: [{ dayIndex: 0, title: 't', items: [bad] }] },
    }).success).toBe(false);
  });
  it('하루 11개 초과 거부', () => {
    const items = Array.from({ length: 11 }, () => item);
    expect(AiPlanResponse.safeParse({
      reply: 'x', intent: 'itinerary', itinerary: { days: [{ dayIndex: 0, title: 't', items }] },
    }).success).toBe(false);
  });
  it('영수증: null 필드 허용, 통화 3글자 검증', () => {
    expect(ReceiptResult.safeParse({
      merchant: null, date: null, total: null, currency: null, categoryGuess: 'food', items: [], confidence: 0.2,
    }).success).toBe(true);
    expect(ReceiptResult.safeParse({
      merchant: 'A', date: '2026-10-09', total: 1480, currency: 'jpy', categoryGuess: 'food', items: [], confidence: 0.9,
    }).success).toBe(false);
  });
  it('실내 대안 1~3개', () => {
    const alt = { name: '박물관', category: 'sightseeing', searchQuery: '도쿄국립박물관', reason: '비 오는 날 좋아요' };
    expect(IndoorAlternatives.safeParse({ alternatives: [alt] }).success).toBe(true);
    expect(IndoorAlternatives.safeParse({ alternatives: [] }).success).toBe(false);
    expect(IndoorAlternatives.safeParse({ alternatives: [alt, alt, alt, alt] }).success).toBe(false);
  });
  it('예약 파싱: 날짜 형식', () => {
    const ok = {
      type: 'flight', title: 'ICN→NRT', startsAt: '2026-12-01T09:20', endsAt: '2026-12-01T11:45',
      confirmationNo: 'ABC123', locationName: '인천공항', amount: null, currency: null, note: null, confidence: 0.9,
    };
    expect(ReservationParse.safeParse(ok).success).toBe(true);
    expect(ReservationParse.safeParse({ ...ok, startsAt: '2026-12-01 09:20' }).success).toBe(false);
  });
  it('회고: 하이라이트 3~5개', () => {
    const base = { title: '도쿄', summary: '좋았다', dayNotes: [{ dayIndex: 0, line: '아사쿠사' }] };
    expect(RecapResult.safeParse({ ...base, highlights: ['a', 'b', 'c'] }).success).toBe(true);
    expect(RecapResult.safeParse({ ...base, highlights: ['a', 'b'] }).success).toBe(false);
  });
});
