import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { ErrorState, Field, Skeleton } from '@/components/ui-kit';
import { btn, inputCls } from '@/components/styles';
import { getLastNickname, setLastNickname } from '@/lib/device';
import { formatDuration, formatRange, nicknameSchema } from '@/lib/trip';
import { errorCode, peekInvite, useJoinTrip } from './api';

export function JoinPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const join = useJoinTrip();
  const [nickname, setNickname] = useState(getLastNickname());

  const preview = useQuery({ queryKey: ['invite', token], queryFn: () => peekInvite(token), retry: false });
  const nick = nicknameSchema.safeParse(nickname);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!nick.success || join.isPending) return;
    join.mutate(
      { token, nickname: nick.data },
      {
        onSuccess: (tripId) => {
          setLastNickname(nick.data);
          navigate(`/t/${tripId}`, { replace: true });
        },
        onError: (e) => {
          if (errorCode(e) === 'invalid_invite') void preview.refetch();
          else toast.error(copy.join.failed);
        },
      },
    );
  };

  if (preview.isPending) {
    return (
      <main className="mx-auto max-w-md p-4" aria-busy>
        <Skeleton className="mt-8 h-56" />
      </main>
    );
  }
  if (preview.isError) {
    return (
      <main className="mx-auto max-w-md p-4">
        <ErrorState
          message={copy.common.loadFailed}
          onRetry={() => void preview.refetch()}
          retryLabel={copy.common.retry}
        />
      </main>
    );
  }
  if (!preview.data) {
    return (
      <main className="mx-auto grid max-w-md gap-3 p-8 text-center">
        <h1 className="text-xl font-bold">{copy.join.invalidTitle}</h1>
        <p className="text-muted">{copy.join.invalidBody}</p>
        <Link to="/" className={`${btn.ghost} mx-auto`}>
          {copy.join.goHome}
        </Link>
      </main>
    );
  }

  const t = preview.data;
  return (
    <main className="mx-auto max-w-md p-4">
      <section className="mt-8 rounded-card bg-hero p-6 text-white shadow-card">
        <p className="text-sm text-white/70">{copy.join.heading}</p>
        <h1 className="mt-1 text-2xl font-bold">{t.title}</h1>
        <p className="mt-2 text-sm text-white/80">
          {formatRange(t.start_date, t.end_date)} · {formatDuration(t.start_date, t.end_date)} ·{' '}
          {copy.join.members(t.member_count)}
        </p>
      </section>

      <form onSubmit={onSubmit} className="mt-4 grid gap-4 rounded-card bg-surface p-5 shadow-card">
        <Field label={copy.join.nickname} hint={copy.join.nicknameHint}>
          <input
            required
            className={inputCls}
            value={nickname}
            maxLength={20}
            onChange={(e) => setNickname(e.target.value)}
          />
        </Field>
        <button type="submit" className={btn.primary} disabled={!nick.success || join.isPending}>
          {join.isPending ? copy.join.joining : copy.join.submit}
        </button>
      </form>
    </main>
  );
}
