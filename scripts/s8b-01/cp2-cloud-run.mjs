// S8B-01 CP2 — the full Google Cloud evaluation's child process (started by `cp2-cloud.mjs --live`, under spend-guard.cjs
// with QANDEEL_S8B_CHECK=cp2-cloud, never directly). The interleaved, reviewed calls of the plan, paced, no retry, with the
// plan's stop rules. Writes report.json (no token), samples.csv and audio/<sample>.wav under the run directory (gitignored).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { playbackStalls, wavFile, worstAudioSeconds } from './cp2-providers.mjs';
import { callCeilingUsd, cloudCalls, gcpStream } from './cp2-cloud.mjs';
import { gcpEndpoint, gcpRequestBody, gcpUsd } from './gcp-paygo.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const guard = globalThis.__QANDEEL_S8B_01_GUARD__;
if (!guard || guard.mode !== 'live' || guard.check !== 'cp2-cloud') throw new Error('S8B_01_CLOUD: the live cp2-cloud guard must be preloaded');
const runDir = process.argv[2];
const plan = JSON.parse(readFileSync(join(HERE, 'cp2-cloud-plan.json'), 'utf8'));
const token = process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
const calls = cloudCalls(plan);
const rules = plan.stopRules;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (line) => console.log(`[s8b-01 cp2-cloud] ${line}`);
const startedMs = Date.now();

const report = { kind: 'S8B-01 CP2 full Gemini TTS evaluation on Google Cloud', runId: guard.runId, planSha256: guard.planSha256, head: process.env.QANDEEL_S8B_HEAD ?? null,
  project: plan.project, location: plan.location, startedAt: new Date().toISOString(), planned: calls.length, models: {}, stoppedRun: null };
for (const m of plan.models) report.models[m.id] = { calls: 0, ok: 0, errors: 0, http429: 0, stoppedBecause: null };
const rows = [];
const HEADER = 'sample,model,voice,group,category,item,arm,dialect,emotion,status,http,first_audio_ms,end_ms,audio_s,rtf,max_gap_ms,stall_ms_200,s_per_char,list_usd,promo_usd,cost_source,error';
const save = () => {
  report.spend = guard.spend();
  report.done = rows.length;
  writeFileSync(join(runDir, 'report.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(runDir, 'samples.csv'), [HEADER, ...rows.map((r) => [r.sample, r.model, r.voice, r.group, r.category, r.item, r.arm, r.dialect, r.emotion ?? '',
    r.status, r.http ?? '', r.firstAudioMs ?? '', r.endMs, r.audioSeconds.toFixed(2), r.rtf ?? '', r.maxGapMs, r.stall200, r.sPerChar ?? '',
    r.listUsd.toFixed(6), r.promoUsd.toFixed(6), r.costSource, JSON.stringify(r.error ?? '')].join(','))].join('\n'));
};

const lastStart = {};
const consecutive = Object.fromEntries(plan.models.map((m) => [m.id, { fail: 0, r429: 0 }]));
try {
  for (let i = 0; i < calls.length; i += 1) {
    const c = calls[i];
    const m = report.models[c.model];
    if (report.stoppedRun) break;
    if (m.stoppedBecause) continue;
    if (Date.now() - startedMs > rules.tokenWindowMs) { report.stoppedRun = 'the ADC token window (55 minutes) ended'; break; }
    const model = plan.models.find((x) => x.id === c.model);
    const body = gcpRequestBody(c.text, c.voice, c.style);
    let id;
    try {
      // The reservation is the most Google can bill for this request (its maximum output), so the cap holds even for a
      // stream cancelled at its bound: the guard refuses any call that could pass the cap.
      id = guard.reserve('tts', callCeilingUsd(model, body));
    } catch (e) {
      if (e.code === 'S8B_01_BUDGET_REFUSED') { report.stoppedRun = 'budget refused by the guard'; break; }
      throw e;
    }
    // Pacing: at least perModelStartIntervalMs between two calls to the same model, start to start.
    const due = (lastStart[c.model] ?? -Infinity) + plan.pacing.perModelStartIntervalMs - Date.now();
    if (due > 0) await sleep(due);
    lastStart[c.model] = Date.now();
    const r = await gcpStream({ url: gcpEndpoint(plan, c.model), body, token, project: plan.project, boundSeconds: worstAudioSeconds(c.text) });
    const usage = r.usage ?? { promptTokenCount: 0, candidatesTokenCount: Math.ceil(r.audioSeconds * plan.audioTokensPerSecond) };
    const listUsd = gcpUsd(model.listUsdPerMillion, usage);
    guard.settle(id, listUsd);
    const ok = !r.error && r.audioSeconds > 0;
    const sample = `C${String(i + 1).padStart(4, '0')}`;
    if (ok) writeFileSync(join(runDir, 'audio', `${sample}.wav`), wavFile(Buffer.concat(r.pcm), r.sampleRate));
    m.calls += 1;
    if (ok) m.ok += 1; else m.errors += 1;
    if (r.status === 429) m.http429 += 1;
    rows.push({ sample, ...c, status: ok ? (r.cancelledAtBound ? 'CANCELLED_AT_BOUND' : 'OK') : 'ERROR', http: r.status, firstAudioMs: r.firstAudioMs, endMs: r.endMs,
      audioSeconds: r.audioSeconds, rtf: r.audioSeconds > 0 ? (r.endMs / 1000 / r.audioSeconds).toFixed(3) : null, maxGapMs: r.maxGapMs,
      stall200: playbackStalls(r.arrivals, 200).stallMs, sPerChar: r.audioSeconds > 0 ? (r.audioSeconds / [...c.text].length).toFixed(4) : null,
      listUsd, promoUsd: gcpUsd(model.promotionalUsdPerMillion, usage), costSource: r.usage ? 'usage' : 'audio-duration', error: r.error });
    const k = consecutive[c.model];
    k.fail = ok ? 0 : k.fail + 1;
    k.r429 = r.status === 429 ? k.r429 + 1 : 0;
    // The plan's stop rules: nothing is retried, and a stopped model is not called again.
    if (r.status === 401) report.stoppedRun = `HTTP 401 on ${sample}: ${r.error}`;
    else if (!ok && m.calls === 1) m.stoppedBecause = `first request failed on ${sample}: ${r.error ?? 'no audio'}`;
    else if ([400, 403, 404].includes(r.status)) m.stoppedBecause = `HTTP ${r.status} on ${sample}: ${r.error}`;
    else if (k.r429 >= rules.consecutive429PerModel) m.stoppedBecause = `${k.r429} consecutive HTTP 429 (last on ${sample})`;
    else if (m.http429 >= rules.total429PerModel) m.stoppedBecause = `${m.http429} HTTP 429 in all (last on ${sample})`;
    else if (r.cancelledAtBound) m.stoppedBecause = `a runaway stream cancelled at its audio bound on ${sample}`;
    else if (k.fail >= rules.consecutiveFailuresPerModel) m.stoppedBecause = `${k.fail} consecutive failures (last on ${sample}: ${r.error})`;
    if (m.stoppedBecause) log(`${c.model} stopped: ${m.stoppedBecause}`);
    if (rows.length % 40 === 0) { save(); log(`${rows.length} / ${calls.length} calls, settled (list) USD ${guard.spend().settledUsd.toFixed(4)}`); }
  }
} finally {
  report.finishedAt = new Date().toISOString();
  report.notReached = calls.length - rows.length;
  report.blocked = guard.blocked;
  save();
  log(`done: ${rows.length} of ${calls.length} calls${report.stoppedRun ? ` (run stopped: ${report.stoppedRun})` : ''}, settled (list) USD ${guard.spend().settledUsd.toFixed(4)}`);
}
