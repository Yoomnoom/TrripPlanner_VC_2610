import { z } from 'zod';
import { aiEnv } from '../_shared/ai/env.ts';
import { runAi } from '../_shared/ai/index.ts';
import { AiError, type Provider } from '../_shared/ai/types.ts';
import { bumpUsage, limitFromEnv, requireUser, userClient } from '../_shared/auth.ts';
import { corsHeaders, fail, HttpError, json, ok } from '../_shared/http.ts';
import { PING_JSON_SCHEMA } from '../_shared/prompts.ts';

// Which AI keys exist (booleans only) and, with { test: provider }, one tiny real call to prove the connection.
Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'), Deno.env.get('APP_BASE_URL'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const userId = await requireUser(userClient(req));
    const env = await aiEnv();
    const body = (await req.json().catch(() => ({}))) as { test?: unknown };
    const status = { ...env.keys, models: env.models };
    if (body.test !== 'gemini' && body.test !== 'openrouter') return ok(status, cors);

    const provider = body.test as Provider;
    if (!env.clients[provider]) return ok({ ...status, test: { ok: false, code: 'AI_NO_KEY' } }, cors);
    await bumpUsage(userId, 'ai', limitFromEnv('DAILY_LIMIT_AI', 60));
    try {
      const r = await runAi({
        clients: env.clients,
        models: env.models,
        provider,
        fallback: false,
        req: {
          system: 'JSON 객체 {"ok": true}만 출력한다.',
          user: 'ping',
          jsonSchema: PING_JSON_SCHEMA,
          temperature: 0,
        },
        schema: z.object({ ok: z.boolean() }),
      });
      return ok({ ...status, test: { ok: r.data.ok, provider: r.provider, model: r.model } }, cors);
    } catch (e) {
      const code = e instanceof AiError ? e.code : 'AI_FAILED';
      // the message may echo provider errors but never keys; keep it short for the UI
      return ok(
        { ...status, test: { ok: false, code, message: e instanceof Error ? e.message.slice(0, 160) : '' } },
        cors,
      );
    }
  } catch (e) {
    if (e instanceof HttpError) return fail(e, cors);
    return json(500, { error: { code: 'INTERNAL', message: 'Unexpected error' } }, cors);
  }
});
