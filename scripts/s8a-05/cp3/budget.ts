// S8A-05 CP3 — the Tier S / Tier P budget, computed (operator-only; no network; never a CI step).
//
//   node node_modules/ts-node/dist/bin.js --transpile-only --project apps/api/tsconfig.json scripts/s8a-05/cp3/budget.ts
//
// The call list is measured, not guessed: the exact request body of each of the 100 calls (80 proposals, 20 correction
// assessments) is built with the application's own request builders (`deepSeekJsonRequest`, the adapter's instructions,
// schemas and `publicSemanticData`), so its byte length is what the guard will see. Tier P makes no call.
// Prices: the guard's peak rates (USD 0.30 / M cache-miss input, 0.006 / M cache-hit input, 1.20 / M output; re-checked
// 2026-10-27), the cap always at peak. Token behaviour: the earlier paid rounds' measured tokens-per-byte, and output lengths
// fixed here per answer kind.
// Three numbers:
// - expected: median tokens per byte, the shared instruction prefix a cache hit after the first call, median output;
// - pessimistic: the highest tokens per byte seen, NO cache hit, a long output, and a 2 % share of calls cut at max_tokens;
// - reservation: every call at its full worst case (every byte a cache-miss token, all of max_tokens), which is what the
//   guard reserves before each call and never exceeds.
// Proposed cap = pessimistic + the largest single reservation (so the last call is never refused by the guard), rounded up
// to the next cent.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deepSeekJsonRequest } from '../../../apps/api/src/model-router/providers/deepseek/deepseek-client';
import {
  PUBLIC_SEMANTIC_CORRECTION_INSTRUCTIONS, PUBLIC_SEMANTIC_CORRECTION_SCHEMA, PUBLIC_SEMANTIC_PROPOSAL_INSTRUCTIONS,
  PUBLIC_SEMANTIC_PROPOSAL_SCHEMA, publicSemanticData,
} from '../../../apps/api/src/public-world/deepseek-public-semantic-interpreter';
import { PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT } from '../../../apps/api/src/public-world/public-semantic-interpreter';
import { PUBLIC_SEMANTIC_INTERPRETATION_MAX_OUTPUT_TOKENS } from '../../../apps/api/src/public-world/public-semantic-interpreter-provider.config';

const RATE = { miss: 0.30 / 1e6, hit: 0.006 / 1e6, out: 1.20 / 1e6 };
// Tokens per request byte, from artifacts/evals/s8a-04-*/deepseek/spend-state.json (paid, synthetic; English instructions
// with Arabic data): 0.233 – 0.256. Output tokens per answer kind: a proposal is about 120-200 characters of Arabic meaning
// and themes plus a 280-character explanation and 1-3 regions; an assessment is a verdict and at most 3 regions.
const CALIBRATION = { ratio: [0.245, 0.256], out: { PROPOSAL: [260, 450], CORRECTION: [50, 160] }, cutoff: [0, 0.02] } as const;

const doc = JSON.parse(readFileSync(join(__dirname, 'tier-s-cases.json'), 'utf8'));
const byId = new Map<string, any>(doc.cases.map((c: any) => [c.id, c])); // eslint-disable-line @typescript-eslint/no-explicit-any
const body = (instructions: string, schema: object, data: string) => JSON.stringify(deepSeekJsonRequest({ instructions, schema, data, maxTokens: PUBLIC_SEMANTIC_INTERPRETATION_MAX_OUTPUT_TOKENS }));
const prefixBytes = (instructions: string, schema: object) => Buffer.byteLength(body(instructions, schema, ''));
const calls = [
  ...doc.cases.map((c: any) => ({ kind: 'PROPOSAL' as const, id: c.id, prefix: prefixBytes(PUBLIC_SEMANTIC_PROPOSAL_INSTRUCTIONS, PUBLIC_SEMANTIC_PROPOSAL_SCHEMA), // eslint-disable-line @typescript-eslint/no-explicit-any
    bytes: Buffer.byteLength(body(PUBLIC_SEMANTIC_PROPOSAL_INSTRUCTIONS, PUBLIC_SEMANTIC_PROPOSAL_SCHEMA,
      publicSemanticData({ contract: PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT, packageText: c.packageText }))) })),
  ...doc.corrections.map((k: any) => ({ kind: 'CORRECTION' as const, id: k.id, prefix: prefixBytes(PUBLIC_SEMANTIC_CORRECTION_INSTRUCTIONS, PUBLIC_SEMANTIC_CORRECTION_SCHEMA), // eslint-disable-line @typescript-eslint/no-explicit-any
    bytes: Buffer.byteLength(body(PUBLIC_SEMANTIC_CORRECTION_INSTRUCTIONS, PUBLIC_SEMANTIC_CORRECTION_SCHEMA,
      publicSemanticData({ contract: PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT, packageText: byId.get(k.caseId).packageText, correction: k.correction }))) })),
];
const worst = (call: { bytes: number }) => call.bytes * RATE.miss + PUBLIC_SEMANTIC_INTERPRETATION_MAX_OUTPUT_TOKENS * RATE.out;
const cost = (call: { kind: 'PROPOSAL' | 'CORRECTION'; bytes: number; prefix: number }, level: 0 | 1, cached: boolean) => {
  const tokens = call.bytes * CALIBRATION.ratio[level];
  const hit = cached ? call.prefix * CALIBRATION.ratio[level] : 0;
  const normal = hit * RATE.hit + (tokens - hit) * RATE.miss + CALIBRATION.out[call.kind][level] * RATE.out;
  return CALIBRATION.cutoff[level] * worst(call) + (1 - CALIBRATION.cutoff[level]) * normal;
};
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const expected = sum(calls.map((call, i) => cost(call, 0, i > 0 && call.kind === calls[i - 1].kind)));
const pessimistic = sum(calls.map((call) => cost(call, 1, false)));
const largest = Math.max(...calls.map(worst));
const bytes = calls.map((call) => call.bytes);
const r5 = (value: number) => Number(value.toFixed(5));
console.log(JSON.stringify({
  calls: calls.length, proposals: doc.cases.length, corrections: doc.corrections.length, tierPCalls: 0,
  maxOutputTokens: PUBLIC_SEMANTIC_INTERPRETATION_MAX_OUTPUT_TOKENS,
  requestBytes: { min: Math.min(...bytes), max: Math.max(...bytes), total: sum(bytes), proposalPrefix: calls[0].prefix, correctionPrefix: calls.at(-1)!.prefix },
  expectedUsd: r5(expected), pessimisticUsd: r5(pessimistic), reservationAllUsd: r5(sum(calls.map(worst))), largestSingleUsd: r5(largest),
  proposedCapUsd: Math.ceil((pessimistic + largest) * 100) / 100, proposedMaxAttempts: calls.length,
  rates: { cacheMissPerM: 0.30, cacheHitPerM: 0.006, outputPerM: 1.20, checked: '2026-10-27' }, calibration: CALIBRATION,
}, null, 2));
