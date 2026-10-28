// S8B-01 — time-to-first-token and time-to-first-releasable-chunk over a Chat Completions SSE stream (stages T and G of
// the budget model). Provider-neutral: it reads the OpenAI-compatible `data:` event stream DeepSeek's Chat Completions
// emits with `stream: true`. CP1 proves it against a local simulated stream only; CP2's paid probe uses the same function.
// It keeps no text: it counts characters and records instants.

/** A sentence / clause boundary that VA-2's incremental release guard may release at. */
export const CHUNK_BOUNDARY = /[.!?؟،؛:\n]/u;

/**
 * Consumes a fetch Response whose body is an SSE stream. Returns instants relative to `startedAt` (performance.now()).
 * `firstTokenMs`: the first non-empty `delta.content`; `firstChunkMs`: the first boundary after at least `minChunkChars`
 * characters (the guard's first releasable chunk); `usage`: the final usage object if the stream carried one.
 */
export async function measureStream(response, startedAt, { minChunkChars = 12 } = {}) {
  const result = { headersMs: Math.round(performance.now() - startedAt), firstTokenMs: null, firstChunkMs: null, endMs: null,
    characters: 0, events: 0, usage: null, finishReason: null };
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const part of response.body) {
    buffer += decoder.decode(part, { stream: true });
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') { result.endMs = Math.round(performance.now() - startedAt); continue; }
      const event = JSON.parse(data);
      result.events += 1;
      if (event.usage) result.usage = event.usage;
      const choice = event.choices?.[0];
      if (choice?.finish_reason) result.finishReason = choice.finish_reason;
      const delta = choice?.delta?.content ?? '';
      if (!delta) continue;
      const now = Math.round(performance.now() - startedAt);
      if (result.firstTokenMs === null) result.firstTokenMs = now;
      result.characters += [...delta].length;
      if (result.firstChunkMs === null && result.characters >= minChunkChars && CHUNK_BOUNDARY.test(delta)) result.firstChunkMs = now;
    }
  }
  if (result.endMs === null) result.endMs = Math.round(performance.now() - startedAt);
  return result;
}
