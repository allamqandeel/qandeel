// S8B-01 CP2 — the Speechmatics ASR run's summary and its preregistered verdict (asr-sm-plan.json `acceptance`). Pure.
// Corpus-level WER / CER (total errors over total reference length), the checks' pass rates, and the latency p50 / p95,
// per arm and per dialect, category, condition and speaker. The verdict is the harness's reading of the thresholds; the
// production decision is the Product Owner's.

const pct = (xs, p) => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return v.length ? v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))] : null;
};
const num = (x) => (x === '' || x === null || x === undefined ? null : Number(x));

export function group(rows) {
  const ok = rows.filter((r) => r.status === 'OK');
  const scored = ok.filter((r) => num(r.ref_words) > 0);
  const sum = (k) => scored.reduce((s, r) => s + num(r[k]), 0);
  const checks = { keyterms: [0, 0], number: [0, 0], intent: [0, 0], english: [0, 0] };
  for (const r of ok) {
    const c = typeof r.checks === 'string' && r.checks ? JSON.parse(r.checks) : r.checks ?? {};
    for (const [k, v] of Object.entries(c)) for (const x of [v].flat()) { checks[k][0] += x ? 1 : 0; checks[k][1] += 1; }
  }
  const lat = (k) => ({ p50: pct(ok.map((r) => num(r[k])), 50), p95: pct(ok.map((r) => num(r[k])), 95) });
  return {
    sessions: rows.length, ok: ok.length, errors: rows.length - ok.length, scored: scored.length,
    wer: sum('ref_words') ? Number((sum('word_errors') / sum('ref_words')).toFixed(4)) : null,
    cer: sum('ref_chars') ? Number((sum('char_errors') / sum('ref_chars')).toFixed(4)) : null,
    checks: Object.fromEntries(Object.entries(checks).filter(([, [, n]]) => n).map(([k, [y, n]]) => [k, { passed: y, of: n, rate: Number((y / n).toFixed(3)) }])),
    firstPartialMs: lat('first_partial_ms'), finalMs: lat('final_ms'), eouMs: lat('eou_ms'), finalAfterEouMs: lat('final_after_eou_ms'), lagMs: lat('lag_ms_p50'),
  };
}

const by = (rows, key) => {
  const m = {};
  for (const r of rows) (m[key(r)] ??= []).push(r);
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, group(v)]));
};

/** The preregistered acceptance of an arm (plan.acceptance); every item is reported, passed or not. */
export function verdict(rows, plan, armId) {
  const a = plan.acceptance;
  const mine = rows.filter((r) => r.arm === armId);
  const all = group(mine);
  const eg = group(mine.filter((r) => r.dialect === 'EGYPTIAN' && r.condition === 'SPEAKER'));
  const msa = group(mine.filter((r) => r.dialect === 'MSA'));
  const noise = group(mine.filter((r) => r.condition === 'NOISE'));
  const items = [
    ['every planned session ran without error', all.sessions === plan.set.sessions / plan.arms.length && all.errors === 0],
    [`Egyptian WER (speaker phone) ≤ ${a.egyptianWerMax}`, eg.wer !== null && eg.wer <= a.egyptianWerMax],
    [`MSA WER ≤ ${a.msaWerMax}`, msa.wer !== null && msa.wer <= a.msaWerMax],
    [`noise WER ≤ ${a.noiseWerMax}`, noise.wer !== null && noise.wer <= a.noiseWerMax],
    [`English words heard ≥ ${a.checksMin}`, (all.checks.english?.rate ?? 0) >= a.checksMin],
    [`names / key terms ≥ ${a.checksMin}`, (all.checks.keyterms?.rate ?? 0) >= a.checksMin],
    [`numbers ≥ ${a.checksMin}`, (all.checks.number?.rate ?? 0) >= a.checksMin],
    [`self-corrections keep the intended word ≥ ${a.checksMin}`, (all.checks.intent?.rate ?? 0) >= a.checksMin],
    [`first partial p50 ≤ ${a.firstPartialP50MaxMs} ms`, all.firstPartialMs.p50 !== null && all.firstPartialMs.p50 <= a.firstPartialP50MaxMs],
    [`end of speech detected (E) p50 ≤ ${a.eouP50MaxMs} ms`, all.eouMs.p50 !== null && all.eouMs.p50 <= a.eouP50MaxMs],
    [`final after the endpoint (A) p50 ≤ ${a.finalAfterEouP50MaxMs} ms`, all.finalAfterEouMs.p50 !== null && all.finalAfterEouMs.p50 <= a.finalAfterEouP50MaxMs],
  ].map(([rule, passed]) => ({ rule, passed }));
  return { arm: armId, passed: items.every((i) => i.passed), items };
}

export function summarizeAsr(rows, plan) {
  return {
    byArm: by(rows, (r) => r.arm),
    byArmDialect: by(rows, (r) => `${r.arm}|${r.dialect}`),
    byArmCategory: by(rows, (r) => `${r.arm}|${r.category}`),
    byArmCondition: by(rows, (r) => `${r.arm}|${r.condition}`),
    byArmSpeaker: by(rows, (r) => `${r.arm}|${r.speaker}`),
    verdicts: plan.arms.map((a) => verdict(rows, plan, a.id)),
  };
}
