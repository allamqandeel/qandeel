// S8B-05 CP3 - the Durable Ordered Analysis Worker (contract v1.2 Part A, A3.3; A1 §1 - §3; migration 0191).
//
// Live Analysis runs DURING the call: each numbered call turn is established one half at a time - the USER half as soon
// as it is committed (while its reply is still generating), the reply's half when its exchange closes - in the session's
// analysis order, which migration 0191 owns:
//
//   - one active worker per session across every instance: 0191's claim takes the session's semantic lease (an analysis
//     lock separate from 0131's work lease) and the head item's lease; a crashed worker's leases lapse and the item is
//     claimed again; a half that was committed before the crash is REPLAYED from storage with zero provider calls;
//   - FIFO by the call's turn order (call_turn_index, never a timestamp); the session's unestablished pre-call exchanges
//     first (O3b / B1);
//   - B2 / L4: an item is never skipped or dropped - a provider outage, a 429 or a stale context is a retry with backoff
//     (L5: three attempts, then PARKED and retried later within the daily budget); only an integrity failure confirmed
//     twice abandons the item, with its reply (B3);
//   - one shared background permit per item, asked before its context is read (A1 §3); L2: in the default mode the
//     permit waits while this person's reply is generating with nothing heard yet (M1), and in AT_COMMIT mode it does
//     not (M1′). The mode is configuration, measured by the CP3 synthetic proof, never changed silently.
//
// S3 after the call ended (A3.1, R5′): an exchange of an ENDED call whose Safety was never stored stays OPEN (0191 closes
// with the END only an exchange whose Safety is stored). The sweep recomputes that Safety with the SAME gate over the SAME
// context reader, stores it once, then closes the exchange (CALL_ENDING), which queues the reply's half and writes the
// turn's one completion event. A context that cannot be read leaves it for the next scan: never a default ALLOW / BLOCK.
//
// Nothing here logs. Observations carry identifiers, instants and counts, never words.

import { randomUUID } from 'node:crypto';
import type { ConversationTurn } from '../conversation/conversation.types';
import { CALL_CONTEXT_POLICY } from '../conversation/live-call-reply.service';
import { establishmentIntegrityReason, type ConversationSemanticEstablishmentService } from '../live-focus/conversation-semantic-establishment.service';
import { CallHalfOrderError, ConversationSemanticUnavailableError } from '../live-focus/conversation-semantic-runtime.types';
import type { LiveCallAnalysisKick, LiveCallAnalysisListener } from '../voice/call-turn/live-call-analysis.signal';
import type { BackgroundPermitGate } from './background-permits';
import type { CallAnalysisClaim, CallAnalysisHalf, CallAnalysisSettleOutcome, CallAnalysisStore } from './call-analysis.repository';

/** L2 as configuration (A1 §3): M1 starts an item's provider work after the reply's first audio, M1′ at the commit. */
export type CallAnalysisStart = 'AFTER_FIRST_AUDIO' | 'AT_COMMIT';
export const CALL_ANALYSIS_START_ENV = 'LIVE_CALL_ANALYSIS_START';
export function callAnalysisStart(environment: NodeJS.ProcessEnv = process.env): CallAnalysisStart {
  // The contract's default is L2's yield (M1). AT_COMMIT (M1′) only when set explicitly.
  return environment[CALL_ANALYSIS_START_ENV] === 'AT_COMMIT' ? 'AT_COMMIT' : 'AFTER_FIRST_AUDIO';
}

export const CALL_ANALYSIS_POLICY = Object.freeze({
  /** The scan that finds work no kick announced (a crashed worker's lapsed lease, a due retry, a call ended elsewhere). */
  scanIntervalMs: 2_000,
  scanLimit: 50,
  /** Items one drain takes before it yields to the scan (the queue is never skipped; this only bounds one loop). */
  maxItemsPerDrain: 64,
  /** The longest an item waits for its permit (longer than L2's critical window) before it is released, uncounted. */
  permitWaitMs: 15_000,
  /** A BUSY session (another worker or a post-response execution holds its lease) is asked again after this. */
  busyRetryMs: 250,
  /** The latest a WAITING item's own timer is set (the scan covers anything later). */
  maxTimerMs: 30_000,
  sweepLimit: 20,
});

/** What the worker observed, for measurement only (no words, no content). */
export type CallAnalysisObservation =
  | { readonly kind: 'KICK'; readonly sessionId: string; readonly reason: LiveCallAnalysisKick | 'SCAN'; readonly at: number }
  | { readonly kind: 'CLAIMED'; readonly sessionId: string; readonly callTurnIndex: number; readonly half: CallAnalysisHalf; readonly attempt: number; readonly at: number }
  | { readonly kind: 'PERMIT'; readonly sessionId: string; readonly callTurnIndex: number; readonly half: CallAnalysisHalf; readonly waitedMs: number; readonly granted: boolean; readonly at: number }
  | {
    readonly kind: 'ESTABLISHED'; readonly sessionId: string; readonly callTurnIndex: number; readonly half: CallAnalysisHalf;
    readonly outcome: 'COMMITTED' | 'REPLAYED'; readonly units: number; readonly liveFocusTransitions: number; readonly at: number;
  }
  | {
    readonly kind: 'SETTLED'; readonly sessionId: string; readonly callTurnIndex: number; readonly half: CallAnalysisHalf;
    readonly outcome: CallAnalysisSettleOutcome; readonly failure: string | null; readonly queueState: string | null; readonly at: number;
  }
  | { readonly kind: 'S3'; readonly sessionId: string; readonly callTurnIndex: number; readonly result: 'CLOSED' | 'LEFT_OPEN'; readonly at: number };

/** S3's one gate after the call ended: the conversation's ONE fold and gate over the given reader (LiveCallReplyService). */
export interface EndedCallSafety {
  settleEndedCallSafety(request: {
    readonly content: string;
    readonly readContext: () => Promise<unknown>;
    readonly storeSafety: (disposition: 'ALLOW' | 'GUIDED' | 'BLOCK') => Promise<void>;
  }): Promise<void>;
}

export interface CallAnalysisWorkerDeps {
  readonly store: CallAnalysisStore;
  readonly semantic: Pick<ConversationSemanticEstablishmentService, 'establishCallHalf' | 'establishExchange'>;
  readonly permits: BackgroundPermitGate;
  readonly safety: EndedCallSafety;
  readonly start: CallAnalysisStart;
  readonly observe?: (observation: CallAnalysisObservation) => void;
  readonly now?: () => number;
}

/** A failure code the queue accepts (`^[A-Z][A-Z0-9_]{0,63}$`). */
const code = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9_]/gu, '_').replace(/^[^A-Z]+/u, '').slice(0, 64) || 'UNKNOWN_FAILURE';

export class CallAnalysisWorker implements LiveCallAnalysisListener {
  private readonly draining = new Set<string>();
  private readonly again = new Set<string>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly inFlight = new Set<Promise<void>>();
  /** Per session, the next kick that may end a permit wait early (the reply's first audio ends L2's window). */
  private readonly wakers = new Map<string, { readonly promise: Promise<void>; readonly resolve: () => void }>();
  private scanTimer: NodeJS.Timeout | null = null;
  private scanning = false;
  private stopped = true;
  private readonly now: () => number;

  constructor(private readonly deps: CallAnalysisWorkerDeps) {
    this.now = deps.now ?? Date.now;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.scanTimer = setInterval(() => this.track(this.scan()), CALL_ANALYSIS_POLICY.scanIntervalMs);
    this.scanTimer.unref?.();
    this.track(this.scan());
  }

  /** Stops scanning and kicking, and waits for the drains in flight (their items are settled or lapse; nothing is lost). */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.scanTimer) clearInterval(this.scanTimer);
    this.scanTimer = null;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    for (const sessionId of [...this.wakers.keys()]) this.wake(sessionId);
    await Promise.allSettled([...this.inFlight]);
  }

  /** The voice path's kick: in memory, never awaited by it. */
  kick(sessionId: string, reason: LiveCallAnalysisKick | 'SCAN' = 'SCAN'): void {
    if (this.stopped) return;
    this.deps.observe?.({ kind: 'KICK', sessionId, reason, at: this.now() });
    // A drain waiting for its permit in L2's window asks again now rather than after its backoff step.
    if (reason === 'FIRST_AUDIO' || reason === 'EXCHANGE_CLOSED') this.wake(sessionId);
    setImmediate(() => this.track(this.drain(sessionId)));
  }

  private wake(sessionId: string): void {
    const waker = this.wakers.get(sessionId);
    this.wakers.delete(sessionId);
    waker?.resolve();
  }

  private nextWake(sessionId: string): Promise<void> {
    let waker = this.wakers.get(sessionId);
    if (!waker) {
      let resolve: () => void = () => undefined;
      const promise = new Promise<void>((r) => { resolve = r; });
      waker = { promise, resolve };
      this.wakers.set(sessionId, waker);
    }
    return waker.promise;
  }

  /** One scan: S3 for ended calls, then every session with work that may run now. Exported for the proofs. */
  async scan(): Promise<void> {
    if (this.scanning || this.stopped) return;
    this.scanning = true;
    try {
      await this.sweep();
      const sessions = await this.deps.store.listSessions(CALL_ANALYSIS_POLICY.scanLimit);
      for (const { sessionId } of sessions) this.kick(sessionId, 'SCAN');
    } catch {
      // The next scan tries again; nothing was claimed by a failed listing.
    } finally {
      this.scanning = false;
    }
  }

  /** Drains one session's analysis order, head first, until it is idle, waiting or held elsewhere. */
  async drain(sessionId: string): Promise<void> {
    if (this.stopped) return;
    if (this.draining.has(sessionId)) {
      this.again.add(sessionId);
      return;
    }
    this.draining.add(sessionId);
    try {
      for (let taken = 0; taken < CALL_ANALYSIS_POLICY.maxItemsPerDrain && !this.stopped; taken += 1) {
        const token = randomUUID();
        const claim = await this.deps.store.claim(sessionId, token);
        if (claim.outcome === 'CLAIMED') {
          await this.process(sessionId, claim, token);
          continue;
        }
        if (claim.outcome === 'BUSY') this.later(sessionId, CALL_ANALYSIS_POLICY.busyRetryMs);
        if (claim.outcome === 'WAITING' || claim.outcome === 'BUDGET_EXHAUSTED') this.laterAt(sessionId, claim.nextAttemptAt);
        break;
      }
    } catch {
      // A claim or settlement that failed in transport: the item's lease lapses and the scan claims it again.
    } finally {
      this.draining.delete(sessionId);
      this.wake(sessionId);
      if (this.again.delete(sessionId)) this.kick(sessionId, 'SCAN');
    }
  }

  private async process(sessionId: string, claim: Extract<CallAnalysisClaim, { outcome: 'CLAIMED' }>, token: string): Promise<void> {
    const item = { sessionId, callId: claim.callId, callTurnIndex: claim.callTurnIndex, half: claim.half, claimToken: token };
    this.deps.observe?.({ kind: 'CLAIMED', sessionId, callTurnIndex: claim.callTurnIndex, half: claim.half, attempt: claim.attemptCount, at: this.now() });
    const settle = async (outcome: CallAnalysisSettleOutcome, failure: string | null): Promise<void> => {
      const settled = await this.deps.store.settle({ ...item, outcome, failureCode: failure });
      this.deps.observe?.({
        kind: 'SETTLED', sessionId, callTurnIndex: claim.callTurnIndex, half: claim.half, outcome, failure, queueState: settled.queueState, at: this.now(),
      });
    };

    // A1 §3: ONE permit for this item, before its context is read. L2 (M1): it waits while the reply is generating with
    // nothing heard yet. Not granted in time: released uncounted (RELEASE refunds the attempt) and asked again later.
    const permit = await this.deps.permits.acquire(claim.userId, 'CALL_ANALYSIS', {
      respectCriticalWindow: this.deps.start === 'AFTER_FIRST_AUDIO',
      maxWaitMs: CALL_ANALYSIS_POLICY.permitWaitMs,
      wake: () => this.nextWake(sessionId),
    });
    this.deps.observe?.({
      kind: 'PERMIT', sessionId, callTurnIndex: claim.callTurnIndex, half: claim.half, waitedMs: permit?.waitedMs ?? CALL_ANALYSIS_POLICY.permitWaitMs, granted: permit !== null, at: this.now(),
    });
    if (!permit) {
      await settle('RELEASE', null);
      this.later(sessionId, CALL_ANALYSIS_POLICY.busyRetryMs);
      return;
    }
    try {
      const failure = await this.establish(sessionId, claim);
      if (failure === null) {
        // An EXCHANGE item is settled COMPLETE by the worker (the full coordinator does not know the queue); a half was
        // settled COMPLETE by its own commit, so this only returns the session lease (ALREADY_SETTLED).
        await settle(claim.half === 'EXCHANGE' ? 'COMPLETE' : 'RELEASE', null);
      } else {
        await settle(failure.outcome, failure.code);
      }
    } finally {
      await permit.release();
    }
  }

  /** Establishes the claimed item; null when it is established (now or already), else how to settle it. */
  private async establish(
    sessionId: string,
    claim: Extract<CallAnalysisClaim, { outcome: 'CLAIMED' }>,
  ): Promise<{ readonly outcome: Exclude<CallAnalysisSettleOutcome, 'COMPLETE'>; readonly code: string | null } | null> {
    try {
      const ids = claim.half === 'EXCHANGE' && claim.assistantTurnId ? [claim.turnId, claim.assistantTurnId] : [claim.turnId];
      const turns = await this.deps.store.readTurns(claim.userId, sessionId, ids);
      const byId = (id: string | null): ConversationTurn | undefined => turns.find((turn) => turn.id === id);
      const turn = byId(claim.turnId);
      if (!turn) return { outcome: 'INTEGRITY_FAILURE', code: 'CALL_ANALYSIS_TURN_MISSING' };
      if (claim.half === 'EXCHANGE') {
        const reply = byId(claim.assistantTurnId);
        if (!reply) return { outcome: 'INTEGRITY_FAILURE', code: 'CALL_ANALYSIS_TURN_MISSING' };
        // The full path returns its delivery without a replay flag, so an EXCHANGE item is observed as COMMITTED even when
        // it was replayed from storage (the CP3 proof measures that replay by its provider calls: zero).
        const delivery = await this.deps.semantic.establishExchange(claim.userId, turn, reply, { backgroundPermitHeld: true });
        this.established(sessionId, claim, 'COMMITTED', delivery.committedEvents.reduce((n, e) => n + e.unitCount, 0), delivery.liveFocusTransitions.length);
        return null;
      }
      const result = await this.deps.semantic.establishCallHalf(claim.userId, { callId: claim.callId, callTurnIndex: claim.callTurnIndex, half: claim.half }, turn);
      this.established(sessionId, claim, result.outcome, result.delivery.committedEvents.reduce((n, e) => n + e.unitCount, 0), result.delivery.liveFocusTransitions.length);
      return null;
    } catch (error) {
      // The analysis order refused it (an earlier item is open, or its exchange was abandoned): released uncounted.
      if (error instanceof CallHalfOrderError) return { outcome: 'RELEASE', code: null };
      const integrity = establishmentIntegrityReason(error);
      if (integrity !== null) return { outcome: 'INTEGRITY_FAILURE', code: code(integrity) };
      // A provider outage or rejection, a 429, a stale context twice, a transport failure: a counted retry (L5).
      if (error instanceof ConversationSemanticUnavailableError) return { outcome: 'PROVIDER_FAILURE', code: code(error.reason) };
      return { outcome: 'PROVIDER_FAILURE', code: 'TRANSPORT_UNAVAILABLE' };
    }
  }

  private established(sessionId: string, claim: Extract<CallAnalysisClaim, { outcome: 'CLAIMED' }>, outcome: 'COMMITTED' | 'REPLAYED', units: number, transitions: number): void {
    this.deps.observe?.({
      kind: 'ESTABLISHED', sessionId, callTurnIndex: claim.callTurnIndex, half: claim.half, outcome, units, liveFocusTransitions: transitions, at: this.now(),
    });
  }

  /** S3 after the end (A3.1): the same gate over the same reader, stored once, then the ONE close. */
  async sweep(): Promise<void> {
    const open = await this.deps.store.listUnsettledExchanges(CALL_ANALYSIS_POLICY.sweepLimit);
    for (const exchange of open) {
      try {
        if (exchange.safetyDisposition === null) {
          await this.deps.safety.settleEndedCallSafety({
            content: exchange.content,
            readContext: () => this.deps.store.readCallContext(exchange.userId, exchange.sessionId, exchange.callId, CALL_CONTEXT_POLICY.readLimit),
            storeSafety: async (disposition) => {
              const stored = await this.deps.store.storeSafety(exchange.userId, exchange.callId, exchange.callTurnIndex, disposition);
              if (stored !== 'STORED' && stored !== 'SAME') throw new Error('CALL_SAFETY_NOT_STORED');
            },
          });
        }
        const closed = await this.deps.store.closeEndedExchange(exchange.userId, exchange.callId, exchange.callTurnIndex, randomUUID(), randomUUID());
        const done = closed === 'CLOSED' || closed === 'ALREADY_CLOSED';
        this.deps.observe?.({ kind: 'S3', sessionId: exchange.sessionId, callTurnIndex: exchange.callTurnIndex, result: done ? 'CLOSED' : 'LEFT_OPEN', at: this.now() });
        if (done) this.kick(exchange.sessionId, 'EXCHANGE_CLOSED');
      } catch {
        // The context could not be read or the store refused: left OPEN for the next scan, never a default disposition.
        this.deps.observe?.({ kind: 'S3', sessionId: exchange.sessionId, callTurnIndex: exchange.callTurnIndex, result: 'LEFT_OPEN', at: this.now() });
      }
    }
  }

  private later(sessionId: string, ms: number): void {
    if (this.stopped || this.timers.has(sessionId)) return;
    const timer = setTimeout(() => {
      this.timers.delete(sessionId);
      this.kick(sessionId, 'SCAN');
    }, Math.max(1, Math.min(ms, CALL_ANALYSIS_POLICY.maxTimerMs)));
    timer.unref?.();
    this.timers.set(sessionId, timer);
  }

  private laterAt(sessionId: string, at: string | null): void {
    const due = at === null ? Number.NaN : Date.parse(at);
    this.later(sessionId, Number.isFinite(due) ? due - Date.now() : CALL_ANALYSIS_POLICY.scanIntervalMs);
  }

  private track(work: Promise<void>): void {
    this.inFlight.add(work);
    void work.finally(() => this.inFlight.delete(work));
  }
}
