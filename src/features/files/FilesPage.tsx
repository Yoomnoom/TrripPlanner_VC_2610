import { useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileText, Image as ImageIcon, Link2, Pencil, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';
import { btn, inputCls } from '@/components/styles';
import { ErrorState, Field, Skeleton } from '@/components/ui-kit';
import { useReservations } from '@/features/reservations/api';
import { useMembers } from '@/features/trips/api';
import type { TripContext } from '@/features/trips/TripLayout';
import { formatBytes, normalizeUrl } from '@/lib/files';
import { useOnline } from '@/lib/offlineStore';
import { formatMd } from '@/lib/trip';
import {
  signedUrl,
  useAddLink,
  useDeleteFile,
  useFiles,
  useUpdateFile,
  useUploadFile,
  type TripFile,
} from './api';

export function FilesPage() {
  const { trip } = useOutletContext<TripContext>();
  const files = useFiles(trip.id);
  const reservations = useReservations(trip.id);
  const members = useMembers(trip.id);
  const upload = useUploadFile(trip.id);
  const addLink = useAddLink(trip.id);
  const update = useUpdateFile(trip.id);
  const del = useDeleteFile(trip.id);

  const online = useOnline();
  const input = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [editing, setEditing] = useState<TripFile | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const reservationTitle = (id: string | null) => reservations.data?.find((r) => r.id === id)?.title;

  const open = async (f: TripFile) => {
    if (f.kind === 'link' && f.url) return void window.open(f.url, '_blank', 'noopener,noreferrer');
    if (!f.storage_path) return;
    setOpening(f.id);
    const url = await signedUrl('trip-files', f.storage_path);
    setOpening(null);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else toast.error(copy.files.openFailed);
  };

  return (
    <div className="p-4">
      <header className="flex items-center justify-between gap-2 py-2">
        <h1 className="text-xl font-bold">{copy.routes.files}</h1>
        <div className="flex gap-2">
          <button type="button" className={btn.ghost} onClick={() => setLinkOpen(true)}>
            <Link2 className="size-4" aria-hidden />
            {copy.files.addLink}
          </button>
          <button
            type="button"
            className={btn.dark}
            onClick={() => input.current?.click()}
            disabled={upload.isPending || !online}
          >
            <Upload className="size-4" aria-hidden />
            {upload.isPending ? copy.files.uploading : copy.files.upload}
          </button>
          <input
            ref={input}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) setPendingFile(f);
            }}
          />
        </div>
      </header>

      <p role="note" className="rounded-input bg-primary-soft p-3 text-sm">
        {copy.files.privacy}
      </p>

      {files.isPending && <Skeleton className="mt-3 h-32" />}
      {files.isError && (
        <ErrorState
          message={copy.common.loadFailed}
          onRetry={() => void files.refetch()}
          retryLabel={copy.common.retry}
        />
      )}
      {files.data?.length === 0 && <p className="py-10 text-center text-muted">{copy.files.empty}</p>}

      <ul className="mt-3 grid gap-2">
        {files.data?.map((f) => {
          const who = members.data?.find((m) => m.user_id === f.created_by)?.nickname;
          const Icon = f.kind === 'link' ? Link2 : f.mime_type?.startsWith('image/') ? ImageIcon : FileText;
          return (
            <li key={f.id} className="flex items-center gap-1 rounded-card bg-surface p-2 shadow-card">
              <button
                type="button"
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-2 text-left"
                onClick={() => void open(f)}
                disabled={opening === f.id}
              >
                <Icon className="size-6 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{f.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {f.kind === 'file' && f.size_bytes ? `${formatBytes(Number(f.size_bytes))} · ` : ''}
                    {who ? `${who} · ` : ''}
                    {formatMd(f.created_at.slice(0, 10))}
                    {reservationTitle(f.reservation_id)
                      ? ` · ${copy.files.linked(reservationTitle(f.reservation_id)!)}`
                      : ''}
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label={`${f.title} ${copy.checklist.rename}`}
                className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-bg"
                onClick={() => setEditing(f)}
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`${f.title} ${copy.checklist.remove}`}
                className="grid size-11 shrink-0 place-items-center rounded-full text-danger hover:bg-bg"
                onClick={() => del.mutate(f)}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      <Sheet open={!!pendingFile} onClose={() => setPendingFile(null)} title={copy.files.upload}>
        {pendingFile && (
          <MetaForm
            key={pendingFile.name + pendingFile.size}
            initialTitle={pendingFile.name}
            reservations={reservations.data ?? []}
            submitLabel={copy.files.upload}
            onSubmit={({ title, reservationId }) => {
              upload.mutate({ file: pendingFile, title, reservationId });
              setPendingFile(null);
            }}
          />
        )}
      </Sheet>

      <Sheet open={linkOpen} onClose={() => setLinkOpen(false)} title={copy.files.addLink}>
        {linkOpen && (
          <MetaForm
            withUrl
            initialTitle=""
            reservations={reservations.data ?? []}
            submitLabel={copy.common.save}
            onSubmit={({ title, url, reservationId }) => {
              addLink.mutate({ title, url: url!, reservationId });
              setLinkOpen(false);
            }}
          />
        )}
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={copy.checklist.rename}>
        {editing && (
          <MetaForm
            key={editing.id}
            initialTitle={editing.title}
            initialReservation={editing.reservation_id}
            reservations={reservations.data ?? []}
            submitLabel={copy.common.save}
            onSubmit={({ title, reservationId }) => {
              update.mutate({ id: editing.id, patch: { title, reservation_id: reservationId } });
              setEditing(null);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function MetaForm({
  initialTitle,
  initialReservation = null,
  withUrl,
  reservations,
  submitLabel,
  onSubmit,
}: {
  initialTitle: string;
  initialReservation?: string | null;
  withUrl?: boolean;
  reservations: { id: string; title: string }[];
  submitLabel: string;
  onSubmit: (v: { title: string; url?: string; reservationId: string | null }) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [url, setUrl] = useState('');
  const [reservationId, setReservationId] = useState<string>(initialReservation ?? '');
  const normalized = withUrl ? normalizeUrl(url) : null;
  const canSubmit = title.trim() !== '' && (!withUrl || normalized !== null);
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit)
          onSubmit({
            title: title.trim(),
            url: normalized ?? undefined,
            reservationId: reservationId || null,
          });
      }}
    >
      <Field label={copy.files.title}>
        <input
          className={inputCls}
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      {withUrl && (
        <Field label="URL" hint={url && !normalized ? copy.files.badUrl : undefined}>
          <input className={inputCls} inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
      )}
      <Field label={copy.files.reservation}>
        <select className={inputCls} value={reservationId} onChange={(e) => setReservationId(e.target.value)}>
          <option value="">{copy.expenses.placeNone}</option>
          {reservations.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </Field>
      <button type="submit" className={btn.primary} disabled={!canSubmit}>
        {submitLabel}
      </button>
    </form>
  );
}
