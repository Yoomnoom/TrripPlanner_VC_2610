import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import pkg from '../../../package.json';
import { copy } from '@/copy';
import { btn, inputCls } from '@/components/styles';
import { Field, Skeleton } from '@/components/ui-kit';
import { AiSettingsSheet } from '@/features/chat/AiSettingsSheet';
import { useAiStatus } from '@/features/chat/api';
import { footprintKey, useFootprints } from '@/features/footprints/api';
import { useMyTrips } from '@/features/trips/api';
import { buildBackup, parseBackup } from '@/lib/backup';
import { getLastNickname, setLastNickname } from '@/lib/device';
import { googleEnabled } from '@/lib/env';
import { supabase } from '@/lib/supabase';

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SettingsPage() {
  const qc = useQueryClient();
  const trips = useMyTrips();
  const footprints = useFootprints();
  const ai = useAiStatus();
  const file = useRef<HTMLInputElement>(null);
  const [tripId, setTripId] = useState('');
  const [aiOpen, setAiOpen] = useState(false);

  const trip = trips.data?.find((t) => t.trip.id === tripId)?.trip ?? trips.data?.[0]?.trip;

  const exportData = () => {
    const b = buildBackup({
      nickname: getLastNickname() || null,
      trips: (trips.data ?? []).map((t) => t.trip),
      footprints: footprints.data ?? [],
    });
    download(`trip-planner-${b.exportedAt.slice(0, 10)}.json`, JSON.stringify(b, null, 2));
    toast.success(copy.settings.exported);
  };

  const importData = async (f: File) => {
    const parsed = parseBackup(await f.text());
    if (!parsed.ok)
      return void toast.error(parsed.reason === 'json' ? copy.settings.notJson : copy.settings.badBackup);
    if (!supabase) return;
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return void toast.error(copy.common.saveFailed);
    if (parsed.backup.footprints.length > 0) {
      const { error } = await supabase.from('footprints').upsert(
        parsed.backup.footprints.map((x) => ({ ...x, user_id: uid })),
        { onConflict: 'user_id,kind,code' },
      );
      if (error) return void toast.error(copy.common.saveFailed);
    }
    if (parsed.backup.nickname) setLastNickname(parsed.backup.nickname);
    await qc.invalidateQueries({ queryKey: footprintKey });
    toast.success(copy.settings.imported(parsed.backup.footprints.length));
  };

  const clearCache = () => {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('tp:')) localStorage.removeItem(k);
    } catch {
      // storage unavailable: nothing to clear
    }
    qc.clear();
    toast.success(copy.settings.cleared);
  };

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
        <h1 className="text-xl font-bold">{copy.routes.settings}</h1>
      </header>

      <section className="mt-2 grid gap-3 rounded-card bg-surface p-4 shadow-card">
        <h2 className="font-bold">{copy.settings.ai}</h2>
        {trips.isPending ? (
          <Skeleton className="h-12" />
        ) : !trip ? (
          <p className="text-sm text-muted">{copy.settings.noTrip}</p>
        ) : (
          <>
            <Field label={copy.settings.pickTrip}>
              <select className={inputCls} value={trip.id} onChange={(e) => setTripId(e.target.value)}>
                {trips.data?.map(({ trip: t }) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </Field>
            <p className="text-sm text-muted">
              {copy.settings.current(
                trip.ai_provider === 'gemini' ? 'Gemini' : 'OpenRouter',
                trip.ai_model,
                trip.ai_fallback,
              )}
            </p>
            <button type="button" className={btn.dark} onClick={() => setAiOpen(true)}>
              {copy.chat.settings}
            </button>
            {trip && (
              <AiSettingsSheet open={aiOpen} onClose={() => setAiOpen(false)} trip={trip} status={ai.data} />
            )}
          </>
        )}
      </section>

      <section className="mt-3 grid gap-3 rounded-card bg-surface p-4 shadow-card">
        <h2 className="font-bold">{copy.settings.data}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btn.ghost}
            onClick={exportData}
            disabled={trips.isPending || footprints.isPending}
          >
            {copy.settings.export}
          </button>
          <button type="button" className={btn.ghost} onClick={() => file.current?.click()}>
            {copy.settings.import}
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void importData(f);
            }}
          />
          <button type="button" className={`${btn.ghost} text-danger`} onClick={clearCache}>
            {copy.settings.clearCache}
          </button>
        </div>
        <p className="text-xs text-muted">{copy.settings.dataHint}</p>
        <p className="text-xs text-muted">{copy.members.rejoinNote}</p>
      </section>

      <section className="mt-3 rounded-card bg-surface p-4 shadow-card">
        <h2 className="font-bold">{copy.settings.about}</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{copy.settings.version}</dt>
          <dd>{pkg.version}</dd>
          <dt className="text-muted">{copy.settings.map}</dt>
          <dd>{googleEnabled ? 'Google 지도' : copy.settings.mapOff}</dd>
          <dt className="text-muted">AI</dt>
          <dd>
            {ai.data
              ? [
                  ai.data.gemini && 'Gemini',
                  ai.data.openrouter && 'OpenRouter',
                  ai.data.fake && '테스트용 가짜',
                ]
                  .filter(Boolean)
                  .join(', ') || copy.settings.aiOff
              : '…'}
          </dd>
        </dl>
        <p className="mt-3 text-xs text-muted">{copy.settings.privacy}</p>
      </section>
    </main>
  );
}
