// S8B-01 CP2 — the live provider adapters of the benchmark (operator-only; never imported by production code).
//
// Gemini TTS through the documented Interactions API (stream: true, store: false), and the DeepSeek Chat Completions
// stream. Every request is preceded by a guard reservation of its worst-case cost (spend-guard.cjs) and settled with its
// measured cost; nothing retries. Keys come from the environment the launcher builds and are never logged. The pure
// functions (pricing, rendering, WAV, playback stalls) are exported for the root contract.
import { measureStream } from './stream-first-token.mjs';

// ── pricing ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Worst-case audio seconds for a text: (characters / 4 + 10) s. The stream is cancelled at this bound. */
export const worstAudioSeconds = (text) => [...text].length / 4 + 10;

/** Gemini TTS worst case: every request byte as a text token, plus the worst-case audio as audio tokens. */
export function geminiWorstUsd(model, requestBody, text, tokensPerSecond = 25) {
  return (Buffer.byteLength(requestBody) * model.inputUsdPerMillionTextTokens
    + Math.ceil(worstAudioSeconds(text) * tokensPerSecond) * model.outputUsdPerMillionAudioTokens) / 1e6;
}

/**
 * Gemini TTS measured cost. From the reported usage when present (input tokens as text; output tokens as audio);
 * otherwise from the audio actually received (25 tokens / s) plus the request bytes as input: the larger is never
 * understated, because the fallback prices every byte as a token.
 */
export function geminiActualUsd(model, usage, audioSeconds, requestBytes, tokensPerSecond = 25) {
  const fromAudio = Math.ceil(audioSeconds * tokensPerSecond);
  if (usage && Number.isFinite(usage.total_output_tokens)) {
    const input = Number(usage.total_input_tokens ?? 0);
    const output = Number(usage.total_output_tokens);
    return { usd: (input * model.inputUsdPerMillionTextTokens + output * model.outputUsdPerMillionAudioTokens) / 1e6, source: 'usage', inputTokens: input, outputTokens: output };
  }
  return { usd: (requestBytes * model.inputUsdPerMillionTextTokens + fromAudio * model.outputUsdPerMillionAudioTokens) / 1e6, source: 'audio-duration', inputTokens: requestBytes, outputTokens: fromAudio };
}

/** DeepSeek's peak window: Monday – Friday, 01:00 – 04:00 and 06:00 – 10:00 UTC. */
export function deepseekPeak(date) {
  const day = date.getUTCDay();
  const h = date.getUTCHours();
  return day >= 1 && day <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10));
}
export function deepseekWorstUsd(peak, requestBody, maxTokens) {
  return (Buffer.byteLength(requestBody) * peak.cacheMiss + maxTokens * peak.output) / 1e6;
}
export function deepseekActualUsd(peak, usage, isPeak) {
  const r = isPeak ? peak : { cacheHit: peak.cacheHit / 2, cacheMiss: peak.cacheMiss / 2, output: peak.output / 2 };
  const hit = Number(usage?.prompt_cache_hit_tokens ?? 0);
  const miss = Number(usage?.prompt_cache_miss_tokens ?? Math.max(0, Number(usage?.prompt_tokens ?? 0) - hit));
  const out = Number(usage?.completion_tokens ?? 0);
  return (hit * r.cacheHit + miss * r.cacheMiss + out * r.output) / 1e6;
}

// ── rendering (the RENDERED arm) ─────────────────────────────────────────────────────────────────────────────────────
const NUMBER_SPAN = /[0-9٠-٩]+(?:[:/.,][0-9٠-٩]+)*%?/u;
const plain = (w) => w.replace(/[ً-ْٰ.,!?؟،؛:]/gu, '');
/**
 * Applies the corpus's expected reading to the target only. A homograph or name: the first occurrence of the target is
 * replaced by its selectively diacritized form. A number: the number span — with the word after it when that word's stem
 * appears in the expected reading — is replaced by the spelled reading. Anything else is unchanged.
 */
export function renderItem(item) {
  if (item.target && item.expected) return item.text.replace(item.target, item.expected);
  if (/^D\d+$/u.test(item.id) && item.expected) {
    const m = item.text.match(NUMBER_SPAN);
    if (!m) return item.text;
    let end = m.index + m[0].length;
    const after = item.text.slice(end).match(/^\s+(\S+)/u);
    if (after && plain(item.expected).includes(plain(after[1]).replace(/ات$/u, ''))) {
      const word = after[1].replace(/[.,!?؟،؛:]+$/u, '');
      end += after[0].length - (after[1].length - word.length);
    }
    return item.text.slice(0, m.index) + item.expected + item.text.slice(end);
  }
  return item.text;
}

// ── audio ────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A RIFF / WAVE header for mono 16-bit PCM. */
export function wavFile(pcm, sampleRate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/**
 * Playback stalls if playout starts `bufferMs` after the first audio chunk and plays in real time: `arrivals` are
 * [arrivalMs, audioMs] per chunk. Returns the total stalled time and the number of stalls.
 */
export function playbackStalls(arrivals, bufferMs) {
  if (!arrivals.length) return { stallMs: 0, stalls: 0 };
  let clock = arrivals[0][0] + bufferMs; // when the next audio sample is due to play
  let stallMs = 0;
  let stalls = 0;
  for (const [arrival, audioMs] of arrivals) {
    if (arrival > clock) { stallMs += arrival - clock; stalls += 1; clock = arrival; }
    clock += audioMs;
  }
  return { stallMs: Math.round(stallMs), stalls };
}

// ── adapters ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function guardOrThrow() {
  const g = globalThis.__QANDEEL_S8B_01_GUARD__;
  if (!g || g.mode !== 'live') throw new Error('S8B_01_CP2: the live adapters run only under the live guard');
  return g;
}

/** The documented Gemini 3.8 Interactions request: the text is the verbatim transcript; a style rides only in speech_metadata. */
export function geminiRequestBody(modelId, voice, text, style) {
  const part = { type: 'text', text };
  if (style) part.annotations = [{ type: 'speech_metadata', style }];
  return JSON.stringify({
    model: modelId,
    input: [{ type: 'user_input', content: [part] }],
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice }] },
    stream: true,
    store: false,
  });
}

/** One streamed Gemini TTS synthesis. Returns timings, the PCM, the usage and the cost; never retries. */
export async function geminiSynthesize({ model, voice, text, style, endpoint, tokensPerSecond }) {
  const guard = guardOrThrow();
  const body = geminiRequestBody(model.id, voice, text, style);
  const reservation = guard.reserve('tts', geminiWorstUsd(model, body, text, tokensPerSecond));
  const boundBytes = Math.ceil(worstAudioSeconds(text) * 24000 * 2);
  const controller = new AbortController();
  const startedAt = performance.now();
  const out = { status: null, headersMs: null, firstAudioMs: null, endMs: null, audioBytes: 0, chunks: 0, sampleRate: 24000,
    arrivals: [], usage: null, error: null, cancelledAtBound: false, maxGapMs: 0, eventTypes: [] };
  const pcm = [];
  try {
    const response = await fetch(endpoint, { method: 'POST', signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY, accept: 'text/event-stream' }, body });
    out.status = response.status;
    out.headersMs = Math.round(performance.now() - startedAt);
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      out.error = `HTTP ${response.status}: ${detail.slice(0, 300)}`;
    } else {
      const decoder = new TextDecoder();
      let buffer = '';
      let last = null;
      for await (const part of response.body) {
        buffer += decoder.decode(part, { stream: true });
        let nl;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          const event = JSON.parse(data);
          const kind = `${event.event_type ?? '?'}${event.delta?.type ? `:${event.delta.type}` : ''}`;
          if (!out.eventTypes.includes(kind)) out.eventTypes.push(kind);
          if (event.event_type === 'error') { out.error = `stream error: ${JSON.stringify(event.error ?? {}).slice(0, 300)}`; continue; }
          const usage = event.interaction?.usage ?? event.usage ?? event.metadata?.total_usage;
          if (usage) out.usage = usage;
          if (event.event_type === 'step.delta' && event.delta?.type === 'audio' && event.delta.data) {
            const bytes = Buffer.from(event.delta.data, 'base64');
            if (event.delta.sample_rate) out.sampleRate = Number(event.delta.sample_rate);
            const now = performance.now() - startedAt;
            if (out.firstAudioMs === null) out.firstAudioMs = Math.round(now);
            if (last !== null) out.maxGapMs = Math.max(out.maxGapMs, Math.round(now - last));
            last = now;
            out.arrivals.push([Math.round(now), (bytes.length / 2 / out.sampleRate) * 1000]);
            pcm.push(bytes);
            out.audioBytes += bytes.length;
            out.chunks += 1;
            if (out.audioBytes > boundBytes) { out.cancelledAtBound = true; controller.abort(); break; }
          }
        }
        if (out.cancelledAtBound) break;
      }
    }
  } catch (e) {
    if (!out.cancelledAtBound) out.error = `${e.code ?? e.name}: ${String(e.message).slice(0, 200)}`;
  }
  out.endMs = Math.round(performance.now() - startedAt);
  const audioSeconds = out.audioBytes / 2 / out.sampleRate;
  const cost = out.audioBytes === 0 && out.status !== null && out.status >= 400
    ? { usd: 0, source: 'refused-before-generation', inputTokens: 0, outputTokens: 0 }
    : geminiActualUsd(model, out.usage, audioSeconds, Buffer.byteLength(body), tokensPerSecond);
  // A transport failure after audio started is charged from the audio received plus the bound's remainder: not knowable,
  // so the worst case stays charged.
  const charged = out.error && out.audioBytes > 0 && !out.usage ? null : cost.usd;
  guard.settle(reservation, charged ?? geminiWorstUsd(model, body, text, tokensPerSecond));
  return { ...out, audioSeconds, cost: { ...cost, chargedUsd: charged ?? geminiWorstUsd(model, body, text, tokensPerSecond) }, pcm: Buffer.concat(pcm) };
}

/** One DeepSeek Chat Completions stream (FAST, no thinking), measured by measureStream (T and the VA-2 G). */
export async function deepseekStream({ endpoint, model, guidance, userText, maxTokens, peak }) {
  const guard = guardOrThrow();
  const body = JSON.stringify({ model, messages: [{ role: 'system', content: guidance }, { role: 'user', content: userText }],
    thinking: { type: 'disabled' }, max_tokens: maxTokens, stream: true, stream_options: { include_usage: true } });
  const reservation = guard.reserve('deepseekStream', deepseekWorstUsd(peak, body, maxTokens));
  const isPeak = deepseekPeak(new Date());
  const startedAt = performance.now();
  let m = null;
  let error = null;
  let status = null;
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` }, body });
    status = response.status;
    if (!response.ok) error = `HTTP ${response.status}: ${(await response.text().catch(() => '')).slice(0, 300)}`;
    else m = await measureStream(response, startedAt, { serverGuidance: guidance });
  } catch (e) {
    error = `${e.code ?? e.name}: ${String(e.message).slice(0, 200)}`;
  }
  const worst = deepseekWorstUsd(peak, body, maxTokens);
  const usd = m?.usage ? deepseekActualUsd(peak, m.usage, isPeak) : (status !== null && status >= 400 ? 0 : worst);
  guard.settle(reservation, usd);
  return { status, error, isPeak, usd, ...(m ?? {}) };
}

/** A free metadata read (no tokens): the model's availability for the key's project. */
export async function geminiModelInfo(modelId) {
  const guard = guardOrThrow();
  const reservation = guard.reserve('tts', 0);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}`, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } });
    const json = await r.json().catch(() => ({}));
    return { status: r.status, name: json.name, displayName: json.displayName, inputTokenLimit: json.inputTokenLimit, outputTokenLimit: json.outputTokenLimit,
      supportedGenerationMethods: json.supportedGenerationMethods, error: r.ok ? null : JSON.stringify(json.error ?? {}).slice(0, 300) };
  } finally {
    guard.settle(reservation, 0);
  }
}
