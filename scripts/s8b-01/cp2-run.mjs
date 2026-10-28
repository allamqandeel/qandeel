// S8B-01 CP2 — the ONE bounded live run (child process; started by `bench-launch.mjs --live`, under spend-guard.cjs in
// live mode, never directly). The Product Owner's CP2 order (2026-10-28):
//   1. preflight (free): each Gemini TTS model's availability for the key's project;
//   2. Gemini TTS: both models × two voices × the CP1 TTS set (BASELINE, and RENDERED where it differs) and the CP2
//      expression set (NO_STYLE / PERSONA / EMOTION), streamed, store: false, paced, no retry;
//   3. DeepSeek stream probe: 20 synthetic spoken prompts × 2 (T and the VA-2 G), no retry;
//   4. stage R measured locally.
// ASR, the Orchestrator stage P and the render spike are NOT RUN (bench-plan.json). The run writes, under its run
// directory (gitignored): report.json (counts, instants, costs; no audio, no reply text), samples.csv, the WAV files.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { percentile } from './latency-model.mjs';
import { deepseekStream, geminiModelInfo, geminiSynthesize, playbackStalls, renderItem, wavFile } from './cp2-providers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const guard = globalThis.__QANDEEL_S8B_01_GUARD__;
if (!guard || guard.mode !== 'live') throw new Error('S8B_01_CP2: the live guard must be preloaded');
const runDir = process.argv[2];
if (!runDir) throw new Error('S8B_01_CP2: a run directory is required');
const plan = JSON.parse(readFileSync(join(HERE, 'bench-plan.json'), 'utf8'));
const ttsSet = JSON.parse(readFileSync(join(HERE, plan.tts.corpus), 'utf8'));
const expression = JSON.parse(readFileSync(join(HERE, plan.tts.cp2.expressionSet.corpus), 'utf8'));
const prompts = JSON.parse(readFileSync(join(HERE, plan.deepseekStream.cp2.prompts), 'utf8'));
mkdirSync(join(runDir, 'audio'), { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (line) => console.log(`[s8b-01 cp2] ${line}`);

// ── the TTS work list ────────────────────────────────────────────────────────────────────────────────────────────────
const setItems = [...ttsSet.homographs, ...ttsSet.names, ...ttsSet.numbers, ...ttsSet.dialect_sentences, ...ttsSet.code_switch, ...ttsSet.replies];
const work = [];
for (const item of setItems) {
  work.push({ item: item.id, group: 'SET', arm: 'BASELINE', text: item.text, style: null, dialect: item.dialect });
  const rendered = renderItem(item);
  if (rendered !== item.text) work.push({ item: item.id, group: 'SET', arm: 'RENDERED', text: rendered, style: null, dialect: item.dialect });
}
const replies = new Map(ttsSet.replies.map((r) => [r.id, r]));
for (const x of [...expression.items, ...expression.also_from_tts_set.map((id) => replies.get(id))]) {
  work.push({ item: x.id, group: 'EXPRESSION', arm: 'NO_STYLE', text: x.text, style: null, dialect: x.dialect, emotion: x.emotion ?? 'REPLY' });
  work.push({ item: x.id, group: 'EXPRESSION', arm: 'PERSONA', text: x.text, style: expression.persona_style, dialect: x.dialect, emotion: x.emotion ?? 'REPLY' });
  if (x.style) work.push({ item: x.id, group: 'EXPRESSION', arm: 'EMOTION', text: x.text, style: x.style, dialect: x.dialect, emotion: x.emotion });
}

const report = { kind: 'S8B-01 CP2 live report', runId: guard.runId, planSha256: guard.planSha256, head: process.env.QANDEEL_S8B_HEAD ?? null, startedAt: new Date().toISOString(),
  preflight: {}, tts: { models: {}, samples: 0, errors: 0 }, deepseekStream: null, stageR: null, notRun: {
    asr: plan.asr.cp2.status, orchestratorOverheadP: plan.orchestratorOverhead.cp2.status, renderSpike: plan.renderSpike.cp2.status,
    ttsAssisted: 'NOT RUN', otherTtsCandidates: 'NOT RUN — Product Owner decision (Gemini only)' } };
const rows = [];
const save = () => {
  report.spend = guard.spend();
  writeFileSync(join(runDir, 'report.json'), JSON.stringify(report, null, 2));
  const header = 'sample,model,voice,group,item,arm,dialect,emotion,status,first_audio_ms,end_ms,audio_s,rtf,max_gap_ms,stall_ms_0,stall_ms_200,s_per_char,usd,cost_source,error';
  writeFileSync(join(runDir, 'samples.csv'), [header, ...rows.map((r) => [r.sample, r.model, r.voice, r.group, r.item, r.arm, r.dialect, r.emotion ?? '',
    r.status, r.firstAudioMs ?? '', r.endMs, r.audioSeconds.toFixed(2), r.rtf ?? '', r.maxGapMs, r.stall0, r.stall200, r.sPerChar ?? '', r.usd.toFixed(6), r.costSource,
    JSON.stringify(r.error ?? '')].join(','))].join('\n'));
};

try {
  // 1. preflight
  for (const model of plan.tts.cp2.models) {
    report.preflight[model.id] = await geminiModelInfo(model.id);
    log(`preflight ${model.id}: HTTP ${report.preflight[model.id].status}`);
  }
  save();

  // 2. Gemini TTS
  let n = 0;
  for (const model of plan.tts.cp2.models) {
    const pre = report.preflight[model.id];
    const m = report.tts.models[model.id] = { available: pre.status === 200, calls: 0, errors: 0, stoppedBecause: null };
    if (!m.available) { m.stoppedBecause = `preflight HTTP ${pre.status}`; continue; }
    let consecutive = 0;
    for (const voice of plan.tts.cp2.voices) {
      for (const w of work) {
        if (m.stoppedBecause) break;
        const started = Date.now();
        n += 1;
        const sample = `S${String(n).padStart(4, '0')}`;
        let r;
        try {
          r = await geminiSynthesize({ model, voice, text: w.text, style: w.style, endpoint: plan.tts.cp2.api.endpoint, tokensPerSecond: plan.tts.cp2.audioTokensPerSecond });
        } catch (e) {
          if (e.code === 'S8B_01_BUDGET_REFUSED') { m.stoppedBecause = 'budget refused by the guard'; break; }
          throw e;
        }
        m.calls += 1;
        const ok = !r.error && r.audioBytes > 0;
        if (ok) writeFileSync(join(runDir, 'audio', `${sample}.wav`), wavFile(r.pcm, r.sampleRate));
        else { m.errors += 1; report.tts.errors += 1; }
        consecutive = ok ? 0 : consecutive + 1;
        rows.push({ sample, model: model.id, voice, ...w, status: ok ? (r.cancelledAtBound ? 'CANCELLED_AT_BOUND' : 'OK') : 'ERROR', firstAudioMs: r.firstAudioMs, endMs: r.endMs,
          audioSeconds: r.audioSeconds, rtf: r.audioSeconds > 0 ? (r.endMs / 1000 / r.audioSeconds).toFixed(3) : null, maxGapMs: r.maxGapMs,
          stall0: playbackStalls(r.arrivals, 0).stallMs, stall200: playbackStalls(r.arrivals, 200).stallMs,
          sPerChar: r.audioSeconds > 0 ? (r.audioSeconds / [...w.text].length).toFixed(4) : null, usd: r.cost.chargedUsd, costSource: r.cost.source,
          inputTokens: r.cost.inputTokens, outputTokens: r.cost.outputTokens, error: r.error });
        report.tts.samples = rows.length;
        if (rows.length % 10 === 0) { save(); log(`${rows.length} samples, settled USD ${guard.spend().settledUsd.toFixed(4)}`); }
        if (m.calls === 1) m.firstCallEventTypes = r.eventTypes;
        // Fail fast: a model whose first request fails, or a request the API refuses outright, is not repeated; three
        // failures in a row stop the model.
        if (!ok && m.calls === 1) m.stoppedBecause = `first request failed on ${sample} (HTTP ${r.status}; events ${r.eventTypes.join(' ')}): ${r.error ?? 'no audio'}`;
        else if (!ok && r.status === 400) m.stoppedBecause = `HTTP 400 on ${sample}: ${r.error}`;
        else if (consecutive >= 3) m.stoppedBecause = `three consecutive failures (last: ${r.error})`;
        const wait = plan.tts.cp2.pacingMs - (Date.now() - started);
        if (wait > 0) await sleep(wait);
      }
    }
  }
  save();

  // 3. DeepSeek stream probe
  const ds = plan.deepseekStream.cp2;
  const streams = [];
  for (let round = 0; round < 2; round += 1) {
    for (const p of prompts.prompts) {
      let r;
      try {
        r = await deepseekStream({ endpoint: ds.endpoint, model: ds.model, guidance: prompts.guidance, userText: p.text, maxTokens: ds.maxTokens, peak: ds.usdPerMillion.peak });
      } catch (e) {
        if (e.code === 'S8B_01_BUDGET_REFUSED') break;
        throw e;
      }
      streams.push({ prompt: p.id, round, dialect: p.dialect, status: r.status, error: r.error, isPeak: r.isPeak, usd: r.usd, headersMs: r.headersMs,
        firstTokenMs: r.firstTokenMs, firstBoundaryApproxMs: r.firstBoundaryApproxMs, firstReleasableChunkMs: r.firstReleasableChunkMs,
        releasedAtEnd: r.releasedAtEnd, heldAtEnd: r.heldAtEnd, withheldReason: r.withheldReason, endMs: r.endMs, characters: r.characters,
        finishReason: r.finishReason, usage: r.usage });
      if (r.status === 400) break;
      await sleep(1000);
    }
  }
  const okStreams = streams.filter((s) => !s.error && s.firstTokenMs !== null);
  const g = okStreams.filter((s) => s.firstReleasableChunkMs !== null).map((s) => s.firstReleasableChunkMs - s.firstTokenMs);
  const pct = (xs) => ({ n: xs.length, p50: percentile(xs, 50), p95: percentile(xs, 95) });
  report.deepseekStream = { calls: streams.length, ok: okStreams.length, withheld: okStreams.filter((s) => s.withheldReason).length,
    heldAtEnd: okStreams.filter((s) => s.heldAtEnd).length, releasedAtEnd: okStreams.filter((s) => s.releasedAtEnd).length,
    headers: pct(okStreams.map((s) => s.headersMs)), T: pct(okStreams.map((s) => s.firstTokenMs)), G: pct(g),
    firstReleasable: pct(okStreams.filter((s) => s.firstReleasableChunkMs !== null).map((s) => s.firstReleasableChunkMs)),
    firstBoundaryApproxDiagnostic: pct(okStreams.filter((s) => s.firstBoundaryApproxMs !== null).map((s) => s.firstBoundaryApproxMs)),
    end: pct(okStreams.map((s) => s.endMs)), characters: pct(okStreams.map((s) => s.characters)), usd: streams.reduce((a, s) => a + s.usd, 0), streams };
  save();

  // 4. stage R, locally: the rendering of each item, timed.
  const rTimes = setItems.map((item) => { const t0 = performance.now(); for (let i = 0; i < 1000; i += 1) renderItem(item); return (performance.now() - t0) / 1000; });
  report.stageR = { method: 'renderItem per item, mean of 1,000 runs', p50Ms: percentile(rTimes, 50), p95Ms: percentile(rTimes, 95),
    note: 'the corpus-oracle rendering of the RENDERED arm; the real Speech Rendering layer (S8B-04) is re-measured there' };
} finally {
  report.finishedAt = new Date().toISOString();
  report.blocked = guard.blocked;
  save();
  log(`done: ${rows.length} TTS samples, ${report.deepseekStream?.calls ?? 0} DeepSeek streams, settled USD ${guard.spend().settledUsd.toFixed(4)}`);
}
