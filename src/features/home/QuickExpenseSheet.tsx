import { useState } from 'react';
import { Delete } from 'lucide-react';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';
import { btn, inputCls } from '@/components/styles';
import { useFx } from '@/features/info/api';
import { useSaveExpense } from '@/features/expenses/api';
import type { Member } from '@/features/trips/api';
import { CURRENCIES, formatKrw, formatMoney, toKrw } from '@/lib/money';
import { buildQuickExpense, keypad } from '@/lib/quickExpense';
import { EXPENSE_CATEGORIES, LABELS_KO } from '@/types/domain';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

/** On-the-road expense: type an amount, tap a category, save. Split equally between everyone, paid by me. */
export function QuickExpenseSheet({
  open,
  onClose,
  tripId,
  tripStart,
  dayIndex,
  members,
  meId,
  defaultCurrency,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  tripStart: string;
  dayIndex: number | null;
  members: Member[];
  meId: string | null;
  defaultCurrency: string;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={copy.quick.title}>
      {open && (
        <Body
          tripId={tripId}
          tripStart={tripStart}
          dayIndex={dayIndex}
          members={members}
          meId={meId}
          defaultCurrency={defaultCurrency}
          onDone={onClose}
        />
      )}
    </Sheet>
  );
}

function Body({
  tripId,
  tripStart,
  dayIndex,
  members,
  meId,
  defaultCurrency,
  onDone,
}: {
  tripId: string;
  tripStart: string;
  dayIndex: number | null;
  members: Member[];
  meId: string | null;
  defaultCurrency: string;
  onDone: () => void;
}) {
  const save = useSaveExpense(tripId);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [category, setCategory] = useState<string>('food');
  const fx = useFx(currency);
  const rate = fx.data?.rate ?? null;

  const num = Number(amount);
  const built =
    rate !== null && meId
      ? buildQuickExpense({
          id: crypto.randomUUID(),
          amount: num,
          currency,
          rate,
          category,
          paidBy: meId,
          memberIds: members.map((m) => m.id),
          dayIndex,
          tripStart,
        })
      : null;

  return (
    <div className="grid gap-3">
      <div className="flex items-end gap-2">
        <output
          className="tabular min-h-14 flex-1 rounded-input bg-bg px-4 py-2 text-right text-3xl font-extrabold"
          aria-live="polite"
        >
          {amount || '0'}
        </output>
        <select
          className={`${inputCls} !w-24`}
          value={currency}
          aria-label={copy.expenses.currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {[...new Set([defaultCurrency, ...CURRENCIES])].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <p className="tabular min-h-5 text-right text-sm text-muted">
        {amount && rate !== null && currency !== 'KRW' && `≈ ${formatKrw(toKrw(num, rate))}`}
        {rate === null && !fx.isPending && copy.quick.noRate}
      </p>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label={copy.quick.keypad}>
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            aria-label={k === 'back' ? copy.quick.backspace : k}
            onClick={() => setAmount((a) => keypad(a, k))}
            className="grid min-h-14 place-items-center rounded-input border border-line bg-surface text-xl font-bold active:bg-bg"
          >
            {k === 'back' ? <Delete className="size-6" aria-hidden /> : k}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={copy.expenses.category}>
        {EXPENSE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={category === c}
            onClick={() => setCategory(c)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${category === c ? 'border-ink bg-ink text-white' : 'border-line'}`}
          >
            {LABELS_KO[c]}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={btn.primary}
        disabled={!built || save.isPending}
        onClick={() => {
          if (!built) return;
          save.mutate(built);
          toast.success(copy.quick.saved(formatMoney(num, currency)));
          onDone();
        }}
      >
        {copy.common.save}
      </button>
    </div>
  );
}
