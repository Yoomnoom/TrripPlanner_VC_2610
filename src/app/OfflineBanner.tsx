import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { flushQueue, useOnline, useQueueSize } from '@/lib/offlineStore';

/** Top banner while offline, with the number of queued writes. Flushes the queue when the connection returns. */
export function OfflineBanner() {
  const online = useOnline();
  const waiting = useQueueSize();
  const qc = useQueryClient();

  useEffect(() => {
    if (!online) return;
    let alive = true;
    void flushQueue().then((r) => {
      if (!alive || (r.done === 0 && r.dropped.length === 0)) return;
      if (r.done > 0) toast.success(copy.offline.synced(r.done));
      if (r.dropped.length > 0) toast.error(copy.offline.dropped(r.dropped.length));
      // one refresh of the lists that queued writes touched (Realtime handles the other devices)
      for (const key of ['checklist', 'expenses', 'places']) void qc.invalidateQueries({ queryKey: [key] });
    });
    return () => {
      alive = false;
    };
  }, [online, qc]);

  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-30 bg-amber-500 px-4 py-2 text-center text-sm font-bold text-ink"
    >
      {copy.offline.banner}
      {waiting > 0 && <span className="ml-2">{copy.offline.waiting(waiting)}</span>}
    </div>
  );
}
