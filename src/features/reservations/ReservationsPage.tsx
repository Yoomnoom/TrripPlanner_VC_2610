import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Copy, ExternalLink, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';
import { btn, inputCls } from '@/components/styles';
import { ErrorState, Field, Skeleton } from '@/components/ui-kit';
import { useFiles } from '@/features/files/api';
import { usePlaces } from '@/features/plan/api';
import type { TripContext } from '@/features/trips/TripLayout';
import { copyText } from '@/lib/device';
import { normalizeUrl } from '@/lib/files';
import { formatMoney, CURRENCIES } from '@/lib/money';
import {
  formatRangeWhen,
  fromInputValue,
  RESERVATION_TYPES,
  toExpensePrefill,
  toInputValue,
  type ReservationType,
} from '@/lib/reservations';
import { useDeleteReservation, useReservations, useSaveReservation, type Reservation } from './api';

export function ReservationsPage() {
  const { trip } = useOutletContext<TripContext>();
  const navigate = useNavigate();
  const list = useReservations(trip.id);
  const files = useFiles(trip.id);
  const places = usePlaces(trip.id);
  const save = useSaveReservation(trip.id);
  const del = useDeleteReservation(trip.id);
  const [form, setForm] = useState<{ edit?: Reservation } | null>(null);

  const copyNo = async (no: string) => {
    if (await copyText(no)) toast.success(copy.reservations.copied);
    else toast.error(copy.members.copyFailed);
  };

  return (
    <div className="p-4 pb-28">
      <h1 className="py-2 text-xl font-bold">{copy.routes.reservations}</h1>

      {list.isPending && <Skeleton className="h-32" />}
      {list.isError && (
        <ErrorState
          message={copy.common.loadFailed}
          onRetry={() => void list.refetch()}
          retryLabel={copy.common.retry}
        />
      )}
      {list.data?.length === 0 && <p className="py-10 text-center text-muted">{copy.reservations.empty}</p>}

      <ol className="grid gap-3">
        {list.data?.map((r) => {
          const attached = files.data?.filter((f) => f.reservation_id === r.id) ?? [];
          const place = places.data?.find((p) => p.id === r.place_id);
          return (
            <li key={r.id} className="rounded-card bg-surface p-4 shadow-card">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-bold text-primary">
                    {copy.reservations.types[r.type as ReservationType] ?? r.type}
                  </span>
                  <h2 className="mt-1 truncate font-bold">{r.title}</h2>
                  {r.starts_at && (
                    <p className="tabular text-sm text-muted">{formatRangeWhen(r.starts_at, r.ends_at)}</p>
                  )}
                  {place && <p className="text-sm text-muted">{place.name}</p>}
                </div>
                <button
                  type="button"
                  aria-label={`${r.title} ${copy.checklist.rename}`}
                  className="grid size-11 place-items-center rounded-full text-muted hover:bg-bg"
                  onClick={() => setForm({ edit: r })}
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`${r.title} ${copy.checklist.remove}`}
                  className="grid size-11 place-items-center rounded-full text-danger hover:bg-bg"
                  onClick={() => del.mutate(r.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                {r.confirmation_no && (
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3 font-semibold"
                    onClick={() => void copyNo(r.confirmation_no!)}
                  >
                    <Copy className="size-4" aria-hidden />
                    {r.confirmation_no}
                  </button>
                )}
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3 font-semibold"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    {copy.reservations.openLink}
                  </a>
                )}
                {r.amount !== null && r.currency && (
                  <span className="tabular font-semibold">{formatMoney(Number(r.amount), r.currency)}</span>
                )}
                {r.amount !== null && (
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-hero px-3 font-semibold text-white"
                    onClick={() =>
                      navigate(`/t/${trip.id}/expenses`, {
                        state: {
                          prefill: toExpensePrefill({
                            ...r,
                            amount: r.amount === null ? null : Number(r.amount),
                          }),
                        },
                      })
                    }
                  >
                    <Wallet className="size-4" aria-hidden />
                    {copy.reservations.toExpense}
                  </button>
                )}
              </div>
              {r.note && <p className="mt-2 text-sm text-muted">{r.note}</p>}
              {attached.length > 0 && (
                <p className="mt-1 text-xs text-muted">{copy.reservations.attached(attached.length)}</p>
              )}
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        className={`${btn.primary} fixed bottom-20 right-4 z-10 shadow-card lg:bottom-6`}
        onClick={() => setForm({})}
      >
        <Plus className="size-5" aria-hidden />
        {copy.reservations.add}
      </button>

      <Sheet
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.edit ? copy.reservations.edit : copy.reservations.add}
      >
        {form && (
          <ReservationForm
            key={form.edit?.id ?? 'new'}
            initial={form.edit}
            places={(places.data ?? []).map((p) => ({ id: p.id, name: p.name }))}
            onSubmit={(row) => {
              save.mutate({ ...row, trip_id: trip.id });
              setForm(null);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function ReservationForm({
  initial,
  places,
  onSubmit,
}: {
  initial?: Reservation;
  places: { id: string; name: string }[];
  onSubmit: (row: {
    id: string;
    type: string;
    title: string;
    starts_at: string | null;
    ends_at: string | null;
    confirmation_no: string | null;
    place_id: string | null;
    url: string | null;
    amount: number | null;
    currency: string | null;
    note: string | null;
  }) => void;
}) {
  const [id] = useState(() => initial?.id ?? crypto.randomUUID());
  const [type, setType] = useState<string>(initial?.type ?? 'other');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [starts, setStarts] = useState(toInputValue(initial?.starts_at ?? null));
  const [ends, setEnds] = useState(toInputValue(initial?.ends_at ?? null));
  const [no, setNo] = useState(initial?.confirmation_no ?? '');
  const [placeId, setPlaceId] = useState(initial?.place_id ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [amount, setAmount] = useState(
    initial?.amount !== null && initial?.amount !== undefined ? String(initial.amount) : '',
  );
  const [currency, setCurrency] = useState(initial?.currency ?? 'KRW');
  const [note, setNote] = useState(initial?.note ?? '');

  const normalized = url.trim() ? normalizeUrl(url) : null;
  const urlBad = url.trim() !== '' && normalized === null;
  const timeBad = !!starts && !!ends && ends < starts;
  const canSubmit = title.trim() !== '' && !urlBad && !timeBad;

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        const num = amount.trim() === '' ? null : Number(amount);
        onSubmit({
          id,
          type,
          title: title.trim(),
          starts_at: fromInputValue(starts),
          ends_at: fromInputValue(ends),
          confirmation_no: no.trim() || null,
          place_id: placeId || null,
          url: normalized,
          amount: num !== null && Number.isFinite(num) && num >= 0 ? num : null,
          currency: num !== null ? currency : null,
          note: note.trim() || null,
        });
      }}
    >
      <div role="radiogroup" aria-label={copy.reservations.type} className="flex flex-wrap gap-1.5">
        {RESERVATION_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => setType(t)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${type === t ? 'border-ink bg-ink text-white' : 'border-line'}`}
          >
            {copy.reservations.types[t]}
          </button>
        ))}
      </div>
      <Field label={copy.files.title}>
        <input
          autoFocus
          required
          className={inputCls}
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={copy.plan.start}>
          <input
            type="datetime-local"
            className={inputCls}
            value={starts}
            onChange={(e) => setStarts(e.target.value)}
          />
        </Field>
        <Field label={copy.plan.end}>
          <input
            type="datetime-local"
            className={inputCls}
            value={ends}
            min={starts || undefined}
            onChange={(e) => setEnds(e.target.value)}
          />
        </Field>
      </div>
      {timeBad && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {copy.plan.timeInvalid}
        </p>
      )}
      <Field label={copy.reservations.confirmationNo}>
        <input className={inputCls} value={no} maxLength={60} onChange={(e) => setNo(e.target.value)} />
      </Field>
      <Field label={copy.expenses.place}>
        <select className={inputCls} value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
          <option value="">{copy.expenses.placeNone}</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="URL" hint={urlBad ? copy.files.badUrl : undefined}>
        <input className={inputCls} inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} />
      </Field>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label={copy.expenses.amount}>
          <input
            inputMode="decimal"
            className={inputCls}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          />
        </Field>
        <Field label={copy.expenses.currency}>
          <select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={copy.expenses.memo}>
        <input className={inputCls} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <button type="submit" className={btn.primary} disabled={!canSubmit}>
        {copy.common.save}
      </button>
    </form>
  );
}
