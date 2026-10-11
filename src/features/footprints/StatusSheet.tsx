import { useState } from 'react';
import { Link } from 'react-router-dom';
import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';
import { btn, inputCls } from '@/components/styles';
import { Field } from '@/components/ui-kit';
import type { Footprint, FootprintInput, FootprintKind } from './api';
import { choiceOf, periodLabel, visitedPeriod, wishPeriod, type WishChoice } from './period';

export interface Target {
  kind: FootprintKind;
  code: string;
  name: string;
}

/** The "가봤어요 / 가보고 싶어요" sheet; for an already-marked place it edits status, memo and period or clears it. */
export function StatusSheet({
  target,
  existing,
  onClose,
  onSave,
  onRemove,
}: {
  target: Target | null;
  existing: Footprint | undefined;
  onClose: () => void;
  onSave: (input: FootprintInput) => void;
  onRemove: () => void;
}) {
  return (
    <Sheet open={!!target} onClose={onClose} title={target?.name ?? ''}>
      {target && (
        <Body
          key={`${target.kind}:${target.code}`}
          target={target}
          existing={existing}
          onSave={onSave}
          onRemove={onRemove}
          onClose={onClose}
        />
      )}
    </Sheet>
  );
}

function Body({
  target,
  existing,
  onSave,
  onRemove,
  onClose,
}: {
  target: Target;
  existing: Footprint | undefined;
  onSave: (input: FootprintInput) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const year = new Date().getFullYear();
  const [mode, setMode] = useState<'pick' | 'wish' | 'visited'>(
    existing ? (existing.status === 'wish' ? 'wish' : 'visited') : 'pick',
  );
  const init = choiceOf(existing?.status === 'wish' ? existing.period : null, year);
  const [choice, setChoice] = useState<WishChoice>(init.choice);
  const [custom, setCustom] = useState(init.custom);
  const [visitedMonth, setVisitedMonth] = useState(
    existing?.status === 'visited' ? (existing.period ?? '') : '',
  );
  const [memo, setMemo] = useState(existing?.memo ?? '');

  const save = (status: 'visited' | 'wish') => {
    onSave({
      kind: target.kind,
      code: target.code,
      status,
      period: status === 'wish' ? wishPeriod(choice, custom, year) : visitedPeriod(visitedMonth),
      memo: memo.trim() || null,
    });
    onClose();
  };

  if (mode === 'pick') {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted">{copy.footprints.notVisited}</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={btn.primary} onClick={() => setMode('visited')}>
            {copy.footprints.visited}
          </button>
          <button
            type="button"
            className={`${btn.ghost} !border-amber-500 !text-amber-700`}
            onClick={() => setMode('wish')}
          >
            {copy.footprints.wish}
          </button>
        </div>
        <button type="button" className={btn.ghost} onClick={onClose}>
          {copy.members.close}
        </button>
      </div>
    );
  }

  const customBad = mode === 'wish' && choice === 'custom' && wishPeriod(choice, custom, year) === null;

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!customBad) save(mode);
      }}
    >
      {existing && (
        <p className="text-sm font-semibold">
          {existing.status === 'visited' ? copy.footprints.statusVisited : copy.footprints.statusWish}
          {existing.period && ` · ${periodLabel(existing.period)}`}
        </p>
      )}
      <div
        role="radiogroup"
        aria-label={copy.footprints.status}
        className="grid grid-cols-2 gap-1 rounded-full bg-bg p-1"
      >
        {(['visited', 'wish'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-11 rounded-full text-sm font-semibold ${mode === m ? 'bg-surface shadow-card' : 'text-muted'}`}
          >
            {m === 'visited' ? copy.footprints.visited : copy.footprints.wish}
          </button>
        ))}
      </div>

      {mode === 'visited' ? (
        <Field label={copy.footprints.whenVisited} hint={copy.footprints.optional}>
          <input
            type="month"
            className={inputCls}
            value={visitedMonth}
            onChange={(e) => setVisitedMonth(e.target.value)}
          />
        </Field>
      ) : (
        <>
          <Field label={copy.footprints.when}>
            <select
              className={inputCls}
              value={choice}
              onChange={(e) => setChoice(e.target.value as WishChoice)}
            >
              <option value="undecided">{copy.footprints.undecided}</option>
              <option value="thisYear">{copy.footprints.thisYear}</option>
              <option value="nextYear">{copy.footprints.nextYear}</option>
              <option value="custom">{copy.footprints.custom}</option>
            </select>
          </Field>
          {choice === 'custom' && (
            <Field
              label={copy.footprints.customMonth}
              hint={customBad ? copy.footprints.customBad : undefined}
            >
              <input
                type="month"
                className={inputCls}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </Field>
          )}
        </>
      )}
      <Field label={copy.footprints.memo}>
        <input
          className={inputCls}
          value={memo}
          maxLength={100}
          placeholder={copy.footprints.memoPlaceholder}
          onChange={(e) => setMemo(e.target.value)}
        />
      </Field>

      <button type="submit" className={btn.primary} disabled={customBad}>
        {existing ? copy.common.save : copy.footprints.add}
      </button>
      {mode === 'wish' && target.kind === 'country' && existing?.status === 'wish' && (
        <Link to={`/new?country=${target.code}`} className={btn.dark} onClick={onClose}>
          {copy.footprints.makeTrip}
        </Link>
      )}
      {existing && (
        <button
          type="button"
          className={`${btn.ghost} text-danger`}
          onClick={() => {
            onRemove();
            onClose();
          }}
        >
          {copy.footprints.clear}
        </button>
      )}
    </form>
  );
}
