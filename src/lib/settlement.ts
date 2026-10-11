export type Id = string;
export interface ExpenseLite {
  id: Id;
  paidBy: Id;
  amountKrw: number;
}
export interface SplitLite {
  expenseId: Id;
  memberId: Id;
  shareKrw: number;
}
export interface SettlementLite {
  fromMember: Id;
  toMember: Id;
  amountKrw: number;
}
export interface Transfer {
  from: Id;
  to: Id;
  amountKrw: number;
}

/** +면 받을 돈, -면 줄 돈. 정산 완료분 반영. */
export function computeBalances(
  memberIds: Id[],
  expenses: ExpenseLite[],
  splits: SplitLite[],
  settlements: SettlementLite[],
): Record<Id, number> {
  const bal: Record<Id, number> = Object.fromEntries(memberIds.map((id) => [id, 0]));
  const add = (id: Id, v: number) => {
    bal[id] = (bal[id] ?? 0) + v;
  };
  for (const e of expenses) add(e.paidBy, e.amountKrw);
  for (const s of splits) add(s.memberId, -s.shareKrw);
  for (const t of settlements) {
    add(t.fromMember, t.amountKrw);
    add(t.toMember, -t.amountKrw);
  }
  return bal;
}

/** 탐욕적 최소 송금. 큰 채무자 ↔ 큰 채권자부터 매칭. */
export function minimizeTransfers(balances: Record<Id, number>): Transfer[] {
  const creditors: { id: Id; amt: number }[] = [];
  const debtors: { id: Id; amt: number }[] = [];
  for (const [id, v] of Object.entries(balances)) {
    if (v > 0) creditors.push({ id, amt: v });
    else if (v < 0) debtors.push({ id, amt: -v });
  }
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);
  const out: Transfer[] = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    out.push({ from: debtors[i].id, to: creditors[j].id, amountKrw: pay });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }
  return out;
}

/** 균등 분담. 나머지 원 단위는 결제자(참여자일 때) 또는 첫 참여자에게. */
export function splitEqual(totalKrw: number, participantIds: Id[], payerId: Id): Record<Id, number> {
  const n = participantIds.length;
  if (n === 0) throw new Error('participants required');
  const base = Math.floor(totalKrw / n);
  const rem = totalKrw - base * n;
  const out: Record<Id, number> = Object.fromEntries(participantIds.map((id) => [id, base]));
  out[participantIds.includes(payerId) ? payerId : participantIds[0]] += rem;
  return out;
}
