/**
 * W3-MEGA-A — the reader's own account identity and Security & Sign-in acts, for ONE runtime generation.
 *
 * It holds what General Settings shows — the Name, the Login ID, the Email and whether it is verified — exactly as
 * the server read them, and it performs the reader's own changes. It owns no identity, no credential and no
 * persistence: the integration owner builds one per runtime generation over the account transport bound to that
 * identity and retires it with the generation. A password the reader types passes through once and is never kept.
 *
 * ## Nothing is guessed
 *
 *   - The state changes only on a server answer or a fresh read — never optimistically.
 *   - A Login ID change carries ONE command identity per requested value, so a retry after a lost answer is the
 *     same command and the database commits it once.
 *   - When a Name or Login ID change has no usable answer, the canonical identity is READ before anything is said:
 *     the requested value is now current → it committed (never a false failure); otherwise → a retry is offered.
 *   - An Email confirmation whose answer is lost is reconciled the same way: the Email is the new one → changed.
 *   - A password change or a sign-out of other devices without an answer is NEVER reported as done: there is no
 *     readable password state, so it says only "try again".
 *   - One act at a time: a second act while one is in flight is refused (`null`).
 */
import type { AccountIdentityOutcome, AccountIdentityView, EmailChangeConfirmOutcome, EmailChangeRequestOutcome, LoginIdChangeOutcome, NameChangeOutcome, PasswordChangeOutcome, SignOutOthersOutcome } from '../runtime-entry';
import { canonicalName, isPlausibleEmail, judgeLoginId, NAME_MAX_LENGTH } from '../account';
import { mintPublicIdCommandId } from './public-id-controller';

export type AccountIdentityStatus = 'LOADING' | 'READY';

export interface AccountIdentityState {
  readonly status: AccountIdentityStatus;
  /** Present only when READY. */
  readonly identity: AccountIdentityView | null;
}

export interface AccountIdentityTransport {
  readIdentity(): Promise<AccountIdentityOutcome>;
  changeName(name: string): Promise<NameChangeOutcome>;
  changeLoginId(commandId: string, loginId: string, password: string): Promise<LoginIdChangeOutcome>;
  requestEmailChange(password: string, email: string): Promise<EmailChangeRequestOutcome>;
  confirmEmailChange(email: string, newEmailCode: string, currentEmailCode: string): Promise<EmailChangeConfirmOutcome>;
  changePassword(password: string, newPassword: string): Promise<PasswordChangeOutcome>;
  signOutOtherDevices(): Promise<SignOutOthersOutcome>;
}

/** DONE: committed (now, or found committed). RETRY: it did not commit, or it is not known whether it did. */
export type NameChangeResult = 'DONE' | 'UNCHANGED' | 'EMPTY' | 'RETRY';
export type LoginIdChangeResult = 'DONE' | 'UNCHANGED' | 'EMPTY' | 'MALFORMED' | 'UNAVAILABLE' | 'PASSWORD_REJECTED' | 'RETRY';
export type EmailChangeRequestResult = 'CODES_SENT' | 'UNCHANGED' | 'INVALID_EMAIL' | 'PASSWORD_REJECTED' | 'RETRY';
export type EmailChangeConfirmResult = 'CHANGED' | 'CODE_REJECTED' | 'RETRY';
export type PasswordChangeResult = 'CHANGED' | 'CHANGED_SIGNED_OUT' | 'POLICY' | 'PASSWORD_REJECTED' | 'RETRY';
export type SignOutOthersResult = 'DONE' | 'RETRY';

export interface AccountIdentityController {
  getState(): AccountIdentityState;
  subscribe(listener: () => void): () => void;
  /** Read the reader's identity once, asking again after a failure until it answers. Idempotent. */
  start(): void;
  changeName(requested: string): Promise<NameChangeResult | null>;
  changeLoginId(requested: string, password: string): Promise<LoginIdChangeResult | null>;
  requestEmailChange(password: string, email: string): Promise<EmailChangeRequestResult | null>;
  confirmEmailChange(email: string, newEmailCode: string, currentEmailCode: string): Promise<EmailChangeConfirmResult | null>;
  changePassword(password: string, newPassword: string): Promise<PasswordChangeResult | null>;
  signOutOtherDevices(): Promise<SignOutOthersResult | null>;
  retire(): void;
}

export interface AccountIdentityControllerOptions {
  readonly transport: AccountIdentityTransport;
  readonly isCurrent: () => boolean;
  readonly newCommandId?: () => string;
  readonly setTimer?: (tick: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

/** The pause before the next read after a failed one; the last value repeats. */
export const ACCOUNT_IDENTITY_READ_RETRY_DELAYS_MS: readonly number[] = Object.freeze([1_000, 2_000, 4_000, 8_000, 15_000]);

const LOADING: AccountIdentityState = Object.freeze({ status: 'LOADING', identity: null });

export function createAccountIdentityController({
  transport,
  isCurrent,
  newCommandId = mintPublicIdCommandId,
  setTimer = (tick, ms) => setTimeout(tick, ms),
  clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: AccountIdentityControllerOptions): AccountIdentityController {
  let state: AccountIdentityState = LOADING;
  let started = false;
  let retired = false;
  let attempts = 0;
  let timer: unknown = null;
  let busy = false;
  /** The command that owns the Login ID the reader last confirmed and that has not been settled. */
  let loginIdCommand: { readonly value: string; readonly id: string } | null = null;
  const listeners = new Set<() => void>();
  const live = () => !retired && isCurrent();

  const publish = (identity: AccountIdentityView) => {
    state = { status: 'READY', identity };
    for (const listener of Array.from(listeners)) listener();
  };
  const current = () => state.identity;

  const read = () => {
    if (!live() || state.status !== 'LOADING') return;
    attempts += 1;
    const delay = ACCOUNT_IDENTITY_READ_RETRY_DELAYS_MS[Math.min(attempts, ACCOUNT_IDENTITY_READ_RETRY_DELAYS_MS.length) - 1];
    void transport.readIdentity().then(
      (outcome) => {
        if (!live() || state.status !== 'LOADING') return;
        if (outcome.kind === 'READ') publish(outcome.view);
        else timer = setTimer(read, delay);
      },
      () => {
        if (live() && state.status === 'LOADING') timer = setTimer(read, delay);
      },
    );
  };

  /** After an answer that does not say what happened: read the canonical identity, and say only that. */
  const reread = async (): Promise<AccountIdentityView | null> => {
    let outcome: AccountIdentityOutcome;
    try {
      outcome = await transport.readIdentity();
    } catch {
      return null;
    }
    if (!live() || outcome.kind !== 'READ') return null;
    publish(outcome.view);
    return outcome.view;
  };

  /** One act at a time, only once the identity is known, and only for a live generation. */
  const exclusive = async <T>(act: () => Promise<T>): Promise<T | null> => {
    if (!live() || busy || state.status !== 'READY') return null;
    busy = true;
    try {
      return await act();
    } finally {
      busy = false;
    }
  };

  const withIdentity = (patch: Partial<AccountIdentityView>) => {
    const identity = current();
    if (identity !== null) publish({ ...identity, ...patch });
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

    changeName(requested) {
      return exclusive(async (): Promise<NameChangeResult> => {
        const name = canonicalName(requested);
        // Told at once, without a request: a Name can never be empty (the database's own rule).
        // Counted in code points, as the database counts characters.
        if (name === '' || Array.from(name).length > NAME_MAX_LENGTH) return 'EMPTY';
        const outcome = await transport.changeName(name).catch((): NameChangeOutcome => ({ kind: 'NETWORK' }));
        if (!live()) return 'RETRY';
        if (outcome.kind === 'ANSWERED') {
          if (outcome.answer === 'INVALID') return 'EMPTY';
          withIdentity({ name: outcome.name });
          return outcome.answer === 'CHANGED' ? 'DONE' : 'UNCHANGED';
        }
        const read = await reread();
        return read !== null && read.name === name ? 'DONE' : 'RETRY';
      });
    },

    changeLoginId(requested, password) {
      return exclusive(async (): Promise<LoginIdChangeResult> => {
        const verdict = judgeLoginId(requested);
        if (verdict.kind === 'EMPTY') return 'EMPTY';
        if (verdict.kind === 'MALFORMED') return 'MALFORMED';
        const value = verdict.canonical;
        if (loginIdCommand === null || loginIdCommand.value !== value) loginIdCommand = { value, id: newCommandId() };
        const outcome = await transport.changeLoginId(loginIdCommand.id, value, password).catch((): LoginIdChangeOutcome => ({ kind: 'NETWORK' }));
        if (!live()) return 'RETRY';
        switch (outcome.kind) {
          case 'PASSWORD_REJECTED':
            return 'PASSWORD_REJECTED';
          case 'ANSWERED':
            withIdentity({ loginId: outcome.loginId });
            if (outcome.answer === 'CHANGED' || outcome.answer === 'UNCHANGED') loginIdCommand = null;
            if (outcome.answer === 'CHANGED') return 'DONE';
            if (outcome.answer === 'UNCHANGED') return 'UNCHANGED';
            return outcome.answer === 'INVALID' ? 'MALFORMED' : 'UNAVAILABLE';
          case 'CONFLICT':
            // This identity is spent on another value: never reuse it, and learn what is true first.
            loginIdCommand = null;
            break;
          default:
            break;
        }
        const read = await reread();
        if (read !== null && read.loginId === value) {
          loginIdCommand = null;
          return 'DONE';
        }
        return 'RETRY';
      });
    },

    requestEmailChange(password, email) {
      return exclusive(async (): Promise<EmailChangeRequestResult> => {
        if (!isPlausibleEmail(email)) return 'INVALID_EMAIL';
        const outcome = await transport.requestEmailChange(password, email.trim()).catch((): EmailChangeRequestOutcome => ({ kind: 'NETWORK' }));
        if (!live()) return 'RETRY';
        switch (outcome.kind) {
          case 'ACCEPTED':
            return 'CODES_SENT';
          case 'UNCHANGED':
          case 'INVALID_EMAIL':
          case 'PASSWORD_REJECTED':
            return outcome.kind;
          default:
            // Nothing has changed yet in any case: asking again is always safe.
            return 'RETRY';
        }
      });
    },

    confirmEmailChange(email, newEmailCode, currentEmailCode) {
      return exclusive(async (): Promise<EmailChangeConfirmResult> => {
        const outcome = await transport.confirmEmailChange(email.trim(), newEmailCode, currentEmailCode).catch((): EmailChangeConfirmOutcome => ({ kind: 'NETWORK' }));
        if (!live()) return 'RETRY';
        if (outcome.kind === 'CHANGED' || outcome.kind === 'CODE_REJECTED') return outcome.kind;
        const read = await reread();
        return read !== null && read.email.toLowerCase() === email.trim().toLowerCase() ? 'CHANGED' : 'RETRY';
      });
    },

    changePassword(password, newPassword) {
      return exclusive(async (): Promise<PasswordChangeResult> => {
        const outcome = await transport.changePassword(password, newPassword).catch((): PasswordChangeOutcome => ({ kind: 'NETWORK' }));
        if (!live()) return 'RETRY';
        return outcome.kind === 'FAILED' || outcome.kind === 'NETWORK' ? 'RETRY' : outcome.kind;
      });
    },

    signOutOtherDevices() {
      return exclusive(async (): Promise<SignOutOthersResult> => {
        const outcome = await transport.signOutOtherDevices().catch((): SignOutOthersOutcome => ({ kind: 'NETWORK' }));
        if (!live()) return 'RETRY';
        return outcome.kind === 'SIGNED_OUT_OTHERS' ? 'DONE' : 'RETRY';
      });
    },

    retire() {
      retired = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
      listeners.clear();
    },
  };
}
