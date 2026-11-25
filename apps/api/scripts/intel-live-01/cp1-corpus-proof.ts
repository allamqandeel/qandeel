/**
 * INTEL-LIVE-01 CP1 — the corpus proof of continuous in-speech understanding (A1 §6 A1′ a–k, A2 §6 A1′-j / A1′-k / A7 /
 * A9 / A10 / A12, and A8′ with the real evaluator).
 *
 * REAL: the call's provisional attention tracker, migration 0204's writer, readers and settlement (through the same
 * service_role RPCs the API calls, over a pg shim with PostgREST's error identity), 0191's shared background permits
 * (PROVISIONAL_ATTENTION, no wait), a local PostgreSQL carrying migrations through 0204. Time is VIRTUAL: the call clock
 * advances from event to event (a FINAL's arrival, an evaluation's result, a retry), and never while a database call or a
 * provider call is in flight, so a 20-minute call runs in seconds and every interval is exact and repeatable.
 *
 * The evaluator is one of two:
 *   FAKE      the annotation oracle: it answers exactly the corpus annotation for the evidence it is shown (it proves the
 *             MECHANISM: coverage, order, no loss, timing plumbing), with seeded latencies; free.
 *   DEEPSEEK  the production evaluator (DeepSeek Flash, the production prompt and parser) on the normal-operation corpus
 *             (a – g, j), its own latency placed on the virtual clock (A8′: semantic recall, judged by a human reviewer).
 *             Paid: refused unless INTEL_LIVE_01_PAID=AUTHORISED, metered at DeepSeek's PEAK list price and stopped before
 *             INTEL_LIVE_01_DEEPSEEK_CEILING_USD (default 0.28 of the PO's USD 0.30). The key is read from the file named by
 *             INTEL_LIVE_01_DEEPSEEK_KEY_FILE into memory only. No cost ledger row is written (no hosted service is reached).
 *
 * The humans are random UUIDs, the speech is the synthetic corpus (corpus.ts). It refuses anything but a loopback database
 * and writes fixture rows into it: run it only on a disposable local clone.
 *
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55470/il_p1 INTEL_LIVE_01_EVALUATOR=FAKE \
 *     node node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/intel-live-01/cp1-corpus-proof.ts
 */
import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataApiError } from '../../src/conversation/supabase-data-api.service';
import { DatabaseBackgroundPermitGate } from '../../src/live-analysis/background-permits';
import { CallAttentionRepository } from '../../src/live-attention/call-attention.repository';
import { CallAttentionTracker } from '../../src/live-attention/call-attention.tracker';
import { DeepSeekAttentionEvaluator, loadAttentionDeepSeekConfig } from '../../src/live-attention/deepseek-attention-evaluator';
import {
  estimatedSpendUsd, type AttentionDevelopment, type AttentionEvaluationInput, type AttentionEvaluationResult, type AttentionEvaluator,
  type AttentionObservation, type AttentionUsage, type ProvisionalAttentionConfig,
} from '../../src/live-attention/provisional-attention.types';
import { createDeepSeekClient } from '../../src/model-router/providers/deepseek/deepseek-client';
import type { LiveCallAttentionDisclosure } from '../../src/voice/call-turn/live-call-attention.port';
import { CORPUS, RECALL_GATE, corpusWords, type Scenario, type Segment, type Track } from './corpus';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require('pg') as { Pool: new (config: { connectionString: string; max: number }) => PgPool };
interface PgClient { query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; release(): void }
interface PgPool { connect(): Promise<PgClient>; query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; end(): Promise<void> }

const MODE = (process.env.INTEL_LIVE_01_EVALUATOR ?? 'FAKE').trim();
if (MODE !== 'FAKE' && MODE !== 'DEEPSEEK') throw new Error('INTEL_LIVE_01_EVALUATOR must be FAKE or DEEPSEEK');
const OUT = process.env.INTEL_LIVE_01_OUT ?? 'E:/QANDEEL_REPORTS/INTEL-LIVE-01/CP1';
const RUN_ID = process.env.INTEL_LIVE_01_RUN_ID ?? `cp1-${MODE.toLowerCase()}-${new Date().toISOString().replace(/[:.]/gu, '-')}`;

function loopbackUrl(): string {
  const url = process.env.DATABASE_URL ?? '';
  let host = '';
  try { host = new URL(url).hostname; } catch { host = ''; }
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) throw new Error('INTEL_LIVE_01_PROOF_REFUSED: DATABASE_URL must name a loopback throwaway database');
  return url;
}

/** Seeded PRNG (mulberry32). */
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

// ------------------------------------------------------------------------------------------------ virtual time
/** Work that holds the virtual clock still: a database call, a provider call. */
class Pending {
  n = 0;
  private waiters: Array<() => void> = [];
  inc(): void { this.n += 1; }
  dec(): void {
    this.n -= 1;
    if (this.n === 0) { const w = this.waiters; this.waiters = []; for (const f of w) f(); }
  }
  idle(): Promise<void> { return this.n === 0 ? Promise.resolve() : new Promise((r) => this.waiters.push(r)); }
}
const pending = new Pending();

class VirtualClock {
  now = 0;
  private seq = 0;
  private readonly timers = new Map<number, { readonly at: number; readonly fn: () => void }>();
  set = (fn: () => void, ms: number): unknown => this.setAt(this.now + Math.max(0, ms), fn);
  setAt(at: number, fn: () => void): number {
    const id = ++this.seq;
    this.timers.set(id, { at: Math.max(at, this.now), fn });
    return id;
  }
  clear = (handle: unknown): void => { this.timers.delete(handle as number); };
  nextAt(): number | null {
    let min: number | null = null;
    for (const t of this.timers.values()) if (min === null || t.at < min) min = t.at;
    return min;
  }
  /** Fires the earliest timer due now (ties in creation order). */
  fireDue(): boolean {
    let best: [number, { at: number; fn: () => void }] | null = null;
    for (const entry of this.timers) if (entry[1].at <= this.now && (!best || entry[1].at < best[1].at || (entry[1].at === best[1].at && entry[0] < best[0]))) best = entry;
    if (!best) return false;
    this.timers.delete(best[0]);
    best[1].fn();
    return true;
  }
  reset(): void { this.timers.clear(); this.now = 0; }
  get size(): number { return this.timers.size; }
}
const vc = new VirtualClock();
const immediate = () => new Promise<void>((r) => setImmediate(r));
async function quiesce(): Promise<void> {
  for (let quiet = 0; quiet < 6;) {
    await immediate();
    if (pending.n > 0) { quiet = 0; await pending.idle(); } else quiet += 1;
  }
}
interface Action { readonly at: number; readonly label: string; readonly run: () => void | Promise<void> }
async function runTimeline(actions: Action[]): Promise<void> {
  const queue = [...actions].sort((x, y) => x.at - y.at);
  for (let guard = 0; guard < 1_000_000; guard += 1) {
    await quiesce();
    if (vc.fireDue()) continue;
    const nextTimer = vc.nextAt();
    const nextAction = queue.length ? queue[0]!.at : null;
    if (nextTimer === null && nextAction === null) return;
    vc.now = Math.max(vc.now, Math.min(nextTimer ?? Infinity, nextAction ?? Infinity));
    while (queue.length && queue[0]!.at <= vc.now) {
      await queue.shift()!.run();
      await quiesce();
    }
  }
  throw new Error('the timeline did not settle');
}

// ------------------------------------------------------------------------------------------------ the PostgREST hop
const RPC_NAME = /^server_(?:record_call_attention_evaluation|read_call_attention_state|read_call_attention_threads|settle_call_attention|settle_due_call_attention|acquire_background_permit|release_background_permit)_v1$/u;
class PgServiceRoleRpc {
  calls = 0;
  constructor(private readonly pool: PgPool) {}
  async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    if (!RPC_NAME.test(name)) throw new Error(`INTEL_LIVE_01_PROOF_RPC_NAME ${name}`);
    this.calls += 1;
    pending.inc();
    const entries = Object.entries(body);
    const args = entries.map(([key], i) => `${key} => $${i + 1}`).join(', ');
    const values = entries.map(([, v]) => ((v !== null && typeof v === 'object') ? JSON.stringify(v) : v));
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
      throw new DataApiError(400, { databaseCode: e.code, databaseMessage: e.message });
    } finally {
      client.release();
      pending.dec();
    }
  }
}

// ------------------------------------------------------------------------------------------------ the world
async function tx<T>(pool: PgPool, work: (c: PgClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await work(c);
    await c.query('COMMIT');
    return r;
  } catch (error) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    c.release();
  }
}
interface World { readonly user: string; readonly session: string; readonly call: string; readonly recording: string }
async function world(pool: PgPool): Promise<World> {
  const user = randomUUID();
  const session = randomUUID();
  const call = randomUUID();
  const recording = randomUUID();
  await tx(pool, async (c) => {
    await c.query('INSERT INTO auth.users(id) VALUES ($1)', [user]);
    await c.query("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, user]);
    const t = String((await c.query('SELECT clock_timestamp()::text AS t')).rows[0]!.t);
    await c.query(`INSERT INTO voice_private.calls (id, user_id, session_id, client_instance_id, state, connection_epoch, created_at,
        connect_deadline, seat_lease_until)
      VALUES ($1, $2, $3, $1, 'CONNECTING', 1, $4::timestamptz - interval '1 second', clock_timestamp() + interval '15 seconds',
        clock_timestamp() + interval '20 seconds')`, [call, user, session, t]);
    await c.query("UPDATE voice_private.calls SET state = 'ACTIVE', started_at = $2::timestamptz WHERE id = $1", [call, t]);
    await c.query(`INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, call_id, started_at, retention_expires_at,
        recording_state, sealed_by)
      VALUES ($1, $2, $3, 'LIVE_CALL', $4, $5::timestamptz, $5::timestamptz + interval '30 days', 'STORED', 'WRITER')`, [recording, user, session, call, t]);
    for (const track of ['USER', 'QANDEEL']) {
      await c.query(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state, content_type,
          byte_size, clock_start_ms, clock_end_ms, upload_deadline, stored_at)
        VALUES ($1, $2, 0, $3, 'STORED', 'audio/ogg', 1000, 0, 3600000, clock_timestamp(), clock_timestamp())`, [recording, track, `voice-call/${randomUUID()}`]);
    }
  });
  return { user, session, call, recording };
}
/** A committed voiced call turn of one unit, anchored on [a, b] of the call clock (fixture: the durable commit's rows). */
async function committedTurn(pool: PgPool, w: World, role: 'USER' | 'ASSISTANT', a: number, b: number): Promise<{ turn: string; unit: string; sp: number }> {
  return tx(pool, async (c) => {
    const sp = Number((await c.query('SELECT coalesce((SELECT current_sp FROM public.session_semantic_clocks WHERE session_id = $1), 0) AS sp', [w.session])).rows[0]!.sp) + 1;
    const turn = randomUUID();
    const batch = randomUUID();
    const unit = randomUUID();
    const content = `turn at ${sp}`;
    await c.query("INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content) VALUES ($1, $2, $3, $4, 'COMPLETED', $5)", [turn, w.session, w.user, role, content]);
    await c.query(`INSERT INTO public.conversation_unit_commit_batches (id, user_id, session_id, source_turn_id, canonical_fingerprint,
        source_content_sha256, unit_count, evaluator_version, policy_version, segmentation_provider, segmentation_model, segmentation_prompt_version)
      VALUES ($1, $2, $3, $4, sha256($5::bytea), sha256($5::bytea), 1, 'v1', 'v1', 'PROBE', 'probe', 'v1')`, [batch, w.user, w.session, turn, Buffer.from(`${w.session}:${turn}`)]);
    const assistant = role === 'ASSISTANT';
    await c.query(`INSERT INTO public.conversation_turn_voice_sources (turn_id, user_id, session_id, source_role, source_modality, transcript_origin,
        asr_confidence_band, recording_id, anchor_start_ms, anchor_end_ms, spoken, delivery_state)
      VALUES ($1, $2, $3, $4, 'LIVE_CALL_SPEECH', $5, $6, $7, $8, $9, $10, $11)`,
    [turn, w.user, w.session, role, assistant ? null : 'MACHINE_ASR', assistant ? null : 'HIGH', w.recording, a, b, assistant ? true : null, assistant ? 'COMPLETE' : null]);
    await c.query(`INSERT INTO public.conversation_units (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state,
        source_modality, ordinal_within_turn, source_span_start, source_span_end, committed_text, source_content_sha256, session_position)
      VALUES ($1, $2, $3, $4, $5, $6, 'RESOLVED', 'LIVE_CALL_SPEECH', 0, 0, $7, $8, sha256(convert_to($8, 'UTF8')), $9)`,
    [unit, w.user, w.session, turn, batch, role, [...content].length, content, sp]);
    await c.query(`INSERT INTO public.session_semantic_clocks (session_id, user_id, current_sp) VALUES ($1, $2, $3)
      ON CONFLICT (session_id) DO UPDATE SET current_sp = excluded.current_sp`, [w.session, w.user, sp]);
    return { turn, unit, sp };
  });
}
/** A durable Thread established at a unit, named by an alias (fixture surgery: only the rows the readers use by id). */
async function seedThread(pool: PgPool, w: World, unit: string, sp: number, name: string): Promise<string> {
  const thread = randomUUID();
  const focus = randomUUID();
  await tx(pool, async (c) => {
    await c.query("SET LOCAL session_replication_role = 'replica'");
    await c.query(`INSERT INTO public.conversation_emerging_focuses (id, user_id, session_id, grounding_handle_id, started_cu_id, started_sp,
        started_event_sequence) VALUES ($1, $2, $3, gen_random_uuid(), $4, $5, 1)`, [focus, w.user, w.session, unit, sp]);
    await c.query(`INSERT INTO public.conversation_threads (id, user_id, grounding_emerging_focus_id, established_session_id, established_cu_id,
        established_sp, established_event_sequence, establishment_path) VALUES ($1, $2, $3, $4, $5, $6, 2, 'TE-01')`, [thread, w.user, focus, w.session, unit, sp]);
  });
  await tx(pool, (c) => c.query('INSERT INTO public.conversation_thread_aliases (thread_id, user_id, alias) VALUES ($1, $2, $3)', [thread, w.user, name]));
  return thread;
}
const queueHalf = (pool: PgPool, w: World, idx: number, half: 'USER' | 'ASSISTANT', turn: string, state: string) => tx(pool, (c) => c.query(`
  INSERT INTO voice_private.call_analysis_queue (call_id, call_turn_index, half, user_id, session_id, turn_id, queue_state, settled_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $7 IN ('COMPLETE', 'ABANDONED_INTEGRITY') THEN clock_timestamp() END)
  ON CONFLICT (call_id, call_turn_index, half) DO UPDATE SET queue_state = excluded.queue_state, settled_at = excluded.settled_at`,
[w.call, idx, half, w.user, w.session, turn, state]));
const moveEpoch = (pool: PgPool, call: string) => tx(pool, (c) => c.query('UPDATE voice_private.calls SET connection_epoch = connection_epoch + 1 WHERE id = $1', [call]));

interface EvalRow { seq: number; track: Track; from: number; to: number; outcome: string; epoch: number; admitted: number | null; produced: number | null; prompt: number | null; cached: number | null; completion: number | null }
interface EventRow { seq: number; track: Track; op: string; key: string; label: string; kind: string; thread: string | null; eval: number | null; anchor: number | null; evidence: number | null; produced: number | null; settles: number | null }
async function evaluationsOf(pool: PgPool, call: string): Promise<EvalRow[]> {
  return (await pool.query(`SELECT eval_seq::int AS seq, track, covers_from_clock_ms::int AS "from", covers_to_clock_ms::int AS "to", outcome,
      connection_epoch::int AS epoch, admitted_clock_ms::int AS admitted, produced_clock_ms::int AS produced, prompt_tokens AS prompt,
      cache_hit_tokens AS cached, completion_tokens AS completion
    FROM voice_private.call_attention_evaluations WHERE call_id = $1 ORDER BY eval_seq`, [call])).rows as unknown as EvalRow[];
}
async function eventsOf(pool: PgPool, call: string): Promise<EventRow[]> {
  return (await pool.query(`SELECT event_seq::int AS seq, track, op, subject_key AS key, label, kind, thread_ref::text AS thread, eval_seq::int AS eval,
      anchor_clock_ms::int AS anchor, evidence_clock_ms::int AS evidence, produced_clock_ms::int AS produced, settles_event_seq::int AS settles
    FROM voice_private.call_attention_events WHERE call_id = $1 ORDER BY event_seq`, [call])).rows as unknown as EventRow[];
}

// ------------------------------------------------------------------------------------------------ evaluators
const seededLatency = prng(204);
function syntheticUsage(input: AttentionEvaluationInput, developments: number): AttentionUsage {
  const textTokens = Math.round(2.6 * [input.priorText, input.contextCarry ?? '', ...input.newEvidence.map((e) => e.text)].join(' ').split(/\s+/u).length);
  const prompt = 900 + textTokens + 30 * (input.openSubjects.length + input.foldedSubjects.length) + 12 * input.threads.length;
  return { promptTokens: prompt, cacheHitTokens: Math.round(prompt * 0.8), completionTokens: 18 + 45 * developments };
}

/** The annotation oracle: exactly the corpus annotation for the evidence it is shown; it decides nothing by itself. */
class OracleEvaluator implements AttentionEvaluator {
  readonly inputs: AttentionEvaluationInput[] = [];
  private failures = 0;
  constructor(
    private readonly byText: Map<string, Segment>,
    private readonly threadId: string | null,
    private readonly outage: { readonly from: number; readonly to: number } | null,
    /** Evidence whose evaluation is slow (scenario f: the FINAL before the development, so the development arrives in flight). */
    private readonly slowText: string | null = null,
  ) {}
  async evaluate(input: AttentionEvaluationInput): Promise<AttentionEvaluationResult> {
    this.inputs.push(input);
    if (this.outage && vc.now >= this.outage.from && vc.now < this.outage.to) {
      this.failures += 1;
      return this.failures % 2 === 1 ? { kind: 'TIMEOUT', usage: null, providerMs: 4_000 } : { kind: 'REFUSED', usage: syntheticUsage(input, 0), providerMs: 900 };
    }
    const developments: AttentionDevelopment[] = [];
    for (const e of input.newEvidence) {
      const seg = this.byText.get(e.text);
      assert.ok(seg, 'the oracle knows every evidence unit it is shown');
      for (const d of seg.devs) {
        developments.push({ op: d.op, subjectKey: d.key, label: d.label, kind: d.kind, confidence: 'HIGH', threadRef: d.thread ? this.threadId : null, dependsOnSeq: e.seq });
      }
    }
    const open = [...input.foldedSubjects, ...input.openSubjects].map((s) => s.label);
    const carry = input.carryRequired ? `مواضيع مفتوحة: ${open.join('، ')}`.split(/\s+/u).slice(0, 80).join(' ') : null;
    const usage = syntheticUsage(input, developments.length);
    const slow = this.slowText !== null && input.newEvidence.some((e) => e.text === this.slowText);
    const providerMs = slow ? 3_500 : Math.round(650 + seededLatency() * 850 + usage.promptTokens * 0.05);
    return { kind: developments.length ? 'DEVELOPMENTS' : 'NONE', developments, contextCarry: carry, usage, providerMs };
  }
}

/** Places any evaluator's answer on the virtual clock at its own latency; the clock stands still while a real call runs. */
class VirtualTimeEvaluator implements AttentionEvaluator {
  constructor(private readonly inner: AttentionEvaluator) {}
  evaluate(input: AttentionEvaluationInput, signal: AbortSignal): Promise<AttentionEvaluationResult> {
    const start = vc.now;
    return new Promise((resolve) => {
      let done = false;
      const controller = new AbortController();
      const onAbort = () => {
        if (done) return;
        done = true;
        controller.abort();
        resolve({ kind: 'TIMEOUT', usage: null, providerMs: vc.now - start });
      };
      signal.addEventListener('abort', onAbort, { once: true });
      pending.inc();
      this.inner.evaluate(input, controller.signal).then((result) => {
        pending.dec();
        if (done) return;
        vc.setAt(start + Math.max(1, result.providerMs), () => {
          if (done) return;
          done = true;
          signal.removeEventListener('abort', onAbort);
          resolve(result);
        });
      }, () => {
        pending.dec();
        if (!done) { done = true; resolve({ kind: 'PROVIDER_FAILED', usage: null, providerMs: vc.now - start, overloaded: false }); }
      });
    });
  }
}

/** The paid meter: DeepSeek's PEAK list price over the provider's usage fields; refuses once the ceiling would be passed. */
class SpendMeter {
  spentUsd = 0;
  calls = 0;
  readonly usages: AttentionUsage[] = [];
  constructor(readonly ceilingUsd: number) {}
  guard(inner: AttentionEvaluator): AttentionEvaluator {
    return {
      evaluate: async (input, signal) => {
        // The next call's worst case (no cache, 1 024 output tokens) must fit under the ceiling.
        const worst = estimatedSpendUsd({ promptTokens: 6_000, cacheHitTokens: 0, completionTokens: 1_024 });
        if (this.spentUsd + worst > this.ceilingUsd) throw new Error('INTEL_LIVE_01_CEILING');
        this.calls += 1;
        const result = await inner.evaluate(input, signal);
        if (result.usage) { this.usages.push(result.usage); this.spentUsd += estimatedSpendUsd(result.usage); }
        return result;
      },
    };
  }
}

// ------------------------------------------------------------------------------------------------ one scenario
interface ScenarioResult {
  readonly id: string; readonly title: string; readonly kind: Scenario['kind'];
  readonly words: { readonly user: number; readonly qandeel: number };
  readonly segments: number; readonly admissions: number;
  readonly coverage: Record<string, number>;
  readonly developments: Array<Record<string, unknown>>;
  readonly falseUpdates: Array<Record<string, unknown>>;
  readonly orderErrors: number;
  readonly timings: { readonly T1: number[]; readonly T2: number[]; readonly T3: number[]; readonly wordEndToProduced: number[] };
  readonly usage: { readonly prompt: number; readonly cached: number; readonly completion: number; readonly spendUsd: number };
  readonly asserts: string[];
  readonly adjudication?: unknown[];
  readonly unbound?: number;
  readonly events: EventRow[];
  readonly evaluations: EvalRow[];
  readonly inputs?: unknown[];
}

const T1_LAG = prng(1);
async function runScenario(pools: { a: PgPool; b: PgPool }, s: Scenario, evaluatorOf: (w: World, threadId: string | null) => AttentionEvaluator,
  config: Partial<ProvisionalAttentionConfig> = {}, oracle?: OracleEvaluator): Promise<ScenarioResult> {
  vc.reset();
  const shimA = new PgServiceRoleRpc(pools.a);
  const shimB = new PgServiceRoleRpc(pools.b);
  const w = await world(pools.a);
  const asserts: string[] = [];
  const check = (ok: boolean, what: string) => {
    if (MODE === 'FAKE') assert.ok(ok, `${s.id}: ${what}`);
    asserts.push(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  };
  // The oracle answers with the annotation's keys; the real evaluator chooses its own, so a key-specific check reads any key.
  const keyIs = (e: { key: string }, key: string) => MODE === 'FAKE' ? e.key === key : true;
  const byText = new Map<string, Segment>();
  for (const seg of s.segments) {
    assert.ok(!byText.has(seg.text), `${s.id}: corpus segment texts are unique (${seg.text})`);
    byText.set(seg.text, seg);
  }

  // Scenario e: an existing Thread the person knows by name, established at the call turn's own unit (so the durable half
  // that binds it is the one the settlement reads). Scenario g / g2 / e: the committed call turns for settlement.
  const turn1 = s.turns[0]!;
  let threadId: string | null = null;
  let userTurn: { turn: string; unit: string; sp: number } | null = null;
  if (s.id === 'e' || s.id === 'g' || s.id === 'g2') userTurn = await committedTurn(pools.a, w, 'USER', turn1.speechStart, turn1.speechEnd);
  if (s.id === 'e') threadId = await seedThread(pools.a, w, userTurn!.unit, userTurn!.sp, s.threadName!);

  const observations: AttentionObservation[] = [];
  const evidenceAt = new Map<string, number>();
  // INTEL-LIVE-01 CP2 (B2): what each connection told its phone (protocol v3), with the connection's epoch.
  const told: Array<{ readonly epoch: number; readonly d: LiveCallAttentionDisclosure }> = [];
  const makeTracker = (epoch: number, shim: PgServiceRoleRpc) => new CallAttentionTracker({
    userId: w.user, callId: w.call, epoch, evaluator: new VirtualTimeEvaluator(evaluatorOf(w, threadId)),
    store: new CallAttentionRepository(shim), permits: new DatabaseBackgroundPermitGate(shim),
    captureClock: () => vc.now, now: () => vc.now, timers: vc, config, observe: (o) => observations.push(o),
    disclose: (d) => { told.push({ epoch, d }); return 'SENT'; },
  });
  let epoch = 1;
  let tracker = makeTracker(epoch, shimA);
  await tracker.start();
  await quiesce();

  const actions: Action[] = [];
  s.segments.forEach((seg, i) => {
    const lag = seg.track === 'USER' ? Math.round(600 + T1_LAG() * 500) : 0; // QANDEEL: heard at the PLAYOUT mark of its end
    actions.push({ at: seg.t1 + lag, label: `evidence ${i}`, run: () => { evidenceAt.set(seg.text, vc.now); tracker.evidence(seg.track, seg.text, seg.t0, seg.t1); } });
  });
  for (const t of s.turns) actions.push({ at: t.commitAt, label: `commit ${t.index}`, run: () => tracker.turnCommitted() });

  // Scenario h: another instance takes the call mid-turn (the old one flushes MISSED_HANDOVER under its epoch, the epoch
  // moves, a late result of the old epoch is fenced); later the same instance resumes again.
  let fencedOutcome: string | null = null;
  if (s.id === 'h') {
    const after = (n: number) => s.segments[n]!.t1 + 1_250; // its evaluation is in flight
    actions.push({ at: after(s.expect!.handoverAfterSegment as number), label: 'handover A->B', run: async () => {
      const old = tracker;
      await old.handover();
      await moveEpoch(pools.a, w.call);
      epoch += 1;
      tracker = makeTracker(epoch, shimB);
      await tracker.start();
      const state = await new CallAttentionRepository(shimA).readState(w.user, w.call);
      const accounted = state.find((x) => x.track === 'USER')!.accountedToClockMs;
      fencedOutcome = (await new CallAttentionRepository(shimA).record({
        userId: w.user, callId: w.call, epoch: 1, track: 'USER', coversFromClockMs: accounted, coversToClockMs: accounted + 10, outcome: 'NONE',
        admittedClockMs: accounted, producedClockMs: accounted + 10, providerMs: 1, promptTokens: 1, cacheHitTokens: 0, completionTokens: 1, events: null,
      })).outcome;
    } });
    actions.push({ at: after(s.expect!.sameInstanceAfterSegment as number), label: 'handover B->A', run: async () => {
      await tracker.handover();
      await moveEpoch(pools.a, w.call);
      epoch += 1;
      tracker = makeTracker(epoch, shimA);
      await tracker.start();
    } });
  }
  // Scenario g2: the durable half settles BEFORE the tail evaluation resolves (A12: its events are refused).
  if (s.id === 'g2') {
    actions.push({ at: turn1.commitAt + 50, label: 'settle before the tail result', run: async () => {
      await queueHalf(pools.a, w, 1, 'USER', userTurn!.turn, 'COMPLETE');
      await new CallAttentionRepository(shimA).settle(w.user, w.call, 1, 'USER');
    } });
  }
  const lastAt = Math.max(...actions.map((x) => x.at));
  let openAtClose: Map<string, number> | null = null;
  actions.push({ at: lastAt + 30_000, label: 'close', run: async () => {
    const state = await new CallAttentionRepository(shimA).readState(w.user, w.call);
    openAtClose = new Map(state.flatMap((t) => t.openSubjects.map((o, i) => [`${t.track}:${o.subjectKey}`, t.openEventSeqs[i]!] as const)));
    await tracker.close();
  } });
  await runTimeline(actions);

  // Settlement through the worker's command (A6): e confirms the Thread subject by id; g settles the tail's events.
  let settlement: unknown = null;
  if (s.id === 'e' || s.id === 'g') {
    await queueHalf(pools.a, w, 1, 'USER', userTurn!.turn, 'COMPLETE');
    settlement = await new CallAttentionRepository(shimA).settle(w.user, w.call, 1, 'USER');
  }

  const evaluations = await evaluationsOf(pools.a, w.call);
  const events = await eventsOf(pools.a, w.call);
  const producer = events.filter((e) => e.op === 'SET' || e.op === 'WITHDRAW');
  const segmentOf = (e: EventRow): Segment | undefined => s.segments.filter((x) => x.track === e.track && x.t1 >= e.anchor!).sort((x, y) => x.t1 - y.t1)[0];

  // ---- coverage (A2 §2 evidence accounting)
  const coverage: Record<string, number> = { COVERED: 0, MISSED_HANDOVER: 0, DEGRADED_SUSPENDED: 0, STALE_AFTER_SETTLEMENT: 0, UNCOVERED_AT_END: 0 };
  const classOf = (seg: Segment): string => {
    const row = evaluations.find((r) => r.track === seg.track && r.from < seg.t1 && seg.t1 <= r.to
      && ['DEVELOPMENTS', 'NONE', 'MISSED_HANDOVER', 'DEGRADED_SUSPENDED', 'STALE_AFTER_SETTLEMENT'].includes(r.outcome));
    if (!row) return 'UNCOVERED_AT_END';
    return row.outcome === 'DEVELOPMENTS' || row.outcome === 'NONE' ? 'COVERED' : row.outcome;
  };
  for (const seg of s.segments) coverage[classOf(seg)]! += 1;

  // ---- developments, against the annotation (the fake's keys are the annotation's; the real run is adjudicated by hand)
  const developments: Array<Record<string, unknown>> = [];
  const matched = new Set<number>();
  for (const seg of s.segments) {
    const turn = s.turns.find((t) => t.index === seg.turn);
    for (const d of seg.devs) {
      const ev = producer.find((e) => !matched.has(e.seq) && e.track === seg.track && e.op === d.op && e.key === d.key);
      if (ev) matched.add(ev.seq);
      const cls = classOf(seg);
      const speechEnd = seg.track === 'USER' ? turn!.speechEnd : null;
      developments.push({
        segment: s.segments.indexOf(seg), track: seg.track, op: d.op, key: d.key, label: d.label, wordEndMs: seg.t1,
        outcome: ev ? 'EMITTED' : cls === 'COVERED' ? 'NOT_DETECTED' : cls,
        producedMs: ev?.produced ?? null, wordEndToProducedMs: ev?.produced != null ? ev.produced - seg.t1 : null,
        disclosure: !ev ? 'NOT_UNDERSTOOD_LIVE' : seg.track === 'QANDEEL' ? 'QANDEEL_SIDE' : (ev.produced! < speechEnd! ? 'IN_SPEECH' : 'TAIL_AFTER_SPEECH_END'),
      });
    }
  }
  const falseUpdates = producer.filter((e) => !matched.has(e.seq)).map((e) => ({ seq: e.seq, track: e.track, op: e.op, key: e.key, label: e.label }));
  // ---- order inside one evaluation: annotated evidence order
  let orderErrors = 0;
  for (const r of evaluations.filter((x) => x.outcome === 'DEVELOPMENTS')) {
    const mine = producer.filter((e) => e.eval === r.seq);
    const annotated = s.segments.filter((x) => x.track === r.track && r.from < x.t1 && x.t1 <= r.to).flatMap((x) => x.devs.map((d) => `${d.op}:${d.key}`));
    const emitted = mine.map((e) => `${e.op}:${e.key}`).filter((k) => annotated.includes(k));
    if (emitted.join('|') !== annotated.filter((k) => emitted.includes(k)).join('|')) orderErrors += 1;
  }

  // ---- A7: anchor <= evidence <= produced on every producer event; produced is never before its admission
  check(producer.every((e) => e.anchor! <= e.evidence! && e.evidence! <= e.produced!), 'A7 every event has anchor ≤ evidence ≤ produced on the call clock');
  check(evaluations.filter((r) => r.produced !== null).every((r) => r.admitted! <= r.produced!), 'A7 every success is produced after its admission');
  // ---- A9 / A10: contiguous, rising, per track; numbers gap-free; only successes and explicit misses advance
  for (const track of ['USER', 'QANDEEL'] as const) {
    const adv = evaluations.filter((r) => r.track === track && ['DEVELOPMENTS', 'NONE', 'MISSED_HANDOVER', 'DEGRADED_SUSPENDED'].includes(r.outcome));
    check(adv.every((r, i) => i === 0 || r.from === adv[i - 1]!.to), `A10 ${track}: each advancing row starts where the previous ended (covers_from = previous covers_to)`);
  }
  check(evaluations.every((r, i) => r.seq === i + 1), 'A10 eval_seq is gap-free and rising');
  check(events.every((r, i) => r.seq === i + 1), 'A10 event_seq is gap-free and rising');
  check(producer.every((e) => evaluations.find((r) => r.seq === e.eval)!.outcome === 'DEVELOPMENTS'), 'A9 every producer event belongs to a DEVELOPMENTS row');
  const failed = evaluations.filter((r) => ['TIMEOUT', 'REFUSED', 'PROVIDER_FAILED', 'DEFERRED_PERMIT'].includes(r.outcome));
  for (const f of failed) {
    const later = evaluations.find((r) => r.seq > f.seq && r.track === f.track && ['DEVELOPMENTS', 'NONE'].includes(r.outcome));
    if (later) check(later.from <= f.from, `A1′ a failed span (eval ${f.seq}) is covered by a later success from the same watermark`);
  }

  // ---- scenario-specific acceptance
  const admitted = observations.filter((o): o is Extract<AttentionObservation, { kind: 'ATTENTION_ADMITTED' }> => o.kind === 'ATTENTION_ADMITTED');
  if (s.kind === 'NORMAL' && s.id !== 'g2') check(coverage.COVERED === s.segments.length, 'A1′ every FINAL span of the call is covered (DEVELOPMENTS | NONE)');
  if (s.id === 'f') {
    const seg = s.segments.find((x) => x.devs.length > 0)!;
    const arrival = evidenceAt.get(seg.text)!;
    const inFlight = admitted.filter((o) => o.admittedClockMs < arrival).at(-1)!;
    const next = admitted.find((o) => o.evalOrdinal === inFlight.evalOrdinal + 1)!;
    const inFlightRow = evaluations.find((r) => r.admitted === inFlight.admittedClockMs && r.track === 'USER')!;
    check(inFlightRow.produced === null || inFlightRow.produced > arrival, '(f) the development arrived while an evaluation was in flight');
    check(next.fromClockMs < seg.t1 && seg.t1 <= next.toClockMs, '(f) the in-flight-time FINAL is covered by the very next admission');
  }
  if (s.id === 'g' || s.id === 'g2') {
    const seg = s.segments.at(-1)!;
    const row = evaluations.find((r) => r.from < seg.t1 && seg.t1 <= r.to && ['DEVELOPMENTS', 'NONE'].includes(r.outcome))
      ?? evaluations.find((r) => r.from < seg.t1 && seg.t1 <= r.to && r.produced !== null);
    check(!!row && row.produced! > turn1.speechEnd, '(g) the last FINAL\'s evaluation is produced after the speech end (a tail, at its real instant)');
    if (s.id === 'g') {
      check(JSON.stringify(settlement).includes('SETTLED'), '(g) the tail\'s events, written before the settlement, are settled by it');
      check(events.some((e) => e.op === 'EXPIRED' && keyIs(e, 'back-surgery')), '(g) the tail subject without a Thread reference EXPIRES at settlement');
    } else {
      const stale = (await pools.a.query("SELECT count(*)::int n FROM voice_private.call_attention_evaluations WHERE call_id = $1 AND outcome IN ('DEVELOPMENTS', 'NONE')", [w.call])).rows;
      check(!producer.some((e) => segmentOf(e) === s.segments.at(-1)), '(g2 / A12) a tail result after the settlement writes no event (STALE_AFTER_SETTLEMENT)');
      void stale;
    }
  }
  if (s.id === 'e') {
    check(threadId !== null && producer.some((e) => keyIs(e, 'bank-job') && e.thread === threadId), '(e) the Thread reference is the person\'s own Thread id');
    check(events.some((e) => e.op === 'CONFIRMED' && keyIs(e, 'bank-job')), '(e / A6) the subject whose Thread the durable half bound is CONFIRMED (identity by id)');
    check(events.some((e) => e.op === 'EXPIRED' && keyIs(e, 'learning-guitar')), '(e / A6) the subject without a Thread reference EXPIRES');
  }
  if (s.id === 'h') {
    check(fencedOutcome === 'FENCED', '(h) a late result of the old epoch is FENCED: nothing written');
    check(evaluations.some((r) => r.outcome === 'MISSED_HANDOVER' && r.epoch === 1), '(h) the first connection recorded MISSED_HANDOVER under its own epoch');
    check(evaluations.some((r) => r.outcome === 'MISSED_HANDOVER' && r.epoch === 2), '(h) the other instance recorded its own MISSED_HANDOVER under epoch 2');
    check(new Set(evaluations.map((r) => r.epoch)).size === 3, '(h) three epochs wrote, in order');
    check(evaluations.every((r, i) => i === 0 || r.epoch >= evaluations[i - 1]!.epoch), '(h) eval_seq rises across epochs');
    const firstOfB = evaluations.find((r) => r.epoch === 2 && ['DEVELOPMENTS', 'NONE'].includes(r.outcome));
    const missA = evaluations.filter((r) => r.epoch === 1 && r.outcome === 'MISSED_HANDOVER').at(-1)!;
    check(!firstOfB || firstOfB.from >= missA.to, '(h) the new tracker continues from the database watermark');
  }
  // ---- INTEL-LIVE-01 CP2 B2: the phone is told only the database's rows, every connection starts from the database, the
  // told numbers never move backwards, and a phone fed exactly these frames holds the database's open attention.
  {
    const epochs = [...new Set(told.map((t) => t.epoch))];
    check(epochs.every((e) => told.find((t) => t.epoch === e)!.d.kind === 'STATE'), 'B2 every connection starts its phone from the database (ATTENTION_STATE first)');
    check(epochs.every((e) => told.filter((t) => t.epoch === e).every((t, i, a) => i === 0 || t.d.seq >= a[i - 1]!.d.seq)), 'B2 what one connection tells never moves backwards (seq non-decreasing)');
    const toldEvents = told.flatMap((t) => (t.d.kind === 'EVENT' ? [t.d] : []));
    check(toldEvents.every((d) => { const row = events.find((e) => e.seq === d.seq); return !!row && row.op === d.op && row.key === d.subject.subjectKey && row.track === d.subject.track && row.produced === d.producedClockMs; }),
      "B2 each disclosed event is the database's own committed row (seq, op, key, track, produced)");
    check(toldEvents.every((d, i) => i === 0 || d.seq > toldEvents[i - 1]!.seq), 'B2 event_seq strictly rises across every connection and hand-over');
    check(producer.every((e) => toldEvents.some((d) => d.seq === e.seq) || told.some((t) => t.d.kind === 'STATE' && t.d.seq >= e.seq)), 'B2 no committed development is lost to the phone (told as an event, or reflected by a later state)');
    let seq = 0;
    const phone = new Map<string, number>();
    for (const { d } of told) {
      if (d.kind === 'STATE') {
        if (d.seq < seq) continue;
        phone.clear();
        for (const e of d.entries) phone.set(`${e.track}:${e.subjectKey}`, e.seq);
        seq = d.seq;
      } else if (d.seq > seq) {
        const key = `${d.subject.track}:${d.subject.subjectKey}`;
        if (d.op === 'SET') phone.set(key, d.seq); else phone.delete(key);
        seq = d.seq;
      }
    }
    const expected = openAtClose ?? new Map<string, number>();
    check(phone.size === expected.size && [...expected].every(([k, v]) => phone.get(k) === v), "B2 a phone fed exactly these frames holds the database's open attention (no duplicate, no stale entry)");
    if (s.id === 'h') {
      const resume = told.find((t) => t.epoch === 2)!.d;
      const openAt = (upTo: number) => {
        const open = new Map<string, number>();
        for (const e of events.filter((x) => x.seq <= upTo)) { const k = `${e.track}:${e.key}`; if (e.op === 'SET') open.set(k, e.seq); else open.delete(k); }
        return open;
      };
      const want = openAt(resume.seq);
      check(resume.kind === 'STATE' && resume.entries.length === want.size && resume.entries.every((e) => want.get(`${e.track}:${e.subjectKey}`) === e.seq),
        '(h / B2) the resume on the other instance got ATTENTION_STATE from the database: every subject open at the hand-over, at its own seq');
      check(resume.seq === Math.max(0, ...events.filter((e) => e.seq <= resume.seq).map((e) => e.seq)) && told.filter((t) => t.epoch === 1).every((t) => t.d.seq <= resume.seq),
        '(h / B2) the resumed snapshot is at least as new as everything the old connection told');
    }
  }
  if (s.id === 'i') {
    const outage = { from: (s.expect as { outageFrom: number }).outageFrom, to: (s.expect as { outageFrom: number }).outageFrom + 15_000 };
    const during = evaluations.filter((r) => r.admitted !== null && r.admitted >= outage.from && r.admitted < outage.to);
    check(during.length > 0 && during.every((r) => ['TIMEOUT', 'REFUSED'].includes(r.outcome)), '(i) during the outage every evaluation is TIMEOUT / REFUSED, recorded');
    const tries = during.map((r) => r.admitted!);
    check(tries.slice(2).every((t, idx) => t - tries[idx + 1]! >= 0) && (tries.length < 3 || tries[2]! - tries[1]! >= 5_000 - 1), '(i) after two consecutive failures the next admission waits the 5 000 ms backoff');
    const recovery = evaluations.find((r) => r.admitted !== null && r.admitted >= outage.to && ['DEVELOPMENTS', 'NONE'].includes(r.outcome))!;
    const before = evaluations.filter((r) => r.admitted !== null && r.admitted < outage.from && ['DEVELOPMENTS', 'NONE'].includes(r.outcome)).at(-1);
    check(!!recovery && recovery.from === (before?.to ?? 0), '(i) the watermark did not move during the outage; the first success after it covers everything since');
  }
  if (s.id === 'j') {
    const lastSeg = s.segments.at(-1)!;
    const lastInput = (oracle?.inputs ?? []).find((x) => x.newEvidence.some((e) => e.text === lastSeg.text));
    const before = s.segments.slice(0, -1).reduce((n, x) => n + x.text.split(/\s+/u).length, 0);
    check(before > 600, `(j) the turn's evaluated words before the correction (${before}) exceed the 600-word window`);
    if (lastInput) {
      check(!lastInput.priorText.includes(s.segments[1]!.text), '(j) the early subject\'s own words have left the window (actual word boundary exceeded)');
      check(lastInput.carryRequired && lastInput.contextCarry !== null, '(j / A1′-j) the evaluator\'s carried context travels across the window');
      check([...lastInput.openSubjects, ...lastInput.foldedSubjects].some((x) => x.subjectKey === 'ahmed-canada'), '(j / A1′-j) the early subject is still open in the admission input');
    }
  }
  if (s.id === 'k') {
    check(observations.some((o) => o.kind === 'ATTENTION_DEGRADED' && o.reason === 'EMERGENCY_SPEND'), '(k / A1′-k) the low guard put the lane in DEGRADED');
    check(evaluations.some((r) => r.outcome === 'DEGRADED_SUSPENDED'), '(k / A1′-k) DEGRADED_SUSPENDED rows account for what was not evaluated');
  }
  if (s.id === 'k20') {
    check(!observations.some((o) => o.kind === 'ATTENTION_DEGRADED'), '(k20 / A1′-k) with the default guard (null) a 20-minute call never suspends');
    check(coverage.COVERED === s.segments.length, '(k20) every span of the 20-minute call is covered');
  }

  const T1 = s.segments.filter((x) => x.track === 'USER').map((x) => evidenceAt.get(x.text)! - x.t1);
  const T2: number[] = [];
  for (const o of admitted) {
    const arrivals = s.segments.filter((x) => x.track === o.track && o.fromClockMs < x.t1 && x.t1 <= o.toClockMs).map((x) => evidenceAt.get(x.text)!);
    if (arrivals.length) T2.push(o.admittedClockMs - Math.min(...arrivals));
  }
  const T3 = evaluations.filter((r) => r.produced !== null && r.admitted !== null).map((r) => r.produced! - r.admitted!);
  const wordEndToProduced = developments.map((d) => d.wordEndToProducedMs).filter((x): x is number => typeof x === 'number');
  const used = evaluations.filter((r) => r.prompt !== null);
  const usage = {
    prompt: used.reduce((n, r) => n + r.prompt!, 0), cached: used.reduce((n, r) => n + r.cached!, 0), completion: used.reduce((n, r) => n + r.completion!, 0),
    spendUsd: used.reduce((n, r) => n + estimatedSpendUsd({ promptTokens: r.prompt!, cacheHitTokens: r.cached!, completionTokens: r.completion! }), 0),
  };
  return {
    id: s.id, title: s.title, kind: s.kind, words: { user: corpusWords(s, 'USER'), qandeel: corpusWords(s, 'QANDEEL') },
    segments: s.segments.length, admissions: admitted.length, coverage, developments, falseUpdates, orderErrors,
    timings: { T1, T2, T3, wordEndToProduced }, usage, asserts, events, evaluations,
    adjudication: s.segments.map((seg, index) => ({
      index, track: seg.track, turn: seg.turn, wordEndMs: seg.t1, speechEndMs: s.turns.find((t) => t.index === seg.turn)?.speechEnd ?? null, text: seg.text,
      annotated: seg.devs.map((d) => `${d.op} ${d.key} «${d.label}» ${d.kind}${d.thread ? ' (Thread)' : ''}`),
      emitted: producer.filter((e) => segmentOf(e) === seg).map((e) => ({ op: e.op, key: e.key, label: e.label, kind: e.kind, thread: e.thread !== null, producedMs: e.produced })),
    })),
    unbound: producer.filter((e) => segmentOf(e) === undefined).length,
  };
}

// ------------------------------------------------------------------------------------------------ the 20-minute call
function twentyMinuteCall(): Scenario {
  const base = CORPUS.find((x) => x.id === 'b')!;
  const segments: Segment[] = [];
  const turns: Array<{ index: number; speechStart: number; speechEnd: number; commitAt: number }> = [];
  let clock = 1_000;
  let n = 0;
  for (let turn = 1; clock < 20 * 60_000; turn += 1) {
    const start = clock;
    for (let k = 0; k < 8; k += 1) {
      const text = `${base.segments[n % base.segments.length]!.text} ${n}`;
      const len = Math.round((text.split(/\s+/u).length / 2.4) * 1_000);
      segments.push({ track: 'USER', text, devs: n % 40 === 0 ? [{ op: 'SET', key: `k20-${n}`, label: `موضوع ${n}`, kind: 'TOPIC' }] : [], t0: clock, t1: clock + len, turn });
      clock += len + 350;
      n += 1;
    }
    turns.push({ index: turn, speechStart: start, speechEnd: clock - 350, commitAt: clock - 350 + 800 });
    clock += 1_400;
    for (let k = 0; k < 2; k += 1) {
      const text = `تمام، فاهمك. ${n}`;
      segments.push({ track: 'QANDEEL', text, devs: [], t0: clock, t1: clock + 1_500, turn });
      clock += 1_500 + 200;
      n += 1;
    }
    clock += 1_200;
  }
  return { id: 'k20', title: 'a 20-minute call with the default guard (null)', kind: 'FAILURE_INJECTION', segments, turns };
}

// ------------------------------------------------------------------------------------------------ main
const pct = (xs: number[], p: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!;
};

async function main(): Promise<void> {
  const url = loopbackUrl();
  const poolA = new Pool({ connectionString: url, max: 4 });
  const poolB = new Pool({ connectionString: url, max: 4 });
  const pools = { a: poolA, b: poolB };
  mkdirSync(join(OUT, RUN_ID), { recursive: true });
  const results: ScenarioResult[] = [];
  let meter: SpendMeter | null = null;

  // Scenario g2 is g with the settlement before the tail result (A12).
  const g = CORPUS.find((x) => x.id === 'g')!;
  const g2: Scenario = { ...g, id: 'g2', title: 'g, with the durable settlement before the tail result (A12)', segments: g.segments.map((x) => ({ ...x })) };
  // Scenario i: the outage starts at the second segment's arrival.
  const i = CORPUS.find((x) => x.id === 'i')!;
  (i.expect as Record<string, unknown>).outageFrom = i.segments[1]!.t1;

  if (MODE === 'FAKE') {
    for (const s of [...CORPUS, g2, twentyMinuteCall()]) {
      const byText = new Map(s.segments.map((x) => [x.text, x]));
      let oracle: OracleEvaluator | null = null;
      const outage = s.id === 'i' ? { from: (s.expect as { outageFrom: number }).outageFrom, to: (s.expect as { outageFrom: number }).outageFrom + 15_000 } : null;
      const config: Partial<ProvisionalAttentionConfig> = s.id === 'k' ? { emergencyCallSpendUsd: (s.expect as { emergencyCallSpendUsd: number }).emergencyCallSpendUsd } : {};
      const result = await runScenario(pools, s, (_w, thread) => (oracle ??= new OracleEvaluator(byText, thread, outage, s.id === 'f' ? s.segments[s.segments.findIndex((x) => x.devs.length > 0) - 1]!.text : null)), config, undefined);
      // (j) re-check its plumbing against the oracle's recorded inputs (A1′-j).
      if (s.id === 'j') {
        const lastSeg = s.segments.at(-1)!;
        const input = oracle!.inputs.find((x) => x.newEvidence.some((e) => e.text === lastSeg.text))!;
        assert.ok(input, 'j: the correction was admitted');
        assert.ok(!input.priorText.includes(s.segments[1]!.text), 'j: the early words left the window');
        assert.ok(input.carryRequired && input.contextCarry !== null, 'j: the carry travels');
        assert.ok([...input.openSubjects, ...input.foldedSubjects].some((x) => x.subjectKey === 'ahmed-canada'), 'j: the early subject is open');
        result.asserts.push('PASS  (j / A1′-j) the correction\'s admission: early words out of the window, carry present, early subject open');
      }
      results.push(result);
      process.stdout.write(`  PASS  ${s.id.padEnd(4)} ${s.title}  (${result.asserts.length} assertions, ${result.admissions} admissions)\n`);
    }
  } else {
    if (process.env.INTEL_LIVE_01_PAID !== 'AUTHORISED') throw new Error('INTEL_LIVE_01_PROOF_REFUSED: the paid run needs INTEL_LIVE_01_PAID=AUTHORISED');
    const keyFile = process.env.INTEL_LIVE_01_DEEPSEEK_KEY_FILE;
    if (!keyFile) throw new Error('INTEL_LIVE_01_DEEPSEEK_KEY_FILE is required');
    const env = { ...process.env, DEEPSEEK_API_KEY: readFileSync(keyFile, 'utf8').trim(), DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY' };
    const config = loadAttentionDeepSeekConfig(env);
    const client = createDeepSeekClient(config);
    meter = new SpendMeter(Number(process.env.INTEL_LIVE_01_DEEPSEEK_CEILING_USD ?? 0.28));
    const inputs: Record<string, unknown[]> = {};
    for (const id of RECALL_GATE) {
      const s = CORPUS.find((x) => x.id === id)!;
      const seen: unknown[] = [];
      inputs[id] = seen;
      const real = meter.guard(new DeepSeekAttentionEvaluator(config, client));
      const recording: AttentionEvaluator = {
        evaluate: async (input, signal) => {
          const r = await real.evaluate(input, signal);
          seen.push({ at: vc.now, input, result: r });
          return r;
        },
      };
      try {
        const result = await runScenario(pools, s, () => recording, {}, undefined);
        results.push({ ...result, inputs: seen });
        process.stdout.write(`  RAN   ${s.id.padEnd(4)} ${s.title}  (${result.admissions} admissions, spent ≈ USD ${meter.spentUsd.toFixed(4)})\n`);
      } catch (error) {
        process.stdout.write(`  STOP  ${s.id}: ${(error as Error).message.split('\n')[0]}\n`);
        if ((error as Error).message.includes('INTEL_LIVE_01_CEILING')) break;
        results.push({ id: s.id, title: s.title, kind: s.kind, error: (error as Error).message } as unknown as ScenarioResult);
      }
    }
  }

  // ---------------------------------------------------------------------------------------------- the report
  const all = results.filter((r) => r.timings);
  const summary = {
    runId: RUN_ID, mode: MODE, at: new Date().toISOString(),
    spendUsd: meter ? { estimatedPeakUsd: meter.spentUsd, calls: meter.calls, ceilingUsd: meter.ceilingUsd } : { estimatedPeakUsd: 0, calls: 0, note: 'fake evaluator: no provider call' },
    scenarios: all.map((r) => ({
      id: r.id, title: r.title, kind: r.kind, words: r.words, segments: r.segments, admissions: r.admissions, coverage: r.coverage,
      developments: r.developments, falseUpdates: r.falseUpdates, orderErrors: r.orderErrors, asserts: r.asserts.length, failedAsserts: r.asserts.filter((a) => a.startsWith('FAIL')),
      timingsMs: {
        T1: { p50: pct(r.timings.T1, 50), p95: pct(r.timings.T1, 95) }, T2: { p50: pct(r.timings.T2, 50), p95: pct(r.timings.T2, 95) },
        T3: { p50: pct(r.timings.T3, 50), p95: pct(r.timings.T3, 95) },
        wordEndToProduced: { p50: pct(r.timings.wordEndToProduced, 50), p95: pct(r.timings.wordEndToProduced, 95), max: r.timings.wordEndToProduced.length ? Math.max(...r.timings.wordEndToProduced) : null },
      },
      usage: { ...r.usage, cacheRatio: r.usage.prompt ? r.usage.cached / r.usage.prompt : null },
      perMinute: (() => {
        const span = Math.max(...r.evaluations.map((e) => e.to), 1) / 60_000;
        return { admissions: r.admissions / span, spendUsd: r.usage.spendUsd / span };
      })(),
    })),
  };
  writeFileSync(join(OUT, RUN_ID, 'summary.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(OUT, RUN_ID, 'adjudication.json'), JSON.stringify(all.map((r) => ({ id: r.id, title: r.title, unbound: r.unbound, asserts: r.asserts, segments: r.adjudication })), null, 2));
  writeFileSync(join(OUT, RUN_ID, 'rows.json'), JSON.stringify(all.map((r) => ({ id: r.id, evaluations: r.evaluations, events: r.events, inputs: r.inputs ?? null })), null, 2));
  process.stdout.write(`\n${all.length} scenario(s) written to ${join(OUT, RUN_ID)}\n`);
  await poolA.end();
  await poolB.end();
}

main().then(() => process.exit(0), (error) => {
  process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
  process.exit(1);
});
