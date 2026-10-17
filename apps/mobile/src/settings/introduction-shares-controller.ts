/**
 * S6-06 (CP2) — «ما شاركته في التعارف» / What I shared in Introductions, in General Settings → Privacy & Data (P16):
 * everything the reader shared in every Introduction they are one of the two humans of — live, ended or continued as a
 * Shared World — so deleting a share and going back to their first name are always reachable (correction 4), even after
 * END and after SUCCESS, when the World itself no longer offers them.
 *
 * Read only when the page is opened. Only the reader's own shares and their own display choice; nothing of the other
 * person but the first name the server presents. A text share is deleted through the existing Shared owner deletion;
 * a photo is removed whole (every shared stage, D-05). A lost answer keeps its command id.
 */
import { mintIntroductionsCommandId } from '../introductions/introductions-controller';
import type { IntroductionRemoveResult, IntroductionRevokeResult, IntroductionSharesRead, IntroductionSharesWorld, SharedDeleteResult } from '../runtime-entry';

export interface IntroductionSharesTransport {
  shares(): Promise<IntroductionSharesRead>;
  removeImage(worldId: string, commandId: string, seriesId: string): Promise<IntroductionRemoveResult>;
  revokeDisplayName(worldId: string, commandId: string): Promise<IntroductionRevokeResult>;
}
export interface IntroductionSharesDeletionTransport {
  deleteMaterial(worldId: string, materialId: string, commandId: string): Promise<SharedDeleteResult>;
}

export interface IntroductionSharesState {
  readonly status: 'IDLE' | 'LOADING' | 'READY' | 'FAILED' | 'OFFLINE';
  readonly worlds: readonly IntroductionSharesWorld[];
  /** The one act in flight, by what it acts on. */
  readonly busy: string | null;
  readonly notice: 'DELETED' | 'REMOVED' | 'REVOKED' | 'FAILED' | null;
}

export interface IntroductionSharesController {
  getState(): IntroductionSharesState;
  subscribe(listener: () => void): () => void;
  open(): void;
  deleteText(worldId: string, materialId: string): Promise<boolean>;
  removePhoto(worldId: string, seriesId: string): Promise<boolean>;
  revokeDisplay(worldId: string): Promise<boolean>;
  dismissNotice(): void;
  retire(): void;
}

export interface IntroductionSharesControllerOptions {
  readonly transport: IntroductionSharesTransport;
  readonly deletion: IntroductionSharesDeletionTransport;
  readonly isCurrent: () => boolean;
  readonly newCommandId?: () => string;
}

const INITIAL: IntroductionSharesState = Object.freeze({ status: 'IDLE', worlds: Object.freeze([]), busy: null, notice: null });

export function createIntroductionSharesController({ transport, deletion, isCurrent, newCommandId = mintIntroductionsCommandId }: IntroductionSharesControllerOptions): IntroductionSharesController {
  let state = INITIAL;
  let retired = false;
  let reads = 0;
  const lost = new Map<string, string>();
  const listeners = new Set<() => void>();
  const live = () => !retired && isCurrent();
  const publish = (next: Partial<IntroductionSharesState>) => {
    if (!live()) return;
    state = Object.freeze({ ...state, ...next });
    for (const listener of listeners) listener();
  };
  const read = () => {
    const mine = ++reads;
    publish({ status: state.status === 'READY' ? 'READY' : 'LOADING' });
    void transport.shares().then((answer) => {
      if (mine !== reads) return;
      if (answer.kind === 'READY') publish({ status: 'READY', worlds: answer.worlds });
      // A failed re-read keeps what was read moments ago; a first read that fails shows nothing.
      else if (state.status !== 'READY') publish({ status: answer.kind, worlds: Object.freeze([]) });
    });
  };
  const act = async (key: string, run: (id: string) => Promise<'DONE' | 'REFUSED' | 'UNKNOWN'>, done: IntroductionSharesState['notice']): Promise<boolean> => {
    if (!live() || state.busy !== null) return false;
    const id = lost.get(key) ?? newCommandId();
    lost.set(key, id);
    publish({ busy: key, notice: null });
    const answer = await run(id);
    if (answer !== 'UNKNOWN') lost.delete(key);
    publish({ busy: null, notice: answer === 'DONE' ? done : 'FAILED' });
    read();
    return answer === 'DONE';
  };
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open() {
      publish({ notice: null });
      read();
    },
    deleteText(worldId, materialId) {
      return act(`DELETE|${worldId}|${materialId}`, async (id) => {
        const answer = await deletion.deleteMaterial(worldId, materialId, id);
        return answer.kind === 'DELETED' ? 'DONE' : answer.kind === 'UNAVAILABLE' ? 'UNKNOWN' : 'REFUSED';
      }, 'DELETED');
    },
    removePhoto(worldId, seriesId) {
      return act(`REMOVE|${worldId}|${seriesId}`, async (id) => {
        const answer = await transport.removeImage(worldId, id, seriesId);
        return answer.kind === 'REMOVED' ? 'DONE' : answer.kind === 'FAILED' || answer.kind === 'OFFLINE' ? 'UNKNOWN' : 'REFUSED';
      }, 'REMOVED');
    },
    revokeDisplay(worldId) {
      return act(`REVOKE|${worldId}`, async (id) => {
        const answer = await transport.revokeDisplayName(worldId, id);
        return answer.kind === 'REVOKED' ? 'DONE' : answer.kind === 'FAILED' || answer.kind === 'OFFLINE' ? 'UNKNOWN' : 'REFUSED';
      }, 'REVOKED');
    },
    dismissNotice() {
      if (state.notice !== null) publish({ notice: null });
    },
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
