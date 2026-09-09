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

  async function catchUpCommitted(client: TemporalApiClient): Promise<void> {
    for (let page = 0; page < maxPages; page += 1) {
      if (!canRequest()) return;
      const events = await client.fetchCommittedEvents(bundle.sessionId, pageRequest(committedAfterSp));
      if (!canApply()) return;
      if (events.length === 0) return;
      const outcomes = applyCommittedUnitsPage(bundle.store, events);
      let advanced: number | null = null;
      let rejected: string | null = null;
      for (const outcome of outcomes) {
        if (outcome.outcome === 'REJECTED') {
          rejected = `${outcome.reason}: ${outcome.detail}`;
          break;
        }
        advanced = outcome.toSp;
      }
      if (advanced !== null) {
        const next = sessionPosition(advanced);
        // A cursor never moves backwards, whatever a server or a race delivers.
        if (committedAfterSp === null || next > committedAfterSp) committedAfterSp = next;
      }
      if (rejected !== null) throw new Error(`committed delivery refused (${rejected})`);
      if (events.length < pageLimit) return;
    }
  }

  async function catchUpLiveFocus(client: TemporalApiClient): Promise<void> {
    for (let page = 0; page < maxPages; page += 1) {
      if (!canRequest()) return;
      const events = await client.fetchLiveFocusEvents(bundle.sessionId, pageRequest(liveFocusAfterSp));
      if (!canApply()) return;
      if (events.length === 0) return;
      const outcomes = applyLiveFocusEventsPage(bundle.store, events);
      let advanced: number | null = null;
      let rejected: string | null = null;
      for (const outcome of outcomes) {
        if (outcome.outcome === 'REJECTED') {
          rejected = `${outcome.reason}: ${outcome.detail}`;
          break;
        }
        advanced = outcome.atSp;
      }
      if (advanced !== null) {
        const next = sessionPosition(advanced);
        if (liveFocusAfterSp === null || next > liveFocusAfterSp) liveFocusAfterSp = next;
      }
      if (rejected !== null) throw new Error(`live-focus delivery refused (${rejected})`);
      if (events.length < pageLimit) return;
    }
  }

  async function cycle(): Promise<void> {
    const current = credential();
    if (current === null || !canRequest()) return;
    const client = createTemporalClient(current.accessToken);

    // Reconcile against the authoritative snapshot FIRST. It is the target the catch-up is aiming
    // at, and it is also what makes a quiet Session cost one request instead of three.
    const snapshot = await client.fetchSessionTemporalState(bundle.sessionId);
    if (!canApply()) return;
    if (snapshot.sessionId !== bundle.sessionId) {
      throw new Error(`snapshot names Session ${snapshot.sessionId}, expected ${bundle.sessionId}`);
    }

    const headBehind = snapshot.liveHead !== null && (committedAfterSp === null || snapshot.liveHead > committedAfterSp);
    if (headBehind) await catchUpCommitted(client);

    const focusBehind =
      snapshot.liveFocusAtSp !== null && (liveFocusAfterSp === null || snapshot.liveFocusAtSp > liveFocusAfterSp);
    if (focusBehind) await catchUpLiveFocus(client);
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
