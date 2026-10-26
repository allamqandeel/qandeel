// S8A-04 CP3-D V2 — the D-7 budget, computed (operator-only; no network; never a CI step).
//
//   node scripts/s8a-04/cp3d-v2/budget.mjs <preflight.json> <tier2 simulated results.json>
//
// Inputs are measured, not guessed:
// - the call list: Tier 1 from the pre-flight (the exact check-request bytes of each of the 150 cases, built by the real
//   adapter); Tier 2 from a zero-cost simulated run of the frozen scenarios (every call's family, request bytes and max_tokens,
//   both arms). Which calls happen is deterministic: the attribution reading follows a deterministic scan of the
//   conversation, and the check follows admission. Only the text of the replies is simulated.
// - prices and token behaviour: the guard's peak rates (USD 0.30 / M input, USD 1.20 / M output, every input token a cache
//   miss), and the earlier paid S8A-04 rounds' measured tokens-per-byte, output lengths and budget cut-offs (CALIBRATION).
// Three numbers per tier:
// - expected: median behaviour;
// - pessimistic: the worst behaviour seen, plus a cut-off rate above the one measured;
// - reservation: every call at its full worst case, which is what the guard reserves and never exceeds.
// Proposed cap = pessimistic + the largest single reservation (so the last call is never refused by the guard), rounded up
// to the next cent.
import { readFileSync } from 'node:fs';

const IN = 0.30 / 1e6;
const OUT = 1.20 / 1e6;
// From artifacts/evals/s8a-04-{cp1,cp2,cp2-binding,cp3d}/deepseek/spend-state.json (paid, synthetic):
const CALIBRATION = {
  SHARED_DISCLOSURE_JUDGE: { ratio: [0.235, 0.238], out: [49, 200], cutoff: [0, 0.02] }, // V1 checker: 120 calls, out max 67, ms max 1846; V2 answers per span: pessimistic 200
  REPLY: { ratio: [0.234, 0.256], out: [184, 300], cutoff: [0.125, 0.2] }, // CP2 Shared replies 1024: 5 / 40 cut at the 3 s FAST budget
  ATTRIBUTION_READING: { ratio: [0.233, 0.256], out: [149, 300], cutoff: [0.05, 0.2] }, // 2.5 s budget; CP1 readings ms p90 2.4 s
};
const worstOf = (bytes, maxTokens) => bytes * IN + maxTokens * OUT;
const costOf = (call, level) => {
  const c = CALIBRATION[call.family];
  const worst = worstOf(call.bytes, call.maxTokens);
  const normal = call.bytes * c.ratio[level] * IN + c.out[level] * OUT;
  return c.cutoff[level] * worst + (1 - c.cutoff[level]) * normal; // a cut-off call is charged at its worst case
};
function tally(calls) {
  const byFamily = {};
  for (const call of calls) {
    const f = (byFamily[call.family] ??= { calls: 0, bytes: 0, expected: 0, pessimistic: 0, reservation: 0 });
    f.calls += 1; f.bytes += call.bytes;
    f.expected += costOf(call, 0); f.pessimistic += costOf(call, 1); f.reservation += worstOf(call.bytes, call.maxTokens);
  }
  const sum = (key) => Object.values(byFamily).reduce((acc, f) => acc + f[key], 0);
  const largest = Math.max(...calls.map((call) => worstOf(call.bytes, call.maxTokens)));
  const pessimistic = sum('pessimistic');
  return {
    calls: calls.length, byFamily, expectedUsd: sum('expected'), pessimisticUsd: pessimistic, reservationAllUsd: sum('reservation'),
    largestSingleUsd: largest, proposedCapUsd: Math.ceil((pessimistic + largest) * 100) / 100,
  };
}

const [preflightPath, tier2Path] = process.argv.slice(2);
const preflight = JSON.parse(readFileSync(preflightPath, 'utf8'));
const tier1 = preflight.tier1.perCase.map((c) => ({ family: 'SHARED_DISCLOSURE_JUDGE', bytes: c.bytes, maxTokens: preflight.tier1.maxOutputTokens }));
const sim = JSON.parse(readFileSync(tier2Path, 'utf8'));
if (sim.subset) throw new Error('the Tier 2 measurement must be a full simulated run, not a subset');
const tier2 = sim.provider.perCall.map((c) => ({ family: c.family, bytes: c.requestBytes, maxTokens: c.maxTokens, arm: c.arm }));
const round = (value) => (typeof value === 'number' ? Number(value.toFixed(5)) : value);
const out = JSON.parse(JSON.stringify({ tier1: tally(tier1), tier2: tally(tier2), tier2Arms: {
  knowledge: tier2.filter((c) => c.arm.endsWith(':KNOWLEDGE')).length, without: tier2.filter((c) => c.arm.endsWith(':WITHOUT')).length,
}, calibration: CALIBRATION }), (_key, value) => round(value));
console.log(JSON.stringify(out, null, 2));
