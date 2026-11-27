// CALL-ATTR-01 (T-1, 2026-11-27) — the call path's provider work through the REAL production composition and the REAL
// AI-COST-01 accounting boundary. What runs as shipped:
//   - `productionLiveCallAttention`, with its `DeepSeekAttentionEvaluator` behind `costLedgerDecorator('LIVE_ATTENTION_EVALUATION')`;
//   - a `CallAnalysisWorker` over the production `ConversationSemanticEstablishmentService` and its four production
//     bindings (each a DeepSeek adapter behind its cost-ledger decorator and the foreground guard, as ConversationModule
//     composes them);
//   - `productionAiProviderCallAccounting()` → `SupabaseAiProviderCallLedger` → `SupabaseServiceRoleApiService`.
// What is replaced:
//   - the NETWORK only: `fetch` answers DeepSeek with a deterministic completion, and the ledger's two service-role RPCs
//     (0170 `begin_ai_provider_call_v1` / `settle_ai_provider_call_v1`) with their ownership rule (the session must be
//     the payer's, the turn the payer's in that session, else 42501). T-2 runs the same compositions over real
//     PostgREST and PostgreSQL.
//   - the call's own stores (the 0204 writer, the 0191 queue, the semantic runtime reads), which hold no accounting.
// Nothing here is a fake evaluator: an evaluator that bypassed the boundary would prove nothing.
import { guardForegroundBinding } from '../conversation/foreground-turn-work';
import { deepSeekSegmentationBinding } from '../conversation/conversation.module';
import type { ConversationTurn } from '../conversation/conversation.types';
import { deepSeekFocusResolutionBinding } from '../conversational-focus/focus-resolution-binding';
import type { BackgroundPermitGate } from '../live-analysis/background-permits';
import type { CallAnalysisClaim, CallAnalysisSettleOutcome, CallAnalysisStore } from '../live-analysis/call-analysis.repository';
import { CallAnalysisWorker } from '../live-analysis/call-analysis.worker';
import { productionLiveCallAttention } from '../live-attention/live-attention.provider';
import { ConversationSemanticEstablishmentService } from '../live-focus/conversation-semantic-establishment.service';
import type { ConversationSemanticRuntimeBoundary } from '../live-focus/conversation-semantic-runtime.repository';
import { deepSeekThreadEstablishmentBinding } from '../thread-establishment/thread-establishment-binding';
import { deepSeekThreadContinuityBinding } from '../thread-lifecycle/thread-continuity-binding';
import type { LiveCallAttentionChannel } from '../voice/call-turn/live-call-attention.port';
import { currentAiUsageAttribution } from './ai-usage-attribution';
import { costLedgerDecorator } from './production-ai-provider-call-accounting';

const LEDGER = 'http://ledger.call-attr-01.test';
const U1 = 'c0a70001-0000-4000-8000-0000000000a1';
const U2 = 'c0a70001-0000-4000-8000-0000000000a2';
const S1 = 'c0a70001-0000-4000-8000-0000000000b1';
const S2 = 'c0a70001-0000-4000-8000-0000000000b2';
const CALL1 = 'c0a70001-0000-4000-8000-0000000000c1';
const CALL2 = 'c0a70001-0000-4000-8000-0000000000c2';
const T_USER = 'c0a70001-0000-4000-8000-0000000000d1';
const T_ASSISTANT = 'c0a70001-0000-4000-8000-0000000000d2';
const T_PRE_USER = 'c0a70001-0000-4000-8000-0000000000d3';
const T_PRE_ASSISTANT = 'c0a70001-0000-4000-8000-0000000000d4';
const USER_TEXT = 'أنا وصاحبي بنفكر نفتح كافيه صغير.';
const ASSISTANT_TEXT = 'فكرة حلوة، احكيلي أكتر.';

// ------------------------------------------------------------------------------------------------ the network
interface Begin { readonly callId: string; readonly userId: string; readonly sessionId: string | null; readonly sourceTurnId: string | null; readonly family: string; readonly path: string | null }
interface Settle { readonly callId: string; readonly userId: string; readonly outcome: string; readonly completeness: string; readonly usage: Record<string, number> }

/** The database's ownership facts the 0170 begin command checks (whose session, whose turn in which session). */
const SESSIONS: Record<string, string> = { [S1]: U1, [S2]: U2 };
const TURNS: Record<string, { user: string; session: string }> = {
  [T_USER]: { user: U1, session: S1 }, [T_ASSISTANT]: { user: U1, session: S1 },
  [T_PRE_USER]: { user: U1, session: S1 }, [T_PRE_ASSISTANT]: { user: U1, session: S1 },
};

class Network {
  readonly begins: Begin[] = [];
  readonly refusedBegins: Begin[] = [];
  readonly settles: Settle[] = [];
  readonly deepseek: { readonly system: string; readonly data: string }[] = [];
  /** When set, DeepSeek answers wait for it (the concurrency case releases them in reverse order). */
  hold: Promise<void> | null = null;
  private readonly original = globalThis.fetch;

  install(): void {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => this.route(String(input instanceof Request ? input.url : input), init)) as typeof fetch;
  }

  restore(): void {
    globalThis.fetch = this.original;
  }

  private json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }

  private async route(url: string, init?: RequestInit): Promise<Response> {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    if (url.startsWith('https://api.deepseek.com')) return this.answerDeepSeek(body);
    if (url === `${LEDGER}/rest/v1/rpc/begin_ai_provider_call_v1`) {
      const begin: Begin = {
        callId: String(body.p_call_id), userId: String(body.p_user_id), sessionId: (body.p_session_id as string | null) ?? null,
        sourceTurnId: (body.p_source_turn_id as string | null) ?? null, family: String(body.p_feature_family), path: (body.p_processing_path as string | null) ?? null,
      };
      const turn = begin.sourceTurnId === null ? null : TURNS[begin.sourceTurnId];
      const forbidden = (begin.sessionId !== null && SESSIONS[begin.sessionId] !== begin.userId)
        || (begin.sourceTurnId !== null && (!turn || turn.user !== begin.userId || (begin.sessionId !== null && turn.session !== begin.sessionId)));
      if (forbidden) {
        this.refusedBegins.push(begin);
        return this.json(403, { code: '42501', message: 'FORBIDDEN', details: null, hint: null });
      }
      this.begins.push(begin);
      return this.json(200, [{ begin_outcome: 'BEGUN', attempt_number: 1 }]);
    }
    if (url === `${LEDGER}/rest/v1/rpc/settle_ai_provider_call_v1`) {
      this.settles.push({
        callId: String(body.p_call_id), userId: String(body.p_user_id), outcome: String(body.p_outcome),
        completeness: String(body.p_usage_completeness), usage: body.p_usage as Record<string, number>,
      });
      return this.json(200, [{ settle_outcome: 'SETTLED' }]);
    }
    throw new Error(`CALL-ATTR-01 T-1: unexpected request to ${url}`);
  }

  private async answerDeepSeek(body: Record<string, unknown>): Promise<Response> {
    const messages = body.messages as Array<{ role: string; content: string }>;
    const system = messages[0]?.content ?? '';
    const data = messages[1]?.content ?? '';
    this.deepseek.push({ system, data });
    if (this.hold) await this.hold;
    // The answer: a valid one where the test needs the chain to continue (attention: NONE; segmentation: one whole unit),
    // otherwise an empty object, which the adapter refuses AFTER its accounted transport attempt settled.
    let content = '{}';
    if (system.includes('"developments"')) content = JSON.stringify({ developments: [], contextCarry: null });
    else if (system.includes('"units"') && data.includes(USER_TEXT)) content = JSON.stringify({ units: [{ text: USER_TEXT, occurrence: 1 }] });
    else if (system.includes('"units"') && data.includes(ASSISTANT_TEXT)) content = JSON.stringify({ units: [{ text: ASSISTANT_TEXT, occurrence: 1 }] });
    // The usage identifies the request it settles: 111 prompt tokens for the first person's text, 222 for the second's.
    const prompt = data.includes('marker-two') ? 222 : 111;
    return this.json(200, {
      id: 'call-attr-01', object: 'chat.completion', created: 0, model: 'deepseek-v4-flash',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
      usage: { prompt_tokens: prompt, prompt_cache_hit_tokens: 100, prompt_cache_miss_tokens: prompt - 100, completion_tokens: 7, total_tokens: prompt + 7 },
    });
  }
}

const until = async (predicate: () => boolean, what: string, ms = 5_000): Promise<void> => {
  const deadline = Date.now() + ms;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`CALL-ATTR-01 T-1: timed out waiting for ${what}`);
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
};

const GRANTED: BackgroundPermitGate = { acquire: async () => ({ waitedMs: 0, release: async () => undefined }) };

let network: Network;
const saved = { ...process.env };
beforeEach(() => {
  process.env.SUPABASE_URL = LEDGER;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'call-attr-01-test-service-role';
  process.env.DEEPSEEK_API_KEY = 'call-attr-01-test-key';
  process.env.DEEPSEEK_QUALIFICATION_MODE = 'SYNTHETIC_ONLY';
  process.env.LIVE_CALL_PROVISIONAL_ATTENTION = 'ON';
  delete process.env.EMERGENCY_CALL_SPEND_USD;
  network = new Network();
  network.install();
});
afterEach(() => {
  network.restore();
  process.env = { ...saved };
});

// ------------------------------------------------------------------------------------------------ provisional attention
/** The 0204 store as the lane reads and writes it: no state, no Threads, every evaluation recorded. */
function attentionStore() {
  const records: Array<{ user: string; call: string; epoch: number; outcome: string; promptTokens: number | null }> = [];
  const rpc = async <T,>(name: string, body: Record<string, unknown>): Promise<T> => {
    // A live call with nothing accounted yet on either track.
    if (name === 'server_read_call_attention_state_v1') {
      return (['USER', 'QANDEEL'] as const).map((track) => ({ track, accounted_to_clock_ms: 0, settled_through_clock_ms: -1, last_event_seq: 0, call_ended: false, open_subjects: [] })) as T;
    }
    if (name === 'server_read_call_attention_threads_v1') return [] as T;
    if (name === 'server_record_call_attention_evaluation_v1') {
      records.push({ user: String(body.p_user_id), call: String(body.p_call_id), epoch: Number(body.p_connection_epoch), outcome: String(body.p_outcome), promptTokens: (body.p_prompt_tokens as number | null) ?? null });
      return [{ outcome: 'RECORDED', accounted_to_clock_ms: body.p_covers_to_clock_ms, first_event_seq: null, last_event_seq: null }] as T;
    }
    throw new Error(`unexpected attention RPC ${name}`);
  };
  return { records, serviceApi: { rpc } };
}

const channel = (userId: string, sessionId: string, callId: string, epoch: number): LiveCallAttentionChannel => ({
  userId, sessionId, callId, epoch, latestCaptureMs: () => 10_000,
});

describe('CALL-ATTR-01 T-1: provisional attention through the production composition and the accounting boundary', () => {
  it('is admitted under the connection\'s payer and session, with NO source turn, and settled with the reported usage', async () => {
    const store = attentionStore();
    const lane = productionLiveCallAttention(process.env, store.serviceApi, GRANTED)!;
    const session = lane.open(channel(U1, S1, CALL1, 1));
    session.evidence('USER', USER_TEXT, 0, 2_000);
    await until(() => store.records.length === 1, 'the evaluation record');

    expect(network.deepseek).toHaveLength(1);
    expect(network.begins).toEqual([{ callId: expect.any(String), userId: U1, sessionId: S1, sourceTurnId: null, family: 'LIVE_ATTENTION_EVALUATION', path: null }]);
    expect(network.settles).toEqual([{ callId: network.begins[0]!.callId, userId: U1, outcome: 'SUCCEEDED', completeness: 'COMPLETE', usage: { INPUT_TOKEN: 11, CACHE_READ_INPUT_TOKEN: 100, OUTPUT_TOKEN: 7 } }]);
    expect(store.records).toEqual([{ user: U1, call: CALL1, epoch: 1, outcome: 'NONE', promptTokens: 111 }]);
    // No scope outlives the evaluation.
    expect(currentAiUsageAttribution()).toBeUndefined();
    session.close();
  });

  it('a reconnect\'s new connection is attributed by its own channel, never by the old one', async () => {
    const store = attentionStore();
    const lane = productionLiveCallAttention(process.env, store.serviceApi, GRANTED)!;
    const first = lane.open(channel(U1, S1, CALL1, 1));
    first.evidence('USER', USER_TEXT, 0, 2_000);
    await until(() => store.records.length === 1, 'the first epoch\'s record');
    await first.handover();
    const second = lane.open(channel(U1, S1, CALL1, 2));
    second.evidence('USER', `${USER_TEXT} تاني`, 2_000, 4_000);
    await until(() => store.records.some((r) => r.epoch === 2 && r.outcome === 'NONE'), 'the second epoch\'s record');

    expect(network.begins.map((b) => [b.userId, b.sessionId, b.sourceTurnId, b.family])).toEqual([
      [U1, S1, null, 'LIVE_ATTENTION_EVALUATION'], [U1, S1, null, 'LIVE_ATTENTION_EVALUATION'],
    ]);
    expect(network.settles.map((s) => s.outcome)).toEqual(['SUCCEEDED', 'SUCCEEDED']);
    second.close();
  });

  it('two people\'s calls evaluated concurrently are each charged to their own payer and session only', async () => {
    const store = attentionStore();
    const lane = productionLiveCallAttention(process.env, store.serviceApi, GRANTED)!;
    let release!: () => void;
    network.hold = new Promise<void>((resolve) => { release = resolve; });
    const one = lane.open(channel(U1, S1, CALL1, 1));
    const two = lane.open(channel(U2, S2, CALL2, 1));
    one.evidence('USER', `${USER_TEXT} marker-one`, 0, 2_000);
    two.evidence('USER', `${USER_TEXT} marker-two`, 0, 2_000);
    await until(() => network.deepseek.length === 2, 'both provider requests in flight');
    release();
    await until(() => store.records.length === 2, 'both records');

    // Each settled request's usage (111 = the first person's text, 222 = the second's) belongs to the call it began as.
    const byCall = new Map(network.begins.map((b) => [b.callId, b]));
    const charged = network.settles.map((s) => [s.usage.INPUT_TOKEN! + s.usage.CACHE_READ_INPUT_TOKEN!, byCall.get(s.callId)!.userId, byCall.get(s.callId)!.sessionId, s.userId]);
    expect(charged.sort()).toEqual([[111, U1, S1, U1], [222, U2, S2, U2]]);
    expect(store.records.map((r) => [r.user, r.promptTokens]).sort()).toEqual([[U1, 111], [U2, 222]]);
    expect(network.begins.every((b) => b.sourceTurnId === null)).toBe(true);
    one.close();
    two.close();
  });

  it('fails closed: an invalid identity opens no scope, so the boundary refuses before any provider request', async () => {
    const store = attentionStore();
    const lane = productionLiveCallAttention(process.env, store.serviceApi, GRANTED)!;
    const session = lane.open(channel('not-a-uuid', S1, CALL1, 1));
    session.evidence('USER', USER_TEXT, 0, 2_000);
    // A failed span is recorded and retried at once (backoff only after two failures): every record is examined.
    await until(() => store.records.length >= 1, 'the refused evaluation\'s record');
    expect(store.records.every((r) => r.outcome === 'PROVIDER_FAILED')).toBe(true);
    expect(network.begins).toEqual([]);
    expect(network.deepseek).toEqual([]);
    session.close();
  });

  it('cross-user ownership is refused by the ledger (42501) before any provider request', async () => {
    const store = attentionStore();
    const lane = productionLiveCallAttention(process.env, store.serviceApi, GRANTED)!;
    const session = lane.open(channel(U1, S2, CALL1, 1)); // a session that is not the payer's
    session.evidence('USER', USER_TEXT, 0, 2_000);
    await until(() => store.records.length >= 1, 'the refused evaluation\'s record');
    expect(store.records.every((r) => r.outcome === 'PROVIDER_FAILED')).toBe(true);
    expect(network.refusedBegins.length).toBeGreaterThan(0);
    expect(network.refusedBegins.every((b) => b.userId === U1 && b.sessionId === S2 && b.sourceTurnId === null)).toBe(true);
    expect(network.begins).toEqual([]);
    expect(network.deepseek).toEqual([]);
    session.close();
  });
});

// ------------------------------------------------------------------------------------------------ committed call analysis
function turn(id: string, sessionId: string, role: 'USER' | 'ASSISTANT', content: string, status: ConversationTurn['status'], sourceTurnId: string | null = null): ConversationTurn {
  return {
    id, session_id: sessionId, role, status, content, processing_path: null, routing_reason: null,
    source_turn_id: sourceTurnId, idempotency_key: null, created_at: 'now', updated_at: 'now', completed_at: null,
  };
}
const TURN_ROWS: Record<string, ConversationTurn> = {
  [T_USER]: turn(T_USER, S1, 'USER', USER_TEXT, 'GENERATING'),
  [T_ASSISTANT]: turn(T_ASSISTANT, S1, 'ASSISTANT', ASSISTANT_TEXT, 'COMPLETED', T_USER),
  [T_PRE_USER]: turn(T_PRE_USER, S1, 'USER', USER_TEXT, 'COMPLETED'),
  [T_PRE_ASSISTANT]: turn(T_PRE_ASSISTANT, S1, 'ASSISTANT', ASSISTANT_TEXT, 'COMPLETED', T_PRE_USER),
};

const claimed = (half: 'EXCHANGE' | 'USER' | 'ASSISTANT', userId: string, turnId: string, assistantTurnId: string | null = null, attemptCount = 1): CallAnalysisClaim => ({
  outcome: 'CLAIMED', callId: CALL1, callTurnIndex: half === 'EXCHANGE' ? 0 : 1, half, userId, turnId, assistantTurnId, attemptCount,
});

/** The 0191 queue in memory: scripted claims, recorded settlements. */
function queue(claims: CallAnalysisClaim[]) {
  const settled: Array<{ half: string; outcome: CallAnalysisSettleOutcome }> = [];
  const store: CallAnalysisStore = {
    listSessions: async () => [],
    claim: async () => claims.shift() ?? { outcome: 'IDLE' as const },
    settle: async (input) => {
      settled.push({ half: input.half, outcome: input.outcome });
      return { outcome: 'SETTLED' as const, queueState: 'COMPLETE', nextAttemptAt: null };
    },
    readTurns: async (_user, _session, ids) => ids.map((id) => TURN_ROWS[id]!).filter(Boolean),
    listUnsettledExchanges: async () => [],
    readCallContext: async () => [],
    storeSafety: async () => 'STORED',
    closeEndedExchange: async () => 'CLOSED',
  };
  return { store, settled };
}

/** The semantic runtime's reads: nothing established yet, an empty context. No accounting lives here. */
const RUNTIME: ConversationSemanticRuntimeBoundary = {
  readIntegratedBatchSnapshot: async () => ({
    batch_exists: false, committed_unit_count: 0, units: [], commit_event: null, source_frontier: 0, live_head: null,
    focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false,
    thread_capture_state: 'ABSENT', thread_batch_exists: false, thread_unit_count: 0, thread_establishment_count: 0,
    thread_semantic_capture_state: 'ABSENT', thread_semantic_batch_exists: false, thread_semantic_unit_count: 0, continuity_binding_count: 0, lifecycle_transition_count: 0,
    full_semantic_capture_state: 'ABSENT', live_focus_batch_exists: false, live_focus_unit_count: 0, live_focus_transition_count: 0,
    live_focus_transitions: [], session_live_focus: { kind: 'NONE' }, session_live_focus_sp: null,
  }),
  readRuntimeContext: async ({ sessionId }: { sessionId: string }) => ({
    sessionId, token: { currentSp: null, sameSpEventSequence: 0 },
    priorContext: { priorCus: [], referenceHandles: [], focusCandidates: [], currentFocusCandidateId: null },
    priorFocusSemantics: [], focusAttentionHistory: [], establishedThreadBindings: [],
    worldThreadIdentityVersion: 0, sessionFocusThreadBindings: [], sessionThreadLifecycleHistory: [],
    currentLiveFocus: { kind: 'NONE' }, currentLiveFocusSp: null,
  }),
  readIdentityDossierPage: async () => [],
  commitFinalizedExchangeWithFullSemanticChain: async () => { throw new Error('not reached in T-1'); },
  commitCallHalfWithFullSemanticChain: async () => { throw new Error('not reached in T-1'); },
} as unknown as ConversationSemanticRuntimeBoundary;

/** The production analysis composition: ConversationModule's four bindings, exactly as it registers them. */
function analysisWorker(claims: CallAnalysisClaim[]) {
  const semantic = new ConversationSemanticEstablishmentService(
    RUNTIME,
    guardForegroundBinding(deepSeekSegmentationBinding),
    guardForegroundBinding(deepSeekFocusResolutionBinding(process.env, costLedgerDecorator('FOCUS_RESOLUTION'))),
    guardForegroundBinding(deepSeekThreadEstablishmentBinding(process.env, costLedgerDecorator('THREAD_FORMATION'))),
    guardForegroundBinding(deepSeekThreadContinuityBinding(process.env, costLedgerDecorator('THREAD_CONTINUITY'))),
    GRANTED,
  );
  const q = queue(claims);
  const worker = new CallAnalysisWorker({
    store: q.store, semantic, permits: GRANTED, start: 'AT_COMMIT',
    safety: { settleEndedCallSafety: async () => undefined },
  });
  (worker as unknown as { stopped: boolean }).stopped = false;
  return { worker, settled: q.settled };
}

describe('CALL-ATTR-01 T-1: committed call analysis through the production composition and the accounting boundary', () => {
  it('each half and each pre-call exchange is admitted under the claim\'s payer, session and source turn, and settled', async () => {
    const { worker } = analysisWorker([
      claimed('EXCHANGE', U1, T_PRE_USER, T_PRE_ASSISTANT), claimed('USER', U1, T_USER), claimed('ASSISTANT', U1, T_ASSISTANT),
    ]);
    await worker.drain(S1);
    await worker.stop();

    expect(network.begins.length).toBeGreaterThanOrEqual(3);
    expect(network.deepseek).toHaveLength(network.begins.length);
    // Every admitted attempt is the claim's payer and session; its source turn is the claim's turn.
    expect(new Set(network.begins.map((b) => `${b.userId}|${b.sessionId}`))).toEqual(new Set([`${U1}|${S1}`]));
    expect(new Set(network.begins.map((b) => b.sourceTurnId))).toEqual(new Set([T_PRE_USER, T_USER, T_ASSISTANT]));
    // The half's own segmentation is attributed to the half's own turn; the chain continued past it under the same scope.
    expect(network.begins.filter((b) => b.family === 'CU_SEGMENTATION').map((b) => b.sourceTurnId)).toEqual(expect.arrayContaining([T_USER, T_ASSISTANT]));
    expect(network.begins.some((b) => b.family !== 'CU_SEGMENTATION')).toBe(true);
    // Every begun attempt settled with the reported usage, under the same payer.
    expect(network.settles).toHaveLength(network.begins.length);
    expect(network.settles.every((s) => s.outcome === 'SUCCEEDED' && s.completeness === 'COMPLETE' && s.userId === U1)).toBe(true);
    expect(currentAiUsageAttribution()).toBeUndefined();
  });

  it('a recovered item, re-claimed by another worker instance, is attributed exactly as its first attempt', async () => {
    const first = analysisWorker([claimed('USER', U1, T_USER, null, 1)]);
    await first.worker.drain(S1);
    await first.worker.stop();
    const firstBegins = network.begins.length;
    const second = analysisWorker([claimed('USER', U1, T_USER, null, 2)]);
    await second.worker.drain(S1);
    await second.worker.stop();

    const recovered = network.begins.slice(firstBegins);
    expect(recovered.length).toBeGreaterThan(0);
    expect(recovered.map((b) => [b.userId, b.sessionId, b.sourceTurnId])).toEqual(network.begins.slice(0, firstBegins).map((b) => [b.userId, b.sessionId, b.sourceTurnId]));
  });

  it('cross-user ownership is refused by the ledger (42501) before any provider request; the item is a counted retry', async () => {
    const { worker, settled } = analysisWorker([claimed('USER', U2, T_USER)]); // U1's turn claimed for U2
    await worker.drain(S1);
    await worker.stop();
    expect(network.refusedBegins.length).toBeGreaterThan(0);
    expect(network.refusedBegins.every((b) => b.userId === U2 && b.sourceTurnId === T_USER)).toBe(true);
    expect(network.begins).toEqual([]);
    expect(network.deepseek).toEqual([]);
    expect(settled).toEqual([{ half: 'USER', outcome: 'PROVIDER_FAILURE' }]);
  });

  it('fails closed: an invalid claim identity opens no scope, so nothing is begun and no provider request is made', async () => {
    const { worker, settled } = analysisWorker([claimed('USER', 'not-a-uuid', T_USER)]);
    await worker.drain(S1);
    await worker.stop();
    expect(network.begins).toEqual([]);
    expect(network.refusedBegins).toEqual([]);
    expect(network.deepseek).toEqual([]);
    expect(settled).toEqual([{ half: 'USER', outcome: 'PROVIDER_FAILURE' }]);
  });
});
