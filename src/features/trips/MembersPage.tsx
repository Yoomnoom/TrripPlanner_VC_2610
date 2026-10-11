import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Share2, UserPlus, Pencil, Trash2 } from 'lucide-react';
import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';
import { Avatar, ErrorState, Field, Skeleton } from '@/components/ui-kit';
import { btn, inputCls } from '@/components/styles';
import { formatMd, MEMBER_COLORS, nicknameSchema } from '@/lib/trip';
import { useMembers, useRemoveMember, useUpdateMyMember, type Member } from './api';
import { InviteSheet, ShareMenuSheet } from './InviteSheet';
import type { TripContext } from './TripLayout';

export function MembersPage() {
  const { trip, me } = useOutletContext<TripContext>();
  const members = useMembers(trip.id);
  const update = useUpdateMyMember(trip.id);
  const remove = useRemoveMember(trip.id);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);

  const myMember = members.data?.find((m) => m.user_id === me);
  const isOwner = myMember?.role === 'owner';

  return (
    <div className="p-4">
      <header className="flex items-center justify-between py-2">
        <h1 className="text-xl font-bold">
          {copy.members.heading} {members.data && <span className="text-muted">{members.data.length}</span>}
        </h1>
        <div className="flex items-center gap-1">
          <button type="button" className={btn.dark} onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" aria-hidden />
            {copy.members.invite}
          </button>
          <button
            type="button"
            aria-label={copy.members.shareMenu}
            className="grid size-11 place-items-center rounded-full hover:bg-surface"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="size-5" aria-hidden />
          </button>
        </div>
      </header>

      {members.isPending && <Skeleton className="mt-3 h-40" />}
      {members.isError && (
        <ErrorState
          message={copy.common.loadFailed}
          onRetry={() => void members.refetch()}
          retryLabel={copy.common.retry}
        />
      )}

      <ul className="mt-3 divide-y divide-line rounded-card bg-surface shadow-card">
        {members.data?.map((m) => (
          <li key={m.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
            <Avatar nickname={m.nickname} color={m.color} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {m.nickname}
                {m.user_id === me && (
                  <span className="ml-1.5 text-xs font-bold text-primary">{copy.members.me}</span>
                )}
              </p>
              <p className="text-xs text-muted">
                {copy.members.joinedAt(formatMd(m.joined_at.slice(0, 10)))}
              </p>
            </div>
            {m.role === 'owner' && (
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
                {copy.members.owner}
              </span>
            )}
            {m.user_id === me && (
              <button
                type="button"
                aria-label={copy.members.edit}
                className="grid size-11 place-items-center rounded-full hover:bg-bg"
                onClick={() => setEditing(m)}
              >
                <Pencil className="size-4" aria-hidden />
              </button>
            )}
            {isOwner && m.user_id !== me && (
              <button
                type="button"
                aria-label={`${m.nickname} ${copy.members.remove}`}
                className="grid size-11 place-items-center rounded-full text-danger hover:bg-bg"
                onClick={() => setRemoving(m)}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">{copy.members.rejoinNote}</p>

      <InviteSheet trip={trip} isOwner={isOwner} open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <ShareMenuSheet trip={trip} isOwner={isOwner} open={shareOpen} onClose={() => setShareOpen(false)} />

      <EditSheet
        member={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) update.mutate({ id: editing.id, patch });
          setEditing(null);
        }}
      />

      <Sheet open={!!removing} onClose={() => setRemoving(null)} title={copy.members.remove}>
        <p>{removing && copy.members.removeConfirm(removing.nickname)}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className={`${btn.danger} flex-1`}
            onClick={() => {
              if (removing) remove.mutate(removing.id);
              setRemoving(null);
            }}
          >
            {copy.members.remove}
          </button>
          <button type="button" className={`${btn.ghost} flex-1`} onClick={() => setRemoving(null)}>
            {copy.common.cancel}
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function EditSheet({
  member,
  onClose,
  onSave,
}: {
  member: Member | null;
  onClose: () => void;
  onSave: (patch: { nickname: string; color: string }) => void;
}) {
  return (
    <Sheet open={!!member} onClose={onClose} title={copy.members.edit}>
      {/* keyed so the draft resets for each member */}
      {member && <EditForm key={member.id} member={member} onSave={onSave} />}
    </Sheet>
  );
}

function EditForm({
  member,
  onSave,
}: {
  member: Member;
  onSave: (patch: { nickname: string; color: string }) => void;
}) {
  const [nickname, setNickname] = useState(member.nickname);
  const [color, setColor] = useState(member.color);
  const nick = nicknameSchema.safeParse(nickname);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (nick.success) onSave({ nickname: nick.data, color });
      }}
    >
      <Field label={copy.members.nickname}>
        <input
          className={inputCls}
          value={nickname}
          maxLength={20}
          onChange={(e) => setNickname(e.target.value)}
        />
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">{copy.members.color}</legend>
        <div className="flex flex-wrap gap-2">
          {MEMBER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`size-11 rounded-full ${color === c ? 'ring-2 ring-ink ring-offset-2' : ''}`}
            >
              {color === c && <span className="text-white">✓</span>}
            </button>
          ))}
        </div>
      </fieldset>
      <button type="submit" className={btn.primary} disabled={!nick.success}>
        {copy.common.save}
      </button>
    </form>
  );
}
