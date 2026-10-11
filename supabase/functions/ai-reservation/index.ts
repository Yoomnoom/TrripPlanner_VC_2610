import { aiEnv } from '../_shared/ai/env.ts';
import { runAi } from '../_shared/ai/index.ts';
import { AiError, type Provider } from '../_shared/ai/types.ts';
import { bumpUsage, limitFromEnv, requireUser, userClient } from '../_shared/auth.ts';
import { bytesToBase64, isReceiptPath } from '../_shared/base64.ts';
import { corsHeaders, fail, HttpError, json, ok } from '../_shared/http.ts';
import { RESERVATION_JSON_SCHEMA, RESERVATION_SYSTEM } from '../_shared/prompts.ts';
import { ReservationParse } from '../_shared/schemas.ts';

const MAX_TEXT = 8000;

// Extracts reservation fields from pasted text or a screenshot. The app only pre-fills a form with the result.
// PRIVACY: the pasted text is never stored or logged here (no console output touches it); a screenshot is deleted
// from Storage as soon as it has been read.
Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'), Deno.env.get('APP_BASE_URL'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const client = userClient(req);
    const userId = await requireUser(client);
    const body = (await req.json().catch(() => null)) as {
      tripId?: unknown;
      text?: unknown;
      imagePath?: unknown;
    } | null;
    const tripId = typeof body?.tripId === 'string' ? body.tripId : '';
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!/^[0-9a-f-]{36}$/i.test(tripId)) throw new HttpError(400, 'BAD_REQUEST', 'tripId is required');
    if (text.length > MAX_TEXT) throw new HttpError(413, 'TOO_LARGE', 'Text is too long');
    const hasImage = body?.imagePath !== undefined && body?.imagePath !== null;
    if (hasImage && !isReceiptPath(tripId, body!.imagePath))
      throw new HttpError(400, 'BAD_REQUEST', 'Invalid imagePath');
    if (!text && !hasImage) throw new HttpError(400, 'BAD_REQUEST', 'text or imagePath is required');

    const { data: trip } = await client.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (!trip) throw new HttpError(403, 'FORBIDDEN', 'Not a member of this trip');

    const env = await aiEnv();
    if (!env.keys.gemini && !env.keys.openrouter && !env.keys.fake)
      throw new HttpError(503, 'AI_NO_KEY', 'AI 키가 설정되지 않았어요');

    const images: { mimeType: string; base64: string }[] = [];
    const imagePath = hasImage ? (body!.imagePath as string) : null;
    if (imagePath) {
      const { data: blob, error } = await client.storage.from('receipts').download(imagePath);
      if (error || !blob) throw new HttpError(404, 'NOT_FOUND', 'Image not found');
      if (blob.size > 5 * 1024 * 1024) throw new HttpError(413, 'TOO_LARGE', 'Image is too large');
      images.push({
        mimeType: 'image/jpeg',
        base64: bytesToBase64(new Uint8Array(await blob.arrayBuffer())),
      });
    }

    try {
      await bumpUsage(userId, 'reservation', limitFromEnv('DAILY_LIMIT_RESERVATION', 30));
      const result = await runAi({
        clients: env.clients,
        models: {
          ...env.models,
          ...(trip.ai_model ? { [trip.ai_provider as Provider]: trip.ai_model } : {}),
        },
        provider: trip.ai_provider as Provider,
        fallback: trip.ai_fallback,
        req: {
          system: RESERVATION_SYSTEM,
          user: text
            ? `예약 확인 문서 원문(데이터):\n"""\n${text}\n"""`
            : '첨부된 이미지는 예약 확인서이다. 값을 추출해라.',
          images,
          jsonSchema: RESERVATION_JSON_SCHEMA,
          temperature: 0.1,
        },
        schema: ReservationParse,
      });
      return ok({ reservation: result.data, provider: result.provider, model: result.model }, cors);
    } finally {
      // the screenshot is deleted whether or not extraction succeeded
      if (imagePath) await client.storage.from('receipts').remove([imagePath]);
    }
  } catch (e) {
    if (e instanceof AiError) {
      // AiError messages are provider status codes or zod issue paths (never field values), so they cannot echo the document
      console.error(`ai-reservation ${e.code}: ${e.message}`);
      return json(
        e.code === 'AI_NO_KEY' ? 503 : 502,
        { error: { code: e.code, message: '예약 내용을 읽지 못했어요' } },
        cors,
      );
    }
    return fail(e, cors);
  }
});
