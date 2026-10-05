/**
 * S4-01 — the reader's own Shared ID, for THIS identity (P1 §5.1; W3-PDG-01 §4).
 *
 * The server provisions it on the first read while Shared is open, holds it sealed, and shows it only to its owner.
 * Regeneration is one command that a retry reuses: a lost answer is reconciled by the server's committed truth, never a
 * second regeneration. After regeneration the old value is never shown again (W3-PDG-01 §4). Retired with the generation.
 */
import type { SharedIdentityResult } from '../runtime-entry';
import { mintSharedCommandId } from './shared-world-controller';

export interface SharedIdTransport {
  identity(): Promise<SharedIdentityResult>;
  regenerate(commandId: string): Promise<SharedIdentityResult>;
}

export interface SharedIdState {
  /** NOT_OPEN: Shared is not open yet and no Shared ID exists. UNAVAILABLE: it could not be read now. */
  readonly status: 'IDLE' | 'LOADING' | 'READY' | 'NOT_OPEN' | 'UNAVAILABLE';
  readonly sharedId: string | null;
  readonly regenerating: boolean;
}

export interface SharedIdController {
  getState(): SharedIdState;
  subscribe(listener: () => void): () => void;
  start(): void;
  /** True when a new Shared ID is in place. */
  regenerate(): Promise<boolean>;
  retire(): void;
}

export function createSharedIdController(options: {
  readonly transport: SharedIdTransport;
  readonly isCurrent: () => boolean;
  readonly newCommandId?: () => string;
}): SharedIdController {
  const { transport, isCurrent } = options;
  const newCommandId = options.newCommandId ?? mintSharedCommandId;
  const listeners = new Set<() => void>();
  let state: SharedIdState = { status: 'IDLE', sharedId: null, regenerating: false };
  let retired = false;
  let pendingCommand: string | null = null;
  const live = () => !retired && isCurrent();
  const publish = (next: SharedIdState) => {
    if (!live()) return;
    state = next;
    for (const listener of Array.from(listeners)) listener();
  };
  const apply = (result: SharedIdentityResult) => {
    if (result.kind === 'READY') publish({ status: 'READY', sharedId: result.sharedId, regenerating: false });
    else if (result.kind === 'NOT_OPEN') publish({ status: 'NOT_OPEN', sharedId: null, regenerating: false });
    else publish({ ...state, status: state.sharedId === null ? 'UNAVAILABLE' : state.status, regenerating: false });
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (state.status === 'LOADING') return;
      publish({ ...state, status: state.sharedId === null ? 'LOADING' : state.status });
      void transport.identity().then(apply);
    },
    async regenerate() {
      if (state.regenerating) return false;
      const before = state.sharedId;
      pendingCommand = pendingCommand ?? newCommandId();
      publish({ ...state, regenerating: true });
      const result = await transport.regenerate(pendingCommand);
      if (result.kind !== 'UNAVAILABLE') pendingCommand = null;
      apply(result);
      return result.kind === 'READY' && result.sharedId !== before;
    },
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
