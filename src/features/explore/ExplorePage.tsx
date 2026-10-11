import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ExternalLink, Heart, MoreVertical, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';
import { btn, inputCls } from '@/components/styles';
import { ErrorState, Field, Skeleton } from '@/components/ui-kit';
import {
  invalidLeg,
  useAddPlace,
  useDeletePlace,
  usePlaces,
  usePlacesRealtime,
  useUpdatePlaces,
  type Place,
} from '@/features/plan/api';
import { PlaceSheet, type PlaceAction } from '@/features/plan/PlaceSheet';
import type { TripContext } from '@/features/trips/TripLayout';
import { useSavedPlaces, useSavePlace, useUnsavePlace, type SavedPlace } from '@/features/saved/api';
import { useTripDestinations } from '@/features/trips/api';
import { externalLinks } from '@/lib/external';
import { notInIdeas, savedKey } from '@/lib/saved';
import { groupByDay, nextSlot } from '@/lib/plan';
import { dayYmd, formatMdWeekday, tripDays } from '@/lib/trip';
import { getPlacesProvider, type PlaceCandidate } from '@/providers/places';
import { LABELS_KO, PLACE_CATEGORIES, type PlaceCategory } from '@/types/domain';

/** Search + idea inbox. Search goes through the PlacesProvider (manual entry until a Google key exists). */
export function ExplorePage() {
  const { trip } = useOutletContext<TripContext>();
  const places = usePlaces(trip.id);
  usePlacesRealtime(trip.id);
  const add = useAddPlace(trip.id);
  const update = useUpdatePlaces(trip.id);
  const del = useDeletePlace(trip.id);
  const provider = getPlacesProvider();
  const savedList = useSavedPlaces();
  const savePlace = useSavePlace();
  const unsave = useUnsavePlace();
  const dest = useTripDestinations(trip.id).data?.[0];
  const [importOpen, setImportOpen] = useState(false);
  const [importPick, setImportPick] = useState<Set<string>>(new Set());
  const savedBy = new Map((savedList.data ?? []).map((s) => [s.google_place_id, s]));

  const [q, setQ] = useState('');
  const [cat, setCat] = useState<PlaceCategory | 'all'>('all');
  const [found, setFound] = useState<{ q: string; list: PlaceCandidate[] }>({ q: '', list: [] });
  const [detail, setDetail] = useState<PlaceCandidate | null>(null);
  const [selected, setSelected] = useState<Place | null>(null);

  const dayCount = tripDays(trip.start_date, trip.end_date);
  const grouped = useMemo(() => groupByDay(places.data ?? [], dayCount), [places.data, dayCount]);

  const query = q.trim();
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
  const results = found.q === query ? found.list : [];

  const ideas = grouped.ideas.filter(
    (p) =>
      (cat === 'all' || p.category === cat) && (!query || p.name.toLowerCase().includes(query.toLowerCase())),
  );

  const onAction = (place: Place, a: PlaceAction) => {
    if (a.type === 'delete') return del.mutate(place.id);
    if (a.type === 'note') return update.mutate([{ id: place.id, patch: { note: a.note } }]);
    if (a.type === 'time')
      return update.mutate([
        { id: place.id, patch: { day_index: a.day, start_time: a.start, end_time: a.end, ...invalidLeg } },
      ]);
    if (a.day === null) return;
    const day = grouped.days[a.day] ?? [];
    const slot = nextSlot(day);
    const last = day.reduce((m, p) => Math.max(m, p.position), 0);
    update.mutate([
      {
        id: place.id,
        patch: {
          day_index: a.day,
          start_time: slot.start,
          end_time: slot.end,
          position: last + 1000,
          ...invalidLeg,
        },
      },
    ]);
    toast.success(copy.explore.movedToDay(a.day + 1));
  };

  return (
    <div className="p-4">
      <h1 className="py-2 text-xl font-bold">{copy.routes.explore}</h1>

      <input
        type="search"
        className={inputCls}
        value={q}
        placeholder={copy.explore.search}
        aria-label={copy.explore.search}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="mt-2 flex gap-1.5 overflow-x-auto" role="group" aria-label={copy.explore.categories}>
        {(['all', ...PLACE_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cat === c}
            onClick={() => setCat(c)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${cat === c ? 'border-ink bg-ink text-white' : 'border-line'}`}
          >
            {c === 'all' ? copy.map.all : LABELS_KO[c]}
          </button>
        ))}
      </div>

      {results.length > 0 && (
        <section className="mt-3" aria-label={copy.explore.results}>
          <h2 className="text-sm font-bold text-muted">{copy.explore.results}</h2>
          <ul className="mt-1 grid gap-2">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex min-h-14 w-full items-center gap-3 rounded-card bg-surface p-3 text-left shadow-card"
                  onClick={() => setDetail(c)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {provider.id === 'manual' ? copy.plan.suggestion(c.name) : c.name}
                    </span>
                    {c.address && <span className="block truncate text-xs text-muted">{c.address}</span>}
                  </span>
                  <Plus className="size-5 text-primary" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4" aria-label={copy.plan.ideas}>
        <h2 className="flex items-center gap-2 font-bold">
          {copy.plan.ideas}{' '}
          <span className="text-sm font-normal text-muted">{copy.plan.placeCount(ideas.length)}</span>
          <button
            type="button"
            className="ml-auto min-h-11 text-sm font-semibold text-primary"
            onClick={() => setImportOpen(true)}
          >
            {copy.saved.import}
          </button>
        </h2>
        <p className="text-xs text-muted">{copy.saved.difference}</p>
        {places.isPending && <Skeleton className="mt-2 h-24" />}
        {places.isError && (
          <ErrorState
            message={copy.common.loadFailed}
            onRetry={() => void places.refetch()}
            retryLabel={copy.common.retry}
          />
        )}
        {places.data && ideas.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">{copy.plan.ideasEmpty}</p>
        )}
        <ul className="mt-2 grid gap-2">
          {ideas.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-card bg-surface p-3 shadow-card">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 font-semibold text-primary">
                    {LABELS_KO[p.category as PlaceCategory] ?? p.category}
                  </span>
                  {p.address && <span className="truncate">{p.address}</span>}
                </span>
              </span>
              <a
                href={externalLinks(p.name)[0].url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${p.name} ${copy.explore.openMap}`}
                className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-bg"
              >
                <ExternalLink className="size-4" aria-hidden />
              </a>
              <button
                type="button"
                aria-label={`${p.name} ${savedBy.has(savedKey(p)) ? copy.saved.remove : copy.saved.save}`}
                aria-pressed={savedBy.has(savedKey(p))}
                className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-bg"
                onClick={() => {
                  const hit = savedBy.get(savedKey(p));
                  if (hit) unsave.mutate(hit.id);
                  else
                    savePlace.mutate({
                      google_place_id: p.google_place_id,
                      name: p.name,
                      address: p.address,
                      lat: p.lat,
                      lng: p.lng,
                      category: p.category,
                      country_code: dest?.country_code ?? null,
                      city: dest?.city ?? null,
                    });
                }}
              >
                <Heart
                  className={`size-4 ${savedBy.has(savedKey(p)) ? 'fill-danger text-danger' : 'text-muted'}`}
                  aria-hidden
                />
              </button>
              <button
                type="button"
                aria-label={copy.plan.menu}
                onClick={() => setSelected(p)}
                className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-bg"
              >
                <MoreVertical className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ''}>
        {detail && (
          <Detail
            key={detail.id}
            candidate={detail}
            defaultCategory={cat === 'all' ? 'sightseeing' : cat}
            days={dayCount}
            tripStart={trip.start_date}
            onAdd={(category, day) => {
              const pool = day === null ? grouped.ideas : (grouped.days[day] ?? []);
              const slot = day === null ? null : nextSlot(pool);
              add.mutate({
                id: crypto.randomUUID(),
                trip_id: trip.id,
                name: detail.name,
                category,
                address: detail.address ?? null,
                lat: detail.lat ?? null,
                lng: detail.lng ?? null,
                google_place_id: detail.googlePlaceId ?? null,
                day_index: day,
                start_time: slot?.start ?? null,
                end_time: slot?.end ?? null,
                position: pool.reduce((m, p) => Math.max(m, p.position), 0) + 1000,
                source: 'explore',
              });
              toast.success(day === null ? copy.explore.addedIdea : copy.explore.movedToDay(day + 1));
              setDetail(null);
              setQ('');
            }}
          />
        )}
      </Sheet>

      <Sheet open={importOpen} onClose={() => setImportOpen(false)} title={copy.saved.import}>
        {importOpen && (
          <ImportList
            options={notInIdeas(
              savedList.data ?? [],
              grouped.ideas.map((p) => p.name),
            )}
            picked={importPick}
            onToggle={(id) =>
              setImportPick((cur) => {
                const n = new Set(cur);
                if (n.has(id)) n.delete(id);
                else n.add(id);
                return n;
              })
            }
            onImport={(chosen) => {
              let pos = grouped.ideas.reduce((m, p) => Math.max(m, p.position), 0);
              for (const s of chosen) {
                pos += 1000;
                add.mutate({
                  id: crypto.randomUUID(),
                  trip_id: trip.id,
                  name: s.name,
                  category: s.category,
                  address: s.address,
                  lat: s.lat,
                  lng: s.lng,
                  google_place_id: s.google_place_id.startsWith('manual:') ? null : s.google_place_id,
                  day_index: null,
                  position: pos,
                  source: 'explore',
                });
              }
              toast.success(copy.saved.imported(chosen.length));
              setImportPick(new Set());
              setImportOpen(false);
            }}
          />
        )}
      </Sheet>

      <PlaceSheet
        place={selected}
        days={grouped.days}
        tripStart={trip.start_date}
        onClose={() => setSelected(null)}
        onAction={onAction}
      />
    </div>
  );
}

function Detail({
  candidate,
  defaultCategory,
  days,
  tripStart,
  onAdd,
}: {
  candidate: PlaceCandidate;
  defaultCategory: PlaceCategory;
  days: number;
  tripStart: string;
  onAdd: (category: PlaceCategory, day: number | null) => void;
}) {
  const [category, setCategory] = useState<PlaceCategory>(candidate.category ?? defaultCategory);
  const [day, setDay] = useState<string>('idea');
  return (
    <div className="grid gap-3">
      {candidate.address && <p className="text-sm text-muted">{candidate.address}</p>}
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
      <Field label={copy.explore.addTo}>
        <select className={inputCls} value={day} onChange={(e) => setDay(e.target.value)}>
          <option value="idea">{copy.plan.ideas}</option>
          {Array.from({ length: days }, (_, i) => (
            <option key={i} value={i}>
              {copy.plan.dayTitle(i + 1)} · {formatMdWeekday(dayYmd(tripStart, i))}
            </option>
          ))}
        </select>
      </Field>
      <button
        type="button"
        className={btn.primary}
        onClick={() => onAdd(category, day === 'idea' ? null : Number(day))}
      >
        {copy.plan.submit}
      </button>
      <div>
        <p className="text-xs font-semibold text-muted">{copy.explore.lookup}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {externalLinks(candidate.name).map((l) => (
            <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className={btn.ghost}>
              {l.label}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImportList({
  options,
  picked,
  onToggle,
  onImport,
}: {
  options: SavedPlace[];
  picked: Set<string>;
  onToggle: (id: string) => void;
  onImport: (chosen: SavedPlace[]) => void;
}) {
  if (options.length === 0)
    return <p className="py-4 text-center text-sm text-muted">{copy.saved.nothingToImport}</p>;
  return (
    <div className="grid gap-2">
      <ul className="grid gap-1">
        {options.map((s) => (
          <li key={s.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-5 accent-[var(--color-primary)]"
                checked={picked.has(s.id)}
                onChange={() => onToggle(s.id)}
              />
              <span className="min-w-0 truncate">{s.name}</span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={btn.primary}
        disabled={picked.size === 0}
        onClick={() => onImport(options.filter((o) => picked.has(o.id)))}
      >
        {copy.saved.importButton(picked.size)}
      </button>
    </div>
  );
}
