import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Send, Settings2 } from 'lucide-react';
import { copy } from '@/copy';
import { btn, inputCls } from '@/components/styles';
import { ErrorState, Skeleton } from '@/components/ui-kit';
import { usePlaces } from '@/features/plan/api';
import { useMembers } from '@/features/trips/api';
import type { TripContext } from '@/features/trips/TripLayout';
import { asProposal } from '@/lib/itinerary';
import { tripDays } from '@/lib/trip';
import { useSavedPlaces } from '@/features/saved/api';
import { prefsToText, readPrefs } from '@/lib/prefs';
import { useOnline } from '@/lib/offlineStore';
import { AiSettingsSheet } from './AiSettingsSheet';
import { WizardSheet } from './WizardSheet';
import { ProposalCard } from './ProposalCard';
import {
  useAiStatus,
  useApplyProposal,
  useChatMessages,
  useChatRealtime,
  useSavePrefs,
  useSendMessage,
} from './api';

export function ChatPage() {
  const { trip, me } = useOutletContext<TripContext>();
  const qc = useQueryClient();
  const messages = useChatMessages(trip.id);
  useChatRealtime(trip.id, qc);
  const members = useMembers(trip.id);
  const places = usePlaces(trip.id);
  const status = useAiStatus();
  const send = useSendMessage(trip.id);
  const savePrefs = useSavePrefs(trip.id);
  const saved = useSavedPlaces();
  const apply = useApplyProposal(trip.id, tripDays(trip.start_date, trip.end_date));

  const [text, setText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const online = useOnline();
  const noKey = !!status.data && !status.data.gemini && !status.data.openrouter && !status.data.fake;
  const count = messages.data?.length ?? 0;
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' });
  }, [count, send.isPending]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || send.isPending || noKey || !online) return;
    send.mutate(t, { onSuccess: () => setText('') });
  };

  const nameOf = (memberId: string | null) => members.data?.find((m) => m.id === memberId)?.nickname ?? '';
  const myMemberId = members.data?.find((m) => m.user_id === me)?.id;

  return (
    <div className="flex h-[calc(100dvh-5rem)] flex-col p-4 lg:h-[calc(100dvh-1.5rem)]">
      <header className="flex items-center justify-between py-2">
        <h1 className="text-xl font-bold">{copy.routes.chat}</h1>
        <button
          type="button"
          aria-label={copy.chat.settings}
          className="grid size-11 place-items-center rounded-full hover:bg-surface"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 className="size-5" aria-hidden />
        </button>
      </header>

      {!online && (
        <p role="status" className="mb-2 rounded-input bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          {copy.offline.needOnline}
        </p>
      )}
      {noKey && (
        <div role="status" className="mb-2 rounded-card bg-primary-soft p-4">
          <p className="font-bold">{copy.chat.needKey}</p>
          <p className="mt-1 text-sm text-muted">{copy.chat.needKeyBody}</p>
        </div>
      )}

      <div
        className="min-h-0 flex-1 overflow-y-auto rounded-card bg-surface p-3 shadow-card"
        aria-live="polite"
      >
        {messages.isPending && <Skeleton className="h-32" />}
        {messages.isError && (
          <ErrorState
            message={copy.common.loadFailed}
            onRetry={() => void messages.refetch()}
            retryLabel={copy.common.retry}
          />
        )}
        {messages.data?.length === 0 && (
          <div className="grid gap-2 py-8 text-center text-sm text-muted">
            <p className="font-semibold text-ink">{copy.chat.empty}</p>
            <button
              type="button"
              className="mx-auto min-h-11 rounded-full bg-primary px-5 font-semibold text-white disabled:opacity-50"
              disabled={noKey || !online}
              onClick={() => setWizardOpen(true)}
            >
              {copy.wizard.open}
            </button>
            {copy.chat.examples.map((ex) => (
              <button
                key={ex}
                type="button"
                className="min-h-11 rounded-full border border-line px-4 text-ink"
                onClick={() => setText(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
        )}
        <ul className="grid gap-3">
          {messages.data?.map((m) => {
            const mine = m.role === 'user' && m.member_id === myMemberId;
            const proposal = m.role === 'assistant' ? asProposal(m.proposal) : null;
            return (
              <li key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <p className="mb-0.5 text-xs text-muted">
                  {m.role === 'user'
                    ? mine
                      ? copy.members.me
                      : nameOf(m.member_id)
                    : `AI${m.provider ? ` · ${m.provider}` : ''}`}
                </p>
                <div
                  className={`max-w-[92%] whitespace-pre-wrap rounded-card px-3 py-2 ${m.role === 'user' ? 'bg-hero text-white' : 'bg-bg'}`}
                >
                  {m.content}
                  {proposal && (
                    <ProposalCard
                      proposal={proposal}
                      applied={m.proposal_applied}
                      current={places.data ?? []}
                      tripStart={trip.start_date}
                      busy={apply.isPending}
                      onApply={(mode) => apply.mutate({ message: m, mode })}
                    />
                  )}
                </div>
              </li>
            );
          })}
          {send.isPending && (
            <li className="text-sm text-muted" role="status">
              {copy.chat.thinking}
            </li>
          )}
        </ul>
        <div ref={bottom} />
      </div>

      <form onSubmit={submit} className="mt-2 flex gap-2">
        <input
          className={inputCls}
          value={text}
          placeholder={copy.chat.placeholder}
          aria-label={copy.chat.placeholder}
          maxLength={2000}
          disabled={noKey || !online}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          aria-label={copy.chat.send}
          className={`${btn.primary} !px-4`}
          disabled={!text.trim() || send.isPending || noKey || !online}
        >
          <Send className="size-5" aria-hidden />
        </button>
      </form>

      <WizardSheet
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        initial={readPrefs(trip.planning_prefs)}
        candidates={[
          ...new Set([
            ...(places.data ?? []).filter((p) => p.day_index === null).map((p) => p.name),
            ...(saved.data ?? []).map((s) => s.name),
          ]),
        ]}
        onFinish={(prefs) => {
          setWizardOpen(false);
          savePrefs.mutate(prefs);
          send.mutate({ message: prefsToText(prefs), mustInclude: prefs.mustInclude ?? [] });
        }}
      />
      <AiSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        trip={trip}
        status={status.data}
      />
    </div>
  );
}
