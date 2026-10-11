import { JSON_ONLY_SUFFIX } from './parse.ts';
import { AiHttpError, type AiClient, type AiRequest, type FetchLike } from './types.ts';

// Gemini generateContent (v1beta). UNVERIFIED field names are marked; verify with a real key
// (docs/HUMAN_TODO.md). If structured output is rejected (HTTP 400) we retry once without the schema.
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function buildGeminiBody(req: AiRequest, withSchema: boolean) {
  const imageParts = (req.images ?? []).map((i) => ({
    inlineData: { mimeType: i.mimeType, data: i.base64 },
  }));
  return {
    systemInstruction: { parts: [{ text: withSchema ? req.system : req.system + JSON_ONLY_SUFFIX }] },
    contents: [
      ...(req.history ?? []).map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: [{ text: req.user }, ...imageParts] },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      ...(withSchema ? { responseJsonSchema: req.jsonSchema } : {}),
      temperature: req.temperature ?? 0.7,
    },
  };
}

export function extractGeminiText(json: unknown): string {
  const j = json as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  if (j.promptFeedback?.blockReason) throw new AiHttpError(422, `blocked: ${j.promptFeedback.blockReason}`);
  const text = j.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? '')
    .join('')
    .trim();
  if (!text) throw new AiHttpError(502, 'Gemini returned no text');
  return text;
}

export function createGeminiClient(apiKey: string, fetchImpl: FetchLike = fetch): AiClient {
  const send = async (req: AiRequest, model: string, withSchema: boolean, signal?: AbortSignal) => {
    const res = await fetchImpl(`${BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(buildGeminiBody(req, withSchema)),
      signal: signal ?? AbortSignal.timeout(40_000),
    });
    if (!res.ok) throw new AiHttpError(res.status, `Gemini HTTP ${res.status}`);
    return extractGeminiText(await res.json());
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
