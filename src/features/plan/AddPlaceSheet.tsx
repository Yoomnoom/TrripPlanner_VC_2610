import { useEffect, useState, type FormEvent } from 'react';
import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';
import { btn, inputCls } from '@/components/styles';
import { Field } from '@/components/ui-kit';
import { nextSlot, overlapping, parseCoords, validTimes } from '@/lib/plan';
import { getPlacesProvider, type PlaceCandidate } from '@/providers/places';
import { PLACE_CATEGORIES, LABELS_KO, type PlaceCategory } from '@/types/domain';
import type { NewPlace, Place } from './api';

export type AddTarget = {
  dayIndex: number | null;
  dayPlaces: Place[];
  ideas: Place[];
  /** Pre-filled time, e.g. from a calendar selection. */
  prefill?: { start: string; end: string };
} | null;

/** Add a place to a day (or the idea inbox when dayIndex is null), or pull one in from the inbox. */
export function AddPlaceSheet({
  target,
  onClose,
  onAdd,
  onPickIdea,
}: {
  target: AddTarget;
  onClose: () => void;
  onAdd: (row: NewPlace) => void;
  onPickIdea: (idea: Place) => void;
}) {
  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      title={target?.dayIndex === null ? copy.plan.addIdeaTitle : copy.plan.addTitle}
    >
      {target && (
        <AddForm
          key={`${target.dayIndex}:${target.prefill?.start ?? ''}`}
          target={target}
          onAdd={onAdd}
          onPickIdea={onPickIdea}
        />
      )}
    </Sheet>
  );
}

function AddForm({
  target,
  onAdd,
  onPickIdea,
}: {
  target: NonNullable<AddTarget>;
  onAdd: (row: NewPlace) => void;
  onPickIdea: (idea: Place) => void;
}) {
  const provider = getPlacesProvider();
  const isIdea = target.dayIndex === null;
  const slot = target.prefill ?? nextSlot(target.dayPlaces);

  const [tab, setTab] = useState<'new' | 'ideas'>('new');
  const [name, setName] = useState('');
  const [found, setFound] = useState<{ q: string; list: PlaceCandidate[] }>({ q: '', list: [] });
  const [picked, setPicked] = useState<PlaceCandidate | null>(null);
  const [category, setCategory] = useState<PlaceCategory>('sightseeing');
  const [start, setStart] = useState(slot.start);
  const [end, setEnd] = useState(slot.end);
  const [address, setAddress] = useState('');
  const [coordText, setCoordText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Debounced provider search; a Google provider would return real suggestions here.
  const query = name.trim();
  useEffect(() => {
    if (!query) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      provider.search(query, { signal: ctl.signal }).then(
        (list) => setFound({ q: query, list }),
        () => setFound({ q: query, list: [] }),
      );
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [query, provider]);
  const candidates = found.q === query && picked?.name !== query ? found.list : [];

  const timesOk = isIdea || validTimes(start, end);
  const overlaps = isIdea || !timesOk ? [] : overlapping(target.dayPlaces, null, start, end);
  const coordsBad = coordText.trim() !== '' && !parseCoords(coordText);
  const canSubmit = name.trim() !== '' && timesOk && !coordsBad && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      const c = picked ?? (await provider.search(name.trim()))[0] ?? { id: '', name: name.trim() };
      const typed = parseCoords(coordText);
      const resolved =
        c.lat !== undefined && c.lng !== undefined
          ? { lat: c.lat, lng: c.lng }
          : ((await provider.coords(c.id)) ?? typed);
      const last = target.dayPlaces.reduce((m, p) => Math.max(m, p.position), 0);
      const pool = isIdea ? target.ideas : target.dayPlaces;
      onAdd({
        name: c.name,
        category: c.category ?? category,
        address: address.trim() || c.address || null,
        lat: resolved?.lat ?? null,
        lng: resolved?.lng ?? null,
        google_place_id: c.googlePlaceId ?? null,
        note: note.trim() || null,
        day_index: target.dayIndex,
        start_time: isIdea ? null : start,
        end_time: isIdea ? null : end,
        position: isIdea ? pool.reduce((m, p) => Math.max(m, p.position), 0) + 1000 : last + 1000,
        source: 'manual',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      {!isIdea && target.ideas.length > 0 && (
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-full bg-bg p-1">
          {(['new', 'ideas'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-11 rounded-full text-sm font-semibold ${tab === t ? 'bg-surface shadow-card' : 'text-muted'}`}
            >
              {t === 'new' ? copy.plan.tabNew : copy.plan.tabIdeas}
            </button>
          ))}
        </div>
      )}

      {tab === 'ideas' ? (
        <ul className="grid gap-2">
          {target.ideas.map((idea) => (
            <li key={idea.id} className="flex items-center gap-2 rounded-input border border-line p-2 pl-3">
              <span className="min-w-0 flex-1 truncate font-semibold">{idea.name}</span>
              <button type="button" className={btn.primary} onClick={() => onPickIdea(idea)}>
                {copy.plan.pickIdea}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <form onSubmit={submit} className="grid gap-3">
          <Field label={copy.plan.name}>
            <input
              autoFocus
              required
              className={inputCls}
              value={name}
              maxLength={80}
              placeholder={copy.plan.namePlaceholder}
              onChange={(e) => {
                setName(e.target.value);
                setPicked(null);
              }}
            />
          </Field>
          {candidates.length > 0 && (
            <ul className="-mt-1 grid gap-1" aria-label="suggestions">
              {candidates.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center rounded-input border border-line px-3 text-left text-sm hover:bg-bg"
                    onClick={() => {
                      setPicked(c);
                      setName(c.name);
                      if (c.address) setAddress(c.address);
                    }}
                  >
                    {provider.id === 'manual' ? copy.plan.suggestion(c.name) : c.name}
                    {c.address && <span className="ml-2 truncate text-muted">{c.address}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Field label={copy.plan.category}>
            <select
              className={inputCls}
              value={category}
              onChange={(e) => setCategory(e.target.value as PlaceCategory)}
            >
              {PLACE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {LABELS_KO[c]}
                </option>
              ))}
            </select>
          </Field>

          {!isIdea && (
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
          )}
          {!timesOk && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {copy.plan.timeInvalid}
            </p>
          )}
          {overlaps.length > 0 && (
            <p role="status" className="text-sm font-semibold text-amber-700">
              ⚠ {copy.plan.overlap(overlaps.map((p) => p.name).join(', '))}
            </p>
          )}

          <Field label={copy.plan.address}>
            <input
              className={inputCls}
              value={address}
              maxLength={200}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          <Field label={copy.plan.coords} hint={copy.plan.coordsHint}>
            <input
              className={inputCls}
              value={coordText}
              inputMode="decimal"
              onChange={(e) => setCoordText(e.target.value)}
            />
          </Field>
          {coordsBad && (
            <p role="alert" className="-mt-2 text-sm font-semibold text-danger">
              {copy.plan.coordsInvalid}
            </p>
          )}
          <Field label={copy.plan.note}>
            <input
              className={inputCls}
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <button type="submit" className={btn.primary} disabled={!canSubmit}>
            {copy.plan.submit}
          </button>
        </form>
      )}
    </div>
  );
}
