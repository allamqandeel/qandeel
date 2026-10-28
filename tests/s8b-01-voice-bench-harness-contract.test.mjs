import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { corpusRates, errorRates, normalizeArabic } from '../scripts/s8b-01/arabic-text-metrics.mjs';
import { composeBudget, percentile } from '../scripts/s8b-01/latency-model.mjs';
import { checkPlan } from '../scripts/s8b-01/bench-launch.mjs';

// S8B-01 CP1 — the non-production voice benchmark harness (scripts/s8b-01/). This contract proves, at zero cost and with
// nothing sent off the machine, that the preregistered plan is intact, that the scoring is the preregistered one, that the
// CP1 lock refuses every live run, and that the whole path runs end to end against simulated providers.

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = join(root, 'scripts', 's8b-01');
const plan = JSON.parse(readFileSync(join(dir, 'bench-plan.json'), 'utf8'));
const launch = (args, env = {}) => spawnSync(process.execPath, [join(dir, 'bench-launch.mjs'), ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });

test('the preregistered plan is intact: corpus hashes, the USD 10 cap and its split, no retry, the D-6 target', () => {
  assert.deepEqual(checkPlan(plan), []);
  assert.equal(plan.guard.costCapUsd, 10);
  assert.equal(plan.guard.authorized, false, 'CP1 keeps the benchmark locked');
});

test('a changed corpus or a widened cap fails the plan check', () => {
  const tampered = structuredClone(plan);
  tampered.corpusSha256['corpus/tts-pronunciation-set.json'] = '0'.repeat(64);
  tampered.guard.costCapUsd = 12;
  const problems = checkPlan(tampered);
  assert.ok(problems.some((p) => p.includes('corpus hash mismatch')));
  assert.ok(problems.some((p) => p.includes('USD 10')));
});

test('scoring normalization ignores orthography that does not change what was said', () => {
  assert.equal(normalizeArabic('العِلْمُ'), normalizeArabic('العلم'));
  assert.equal(normalizeArabic('أحمد إلى'), normalizeArabic('احمد الي'));
  assert.equal(normalizeArabic('مدرسة'), normalizeArabic('مدرسه'));
  assert.equal(normalizeArabic('٢٥٠٠ جنيه!'), '2500 جنيه');
  assert.equal(errorRates('ميعاد الدكتور الساعة عشرة', 'ميعاد الدكتور الساعه عشره').wordErrors, 0);
});

test('WER is corpus-level: total word errors over total reference words', () => {
  const r = corpusRates([
    { reference: 'أنا رايح الشغل', hypothesis: 'أنا رايح' },
    { reference: 'بكرة الصبح بدري خالص', hypothesis: 'بكرة الصبح بدري خالص' },
  ]);
  assert.equal(r.utterances, 2);
  assert.equal(r.wer, 1 / 7);
});

test('the budget never passes a stage it did not measure', () => {
  assert.equal(percentile([5, 1, 3, 2, 4], 50), 3);
  const partialSamples = { E: [500], A: [200], P: [150], T: [600], G: [200], R: [20], S: [250] };
  const missingN = composeBudget(partialSamples, plan);
  assert.equal(missingN.verdict, 'NOT_MEASURED');
  assert.deepEqual(missingN.missing, ['N']);
  assert.equal(missingN.partial.p50Ms, 1920);
  const within = composeBudget({ E: [300], A: [150], P: [100], T: [400], G: [150], R: [10], S: [200], N: [100] }, plan);
  assert.equal(within.verdict, 'WITHIN_TARGET');
  const over = composeBudget({ ...partialSamples, N: [100] }, plan);
  assert.equal(over.verdict, 'OVER_TARGET');
});

test('the CP1 lock refuses a live run before anything is sent, at the launcher and in the guard', () => {
  const r = launch(['--live']);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /not authorized \(CP1 lock\)\. Nothing was sent\./u);
  const guarded = spawnSync(process.execPath, ['--require', join(dir, 'spend-guard.cjs'), '-e', ''], { encoding: 'utf8', env: { ...process.env, QANDEEL_S8B_MODE: 'live' } });
  assert.notEqual(guarded.status, 0);
  assert.match(guarded.stderr, /not authorized for a live run \(CP1 lock\); nothing was sent/u);
});

test('under the guard, every non-loopback destination is refused', () => {
  const probe = `
    const results = [];
    for (const attempt of [
      () => fetch('https://api.deepseek.com/chat/completions', { method: 'POST' }),
      () => fetch('https://example.com/'),
    ]) { try { await attempt(); results.push('SENT'); } catch (e) { results.push(e.code ?? e.message); } }
    try { require('node:net').connect(443, 'api.openai.com'); results.push('SENT'); } catch (e) { results.push(e.code); }
    console.log(JSON.stringify(results));`;
  const r = spawnSync(process.execPath, ['--require', join(dir, 'spend-guard.cjs'), '--input-type=commonjs', '-e', `(async () => { ${probe} })()`],
    { encoding: 'utf8', env: { ...process.env, QANDEEL_S8B_MODE: 'simulate' } });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout.trim()), ['S8B_01_NETWORK_FORBIDDEN', 'S8B_01_NETWORK_FORBIDDEN', 'S8B_01_NETWORK_FORBIDDEN']);
});

test('the zero-cost rehearsal runs the whole scoring path against simulated providers and reports no paid call', () => {
  const out = join(root, 'artifacts', 'evals', 's8b-01', 'simulated', 'report.json');
  rmSync(out, { force: true });
  const r = launch(['--simulate']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(out));
  const report = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(report.simulated, true);
  assert.equal(report.paidCalls, 0);
  assert.deepEqual(Object.keys(report.asr).sort(), plan.asr.candidates.map((c) => c.id).sort());
  for (const dialects of Object.values(report.asr)) assert.deepEqual(Object.keys(dialects).sort(), ['EGYPTIAN', 'GULF', 'LEVANTINE', 'MSA']);
  assert.equal(report.deepseekStream.calls, plan.deepseekStream.calls);
  assert.ok(report.deepseekStream.firstTokenP50Ms > 0, 'first token measured by the real stream measurer');
  assert.equal(report.budget.verdict, 'NOT_MEASURED', 'the device stage N is never simulated into a pass');
});
