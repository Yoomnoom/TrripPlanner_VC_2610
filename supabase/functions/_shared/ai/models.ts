import type { FetchLike } from './types.ts';

// Model names churn, so when DEFAULT_GEMINI_MODEL is not set we ask the API which models exist now
// (ListModels, names only) and pick the newest plain "flash" one. UNVERIFIED shapes: docs/HUMAN_TODO.md.

export interface ModelInfo {
  name: string;
  methods: string[];
}

export function parseGeminiModels(json: unknown): ModelInfo[] {
  const list = (json as { models?: { name?: unknown; supportedGenerationMethods?: unknown }[] } | null)
    ?.models;
  if (!Array.isArray(list)) return [];
  return list
    .filter((m) => typeof m.name === 'string')
    .map((m) => ({
      name: String(m.name).replace(/^models\//, ''),
      methods: Array.isArray(m.supportedGenerationMethods) ? (m.supportedGenerationMethods as string[]) : [],
    }));
}

const version = (name: string) => {
  const m = name.match(/^gemini-(\d+(?:\.\d+)?)-flash$/);
  return m ? Number(m[1]) : null;
};

/** Newest stable `gemini-X-flash` that supports generateContent; null when none is listed. */
export function pickGeminiFlash(models: readonly ModelInfo[]): string | null {
  const ok = models
    .filter((m) => m.methods.includes('generateContent'))
    .map((m) => ({ name: m.name, v: version(m.name) }))
    .filter((m): m is { name: string; v: number } => m.v !== null)
    .sort((a, b) => b.v - a.v);
  return ok[0]?.name ?? null;
}

let cached: { name: string | null; at: number } | null = null;

/** Resolves the Gemini model to use (env override first, then ListModels, cached for an hour). */
export async function resolveGeminiModel(
  apiKey: string,
  envModel: string | undefined,
  fallback: string,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  if (envModel) return envModel;
  if (cached && Date.now() - cached.at < 3_600_000) return cached.name ?? fallback;
  let name: string | null = null;
  try {
    const res = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
      headers: { 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) name = pickGeminiFlash(parseGeminiModels(await res.json()));
  } catch {
    // keep the fallback below
  }
  cached = { name, at: Date.now() };
  return name ?? fallback;
}
