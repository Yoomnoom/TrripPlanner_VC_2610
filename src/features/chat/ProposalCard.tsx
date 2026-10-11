import { useMemo, useState } from 'react';
import { copy } from '@/copy';
import { btn } from '@/components/styles';
import type { Place } from '@/features/plan/api';
import { diffItinerary, unresolvedCount, type Proposal } from '@/lib/itinerary';
import { dayYmd, formatMdWeekday } from '@/lib/trip';
import { LABELS_KO } from '@/types/domain';

/** Preview of an AI itinerary with a diff against the current schedule and apply buttons. */
export function ProposalCard({
  proposal,
  applied,
  current,
  tripStart,
  busy,
  onApply,
}: {
  proposal: Proposal;
  applied: boolean;
  current: Place[];
  tripStart: string;
  busy: boolean;
  onApply: (mode: 'overwrite' | 'append') => void;
}) {
  const [open, setOpen] = useState(false);
  const diff = useMemo(() => diffItinerary(current, proposal), [current, proposal]);
  const hasCurrent = current.some((p) => p.day_index !== null);
  const unresolved = unresolvedCount(proposal);

  return (
    <div className="mt-2 rounded-input border border-line bg-surface p-3 text-ink">
      <p className="text-sm font-bold">{copy.chat.proposal}</p>
      <ol className="mt-1 grid gap-2 text-sm">
        {proposal.days.map((d) => (
          <li key={d.dayIndex}>
            <p className="font-semibold">
              {copy.plan.dayTitle(d.dayIndex + 1)} · {formatMdWeekday(dayYmd(tripStart, d.dayIndex))} ·{' '}
              {d.title}
            </p>
            <ul className="mt-0.5 grid gap-0.5 text-muted">
              {d.items.map((it, i) => (
                <li key={i} className="flex flex-wrap items-center gap-1.5">
                  <span className="tabular">{it.startTime}</span>
                  <span className="text-ink">{it.name}</span>
                  <span className="rounded-full bg-primary-soft px-1.5 text-xs font-semibold text-primary">
                    {LABELS_KO[it.category as keyof typeof LABELS_KO] ?? it.category}
                  </span>
                  {!it.resolved && (
                    <span className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800">
                      {copy.chat.unresolved}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {unresolved > 0 && <p className="mt-2 text-xs text-muted">{copy.chat.unresolvedHint(unresolved)}</p>}

      {hasCurrent && (
        <div className="mt-2">
          <button
            type="button"
            className="min-h-11 text-sm font-semibold text-primary"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {copy.chat.diffSummary(diff.added.length, diff.changed.length, diff.removed.length)}
          </button>
          {open && (
            <ul className="grid gap-0.5 text-xs">
              {diff.added.map((a) => (
                <li key={`a${a.day}${a.name}`}>
                  ＋ {copy.plan.dayTitle(a.day + 1)} {a.name}
                </li>
              ))}
              {diff.changed.map((c) => (
                <li key={`c${c.name}`}>
                  ↔ {c.name}: {c.from} → {c.to}
                </li>
              ))}
              {diff.removed.map((r) => (
                <li key={`r${r.day}${r.name}`} className="text-danger">
                  － {copy.plan.dayTitle(r.day + 1)} {r.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {applied ? (
        <p className="mt-2 text-sm font-semibold text-positive">✓ {copy.chat.appliedBadge}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className={btn.primary}
            disabled={busy}
            onClick={() => onApply(hasCurrent ? 'overwrite' : 'append')}
          >
            {hasCurrent ? copy.chat.applyOverwrite : copy.chat.applyNew}
          </button>
          {hasCurrent && (
            <button type="button" className={btn.ghost} disabled={busy} onClick={() => onApply('append')}>
              {copy.chat.applyAppend}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
