'use strict';
/**
 * S8B-06 CP1 — pool the repetitions of one echo condition. VALIDATION TOOLING ONLY.
 *
 * Re-runs the echo analysis (echo-analysis.cjs) offline from the numbers each `echo-device-report-*.json` stored (uplink
 * levels and instants, the reply's ON/OFF mask, reference levels, heard marks — never samples), then pools the valid
 * ON/OFF pairs of every run of the condition: a street cannot be made quiet, so the sample is grown by repetition rather
 * than by asking for silence. A condition is decided only when the pooled sample is sufficient (≥ 24 valid pairs over
 * ≥ 2 runs); the decision is the sign test of the pooled pair differences, and the leak is the median added power.
 *
 *   node scripts/s8b-06/echo-pool.cjs <evidence dir> [--lag <ms>] [--from <report number>] [button ...]
 *
 * `--lag` evaluates every run at that one lag (taken from the positive control) instead of each run's best lag, which
 * would bias the pooled pairs towards an echo. `--from` keeps only the reports from that number on (a build or method change).
 */
const fs = require('node:fs');
const path = require('node:path');
const { analyzeEcho, signTestP } = require('./echo-analysis.cjs');

const dir = process.argv[2];
if (!dir) throw new Error('usage: echo-pool.cjs <evidence dir> [button ...]');
const rest = process.argv.slice(3);
const flag = (name) => {
  const at = rest.indexOf(name);
  if (at < 0) return null;
  const value = Number(rest[at + 1]);
  rest.splice(at, 2);
  return value;
};
const fixedLagMs = flag('--lag');
const fromReport = flag('--from');
const wanted = rest;
const MIN_PAIRS = 24;
const MIN_RUNS = 2;

const median = (v) => {
  if (v.length === 0) return null;
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const round = (v, d = 1) => (v === null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

function reanalyse(record) {
  const i = record.echo?.inputs;
  if (!i || !i.mask) return null;
  const uplink = i.levels.map(([captureMs, levelDb, receivedAt]) => ({ captureMs, levelDb, receivedAt }));
  return analyzeEcho({
    uplink, mask: [...i.mask].map((c) => c === '1'), refDb: i.refDb, sendAt: i.sendAt, marks: i.marks, chunks: i.chunks, candidates: i.candidates, fixedLagMs,
  });
}

const groups = new Map();
for (const file of fs.readdirSync(dir).filter((f) => /^echo-device-report-.*\.json$/u.test(f)).sort()) {
  const record = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  if (wanted.length && !wanted.includes(record.button)) continue;
  if (fromReport !== null && Number(file.match(/report-(\d+)/u)?.[1] ?? 0) < fromReport) continue;
  const a = reanalyse(record);
  if (!a) continue;
  const key = `${record.button}:${record.gate}`;
  if (!groups.has(key)) groups.set(key, { runs: [], pairs: [], cuts: 0, candidates: 0, capture: new Set() });
  const g = groups.get(key);
  g.runs.push({ file, timeline: a.timeline, lag: a.bestLagMs, rho: a.correlation, p: a.pNull, valid: a.validPairs ?? 0, of: a.onSegments ?? 0, ext: a.externalEvents?.count ?? 0 });
  g.pairs.push(...(a.validPairDiffs ?? []));
  g.cuts += record.falseCuts ?? 0;
  g.candidates += record.reportOnlyCandidates ?? 0;
  for (const c of Array.isArray(record.capture) ? record.capture : []) {
    g.capture.add(`${c.source}[${c.effects.map((e) => `${e.name}${e.enabled ? '' : ' (disabled)'}`).join(', ') || 'no effect'}]`);
  }
}

const out = [];
for (const [key, g] of groups) {
  const d = g.pairs.map((p) => p[0]);
  const added = median(g.pairs.map((p) => p[1]));
  const positive = d.filter((x) => x > 0).length;
  const sufficient = g.pairs.length >= MIN_PAIRS && g.runs.length >= MIN_RUNS;
  const pSign = d.length ? signTestP(positive, d.length) : null;
  out.push({
    condition: key, fromReport, lag: fixedLagMs === null ? 'per-run best (biased toward echo)' : fixedLagMs, runs: g.runs.length, validPairs: g.pairs.length, sufficient,
    pairDiffDbMedian: round(median(d)), positivePairs: positive, pSign: round(pSign, 5),
    leakDb: added === null ? null : added > 0 ? round(10 * Math.log10(added)) : -120,
    echoDetected: sufficient ? pSign < 0.01 && median(d) > 0 : null,
    falseCuts: g.cuts, reportOnlyCandidates: g.candidates, capture: [...g.capture], perRun: g.runs,
  });
}
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
