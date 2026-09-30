/**
 * W3-MEGA-S — the reader's own Privacy & Data acts, for ONE runtime generation: Export My Data (E2E-D-16) and the
 * Personal-world Delete Account (E2E-D-17), exactly the W3-PDG-01 §7 / §8 journeys marked PO.
 *
 * It holds what General Settings shows — the export package's state and the account deletion's state — exactly as
 * the server read them, and it performs the reader's own requests. It owns no identity, no credential and no
 * persistence: the integration owner builds one per runtime generation over the account transport bound to that
 * identity and retires it with the generation. A password the reader types passes through once and is never kept.
 *
 * ## Nothing is guessed
 *
 *   - The state changes only on a server answer or a fresh read — never optimistically.
 *   - Each request carries ONE command identity until it is settled, so a retry after a lost answer is the same
 *     request and the database holds it once.
 *   - When a request has no usable answer, the state is READ before anything is said: the request is now held → it
 *     was accepted; otherwise → a retry is offered. A cancellation is judged the same way.
 *   - While a package is being prepared, the state is read again now and then, so "ready" arrives without the reader
 *     having to leave and come back. The server alone decides when it is ready and until when it stays available.
 *   - One act at a time: a second act while one is in flight is refused (`null`).
 */
import type { DeletionCancelOutcome, ExportDownloadOutcome, PrivacyRequestOutcome, PrivacyStateOutcome, PrivacyStateView } from '../runtime-entry';
import { mintPublicIdCommandId } from './public-id-controller';

export type PrivacyDataStatus = 'LOADING' | 'READY';

export interface PrivacyDataState {
  readonly status: PrivacyDataStatus;
  /** Present only when READY. */
  readonly view: PrivacyStateView | null;
}

export interface PrivacyDataTransport {
  readPrivacyState(): Promise<PrivacyStateOutcome>;
  requestDataExport(commandId: string, password: string): Promise<PrivacyRequestOutcome>;
  downloadDataExport(): Promise<ExportDownloadOutcome>;
  requestAccountDeletion(commandId: string, password: string): Promise<PrivacyRequestOutcome>;
  cancelAccountDeletion(): Promise<DeletionCancelOutcome>;
}

/** ACCEPTED: the request is held (now, or found held). RETRY: it is not known to be held. */
export type PrivacyRequestResult = 'ACCEPTED' | 'EMPTY' | 'PASSWORD_REJECTED' | 'RETRY';
export type DeletionCancelResult = 'CANCELLED' | 'NOT_CANCELLABLE' | 'RETRY';
export type ExportDownloadResult =
  | { readonly kind: 'READY'; readonly document: Record<string, unknown> }
  | { readonly kind: 'NOT_READY' }
  | { readonly kind: 'RETRY' };

export interface PrivacyDataController {
  getState(): PrivacyDataState;
  subscribe(listener: () => void): () => void;
  /**
   * Read the reader's state, asking again after a failure until it answers. Each later call (Settings shown again)
   * reads it once more; a call while the first read is still pending does nothing.
   */
  start(): void;
  requestExport(password: string): Promise<PrivacyRequestResult | null>;
  downloadExport(): Promise<ExportDownloadResult | null>;
  requestDeletion(password: string): Promise<PrivacyRequestResult | null>;
  cancelDeletion(): Promise<DeletionCancelResult | null>;
  retire(): void;
}

export interface PrivacyDataControllerOptions {
  readonly transport: PrivacyDataTransport;
  readonly isCurrent: () => boolean;
  readonly newCommandId?: () => string;
  readonly setTimer?: (tick: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

/** The pause before the next read after a failed one; the last value repeats. */
export const PRIVACY_READ_RETRY_DELAYS_MS: readonly number[] = Object.freeze([1_000, 2_000, 4_000, 8_000, 15_000]);
/** How often a package being prepared is read again. An implementation detail, not Product authority. */
export const PRIVACY_PREPARING_POLL_MS = 15_000;

const LOADING: PrivacyDataState = Object.freeze({ status: 'LOADING', view: null });

export function createPrivacyDataController({
  transport,
  isCurrent,
  newCommandId = mintPublicIdCommandId,
  setTimer = (tick, ms) => setTimeout(tick, ms),
  clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: PrivacyDataControllerOptions): PrivacyDataController {
  let state: PrivacyDataState = LOADING;
  let started = false;
  let retired = false;
  let attempts = 0;
  let timer: unknown = null;
  let poll: unknown = null;
  let busy = false;
  /** The unsettled command of each kind: a retry after a lost answer is the same request. */
  let exportCommand: string | null = null;
  let deletionCommand: string | null = null;
  const listeners = new Set<() => void>();
  const live = () => !retired && isCurrent();

  const watchPreparation = () => {
    if (poll !== null) clearTimer(poll);
    poll = null;
    if (live() && state.view?.export.status === 'PREPARING') {
      poll = setTimer(() => {
        poll = null;
        void reread();
      }, PRIVACY_PREPARING_POLL_MS);
    }
  };

  /** Counts every published view, so an unrequested read that an act's answer overtook is dropped, not shown. */
  let published = 0;
  const publish = (view: PrivacyStateView) => {
    published += 1;
    state = { status: 'READY', view };
    // A request the server shows as held is no longer unsettled: the next request is a new one.
    if (view.export.status === 'PREPARING' || view.export.status === 'READY') exportCommand = null;
    if (view.deletion.status !== 'NONE') deletionCommand = null;
    for (const listener of Array.from(listeners)) listener();
    watchPreparation();
  };

  const read = () => {
    if (!live() || state.status !== 'LOADING') return;
    attempts += 1;
    const delay = PRIVACY_READ_RETRY_DELAYS_MS[Math.min(attempts, PRIVACY_READ_RETRY_DELAYS_MS.length) - 1];
    void transport.readPrivacyState().then(
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

  /**
   * Read the canonical state and show it. An act's own read (after an answer that does not say what happened) is
   * always shown. An unrequested read (Settings shown again, the preparing poll) is dropped when an act is in flight
   * or has published since it was issued — its answer may predate that act. A failed read leaves the poll running.
   */
  async function reread(forAct = false): Promise<PrivacyStateView | null> {
    const issued = published;
    let outcome: PrivacyStateOutcome | null;
    try {
      outcome = await transport.readPrivacyState();
    } catch {
      outcome = null;
    }
    if (!live()) return null;
    if (outcome === null || outcome.kind !== 'READ' || (!forAct && (busy || published !== issued))) {
      if (poll === null) watchPreparation();
      return null;
    }
    publish(outcome.view);
    return outcome.view;
  }

  const exclusive = async <T>(act: () => Promise<T>): Promise<T | null> => {
    if (!live() || busy || state.status !== 'READY') return null;
    busy = true;
    try {
      return await act();
    } finally {
      busy = false;
    }
  };

  const withView = (patch: Partial<PrivacyStateView>) => {
    if (state.view !== null) publish({ ...state.view, ...patch });
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
      if (!live()) return;
      if (!started) {
        started = true;
        read();
        return;
      }
      // Shown again: the server's state moves on its own (a package becomes ready, a deletion falls due), so it is read
      // again — never while an act is in flight, whose own answer decides what is said.
      if (state.status === 'READY' && !busy) void reread();
    },

    requestExport(password) {
      return exclusive(async (): Promise<PrivacyRequestResult> => {
        if (password === '') return 'EMPTY';
        exportCommand ??= newCommandId();
        const outcome = await transport.requestDataExport(exportCommand, password).catch((): PrivacyRequestOutcome => ({ kind: 'NETWORK' }));
        if (!live()) return 'RETRY';
        if (outcome.kind === 'PASSWORD_REJECTED') return 'PASSWORD_REJECTED';
        if (outcome.kind === 'ACCEPTED' && 'availableUntil' in outcome.view) {
          exportCommand = null;
          withView({ export: outcome.view });
          return 'ACCEPTED';
        }
        const read = await reread(true);
        if (read !== null && (read.export.status === 'PREPARING' || read.export.status === 'READY')) {
          exportCommand = null;
          return 'ACCEPTED';
        }
        return 'RETRY';
      });
    },

    downloadExport() {
      return exclusive(async (): Promise<ExportDownloadResult> => {
        const outcome = await transport.downloadDataExport().catch((): ExportDownloadOutcome => ({ kind: 'NETWORK' }));
        if (!live()) return { kind: 'RETRY' };
        if (outcome.kind === 'READY') return { kind: 'READY', document: outcome.document };
        await reread(true);
        return outcome.kind === 'NOT_READY' ? { kind: 'NOT_READY' } : { kind: 'RETRY' };
      });
    },

    requestDeletion(password) {
      return exclusive(async (): Promise<PrivacyRequestResult> => {
        if (password === '') return 'EMPTY';
        deletionCommand ??= newCommandId();
        const outcome = await transport.requestAccountDeletion(deletionCommand, password).catch((): PrivacyRequestOutcome => ({ kind: 'NETWORK' }));
        if (!live()) return 'RETRY';
        if (outcome.kind === 'PASSWORD_REJECTED') return 'PASSWORD_REJECTED';
        if (outcome.kind === 'ACCEPTED' && 'finalAt' in outcome.view) {
          deletionCommand = null;
          withView({ deletion: outcome.view });
          return 'ACCEPTED';
        }
        if (outcome.kind === 'CANCELLED') deletionCommand = null;
        const read = await reread(true);
        if (read !== null && read.deletion.status !== 'NONE') {
          deletionCommand = null;
          return 'ACCEPTED';
        }
        return 'RETRY';
      });
    },

    cancelDeletion() {
      return exclusive(async (): Promise<DeletionCancelResult> => {
        const outcome = await transport.cancelAccountDeletion().catch((): DeletionCancelOutcome => ({ kind: 'NETWORK' }));
        if (!live()) return 'RETRY';
        if (outcome.kind === 'CANCELLED' || outcome.kind === 'NONE') {
          deletionCommand = null;
          withView({ deletion: { status: 'NONE', finalAt: null } });
          return 'CANCELLED';
        }
        const read = await reread(true);
        if (read !== null && read.deletion.status === 'NONE') deletionCommand = null;
        if (outcome.kind === 'NOT_CANCELLABLE') return 'NOT_CANCELLABLE';
        return read !== null && read.deletion.status === 'NONE' ? 'CANCELLED' : 'RETRY';
      });
    },

    retire() {
      retired = true;
      if (timer !== null) clearTimer(timer);
      if (poll !== null) clearTimer(poll);
      timer = null;
      poll = null;
      listeners.clear();
    },
  };
}
