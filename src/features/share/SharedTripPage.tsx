import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { btn } from '@/components/styles';
import { ErrorState, Skeleton } from '@/components/ui-kit';
import { Sheet } from '@/components/Sheet';
import { useState } from 'react';
import { groupByDay, hm } from '@/lib/plan';
import { setLastNickname } from '@/lib/device';
import { dayYmd, formatDuration, formatMdWeekday, formatRange, tripDays } from '@/lib/trip';
import { LABELS_KO, type PlaceCategory } from '@/types/domain';
import { countryName } from '@/features/footprints/geo';
import { parseRecap } from '@/lib/recap';
import { useImportShared, useSharedTrip } from './api';
import { CopyTripForm } from './CopyTripForm';

/** /v/:viewToken — read-only trip page for anyone with the link (an anonymous session is created automatically). */
export function SharedTripPage() {
  const { viewToken = '' } = useParams();
  const navigate = useNavigate();
  const q = useSharedTrip(viewToken);
  const importer = useImportShared(viewToken);
  const [open, setOpen] = useState(false);

  // This page must not be indexed (the link is a secret).
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const t = q.data;
  const grouped = useMemo(
    () =>
      t
        ? groupByDay(
            t.places.map((p, i) => ({
              id: String(i),
              day_index: p.dayIndex,
              start_time: p.startTime,
              end_time: p.endTime,
              position: i,
              place: p,
            })),
            tripDays(t.startDate, t.endDate),
          ).days
        : [],
    [t],
  );

  if (q.isPending) {
    return (
      <main className="mx-auto max-w-xl p-4" aria-busy>
        <Skeleton className="mt-8 h-40" />
      </main>
    );
  }
  if (q.isError) {
    return (
      <main className="mx-auto max-w-xl p-4">
        <ErrorState
          message={copy.common.loadFailed}
          onRetry={() => void q.refetch()}
          retryLabel={copy.common.retry}
        />
      </main>
    );
  }
  if (!t) {
    return (
      <main className="mx-auto grid max-w-md gap-3 p-8 text-center">
        <h1 className="text-xl font-bold">{copy.share.invalidTitle}</h1>
        <p className="text-muted">{copy.share.invalidBody}</p>
        <Link to="/" className={`${btn.ghost} mx-auto`}>
          {copy.join.goHome}
        </Link>
      </main>
    );
  }

  const recap = parseRecap(t.recap);
  const dest = t.destinations
    .map((d) => d.city ?? (d.countryCode ? countryName(d.countryCode) : ''))
    .filter(Boolean)
    .join(' · ');

  return (
    <main className="mx-auto max-w-xl p-4 pb-24">
      <section className="rounded-card bg-hero p-5 text-white shadow-card">
        <p className="text-xs text-white/70">{copy.share.readOnly}</p>
        <h1 className="mt-1 text-2xl font-bold">{t.title}</h1>
        <p className="mt-1 text-sm text-white/80">
          {formatRange(t.startDate, t.endDate)} · {formatDuration(t.startDate, t.endDate)}
          {dest && ` · ${dest}`}
        </p>
        <button type="button" className={`${btn.ghost} mt-3 text-ink`} onClick={() => setOpen(true)}>
          {copy.share.import}
        </button>
      </section>

      {recap && (
        <section className="mt-3 rounded-card bg-surface p-4 shadow-card" aria-label={copy.recap.title}>
          <h2 className="font-bold">{recap.title}</h2>
          <p className="mt-1 text-sm text-muted">{recap.summary}</p>
          <ul className="mt-2 grid gap-1 text-sm">
            {recap.highlights.map((h, i) => (
              <li key={i}>✦ {h}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-3 grid gap-3">
        {grouped.map((list, i) => (
          <section key={i} className="rounded-card bg-surface p-4 shadow-card">
            <h2 className="font-bold">
              {copy.plan.dayTitle(i + 1)} · {formatMdWeekday(dayYmd(t.startDate, i))}
            </h2>
            {list.length === 0 ? (
              <p className="mt-1 text-sm text-muted">{copy.plan.dayEmpty}</p>
            ) : (
              <ol className="mt-1 grid gap-2">
                {list.map((it) => {
                  const p = (it as unknown as { place: (typeof t.places)[number] }).place;
                  return (
                    <li key={it.id} className="text-sm">
                      <p className="tabular text-xs text-muted">
                        {hm(p.startTime)} – {hm(p.endTime)}
                      </p>
                      <p className="font-semibold">
                        {p.name}{' '}
                        <span className="rounded-full bg-primary-soft px-1.5 text-xs text-primary">
                          {LABELS_KO[p.category as PlaceCategory] ?? p.category}
                        </span>
                      </p>
                      {p.address && <p className="text-xs text-muted">{p.address}</p>}
                      {p.note && <p className="text-xs text-muted">{p.note}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        ))}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={copy.share.import}>
        {open && (
          <CopyTripForm
            defaultTitle={`${t.title} ${copy.share.copySuffix}`}
            withChecklist={false}
            busy={importer.isPending}
            onSubmit={(v) =>
              importer.mutate(v, {
                onSuccess: (id) => {
                  setLastNickname(v.nickname);
                  toast.success(copy.share.imported);
                  navigate(`/t/${id}`, { replace: true });
                },
                onError: () => toast.error(copy.common.saveFailed),
              })
            }
          />
        )}
      </Sheet>
    </main>
  );
}
