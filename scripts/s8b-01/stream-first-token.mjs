// S8B-01 — time-to-first-token and time-to-first-releasable-chunk over a Chat Completions SSE stream (stages T and G of
// the budget model). Provider-neutral: it reads the OpenAI-compatible `data:` event stream DeepSeek's Chat Completions
// emits with `stream: true`. CP1 proves it against a local simulated stream only; CP2's paid probe uses the same function.
// It keeps no text: it counts characters and records instants.
//
// Two instants are kept apart (CP1 review R1-1). `firstBoundaryApproxMs` is the first punctuation mark after the minimum
// length: a diagnostic only, never stage G. `firstReleasableChunkMs` is the first instant at which a chunk satisfies the
// VA-2 release conditions, evaluated by `va2ReleasableLength` below; only that instant feeds G. The predicate mirrors the
// S8A-01 guard's checks (`apps/api/src/model-router/model-output-release-guard.ts`), and the root contract pins the mirror
// against that file. The implemented VA-2 guard does not exist until S8B-05, which re-measures G through it.

/** A sentence / clause boundary that VA-2's incremental release guard may release at. */
export const CHUNK_BOUNDARY = /[.!?؟،؛:\n]/u;

// Mirrored from model-output-release-guard.ts (pinned by the S8B-01 root contract).
export const INTERNAL_CONTAINERS = ['user_memory_context', 'him_reasoning_context', 'him_brain_context',
  'hypothesis_reasoning_context', 'recommendation_grounding_context', 'question_context', 'shared_attribution_notes', 'think'];
const INTERNAL_CONTAINER_TAG = new RegExp(`<\\s*/?\\s*(?:${INTERNAL_CONTAINERS.join('|')})\\s*>`, 'iu');
const UNREADABLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F�]/u;
export const GUIDANCE_ECHO_MIN_LENGTH = 48;
const collapse = (text) => text.replace(/\s+/gu, ' ');

/** The server-authored sentences of a guidance text, split as the S8A-01 guard splits them. */
export function guidanceSentences(serverGuidance) {
  const prose = serverGuidance
    .replace(/<shared_attribution_notes>([\s\S]*?)<\/shared_attribution_notes>/gu, (_c, body) =>
      `\n${body.split('\n').filter((line) => !line.startsWith('- [')).join('\n')}\n`)
    .replace(/<([a-z_]+)>[\s\S]*?<\/\1>/gu, '\n');
  return prose.split(/\n+|(?<=[.!?:])\s+/u).map((s) => collapse(s).trim()).filter((s) => s.length >= GUIDANCE_ECHO_MIN_LENGTH);
}

/**
 * The VA-2 holdback over collapsed text: `end` is where the releasable text stops, `heldBy` names what holds the rest
 * (an unclosed `<`, or the GUIDANCE_ECHO suffix holdback), or is null when nothing is held.
 */
function va2Holdback(text, sentences) {
  let end = text.length;
  let heldBy = null;
  const open = text.lastIndexOf('<');
  if (open > text.lastIndexOf('>')) { end = open; heldBy = 'UNCLOSED_TAG'; }
  for (let k = Math.min(text.length, Math.max(0, ...sentences.map((s) => s.length))); k > 0; k -= 1) {
    const suffix = text.slice(-k);
    if (sentences.some((s) => s.includes(suffix))) {
      if (text.length - k < end) { end = text.length - k; heldBy = 'GUIDANCE_ECHO_HOLDBACK'; }
      break;
    }
  }
  return { end, heldBy };
}

/**
 * VA-2 over the accumulated text of a stream that has not failed. Returns `{ withheld }` when the accumulated text fails a
 * check (the stream is cancelled and nothing more is released), otherwise `{ length }`: the releasable prefix length in
 * the collapsed text, 0 when nothing is releasable yet. A prefix is releasable only when it ends on a boundary, is at
 * least `minChunkChars` long, lies before any unclosed `<`, and lies before the GUIDANCE_ECHO holdback (the longest suffix
 * of the accumulated text that occurs inside a server-authored sentence).
 */
export function va2ReleasableLength(accumulated, sentences, { minChunkChars = 12 } = {}) {
  if (UNREADABLE.test(accumulated)) return { withheld: 'UNREADABLE' };
  if (INTERNAL_CONTAINER_TAG.test(accumulated)) return { withheld: 'INTERNAL_CONTAINER' };
  const text = collapse(accumulated);
  if (sentences.some((s) => text.includes(s))) return { withheld: 'GUIDANCE_ECHO' };
  const { end } = va2Holdback(text, sentences);
  for (let i = end - 1; i >= minChunkChars - 1; i -= 1) if (CHUNK_BOUNDARY.test(text[i])) return { length: i + 1 };
  return { length: 0 };
}

/**
 * Consumes a fetch Response whose body is an SSE stream. Returns instants relative to `startedAt` (performance.now()):
 * - `firstTokenMs`: the first non-empty `delta.content`;
 * - `firstBoundaryApproxMs`: the first delta carrying a boundary after `minChunkChars` characters (diagnostic only);
 * - `firstReleasableChunkMs`: the first instant VA-2 releases a chunk; at the end of the stream, a text that never reached
 *   a releasable boundary is released whole only if it passes the checks and nothing of it is still held (`releasedAtEnd`);
 *   null when nothing is ever released;
 * - `heldAtEnd`: what still held the text when the stream ended without a release (`UNCLOSED_TAG` or
 *   `GUIDANCE_ECHO_HOLDBACK`); such a text is never counted as released;
 * - `withheldReason`: the VA-2 failure that cancelled the stream, if any (then nothing more counts as released);
 * - `usage`: the final usage object, if the stream carried one.
 */
export async function measureStream(response, startedAt, { minChunkChars = 12, serverGuidance = '' } = {}) {
  const result = { headersMs: Math.round(performance.now() - startedAt), firstTokenMs: null, firstBoundaryApproxMs: null,
    firstReleasableChunkMs: null, releasedAtEnd: false, heldAtEnd: null, withheldReason: null, endMs: null, characters: 0, events: 0,
    usage: null, finishReason: null };
  const sentences = guidanceSentences(serverGuidance);
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
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
      if (result.firstBoundaryApproxMs === null && result.characters >= minChunkChars && CHUNK_BOUNDARY.test(delta)) result.firstBoundaryApproxMs = now;
      if (result.firstReleasableChunkMs !== null || result.withheldReason !== null) continue;
      accumulated += delta;
      const release = va2ReleasableLength(accumulated, sentences, { minChunkChars });
      if (release.withheld) result.withheldReason = release.withheld;
      else if (release.length > 0) result.firstReleasableChunkMs = now;
    }
  }
  if (result.endMs === null) result.endMs = Math.round(performance.now() - startedAt);
  // End of turn: the whole text is released only if it passes the S8A-01 whole-candidate checks (EMPTY included) AND
  // nothing of it is still held by VA-2 (an unclosed `<`, the GUIDANCE_ECHO holdback); otherwise nothing is released.
  if (result.firstReleasableChunkMs === null && result.withheldReason === null) {
    const whole = accumulated.trim();
    const check = whole ? va2ReleasableLength(whole, sentences, { minChunkChars: Infinity }) : { withheld: 'EMPTY' };
    if (check.withheld) result.withheldReason = check.withheld;
    else {
      const { heldBy } = va2Holdback(collapse(whole), sentences);
      if (heldBy) result.heldAtEnd = heldBy;
      else { result.firstReleasableChunkMs = result.endMs; result.releasedAtEnd = true; }
    }
  }
  return result;
}
