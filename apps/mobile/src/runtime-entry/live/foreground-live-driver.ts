/**
 * T-12P §2.7 / §9 — the foreground live-delivery driver.
 *
 * Orchestration only. It owns no temporal authority: every byte it applies goes through T-03's own
 * `applyCommittedUnitsPage` / `applyLiveFocusEventsPage` seams, which are the only authorized
 * writers of `LH` and `LF`. The driver decides WHEN to ask and WHAT cursor to ask from, and nothing
 * else. No timer callback here is Product authority.
 *
 * It is HTTP catch-up over the existing authenticated transports. There is no WebSocket and no SSE
 * — the transports already declare that ownership, and inventing a push channel here would be a new
 * delivery contract nobody froze.
 *
 * IT RUNS ONLY IN THE FOREGROUND. Backgrounding stops it issuing requests, and a cycle already in
 * flight stops paging at its next checkpoint. There is no background polling.
 *
 * THE GENERATION RULE. Every application is gated on the runtime generation still being current AND
 * the authenticated identity still being the one this driver was built for. That single gate is
 * what makes sign-out, user replacement, Session replacement and disposal all produce zero late
 * canonical writes: a response that arrives after any of them is dropped, not applied.
 *
 * THE CURSOR RULE. Nothing in the transport or the sync seams returns a cursor, and the mirrored
 * `LH` is NOT one — the bootstrap snapshot writes `LH` too, and a `STALE` delivery leaves it
 * untouched while the event was still delivered. So the driver tracks its own cursor and advances
 * it to the last outcome the sync owner did not REJECT. `REJECTED` means the payload never became
 * client truth, and the seam stops the page there, so the cursor stops there too and the page is
 * re-requested from the last position that was genuinely accepted.
 */
import type { ConversationalUnitsCommittedWireEvent, LiveFocusTransitionWireEvent } from '@qandeel/runtime';
import {
  applyCommittedUnitsPage,
  applyLiveFocusEventsPage,
  MAX_TEMPORAL_EVENT_PAGE,
  type TemporalApiClient,
} from '../../temporal';
import { sessionPosition, type SessionPosition } from '../../state';
import type { ForegroundSignal, ForegroundState } from '../lifecycle/foreground-signal';
import type { CanonicalRuntimeBundle, LiveDeliveryCursors } from '../bootstrap/bootstrap-types';
import { createCatchUpSchedule, type CatchUpSchedule } from './live-driver-scheduler';

export type TimerHandle = unknown;

/** The credential a request is authorized with, read fresh so a token refresh is picked up. */
export interface LiveDriverCredential {
  readonly accessToken: string;
  readonly authGeneration: number;
}

export interface LiveDriverStatus {
  readonly started: boolean;
  readonly cycleInFlight: boolean;
  readonly foreground: ForegroundState;
  readonly consecutiveFailures: number;
  readonly cursors: LiveDeliveryCursors;
  /** A technical description of the last failed cycle. Never contains a credential. */
  readonly lastFailure: string | null;
}

export interface ForegroundLiveDriverOptions {
  readonly bundle: CanonicalRuntimeBundle;
  /**
   * The current credential, or `null` when nobody is authenticated. Read at the start of every
   * request so a refreshed token is used immediately, and compared against the bundle's auth
   * generation so a replaced identity can never authorize a write for the previous one.
   */
  readonly credential: () => LiveDriverCredential | null;
  /**
   * Build a transport for one request. `TemporalApiConfig` captures the access token at
   * construction and exposes no setter, so a client is built per cycle rather than held — that is
   * what makes "token refresh affects subsequent request auth" true by construction.
   */
  readonly createTemporalClient: (accessToken: string) => TemporalApiClient;
  readonly foreground: ForegroundSignal;
  /** Whether this driver's runtime generation is still the current one. */
  readonly isCurrent: () => boolean;
  readonly schedule?: CatchUpSchedule;
  readonly setTimer?: (tick: () => void, ms: number) => TimerHandle;
  readonly clearTimer?: (handle: TimerHandle) => void;
  readonly pageLimit?: number;
  /** A hard bound so one cycle cannot page forever against a fast-moving Session. */
  readonly maxPagesPerCycle?: number;
}

export interface ForegroundLiveDriver {
  /** Begin. Runs one catch-up immediately if foregrounded, then on the cadence. */
  start(): void;
  /** Stop issuing requests without retiring the driver. `start()` may follow. */
  stop(): void;
  /** Retire permanently. After this, nothing can be applied — including an in-flight response. */
  dispose(): void;
  /** Catch up now rather than at the next tick. Coalesces into a cycle already running. */
  requestImmediateCatchUp(): void;
  getStatus(): LiveDriverStatus;
}

const DEFAULT_PAGE_LIMIT = 64;
const DEFAULT_MAX_PAGES_PER_CYCLE = 16;

export function createForegroundLiveDriver(options: ForegroundLiveDriverOptions): ForegroundLiveDriver {
  const { bundle, credential, createTemporalClient, foreground, isCurrent } = options;
  const schedule = options.schedule ?? createCatchUpSchedule();
  const setTimer = options.setTimer ?? ((tick, ms) => setTimeout(tick, ms));
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const pageLimit = Math.min(options.pageLimit ?? DEFAULT_PAGE_LIMIT, MAX_TEMPORAL_EVENT_PAGE);
  const maxPages = options.maxPagesPerCycle ?? DEFAULT_MAX_PAGES_PER_CYCLE;

  let started = false;
  let disposed = false;
  let cycleInFlight = false;
  let pendingImmediate = false;
  let consecutiveFailures = 0;
  let lastFailure: string | null = null;
  let timer: TimerHandle | null = null;
  let committedAfterSp: SessionPosition | null = bundle.cursors.committedAfterSp;
  let liveFocusAfterSp: SessionPosition | null = bundle.cursors.liveFocusAfterSp;

  /** May an already-fetched payload still be applied? Generation and identity only. */
  function canApply(): boolean {
    if (disposed || !isCurrent()) return false;
    const current = credential();
    return current !== null && current.authGeneration === bundle.authGeneration;
  }

  /** May a NEW request be issued? Everything `canApply` requires, plus started and foregrounded. */
  function canRequest(): boolean {
    return started && canApply() && foreground.current() === 'ACTIVE';
  }

  function clearPendingTimer(): void {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  }

  function scheduleNext(): void {
    clearPendingTimer();
    if (!canRequest()) return;
    timer = setTimer(() => {
      timer = null;
      void runCycle();
    }, schedule.nextDelayMs(consecutiveFailures));
  }

  /** `afterSp` must be an addressable position: SP(0) is not a cursor, so `null` means omit it. */
  function pageRequest(after: SessionPosition | null): { afterSp?: number; limit: number } {
    return after === null ? { limit: pageLimit } : { afterSp: after, limit: pageLimit };
  }

  /**
   * R1-02 — a transport built from the credential as it is RIGHT NOW, or `null` if no request may
   * be issued.
   *
   * `TemporalApiConfig` captures the access token at construction and exposes no setter, so a client
   * built once at the top of a cycle would keep using the token it was born with. If the token
   * refreshes after the snapshot but before the next page, that page would go out with a stale
   * credential. Building per request is what makes freshness true at every request boundary rather
   * than only at the first one — and the generation check rides along, so a request can never be
   * issued for an identity that has already been replaced.
   */
  function clientForRequest(): TemporalApiClient | null {
    if (!canRequest()) return null;
    const current = credential();
    if (current === null || current.authGeneration !== bundle.authGeneration) return null;
    return createTemporalClient(current.accessToken);
  }

  /**
   * R1-03 — one delivery entry, keyed by the authoritative Session Position it belongs to.
   *
   * `rank` encodes the frozen same-SP order. Within one Session Position the server reserves
   * same-SP sequence 1 for the committed CU and sequence 3 for the Live Focus transition, so at an
   * equal SP the committed CU precedes the LF transition. That rule is read off the frozen write
   * order, not invented here.
   */
  type DeliveryEntry =
    | { readonly sp: number; readonly rank: 0; readonly stream: 'COMMITTED'; readonly event: ConversationalUnitsCommittedWireEvent }
    | { readonly sp: number; readonly rank: 1; readonly stream: 'LIVE_FOCUS'; readonly event: LiveFocusTransitionWireEvent };

  /**
   * Apply ONE delivery through its own frozen T-03 sync owner, and advance only that stream's
   * cursor, and only when the owner did not refuse the payload.
   *
   * Returns `false` when the delivery was REJECTED — the payload never became client truth, so the
   * cursor stays where it was and the caller stops the cycle there.
   */
  function applyOne(entry: DeliveryEntry): boolean {
    if (entry.stream === 'COMMITTED') {
      const [outcome] = applyCommittedUnitsPage(bundle.store, [entry.event]);
      if (outcome === undefined || outcome.outcome === 'REJECTED') {
        lastFailure =
          outcome === undefined ? 'committed delivery produced no outcome' : `committed delivery refused (${outcome.reason}: ${outcome.detail})`;
        return false;
      }
      const next = sessionPosition(outcome.toSp);
      // A cursor never moves backwards, whatever a server or a race delivers.
      if (committedAfterSp === null || next > committedAfterSp) committedAfterSp = next;
      return true;
    }
    const [outcome] = applyLiveFocusEventsPage(bundle.store, [entry.event]);
    if (outcome === undefined || outcome.outcome === 'REJECTED') {
      lastFailure =
        outcome === undefined ? 'live-focus delivery produced no outcome' : `live-focus delivery refused (${outcome.reason}: ${outcome.detail})`;
      return false;
    }
    const next = sessionPosition(outcome.atSp);
    if (liveFocusAfterSp === null || next > liveFocusAfterSp) liveFocusAfterSp = next;
    return true;
  }

  async function cycle(): Promise<void> {
    // Reconcile against the authoritative snapshot FIRST. It is the target the catch-up aims at,
    // and it is also what makes a quiet Session cost one request instead of three.
    const snapshotClient = clientForRequest();
    if (snapshotClient === null) return;
    const snapshot = await snapshotClient.fetchSessionTemporalState(bundle.sessionId);
    if (!canApply()) return;
    if (snapshot.sessionId !== bundle.sessionId) {
      throw new Error(`snapshot names Session ${snapshot.sessionId}, expected ${bundle.sessionId}`);
    }

    const headTarget = snapshot.liveHead;
    const focusTarget = snapshot.liveFocusAtSp;
    const behindHead = () => headTarget !== null && (committedAfterSp === null || headTarget > committedAfterSp);
    const behindFocus = () => focusTarget !== null && (liveFocusAfterSp === null || focusTarget > liveFocusAfterSp);
    // A stream that returns an empty page cannot advance, so it is finished for this cycle. Without
    // this the loop below would spin against a server that has nothing more to give.
    let headExhausted = false;
    let focusExhausted = false;

    for (let page = 0; page < maxPages; page += 1) {
      const wantHead = behindHead() && !headExhausted;
      const wantFocus = behindFocus() && !focusExhausted;
      if (!wantHead && !wantFocus) return;

      let committed: readonly ConversationalUnitsCommittedWireEvent[] = [];
      let focus: readonly LiveFocusTransitionWireEvent[] = [];

      if (wantHead) {
        const client = clientForRequest();
        if (client === null) return;
        committed = await client.fetchCommittedEvents(bundle.sessionId, pageRequest(committedAfterSp));
        if (!canApply()) return;
        if (committed.length === 0) headExhausted = true;
      }
      if (wantFocus) {
        const client = clientForRequest();
        if (client === null) return;
        focus = await client.fetchLiveFocusEvents(bundle.sessionId, pageRequest(liveFocusAfterSp));
        if (!canApply()) return;
        if (focus.length === 0) focusExhausted = true;
      }

      const entries: DeliveryEntry[] = [
        ...committed.map((event): DeliveryEntry => ({ sp: event.lastSp, rank: 0, stream: 'COMMITTED', event })),
        ...focus.map((event): DeliveryEntry => ({ sp: event.atSp, rank: 1, stream: 'LIVE_FOCUS', event })),
      ].sort((a, b) => (a.sp === b.sp ? a.rank - b.rank : a.sp - b.sp));

      // A stream whose page came back FULL may have more events below the other stream's last
      // position, so nothing beyond that watermark can be applied yet without risking an
      // out-of-order application. Whatever is held back is simply re-fetched next iteration: the
      // cursors only advanced for what was actually applied.
      const bounds: number[] = [];
      if (wantHead && committed.length === pageLimit) bounds.push(committed[committed.length - 1].lastSp);
      if (wantFocus && focus.length === pageLimit) bounds.push(focus[focus.length - 1].atSp);
      const watermark = bounds.length > 0 ? Math.min(...bounds) : Number.POSITIVE_INFINITY;

      let applied = 0;
      for (const entry of entries) {
        if (entry.sp > watermark) break;
        if (!canApply()) return;
        if (!applyOne(entry)) throw new Error(lastFailure ?? 'delivery refused');
        applied += 1;
      }
      // No progress is possible from here without new data; stop rather than spin.
      if (applied === 0) return;
    }
  }

  async function runCycle(): Promise<void> {
    // One cycle at a time: no overlapping snapshot, no overlapping page for the same cursor.
    if (cycleInFlight || !canRequest()) return;
    cycleInFlight = true;
    try {
      await cycle();
      if (canApply()) {
        consecutiveFailures = 0;
        lastFailure = null;
      }
    } catch (cause) {
      if (canApply()) {
        // A failure never invents state and never rewinds truth: the cursor is untouched and the
        // next cycle simply asks again from the last position that was genuinely accepted.
        consecutiveFailures += 1;
        lastFailure = cause instanceof Error && cause.message !== '' ? cause.message : 'catch-up failed';
      }
    } finally {
      cycleInFlight = false;
      if (pendingImmediate && canRequest()) {
        pendingImmediate = false;
        void runCycle();
      } else {
        pendingImmediate = false;
        scheduleNext();
      }
    }
  }

  const unsubscribeForeground = foreground.subscribe((state) => {
    if (disposed || !started) return;
    if (state === 'ACTIVE') {
      // Resuming reconciles immediately rather than waiting out a tick.
      void runCycle();
    } else {
      clearPendingTimer();
    }
  });

  return {
    start() {
      if (disposed || started) return;
      started = true;
      void runCycle();
    },
    stop() {
      if (!started) return;
      started = false;
      clearPendingTimer();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      started = false;
      clearPendingTimer();
      unsubscribeForeground();
    },
    requestImmediateCatchUp() {
      if (!canRequest()) return;
      if (cycleInFlight) {
        pendingImmediate = true;
        return;
      }
      clearPendingTimer();
      void runCycle();
    },
    getStatus: () => ({
      started,
      cycleInFlight,
      foreground: foreground.current(),
      consecutiveFailures,
      cursors: { committedAfterSp, liveFocusAfterSp },
      lastFailure,
    }),
  };
}
