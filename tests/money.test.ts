import { describe, expect, it } from 'vitest';
import { formatCompactKrw, formatKrw, parseQuickInput, splitByWeights, toKrw } from '@/lib/money';
import { splitEqual } from '@/lib/settlement';
import { budgetProgress, byCategory, byDay, byMember, percentages, topExpenses } from '@/lib/expenseStats';

describe('parseQuickInput', () => {
  it('parses the reference example', () => {
    expect(parseQuickInput('점심 스시 1480엔 카드')).toEqual({
      title: '점심 스시',
      amount: 1480,
      currency: 'JPY',
      payment: 'card',
      category: 'food',
    });
  });
  it('handles symbols, commas, codes and decimals', () => {
    expect(parseQuickInput('택시 ¥1,200 현금')).toMatchObject({
      amount: 1200,
      currency: 'JPY',
      payment: 'cash',
      category: 'transport',
    });
    expect(parseQuickInput('기념품 $12.5')).toMatchObject({
      amount: 12.5,
      currency: 'USD',
      category: 'shopping',
    });
    expect(parseQuickInput('hotel 30000 KRW')).toMatchObject({ amount: 30000, currency: 'KRW' });
  });
  it('returns only the title when there is no number', () => {
    expect(parseQuickInput('커피')).toEqual({ title: '커피', category: 'food' });
    expect(parseQuickInput('   ')).toEqual({ title: '' });
  });
});

describe('formatting', () => {
  it('formats won and compact won', () => {
    expect(formatKrw(1352500)).toBe('₩1,352,500');
    expect(formatKrw(-500)).toBe('-₩500');
    expect(formatCompactKrw(62000)).toBe('6.2만');
    expect(formatCompactKrw(1352500)).toBe('135만');
    expect(formatCompactKrw(120000000)).toBe('1.2억');
    expect(formatCompactKrw(9500)).toBe('9,500');
  });
  it('converts with rounding that passes the RPC check', () => {
    expect(toKrw(1480, 9.2)).toBe(13616);
    expect(Math.abs(toKrw(12.5, 1380.55) - Math.round(12.5 * 1380.55))).toBeLessThanOrEqual(1);
  });
});

describe('splitByWeights', () => {
  it('keeps the total and gives the remainder to the payer', () => {
    const r = splitByWeights(10000, { a: 1, b: 1, c: 1 }, 'a');
    expect(r).toEqual({ a: 3334, b: 3333, c: 3333 });
  });
  it('matches splitEqual for equal weights', () => {
    expect(splitByWeights(10001, { a: 1, b: 1, c: 1 }, 'b')).toEqual(splitEqual(10001, ['a', 'b', 'c'], 'b'));
  });
  it('supports ratios and ignores zero weights', () => {
    const r = splitByWeights(1000, { a: 70, b: 30, c: 0 }, 'a');
    expect(r).toEqual({ a: 700, b: 300 });
  });
  it('rejects empty participants', () => {
    expect(() => splitByWeights(100, { a: 0 }, 'a')).toThrow();
  });
  it('always sums to the total (random)', () => {
    for (let k = 0; k < 200; k++) {
      const total = Math.floor(Math.random() * 1_000_000);
      const w = {
        a: 1 + Math.floor(Math.random() * 9),
        b: 1 + Math.floor(Math.random() * 9),
        c: 1 + Math.floor(Math.random() * 9),
      };
      expect(Object.values(splitByWeights(total, w, 'b')).reduce((s, v) => s + v, 0)).toBe(total);
    }
  });
});

describe('expense stats', () => {
  const ex = [
    { id: '1', category: 'transport', amountKrw: 380, dayIndex: 0, paidBy: 'a' },
    { id: '2', category: 'lodging', amountKrw: 330, dayIndex: 0, paidBy: 'a' },
    { id: '3', category: 'food', amountKrw: 210, dayIndex: 1, paidBy: 'b' },
    { id: '4', category: 'shopping', amountKrw: 50, dayIndex: null, paidBy: 'b' },
    { id: '5', category: 'ticket', amountKrw: 30, dayIndex: 1, paidBy: 'b' },
  ];
  it('percentages add up to 100', () => {
    expect(percentages([1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(100);
    expect(percentages([0, 0])).toEqual([0, 0]);
    expect(byCategory(ex).map((c) => c.pct)).toEqual([38, 33, 21, 5, 3]);
  });
  it('groups by member share', () => {
    const m = byMember([
      { expenseId: '1', memberId: 'a', shareKrw: 300 },
      { expenseId: '1', memberId: 'b', shareKrw: 100 },
      { expenseId: '2', memberId: 'a', shareKrw: 100 },
    ]);
    expect(m).toEqual([
      { key: 'a', krw: 400, pct: 80 },
      { key: 'b', krw: 100, pct: 20 },
    ]);
  });
  it('sums per day with a category filter and skips undated', () => {
    expect(byDay(ex, 3)).toEqual([710, 240, 0]);
    expect(byDay(ex, 3, 'food')).toEqual([0, 210, 0]);
  });
  it('lists top expenses with their share and tracks the budget', () => {
    expect(topExpenses(ex, 2).map((t) => [t.expense.id, t.pct])).toEqual([
      ['1', 38],
      ['2', 33],
    ]);
    expect(budgetProgress(500, 1000)).toEqual({ pct: 50, over: false, left: 500 });
    expect(budgetProgress(1500, 1000)).toMatchObject({ pct: 100, over: true, left: -500 });
    expect(budgetProgress(10, null)).toBeNull();
  });
});
