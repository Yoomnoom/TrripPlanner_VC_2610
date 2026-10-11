import { useState } from 'react';
import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';
import { btn, inputCls } from '@/components/styles';
import { AVOIDS, COMPANIONS, PACES, THEMES, TRANSPORTS, labelOf, type PlanningPrefs } from '@/lib/prefs';

const STEPS = ['companions', 'pace', 'themes', 'transport', 'must', 'avoid'] as const;
type Step = (typeof STEPS)[number];

/** One-question-at-a-time chip wizard (6 steps, every step skippable) that ends with a planning request. */
export function WizardSheet({
  open,
  onClose,
  initial,
  candidates,
  onFinish,
}: {
  open: boolean;
  onClose: () => void;
  initial: PlanningPrefs;
  /** Names from the idea inbox and my saved places, offered for "꼭 가고 싶은 곳". */
  candidates: string[];
  onFinish: (prefs: PlanningPrefs) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={copy.wizard.title}>
      {open && <Body initial={initial} candidates={candidates} onFinish={onFinish} />}
    </Sheet>
  );
}

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${on ? 'border-primary bg-primary-soft text-primary' : 'border-line'}`}
    >
      {on && '✓ '}
      {label}
    </button>
  );
}

function Body({
  initial,
  candidates,
  onFinish,
}: {
  initial: PlanningPrefs;
  candidates: string[];
  onFinish: (p: PlanningPrefs) => void;
}) {
  const [i, setI] = useState(0);
  const [prefs, setPrefs] = useState<PlanningPrefs>(initial);
  const [manual, setManual] = useState('');
  const step: Step = STEPS[i];
  const last = i === STEPS.length - 1;

  const toggle = (key: 'themes' | 'avoid' | 'mustInclude', v: string) =>
    setPrefs((p) => {
      const cur = p[key] ?? [];
      return { ...p, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });
  const pick = <K extends 'companions' | 'pace' | 'transport'>(key: K, v: PlanningPrefs[K]) =>
    setPrefs((p) => ({ ...p, [key]: p[key] === v ? null : v }));

  const must = prefs.mustInclude ?? [];
  const allMust = [...new Set([...candidates, ...must])];

  return (
    <div className="grid gap-4">
      <p className="tabular text-xs font-semibold text-muted">
        {i + 1} / {STEPS.length}
      </p>
      <h3 className="text-lg font-bold">{copy.wizard.questions[step]}</h3>

      <div className="flex flex-wrap gap-2">
        {step === 'companions' &&
          COMPANIONS.map((c) => (
            <Chip
              key={c}
              on={prefs.companions === c}
              label={labelOf(c)}
              onClick={() => pick('companions', c)}
            />
          ))}
        {step === 'pace' &&
          PACES.map((c) => (
            <Chip key={c} on={prefs.pace === c} label={labelOf(c)} onClick={() => pick('pace', c)} />
          ))}
        {step === 'themes' &&
          THEMES.map((c) => (
            <Chip
              key={c}
              on={!!prefs.themes?.includes(c)}
              label={labelOf(c)}
              onClick={() => toggle('themes', c)}
            />
          ))}
        {step === 'transport' &&
          TRANSPORTS.map((c) => (
            <Chip
              key={c}
              on={prefs.transport === c}
              label={labelOf(c)}
              onClick={() => pick('transport', c)}
            />
          ))}
        {step === 'avoid' &&
          AVOIDS.map((c) => (
            <Chip
              key={c}
              on={!!prefs.avoid?.includes(c)}
              label={labelOf(c)}
              onClick={() => toggle('avoid', c)}
            />
          ))}
        {step === 'must' && (
          <>
            {allMust.length === 0 && <p className="text-sm text-muted">{copy.wizard.noCandidates}</p>}
            {allMust.map((n) => (
              <Chip key={n} on={must.includes(n)} label={n} onClick={() => toggle('mustInclude', n)} />
            ))}
          </>
        )}
      </div>

      {step === 'must' && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = manual.trim();
            if (t && !must.includes(t)) toggle('mustInclude', t);
            setManual('');
          }}
        >
          <input
            className={inputCls}
            value={manual}
            maxLength={80}
            placeholder={copy.wizard.manualPlaceholder}
            aria-label={copy.wizard.manualPlaceholder}
            onChange={(e) => setManual(e.target.value)}
          />
          <button type="submit" className={btn.ghost} disabled={!manual.trim()}>
            {copy.plan.add}
          </button>
        </form>
      )}

      <div className="flex gap-2">
        {i > 0 && (
          <button type="button" className={btn.ghost} onClick={() => setI(i - 1)}>
            {copy.common.back}
          </button>
        )}
        {!last && (
          <>
            <button type="button" className={`${btn.ghost} ml-auto`} onClick={() => setI(i + 1)}>
              {copy.wizard.skip}
            </button>
            <button type="button" className={btn.primary} onClick={() => setI(i + 1)}>
              {copy.wizard.next}
            </button>
          </>
        )}
        {last && (
          <button type="button" className={`${btn.primary} ml-auto`} onClick={() => onFinish(prefs)}>
            {copy.wizard.finish}
          </button>
        )}
      </div>
    </div>
  );
}
