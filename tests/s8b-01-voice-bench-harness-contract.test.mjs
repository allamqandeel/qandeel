import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { corpusRates, errorRates, normalizeArabic } from '../scripts/s8b-01/arabic-text-metrics.mjs';
import { composeBudget, endToEndVerdict, percentile } from '../scripts/s8b-01/latency-model.mjs';
import { GUIDANCE_ECHO_MIN_LENGTH, INTERNAL_CONTAINERS, guidanceSentences, measureStream, va2ReleasableLength } from '../scripts/s8b-01/stream-first-token.mjs';
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

test('the planning budget never passes a stage it did not measure', () => {
  assert.equal(percentile([5, 1, 3, 2, 4], 50), 3);
  const partialSamples = { E: [500], A: [200], P: [150], T: [600], G: [200], R: [20], S: [250] };
  const missingN = composeBudget(partialSamples, plan);
  assert.equal(missingN.verdict, 'NOT_MEASURED');
  assert.deepEqual(missingN.missing, ['N']);
  assert.equal(missingN.partial.p50SumMs, 1920);
  const within = composeBudget({ E: [300], A: [150], P: [100], T: [400], G: [150], R: [10], S: [200], N: [100] }, plan);
  assert.equal(within.verdict, 'WITHIN_PLANNING_BUDGET');
  const over = composeBudget({ ...partialSamples, N: [100] }, plan);
  assert.equal(over.verdict, 'OVER_PLANNING_BUDGET');
});

test('R1-2: the per-stage p95 sum is a planning budget, not a bound; only end-to-end device samples prove p50 / p95', () => {
  // Two stages whose rare spikes fall on different turns: each stage p95 is 0, the p95 of the end-to-end sum is 100.
  const a = Array.from({ length: 100 }, (_, i) => (i < 4 ? 100 : 0));
  const b = Array.from({ length: 100 }, (_, i) => (i >= 4 && i < 8 ? 100 : 0));
  const sumOfP95 = percentile(a, 95) + percentile(b, 95);
  const p95OfSum = percentile(a.map((x, i) => x + b[i]), 95);
  assert.equal(sumOfP95, 0);
  assert.equal(p95OfSum, 100, 'the sum of stage p95s under-states the end-to-end p95 here, so it is no bound');
  const budget = composeBudget({ E: [300], A: [150], P: [100], T: [400], G: [150], R: [10], S: [200], N: [100] }, plan);
  assert.equal(budget.kind, 'PLANNING_BUDGET');
  assert.equal(budget.proof, 'END_TO_END_DEVICE_MEASUREMENT');
  assert.ok(!['WITHIN_TARGET', 'OVER_TARGET'].includes(budget.verdict), 'the planning budget never claims the target');
  assert.equal(endToEndVerdict([1200, 1300], plan).verdict, 'NOT_MEASURED', 'too few end-to-end samples');
  const device = Array.from({ length: 40 }, (_, i) => 1000 + i * 10);
  assert.deepEqual([endToEndVerdict(device, plan).p50, endToEndVerdict(device, plan).verdict], [1190, 'WITHIN_TARGET']);
  assert.equal(endToEndVerdict([...device.slice(0, 37), 2600, 2700, 2800], plan).verdict, 'OVER_TARGET');
  assert.match(plan.latency.composition, /planning budget only/u);
});

const guardSource = readFileSync(join(root, 'apps', 'api', 'src', 'model-router', 'model-output-release-guard.ts'), 'utf8');

test('R1-1: the VA-2 predicate mirrors the S8A-01 guard checks exactly', () => {
  const containers = guardSource.match(/const INTERNAL_CONTAINERS = \[([\s\S]*?)\] as const;/u)[1].match(/'([a-z_]+)'/gu).map((q) => q.slice(1, -1));
  assert.deepEqual(INTERNAL_CONTAINERS, containers);
  assert.equal(GUIDANCE_ECHO_MIN_LENGTH, Number(guardSource.match(/GUIDANCE_ECHO_MIN_LENGTH = (\d+);/u)[1]));
  const unreadable = new RegExp(guardSource.match(/const UNREADABLE = \/(.*)\/u;/u)[1], 'u');
  for (let cp = 0; cp <= 0xa0; cp += 1) {
    const ch = String.fromCodePoint(cp);
    assert.equal(va2ReleasableLength(`مرحبا يا صاحبي، ${ch}`, []).withheld === 'UNREADABLE', unreadable.test(ch), `U+${cp.toString(16)}`);
  }
  assert.ok(unreadable.test('�'));
  assert.equal(va2ReleasableLength('مرحبا يا صاحبي، �', []).withheld, 'UNREADABLE');
});

test('R1-1: a punctuation mark is not a releasable chunk unless VA-2 releases it', () => {
  const english = guidanceSentences('Reply in short spoken sentences that the listener can follow without seeing any text at all.');
  assert.deepEqual(va2ReleasableLength('تمام، فاهمك. تحب', english), { length: 12 }, 'an ordinary chunk is released at its boundary');
  assert.deepEqual(va2ReleasableLength('مرحبا يا صاحبي <note: x', english), { length: 0 }, 'a boundary inside an unclosed < is held');
  assert.deepEqual(va2ReleasableLength('مرحبا يا صاحبي <think> خطة', english), { withheld: 'INTERNAL_CONTAINER' });
  const arabic = guidanceSentences('تكلم بجمل قصيرة، واضحة، يمكن للمستمع أن يتابعها دون أن يرى أي نص مكتوب أمامه.');
  assert.equal(arabic.length, 1);
  assert.deepEqual(va2ReleasableLength('تكلم بجمل قصيرة، واضحة،', arabic), { length: 0 }, 'a guidance-echo prefix stays withheld at its commas');
  assert.deepEqual(va2ReleasableLength(arabic[0], arabic), { withheld: 'GUIDANCE_ECHO' });
});

function timedStream(deltas, gapMs) {
  const encoder = new TextEncoder();
  let i = 0;
  return new Response(new ReadableStream({
    async pull(controller) {
      await new Promise((resolve) => setTimeout(resolve, gapMs));
      if (i < deltas.length) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: deltas[i++] } }] })}\n\n`));
      else { controller.enqueue(encoder.encode('data: [DONE]\n\n')); controller.close(); }
    },
  }));
}

test('R1-1: G is measured at the first VA-2 release, never at the first punctuation mark', async () => {
  const held = await measureStream(timedStream(['مرحبا يا صاحبي ', '<note: ', 'x> تمام', '، كمل'], 40), performance.now());
  assert.ok(held.firstBoundaryApproxMs !== null && held.firstReleasableChunkMs !== null);
  assert.ok(held.firstReleasableChunkMs - held.firstBoundaryApproxMs >= 25, 'the first mark (inside an unclosed <) is not the release');
  const withheld = await measureStream(timedStream(['مرحبا يا صاحبي ', '<think>', ' خطة.'], 5), performance.now());
  assert.ok(withheld.firstBoundaryApproxMs !== null, 'a mark was seen');
  assert.equal(withheld.firstReleasableChunkMs, null, 'but nothing is releasable: no speed is reported for a withheld stream');
  assert.equal(withheld.withheldReason, 'INTERNAL_CONTAINER');
  const short = await measureStream(timedStream(['أيوه'], 5), performance.now());
  assert.equal(short.releasedAtEnd, true, 'a reply with no boundary is released whole at its end, after the whole-candidate checks');
});

test('R1-1: at the end of a stream, text VA-2 still holds is never counted as released', async () => {
  const unclosed = await measureStream(timedStream(['أيوه طبعا ', '<note'], 5), performance.now());
  assert.equal(unclosed.firstReleasableChunkMs, null, 'an unclosed < at the end releases nothing');
  assert.equal(unclosed.releasedAtEnd, false);
  assert.equal(unclosed.heldAtEnd, 'UNCLOSED_TAG');
  const serverGuidance = 'تكلم بجمل قصيرة، واضحة، يمكن للمستمع أن يتابعها دون أن يرى أي نص مكتوب أمامه.';
  const echo = await measureStream(timedStream(['تكلم بجمل', ' قصيرة'], 5), performance.now(), { serverGuidance });
  assert.equal(echo.firstReleasableChunkMs, null, 'a text held by the GUIDANCE_ECHO holdback at the end releases nothing');
  assert.equal(echo.releasedAtEnd, false);
  assert.equal(echo.heldAtEnd, 'GUIDANCE_ECHO_HOLDBACK');
  assert.equal(echo.withheldReason, null, 'held, not failed: the prefix is below the 48-character echo');
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
  assert.ok(report.deepseekStream.firstReleasableChunkP50Ms >= report.deepseekStream.firstTokenP50Ms, 'G from the VA-2 release');
  assert.equal(report.deepseekStream.firstBoundaryApproxIsDiagnosticOnly, true);
  assert.equal(report.budget.kind, 'PLANNING_BUDGET');
  assert.equal(report.budget.verdict, 'NOT_MEASURED', 'the device stage N is never simulated into a pass');
  assert.equal(report.endToEnd.verdict, 'NOT_MEASURED', 'p50 / p95 are proven on the device only');
});
