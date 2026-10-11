import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { copy } from '@/copy';
import { btn, inputCls } from '@/components/styles';
import { Field } from '@/components/ui-kit';
import type { Member } from '@/features/trips/api';
import { aiErrorMessage, functionErrorCode } from '@/features/chat/api';
import { getFxRate } from '@/lib/fx';
import { receiptPath as makeReceiptPath } from '@/lib/files';
import { resizeToJpeg } from '@/lib/image';
import { supabase } from '@/lib/supabase';
import { CURRENCIES, formatKrw, formatMoney, parseQuickInput, splitByWeights, toKrw } from '@/lib/money';
import { dayIndexOf, dayYmd, formatMdWeekday } from '@/lib/trip';
import { EXPENSE_CATEGORIES, LABELS_KO, type ExpenseCategory, type PaymentMethod } from '@/types/domain';
import type { z } from 'zod';
import type { ReceiptResult as ReceiptSchema } from '@/schemas/ai';
import type { ExpenseInput, ExpenseWithSplits } from './api';

const LAST_CURRENCY = 'tp:last-currency';
const lastCurrency = () => {
  try {
    return localStorage.getItem(LAST_CURRENCY) ?? 'KRW';
  } catch {
    return 'KRW';
  }
};

type ReceiptResult = z.infer<typeof ReceiptSchema>;
type Mode = 'equal' | 'ratio' | 'amount';

export type ExpensePrefill = Partial<
  Pick<
    ExpenseInput,
    'title' | 'amount' | 'currency' | 'category' | 'spent_on' | 'receipt_path' | 'place_label'
  >
>;

export interface FormContext {
  members: Member[];
  meId: string | null;
  tripId: string;
  tripStart: string;
  dayCount: number;
  /** Today's Day index when the trip is under way, else null. */
  todayIndex: number | null;
  places: { id: string; name: string }[];
}

/** Add/edit an expense. Submits a complete ExpenseInput; the splits always sum to amount_krw. */
export function ExpenseForm({
  ctx,
  initial,
  onSubmit,
  prefill,
}: {
  ctx: FormContext;
  initial?: ExpenseWithSplits;
  onSubmit: (input: ExpenseInput) => void;
  /** Values to pre-fill a NEW expense (e.g. receipt recognition, reservation link). User still confirms. */
  prefill?: Partial<
    Pick<
      ExpenseInput,
      'title' | 'amount' | 'currency' | 'category' | 'spent_on' | 'receipt_path' | 'place_label'
    >
  >;
}) {
  const editing = !!initial;
  const [id] = useState(() => initial?.id ?? crypto.randomUUID());
  const [quick, setQuick] = useState('');
  const [more, setMore] = useState(editing);
  const [title, setTitle] = useState(initial?.title ?? prefill?.title ?? '');
  const [amount, setAmount] = useState(
    initial ? String(initial.amount) : prefill?.amount ? String(prefill.amount) : '',
  );
  const [currency, setCurrency] = useState(initial?.currency ?? prefill?.currency ?? lastCurrency());
  const [rate, setRate] = useState(initial ? String(initial.exchange_rate) : currency === 'KRW' ? '1' : '');
  const [rateNote, setRateNote] = useState('');
  const [category, setCategory] = useState<string>(initial?.category ?? prefill?.category ?? 'food');
  const [payment, setPayment] = useState<string>(initial?.payment_method ?? 'card');
  const [day, setDay] = useState<number | null>(
    initial
      ? initial.day_index
      : prefill?.spent_on
        ? dayIndexOf(ctx.tripStart, prefill.spent_on, ctx.dayCount)
        : ctx.todayIndex,
  );
  const [spentOn, setSpentOn] = useState<string | null>(initial?.spent_on ?? prefill?.spent_on ?? null);
  const [receipt, setReceipt] = useState<string | null>(
    initial?.receipt_path ?? prefill?.receipt_path ?? null,
  );
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptMsg, setReceiptMsg] = useState('');
  const [paidBy, setPaidBy] = useState(initial?.paid_by ?? ctx.meId ?? ctx.members[0]?.id ?? '');
  const [placeId, setPlaceId] = useState<string | null>(initial?.place_id ?? null);
  const [placeLabel, setPlaceLabel] = useState(initial?.place_label ?? prefill?.place_label ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');

  const everyone = useMemo(() => new Set(ctx.members.map((m) => m.id)), [ctx.members]);
  const [mode, setMode] = useState<Mode>(() => {
    if (!initial) return 'equal';
    const shares = initial.expense_splits.map((s) => Number(s.share_krw));
    return Math.max(...shares) - Math.min(...shares) <= 1 ? 'equal' : 'amount';
  });
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(initial ? initial.expense_splits.map((s) => s.member_id) : everyone),
  );
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    Object.fromEntries((initial?.expense_splits ?? []).map((s) => [s.member_id, String(s.share_krw)])),
  );
  const [weights, setWeights] = useState<Record<string, string>>({});

  // Latest-request-wins guard so a slow response for an old currency cannot overwrite the rate.
  const rateReq = useRef(0);
  const loadRate = (c: string) => {
    const req = ++rateReq.current;
    void getFxRate(c).then((r) => {
      if (req !== rateReq.current) return;
      if (r) {
        setRate(String(r.rate));
        setRateNote(r.stale ? copy.expenses.rateStale(r.date) : copy.expenses.rateAsOf(r.date));
      } else {
        setRate('');
        setRateNote(copy.expenses.rateManual);
      }
    });
  };
  const pickCurrency = (c: string) => {
    setCurrency(c);
    if (c === 'KRW') {
      rateReq.current++;
      setRate('1');
      setRateNote('');
    } else if (!(initial && c === initial.currency)) loadRate(c);
    else {
      rateReq.current++;
      setRate(String(initial.exchange_rate));
      setRateNote('');
    }
  };
  // First rate for the remembered/pre-filled currency of a new expense.
  useEffect(() => {
    if (!initial && currency !== 'KRW') loadRate(currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  /** Photo -> resize -> Storage -> ai-receipt -> pre-fill only. The user still checks and saves. */
  const readReceipt = async (file: File) => {
    if (!supabase) return;
    setReceiptBusy(true);
    setReceiptMsg('');
    try {
      const blob = await resizeToJpeg(file);
      const path = makeReceiptPath(ctx.tripId, crypto.randomUUID());
      const up = await supabase.storage.from('receipts').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      setReceipt(path);
      const { data, error } = await supabase.functions.invoke('ai-receipt', {
        body: { tripId: ctx.tripId, imagePath: path },
      });
      if (error) {
        setReceiptMsg(`${aiErrorMessage(await functionErrorCode(error))} ${copy.expenses.receiptManual}`);
        return;
      }
      const r = (data as { data: { receipt: ReceiptResult } }).data.receipt;
      if (r.merchant) setTitle(r.merchant);
      if (r.total !== null) setAmount(String(r.total));
      if (r.currency && (CURRENCIES as readonly string[]).includes(r.currency)) pickCurrency(r.currency);
      setCategory(r.categoryGuess);
      if (r.date) {
        setSpentOn(r.date);
        setDay(dayIndexOf(ctx.tripStart, r.date, ctx.dayCount));
      }
      setMore(true);
      setReceiptMsg(r.confidence < 0.5 ? copy.expenses.receiptLow : copy.expenses.receiptFilled);
    } catch {
      setReceiptMsg(`${copy.expenses.receiptFailed} ${copy.expenses.receiptManual}`);
    } finally {
      setReceiptBusy(false);
    }
  };

  const applyQuick = (text: string) => {
    setQuick(text);
    const p = parseQuickInput(text);
    if (p.title) setTitle(p.title);
    if (p.amount) setAmount(String(p.amount));
    if (p.currency && (CURRENCIES as readonly string[]).includes(p.currency)) pickCurrency(p.currency);
    if (p.payment) setPayment(p.payment);
    if (p.category) setCategory(p.category);
  };

  const amountNum = Number(amount);
  const rateNum = Number(rate);
  const validMoney = amountNum > 0 && rateNum > 0;
  const krw = validMoney ? toKrw(amountNum, rateNum) : 0;

  const { splits, error } = useMemo(() => {
    if (!validMoney) return { splits: [] as { member_id: string; share_krw: number }[], error: '' };
    const ids = ctx.members.map((m) => m.id);
    if (mode === 'amount') {
      const rows = ids
        .map((m) => ({ member_id: m, share_krw: Math.round(Number(custom[m] ?? 0)) }))
        .filter((r) => r.share_krw > 0);
      const sum = rows.reduce((s, r) => s + r.share_krw, 0);
      return { splits: rows, error: sum === krw ? '' : copy.expenses.splitRemaining(krw - sum) };
    }
    const w: Record<string, number> = {};
    for (const m of ids) {
      if (!picked.has(m)) continue;
      w[m] = mode === 'ratio' ? Number(weights[m] ?? 0) : 1;
    }
    if (!Object.values(w).some((v) => v > 0)) return { splits: [], error: copy.expenses.splitNobody };
    const r = splitByWeights(krw, w, paidBy);
    return {
      splits: Object.entries(r).map(([member_id, share_krw]) => ({ member_id, share_krw })),
      error: '',
    };
  }, [validMoney, krw, mode, picked, custom, weights, ctx.members, paidBy]);

  const canSubmit = title.trim() !== '' && validMoney && !error && splits.length > 0 && paidBy !== '';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      localStorage.setItem(LAST_CURRENCY, currency);
    } catch {
      // remembering the currency is a convenience only
    }
    onSubmit({
      id,
      day_index: day,
      spent_on: spentOn ?? (day !== null ? dayYmd(ctx.tripStart, day) : null),
      title: title.trim(),
      category,
      amount: amountNum,
      currency,
      exchange_rate: rateNum,
      amount_krw: krw,
      payment_method: payment,
      paid_by: paidBy,
      place_id: placeId,
      place_label: placeLabel.trim() || null,
      memo: memo.trim() || null,
      receipt_path: receipt,
      splits,
    });
  };

  const sel = inputCls;
  return (
    <form onSubmit={submit} className="grid gap-3">
      {!editing && (
        <Field label={copy.expenses.quick} hint={copy.expenses.quickHint}>
          <input
            autoFocus
            className={inputCls}
            value={quick}
            placeholder={copy.expenses.quickPlaceholder}
            onChange={(e) => applyQuick(e.target.value)}
          />
        </Field>
      )}

      <div className="grid gap-1">
        <label className={`${btn.ghost} cursor-pointer ${receiptBusy ? 'opacity-50' : ''}`}>
          {receiptBusy ? copy.expenses.receiptReading : copy.expenses.receiptButton}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            disabled={receiptBusy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void readReceipt(file);
            }}
          />
        </label>
        {receipt && !receiptMsg && <p className="text-xs text-muted">{copy.expenses.receiptAttached}</p>}
        {receiptMsg && (
          <p role="status" className="text-sm font-semibold text-muted">
            {receiptMsg}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label={copy.expenses.chips}>
        {validMoney && (
          <Chip>
            {formatMoney(amountNum, currency)}
            {currency !== 'KRW' && ` ≈ ${formatKrw(krw)}`}
          </Chip>
        )}
        <Chip>{currency}</Chip>
        <Chip>{LABELS_KO[category as ExpenseCategory] ?? category}</Chip>
        <Chip>{copy.expenses.payment[payment as PaymentMethod] ?? payment}</Chip>
        <Chip>{day === null ? copy.expenses.noDay : copy.plan.dayTitle(day + 1)}</Chip>
      </div>

      <Field label={copy.expenses.title}>
        <input
          required
          className={inputCls}
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label={copy.expenses.amount}>
          <input
            required
            inputMode="decimal"
            className={inputCls}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          />
        </Field>
        <Field label={copy.expenses.currency}>
          <select className={sel} value={currency} onChange={(e) => pickCurrency(e.target.value)}>
            {[...new Set([currency, ...CURRENCIES])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <button
        type="button"
        className="min-h-11 text-left text-sm font-semibold text-primary"
        aria-expanded={more}
        onClick={() => setMore((v) => !v)}
      >
        {more ? copy.expenses.less : copy.expenses.more}
      </button>

      {more && (
        <div className="grid gap-3">
          <Field label={copy.expenses.rate} hint={rateNote || undefined}>
            <input
              required={currency !== 'KRW'}
              inputMode="decimal"
              className={inputCls}
              value={rate}
              disabled={currency === 'KRW'}
              onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))}
            />
          </Field>
          {validMoney && currency !== 'KRW' && (
            <p className="tabular text-sm text-muted">
              {copy.expenses.krwValue}: <b className="text-ink">{formatKrw(krw)}</b>
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label={copy.expenses.category}>
              <select className={sel} value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {LABELS_KO[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={copy.expenses.paymentLabel}>
              <select className={sel} value={payment} onChange={(e) => setPayment(e.target.value)}>
                {(Object.keys(copy.expenses.payment) as PaymentMethod[]).map((p) => (
                  <option key={p} value={p}>
                    {copy.expenses.payment[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={copy.plan.day}>
              <select
                className={sel}
                value={day ?? ''}
                onChange={(e) => setDay(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">{copy.expenses.noDay}</option>
                {Array.from({ length: ctx.dayCount }, (_, i) => (
                  <option key={i} value={i}>
                    {copy.plan.dayTitle(i + 1)} · {formatMdWeekday(dayYmd(ctx.tripStart, i))}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={copy.expenses.paidBy}>
              <select className={sel} value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                {ctx.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nickname}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={copy.expenses.place}>
            <select
              className={sel}
              value={placeId ?? ''}
              onChange={(e) => {
                const p = ctx.places.find((x) => x.id === e.target.value);
                setPlaceId(p?.id ?? null);
                if (p) setPlaceLabel(p.name);
              }}
            >
              <option value="">{copy.expenses.placeNone}</option>
              {ctx.places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={copy.expenses.placeFree}>
            <input
              className={inputCls}
              value={placeLabel}
              maxLength={60}
              onChange={(e) => {
                setPlaceLabel(e.target.value);
                setPlaceId(null);
              }}
            />
          </Field>
          <Field label={copy.expenses.memo}>
            <input
              className={inputCls}
              value={memo}
              maxLength={200}
              onChange={(e) => setMemo(e.target.value)}
            />
          </Field>
        </div>
      )}

      <fieldset className="grid gap-2 rounded-input border border-line p-3">
        <legend className="px-1 text-sm font-semibold">{copy.expenses.split}</legend>
        <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-full bg-bg p-1">
          {(['equal', 'ratio', 'amount'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-11 rounded-full text-sm font-semibold ${mode === m ? 'bg-surface shadow-card' : 'text-muted'}`}
            >
              {copy.expenses.modes[m]}
            </button>
          ))}
        </div>
        <ul className="grid gap-1">
          {ctx.members.map((m) => {
            const share = splits.find((s) => s.member_id === m.id)?.share_krw;
            return (
              <li key={m.id} className="flex min-h-11 items-center gap-2">
                {mode !== 'amount' ? (
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--color-primary)]"
                      checked={picked.has(m.id)}
                      onChange={() =>
                        setPicked((cur) => {
                          const n = new Set(cur);
                          if (n.has(m.id)) n.delete(m.id);
                          else n.add(m.id);
                          return n;
                        })
                      }
                    />
                    <span className="truncate">{m.nickname}</span>
                  </label>
                ) : (
                  <span className="min-w-0 flex-1 truncate">{m.nickname}</span>
                )}
                {mode === 'ratio' && picked.has(m.id) && (
                  <input
                    aria-label={`${m.nickname} ${copy.expenses.modes.ratio}`}
                    inputMode="decimal"
                    className={`${inputCls} !w-20`}
                    value={weights[m.id] ?? ''}
                    placeholder="1"
                    onChange={(e) =>
                      setWeights((w) => ({ ...w, [m.id]: e.target.value.replace(/[^\d.]/g, '') }))
                    }
                  />
                )}
                {mode === 'amount' && (
                  <input
                    aria-label={`${m.nickname} ${copy.expenses.modes.amount}`}
                    inputMode="numeric"
                    className={`${inputCls} !w-28`}
                    value={custom[m.id] ?? ''}
                    onChange={(e) => setCustom((c) => ({ ...c, [m.id]: e.target.value.replace(/\D/g, '') }))}
                  />
                )}
                {mode !== 'amount' && share !== undefined && (
                  <span className="tabular w-24 text-right text-sm text-muted">{formatKrw(share)}</span>
                )}
              </li>
            );
          })}
        </ul>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </fieldset>

      <button type="submit" className={btn.primary} disabled={!canSubmit}>
        {copy.common.save}
      </button>
    </form>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">{children}</span>
  );
}
