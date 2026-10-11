import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { Toaster } from 'sonner';
import { ensureSession } from '@/lib/supabase';
import { idbKV } from '@/lib/offlineStore';
import { PERSIST_MAX_AGE, shouldPersist } from '@/lib/offlineQueue';
import { copy } from '@/copy';
import { OfflineBanner } from './OfflineBanner';

const queryClient = new QueryClient({
  // gcTime must be at least the persist maxAge or restored queries would be dropped immediately
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false, gcTime: PERSIST_MAX_AGE },
  },
});

/** Read cache on the device (IndexedDB), trip data only, 7 days. Bump `buster` when cached shapes change. */
const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (k) => (await idbKV.get<string>(k)) ?? null,
    setItem: (k, v) => idbKV.set(k, v),
    removeItem: (k) => idbKV.set(k, undefined),
  },
  key: 'tp:query-cache',
  throttleTime: 2000,
});

type SessionState =
  { status: 'loading' } | { status: 'ready'; userId: string } | { status: 'error'; code: string };

/** Blocks the app until an (anonymous) Supabase session exists. */
function SessionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    ensureSession().then(
      (userId) => alive && setState({ status: 'ready', userId }),
      (e: unknown) =>
        alive && setState({ status: 'error', code: e instanceof Error ? e.message : 'UNKNOWN' }),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (state.status === 'ready') return <>{children}</>;
  if (state.status === 'loading') {
    return <p className="p-6 text-muted">{copy.common.loading}</p>;
  }
  return (
    <main className="mx-auto max-w-xl p-6">
      <p className="font-semibold">
        {state.code === 'ENV_MISSING' ? copy.session.envMissing : copy.session.failed}
      </p>
      {state.code !== 'ENV_MISSING' && (
        <button
          type="button"
          className="mt-4 min-h-11 rounded-full bg-primary px-5 text-white"
          onClick={() => {
            setState({ status: 'loading' });
            setAttempt((n) => n + 1);
          }}
        >
          {copy.common.retry}
        </button>
      )}
    </main>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        buster: 'v1',
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => q.state.status === 'success' && shouldPersist(q.queryKey),
        },
      }}
    >
      <OfflineBanner />
      <SessionGate>{children}</SessionGate>
      <Toaster position="top-center" />
    </PersistQueryClientProvider>
  );
}
