import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { btn, inputCls } from '@/components/styles';
import { Field, Skeleton } from '@/components/ui-kit';
import { aiErrorMessage, functionErrorCode } from '@/features/chat/api';
import { usePlaces } from '@/features/plan/api';
import { usePhotos, usePhotoUrl, useReviews } from '@/features/reviews/api';
import { keys as tripKeys, type Trip } from '@/features/trips/api';
import type { TripContext } from '@/features/trips/TripLayout';
import { stars } from '@/lib/reviews';
import { dayYmd, formatMdWeekday } from '@/lib/trip';
import { RecapResult } from '@/schemas/ai';
import { parseRecap, type Recap } from '@/lib/recap';
import { supabase } from '@/lib/supabase';
import { useOnline } from '@/lib/offlineStore';
import { topRated } from '../../../supabase/functions/_shared/recap';

/** Trip recap: AI-written title/summary/highlights/day lines, top-rated places with photos; editable by hand. */
export function RecapPage() {
  const { trip } = useOutletContext<TripContext>();
  const qc = useQueryClient();
  const online = useOnline();
  const places = usePlaces(trip.id);
  const reviews = useReviews(trip.id);
  const photos = usePhotos(trip.id);
  const [editing, setEditing] = useState(false);
  const recap = parseRecap(trip.recap);

  const generate = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error('ENV_MISSING');
      const { data, error } = await supabase.functions.invoke('ai-recap', { body: { tripId: trip.id } });
      if (error) throw error;
      return (data as { data: { recap: unknown } }).data.recap;
    },
    onSuccess: (r) =>
      qc.setQueryData<Trip | null>(tripKeys.trip(trip.id), (t) =>
        t ? { ...t, recap: r as Trip['recap'] } : t,
      ),
    onError: async (e) => toast.error(aiErrorMessage(await functionErrorCode(e))),
  });

  const save = useMutation({
    mutationFn: async (r: Recap) => {
      if (!supabase) throw new Error('ENV_MISSING');
      const { error } = await supabase.from('trips').update({ recap: r }).eq('id', trip.id);
      if (error) throw error;
      return r;
    },
    onSuccess: (r) =>
      qc.setQueryData<Trip | null>(tripKeys.trip(trip.id), (t) =>
        t ? { ...t, recap: r as Trip['recap'] } : t,
      ),
    onError: () => toast.error(copy.common.saveFailed),
  });

  const top = topRated(
    (places.data ?? []).filter((p) => p.day_index !== null),
    reviews.data ?? [],
    3,
  );

  return (
    <div className="p-4 pb-24">
      <h1 className="py-2 text-xl font-bold">{copy.recap.title}</h1>

      {!recap && (
        <div className="grid place-items-center gap-3 rounded-card bg-surface p-8 text-center shadow-card">
          <p className="font-semibold">{copy.recap.empty}</p>
          <p className="text-sm text-muted">{copy.recap.emptyHint}</p>
          <button
            type="button"
            className={btn.primary}
            disabled={generate.isPending || !online}
            onClick={() => generate.mutate()}
          >
            {generate.isPending ? copy.recap.making : copy.recap.make}
          </button>
        </div>
      )}

      {recap && !editing && (
        <article className="grid gap-3">
          <section className="rounded-card bg-hero p-5 text-white shadow-card">
            <h2 className="text-2xl font-bold">{recap.title}</h2>
            <p className="mt-2 text-sm text-white/85">{recap.summary}</p>
          </section>
          <section className="rounded-card bg-surface p-4 shadow-card" aria-label={copy.recap.highlights}>
            <h2 className="font-bold">{copy.recap.highlights}</h2>
            <ul className="mt-1 grid gap-1 text-sm">
              {recap.highlights.map((h, i) => (
                <li key={i}>✦ {h}</li>
              ))}
            </ul>
          </section>
          {recap.dayNotes.length > 0 && (
            <section className="rounded-card bg-surface p-4 shadow-card" aria-label={copy.recap.days}>
              <h2 className="font-bold">{copy.recap.days}</h2>
              <ol className="mt-1 grid gap-1 text-sm">
                {[...recap.dayNotes]
                  .sort((a, b) => a.dayIndex - b.dayIndex)
                  .map((n) => (
                    <li key={n.dayIndex}>
                      <b>{copy.plan.dayTitle(n.dayIndex + 1)}</b>{' '}
                      <span className="text-xs text-muted">
                        {formatMdWeekday(dayYmd(trip.start_date, n.dayIndex))}
                      </span>{' '}
                      · {n.line}
                    </li>
                  ))}
              </ol>
            </section>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className={btn.ghost}
              disabled={generate.isPending || !online}
              onClick={() => generate.mutate()}
            >
              {generate.isPending ? copy.recap.making : copy.recap.again}
            </button>
            <button type="button" className={btn.ghost} onClick={() => setEditing(true)}>
              {copy.recap.edit}
            </button>
          </div>
        </article>
      )}

      {recap && editing && (
        <EditForm
          recap={recap}
          onCancel={() => setEditing(false)}
          onSave={(r) => {
            save.mutate(r);
            setEditing(false);
          }}
        />
      )}

      {top.length > 0 && (
        <section className="mt-3 rounded-card bg-surface p-4 shadow-card" aria-label={copy.recap.top}>
          <h2 className="font-bold">{copy.recap.top}</h2>
          <ol className="mt-2 grid gap-3">
            {top.map((t, i) => {
              const photo = (photos.data ?? []).find((p) => p.place_id === t.place.id);
              return (
                <li key={t.place.id} className="flex items-center gap-3">
                  <span className="tabular w-5 text-lg font-extrabold text-primary">{i + 1}</span>
                  <TopPhoto path={photo?.storage_path ?? null} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{t.place.name}</span>
                    <span className="text-sm text-amber-500" aria-hidden>
                      {stars(t.avg)}
                    </span>
                    <span className="tabular ml-1 text-xs text-muted">
                      {t.avg.toFixed(1)}/5 · {t.count}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
      {places.isPending && <Skeleton className="mt-3 h-20" />}
    </div>
  );
}

function TopPhoto({ path }: { path: string | null }) {
  const url = usePhotoUrl(path);
  return (
    <span className="size-14 shrink-0 overflow-hidden rounded-input bg-bg">
      {url.data && <img src={url.data} alt="" className="size-full object-cover" />}
    </span>
  );
}

function EditForm({
  recap,
  onSave,
  onCancel,
}: {
  recap: Recap;
  onSave: (r: Recap) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(recap.title);
  const [summary, setSummary] = useState(recap.summary);
  const [highlights, setHighlights] = useState(recap.highlights.join('\n'));
  const lines = highlights
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const next = { ...recap, title: title.trim(), summary: summary.trim(), highlights: lines };
  const valid = RecapResult.safeParse(next).success;
  return (
    <form
      className="grid gap-3 rounded-card bg-surface p-4 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(next);
      }}
    >
      <Field label={copy.recap.fieldTitle}>
        <input className={inputCls} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={copy.recap.fieldSummary}>
        <textarea
          className={`${inputCls} min-h-24 py-2`}
          value={summary}
          maxLength={500}
          onChange={(e) => setSummary(e.target.value)}
        />
      </Field>
      <Field label={copy.recap.fieldHighlights} hint={copy.recap.fieldHighlightsHint}>
        <textarea
          className={`${inputCls} min-h-24 py-2`}
          value={highlights}
          onChange={(e) => setHighlights(e.target.value)}
        />
      </Field>
      {!valid && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {copy.recap.invalid}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className={`${btn.primary} flex-1`} disabled={!valid}>
          {copy.common.save}
        </button>
        <button type="button" className={btn.ghost} onClick={onCancel}>
          {copy.common.cancel}
        </button>
      </div>
    </form>
  );
}
