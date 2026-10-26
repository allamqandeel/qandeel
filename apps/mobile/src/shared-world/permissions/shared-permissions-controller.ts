/**
 * S8A-04 CP3-C — the owner's permissions for their own knowledge in ONE open Shared World: the private request, what they
 * allowed, what waits for their answer because the audience grew, what they declined or withdrew, and what ended.
 *
 * It holds the reader's OWN state only, for the exact open World, and is never authority: every open, every return to the
 * World's conversation and every answer reads the server again; an answer for another World or an earlier read is
 * dropped. A command is minted once per logical act (the act, its item or request and the audience reference it was
 * answered about) and reused only when the same act is retried after no answer; a new audience is a new act.
 *
 * AUDIENCE_CHANGED (a member joined or left while the reader looked) re-reads at once, so the reader is shown the new
 * list and answers about THAT one; nothing was written. A REFUSED act (nothing left to act on) re-reads too. No act here
 * notifies anyone, posts anything or reaches the conversation: these are the reader's own decisions.
 */
import type {
  SharedPermissionAllowResult, SharedPermissionAnswerResult, SharedPermissions, SharedPermissionsResult, SharedPermissionWithdrawResult,
} from '../../runtime-entry';

export interface SharedPermissionsTransport {
  permissions(worldId: string): Promise<SharedPermissionsResult>;
  answerPermission(worldId: string, requestId: string, commandId: string, decision: 'ALLOW' | 'DECLINE', audienceRef: string | null): Promise<SharedPermissionAnswerResult>;
  allowPermission(worldId: string, itemId: string, commandId: string, audienceRef: string): Promise<SharedPermissionAllowResult>;
  withdrawPermission(worldId: string, itemId: string, commandId: string): Promise<SharedPermissionWithdrawResult>;
}

/** What the reader's last act did, said with the CG-2 confirmations; FAILED is the S4-01 "That didn't work right now". */
export type SharedPermissionsNotice = 'ALLOWED' | 'DECLINED' | 'FAILED' | null;

export interface SharedPermissionsState {
  readonly worldId: string | null;
  readonly status: 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE';
  readonly data: SharedPermissions | null;
  /** The act in flight (`answer|<requestId>`, `allow|<itemId>`, `withdraw|<itemId>`), or null. */
  readonly busy: string | null;
  readonly notice: SharedPermissionsNotice;
}

export interface SharedPermissionsController {
  getState(): SharedPermissionsState;
  subscribe(listener: () => void): () => void;
  /** Read the reader's permissions in ONE World whose entry is ALLOW now (again, when it is already the open one). Called by
   *  the Shared area after the World's conversation or Manage World was read — never by a surface, never before ALLOW. */
  open(worldId: string): void;
  /** Hold nothing of any World. */
  close(): void;
  /** CG-1 / CG-2: Allow (over the members the reader is shown now) or No, for one open request. */
  answer(requestId: string, decision: 'ALLOW' | 'DECLINE'): Promise<SharedPermissionAnswerResult['kind'] | null>;
  /** CG-4 «اسمح الآن» / CG-3 «اسمح للجميع»: over the members the reader is shown now. */
  allow(itemId: string): Promise<SharedPermissionAllowResult['kind'] | null>;
  /** CG-4 «اسحب» / CG-3 «أوقف استخدامها». */
  withdraw(itemId: string): Promise<SharedPermissionWithdrawResult['kind'] | null>;
  retire(): void;
}

export interface SharedPermissionsControllerOptions {
  readonly transport: SharedPermissionsTransport;
  readonly isCurrent: () => boolean;
  readonly newCommandId: () => string;
}

const CLOSED: SharedPermissionsState = Object.freeze({ worldId: null, status: 'IDLE', data: null, busy: null, notice: null });

export function createSharedPermissionsController({ transport, isCurrent, newCommandId }: SharedPermissionsControllerOptions): SharedPermissionsController {
  const listeners = new Set<() => void>();
  let state: SharedPermissionsState = CLOSED;
  let retired = false;
  let readTicket = 0;
  const commands = new Map<string, string>();
  const live = () => !retired && isCurrent();
  const publish = (next: Partial<SharedPermissionsState>) => {
    if (!live()) return;
    state = Object.freeze({ ...state, ...next });
    for (const listener of Array.from(listeners)) listener();
  };
  const commandFor = (key: string): string => {
    const held = commands.get(key);
    if (held !== undefined) return held;
    const minted = newCommandId();
    commands.set(key, minted);
    return minted;
  };

  async function read(worldId: string): Promise<void> {
    const ticket = ++readTicket;
    if (state.data === null) publish({ status: 'LOADING' });
    const result = await transport.permissions(worldId).catch((): SharedPermissionsResult => ({ kind: 'UNAVAILABLE' }));
    if (ticket !== readTicket || state.worldId !== worldId) return;
    if (result.kind === 'READ') { publish({ status: 'READY', data: result.permissions }); return; }
    // Not the reader's World now: nothing of it stays. The Shared area owns what the reader sees of the World itself.
    if (result.kind === 'DENIED') { publish({ status: 'UNAVAILABLE', data: null, notice: null }); return; }
    publish({ status: state.data === null ? 'UNAVAILABLE' : state.status });
  }

  /** One act on the open World: busy while in flight, its command kept until the server answers it. */
  async function act<K extends string>(key: string, work: (worldId: string, commandId: string) => Promise<{ readonly kind: K }>,
    onAnswer: (kind: K) => SharedPermissionsNotice): Promise<K | null> {
    const worldId = state.worldId;
    if (worldId === null || state.busy !== null) return null;
    publish({ busy: key, notice: null });
    const result = await work(worldId, commandFor(key)).catch((): { readonly kind: K } => ({ kind: 'UNAVAILABLE' as K }));
    if (state.worldId !== worldId) return null;
    if (result.kind !== 'UNAVAILABLE') commands.delete(key);
    publish({ busy: null, notice: onAnswer(result.kind) });
    if (result.kind !== 'UNAVAILABLE') void read(worldId);
    return result.kind;
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    open(worldId) {
      if (state.worldId !== worldId) {
        readTicket += 1;
        publish({ ...CLOSED, worldId, status: 'LOADING' });
      } else if (state.notice !== null) {
        // A confirmation belongs to the act on the screen it was made on; another screen never repeats it.
        publish({ notice: null });
      }
      void read(worldId);
    },
    close() {
      readTicket += 1;
      publish(CLOSED);
    },
    answer(requestId, decision) {
      const audienceRef = state.data?.audienceRef ?? null;
      if (decision === 'ALLOW' && audienceRef === null) return Promise.resolve(null);
      return act(`answer|${requestId}|${decision}|${decision === 'ALLOW' ? audienceRef : ''}`,
        (worldId, commandId) => transport.answerPermission(worldId, requestId, commandId, decision, decision === 'ALLOW' ? audienceRef : null),
        (kind) => (kind === 'ALLOWED' ? 'ALLOWED' : kind === 'DECLINED' ? 'DECLINED' : kind === 'UNAVAILABLE' ? 'FAILED' : null));
    },
    allow(itemId) {
      const audienceRef = state.data?.audienceRef ?? null;
      if (audienceRef === null) return Promise.resolve(null);
      return act(`allow|${itemId}|${audienceRef}`, (worldId, commandId) => transport.allowPermission(worldId, itemId, commandId, audienceRef),
        (kind) => (kind === 'ALLOWED' ? 'ALLOWED' : kind === 'UNAVAILABLE' ? 'FAILED' : null));
    },
    withdraw(itemId) {
      return act(`withdraw|${itemId}`, (worldId, commandId) => transport.withdrawPermission(worldId, itemId, commandId),
        (kind) => (kind === 'UNAVAILABLE' ? 'FAILED' : null));
    },
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
