// S8B-01 — the preregistered end-of-speech → first-audible-audio budget model (Voice Runtime Contract §11).
//
// first audio = E + A + P + T + G + R + S + N, each stage measured separately (bench-plan.json `latency.stages`). The model
// composes measured samples per stage; it never invents a stage value. A stage with no measurement is reported MISSING and
// the verdict is NOT_MEASURED, never a pass.
//
// CP1 review R1-2: the per-stage sums are a PLANNING BUDGET only. Neither the sum of per-stage p50s nor the sum of
// per-stage p95s is a statistical bound on the p50 / p95 of the end-to-end time (stage delays are not independent, and a
// sum of percentiles can sit on either side of the percentile of the sum). The only proof of the p50 / p95 target is
// `endToEndVerdict` over complete end-of-speech → first-audible-audio measurements taken on the device (S8B-05 on
// synthetic audio, S8B-06 on a real Android device).

/** Nearest-rank percentile of numeric samples (p in 0..100). */
export function percentile(samples, p) {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  const sorted = [...samples].sort((x, y) => x - y);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

/**
 * Composes the per-stage p50 / p95 into the planning budget: it shows where the time goes and which stage to work on. Its
 * verdict is a planning verdict (WITHIN_PLANNING_BUDGET / OVER_PLANNING_BUDGET / NOT_MEASURED), never a proof of the
 * target; `proof` names what proves it.
 */
export function composeBudget(stageSamples, plan) {
  const rows = plan.latency.stages.map(({ symbol, name }) => {
    const samples = stageSamples[symbol];
    if (!Array.isArray(samples) || samples.length === 0) return { symbol, name, status: 'MISSING', p50: null, p95: null, n: 0 };
    return { symbol, name, status: 'MEASURED', p50: percentile(samples, 50), p95: percentile(samples, 95), n: samples.length };
  });
  const missing = rows.filter((r) => r.status === 'MISSING').map((r) => r.symbol);
  const p50Sum = missing.length ? null : rows.reduce((sum, r) => sum + r.p50, 0);
  const p95Sum = missing.length ? null : rows.reduce((sum, r) => sum + r.p95, 0);
  const { p50Ms, p95Ms } = plan.latency.target;
  let verdict = 'NOT_MEASURED';
  if (!missing.length) verdict = p50Sum <= p50Ms && p95Sum <= p95Ms ? 'WITHIN_PLANNING_BUDGET' : 'OVER_PLANNING_BUDGET';
  // The measured stages alone, shown beside the verdict so a missing device stage (N) never hides what is known.
  const measured = rows.filter((r) => r.status === 'MEASURED');
  const partial = { stages: measured.map((r) => r.symbol).join(''), p50SumMs: measured.reduce((sum, r) => sum + r.p50, 0),
    p95SumMs: measured.reduce((sum, r) => sum + r.p95, 0) };
  return { kind: 'PLANNING_BUDGET', rows, missing, planning: { p50SumMs: p50Sum, p95SumMs: p95Sum }, partial,
    target: { p50Ms, p95Ms }, verdict, proof: 'END_TO_END_DEVICE_MEASUREMENT' };
}

/**
 * The acceptance check: p50 / p95 of complete end-of-speech → first-audible-audio samples measured on the device. Fewer
 * than `minSamples` samples is NOT_MEASURED.
 */
export function endToEndVerdict(samples, plan, { minSamples = 20 } = {}) {
  const { p50Ms, p95Ms } = plan.latency.target;
  if (!Array.isArray(samples) || samples.length < minSamples) return { n: samples?.length ?? 0, p50: null, p95: null, target: { p50Ms, p95Ms }, verdict: 'NOT_MEASURED' };
  const p50 = percentile(samples, 50);
  const p95 = percentile(samples, 95);
  return { n: samples.length, p50, p95, target: { p50Ms, p95Ms }, verdict: p50 <= p50Ms && p95 <= p95Ms ? 'WITHIN_TARGET' : 'OVER_TARGET' };
}
