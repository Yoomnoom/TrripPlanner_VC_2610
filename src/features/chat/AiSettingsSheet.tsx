import { useState } from 'react';
import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';
import { btn, inputCls } from '@/components/styles';
import { Field } from '@/components/ui-kit';
import type { Trip } from '@/features/trips/api';
import { aiErrorMessage, testConnection, useSaveAiSettings, type AiStatus, type ConnectionTest } from './api';

type Provider = 'gemini' | 'openrouter';
const NAMES: Record<Provider, string> = { gemini: 'Gemini', openrouter: 'OpenRouter' };

/** Per-trip AI choice: provider, optional model override, automatic fallback, and a real connection test. */
export function AiSettingsSheet({
  open,
  onClose,
  trip,
  status,
}: {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  status: AiStatus | undefined;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={copy.chat.settings}>
      {open && <Body key={trip.id} trip={trip} status={status} onDone={onClose} />}
    </Sheet>
  );
}

function Body({ trip, status, onDone }: { trip: Trip; status: AiStatus | undefined; onDone: () => void }) {
  const save = useSaveAiSettings(trip.id);
  const [provider, setProvider] = useState<Provider>(trip.ai_provider as Provider);
  const [model, setModel] = useState(trip.ai_model ?? '');
  const [fallback, setFallback] = useState(trip.ai_fallback);
  const [results, setResults] = useState<Partial<Record<Provider, ConnectionTest | 'busy'>>>({});

  const has = (p: Provider) => !!status && (status.fake || status[p]);

  const test = async (p: Provider) => {
    setResults((r) => ({ ...r, [p]: 'busy' }));
    const out = await testConnection(p);
    setResults((r) => ({ ...r, [p]: out }));
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(
          { ai_provider: provider, ai_model: model.trim() || null, ai_fallback: fallback },
          { onSuccess: onDone },
        );
      }}
    >
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">{copy.chat.provider}</legend>
        {(['gemini', 'openrouter'] as const).map((p) => {
          const r = results[p];
          return (
            <div key={p} className="rounded-input border border-line p-3">
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="radio"
                  name="provider"
                  className="size-5 accent-[var(--color-primary)]"
                  checked={provider === p}
                  disabled={!has(p)}
                  onChange={() => setProvider(p)}
                />
                <span className="font-semibold">{NAMES[p]}</span>
                {!has(p) && <span className="text-xs text-muted">{copy.chat.noKeyShort}</span>}
              </label>
              {has(p) && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={btn.ghost}
                    disabled={r === 'busy'}
                    onClick={() => void test(p)}
                  >
                    {r === 'busy' ? copy.chat.testing : copy.chat.test}
                  </button>
                  {r && r !== 'busy' && (
                    <span
                      role="status"
                      className={`text-sm font-semibold ${r.ok ? 'text-positive' : 'text-danger'}`}
                    >
                      {r.ok
                        ? `✓ ${copy.chat.testOk(r.model ?? '')}`
                        : `✕ ${copy.chat.testFail(testReason(r))}`}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </fieldset>

      <Field label={copy.chat.model} hint={copy.chat.modelHint(status?.models[provider] ?? '')}>
        <input
          className={inputCls}
          value={model}
          placeholder={status?.models[provider] ?? ''}
          onChange={(e) => setModel(e.target.value)}
        />
      </Field>

      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          className="size-5 accent-[var(--color-primary)]"
          checked={fallback}
          onChange={(e) => setFallback(e.target.checked)}
        />
        <span>
          <span className="block font-semibold">{copy.chat.fallback}</span>
          <span className="block text-xs text-muted">{copy.chat.fallbackHint}</span>
        </span>
      </label>

      <button type="submit" className={btn.primary} disabled={save.isPending}>
        {copy.common.save}
      </button>
    </form>
  );
}

function testReason(r: ConnectionTest) {
  if (r.code === 'AI_NO_KEY') return aiErrorMessage('AI_NO_KEY');
  return r.message?.replace(/\s+/g, ' ') || r.code || '';
}
