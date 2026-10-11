import { toast } from 'sonner';
import { copy } from '@/copy';
import { btn, inputCls } from '@/components/styles';
import type { Trip } from '@/features/trips/api';
import { copyText } from '@/lib/device';
import { viewUrl } from '@/lib/external';
import { useSetViewLink } from './api';

/** "보기 링크": a separate, read-only link (no editing, no money/reservations/files/chat/members). Owner only. */
export function ViewLinkSection({ trip, isOwner }: { trip: Trip; isOwner: boolean }) {
  const set = useSetViewLink(trip.id);
  const token = trip.view_token;

  const copyLink = async () => {
    if (!token) return;
    const ok = await copyText(viewUrl(window.location.origin, token));
    if (ok) toast.success(copy.share.copied);
    else toast.error(copy.members.copyFailed);
  };

  return (
    <section className="mt-4 rounded-card bg-surface p-4 shadow-card" aria-label={copy.share.viewLink}>
      <h2 className="font-bold">{copy.share.viewLink}</h2>
      <p className="mt-1 text-sm text-muted">{copy.share.viewHint}</p>
      {token ? (
        <div className="mt-3 grid gap-2">
          <input
            readOnly
            aria-label={copy.share.viewLink}
            className={inputCls}
            value={viewUrl(window.location.origin, token)}
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn.dark} onClick={() => void copyLink()}>
              {copy.members.copy}
            </button>
            {isOwner && (
              <>
                <button
                  type="button"
                  className={btn.ghost}
                  disabled={set.isPending}
                  onClick={() => set.mutate(true, { onSuccess: () => toast.success(copy.share.reissued) })}
                >
                  {copy.share.reissue}
                </button>
                <button
                  type="button"
                  className={`${btn.ghost} text-danger`}
                  disabled={set.isPending}
                  onClick={() => set.mutate(false, { onSuccess: () => toast.success(copy.share.stopped) })}
                >
                  {copy.share.stop}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          {isOwner ? (
            <button
              type="button"
              className={btn.primary}
              disabled={set.isPending}
              onClick={() => set.mutate(true)}
            >
              {copy.share.turnOn}
            </button>
          ) : (
            <p className="text-sm text-muted">{copy.share.off}</p>
          )}
        </div>
      )}
    </section>
  );
}
