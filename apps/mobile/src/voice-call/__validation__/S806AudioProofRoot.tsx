/**
 * S8B-06 CP1 — the native audio engine's real-Android proof root. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes an entry point only
 * when `apps/mobile/scripts/select-s806-proof-entry.mjs --apply` points `main` at `s806-proof-entry.tsx` for one proof
 * build (S806_DEVICE_PROOF=1) installed under its own package, which the S8B-06 CP1 record names in its evidence.
 *
 * It runs the PRODUCTION call code (LiveCallSession = LiveCallClient + the native engine) against the fake call gateway
 * (`scripts/s8b-06/fake-call-gateway.cjs`, synthetic Opus, no provider) reached through `adb reverse tcp:8806 tcp:8806`.
 * The cleartext loopback is allowed here only (`insecureLoopbackForProof`).
 *
 *   E1–E9  echo only (E6–E9 = the positive control on four capture sources: no call processing asked for): a 20 s synthetic reply and nobody speaks — false cuts (STOP) or candidates (REPORT_ONLY), the
 *          microphone level against the reply level per frame, with the canceller on / disabled / raw microphone.
 *   B1 B2  true barge-in, repeated: speak over the reply (a person, or the host stimulus) — the stop latency (the
 *          AudioTrack timestamp origin), onset → detection, the final heard mark, late packets after the cut, and the
 *          uplink around the onset as the gateway received it (first words).
 *   A1     acoustic cross-check: raw microphone, no canceller, a forced cut at a random instant — when the reply's sound
 *          actually leaves the microphone, against the timestamp estimate.
 *   L1     late, repeated, reordered and wrong-epoch reply packets, then a cut with late packets behind it.
 *   R1     reconnection with a durable lag: resend, new epoch, capture clock unbroken; then a MUTED gap.
 *   H1     lifecycle: five open / end cycles, the engine stopped after each; mute; describe after stop.
 *   P0     start WITHOUT microphone permission: the engine refuses and the call is ended (no silent call).
 *
 * Results are shown (testID `s806-log`) and posted to the gateway as numbers only: no audio, no samples, no token.
 */
import { useState } from 'react';
import { PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { LiveCallSession, type LiveCallSessionEvent } from '../live-call-session';
import { loadVoiceCallEngine, type EngineBargeIn, type EngineStartOptions } from '../voice-call-engine';

const GATEWAY = 'http://127.0.0.1:8806';
const SOCKET_URL = 'ws://127.0.0.1:8806/voice/calls/connect';
/** The fake gateway's fixed synthetic bearer (no account exists here). */
const SYNTHETIC_TOKEN = 's806-local-synthetic-token';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clock = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

function uuid(): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16]!, 16) & 3) | 8).toString(16);
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function gateway(path: string, method: 'GET' | 'POST' = 'POST'): Promise<Record<string, unknown>> {
  const response = await fetch(`${GATEWAY}${path}`, { method });
  return (await response.json()) as Record<string, unknown>;
}

async function post(test: string, body: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${GATEWAY}/fv/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test, ...body }) });
  } catch {
    // Best effort; the screen keeps the result.
  }
}

function quantile(values: readonly number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return Math.round(sorted[i]! * 100) / 100;
}

const stats = (values: readonly number[]) => ({
  n: values.length, p50: quantile(values, 0.5), p95: quantile(values, 0.95), max: values.length ? Math.round(Math.max(...values) * 100) / 100 : null,
  min: values.length ? Math.round(Math.min(...values) * 100) / 100 : null,
});

interface Timed {
  readonly at: number;
  readonly e: LiveCallSessionEvent;
}

/** One proof call: the production session, every event it emits, and waits over them. */
class ProofCall {
  readonly events: Timed[] = [];
  /** The newest capture instant sent (uplink events are not kept: 50 a second). */
  lastUplinkMs = -20;
  readonly session: LiveCallSession;
  readonly engine = loadVoiceCallEngine();
  private waiters: { pred: (t: Timed) => boolean; resolve: (t: Timed | null) => void }[] = [];

  constructor(readonly options: EngineStartOptions) {
    if (!this.engine) throw new Error('ENGINE_NOT_LINKED');
    this.session = new LiveCallSession({
      url: SOCKET_URL, accessToken: () => SYNTHETIC_TOKEN, callId: uuid(), sessionId: uuid(), clientInstanceId: uuid(),
      insecureLoopbackForProof: true, engine: this.engine, engineOptions: options,
      onEvent: (e) => {
        const t = { at: clock(), e };
        if (e.source === 'engine' && e.event.type === 'uplink') {
          this.lastUplinkMs = e.event.captureMs;
          return;
        }
        this.events.push(t);
        for (const w of [...this.waiters]) if (w.pred(t)) {
          this.waiters.splice(this.waiters.indexOf(w), 1);
          w.resolve(t);
        }
      },
    });
  }

  waitFor(pred: (t: Timed) => boolean, timeoutMs: number, since = 0): Promise<Timed | null> {
    const found = this.events.find((t) => t.at >= since && pred(t));
    if (found) return Promise.resolve(found);
    return new Promise((resolve) => {
      const waiter = { pred: (t: Timed) => t.at >= since && pred(t), resolve };
      this.waiters.push(waiter);
      setTimeout(() => {
        const i = this.waiters.indexOf(waiter);
        if (i >= 0) {
          this.waiters.splice(i, 1);
          resolve(null);
        }
      }, timeoutMs);
    });
  }

  of<T extends LiveCallSessionEvent['event']['type']>(type: T, since = 0): (Timed & { ev: Extract<LiveCallSessionEvent['event'], { type: T }> })[] {
    return this.events.filter((t) => t.at >= since && t.e.event.type === type).map((t) => ({ ...t, ev: t.e.event as never }));
  }

  async open(): Promise<boolean> {
    this.session.start();
    const active = await this.waitFor((t) => t.e.source === 'client' && t.e.event.type === 'state' && t.e.event.message.state === 'ACTIVE', 6000);
    return active !== null;
  }

  async end(): Promise<string | null> {
    this.session.end();
    const ended = await this.waitFor((t) => t.e.source === 'client' && t.e.event.type === 'ended', 4000);
    const stopped = await this.waitFor((t) => t.e.source === 'engine' && t.e.event.type === 'engineState' && t.e.event.state === 'STOPPED', 3000);
    await this.session.dispose();
    return `${ended ? (ended.e.event as { reason: string }).reason : 'NOT_ENDED'}/${stopped ? 'ENGINE_STOPPED' : 'ENGINE_NOT_STOPPED'}`;
  }

  /** Requests a reply from the gateway and returns its turn and the instant it was asked for. */
  async reply(query: string): Promise<{ turn: number; chunks: number; at: number }> {
    const at = clock();
    const r = await gateway(`/fv/reply?${query}`);
    if (typeof r.turn !== 'number') throw new Error(`REPLY_REFUSED ${JSON.stringify(r)}`);
    return { turn: r.turn, chunks: r.chunks as number, at };
  }
}

function admissions(call: ProofCall, turn: number) {
  const counts: Record<string, number> = {};
  for (const t of call.of('replyAdmission')) if (t.ev.callTurnIndex === turn) counts[t.ev.admission] = (counts[t.ev.admission] ?? 0) + 1;
  return counts;
}

/**
 * Playout truth on the device: every heard mark sent is behind what had been admitted (by at least the platform's output
 * latency), and never ahead of the time elapsed since the turn's first admitted packet.
 */
function playoutTruth(call: ProofCall, turn: number) {
  const admitted = call.of('replyAdmission').filter((t) => t.ev.callTurnIndex === turn && t.ev.admission === 'ACCEPT');
  const first = admitted[0]?.at ?? null;
  const lagMs: number[] = [];
  let aheadOfAdmitted = 0;
  let aheadOfTime = 0;
  for (const p of call.of('playout')) {
    if (p.ev.callTurnIndex !== turn || first === null) continue;
    const admittedMs = admitted.filter((a) => a.at <= p.at).length * 20;
    lagMs.push(admittedMs - p.ev.playedMs);
    if (p.ev.playedMs > admittedMs) aheadOfAdmitted += 1;
    if (p.ev.playedMs > p.at - first + 20) aheadOfTime += 1;
  }
  const sources = [...new Set(call.of('playout').filter((p) => p.ev.callTurnIndex === turn).map((p) => p.ev.source))];
  return { marks: lagMs.length, admittedMinusPlayedMs: stats(lagMs), aheadOfAdmitted, aheadOfTime, sources, sent: call.of('playoutSent').filter((p) => p.ev.callTurnIndex === turn).length };
}

/** The microphone against the reply, per 20 ms frame while QANDEEL was audible (the levels trace). */
function echoLevels(call: ProofCall, since: number) {
  const mic: number[] = [];
  const ref: number[] = [];
  const erl: number[] = [];
  let aboveGuard = 0;
  let floor: number | null = null;
  for (const t of call.of('levels', since)) {
    const r = t.ev.report as { levelsDb: number[]; refDb: (number | null)[]; floorDb: number };
    floor = r.floorDb;
    r.levelsDb.forEach((m, i) => {
      const ref0 = r.refDb[i];
      if (ref0 === null || ref0 === undefined) return;
      mic.push(m);
      ref.push(ref0);
      erl.push(ref0 - m);
      if (m >= ref0 - 18) aboveGuard += 1;
    });
  }
  return { audibleFrames: mic.length, micDb: stats(mic), refDb: stats(ref), refMinusMicDb: stats(erl), framesAboveEchoGuard: aboveGuard, lastFloorDb: floor };
}

async function firstWords(cut: EngineBargeIn) {
  const from = Math.max(0, cut.onsetCaptureMs - 400);
  const rows = (await gateway(`/fv/levels?from=${from}&to=${cut.detectCaptureMs + 100}`, 'GET')) as unknown as [number, number, number, number][];
  let holes = 0;
  for (let i = 1; i < rows.length; i += 1) if (rows[i]![0] !== rows[i - 1]![0] + 20) holes += 1;
  const before = rows.filter((r) => r[0] < cut.onsetCaptureMs - 100).map((r) => r[2]);
  const onset = rows.filter((r) => r[0] >= cut.onsetCaptureMs && r[0] < cut.onsetCaptureMs + 100).map((r) => r[2]);
  return {
    receivedFromMs: rows[0]?.[0] ?? null, receivedToMs: rows.at(-1)?.[0] ?? null, packets: rows.length, holes,
    expectedPackets: Math.floor((cut.detectCaptureMs + 100 - from) / 20) + 1,
    uplinkDbBeforeOnset: stats(before), uplinkDbFirst100msOfSpeech: stats(onset),
  };
}

type Log = (line: string) => void;

async function openCall(log: Log, options: EngineStartOptions): Promise<ProofCall | null> {
  await gateway('/fv/reset');
  const call = new ProofCall(options);
  if (!(await call.open())) {
    log('call did not become ACTIVE');
    await call.session.dispose();
    return null;
  }
  return call;
}

function device() {
  const c = Platform.constants as unknown as Record<string, unknown>;
  return { os: Platform.OS, api: Platform.Version, brand: c.Brand ?? null, model: c.Model ?? null, manufacturer: c.Manufacturer ?? null };
}

// ------------------------------------------------------------------ scenarios

async function echoOnly(log: Log, test: string, options: EngineStartOptions, replyMs = 20_000) {
  const call = await openCall(log, { ...options, trace: true });
  if (!call) return;
  const describe = call.engine!.describe();
  await wait(1500);
  const since = clock();
  const reply = await call.reply(`ms=${replyMs}`);
  await call.waitFor((t) => (t.e.event.type === 'replyDrained' && t.e.event.callTurnIndex === reply.turn) || (t.e.event.type === 'bargeIn' && t.e.event.action === 'STOP'), replyMs + 4000, since);
  await wait(1200);
  const cuts = call.of('bargeIn', since).filter((t) => t.ev.action === 'STOP' && !t.ev.forced);
  const candidates = call.of('bargeIn', since).filter((t) => t.ev.action === 'REPORT_ONLY');
  const result = {
    options, describe, device: device(), replyMs, falseCuts: cuts.length, reportOnlyCandidates: candidates.length,
    cutAtPlayedMs: cuts.map((c) => c.ev.finalPlayedMs ?? null), candidateCaptureMs: candidates.map((c) => c.ev.onsetCaptureMs),
    quietOnsets: call.of('speech', since).length, echo: echoLevels(call, since), playout: playoutTruth(call, reply.turn), admissions: admissions(call, reply.turn),
  };
  const summary = await gateway('/fv/summary', 'GET');
  result.describe = { ...describe, ...(call.engine!.describe() ?? {}) };
  const ended = await call.end();
  await post(test, { ...result, ended, gateway: summary });
  log(`${test}: falseCuts=${result.falseCuts} candidates=${result.reportOnlyCandidates} mic p50=${result.echo.micDb.p50} ref−mic p50=${result.echo.refMinusMicDb.p50} aboveGuard=${result.echo.framesAboveEchoGuard}/${result.echo.audibleFrames} lag p50=${result.playout.admittedMinusPlayedMs.p50} ahead=${result.playout.aheadOfAdmitted}/${result.playout.aheadOfTime} ${ended}`);
}

/**
 * True barge-in with a person's voice under real (street) noise. The person speaks only at the on-screen cue, shown at a
 * random instant 2–4 s into the reply, so a cut whose onset precedes the cue (+150 ms, faster than any reaction) is
 * evidence it was NOT the person: it is reported as BEFORE_CUE and kept out of the person's first-words figures. The stop
 * latency is the engine's for every cut.
 */
async function trueBargeIn(log: Log, test: string, options: EngineStartOptions, reps: number, cue: (text: string | null) => void) {
  const call = await openCall(log, { ...options, trace: true });
  if (!call) return;
  const describe = call.engine!.describe();
  const runs: Record<string, unknown>[] = [];
  await wait(1500);
  for (let rep = 0; rep < reps; rep += 1) {
    const since = clock();
    const reply = await call.reply('ms=12000&late=5');
    cue(`${rep + 1}/${reps} — انتظر… (wait)`);
    const cueDelay = 2000 + Math.random() * 2000;
    const early = await call.waitFor((t) => t.e.event.type === 'bargeIn' && t.e.event.action === 'STOP' && t.e.event.callTurnIndex === reply.turn, cueDelay, since);
    const cueCaptureMs = early ? null : call.lastUplinkMs;
    if (!early) cue('تكلم الآن — SPEAK NOW');
    const cutT = early ?? (await call.waitFor((t) => t.e.event.type === 'bargeIn' && t.e.event.action === 'STOP' && t.e.event.callTurnIndex === reply.turn, 8000, since));
    cue(null);
    if (!cutT) {
      runs.push({ rep, miss: true, cueCaptureMs });
      log(`${test} #${rep + 1}: no barge-in (miss)`);
      await call.waitFor((t) => t.e.event.type === 'replyDrained' && t.e.event.callTurnIndex === reply.turn, 4000, since);
      await wait(1500);
      continue;
    }
    const cut = cutT.e.event as EngineBargeIn;
    const byCue = cueCaptureMs === null || cut.onsetCaptureMs < cueCaptureMs + 150 ? 'BEFORE_CUE' : 'AFTER_CUE';
    await wait(700);
    const run = {
      rep, byCue, cueCaptureMs, reactionMs: cueCaptureMs === null ? null : cut.onsetCaptureMs - cueCaptureMs,
      stopLatencyMs: cut.stopLatencyMs, stopSource: cut.stopSource, onsetToDetectMs: cut.detectCaptureMs - cut.onsetCaptureMs,
      onsetCaptureMs: cut.onsetCaptureMs, detectCaptureMs: cut.detectCaptureMs, finalChunkSeq: cut.finalChunkSeq ?? null, finalPlayedMs: cut.finalPlayedMs ?? null,
      fadeAfterDetectMs: cut.fadeAppliedAtNs && cut.detectedAtNs ? (cut.fadeAppliedAtNs - cut.detectedAtNs) / 1e6 : null,
      admissions: admissions(call, reply.turn), playout: playoutTruth(call, reply.turn),
      bargeInSent: call.of('bargeInSent', since).length, jsEventDelayMs: null as number | null, firstWords: await firstWords(cut),
    };
    runs.push(run);
    log(`${test} #${rep + 1}: ${byCue} reaction=${String(run.reactionMs)} stop=${run.stopLatencyMs?.toFixed(1)} ms (${run.stopSource}) onset→detect=${run.onsetToDetectMs} late dropped=${run.admissions.LATE_AFTER_CUT ?? 0} holes=${run.firstWords.holes}`);
    await wait(3000);
  }
  const done = runs.filter((r) => !r.miss) as { stopLatencyMs: number; onsetToDetectMs: number; byCue: string; reactionMs: number | null }[];
  const person = done.filter((r) => r.byCue === 'AFTER_CUE');
  const summary = await gateway('/fv/summary', 'GET');
  const result = {
    options, describe, device: device(), reps, misses: runs.length - done.length, beforeCue: done.length - person.length, afterCue: person.length,
    stopLatencyMs: stats(done.map((r) => r.stopLatencyMs)), stopLatencyAfterCueMs: stats(person.map((r) => r.stopLatencyMs)),
    reactionMs: stats(person.map((r) => r.reactionMs ?? 0)),
    onsetToDetectMs: stats(done.map((r) => r.onsetToDetectMs)), runs, echo: echoLevels(call, 0),
  };
  const ended = await call.end();
  await post(test, { ...result, ended, gateway: summary });
  log(`${test}: cues ${result.afterCue}/${reps} (before cue ${result.beforeCue}) n=${result.stopLatencyMs.n} stop P50=${result.stopLatencyMs.p50} P95=${result.stopLatencyMs.p95} Max=${result.stopLatencyMs.max} misses=${result.misses} ${ended}`);
}

/** Raw microphone, no canceller, speaker: when the reply's sound leaves the microphone after a forced cut. */
async function acoustic(log: Log, reps: number) {
  const call = await openCall(log, { route: 'SPEAKER', capture: 'UNPROCESSED_PROOF', aec: false, bargeIn: 'STOP', trace: true });
  if (!call) return;
  const describe = call.engine!.describe();
  const runs: Record<string, unknown>[] = [];
  await wait(1500);
  for (let rep = 0; rep < reps; rep += 1) {
    const since = clock();
    const reply = await call.reply('ms=8000');
    await call.waitFor((t) => t.e.event.type === 'playout' && t.e.event.callTurnIndex === reply.turn, 3000, since);
    await wait(1500 + Math.random() * 2500);
    const engine = call.engine as NonNullable<ReturnType<typeof loadVoiceCallEngine>>;
    engine.forceBargeIn();
    const traceT = await call.waitFor((t) => t.e.event.type === 'bargeInTrace', 3000, since);
    if (!traceT) {
      runs.push({ rep, noTrace: true });
      continue;
    }
    const tr = (traceT.e.event as { report: Record<string, unknown> }).report as Record<string, unknown> & { frames: [number, number, number, number | null, number][] };
    const detected = tr.detectedAtNs as number;
    const frames = tr.frames.filter((f) => f[1] > 0);
    const pre = frames.filter((f) => f[1] >= detected - 500e6 && f[1] < detected - 60e6).map((f) => f[2]);
    const preDb = quantile(pre, 0.5);
    let acousticUpperMs: number | null = null;
    let acousticLowerMs: number | null = null;
    if (preDb !== null) {
      const threshold = preDb - 12;
      for (let i = 0; i + 2 < frames.length; i += 1) {
        const f = frames[i]!;
        if (f[1] < detected - 20e6) continue;
        if (f[2] <= threshold && frames[i + 1]![2] <= threshold && frames[i + 2]![2] <= threshold) {
          acousticUpperMs = (f[1] + 20e6 - detected) / 1e6;
          acousticLowerMs = (f[1] - 20e6 - detected) / 1e6;
          break;
        }
      }
    }
    const run = {
      rep, estimateMs: tr.stopLatencyMs, estimateSource: tr.stopSource, preCutMicDb: preDb, acousticLowerMs, acousticUpperMs,
      postCutMicDb: stats(frames.filter((f) => f[1] > detected + 150e6).map((f) => f[2])), frames: tr.frames.map((f) => [f[0], Math.round((f[1] - detected) / 1e5) / 10, Math.round(f[2] * 10) / 10]),
    };
    runs.push(run);
    log(`A1 #${rep + 1}: estimate=${(run.estimateMs as number)?.toFixed(1)} acoustic ∈ [${acousticLowerMs?.toFixed(0)}, ${acousticUpperMs?.toFixed(0)}] ms pre=${preDb}`);
    await call.waitFor((t) => t.e.event.type === 'replyDrained' && t.e.event.callTurnIndex === reply.turn, 2000, since);
    await wait(1200);
  }
  const good = runs.filter((r) => typeof r.acousticUpperMs === 'number') as { acousticUpperMs: number; estimateMs: number }[];
  const summary = await gateway('/fv/summary', 'GET');
  const result = {
    describe, device: device(), reps, acousticUpperMs: stats(good.map((r) => r.acousticUpperMs)), estimateMs: stats(good.map((r) => r.estimateMs)),
    upperMinusEstimateMs: stats(good.map((r) => r.acousticUpperMs - r.estimateMs)), runs,
  };
  const ended = await call.end();
  await post('A1-acoustic', { ...result, ended, gateway: summary });
  log(`A1: acoustic upper P50=${result.acousticUpperMs.p50} P95=${result.acousticUpperMs.p95} Max=${result.acousticUpperMs.max}; estimate P50=${result.estimateMs.p50} ${ended}`);
}

async function lateAndReordered(log: Log) {
  const call = await openCall(log, { route: 'SPEAKER', capture: 'VOICE_COMMUNICATION', aec: true, bargeIn: 'STOP' });
  if (!call) return;
  await wait(800);
  const since = clock();
  const reply = await call.reply('ms=8000&repeat=7&reorder=5&wrongEpoch=9&jitter=15&late=8');
  await wait(3000);
  (call.engine as NonNullable<ReturnType<typeof loadVoiceCallEngine>>).forceBargeIn();
  await wait(1500);
  const summary = (await gateway('/fv/summary', 'GET')) as { call: { replies: Record<string, number | null>[] } };
  const sent = summary.call.replies.find((r) => r.turn === reply.turn) ?? {};
  const counts = admissions(call, reply.turn);
  const cut = call.of('bargeIn', since)[0]?.ev;
  const result = {
    device: device(), admissions: counts, clientWrongEpoch: call.session.client.counters.replyWrongEpoch, gatewaySent: sent,
    finalPlayedMs: cut?.finalPlayedMs ?? null, playout: playoutTruth(call, reply.turn),
    checks: {
      wrongEpochAllDropped: call.session.client.counters.replyWrongEpoch === sent.wrongEpochSent,
      repeatsAndReorderedDropped: (counts.REPEATED_OR_REORDERED ?? 0) === (sent.repeatsSent ?? 0) + (sent.reorderedSent ?? 0),
      lateAfterCutDropped: (counts.LATE_AFTER_CUT ?? 0) === sent.sentAfterCut,
    },
  };
  const ended = await call.end();
  await post('L1-late-reordered', { ...result, ended, gateway: summary });
  log(`L1: ${JSON.stringify(result.admissions)} wrongEpoch=${result.clientWrongEpoch}/${String(sent.wrongEpochSent)} checks=${JSON.stringify(result.checks)} ${ended}`);
}

async function resume(log: Log) {
  const call = await openCall(log, { route: 'EARPIECE', capture: 'VOICE_COMMUNICATION', aec: true, bargeIn: 'STOP' });
  if (!call) return;
  await wait(3000);
  await gateway('/fv/durable-lag?ms=400');
  const since = clock();
  await gateway('/fv/drop');
  const resumed = await call.waitFor((t) => t.e.source === 'client' && t.e.event.type === 'state' && t.e.event.message.epoch === 2, 6000, since);
  const resent = call.of('resent', since)[0]?.ev ?? null;
  await gateway('/fv/durable-lag?ms=0');
  await wait(2000);
  const muted = call.session.setMuted(true);
  await wait(1000);
  const unmuted = call.session.setMuted(false);
  await wait(1500);
  const summary = (await gateway('/fv/summary', 'GET')) as { call: Record<string, unknown> };
  const result = {
    device: device(), resumed: resumed !== null, resumeFromCaptureMs: resumed ? (resumed.e.event as { message: { resumeFromCaptureMs: number } }).message.resumeFromCaptureMs : null,
    resent, counters: call.session.client.counters, muted, unmuted, gateway: summary.call,
  };
  const ended = await call.end();
  await post('R1-resume', { ...result, ended });
  const g = summary.call;
  log(`R1: resumed=${result.resumed} from=${result.resumeFromCaptureMs} resent=${JSON.stringify(resent)} epochs=${JSON.stringify(g.epochsSeen)} captureBreaks=${String(g.captureBreaks)} seqBreaks=${String(g.seqBreaks)} gaps=${JSON.stringify(g.gaps)} violations=${JSON.stringify(g.violations)} ${ended}`);
}

async function lifecycle(log: Log) {
  const cycles: Record<string, unknown>[] = [];
  for (let i = 0; i < 5; i += 1) {
    const call = await openCall(log, { route: i % 2 ? 'SPEAKER' : 'EARPIECE', capture: 'VOICE_COMMUNICATION', aec: true, bargeIn: 'STOP' });
    if (!call) {
      cycles.push({ i, opened: false });
      continue;
    }
    const describe = call.engine!.describe();
    await wait(1200);
    const ended = await call.end();
    cycles.push({ i, opened: true, audioModeDuring: describe?.audioMode ?? null, routeDevice: describe?.routeDevice ?? null, ended, after: call.engine!.describe() });
  }
  await post('H1-lifecycle', { device: device(), cycles });
  log(`H1: ${cycles.map((c) => `${String(c.opened)}:${String(c.ended)}`).join(' ')}`);
}

async function noPermission(log: Log) {
  const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  await gateway('/fv/reset');
  const call = new ProofCall({ route: 'SPEAKER', capture: 'VOICE_COMMUNICATION', aec: true, bargeIn: 'STOP' });
  call.session.start();
  const failed = await call.waitFor((t) => t.e.event.type === 'engineStartFailed', 6000);
  const ended = await call.waitFor((t) => t.e.source === 'client' && t.e.event.type === 'ended', 6000);
  const summary = (await gateway('/fv/summary', 'GET')) as { call: Record<string, unknown> };
  await call.session.dispose();
  const result = { device: device(), permissionGranted: granted, startFailed: failed ? (failed.e.event as { code: string }).code : null, ended: ended ? (ended.e.event as { reason: string }).reason : null, gateway: summary.call };
  await post('P0-no-permission', result);
  log(`P0: granted=${String(granted)} startFailed=${String(result.startFailed)} ended=${String(result.ended)} uplink=${String(summary.call?.uplinkPackets)}`);
}

// ------------------------------------------------------------------ screen

const SPEAKER_ON: EngineStartOptions = { route: 'SPEAKER', capture: 'VOICE_COMMUNICATION', aec: true, bargeIn: 'STOP' };
const EARPIECE_ON: EngineStartOptions = { route: 'EARPIECE', capture: 'VOICE_COMMUNICATION', aec: true, bargeIn: 'STOP' };

const proof = { busy: false };

export function S806AudioProofRoot() {
  const [cueText, setCueText] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([`S8B-06 CP1 proof — ${Platform.OS} ${String(Platform.Version)}`]);
  const log: Log = (line) => setLines((current) => [...current.slice(-80), line]);

  const run = (label: string, task: () => Promise<void>) => async () => {
    if (proof.busy) return;
    proof.busy = true;
    log(`— ${label}`);
    try {
      await task();
    } catch (error) {
      log(`${label} failed: ${(error as Error)?.message ?? String(error)}`);
    } finally {
      proof.busy = false;
    }
  };

  const buttons: [string, () => Promise<void>][] = [
    ['MIC', async () => log(`permission: ${await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)}`)],
    ['DESC', async () => {
      const call = await openCall(log, SPEAKER_ON);
      if (!call) return;
      const d = call.engine!.describe();
      log(JSON.stringify(d));
      await post('D0-describe', { device: device(), describe: d, ended: await call.end() });
    }],
    ['P0', () => noPermission(log)],
    ['E1 spk', () => echoOnly(log, 'E1-echo-speaker-aec', SPEAKER_ON)],
    ['E2 ear', () => echoOnly(log, 'E2-echo-earpiece-aec', EARPIECE_ON)],
    ['E3 off', () => echoOnly(log, 'E3-echo-speaker-aec-disabled', { ...SPEAKER_ON, aec: false, bargeIn: 'REPORT_ONLY' })],
    ['E4 raw', () => echoOnly(log, 'E4-echo-speaker-raw-mic', { route: 'SPEAKER', capture: 'UNPROCESSED_PROOF', aec: false, bargeIn: 'REPORT_ONLY' })],
    ['E5 rpt', () => echoOnly(log, 'E5-echo-speaker-aec-report-only', { ...SPEAKER_ON, bargeIn: 'REPORT_ONLY' })],
    ['E6 ctl', () => echoOnly(log, 'E6-echo-positive-control-media-raw', { route: 'SPEAKER', capture: 'RAW_MEDIA_PROOF', aec: false, bargeIn: 'REPORT_ONLY' })],
    ['E7 prf', () => echoOnly(log, 'E7-echo-positive-control-performance', { route: 'SPEAKER', capture: 'RAW_PERFORMANCE_PROOF', aec: false, bargeIn: 'REPORT_ONLY' })],
    ['E8 cam', () => echoOnly(log, 'E8-echo-positive-control-camcorder', { route: 'SPEAKER', capture: 'RAW_CAMCORDER_PROOF', aec: false, bargeIn: 'REPORT_ONLY' })],
    ['E9 unp', () => echoOnly(log, 'E9-echo-positive-control-unprocessed', { route: 'SPEAKER', capture: 'RAW_UNPROCESSED_PROOF', aec: false, bargeIn: 'REPORT_ONLY' })],
    ['B1 spk', () => trueBargeIn(log, 'B1-barge-in-speaker', SPEAKER_ON, 10, setCueText)],
    ['B2 ear', () => trueBargeIn(log, 'B2-barge-in-earpiece', EARPIECE_ON, 10, setCueText)],
    ['A1', () => acoustic(log, 10)],
    ['L1', () => lateAndReordered(log)],
    ['R1', () => resume(log)],
    ['H1', () => lifecycle(log)],
  ];

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {cueText ? (
        <Text testID="s806-cue" style={styles.cue}>
          {cueText}
        </Text>
      ) : null}
      <View style={styles.grid}>
        {buttons.map(([label, task]) => (
          <Pressable key={label} testID={`s806-${label.split(' ')[0]!.toLowerCase()}`} accessibilityRole="button" onPress={run(label, task)} style={styles.button}>
            <Text style={styles.buttonText}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView style={styles.log} testID="s806-log">
        {lines.map((line, i) => (
          <Text key={`${i}-${line.slice(0, 12)}`} style={styles.line}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff', paddingTop: 48, paddingHorizontal: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { width: '23%', paddingVertical: 14, backgroundColor: '#1f3b57', borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  log: { flex: 1, marginTop: 12 },
  cue: { fontSize: 34, fontWeight: '700', color: '#b00020', textAlign: 'center', paddingVertical: 16 },
  line: { fontSize: 11, color: '#111111', fontFamily: Platform.OS === 'android' ? 'monospace' : undefined, marginBottom: 4 },
});
