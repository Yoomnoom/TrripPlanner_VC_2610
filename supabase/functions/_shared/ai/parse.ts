/** Models sometimes wrap JSON in ```json fences or add a sentence around it. Returns the parsed value. */
export function parseJsonText(raw: string): unknown {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) text = fence[1].trim();
  try {
    return JSON.parse(text);
  } catch {
    // fall back to the outermost {...} block
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new SyntaxError('Model output is not JSON');
  }
}

/** Appended to the system prompt when structured output is unavailable. */
export const JSON_ONLY_SUFFIX = '\n\n반드시 JSON 객체 하나만 출력하고, JSON 밖에는 어떤 글자도 쓰지 마라.';
