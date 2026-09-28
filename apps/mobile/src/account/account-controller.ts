/**
 * W1B-01 — the account's first-use presentation for ONE runtime generation.
 *
 * It holds what the reader's first use and Conversation opening need — the Name, whether the Welcome
 * is owed, and whether the First Conversation Opening is owed — exactly as the server decided it. It
 * owns no identity, no credential, no Session and no persistence: the integration owner builds one per
 * runtime generation over the T-12P account transport and retires it with that generation.
 *
 * ## Durable semantics (W1B-01 record §5)
 *
 *   Welcome            owed while the account is named, has not completed it and has never conversed.
 *                      Tapping its start act completes it durably (`complete_first_use_welcome_v1`).
 *                      The reader moves on at once; if that write does not land, the Welcome is simply
 *                      owed again at the next launch — repeated rather than lost, and never shown to an
 *                      account that has conversed since.
 *   First opening      owed until the account's FIRST committed turn. Nothing marks it consumed on
 *                      display: an interrupted first visit shows it again, and the first committed turn —
 *                      durable in its own right — is what consumes it.
 *   Normal opener      every later genuinely empty Conversation.
 *
 * ## Unknown delays first use; it never erases it
 *
 * The reader's world waits for this answer. Opening the Conversation without it would let a brand-new
 * account's first committed turn — durable, and the very thing that retires the Welcome and the First
 * Conversation Opening — land while neither was shown, erasing both for good. So there is no state in
 * which the account is unknown and the world is open: the state stays `LOADING` until the server
 * answers, and a failed read, or one that has not answered within `ACCOUNT_READ_ATTEMPT_MS`, asks
 * again after `ACCOUNT_READ_RETRY_DELAYS_MS`. Any attempt's successful answer, however late, resolves
 * normally. A timeout or a transport failure never consumes, completes or bypasses anything.
 */
import type { AccountFirstUseOutcome } from '../runtime-entry';

export type AccountStatus = 'LOADING' | 'READY';

export interface AccountPresentationState {
  readonly status: AccountStatus;
  /** Present only when READY and the account has a Name. Never a fallback. */
  readonly displayName: string | null;
  readonly welcomePending: boolean;
  readonly firstConversationOpening: boolean;
}

export interface AccountTransport {
  readFirstUse(): Promise<AccountFirstUseOutcome>;
  completeWelcome(): Promise<boolean>;
}

export interface AccountController {
  getState(): AccountPresentationState;
  subscribe(listener: () => void): () => void;
  /** Read the account once. Idempotent. */
  start(): void;
  /** The Welcome's start act: the reader moves on now, and the completion is written once. */
  completeWelcome(): void;
  retire(): void;
}

export interface AccountControllerOptions {
  readonly transport: AccountTransport;
  /** The runtime generation's own liveness check. An answer arriving after retirement changes nothing. */
  readonly isCurrent: () => boolean;
  readonly setTimer?: (tick: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

/** How long one account read is waited for before another is asked. The earlier one may still answer. */
export const ACCOUNT_READ_ATTEMPT_MS = 6_000;
/** The pause before the next read after a failed or unanswered one; the last value repeats. */
export const ACCOUNT_READ_RETRY_DELAYS_MS: readonly number[] = Object.freeze([1_000, 2_000, 4_000, 8_000, 15_000]);

const LOADING: AccountPresentationState = Object.freeze({ status: 'LOADING', displayName: null, welcomePending: false, firstConversationOpening: false });

export function createAccountController({
  transport,
  isCurrent,
  setTimer = (tick, ms) => setTimeout(tick, ms),
  clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: AccountControllerOptions): AccountController {
  let state: AccountPresentationState = LOADING;
  let started = false;
  let retired = false;
  let welcomeWritten = false;
  let attempts = 0;
  let timer: unknown = null;
  const listeners = new Set<() => void>();
  const live = () => !retired && isCurrent();

  const publish = (next: AccountPresentationState) => {
    state = next;
    for (const listener of Array.from(listeners)) listener();
  };

  const stopWaiting = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  const waitThen = (next: () => void, ms: number) => {
    stopWaiting();
    timer = setTimer(() => {
      timer = null;
      next();
    }, ms);
  };

  /** One read. Only a READ answer changes the state; anything else leads to another read, later. */
  const read = () => {
    if (!live() || state.status !== 'LOADING') return;
    attempts += 1;
    const delay = ACCOUNT_READ_RETRY_DELAYS_MS[Math.min(attempts, ACCOUNT_READ_RETRY_DELAYS_MS.length) - 1];
    let given = false;
    // This attempt gives way once: on its failure or its time running out, whichever comes first.
    const giveWay = () => {
      if (given || !live() || state.status !== 'LOADING') return;
      given = true;
      waitThen(read, delay);
    };
    waitThen(giveWay, ACCOUNT_READ_ATTEMPT_MS);
    void transport.readFirstUse().then(
      (outcome) => {
        if (!live() || state.status !== 'LOADING') return;
        if (outcome.kind !== 'READ') {
          giveWay();
          return;
        }
        stopWaiting();
        const { displayName, welcomePending, firstConversationOpening } = outcome.view;
        publish({ status: 'READY', displayName, welcomePending: displayName !== null && welcomePending, firstConversationOpening });
      },
      giveWay,
    );
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (started || !live()) return;
      started = true;
      read();
    },
    completeWelcome() {
      if (!live() || state.status !== 'READY' || !state.welcomePending) return;
      publish({ ...state, welcomePending: false });
      if (welcomeWritten) return;
      welcomeWritten = true;
      // One write. A completion that does not land leaves the Welcome owed at the next launch.
      void transport.completeWelcome().catch(() => false);
    },
    retire() {
      retired = true;
      stopWaiting();
      listeners.clear();
    },
  };
}
