import { useState } from 'react';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';
import { btn, inputCls } from '@/components/styles';
import { inviteUrl } from '@/lib/trip';
import { copyInvite } from './invite';
import { useSetInvite, type Trip } from './api';

/** Invite link sheet: read-only link + copy, or the "sharing off" state (owner can turn it back on). */
export function InviteSheet({
  trip,
  isOwner,
  open,
  onClose,
}: {
  trip: Trip;
  isOwner: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const setInvite = useSetInvite(trip.id);
  const token = trip.invite_token;

  return (
    <Sheet open={open} onClose={onClose} title={copy.members.inviteSheet}>
      {token ? (
        <div className="grid gap-3">
          <input
            readOnly
            aria-label={copy.members.linkLabel}
            className={inputCls}
            value={inviteUrl(window.location.origin, token)}
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="flex gap-2">
            <button type="button" className={`${btn.dark} flex-1`} onClick={() => void copyInvite(token)}>
              {copy.members.copy}
            </button>
            <button type="button" className={`${btn.ghost} flex-1`} onClick={onClose}>
              {copy.members.close}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="font-semibold">{copy.members.sharingOff}</p>
          {isOwner ? (
            <>
              <p className="text-sm text-muted">{copy.members.sharingOffOwner}</p>
              <button
                type="button"
                className={btn.primary}
                disabled={setInvite.isPending}
                onClick={() =>
                  setInvite.mutate(true, { onSuccess: () => toast.success(copy.members.resumed) })
                }
              >
                {copy.members.resume}
              </button>
            </>
          ) : (
            <p className="text-sm text-muted">{copy.members.ownerOnly}</p>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** Share menu: copy link / stop sharing (two-step confirm). */
export function ShareMenuSheet({
  trip,
  isOwner,
  open,
  onClose,
}: {
  trip: Trip;
  isOwner: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const setInvite = useSetInvite(trip.id);
  const [confirming, setConfirming] = useState(false);
  const token = trip.invite_token;

  const close = () => {
    setConfirming(false);
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={copy.members.shareMenu}>
      <div className="grid gap-2">
        {token && (
          <button
            type="button"
            className={btn.ghost}
            onClick={() => {
              void copyInvite(token);
              close();
            }}
          >
            {copy.members.copyLink}
          </button>
        )}
        {!token && <p className="text-sm text-muted">{copy.members.sharingOff}</p>}

        {isOwner && token && !confirming && (
          <button type="button" className={`${btn.ghost} text-danger`} onClick={() => setConfirming(true)}>
            {copy.members.stopShare}
          </button>
        )}
        {isOwner && token && confirming && (
          <div role="alert" className="grid gap-2 rounded-input bg-bg p-3">
            <p className="text-sm">{copy.members.stopConfirm}</p>
            <div className="flex gap-2">
              <button
                type="button"
                className={`${btn.danger} flex-1`}
                disabled={setInvite.isPending}
                onClick={() =>
                  setInvite.mutate(false, {
                    onSuccess: () => {
                      toast.success(copy.members.stopped);
                      close();
                    },
                  })
                }
              >
                {copy.members.stopShare}
              </button>
              <button type="button" className={`${btn.ghost} flex-1`} onClick={() => setConfirming(false)}>
                {copy.common.cancel}
              </button>
            </div>
          </div>
        )}
        {isOwner && !token && (
          <button
            type="button"
            className={btn.primary}
            disabled={setInvite.isPending}
            onClick={() =>
              setInvite.mutate(true, {
                onSuccess: () => {
                  toast.success(copy.members.resumed);
                  close();
                },
              })
            }
          >
            {copy.members.resume}
          </button>
        )}
      </div>
    </Sheet>
  );
}
