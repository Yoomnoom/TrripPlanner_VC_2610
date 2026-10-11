import { toast } from 'sonner';
import { copy } from '@/copy';
import { copyText } from '@/lib/device';
import { inviteUrl } from '@/lib/trip';

export async function copyInvite(token: string) {
  const ok = await copyText(inviteUrl(window.location.origin, token));
  if (ok) toast.success(copy.members.copied);
  else toast.error(copy.members.copyFailed);
}
