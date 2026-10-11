import { JSON_ONLY_SUFFIX } from './parse.ts';
import { AiHttpError, type AiClient, type AiRequest, type FetchLike } from './types.ts';

// OpenRouter chat completions. UNVERIFIED against a live key (docs/HUMAN_TODO.md). Models without
// structured-output support answer 400; we retry once with a "JSON only" instruction instead.
const URL_ = 'https://openrouter.ai/api/v1/chat/completions';

export function buildOpenRouterBody(req: AiRequest, model: string, structured: boolean) {
  const userContent =
    (req.images ?? []).length > 0
      ? [
          { type: 'text', text: req.user },
          ...(req.images ?? []).map((i) => ({
            type: 'image_url',
            image_url: { url: `data:${i.mimeType};base64,${i.base64}` },
          })),
        ]
      : req.user;
  return {
    model,
    temperature: req.temperature ?? 0.7,
    messages: [
      { role: 'system', content: structured ? req.system : req.system + JSON_ONLY_SUFFIX },
      ...(req.history ?? []).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: userContent },
    ],
    ...(structured
      ? {
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'response', strict: true, schema: req.jsonSchema },
          },
        }
      : {}),
  };
}

export function extractOpenRouterText(json: unknown): string {
  const content = (json as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message
    ?.content;
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((c: { text?: string }) => c.text ?? '').join('')
        : '';
  if (!text.trim()) throw new AiHttpError(502, 'OpenRouter returned no text');
  return text.trim();
}

export function createOpenRouterClient(
  apiKey: string,
  appUrl?: string,
  fetchImpl: FetchLike = fetch,
): AiClient {
  const send = async (req: AiRequest, model: string, structured: boolean, signal?: AbortSignal) => {
    const res = await fetchImpl(URL_, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Title': 'Trip Planner',
        ...(appUrl ? { 'HTTP-Referer': appUrl } : {}),
      },
      body: JSON.stringify(buildOpenRouterBody(req, model, structured)),
      signal: signal ?? AbortSignal.timeout(40_000),
    });
    if (!res.ok) throw new AiHttpError(res.status, `OpenRouter HTTP ${res.status}`);
    return extractOpenRouterText(await res.json());
  };
  return {
    async call(req, model, signal) {
      try {
        return await send(req, model, true, signal);
      } catch (e) {
        if (e instanceof AiHttpError && e.status === 400) return send(req, model, false, signal);
        throw e;
      }
    },
  };
}
