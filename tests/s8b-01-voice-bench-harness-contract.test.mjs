import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { corpusRates, errorRates, normalizeArabic } from '../scripts/s8b-01/arabic-text-metrics.mjs';
import { composeBudget, endToEndVerdict, percentile } from '../scripts/s8b-01/latency-model.mjs';
import { GUIDANCE_ECHO_MIN_LENGTH, INTERNAL_CONTAINERS, guidanceSentences, measureStream, va2ReleasableLength } from '../scripts/s8b-01/stream-first-token.mjs';
import { checkPlan, sha256Normalized } from '../scripts/s8b-01/bench-launch.mjs';
import { audioParts, checkGcpPlan, gcpEndpoint, gcpRequestBody, gcpUsd, gcpWorstUsd, parseSse } from '../scripts/s8b-01/gcp-paygo.mjs';
import { callCeilingUsd, checkCloudPlan, cloudCalls, cloudCost, estimateDurationMs, gcpStream } from '../scripts/s8b-01/cp2-cloud.mjs';
import { buildWork, countBy, loadCorpora, reviewWork } from '../scripts/s8b-01/cp2-worklist.mjs';
import { COMBOS, SECTIONS, grid, parseCloudSamples, styleRatios, summarizeCloud } from '../scripts/s8b-01/cp2-cloud-listen.mjs';
import { deepseekActualUsd, deepseekPeak, deepseekWorstUsd, geminiActualUsd, geminiRequestBody, geminiWorstUsd, playbackStalls, readingAnnotated, renderItem, wavFile, worstAudioSeconds }
  from '../scripts/s8b-01/cp2-providers.mjs';

// S8B-01 CP1 — the non-production voice benchmark harness (scripts/s8b-01/). This contract proves, at zero cost and with
// nothing sent off the machine, that the preregistered plan is intact, that the scoring is the preregistered one, that the
// CP1 lock refuses every live run, and that the whole path runs end to end against simulated providers.
// CP2 (the Product Owner's CP2 order, 2026-10-28) lifts the lock for ONE recorded run only; the contract proves, still with
// nothing sent, the guard's live rules (the approval bound to the plan hash, allowed hosts, one request per reservation,
// bucket budgets and the cap), the cost formulas, the RENDERED arm, the request shape and the WAV / stall helpers.

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = join(root, 'scripts', 's8b-01');
const plan = JSON.parse(readFileSync(join(dir, 'bench-plan.json'), 'utf8'));
const launch = (args, env = {}) => spawnSync(process.execPath, [join(dir, 'bench-launch.mjs'), ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });

test('the preregistered plan is intact: corpus hashes, the USD 10 cap and its split, no retry, the D-6 target', () => {
  assert.deepEqual(checkPlan(plan), []);
  assert.equal(plan.guard.costCapUsd, 10);
  // CP2: the lock is lifted by the Product Owner's CP2 order for the ONE run recorded in cp2-approval.json (proven below).
  assert.equal(plan.guard.authorized, true, 'CP2 lifts the CP1 lock for one approved run');
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

test('the CP1 lock still refuses a live run before anything is sent, in the guard (a locked plan copy)', () => {
  // CP2 lifted the lock on the real plan; the lock itself is proven on a copy whose plan keeps it (guardMirror, below).
  const guarded = underGuard(guardMirror({ authorized: false }), '');
  assert.notEqual(guarded.status, 0);
  assert.match(guarded.stderr, /not authorized for a live run \(CP1 lock\); nothing was sent/u);
  const unapproved = spawnSync(process.execPath, ['--require', join(dir, 'spend-guard.cjs'), '-e', ''], { encoding: 'utf8', env: { ...process.env, QANDEEL_S8B_MODE: 'live', QANDEEL_S8B_RUN_ID: 'not-the-run' } });
  assert.notEqual(unapproved.status, 0, 'the real guard refuses any run that is not the approved one');
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

// ── CP2 (the Product Owner's CP2 order, 2026-10-28) ───────────────────────────────────────────────────────────────────

/** A throwaway copy of the guard with its own plan and approval, so the live-mode rules are proven without a provider. */
function guardMirror({ authorized = true, approval = 'APPROVED', planEdit = (p) => p, hosts = { TEST: 'provider.test' } } = {}) {
  const m = mkdtempSync(join(tmpdir(), 's8b01-guard-'));
  const p = planEdit({ ...structuredClone(plan), guard: { ...structuredClone(plan.guard), authorized, allowedHosts: hosts } });
  const text = JSON.stringify(p, null, 2);
  writeFileSync(join(m, 'bench-plan.json'), text);
  copyFileSync(join(dir, 'spend-guard.cjs'), join(m, 'spend-guard.cjs'));
  const sha = createHash('sha256').update(text).digest('hex');
  if (approval) writeFileSync(join(m, 'cp2-approval.json'), JSON.stringify({ status: approval, runId: 'r-test', capUsd: 10, planSha256: sha }));
  return m;
}
const underGuard = (m, script, env = {}) => spawnSync(process.execPath, ['--require', join(m, 'spend-guard.cjs'), '--input-type=commonjs', '-e', `(async () => { ${script} })()`],
  { encoding: 'utf8', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, QANDEEL_S8B_MODE: 'live', QANDEEL_S8B_RUN_ID: 'r-test', ...env } });

test('CP2: the recorded approval names this exact plan, the USD 10 cap and one run; the plan carries only the approved hosts and keys', () => {
  const approval = JSON.parse(readFileSync(join(dir, 'cp2-approval.json'), 'utf8'));
  assert.equal(approval.planSha256, sha256Normalized(join(dir, 'bench-plan.json')), 'the approval is bound to this plan');
  assert.equal(approval.capUsd, 10);
  assert.ok(['APPROVED', 'CONSUMED'].includes(approval.status));
  assert.deepEqual(Object.values(plan.guard.allowedHosts).sort(), ['api.deepseek.com', 'generativelanguage.googleapis.com']);
  assert.deepEqual(plan.guard.liveKeys.sort(), ['DEEPSEEK_API_KEY', 'GEMINI_API_KEY']);
  assert.deepEqual(plan.tts.cp2.models.map((m) => m.id), ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']);
  assert.equal(plan.tts.cp2.api.store, false, 'stateless interactions: nothing stored for later retrieval');
  assert.match(plan.asr.cp2.status, /^NOT RUN — MISSING PREREQUISITE/u, 'ASR is not run, and synthesized speech is never its evidence');
});

test('CP2: the guard refuses a live run whose plan is locked, unapproved, consumed, changed, or not the approved run', () => {
  for (const [m, env, why] of [
    [guardMirror({ authorized: false }), {}, /CP1 lock/u],
    [guardMirror({ approval: null }), {}, /no unconsumed Product Owner approval/u],
    [guardMirror({ approval: 'CONSUMED' }), {}, /no unconsumed Product Owner approval/u],
    [guardMirror(), { QANDEEL_S8B_RUN_ID: 'another-run' }, /not the approved run/u],
  ]) {
    const r = underGuard(m, '', env);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, why);
  }
  const changed = guardMirror();
  writeFileSync(join(changed, 'bench-plan.json'), readFileSync(join(changed, 'bench-plan.json'), 'utf8').replace('"costCapUsd": 10', '"costCapUsd": 9'));
  assert.match(underGuard(changed, '').stderr, /differs from the approved plan hash/u);
});

test('CP2: live mode admits only an allowed host, only over https, only with a reservation, one request per reservation', () => {
  const r = underGuard(guardMirror(), `
    const g = globalThis.__QANDEEL_S8B_01_GUARD__; const out = [];
    const tryFetch = async (u) => { try { await fetch(u); return 'SENT'; } catch (e) { return e.code ?? e.cause?.code ?? e.message; } };
    out.push(await tryFetch('https://example.com/'));
    out.push(await tryFetch('https://provider.test/x'));
    g.reserve('tts', 0.01);
    out.push(await tryFetch('http://provider.test/x'));
    out.push(await tryFetch('https://provider.test/x'));
    out.push(await tryFetch('https://provider.test/x'));
    console.log(JSON.stringify(out));`);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout.trim());
  assert.equal(out[0], 'S8B_01_NETWORK_FORBIDDEN', 'a host outside the plan');
  assert.equal(out[1], 'S8B_01_NETWORK_FORBIDDEN', 'an allowed host without a reservation');
  assert.equal(out[2], 'S8B_01_NETWORK_FORBIDDEN', 'plain http');
  assert.notEqual(out[3], 'S8B_01_NETWORK_FORBIDDEN', 'admitted (the reserved .test host never resolves, so nothing is sent anywhere)');
  assert.equal(out[4], 'S8B_01_NETWORK_FORBIDDEN', 'the reservation admitted one request: no retry without a new one');
});

test('CP2: a reservation that would pass a bucket budget or the cap is refused, and the spend state is written', () => {
  const m = guardMirror();
  const state = join(m, 'spend-state.json');
  const r = underGuard(m, `
    const g = globalThis.__QANDEEL_S8B_01_GUARD__; const out = [];
    const id = g.reserve('tts', 4.0); g.settle(id, 4.0);
    try { g.reserve('tts', 0.6); out.push('RESERVED'); } catch (e) { out.push(e.code); }
    const id2 = g.reserve('tts', 0.4); const o = g.settle(id2, 0.45); out.push(o.overrun);
    try { g.reserve('nope', 0); } catch (e) { out.push(e.message); }
    console.log(JSON.stringify({ out, spend: g.spend() }));`, { QANDEEL_S8B_STATE_FILE: state });
  assert.equal(r.status, 0, r.stderr);
  const { out, spend } = JSON.parse(r.stdout.trim());
  assert.equal(out[0], 'S8B_01_BUDGET_REFUSED', 'tts budget is USD 4.5');
  assert.equal(out[1], true, 'a measured cost above its worst case is charged in full and flagged');
  assert.match(out[2], /unknown bucket/u);
  assert.ok(Math.abs(spend.settledUsd - 4.45) < 1e-9);
  assert.equal(JSON.parse(readFileSync(state, 'utf8')).settledUsd, spend.settledUsd);
});

test('CP2: the launcher refuses --live without the explicit run confirmation, before anything is sent', () => {
  const r = launch(['--live']);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /Nothing was sent\./u);
});

test('CP2: Gemini and DeepSeek costs: worst cases bound the call, usage settles it, off-peak DeepSeek is half', () => {
  const flash = plan.tts.cp2.models[0];
  const lite = plan.tts.cp2.models[1];
  const body = geminiRequestBody(flash.id, 'Achird', 'تمام، فاهمك.', null);
  assert.ok(geminiWorstUsd(flash, body, 'تمام، فاهمك.') > geminiWorstUsd(lite, body, 'تمام، فاهمك.'));
  assert.equal(worstAudioSeconds('1234'), 11);
  const fromUsage = geminiActualUsd(flash, { total_input_tokens: 20, total_output_tokens: 250 }, 10, 300);
  assert.equal(fromUsage.source, 'usage');
  assert.ok(Math.abs(fromUsage.usd - (20 * 0.5 + 250 * 9) / 1e6) < 1e-15);
  const fromAudio = geminiActualUsd(lite, null, 10, 300);
  assert.equal(fromAudio.source, 'audio-duration');
  assert.ok(Math.abs(fromAudio.usd - (300 * 0.5 + 250 * 6) / 1e6) < 1e-15, '10 s of audio = 250 tokens; every request byte as a token');
  const peak = plan.deepseekStream.cp2.usdPerMillion.peak;
  const usage = { prompt_cache_hit_tokens: 100, prompt_cache_miss_tokens: 200, completion_tokens: 50 };
  assert.ok(Math.abs(deepseekActualUsd(peak, usage, true) - 2 * deepseekActualUsd(peak, usage, false)) < 1e-15);
  assert.equal(deepseekPeak(new Date('2026-10-28T07:00:00Z')), true, 'Wednesday 07:00 UTC');
  assert.equal(deepseekPeak(new Date('2026-10-28T05:00:00Z')), false);
  assert.equal(deepseekPeak(new Date('2026-10-31T07:00:00Z')), false, 'Saturday');
  assert.ok(deepseekWorstUsd(peak, '{}', 160) >= (160 * peak.output) / 1e6);
});

test('CP2: the Gemini request carries the text verbatim, a style only in speech_metadata, stream on and store off', () => {
  const b = JSON.parse(geminiRequestBody('gemini-3.8-flash-tts', 'Sulafat', 'بجد؟ ده خبر حلو!', 'happy'));
  assert.equal(b.input[0].type, 'user_input');
  assert.deepEqual(b.input[0].content[0], { type: 'text', text: 'بجد؟ ده خبر حلو!', annotations: [{ type: 'speech_metadata', style: 'happy' }] });
  assert.deepEqual(b.generation_config, { speech_config: [{ voice: 'Sulafat' }] });
  assert.equal(b.stream, true);
  assert.equal(b.store, false);
  assert.equal(JSON.parse(geminiRequestBody('m', 'v', 'x', null)).input[0].content[0].annotations, undefined, 'no style, no annotation');
});

test('CP2: the RENDERED arm changes the target only, from the corpus expected reading', () => {
  const set = JSON.parse(readFileSync(join(dir, 'corpus', 'tts-pronunciation-set.json'), 'utf8'));
  const by = Object.fromEntries([...set.homographs, ...set.names, ...set.numbers, ...set.replies].map((i) => [i.id, i]));
  assert.equal(renderItem(by.H01), 'رفعوا العَلَم فوق المدرسة صباح اليوم.');
  assert.equal(renderItem(by.N01), 'اتصلت بك هَدِير مساء أمس.');
  assert.equal(renderItem(by.D01), 'الموعد في الساعة السابعة والنصف مساءً.');
  assert.equal(renderItem(by.D02), 'دفعت ألفين وخمسمية جنيه.');
  assert.equal(renderItem(by.D03), 'ولد في الخامس عشر من مارس عام ألف وتسعمئة وتسعين.');
  assert.equal(renderItem(by.D04), 'ارتفع السعر بنسبة خمسة وعشرين في المئة.');
  assert.equal(renderItem(by.D05), 'فاضل تلات أيام على الامتحان.');
  assert.equal(renderItem(by.D07), 'المسافة ثلاثة كيلومترات ونصف.');
  assert.equal(renderItem(by.R01), by.R01.text, 'no target, no change');
});

test('CP2 run r1 defect: a rater gloss or a Latin / IPA reading is never sent as speech text', () => {
  const set = JSON.parse(readFileSync(join(dir, 'corpus', 'tts-pronunciation-set.json'), 'utf8'));
  const all = [...set.homographs, ...set.names, ...set.numbers, ...set.dialect_sentences, ...set.code_switch, ...set.replies];
  const by = Object.fromEntries(all.map((i) => [i.id, i]));
  assert.equal(renderItem(by.H27), 'جِدّي عنده تمانين سنة وصحته كويسة.', 'the gloss is stripped');
  assert.equal(renderItem(by.H28), 'الموضوع ده جَدّ مش هزار.');
  assert.equal(renderItem(by.N04), by.N04.text, 'an IPA reading has no Arabic-script form: not rendered');
  assert.equal(renderItem(by.N05), by.N05.text);
  assert.equal(renderItem(by.N06), by.N06.text, 'a Latin brand spelling is not rendered');
  for (const i of all) {
    const added = renderItem(i).replace(/[A-Za-z]+/gu, (w) => (i.text.includes(w) ? '' : w));
    assert.ok(!readingAnnotated(added), `${i.id}: no annotation reaches the speech text`);
  }
  assert.deepEqual(all.filter((i) => i.target && readingAnnotated(i.expected)).map((i) => i.id), ['H27', 'H28', 'H30', 'N04', 'N05', 'N06'],
    'the six items whose r1 RENDERED samples are excluded as invalid');
});

test('CP2: WAV files are valid mono 16-bit PCM, and playback stalls are counted against real time', () => {
  const w = wavFile(Buffer.alloc(48000), 24000);
  assert.equal(w.toString('ascii', 0, 4), 'RIFF');
  assert.equal(w.readUInt32LE(24), 24000);
  assert.equal(w.readUInt16LE(34), 16);
  assert.equal(w.readUInt32LE(40), 48000);
  // three 100 ms chunks arriving at 0, 100 and 350 ms: with no buffer, the third is 150 ms late.
  assert.deepEqual(playbackStalls([[0, 100], [100, 100], [350, 100]], 0), { stallMs: 150, stalls: 1 });
  assert.deepEqual(playbackStalls([[0, 100], [100, 100], [350, 100]], 200), { stallMs: 0, stalls: 0 });
});

// ── CP2 Google Cloud PayGo check (the Product Owner's order, 2026-10-28) ──────────────────────────────────────────────
const gcpPlan = JSON.parse(readFileSync(join(dir, 'gcp-paygo-plan.json'), 'utf8'));

/** A throwaway copy of the guard with a gcp-paygo plan and approval (host provider.test, so nothing is ever sent). */
function gcpMirror(approval = 'APPROVED') {
  const m = mkdtempSync(join(tmpdir(), 's8b01-gcp-'));
  const text = JSON.stringify({ ...structuredClone(gcpPlan), guard: { ...structuredClone(gcpPlan.guard), allowedHosts: { TEST: 'provider.test' } } }, null, 2);
  writeFileSync(join(m, 'gcp-paygo-plan.json'), text);
  writeFileSync(join(m, 'bench-plan.json'), JSON.stringify(plan));
  copyFileSync(join(dir, 'spend-guard.cjs'), join(m, 'spend-guard.cjs'));
  writeFileSync(join(m, 'gcp-paygo-approval.json'), JSON.stringify({ status: approval, runId: 'r-gcp', capUsd: 0.25, planSha256: createHash('sha256').update(text).digest('hex') }));
  return m;
}

test('gcp-paygo: the plan is two calls, USD 0.25, the Google Cloud host and the ADC token only; its approval is not CP2\'s', () => {
  assert.deepEqual(checkGcpPlan(gcpPlan), []);
  assert.equal(gcpPlan.project, 'gen-lang-client-0473671267');
  assert.deepEqual(gcpPlan.models.map((m) => m.id), ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']);
  const approval = JSON.parse(readFileSync(join(dir, 'gcp-paygo-approval.json'), 'utf8'));
  assert.ok(['PENDING', 'APPROVED', 'CONSUMED'].includes(approval.status));
  if (approval.status !== 'PENDING') assert.equal(approval.planSha256, sha256Normalized(join(dir, 'gcp-paygo-plan.json')), 'an approval is bound to this plan');
  assert.equal(JSON.parse(readFileSync(join(dir, 'cp2-approval.json'), 'utf8')).status, 'CONSUMED', 'the CP2 approval stays consumed');
  const corpora = ['tts-pronunciation-set.json', 'tts-expression-set.json'].map((f) => readFileSync(join(dir, 'corpus', f), 'utf8'));
  assert.ok(corpora.every((c) => !c.includes(gcpPlan.text)), 'an invented sentence, not a CP2 sample');
  const total = gcpPlan.models.reduce((a, m) => a + gcpWorstUsd(m, gcpRequestBody(gcpPlan.text, gcpPlan.voice), gcpPlan.text), 0);
  assert.ok(total < gcpPlan.guard.costCapUsd, 'both worst cases, at the list price, fit the cap');
  const tampered = structuredClone(gcpPlan);
  tampered.guard.costCapUsd = 1; tampered.guard.budgetUsd.tts = 1; tampered.guard.allowedHosts.X = 'generativelanguage.googleapis.com';
  assert.equal(checkGcpPlan(tampered).length, 2);
});

test('gcp-paygo: the guard refuses an unknown check and an unapproved or consumed check, and keeps the token only when approved', () => {
  const unknown = underGuard(gcpMirror(), '', { QANDEEL_S8B_CHECK: 'anything' });
  assert.match(unknown.stderr, /unknown check/u);
  for (const status of ['PENDING', 'CONSUMED']) {
    const r = underGuard(gcpMirror(status), '', { QANDEEL_S8B_CHECK: 'gcp-paygo', QANDEEL_S8B_RUN_ID: 'r-gcp' });
    assert.match(r.stderr, /no unconsumed Product Owner approval/u, status);
  }
  const ok = underGuard(gcpMirror(), `
    const g = globalThis.__QANDEEL_S8B_01_GUARD__; const out = { check: g.check, token: Boolean(process.env.GOOGLE_CLOUD_ACCESS_TOKEN), gemini: Boolean(process.env.GEMINI_API_KEY) };
    try { g.reserve('tts', 0.3); out.over = 'RESERVED'; } catch (e) { out.over = e.code; }
    try { await fetch('https://generativelanguage.googleapis.com/'); out.studio = 'SENT'; } catch (e) { out.studio = e.code; }
    console.log(JSON.stringify(out));`, { QANDEEL_S8B_CHECK: 'gcp-paygo', QANDEEL_S8B_RUN_ID: 'r-gcp', GOOGLE_CLOUD_ACCESS_TOKEN: 'x'.repeat(30), GEMINI_API_KEY: 'y'.repeat(30) });
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(JSON.parse(ok.stdout.trim()), { check: 'gcp-paygo', token: true, gemini: false, over: 'S8B_01_BUDGET_REFUSED', studio: 'S8B_01_NETWORK_FORBIDDEN' });
  const simulate = underGuard(gcpMirror(), 'console.log(Boolean(process.env.GOOGLE_CLOUD_ACCESS_TOKEN));', { QANDEEL_S8B_MODE: 'simulate', GOOGLE_CLOUD_ACCESS_TOKEN: 'x'.repeat(30) });
  assert.equal(simulate.stdout.trim(), 'false', 'outside an approved live check the token is scrubbed');
});

test('gcp-paygo: the launcher refuses --live without an approval and confirmation, before anything is sent', () => {
  const r = spawnSync(process.execPath, [join(dir, 'gcp-paygo.mjs'), '--live'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /Nothing was sent\./u);
});

test('gcp-paygo: the documented request, the SSE stream parser, the audio parts and the cost', () => {
  assert.equal(gcpEndpoint(gcpPlan, 'gemini-3.8-flash-tts'),
    'https://aiplatform.googleapis.com/v1/projects/gen-lang-client-0473671267/locations/global/publishers/google/models/gemini-3.8-flash-tts:streamGenerateContent?alt=sse');
  assert.deepEqual(JSON.parse(gcpRequestBody('أهلًا', 'Achird')), {
    contents: [{ role: 'user', parts: [{ text: 'أهلًا' }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice: 'Achird' } } } });
  const pcm = Buffer.alloc(4800).toString('base64');
  const ev = (o) => `data: ${JSON.stringify(o)}\r\n\r\n`;
  const stream = ev({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm } }] } }] })
    + ev({ candidates: [{ content: { parts: [] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 100 } }) + 'data: {"partial"';
  const { events, rest } = parseSse(stream);
  assert.equal(events.length, 2);
  assert.equal(rest, 'data: {"partial"', 'an incomplete event waits for the next chunk');
  const [a] = audioParts(events[0]);
  assert.equal(a.sampleRate, 24000);
  assert.equal(a.pcm.length, 4800, '0.1 s of 16-bit mono at 24 kHz');
  assert.equal(audioParts(events[1]).length, 0);
  const [flash, lite] = gcpPlan.models;
  assert.ok(Math.abs(gcpUsd(flash.listUsdPerMillion, events[1].usageMetadata) - (12 * 1 + 100 * 18) / 1e6) < 1e-15);
  assert.ok(Math.abs(gcpUsd(lite.promotionalUsdPerMillion, events[1].usageMetadata) - (12 * 0.5 + 100 * 6) / 1e6) < 1e-15);
});

// ── CP2 full Gemini TTS evaluation on Google Cloud (the Product Owner's order, 2026-10-28) ──────────────────────────────
const cloudPlan = JSON.parse(readFileSync(join(dir, 'cp2-cloud-plan.json'), 'utf8'));
const corpora = loadCorpora(dir);
const cloudWork = buildWork(corpora);

test('cp2-cloud review: the corrected set has no defect; 148 texts, 592 calls; every model, voice and category is covered', () => {
  assert.deepEqual(reviewWork(cloudWork, corpora.setItems), []);
  assert.equal(cloudWork.length, 148, 'N04 – N06 no longer rendered (157 - 3), and the duplicate no-style request of each reply dropped (- 6)');
  const calls = cloudCalls(cloudPlan, dir);
  assert.equal(calls.length, 592);
  for (const n of Object.values(countBy(calls, (c) => `${c.model}|${c.voice}`))) assert.equal(n, 148);
  assert.deepEqual(Object.keys(countBy(calls, (c) => c.category)).sort(), ['CODE_SWITCH', 'DIALECT', 'EMOTION', 'HOMOGRAPH', 'NAME', 'NUMBER', 'REPLY']);
  for (const e of ['JOY', 'SURPRISE', 'JOKING', 'EMPATHY', 'ADVICE']) assert.equal(calls.filter((c) => c.emotion === e && c.arm === 'EMOTION').length, 8, `${e}: 2 items × 4`);
  assert.deepEqual(checkCloudPlan(cloudPlan, dir), []);
});

test('cp2-cloud review: it refuses the r1 gloss, a Latin reading, an inline tag, a style in the text or on a plain arm, and a changed word', () => {
  const swap = (id, arm, patch) => cloudWork.map((w) => (w.item === id && w.arm === arm ? { ...w, ...patch } : w));
  const cases = [
    [swap('H27', 'RENDERED', { text: 'جِدّي (جدّ = grandfather, Egyptian reading) عنده تمانين سنة وصحته كويسة.' }), /annotation mark/u],
    [swap('N06', 'BASELINE', { text: 'تعمل نور في شركة Microsoft.' }), /Latin word not in the item's text: Microsoft/u],
    [swap('X02', 'EMOTION', { text: 'الله! <laugh> أخيرًا خلصت المشروع؟ أنا فرحان لك جدًا.' }), /inline-tag bracket|differ in text/u],
    [swap('X01', 'EMOTION', { style: 'سعيد' }), /short English speechMetadata style/u],
    [swap('E01', 'BASELINE', { style: 'happy' }), /no style on this arm/u],
    [swap('H01', 'RENDERED', { text: 'رفعوا العَلَم فوق البيت صباح اليوم.' }), /more than diacritics/u],
    [swap('D02', 'RENDERED', { text: 'دفعت 2500 جنيه مصري.' }), /digit span/u],
    [[...cloudWork, { ...cloudWork.find((w) => w.item === 'R01' && w.arm === 'BASELINE'), group: 'EXPRESSION', arm: 'NO_STYLE' }], /the same request as R01 BASELINE/u],
  ];
  for (const [work, why] of cases) assert.match(reviewWork(work, corpora.setItems).join('\n'), why);
});

test('cp2-cloud order: any prefix keeps the four model × voice combinations even and every category reached early', () => {
  const calls = cloudCalls(cloudPlan, dir);
  for (const k of [10, 40, 100, 148]) for (const n of Object.values(countBy(calls.slice(0, k * 4), (c) => `${c.model}|${c.voice}`))) assert.equal(n, k);
  assert.equal(new Set(calls.slice(0, 7 * 4).map((c) => c.category)).size, 7, 'the first seven entries span the seven categories');
  const firstEmotion = calls.findIndex((c) => c.arm === 'EMOTION');
  assert.ok(firstEmotion < 100, 'emotions are reached in the first hundred calls (r1 never reached them)');
});

test('cp2-cloud: the request carries a style only in speechMetadata; the guard refuses the check unapproved; the launcher refuses', () => {
  assert.deepEqual(JSON.parse(gcpRequestBody('بجد؟', 'Sulafat', 'happy')).contents[0].parts[0], { text: 'بجد؟', speechMetadata: { style: 'happy' } });
  assert.deepEqual(JSON.parse(gcpRequestBody('بجد؟', 'Sulafat')).contents[0].parts[0], { text: 'بجد؟' });
  const m = mkdtempSync(join(tmpdir(), 's8b01-cloud-'));
  copyFileSync(join(dir, 'spend-guard.cjs'), join(m, 'spend-guard.cjs'));
  copyFileSync(join(dir, 'cp2-cloud-plan.json'), join(m, 'cp2-cloud-plan.json'));
  writeFileSync(join(m, 'cp2-cloud-approval.json'), JSON.stringify({ status: 'PENDING', runId: 'r-cloud', capUsd: 2, planSha256: null }));
  assert.match(underGuard(m, '', { QANDEEL_S8B_CHECK: 'cp2-cloud', QANDEEL_S8B_RUN_ID: 'r-cloud' }).stderr, /no unconsumed Product Owner approval/u);
  const approval = JSON.parse(readFileSync(join(dir, 'cp2-cloud-approval.json'), 'utf8'));
  if (approval.status !== 'PENDING') assert.equal(approval.planSha256, sha256Normalized(join(dir, 'cp2-cloud-plan.json')), 'an approval is bound to this plan');
  const r = spawnSync(process.execPath, [join(dir, 'cp2-cloud.mjs'), '--live'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /Nothing was sent\./u);
  const tampered = structuredClone(cloudPlan);
  tampered.guard.costCapUsd = 3; tampered.guard.budgetUsd.tts = 3; tampered.voices = ['Achird'];
  const problems = checkCloudPlan(tampered, dir).join(' | ');
  assert.match(problems, /at most the proposed USD 2/u);
  assert.match(problems, /the voices Achird and Sulafat/u);
  assert.match(problems, /exactly two models and two voices/u, 'one voice fewer is a different run');
});

test('cp2-cloud stream: first audio, usage, the audio bound and an HTTP error, measured against a loopback SSE server', async () => {
  const pcm = Buffer.alloc(24000 * 2).toString('base64'); // 1 s of audio per event
  const ev = (o) => `data: ${JSON.stringify(o)}\r\n\r\n`;
  const audio = ev({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm } }] } }] });
  const server = createServer((req, res) => {
    if (req.url === '/429') { res.writeHead(429, { 'content-type': 'application/json' }); res.end('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'); return; }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const n = req.url === '/long' ? 6 : 2;
    let i = 0;
    const tick = () => {
      if (i < n) { res.write(audio); i += 1; setTimeout(tick, 20); return; }
      res.end(ev({ usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 50 } }));
    };
    tick();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const ok = await gcpStream({ url: `${base}/ok`, body: '{}', token: 't', project: 'p', boundSeconds: 10 });
    assert.equal(ok.status, 200);
    assert.equal(ok.error, null);
    assert.equal(ok.chunks, 2);
    assert.equal(ok.audioSeconds, 2);
    assert.ok(ok.firstAudioMs !== null && ok.firstAudioMs <= ok.endMs);
    assert.deepEqual(ok.usage, { promptTokenCount: 9, candidatesTokenCount: 50 });
    const long = await gcpStream({ url: `${base}/long`, body: '{}', token: 't', project: 'p', boundSeconds: 2.5 });
    assert.equal(long.cancelledAtBound, true, 'the stream is cancelled past its audio bound');
    assert.equal(long.audioSeconds, 3);
    const refused = await gcpStream({ url: `${base}/429`, body: '{}', token: 't', project: 'p', boundSeconds: 10 });
    assert.equal(refused.status, 429);
    assert.match(refused.error, /^HTTP 429: .*RESOURCE_EXHAUSTED/u);
    assert.equal(refused.audioSeconds, 0);
  } finally {
    server.close();
  }
});

test('cp2-cloud listening: every listed entry is a real (item, arm) of the run; the grid, the summary and the style ratios', () => {
  const keys = new Set(cloudWork.map((w) => `${w.item}|${w.arm}`));
  for (const [heading, entries] of SECTIONS) for (const [item, arm] of entries) assert.ok(keys.has(`${item}|${arm}`), `${heading}: ${item} ${arm}`);
  const listed = new Set(SECTIONS.slice(1).flatMap(([, e]) => e.map(([i, a]) => `${i}|${a}`)));
  assert.deepEqual([...keys].filter((k) => !listed.has(k)), [], 'every text of the run appears in a section');
  const header = 'sample,model,voice,group,category,item,arm,dialect,emotion,status,http,first_audio_ms,end_ms,audio_s,rtf,max_gap_ms,stall_ms_200,s_per_char,list_usd,promo_usd,cost_source,error';
  const csv = [header,
    'C0001,gemini-3.8-flash-tts,Achird,EXPRESSION,EMOTION,X01,NO_STYLE,EGYPTIAN,JOY,OK,200,600,1200,4.00,0.300,40,0,0.0800,0.001800,0.000900,usage,""',
    'C0002,gemini-3.8-flash-tts,Achird,EXPRESSION,EMOTION,X01,EMOTION,EGYPTIAN,JOY,OK,200,700,1300,5.00,0.260,40,0,0.1000,0.002250,0.001125,usage,""',
    'C0003,gemini-3.8-flash-lite-tts,Sulafat,EXPRESSION,EMOTION,X01,NO_STYLE,EGYPTIAN,JOY,ERROR,429,,200,0.00,,0,0,,0.000000,0.000000,usage,"HTTP 429: x, y"'].join('\n');
  const rows = parseCloudSamples(csv);
  assert.equal(rows[2].error, 'HTTP 429: x, y', 'a comma inside the error survives');
  const s = summarizeCloud(rows);
  assert.equal(s.ok, 2); assert.equal(s.http429, 1); assert.equal(s.audioSeconds, 9);
  assert.equal(s.listUsdPerAudioMinute, Number(((0.0018 + 0.00225) / 9 * 60).toFixed(5)));
  const g = grid(rows).get('X01|NO_STYLE');
  assert.deepEqual(Object.keys(g.cells).sort(), ['gemini-3.8-flash-lite-tts|Sulafat', 'gemini-3.8-flash-tts|Achird']);
  assert.deepEqual(styleRatios(rows)['gemini-3.8-flash-tts|EMOTION'], { n: 1, p50: 1.25, min: 1.25, max: 1.25 });
  assert.equal(COMBOS.length, 4);
});

test('cp2-cloud pacing (Product Owner): ≥ 6.5 s between two calls to the same model, the models alternating, the run inside the token window', () => {
  const calls = cloudCalls(cloudPlan, dir);
  assert.equal(cloudPlan.pacing.perModelStartIntervalMs, 6500);
  for (let i = 1; i < calls.length; i += 1) assert.notEqual(calls[i].model, calls[i - 1].model, `calls ${i - 1} and ${i} are the same model`);
  // The simulated schedule never starts a model sooner than 6.5 s after its previous start, even with instant calls.
  const starts = {};
  let t = 0;
  for (const c of calls) {
    const s = Math.max(t, (starts[c.model]?.at(-1) ?? -Infinity) + 6500);
    (starts[c.model] ??= []).push(s);
    t = s;
  }
  for (const xs of Object.values(starts)) for (let i = 1; i < xs.length; i += 1) assert.ok(xs[i] - xs[i - 1] >= 6500);
  const ms = estimateDurationMs(calls, cloudPlan);
  assert.ok(ms > 30 * 60000 && ms < 0.8 * cloudPlan.stopRules.tokenWindowMs, `${(ms / 60000).toFixed(1)} min`);
  const faster = structuredClone(cloudPlan);
  faster.pacing.perModelStartIntervalMs = 5000;
  assert.match(checkCloudPlan(faster, dir).join(' | '), /at least 6\.5 s/u);
});

test('cp2-cloud cap: each call reserves the most Google can bill for it, so the guard stops before USD 2 even if every call were billed in full', () => {
  const calls = cloudCalls(cloudPlan, dir);
  const flash = cloudPlan.models[0];
  const body = gcpRequestBody(calls[0].text, calls[0].voice, calls[0].style);
  assert.equal(callCeilingUsd(flash, body), (Buffer.byteLength(body) * 1 + 16384 * 18) / 1e6, 'request bytes + the maximum output, list price');
  const ceilings = calls.map((c) => callCeilingUsd(cloudPlan.models.find((m) => m.id === c.model), gcpRequestBody(c.text, c.voice, c.style)));
  const m = mkdtempSync(join(tmpdir(), 's8b01-cap-'));
  const text = readFileSync(join(dir, 'cp2-cloud-plan.json'), 'utf8').replace(/\r\n/gu, '\n');
  writeFileSync(join(m, 'cp2-cloud-plan.json'), text);
  copyFileSync(join(dir, 'spend-guard.cjs'), join(m, 'spend-guard.cjs'));
  writeFileSync(join(m, 'cp2-cloud-approval.json'), JSON.stringify({ status: 'APPROVED', runId: 'r-cap', capUsd: 2, planSha256: createHash('sha256').update(text).digest('hex') }));
  const r = underGuard(m, `
    const g = globalThis.__QANDEEL_S8B_01_GUARD__; const ceilings = ${JSON.stringify(ceilings)}; let admitted = 0;
    for (const c of ceilings) { try { const id = g.reserve('tts', c); g.settle(id, c); admitted += 1; } catch (e) { if (e.code !== 'S8B_01_BUDGET_REFUSED') throw e; break; } }
    console.log(JSON.stringify({ admitted, spend: g.spend() }));`, { QANDEEL_S8B_CHECK: 'cp2-cloud', QANDEEL_S8B_RUN_ID: 'r-cap' });
  assert.equal(r.status, 0, r.stderr);
  const { admitted, spend } = JSON.parse(r.stdout.trim());
  assert.ok(spend.settledUsd <= 2, `every call billed at its ceiling stops at USD ${spend.settledUsd}`);
  assert.ok(admitted < calls.length && spend.refused === 1 && spend.overruns === 0);
  assert.ok(cloudCost(cloudPlan, calls).expectedListUsd < 2 - Math.max(...ceilings), 'the expected spend leaves the whole run admissible');
});

// CP2 completion (the Product Owner's ASR & Replay order, 2026-10-28): the ASR recording kit and the Replay render spike.
const { loadRecordingScript, poLines, sessionLines, fileName, referenceOf } = await import('../scripts/s8b-01/asr-recording-sheet.mjs');
const spike = await import('../scripts/s8b-01/replay-render-spike.mjs');

test('ASR recording kit: Egyptian first, MSA second, every line Arabic and named, references without fillers, the pinned prompts reused unchanged', () => {
  const data = loadRecordingScript(dir);
  const lines = sessionLines(data);
  assert.equal(lines.length, 130);
  assert.equal(lines.findIndex((l) => l.dialect === 'MSA'), lines.filter((l) => l.dialect === 'EGYPTIAN').length, 'all Egyptian lines come first');
  const names = lines.map((l) => fileName('S1', l));
  assert.equal(new Set(names).size, names.length, 'one file per line');
  for (const n of names) assert.match(n, /^S1_(EG|MSA)-[A-Z]+-?\d{2}_(QUIET|SPEAKER|NOISE|OVERLAP)$/u);
  for (const item of data.script.items) {
    assert.match(item.text, /[\u0600-\u06ff]/u);
    for (const word of Object.keys(item.alternatives ?? {})) assert.ok(item.text.includes(word), `${item.id}: ${word}`);
    for (const c of item.conditions) assert.ok(data.script.conditions.some((x) => x.id === c), `${item.id}: ${c}`);
  }
  const df = lines.find((l) => l.id === 'EG-DF-03');
  assert.equal(referenceOf(data.script, df), 'مش عارف، بس حاسس إن الموضوع ده مضايقني.', 'the filler and the hesitation dots are not scored');
  assert.equal(referenceOf(data.script, lines.find((l) => l.category === 'SPONTANEOUS')), null, 'a spontaneous answer is scored against the speaker\'s own transcript');
  assert.deepEqual(checkPlan(plan), [], 'asr-reading-prompts.json is reused, not edited: the CP1 corpus hashes hold');
  assert.match(plan.asr.cp2.status, /^NOT RUN — MISSING PREREQUISITE/u, 'no ASR run without recordings and an approved spend plan');
});

test('Replay spike timeline: one clock, a cut reply keeps only its played part, the barge-in overlaps it, a gap stays a gap', () => {
  const durations = { C0013: 3000, C0177: 8000, C0069: 2000, C0345: 6000, C0125: 4000, C0201: 5000 };
  const t = spike.buildTimeline(spike.SCRIPT, durations);
  const cut = t.units.find((u) => u.interrupted);
  assert.equal(cut.endMs - cut.startMs, 3300, '55 % of the reply was confirmed played; the remainder is never placed');
  const barge = t.units[t.units.indexOf(cut) + 1];
  assert.equal(barge.track, 'USER');
  assert.equal(cut.endMs - barge.startMs, 300, 'the user started 300 ms before the playout stopped');
  const gap = t.units.find((u) => u.kind === 'GAP');
  assert.equal(gap.endMs - gap.startMs, 1500);
  assert.equal(t.beeps.length, 2);
  const audio = Object.fromEntries(Object.entries(durations).map(([k, ms]) => [k, new Int16Array((ms / 1000) * spike.RATE).fill(1000)]));
  const q = spike.trackPcm(t, 'QANDEEL', audio);
  const at = (ms) => q[Math.round((ms / 1000) * spike.RATE)];
  assert.equal(at(cut.startMs + 10), 1000);
  assert.equal(at(cut.endMs + 10), 0, 'nothing after the confirmed playout position');
  assert.equal(at(gap.startMs + 700), 0, 'the gap is silence, not stitched');
  assert.deepEqual(spike.findBeeps(q, spike.RATE).map(Math.round).filter((ms) => t.beeps.some((b) => Math.abs(b - ms) < 20)).length, 2);
});

test('Replay spike checks: beep and flash detection, faststart, the benchmark line, caption wrapping', () => {
  const rate = 24000;
  const pcm = new Int16Array(rate * 3);
  for (const s of [0.5, 2.25]) for (let i = 0; i < 0.2 * rate; i += 1) pcm[Math.round(s * rate) + i] = Math.round(8000 * Math.sin((2 * Math.PI * 1000 * i) / rate));
  assert.deepEqual(spike.findBeeps(pcm, rate).map((ms) => Math.round(ms / 10)), [50, 225]);
  const lumas = Buffer.alloc(90, 20);
  lumas.fill(255, 15, 21);
  lumas.fill(255, 67, 73);
  assert.deepEqual(spike.findFlashes(lumas, 30).map(Math.round), [500, 2233]);
  const box = (type, size = 16) => { const b = Buffer.alloc(size); b.writeUInt32BE(size, 0); b.write(type, 4, 'ascii'); return b; };
  assert.equal(spike.moovBeforeMdat(Buffer.concat([box('ftyp'), box('moov'), box('mdat')])), true);
  assert.equal(spike.moovBeforeMdat(Buffer.concat([box('ftyp'), box('mdat'), box('moov')])), false);
  assert.deepEqual(spike.parseBenchmark('x\nbench: utime=1.250s stime=0.100s rtime=0.900s\nbench: maxrss=123456KiB\n'), { utimeS: 1.25, stimeS: 0.1, rtimeS: 0.9, maxRssKiB: 123456 });
  for (const line of spike.wrapCaption('فاهمك. أول خطوة ممكن تكون إنك تكلم أبوك في وقت هادي، من غير ما تحط كل حاجة مرة واحدة.').split('\n')) assert.ok(line.length <= 26);
});

// The Product Owner's Speechmatics order (2026-10-28): the real-time ASR harness, proven against a loopback server only.
const asr = await import('../scripts/s8b-01/asr-sm.mjs');
const { summarizeAsr, verdict } = await import('../scripts/s8b-01/asr-sm-summary.mjs');
const asrPlan = JSON.parse(readFileSync(join(dir, 'asr-sm-plan.json'), 'utf8'));

// A minimal RFC 6455 server (text frames out; masked text / binary frames in), so the contract needs no WebSocket package.
function miniWsServer(onClient) {
  const server = createServer();
  server.on('upgrade', (req, socket) => {
    const accept = createHash('sha1').update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const send = (obj) => {
      const p = Buffer.from(JSON.stringify(obj));
      const h = p.length < 126 ? Buffer.from([0x81, p.length]) : Buffer.from([0x81, 126, p.length >> 8, p.length & 255]);
      socket.write(Buffer.concat([h, p]));
    };
    const client = { headers: req.headers, send, close: () => { socket.write(Buffer.from([0x88, 2, 0x03, 0xe8])); socket.end(); } };
    let buf = Buffer.alloc(0);
    socket.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      for (;;) {
        if (buf.length < 2) return;
        const op = buf[0] & 15;
        let len = buf[1] & 127;
        let off = 2;
        if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (buf.length < off + 4 + len) return;
        const mask = buf.subarray(off, off + 4);
        const payload = Buffer.from(buf.subarray(off + 4, off + 4 + len)).map((b, i) => b ^ mask[i % 4]);
        buf = buf.subarray(off + 4 + len);
        if (op === 8) { socket.end(); return; }
        onClient(client, op === 1 ? JSON.parse(payload.toString('utf8')) : null, op === 2 ? payload.length : 0);
      }
    });
    socket.on('error', () => {});
  });
  return server;
}

test('asr-sm plan: Speechmatics Enhanced ar_en only, EU real-time, model training off, the Product Owner\'s 20 recordings, a preliminary single-speaker test inside USD 0.25', () => {
  assert.deepEqual(asr.checkAsrPlan(asrPlan, dir), []);
  assert.equal(asrPlan.set.sessions, 20);
  assert.match(asrPlan.supersedes, /e6b233b62675ca18009cc14ddef693afee1478bc14f2e92d188b8286e44379be.*never approved and never run/u);
  const approval = JSON.parse(readFileSync(join(dir, 'asr-sm-approval.json'), 'utf8'));
  assert.ok(['PENDING', 'APPROVED', 'CONSUMED'].includes(approval.status));
  assert.equal(approval.runId, 's8b01-cp2-asr-sm-po-r1', 'a new run id: the version 1 approval record is not reused');
  if (approval.status !== 'PENDING') assert.equal(approval.planSha256, asr.fileSha256(join(dir, 'asr-sm-plan.json')));
  const changes = [
    [(p) => { p.guard.costCapUsd = 1; }, /at most USD 0\.25/u],
    [(p) => { p.guard.allowedHosts.speechmatics = 'global.rt.speechmatics.com'; }, /EU real-time host/u],
    [(p) => { p.arms[0].transcriptionConfig.language = 'ar'; }, /Enhanced ar_en/u],
    [(p) => { p.arms.push({ ...p.arms[0], id: 'MELIA_1' }); }, /one arm only/u],
    [(p) => { p.privacy.modelTrainingMustBeOff = false; }, /model training off/u],
    [(p) => { p.scope.preliminarySingleSpeaker = false; }, /preliminary single-speaker/u],
    [(p) => { p.set.speakers = ['S1', 'S2']; }, /one speaker/u],
    [(p) => { p.set.name = 'core'; }, /po20/u],
  ];
  for (const [change, why] of changes) { const p = structuredClone(asrPlan); change(p); assert.match(asr.checkAsrPlan(p, dir).join(' | '), why); }
  const start = asr.startRecognition(asrPlan.arms[0], 48000, ['نهى الشربيني']);
  assert.deepEqual(start.audio_format, { type: 'raw', encoding: 'pcm_s16le', sample_rate: 48000 });
  assert.deepEqual(start.transcription_config.additional_vocab, [{ content: 'نهى الشربيني' }]);
  assert.throws(() => asr.startRecognition(asrPlan.arms[0], 11025), /sample rate/u);
});

test('asr-sm po20: 20 numbered lines over the PO\'s categories; any phone format is prepared locally, hash-bound, and a re-recorded file is never streamed stale', () => {
  const data = loadRecordingScript(dir);
  const lines = poLines(data);
  assert.deepEqual(lines.map((l) => Number(l.n)), [...Array(20)].map((_, i) => i + 1));
  const count = (f) => lines.filter(f).length;
  assert.equal(count((l) => l.dialect === 'MSA'), 2);
  assert.equal(count((l) => l.condition === 'NOISE'), 2);
  assert.equal(count((l) => l.condition === 'OVERLAP'), 1);
  for (const c of ['READ', 'CODE_SWITCH', 'NUMBER', 'NAME_DATE', 'SELF_CORRECTION', 'DISFLUENCY']) assert.ok(count((l) => l.category === c) >= 1, c);
  for (const l of lines) assert.match(l.text, /[؀-ۿ]/u);
  const corpus = mkdtempSync(join(tmpdir(), 's8b01-po-'));
  const po = join(corpus, 'PO');
  mkdirSync(po);
  const tone = (rate) => {
    const pcm = new Int16Array(rate * 2);
    for (let i = rate / 2; i < rate * 1.5; i += 1) pcm[i] = Math.round(6000 * Math.sin(i / 3));
    return wavFile(Buffer.from(pcm.buffer), rate);
  };
  writeFileSync(join(po, '01.m4a'), 'phone audio 1');
  writeFileSync(join(po, '2.wav'), tone(48000));
  writeFileSync(join(po, '03.ogg'), 'unreadable');
  writeFileSync(join(po, 'notes.txt'), 'ignored');
  const convert = (src, target) => (src.endsWith('.ogg') ? { ok: false, why: 'no decoder' } : (writeFileSync(target, tone(16000)), { ok: true }));
  const rep = asr.prepareRecordings(asrPlan, corpus, { convert });
  assert.deepEqual(rep.slice(0, 4).map((r) => r.status), ['CONVERTED', 'WAV AS IS', 'NOT CONVERTED', 'MISSING']);
  let m = asr.recordingManifest(asrPlan, corpus);
  assert.deepEqual(m.present.map((r) => [Number(r.line.n), r.rate, r.ms]), [[1, 16000, 2000], [2, 48000, 2000]]);
  assert.deepEqual(m.unprepared, ['03']);
  assert.equal(m.missing.length, 17);
  writeFileSync(join(po, '01.m4a'), 'phone audio 1, recorded again');
  m = asr.recordingManifest(asrPlan, corpus);
  assert.deepEqual(m.unprepared, ['01', '03'], 'a changed source must be prepared again');
  assert.match(asr.convertWithFfmpeg(join(po, '03.ogg'), join(po, 'x.wav'), undefined).why, /not installed \(QANDEEL_FFMPEG_DIR\)/u, 'ffmpeg only from the approved folder, never PATH');
  assert.equal(asr.convertWithFfmpeg(join(po, '03.ogg'), join(po, 'x.wav'), corpus).ok, false);
  rmSync(corpus, { recursive: true, force: true });
});

test('asr-sm guard: a WebSocket reaches only the EU host, over wss, with a reservation, one session each', () => {
  const m = mkdtempSync(join(tmpdir(), 's8b01-asr-'));
  const text = readFileSync(join(dir, 'asr-sm-plan.json'), 'utf8').replace(/\r\n/gu, '\n');
  writeFileSync(join(m, 'asr-sm-plan.json'), text);
  copyFileSync(join(dir, 'spend-guard.cjs'), join(m, 'spend-guard.cjs'));
  writeFileSync(join(m, 'asr-sm-approval.json'), JSON.stringify({ status: 'APPROVED', runId: 'r-asr', capUsd: 0.25, planSha256: createHash('sha256').update(text).digest('hex') }));
  const r = underGuard(m, `
    const g = globalThis.__QANDEEL_S8B_01_GUARD__; const out = [];
    const tryWs = (u) => { try { const w = new WebSocket(u); w.onerror = () => {}; out.push('opened'); } catch (e) { out.push(e.message.replace('S8B_01_NETWORK_FORBIDDEN:', '')); } };
    tryWs('wss://evil.example/v2');
    tryWs('wss://eu.rt.speechmatics.com/v2');
    g.reserve('asr', 0.01); tryWs('ws://eu.rt.speechmatics.com/v2');
    console.log(JSON.stringify({ out, key: process.env.SPEECHMATICS_API_KEY ?? null, other: process.env.DEEPGRAM_API_KEY ?? null }));
    process.exit(0);`, { QANDEEL_S8B_CHECK: 'asr-sm', QANDEEL_S8B_RUN_ID: 'r-asr', SPEECHMATICS_API_KEY: 'sm-test', DEEPGRAM_API_KEY: 'dg-test' });
  assert.equal(r.status, 0, r.stderr);
  const o = JSON.parse(r.stdout.trim());
  assert.deepEqual(o.out, ['websocket:evil.example', 'websocket-without-reservation:eu.rt.speechmatics.com', 'websocket:ws:eu.rt.speechmatics.com']);
  assert.equal(o.key, 'sm-test', 'the approved key survives the scrub');
  assert.equal(o.other, null, 'every other provider key is scrubbed');
});

test('asr-sm session against a loopback server: the key in the handshake header, real-time pacing, partials, finals, EndOfUtterance, the measures', async () => {
  let auth = null;
  let bytes = 0;
  const server = miniWsServer((c, msg, n) => {
    auth = c.headers.authorization;
    if (msg?.message === 'StartRecognition') return c.send({ message: 'RecognitionStarted', id: 't' });
    if (n) {
      bytes += n;
      if (bytes === 16000 * 2 * 0.2) c.send({ message: 'AddPartialTranscript', metadata: { transcript: 'بعتلك', start_time: 0.1, end_time: 0.2 } });
      return undefined;
    }
    if (msg?.message === 'EndOfStream') {
      c.send({ message: 'AddTranscript', metadata: { transcript: 'بعتلك الميتنج لينك', start_time: 0.1, end_time: 0.6 }, results: [] });
      c.send({ message: 'EndOfUtterance', metadata: {} });
      c.send({ message: 'EndOfTranscript' });
      c.close();
    }
    return undefined;
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const pcm = new Int16Array(16000 * 0.6);
  for (let i = 1600; i < 9600; i += 1) pcm[i] = Math.round(6000 * Math.sin(i / 3));
  const bounds = asr.speechBounds(pcm, 16000);
  assert.deepEqual([bounds.onsetMs, bounds.offsetMs], [100, 600]);
  const s = await asr.smSession({ url: `ws://127.0.0.1:${server.address().port}/v2`, apiKey: 'k-test', pcm, rate: 16000,
    start: asr.startRecognition(asrPlan.arms[0], 16000), tailSilenceMs: 200, timeoutMs: 5000 });
  server.close();
  assert.equal(s.error, null);
  assert.equal(auth, 'Bearer k-test');
  assert.equal(s.seqSent, 40, '0.8 s in 20 ms frames');
  assert.ok(s.wallMs >= 750, `streamed at real-time pace (${s.wallMs} ms)`);
  const m = asr.sessionMetrics(s.events, bounds);
  assert.equal(m.transcript, 'بعتلك الميتنج لينك');
  assert.equal(m.partials, 1);
  assert.ok(m.firstPartialMs >= 50 && m.firstPartialMs < 400, `first partial ${m.firstPartialMs} ms after onset`);
  assert.ok(m.eouMs >= 0 && m.finalAfterEouMs === 0);
});

test('asr-sm scoring: English words in either script, numbers in digits or words, the intended word, corpus-level WER and the preregistered verdict', () => {
  const data = loadRecordingScript(dir);
  const items = new Map(data.script.items.map((i) => [i.id, i]));
  const line = (id, condition = 'SPEAKER') => sessionLines(data).find((l) => l.id === id && l.condition === condition);
  const cs = asr.scoreLine(line('EG-CS-01'), items.get('EG-CS-01'), 'بعتلك الـ ميتنج لينك على الإيميل، شوفه قبل الساعة تلاتة', data.script, asrPlan.normalization);
  assert.equal(cs.wordErrors, 0, 'ميتنج / لينك count as meeting / link');
  assert.deepEqual(cs.checks.english, [true, true]);
  const nd = asr.scoreLine(line('EG-ND-02'), items.get('EG-ND-02'), 'رقم الطلب 78345', data.script, asrPlan.normalization);
  assert.equal(nd.checks.number, true, 'the digits count as the number');
  const df = asr.scoreLine(line('EG-DF-02'), items.get('EG-DF-02'), 'الميعاد الساعة أربعة لا لا قصدي خمسة', data.script, asrPlan.normalization);
  assert.equal(df.checks.intent, true);
  assert.equal(asr.scoreLine(line('EG-S01'), null, 'أي كلام', data.script, asrPlan.normalization).scored, false, 'a spontaneous answer needs its own transcript');
  const wav = Buffer.alloc(44 + 8);
  wav.write('RIFF', 0); wav.writeUInt32LE(44, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(3, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(48000, 24); wav.writeUInt16LE(32, 34); wav.write('data', 36); wav.writeUInt32LE(8, 40); wav.writeFloatLE(0.5, 44); wav.writeFloatLE(-0.5, 48);
  assert.deepEqual([...asr.readAnyWav(wav).pcm], [0], 'float stereo is averaged to mono PCM16');
  const row = (o) => ({ arm: 'ENHANCED_AR_EN', status: 'OK', dialect: 'EGYPTIAN', condition: 'SPEAKER', category: 'READ', speaker: 'S1', ref_words: 10, word_errors: 1, ref_chars: 40,
    char_errors: 2, first_partial_ms: 600, final_ms: 500, eou_ms: 700, final_after_eou_ms: 0, lag_ms_p50: 400, checks: '{"english":[true],"keyterms":[true],"number":true,"intent":true}', ...o });
  const rows = [...Array(17)].map(() => row({})).concat([row({ dialect: 'MSA', word_errors: 0 }), row({ condition: 'NOISE', word_errors: 2 }), row({ dialect: 'MSA' })]);
  const v = verdict(rows, asrPlan, 'ENHANCED_AR_EN');
  assert.equal(v.passed, true, JSON.stringify(v.items.filter((i) => !i.passed)));
  assert.equal(summarizeAsr(rows, asrPlan).byArm.ENHANCED_AR_EN.wer, Number((20 / 200).toFixed(4)));
  assert.equal(verdict(rows.map((r) => ({ ...r, eou_ms: 1200 })), asrPlan, 'ENHANCED_AR_EN').passed, false, 'a slow endpoint fails the verdict');
});
