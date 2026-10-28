import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { corpusRates, errorRates, normalizeArabic } from '../scripts/s8b-01/arabic-text-metrics.mjs';
import { composeBudget, endToEndVerdict, percentile } from '../scripts/s8b-01/latency-model.mjs';
import { GUIDANCE_ECHO_MIN_LENGTH, INTERNAL_CONTAINERS, guidanceSentences, measureStream, va2ReleasableLength } from '../scripts/s8b-01/stream-first-token.mjs';
import { checkPlan, sha256Normalized } from '../scripts/s8b-01/bench-launch.mjs';
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
