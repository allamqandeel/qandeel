// S8B-01 CP2 — the final ASR engineering proof's child process (started by `asr-sm-proof.mjs --live`, under spend-guard.cjs
// with QANDEEL_S8B_CHECK=asr-sm-proof, never directly). The 12 planned sessions in order, one real-time session each, the
// audio streamed at real-time pace with QANDEEL's ForceEndOfUtterance at each causal-VAD endpoint; no retry; the stop rules.
// Writes, under the run directory (gitignored): sessions/<id>.json (the server messages, which hold the transcripts),
// samples.csv, summary.json and report.json. No transcript or key is printed.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecordingScript } from './asr-recording-sheet.mjs';
import { scoreLine, sessionCeilingUsd, smSession, startRecognition } from './asr-sm.mjs';
import { proofMetrics, proofSessions, proofVerdict } from './asr-sm-proof.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const guard = globalThis.__QANDEEL_S8B_01_GUARD__;
if (!guard || guard.mode !== 'live' || guard.check !== 'asr-sm-proof') throw new Error('S8B_01_ASR: the live asr-sm-proof guard must be preloaded');
const [runDir] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(join(HERE, 'asr-sm-proof-plan.json'), 'utf8'));
const data = loadRecordingScript(HERE);
const items = new Map(data.script.items.map((i) => [i.id, i]));
const vocab = [...new Set(data.script.items.flatMap((i) => i.keyterms ?? []))];
const apiKey = process.env.SPEECHMATICS_API_KEY;
const arm = plan.arms[0];
const log = (s) => console.log(`[s8b-01 asr-sm-proof] ${s}`);

const report = { kind: 'S8B-01 CP2 Speechmatics final ASR engineering proof', runId: guard.runId, planSha256: guard.planSha256, head: process.env.QANDEEL_S8B_HEAD ?? null,
  endpoint: plan.endpointUrl, startedAt: new Date().toISOString(), planned: plan.sessions, ok: 0, errors: 0, consecutiveErrors: 0, stoppedRun: null };
const rows = [];
const cols = ['id', 'set', 'n', 'variant', 'status', 'audio_ms', 'onset_ms', 'offset_ms', 'forces', 'mid_forces', 'force_response_ms', 'text_ready_ms', 'last_word_final_ms',
  'first_partial_ms', 'ref_words', 'word_errors', 'checks', 'clipped', 'ceiling_usd', 'error'];
const save = () => {
  report.spend = guard.spend();
  report.done = rows.length;
  writeFileSync(join(runDir, 'report.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(runDir, 'samples.csv'), [cols.join(','), ...rows.map((r) => cols.map((c) => JSON.stringify(typeof r[c] === 'object' && r[c] !== null ? JSON.stringify(r[c]) : r[c] ?? '')).join(','))].join('\n'));
};

try {
  for (const x of proofSessions(plan)) {
    if (report.stoppedRun) break;
    const ceiling = sessionCeilingUsd(plan, arm, x.ms);
    let id;
    try { id = guard.reserve('asr', ceiling); } catch (e) {
      if (e.code === 'S8B_01_BUDGET_REFUSED') { report.stoppedRun = 'budget refused by the guard'; break; }
      throw e;
    }
    const s = await smSession({ url: plan.endpointUrl, apiKey, pcm: x.pcm, rate: x.rate, start: startRecognition(arm, x.rate, vocab), chunkMs: plan.audio.chunkMs,
      tailSilenceMs: plan.audio.tailSilenceMs, timeoutMs: x.ms + plan.audio.tailSilenceMs + plan.audio.sessionTimeoutMarginMs, forces: x.forces });
    guard.settle(id, (s.wallMs / 3.6e6) * arm.pricePerHourUsd);
    writeFileSync(join(runDir, 'sessions', `${x.id}.json`), JSON.stringify({ id: x.id, bounds: x.bounds, forces: x.forces, forcesSent: s.forcesSent, wallMs: s.wallMs,
      recognitionStartedMs: s.recognitionStartedMs, closeCode: s.closeCode, error: s.error, events: s.events }));
    const m = proofMetrics(s.events, s.forcesSent, x.forces, x.bounds, plan.endpoint.vad.frameMs);
    const ok = !s.error && Boolean(m.transcript);
    const sc = ok ? scoreLine(x.line, items.get(x.line.id), m.transcript, data.script, plan.normalization) : { scored: false };
    if (ok) { report.ok += 1; report.consecutiveErrors = 0; } else { report.errors += 1; report.consecutiveErrors += 1; }
    rows.push({ id: x.id, set: x.set, n: x.n, variant: x.variant, status: ok ? 'OK' : 'ERROR', audio_ms: x.ms, onset_ms: x.bounds.onsetMs, offset_ms: x.bounds.offsetMs,
      forces: s.forcesSent.length, mid_forces: m.midForces, force_response_ms: m.forceResponsesMs, text_ready_ms: m.textReadyMs, last_word_final_ms: m.lastWordFinalMs,
      first_partial_ms: m.firstPartialMs, ref_words: sc.referenceWords, word_errors: sc.wordErrors, checks: sc.checks ?? null, clipped: x.clipped ?? 0,
      ceiling_usd: ceiling.toFixed(6), error: s.error });
    // The stop rules: nothing is retried.
    if (/not_authorised|4001|401/u.test(s.error ?? '')) report.stoppedRun = `not authorised on ${x.id}`;
    else if (/quota_exceeded|4005/u.test(s.error ?? '')) report.stoppedRun = `quota exceeded on ${x.id}`;
    else if (s.error && rows.length === 1) report.stoppedRun = `the first session failed: ${s.error}`;
    else if (report.consecutiveErrors >= plan.stopRules.consecutiveFailures) report.stoppedRun = `${report.consecutiveErrors} consecutive failures (last ${x.id})`;
    save();
    log(`${rows.length} / ${plan.sessions} sessions, settled USD ${guard.spend().settledUsd.toFixed(4)}`);
  }
} finally {
  report.finishedAt = new Date().toISOString();
  report.notReached = plan.sessions - rows.length;
  report.blocked = guard.blocked;
  save();
  writeFileSync(join(runDir, 'summary.json'), JSON.stringify(proofVerdict(rows, plan), null, 2));
  log(`done: ${rows.length} of ${plan.sessions} sessions${report.stoppedRun ? ` (run stopped: ${report.stoppedRun})` : ''}, settled USD ${guard.spend().settledUsd.toFixed(4)}`);
}
