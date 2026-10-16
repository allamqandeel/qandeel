/**
 * S6-05 (CP5) — a human's own Introduction Worlds, for ONE runtime generation: the list both humans find them in, and the
 * one World open now — its human words while the Introduction lives, its one unilateral END, and after END the closed
 * history this human's own entitlement keeps.
 *
 * It holds exactly what the server answered and nothing it has not been told. No identity, credential or persistence of
 * its own: the integration owner builds one per runtime generation and retires it with the generation, so nothing of one
 * account reaches the next. Every answer is bound to the World it was asked about and to the opening it belongs to: an
 * answer about a World that is no longer open, or about an earlier opening of the same World, is dropped — so no word of
 * one World is ever laid over another.
 *
 *   - Reads happen when asked: entering «العالم المشترك» or the proposals, opening a World, the app returning to the
 *     foreground, and after the reader's own send, END or deletion. Nothing polls.
 *   - The authority to show a World is the server's read of it, never the list: until that read answers, nothing of the
 *     World — not even the other person's name — is drawn (S13). UNAVAILABLE clears everything (S14).
 *   - A message, an END and a deletion whose answer was lost are asked again with the SAME command id, so the server
 *     decides each once. One message and one END at a time.
 *   - The ENDED state of a send is shown only when the server itself answered it (IW-35): a network failure, a timeout, a
 *     5xx or a doubtful body leaves the message unsent with its retry, never "ended".
 *   - One World is open at a time for the whole generation: the hosts (the proposals and «العالم المشترك») never draw
 *     the Introduction surface at the same time (DepthComposition shows one area or the other).
 *   - A message or an END whose answer was lost keeps its command id for that World for the whole generation, across
 *     leaving and re-opening it, so a later retry is still the same request.
 *   - Nothing here reaches QANDEEL's reply, weaving, Living Analysis, Activity or Push: an Introduction is the two humans'
 *     words only (R-1, R-7). Deletion is the existing Shared owner deletion (R-5).
 */
import type {
  ForegroundSignal, IntroductionEndResult, IntroductionHistoryRead, IntroductionMessage, IntroductionMessageCursor, IntroductionMessagesRead,
  IntroductionSendResult, IntroductionWorld, IntroductionWorldsRead, SharedDeleteResult,
} from '../runtime-entry';
import { mintIntroductionsCommandId } from './introductions-controller';

export interface IntroductionWorldsTransport {
  list(): Promise<IntroductionWorldsRead>;
  messages(worldId: string, before: IntroductionMessageCursor | null): Promise<IntroductionMessagesRead>;
  history(worldId: string, before: IntroductionMessageCursor | null): Promise<IntroductionHistoryRead>;
  send(worldId: string, commandId: string, content: string): Promise<IntroductionSendResult>;
  end(worldId: string, commandId: string): Promise<IntroductionEndResult>;
}
/** The existing Shared owner deletion (R-5): the reader's own words only, decided by the server. */
export interface IntroductionDeletionTransport {
  deleteMaterial(worldId: string, materialId: string, commandId: string): Promise<SharedDeleteResult>;
}

/** The one message on its way: SENDING; FAILED / OFFLINE — not known to be sent, retried with the same id; ENDED — the server said so (IW-35). */
export interface IntroductionPending { readonly text: string; readonly status: 'SENDING' | 'FAILED' | 'OFFLINE' | 'ENDED' }
export type IntroductionWorldNotice = 'ALREADY_ENDED' | 'DELETED' | 'DELETE_FAILED' | 'OLDER_FAILED' | 'LOAD_FAILED' | null;

export interface IntroductionWorldView {
  readonly worldId: string;
  /**
   * LOADING — no authorized read yet (S13). ACTIVE — the live conversation. CLOSED — the closed record after END (S12).
   * UNAVAILABLE — not this reader's, or no longer an Introduction (S14). FAILED — no usable answer yet; retry.
   */
  readonly status: 'LOADING' | 'ACTIVE' | 'CLOSED' | 'UNAVAILABLE' | 'FAILED';
  /** Oldest first. */
  readonly messages: readonly IntroductionMessage[];
  readonly hasOlder: boolean;
  readonly loadingOlder: boolean;
  readonly pending: IntroductionPending | null;
  /** The reader's END: RUNNING (IW-30), FAILED (not known; retried with the same id). */
  readonly end: 'IDLE' | 'RUNNING' | 'FAILED';
  readonly deleting: string | null;
  readonly notice: IntroductionWorldNotice;
}

export interface IntroductionWorldsState {
  readonly list: { readonly status: 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE' | 'OFFLINE'; readonly worlds: readonly IntroductionWorld[] };
  readonly open: IntroductionWorldView | null;
}

export interface IntroductionWorldsController {
  getState(): IntroductionWorldsState;
  subscribe(listener: () => void): () => void;
  /** Read the list afresh, and the open World with it. */
  refresh(): void;
  /** Open one World: nothing of it is drawn until the server's read of it answers. */
  open(worldId: string): void;
  /** Read the open World again (the retry of a failed read). */
  reload(): void;
  close(): void;
  loadOlder(): void;
  /** One message; true once it is on its way (the composer may clear: the words now stand as the pending message). */
  send(text: string): boolean;
  /** The pending message again, with the SAME command id. */
  retrySend(): void;
  /** The reader's own END, alone and without the other's consent (S6-02). A lost answer is retried with the SAME id. */
  endIntroduction(): Promise<IntroductionEndResult['kind'] | null>;
  /** The reader's own message, through the existing Shared owner deletion (R-5). */
  deleteMessage(materialId: string): Promise<boolean>;
  dismissNotice(): void;
  retire(): void;
}

export interface IntroductionWorldsControllerOptions {
  readonly transport: IntroductionWorldsTransport;
  readonly deletion: IntroductionDeletionTransport;
  readonly isCurrent: () => boolean;
  /** Returning to the foreground re-reads the list and the open World. */
  readonly foreground?: ForegroundSignal;
  readonly newCommandId?: () => string;
}

/** One message as drawn, at most this long (the server's own bound, migration 0160). */
export const INTRODUCTION_MESSAGE_MAX_LENGTH = 20000;

const EMPTY: readonly IntroductionMessage[] = Object.freeze([]);
const INITIAL: IntroductionWorldsState = Object.freeze({ list: Object.freeze({ status: 'IDLE', worlds: Object.freeze([]) }), open: null });
const fresh = (worldId: string): IntroductionWorldView => Object.freeze({
  worldId, status: 'LOADING', messages: EMPTY, hasOlder: false, loadingOlder: false, pending: null, end: 'IDLE', deleting: null, notice: null,
});

/** An instant to the microsecond the server keeps: the millisecond, then the three digits `Date.parse` drops. */
const instantOf = (value: string): readonly [number, number] => {
  const fraction = /\.(\d{1,6})/u.exec(value)?.[1] ?? '';
  return [Date.parse(value), Number(fraction.padEnd(6, '0').slice(3))];
};
/** Strictly older than `than` in the server's order (instant to the microsecond, then identity). */
const isOlder = (a: IntroductionMessage, than: IntroductionMessage): boolean => {
  const [am, au] = instantOf(a.establishedAt);
  const [bm, bu] = instantOf(than.establishedAt);
  return am < bm || (am === bm && (au < bu || (au === bu && a.materialId < than.materialId)));
};

/**
 * The newest page laid over what the reader holds. Inside the page's span only the page speaks — so a message deleted
 * since is gone; what the reader holds strictly older than the page is kept when the page says older messages exist.
 */
function merge(page: { readonly messages: readonly IntroductionMessage[]; readonly hasOlder: boolean },
  held: readonly IntroductionMessage[], heldHasOlder: boolean): { readonly messages: readonly IntroductionMessage[]; readonly hasOlder: boolean } {
  const oldest = page.messages[0];
  if (!page.hasOlder || oldest === undefined) return { messages: Object.freeze([...page.messages]), hasOlder: page.hasOlder };
  const ids = new Set(page.messages.map((m) => m.materialId));
  const kept = held.filter((m) => !ids.has(m.materialId) && isOlder(m, oldest));
  return { messages: Object.freeze([...kept, ...page.messages]), hasOlder: kept.length > 0 ? heldHasOlder : true };
}

export function createIntroductionWorldsController({
  transport, deletion, isCurrent, foreground, newCommandId = mintIntroductionsCommandId,
}: IntroductionWorldsControllerOptions): IntroductionWorldsController {
  let state = INITIAL;
  let retired = false;
  const listeners = new Set<() => void>();
  const live = () => !retired && isCurrent();
  const publish = (next: IntroductionWorldsState) => {
    if (!live()) return;
    state = Object.freeze(next);
    for (const listener of listeners) listener();
  };
  let lists = 0;
  /** One number per opening: an answer about an earlier opening (or another World) is never applied. */
  let opening = 0;
  let reads = 0;
  /** Per World, the message whose answer is not known yet — its words and command id — until the server answers it. */
  const unsent = new Map<string, { readonly id: string; readonly text: string }>();
  /** Per World, the END command id whose answer is not known yet. */
  const ends = new Map<string, string>();
  /** The last deletion whose answer was lost: retried with the same id when the reader deletes exactly that message again. */
  let pendingDelete: { readonly materialId: string; readonly id: string } | null = null;

  /** Apply `next` to the open World only if it is still the same opening of the same World. */
  const patch = (token: number, worldId: string, next: Partial<IntroductionWorldView>) => {
    const open = state.open;
    if (token !== opening || open === null || open.worldId !== worldId) return;
    publish({ ...state, open: Object.freeze({ ...open, ...next }) });
  };
  const current = (token: number, worldId: string): IntroductionWorldView | null =>
    (token === opening && state.open !== null && state.open.worldId === worldId ? state.open : null);

  const readList = () => {
    const read = ++lists;
    publish({ ...state, list: Object.freeze({ ...state.list, status: state.list.status === 'READY' ? 'READY' : 'LOADING' }) });
    void transport.list().then((answer) => {
      if (read !== lists) return;
      publish({ ...state, list: Object.freeze(answer.kind === 'READ'
        ? { status: 'READY', worlds: answer.worlds }
        // A failed read shows nothing it cannot vouch for.
        : { status: answer.kind, worlds: Object.freeze([]) }) });
    });
  };

  /** Read the open World's newest page — the live conversation, or after END the closed history. */
  const readOpen = async (token: number, worldId: string): Promise<void> => {
    const view = current(token, worldId);
    if (view === null) return;
    const read = ++reads;
    if (view.status !== 'CLOSED') {
      const answer = await transport.messages(worldId, null);
      const now = current(token, worldId);
      if (now === null || read !== reads) return;
      if (answer.kind === 'PAGE') {
        patch(token, worldId, { status: 'ACTIVE', ...merge(answer, now.status === 'ACTIVE' ? now.messages : EMPTY, now.hasOlder) });
        return;
      }
      if (answer.kind === 'UNAVAILABLE') {
        patch(token, worldId, { ...fresh(worldId), status: 'UNAVAILABLE' });
        return;
      }
      if (answer.kind !== 'ENDED') {
        // A failed re-read keeps what was authorized moments ago; a first read that fails shows nothing of the World.
        if (now.status === 'LOADING') patch(token, worldId, { status: 'FAILED' });
        return;
      }
      // The server says this human's Introduction has ended: the closed record is read from their own entitlement.
      patch(token, worldId, { status: 'CLOSED', messages: EMPTY, hasOlder: false, end: 'IDLE', pending: closedPending(now.pending, worldId) });
      readList();
      return readOpen(token, worldId);
    }
    const answer = await transport.history(worldId, null);
    const now = current(token, worldId);
    if (now === null || read !== reads) return;
    if (answer.kind === 'PAGE') {
      patch(token, worldId, merge(answer, now.messages, now.hasOlder));
    } else if (answer.kind === 'UNAVAILABLE') {
      patch(token, worldId, { ...fresh(worldId), status: 'UNAVAILABLE' });
    } else if (now.messages.length === 0) {
      // Nothing of the record could be read: said, with its retry, rather than shown as an empty record.
      patch(token, worldId, { notice: 'LOAD_FAILED' });
    }
  };

  /**
   * Nothing is sent after END (S12): a message whose answer is not known is no longer offered for retry — if it was
   * committed, the closed history shows it. Only the server's own ENDED answer to the send keeps its words (IW-35).
   */
  const closedPending = (pending: IntroductionPending | null, worldId: string): IntroductionPending | null => {
    if (pending === null || pending.status === 'ENDED' || pending.status === 'SENDING') return pending;
    unsent.delete(worldId);
    return null;
  };
  const toClosed = (token: number, worldId: string, next: Partial<IntroductionWorldView> = {}) => {
    const now = current(token, worldId);
    patch(token, worldId, { status: 'CLOSED', messages: EMPTY, hasOlder: false, loadingOlder: false, end: 'IDLE',
      pending: closedPending(now?.pending ?? null, worldId), ...next });
    readList();
    void readOpen(token, worldId);
  };

  const dispatchSend = async (token: number, worldId: string, text: string) => {
    let entry = unsent.get(worldId);
    if (entry === undefined || entry.text !== text) {
      entry = { id: newCommandId(), text };
      unsent.set(worldId, entry);
    }
    const { id } = entry;
    patch(token, worldId, { pending: Object.freeze({ text, status: 'SENDING' }) });
    const answer = await transport.send(worldId, id, text);
    // An answer the server gave settles the message for this World even if the reader has left it since.
    if (answer.kind !== 'FAILED' && answer.kind !== 'OFFLINE' && unsent.get(worldId)?.id === id) unsent.delete(worldId);
    const now = current(token, worldId);
    if (now === null) return;
    switch (answer.kind) {
      case 'COMMITTED': {
        const mine: IntroductionMessage = Object.freeze({ materialId: answer.materialId, producer: 'SELF', text, establishedAt: answer.establishedAt, canDelete: true });
        const known = now.messages.some((m) => m.materialId === mine.materialId);
        patch(token, worldId, { pending: null, messages: known || now.status !== 'ACTIVE' ? now.messages : Object.freeze([...now.messages, mine]) });
        void readOpen(token, worldId);
        return;
      }
      case 'ENDED':
        // The server's own answer for this member's own World, and only it, shows IW-35 (S15b). The words were not stored.
        if (now.status === 'CLOSED') patch(token, worldId, { pending: Object.freeze({ text, status: 'ENDED' }) });
        else toClosed(token, worldId, { pending: Object.freeze({ text, status: 'ENDED' }) });
        return;
      case 'UNAVAILABLE':
        patch(token, worldId, { ...fresh(worldId), status: 'UNAVAILABLE' });
        readList();
        return;
      case 'COMMAND_CONFLICT':
      case 'INVALID':
        // Refused as a request: asking again with this id would be refused again (a retry takes a new one).
        patch(token, worldId, { pending: Object.freeze({ text, status: 'FAILED' }) });
        return;
      default:
        // Not known to be sent: the SAME id on retry, so the server decides it once (S15a).
        patch(token, worldId, { pending: Object.freeze({ text, status: answer.kind === 'OFFLINE' ? 'OFFLINE' : 'FAILED' }) });
    }
  };

  const unsubscribeForeground = foreground?.subscribe((next) => {
    if (next !== 'ACTIVE') return;
    readList();
    if (state.open !== null) void readOpen(opening, state.open.worldId);
  });

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh() {
      readList();
      if (state.open !== null) void readOpen(opening, state.open.worldId);
    },
    open(worldId) {
      opening += 1;
      reads += 1;
      pendingDelete = null;
      // A message of this World whose answer was lost before the reader left stays theirs to retry, with its own id.
      const held = unsent.get(worldId);
      publish({ ...state, open: held === undefined ? fresh(worldId) : Object.freeze({ ...fresh(worldId), pending: Object.freeze({ text: held.text, status: 'FAILED' as const }) }) });
      readList();
      void readOpen(opening, worldId);
    },
    reload() {
      const open = state.open;
      if (open === null) return;
      patch(opening, open.worldId, { status: open.status === 'FAILED' ? 'LOADING' : open.status, notice: open.notice === 'LOAD_FAILED' ? null : open.notice });
      void readOpen(opening, open.worldId);
    },
    close() {
      opening += 1;
      reads += 1;
      pendingDelete = null;
      publish({ ...state, open: null });
      readList();
    },
    loadOlder() {
      const open = state.open;
      if (open === null || !open.hasOlder || open.loadingOlder || (open.status !== 'ACTIVE' && open.status !== 'CLOSED')) return;
      const oldest = open.messages[0];
      if (oldest === undefined) return;
      const token = opening;
      const { worldId, status } = open;
      const before = { materialId: oldest.materialId, establishedAt: oldest.establishedAt };
      patch(token, worldId, { loadingOlder: true, notice: null });
      void (status === 'ACTIVE' ? transport.messages(worldId, before) : transport.history(worldId, before)).then((answer) => {
        const now = current(token, worldId);
        if (now === null || now.status !== status) return;
        if (answer.kind !== 'PAGE') {
          if (answer.kind === 'UNAVAILABLE') patch(token, worldId, { ...fresh(worldId), status: 'UNAVAILABLE' });
          else if (answer.kind === 'ENDED') toClosed(token, worldId);
          else patch(token, worldId, { loadingOlder: false, notice: 'OLDER_FAILED' });
          return;
        }
        // The older page goes beneath what the reader holds, only where it still joins it.
        if (now.messages[0]?.materialId !== before.materialId) {
          patch(token, worldId, { loadingOlder: false });
          return;
        }
        const seen = new Set(now.messages.map((m) => m.materialId));
        patch(token, worldId, { loadingOlder: false, hasOlder: answer.hasOlder,
          messages: Object.freeze([...answer.messages.filter((m) => !seen.has(m.materialId)), ...now.messages]) });
      });
    },
    send(text) {
      const open = state.open;
      if (!live() || open === null || open.status !== 'ACTIVE' || open.pending !== null) return false;
      if (text.trim().length === 0 || text.length > INTRODUCTION_MESSAGE_MAX_LENGTH) return false;
      void dispatchSend(opening, open.worldId, text);
      return true;
    },
    retrySend() {
      const open = state.open;
      // Only while the Introduction lives: nothing is sent after END.
      if (!live() || open === null || open.status !== 'ACTIVE' || open.pending === null || (open.pending.status !== 'FAILED' && open.pending.status !== 'OFFLINE')) return;
      void dispatchSend(opening, open.worldId, open.pending.text);
    },
    async endIntroduction() {
      const open = state.open;
      if (!live() || open === null || open.status !== 'ACTIVE' || open.end === 'RUNNING') return null;
      const token = opening;
      const { worldId } = open;
      const id = ends.get(worldId) ?? newCommandId();
      ends.set(worldId, id);
      patch(token, worldId, { end: 'RUNNING', notice: null });
      const answer = await transport.end(worldId, id);
      // An answer the server gave settles the END for this World even if the reader has left it since.
      if (answer.kind !== 'FAILED' && answer.kind !== 'OFFLINE' && ends.get(worldId) === id) ends.delete(worldId);
      if (current(token, worldId) === null) return null;
      switch (answer.kind) {
        case 'ENDED':
          toClosed(token, worldId);
          break;
        case 'ALREADY_SETTLED':
          toClosed(token, worldId, { notice: 'ALREADY_ENDED' });
          break;
        case 'UNAVAILABLE':
          patch(token, worldId, { ...fresh(worldId), status: 'UNAVAILABLE' });
          readList();
          break;
        case 'INVALID':
          patch(token, worldId, { end: 'FAILED' });
          break;
        default:
          // Not known: the SAME id on retry (IW-30 → «تعذّر ذلك الآن.» + «إعادة المحاولة»).
          patch(token, worldId, { end: 'FAILED' });
      }
      return answer.kind;
    },
    async deleteMessage(materialId) {
      const open = state.open;
      if (!live() || open === null || open.deleting !== null || (open.status !== 'ACTIVE' && open.status !== 'CLOSED')) return false;
      const message = open.messages.find((m) => m.materialId === materialId);
      if (message === undefined || !message.canDelete) return false;
      const token = opening;
      const { worldId } = open;
      const id = pendingDelete !== null && pendingDelete.materialId === materialId ? pendingDelete.id : newCommandId();
      pendingDelete = { materialId, id };
      patch(token, worldId, { deleting: materialId, notice: null });
      const answer = await deletion.deleteMaterial(worldId, materialId, id);
      const now = current(token, worldId);
      if (now === null) return false;
      if (answer.kind === 'UNAVAILABLE') {
        // Not known: the same id when the reader deletes it again.
        patch(token, worldId, { deleting: null, notice: 'DELETE_FAILED' });
        return false;
      }
      pendingDelete = null;
      if (answer.kind === 'DELETED') {
        patch(token, worldId, { deleting: null, notice: 'DELETED', messages: Object.freeze(now.messages.filter((m) => m.materialId !== materialId)) });
      } else {
        patch(token, worldId, { deleting: null, notice: 'DELETE_FAILED' });
      }
      void readOpen(token, worldId);
      return answer.kind === 'DELETED';
    },
    dismissNotice() {
      const open = state.open;
      if (open !== null && open.notice !== null) patch(opening, open.worldId, { notice: null });
    },
    retire() {
      retired = true;
      unsubscribeForeground?.();
      listeners.clear();
    },
  };
}

/** The first name the server presented to this reader for one of their Worlds, or null (IW-11b). */
export const firstNameOf = (state: IntroductionWorldsState, worldId: string): string | null =>
  state.list.worlds.find((w) => w.worldId === worldId)?.otherFirstName ?? null;

/** The World the server joined to a proposal both humans know (the MATCH_CONCLUDED card's entry, IW-06), or null. */
export const worldOfProposal = (state: IntroductionWorldsState, proposalId: string): IntroductionWorld | null =>
  state.list.worlds.find((w) => w.proposalId === proposalId) ?? null;
