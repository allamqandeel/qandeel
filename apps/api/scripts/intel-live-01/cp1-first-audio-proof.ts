/**
 * INTEL-LIVE-01 CP1 — A4: QANDEEL's First Audio with the provisional attention lane ON against OFF (A1 §5 T5; A2 §6 "tail
 * included"), on the S8B-05 CP3 synthetic pattern.
 *
 * REAL: the live call's own commands (0189 / 0190 / 0191: begin, activate, commit, Safety, reply registration, playout,
 * close), the lane's tracker, 0204's writer and 0191's shared background permits — the permit's L2 critical window is the
 * database's own (from the commit until the reply's first segment is registered) — over a REAL local PostgreSQL through 0204.
 * Stand-ins: the PostgREST hop (a pg shim as service_role) and the providers. The live reply's first token and the lane's
 * evaluations share ONE fake provider capacity of two slots (the contention a real account has), with seeded latencies;
 * the reply's draws are the SAME sequence in every mode, so a mode's First Audio differs only by what the lane did to it.
 * Real time (the contention is wall-clock), no paid API, no person, no audio: random UUIDs and fixed synthetic Arabic.
 *
 * Every turn: the person speaks; FINALs reach the lane during the speech; the turn's LAST FINAL reaches the lane after the
 * speech ends, around the commit (the tail), so its evaluation contends with the reply's first token exactly when it can
 * hurt. QANDEEL's reply, once played, is QANDEEL evidence. T5 = the end of the person's speech -> QANDEEL's first audio.
 *
 * Modes, interleaved round by round so a drift of the machine falls on every mode alike:
 *   OFF          the lane absent.
 *   ON           the lane as shipped: one evaluation in flight, the PROVISIONAL_ATTENTION permit with the critical window
 *                respected and no wait.
 *   ON_UNGATED   the worst case: the lane with no permit at all (what the critical window buys is ON vs ON_UNGATED).
 *
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55470/il_p1 \
 *     node node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/intel-live-01/cp1-first-audio-proof.ts
 */
import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataApiError } from '../../src/conversation/supabase-data-api.service';
import { DatabaseBackgroundPermitGate, UNGATED_BACKGROUND_PERMITS, type BackgroundPermitGate } from '../../src/live-analysis/background-permits';
import { CallAttentionRepository } from '../../src/live-attention/call-attention.repository';
import { CallAttentionTracker } from '../../src/live-attention/call-attention.tracker';
import type { AttentionEvaluationInput, AttentionEvaluationResult, AttentionEvaluator, AttentionObservation } from '../../src/live-attention/provisional-attention.types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require('pg') as { Pool: new (config: { connectionString: string; max: number }) => PgPool };
interface PgClient { query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; release(): void }
interface PgPool { connect(): Promise<PgClient>; query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; end(): Promise<void> }

const OUT = process.env.INTEL_LIVE_01_OUT ?? 'E:/QANDEEL_REPORTS/INTEL-LIVE-01/CP1';
const RUN_ID = process.env.INTEL_LIVE_01_RUN_ID ?? `cp1-a4-${new Date().toISOString().replace(/[:.]/gu, '-')}`;
const VOICE_CONSENT_V3 = 'VOICE_RECORDING_V3';
const WORKLOAD = Object.freeze({
  rounds: Number(process.env.INTEL_LIVE_01_A4_ROUNDS ?? 4),
  calls: Number(process.env.INTEL_LIVE_01_A4_CALLS ?? 4),
  turns: Number(process.env.INTEL_LIVE_01_A4_TURNS ?? 6),
  providerSlots: 2,
  userSpeakMs: 4_200,
  finalsPerTurn: 4,
  commitAfterSpeechMs: 800,
  tailFinalAfterSpeechMs: [700, 250] as const,
  replyFirstTokenMs: [380, 160] as const,
  replyTailMs: 450,
  ttsFirstAudioMs: 120,
  replyPlayMs: 2_400,
  evaluationMs: [1_000, 350] as const,
});
const REPLY = 'فاهمك، احكيلي حصل إيه بالظبط.';
const USER_FINALS = ['كنت في الشغل النهارده', 'والمدير طلب مني تقرير جديد', 'وأنا مش عارف أبدأ منين', 'وده مضايقني شوية'];
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const now = () => performance.now();

function loopbackUrl(): string {
  const url = process.env.DATABASE_URL ?? '';
  let host = '';
  try { host = new URL(url).hostname; } catch { host = ''; }
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) throw new Error('INTEL_LIVE_01_PROOF_REFUSED: DATABASE_URL must name a loopback throwaway database');
  return url;
}
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
const jitterFrom = (r: () => number) => ([base, spread]: readonly [number, number]) => Math.max(10, Math.round(base + (r() - 0.5) * 2 * spread));

class SharedCapacity {
  private free: number;
  private readonly waiting: Array<() => void> = [];
  constructor(slots: number) { this.free = slots; }
  async acquire(): Promise<void> {
    if (this.free > 0) { this.free -= 1; return; }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }
  release(): void {
    const next = this.waiting.shift();
    if (next) next(); else this.free += 1;
  }
}

const RPC_NAME = /^server_[a-z0-9_]+$/u;
class PgServiceRoleRpc {
  constructor(private readonly pool: PgPool) {}
  async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    if (!RPC_NAME.test(name)) throw new Error(`INTEL_LIVE_01_PROOF_RPC_NAME ${name}`);
    const entries = Object.entries(body);
    const args = entries.map(([key], i) => `${key} => $${i + 1}`).join(', ');
    const values = entries.map(([, v]) => (Array.isArray(v) && v.length > 0 && v.every((e) => typeof e === 'string')) ? v
      : (v !== null && typeof v === 'object') ? JSON.stringify(v) : v);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE service_role');
      const result = await client.query(`SELECT * FROM public.${name}(${args})`, values);
      await client.query('COMMIT');
      return JSON.parse(JSON.stringify(result.rows)) as T;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      const e = error as { code?: string; message?: string };
      if (process.env.INTEL_LIVE_01_DEBUG === '1') process.stderr.write(`rpc ${name}: ${e.code} ${e.message}
`);
      throw new DataApiError(400, { databaseCode: e.code, databaseMessage: e.message });
    } finally {
      client.release();
    }
  }
}

type Mode = 'OFF' | 'ON' | 'ON_UNGATED';
interface Timing { mode: Mode; round: number; call: number; turn: number; speechEndToFirstAudio: number; commitToFirstAudio: number; tailAdmittedBeforeFirstAudio: boolean }

/** The lane's evaluator: a NONE after a seeded latency, holding one slot of the shared provider capacity. */
class CapacityEvaluator implements AttentionEvaluator {
  calls = 0;
  constructor(private readonly capacity: SharedCapacity, private readonly jitter: (x: readonly [number, number]) => number) {}
  async evaluate(input: AttentionEvaluationInput): Promise<AttentionEvaluationResult> {
    this.calls += 1;
    const start = now();
    await this.capacity.acquire();
    try {
      await sleep(this.jitter(WORKLOAD.evaluationMs));
    } finally {
      this.capacity.release();
    }
    const prompt = 900 + input.newEvidence.length * 20;
    return { kind: 'NONE', developments: [], contextCarry: null, usage: { promptTokens: prompt, cacheHitTokens: Math.round(prompt * 0.8), completionTokens: 18 }, providerMs: Math.round(now() - start) };
  }
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]! : null;
};
const summary = (xs: number[]) => ({ n: xs.length, p50: pct(xs, 50), p95: pct(xs, 95), max: xs.length ? Math.max(...xs) : null, mean: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null });

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: loopbackUrl(), max: 32 });
  const sql = async (text: string, values: unknown[] = []) => (await pool.query(text, values)).rows;
  const shim = new PgServiceRoleRpc(pool);
  const one = async (name: string, body: Record<string, unknown>) => (await shim.rpc<Array<Record<string, unknown>>>(name, body))[0]!;
  const dbPermits = new DatabaseBackgroundPermitGate(shim);
  mkdirSync(join(OUT, RUN_ID), { recursive: true });
  // The disposable clone's call gate and policy, as the S8B-05 CP3 proof sets them (local synthetic proof only).
  await sql("SELECT * FROM voice_private.set_voice_launch_capability_v1('PERSONAL_LIVE_CALL', 'ENABLED', 'SATISFIED', 'intel-live-01-cp1-a4', 'local synthetic proof')");
  await sql(`SELECT voice_private.set_live_call_policy_v1(64, p.reconnect_grace_seconds, p.connect_timeout_seconds, p.seat_lease_seconds,
      p.max_call_seconds, 'intel-live-01-cp1-a4', 'local synthetic proof') FROM voice_private.live_call_policy p`);
  process.stdout.write(`INTEL-LIVE-01 CP1 A4 First Audio, lane ON vs OFF (${JSON.stringify(WORKLOAD)})\n`);

  const person = async () => {
    const user = randomUUID();
    const session = randomUUID();
    await sql('INSERT INTO auth.users(id) VALUES ($1)', [user]);
    await sql("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, user]);
    await shim.rpc('server_grant_voice_recording_consent_v1', { p_user_id: user, p_command_id: randomUUID(), p_consent_version: VOICE_CONSENT_V3 });
    return { user, session };
  };

  const timings: Timing[] = [];
  const observations: Record<Mode, AttentionObservation[]> = { OFF: [], ON: [], ON_UNGATED: [] };
  const evaluatorCalls: Record<Mode, number> = { OFF: 0, ON: 0, ON_UNGATED: 0 };
  const modes: Mode[] = ['OFF', 'ON', 'ON_UNGATED'];

  for (let round = 0; round < WORKLOAD.rounds; round += 1) {
    // Rotate the order within a round, so no mode always runs first on a cold or warm machine.
    const order = modes.map((_, k) => modes[(k + round) % modes.length]!);
    for (const mode of order) {
      const capacity = new SharedCapacity(WORKLOAD.providerSlots);
      const replyRandom = prng(4242 + round); // the SAME reply sequence for every mode of a round
      const replyJitter = jitterFrom(replyRandom);
      const laneJitter = jitterFrom(prng(900 + round));
      const permits: BackgroundPermitGate = mode === 'ON_UNGATED' ? UNGATED_BACKGROUND_PERMITS : dbPermits;
      const evaluator = new CapacityEvaluator(capacity, laneJitter);
      const people = await Promise.all(Array.from({ length: WORKLOAD.calls }, () => person()));

      // Each call's reply draws are taken up front in call order, so concurrency cannot reorder the sequence.
      const draws = people.map(() => Array.from({ length: WORKLOAD.turns }, () => ({ firstToken: replyJitter(WORKLOAD.replyFirstTokenMs), tail: replyJitter(WORKLOAD.tailFinalAfterSpeechMs) })));

      await Promise.all(people.map(async (p, ci) => {
        const call = randomUUID();
        assert.equal((await one('server_begin_call_v1', { p_user_id: p.user, p_session_id: p.session, p_call_id: call, p_client_instance_id: randomUUID() })).outcome, 'BEGUN');
        const a = await one('server_activate_call_v1', { p_user_id: p.user, p_call_id: call, p_connection_epoch: 1 });
        assert.equal(a.outcome, 'ACTIVE');
        const recording = String(a.recording_id);
        const t0 = now();
        const clock = () => Math.round(now() - t0);
        const next = { USER: 0, QANDEEL: 0 };
        const end = { USER: 0, QANDEEL: 0 };
        const audio = async (track: 'USER' | 'QANDEEL', endMs: number) => {
          const r = await sql('SELECT * FROM public.server_add_call_segment_v2($1, $2, 1, $3, $4, $5, $6, 4096, 20)', [p.user, recording, track, next[track], end[track], endMs]);
          assert.equal(r[0]!.outcome, 'ADDED');
          next[track] += 1;
          end[track] = endMs;
        };
        const tracker = mode === 'OFF' ? null : new CallAttentionTracker({
          userId: p.user, callId: call, epoch: 1, evaluator, store: new CallAttentionRepository(shim), permits,
          captureClock: clock, observe: (o) => observations[mode].push(o),
        });
        await tracker?.start();

        for (let turn = 1; turn <= WORKLOAD.turns; turn += 1) {
          const draw = draws[ci]![turn - 1]!;
          const speechStart = clock();
          const step = WORKLOAD.userSpeakMs / WORKLOAD.finalsPerTurn;
          // FINALs during the speech: each reaches the lane ~600 ms after its last word; the last one after the speech ends.
          for (let k = 0; k < WORKLOAD.finalsPerTurn - 1; k += 1) {
            await sleep(step);
            const e = clock();
            setTimeout(() => tracker?.evidence('USER', USER_FINALS[k]!, e - Math.round(step) + 50, e), 600);
          }
          await sleep(step);
          const speechEnd = clock();
          const speechEndAt = now();
          setTimeout(() => tracker?.evidence('USER', USER_FINALS[WORKLOAD.finalsPerTurn - 1]!, speechEnd - Math.round(step) + 50, speechEnd), draw.tail);
          await audio('USER', speechEnd);
          await sleep(Math.max(0, WORKLOAD.commitAfterSpeechMs - (now() - speechEndAt)));
          const content = USER_FINALS.join(' ');
          // 0190's commit, positionally (as the S8B-05 CP3 proof calls it).
          const committed = (await sql("SELECT * FROM public.server_commit_live_call_turn_v1($1, $2, 1, $3, $4, 'SPEECH', $5, 'HIGH', $6, $7, $8, $9, $10)",
            [p.user, call, randomUUID(), randomUUID(), content, speechStart, speechEnd, [], randomUUID(), randomUUID()]))[0]!;
          assert.equal(committed.outcome, 'COMMITTED');
          const idx = Number(committed.call_turn_index);
          const commitAt = now();
          tracker?.turnCommitted();
          assert.equal((await one('server_store_call_turn_safety_v1', { p_user_id: p.user, p_call_id: call, p_call_turn_index: idx, p_safety_disposition: 'ALLOW' })).outcome, 'STORED');
          // The live reply's first token, on the shared capacity.
          await capacity.acquire();
          let firstTokenAt: number;
          let done: Promise<void>;
          try {
            await sleep(draw.firstToken);
            firstTokenAt = now();
          } catch (error) { capacity.release(); throw error; }
          done = sleep(WORKLOAD.replyTailMs).finally(() => capacity.release());
          const registered = await sql('SELECT * FROM public.server_register_call_reply_segment_v1($1, $2, 1, $3, 0, $4, 0, 400, $5)', [p.user, call, idx, REPLY, []]);
          assert.equal(registered[0]!.outcome, 'REGISTERED');
          await sleep(Math.max(0, WORKLOAD.ttsFirstAudioMs - (now() - firstTokenAt)));
          const firstAudioAt = now();
          const tailAdmitted = observations[mode].some((o) => o.kind === 'ATTENTION_ADMITTED' && o.track === 'USER' && o.toClockMs === speechEnd);
          timings.push({ mode, round, call: ci, turn, speechEndToFirstAudio: firstAudioAt - speechEndAt, commitToFirstAudio: firstAudioAt - commitAt, tailAdmittedBeforeFirstAudio: tailAdmitted });
          await done;
          assert.equal((await sql('SELECT * FROM public.server_finish_call_reply_generation_v1($1, $2, 1, $3, \'COMPLETE\', 400)', [p.user, call, idx]))[0]!.outcome, 'FINISHED');
          const playStart = end.QANDEEL;
          const playClockStart = clock();
          await sleep(WORKLOAD.replyPlayMs);
          assert.equal((await sql('SELECT * FROM public.server_confirm_call_playout_v1($1, $2, 1, $3, 400, $4)', [p.user, call, idx, playStart]))[0]!.outcome, 'ADVANCED');
          await audio('QANDEEL', playStart + 400);
          tracker?.evidence('QANDEEL', REPLY, playClockStart, clock());
          const closed = await sql('SELECT * FROM public.server_close_live_call_exchange_v1($1, $2, 1, $3, \'PLAYED_OUT\', $4, $5)', [p.user, call, idx, randomUUID(), randomUUID()]);
          assert.equal(closed[0]!.outcome, 'CLOSED');
        }
        await sleep(3_000); // the last evaluations resolve before the call ends
        await tracker?.close();
        assert.equal((await one('server_end_call_v1', { p_user_id: p.user, p_call_id: call, p_connection_epoch: 1, p_end_reason: 'USER_ENDED' })).outcome, 'ENDED');
      }));
      evaluatorCalls[mode] += evaluator.calls;
      const mine = timings.filter((t) => t.mode === mode && t.round === round).map((t) => t.speechEndToFirstAudio);
      process.stdout.write(`  round ${round} ${mode.padEnd(10)} T5 p50 ${pct(mine, 50)?.toFixed(1)} ms  p95 ${pct(mine, 95)?.toFixed(1)} ms  (evaluations ${evaluator.calls})\n`);
    }
  }

  const of = (mode: Mode) => timings.filter((t) => t.mode === mode).map((t) => t.speechEndToFirstAudio);
  const perRoundP50 = (mode: Mode) => Array.from({ length: WORKLOAD.rounds }, (_, r) => pct(timings.filter((t) => t.mode === mode && t.round === r).map((t) => t.speechEndToFirstAudio), 50)!);
  const offRounds = perRoundP50('OFF');
  const noiseP50 = Math.max(...offRounds) - Math.min(...offRounds);
  const offRoundsP95 = Array.from({ length: WORKLOAD.rounds }, (_, r) => pct(timings.filter((t) => t.mode === 'OFF' && t.round === r).map((t) => t.speechEndToFirstAudio), 95)!);
  const noiseP95 = Math.max(...offRoundsP95) - Math.min(...offRoundsP95);
  const resolved = (mode: Mode) => observations[mode].filter((o): o is Extract<AttentionObservation, { kind: 'ATTENTION_RESOLVED' }> => o.kind === 'ATTENTION_RESOLVED');
  const deferred = (mode: Mode) => observations[mode].filter((o) => o.kind === 'ATTENTION_DEFERRED').length;
  const report = {
    runId: RUN_ID, workload: WORKLOAD,
    T5ms: { OFF: summary(of('OFF')), ON: summary(of('ON')), ON_UNGATED: summary(of('ON_UNGATED')) },
    perRoundP50: { OFF: offRounds, ON: perRoundP50('ON'), ON_UNGATED: perRoundP50('ON_UNGATED') },
    harnessNoise: { p50SpreadAcrossOffRounds: noiseP50, p95SpreadAcrossOffRounds: noiseP95 },
    deltaVsOff: {
      ON: { p50: pct(of('ON'), 50)! - pct(of('OFF'), 50)!, p95: pct(of('ON'), 95)! - pct(of('OFF'), 95)! },
      ON_UNGATED: { p50: pct(of('ON_UNGATED'), 50)! - pct(of('OFF'), 50)!, p95: pct(of('ON_UNGATED'), 95)! - pct(of('OFF'), 95)! },
    },
    lane: Object.fromEntries((['ON', 'ON_UNGATED'] as const).map((m) => [m, {
      evaluations: evaluatorCalls[m], resolved: resolved(m).length, deferredPermit: deferred(m),
      outcomes: resolved(m).reduce<Record<string, number>>((acc, o) => { acc[o.outcome] = (acc[o.outcome] ?? 0) + 1; return acc; }, {}),
      tailAdmittedBeforeFirstAudio: timings.filter((t) => t.mode === m && t.tailAdmittedBeforeFirstAudio).length,
    }])),
  };
  writeFileSync(join(OUT, RUN_ID, 'a4-first-audio.json'), JSON.stringify({ report, timings }, null, 2));
  process.stdout.write(`\n${JSON.stringify(report, null, 2)}\n`);
  // A4: ON - OFF within the harness noise (the spread of OFF itself across rounds), P50 and P95.
  const okP50 = report.deltaVsOff.ON.p50 <= Math.max(noiseP50, 20);
  const okP95 = report.deltaVsOff.ON.p95 <= Math.max(noiseP95, 40);
  process.stdout.write(`\nA4 ${okP50 && okP95 ? 'PASS' : 'FAIL'}: ON - OFF = ${report.deltaVsOff.ON.p50.toFixed(1)} ms P50 (noise ${noiseP50.toFixed(1)}), ${report.deltaVsOff.ON.p95.toFixed(1)} ms P95 (noise ${noiseP95.toFixed(1)})\n`);
  await pool.end();
  if (!(okP50 && okP95)) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
  process.exit(1);
});
