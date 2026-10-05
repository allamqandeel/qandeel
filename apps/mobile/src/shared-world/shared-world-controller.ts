/**
 * S4-01 — the «العالم المشترك» / Shared World area's own state, for THIS identity and runtime generation.
 *
 * It is the area's viewer-scoped navigation state (CW2-07 §4–§5) and nothing of the Personal world's: it holds no
 * Session, no canonical state, no camera, focus or time, and the Personal world never reads it. Leaving the area keeps
 * it (the area's return anchor, CW2-07 §7); coming back re-resolves authority BEFORE anything of a World is shown again
 * (CW2-07 §19, §43). A denial is one neutral state that reveals nothing.
 *
 * Every act carries a command id that a retry reuses, so a lost answer is never a second invitation, acceptance or
 * decline. It is retired with the generation.
 *
 * S4-02 — the World's conversation (its `thread`). It belongs to exactly ONE World: it is read only after that World's
 * entry verdict is ALLOW, it is emptied whenever the place changes, and a stale answer for another World is dropped —
 * so no material, send, deletion or notice of World A can ever be shown as World B's. It is refreshed on entry, when the
 * app returns to the foreground, after the reader's own send or delete, and on the reader's explicit refresh; there is no
 * timer and no realtime channel. One logical submission keeps ONE command id until the server answers it, so a lost
 * answer is retried without a second message.
 */
import type {
  ForegroundSignal,
  SharedAcceptResult, SharedDeleteResult, SharedEntryResult, SharedInviteResult, SharedMaterial, SharedMaterialCursor, SharedMaterialsResult, SharedRoot,
  SharedRootResult, SharedSendResult, SharedWorldShell,
} from '../runtime-entry';

export interface SharedWorldTransport {
  root(): Promise<SharedRootResult>;
  invite(commandId: string, sharedId: string): Promise<SharedInviteResult>;
  accept(invitationId: string, commandId: string): Promise<SharedAcceptResult>;
  decline(invitationId: string, commandId: string): Promise<{ readonly kind: 'DECLINED' | 'NOT_DECLINABLE' | 'UNAVAILABLE' }>;
  entry(worldId: string): Promise<SharedEntryResult>;
  materials(worldId: string, before?: SharedMaterialCursor | null): Promise<SharedMaterialsResult>;
  send(worldId: string, commandId: string, content: string): Promise<SharedSendResult>;
  deleteMaterial(worldId: string, materialId: string, commandId: string): Promise<SharedDeleteResult>;
}

export type SharedPlace = { readonly kind: 'ROOT' } | { readonly kind: 'WORLD'; readonly worldId: string };
export type SharedNotice = 'DECLINED' | 'ACTION_UNAVAILABLE' | 'NOT_OPEN' | null;

/** What the reader is told about their own last act in the World's conversation. */
export type SharedThreadNotice = 'SEND_UNCONFIRMED' | 'SEND_REFUSED' | 'REPLY_FAILED' | 'DELETED' | 'DELETE_FAILED' | 'LOAD_FAILED' | null;

export interface SharedThreadState {
  /** The World this thread belongs to; null when no World is open. */
  readonly worldId: string | null;
  readonly status: 'NONE' | 'LOADING' | 'READY' | 'UNAVAILABLE';
  /** Oldest first, as the server returned them: the newest page and any older pages the reader asked for. */
  readonly materials: readonly SharedMaterial[];
  /** Whether visible material older than the oldest held one exists. */
  readonly hasOlder: boolean;
  /** An older page is being read. */
  readonly loadingOlder: boolean;
  /** The server's hint that ordinary sending is open; the composer is drawn only then. Never an authority by itself. */
  readonly conversation: boolean;
  /** A submission is in flight: its words, so the composer can keep them until the server confirms. */
  readonly sending: string | null;
  readonly deleting: string | null;
  readonly notice: SharedThreadNotice;
}

export interface SharedAreaState {
  readonly root: { readonly status: 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE'; readonly data: SharedRoot | null };
  readonly place: SharedPlace;
  /** The entry verdict for the World in `place`. Nothing of a World is drawn unless this is ALLOW. */
  readonly entry: { readonly status: 'NONE' | 'RESOLVING' | 'ALLOW' | 'DENIED'; readonly world: SharedWorldShell | null };
  /** The invitation an act is running for, if any. */
  readonly busy: string | null;
  readonly notice: SharedNotice;
  readonly thread: SharedThreadState;
}

export interface SharedWorldController {
  getState(): SharedAreaState;
  subscribe(listener: () => void): () => void;
  /** The area became visible: re-read the root, and re-resolve the World the reader left it on. */
  enter(): void;
  openWorld(worldId: string): void;
  /** Local Back inside the area: from a World to the area's root. */
  toRoot(): void;
  invite(sharedId: string): Promise<SharedInviteResult['kind']>;
  accept(invitationId: string): Promise<void>;
  decline(invitationId: string): Promise<void>;
  dismissNotice(): void;
  /** S4-02: re-read the open World's conversation from the server. */
  refreshThread(): void;
  /** S4-02: read one bounded page older than the oldest held material, when there is one and none is in flight. */
  loadOlder(): void;
  /** S4-02: send the reader's words into the open World. Resolves true once the server confirmed they are committed. */
  send(text: string): Promise<boolean>;
  /** S4-02: delete the reader's own material in the open World. */
  deleteMaterial(materialId: string): Promise<void>;
  retire(): void;
}

export interface SharedWorldControllerOptions {
  readonly transport: SharedWorldTransport;
  readonly isCurrent: () => boolean;
  readonly newCommandId?: () => string;
  /** S4-02: returning to the foreground re-reads the open World's conversation. */
  readonly foreground?: ForegroundSignal;
}

/** A v4-shaped command identity. */
export function mintSharedCommandId(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const block = (n: number) => Array.from({ length: n }, hex).join('');
  return `${block(8)}-${block(4)}-4${block(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${block(3)}-${block(12)}`;
}

/** The bound on one submission: the same bound the Personal composer and the API apply. */
export const SHARED_MESSAGE_MAX_LENGTH = 20000;

const NO_THREAD: SharedThreadState = Object.freeze<SharedThreadState>({
  worldId: null, status: 'NONE', materials: [], hasOlder: false, loadingOlder: false, conversation: false, sending: null, deleting: null, notice: null,
});

/**
 * A fresh newest page, with the older pages the reader already read kept beneath it. They are kept only where the
 * page joins them — its oldest material is one the reader holds — so nothing is ever stitched across a gap; otherwise
 * the newest page alone is the thread, and older history is read again on request.
 */
function joinNewest(held: readonly SharedMaterial[], heldHasOlder: boolean, page: readonly SharedMaterial[], pageHasOlder: boolean): Pick<SharedThreadState, 'materials' | 'hasOlder'> {
  if (!pageHasOlder || page.length === 0) return { materials: page, hasOlder: pageHasOlder };
  const join = held.findIndex((m) => m.materialId === page[0].materialId);
  if (join <= 0) return { materials: page, hasOlder: pageHasOlder };
  return { materials: [...held.slice(0, join), ...page], hasOlder: heldHasOlder };
}

const INITIAL: SharedAreaState = Object.freeze<SharedAreaState>({
  root: { status: 'IDLE', data: null },
  place: { kind: 'ROOT' },
  entry: { status: 'NONE', world: null },
  busy: null,
  notice: null,
  thread: NO_THREAD,
});

export function createSharedWorldController(options: SharedWorldControllerOptions): SharedWorldController {
  const { transport, isCurrent } = options;
  const newCommandId = options.newCommandId ?? mintSharedCommandId;
  const listeners = new Set<() => void>();
  let state: SharedAreaState = INITIAL;
  let retired = false;
  let rootRead = 0;
  let entryRead = 0;
  let threadRead = 0;
  let olderRead = 0;
  // One command per act, reused by a retry of the same act.
  const acceptCommands = new Map<string, string>();
  const declineCommands = new Map<string, string>();
  let inviteCommand: { readonly sharedId: string; readonly commandId: string } | null = null;
  // S4-02: one logical submission (World + words) keeps one command until the server answers it.
  let sendCommand: { readonly worldId: string; readonly text: string; readonly commandId: string } | null = null;
  const deleteCommands = new Map<string, string>();

  const live = () => !retired && isCurrent();
  const publish = (next: SharedAreaState) => {
    if (!live()) return;
    state = next;
    for (const listener of Array.from(listeners)) listener();
  };
  /** The open World, if its entry is ALLOW right now. */
  const openWorldId = (): string | null => (state.place.kind === 'WORLD' && state.entry.status === 'ALLOW' ? state.place.worldId : null);
  /** Publishes a thread change only while the thread still belongs to `worldId`. */
  const publishThread = (worldId: string, change: Partial<SharedThreadState>) => {
    if (state.thread.worldId !== worldId) return;
    publish({ ...state, thread: { ...state.thread, ...change } });
  };

  async function readRoot(): Promise<void> {
    const ticket = ++rootRead;
    publish({ ...state, root: { status: state.root.data === null ? 'LOADING' : state.root.status, data: state.root.data } });
    const result = await transport.root();
    if (ticket !== rootRead) return;
    publish({ ...state, root: result.kind === 'READ' ? { status: 'READY', data: result.root } : { status: 'UNAVAILABLE', data: state.root.data } });
  }

  async function readThread(worldId: string): Promise<void> {
    const ticket = ++threadRead;
    publishThread(worldId, { status: state.thread.status === 'READY' ? 'READY' : 'LOADING' });
    const result = await transport.materials(worldId);
    if (ticket !== threadRead || state.thread.worldId !== worldId) return;
    if (result.kind === 'READ') {
      olderRead += 1;
      publishThread(worldId, {
        status: 'READY', conversation: result.conversation, loadingOlder: false,
        ...joinNewest(state.thread.materials, state.thread.hasOlder, result.materials, result.hasOlder),
        notice: state.thread.notice === 'LOAD_FAILED' ? null : state.thread.notice,
      });
      return;
    }
    if (result.kind === 'DENIED') {
      denied(worldId);
      return;
    }
    publishThread(worldId, { status: state.thread.status === 'READY' ? 'READY' : 'UNAVAILABLE', notice: 'LOAD_FAILED' });
  }

  /** Authority was lost since entry: nothing of the World stays on screen. */
  function denied(worldId: string): void {
    entryRead += 1;
    olderRead += 1;
    sendCommand = null;
    publish({ ...state, entry: { status: 'DENIED', world: null }, thread: { ...NO_THREAD, worldId } });
  }

  /** One page strictly older than the oldest held material, read only on the reader's request. */
  async function readOlder(worldId: string): Promise<void> {
    const oldest = state.thread.materials[0];
    if (oldest === undefined || !state.thread.hasOlder || state.thread.loadingOlder) return;
    const ticket = ++olderRead;
    publishThread(worldId, { loadingOlder: true });
    const result = await transport.materials(worldId, { materialId: oldest.materialId, establishedAt: oldest.establishedAt });
    // A newer read, another World or a lost authority since: this page belongs to nothing on screen.
    if (ticket !== olderRead || state.thread.worldId !== worldId) return;
    if (result.kind === 'DENIED') {
      denied(worldId);
      return;
    }
    if (result.kind !== 'READ' || state.thread.materials[0]?.materialId !== oldest.materialId) {
      // Nothing to say: the held conversation is still true, and asking again reads it again.
      publishThread(worldId, { loadingOlder: false });
      return;
    }
    const held = new Set(state.thread.materials.map((m) => m.materialId));
    publishThread(worldId, {
      loadingOlder: false, hasOlder: result.hasOlder, conversation: result.conversation,
      materials: [...result.materials.filter((m) => !held.has(m.materialId)), ...state.thread.materials],
    });
  }

  async function resolve(worldId: string): Promise<void> {
    const ticket = ++entryRead;
    threadRead += 1;
    olderRead += 1;
    publish({ ...state, place: { kind: 'WORLD', worldId }, entry: { status: 'RESOLVING', world: null }, thread: { ...NO_THREAD, worldId } });
    const result = await transport.entry(worldId);
    if (ticket !== entryRead || state.place.kind !== 'WORLD' || state.place.worldId !== worldId) return;
    publish({ ...state, entry: result.kind === 'ALLOW' ? { status: 'ALLOW', world: result.world } : { status: 'DENIED', world: null } });
    // The conversation is read only once the World's authority is ALLOW (CW2-07 §19).
    if (result.kind === 'ALLOW') await readThread(worldId);
  }

  const unsubscribeForeground = options.foreground?.subscribe((next) => {
    const worldId = openWorldId();
    if (next === 'ACTIVE' && worldId !== null) void readThread(worldId);
  });

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    enter() {
      void readRoot();
      if (state.place.kind === 'WORLD') void resolve(state.place.worldId);
    },
    openWorld(worldId) {
      void resolve(worldId);
    },
    toRoot() {
      entryRead += 1;
      threadRead += 1;
      olderRead += 1;
      sendCommand = null;
      publish({ ...state, place: { kind: 'ROOT' }, entry: { status: 'NONE', world: null }, thread: NO_THREAD });
      void readRoot();
    },
    async invite(sharedId) {
      const value = sharedId.trim();
      if (inviteCommand === null || inviteCommand.sharedId !== value) inviteCommand = { sharedId: value, commandId: newCommandId() };
      const result = await transport.invite(inviteCommand.commandId, value);
      // A delivered answer ends the act; only a lost one keeps the command for a retry.
      if (result.kind !== 'UNAVAILABLE') inviteCommand = null;
      return result.kind;
    },
    async accept(invitationId) {
      if (state.busy !== null) return;
      const commandId = acceptCommands.get(invitationId) ?? newCommandId();
      acceptCommands.set(invitationId, commandId);
      publish({ ...state, busy: invitationId, notice: null });
      const result = await transport.accept(invitationId, commandId);
      if (result.kind === 'BORN') {
        acceptCommands.delete(invitationId);
        publish({ ...state, busy: null });
        // Enter the new World at once (S4-01 §1.5), through the same authority-first entry as any other.
        void readRoot();
        await resolve(result.worldId);
        return;
      }
      if (result.kind !== 'UNAVAILABLE') acceptCommands.delete(invitationId);
      publish({ ...state, busy: null, notice: result.kind === 'NOT_OPEN' ? 'NOT_OPEN' : 'ACTION_UNAVAILABLE' });
      void readRoot();
    },
    async decline(invitationId) {
      if (state.busy !== null) return;
      const commandId = declineCommands.get(invitationId) ?? newCommandId();
      declineCommands.set(invitationId, commandId);
      publish({ ...state, busy: invitationId, notice: null });
      const result = await transport.decline(invitationId, commandId);
      if (result.kind !== 'UNAVAILABLE') declineCommands.delete(invitationId);
      publish({ ...state, busy: null, notice: result.kind === 'DECLINED' ? 'DECLINED' : 'ACTION_UNAVAILABLE' });
      void readRoot();
    },
    dismissNotice() {
      publish({ ...state, notice: null });
    },
    refreshThread() {
      const worldId = openWorldId();
      if (worldId !== null) void readThread(worldId);
    },
    loadOlder() {
      const worldId = openWorldId();
      if (worldId !== null && state.thread.status === 'READY') void readOlder(worldId);
    },
    async send(text) {
      const worldId = openWorldId();
      if (worldId === null || state.thread.sending !== null || !state.thread.conversation) return false;
      if (text.trim().length === 0 || text.length > SHARED_MESSAGE_MAX_LENGTH) return false;
      if (sendCommand === null || sendCommand.worldId !== worldId || sendCommand.text !== text) sendCommand = { worldId, text, commandId: newCommandId() };
      const command = sendCommand;
      publishThread(worldId, { sending: text, notice: null });
      const result = await transport.send(worldId, command.commandId, text);
      if (state.thread.worldId !== worldId) return false;
      if (result.kind === 'UNAVAILABLE') {
        // The outcome is unknown: the words stay, and the same command is retried.
        publishThread(worldId, { sending: null, notice: 'SEND_UNCONFIRMED' });
        return false;
      }
      sendCommand = null;
      if (result.kind === 'NOT_AVAILABLE') {
        publishThread(worldId, { sending: null, notice: 'SEND_REFUSED' });
        // Re-establish what the reader may do now: the capability may have closed, or membership ended.
        await readThread(worldId);
        return false;
      }
      // PENDING: an earlier attempt of this same message is still producing the reply — not a failure; it is read next.
      publishThread(worldId, { sending: null, notice: result.qandeel === 'UNAVAILABLE' ? 'REPLY_FAILED' : null });
      await readThread(worldId);
      return true;
    },
    async deleteMaterial(materialId) {
      const worldId = openWorldId();
      if (worldId === null || state.thread.deleting !== null) return;
      const own = state.thread.materials.find((m) => m.materialId === materialId);
      if (own === undefined || !own.canDelete) return;
      const commandId = deleteCommands.get(materialId) ?? newCommandId();
      deleteCommands.set(materialId, commandId);
      publishThread(worldId, { deleting: materialId, notice: null });
      const result = await transport.deleteMaterial(worldId, materialId, commandId);
      if (result.kind !== 'UNAVAILABLE') deleteCommands.delete(materialId);
      publishThread(worldId, { deleting: null, notice: result.kind === 'DELETED' ? 'DELETED' : 'DELETE_FAILED' });
      await readThread(worldId);
    },
    retire() {
      retired = true;
      unsubscribeForeground?.();
      listeners.clear();
    },
  };
}
