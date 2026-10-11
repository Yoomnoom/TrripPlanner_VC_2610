import type { ExpenseCategory, PaymentMethod } from '@/types/domain';

export const CURRENCIES = [
  'KRW',
  'JPY',
  'USD',
  'EUR',
  'CNY',
  'THB',
  'VND',
  'TWD',
  'GBP',
  'HKD',
  'SGD',
  'AUD',
] as const;
export const ZERO_DECIMAL = new Set(['KRW', 'JPY', 'VND']);

const WORD_TO_CODE: Record<string, string> = {
  엔: 'JPY',
  '¥': 'JPY',
  원: 'KRW',
  달러: 'USD',
  $: 'USD',
  유로: 'EUR',
  '€': 'EUR',
  위안: 'CNY',
  바트: 'THB',
  동: 'VND',
  파운드: 'GBP',
};

const CATEGORY_WORDS: [ExpenseCategory, RegExp][] = [
  ['food', /점심|저녁|아침|식당|밥|카페|커피|맛집|스시|라멘|술|맥주|간식|식사|디저트/],
  ['transport', /택시|버스|지하철|기차|항공|교통|전철|패스|렌트|주유|톨게이트|공항/],
  ['lodging', /호텔|숙소|숙박|에어비앤비|리조트|민박/],
  ['shopping', /쇼핑|기념품|선물|옷|면세|약국|드럭/],
  ['ticket', /입장|티켓|입장료|표\b|투어|체험/],
];

const PAYMENT_WORDS: [PaymentMethod, RegExp][] = [
  ['cash', /현금/],
  ['card', /카드/],
  ['transfer', /이체|송금/],
];

export interface QuickParse {
  title: string;
  amount?: number;
  currency?: string;
  payment?: PaymentMethod;
  category?: ExpenseCategory;
}

/**
 * Client-side parser for "점심 스시 1480엔 카드". Best effort: anything not recognised is left out,
 * and an input without a number returns just the title.
 */
export function parseQuickInput(raw: string): QuickParse {
  let text = raw.trim();
  const out: QuickParse = { title: '' };

  const code = text.match(/\b(KRW|JPY|USD|EUR|CNY|THB|VND|TWD|GBP|HKD|SGD|AUD)\b/i);
  const m =
    text.match(/([¥$€])\s*(\d[\d,]*(?:\.\d+)?)/) ??
    text.match(/(\d[\d,]*(?:\.\d+)?)\s*(엔|원|달러|유로|위안|바트|동|파운드|[A-Za-z]{3})?/);
  if (m) {
    const symbolFirst = /[¥$€]/.test(m[1]);
    const num = Number((symbolFirst ? m[2] : m[1]).replace(/,/g, ''));
    if (Number.isFinite(num) && num > 0) {
      out.amount = num;
      const unit = symbolFirst ? m[1] : m[2];
      const c = unit
        ? (WORD_TO_CODE[unit] ?? (/^[A-Za-z]{3}$/.test(unit) ? unit.toUpperCase() : undefined))
        : undefined;
      out.currency = c ?? code?.[1]?.toUpperCase();
      text = text.replace(m[0], ' ');
    }
  }
  for (const [method, re] of PAYMENT_WORDS) {
    if (re.test(text)) {
      out.payment = method;
      text = text.replace(re, ' ');
      break;
    }
  }
  for (const [cat, re] of CATEGORY_WORDS) {
    if (re.test(raw)) {
      out.category = cat;
      break;
    }
  }
  out.title = text.replace(/\s+/g, ' ').trim();
  return out;
}

export const formatKrw = (n: number) =>
  `${n < 0 ? '-' : ''}₩${Math.abs(Math.round(n)).toLocaleString('ko-KR')}`;

/** Korean short form: 62,000 → '6.2만', 1,352,500 → '135만', 120,000,000 → '1.2억'. Under 10,000 stays as is. */
export function formatCompactKrw(n: number) {
  const v = Math.abs(Math.round(n));
  const sign = n < 0 ? '-' : '';
  const trim = (x: number) => x.toFixed(1).replace(/\.0$/, '');
  if (v >= 1e8) return `${sign}${trim(v / 1e8)}억`;
  if (v >= 1e6) return `${sign}${Math.round(v / 1e4)}만`;
  if (v >= 1e4) return `${sign}${trim(v / 1e4)}만`;
  return `${sign}${v.toLocaleString('ko-KR')}`;
}

export function formatMoney(amount: number, currency: string) {
  const digits = ZERO_DECIMAL.has(currency) ? 0 : 2;
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString('ko-KR')} ${currency}`;
  }
}

/** Same rounding as the save_expense check: |amount_krw - round(amount * rate)| <= 1. */
export const toKrw = (amount: number, rate: number) => Math.round(amount * rate);

/** Splits `totalKrw` by weights; rounding leftovers go to the payer (or the first participant). */
export function splitByWeights(
  totalKrw: number,
  weights: Record<string, number>,
  payerId: string,
): Record<string, number> {
  const ids = Object.keys(weights).filter((id) => weights[id] > 0);
  if (ids.length === 0) throw new Error('participants required');
  const sum = ids.reduce((s, id) => s + weights[id], 0);
  const out: Record<string, number> = {};
  let used = 0;
  for (const id of ids) {
    out[id] = Math.floor((totalKrw * weights[id]) / sum);
    used += out[id];
  }
  out[ids.includes(payerId) ? payerId : ids[0]] += totalKrw - used;
  return out;
}
