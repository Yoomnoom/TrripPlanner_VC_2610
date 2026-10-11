import { useState } from 'react';
import { btn, inputCls } from '@/components/styles';
import { Field } from '@/components/ui-kit';
import { copy } from '@/copy';
import { getLastNickname } from '@/lib/device';
import { nicknameSchema, todayYmd } from '@/lib/trip';

/** Title, start date and my nickname for a copied/imported trip (the schedule keeps its times, only the dates move). */
export function CopyTripForm({
  defaultTitle,
  withChecklist,
  busy,
  onSubmit,
}: {
  defaultTitle: string;
  withChecklist: boolean;
  busy: boolean;
  onSubmit: (v: { title: string; start: string; nickname: string; checklist: boolean }) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [start, setStart] = useState(todayYmd());
  const [nickname, setNickname] = useState(getLastNickname());
  const [checklist, setChecklist] = useState(true);
  const nick = nicknameSchema.safeParse(nickname);
  const ok = title.trim() !== '' && start !== '' && nick.success && !busy;
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok && nick.success) onSubmit({ title: title.trim(), start, nickname: nick.data, checklist });
      }}
    >
      <Field label={copy.newTrip.title}>
        <input className={inputCls} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={copy.newTrip.start}>
        <input
          type="date"
          required
          className={inputCls}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </Field>
      <Field label={copy.newTrip.nickname}>
        <input
          required
          className={inputCls}
          value={nickname}
          maxLength={20}
          onChange={(e) => setNickname(e.target.value)}
        />
      </Field>
      {withChecklist && (
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="size-5 accent-[var(--color-primary)]"
            checked={checklist}
            onChange={(e) => setChecklist(e.target.checked)}
          />
          {copy.share.withChecklist}
        </label>
      )}
      <p className="text-xs text-muted">{copy.share.copyHint}</p>
      <button type="submit" className={btn.primary} disabled={!ok}>
        {busy ? copy.newTrip.creating : copy.share.makeCopy}
      </button>
    </form>
  );
}
