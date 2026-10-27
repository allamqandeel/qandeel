// S8A-05 CP4 — the Tier Q budget, computed (operator-only; no network; never a CI step).
//
//   node node_modules/ts-node/dist/bin.js --transpile-only --project apps/api/tsconfig.json scripts/s8a-05/cp4/budget.ts
//
// The call list is measured, not guessed: each case's exact request body is built by the APPLICATION's own path (0182's
// context rows → `publicQandeelContextOf` → `assemblePublicQandeelRequest` → `DeepSeekModelRouter`), captured by a client
// that answers locally, so its byte length and its path (FAST / DEEP, hence max_tokens) are what the guard will see. A case
// the Safety Gate answers deterministically would make no call; it is still counted here (the cap never assumes one).
// Prices: the guard's peak rates (USD 0.30 / M cache-miss input, 0.006 / M cache-hit input, 1.20 / M output; re-checked
// 2026-10-27), the cap always at peak. Token behaviour: the earlier paid rounds' measured tokens per byte; output fixed here
// per path (FAST: a short public answer; DEEP: thinking counted inside max_tokens, as DeepSeek bills it).
// Three numbers:
// - expected: median tokens per byte, the shared system prefix a cache hit after the first call, median output;
// - pessimistic: the highest tokens per byte seen, NO cache hit, a long output, and a 5 % share of calls cut at max_tokens;
// - reservation: every call at its full worst case (every byte a cache-miss token, all of max_tokens), which is what the
//   guard reserves before each call and never exceeds.
// Proposed cap = pessimistic + the largest single reservation (so the last call is never refused by the guard), rounded up
// to the next cent.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveDeepSeekModel } from '../../../apps/api/src/model-router/model-profile.registry';
import { DeepSeekModelRouter } from '../../../apps/api/src/model-router/providers/deepseek/deepseek-model-router';
import { DEEPSEEK_MAX_OUTPUT_TOKENS, DEEPSEEK_PROVIDER_TIMEOUT_MS } from '../../../apps/api/src/model-router/providers/deepseek/deepseek-model-router.config';
import { assemblePublicQandeelRequest } from '../../../apps/api/src/public-world/public-qandeel-model-input';
import { publicQandeelContextOf } from '../../../apps/api/src/public-world/public-qandeel-reply.service';
import { rowsOf, type Case } from './rows';

const RATE = { miss: 0.30 / 1e6, hit: 0.006 / 1e6, out: 1.20 / 1e6 };
// Tokens per request byte, from the paid synthetic rounds (English instructions with Arabic data): 0.233 – 0.256.
// Output tokens per path: FAST, a short public answer of 2–5 sentences (no thinking); DEEP, thinking plus the answer, from
// the S8A-02 CP3 DEEP measurement (median ≈ 900, long ≈ 1,800, max_tokens 2,800).
const CALIBRATION = { ratio: [0.245, 0.256], out: { FAST: [140, 320], DEEP: [900, 1800] }, cutoff: [0, 0.05] } as const;

async function main() {
  const doc = JSON.parse(readFileSync(join(__dirname, 'tier-q-cases.json'), 'utf8')) as { cases: Case[] };
  const calls: { id: string; path: 'FAST' | 'DEEP'; bytes: number; prefix: number }[] = [];
  let captured: unknown = null;
  const client = { chat: { completions: { create: async (body: unknown) => {
    captured = body;
    return { choices: [{ finish_reason: 'stop', message: { content: 'ok' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } };
  } } } };
  const router = new DeepSeekModelRouter({ apiKey: 'budget-only', resolveModel: resolveDeepSeekModel, maxOutputTokens: DEEPSEEK_MAX_OUTPUT_TOKENS,
    timeoutMs: DEEPSEEK_PROVIDER_TIMEOUT_MS, maxRetries: 0 }, client as never);
  for (const [index, c] of doc.cases.entries()) {
    const context = publicQandeelContextOf(rowsOf(c, index));
    const request = context === null ? null : assemblePublicQandeelRequest(context);
    if (request === null) throw new Error(`${c.id}: no request`);
    await router.generate(request);
    const body = captured as { messages: { role: string; content: string }[] };
    calls.push({ id: c.id, path: request.path, bytes: Buffer.byteLength(JSON.stringify(body)), prefix: Buffer.byteLength(body.messages[0].content) });
  }
  const worst = (call: { path: 'FAST' | 'DEEP'; bytes: number }) => call.bytes * RATE.miss + DEEPSEEK_MAX_OUTPUT_TOKENS[call.path] * RATE.out;
  const cost = (call: (typeof calls)[number], level: 0 | 1, cached: boolean) => {
    const tokens = call.bytes * CALIBRATION.ratio[level];
    const hit = cached ? call.prefix * CALIBRATION.ratio[level] : 0;
    const normal = hit * RATE.hit + (tokens - hit) * RATE.miss + CALIBRATION.out[call.path][level] * RATE.out;
    return CALIBRATION.cutoff[level] * worst(call) + (1 - CALIBRATION.cutoff[level]) * normal;
  };
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const expected = sum(calls.map((call, i) => cost(call, 0, i > 0)));
  const pessimistic = sum(calls.map((call) => cost(call, 1, false)));
  const largest = Math.max(...calls.map(worst));
  const bytes = calls.map((call) => call.bytes);
  const r5 = (value: number) => Number(value.toFixed(5));
  console.log(JSON.stringify({
    calls: calls.length, fast: calls.filter((c) => c.path === 'FAST').length, deep: calls.filter((c) => c.path === 'DEEP').length,
    maxOutputTokens: DEEPSEEK_MAX_OUTPUT_TOKENS,
    requestBytes: { min: Math.min(...bytes), max: Math.max(...bytes), total: sum(bytes), systemPrefix: calls[0].prefix },
    expectedUsd: r5(expected), pessimisticUsd: r5(pessimistic), reservationAllUsd: r5(sum(calls.map(worst))), largestSingleUsd: r5(largest),
    proposedCapUsd: Math.ceil((pessimistic + largest) * 100) / 100, proposedMaxAttempts: calls.length,
    rates: { cacheMissPerM: 0.30, cacheHitPerM: 0.006, outputPerM: 1.20, checked: '2026-10-27' }, calibration: CALIBRATION,
    perCase: calls.map((c) => `${c.id}:${c.path}:${c.bytes}`),
  }, null, 2));
}
main().catch((error) => { console.error(error); process.exit(1); });
