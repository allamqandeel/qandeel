/**
 * INTEL-04 — the integrated proof of the Thread lifecycle derivation correction (QAN-BL-INTEL-04, migration 0194).
 *
 * The REAL semantic establishment service (segmentation -> B1 -> Thread layer -> Live Focus, canonicalized, committed
 * through the production writers: 0071's full-chain coordinator for writing, 0191's half coordinator for a call), the
 * REAL Durable Ordered Analysis Worker, call analysis queue and background permits, and the REAL read controllers the
 * phone calls (temporal snapshot, Live Focus events, the historical projection), over a REAL local PostgreSQL.
 *
 * Stand-ins, and only these: the PostgREST hops (pg shims calling the same definers as service_role / as the owner,
 * with PostgREST's error identity) and the four layer providers, which are FAKES - no provider, no paid API, no model,
 * no real person, no voice: the humans are random UUIDs, the words are fixed synthetic Arabic sentences.
 *
 *   W  WRITTEN (T1, T2, T3, T5): exchange 1 "السفر ... . الشغل ... ." - its first CU establishes a Thread, its second
 *      starts another focus (ONE departure); exchange 2 has two further departures (the second one is SUSTAINED).
 *   C  CALL (T3, T5): turn 1 establishes the Thread; QANDEEL's reply is cut by turn 2 before a word is heard (its
 *      ASSISTANT half has no unit); turn 2 starts another focus; turn 3 two further departures; the worker establishes
 *      every half in order.
 *   P  PARKED RETRY (T5, INTEL04_PHASE=PARK then INTEL04_PHASE=RESUME, the database migrated forward in between): the
 *      call's turn-2 USER half refused and PARKED with the defect; after 0194 the SAME item is retried by its own parked
 *      rule (it is never reset, re-queued or reprocessed by anything else) and the order resumes behind it.
 *
 * Expected without 0194 (INTEL04_EXPECT=DEFECT): W's first commit and C's turn-2 USER half are refused with
 * THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL; W's exchange 1 is lost (the next exchange takes its positions) and C stops
 * behind the PARKED item. With 0194 (INTEL04_EXPECT=FIXED, the
 * default): every half commits once, in order, and the map's reads reach the last Session Position.
 *
 * It refuses anything but a loopback database and changes the database it is given (gates, policies, fixtures it
 * removes again): run it only on a disposable local clone, never on a shared or hosted database.
 *
 *   DATABASE_URL=postgres://postgres@127.0.0.1:55450/i04_proof \
 *     node node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/intel-04-thread-lifecycle-proof.ts
 */
import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { ConversationHistoricalProjectionController } from '../src/conversation/conversation-historical-projection.controller';
import { ConversationTemporalController } from '../src/conversation/conversation-temporal.controller';
import type { ConversationTurn } from '../src/conversation/conversation.types';
import { LiveCallReplyService } from '../src/conversation/live-call-reply.service';
import { SafetyResponseGateService } from '../src/conversation/safety-response-gate.service';
import { DataApiError, type SupabaseDataApiService } from '../src/conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../src/conversation/supabase-service-role-api.service';
import type { AuthenticatedRequest } from '../src/auth/authenticated-request';
import type { SourceAnchor } from '../src/conversation-unit/cu-anchor-mapper';
import type { CuSegmentationRequest } from '../src/conversation-unit/cu-segmentation-provider.types';
import { TemporalDeliveryRepository } from '../src/conversation-unit/temporal-delivery.repository';
import { HistoricalProjectionRepository } from '../src/historical-projection/historical-projection.repository';
import { DatabaseBackgroundPermitGate } from '../src/live-analysis/background-permits';
import { CallAnalysisRepository } from '../src/live-analysis/call-analysis.repository';
import { CallAnalysisWorker, callAnalysisStart, type CallAnalysisObservation } from '../src/live-analysis/call-analysis.worker';
import { ConversationSemanticEstablishmentService } from '../src/live-focus/conversation-semantic-establishment.service';
import { ConversationSemanticRuntimeRepository } from '../src/live-focus/conversation-semantic-runtime.repository';
import { FakeThreadContinuityProvider } from '../src/thread-lifecycle/fake-thread-continuity.provider';
import { LiveCallConversationBinding } from '../src/voice/call-turn/live-call-conversation.port';
import { LiveCallAnalysisSignal } from '../src/voice/call-turn/live-call-analysis.signal';

type Bindings = ConstructorParameters<typeof ConversationSemanticEstablishmentService>;
type FocusProvider = ReturnType<Bindings[2]>['provider'];
type FocusProposal = Awaited<ReturnType<FocusProvider['propose']>>;
type ThreadProvider = ReturnType<Bindings[3]>['provider'];
type ThreadProposal = Awaited<ReturnType<ThreadProvider['propose']>>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require('pg') as { Pool: new (config: { connectionString: string; max: number }) => PgPool };
interface PgClient { query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; release(): void }
interface PgPool { connect(): Promise<PgClient>; query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; end(): Promise<void> }

const VOICE_CONSENT_V3 = 'VOICE_RECORDING_V3';
const NOT_CANONICAL = 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL';
/** The call's committed CUs: turn 1's USER CU, its cut reply none, turn 2's USER and ASSISTANT, turn 3's two USER and its ASSISTANT. */
const CALL_CUS = ['1:USER', '2:USER', '3:ASSISTANT', '4:USER', '5:USER', '6:ASSISTANT'];
const EXPECT = (process.env.INTEL04_EXPECT ?? 'FIXED') as 'FIXED' | 'DEFECT';
const PHASE = (process.env.INTEL04_PHASE ?? 'ALL') as 'ALL' | 'PARK' | 'RESUME';
const STATE_FILE = process.env.INTEL04_STATE_FILE ?? 'intel-04-park-state.json';
const REPORT = process.env.INTEL04_REPORT ?? null;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loopbackUrl(): string {
  const url = process.env.DATABASE_URL ?? '';
  let host = '';
  try { host = new URL(url).hostname; } catch { host = ''; }
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) throw new Error('INTEL04_PROOF_REFUSED: DATABASE_URL must name a loopback throwaway database');
  return url;
}

/** Every database refusal the establishment met: the function, its SQLSTATE and the refusal token (never content). */
const refusals: Array<{ rpc: string; code: string | undefined; token: string }> = [];

/** PostgREST's service_role hop, as a shim: the same definer, the same role, JSON values, the same error identity. */
const SERVER_RPC = /^(?:server_[a-z0-9_]+|commit_conversation_units_call_half_v1|commit_finalized_exchange_with_full_semantic_chain_v1|get_conversation_full_semantic_integrated_batch_snapshot_v1|get_conversation_full_semantic_runtime_context_v1|get_conversation_thread_identity_dossier_page_v1)$/u;
class PgServiceRoleRpc {
  constructor(private readonly pool: PgPool) {}
  async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    if (!SERVER_RPC.test(name)) throw new Error(`INTEL04_PROOF_RPC_NAME ${name}`);
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
      refusals.push({ rpc: name, code: e.code, token: String(e.message ?? '').split(/\s/u)[0] ?? '' });
      throw new DataApiError(400, { databaseCode: e.code, databaseMessage: e.message });
    } finally {
      client.release();
    }
  }
}

/** PostgREST's owner hop, as a shim: `authenticated` with the owner's claims (the bearer IS the synthetic user id), RPC only. */
class PgOwnerDataApi {
  constructor(private readonly pool: PgPool) {}
  async request<T>(accessToken: string, path: string, init: { body?: string } = {}): Promise<T> {
    const name = /^rpc\/([a-z0-9_]+)$/u.exec(path)?.[1];
    if (!name) throw new Error('INTEL04_PROOF_OWNER_PATH');
    const entries = Object.entries(JSON.parse(init.body ?? '{}') as Record<string, unknown>);
    const args = entries.map(([key], i) => `${key} => $${i + 1}`).join(', ');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: accessToken, role: 'authenticated' })]);
      const result = await client.query(`SELECT * FROM public.${name}(${args})`, entries.map(([, v]) => v));
      await client.query('COMMIT');
      return JSON.parse(JSON.stringify(result.rows)) as T;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      const e = error as { code?: string; message?: string };
      throw new DataApiError(400, { databaseCode: e.code, databaseMessage: e.message });
    } finally {
      client.release();
    }
  }
}

/**
 * The four fake layer providers (no model is called):
 *  - segmentation: one unit per sentence;
 *  - focus: every USER CU starts a focus on its first word (each sentence a different word, so a different focus);
 *    an ASSISTANT CU has no independent focus;
 *  - Thread: establishes the FIRST focus of the person (TE-01, the word itself), then NO_ESTABLISHMENT;
 *  - continuity: DISTINCT_NEW (every focus here is new).
 */
function fakeProviders(options: { alreadyEstablished?: boolean } = {}) {
  const calls = { segmentation: 0, focus: 0, thread: 0 };
  // A restarted process (RESUME) is the same fake: the person's first focus was established before it parked.
  let established = options.alreadyEstablished === true;
  const segmentation = {
    propose: async (request: CuSegmentationRequest) => {
      calls.segmentation += 1;
      const units: SourceAnchor[] = request.sourceText.split(/(?<=[.؟!])\s+/u).map((text) => text.trim()).filter((text) => text.length > 0)
        .map((text) => ({ text, occurrence: 1 }));
      return { units };
    },
  };
  const focus: FocusProvider = {
    propose: async (request) => {
      calls.focus += 1;
      const none: FocusProposal = {
        functions: ['INFORM_REPORT'], sequencePosition: 'UNMARKED', targetCuId: null, references: [], claimAttributions: [],
        attention: { kind: 'NO_INDEPENDENT_FOCUS', existingFocusCandidateId: null, groundingAnchor: null, reason: 'INCIDENTAL_OR_SUBORDINATE' },
      };
      if (request.currentCu.sourceRole !== 'USER') return none;
      const word = request.currentCu.committedText.split(/\s+/u)[0]!;
      return {
        ...none,
        references: [{ anchor: { text: word, occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: null, candidateHandleIds: [], newReference: true }],
        attention: { kind: 'START_NEW_FOCUS', existingFocusCandidateId: null, groundingAnchor: { text: word, occurrence: 1 }, reason: 'DIRECT_SUBJECT' },
      };
    },
  };
  const thread: ThreadProvider = {
    propose: async (request): Promise<ThreadProposal> => {
      calls.thread += 1;
      if (established || request.currentCu.sourceRole !== 'USER' || request.currentFocusSemantics.attention.kind !== 'START_NEW_FOCUS') {
        return { decision: 'NO_ESTABLISHMENT', path: null, evidenceCuIds: [], explicitSelectionAnchor: null };
      }
      const word = request.currentCu.committedText.split(/\s+/u)[0]!;
      established = true;
      return { decision: 'ESTABLISH_THREAD', path: 'TE-01', evidenceCuIds: [request.currentCu.cuId], explicitSelectionAnchor: { text: word, occurrence: 1 } };
    },
  };
  const continuity = FakeThreadContinuityProvider.nominatingAll({ decision: 'DISTINCT_NEW', threadId: null, candidateThreadIds: [], currentEvidenceReferenceIndexes: [], priorEvidenceRefs: [] });
  return { calls, segmentation, focus, thread, continuity };
}

function semanticService(serverApi: SupabaseServiceRoleApiService, providers: ReturnType<typeof fakeProviders>): ConversationSemanticEstablishmentService {
  const synthetic = { providerName: 'OPENAI', providerModel: 'gpt-5-mini' } as const;
  return new ConversationSemanticEstablishmentService(
    new ConversationSemanticRuntimeRepository(serverApi),
    () => ({ provider: providers.segmentation, ...synthetic }),
    () => ({ provider: providers.focus, ...synthetic }),
    () => ({ provider: providers.thread, ...synthetic }),
    () => ({ provider: providers.continuity, ...synthetic }),
    new DatabaseBackgroundPermitGate(serverApi),
  );
}

function endedCallSafety(): LiveCallReplyService {
  return new LiveCallReplyService(new LiveCallConversationBinding(), {} as SupabaseDataApiService, new SafetyResponseGateService(),
    {} as never, {} as never, {} as never, {} as never, null);
}

const checks: string[] = [];
const report: Record<string, unknown> = { expect: EXPECT, phase: PHASE };
function check(name: string, ok: boolean, detail = ''): void {
  const line = `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`;
  checks.push(line);
  process.stdout.write(`  ${line}\n`);
  assert.ok(ok, name);
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: loopbackUrl(), max: 16 });
  const sql = async (text: string, values: unknown[] = []) => (await pool.query(text, values)).rows;
  const shim = new PgServiceRoleRpc(pool);
  const serverApi = shim as unknown as SupabaseServiceRoleApiService;
  const ownerApi = new PgOwnerDataApi(pool) as unknown as SupabaseDataApiService;
  const temporal = new ConversationTemporalController(new TemporalDeliveryRepository(ownerApi));
  const historical = new ConversationHistoricalProjectionController(new HistoricalProjectionRepository(ownerApi));
  const as = (user: string) => ({ authenticatedUser: { userId: user, accessToken: user } }) as unknown as AuthenticatedRequest;
  const relation = (await sql("SELECT pg_get_functiondef('public.conversation_thread_cu_relation_v1(uuid,uuid)'::regprocedure) d"))[0]!.d as string;
  const fixed = relation.includes('b.bound_sp <= cu.session_position');
  report.relation = fixed ? '0194 (bound_sp <= cu.session_position)' : '0070 (bound_sp < cu.session_position)';
  process.stdout.write(`INTEL-04 integrated proof - expect ${EXPECT}, phase ${PHASE}, relation ${report.relation}\n`);
  assert.equal(fixed, EXPECT === 'FIXED', 'INTEL04_EXPECT must match the database it runs on');

  const humans: string[] = [];
  const gatesBefore = await sql("SELECT * FROM voice_private.voice_launch_capability_states WHERE capability_scope = 'PERSONAL_LIVE_CALL'");
  const person = async () => {
    const user = randomUUID();
    const session = randomUUID();
    humans.push(user);
    await sql('INSERT INTO auth.users(id) VALUES ($1)', [user]);
    await sql("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, user]);
    return { user, session };
  };
  const turnsOf = async (ids: string[]) => {
    const found = await sql('SELECT id, session_id, role, status, content, processing_path, routing_reason, source_turn_id, idempotency_key, created_at, updated_at, completed_at FROM public.conversation_turns WHERE id = ANY($1::uuid[])', [ids]);
    return ids.map((id) => JSON.parse(JSON.stringify(found.find((t) => t.id === id))) as ConversationTurn);
  };
  const textExchange = async (user: string, session: string, content: string, reply: string) => {
    const client = await pool.connect();
    try {
      const userTurn = randomUUID();
      const assistantTurn = randomUUID();
      await client.query('BEGIN');
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role: 'authenticated' })]);
      await client.query('SET LOCAL ROLE authenticated');
      await client.query('SELECT * FROM public.create_user_conversation_turn($1, $2, $3, $4)', [userTurn, session, content, null]);
      await client.query('RESET ROLE');
      await client.query('SET LOCAL ROLE service_role');
      await client.query('SELECT * FROM public.claim_conversation_turn($1, $2, $3, $4, $5)', [session, user, userTurn, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT']);
      await client.query('SELECT * FROM public.finalize_conversation_turn_v2($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [session, user, userTurn, assistantTurn, reply, 'ALLOW', randomUUID(), null, null, null]);
      await client.query('COMMIT');
      return turnsOf([userTurn, assistantTurn]);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  };
  /** What the database holds for a Session: CUs, lifecycle rows, bindings (ids, positions, states; never words). */
  const truth = async (session: string) => ({
    cus: (await sql('SELECT session_position sp, source_role role FROM public.conversation_units WHERE session_id = $1 ORDER BY session_position', [session]))
      .map((r) => `${r.sp}:${r.role}`),
    lifecycle: (await sql('SELECT session_position sp, from_state f, to_state t, reason_code r FROM public.conversation_thread_lifecycle_events WHERE session_id = $1 ORDER BY session_position, transition_ordinal', [session]))
      .map((r) => `${r.sp}:${r.f}->${r.t}:${r.r}`),
    bindings: (await sql('SELECT bound_sp sp, binding_kind k FROM public.conversation_thread_focus_bindings WHERE session_id = $1 ORDER BY bound_sp', [session]))
      .map((r) => `${r.sp}:${r.k}`),
    threads: Number((await sql('SELECT count(*)::int n FROM public.conversation_threads t JOIN public.conversation_sessions s ON s.user_id = t.user_id WHERE s.id = $1', [session]))[0]!.n),
  });
  /** The SQL reducer re-derives every stored lifecycle row of the Session (no loss, no duplicate, no other derivation). */
  const rederived = async (session: string) => {
    const bad = await sql(`SELECT u.session_position sp FROM public.conversation_units u
      WHERE u.session_id = $1 AND public.derive_conversation_thread_lifecycle_transitions_v1(u) IS DISTINCT FROM COALESCE((
        SELECT jsonb_agg(jsonb_build_object('thread_id', e.thread_id, 'from_state', e.from_state, 'to_state', e.to_state, 'reason_code', e.reason_code) ORDER BY e.transition_ordinal)
          FROM public.conversation_thread_lifecycle_events e WHERE e.cu_id = u.id), '[]'::jsonb)`, [session]);
    return bad.map((r) => Number(r.sp));
  };
  /** The map's reads, as the phone makes them: the temporal snapshot, the Live Focus events and the projection at the head. */
  const mapReads = async (user: string, session: string) => {
    const snapshot = await temporal.sessionTemporalState(as(user), session) as unknown as { liveHead: number | null; liveFocus: unknown };
    const lf = await temporal.liveFocusEvents(as(user), session) as unknown as { events: Array<{ atSp: number }> };
    const head = snapshot.liveHead;
    let projection: { threads: number; liveHeadOk: boolean } | string = 'NO_HEAD';
    if (head !== null) {
      try {
        const disclosure = await historical.historicalProjection(as(user), session, String(head), 'THREAD') as unknown as Record<string, unknown>;
        const threadsOf = (value: unknown): number => (Array.isArray(value) ? value.length : 0);
        projection = { threads: threadsOf((disclosure.threads as unknown) ?? (disclosure.world as { threads?: unknown } | undefined)?.threads), liveHeadOk: true };
      } catch (error) {
        projection = `REFUSED ${(error as Error).message}`;
      }
    }
    return { liveHead: head, liveFocusEvents: lf.events.map((e) => e.atSp), projection };
  };

  try {
    await sql("SELECT * FROM voice_private.set_voice_launch_capability_v1('PERSONAL_LIVE_CALL', 'ENABLED', 'SATISFIED', 'intel-04-proof', 'local synthetic proof')");

    // ======================================================================== W: WRITTEN
    if (PHASE === 'ALL') {
      process.stdout.write('W. written conversation (the text path\'s own establishment, fake providers)\n');
      const providers = fakeProviders();
      const semantic = semanticService(serverApi, providers);
      const w = await person();
      const [u1, a1] = await textExchange(w.user, w.session, 'السفر الجاي مقلقني. الشغل كمان كتير.', 'تمام، فاهمك.');
      const before = refusals.length;
      const first = await semantic.establishExchange(w.user, u1!, a1!).then(() => 'COMMITTED', (e: Error) => `FAILED ${(e as { reason?: string }).reason ?? e.name}`);
      const firstRefusals = refusals.slice(before).map((r) => r.token);
      const [u2, a2] = await textExchange(w.user, w.session, 'والنوم مش مظبوط. والأكل كمان مش مظبوط.', 'تمام.');
      const before2 = refusals.length;
      const second = await semantic.establishExchange(w.user, u2!, a2!).then(() => 'COMMITTED', (e: Error) => `FAILED ${(e as { reason?: string }).reason ?? e.name}`);
      const secondRefusals = refusals.slice(before2).map((r) => r.token);
      const t = await truth(w.session);
      const reads = await mapReads(w.user, w.session);
      report.written = { first, firstRefusals, second, secondRefusals, truth: t, reads, providerCalls: providers.calls };
      process.stdout.write(`   ${JSON.stringify(report.written)}\n`);
      if (EXPECT === 'DEFECT') {
        check('W/T1 (defect): the reducer\'s payload for exchange 1 is refused by the database', first.startsWith('FAILED') && firstRefusals.includes(NOT_CANONICAL), firstRefusals.join(','));
        // Observed (not assumed): the text path has no ordered queue, so the refused exchange is not retried in order - it
        // is LOST. The next exchange commits in its place (SP1..SP3), and the Thread exchange 1 established never exists.
        check('W/T5 (defect): exchange 1 is lost - never committed, its Thread never exists, exchange 2 takes SP1..SP3', second === 'COMMITTED'
          && t.threads === 0 && JSON.stringify(t.cus) === JSON.stringify(['1:USER', '2:USER', '3:ASSISTANT']), `${t.cus.join(',')} threads=${t.threads}`);
      } else {
        check('W/T1: exchange 1 (an establishment, then ONE departure) commits', first === 'COMMITTED' && firstRefusals.length === 0);
        check('W/T2: exchange 2 commits; the SECOND consecutive departure makes the Thread DORMANT there', second === 'COMMITTED'
          && JSON.stringify(t.lifecycle) === JSON.stringify(['5:ACTIVE->DORMANT:SUSTAINED_DEPARTURE']), t.lifecycle.join(','));
        check('W/T5: every CU is committed once, contiguous SP1..SP6', JSON.stringify(t.cus) === JSON.stringify(['1:USER', '2:USER', '3:ASSISTANT', '4:USER', '5:USER', '6:ASSISTANT']), t.cus.join(','));
        check('W/T5: one Thread, one binding at its establishing CU', t.threads === 1 && JSON.stringify(t.bindings) === JSON.stringify(['1:ESTABLISHMENT']));
        check('W/T5: the SQL reducer re-derives every stored row', (await rederived(w.session)).length === 0);
        check('W/T5: the map\'s reads reach the head (SP6): snapshot, Live Focus events and the projection', reads.liveHead === 6
          && reads.liveFocusEvents.length > 0 && typeof reads.projection === 'object', JSON.stringify(reads));
      }
    }

    // ======================================================================== C / P: CALL
    const one = async (name: string, body: Record<string, unknown>) => (await shim.rpc<Array<Record<string, unknown>>>(name, body))[0]!;
    interface Call { user: string; session: string; call: string; recording: string; next: { USER: number; QANDEEL: number }; end: { USER: number; QANDEEL: number } }
    const audio = async (x: Call, track: 'USER' | 'QANDEEL', endMs: number) => {
      const r = await sql('SELECT * FROM public.server_add_call_segment_v2($1, $2, 1, $3, $4, $5, $6, 4096, 20)', [x.user, x.recording, track, x.next[track], x.end[track], endMs]);
      assert.equal(r[0]!.outcome, 'ADDED');
      x.next[track] += 1;
      x.end[track] = endMs;
    };
    const commitTurn = async (x: Call, content: string) => {
      await audio(x, 'USER', x.end.USER + 1000);
      // Positional, as the S8B-05 CP3 proof does: an empty text[] cannot travel through the JSON shim.
      const committed = (await sql("SELECT * FROM public.server_commit_live_call_turn_v1($1, $2, 1, $3, $4, 'SPEECH', $5, 'HIGH', $6, $7, $8, $9, $10)",
        [x.user, x.call, randomUUID(), randomUUID(), content, x.end.USER - 1000, x.end.USER, [], randomUUID(), randomUUID()]))[0]!;
      assert.equal(committed.outcome, 'COMMITTED');
      const idx = Number(committed.call_turn_index);
      assert.equal((await one('server_store_call_turn_safety_v1', { p_user_id: x.user, p_call_id: x.call, p_call_turn_index: idx, p_safety_disposition: 'ALLOW' })).outcome, 'STORED');
      return { idx, closed: committed.closed_call_turn_index === null ? null : { idx: Number(committed.closed_call_turn_index), delivery: committed.closed_delivery_state, heard: Number(committed.closed_heard_mark_ms) } };
    };
    const reply = async (x: Call, idx: number, text: string, playOut: boolean) => {
      assert.equal((await sql('SELECT * FROM public.server_register_call_reply_segment_v1($1, $2, 1, $3, 0, $4, 0, 400, $5)', [x.user, x.call, idx, text, []]))[0]!.outcome, 'REGISTERED');
      assert.equal((await sql('SELECT * FROM public.server_finish_call_reply_generation_v1($1, $2, 1, $3, \'COMPLETE\', 400)', [x.user, x.call, idx]))[0]!.outcome, 'FINISHED');
      if (!playOut) return; // cut before a word is heard: the next turn closes the exchange (NEXT_TURN) with nothing heard
      const start = x.end.QANDEEL;
      assert.equal((await sql('SELECT * FROM public.server_confirm_call_playout_v1($1, $2, 1, $3, 400, $4)', [x.user, x.call, idx, start]))[0]!.outcome, 'ADVANCED');
      await audio(x, 'QANDEEL', start + 400);
      assert.equal((await sql('SELECT * FROM public.server_close_live_call_exchange_v1($1, $2, 1, $3, \'PLAYED_OUT\', $4, $5)', [x.user, x.call, idx, randomUUID(), randomUUID()]))[0]!.outcome, 'CLOSED');
    };
    const queue = async (session: string) => (await sql(`SELECT call_turn_index i, half, queue_state s, attempt_count a, last_failure f, settled_at
      FROM voice_private.call_analysis_queue WHERE session_id = $1 ORDER BY call_turn_index, CASE half WHEN 'EXCHANGE' THEN 0 WHEN 'USER' THEN 1 ELSE 2 END`, [session]))
      .map((r) => ({ item: `${r.i}:${r.half}`, state: String(r.s), attempts: Number(r.a), failure: r.f as string | null, settledAt: r.settled_at ? new Date(String(r.settled_at)).getTime() : null }));
    const worker = (providers: ReturnType<typeof fakeProviders>, observations: CallAnalysisObservation[]) => new CallAnalysisWorker({
      store: new CallAnalysisRepository(serverApi), semantic: semanticService(serverApi, providers), permits: new DatabaseBackgroundPermitGate(serverApi),
      safety: endedCallSafety(), start: callAnalysisStart(), observe: (o) => { observations.push(o); },
    });
    const waitFor = async (what: () => Promise<boolean>, timeoutMs: number, label: string) => {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        if (await what()) return Date.now() - started;
        await sleep(250);
      }
      throw new Error(`INTEL04_PROOF_TIMEOUT ${label}`);
    };

    if (PHASE === 'ALL' || PHASE === 'PARK') {
      process.stdout.write(`C. live call (the REAL worker and half coordinator, start ${callAnalysisStart()}, fake providers)\n`);
      const providers = fakeProviders();
      const observations: CallAnalysisObservation[] = [];
      const signal = new LiveCallAnalysisSignal();
      const w = worker(providers, observations);
      signal.bind(w);
      w.start();
      const p = await person();
      await shim.rpc('server_grant_voice_recording_consent_v1', { p_user_id: p.user, p_command_id: randomUUID(), p_consent_version: VOICE_CONSENT_V3 });
      const call = randomUUID();
      assert.equal((await one('server_begin_call_v1', { p_user_id: p.user, p_session_id: p.session, p_call_id: call, p_client_instance_id: randomUUID() })).outcome, 'BEGUN');
      const activated = await one('server_activate_call_v1', { p_user_id: p.user, p_call_id: call, p_connection_epoch: 1 });
      assert.equal(activated.outcome, 'ACTIVE');
      const x: Call = { ...p, call, recording: String(activated.recording_id), next: { USER: 0, QANDEEL: 0 }, end: { USER: 0, QANDEEL: 0 } };
      const t1 = await commitTurn(x, 'السفر الجاي مقلقني.');
      signal.kick(x.session, 'TURN_COMMITTED');
      await reply(x, t1.idx, 'تمام، احكيلي.', false);
      const t2 = await commitTurn(x, 'الشغل كمان كتير.');
      signal.kick(x.session, 'TURN_COMMITTED');
      check('C/T3: turn 2 closed exchange 1 by NEXT_TURN with nothing heard (the reply has no unit)', t2.closed?.idx === t1.idx && t2.closed?.heard === 0, JSON.stringify(t2.closed));
      await reply(x, t2.idx, 'ماشي.', true);
      signal.kick(x.session, 'EXCHANGE_CLOSED');
      const t3 = await commitTurn(x, 'والنوم مش مظبوط. والأكل كمان مش مظبوط.');
      signal.kick(x.session, 'TURN_COMMITTED');
      await reply(x, t3.idx, 'فاهمك.', true);
      signal.kick(x.session, 'EXCHANGE_CLOSED');
      assert.equal((await one('server_end_call_v1', { p_user_id: x.user, p_call_id: x.call, p_connection_epoch: 1, p_end_reason: 'USER_ENDED' })).outcome, 'ENDED');
      if (EXPECT === 'FIXED') {
        await waitFor(async () => (await queue(x.session)).every((i) => i.state === 'COMPLETE'), 120_000, 'call drained');
      } else {
        await waitFor(async () => (await queue(x.session)).some((i) => i.state === 'PARKED'), 120_000, 'an item PARKED');
        await sleep(3_000); // the order must stay stopped behind it
      }
      await w.stop();
      const items = await queue(x.session);
      const t = await truth(x.session);
      const reads = await mapReads(x.user, x.session);
      report.call = { items, truth: t, reads, providerCalls: providers.calls, refusals: [...new Set(refusals.map((r) => `${r.rpc}:${r.token}`))] };
      process.stdout.write(`   ${JSON.stringify(report.call)}\n`);
      if (EXPECT === 'FIXED') {
        check('C/T3: the call\'s every half commits on its first attempt', items.every((i) => i.state === 'COMPLETE' && i.attempts === 1), items.map((i) => `${i.item}=${i.state}/${i.attempts}`).join(','));
        const settled = items.map((i) => i.settledAt!);
        check('C/T5: the halves settled in the analysis order (FIFO by call_turn_index, USER before ASSISTANT)', settled.every((s, k) => k === 0 || s >= settled[k - 1]!));
        check('C/T2: the second consecutive departure (turn 3, second sentence) makes the Thread DORMANT there, and nothing earlier',
          JSON.stringify(t.lifecycle) === JSON.stringify(['5:ACTIVE->DORMANT:SUSTAINED_DEPARTURE']), t.lifecycle.join(','));
        check('C/T5: every CU committed once, contiguous (the cut reply has none)', JSON.stringify(t.cus) === JSON.stringify(CALL_CUS), t.cus.join(','));
        check('C/T5: one Thread, one binding at its establishing CU', t.threads === 1 && JSON.stringify(t.bindings) === JSON.stringify(['1:ESTABLISHMENT']));
        check('C/T5: the SQL reducer re-derives every stored row', (await rederived(x.session)).length === 0);
        check('C/T5: the map\'s reads reach the head', reads.liveHead === t.cus.length && typeof reads.projection === 'object', JSON.stringify(reads));
      } else {
        const parked = items.find((i) => i.state === 'PARKED')!;
        check('C (defect): the turn-2 USER half is refused and PARKED', parked.item === `${t2.idx}:USER` && refusals.some((r) => r.token === NOT_CANONICAL), JSON.stringify(parked));
        check('C (defect): every later item waits behind it (the map stops at the establishing CU)',
          items.slice(items.indexOf(parked) + 1).every((i) => i.state === 'PENDING') && items.indexOf(parked) < items.length - 1 && t.cus.length === 1, `${items.map((i) => `${i.item}=${i.state}`).join(',')} cus=${t.cus.join(',')}`);
        if (PHASE === 'PARK') {
          writeFileSync(STATE_FILE, JSON.stringify({ user: x.user, session: x.session, call: x.call, parked: parked.item, items, truth: t }));
          humans.length = 0; // the PARKED world is kept for RESUME (on a throwaway clone)
        }
      }
    }

    // ======================================================================== P: RESUME the PARKED item after 0194
    if (PHASE === 'RESUME') {
      const parkedWorld = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as { user: string; session: string; parked: string; items: Array<{ item: string; state: string; attempts: number }> };
      humans.push(parkedWorld.user);
      process.stdout.write(`P. the PARKED item ${parkedWorld.parked} after 0194: the worker's own parked retry (no reset, no re-queue, no reprocessing)\n`);
      const before = await queue(parkedWorld.session);
      const head = before.find((i) => i.item === parkedWorld.parked)!;
      const due = (await sql(`SELECT next_attempt_at FROM voice_private.call_analysis_queue WHERE session_id = $1 AND queue_state = 'PARKED'`, [parkedWorld.session]))[0]!.next_attempt_at;
      check('P: the migration changed no item: the head is still PARKED and every item is exactly as it was parked', head.state === 'PARKED' && JSON.stringify(before) === JSON.stringify(parkedWorld.items), `${head.item}=${head.state}/${head.attempts}, due ${String(due)}`);
      const providers = fakeProviders({ alreadyEstablished: true });
      const observations: CallAnalysisObservation[] = [];
      const w = worker(providers, observations);
      w.start();
      const waited = await waitFor(async () => (await queue(parkedWorld.session)).every((i) => i.state === 'COMPLETE'), 420_000, 'resumed order drained');
      await w.stop();
      const items = await queue(parkedWorld.session);
      const t = await truth(parkedWorld.session);
      const reads = await mapReads(parkedWorld.user, parkedWorld.session);
      report.resume = { before, waitedMs: waited, due, items, truth: t, reads };
      process.stdout.write(`   ${JSON.stringify(report.resume)}\n`);
      const resumed = items.find((i) => i.item === parkedWorld.parked)!;
      check('P/T5: the SAME item completes on its parked retry (one more attempt, never reset)', resumed.state === 'COMPLETE' && resumed.attempts === head.attempts + 1, `${resumed.attempts} after ${head.attempts}`);
      check('P/T5: it was retried only when its parked rule made it due (settled at or after next_attempt_at)', resumed.settledAt !== null && resumed.settledAt >= new Date(String(due)).getTime(), `settled ${new Date(resumed.settledAt ?? 0).toISOString()}, due ${String(due)}, waited ${waited} ms`);
      const settled = items.filter((i) => i.settledAt !== null).map((i) => i.settledAt!);
      check('P/T5: the order resumed behind it and drained in order', items.every((i) => i.state === 'COMPLETE') && settled.every((s, k) => k === 0 || s >= settled[k - 1]!));
      check('P/T5: every CU committed once, contiguous; the second departure is DORMANT there', JSON.stringify(t.cus) === JSON.stringify(CALL_CUS)
        && JSON.stringify(t.lifecycle) === JSON.stringify(['5:ACTIVE->DORMANT:SUSTAINED_DEPARTURE']), `${t.cus.join(',')} | ${t.lifecycle.join(',')}`);
      check('P/T5: the SQL reducer re-derives every stored row', (await rederived(parkedWorld.session)).length === 0);
      check('P/T5: the map\'s reads reach the head', reads.liveHead === t.cus.length && typeof reads.projection === 'object', JSON.stringify(reads));
    }
  } finally {
    if (humans.length > 0) await teardown(pool, humans);
    for (const gate of gatesBefore) {
      await sql('SELECT * FROM voice_private.set_voice_launch_capability_v1($1, $2, $3, $4, $5)',
        [gate.capability_scope, gate.feature_flag_state, gate.condition_state, 'intel-04-proof', 'restored after the local synthetic proof']).catch(() => undefined);
    }
    await pool.end();
  }
  report.checks = checks;
  if (REPORT) writeFileSync(REPORT, JSON.stringify(report, null, 2));
  process.stdout.write(`INTEL-04 integrated proof: ${checks.length}/${checks.length} PASS (${EXPECT}, ${PHASE})\n`);
}

/** Removes the synthetic people's rows that block deleting them (the proof's database is a throwaway clone anyway). */
async function teardown(pool: PgPool, humans: string[]): Promise<void> {
  const q = (text: string) => pool.query(text, [humans]).catch(() => undefined);
  await q('DELETE FROM voice_private.call_analysis_queue WHERE user_id = ANY($1::uuid[])');
}

main().catch((error) => {
  process.stderr.write(`INTEL-04 integrated proof FAILED: ${(error as Error).stack ?? error}\nrefusals: ${JSON.stringify(refusals)}\n`);
  process.exitCode = 1;
});
