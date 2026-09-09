/**
 * T-12P test doubles. TEST-ONLY — no production module imports this file.
 *
 * The doubles are deliberately thin and honest: the HTTP double serves real wire-shaped bodies so
 * the production decoders actually run, and the auth port double implements the real port contract
 * so the authority under test is the real one. Nothing here reimplements behaviour under test.
 */
import type {
  ConversationalUnitsCommittedWireEvent,
  HistoricalDisclosure,
  LiveFocusTransitionWireEvent,
  LiveFocusWireValue,
  SessionTemporalSnapshot,
} from '@qandeel/runtime';
import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { CONVERSATIONAL_UNITS_COMMITTED, LIVE_FOCUS_TRANSITION, MAX_TEMPORAL_EVENT_PAGE } from '../../temporal';
import type {
  AuthChangeKind,
  AuthPortResult,
  AuthSessionChange,
  AuthSessionSnapshot,
  SupabaseAuthPort,
} from '../auth/supabase-auth-port';
import type { MobilePublicConfig } from '../config/mobile-public-config';
import type { RuntimeHttpFetch, TimerHandle } from '..';

export const TEST_CONFIG: MobilePublicConfig = Object.freeze({
  apiBaseUrl: 'https://api.example.test/v1',
  supabaseUrl: 'https://project.supabase.example',
  // The documented new-format shape: `sb_publishable_<22-char-random>_<8-char-checksum>`. Spelled
  // out in words rather than random-looking characters so it can never be mistaken for a real key.
  supabasePublishableKey: 'sb_publishable_examplekeyexamplekey12_checksum',
});

export const SESSION_A = '11111111-1111-4111-8111-111111111111';
export const SESSION_B = '22222222-2222-4222-8222-222222222222';

// ---------------------------------------------------------------------------------------------
// Wire builders
// ---------------------------------------------------------------------------------------------

export function snapshot(
  overrides: Partial<SessionTemporalSnapshot> & { sessionId?: string } = {},
): SessionTemporalSnapshot {
  return {
    sessionId: overrides.sessionId ?? SESSION_A,
    liveHead: overrides.liveHead ?? null,
    liveFocus: overrides.liveFocus ?? ({ kind: 'NONE' } as LiveFocusWireValue),
    liveFocusAtSp: overrides.liveFocusAtSp ?? null,
  };
}

export function committedEvent(firstSp: number, lastSp: number, sessionId = SESSION_A): ConversationalUnitsCommittedWireEvent {
  return {
    type: CONVERSATIONAL_UNITS_COMMITTED,
    version: 1,
    sessionId,
    batchId: `batch-${firstSp}-${lastSp}`,
    sourceTurnId: `turn-${firstSp}`,
    firstSp,
    lastSp,
    unitCount: lastSp - firstSp + 1,
  };
}

export function liveFocusEvent(atSp: number, value: LiveFocusWireValue = { kind: 'NONE' }, sessionId = SESSION_A): LiveFocusTransitionWireEvent {
  return { type: LIVE_FOCUS_TRANSITION, version: 1, sessionId, atSp, value };
}

/**
 * A wire-legal WORLD disclosure at `tc`.
 *
 * Delegated to T-04's own builder rather than hand-rolled: that fixture is already decoded through
 * the real T-03C validator by a T-04 suite, so it cannot silently drift away from the frozen wire
 * contract the way a second hand-written shape would.
 */
export function worldDisclosure(sessionId: string, tc: number, liveHead: number): HistoricalDisclosure {
  return disclosureFixture({ depth: 'WORLD', sessionId, tc, liveHead });
}

// ---------------------------------------------------------------------------------------------
// HTTP double
// ---------------------------------------------------------------------------------------------

export interface RecordedRequest {
  readonly url: string;
  readonly method: string;
  readonly authorization: string | null;
}

export type Responder = (request: RecordedRequest) => { status: number; body: unknown } | Promise<{ status: number; body: unknown }>;

export interface HttpDouble {
  readonly fetch: RuntimeHttpFetch;
  readonly calls: RecordedRequest[];
  /** Requests whose URL contains `fragment`. */
  matching(fragment: string): RecordedRequest[];
  /**
   * Session-CREATE calls only. `/conversation/sessions` is a prefix of every temporal and
   * projection URL too, so a substring match over-counts badly; this is the exact route.
   */
  creates(): RecordedRequest[];
  /** Register a responder for URLs containing `fragment`. Later registrations win. */
  on(fragment: string, responder: Responder): void;
  /** Every subsequent request throws, simulating a transport failure. */
  failEverything(message?: string): void;
  restore(): void;
}

export function httpDouble(): HttpDouble {
  const calls: RecordedRequest[] = [];
  const routes: { fragment: string; responder: Responder }[] = [];
  let thrown: string | null = null;

  const fetchImpl: RuntimeHttpFetch = async (input, init) => {
    const record: RecordedRequest = {
      url: input,
      method: init?.method ?? 'GET',
      authorization: init?.headers?.Authorization ?? null,
    };
    calls.push(record);
    if (thrown !== null) throw new Error(thrown);
    // Route by the DEEPEST path segment that matches, then by the longest fragment, then by the
    // most recent registration. Two traps make the naive rules wrong here:
    //   - last-registered-wins lets a `/temporal` snapshot override swallow `/temporal/events`,
    //     which looks exactly like a driver that never pages;
    //   - longest-fragment-wins lets `/conversation/sessions` win every URL, since it is a prefix
    //     of the temporal and projection routes too.
    // Whichever fragment occurs LATEST in the URL is the one naming the actual endpoint.
    let best: { fragment: string; responder: Responder; at: number; order: number } | null = null;
    routes.forEach((route, order) => {
      const at = input.lastIndexOf(route.fragment);
      if (at < 0) return;
      if (
        best === null ||
        at > best.at ||
        (at === best.at && route.fragment.length > best.fragment.length) ||
        (at === best.at && route.fragment.length === best.fragment.length && order > best.order)
      ) {
        best = { ...route, at, order };
      }
    });
    if (best !== null) {
      const { status, body } = await (best as { responder: Responder }).responder(record);
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    }
    return { ok: false, status: 404, json: async () => ({ code: 'NO_ROUTE' }) };
  };

  return {
    fetch: fetchImpl,
    calls,
    matching: (fragment) => calls.filter((call) => call.url.includes(fragment)),
    creates: () => calls.filter((call) => call.method === 'POST' && call.url.endsWith('/conversation/sessions')),
    on: (fragment, responder) => {
      routes.push({ fragment, responder });
    },
    failEverything: (message = 'network down') => {
      thrown = message;
    },
    restore: () => {
      thrown = null;
    },
  };
}

/**
 * Serve one catch-up stream the way the server actually does: honour `afterSp` and `limit`.
 *
 * Call-count-based responders make paging tests fragile and, worse, can make a driver look correct
 * because the double replayed a page rather than because the cursor advanced.
 */
export function servePagedStream(
  http: HttpDouble,
  fragment: '/temporal/events' | '/temporal/live-focus-events',
  events: readonly (ConversationalUnitsCommittedWireEvent | LiveFocusTransitionWireEvent)[],
  sessionId = SESSION_A,
): void {
  const key = (event: ConversationalUnitsCommittedWireEvent | LiveFocusTransitionWireEvent): number =>
    'lastSp' in event ? event.lastSp : event.atSp;
  http.on(fragment, (request) => {
    const url = new URL(request.url);
    const afterSp = url.searchParams.get('afterSp');
    const limit = Number(url.searchParams.get('limit') ?? String(MAX_TEMPORAL_EVENT_PAGE));
    const cursor = afterSp === null ? 0 : Number(afterSp);
    const page = events.filter((event) => key(event) > cursor).slice(0, limit);
    return { status: 200, body: { sessionId, events: page } };
  });
}

/** Register the whole happy path: session create, snapshot, both event routes, projection. */
export function serveHappyPath(
  http: HttpDouble,
  options: {
    sessionId?: string;
    snapshot?: SessionTemporalSnapshot;
    committed?: ConversationalUnitsCommittedWireEvent[];
    liveFocus?: LiveFocusTransitionWireEvent[];
  } = {},
): void {
  const sessionId = options.sessionId ?? SESSION_A;
  const snap = options.snapshot ?? snapshot({ sessionId });
  http.on('/conversation/sessions', () => ({
    status: 201,
    body: { id: sessionId, user_id: 'user-1', status: 'ACTIVE', channel: 'TEXT', created_at: 'now', updated_at: 'now', last_activity_at: 'now', closed_at: null },
  }));
  http.on('/temporal', () => ({ status: 200, body: snap }));
  http.on('/temporal/events', () => ({ status: 200, body: { sessionId, events: options.committed ?? [] } }));
  http.on('/temporal/live-focus-events', () => ({ status: 200, body: { sessionId, events: options.liveFocus ?? [] } }));
  http.on('/historical-projection', () => ({
    status: 200,
    body: worldDisclosure(sessionId, snap.liveHead ?? 1, snap.liveHead ?? 1),
  }));
}

// ---------------------------------------------------------------------------------------------
// Auth port double
// ---------------------------------------------------------------------------------------------

export interface AuthPortDouble extends SupabaseAuthPort {
  /**
   * Push a session change exactly as the SDK's `onAuthStateChange` would, WITH its provenance.
   *
   * The default is `TOKEN_REFRESHED` because that is the callback whose provenance actually matters:
   * it is the one that can already be in flight when a sign-out runs. A test that means "the reader
   * signed in again" must say `SIGNED_IN` explicitly.
   */
  emit(session: AuthSessionSnapshot | null, kind?: AuthChangeKind): void;
  readonly autoRefresh: { started: number; stopped: number };
  readonly listenerCount: () => number;
  restoreWith(result: AuthPortResult<AuthSessionSnapshot | null>): void;
  signInWith(result: AuthPortResult<AuthSessionSnapshot>): void;
  /**
   * Make `signInWithPassword` block until the returned gate is opened, and — crucially — emit
   * `SIGNED_IN` to the subscriber BEFORE resolving, exactly as the maintained SDK does.
   *
   * `GoTrueClient.signInWithPassword` is `_saveSession` ->
   * `await _notifyAllSubscribers('SIGNED_IN', session)` -> `return`. A double that resolves without
   * emitting first is not production-faithful and cannot discriminate the R2-01 race at all.
   */
  blockSignIn(session: AuthSessionSnapshot): Gate;
}

export function authPortDouble(initial: AuthSessionSnapshot | null = null): AuthPortDouble {
  const listeners = new Set<(change: AuthSessionChange) => void>();
  const autoRefresh = { started: 0, stopped: 0 };
  let restore: AuthPortResult<AuthSessionSnapshot | null> = { ok: true, value: initial };
  let signIn: AuthPortResult<AuthSessionSnapshot> | null = null;
  let blocked: { gate: Gate; session: AuthSessionSnapshot } | null = null;

  const notify = (change: AuthSessionChange) => {
    for (const listener of Array.from(listeners)) listener(change);
  };

  return {
    blockSignIn(session) {
      const opened = gate();
      blocked = { gate: opened, session };
      return opened;
    },
    autoRefresh,
    listenerCount: () => listeners.size,
    restoreWith: (result) => {
      restore = result;
    },
    signInWith: (result) => {
      signIn = result;
    },
    emit: (session, kind = 'TOKEN_REFRESHED') => {
      notify({ kind, session });
    },
    restoreSession: async () => restore,
    signInWithPassword: async (email) => {
      if (blocked !== null) {
        const pending = blocked;
        blocked = null;
        await pending.gate.wait();
        // Production ordering: the SDK saves the session, awaits its subscribers, and only then
        // returns. A double that skipped this could not discriminate a stale sign-in at all.
        notify({ kind: 'SIGNED_IN', session: pending.session });
        return { ok: true, value: pending.session };
      }
      return signIn ?? { ok: true, value: { userId: `user-for-${email}`, accessToken: `token-for-${email}` } };
    },
    signOut: async () => ({ ok: true, value: null }),
    onSessionChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    startAutoRefresh: () => {
      autoRefresh.started += 1;
    },
    stopAutoRefresh: () => {
      autoRefresh.stopped += 1;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Timer double
// ---------------------------------------------------------------------------------------------

export interface TimerDouble {
  setTimer: (tick: () => void, ms: number) => TimerHandle;
  clearTimer: (handle: TimerHandle) => void;
  /** Fire every currently-scheduled timer once, in schedule order. */
  flush(): void;
  readonly scheduled: number[];
  readonly pending: () => number;
}

export function timerDouble(): TimerDouble {
  let nextId = 1;
  const timers = new Map<number, () => void>();
  const scheduled: number[] = [];
  return {
    scheduled,
    pending: () => timers.size,
    setTimer: (tick, ms) => {
      const id = nextId;
      nextId += 1;
      scheduled.push(ms);
      timers.set(id, tick);
      return id;
    },
    clearTimer: (handle) => {
      timers.delete(handle as number);
    },
    flush: () => {
      const due = Array.from(timers.entries());
      timers.clear();
      for (const [, tick] of due) tick();
    },
  };
}

/**
 * A latch for holding one in-flight request open.
 *
 * Written with a waiter LIST rather than a captured `resolve` variable on purpose: assigning a
 * closure to a `let` from inside a callback narrows it to `never` under `tsc`, which is a real type
 * error rather than a lint nit. Once opened it stays open, so a later `wait()` resolves immediately —
 * which is exactly what a test needs when only the FIRST call should block.
 */
export interface Gate {
  wait(): Promise<void>;
  open(): void;
}

export function gate(): Gate {
  const waiters: (() => void)[] = [];
  let opened = false;
  return {
    wait: () =>
      opened
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            waiters.push(resolve);
          }),
    open: () => {
      opened = true;
      while (waiters.length > 0) waiters.shift()?.();
    },
  };
}

/**
 * Drain the async work a cycle queues.
 *
 * Microtask ticks alone are NOT enough: one catch-up cycle is snapshot -> json -> page -> json ->
 * apply, and each awaited responder adds turns. Yielding to a real macrotask between drains lets
 * the whole chain finish. The driver's own cadence runs on the INJECTED timer double, so a real
 * `setTimeout` here never fires a driver tick by accident.
 */
export const settle = async (): Promise<void> => {
  for (let index = 0; index < 12; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
