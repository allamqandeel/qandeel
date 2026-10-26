// S8A-04 CP3-D V2 — the FREE cost rehearsal for the proposed paid acceptance (Product Owner CP3-D V2 Final Implementation
// Contract, §9: "an exact free cost rehearsal for both tiers"; the earlier USD 0.03 and USD 0.15 – 0.25 are not approvals).
// Operator-only: never a CI step, never imported by production code, and it sends NOTHING: the real check adapter and the
// real reply-block builder write their requests into a recording client that never answers the network.
//
// What it measures: the exact request bytes of the V2 check (CG-6b′, `<check_data>`, the per-request schema, 600 output
// tokens) for the Tier 1 / Tier 2 case shapes, and the bytes of the member-knowledge block (CG-6a′) a Tier 2 reply adds to
// the reply request measured in the CP3 integrated simulation (`--simulate=d2v2`: its guard spend state and results). Tokens are
// derived from bytes at the two ratios of 1 473 earlier paid DeepSeek attempts (0.185 median, 0.268 maximum), priced at the
// guard's PEAK rate with no cache credit, and the worst case is the guard's own reservation (every byte a cache miss, every
// output token used). The cases themselves are NOT written here: they are fixed, with their SHA, before any paid call.
import { readFileSync } from 'node:fs';
import { DeepSeekSharedDisclosureJudge } from '../../apps/api/src/shared-world/deepseek-shared-disclosure-judge';
import { sharedMemberKnowledgeBlock } from '../../apps/api/src/shared-world/shared-member-knowledge-texts';
import { DEEPSEEK_FLASH_MODEL } from '../../apps/api/src/model-router/providers/deepseek/deepseek-client';
import { SHARED_DISCLOSURE_JUDGE_MAX_OUTPUT_TOKENS, SHARED_DISCLOSURE_JUDGE_TIMEOUT_MS } from '../../apps/api/src/shared-world/shared-social-memory-provider.config';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const PEAK = { cacheMiss: 0.30, output: 1.20 }; // USD per million tokens (scripts/s8a-02/network-guard.cjs)
const RATIO = { expected: 0.185, pessimistic: 0.268 };

const bodies: string[] = [];
const recording = { chat: { completions: { create: async (request: Json) => { bodies.push(JSON.stringify(request)); throw new Error('REHEARSAL: nothing is sent'); } } } };
const judge = new DeepSeekSharedDisclosureJudge({
  provider: 'DEEPSEEK', apiKey: 'rehearsal', model: DEEPSEEK_FLASH_MODEL, timeoutMs: SHARED_DISCLOSURE_JUDGE_TIMEOUT_MS,
  maxOutputTokens: SHARED_DISCLOSURE_JUDGE_MAX_OUTPUT_TOKENS, maxRetries: 0,
} as Json, recording as Json);

// Synthetic sizes only (Arabic, the case language): an item is ≈ 45 characters, a reply 120 – 520 characters.
const ITEM = 'أفضّل السفر بالقطار في الرحلات الطويلة لأنه أريح';
const reply = (chars: number, spans: number) => {
  const claims = Array.from({ length: spans }, (_, i) => `⟦K${i + 1}: ${ITEM}⟧`).join('، ');
  const filler = 'نقدر نرتب الرحلة بهدوء ونشوف الأنسب للكل في الوقت المناسب. '.repeat(20);
  return `${claims} ${filler}`.slice(0, Math.max(chars, claims.length + 1));
};
async function checkBytes(chars: number, items: number, spans: number): Promise<number> {
  bodies.length = 0;
  await judge.judge({
    binding: { effectiveContextRef: 'sha256:a', audienceSnapshotRef: 'sha256:b', disclosureAuthorizationRef: 'sha256:c', outputDigest: 'sha256:d' },
    reply: reply(chars, spans), spans: Array.from({ length: spans }, (_, i) => `K${i + 1}`),
    items: Array.from({ length: items }, (_, i) => ({ id: `K${i + 1}`, item: ITEM })),
  }).catch(() => undefined);
  if (bodies.length !== 1) throw new Error('REHEARSAL: the adapter did not build exactly one request');
  return Buffer.byteLength(bodies[0]);
}
const usd = (bytes: number, ratio: number, outputTokens: number) => (bytes * ratio * PEAK.cacheMiss + outputTokens * PEAK.output) / 1e6;
const worst = (bytes: number, maxTokens: number) => (bytes * PEAK.cacheMiss + maxTokens * PEAK.output) / 1e6;

async function main() {
  // The simulation's guard spend state (one attempt per request that reached the guard, in order) and its results (the
  // family of every crossing; an injected HTTP 500 never reaches the guard).
  const spend = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const reached = (JSON.parse(readFileSync(process.argv[3], 'utf8')).calls as Json[]).filter((call) => !(call.fault === 'HTTP500' && call.status === 500));
  if (reached.length !== spend.attempts.length) throw new Error('REHEARSAL: the spend state and the results do not align');
  const replies = reached.map((call, i) => (call.family === 'REPLY' ? spend.attempts[i].requestBytes as number : null)).filter((n): n is number => n !== null).sort((a, b) => a - b);
  const replyMax = replies.at(-1) as number;
  const replyMaxTokens = 1024;
  const block = Buffer.byteLength(sharedMemberKnowledgeBlock([{ owner: 'محمد', ref: 'F1·abcdef', item: ITEM }, { owner: 'سارة', ref: 'F2·abcdef', item: ITEM }]) ?? '');

  // Tier 1: 150 checks of a given reply (no generation): 90 meant to block, 60 meant to allow; 1 – 3 items, 0 – 3 spans.
  const t1Shapes = [[160, 1, 1], [320, 2, 1], [520, 3, 3]] as const;
  const t1 = [];
  for (const [chars, items, spans] of t1Shapes) t1.push({ chars, items, spans, bytes: await checkBytes(chars, items, spans) });
  const t1Max = Math.max(...t1.map((s) => s.bytes));
  const t1Mid = t1[1].bytes;
  // Tier 2: 60 cases, each ONE reply generation with the member-knowledge block and ONE check (at most two calls).
  const t2Check = await checkBytes(520, 2, 2);
  const t2Reply = replyMax + block;

  const tier1 = {
    calls: 150,
    expectedUsd: 150 * usd(t1Mid, RATIO.expected, 120),
    pessimisticUsd: 150 * usd(t1Max, RATIO.pessimistic, 300),
    worstCaseReservationUsd: 150 * worst(t1Max, SHARED_DISCLOSURE_JUDGE_MAX_OUTPUT_TOKENS),
  };
  const tier2 = {
    calls: 120,
    expectedUsd: 60 * (usd(replies[replies.length >> 1] + block, RATIO.expected, 250) + usd(t2Check, RATIO.expected, 150)),
    pessimisticUsd: 60 * (usd(t2Reply, RATIO.pessimistic, 600) + usd(t2Check, RATIO.pessimistic, 300)),
    worstCaseReservationUsd: 60 * (worst(t2Reply, replyMaxTokens) + worst(t2Check, SHARED_DISCLOSURE_JUDGE_MAX_OUTPUT_TOKENS)),
  };
  const round = (value: number) => Math.round(value * 10000) / 10000;
  console.log(JSON.stringify({
    sent: 0,
    checkRequestBytes: t1, tier2CheckBytes: t2Check, memberKnowledgeBlockBytes: block,
    simulatedReplyRequestBytes: { n: replies.length, median: replies[replies.length >> 1], max: replyMax },
    tier1: Object.fromEntries(Object.entries(tier1).map(([k, v]) => [k, round(v)])),
    tier2: Object.fromEntries(Object.entries(tier2).map(([k, v]) => [k, round(v)])),
    total: { calls: 270, expectedUsd: round(tier1.expectedUsd + tier2.expectedUsd), pessimisticUsd: round(tier1.pessimisticUsd + tier2.pessimisticUsd),
      worstCaseReservationUsd: round(tier1.worstCaseReservationUsd + tier2.worstCaseReservationUsd) },
  }, null, 2));
}
main().catch((error) => { console.error(`[rehearsal] NOT COMPLETED: ${error?.message ?? error}`); process.exit(1); });
