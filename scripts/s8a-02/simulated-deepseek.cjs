'use strict';
// S8A-02 / CP2 Round 10 readiness — a LOCAL DeepSeek stand-in for the zero-cost simulated run (operator-only; never a CI step;
// never imported by production code). Preloaded with `node --require` BEFORE scripts/s8a-02/network-guard.cjs, it replaces
// fetch with a stub that answers https://api.deepseek.com/chat/completions in the OpenAI Chat Completions format, so the
// guard wraps the stub and counts, caps and settles every attempt exactly as it would a live one. Nothing leaves the process:
// any other URL is refused here, and the guard refuses every lower transport as always.
//
// Replies: a fixed neutral Arabic sentence with the call number. Readings (recognised by the reading instruction in the
// system message): one valid claim, its span copied from the first message the server flagged. Usage: prompt tokens from the
// request bytes (about 5.4 bytes per token, as observed in rounds 5-9), output tokens from the reply length.
//
// QANDEEL_EVAL_SIMULATED_FAULTS  "KIND@n,..." injects a fault on the n-th call of this process: HANG (no answer until the
//                                 caller aborts), HTTP500, LENGTH (finish_reason "length"), MALFORMED (a body that is not
//                                 JSON), INVALID (well-formed, but the content is not a valid reading / not JSON).
// QANDEEL_EVAL_SIMULATED_LATENCY  milliseconds per call (default 120): wiring, not latency, is what this run checks.
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const READING_MARK = 'You read a group conversation for the server. You do not reply to anyone.';
const BYTES_PER_TOKEN = 5.4;
const latencyMs = /^\d+$/u.test(process.env.QANDEEL_EVAL_SIMULATED_LATENCY ?? '') ? Number(process.env.QANDEEL_EVAL_SIMULATED_LATENCY) : 120;
const faults = new Map((process.env.QANDEEL_EVAL_SIMULATED_FAULTS ?? '').split(',').filter(Boolean).map((entry) => {
  const match = /^(HANG|HTTP500|LENGTH|MALFORMED|INVALID)@(\d+)$/u.exec(entry.trim());
  if (!match) throw new Error(`SIMULATED_DEEPSEEK: bad fault "${entry}"`);
  return [Number(match[2]), match[1]];
}));
const counts = { calls: 0, readings: 0, replies: 0, faults: [] };

const wait = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(new DOMException('aborted', 'AbortError'));
  const timer = ms === Infinity ? null : setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { if (timer) clearTimeout(timer); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
});

function readingOf(input) {
  const target = input.messages.find((message) => message.m === input.read[0]) ?? input.messages.find((message) => message.from !== 'QANDEEL');
  if (!target) return { mentions: [], claims: [] };
  const words = target.text.trim().split(/\s+/u).slice(0, 3).join(' ');
  const span = target.text.includes(words) ? words : target.text.trim().split(/\s+/u)[0];
  return { mentions: [], claims: [{ m: target.m, span, origin: target.from, via: [], about: [], act: 'SAYS', polarity: 'AFFIRMED', certainty: 'STATED', links: [] }] };
}

async function simulatedFetch(input, init) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
  if (url !== DEEPSEEK_URL) throw Object.assign(new Error(`SIMULATED_DEEPSEEK_FORBIDDEN:${String(url).slice(0, 60)}`), { code: 'SIMULATED_DEEPSEEK_FORBIDDEN' });
  const n = ++counts.calls;
  const body = JSON.parse(init.body);
  const system = body.messages[0]?.content ?? '';
  const reading = system.includes(READING_MARK);
  if (reading) counts.readings += 1; else counts.replies += 1;
  const fault = faults.get(n) ?? null;
  if (fault) counts.faults.push({ n, fault, kind: reading ? 'READING' : 'REPLY' });
  if (fault === 'HANG') { await wait(Infinity, init.signal); }
  await wait(latencyMs, init.signal);
  if (fault === 'HTTP500') return new Response(JSON.stringify({ error: { type: 'server_error', code: 'simulated', message: 'simulated failure' } }), { status: 500, headers: { 'content-type': 'application/json' } });
  if (fault === 'MALFORMED') return new Response('{"choices": [', { status: 200, headers: { 'content-type': 'application/json' } });
  let content;
  if (reading) {
    const user = body.messages.at(-1)?.content ?? '{}';
    content = fault === 'INVALID' ? 'not a JSON reading' : JSON.stringify(readingOf(JSON.parse(user)));
  } else {
    content = fault === 'INVALID' ? '' : `فهمت. هذا ردّ تجريبي رقم ${n}.`;
  }
  const requestBytes = Buffer.byteLength(init.body);
  const prompt = Math.ceil(requestBytes / BYTES_PER_TOKEN);
  const cacheHit = Math.floor(prompt * 0.5);
  const completion = Math.max(1, Math.ceil(Buffer.byteLength(content) / 3));
  return new Response(JSON.stringify({
    id: `simulated-${n}`, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: body.model,
    choices: [{ index: 0, finish_reason: fault === 'LENGTH' ? 'length' : 'stop', message: { role: 'assistant', content } }],
    usage: { prompt_tokens: prompt, prompt_cache_hit_tokens: cacheHit, prompt_cache_miss_tokens: prompt - cacheHit, completion_tokens: completion, total_tokens: prompt + completion },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

globalThis.__QANDEEL_SIMULATED_DEEPSEEK__ = { fetch: simulatedFetch, counts, faults: [...faults.entries()] };
globalThis.fetch = simulatedFetch;
