import type { ZodType } from 'zod';
import { parseJsonText } from './parse.ts';
import { AiError, type AiClient, type AiRequest, type Provider } from './types.ts';

export interface RunAiOptions<T> {
  clients: Partial<Record<Provider, AiClient>>;
  models: Record<Provider, string>;
  provider: Provider;
  /** When true, a failed provider hands over to the other one (if it has a key). */
  fallback: boolean;
  req: AiRequest;
  schema: ZodType<T>;
}

export interface AiResult<T> {
  data: T;
  provider: Provider;
  model: string;
}

const other = (p: Provider): Provider => (p === 'gemini' ? 'openrouter' : 'gemini');

/**
 * Calls the chosen provider, validates with zod, retries once (feeding the error back), then falls back to
 * the other provider. AI output is never trusted: only schema-valid data leaves this function.
 */
export async function runAi<T>(opts: RunAiOptions<T>): Promise<AiResult<T>> {
  const order = ([opts.provider, ...(opts.fallback ? [other(opts.provider)] : [])] as Provider[]).filter(
    (p) => opts.clients[p],
  );
  if (order.length === 0) throw new AiError('AI_NO_KEY', 'No AI provider is configured');

  let lastError = 'unknown';
  for (const provider of order) {
    const client = opts.clients[provider]!;
    const model = opts.models[provider];
    let req = opts.req;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await client.call(req, model);
        const parsed = opts.schema.safeParse(parseJsonText(raw));
        if (parsed.success) return { data: parsed.data, provider, model };
        lastError = `schema: ${parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.')} ${i.message}`)
          .join('; ')}`;
        // second attempt tells the model what was wrong
        req = {
          ...opts.req,
          user: `${opts.req.user}\n\n[이전 출력 오류] ${lastError}\n스키마를 정확히 지켜 다시 출력해라.`,
        };
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        const status = (e as { status?: number }).status;
        // 4xx other than 429 will not improve by retrying the same provider
        if (typeof status === 'number' && status >= 400 && status < 500 && status !== 429) break;
      }
    }
  }
  throw new AiError('AI_FAILED', lastError);
}
