/**
 * INTEL-LIVE-01 CP1 — A0: the Speechmatics FINAL availability proof (A1 §5 H-1 / D-1, re-expressed as evidence
 * availability: STOP for the Product Owner if the word-end -> FINAL lag L-P95 > 5 s, or any FINAL gap > 20 s, is observed
 * while the person speaks). PAID: Speechmatics realtime, Enhanced, through the PRODUCTION adapter and its frozen recognition
 * configuration (S8B-01 / S8B-04: ar_en, enhanced, max_delay 0.7, end-of-utterance trigger off).
 *
 * Six sessions of ≈ 110 s of continuous synthetic Arabic speech each: 4 in `flexible` (the configured mode) and 2 in
 * `fixed` (D-1b's arm, the only change: the StartRecognition's max_delay_mode, rewritten on its way out by a socket wrapper).
 * The speech is the S8B-01 synthetic TTS corpus (Gemini TTS voices Achird / Sulafat, no person), concatenated clip after
 * clip with a breath of 250–450 ms, streamed in 20 ms frames at the real-time rate.
 *
 * Measured per FINAL: its arrival on the audio clock (the stream is real-time, so the audio position sent equals the
 * elapsed wall time since the first frame) minus the end of its last word (Speechmatics' own word time) = L; and the
 * gaps between FINAL arrivals while speech is being sent. Only instants, counts and word counts are stored: no text.
 *
 * Refused unless INTEL_LIVE_01_PAID=AUTHORISED. The key is read from INTEL_LIVE_01_SPEECHMATICS_KEY_FILE into memory and
 * never printed. Metered at USD 0.80 / audio hour (the CP0 v1.1 basis) and stopped before the ceiling
 * INTEL_LIVE_01_SPEECHMATICS_CEILING_USD (default 0.28 of the PO's 0.30) would be passed, counting the whole next session.
 *
 *   INTEL_LIVE_01_PAID=AUTHORISED INTEL_LIVE_01_SPEECHMATICS_KEY_FILE=~/.qandeel/speechmatics-api-key.txt \
 *     node node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/intel-live-01/cp1-cadence-proof.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadSpeechmaticsRealtimeConfig, SPEECHMATICS_REALTIME_BYTES_PER_MS } from '../../src/voice/speechmatics/speechmatics-realtime.config';
import { nodeWebSocketFactory, SpeechmaticsRealtimeAdapter, type RealtimeSocketFactory } from '../../src/voice/speechmatics/speechmatics-realtime.adapter';

const AUDIO_DIR = process.env.INTEL_LIVE_01_AUDIO_DIR ?? 'E:/s8b01/artifacts/evals/s8b-01/cloud/s8b01-cp2-cloud-r1';
const OUT = process.env.INTEL_LIVE_01_OUT ?? 'E:/QANDEEL_REPORTS/INTEL-LIVE-01/CP1';
const RUN_ID = process.env.INTEL_LIVE_01_RUN_ID ?? `cp1-a0-${new Date().toISOString().replace(/[:.]/gu, '-')}`;
const USD_PER_AUDIO_HOUR = 0.80;
const CEILING_USD = Number(process.env.INTEL_LIVE_01_SPEECHMATICS_CEILING_USD ?? 0.28);
const SESSION_S = Number(process.env.INTEL_LIVE_01_A0_SESSION_S ?? 110);
const ARMS: ReadonlyArray<'flexible' | 'fixed'> = ['flexible', 'fixed', 'flexible', 'flexible', 'fixed', 'flexible'];
const FRAME_MS = 20;
const L_P95_STOP_MS = 5_000;
const GAP_STOP_MS = 20_000;

function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]! : null;
};

/** A PCM16 mono WAV as 16 kHz samples (linear resampling from its own rate). */
function wav16k(path: string): Int16Array {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`not a WAV: ${path}`);
  let off = 12;
  let rate = 0;
  let channels = 0;
  let bits = 0;
  let data: Buffer | null = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') { channels = b.readUInt16LE(off + 10); rate = b.readUInt32LE(off + 12); bits = b.readUInt16LE(off + 22); }
    if (id === 'data') data = b.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size % 2);
  }
  if (!data || channels !== 1 || bits !== 16 || rate <= 0) throw new Error(`unsupported WAV: ${path}`);
  const src = new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length - (data.length % 2)));
  const n = Math.floor((src.length * 16_000) / rate);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i * rate) / 16_000;
    const j = Math.floor(x);
    const f = x - j;
    out[i] = Math.round((src[j] ?? 0) * (1 - f) + (src[Math.min(j + 1, src.length - 1)] ?? 0) * f);
  }
  return out;
}

interface Clip { readonly id: string; readonly voice: string; readonly seconds: number }
function clips(): Clip[] {
  const rows = readFileSync(join(AUDIO_DIR, 'samples.csv'), 'utf8').trim().split(/\r?\n/u);
  const head = rows[0]!.split(',');
  const at = (name: string) => head.indexOf(name);
  return rows.slice(1).map((l) => l.split(',')).filter((r) => r[at('status')] === 'OK')
    .map((r) => ({ id: r[at('sample')]!, voice: r[at('voice')]!, seconds: Number(r[at('audio_s')]) }));
}

/** The socket factory of the arm: `flexible` is the production factory itself; `fixed` rewrites one field of StartRecognition. */
function factoryFor(arm: 'flexible' | 'fixed'): RealtimeSocketFactory {
  if (arm === 'flexible') return nodeWebSocketFactory;
  return (url, init) => {
    const socket = nodeWebSocketFactory(url, init);
    const send = socket.send.bind(socket);
    socket.send = (data: string | Uint8Array) => {
      if (typeof data === 'string' && data.includes('"StartRecognition"')) {
        const message = JSON.parse(data) as { transcription_config: { max_delay_mode: string } };
        message.transcription_config.max_delay_mode = 'fixed';
        send(JSON.stringify(message));
        return;
      }
      send(data);
    };
    return socket;
  };
}

interface FinalRow { readonly arrivedMs: number; readonly startMs: number; readonly endMs: number; readonly lagMs: number; readonly words: number }
interface SessionResult {
  readonly index: number; readonly arm: 'flexible' | 'fixed'; readonly voice: string; readonly clips: number; readonly audioMs: number;
  readonly finals: FinalRow[]; readonly interims: number; readonly gapsWhileSpeakingMs: number[]; readonly firstFinalMs: number | null;
  readonly finalize: string; readonly usage: unknown; readonly error: string | null;
}

async function session(index: number, arm: 'flexible' | 'fixed', voice: string, pool: Clip[], random: () => number, apiKey: string): Promise<SessionResult> {
  // The session's audio: clips of one voice, in a seeded order, each followed by a breath, until SESSION_S.
  const parts: Int16Array[] = [];
  let samples = 0;
  let used = 0;
  const mine = pool.filter((c) => c.voice === voice).sort(() => random() - 0.5);
  for (const c of mine) {
    if (samples >= SESSION_S * 16_000) break;
    const pcm = wav16k(join(AUDIO_DIR, 'audio', `${c.id}.wav`));
    parts.push(pcm, new Int16Array(Math.round((250 + random() * 200) * 16)));
    samples += pcm.length + parts.at(-1)!.length;
    used += 1;
  }
  const all = new Int16Array(samples);
  let o = 0;
  for (const p of parts) { all.set(p, o); o += p.length; }
  const bytes = Buffer.from(all.buffer);
  const audioMs = Math.round(bytes.length / SPEECHMATICS_REALTIME_BYTES_PER_MS);

  const config = loadSpeechmaticsRealtimeConfig({ SPEECHMATICS_API_KEY: apiKey });
  const adapter = new SpeechmaticsRealtimeAdapter({ ...config, apiKey }, { socketFactory: factoryFor(arm) });
  const controller = new AbortController();
  const finals: FinalRow[] = [];
  let interims = 0;
  let t0: number | null = null;
  let error: string | null = null;
  let finalize = 'NOT_RUN';
  let usage: unknown = null;
  const s = await adapter.openStream({ language: 'ar_en', signal: controller.signal });
  const reader = (async () => {
    for await (const event of s.events) {
      if (event.kind === 'INTERIM') { interims += 1; continue; }
      const arrivedMs = t0 === null ? 0 : performance.now() - t0;
      finals.push({ arrivedMs, startMs: event.speech.startMs, endMs: event.speech.endMs, lagMs: arrivedMs - event.speech.endMs, words: event.speech.text.trim().split(/\s+/u).filter(Boolean).length });
    }
  })().catch((e: unknown) => { error = (e as Error).message ?? String(e); });
  const frame = FRAME_MS * SPEECHMATICS_REALTIME_BYTES_PER_MS;
  try {
    for (let k = 0; k * frame < bytes.length; k += 1) {
      if (t0 === null) t0 = performance.now();
      await s.send(bytes.subarray(k * frame, Math.min(bytes.length, (k + 1) * frame)));
      const due = t0 + (k + 1) * FRAME_MS;
      const wait = due - performance.now();
      if (wait > 1) await sleep(wait);
    }
    finalize = await s.finalize();
    usage = (await s.end()).usage;
  } catch (e) {
    error = (e as Error).message ?? String(e);
    s.abort();
  }
  await reader;
  // Gaps between FINAL arrivals while audio was being sent (the first counted from the stream's start).
  const speakingEnd = audioMs;
  const arrivals = finals.map((f) => f.arrivedMs).filter((a) => a <= speakingEnd);
  const gaps = arrivals.map((a, i) => a - (i === 0 ? 0 : arrivals[i - 1]!));
  if (arrivals.length) gaps.push(speakingEnd - arrivals.at(-1)!); else gaps.push(speakingEnd);
  return { index, arm, voice, clips: used, audioMs, finals, interims, gapsWhileSpeakingMs: gaps, firstFinalMs: finals[0]?.arrivedMs ?? null, finalize, usage, error };
}

async function main(): Promise<void> {
  if (process.env.INTEL_LIVE_01_PAID !== 'AUTHORISED') throw new Error('INTEL_LIVE_01_PROOF_REFUSED: the paid run needs INTEL_LIVE_01_PAID=AUTHORISED');
  const keyFile = process.env.INTEL_LIVE_01_SPEECHMATICS_KEY_FILE;
  if (!keyFile) throw new Error('INTEL_LIVE_01_SPEECHMATICS_KEY_FILE is required');
  const apiKey = readFileSync(keyFile, 'utf8').trim();
  mkdirSync(join(OUT, RUN_ID), { recursive: true });
  const pool = clips();
  const random = prng(2025);
  const results: SessionResult[] = [];
  let spentUsd = 0;
  for (const [index, arm] of ARMS.entries()) {
    const next = ((SESSION_S + 5) / 3600) * USD_PER_AUDIO_HOUR;
    if (spentUsd + next > CEILING_USD) { process.stdout.write(`  STOP before session ${index}: the ceiling USD ${CEILING_USD} would be passed\n`); break; }
    const voice = index % 2 === 0 ? 'Achird' : 'Sulafat';
    const r = await session(index, arm, voice, pool, random, apiKey);
    spentUsd += (r.audioMs / 3_600_000) * USD_PER_AUDIO_HOUR;
    results.push(r);
    const lags = r.finals.filter((f) => f.arrivedMs <= r.audioMs).map((f) => f.lagMs);
    process.stdout.write(`  session ${index} ${arm.padEnd(8)} ${voice.padEnd(7)} audio ${(r.audioMs / 1000).toFixed(1)} s  finals ${r.finals.length}  L p50 ${pct(lags, 50)?.toFixed(0)} p95 ${pct(lags, 95)?.toFixed(0)} ms  max gap ${Math.max(...r.gapsWhileSpeakingMs).toFixed(0)} ms  ${r.error ? `ERROR ${r.error}` : ''}\n`);
    if (r.error) break;
  }
  const byArm = (arm: 'flexible' | 'fixed') => {
    const rs = results.filter((r) => r.arm === arm);
    const lags = rs.flatMap((r) => r.finals.filter((f) => f.arrivedMs <= r.audioMs).map((f) => f.lagMs));
    const gaps = rs.flatMap((r) => r.gapsWhileSpeakingMs);
    const words = rs.flatMap((r) => r.finals.map((f) => f.words));
    const finalsPerMin = rs.reduce((n, r) => n + r.finals.length, 0) / Math.max(1e-9, rs.reduce((n, r) => n + r.audioMs, 0) / 60_000);
    return {
      sessions: rs.length, audioS: rs.reduce((n, r) => n + r.audioMs, 0) / 1000, finals: rs.reduce((n, r) => n + r.finals.length, 0), finalsPerMin,
      lagMs: { p50: pct(lags, 50), p95: pct(lags, 95), max: lags.length ? Math.max(...lags) : null },
      gapWhileSpeakingMs: { p50: pct(gaps, 50), p95: pct(gaps, 95), max: gaps.length ? Math.max(...gaps) : null },
      wordsPerFinal: { p50: pct(words, 50), p95: pct(words, 95) },
      stop: (pct(lags, 95) ?? Infinity) > L_P95_STOP_MS || (gaps.length ? Math.max(...gaps) : Infinity) > GAP_STOP_MS,
    };
  };
  const report = {
    runId: RUN_ID, sessionS: SESSION_S, rule: { lP95StopMs: L_P95_STOP_MS, gapStopMs: GAP_STOP_MS },
    spendUsd: { estimated: spentUsd, basis: `${USD_PER_AUDIO_HOUR} USD / audio hour (Speechmatics Enhanced realtime list price, CP0 v1.1)`, ceilingUsd: CEILING_USD },
    flexible: byArm('flexible'), fixed: byArm('fixed'),
    errors: results.filter((r) => r.error).map((r) => ({ index: r.index, error: r.error })),
  };
  writeFileSync(join(OUT, RUN_ID, 'a0-cadence.json'), JSON.stringify({ report, sessions: results }, null, 2));
  process.stdout.write(`\n${JSON.stringify(report, null, 2)}\n`);
  const configured = report.flexible;
  process.stdout.write(`\nA0 ${configured.sessions > 0 && !configured.stop && report.errors.length === 0 ? 'PASS (no STOP)' : 'STOP FOR THE PO'}: flexible L-P95 ${configured.lagMs.p95?.toFixed(0)} ms (rule ≤ ${L_P95_STOP_MS}), max gap while speaking ${configured.gapWhileSpeakingMs.max?.toFixed(0)} ms (rule ≤ ${GAP_STOP_MS})\n`);
}

main().then(() => process.exit(0), (error) => {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exit(1);
});
