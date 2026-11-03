import type { ConversationTurn } from '../conversation/conversation.types';
import { CallHalfOrderError, ConversationSemanticIntegrityError, ConversationSemanticUnavailableError } from '../live-focus/conversation-semantic-runtime.types';
import type { BackgroundPermitGate } from './background-permits';
import type { CallAnalysisClaim, CallAnalysisSettleOutcome, CallAnalysisStore, UnsettledCallExchange } from './call-analysis.repository';
import { CallAnalysisWorker, callAnalysisStart, type CallAnalysisObservation, type CallAnalysisWorkerDeps } from './call-analysis.worker';

const SESSION = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';
const CALL = '99999999-9999-4999-8999-999999999999';
const delivery = { liveHead: 1, liveFocus: { kind: 'NONE' as const }, committedEvents: [], liveFocusTransitions: [] };

function turn(id: string, role: 'USER' | 'ASSISTANT', status: ConversationTurn['status'] = 'COMPLETED'): ConversationTurn {
  return {
    id, session_id: SESSION, role, status, content: 'x', processing_path: null, routing_reason: null, source_turn_id: role === 'ASSISTANT' ? 'u1' : null,
    idempotency_key: null, created_at: 'now', updated_at: 'now', completed_at: null,
  };
}

/** A queue in memory: the claims are scripted in order; settlements are recorded. */
function fakeStore(claims: CallAnalysisClaim[], unsettled: UnsettledCallExchange[] = []) {
  const settled: { half: string; outcome: CallAnalysisSettleOutcome; failureCode: string | null }[] = [];
  const store: CallAnalysisStore & { settled: typeof settled; closes: number; stored: string[] } = {
    settled, closes: 0, stored: [],
    listSessions: jest.fn(async () => [{ sessionId: SESSION, userId: USER }]),
    claim: jest.fn(async () => claims.shift() ?? { outcome: 'IDLE' as const }),
    settle: jest.fn(async (input) => {
      settled.push({ half: input.half, outcome: input.outcome, failureCode: input.failureCode });
      return { outcome: input.half === 'EXCHANGE' || input.outcome !== 'RELEASE' ? 'SETTLED' as const : 'ALREADY_SETTLED' as const, queueState: 'COMPLETE', nextAttemptAt: null };
    }),
    readTurns: jest.fn(async (_user, _session, ids: readonly string[]) => ids.map((id) => turn(id, id.startsWith('a') ? 'ASSISTANT' : 'USER', id === 'u1' ? 'GENERATING' : 'COMPLETED'))),
    listUnsettledExchanges: jest.fn(async () => unsettled.splice(0)),
    readCallContext: jest.fn(async () => []),
    storeSafety: jest.fn(async (_u, _c, _i, disposition: string) => { store.stored.push(disposition); return 'STORED'; }),
    closeEndedExchange: jest.fn(async () => { store.closes += 1; return 'CLOSED'; }),
  };
  return store;
}
const claimed = (half: 'EXCHANGE' | 'USER' | 'ASSISTANT', index: number, turnId: string, assistantTurnId: string | null = null): CallAnalysisClaim => ({
  outcome: 'CLAIMED', callId: CALL, callTurnIndex: index, half, userId: USER, turnId, assistantTurnId, attemptCount: 1,
});
function worker(store: CallAnalysisStore, overrides: Partial<CallAnalysisWorkerDeps> = {}) {
  const observations: CallAnalysisObservation[] = [];
  const release = jest.fn(async () => undefined);
  const permits: BackgroundPermitGate = { acquire: jest.fn(async () => ({ waitedMs: 0, release })) };
  const semantic = {
    establishCallHalf: jest.fn(async () => ({ outcome: 'COMMITTED' as const, delivery })),
    establishExchange: jest.fn(async () => delivery),
  };
  const safety = { settleEndedCallSafety: jest.fn(async (request: { storeSafety: (d: 'ALLOW' | 'GUIDED' | 'BLOCK') => Promise<void> }) => request.storeSafety('GUIDED')) };
  const w = new CallAnalysisWorker({ store, semantic, permits, safety, start: 'AFTER_FIRST_AUDIO', observe: (o) => observations.push(o), ...overrides });
  return { w, observations, permits, semantic, safety, release };
}

describe('S8B-05 CP3: the durable ordered analysis worker', () => {
  it('drains the order head first: pre-call exchanges, then each half; a half settles RELEASE after its commit, an exchange COMPLETE', async () => {
    const store = fakeStore([claimed('EXCHANGE', 0, 'p1', 'ap1'), claimed('USER', 1, 'u1'), claimed('ASSISTANT', 1, 'a1')]);
    const { w, semantic, permits, release } = worker(store);
    (w as unknown as { stopped: boolean }).stopped = false;
    await w.drain(SESSION);
    expect(semantic.establishExchange).toHaveBeenCalledWith(USER, expect.objectContaining({ id: 'p1' }), expect.objectContaining({ id: 'ap1' }), { backgroundPermitHeld: true });
    expect(semantic.establishCallHalf.mock.calls.map((c) => [(c as unknown[])[1], ((c as unknown[])[2] as ConversationTurn).status])).toEqual([
      [{ callId: CALL, callTurnIndex: 1, half: 'USER' }, 'GENERATING'],
      [{ callId: CALL, callTurnIndex: 1, half: 'ASSISTANT' }, 'COMPLETED'],
    ]);
    expect(store.settled.map((s) => [s.half, s.outcome])).toEqual([['EXCHANGE', 'COMPLETE'], ['USER', 'RELEASE'], ['ASSISTANT', 'RELEASE']]);
    expect(permits.acquire).toHaveBeenCalledWith(USER, 'CALL_ANALYSIS', expect.objectContaining({ respectCriticalWindow: true, maxWaitMs: 15_000 }));
    expect(release).toHaveBeenCalledTimes(3);
  });

  it('M1′ (AT_COMMIT) does not respect the critical window; M1 is the default and AT_COMMIT only when set', async () => {
    const store = fakeStore([claimed('USER', 1, 'u1')]);
    const { w, permits } = worker(store, { start: 'AT_COMMIT' });
    (w as unknown as { stopped: boolean }).stopped = false;
    await w.drain(SESSION);
    expect(permits.acquire).toHaveBeenCalledWith(USER, 'CALL_ANALYSIS', expect.objectContaining({ respectCriticalWindow: false, maxWaitMs: 15_000 }));
    expect(callAnalysisStart({})).toBe('AFTER_FIRST_AUDIO');
    expect(callAnalysisStart({ LIVE_CALL_ANALYSIS_START: 'AT_COMMIT' })).toBe('AT_COMMIT');
    expect(callAnalysisStart({ LIVE_CALL_ANALYSIS_START: 'at_commit' })).toBe('AFTER_FIRST_AUDIO');
  });

  it('never skips: a provider outage is a counted retry, an integrity failure is reported, an ordering refusal is released uncounted', async () => {
    const store = fakeStore([claimed('USER', 1, 'u1'), claimed('USER', 1, 'u1'), claimed('USER', 1, 'u1'), claimed('USER', 1, 'u1')]);
    const { w, semantic } = worker(store);
    semantic.establishCallHalf
      .mockRejectedValueOnce(new ConversationSemanticUnavailableError('PROVIDER_UNAVAILABLE'))
      .mockRejectedValueOnce(new ConversationSemanticIntegrityError('INVALID_CALL_HALF_RELATION'))
      .mockRejectedValueOnce(new CallHalfOrderError('OUT_OF_ORDER'))
      .mockRejectedValueOnce(new Error('socket hang up'));
    (w as unknown as { stopped: boolean }).stopped = false;
    await w.drain(SESSION);
    expect(store.settled.map((s) => [s.outcome, s.failureCode])).toEqual([
      ['PROVIDER_FAILURE', 'PROVIDER_UNAVAILABLE'],
      ['INTEGRITY_FAILURE', 'INVALID_CALL_HALF_RELATION'],
      ['RELEASE', null],
      ['PROVIDER_FAILURE', 'TRANSPORT_UNAVAILABLE'],
    ]);
  });

  it('no permit within the bound: released uncounted, nothing read, nothing established', async () => {
    const store = fakeStore([claimed('USER', 1, 'u1')]);
    const { w, semantic } = worker(store, { permits: { acquire: jest.fn(async () => null) } });
    (w as unknown as { stopped: boolean }).stopped = false;
    await w.drain(SESSION);
    expect(store.settled).toEqual([{ half: 'USER', outcome: 'RELEASE', failureCode: null }]);
    expect(store.readTurns).not.toHaveBeenCalled();
    expect(semantic.establishCallHalf).not.toHaveBeenCalled();
    await w.stop();
  });

  it('a missing turn is an integrity failure; WAITING and BUSY end the drain without a claim being lost', async () => {
    const store = fakeStore([claimed('USER', 1, 'u1'), { outcome: 'WAITING', nextAttemptAt: new Date(Date.now() + 60_000).toISOString() }]);
    (store.readTurns as jest.Mock).mockResolvedValueOnce([]);
    const { w } = worker(store);
    (w as unknown as { stopped: boolean }).stopped = false;
    await w.drain(SESSION);
    expect(store.settled).toEqual([{ half: 'USER', outcome: 'INTEGRITY_FAILURE', failureCode: 'CALL_ANALYSIS_TURN_MISSING' }]);
    expect(store.claim).toHaveBeenCalledTimes(2);
    await w.stop();
  });

  it('S3: an ended call\'s exchange without Safety is judged by the same gate over the 0191 reader, stored once, then closed', async () => {
    const open: UnsettledCallExchange = { userId: USER, sessionId: SESSION, callId: CALL, callTurnIndex: 3, userTurnId: 'u3', content: 'x', safetyDisposition: null };
    const store = fakeStore([], [open]);
    const { w, safety, observations } = worker(store);
    await w.sweep();
    expect(safety.settleEndedCallSafety).toHaveBeenCalledTimes(1);
    const [request] = safety.settleEndedCallSafety.mock.calls[0] as unknown as [{ readContext: () => Promise<unknown> }];
    await request.readContext();
    expect(store.readCallContext).toHaveBeenCalledWith(USER, SESSION, CALL, 16);
    expect(store.stored).toEqual(['GUIDED']);
    expect(store.closes).toBe(1);
    expect(observations.filter((o) => o.kind === 'S3')).toEqual([expect.objectContaining({ result: 'CLOSED', callTurnIndex: 3 })]);
  });

  it('S3: a context that cannot be read leaves the exchange OPEN - no default disposition, no close', async () => {
    const open: UnsettledCallExchange = { userId: USER, sessionId: SESSION, callId: CALL, callTurnIndex: 3, userTurnId: 'u3', content: 'x', safetyDisposition: null };
    const store = fakeStore([], [open]);
    const { w, observations } = worker(store, { safety: { settleEndedCallSafety: jest.fn(async () => { throw new Error('CALL_CONTEXT_UNAVAILABLE'); }) } });
    await w.sweep();
    expect(store.stored).toEqual([]);
    expect(store.closes).toBe(0);
    expect(observations.filter((o) => o.kind === 'S3')).toEqual([expect.objectContaining({ result: 'LEFT_OPEN' })]);
  });

  it('S3: an exchange whose Safety is already stored is closed without recomputing it', async () => {
    const open: UnsettledCallExchange = { userId: USER, sessionId: SESSION, callId: CALL, callTurnIndex: 2, userTurnId: 'u2', content: 'x', safetyDisposition: 'ALLOW' };
    const store = fakeStore([], [open]);
    const { w, safety } = worker(store);
    await w.sweep();
    expect(safety.settleEndedCallSafety).not.toHaveBeenCalled();
    expect(store.closes).toBe(1);
  });

  it('a permit wait in L2\'s window is woken by the reply\'s first audio, not slept past', async () => {
    const store = fakeStore([claimed('USER', 1, 'u1')]);
    let woken = false;
    let resolveSeen: () => void = () => undefined;
    const seen = new Promise<void>((r) => { resolveSeen = r; });
    const permits: BackgroundPermitGate = {
      acquire: jest.fn(async (_u, _k, request) => {
        const wake = request.wake!();
        resolveSeen();
        await wake;
        woken = true;
        return { waitedMs: 1, release: async () => undefined };
      }),
    };
    const { w } = worker(store, { permits });
    (w as unknown as { stopped: boolean }).stopped = false;
    const drain = w.drain(SESSION);
    await seen;
    expect(woken).toBe(false);
    w.kick(SESSION, 'TURN_COMMITTED');
    await new Promise((resolve) => setImmediate(resolve));
    expect(woken).toBe(false);
    w.kick(SESSION, 'FIRST_AUDIO');
    await drain;
    expect(woken).toBe(true);
    await w.stop();
  });

  it('the permit goes back when the provider work ends, before the settlement; a closed exchange wakes capacity waits', async () => {
    const store = fakeStore([claimed('USER', 1, 'u1')]);
    const order: string[] = [];
    const permits: BackgroundPermitGate = {
      acquire: jest.fn(async () => ({ waitedMs: 0, release: async () => { order.push('release'); } })),
      capacityMayHaveChanged: jest.fn(),
    };
    const settle = store.settle;
    store.settle = jest.fn(async (input) => { order.push('settle'); return settle(input); });
    const { w } = worker(store, { permits });
    (w as unknown as { stopped: boolean }).stopped = false;
    await w.drain(SESSION);
    expect(order).toEqual(['release', 'settle']);
    w.kick(SESSION, 'FIRST_AUDIO');
    expect(permits.capacityMayHaveChanged).not.toHaveBeenCalled();
    w.kick(SESSION, 'EXCHANGE_CLOSED');
    expect(permits.capacityMayHaveChanged).toHaveBeenCalledTimes(1);
    await w.stop();
  });

  it('a kick is in memory and runs nothing once stopped', async () => {
    const store = fakeStore([claimed('USER', 1, 'u1')]);
    const { w } = worker(store);
    w.kick(SESSION, 'TURN_COMMITTED');
    await new Promise((resolve) => setImmediate(resolve));
    expect(store.claim).not.toHaveBeenCalled();
  });
});
