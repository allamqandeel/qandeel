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
 */
import type {
  SharedAcceptResult, SharedEntryResult, SharedInviteResult, SharedRoot, SharedRootResult, SharedWorldShell,
} from '../runtime-entry';

export interface SharedWorldTransport {
  root(): Promise<SharedRootResult>;
  invite(commandId: string, sharedId: string): Promise<SharedInviteResult>;
  accept(invitationId: string, commandId: string): Promise<SharedAcceptResult>;
  decline(invitationId: string, commandId: string): Promise<{ readonly kind: 'DECLINED' | 'NOT_DECLINABLE' | 'UNAVAILABLE' }>;
  entry(worldId: string): Promise<SharedEntryResult>;
}

export type SharedPlace = { readonly kind: 'ROOT' } | { readonly kind: 'WORLD'; readonly worldId: string };
export type SharedNotice = 'DECLINED' | 'ACTION_UNAVAILABLE' | 'NOT_OPEN' | null;

export interface SharedAreaState {
  readonly root: { readonly status: 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE'; readonly data: SharedRoot | null };
  readonly place: SharedPlace;
  /** The entry verdict for the World in `place`. Nothing of a World is drawn unless this is ALLOW. */
  readonly entry: { readonly status: 'NONE' | 'RESOLVING' | 'ALLOW' | 'DENIED'; readonly world: SharedWorldShell | null };
  /** The invitation an act is running for, if any. */
  readonly busy: string | null;
  readonly notice: SharedNotice;
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
  retire(): void;
}

export interface SharedWorldControllerOptions {
  readonly transport: SharedWorldTransport;
  readonly isCurrent: () => boolean;
  readonly newCommandId?: () => string;
}

/** A v4-shaped command identity. */
export function mintSharedCommandId(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const block = (n: number) => Array.from({ length: n }, hex).join('');
  return `${block(8)}-${block(4)}-4${block(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${block(3)}-${block(12)}`;
}

const INITIAL: SharedAreaState = Object.freeze<SharedAreaState>({
  root: { status: 'IDLE', data: null },
  place: { kind: 'ROOT' },
  entry: { status: 'NONE', world: null },
  busy: null,
  notice: null,
});

export function createSharedWorldController(options: SharedWorldControllerOptions): SharedWorldController {
  const { transport, isCurrent } = options;
  const newCommandId = options.newCommandId ?? mintSharedCommandId;
  const listeners = new Set<() => void>();
  let state: SharedAreaState = INITIAL;
  let retired = false;
  let rootRead = 0;
  let entryRead = 0;
  // One command per act, reused by a retry of the same act.
  const acceptCommands = new Map<string, string>();
  const declineCommands = new Map<string, string>();
  let inviteCommand: { readonly sharedId: string; readonly commandId: string } | null = null;

  const live = () => !retired && isCurrent();
  const publish = (next: SharedAreaState) => {
    if (!live()) return;
    state = next;
    for (const listener of Array.from(listeners)) listener();
  };

  async function readRoot(): Promise<void> {
    const ticket = ++rootRead;
    publish({ ...state, root: { status: state.root.data === null ? 'LOADING' : state.root.status, data: state.root.data } });
    const result = await transport.root();
    if (ticket !== rootRead) return;
    publish({ ...state, root: result.kind === 'READ' ? { status: 'READY', data: result.root } : { status: 'UNAVAILABLE', data: state.root.data } });
  }

  async function resolve(worldId: string): Promise<void> {
    const ticket = ++entryRead;
    publish({ ...state, place: { kind: 'WORLD', worldId }, entry: { status: 'RESOLVING', world: null } });
    const result = await transport.entry(worldId);
    if (ticket !== entryRead || state.place.kind !== 'WORLD' || state.place.worldId !== worldId) return;
    publish({ ...state, entry: result.kind === 'ALLOW' ? { status: 'ALLOW', world: result.world } : { status: 'DENIED', world: null } });
  }

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
      publish({ ...state, place: { kind: 'ROOT' }, entry: { status: 'NONE', world: null } });
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
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
