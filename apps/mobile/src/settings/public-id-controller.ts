/**
 * W3-02 (E2E-D-09) — the reader's Public ID and its ONE lifetime manual change, for ONE runtime generation.
 *
 * It holds what General Settings shows — the canonical Public ID and whether the one change is still
 * available — exactly as the server decided it. It owns no identity, no credential and no persistence;
 * the integration owner builds one per runtime generation over the account transport bound to that
 * identity and retires it with the generation.
 *
 * ## The one change is never guessed
 *
 *   - Nothing is consumed before the server says so: the state changes only on a server answer or a read.
 *   - ONE command identity per requested value. A retry of the same value reuses it, so a request whose
 *     answer was lost and a retry of it are the same command: the database commits it once and answers
 *     the replay with the committed truth. A different value is a different command.
 *   - When a change request has no usable answer, the canonical state is READ before anything is said:
 *       the one change is now used  → the change is over (this command's, or another's), and the read
 *                                     value is shown — never a false failure;
 *       the change is still there   → it did not commit, and a retry is offered;
 *       the read fails too          → still unknown: a retry is offered, and it is the SAME command.
 *   - One commit at a time: a second confirm while one is in flight is refused.
 */
import type { AccountPublicIdOutcome, AccountPublicIdView, PublicIdChangeOutcome } from '../runtime-entry';
import { isWellFormedPublicId, normalizePublicId } from './public-id';

export type PublicIdStatus = 'LOADING' | 'READY';

export interface PublicIdState {
  readonly status: PublicIdStatus;
  /** The canonical Public ID (without `@`), present only when READY. */
  readonly publicId: string | null;
  readonly changeAvailable: boolean;
}

export interface PublicIdTransport {
  readPublicId(): Promise<AccountPublicIdOutcome>;
  changePublicId(commandId: string, publicId: string): Promise<PublicIdChangeOutcome>;
}

/**
 * What a confirm came to, for the change surface:
 *   DONE         the change is over — committed now, or found committed, or already used; show the state;
 *   UNCHANGED    the value is the current Public ID; nothing was consumed;
 *   INVALID      it can never be a Public ID;
 *   UNAVAILABLE  another account holds it;
 *   RETRY        it did not commit, or it is not known whether it did: a retry is the same command.
 */
export type PublicIdCommitResult = 'DONE' | 'UNCHANGED' | 'INVALID' | 'UNAVAILABLE' | 'RETRY';

export interface PublicIdController {
  getState(): PublicIdState;
  subscribe(listener: () => void): () => void;
  /** Read the reader's Public ID once, asking again after a failure until it answers. Idempotent. */
  start(): void;
  /** The one lifetime change. A second confirm while one is in flight is refused (`null`), and so is one before READY. */
  commit(requested: string): Promise<PublicIdCommitResult | null>;
  retire(): void;
}

export interface PublicIdControllerOptions {
  readonly transport: PublicIdTransport;
  readonly isCurrent: () => boolean;
  readonly newCommandId?: () => string;
  readonly setTimer?: (tick: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

/** The pause before the next read after a failed one; the last value repeats. */
export const PUBLIC_ID_READ_RETRY_DELAYS_MS: readonly number[] = Object.freeze([1_000, 2_000, 4_000, 8_000, 15_000]);

/**
 * A command identity: UUID-shaped, unique per logical change within this account. It is never a
 * credential and carries no reader data. Uniqueness is needed only within the one account (the database
 * compares it with that account's own committed command), so no cryptographic source is required.
 */
export function mintPublicIdCommandId(): string {
  const hex = (count: number) => Array.from({ length: count }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const variant = (8 + Math.floor(Math.random() * 4)).toString(16);
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}

const LOADING: PublicIdState = Object.freeze({ status: 'LOADING', publicId: null, changeAvailable: false });

export function createPublicIdController({
  transport,
  isCurrent,
  newCommandId = mintPublicIdCommandId,
  setTimer = (tick, ms) => setTimeout(tick, ms),
  clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: PublicIdControllerOptions): PublicIdController {
  let state: PublicIdState = LOADING;
  let started = false;
  let retired = false;
  let attempts = 0;
  let timer: unknown = null;
  let committing = false;
  /** The command that owns the value the reader last confirmed and that has not been settled. */
  let command: { readonly value: string; readonly id: string } | null = null;
  const listeners = new Set<() => void>();
  const live = () => !retired && isCurrent();

  const publish = (view: AccountPublicIdView) => {
    state = { status: 'READY', publicId: view.publicId, changeAvailable: view.changeAvailable };
    for (const listener of Array.from(listeners)) listener();
  };

  const read = () => {
    if (!live() || state.status !== 'LOADING') return;
    attempts += 1;
    const delay = PUBLIC_ID_READ_RETRY_DELAYS_MS[Math.min(attempts, PUBLIC_ID_READ_RETRY_DELAYS_MS.length) - 1];
    void transport.readPublicId().then(
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

  /** After an answer that does not say what happened: read the canonical state, and say only that. */
  const reconcile = async (): Promise<PublicIdCommitResult> => {
    let outcome: AccountPublicIdOutcome;
    try {
      outcome = await transport.readPublicId();
    } catch {
      return 'RETRY';
    }
    if (!live() || outcome.kind !== 'READ') return 'RETRY';
    publish(outcome.view);
    if (!outcome.view.changeAvailable) {
      command = null;
      return 'DONE';
    }
    return 'RETRY';
  };

  const settle = async (value: string): Promise<PublicIdCommitResult> => {
    if (command === null || command.value !== value) command = { value, id: newCommandId() };
    const outcome = await transport.changePublicId(command.id, value).catch((): PublicIdChangeOutcome => ({ kind: 'NETWORK' }));
    if (!live()) return 'RETRY';
    if (outcome.kind === 'CONFLICT') {
      // This identity is spent on another value: never reuse it, and learn what is true first.
      command = null;
      return reconcile();
    }
    if (outcome.kind !== 'ANSWERED') return reconcile();
    publish(outcome.view);
    switch (outcome.answer) {
      case 'CHANGED':
      case 'ALREADY_USED':
        command = null;
        return 'DONE';
      case 'UNCHANGED':
        command = null;
        return 'UNCHANGED';
      case 'INVALID':
        return 'INVALID';
      case 'UNAVAILABLE':
        return 'UNAVAILABLE';
    }
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
    async commit(requested) {
      if (!live() || committing || state.status !== 'READY') return null;
      const value = normalizePublicId(requested);
      // Told at once, without a request: this can never be a Public ID (the database's own rule).
      if (!isWellFormedPublicId(value)) return 'INVALID';
      committing = true;
      try {
        return await settle(value);
      } finally {
        committing = false;
      }
    },
    retire() {
      retired = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
      listeners.clear();
    },
  };
}
