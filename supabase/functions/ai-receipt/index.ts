import { aiEnv } from '../_shared/ai/env.ts';
import { runAi } from '../_shared/ai/index.ts';
import { AiError, type Provider } from '../_shared/ai/types.ts';
import { bumpUsage, limitFromEnv, requireUser, userClient } from '../_shared/auth.ts';
import { bytesToBase64, isReceiptPath } from '../_shared/base64.ts';
import { corsHeaders, fail, HttpError, json, ok } from '../_shared/http.ts';
import { RECEIPT_JSON_SCHEMA, RECEIPT_SYSTEM } from '../_shared/prompts.ts';
import { ReceiptResult } from '../_shared/schemas.ts';

// Reads a receipt photo from Storage (as the user, so RLS applies) and returns structured fields.
// The app only pre-fills a form with the result; nothing is saved here.
Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'), Deno.env.get('APP_BASE_URL'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const client = userClient(req);
    const userId = await requireUser(client);
    const body = (await req.json().catch(() => null)) as { tripId?: unknown; imagePath?: unknown } | null;
    const tripId = typeof body?.tripId === 'string' ? body.tripId : '';
    if (!/^[0-9a-f-]{36}$/i.test(tripId) || !isReceiptPath(tripId, body?.imagePath)) {
      throw new HttpError(400, 'BAD_REQUEST', 'tripId and a receipt imagePath are required');
    }
    const imagePath = body!.imagePath as string;

    const { data: trip } = await client.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (!trip) throw new HttpError(403, 'FORBIDDEN', 'Not a member of this trip');

    const env = await aiEnv();
    if (!env.keys.gemini && !env.keys.openrouter && !env.keys.fake)
      throw new HttpError(503, 'AI_NO_KEY', 'AI 키가 설정되지 않았어요');

    const { data: blob, error: dlErr } = await client.storage.from('receipts').download(imagePath);
    if (dlErr || !blob) throw new HttpError(404, 'NOT_FOUND', 'Receipt image not found');
    if (blob.size > 5 * 1024 * 1024) throw new HttpError(413, 'TOO_LARGE', 'Image is too large');
    const base64 = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));

    await bumpUsage(userId, 'receipt', limitFromEnv('DAILY_LIMIT_RECEIPT', 30));

    const result = await runAi({
      clients: env.clients,
      models: { ...env.models, ...(trip.ai_model ? { [trip.ai_provider as Provider]: trip.ai_model } : {}) },
      provider: trip.ai_provider as Provider,
      fallback: trip.ai_fallback,
      req: {
        system: RECEIPT_SYSTEM,
        user: '영수증 이미지를 분석해라.',
        images: [{ mimeType: 'image/jpeg', base64 }],
        jsonSchema: RECEIPT_JSON_SCHEMA,
        temperature: 0.1,
      },
      schema: ReceiptResult,
    });
    return ok({ receipt: result.data, provider: result.provider, model: result.model }, cors);
  } catch (e) {
    if (e instanceof AiError) {
      console.error(`ai-receipt ${e.code}: ${e.message}`);
      return json(
        e.code === 'AI_NO_KEY' ? 503 : 502,
        {
          error: {
            code: e.code,
            message: '영수증을 읽지 못했어요. 영수증 인식이 가능한 모델을 선택해 주세요',
          },
        },
        cors,
      );
    }
    return fail(e, cors);
  }
});
