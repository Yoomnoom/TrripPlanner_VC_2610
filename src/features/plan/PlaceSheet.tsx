import { useState } from 'react';
import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';
import { btn, inputCls } from '@/components/styles';
import { Field } from '@/components/ui-kit';
import { formatMdWeekday, dayYmd } from '@/lib/trip';
import { hm, nextSlot, overlapping, validTimes } from '@/lib/plan';
import type { Place } from './api';

type View = 'menu' | 'time' | 'move' | 'note' | 'delete';

export type PlaceAction =
  | { type: 'time'; day: number; start: string; end: string }
  | { type: 'move'; day: number | null }
  | { type: 'note'; note: string | null }
  | { type: 'delete' };

/** Per-place `⋮` menu: time/day change, move to another day or the idea inbox, note, delete. */
export function PlaceSheet({
  place,
  days,
  tripStart,
  onClose,
  onAction,
}: {
  place: Place | null;
  days: Place[][];
  tripStart: string;
  onClose: () => void;
  onAction: (place: Place, action: PlaceAction) => void;
}) {
  return (
    <Sheet open={!!place} onClose={onClose} title={place?.name ?? copy.plan.menu}>
      {place && (
        <Body
          key={place.id}
          place={place}
          days={days}
          tripStart={tripStart}
          onAction={onAction}
          onClose={onClose}
        />
      )}
    </Sheet>
  );
}

function Body({
  place,
  days,
  tripStart,
  onAction,
  onClose,
}: {
  place: Place;
  days: Place[][];
  tripStart: string;
  onAction: (place: Place, action: PlaceAction) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>('menu');
  const isIdea = place.day_index === null;
  const run = (a: PlaceAction) => {
    onAction(place, a);
    onClose();
  };

  if (view === 'time')
    return (
      <TimeForm
        place={place}
        days={days}
        tripStart={tripStart}
        onSubmit={(day, start, end) => run({ type: 'time', day, start, end })}
      />
    );
  if (view === 'note') return <NoteForm place={place} onSubmit={(note) => run({ type: 'note', note })} />;
  if (view === 'move')
    return (
      <ul className="grid gap-1">
        {days.map((_, i) =>
          i === place.day_index ? null : (
            <li key={i}>
              <button
                type="button"
                className={`${btn.ghost} w-full justify-start`}
                onClick={() => run({ type: 'move', day: i })}
              >
                {copy.plan.dayTitle(i + 1)} · {formatMdWeekday(dayYmd(tripStart, i))}
              </button>
            </li>
          ),
        )}
      </ul>
    );
  if (view === 'delete')
    return (
      <div role="alert" className="grid gap-3">
        <p>{copy.plan.deleteConfirm(place.name)}</p>
        <div className="flex gap-2">
          <button type="button" className={`${btn.danger} flex-1`} onClick={() => run({ type: 'delete' })}>
            {copy.plan.menuDelete}
          </button>
          <button type="button" className={`${btn.ghost} flex-1`} onClick={() => setView('menu')}>
            {copy.common.cancel}
          </button>
        </div>
      </div>
    );

  const item = 'flex min-h-11 w-full items-center rounded-input px-3 text-left hover:bg-bg';
  return (
    <ul className="grid gap-1">
      {isIdea ? (
        <li>
          <button type="button" className={item} onClick={() => setView('move')}>
            {copy.plan.pickIdea}
          </button>
        </li>
      ) : (
        <>
          <li>
            <button type="button" className={item} onClick={() => setView('time')}>
              {copy.plan.menuTime}
            </button>
          </li>
          <li>
            <button type="button" className={item} onClick={() => setView('move')}>
              {copy.plan.menuMove}
            </button>
          </li>
          <li>
            <button type="button" className={item} onClick={() => run({ type: 'move', day: null })}>
              {copy.plan.menuToIdea}
            </button>
          </li>
        </>
      )}
      <li>
        <button type="button" className={item} onClick={() => setView('note')}>
          {copy.plan.menuNote}
        </button>
      </li>
      <li>
        <button type="button" className={`${item} text-danger`} onClick={() => setView('delete')}>
          {copy.plan.menuDelete}
        </button>
      </li>
    </ul>
  );
}

function TimeForm({
  place,
  days,
  tripStart,
  onSubmit,
}: {
  place: Place;
  days: Place[][];
  tripStart: string;
  onSubmit: (day: number, start: string, end: string) => void;
}) {
  const [day, setDay] = useState(place.day_index ?? 0);
  const slot = nextSlot(days[day] ?? []);
  const [start, setStart] = useState(hm(place.start_time) || slot.start);
  const [end, setEnd] = useState(hm(place.end_time) || slot.end);
  const ok = validTimes(start, end);
  const overlaps = ok ? overlapping(days[day] ?? [], place.id, start, end) : [];

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSubmit(day, start, end);
      }}
    >
      <Field label={copy.plan.day}>
        <select className={inputCls} value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {days.map((_, i) => (
            <option key={i} value={i}>
              {copy.plan.dayTitle(i + 1)} · {formatMdWeekday(dayYmd(tripStart, i))}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={copy.plan.start}>
          <input
            type="time"
            required
            className={inputCls}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label={copy.plan.end}>
          <input
            type="time"
            required
            className={inputCls}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
      </div>
      {!ok && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {copy.plan.timeInvalid}
        </p>
      )}
      {overlaps.length > 0 && (
        <p role="status" className="text-sm font-semibold text-amber-700">
          ⚠ {copy.plan.overlap(overlaps.map((p) => p.name).join(', '))}
        </p>
      )}
      <button type="submit" className={btn.primary} disabled={!ok}>
        {copy.plan.confirm}
      </button>
    </form>
  );
}

function NoteForm({ place, onSubmit }: { place: Place; onSubmit: (note: string | null) => void }) {
  const [note, setNote] = useState(place.note ?? '');
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(note.trim() || null);
      }}
    >
      <Field label={copy.plan.note}>
        <textarea
          className={`${inputCls} min-h-24 py-2`}
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <button type="submit" className={btn.primary}>
        {copy.common.save}
      </button>
    </form>
  );
}
