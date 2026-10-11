import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ensureSession } from '@/lib/supabase';
import { copy } from '@/copy';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

type SessionState = { status: 'loading' } | { status: 'ready'; userId: string } | { status: 'error'; code: string };

/** Blocks the app until an (anonymous) Supabase session exists. */
function SessionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    ensureSession().then(
      (userId) => alive && setState({ status: 'ready', userId }),
      (e: unknown) => alive && setState({ status: 'error', code: e instanceof Error ? e.message : 'UNKNOWN' }),
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
      <p className="font-semibold">{state.code === 'ENV_MISSING' ? copy.session.envMissing : copy.session.failed}</p>
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
    <QueryClientProvider client={queryClient}>
      <SessionGate>{children}</SessionGate>
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}