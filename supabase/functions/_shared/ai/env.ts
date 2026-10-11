import { createFakeClient } from './fake.ts';
import { createGeminiClient } from './gemini.ts';
import { resolveGeminiModel } from './models.ts';
import { createOpenRouterClient } from './openrouter.ts';
import type { AiClient, Provider } from './types.ts';

// Model names change. The defaults below are only used when DEFAULT_*_MODEL is not set; verify the current
// names in the provider docs (docs/HUMAN_TODO.md) and set the env vars instead of editing code.
const FALLBACK_MODELS: Record<Provider, string> = {
  gemini: 'gemini-2.5-flash',
  openrouter: 'google/gemini-2.5-flash',
};

export interface AiEnv {
  clients: Partial<Record<Provider, AiClient>>;
  models: Record<Provider, string>;
  /** Which keys exist (booleans only, never the values). */
  keys: { gemini: boolean; openrouter: boolean; fake: boolean };
}

/** Builds provider clients from Edge Function secrets. `AI_FAKE=1` swaps in the deterministic fake for local runs. */
export async function aiEnv(): Promise<AiEnv> {
  const gemini = Deno.env.get('GEMINI_API_KEY');
  const openrouter = Deno.env.get('OPENROUTER_API_KEY');
  const fake = Deno.env.get('AI_FAKE') === '1';
  const clients: Partial<Record<Provider, AiClient>> = {};
  if (fake) {
    clients.gemini = createFakeClient();
    clients.openrouter = createFakeClient();
  } else {
    if (gemini) clients.gemini = createGeminiClient(gemini);
    if (openrouter)
      clients.openrouter = createOpenRouterClient(openrouter, Deno.env.get('APP_BASE_URL')?.split(',')[0]);
  }
  return {
    clients,
    models: {
      gemini:
        gemini && !fake
          ? await resolveGeminiModel(
              gemini,
              Deno.env.get('DEFAULT_GEMINI_MODEL') || undefined,
              FALLBACK_MODELS.gemini,
            )
          : Deno.env.get('DEFAULT_GEMINI_MODEL') || FALLBACK_MODELS.gemini,
      openrouter: Deno.env.get('DEFAULT_OPENROUTER_MODEL') || FALLBACK_MODELS.openrouter,
    },
    keys: { gemini: !!gemini, openrouter: !!openrouter, fake },
  };
}
