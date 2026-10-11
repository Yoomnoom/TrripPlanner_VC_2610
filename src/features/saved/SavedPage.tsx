import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ExternalLink, Heart, Trash2 } from 'lucide-react';
import { copy } from '@/copy';
import { btn, inputCls } from '@/components/styles';
import { ErrorState, Skeleton } from '@/components/ui-kit';
import { countryName } from '@/features/footprints/geo';
import { externalLinks } from '@/lib/external';
import { groupSaved } from '@/lib/saved';
import { LABELS_KO, PLACE_CATEGORIES, type PlaceCategory } from '@/types/domain';
import { useSavedPlaces, useUnsavePlace, useUpdateSavedMemo, type SavedPlace } from './api';

/** /saved — my personal wish places (not shared with any trip). */
export function SavedPage() {
  const saved = useSavedPlaces();
  const unsave = useUnsavePlace();
  const [cat, setCat] = useState<PlaceCategory | 'all'>('all');
  const groups = useMemo(() => groupSaved(saved.data ?? [], cat === 'all' ? null : cat), [saved.data, cat]);

  return (
    <main className="mx-auto max-w-xl p-4 pb-16">
      <header className="flex items-center gap-1 py-2">
        <Link
          to="/"
          aria-label={copy.common.back}
          className="grid size-11 place-items-center rounded-full hover:bg-surface"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
        <h1 className="text-xl font-bold">{copy.saved.title}</h1>
      </header>
      <p className="text-sm text-muted">{copy.saved.hint}</p>

      <div className="mt-3 flex gap-1.5 overflow-x-auto" role="group" aria-label={copy.explore.categories}>
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

      {saved.isPending && <Skeleton className="mt-3 h-32" />}
      {saved.isError && (
        <ErrorState
          message={copy.common.loadFailed}
          onRetry={() => void saved.refetch()}
          retryLabel={copy.common.retry}
        />
      )}
      {saved.data && groups.length === 0 && (
        <div className="grid place-items-center gap-2 py-12 text-center">
          <Heart className="size-10 text-muted" aria-hidden />
          <p className="font-semibold">{copy.saved.empty}</p>
          <p className="text-sm text-muted">{copy.saved.emptyHint}</p>
        </div>
      )}

      {groups.map((g) => (
        <section key={`${g.country}|${g.city}`} className="mt-4" aria-label={g.city ?? copy.saved.noLocation}>
          <h2 className="font-bold">
            {g.country ? countryName(g.country) : copy.saved.noLocation}
            {g.city && <span className="ml-1.5 text-sm font-normal text-muted">{g.city}</span>}
          </h2>
          <ul className="mt-1 grid gap-2">
            {g.items.map((s) => (
              <Row key={s.id} item={s} onRemove={() => unsave.mutate(s.id)} />
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

function Row({ item, onRemove }: { item: SavedPlace; onRemove: () => void }) {
  const update = useUpdateSavedMemo();
  const [editing, setEditing] = useState(false);
  const [memo, setMemo] = useState(item.memo ?? '');
  return (
    <li className="rounded-card bg-surface p-3 shadow-card">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{item.name}</p>
          <p className="truncate text-xs text-muted">
            {LABELS_KO[item.category as PlaceCategory] ?? item.category}
            {item.address ? ` · ${item.address}` : ''}
          </p>
        </div>
        <a
          href={externalLinks(item.name)[0].url}
          target="_blank"
          rel="noreferrer"
          aria-label={`${item.name} ${copy.explore.openMap}`}
          className="grid size-11 place-items-center rounded-full text-muted hover:bg-bg"
        >
          <ExternalLink className="size-4" aria-hidden />
        </a>
        <button
          type="button"
          aria-label={`${item.name} ${copy.saved.remove}`}
          className="grid size-11 place-items-center rounded-full text-danger hover:bg-bg"
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      {editing ? (
        <form
          className="mt-1 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ id: item.id, memo: memo.trim() || null });
            setEditing(false);
          }}
        >
          <input
            autoFocus
            className={inputCls}
            value={memo}
            maxLength={200}
            aria-label={copy.expenses.memo}
            onChange={(e) => setMemo(e.target.value)}
          />
          <button type="submit" className={btn.primary}>
            {copy.common.save}
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="mt-1 min-h-11 text-left text-sm text-muted"
          onClick={() => setEditing(true)}
        >
          {item.memo ? item.memo : copy.saved.addMemo}
        </button>
      )}
    </li>
  );
}
