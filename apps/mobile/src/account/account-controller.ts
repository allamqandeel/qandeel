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
 * ## A bounded wait
 *
 * The reader's world waits for this answer so a brand-new account never glimpses the Conversation
 * before its Welcome. The wait is bounded: after `ACCOUNT_READ_WAIT_MS`, or on any failure, the state
 * is `UNAVAILABLE`, which shows the Conversation with no Welcome and no opener — silent, as W1A-01 was,
 * and never with an invented name.
 */
import type { AccountFirstUseOutcome } from '../runtime-entry';

export type AccountStatus = 'LOADING' | 'READY' | 'UNAVAILABLE';

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

/** How long the reader's world waits for the account before it opens without a Welcome or opener. */
export const ACCOUNT_READ_WAIT_MS = 6_000;

const LOADING: AccountPresentationState = Object.freeze({ status: 'LOADING', displayName: null, welcomePending: false, firstConversationOpening: false });
const UNAVAILABLE: AccountPresentationState = Object.freeze({ status: 'UNAVAILABLE', displayName: null, welcomePending: false, firstConversationOpening: false });

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
      timer = setTimer(() => {
        timer = null;
        if (live() && state.status === 'LOADING') publish(UNAVAILABLE);
      }, ACCOUNT_READ_WAIT_MS);
      void transport.readFirstUse().then(
        (outcome) => {
          if (!live() || state.status !== 'LOADING') return;
          stopWaiting();
          if (outcome.kind !== 'READ') {
            publish(UNAVAILABLE);
            return;
          }
          const { displayName, welcomePending, firstConversationOpening } = outcome.view;
          publish({ status: 'READY', displayName, welcomePending: displayName !== null && welcomePending, firstConversationOpening });
        },
        () => {
          if (!live() || state.status !== 'LOADING') return;
          stopWaiting();
          publish(UNAVAILABLE);
        },
      );
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
