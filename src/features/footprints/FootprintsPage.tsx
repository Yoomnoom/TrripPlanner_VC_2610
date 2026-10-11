import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { copy } from '@/copy';
import { btn, inputCls } from '@/components/styles';
import { ErrorState, Skeleton } from '@/components/ui-kit';
import { NUMERIC_TO_ALPHA2 } from '@/data/countryNumeric';
import { CONTINENT_LABEL, continentOf } from '@/lib/continents';
import { todayYmd } from '@/lib/trip';
import { useFootprints, useRemoveFootprint, useSetFootprint, useTripSummaries, type Footprint } from './api';
import { countryName, loadCountryCentroids, loadRegionNames } from './geo';
import { periodLabel } from './period';
import { computeStats, suggestVisited } from './stats';
import { StatusSheet, type Target } from './StatusSheet';
import type { MapView, Marks } from './mapStyle';

const WorldMap = lazy(() => import('./WorldMap'));
const KoreaMap = lazy(() => import('./KoreaMap'));

const DISMISS_KEY = 'tp:fp-dismissed';
const readDismissed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

const ALL_CODES = [...new Set(Object.values(NUMERIC_TO_ALPHA2))];

/** Personal world/Korea map with visited / wish marks, seven stats and the wish list. */
export default function FootprintsPage() {
  const fps = useFootprints();
  const trips = useTripSummaries();
  const set = useSetFootprint();
  const remove = useRemoveFootprint();

  const [mapKind, setMapKind] = useState<'world' | 'korea'>('world');
  const [tab, setTab] = useState<'stats' | 'wish'>('stats');
  const [view, setView] = useState<MapView>({ center: [10, 20], zoom: 1 });
  const [target, setTarget] = useState<Target | null>(null);
  const [q, setQ] = useState('');
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const [regionNames, setRegionNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    void loadRegionNames().then(setRegionNames, () => undefined);
  }, []);

  const list = useMemo(() => fps.data ?? [], [fps.data]);
  const marks = useMemo(() => {
    const world: Marks = {};
    const korea: Marks = {};
    for (const f of list) (f.kind === 'country' ? world : korea)[f.code] = f.status as 'visited' | 'wish';
    return { world, korea };
  }, [list]);

  const visitedCodes = list.filter((f) => f.kind === 'country' && f.status === 'visited').map((f) => f.code);
  const stats = useMemo(
    () => computeStats({ visitedCountryCodes: visitedCodes, pastTrips: trips.data ?? [], today: new Date() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visitedCodes is derived from `list`
    [list, trips.data],
  );
  const suggestions = useMemo(
    () =>
      suggestVisited(
        (trips.data ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          endDate: t.endDate,
          countryCodes: t.countryCodes,
        })),
        new Set(visitedCodes),
        todayYmd(),
      ).filter((s) => !dismissed.includes(s.code)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visitedCodes is derived from `list`
    [trips.data, list, dismissed],
  );

  const dismiss = (codes: string[]) => {
    const next = [...new Set([...dismissed, ...codes])];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      // the banner may reappear next time; harmless
    }
  };

  const nameOf = (f: Pick<Footprint, 'kind' | 'code'>) =>
    f.kind === 'country' ? countryName(f.code) : (regionNames.get(f.code) ?? f.code);
  const existing = (t: Target | null) =>
    t ? list.find((f) => f.kind === t.kind && f.code === t.code) : undefined;

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return ALL_CODES.filter(
      (c) =>
        countryName(c).toLowerCase().includes(needle) ||
        countryName(c, 'en').toLowerCase().includes(needle) ||
        c.toLowerCase() === needle,
    ).slice(0, 6);
  }, [q]);

  const focusCountry = async (code: string) => {
    setMapKind('world');
    setQ('');
    try {
      const c = (await loadCountryCentroids()).get(code);
      if (c) setView({ center: c, zoom: 4 });
    } catch {
      // map stays where it is; the sheet still opens
    }
    setTarget({ kind: 'country', code, name: countryName(code) });
  };

  const wishes = list.filter((f) => f.status === 'wish');

  return (
    <main className="mx-auto max-w-2xl p-4 pb-16">
      <header className="flex items-center gap-1 py-2">
        <Link
          to="/"
          aria-label={copy.common.back}
          className="grid size-11 place-items-center rounded-full hover:bg-surface"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
        <h1 className="text-xl font-bold">{copy.routes.footprints}</h1>
      </header>

      {suggestions.length > 0 && (
        <section className="mb-3 rounded-card bg-primary-soft p-4" aria-label={copy.footprints.suggestTitle}>
          <p className="font-bold">{copy.footprints.suggestTitle}</p>
          <ul className="mt-2 grid gap-2">
            {suggestions.map((s) => (
              <li key={s.code} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-sm">
                  <b>{countryName(s.code)}</b> · {s.tripTitle}
                </span>
                <button
                  type="button"
                  className={btn.primary}
                  onClick={() => {
                    set.mutate({ kind: 'country', code: s.code, status: 'visited' });
                    dismiss([s.code]);
                  }}
                >
                  {copy.footprints.markVisited}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-2 min-h-11 text-sm font-semibold text-muted"
            onClick={() => dismiss(suggestions.map((s) => s.code))}
          >
            {copy.footprints.later}
          </button>
        </section>
      )}

      <div className="relative">
        <input
          type="search"
          className={inputCls}
          value={q}
          placeholder={copy.footprints.search}
          aria-label={copy.footprints.search}
          onChange={(e) => setQ(e.target.value)}
        />
        {results.length > 0 && (
          <ul className="absolute inset-x-0 top-12 z-10 overflow-hidden rounded-input border border-line bg-surface shadow-card">
            {results.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center px-3 text-left hover:bg-bg"
                  onClick={() => void focusCountry(c)}
                >
                  {countryName(c)}{' '}
                  <span className="ml-2 text-xs text-muted">
                    {continentOf(c) ? CONTINENT_LABEL[continentOf(c)!] : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        role="tablist"
        className="my-3 grid max-w-xs grid-cols-2 gap-1 rounded-full bg-surface p-1 shadow-card"
      >
        {(['world', 'korea'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mapKind === k}
            onClick={() => setMapKind(k)}
            className={`min-h-11 rounded-full text-sm font-semibold ${mapKind === k ? 'bg-hero text-white' : 'text-muted'}`}
          >
            {k === 'world' ? copy.footprints.world : copy.footprints.korea}
          </button>
        ))}
      </div>

      {fps.isError && (
        <ErrorState
          message={copy.common.loadFailed}
          onRetry={() => void fps.refetch()}
          retryLabel={copy.common.retry}
        />
      )}
      <Suspense fallback={<Skeleton className="h-72" />}>
        {mapKind === 'world' ? (
          <WorldMap
            marks={marks.world}
            view={view}
            onViewChange={setView}
            onPick={(code) => setTarget({ kind: 'country', code, name: countryName(code) })}
          />
        ) : (
          <KoreaMap marks={marks.korea} onPick={(code, name) => setTarget({ kind: 'region', code, name })} />
        )}
      </Suspense>

      <ul className="mt-2 flex flex-wrap gap-3 text-xs font-semibold" aria-label={copy.footprints.legend}>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-[#5B3DF5]" /> {copy.footprints.statusVisited}
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-sm border border-dashed border-amber-800 bg-[#F59E0B]"
          />{' '}
          {copy.footprints.statusWish}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-[#E4E4EC]" /> {copy.footprints.none}
        </li>
      </ul>

      <section className="mt-4 rounded-sheet bg-surface p-4 shadow-card">
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-full bg-bg p-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'stats'}
            onClick={() => setTab('stats')}
            className={`min-h-11 rounded-full text-sm font-semibold ${tab === 'stats' ? 'bg-surface shadow-card' : 'text-muted'}`}
          >
            {copy.footprints.stats}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'wish'}
            onClick={() => setTab('wish')}
            className={`min-h-11 rounded-full text-sm font-semibold ${tab === 'wish' ? 'bg-surface shadow-card' : 'text-muted'}`}
          >
            {copy.footprints.wishTab(wishes.length)}
          </button>
        </div>

        {tab === 'stats' ? (
          <dl className="mt-3 grid grid-cols-4 gap-2 text-center sm:grid-cols-7">
            {(
              [
                ['countries', stats.countries],
                ['trips', stats.trips],
                ['places', stats.places],
                ['cities', stats.cities],
                ['days', stats.days],
                ['continents', stats.continents],
                ['yearStreak', stats.yearStreak],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-input bg-bg p-2">
                <dd className="tabular text-xl font-extrabold">{v}</dd>
                <dt className="text-xs text-muted">{copy.footprints.statLabels[k]}</dt>
              </div>
            ))}
          </dl>
        ) : wishes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{copy.footprints.wishEmpty}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {wishes.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="flex min-h-14 w-full items-center gap-3 py-2 text-left"
                  onClick={() =>
                    setTarget({ kind: f.kind as 'country' | 'region', code: f.code, name: nameOf(f) })
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{nameOf(f)}</span>
                    <span className="block truncate text-xs text-muted">
                      {periodLabel(f.period)}
                      {f.memo ? ` · ${f.memo}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StatusSheet
        target={target}
        existing={existing(target)}
        onClose={() => setTarget(null)}
        onSave={(input) => set.mutate(input)}
        onRemove={() => target && remove.mutate({ kind: target.kind, code: target.code })}
      />
    </main>
  );
}
