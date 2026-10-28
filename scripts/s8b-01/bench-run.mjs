// S8B-01 — the benchmark runner (child process; started by bench-launch.mjs under spend-guard.cjs, never directly).
//
// CP1 ships it with its SIMULATED providers only (simulated-providers.mjs): deterministic stand-ins that exercise the
// whole scoring path — ASR WER / CER per dialect, TTS arm bookkeeping, the DeepSeek-shaped SSE stream measured by the
// real measureStream(), and the latency budget composition — at zero cost, sending nothing off the machine. CP2 adds the
// approved provider adapters behind the same three functions (transcribe, synthesize, streamCompletion) and changes
// nothing else. The report holds counts, rates and instants only: no audio, no transcript text.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corpusRates } from './arabic-text-metrics.mjs';
import { composeBudget, percentile } from './latency-model.mjs';
import { measureStream } from './stream-first-token.mjs';
import { createSimulatedProviders } from './simulated-providers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const guard = globalThis.__QANDEEL_S8B_01_GUARD__;
if (!guard) throw new Error('S8B_01_RUN: spend-guard.cjs must be preloaded');
if (guard.mode !== 'simulate') throw new Error(`S8B_01_RUN: mode ${guard.mode} has no provider adapters in CP1`);

const plan = JSON.parse(readFileSync(join(HERE, 'bench-plan.json'), 'utf8'));
const asrCorpus = JSON.parse(readFileSync(join(HERE, plan.asr.corpus.prompts), 'utf8'));
const ttsCorpus = JSON.parse(readFileSync(join(HERE, plan.tts.corpus), 'utf8'));
const out = process.argv[2];
if (!out) throw new Error('S8B_01_RUN: an output path is required');

const providers = await createSimulatedProviders();
try {
  // ASR: every candidate, every dialect's read prompts (the simulated speech is the reference itself).
  const asr = {};
  for (const { id } of plan.asr.candidates) {
    asr[id] = {};
    for (const [dialect, prompts] of Object.entries(asrCorpus.dialects)) {
      const pairs = [];
      const finalLatency = [];
      for (const reference of prompts.read) {
        const r = await providers.transcribe(id, dialect, reference);
        pairs.push({ reference, hypothesis: r.text });
        finalLatency.push(r.finalLatencyMs);
      }
      const rates = corpusRates(pairs, plan.asr.normalization);
      asr[id][dialect] = { ...rates, finalLatencyP50Ms: percentile(finalLatency, 50) };
    }
  }

  // TTS: every candidate × arm × item is synthesized once; the simulated provider returns timings and character counts.
  const items = [...ttsCorpus.homographs, ...ttsCorpus.names, ...ttsCorpus.numbers, ...ttsCorpus.dialect_sentences, ...ttsCorpus.code_switch, ...ttsCorpus.replies];
  const tts = {};
  for (const { id } of plan.tts.candidates) {
    tts[id] = {};
    for (const arm of ['BASELINE', 'RENDERED']) {
      const ttfb = [];
      let characters = 0;
      for (const item of items) {
        const r = await providers.synthesize(id, arm, item.text);
        ttfb.push(r.ttfbMs);
        characters += r.characters;
      }
      tts[id][arm] = { items: items.length, characters, ttfbP50Ms: percentile(ttfb, 50), ttfbP95Ms: percentile(ttfb, 95) };
    }
  }

  // DeepSeek-shaped stream: T and G measured by the real measurer against the local simulated SSE server.
  const stream = [];
  for (let i = 0; i < plan.deepseekStream.calls; i += 1) {
    const startedAt = performance.now();
    const response = await providers.streamCompletion(i);
    stream.push(await measureStream(response, startedAt));
  }

  const stageSamples = {
    E: stream.map(() => providers.simulatedStage('E')),
    A: Object.values(asr).flatMap((d) => Object.values(d).map((r) => r.finalLatencyP50Ms)),
    P: stream.map(() => providers.simulatedStage('P')),
    T: stream.map((s) => s.firstTokenMs),
    G: stream.map((s) => s.firstChunkMs - s.firstTokenMs),
    R: stream.map(() => providers.simulatedStage('R')),
    S: Object.values(tts).map((a) => a.RENDERED.ttfbP50Ms),
    // N is device-measured (S8B-06): deliberately absent here, so the full verdict stays NOT_MEASURED.
  };
  const budget = composeBudget(stageSamples, plan);

  const report = {
    kind: 'S8B-01 benchmark report', mode: guard.mode, simulated: true, paidCalls: 0, networkBlocked: guard.blocked.length,
    asr, tts,
    deepseekStream: { calls: stream.length, firstTokenP50Ms: percentile(stream.map((s) => s.firstTokenMs), 50), firstChunkP50Ms: percentile(stream.map((s) => s.firstChunkMs), 50) },
    budget,
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));
} finally {
  await providers.close();
}
