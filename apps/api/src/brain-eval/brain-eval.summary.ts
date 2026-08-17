import type { CandidateResult } from './brain-eval.types';

const average = (values: number[]): number | null => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const percentile = (values: number[], fraction: number): number | null => {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.ceil(fraction * ordered.length) - 1];
};

export function summarizeResults(results: ReadonlyArray<CandidateResult>, reviews: ReadonlyArray<Record<string, unknown>>) {
  const metrics = ['FAST', 'DEEP'].flatMap((path) => ['ANTHROPIC', 'OPENAI'].map((provider) => {
    const rows = results.filter((row) => row.path === path && row.provider === provider && row.success);
    const costs = rows.map((row) => row.estimatedCostUsd).filter((value): value is number => value !== null);
    const averageCost = average(costs);
    return { path, provider, sampleSize: rows.length, p50LatencyMs: percentile(rows.map((row) => row.latencyMs), .5), p95LatencyMs: rows.length >= 20 ? percentile(rows.map((row) => row.latencyMs), .95) : null, averageInputTokens: average(rows.map((row) => row.inputTokens)), averageOutputTokens: average(rows.map((row) => row.outputTokens)), averageEstimatedCostPerTurnUsd: averageCost, estimatedCostPer100TurnsUsd: averageCost === null ? null : averageCost * 100, estimatedCostPer1000TurnsUsd: averageCost === null ? null : averageCost * 1000 };
  }));
  const preferences = Object.fromEntries(['FAST', 'DEEP'].map((path) => {
    const rows = reviews.filter((review) => review.path === path && ['A', 'B', 'Tie'].includes(String(review.overallPreference)));
    const counts = { A: rows.filter((row) => row.overallPreference === 'A').length, B: rows.filter((row) => row.overallPreference === 'B').length, Tie: rows.filter((row) => row.overallPreference === 'Tie').length };
    return [path, { reviewed: rows.length, counts, rates: { A: rows.length ? counts.A / rows.length : null, B: rows.length ? counts.B / rows.length : null, Tie: rows.length ? counts.Tie / rows.length : null } }];
  }));
  return { preferences, metrics, rubricAverages: calculateRubricAverages(reviews), note: 'Evidence only; this report does not select a production provider.' };
}

function calculateRubricAverages(reviews: ReadonlyArray<Record<string, unknown>>) {
  const collected: Record<string, { A: number[]; B: number[] }> = {};
  for (const review of reviews) {
    const scores = review.scores as Record<string, { A: number | null; B: number | null }> | undefined;
    for (const [rubric, pair] of Object.entries(scores ?? {})) {
      collected[rubric] ??= { A: [], B: [] };
      if (typeof pair.A === 'number' && pair.A >= 1 && pair.A <= 5) collected[rubric].A.push(pair.A);
      if (typeof pair.B === 'number' && pair.B >= 1 && pair.B <= 5) collected[rubric].B.push(pair.B);
    }
  }
  return Object.fromEntries(Object.entries(collected).map(([rubric, pair]) => [rubric, { A: average(pair.A), B: average(pair.B) }]));
}
