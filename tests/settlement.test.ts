import { describe, it, expect } from 'vitest';
import { computeBalances, minimizeTransfers, splitEqual } from '../src/lib/settlement';

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

describe('settlement', () => {
  it('1. A가 30,000원 결제, 3명 균등', () => {
    const split = splitEqual(30000, ['A', 'B', 'C'], 'A');
    const bal = computeBalances(
      ['A', 'B', 'C'],
      [{ id: 'e1', paidBy: 'A', amountKrw: 30000 }],
      Object.entries(split).map(([memberId, shareKrw]) => ({ expenseId: 'e1', memberId, shareKrw })),
      [],
    );
    expect(bal).toEqual({ A: 20000, B: -10000, C: -10000 });
    const t = minimizeTransfers(bal);
    expect(t).toHaveLength(2);
    expect(t).toContainEqual({ from: 'B', to: 'A', amountKrw: 10000 });
    expect(t).toContainEqual({ from: 'C', to: 'A', amountKrw: 10000 });
  });

  it('2. 10,000원 3명 균등, 나머지는 결제자', () => {
    const s = splitEqual(10000, ['A', 'B', 'C'], 'A');
    expect(s).toEqual({ A: 3334, B: 3333, C: 3333 });
    expect(sum(s)).toBe(10000);
  });

  it('2b. 결제자가 참여자가 아니면 첫 참여자가 나머지를 부담', () => {
    const s = splitEqual(10000, ['B', 'C', 'D'], 'A');
    expect(s).toEqual({ B: 3334, C: 3333, D: 3333 });
  });

  it('3. 정산 완료 반영', () => {
    const bal = computeBalances(
      ['A', 'B', 'C'],
      [{ id: 'e1', paidBy: 'A', amountKrw: 30000 }],
      [
        { expenseId: 'e1', memberId: 'A', shareKrw: 10000 },
        { expenseId: 'e1', memberId: 'B', shareKrw: 10000 },
        { expenseId: 'e1', memberId: 'C', shareKrw: 10000 },
      ],
      [{ fromMember: 'B', toMember: 'A', amountKrw: 10000 }],
    );
    expect(bal.B).toBe(0);
    expect(minimizeTransfers(bal)).toEqual([{ from: 'C', to: 'A', amountKrw: 10000 }]);
  });

  it('4. 결제자가 분담자에 없는 경우', () => {
    const bal = computeBalances(
      ['A', 'B', 'C'],
      [{ id: 'e1', paidBy: 'A', amountKrw: 20000 }],
      [
        { expenseId: 'e1', memberId: 'B', shareKrw: 10000 },
        { expenseId: 'e1', memberId: 'C', shareKrw: 10000 },
      ],
      [],
    );
    expect(bal).toEqual({ A: 20000, B: -10000, C: -10000 });
  });

  it('5. 속성: 잔액 합 0, 송금 후 모두 0', () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    for (let run = 0; run < 200; run++) {
      const ids = ['A', 'B', 'C', 'D', 'E'].slice(0, 2 + Math.floor(rnd() * 4));
      const expenses = [];
      const splits = [];
      for (let i = 0; i < 1 + Math.floor(rnd() * 8); i++) {
        const total = 1000 + Math.floor(rnd() * 90000);
        const payer = ids[Math.floor(rnd() * ids.length)];
        const parts = ids.filter(() => rnd() > 0.3);
        const part = parts.length ? parts : [ids[0]];
        expenses.push({ id: `e${i}`, paidBy: payer, amountKrw: total });
        for (const [memberId, shareKrw] of Object.entries(splitEqual(total, part, payer)))
          splits.push({ expenseId: `e${i}`, memberId, shareKrw });
      }
      const bal = computeBalances(ids, expenses, splits, []);
      expect(sum(bal)).toBe(0);
      const after = { ...bal };
      for (const t of minimizeTransfers(bal)) {
        after[t.from] += t.amountKrw;
        after[t.to] -= t.amountKrw;
        expect(t.amountKrw).toBeGreaterThan(0);
      }
      for (const v of Object.values(after)) expect(v).toBe(0);
    }
  });

  it('6. 영상 예시: 인서 → 지우 109,250', () => {
    const bal = { 지우: 109250, 인서: -109250 };
    expect(minimizeTransfers(bal)).toEqual([{ from: '인서', to: '지우', amountKrw: 109250 }]);
  });

  it('참여자가 없으면 오류', () => {
    expect(() => splitEqual(1000, [], 'A')).toThrow();
  });
});
