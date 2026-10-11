import type { AiClient, AiRequest } from './types.ts';

/**
 * Deterministic stand-in for a real model (env AI_FAKE=1). It lets the chat -> proposal -> apply flow run end to
 * end without any key. It reads the CONTEXT JSON the app sends and returns a schema-valid itinerary.
 */
export function createFakeClient(): AiClient {
  return {
    async call(req: AiRequest) {
      if (req.jsonSchema && (req.jsonSchema as { required?: string[] }).required?.includes('ok')) {
        return JSON.stringify({ ok: true });
      }
      if ((req.jsonSchema as { required?: string[] }).required?.includes('alternatives')) {
        return JSON.stringify({
          alternatives: ['국립 박물관', '실내 수족관', '대형 쇼핑몰'].map((name) => ({
            name,
            category: 'sightseeing',
            searchQuery: `${name} 도쿄`,
            reason: '비를 피해 편하게 둘러볼 수 있어요',
          })),
        });
      }
      const ctx = req.user.match(/^CONTEXT: (.*)$/m);
      const context = ctx
        ? (JSON.parse(ctx[1]) as { trip?: { dayCount?: number; destinations?: { city?: string | null }[] } })
        : {};
      const days = Math.max(1, Math.min(context.trip?.dayCount ?? 1, 7));
      const city = context.trip?.destinations?.[0]?.city ?? '도쿄';
      const wantsPlan = /일정|코스|짜|만들|추천|수정|바꿔/.test(req.user.split('요청:').pop() ?? '');
      if (!wantsPlan) {
        return JSON.stringify({
          reply: '테스트용 가짜 AI예요. 일정을 만들어 달라고 해 보세요.',
          intent: 'chat',
          itinerary: null,
        });
      }
      const item = (name: string, category: string, s: string, e: string) => ({
        name,
        category,
        startTime: s,
        endTime: e,
        isIndoor: category === 'food' || category === 'cafe' ? true : null,
        note: null,
        searchQuery: `${name} ${city}`,
      });
      return JSON.stringify({
        reply: `${days}일 일정을 만들었어요. (테스트용 가짜 AI)`,
        intent: 'itinerary',
        itinerary: {
          days: Array.from({ length: days }, (_, i) => ({
            dayIndex: i,
            title: `${city} ${i + 1}일차`,
            items: [
              item(`${city} 아침 산책 ${i + 1}`, 'sightseeing', '09:00', '10:30'),
              item(`${city} 점심 맛집 ${i + 1}`, 'food', '12:00', '13:00'),
              item(`${city} 카페 ${i + 1}`, 'cafe', '15:00', '16:00'),
              item(`${city} 저녁 식당 ${i + 1}`, 'food', '18:30', '20:00'),
            ],
          })),
        },
      });
    },
  };
}

/** Coordinates near a center for fake place resolution (deterministic by name). */
export function fakeCoords(name: string, center: { lat: number; lng: number }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 1000;
  return {
    lat: center.lat + ((h % 40) - 20) * 0.001,
    lng: center.lng + ((Math.floor(h / 40) % 40) - 20) * 0.001,
  };
}
