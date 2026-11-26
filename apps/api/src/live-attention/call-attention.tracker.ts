// INTEL-LIVE-01 CP1 — the call's provisional attention tracker: evidence coverage and order, never meaning (A1 §1, §2).
//
// One tracker per call connection (the call turn session's). It receives evidence — each FINAL segment of the person's
// speech, each whole piece of QANDEEL's speech once heard — and keeps it in a per-track ledger in memory. The admission
// loop has no threshold:
//
//   on evidence            → append; if no evaluation is in flight → admit now
//   on evaluation resolved → write its coverage (0204's one writer, atomic); if evidence is pending → admit now
//   admit                  → the span is ALL the pending evidence of one track since its covered position (a span longer
//                            than the context bound is admitted as consecutive whole sub-spans, A2 §3), with a
//                            PROVISIONAL_ATTENTION permit (no wait, skipped in L2's critical window) or DEFERRED_PERMIT
//
// One evaluation in flight per call. DeepSeek decides what is a development; the tracker never filters, keeps no keyword,
// no time and no word count as a prerequisite. The covered position moves only after the writer committed: a success
// (DEVELOPMENTS / NONE) covers its span; TIMEOUT / REFUSED / PROVIDER_FAILED / DEFERRED_PERMIT leave it pending (after two
// consecutive failures the next admission waits the backoff); MISSED_HANDOVER / DEGRADED_SUSPENDED account for it as an
// explicit miss. Nothing here is on the voice path: `evidence()` is synchronous and in memory; every provider and database
// call is background work, and nothing awaits it on the way to QANDEEL's voice.
//
// Nothing is logged: no text, no label, no identifier. Observations carry instants and counts only.
//
// INTEL-LIVE-01 CP2 (D-3, protocol v3): the tracker also tells the phone what the database committed, and nothing else —
// each written event the moment its write committed (ATTENTION), and the call's open attention from ONE read of the
// database (ATTENTION_STATE) when it starts on a connection, when a settlement of this call was signalled on this instance,
// while a committed turn's settlement is awaited (a bounded watch, for a settlement written on another instance), and after
// a frame the connection had to drop. A state older than an event already sent is never sent (it is read again), so the
// phone, which applies only seq above its snapshot's, can never lose an event to a snapshot. Disclosure never changes what
// the tracker evaluates, and nothing of it is awaited by the voice path.

import type { BackgroundPermit, BackgroundPermitGate } from '../live-analysis/background-permits';
import type { LiveCallAttentionDelivery, LiveCallAttentionDisclosure } from '../voice/call-turn/live-call-attention.port';
import type { AttentionEventInput, AttentionRecordResult, AttentionTrackState, CallAttentionStore } from './call-attention.repository';
import {
  DEFAULT_PROVISIONAL_ATTENTION_CONFIG, estimatedSpendUsd, type AttentionEvaluationInput, type AttentionEvaluationResult,
  type AttentionEvaluator, type AttentionObservation, type AttentionThread, type AttentionTrack, type EvidenceUnit,
  type OpenSubject, type ProvisionalAttentionConfig, type RecordedOutcome,
} from './provisional-attention.types';

export interface CallAttentionTrackerDeps {
  readonly userId: string;
  readonly callId: string;
  readonly epoch: number;
  readonly evaluator: AttentionEvaluator;
  readonly store: CallAttentionStore;
  readonly permits: BackgroundPermitGate;
  /** The capture position the server has ingested (the connection's latest capture instant on the call clock). */
  readonly captureClock: () => number;
  readonly now?: () => number;
  readonly config?: Partial<ProvisionalAttentionConfig>;
  readonly observe?: (observation: AttentionObservation) => void;
  readonly signal?: (op: string, outcome: string) => void;
  readonly timers?: { readonly set: (fn: () => void, ms: number) => unknown; readonly clear: (handle: unknown) => void };
  /** INTEL-LIVE-01 CP2: towards the phone (protocol v3); absent where nothing listens. */
  readonly disclose?: (disclosure: LiveCallAttentionDisclosure) => LiveCallAttentionDelivery;
}

/**
 * INTEL-LIVE-01 CP2: when the database's attention is told to the phone again. None of these delays an event: an event is
 * sent the moment its write committed. They bound only the re-reads that carry what no event carries (a settlement).
 */
export const ATTENTION_DISCLOSURE_POLICY = Object.freeze({
  /** After a frame the connection dropped (audio first), the state is read and sent again this much later. */
  resendAfterDropMs: 1_000,
  /** While the phone holds open subjects after a commit, the state is read this often (a settlement on another instance). */
  settlementWatchEveryMs: 5_000,
  /** ... for at most this long after the latest commit. */
  settlementWatchForMs: 120_000,
});

interface TrackLedger {
  readonly track: AttentionTrack;
  /** Evidence not yet covered, in order. */
  pending: EvidenceUnit[];
  /** The position the next span starts at: the writer's accounted position, or past a recorded late refusal. */
  coveredTo: number;
  /** The evaluated words of this track, the newest last (the context window's source). */
  window: string[];
  /** Whether evaluated words have already left the window. */
  overflowed: boolean;
  contextCarry: string | null;
  readonly open: Map<string, OpenSubject>;
  failures: number;
  backoffUntil: number;
}

type Stop = 'FENCED' | 'NOT_FOUND' | 'CALL_ENDED' | 'CLOSED' | 'HANDOVER';

const wordsOf = (text: string): string[] => text.trim().split(/\s+/u).filter((w) => w !== '');

/**
 * PO directive "Semantic Freedom & Targeted Cross-Platform Validation" (2026-11-25) §2, actual mechanical duplication: a
 * SET naming an open subject exactly as it is already open (the same key, label, kind, confidence and Thread) changes
 * nothing, so it is not a development and is not written; an answer left with none is a NONE. It compares the answer with
 * the ledger field by field and judges no meaning: a WITHDRAW and a SET that changes anything always stand.
 */
export function withoutRepeatedSets(open: ReadonlyMap<string, OpenSubject>, result: AttentionEvaluationResult): AttentionEvaluationResult {
  if (result.kind !== 'DEVELOPMENTS') return result;
  const now = new Map(open);
  const kept = result.developments.filter((d) => {
    const was = now.get(d.subjectKey);
    if (d.op === 'WITHDRAW') {
      now.delete(d.subjectKey);
      return true;
    }
    if (was && was.label === d.label && was.kind === d.kind && was.confidence === d.confidence && was.threadRef === d.threadRef) return false;
    now.set(d.subjectKey, { subjectKey: d.subjectKey, label: d.label, kind: d.kind, confidence: d.confidence, threadRef: d.threadRef });
    return true;
  });
  if (kept.length === result.developments.length) return result;
  return { ...result, kind: kept.length > 0 ? 'DEVELOPMENTS' : 'NONE', developments: kept };
}

export class CallAttentionTracker {
  private readonly config: ProvisionalAttentionConfig;
  private readonly now: () => number;
  private readonly timers: NonNullable<CallAttentionTrackerDeps['timers']>;
  private readonly tracks: Record<AttentionTrack, TrackLedger>;
  private threads: readonly AttentionThread[] = [];
  private seq = 0;
  private evalOrdinal = 0;
  private ready = false;
  private starting: Promise<void> | null = null;
  private inFlight: { readonly controller: AbortController; readonly track: AttentionTrack } | null = null;
  private writing: Promise<unknown> = Promise.resolve();
  private retry: unknown = null;
  private stopped: Stop | null = null;
  private degraded: 'EMERGENCY_SPEND' | 'PROVIDER_OVERLOADED' | null = null;
  private spendUsd = 0;
  private overloadedInARow = 0;
  /** CP2: the highest event_seq the phone was told on this connection (by an event or a state). */
  private sentSeq = 0;
  /** CP2: the subjects open in what the phone was told (`track:subjectKey`). */
  private readonly phoneOpen = new Set<string>();
  private rereading = false;
  private rereadAgain = false;
  private rereadTimer: unknown = null;
  private watchTimer: unknown = null;
  private watchUntil = 0;

  constructor(private readonly deps: CallAttentionTrackerDeps) {
    this.config = { ...DEFAULT_PROVISIONAL_ATTENTION_CONFIG, ...(deps.config ?? {}) };
    this.now = deps.now ?? Date.now;
    this.timers = deps.timers ?? {
      set: (fn, ms) => { const t = setTimeout(fn, ms); t.unref?.(); return t; },
      clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
    const ledger = (track: AttentionTrack): TrackLedger => ({
      track, pending: [], coveredTo: 0, window: [], overflowed: false, contextCarry: null, open: new Map(), failures: 0, backoffUntil: 0,
    });
    this.tracks = { USER: ledger('USER'), QANDEEL: ledger('QANDEEL') };
  }

  /** Reads where the call's attention stands (a resumed or moved connection continues from it) and the person's Threads. */
  start(): Promise<void> {
    this.starting ??= this.load();
    return this.starting;
  }

  /**
   * Evidence: one FINAL segment (USER) or one whole heard reply piece (QANDEEL), on the call clock. Synchronous and in
   * memory; never awaited by the voice path.
   */
  evidence(track: AttentionTrack, text: string, clockStartMs: number, clockEndMs: number): void {
    if (this.stopped || text.trim() === '' || !(clockEndMs > clockStartMs) || clockStartMs < 0) return;
    // Evidence the call's attention already accounts for (a resumed connection re-hearing it) is never sent again.
    if (clockEndMs <= this.tracks[track].coveredTo) return;
    const arrivedClockMs = Math.max(this.deps.captureClock(), clockEndMs);
    this.seq += 1;
    this.tracks[track].pending.push({ seq: this.seq, track, text: text.trim(), clockStartMs, clockEndMs, arrivedClockMs });
    this.observe({ kind: 'ATTENTION_EVIDENCE', track, clockStartMs, clockEndMs, at: this.now() });
    this.kick();
  }

  /** A turn was committed: the Threads it may have bound are re-read; a degraded lane accounts for what it did not evaluate. */
  turnCommitted(): void {
    if (this.stopped || !this.ready) return;
    void this.refreshThreads();
    if (this.degraded) void this.flushDegraded();
    // CP2: the turn's settlement will close what the phone shows of it; on this instance it is signalled (`settled`).
    this.watchUntil = this.now() + ATTENTION_DISCLOSURE_POLICY.settlementWatchForMs;
    this.armWatch();
  }

  /** CP2: a half of this call was settled on this instance: the phone is told the database's attention again. */
  settled(): void {
    this.reread();
  }

  /**
   * The connection is going while it still holds the call (its hand-over flush, under its own epoch): the evaluation in
   * flight is abandoned (a late result would be fenced) and every span not covered is recorded MISSED_HANDOVER.
   */
  async handover(): Promise<void> {
    if (this.stopped) return;
    this.stop('HANDOVER');
    await this.writing.catch(() => undefined);
    await this.recordMisses('MISSED_HANDOVER');
  }

  /** The connection closed (the call ended or the connection went without a flush): nothing more is admitted. */
  async close(): Promise<void> {
    if (this.stopped) return;
    const degraded = this.degraded !== null;
    this.stop('CLOSED');
    if (degraded) {
      await this.writing.catch(() => undefined);
      await this.recordMisses('DEGRADED_SUSPENDED');
    }
  }

  /** Counts only, for proofs and tests: what is open and covered per track, what is pending. Never a word. */
  snapshot(): {
    readonly ready: boolean; readonly stopped: Stop | null; readonly degraded: string | null; readonly inFlight: boolean; readonly spendUsd: number;
    readonly tracks: Record<AttentionTrack, { readonly coveredTo: number; readonly pending: number; readonly open: readonly string[]; readonly carry: boolean }>;
  } {
    const t = (l: TrackLedger) => ({ coveredTo: l.coveredTo, pending: l.pending.length, open: [...l.open.keys()], carry: l.contextCarry !== null });
    return {
      ready: this.ready, stopped: this.stopped, degraded: this.degraded, inFlight: this.inFlight !== null, spendUsd: this.spendUsd,
      tracks: { USER: t(this.tracks.USER), QANDEEL: t(this.tracks.QANDEEL) },
    };
  }

  // ------------------------------------------------------------------ state
  private async load(): Promise<void> {
    for (let attempt = 0; !this.stopped; attempt += 1) {
      try {
        const state = await this.deps.store.readState(this.deps.userId, this.deps.callId);
        if (state.length === 0) {
          this.stop('NOT_FOUND');
          return;
        }
        if (state.some((s) => s.callEnded)) {
          this.stop('CALL_ENDED');
          return;
        }
        for (const s of state) this.adopt(s.track, s.accountedToClockMs, s.openSubjects);
        await this.refreshThreads();
        if (this.stopped) return;
        // CP2: the phone starts from the database (after STATE ACTIVE: the connection sent it before this read resolved).
        this.discloseState(state);
        this.ready = true;
        this.kick();
        return;
      } catch {
        this.deps.signal?.('attention', 'state_unavailable');
        await new Promise<void>((resolve) => this.timers.set(resolve, Math.min(this.config.backoffMs, this.config.permitRetryMs * 2 ** attempt)));
      }
    }
  }

  private async refreshThreads(): Promise<void> {
    try {
      this.threads = await this.deps.store.readThreads(this.deps.userId, this.deps.callId, this.config.maxThreads);
    } catch {
      // The previous list stands; a Thread reference is still checked against the person's own Threads by the writer.
      this.deps.signal?.('attention', 'threads_unavailable');
    }
  }

  /** The database's position and open subjects for a track; evidence it already accounts for is dropped. */
  private adopt(track: AttentionTrack, accountedToClockMs: number, open: readonly OpenSubject[] | null): void {
    const ledger = this.tracks[track];
    ledger.coveredTo = Math.max(ledger.coveredTo, accountedToClockMs);
    ledger.pending = ledger.pending.filter((u) => u.clockEndMs > ledger.coveredTo);
    if (open) {
      ledger.open.clear();
      for (const subject of open) ledger.open.set(subject.subjectKey, subject);
    }
  }

  // ------------------------------------------------------------------ the admission loop
  private kick(): void {
    if (this.stopped || !this.ready || this.inFlight || this.retry !== null) return;
    if (this.degraded) return; // a degraded lane evaluates nothing more; its spans are accounted at commit and at close
    const ledger = this.next();
    if (!ledger) return;
    const wait = ledger.backoffUntil - this.now();
    if (wait > 0) {
      this.observe({ kind: 'ATTENTION_DEFERRED', track: ledger.track, reason: 'BACKOFF', at: this.now() });
      this.later(wait);
      return;
    }
    void this.admit(ledger);
  }

  /** The track whose oldest pending evidence arrived first (one evaluation in flight per call, both tracks served in order). */
  private next(): TrackLedger | null {
    const candidates = [this.tracks.USER, this.tracks.QANDEEL].filter((l) => l.pending.length > 0);
    if (candidates.length === 0) return null;
    return candidates.reduce((a, b) => (a.pending[0]!.seq <= b.pending[0]!.seq ? a : b));
  }

  private later(ms: number): void {
    if (this.retry !== null || this.stopped) return;
    this.retry = this.timers.set(() => {
      this.retry = null;
      this.kick();
    }, Math.max(1, ms));
  }

  /** The span: all pending evidence, or — past the context bound — the longest whole prefix of it (at least one unit). */
  private span(ledger: TrackLedger): { readonly units: readonly EvidenceUnit[]; readonly words: number; readonly subSpan: boolean } {
    const units: EvidenceUnit[] = [];
    let words = 0;
    for (const unit of ledger.pending) {
      const n = wordsOf(unit.text).length;
      if (units.length > 0 && words + n > this.config.maxTurnTextWords) break;
      units.push(unit);
      words += n;
    }
    return { units, words, subSpan: units.length < ledger.pending.length };
  }

  private async admit(ledger: TrackLedger): Promise<void> {
    const controller = new AbortController();
    this.inFlight = { controller, track: ledger.track };
    let permit: BackgroundPermit | null = null;
    try {
      const { units, words, subSpan } = this.span(ledger);
      const from = ledger.coveredTo;
      const to = Math.max(units[units.length - 1]!.clockEndMs, from + 1);
      permit = await this.deps.permits.acquire(this.deps.userId, 'PROVISIONAL_ATTENTION', { respectCriticalWindow: true, maxWaitMs: 0 })
        .catch(() => null);
      if (this.stopped) return;
      if (!permit) {
        this.observe({ kind: 'ATTENTION_DEFERRED', track: ledger.track, reason: 'PERMIT', at: this.now() });
        await this.write(ledger, { from, to, outcome: 'DEFERRED_PERMIT', units, admitted: null, produced: null, result: null });
        this.later(this.config.permitRetryMs);
        return;
      }
      const input = this.input(ledger, units, words);
      const admitted = Math.max(this.deps.captureClock(), ...units.map((u) => u.arrivedClockMs));
      this.evalOrdinal += 1;
      const ordinal = this.evalOrdinal;
      this.observe({
        kind: 'ATTENTION_ADMITTED', track: ledger.track, evalOrdinal: ordinal, fromClockMs: from, toClockMs: to, units: units.length, words,
        subSpan, folded: input.foldedSubjects.length, carryRequired: input.carryRequired, admittedClockMs: admitted, at: this.now(),
      });
      // The port never throws by contract; an evaluator that does is a provider failure, never a stuck lane.
      let result: AttentionEvaluationResult;
      try {
        result = await this.deps.evaluator.evaluate(input, controller.signal);
      } catch {
        result = { kind: 'PROVIDER_FAILED', usage: null, providerMs: 0, overloaded: false };
      }
      if (this.stopped) return; // abandoned: its span is recorded as missed by the hand-over, or uncovered at the end
      const produced = Math.max(this.deps.captureClock(), admitted);
      if (result.usage) this.spendUsd += estimatedSpendUsd(result.usage);
      result = withoutRepeatedSets(ledger.open, result);
      await this.write(ledger, { from, to, outcome: result.kind, units, admitted, produced, result, ordinal, words });
    } finally {
      await permit?.release().catch(() => undefined);
      this.inFlight = null;
      this.kick();
    }
  }

  /** The admission input in the prompt's prefix-stable order (A1 §2.3), with the context bound of A2 §3. */
  private input(ledger: TrackLedger, units: readonly EvidenceUnit[], words: number): AttentionEvaluationInput {
    const prior = ledger.window;
    const carryRequired = ledger.overflowed || prior.length + words > this.config.maxTurnTextWords;
    // The open-subject state is never cut: past the fold threshold the oldest subjects travel folded, whole (A2 §3).
    const open = [...ledger.open.values()];
    const cut = Math.max(0, open.length - this.config.maxOpenSubjects);
    return {
      track: ledger.track,
      priorText: prior.join(' '),
      carryRequired,
      contextCarry: ledger.contextCarry,
      foldedSubjects: open.slice(0, cut),
      openSubjects: open.slice(cut),
      threads: this.threads.slice(0, this.config.maxThreads),
      newEvidence: units.map((u) => ({ seq: u.seq, text: u.text })),
    };
  }

  // ------------------------------------------------------------------ coverage
  private async write(ledger: TrackLedger, w: {
    readonly from: number; readonly to: number; readonly outcome: RecordedOutcome; readonly units: readonly EvidenceUnit[];
    readonly admitted: number | null; readonly produced: number | null; readonly result: AttentionEvaluationResult | null;
    readonly ordinal?: number; readonly words?: number;
  }): Promise<void> {
    const result = w.result;
    const success = result !== null && (result.kind === 'DEVELOPMENTS' || result.kind === 'NONE');
    const byUnit = new Map(w.units.map((u) => [u.seq, u]));
    const produced = w.produced === null ? null : Math.max(w.produced, ...w.units.map((u) => u.arrivedClockMs));
    const events: AttentionEventInput[] | null = success && result.kind === 'DEVELOPMENTS'
      ? result.developments.map((d) => {
        const unit = byUnit.get(d.dependsOnSeq)!;
        const anchor = Math.min(Math.max(unit.clockStartMs, w.from), w.to);
        return {
          op: d.op, subjectKey: d.subjectKey, label: d.label, kind: d.kind, confidence: d.confidence, threadRef: d.threadRef,
          anchorClockMs: anchor, evidenceClockMs: Math.min(Math.max(unit.arrivedClockMs, anchor), produced!),
        };
      })
      : null;
    const usage = result?.usage ?? null;
    const writing = this.deps.store.record({
      userId: this.deps.userId, callId: this.deps.callId, epoch: this.deps.epoch, track: ledger.track,
      coversFromClockMs: w.from, coversToClockMs: w.to, outcome: w.outcome, admittedClockMs: w.admitted,
      producedClockMs: success ? produced : null, providerMs: result?.providerMs ?? null,
      promptTokens: usage?.promptTokens ?? null, cacheHitTokens: usage?.cacheHitTokens ?? null, completionTokens: usage?.completionTokens ?? null,
      events,
    });
    this.writing = writing;
    let written: AttentionRecordResult;
    try {
      written = await writing;
    } catch {
      // The result's fate is unknown: the span stays pending; its re-evaluation answers ALREADY_COVERED if it committed.
      this.deps.signal?.('attention', 'write_failed');
      this.observe({ kind: 'ATTENTION_DEFERRED', track: ledger.track, reason: 'WRITE_FAILED', at: this.now() });
      this.later(this.config.permitRetryMs);
      return;
    }
    if (written.outcome === 'RECORDED' && events !== null && written.firstEventSeq !== null) {
      this.discloseEvents(ledger.track, events, written.firstEventSeq, produced);
    }
    if (w.ordinal !== undefined) {
      this.observe({
        kind: 'ATTENTION_RESOLVED', track: ledger.track, evalOrdinal: w.ordinal, outcome: w.outcome, written: written.outcome,
        developments: events?.length ?? 0, fromClockMs: w.from, toClockMs: w.to, producedClockMs: success ? produced : null,
        providerMs: result?.providerMs ?? null, usage, at: this.now(), firstEventSeq: written.firstEventSeq, lastEventSeq: written.lastEventSeq,
      });
    }
    await this.applyWritten(ledger, w, written);
  }

  private async applyWritten(ledger: TrackLedger, w: {
    readonly from: number; readonly to: number; readonly outcome: RecordedOutcome; readonly units: readonly EvidenceUnit[];
    readonly result: AttentionEvaluationResult | null;
  }, written: AttentionRecordResult): Promise<void> {
    switch (written.outcome) {
      case 'FENCED':
      case 'NOT_FOUND':
        this.stop(written.outcome);
        return;
      case 'STALE_AFTER_END':
        this.stop('CALL_ENDED');
        return;
      case 'ALREADY_COVERED':
      case 'STALE_RESULT':
        // Another write already covered this position (a lost acknowledgement, another connection): adopt the database.
        await this.resync();
        this.reread(); // CP2: what that write committed reaches the phone as the database's state
        return;
      case 'STALE_AFTER_SETTLEMENT':
        // A late result for evidence whose turn is already settled: recorded, its events refused; it is not re-admitted.
        this.cover(ledger, w.units, w.to);
        return;
      case 'RECORDED':
        break;
    }
    const result = w.result;
    if (w.outcome === 'MISSED_HANDOVER' || w.outcome === 'DEGRADED_SUSPENDED') {
      this.cover(ledger, w.units, w.to);
      return;
    }
    if (result === null || w.outcome === 'DEFERRED_PERMIT') return;
    if (result.kind === 'DEVELOPMENTS' || result.kind === 'NONE') {
      ledger.failures = 0;
      this.overloadedInARow = 0;
      for (const d of result.developments) {
        if (d.op === 'SET') {
          ledger.open.delete(d.subjectKey); // a SET moves the subject to the newest end (the fold keeps the oldest first)
          ledger.open.set(d.subjectKey, { subjectKey: d.subjectKey, label: d.label, kind: d.kind, confidence: d.confidence, threadRef: d.threadRef });
        } else {
          ledger.open.delete(d.subjectKey);
        }
      }
      if (result.contextCarry !== null) ledger.contextCarry = result.contextCarry;
      this.cover(ledger, w.units, written.accountedToClockMs ?? w.to);
      this.window(ledger, w.units);
      this.guardSpend();
      return;
    }
    // TIMEOUT / REFUSED / PROVIDER_FAILED: recorded; the span stays pending.
    ledger.failures += 1;
    if (ledger.failures >= this.config.failuresBeforeBackoff) ledger.backoffUntil = this.now() + this.config.backoffMs;
    if (result.kind === 'PROVIDER_FAILED' && result.overloaded) {
      this.overloadedInARow += 1;
      if (this.overloadedInARow >= this.config.overloadedFailuresBeforeDegraded) this.degrade('PROVIDER_OVERLOADED');
    } else {
      this.overloadedInARow = 0;
    }
    this.guardSpend();
  }

  private cover(ledger: TrackLedger, units: readonly EvidenceUnit[], to: number): void {
    const covered = new Set(units.map((u) => u.seq));
    ledger.pending = ledger.pending.filter((u) => !covered.has(u.seq));
    ledger.coveredTo = Math.max(ledger.coveredTo, to);
  }

  /** The evaluated words join the window; past the bound the oldest leave it (the evaluator's carry keeps what matters). */
  private window(ledger: TrackLedger, units: readonly EvidenceUnit[]): void {
    for (const unit of units) ledger.window.push(...wordsOf(unit.text));
    if (ledger.window.length > this.config.maxTurnTextWords) {
      ledger.window = ledger.window.slice(ledger.window.length - this.config.maxTurnTextWords);
      ledger.overflowed = true;
    }
  }

  private async resync(): Promise<void> {
    try {
      const state = await this.deps.store.readState(this.deps.userId, this.deps.callId);
      if (state.length === 0) return this.stop('NOT_FOUND');
      if (state.some((s) => s.callEnded)) return this.stop('CALL_ENDED');
      for (const s of state) this.adopt(s.track, s.accountedToClockMs, s.openSubjects);
    } catch {
      this.later(this.config.permitRetryMs);
    }
  }

  // ------------------------------------------------------------------ degraded state (A2 §1): a product failure, recorded
  private guardSpend(): void {
    const limit = this.config.emergencyCallSpendUsd;
    if (limit !== null && this.spendUsd >= limit) this.degrade('EMERGENCY_SPEND');
  }

  private degrade(reason: 'EMERGENCY_SPEND' | 'PROVIDER_OVERLOADED'): void {
    if (this.degraded) return;
    this.degraded = reason;
    this.deps.signal?.('attention', 'degraded');
    this.observe({ kind: 'ATTENTION_DEGRADED', reason, at: this.now() });
  }

  private async flushDegraded(): Promise<void> {
    await this.writing.catch(() => undefined);
    if (this.inFlight || this.stopped) return;
    await this.recordMisses('DEGRADED_SUSPENDED');
  }

  /** One explicit miss per track for everything not covered (a hand-over, or a degraded lane at a commit or at the close). */
  private async recordMisses(outcome: 'MISSED_HANDOVER' | 'DEGRADED_SUSPENDED'): Promise<void> {
    for (const ledger of [this.tracks.USER, this.tracks.QANDEEL]) {
      if (ledger.pending.length === 0) continue;
      const units = [...ledger.pending];
      const from = ledger.coveredTo;
      const to = Math.max(units[units.length - 1]!.clockEndMs, from + 1);
      try {
        const written = await this.deps.store.record({
          userId: this.deps.userId, callId: this.deps.callId, epoch: this.deps.epoch, track: ledger.track, coversFromClockMs: from,
          coversToClockMs: to, outcome, admittedClockMs: null, producedClockMs: null, providerMs: null, promptTokens: null,
          cacheHitTokens: null, completionTokens: null, events: null,
        });
        if (written.outcome === 'RECORDED') this.cover(ledger, units, to);
      } catch {
        this.deps.signal?.('attention', 'miss_unrecorded');
      }
    }
  }

  // ------------------------------------------------------------------ disclosure (CP2, protocol v3)
  /** Each event the writer just committed, in its numbered order. A frame not sent ends the run: the state follows. */
  private discloseEvents(track: AttentionTrack, events: readonly AttentionEventInput[], firstEventSeq: number, produced: number | null): void {
    const disclose = this.deps.disclose;
    if (!disclose) return;
    for (let i = 0; i < events.length; i += 1) {
      const e = events[i]!;
      const seq = firstEventSeq + i;
      const delivery = disclose({
        kind: 'EVENT', seq, op: e.op, producedClockMs: produced,
        subject: { track, subjectKey: e.subjectKey, label: e.label, kind: e.kind, confidence: e.confidence, threadRef: e.threadRef },
      });
      if (delivery !== 'SENT') {
        if (delivery === 'DROPPED') this.rereadLater(ATTENTION_DISCLOSURE_POLICY.resendAfterDropMs);
        return;
      }
      this.sentSeq = Math.max(this.sentSeq, seq);
      if (e.op === 'SET') this.phoneOpen.add(`${track}:${e.subjectKey}`);
      else this.phoneOpen.delete(`${track}:${e.subjectKey}`);
    }
  }

  /**
   * One read of the database as the phone's state. False when it is older than an event already sent (it would undo it):
   * the caller reads again.
   */
  private discloseState(state: readonly AttentionTrackState[]): boolean {
    const disclose = this.deps.disclose;
    if (!disclose) return true;
    const seq = Math.max(0, ...state.map((s) => s.lastEventSeq));
    if (seq < this.sentSeq) return false;
    const entries = state
      .flatMap((s) => s.openSubjects.map((subject, i) => ({ track: s.track, ...subject, seq: s.openEventSeqs[i]! })))
      .sort((a, b) => a.seq - b.seq);
    const delivery = disclose({ kind: 'STATE', seq, entries });
    if (delivery === 'DROPPED') this.rereadLater(ATTENTION_DISCLOSURE_POLICY.resendAfterDropMs);
    if (delivery !== 'SENT') return true;
    this.sentSeq = seq;
    this.phoneOpen.clear();
    for (const e of entries) this.phoneOpen.add(`${e.track}:${e.subjectKey}`);
    return true;
  }

  /** The database's attention, read again and told to the phone (one read at a time; a request meanwhile reads once more). */
  private reread(): void {
    if (!this.deps.disclose || !this.ready || this.stopped) return;
    if (this.rereading) {
      this.rereadAgain = true;
      return;
    }
    this.rereading = true;
    void this.deps.store.readState(this.deps.userId, this.deps.callId).then(
      (state) => {
        if (this.stopped || state.length === 0 || state.some((s) => s.callEnded)) return;
        if (!this.discloseState(state)) this.rereadAgain = true;
      },
      () => this.deps.signal?.('attention', 'state_unavailable'),
    ).finally(() => {
      this.rereading = false;
      if (this.rereadAgain) {
        this.rereadAgain = false;
        this.reread();
      }
    });
  }

  private rereadLater(ms: number): void {
    if (this.rereadTimer !== null || this.stopped) return;
    this.rereadTimer = this.timers.set(() => {
      this.rereadTimer = null;
      this.reread();
    }, ms);
  }

  /** While the phone holds open subjects after a commit (bounded), the state is read again for a settlement made elsewhere. */
  private armWatch(): void {
    if (this.watchTimer !== null || this.stopped || !this.deps.disclose) return;
    this.watchTimer = this.timers.set(() => {
      this.watchTimer = null;
      if (this.stopped || this.now() >= this.watchUntil || this.phoneOpen.size === 0) return;
      this.reread();
      this.armWatch();
    }, ATTENTION_DISCLOSURE_POLICY.settlementWatchEveryMs);
  }

  private stop(reason: Stop): void {
    if (this.stopped) return;
    this.stopped = reason;
    this.inFlight?.controller.abort();
    if (this.retry !== null) this.timers.clear(this.retry);
    this.retry = null;
    if (this.rereadTimer !== null) this.timers.clear(this.rereadTimer);
    if (this.watchTimer !== null) this.timers.clear(this.watchTimer);
    this.rereadTimer = null;
    this.watchTimer = null;
    this.observe({ kind: 'ATTENTION_STOPPED', reason, at: this.now() });
  }

  private observe(observation: AttentionObservation): void {
    try {
      this.deps.observe?.(observation);
    } catch {
      // An observer never breaks the lane.
    }
  }
}
