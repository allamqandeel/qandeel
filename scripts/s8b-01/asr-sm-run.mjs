// S8B-01 CP2 — the Speechmatics real-time ASR run's child process (started by `asr-sm.mjs --live`, under spend-guard.cjs
// with QANDEEL_S8B_CHECK=asr-sm, never directly). For each of the Product Owner's prepared recordings (set po20), the plan's
// arm (Enhanced ar_en only), one real-time session each, the audio streamed at real-time pace; no retry; the plan's stop rules.
// Writes, under the run directory (gitignored): sessions/<speaker>_<NN>_<line>_<condition>_<arm>.json (the server messages,
// which hold the transcripts), samples.csv, summary.json and report.json. No transcript or key is printed.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecordingScript } from './asr-recording-sheet.mjs';
import { readAnyWav, recordingManifest, scoreLine, sessionCeilingUsd, sessionMetrics, smSession, speechBounds, startRecognition } from './asr-sm.mjs';
import { summarizeAsr } from './asr-sm-summary.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const guard = globalThis.__QANDEEL_S8B_01_GUARD__;
if (!guard || guard.mode !== 'live' || guard.check !== 'asr-sm') throw new Error('S8B_01_ASR: the live asr-sm guard must be preloaded');
const [runDir, corpusDir] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(join(HERE, 'asr-sm-plan.json'), 'utf8'));
const data = loadRecordingScript(HERE);
const items = new Map(data.script.items.map((i) => [i.id, i]));
const apiKey = process.env.SPEECHMATICS_API_KEY;
const log = (s) => console.log(`[s8b-01 asr-sm] ${s}`);
const vocab = [...new Set(data.script.items.flatMap((i) => i.keyterms ?? []))];

const report = { kind: 'S8B-01 CP2 Speechmatics real-time ASR', runId: guard.runId, planSha256: guard.planSha256, head: process.env.QANDEEL_S8B_HEAD ?? null,
  endpoint: plan.endpoint, startedAt: new Date().toISOString(), planned: plan.set.sessions, arms: {}, stoppedRun: null };
for (const a of plan.arms) report.arms[a.id] = { sessions: 0, ok: 0, errors: 0, stoppedBecause: null, consecutiveErrors: 0 };
const rows = [];
const save = () => {
  report.spend = guard.spend();
  report.done = rows.length;
  writeFileSync(join(runDir, 'report.json'), JSON.stringify(report, null, 2));
  const cols = ['speaker', 'n', 'line', 'dialect', 'category', 'condition', 'arm', 'status', 'audio_ms', 'onset_ms', 'offset_ms', 'first_partial_ms', 'final_ms', 'eou_ms',
    'final_after_eou_ms', 'lag_ms_p50', 'partials', 'finals', 'ref_words', 'word_errors', 'ref_chars', 'char_errors', 'checks', 'quality', 'ceiling_usd', 'error'];
  writeFileSync(join(runDir, 'samples.csv'), [cols.join(','), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n'));
};

const manifest = recordingManifest(plan, corpusDir);
try {
  for (const rec of manifest.present) {
    if (report.stoppedRun) break;
    const { rate, pcm } = readAnyWav(readFileSync(rec.file));
    const bounds = speechBounds(pcm, rate);
    const own = rec.line.category === 'SPONTANEOUS' && existsSync(rec.file.replace(/\.wav$/u, '.txt')) ? readFileSync(rec.file.replace(/\.wav$/u, '.txt'), 'utf8').trim() : null;
    for (const arm of plan.arms) {
      const a = report.arms[arm.id];
      if (report.stoppedRun || a.stoppedBecause) continue;
      const ceiling = sessionCeilingUsd(plan, arm, rec.ms);
      let id;
      try { id = guard.reserve('asr', ceiling); } catch (e) {
        if (e.code === 'S8B_01_BUDGET_REFUSED') { report.stoppedRun = 'budget refused by the guard'; break; }
        throw e;
      }
      const s = await smSession({ url: plan.endpoint, apiKey, pcm, rate, start: startRecognition(arm, rate, vocab), chunkMs: plan.audio.chunkMs,
        tailSilenceMs: plan.audio.tailSilenceMs, timeoutMs: rec.ms + plan.audio.tailSilenceMs + plan.audio.sessionTimeoutMarginMs,
        forceAtMs: arm.forceEndOfUtteranceAfterSilenceMs ? bounds.offsetMs + arm.forceEndOfUtteranceAfterSilenceMs : null });
      // Real-time sessions report no usage: the session is settled at its whole wall time, priced (an upper bound of the
      // audio billed); it can never pass its reservation, which is the timeout.
      guard.settle(id, (s.wallMs / 3.6e6) * arm.pricePerHourUsd);
      const key = `${rec.speaker}_${String(rec.line.n).padStart(2, '0')}_${rec.line.id}_${rec.line.condition}_${arm.id}`;
      writeFileSync(join(runDir, 'sessions', `${key}.json`), JSON.stringify({ key, bounds, wallMs: s.wallMs, recognitionStartedMs: s.recognitionStartedMs, closeCode: s.closeCode, error: s.error, events: s.events }));
      const m = sessionMetrics(s.events, bounds);
      const ok = !s.error && m.finals > 0;
      const sc = ok ? scoreLine(rec.line, items.get(rec.line.id), m.transcript, data.script, plan.normalization, own) : { scored: false };
      a.sessions += 1;
      if (ok) { a.ok += 1; a.consecutiveErrors = 0; } else { a.errors += 1; a.consecutiveErrors += 1; }
      rows.push({ speaker: rec.speaker, n: rec.line.n, line: rec.line.id, dialect: rec.line.dialect, category: rec.line.category, condition: rec.line.condition, arm: arm.id,
        status: ok ? 'OK' : 'ERROR', audio_ms: rec.ms, onset_ms: bounds.onsetMs, offset_ms: bounds.offsetMs, first_partial_ms: m.firstPartialMs, final_ms: m.finalMs,
        eou_ms: m.eouMs, final_after_eou_ms: m.finalAfterEouMs, lag_ms_p50: m.lagMsP50, partials: m.partials, finals: m.finals,
        ref_words: sc.referenceWords, word_errors: sc.wordErrors, ref_chars: sc.referenceChars, char_errors: sc.charErrors, checks: sc.checks ? JSON.stringify(sc.checks) : '',
        quality: m.quality, ceiling_usd: ceiling.toFixed(6), error: s.error });
      // The stop rules: nothing is retried; a stopped arm is not called again.
      if (/not_authorised|4001|401/u.test(s.error ?? '')) report.stoppedRun = `not authorised on ${key}`;
      else if (/quota_exceeded|4005/u.test(s.error ?? '')) report.stoppedRun = `quota exceeded on ${key}`;
      else if (!ok && a.sessions === 1) a.stoppedBecause = `first session failed: ${s.error ?? 'no final transcript'}`;
      else if (a.consecutiveErrors >= plan.stopRules.consecutiveFailuresPerArm) a.stoppedBecause = `${a.consecutiveErrors} consecutive failures (last ${key})`;
      if (a.stoppedBecause) log(`${arm.id} stopped: ${a.stoppedBecause}`);
    }
    if (rows.length % 5 === 0) { save(); log(`${rows.length} / ${plan.set.sessions} sessions, settled USD ${guard.spend().settledUsd.toFixed(4)}`); }
  }
} finally {
  report.finishedAt = new Date().toISOString();
  report.notReached = plan.set.sessions - rows.length;
  report.blocked = guard.blocked;
  save();
  writeFileSync(join(runDir, 'summary.json'), JSON.stringify(summarizeAsr(rows, plan), null, 2));
  log(`done: ${rows.length} of ${plan.set.sessions} sessions${report.stoppedRun ? ` (run stopped: ${report.stoppedRun})` : ''}, settled USD ${guard.spend().settledUsd.toFixed(4)}`);
}
