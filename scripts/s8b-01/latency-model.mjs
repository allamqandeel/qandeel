// S8B-01 — the preregistered end-of-speech → first-audible-audio budget model (Voice Runtime Contract §11).
//
// first audio = E + A + P + T + G + R + S + N, each stage measured separately (bench-plan.json `latency.stages`). The model
// composes measured samples per stage; it never invents a stage value. A stage with no measurement is reported MISSING and
// the verdict is NOT_MEASURED, never a pass.

/** Nearest-rank percentile of numeric samples (p in 0..100). */
export function percentile(samples, p) {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  const sorted = [...samples].sort((x, y) => x - y);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

/**
 * Composes the per-stage p50 / p95 into the budget. Summing per-stage p95s over-states the true p95 of the sum (stages are
 * not perfectly correlated); the plan says so and uses it as the conservative bound. The verdict compares the composed
 * p50 / p95 with the target.
 */
export function composeBudget(stageSamples, plan) {
  const rows = plan.latency.stages.map(({ symbol, name }) => {
    const samples = stageSamples[symbol];
    if (!Array.isArray(samples) || samples.length === 0) return { symbol, name, status: 'MISSING', p50: null, p95: null, n: 0 };
    return { symbol, name, status: 'MEASURED', p50: percentile(samples, 50), p95: percentile(samples, 95), n: samples.length };
  });
  const missing = rows.filter((r) => r.status === 'MISSING').map((r) => r.symbol);
  const p50 = missing.length ? null : rows.reduce((sum, r) => sum + r.p50, 0);
  const p95Bound = missing.length ? null : rows.reduce((sum, r) => sum + r.p95, 0);
  const { p50Ms, p95Ms } = plan.latency.target;
  let verdict = 'NOT_MEASURED';
  if (!missing.length) verdict = p50 <= p50Ms && p95Bound <= p95Ms ? 'WITHIN_TARGET' : 'OVER_TARGET';
  // The measured stages alone, shown beside the verdict so a missing device stage (N) never hides what is known.
  const measured = rows.filter((r) => r.status === 'MEASURED');
  const partial = { stages: measured.map((r) => r.symbol).join(''), p50Ms: measured.reduce((sum, r) => sum + r.p50, 0),
    p95BoundMs: measured.reduce((sum, r) => sum + r.p95, 0) };
  return { rows, missing, composed: { p50Ms: p50, p95BoundMs: p95Bound }, partial, target: { p50Ms, p95Ms }, verdict };
}
