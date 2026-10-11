export type Provider = 'gemini' | 'openrouter';

export interface AiRequest {
  system: string;
  user: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  images?: { mimeType: string; base64: string }[];
  /** JSON Schema passed to the provider's structured-output feature. */
  jsonSchema: Record<string, unknown>;
  /** Default 0.7; receipts use 0.1. */
  temperature?: number;
}

/** One provider. Returns the raw JSON text the model produced. */
export interface AiClient {
  call(req: AiRequest, model: string, signal?: AbortSignal): Promise<string>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class AiHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** `AI_NO_KEY`: no provider configured. `AI_FAILED`: every attempt failed. `MODEL_NO_VISION`: images unsupported. */
export class AiError extends Error {
  constructor(
    public code: 'AI_NO_KEY' | 'AI_FAILED' | 'MODEL_NO_VISION',
    message: string,
  ) {
    super(message);
  }
}
