/**
 * S8B-05 CP3 — the Fast Live Analysis synthetic proof: the REAL Durable Ordered Analysis Worker (two instances), the REAL
 * half-exchange establishment (segmentation -> B1 -> Thread layer -> LF, canonicalized, through migration 0191's half
 * coordinator), the REAL PostgreSQL-shared background permits and the REAL call analysis queue, over a REAL local
 * PostgreSQL carrying migrations through 0191, driven by synthetic live calls through 0189 / 0190's own commands.
 *
 * Stand-ins, and only these: the PostgREST hop (a pg shim calling the same definers as service_role, with PostgREST's error
 * identity), and the providers - every provider is a FAKE with a seeded latency, and the live reply's first token and the
 * analysis calls share ONE fake provider capacity (the contention a real account has). No provider, no paid API, no real
 * person, no real voice, no audio: the humans are random UUIDs, the words are fixed synthetic Arabic sentences.
 *
 * It measures, for M0 (analysis off), M1 (L2: provider work after the reply's first audio - the default) and M1′ (at the
 * commit): commit -> first analysis work, -> USER half committed, -> Live Focus update; First Audio P50 / P95 and its
 * impact against M0; queue depth and backlog age; long-call lag; analysis provider calls per exchange and per minute. It
 * proves: the analysis order (FIFO by call_turn_index, pre-call first), one active worker per session across instances, no
 * duplicate batch, never a skip (a 429 / outage is retried), a committed half replayed with ZERO provider calls after a
 * crash, and S3 after the end (the same gate over the same reader, stored once, closed once).
 *
 * It refuses anything but a loopback database and changes the database it is given (gates, policies): run it only on a
 * disposable local clone, never on a shared or hosted database.
 *
 *   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55437/proof191 \
 *     node node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/s8b-05-cp3-live-analysis-proof.ts
 */
import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { AsyncLocalStorage } from 'node:async_hooks';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LiveCallConversationBinding } from '../src/voice/call-turn/live-call-conversation.port';
import { CALL_CONTEXT_POLICY, LiveCallReplyService } from '../src/conversation/live-call-reply.service';
import { SafetyResponseGateService } from '../src/conversation/safety-response-gate.service';
import { DataApiError, type SupabaseDataApiService } from '../src/conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../src/conversation/supabase-service-role-api.service';
import type { SourceAnchor } from '../src/conversation-unit/cu-anchor-mapper';
import { CuSegmentationProviderError, type CuSegmentationProvider, type CuSegmentationRequest } from '../src/conversation-unit/cu-segmentation-provider.types';
import { DatabaseBackgroundPermitGate } from '../src/live-analysis/background-permits';
import { CallAnalysisRepository } from '../src/live-analysis/call-analysis.repository';
import { CallAnalysisWorker, type CallAnalysisObservation, type CallAnalysisStart } from '../src/live-analysis/call-analysis.worker';
import { ConversationSemanticEstablishmentService } from '../src/live-focus/conversation-semantic-establishment.service';
import { ConversationSemanticRuntimeRepository } from '../src/live-focus/conversation-semantic-runtime.repository';
import { FakeThreadContinuityProvider } from '../src/thread-lifecycle/fake-thread-continuity.provider';
import { LiveCallAnalysisSignal } from '../src/voice/call-turn/live-call-analysis.signal';

// The providers' types, taken from the establishment service's own bindings: the proof reaches the B1 and Thread layers
// only through that service, as the runtime does.
type Bindings = ConstructorParameters<typeof ConversationSemanticEstablishmentService>;
type FocusProvider = ReturnType<Bindings[2]>['provider'];
type FocusRequest = Parameters<FocusProvider['propose']>[0];
type FocusProposal = Awaited<ReturnType<FocusProvider['propose']>>;
type ThreadProvider = ReturnType<Bindings[3]>['provider'];
type ThreadRequest = Parameters<ThreadProvider['propose']>[0];
type ThreadProposal = Awaited<ReturnType<ThreadProvider['propose']>>;
type ContinuityProvider = ReturnType<Bindings[4]>['provider'];

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require('pg') as { Pool: new (config: { connectionString: string; max: number }) => PgPool };
interface PgClient { query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; release(): void }
interface PgPool { connect(): Promise<PgClient>; query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; end(): Promise<void> }

const VOICE_CONSENT_V3 = 'VOICE_RECORDING_V3';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => performance.now();

/** The synthetic workload. Times are milliseconds; every latency is seeded, so a run is repeatable up to scheduling. */
const WORKLOAD = Object.freeze({
  shortCalls: 6,
  shortTurns: 8,
  longTurns: 20,
  // The person's turn before each commit: 900 ms is a deliberately fast exchange (a stress pace); S8B05_CP3_USER_SPEAK_MS sets
  // a conversational pace for a comparison run.
  userSpeakMs: Number(process.env.S8B05_CP3_USER_SPEAK_MS ?? 900),
  replyFirstTokenMs: [380, 160] as const,
  replyTailMs: 450,
  ttsFirstAudioMs: 120,
  segmentationMs: [200, 80] as const,
  focusMs: [240, 90] as const,
  threadMs: [220, 80] as const,
  providerSlots: 8,
});
const FOCUS_NAMES = ['سامي', 'منى', 'كريم', 'هالة', 'يوسف', 'نادية', 'طارق', 'ليلى', 'عمر', 'سلمى', 'رامي', 'دينا'];
const userWords = (i: number) => `${FOCUS_NAMES[i % FOCUS_NAMES.length]} كلمني النهارده عن الشغل. الموضوع ده شاغلني من امبارح.`;
const REPLY = 'فاهمك، احكيلي حصل إيه بالظبط.';
// RE-ANCHORED by DEC-R1-1 (was 0): the call's ACTIVATION adopts a session's one pre-call exchange, numbered -1000 (0191 keeps
// the 1000 slots below the first turn for an exchange that completes between the activation and that turn).
const PRE_CALL = -1000;

function loopbackUrl(): string {
  const url = process.env.DATABASE_URL ?? '';
  let host = '';
  try { host = new URL(url).hostname; } catch { host = ''; }
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) throw new Error('S8B05_CP3_PROOF_REFUSED: DATABASE_URL must name a loopback throwaway database');
  return url;
}

/** Seeded PRNG (mulberry32): the fake providers' latencies repeat run to run. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ONE fake provider capacity shared by the live reply and every analysis call (FIFO). */
class SharedCapacity {
  private free: number;
  private readonly waiting: Array<() => void> = [];
  /** Slot-milliseconds held, and since when the busy count last changed: the provider's utilization over a run. */
  private busySlotMs = 0;
  private busy = 0;
  private changedAt = now();
  private readonly startedAt = now();
  constructor(private readonly slots: number) { this.free = slots; }
  async acquire(): Promise<void> {
    if (this.free > 0) { this.free -= 1; this.account(1); return; }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }
  release(): void {
    const next = this.waiting.shift();
    if (next) next(); else { this.free += 1; this.account(-1); }
  }
  /** The share of the provider's slot-time held so far (1 = every slot busy all the time). */
  utilization(): number {
    this.account(0);
    return this.busySlotMs / (this.slots * Math.max(1, now() - this.startedAt));
  }
  private account(delta: number): void {
    const at = now();
    this.busySlotMs += this.busy * (at - this.changedAt);
    this.changedAt = at;
    this.busy += delta;
  }
}

/**
 * Latency instrumentation, for measurement only (identifiers, instants and outcomes; never words): every provider call
 * and every RPC is a span attributed to its session, so each analysis item's time can be split into its stages.
 */
interface Span { readonly session: string | null; readonly stage: string; readonly start: number; readonly end: number; readonly queuedMs: number; readonly outcome: string | null }
const tracer = {
  /** The analysis item being established (set around the establishment service's two entry points). */
  item: new AsyncLocalStorage<{ readonly session: string }>(),
  sessionOfUser: new Map<string, string>(),
  spans: [] as Span[],
};

/**
 * PostgREST's service_role hop, as a shim: the same definer, the same role, JSON values, the same error identity.
 * S8B05_CP3_RPC_RTT_MS adds a fixed delay to every RPC: the hosted hop's round trip, which loopback does not have.
 */
const RPC_NAME = /^(?:server_[a-z0-9_]+|commit_conversation_units_call_half_v1|commit_finalized_exchange_with_full_semantic_chain_v1|get_conversation_full_semantic_integrated_batch_snapshot_v1|get_conversation_full_semantic_runtime_context_v1|get_conversation_thread_identity_dossier_page_v1)$/u;
const RPC_RTT_MS = Number(process.env.S8B05_CP3_RPC_RTT_MS ?? 0);
class PgServiceRoleRpc {
  calls = 0;
  constructor(private readonly pool: PgPool) {}
  async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    if (!RPC_NAME.test(name)) throw new Error(`S8B05_CP3_PROOF_RPC_NAME ${name}`);
    this.calls += 1;
    const session = tracer.item.getStore()?.session
      ?? (typeof body.p_session_id === 'string' ? body.p_session_id : tracer.sessionOfUser.get(String(body.p_user_id)) ?? null);
    const start = now();
    let outcome: string | null = null;
    const entries = Object.entries(body);
    const args = entries.map(([key], i) => `${key} => $${i + 1}`).join(', ');
    const values = entries.map(([, v]) => (Array.isArray(v) && v.length > 0 && v.every((e) => typeof e === 'string')) ? v
      : (v !== null && typeof v === 'object') ? JSON.stringify(v) : v);
    if (RPC_RTT_MS > 0) await sleep(RPC_RTT_MS);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE service_role');
      const result = await client.query(`SELECT * FROM public.${name}(${args})`, values);
      await client.query('COMMIT');
      const first = result.rows[0] as { outcome?: unknown } | undefined;
      outcome = typeof first?.outcome === 'string' ? first.outcome : null;
      return JSON.parse(JSON.stringify(result.rows)) as T;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      const e = error as { code?: string; message?: string };
      outcome = 'ERROR';
      throw new DataApiError(400, { databaseCode: e.code, databaseMessage: e.message });
    } finally {
      client.release();
      tracer.spans.push({ session, stage: name, start, end: now(), queuedMs: 0, outcome });
    }
  }
}

type Kind = 'SEGMENTATION' | 'FOCUS' | 'THREAD' | 'CONTINUITY' | 'REPLY';
interface Providers {
  readonly counts: Record<Kind, number>;
  failNextSegmentations: number;
  readonly segmentation: CuSegmentationProvider;
  readonly focus: FocusProvider;
  readonly thread: ThreadProvider;
  readonly continuity: ContinuityProvider;
  reply(): Promise<{ firstTokenAt: number; done: Promise<void> }>;
}
function providers(capacity: SharedCapacity, seed: number): Providers {
  // Two streams: the analysis latencies vary by seed; the live reply's draw the SAME sequence in every mode, so a mode's
  // First Audio differs from M0's only by what the analysis did to it.
  const random = prng(seed);
  const replyRandom = prng(4242);
  const jitterFrom = (r: () => number) => ([base, spread]: readonly [number, number]) => Math.max(10, Math.round(base + (r() - 0.5) * 2 * spread));
  const jitter = jitterFrom(random);
  const replyJitter = jitterFrom(replyRandom);
  const counts: Record<Kind, number> = { SEGMENTATION: 0, FOCUS: 0, THREAD: 0, CONTINUITY: 0, REPLY: 0 };
  const call = async <T>(kind: Kind, ms: number, answer: () => T): Promise<T> => {
    counts[kind] += 1;
    const session = tracer.item.getStore()?.session ?? null;
    const start = now();
    await capacity.acquire();
    const queuedMs = now() - start;
    try { await sleep(ms); return answer(); } finally {
      capacity.release();
      tracer.spans.push({ session, stage: `PROVIDER_${kind}`, start, end: now(), queuedMs, outcome: null });
    }
  };
  const p: Providers = {
    counts,
    failNextSegmentations: 0,
    segmentation: {
      propose: (request: CuSegmentationRequest) => call('SEGMENTATION', jitter(WORKLOAD.segmentationMs), () => {
        if (p.failNextSegmentations > 0) { p.failNextSegmentations -= 1; throw new CuSegmentationProviderError('PROVIDER_ERROR'); }
        const units: SourceAnchor[] = request.sourceText.split(/(?<=[.؟!])\s+/u).map((text) => text.trim()).filter((text) => text.length > 0)
          .map((text) => ({ text, occurrence: 1 }));
        return { units };
      }),
    },
    focus: {
      propose: (request: FocusRequest) => call('FOCUS', jitter(WORKLOAD.focusMs), (): FocusProposal => {
        const none: FocusProposal = {
          functions: ['INFORM_REPORT'], sequencePosition: 'UNMARKED', targetCuId: null, references: [], claimAttributions: [],
          attention: { kind: 'NO_INDEPENDENT_FOCUS', existingFocusCandidateId: null, groundingAnchor: null, reason: 'INCIDENTAL_OR_SUBORDINATE' },
        };
        if (request.currentCu.sourceRole !== 'USER' || request.currentCu.ordinalWithinTurn !== 0) return none;
        const word = request.currentCu.committedText.split(/\s+/u)[0]!;
        return {
          ...none,
          references: [{ anchor: { text: word, occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: null, candidateHandleIds: [], newReference: true }],
          attention: { kind: 'START_NEW_FOCUS', existingFocusCandidateId: null, groundingAnchor: { text: word, occurrence: 1 }, reason: 'DIRECT_SUBJECT' },
        };
      }),
    },
    thread: {
      propose: (_request: ThreadRequest) => call('THREAD', jitter(WORKLOAD.threadMs), (): ThreadProposal => ({
        decision: 'NO_ESTABLISHMENT', path: null, evidenceCuIds: [], explicitSelectionAnchor: null,
      })),
    },
    continuity: FakeThreadContinuityProvider.nominatingAll({ decision: 'DISTINCT_NEW', threadId: null, candidateThreadIds: [], currentEvidenceReferenceIndexes: [], priorEvidenceRefs: [] }),
    reply: async () => {
      counts.REPLY += 1;
      // Drawn before the wait, so the draw order does not depend on the contention.
      const firstToken = replyJitter(WORKLOAD.replyFirstTokenMs);
      await capacity.acquire();
      await sleep(firstToken);
      const firstTokenAt = now();
      const done = sleep(WORKLOAD.replyTailMs).then(() => capacity.release());
      return { firstTokenAt, done };
    },
  };
  return p;
}

const percentile = (values: readonly number[], p: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!);
};
const summary = (values: readonly number[]) => ({ n: values.length, p50: percentile(values, 50), p95: percentile(values, 95), max: values.length ? Math.round(Math.max(...values)) : null });

/** The RPCs the analysis runtime makes (the synthetic driver's own commands are left out of the breakdown). */
const STAGE_OF_RPC: Record<string, string> = {
  server_read_call_analysis_turns_v1: 'readTurns',
  get_conversation_full_semantic_integrated_batch_snapshot_v1: 'snapshotRead',
  get_conversation_full_semantic_runtime_context_v1: 'contextRead',
  get_conversation_thread_identity_dossier_page_v1: 'dossierRead',
  commit_conversation_units_call_half_v1: 'commitRpc',
};
const STAGE_OF_PROVIDER: Record<string, string> = {
  PROVIDER_SEGMENTATION: 'segmentation', PROVIDER_FOCUS: 'focus', PROVIDER_THREAD: 'thread', PROVIDER_CONTINUITY: 'continuity',
};
type UserHalfStages = Record<string, number> & { idx: number };

/**
 * Where each USER half's time went, from its commit to its half (and Live Focus) committed:
 *   [commit -> claim]   wake (commit -> first claim attempt), backlog (the session's earlier items being processed: FIFO,
 *                       the pre-call exchange first), lockWait (a BUSY claim until the next attempt), claimRpc, scheduling;
 *   [claim -> permit]   the permit wait, split by what each ask answered (L2's critical window, the per-person limit, capacity);
 *   [permit -> commit]  the reads, each provider call (its wait for provider capacity and its service time), the commit RPC,
 *                       and local processing (canonicalization, the LF reduction, mapping) as the remainder.
 */
function userHalfStages(
  timings: ReadonlyArray<{ readonly session: string; readonly idx: number; readonly commitAt: number }>,
  observations: readonly CallAnalysisObservation[],
  spans: readonly Span[],
): UserHalfStages[] {
  const out: UserHalfStages[] = [];
  for (const t of timings) {
    const mine = observations.filter((o) => o.sessionId === t.session);
    const isThis = (o: CallAnalysisObservation) => 'callTurnIndex' in o && o.callTurnIndex === t.idx && 'half' in o && o.half === 'USER';
    const est = mine.find((o) => o.kind === 'ESTABLISHED' && isThis(o));
    if (!est) continue;
    const claimed = mine.filter((o) => o.kind === 'CLAIMED' && isThis(o) && o.at <= est.at).at(-1);
    const permit = mine.filter((o) => o.kind === 'PERMIT' && o.granted && isThis(o) && o.at <= est.at).at(-1);
    if (!claimed || !permit) continue;
    const ss = spans.filter((s) => s.session === t.session).sort((a, b) => a.start - b.start);
    const s: UserHalfStages = { idx: t.idx } as UserHalfStages;
    const add = (key: string, ms: number) => { s[key] = (s[key] ?? 0) + ms; };

    // [commit -> claim], classified millisecond by millisecond so nothing is counted twice.
    const backlog: Array<[number, number]> = [];
    for (const c of mine.filter((o) => o.kind === 'CLAIMED' && !isThis(o) && o.at < claimed.at)) {
      const done = mine.find((o) => o.kind === 'SETTLED' && o.at >= c.at && 'callTurnIndex' in c && o.callTurnIndex === c.callTurnIndex && o.half === (c as { half: string }).half);
      backlog.push([c.at, done?.at ?? claimed.at]);
    }
    const claims = ss.filter((x) => x.stage === 'server_claim_call_analysis_item_v1');
    const busy: Array<[number, number]> = claims.filter((x) => x.outcome === 'BUSY')
      .map((x) => [x.end, claims.find((y) => y.start > x.end)?.start ?? claimed.at]);
    const final = claims.filter((x) => x.outcome === 'CLAIMED' && x.end <= claimed.at + 1).at(-1);
    const firstAttempt = claims.find((x) => x.start >= t.commitAt - 1);
    const inside = (ms: number, list: Array<[number, number]>) => list.some(([a, b]) => ms >= a && ms < b);
    for (let ms = t.commitAt; ms < claimed.at; ms += 1) {
      if (inside(ms, backlog)) add('backlog', 1);
      else if (inside(ms, busy)) add('lockWait', 1);
      else if (final && ms >= final.start && ms < final.end) add('claimRpc', 1);
      else if (!firstAttempt || ms < firstAttempt.start) add('wake', 1);
      else add('scheduling', 1);
    }
    s.commitToClaim = claimed.at - t.commitAt;

    // [claim -> permit]: each ask's answer holds until the next ask.
    const asks = ss.filter((x) => x.stage === 'server_acquire_background_permit_v1' && x.start >= claimed.at - 1 && x.end <= permit.at + 1);
    asks.forEach((a, k) => {
      const until = asks[k + 1]?.start ?? permit.at;
      const key = a.outcome === 'WAIT_CRITICAL_WINDOW' ? 'permitCriticalWindow' : a.outcome === 'WAIT_USER_LIMIT' ? 'permitUserLimit'
        : a.outcome === 'WAIT_CAPACITY' ? 'permitCapacity' : 'permitGrantRpc';
      add(key, until - a.start);
    });
    s.permitTotal = permit.at - claimed.at;
    s.permitAsks = asks.length;

    // [permit -> commit]
    let accounted = 0;
    let firstProvider = Number.NaN;
    for (const x of ss.filter((y) => y.start >= permit.at - 1 && y.end <= est.at + 1)) {
      const rpc = STAGE_OF_RPC[x.stage];
      const provider = STAGE_OF_PROVIDER[x.stage];
      if (!rpc && !provider) continue;
      const ms = x.end - x.start;
      accounted += ms;
      if (rpc) add(rpc, ms);
      if (provider) {
        if (!Number.isFinite(firstProvider)) firstProvider = x.start;
        add(provider, ms);
        add('providerCapacityWait', x.queuedMs);
        add('providerService', ms - x.queuedMs);
        add('providerCalls', 1);
      }
    }
    s.local = Math.max(0, est.at - permit.at - accounted);
    s.commitToFirstProviderCall = firstProvider - t.commitAt;
    s.total = est.at - t.commitAt;
    out.push(s);
  }
  return out;
}

const STAGE_KEYS = ['wake', 'backlog', 'lockWait', 'claimRpc', 'scheduling', 'permitTotal', 'permitCriticalWindow', 'permitUserLimit', 'permitCapacity',
  'permitGrantRpc', 'permitAsks', 'readTurns', 'snapshotRead', 'contextRead', 'segmentation', 'focus', 'thread', 'continuity', 'dossierRead', 'commitRpc',
  'local', 'providerCalls', 'providerCapacityWait', 'providerService', 'total'] as const;
function stageSummary(stages: readonly UserHalfStages[]): Record<string, { p50: number | null; p95: number | null }> & { n: number } {
  const out = { n: stages.length } as Record<string, { p50: number | null; p95: number | null }> & { n: number };
  for (const key of STAGE_KEYS) {
    const values = stages.map((s) => s[key] ?? 0);
    out[key] = { p50: percentile(values, 50), p95: percentile(values, 95) };
  }
  return out;
}

/** S3's one gate after the end (A3.1): the live reply service's fold and its SafetyResponseGateService over the given reader. */
function endedCallSafety(): LiveCallReplyService {
  return new LiveCallReplyService(new LiveCallConversationBinding(), {} as SupabaseDataApiService, new SafetyResponseGateService(),
    {} as never, {} as never, {} as never, {} as never, null);
}

/** One "instance" of the analysis runtime: the REAL worker, establishment service, permit gate and queue repository. */
function analysisWorker(serviceApi: SupabaseServiceRoleApiService, prov: Providers, start: CallAnalysisStart, observations: CallAnalysisObservation[],
  instance: string, onObserve?: (observation: CallAnalysisObservation) => void): CallAnalysisWorker {
  const permits = new DatabaseBackgroundPermitGate(serviceApi);
  const semantic = new ConversationSemanticEstablishmentService(
    new ConversationSemanticRuntimeRepository(serviceApi),
    () => ({ provider: prov.segmentation, providerName: 'OPENAI', providerModel: 'gpt-5-mini' }),
    () => ({ provider: prov.focus, providerName: 'OPENAI', providerModel: 'gpt-5-mini' }),
    () => ({ provider: prov.thread, providerName: 'OPENAI', providerModel: 'gpt-5-mini' }),
    () => ({ provider: prov.continuity, providerName: 'OPENAI', providerModel: 'gpt-5-mini' }),
    permits,
  );
  // The same service, its two entry points run inside the item's measurement scope (nothing else changes).
  const measured: Pick<ConversationSemanticEstablishmentService, 'establishCallHalf' | 'establishExchange'> = {
    establishCallHalf: (userId, item, turn) => tracer.item.run({ session: turn.session_id }, () => semantic.establishCallHalf(userId, item, turn)),
    establishExchange: (userId, turn, reply, options) => tracer.item.run({ session: turn.session_id }, () => semantic.establishExchange(userId, turn, reply, options)),
  };
  return new CallAnalysisWorker({
    store: new CallAnalysisRepository(serviceApi), semantic: measured, permits, safety: endedCallSafety(), start,
    observe: (o) => { observations.push({ ...o, instance } as unknown as CallAnalysisObservation); onObserve?.(o); },
    now,
  });
}

/** What R4's child process is told: the call whose last exchange has no stored Safety, and whether its reads fail. */
interface ChildSpec { readonly session: string; readonly call: string; readonly mode: 'FAILING' | 'HEALTHY' }
const CHILD_RESULT = 'S8B05_CP3_CHILD_RESULT ';

/**
 * R4's child: a separate OS process running one worker instance over its own pool, as an API process does. FAILING: every
 * context read fails; it runs until S3 has left the exchange OPEN at least twice and the rest of the order is done, prints
 * what it saw, and exits abruptly (no stop, no cleanup: the process dies). HEALTHY: it runs until the exchange is closed and
 * the session's order is empty, prints, and exits the same way.
 */
async function child(spec: ChildSpec): Promise<never> {
  const pool = new Pool({ connectionString: loopbackUrl(), max: 8 });
  const serviceApi = new PgServiceRoleRpc(pool) as unknown as SupabaseServiceRoleApiService;
  const observations: CallAnalysisObservation[] = [];
  const w = analysisWorker(serviceApi, providers(new SharedCapacity(WORKLOAD.providerSlots), spec.mode === 'FAILING' ? 11 : 12), 'AT_COMMIT', observations, spec.mode);
  const store = (w as unknown as { deps: { store: CallAnalysisRepository } }).deps.store;
  const read = store.readCallContext.bind(store);
  let contextReads = 0;
  store.readCallContext = async (...args: Parameters<CallAnalysisRepository['readCallContext']>) => {
    contextReads += 1;
    if (spec.mode === 'FAILING') throw new Error('the call context could not be read');
    return read(...args);
  };
  const q = async (text: string, values: unknown[]) => (await pool.query(text, values)).rows;
  const open = async () => Number((await q(`SELECT count(*)::int AS n FROM voice_private.call_analysis_queue WHERE session_id = $1
    AND queue_state NOT IN ('COMPLETE', 'ABANDONED_INTEGRITY')`, [spec.session]))[0]!.n);
  const closed = async () => String((await q('SELECT exchange_state FROM voice_private.call_exchanges WHERE call_id = $1 AND call_turn_index = 2', [spec.call]))[0]!.exchange_state) === 'CLOSED';
  const s3 = (result: string) => observations.filter((o) => o.kind === 'S3' && o.sessionId === spec.session && o.result === result).length;
  w.start();
  const started = now();
  let finished = false;
  while (!finished && now() - started < 60_000) {
    finished = spec.mode === 'FAILING' ? s3('LEFT_OPEN') >= 2 && await open() === 0 : await closed() && await open() === 0;
    if (!finished) await sleep(200);
  }
  const established = observations.filter((o) => o.kind === 'ESTABLISHED' && o.sessionId === spec.session)
    .map((o) => `${(o as { callTurnIndex: number }).callTurnIndex}:${(o as { half: string }).half}`);
  process.stdout.write(`\n${CHILD_RESULT}${JSON.stringify({ pid: process.pid, mode: spec.mode, finished, established, contextReads,
    s3: { closed: s3('CLOSED'), leftOpen: s3('LEFT_OPEN') } })}\n`);
  process.exit(0);
}

async function main(): Promise<void> {
  if (process.env.S8B05_CP3_CHILD) await child(JSON.parse(process.env.S8B05_CP3_CHILD) as ChildSpec);
  const pool = new Pool({ connectionString: loopbackUrl(), max: 24 });
  const sql = async (text: string, values: unknown[] = []) => (await pool.query(text, values)).rows;
  const shim = new PgServiceRoleRpc(pool);
  const serviceApi = shim as unknown as SupabaseServiceRoleApiService;
  process.stdout.write('S8B-05 CP3 Fast Live Analysis synthetic proof (transport: service_role connection; providers: fakes over one shared capacity)\n');

  // ---------------------------------------------------------------- fixtures, snapshotted first and restored at the end
  const SCOPES = ['PERSONAL_LIVE_CALL'];
  const humans: string[] = [];
  const gatesBefore = await sql('SELECT * FROM voice_private.voice_launch_capability_states WHERE capability_scope = ANY($1::text[])', [SCOPES]);
  const policyBefore = (await sql('SELECT * FROM voice_private.live_call_policy'))[0]!;
  const permitPolicyBefore = (await sql('SELECT * FROM voice_private.background_permit_policy'))[0]!;
  const gatesEnabledBefore = Number((await sql("SELECT count(*) AS n FROM voice_private.voice_launch_capability_states WHERE feature_flag_state = 'ENABLED'"))[0]!.n);
  await sql("SELECT * FROM voice_private.set_voice_launch_capability_v1('PERSONAL_LIVE_CALL', 'ENABLED', 'SATISFIED', 's8b-05-cp3-proof', 'local synthetic proof')");
  await sql(`SELECT voice_private.set_live_call_policy_v1(64, p.reconnect_grace_seconds, p.connect_timeout_seconds, p.seat_lease_seconds,
      p.max_call_seconds, 's8b-05-cp3-proof', 'local synthetic proof') FROM voice_private.live_call_policy p`);

  const report: Record<string, unknown> = { workload: WORKLOAD, modes: {} };
  const checks: string[] = [];
  const check = (name: string, ok: boolean, detail = '') => {
    checks.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
    process.stdout.write(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}\n`);
    assert.ok(ok, name);
  };

  try {
    const person = async () => {
      const user = randomUUID();
      const session = randomUUID();
      humans.push(user);
      tracer.sessionOfUser.set(user, session);
      await sql('INSERT INTO auth.users(id) VALUES ($1)', [user]);
      await sql("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, user]);
      await shim.rpc('server_grant_voice_recording_consent_v1', { p_user_id: user, p_command_id: randomUUID(), p_consent_version: VOICE_CONSENT_V3 });
      return { user, session };
    };

    /** A completed text exchange through the text path's own commands (the pre-call history O3b adopts). */
    const textExchange = async (user: string, session: string, content: string, reply: string) => {
      const client = await pool.connect();
      try {
        const userTurn = randomUUID();
        const assistantTurn = randomUUID();
        await client.query('BEGIN');
        await client.query("SELECT set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: user, role: 'authenticated' }), user]);
        await client.query('SET LOCAL ROLE authenticated');
        await client.query('SELECT * FROM public.create_user_conversation_turn($1, $2, $3, $4)', [userTurn, session, content, null]);
        await client.query('RESET ROLE');
        await client.query('SET LOCAL ROLE service_role');
        await client.query('SELECT * FROM public.claim_conversation_turn($1, $2, $3, $4, $5)', [session, user, userTurn, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT']);
        await client.query('SELECT * FROM public.finalize_conversation_turn_v2($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [session, user, userTurn, assistantTurn, reply, 'ALLOW', randomUUID(), null, null, null]);
        await client.query('COMMIT');
        return { userTurn, assistantTurn };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    };

    // ------------------------------------------------------------------------------------- one synthetic live call
    interface Call { user: string; session: string; call: string; recording: string; next: { USER: number; QANDEEL: number }; end: { USER: number; QANDEEL: number } }
    const one = async (name: string, body: Record<string, unknown>) => (await shim.rpc<Array<Record<string, unknown>>>(name, body))[0]!;
    const begin = async (p: { user: string; session: string }): Promise<Call> => {
      const call = randomUUID();
      assert.equal((await one('server_begin_call_v1', { p_user_id: p.user, p_session_id: p.session, p_call_id: call, p_client_instance_id: randomUUID() })).outcome, 'BEGUN');
      const a = await one('server_activate_call_v1', { p_user_id: p.user, p_call_id: call, p_connection_epoch: 1 });
      assert.equal(a.outcome, 'ACTIVE');
      return { ...p, call, recording: String(a.recording_id), next: { USER: 0, QANDEEL: 0 }, end: { USER: 0, QANDEEL: 0 } };
    };
    const audio = async (x: Call, track: 'USER' | 'QANDEEL', endMs: number) => {
      const r = await sql('SELECT * FROM public.server_add_call_segment_v2($1, $2, 1, $3, $4, $5, $6, 4096, 20)', [x.user, x.recording, track, x.next[track], x.end[track], endMs]);
      assert.equal(r[0]!.outcome, 'ADDED');
      x.next[track] += 1;
      x.end[track] = endMs;
    };

    /** What the driver saw of one turn: the instants the analysis is measured against. */
    interface TurnTiming { session: string; idx: number; commitAt: number; firstAudioAt: number; closeAt: number }

    const runCall = async (
      x: Call, turns: number, wordsOffset: number, prov: Providers, signal: LiveCallAnalysisSignal, timings: TurnTiming[],
      options: { leaveLastSafetyUnstored?: boolean; firstSpeakMs?: number } = {},
    ) => {
      for (let i = 1; i <= turns; i += 1) {
        await sleep(i === 1 && options.firstSpeakMs !== undefined ? options.firstSpeakMs : WORKLOAD.userSpeakMs);
        await audio(x, 'USER', x.end.USER + 1000);
        const content = userWords(wordsOffset + i);
        const committed = await one('server_commit_live_call_turn_v1', {
          p_user_id: x.user, p_call_id: x.call, p_connection_epoch: 1, p_turn_id: randomUUID(), p_commit_id: randomUUID(), p_turn_channel: 'SPEECH',
          p_content: content, p_asr_confidence_band: 'HIGH', p_turn_start_ms: x.end.USER - 1000, p_turn_end_ms: x.end.USER, p_retrieval_terms: [],
          p_provider_call_id: randomUUID(), p_event_id: randomUUID(),
        }).catch(async () => (await sql('SELECT * FROM public.server_commit_live_call_turn_v1($1, $2, 1, $3, $4, \'SPEECH\', $5, \'HIGH\', $6, $7, $8, $9, $10)',
          [x.user, x.call, randomUUID(), randomUUID(), content, x.end.USER - 1000, x.end.USER, [], randomUUID(), randomUUID()]))[0]!);
        assert.equal(committed.outcome, 'COMMITTED');
        const idx = Number(committed.call_turn_index);
        const commitAt = now();
        signal.kick(x.session, 'TURN_COMMITTED');
        if (options.leaveLastSafetyUnstored && i === turns) {
          // The process "dies" here: the turn is committed, its Safety never stored, and the call is ended by the sweep.
          timings.push({ session: x.session, idx, commitAt, firstAudioAt: Number.NaN, closeAt: Number.NaN });
          return;
        }
        assert.equal((await one('server_store_call_turn_safety_v1', { p_user_id: x.user, p_call_id: x.call, p_call_turn_index: idx, p_safety_disposition: 'ALLOW' })).outcome, 'STORED');
        const reply = await prov.reply();
        const registered = await sql('SELECT * FROM public.server_register_call_reply_segment_v1($1, $2, 1, $3, 0, $4, 0, 400, $5)', [x.user, x.call, idx, REPLY, []]);
        assert.equal(registered[0]!.outcome, 'REGISTERED');
        await sleep(Math.max(0, WORKLOAD.ttsFirstAudioMs - (now() - reply.firstTokenAt)));
        const firstAudioAt = now();
        signal.kick(x.session, 'FIRST_AUDIO');
        await reply.done;
        assert.equal((await sql('SELECT * FROM public.server_finish_call_reply_generation_v1($1, $2, 1, $3, \'COMPLETE\', 400)', [x.user, x.call, idx]))[0]!.outcome, 'FINISHED');
        const start = x.end.QANDEEL;
        assert.equal((await sql('SELECT * FROM public.server_confirm_call_playout_v1($1, $2, 1, $3, 400, $4)', [x.user, x.call, idx, start]))[0]!.outcome, 'ADVANCED');
        await audio(x, 'QANDEEL', start + 400);
        const closed = await sql('SELECT * FROM public.server_close_live_call_exchange_v1($1, $2, 1, $3, \'PLAYED_OUT\', $4, $5)', [x.user, x.call, idx, randomUUID(), randomUUID()]);
        assert.equal(closed[0]!.outcome, 'CLOSED');
        const closeAt = now();
        signal.kick(x.session, 'EXCHANGE_CLOSED');
        timings.push({ session: x.session, idx, commitAt, firstAudioAt, closeAt });
      }
      assert.equal((await one('server_end_call_v1', { p_user_id: x.user, p_call_id: x.call, p_connection_epoch: 1, p_end_reason: 'USER_ENDED' })).outcome, 'ENDED');
    };

    // ------------------------------------------------------------------------------------- the analysis runtime
    const replyService = endedCallSafety();
    const makeWorker = (prov: Providers, start: CallAnalysisStart, observations: CallAnalysisObservation[], instance: string,
      onObserve?: (observation: CallAnalysisObservation) => void) => analysisWorker(serviceApi, prov, start, observations, instance, onObserve);
    const openItems = async (sessions: readonly string[]) => Number((await sql(`SELECT count(*)::int AS n FROM voice_private.call_analysis_queue
      WHERE session_id = ANY($1::uuid[]) AND queue_state NOT IN ('COMPLETE', 'ABANDONED_INTEGRITY')`, [sessions]))[0]!.n);
    const drained = async (sessions: readonly string[], timeoutMs = 180_000) => {
      const started = now();
      while (now() - started < timeoutMs) {
        if (await openItems(sessions) === 0) return now() - started;
        await sleep(200);
      }
      throw new Error(`S8B05_CP3_PROOF_NOT_DRAINED: ${await openItems(sessions)} open items`);
    };

    // ------------------------------------------------------------------------------------- M0 / M1 / M1′
    // Each analysis mode runs under the permit policy 0191 ships (A1 §3: B_total 16, k 2, B_min 2, two per person - values
    // S8B-08 calibrates against the real provider) and under a policy calibrated to the fake capacity (B_total = its slots):
    // what the shipped values do on a provider tighter than they assume, and what calibration does. CONSERVATIVE is the
    // setting this proof proposes before any real calibration (never applied by 0191; a Product Owner decision, set through
    // set_background_permit_policy_v1): at most 4 background permits, one fewer per live generation, never below one, so
    // background work never holds most of a provider's capacity when replies start.
    const PERMIT_PROFILES = {
      SHIPPED: null,
      CALIBRATED: { total: WORKLOAD.providerSlots, minimum: 2, weight: 2, perUser: 2 },
      CONSERVATIVE: { total: 4, minimum: 1, weight: 1, perUser: 2 },
    } as const;
    type Profile = keyof typeof PERMIT_PROFILES;
    const profiles = (process.env.S8B05_CP3_PROFILES ?? 'SHIPPED,CALIBRATED,CONSERVATIVE').split(',').map((s) => s.trim()) as Profile[];
    for (const profile of profiles) assert.ok(profile in PERMIT_PROFILES, `unknown profile ${profile}`);
    const modes: Array<{ key: string; start: CallAnalysisStart | null; profile: Profile | null }> = [
      { key: 'M0', start: null, profile: null },
      ...profiles.flatMap((profile) => [
        { key: `M1_${profile}`, start: 'AFTER_FIRST_AUDIO' as const, profile },
        { key: `M1_PRIME_${profile}`, start: 'AT_COMMIT' as const, profile },
      ]),
    ];
    // A reliability-only run (R1 - R4, no measurement) for iterating on the scenarios; never what CI or the record runs.
    if (process.env.S8B05_CP3_RELIABILITY_ONLY === '1') modes.length = 0;
    // The DEC-R1-1 matrix alone (below): no M0 / M1 / M1′ load and no R1 - R4. It runs unchanged on a database without the
    // amendment (adoption at the first turn), which is how its "before" is measured.
    const O3B_ONLY = process.env.S8B05_CP3_SCENARIO === 'O3B';
    if (O3B_ONLY) modes.length = 0;
    report.permitProfiles = { SHIPPED: { total: Number(permitPolicyBefore.total_permits), minimum: Number(permitPolicyBefore.minimum_permits),
      weight: Number(permitPolicyBefore.live_generation_weight), perUser: Number(permitPolicyBefore.per_user_permits) }, CALIBRATED: PERMIT_PROFILES.CALIBRATED, CONSERVATIVE: PERMIT_PROFILES.CONSERVATIVE };
    const setPermitPolicy = async (profile: Profile | null) => {
      const v = (profile ? PERMIT_PROFILES[profile] : null) ?? (report.permitProfiles as { SHIPPED: { total: number; minimum: number; weight: number; perUser: number } }).SHIPPED;
      await sql('SELECT voice_private.set_background_permit_policy_v1($1, $2, $3, $4, $5, $6, $7)',
        [v.total, v.minimum, v.weight, v.perUser, Number(permitPolicyBefore.lease_seconds), 's8b-05-cp3-proof', 'local synthetic proof']);
    };
    const firstAudio: Record<string, number[]> = {};
    for (const [modeIndex, mode] of modes.entries()) {
      await setPermitPolicy(mode.profile);
      const capacity = new SharedCapacity(WORKLOAD.providerSlots);
      const prov = providers(capacity, 1000 + modeIndex);
      const signal = new LiveCallAnalysisSignal();
      const observations: CallAnalysisObservation[] = [];
      tracer.spans = [];
      const workers = mode.start ? [makeWorker(prov, mode.start, observations, 'A'), makeWorker(prov, mode.start, observations, 'B')] : [];
      // Two instances: a call lives on one of them and kicks only that instance's worker (sticky, as a call's socket is);
      // both scan, so either may hold a session's order at a given moment.
      const route = new Map<string, number>();
      signal.bind(workers.length ? { kick: (sessionId, reason) => workers[(route.get(sessionId) ?? 0) % workers.length]!.kick(sessionId, reason) } : null);
      for (const w of workers) w.start();

      const people = await Promise.all(Array.from({ length: WORKLOAD.shortCalls + 1 }, () => person()));
      // O3b: every session has one unestablished pre-call text exchange the call adopts at the head of its order.
      const preCall = await Promise.all(people.map((p, i) => textExchange(p.user, p.session, userWords(100 + i), 'تمام، وبعدين؟')));
      const sessions = people.map((p) => p.session);
      people.forEach((p, i) => route.set(p.session, i));
      const timings: TurnTiming[] = [];
      const depth: number[] = [];
      const age: number[] = [];
      let sampling = true;
      const sampler = (async () => {
        while (sampling) {
          const [row] = await sql(`SELECT count(*)::int AS n, COALESCE(EXTRACT(EPOCH FROM clock_timestamp() - min(enqueued_at)) * 1000, 0)::float8 AS age
            FROM voice_private.call_analysis_queue WHERE session_id = ANY($1::uuid[]) AND queue_state NOT IN ('COMPLETE', 'ABANDONED_INTEGRITY')`, [sessions]);
          depth.push(Number(row!.n));
          age.push(Number(row!.age));
          await sleep(250);
        }
      })();
      const started = now();
      const calls = await Promise.all(people.map((p) => begin(p)));
      // The connection kicks the worker once the call is ACTIVE (O3b as amended by DEC-R1-1): the pre-call exchange's analysis
      // may start while the person has not spoken yet.
      for (const x of calls) signal.kick(x.session, 'CALL_ACTIVATED');
      const adoptedAtActivation = Number((await sql(`SELECT count(*)::int AS n FROM voice_private.call_analysis_queue
        WHERE session_id = ANY($1::uuid[]) AND half = 'EXCHANGE' AND call_turn_index = $2`, [sessions, PRE_CALL]))[0]!.n);
      check(`${mode.key}: the activation adopted every pre-call exchange before any turn (O3b as amended by DEC-R1-1)`,
        adoptedAtActivation === preCall.length, `${adoptedAtActivation}/${preCall.length}`);
      await Promise.all(calls.map((x, i) => runCall(x, i === 0 ? WORKLOAD.longTurns : WORKLOAD.shortTurns, i * 40, prov, signal, timings)));
      const callsWallMs = now() - started;
      // The fake provider's utilization while the calls ran (replies and analysis together): above ~0.8, a queue forms.
      const providerUtilization = Number(capacity.utilization().toFixed(2));
      const drainMs = mode.start ? await drained(sessions) : null;
      sampling = false;
      await sampler;
      for (const w of workers) await w.stop();
      signal.bind(null);

      firstAudio[mode.key] = timings.map((t) => t.firstAudioAt - t.commitAt);
      const result: Record<string, unknown> = {
        firstAudioMs: summary(firstAudio[mode.key]!),
        callsWallMs: Math.round(callsWallMs),
        providerUtilization,
        exchanges: timings.length,
        replyProviderCalls: prov.counts.REPLY,
      };
      if (mode.start) {
        const at = (o: CallAnalysisObservation) => o.at;
        const userHalf = (kind: CallAnalysisObservation['kind'], t: TurnTiming) =>
          observations.find((o) => o.kind === kind && o.sessionId === t.session && 'callTurnIndex' in o && o.callTurnIndex === t.idx && 'half' in o && o.half === 'USER'
            && (o.kind !== 'PERMIT' || o.granted));
        // Named for what it measures: the commit to the USER half's permit GRANTED (the provider work starts after it;
        // commitToFirstProviderCallMs below is the first provider call itself).
        const permitGranted = timings.map((t) => { const o = userHalf('PERMIT', t); return o ? at(o) - t.commitAt : Number.NaN; }).filter(Number.isFinite);
        const stages = userHalfStages(timings, observations, tracer.spans);
        const userDone = timings.map((t) => { const o = userHalf('ESTABLISHED', t); return o ? at(o) - t.commitAt : Number.NaN; }).filter(Number.isFinite);
        const lfUpdate = timings.map((t) => {
          const o = userHalf('ESTABLISHED', t) as Extract<CallAnalysisObservation, { kind: 'ESTABLISHED' }> | undefined;
          return o && o.liveFocusTransitions > 0 ? at(o) - t.commitAt : Number.NaN;
        }).filter(Number.isFinite);
        const assistantDone = timings.map((t) => {
          const o = observations.find((e) => e.kind === 'ESTABLISHED' && e.sessionId === t.session && e.callTurnIndex === t.idx && e.half === 'ASSISTANT');
          return o ? at(o) - t.closeAt : Number.NaN;
        }).filter(Number.isFinite);
        // First stable LF of each call: its first commit to its first LF transition established.
        const firstLf = calls.map((x) => {
          const first = timings.filter((t) => t.session === x.session).sort((a, b) => a.idx - b.idx)[0]!;
          const o = observations.filter((e) => e.kind === 'ESTABLISHED' && e.sessionId === x.session && e.liveFocusTransitions > 0 && e.half !== 'EXCHANGE')
            .sort((a, b) => a.at - b.at)[0];
          return o ? o.at - first.commitAt : Number.NaN;
        }).filter(Number.isFinite);
        const longSession = calls[0]!.session;
        const longLag = timings.filter((t) => t.session === longSession).sort((a, b) => a.idx - b.idx).map((t) => {
          const o = userHalf('ESTABLISHED', t);
          return o ? Math.round(at(o) - t.commitAt) : null;
        });
        const analysisCalls = prov.counts.SEGMENTATION + prov.counts.FOCUS + prov.counts.THREAD + prov.counts.CONTINUITY;
        const halves = observations.filter((o) => o.kind === 'ESTABLISHED');
        Object.assign(result, {
          commitToClaimMs: summary(stages.map((s) => s.commitToClaim)),
          commitToPermitGrantedMs: summary(permitGranted),
          commitToFirstProviderCallMs: summary(stages.map((s) => s.commitToFirstProviderCall).filter(Number.isFinite)),
          commitToUserHalfCommittedMs: summary(userDone),
          userHalfStagesMs: stageSummary(stages),
          userHalfStagesTurn1Ms: stageSummary(stages.filter((s) => s.idx === 1)),
          userHalfStagesLaterTurnsMs: stageSummary(stages.filter((s) => s.idx > 1)),
          commitToLiveFocusUpdateMs: summary(lfUpdate),
          closeToReplyHalfCommittedMs: summary(assistantDone),
          firstStableLiveFocusMs: summary(firstLf),
          longCallUserHalfLagMs: longLag,
          queueDepth: summary(depth),
          backlogAgeMs: summary(age),
          drainAfterLastCallMs: drainMs === null ? null : Math.round(drainMs),
          analysisProviderCalls: { ...prov.counts, REPLY: undefined, total: analysisCalls },
          analysisCallsPerExchange: Number((analysisCalls / timings.length).toFixed(2)),
          analysisCallsPerMinute: Number((analysisCalls / ((callsWallMs + (drainMs ?? 0)) / 60_000)).toFixed(1)),
          establishedItems: halves.length,
        });

        // The analysis order, per session: pre-call exchange first, then (1, USER), (1, ASSISTANT), (2, USER), ... with no gap.
        for (const [i, x] of calls.entries()) {
          const seen = observations.filter((o) => o.kind === 'ESTABLISHED' && o.sessionId === x.session).map((o) => `${(o as { callTurnIndex: number }).callTurnIndex}:${(o as { half: string }).half}`);
          const turns = i === 0 ? WORKLOAD.longTurns : WORKLOAD.shortTurns;
          const expected = [`${PRE_CALL}:EXCHANGE`, ...Array.from({ length: turns }, (_v, k) => [`${k + 1}:USER`, `${k + 1}:ASSISTANT`]).flat()];
          check(`${mode.key} session ${i}: established in the analysis order (pre-call first, FIFO by call_turn_index)`, JSON.stringify(seen) === JSON.stringify(expected),
            `${seen.length}/${expected.length}`);
        }
        // One active worker per session across the two instances: claim -> settle intervals never overlap within a session.
        const intervals = new Map<string, Array<[number, number, string]>>();
        const open = new Map<string, { at: number; instance: string }>();
        for (const o of observations) {
          const instance = (o as unknown as { instance: string }).instance;
          if (o.kind === 'CLAIMED') open.set(`${o.sessionId}:${instance}`, { at: o.at, instance });
          if (o.kind === 'SETTLED') {
            const c = open.get(`${o.sessionId}:${instance}`);
            if (c) intervals.set(o.sessionId, [...(intervals.get(o.sessionId) ?? []), [c.at, o.at, instance]]);
          }
        }
        let overlaps = 0;
        for (const list of intervals.values()) {
          list.sort((a, b) => a[0] - b[0]);
          for (let k = 1; k < list.length; k += 1) if (list[k]![0] < list[k - 1]![1]) overlaps += 1;
        }
        const instances = new Set(observations.filter((o) => o.kind === 'CLAIMED').map((o) => (o as unknown as { instance: string }).instance));
        check(`${mode.key}: one active worker per session across instances (both instances worked: ${[...instances].sort().join('+')})`, overlaps === 0 && instances.size === 2, `${overlaps} overlaps`);
        const duplicates = Number((await sql(`SELECT count(*)::int AS n FROM (SELECT source_turn_id FROM public.conversation_unit_commit_batches
          WHERE session_id = ANY($1::uuid[]) GROUP BY source_turn_id HAVING count(*) > 1) d`, [sessions]))[0]!.n);
        check(`${mode.key}: no duplicate commitment batch`, duplicates === 0);
        const adopted = preCall.length;
        const preCallDone = Number((await sql(`SELECT count(*)::int AS n FROM voice_private.call_analysis_queue WHERE session_id = ANY($1::uuid[])
          AND half = 'EXCHANGE' AND queue_state = 'COMPLETE'`, [sessions]))[0]!.n);
        check(`${mode.key}: every pre-call exchange adopted and established first (O3b)`, preCallDone === adopted, `${preCallDone}/${adopted}`);
      } else {
        // M0 leaves its backlog: drained now by a worker (not measured), so the next mode starts clean - catch-up after the fact.
        const catchUp = makeWorker(providers(new SharedCapacity(WORKLOAD.providerSlots), 99), 'AT_COMMIT', [], 'catch-up');
        catchUp.start();
        result.backlogCatchUpMs = Math.round(await drained(sessions));
        await catchUp.stop();
      }
      (report.modes as Record<string, unknown>)[mode.key] = result;
      process.stdout.write(`  ${mode.key}: ${JSON.stringify(result)}\n`);
    }

    await setPermitPolicy(null);
    // Voice protection (contract: <= +50 ms P50 and <= +100 ms P95 against analysis off), reported for every mode. The
    // contract's rule when it is exceeded is to report the number, never to claim "no impact" (§4.3).
    const p = (key: string, q: number) => percentile(firstAudio[key]!, q)!;
    const within = (i: { p50: number; p95: number }) => i.p50 <= 50 && i.p95 <= 100;
    const impact: Record<string, { p50: number; p95: number; withinVoiceProtection: boolean }> = {};
    for (const mode of modes.filter((m) => m.start)) {
      const i = { p50: p(mode.key, 50) - p('M0', 50), p95: p(mode.key, 95) - p('M0', 95) };
      impact[mode.key] = { ...i, withinVoiceProtection: within(i) };
    }
    report.firstAudioImpactMs = impact;
    process.stdout.write(`  First Audio impact vs M0: ${JSON.stringify(impact)}\n`);
    // The gate this proof enforces: the default mode (M1, L2) under the CONSERVATIVE setting proposed before calibration.
    // CALIBRATED (B_total = every one of the fake's slots) and SHIPPED (16) are measured and reported, not enforced: at the
    // stress pace they exceed the P95 limit in some runs (the record keeps every number), because a permit granted while
    // no reply is generating keeps its provider work running when replies start, and they leave the replies no headroom.
    if (impact.M1_CONSERVATIVE) {
      check('M1 (the default, L2) under the conservative permit setting keeps First Audio within +50 ms P50 / +100 ms P95 of analysis off',
        impact.M1_CONSERVATIVE.withinVoiceProtection, JSON.stringify(impact.M1_CONSERVATIVE));
    }
    for (const [key, value] of Object.entries(impact).filter(([, v]) => !v.withinVoiceProtection)) {
      process.stdout.write(`  REPORTED  ${key} exceeds the voice protection limit: P50 +${value.p50} ms, P95 +${value.p95} ms (measured, not enforced)\n`);
    }

    // ------------------------------------------------------------------------------------- DEC-R1-1: the first USER half
    // O3b as amended by DEC-R1-1: the activation adopts the session's unestablished pre-call exchanges, so their analysis runs
    // while the person has not spoken yet. Measured, per cell of 7 concurrent calls: the first turn's commit -> its USER half
    // committed, and the first turn's First Audio, for 0, 1 and 2 pending pre-call exchanges and a gap from the activation to
    // the first commit of 0.5, 1.5, 3 and 6 s, in M1 (the default) and M1′, under the shipped permit policy. Each cell's
    // providers use the same seeds before and after, and its order is checked: every pre-call exchange first, then 1:USER.
    if (O3B_ONLY || process.env.S8B05_CP3_O3B === '1') {
      // The permit profile of the matrix (S8B05_CP3_O3B_PROFILE; the shipped policy by default).
      const o3bProfile = (process.env.S8B05_CP3_O3B_PROFILE ?? 'SHIPPED') as Profile;
      assert.ok(o3bProfile in PERMIT_PROFILES, `unknown profile ${o3bProfile}`);
      await setPermitPolicy(o3bProfile);
      const o3b: Record<string, Record<string, unknown>> = {};
      const gaps = [500, 1500, 3000, 6000];
      const O3B_CALLS = Number(process.env.S8B05_CP3_O3B_CALLS ?? WORKLOAD.shortCalls + 1);
      const O3B_REPS = Number(process.env.S8B05_CP3_O3B_REPS ?? 1);
      report.o3bCallsPerCell = O3B_CALLS;
      report.o3bRepetitions = O3B_REPS;
      for (const start of ['AFTER_FIRST_AUDIO', 'AT_COMMIT'] as const) {
        const key = start === 'AT_COMMIT' ? 'M1_PRIME' : 'M1';
        o3b[key] = {};
        for (const pending of [0, 1, 2]) {
          for (const [g, gap] of gaps.entries()) {
            // A cell: O3B_CALLS concurrent calls (7: the shared provider's contention; 1: the person's own voice path alone),
            // repeated O3B_REPS times on fresh people, every sample kept.
            const firstHalf: number[] = [];
            const firstAudioMs: number[] = [];
            const counts = { SEGMENTATION: 0, FOCUS: 0, THREAD: 0, CONTINUITY: 0, items: 0 };
            let ordered = true;
            for (let rep = 0; rep < O3B_REPS; rep += 1) {
              const prov = providers(new SharedCapacity(WORKLOAD.providerSlots), 3000 + pending * 10 + g + rep * 100);
              const signal = new LiveCallAnalysisSignal();
              const observations: CallAnalysisObservation[] = [];
              tracer.spans = [];
              const workers = [makeWorker(prov, start, observations, 'A'), makeWorker(prov, start, observations, 'B')];
              const route = new Map<string, number>();
              signal.bind({ kick: (sessionId, reason) => workers[(route.get(sessionId) ?? 0) % workers.length]!.kick(sessionId, reason) });
              for (const w of workers) w.start();
              const people = await Promise.all(Array.from({ length: O3B_CALLS }, () => person()));
              for (const [i, p] of people.entries()) {
                route.set(p.session, i);
                for (let k = 0; k < pending; k += 1) await textExchange(p.user, p.session, userWords(200 + i * 3 + k), 'تمام، وبعدين؟');
              }
              const sessions = people.map((p) => p.session);
              const timings: TurnTiming[] = [];
              const calls = await Promise.all(people.map((p) => begin(p)));
              for (const x of calls) signal.kick(x.session, 'CALL_ACTIVATED');
              await Promise.all(calls.map((x, i) => runCall(x, 1, 300 + i, prov, signal, timings, { firstSpeakMs: gap })));
              await drained(sessions);
              for (const w of workers) await w.stop();
              signal.bind(null);
              for (const tm of timings) {
                const o = observations.find((e) => e.kind === 'ESTABLISHED' && e.sessionId === tm.session && e.callTurnIndex === 1 && e.half === 'USER');
                if (o) firstHalf.push(o.at - tm.commitAt);
                firstAudioMs.push(tm.firstAudioAt - tm.commitAt);
              }
              ordered &&= calls.every((x) => {
                const seen = observations.filter((o) => o.kind === 'ESTABLISHED' && o.sessionId === x.session).map((o) => { const e = o as { callTurnIndex: number; half: string }; return e.half === 'EXCHANGE' ? 'EXCHANGE' : `${e.callTurnIndex}:${e.half}`; });
                return JSON.stringify(seen) === JSON.stringify([...Array.from({ length: pending }, () => 'EXCHANGE'), '1:USER', '1:ASSISTANT']);
              });
              for (const kind of ['SEGMENTATION', 'FOCUS', 'THREAD', 'CONTINUITY'] as const) counts[kind] += prov.counts[kind];
              counts.items += calls.length * (pending + 2);
            }
            const analysisCalls = counts.SEGMENTATION + counts.FOCUS + counts.THREAD + counts.CONTINUITY;
            check(`DEC-R1-1 ${key}, ${pending} pending, gap ${gap} ms: every pre-call exchange first, then 1:USER, 1:ASSISTANT, each once`,
              ordered && firstHalf.length === O3B_CALLS * O3B_REPS);
            o3b[key]![`pending${pending}_gap${gap}`] = {
              firstUserHalfMs: summary(firstHalf),
              firstAudioMs: summary(firstAudioMs),
              analysisCalls: { ...counts, total: analysisCalls },
            };
            process.stdout.write(`  DEC-R1-1 ${key} pending ${pending} gap ${gap}: ${JSON.stringify(o3b[key]![`pending${pending}_gap${gap}`])}\n`);
          }
        }
      }
      report.o3bFirstUserHalf = o3b;
      report.o3bProfile = o3bProfile;
    }

    // ------------------------------------------------------------------------------------- reliability scenarios
    if (!O3B_ONLY) {
      // R1 crashes, on real PostgreSQL. (a) An EXCHANGE item (a pre-call exchange) is committed by the full coordinator and
      // the process dies before the worker's COMPLETE settlement: the leases lapse, another instance claims it again, and it
      // is replayed from storage with ZERO provider calls. (b) A half is committed and the process dies before the session
      // lease is returned: the half's item was settled COMPLETE by its own commit, in the same transaction, so no instance
      // ever establishes it again; the next instance goes on with the next item.
      const prov = providers(new SharedCapacity(WORKLOAD.providerSlots), 7);
      const total = () => prov.counts.SEGMENTATION + prov.counts.FOCUS + prov.counts.THREAD + prov.counts.CONTINUITY;
      const p1 = await person();
      await textExchange(p1.user, p1.session, userWords(500), 'تمام، وبعدين؟');
      const x = await begin(p1);
      await runCall(x, 1, 500, prov, new LiveCallAnalysisSignal(), []);
      const lapse = async () => {
        await sql("UPDATE voice_private.call_analysis_queue SET lease_until = clock_timestamp() - interval '1 second' WHERE session_id = $1 AND queue_state = 'CLAIMED'", [x.session]);
        await sql("UPDATE voice_private.session_semantic_leases SET lease_until = clock_timestamp() - interval '1 second' WHERE session_id = $1", [x.session]);
      };
      const run = async (instance: string, dies: (half: string) => boolean) => {
        const observations: CallAnalysisObservation[] = [];
        const callsAt: Array<{ kind: string; item: string; calls: number }> = [];
        const w = makeWorker(prov, 'AT_COMMIT', observations, instance, (o) => {
          if (o.kind === 'CLAIMED' || o.kind === 'ESTABLISHED') callsAt.push({ kind: o.kind, item: `${o.callTurnIndex}:${o.half}`, calls: total() });
        });
        const store = (w as unknown as { deps: { store: CallAnalysisRepository } }).deps.store;
        const settle = store.settle.bind(store);
        store.settle = async (input) => { if (dies(input.half)) throw new Error('the process died before the settlement'); return settle(input); };
        (w as unknown as { stopped: boolean }).stopped = false;
        await w.drain(x.session);
        const established = observations.filter((o) => o.kind === 'ESTABLISHED').map((o) => `${(o as { callTurnIndex: number }).callTurnIndex}:${(o as { half: string }).half}`);
        const spent = (item: string) => {
          const claimed = callsAt.find((c) => c.kind === 'CLAIMED' && c.item === item);
          const done = callsAt.find((c) => c.kind === 'ESTABLISHED' && c.item === item);
          return claimed && done ? done.calls - claimed.calls : null;
        };
        return { established, spent };
      };
      const state = async (half: string, index: number) => String((await sql('SELECT queue_state FROM voice_private.call_analysis_queue WHERE session_id = $1 AND half = $2 AND call_turn_index = $3',
        [x.session, half, index]))[0]?.queue_state);

      const crashed = await run('crashing', () => true);
      check('R1a: the crashed instance committed the pre-call EXCHANGE and died before settling it (still CLAIMED)',
        crashed.established.join(',') === `${PRE_CALL}:EXCHANGE` && (crashed.spent(`${PRE_CALL}:EXCHANGE`) ?? 0) > 0 && await state('EXCHANGE', PRE_CALL) === 'CLAIMED');
      await lapse();
      const second = await run('survivor-1', (half) => half !== 'EXCHANGE');
      check('R1a: another instance re-claimed it after the lease lapsed and replayed it from storage with ZERO provider calls',
        second.established[0] === `${PRE_CALL}:EXCHANGE` && second.spent(`${PRE_CALL}:EXCHANGE`) === 0 && await state('EXCHANGE', PRE_CALL) === 'COMPLETE',
        `spent ${String(second.spent(`${PRE_CALL}:EXCHANGE`))}`);
      check('R1b: that instance committed the USER half and died before returning the lease: the item is COMPLETE by its own commit',
        second.established.join(',') === `${PRE_CALL}:EXCHANGE,1:USER` && await state('USER', 1) === 'COMPLETE');
      await lapse();
      const third = await run('survivor-2', () => false);
      check('R1b: the next instance never establishes the committed half again; it goes on with the reply\'s half', third.established.join(',') === '1:ASSISTANT', third.established.join(','));
      const duplicates = Number((await sql(`SELECT count(*)::int AS n FROM (SELECT source_turn_id FROM public.conversation_unit_commit_batches
        WHERE session_id = $1 GROUP BY source_turn_id HAVING count(*) > 1) d`, [x.session]))[0]!.n);
      check('R1: the order completed after both crashes with one batch per turn', await openItems([x.session]) === 0 && duplicates === 0);
    }
    if (!O3B_ONLY) {
      // R2 a provider outage / 429: retried with backoff (RETRY_WAIT), never skipped; the next turn waits for it.
      const prov = providers(new SharedCapacity(WORKLOAD.providerSlots), 8);
      const observations: CallAnalysisObservation[] = [];
      const p2 = await person();
      const x = await begin(p2);
      const signal = new LiveCallAnalysisSignal();
      const w = makeWorker(prov, 'AT_COMMIT', observations, 'R2');
      signal.bind(w);
      w.start();
      prov.failNextSegmentations = 1;
      const timings: TurnTiming[] = [];
      await runCall(x, 2, 600, prov, signal, timings);
      await drained([x.session], 60_000);
      await w.stop();
      const settled = observations.filter((o) => o.kind === 'SETTLED');
      const failure = settled.find((o) => o.kind === 'SETTLED' && o.outcome === 'PROVIDER_FAILURE');
      check('R2: a provider outage is a counted retry with backoff (RETRY_WAIT), never a skip', failure?.kind === 'SETTLED' && failure.queueState === 'RETRY_WAIT');
      const order = observations.filter((o) => o.kind === 'ESTABLISHED').map((o) => `${(o as { callTurnIndex: number }).callTurnIndex}:${(o as { half: string }).half}`);
      check('R2: after the retry the order is intact: 1 USER, 1 ASSISTANT, 2 USER, 2 ASSISTANT', JSON.stringify(order) === JSON.stringify(['1:USER', '1:ASSISTANT', '2:USER', '2:ASSISTANT']), order.join(','));
    }
    if (!O3B_ONLY) {
      // R3 S3 after the end: a turn committed with its Safety never stored; the call ends; the exchange stays OPEN; the sweep
      // recomputes Safety with the same gate over the same reader, stores it once, closes it once, and its halves are analyzed.
      const prov = providers(new SharedCapacity(WORKLOAD.providerSlots), 9);
      const observations: CallAnalysisObservation[] = [];
      const p3 = await person();
      const x = await begin(p3);
      const timings: TurnTiming[] = [];
      const silent = new LiveCallAnalysisSignal();
      await runCall(x, 2, 700, prov, silent, timings, { leaveLastSafetyUnstored: true });
      assert.equal((await one('server_end_call_v1', { p_user_id: x.user, p_call_id: x.call, p_connection_epoch: 1, p_end_reason: 'USER_ENDED' })).outcome, 'ENDED');
      const openAfterEnd = await sql("SELECT exchange_state, safety_disposition FROM voice_private.call_exchanges WHERE call_id = $1 AND call_turn_index = 2", [x.call]);
      check('R3: after the END the exchange with no stored Safety is still OPEN (never closed without Safety)', openAfterEnd[0]!.exchange_state === 'OPEN' && openAfterEnd[0]!.safety_disposition === null);
      const w = makeWorker(prov, 'AT_COMMIT', observations, 'R3');
      (w as unknown as { stopped: boolean }).stopped = false;
      await w.sweep();
      await w.sweep();
      const after = await sql("SELECT exchange_state, safety_disposition, close_reason FROM voice_private.call_exchanges WHERE call_id = $1 AND call_turn_index = 2", [x.call]);
      const events = Number((await sql(`SELECT count(*)::int AS n FROM public.runtime_event_outbox o JOIN voice_private.call_exchanges e ON e.user_turn_id = o.subject_turn_id
        WHERE e.call_id = $1 AND e.call_turn_index = 2 AND o.event_type = 'ConversationTurnCompleted'`, [x.call]))[0]!.n);
      check('R3: S3 stored the gate\'s disposition once and closed the exchange once (CALL_ENDING, one completion event)',
        after[0]!.exchange_state === 'CLOSED' && after[0]!.safety_disposition === 'ALLOW' && after[0]!.close_reason === 'CALL_ENDING' && events === 1
          && observations.filter((o) => o.kind === 'S3').length === 1, `${String(after[0]!.close_reason)}, events ${events}`);
      // The sweep kicked the session; the worker, started, drains it (and scans) until the order is empty.
      await w.stop();
      w.start();
      const settledAfterEnd = await drained([x.session], 60_000).then(() => true, () => false);
      await w.stop();
      const order = observations.filter((o) => o.kind === 'ESTABLISHED').map((o) => `${(o as { callTurnIndex: number }).callTurnIndex}:${(o as { half: string }).half}`);
      const states = (await sql('SELECT call_turn_index, half, queue_state FROM voice_private.call_analysis_queue WHERE session_id = $1 ORDER BY call_turn_index, half DESC', [x.session]))
        .map((r) => `${String(r.call_turn_index)}:${String(r.half)}=${String(r.queue_state)}`).join(',');
      check('R3: the swept exchange\'s halves are analyzed in order after the end', settledAfterEnd
        && JSON.stringify(order) === JSON.stringify(['1:USER', '1:ASSISTANT', '2:USER', '2:ASSISTANT']), `${order.join(',')} | ${states}`);
    }
    if (!O3B_ONLY) {
      // R4 Safety recovery across a REAL restart: the call ends with its last exchange's Safety never stored. Process A (a
      // separate OS process) runs a worker whose every context read fails: S3 leaves the exchange OPEN, scan after scan,
      // with no default disposition, while the facts that may be committed (1 USER, 1 ASSISTANT, 2 USER) are; then A dies
      // abruptly. Process B (another OS process) runs a fresh worker with the reads restored: the same gate over the same
      // reader stores the disposition once, the exchange closes once, one completion event and one reply half follow, and
      // the order completes with no duplicate commit.
      const prov = providers(new SharedCapacity(WORKLOAD.providerSlots), 10);
      const p4 = await person();
      const x = await begin(p4);
      await runCall(x, 2, 800, prov, new LiveCallAnalysisSignal(), [], { leaveLastSafetyUnstored: true });
      assert.equal((await one('server_end_call_v1', { p_user_id: x.user, p_call_id: x.call, p_connection_epoch: 1, p_end_reason: 'USER_ENDED' })).outcome, 'ENDED');
      const runChild = (mode: ChildSpec['mode']) => {
        const spec: ChildSpec = { session: x.session, call: x.call, mode };
        const r = spawnSync(process.execPath, [require.resolve('ts-node/dist/bin.js'), '--transpile-only', '--project', join(__dirname, '..', 'tsconfig.scripts.json'), __filename], {
          env: { ...process.env, S8B05_CP3_CHILD: JSON.stringify(spec), S8B05_CP3_REPORT: '' }, encoding: 'utf8', timeout: 180_000,
        });
        const line = String(r.stdout ?? '').split('\n').find((l) => l.startsWith(CHILD_RESULT));
        if (!line) throw new Error(`S8B05_CP3_PROOF_CHILD ${mode} gave no result (status ${String(r.status)}): ${String(r.stderr ?? '').slice(-1500)}`);
        return JSON.parse(line.slice(CHILD_RESULT.length)) as { pid: number; finished: boolean; established: string[]; contextReads: number; s3: { closed: number; leftOpen: number } };
      };
      const exchange = async () => (await sql(`SELECT exchange_state, safety_disposition, close_reason, user_turn_id FROM voice_private.call_exchanges
        WHERE call_id = $1 AND call_turn_index = 2`, [x.call]))[0]!;
      const completions = async () => Number((await sql(`SELECT count(*)::int AS n FROM public.runtime_event_outbox o JOIN voice_private.call_exchanges e ON e.user_turn_id = o.subject_turn_id
        WHERE e.call_id = $1 AND e.call_turn_index = 2 AND o.event_type = 'ConversationTurnCompleted'`, [x.call]))[0]!.n);
      const replyHalves = async () => (await sql("SELECT queue_state FROM voice_private.call_analysis_queue WHERE call_id = $1 AND call_turn_index = 2 AND half = 'ASSISTANT'", [x.call]))
        .map((r) => String(r.queue_state));

      const a = runChild('FAILING');
      const afterA = await exchange();
      check('R4: process A, every context read failing, left the exchange OPEN scan after scan with no disposition (never a default ALLOW / BLOCK)',
        a.finished && a.s3.leftOpen >= 2 && a.s3.closed === 0 && a.contextReads >= 2 && afterA.exchange_state === 'OPEN' && afterA.safety_disposition === null,
        `pid ${a.pid}, ${a.s3.leftOpen} scans left it OPEN, ${a.contextReads} failed reads`);
      check('R4: while it was OPEN nothing depending on it was written: no completion event, no reply half; the facts before it were committed in order',
        await completions() === 0 && (await replyHalves()).length === 0 && JSON.stringify(a.established) === JSON.stringify(['1:USER', '1:ASSISTANT', '2:USER']),
        a.established.join(','));

      // The disposition the gate gives this turn over this reader, computed apart (S3 must store exactly this, once).
      const content = String((await sql('SELECT content FROM public.conversation_turns WHERE id = $1', [afterA.user_turn_id]))[0]!.content);
      const reader = new CallAnalysisRepository(serviceApi);
      let expected: string | null = null;
      await endedCallSafety().settleEndedCallSafety({
        content,
        readContext: () => reader.readCallContext(x.user, x.session, x.call, CALL_CONTEXT_POLICY.readLimit),
        storeSafety: async (disposition) => { expected = disposition; },
      });

      const b = runChild('HEALTHY');
      const afterB = await exchange();
      check('R4: process B (a new process, reads restored) stored the gate\'s disposition for the same context once and closed the exchange once',
        b.finished && b.pid !== a.pid && b.pid !== process.pid && b.s3.closed === 1 && afterB.exchange_state === 'CLOSED' && afterB.close_reason === 'CALL_ENDING'
          && expected !== null && afterB.safety_disposition === expected, `pid ${b.pid}, ${String(afterB.safety_disposition)} = gate ${String(expected)}`);
      const duplicates = Number((await sql(`SELECT count(*)::int AS n FROM (SELECT source_turn_id FROM public.conversation_unit_commit_batches
        WHERE session_id = $1 GROUP BY source_turn_id HAVING count(*) > 1) d`, [x.session]))[0]!.n);
      check('R4: one completion event, one reply half (COMPLETE), the order finished in order across both processes, no duplicate commit',
        await completions() === 1 && JSON.stringify(await replyHalves()) === JSON.stringify(['COMPLETE']) && JSON.stringify(b.established) === JSON.stringify(['2:ASSISTANT'])
          && await openItems([x.session]) === 0 && duplicates === 0, `A ${a.established.join(',')} | B ${b.established.join(',')}`);
    }

    const enabledAfter =Number((await sql("SELECT count(*) AS n FROM voice_private.voice_launch_capability_states WHERE feature_flag_state = 'ENABLED'"))[0]!.n);
    report.checks = checks;
    report.rpcCalls = shim.calls;
    report.gatesEnabledBeforeProof = gatesEnabledBefore;
    report.gatesEnabledDuringProof = enabledAfter;
  } finally {
    const mediaKeys = await fixtureMediaKeys(pool, humans);
    await teardown(pool, humans, gatesBefore, policyBefore, permitPolicyBefore);
    const enabledFinal = Number((await sql("SELECT count(*) AS n FROM voice_private.voice_launch_capability_states WHERE feature_flag_state = 'ENABLED'"))[0]!.n);
    report.gatesEnabledAfterTeardown = enabledFinal;
    report.fixtureRowsLeftAfterTeardown = await fixtureRowsLeft(pool, humans, mediaKeys);
    await pool.end();
  }
  assert.equal(report.gatesEnabledAfterTeardown, report.gatesEnabledBeforeProof, 'every gate is restored');
  const left = report.fixtureRowsLeftAfterTeardown as Record<string, number>;
  assert.ok(Object.values(left).every((n) => n === 0), `the teardown left fixture rows behind: ${JSON.stringify(left)}`);
  process.stdout.write(`  PASS  teardown: no fixture row left, the runtime outbox included (${JSON.stringify(left)})\n`);
  if (process.env.S8B05_CP3_REPORT) writeFileSync(process.env.S8B05_CP3_REPORT, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`S8B-05 CP3 synthetic proof: ${(report.checks as string[]).length} checks passed; no provider, no paid API, no real person, no audio.\n`);
}

/** The storage keys of the fixtures' recording objects, read before the teardown removes the objects. */
async function fixtureMediaKeys(pool: PgPool, humans: string[]): Promise<string[]> {
  return (await pool.query(`SELECT o.storage_key FROM voice_private.recording_objects o JOIN voice_private.recordings r ON r.id = o.recording_id
    WHERE r.user_id = ANY($1::uuid[])`, [humans])).rows.map((row) => String(row.storage_key));
}

/** What the teardown left of the fixture humans: every count must be zero (a later suite shares this database). */
async function fixtureRowsLeft(pool: PgPool, humans: string[], mediaKeys: readonly string[]): Promise<Record<string, number>> {
  const [row] = (await pool.query(`SELECT (SELECT count(*) FROM voice_private.calls WHERE user_id = ANY($1::uuid[]))::int AS calls,
      (SELECT count(*) FROM voice_private.call_exchanges WHERE user_id = ANY($1::uuid[]))::int AS exchanges,
      (SELECT count(*) FROM voice_private.call_analysis_queue WHERE user_id = ANY($1::uuid[]))::int AS queue_items,
      (SELECT count(*) FROM voice_private.recordings WHERE user_id = ANY($1::uuid[]))::int AS recordings,
      (SELECT count(*) FROM public.conversation_unit_commit_batches WHERE user_id = ANY($1::uuid[]))::int AS commit_batches,
      (SELECT count(*) FROM public.runtime_event_outbox WHERE subject_user_id = ANY($1::uuid[]))::int AS outbox_events,
      (SELECT count(*) FROM introduction_sharing_private.media_erasure_queue WHERE storage_key = ANY($2::text[]))::int AS erasure_queue_keys,
      (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))::int AS users`, [humans, mediaKeys])).rows;
  return row as Record<string, number>;
}

/** Leaves the database as it was (the CP2 proof's teardown, plus the permit policy). */
async function teardown(pool: PgPool, humans: string[], gates: Array<Record<string, unknown>>, policy: Record<string, unknown>, permits: Record<string, unknown>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL session_replication_role = 'replica'");
    const recordings = 'SELECT id FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])';
    await client.query(`DELETE FROM voice_private.recording_gaps WHERE recording_id IN (${recordings})`, [humans]);
    // A call's end seals its recording, which queues every never-uploaded segment's key for erasure (0183
    // seal_call_recording_v1). The queue keys on storage_key, so the user_id sweep below never reaches it: left behind, the
    // keys come due minutes later and fill the media erasure worker's oldest-first claim of 25 (it starved the S6-06 media
    // proof's P04 in API CI). The fixtures' keys leave with their objects.
    await client.query(`DELETE FROM introduction_sharing_private.media_erasure_queue WHERE storage_key IN
      (SELECT o.storage_key FROM voice_private.recording_objects o WHERE o.recording_id IN (${recordings}))`, [humans]);
    await client.query(`DELETE FROM voice_private.recording_objects WHERE recording_id IN (${recordings})`, [humans]);
    // The outbox names its subject `subject_user_id`, so the `user_id` sweep below never reaches it: a fixture event left
    // PENDING is older than any later event and fills the publisher's oldest-first batch (it broke the A2 smoke in CI).
    await client.query('DELETE FROM public.runtime_event_outbox WHERE subject_user_id = ANY($1::uuid[])', [humans]);
    const owned = await client.query(`SELECT table_schema, table_name FROM information_schema.columns
      WHERE column_name = 'user_id' AND table_schema IN ('voice_private', 'public', 'private') AND table_name NOT IN ('users')
        AND table_name IN (SELECT table_name FROM information_schema.tables t WHERE t.table_schema = columns.table_schema AND t.table_type = 'BASE TABLE')`);
    for (const row of owned.rows) {
      await client.query(`DELETE FROM "${String(row.table_schema)}"."${String(row.table_name)}" WHERE user_id = ANY($1::uuid[])`, [humans]);
    }
    await client.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [humans]);
    for (const gate of gates) {
      await client.query(`UPDATE voice_private.voice_launch_capability_states SET feature_flag_state = $2, launch_requirements_state = $3,
          restriction_version = $4, decided_by = $5, policy_basis = $6, decided_at = $7 WHERE capability_scope = $1`,
      [gate.capability_scope, gate.feature_flag_state, gate.launch_requirements_state, gate.restriction_version, gate.decided_by, gate.policy_basis, gate.decided_at]);
      await client.query('DELETE FROM voice_private.voice_launch_capability_events WHERE capability_scope = $1 AND restriction_version > $2',
        [gate.capability_scope, gate.restriction_version]);
    }
    await client.query(`UPDATE voice_private.live_call_policy SET realtime_session_capacity = $1, reconnect_grace_seconds = $2, connect_timeout_seconds = $3,
        seat_lease_seconds = $4, max_call_seconds = $5, policy_version = $6, decided_by = $7, policy_basis = $8, decided_at = $9`,
    [policy.realtime_session_capacity, policy.reconnect_grace_seconds, policy.connect_timeout_seconds, policy.seat_lease_seconds,
      policy.max_call_seconds, policy.policy_version, policy.decided_by, policy.policy_basis, policy.decided_at]);
    const columns = Object.keys(permits).filter((key) => key !== 'singleton');
    if (columns.length > 0) {
      await client.query(`UPDATE voice_private.background_permit_policy SET ${columns.map((key, i) => `"${key}" = $${i + 1}`).join(', ')}`, columns.map((key) => permits[key]));
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`S8B-05 CP3 synthetic proof FAILED: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
