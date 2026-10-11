import { useEffect, useState } from 'react';
import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';
import { btn } from '@/components/styles';
import { aiErrorMessage, functionErrorCode } from '@/features/chat/api';
import { asAlternatives, type IndoorAlternative } from '@/lib/indoor';
import { supabase } from '@/lib/supabase';
import type { Place } from './api';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: IndoorAlternative[] };

/** Asks `ai-indoor-swap` for indoor alternatives to one place and lets the user swap it in. */
export function IndoorSheet({
  tripId,
  place,
  onClose,
  onReplace,
}: {
  tripId: string;
  place: Place | null;
  onClose: () => void;
  onReplace: (place: Place, alt: IndoorAlternative) => void;
}) {
  return (
    <Sheet open={!!place} onClose={onClose} title={copy.plan.indoorTitle}>
      {place && <Body key={place.id} tripId={tripId} place={place} onClose={onClose} onReplace={onReplace} />}
    </Sheet>
  );
}

function Body({
  tripId,
  place,
  onClose,
  onReplace,
}: {
  tripId: string;
  place: Place;
  onClose: () => void;
  onReplace: (place: Place, alt: IndoorAlternative) => void;
}) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!supabase) return;
    void supabase.functions
      .invoke('ai-indoor-swap', { body: { tripId, placeId: place.id } })
      .then(async ({ data, error }) => {
        if (!alive) return;
        if (error)
          return setState({ status: 'error', message: aiErrorMessage(await functionErrorCode(error)) });
        const items = asAlternatives((data as { data?: unknown } | null)?.data);
        setState(items.length ? { status: 'ready', items } : { status: 'error', message: copy.chat.failed });
      });
    return () => {
      alive = false;
    };
  }, [tripId, place.id, attempt]);

  if (state.status === 'loading')
    return (
      <p role="status" className="py-6 text-center text-muted">
        {copy.plan.indoorLoading}
      </p>
    );
  if (state.status === 'error')
    return (
      <div role="alert" className="grid gap-3 py-2 text-center">
        <p className="font-semibold">{state.message}</p>
        <button
          type="button"
          className={`${btn.primary} mx-auto`}
          onClick={() => {
            setState({ status: 'loading' });
            setAttempt((n) => n + 1);
          }}
        >
          {copy.common.retry}
        </button>
      </div>
    );

  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted">{copy.plan.indoorFor(place.name)}</p>
      <ul className="grid gap-2">
        {state.items.map((a) => (
          <li key={a.name} className="flex items-center gap-2 rounded-input border border-line p-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{a.name}</span>
              <span className="block text-xs text-muted">{a.reason}</span>
              {!a.resolved && (
                <span className="text-xs font-semibold text-amber-700">{copy.chat.unresolved}</span>
              )}
            </span>
            <button
              type="button"
              className={btn.primary}
              onClick={() => {
                onReplace(place, a);
                onClose();
              }}
            >
              {copy.plan.indoorReplace}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
