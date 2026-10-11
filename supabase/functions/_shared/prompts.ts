import { PLACE_CATEGORIES } from './domain.ts';

/** ai-plan system prompt (SPEC C-5). */
export const PLAN_SYSTEM = `너는 개인 여행 플래너의 일정 설계 도우미다. 항상 한국어로 답한다.
출력은 지정된 JSON 스키마만 사용하고 JSON 밖에는 아무 글자도 쓰지 않는다.

[규칙]
- 사용자가 일정을 만들거나 고쳐 달라고 하면 intent="itinerary"와 itinerary를 채우고, 단순 질문이면 intent="chat", itinerary=null.
- 일정은 여행 일수와 같은 수의 day를 만들고 dayIndex는 0부터 시작한다.
- 하루 3~6개 장소, 시간은 24시간제 "HH:mm". 식사는 식사 시간대(아침 08~09, 점심 12~13, 저녁 18~19)에 둔다.
- 같은 날 장소는 지리적으로 가까운 순서로 묶고, 이동 시간을 고려해 사이에 여유를 둔다.
- 실제로 존재하는 유명하고 검증 가능한 장소만 쓴다. 불확실하면 쓰지 않는다.
- searchQuery는 "정확한 상호명 + 도시/동네" 형태로 쓴다.
- category는 food, cafe, sightseeing, shopping, activity, lodging, transport, other 중 하나.
- isIndoor는 확실하지 않으면 null.
- 이미 있는 일정(CONTEXT.currentItinerary)을 수정하라는 요청이면 수정이 반영된 "전체 일정"을 반환한다.
- 날씨·환율 정보는 CONTEXT에 주어진 값만 사용한다. 없으면 모른다고 말하고 추측하지 않는다.
- 비자·입국 규정은 변할 수 있으니 일반 안내 후 "공식 사이트에서 확인하세요"를 덧붙인다.
- reply는 3문장 이내로, 일정을 만들었다면 일차별 한 줄 요약을 포함한다.
- CONTEXT.planningPrefs를 반영한다. pace가 relaxed면 하루 3곳 이내, busy면 6곳 이상.
- CONTEXT.mustInclude(아이디어 보관함·사용자 지정 장소)는 반드시 일정에 포함하고, 불가하면 reply에 이유를 쓴다.
- avoid 항목에 해당하는 장소는 넣지 않는다.
- 대화 중 선호가 바뀌면(예: "더 느긋하게") prefsPatch에 바뀐 항목만 채우고 나머지는 null, 바뀐 게 없으면 prefsPatch는 null이다.`;

export const buildPlanUser = (context: unknown, message: string) =>
  `CONTEXT: ${JSON.stringify(context)}\n\n요청: ${message}`;

const nullable = (type: string, extra: Record<string, unknown> = {}) => ({ type: [type, 'null'], ...extra });
const PREFS_SCHEMA = {
  anyOf: [
    { type: 'null' },
    {
      type: 'object',
      additionalProperties: false,
      required: ['companions', 'pace', 'themes', 'transport', 'avoid', 'mustInclude'],
      properties: {
        companions: nullable('string', {
          enum: ['solo', 'couple', 'friends', 'family', 'kids', 'parents', null],
        }),
        pace: nullable('string', { enum: ['relaxed', 'normal', 'busy', null] }),
        themes: nullable('array', { items: { type: 'string' } }),
        transport: nullable('string', { enum: ['public', 'car', null] }),
        avoid: nullable('array', { items: { type: 'string' } }),
        mustInclude: nullable('array', { items: { type: 'string' } }),
      },
    },
  ],
};
const HHMM = { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' };

const itemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'category', 'startTime', 'endTime', 'isIndoor', 'note', 'searchQuery'],
  properties: {
    name: { type: 'string' },
    category: { type: 'string', enum: [...PLACE_CATEGORIES] },
    startTime: HHMM,
    endTime: HHMM,
    isIndoor: nullable('boolean'),
    note: nullable('string'),
    searchQuery: { type: 'string' },
  },
};

/** JSON Schema twin of AiPlanResponse for provider structured output (strict-compatible). */
export const PLAN_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'intent', 'itinerary', 'prefsPatch'],
  properties: {
    reply: { type: 'string' },
    prefsPatch: PREFS_SCHEMA,
    intent: { type: 'string', enum: ['chat', 'itinerary'] },
    itinerary: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['days'],
          properties: {
            days: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['dayIndex', 'title', 'items'],
                properties: {
                  dayIndex: { type: 'integer' },
                  title: { type: 'string' },
                  items: { type: 'array', items: itemSchema },
                },
              },
            },
          },
        },
      ],
    },
  },
};

/** ai-indoor-swap (SPEC C-5). */
export const INDOOR_SYSTEM = `다음 장소를 대체할 수 있는 같은 지역의 **실내** 장소 3곳을 제안한다. 같은 시간대에 방문 가능하고 이동이 짧은 곳을 우선한다. 비 오는 날 방문하기 좋은 이유를 reason에 한 줄로 쓴다.
실제로 존재하는 유명하고 검증 가능한 장소만 쓰고, searchQuery는 "정확한 상호명 + 도시/동네" 형태로 쓴다. 항상 한국어로 답하고 JSON 스키마만 출력한다.`;

export const buildIndoorUser = (p: {
  name: string;
  category: string;
  address: string | null;
  startTime: string | null;
}) => `대체할 장소: ${JSON.stringify(p)}`;

/** JSON Schema twin of IndoorAlternatives. */
export const INDOOR_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['alternatives'],
  properties: {
    alternatives: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'category', 'searchQuery', 'reason'],
        properties: {
          name: { type: 'string' },
          category: { type: 'string', enum: [...PLACE_CATEGORIES] },
          searchQuery: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
};

/** ai-receipt (SPEC C-5). */
export const RECEIPT_SYSTEM = `이미지는 영수증이다. 상호명, 날짜(YYYY-MM-DD), 합계 금액(숫자만), 통화(ISO 4217 3글자), 분류 추정, 품목을 JSON 스키마대로 추출한다. 보이지 않는 값은 null. 금액에서 천 단위 구분 기호는 제거한다. 추정이 불확실하면 confidence를 낮춘다.
분류(categoryGuess)는 transport, lodging, food, shopping, ticket, other 중 하나. 항상 JSON 스키마만 출력한다.`;

/** JSON Schema twin of ReceiptResult. */
export const RECEIPT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['merchant', 'date', 'total', 'currency', 'categoryGuess', 'items', 'confidence'],
  properties: {
    merchant: nullable('string'),
    date: nullable('string', { pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
    total: nullable('number'),
    currency: nullable('string', { pattern: '^[A-Z]{3}$' }),
    categoryGuess: { type: 'string', enum: ['transport', 'lodging', 'food', 'shopping', 'ticket', 'other'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'amount'],
        properties: { name: { type: 'string' }, amount: { type: 'number' } },
      },
    },
    confidence: { type: 'number' },
  },
};

/** Tiny schema for the connection test. */
export const PING_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok'],
  properties: { ok: { type: 'boolean' } },
};
