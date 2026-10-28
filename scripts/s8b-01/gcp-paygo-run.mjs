// S8B-01 CP2 — the Google Cloud PayGo check's child process (started by `gcp-paygo.mjs --live`, under spend-guard.cjs with
// QANDEEL_S8B_CHECK=gcp-paygo, never directly). One streamed request per model, the same text and voice, no retry; a model
// whose request fails is not tried again. Writes report.json (no token) and one WAV per model under the run directory
// (gitignored).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { playbackStalls, wavFile, worstAudioSeconds } from './cp2-providers.mjs';
import { audioParts, gcpEndpoint, gcpRequestBody, gcpUsd, gcpWorstUsd, parseSse } from './gcp-paygo.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const guard = globalThis.__QANDEEL_S8B_01_GUARD__;
if (!guard || guard.mode !== 'live' || guard.check !== 'gcp-paygo') throw new Error('S8B_01_GCP: the live gcp-paygo guard must be preloaded');
const runDir = process.argv[2];
const plan = JSON.parse(readFileSync(join(HERE, 'gcp-paygo-plan.json'), 'utf8'));
const token = process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
const report = { kind: 'S8B-01 CP2 Google Cloud PayGo check', runId: guard.runId, planSha256: guard.planSha256, head: process.env.QANDEEL_S8B_HEAD ?? null,
  project: plan.project, location: plan.location, voice: plan.voice, characters: [...plan.text].length, startedAt: new Date().toISOString(), calls: [] };
const save = () => { report.spend = guard.spend(); writeFileSync(join(runDir, 'report.json'), JSON.stringify(report, null, 2)); };

async function synthesize(model) {
  const body = gcpRequestBody(plan.text, plan.voice);
  const id = guard.reserve('tts', gcpWorstUsd(model, body, plan.text, plan.audioTokensPerSecond));
  const bound = worstAudioSeconds(plan.text);
  const out = { model: model.id, status: null, error: null, headersMs: null, firstAudioMs: null, endMs: null, audioSeconds: 0, chunks: 0,
    maxGapMs: 0, usage: null, cancelledAtBound: false };
  const pcm = [];
  const arrivals = [];
  let sampleRate = 24000;
  const t0 = performance.now();
  try {
    const res = await fetch(gcpEndpoint(plan, model.id), { method: 'POST', body,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-goog-user-project': plan.project } });
    out.status = res.status;
    out.headersMs = Math.round(performance.now() - t0);
    if (!res.ok) {
      out.error = `HTTP ${res.status}: ${(await res.text()).slice(0, 600)}`;
    } else {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let last = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const parsed = parseSse(buffer + decoder.decode(value, { stream: true }));
        buffer = parsed.rest;
        for (const ev of parsed.events) {
          if (ev.usageMetadata) out.usage = ev.usageMetadata;
          if (ev.error) out.error = `stream error: ${JSON.stringify(ev.error).slice(0, 600)}`;
          for (const a of audioParts(ev)) {
            const now = performance.now() - t0;
            out.firstAudioMs ??= Math.round(now);
            if (last !== null) out.maxGapMs = Math.max(out.maxGapMs, Math.round(now - last));
            last = now;
            sampleRate = a.sampleRate;
            pcm.push(a.pcm);
            const ms = (a.pcm.length / 2 / sampleRate) * 1000;
            arrivals.push([now, ms]);
            out.audioSeconds += ms / 1000;
            out.chunks += 1;
          }
        }
        if (out.audioSeconds > bound) { out.cancelledAtBound = true; await reader.cancel(); break; }
      }
    }
  } catch (e) {
    out.error = `${e.code ?? e.name}: ${e.message}`.slice(0, 600);
  }
  out.endMs = Math.round(performance.now() - t0);
  out.audioSeconds = Number(out.audioSeconds.toFixed(3));
  out.stallMs200 = playbackStalls(arrivals, 200).stallMs;
  // Settled at the list price (the guard's upper estimate); the promotional price is reported beside it.
  const audioTokens = { promptTokenCount: 0, candidatesTokenCount: Math.ceil(out.audioSeconds * plan.audioTokensPerSecond) };
  const usage = out.usage ?? audioTokens;
  out.costSource = out.usage ? 'usage' : 'audio-duration';
  out.listUsd = gcpUsd(model.listUsdPerMillion, usage);
  out.promotionalUsd = gcpUsd(model.promotionalUsdPerMillion, usage);
  guard.settle(id, out.listUsd);
  if (pcm.length) writeFileSync(join(runDir, `${model.id}.wav`), wavFile(Buffer.concat(pcm), sampleRate));
  return out;
}

try {
  for (const model of plan.models) {
    const r = await synthesize(model);
    report.calls.push(r);
    console.log(`[s8b-01 gcp-paygo] ${model.id}: ${r.error ? `FAILED (${r.error.slice(0, 160)})` : `HTTP ${r.status}, first audio ${r.firstAudioMs} ms, end ${r.endMs} ms, ${r.audioSeconds} s audio`}`);
    save();
  }
} finally {
  report.finishedAt = new Date().toISOString();
  report.blocked = guard.blocked;
  save();
  console.log(`[s8b-01 gcp-paygo] done: settled (list price) USD ${guard.spend().settledUsd.toFixed(5)}`);
}
