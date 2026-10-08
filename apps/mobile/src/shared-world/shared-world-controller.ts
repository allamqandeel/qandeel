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
 *
 * S4-03 — the World's lifecycle. «إدارة العالم» / Manage World is a place INSIDE the exact World governed (I-08A4 §7;
 * P1: no Settings page nested in a World): it is read only through the server's entry verdict, it belongs to one World,
 * and a stale answer for another place is dropped. Every act — leave, a proposal, an approval, a history package — keeps
 * ONE command id per logical act until the server answers it, so a lost answer is retried as the same act and never
 * becomes a second one. Leaving returns the reader to the Shared root at once (the World is no longer theirs); an act that
 * ends the reader's access (the World ended, or they are no longer a member) does the same. An ended World is a separate,
 * read-only place reached only through the reader's closed-view entitlement, never through the active World's entry.
 * An add / rejoin is proposed by the target's CURRENT Shared ID (the one answer reveals nothing about them); the target
 * accepts from the Shared root and is then entered through the same authority-first entry as any World.
 *
 * SHARED-VIS-01 — the World's main experience is its Living Analysis field (`./field`), owned here so that it follows the
 * area's authority exactly: it is opened only once the World's entry verdict is ALLOW, closed (its anchor kept) when the
 * reader goes to the root, Manage World or an ended World, and forgotten when the World is no longer the reader's (a
 * denial, a leave, a removal). The World's existing conversation stays exactly what it was, reached by ONE entry in the
 * World's chrome (`worldView`); returning from it shows the same field, read again, at the same camera and focus.
 */
import type {
  ForegroundSignal,
  SharedAcceptResult, SharedDeleteResult, SharedEntryResult, SharedInviteResult, SharedMaterial, SharedMaterialCursor, SharedMaterialsResult, SharedRoot,
  SharedRootResult, SharedSendResult, SharedWorldShell,
  SharedApproveResult, SharedClosedWorld, SharedClosedWorldResult, SharedHistoryApproveResult, SharedHistoryCandidate, SharedHistoryCandidatesResult,
  SharedLeaveResult, SharedManage, SharedManageResult, SharedProposeResult, SharedProposeMemberResult, SharedJoinResult,
} from '../runtime-entry';
import { createSharedFieldController, type SharedFieldController, type SharedFieldTransport } from './field/shared-field-controller';

export interface SharedWorldTransport {
  root(): Promise<SharedRootResult>;
  invite(commandId: string, sharedId: string): Promise<SharedInviteResult>;
  accept(invitationId: string, commandId: string): Promise<SharedAcceptResult>;
  decline(invitationId: string, commandId: string): Promise<{ readonly kind: 'DECLINED' | 'NOT_DECLINABLE' | 'UNAVAILABLE' }>;
  entry(worldId: string): Promise<SharedEntryResult>;
  materials(worldId: string, before?: SharedMaterialCursor | null): Promise<SharedMaterialsResult>;
  send(worldId: string, commandId: string, content: string): Promise<SharedSendResult>;
  deleteMaterial(worldId: string, materialId: string, commandId: string): Promise<SharedDeleteResult>;
  // S4-03
  manage(worldId: string): Promise<SharedManageResult>;
  leave(worldId: string, commandId: string): Promise<SharedLeaveResult>;
  proposeSettings(worldId: string, commandId: string, values: SharedSettingsInput): Promise<SharedProposeResult>;
  proposeRemoval(worldId: string, commandId: string, memberHandle: string): Promise<SharedProposeResult>;
  proposeEnd(worldId: string, commandId: string): Promise<SharedProposeResult>;
  approve(worldId: string, proposalId: string, commandId: string): Promise<SharedApproveResult>;
  historyCandidates(worldId: string, memberHandle: string, before?: SharedMaterialCursor | null): Promise<SharedHistoryCandidatesResult>;
  proposeMember(worldId: string, commandId: string, sharedId: string): Promise<SharedProposeMemberResult>;
  acceptMembershipRequest(worldId: string, requestId: string, commandId: string): Promise<SharedJoinResult>;
  proposeHistoryShare(worldId: string, commandId: string, memberHandle: string, materialIds: readonly string[]): Promise<SharedProposeResult>;
  approveHistoryShare(worldId: string, packageId: string, commandId: string): Promise<SharedHistoryApproveResult>;
  closedWorld(worldId: string, before?: SharedMaterialCursor | null): Promise<SharedClosedWorldResult>;
}

/** The three World Settings a proposal names, as the reader typed them (empty = not set). */
export interface SharedSettingsInput { readonly name: string; readonly description: string; readonly topic: string }

export type SharedPlace =
  | { readonly kind: 'ROOT' }
  | { readonly kind: 'WORLD'; readonly worldId: string }
  /** S4-03: Manage World, inside the exact World governed. */
  | { readonly kind: 'MANAGE'; readonly worldId: string }
  /** S4-03: an ended World, read-only, by the reader's closed-view entitlement. */
  | { readonly kind: 'CLOSED'; readonly worldId: string };
export type SharedNotice = 'DECLINED' | 'ACTION_UNAVAILABLE' | 'NOT_OPEN' | 'LEFT' | null;

/** What the reader is told about their own last lifecycle act. */
export type SharedManageNotice =
  | 'PROPOSED' | 'UNCHANGED' | 'APPROVED' | 'COMMITTED' | 'INVITED' | 'STALE' | 'GRANTED' | 'REFUSED' | 'UNAVAILABLE'
  | 'MEMBER_SUBMITTED' | 'INVALID_SHARED_ID' | null;

export interface SharedManageState {
  readonly worldId: string | null;
  readonly status: 'NONE' | 'LOADING' | 'READY' | 'UNAVAILABLE';
  readonly data: SharedManage | null;
  /** The act in flight (its key), if any: one act at a time. */
  readonly busy: string | null;
  readonly notice: SharedManageNotice;
  /** The earlier words the reader may offer one member, read on request. */
  readonly candidates: {
    readonly memberHandle: string;
    readonly status: 'LOADING' | 'READY' | 'UNAVAILABLE';
    /** Oldest first: the newest page and any older pages the reader asked for. */
    readonly list: readonly SharedHistoryCandidate[];
    readonly hasOlder: boolean;
    readonly loadingOlder: boolean;
  } | null;
}

export interface SharedClosedState {
  readonly worldId: string | null;
  readonly status: 'NONE' | 'LOADING' | 'READY' | 'DENIED' | 'UNAVAILABLE';
  readonly world: SharedClosedWorld | null;
  readonly loadingOlder: boolean;
}

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
  /** S4-03: Manage World of the World in `place` (MANAGE only). */
  readonly manage: SharedManageState;
  /** S4-03: the ended World in `place` (CLOSED only). */
  readonly closed: SharedClosedState;
  /** SHARED-VIS-01: inside an ALLOWed World, its Living Analysis field (MAP) or its existing conversation (CONVERSATION). */
  readonly worldView: 'MAP' | 'CONVERSATION';
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
  /** S4-03: open Manage World for the World the reader is in (after its ALLOW). */
  openManage(): void;
  /** S4-03: read Manage World again (the explicit retry after an unanswered read). */
  refreshManage(): void;
  /** S4-03: leave Manage World for the World itself, re-resolving its authority. */
  closeManage(): void;
  /** S4-03: leave the World the reader is in or manages. LEFT returns the reader to the Shared root. */
  leaveWorld(): Promise<SharedLeaveResult['kind'] | null>;
  proposeSettings(values: SharedSettingsInput): Promise<SharedProposeResult['kind'] | null>;
  proposeRemoval(memberHandle: string): Promise<SharedProposeResult['kind'] | null>;
  proposeEnd(): Promise<SharedProposeResult['kind'] | null>;
  approve(proposalId: string): Promise<SharedApproveResult['kind'] | null>;
  loadHistoryCandidates(memberHandle: string): void;
  /** S4-03: one bounded page of earlier words older than the oldest offered (a page, never a ceiling). */
  loadOlderHistoryCandidates(): void;
  /** S4-03: propose adding a member — or bringing a former one back — by their CURRENT Shared ID. */
  proposeMember(sharedId: string): Promise<SharedProposeMemberResult['kind'] | null>;
  /** S4-03: the reader's own acceptance of an add / rejoin request; JOINED enters the World. */
  acceptMembershipRequest(requestId: string): Promise<void>;
  proposeHistoryShare(memberHandle: string, materialIds: readonly string[]): Promise<SharedProposeResult['kind'] | null>;
  approveHistoryShare(packageId: string): Promise<SharedHistoryApproveResult['kind'] | null>;
  /** S4-03: open an ended World, read-only. */
  openClosed(worldId: string): void;
  /** S4-03: read one page older than the oldest material held of the ended World. */
  loadOlderClosed(): void;
  /** SHARED-VIS-01: the open World's Living Analysis field; null where the host provides no field transport. */
  readonly field: SharedFieldController | null;
  /** SHARED-VIS-01: the World's existing conversation, from the World's chrome (D7). */
  openConversation(): void;
  /** SHARED-VIS-01: back from the conversation to the same World's field, read again at the same camera and focus. */
  closeConversation(): void;
  retire(): void;
}

export interface SharedWorldControllerOptions {
  readonly transport: SharedWorldTransport;
  readonly isCurrent: () => boolean;
  readonly newCommandId?: () => string;
  /** S4-02: returning to the foreground re-reads the open World's conversation. */
  readonly foreground?: ForegroundSignal;
  /** SHARED-VIS-01: the Shared field reads (`/shared/worlds/:worldId/field`); without it no field is drawn. */
  readonly fieldTransport?: SharedFieldTransport | null;
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

const NO_MANAGE: SharedManageState = Object.freeze<SharedManageState>({ worldId: null, status: 'NONE', data: null, busy: null, notice: null, candidates: null });
const NO_CLOSED: SharedClosedState = Object.freeze<SharedClosedState>({ worldId: null, status: 'NONE', world: null, loadingOlder: false });

const INITIAL: SharedAreaState = Object.freeze<SharedAreaState>({
  root: { status: 'IDLE', data: null },
  place: { kind: 'ROOT' },
  entry: { status: 'NONE', world: null },
  busy: null,
  notice: null,
  thread: NO_THREAD,
  manage: NO_MANAGE,
  closed: NO_CLOSED,
  worldView: 'MAP',
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
  // S4-03: one command per logical lifecycle act (World + act + its exact request), until the server answers it.
  const lifecycleCommands = new Map<string, string>();
  let manageRead = 0;
  let closedRead = 0;

  const live = () => !retired && isCurrent();
  // SHARED-VIS-01: the field of the open World. Its own read denial is this area's denial of that exact World.
  const field: SharedFieldController | null = options.fieldTransport
    ? createSharedFieldController({ transport: options.fieldTransport, isCurrent, foreground: options.foreground,
      onDenied: (worldId) => { if (openWorldId() === worldId) denied(worldId); } })
    : null;
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
    field?.forget(worldId);
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
    // The same World re-resolved (the area re-entered) keeps the view the reader was in; any other entry opens the field.
    const worldView = state.place.kind === 'WORLD' && state.place.worldId === worldId ? state.worldView : 'MAP';
    // Nothing of another World's field stays while this one resolves (its anchor is kept for a later return).
    if (field !== null && field.getState().worldId !== worldId) field.close();
    publish({ ...state, place: { kind: 'WORLD', worldId }, entry: { status: 'RESOLVING', world: null }, thread: { ...NO_THREAD, worldId }, worldView });
    const result = await transport.entry(worldId);
    if (ticket !== entryRead || state.place.kind !== 'WORLD' || state.place.worldId !== worldId) return;
    publish({ ...state, entry: result.kind === 'ALLOW' ? { status: 'ALLOW', world: result.world } : { status: 'DENIED', world: null } });
    // The field is read only once the World's authority is ALLOW (CW2-07 §19, §43); a denial forgets its anchor.
    if (result.kind === 'ALLOW') field?.open(worldId);
    else if (result.kind === 'DENIED') field?.forget(worldId);
    // The conversation is read only once the World's authority is ALLOW (CW2-07 §19).
    if (result.kind === 'ALLOW') await readThread(worldId);
  }

  /** The World Manage World is open on, if any. */
  const managedWorldId = (): string | null => (state.place.kind === 'MANAGE' ? state.place.worldId : null);
  const publishManage = (worldId: string, change: Partial<SharedManageState>) => {
    if (state.manage.worldId !== worldId) return;
    publish({ ...state, manage: { ...state.manage, ...change } });
  };

  /** Back to the Shared root with the reader's own notice: the World is no longer theirs to browse. */
  function returnToRoot(notice: SharedNotice, lost = false): void {
    // SHARED-VIS-01: Back keeps the World's field anchor for a later return; a World that is no longer the reader's forgets it.
    const leaving = state.place.kind === 'ROOT' ? null : state.place.worldId;
    if (leaving !== null && (lost || notice === 'LEFT')) field?.forget(leaving);
    else field?.close();
    entryRead += 1;
    threadRead += 1;
    olderRead += 1;
    manageRead += 1;
    closedRead += 1;
    sendCommand = null;
    publish({ ...state, place: { kind: 'ROOT' }, entry: { status: 'NONE', world: null }, thread: NO_THREAD, manage: NO_MANAGE, closed: NO_CLOSED, notice, worldView: 'MAP' });
    void readRoot();
  }

  async function readManage(worldId: string): Promise<void> {
    const ticket = ++manageRead;
    publishManage(worldId, { status: state.manage.status === 'READY' ? 'READY' : 'LOADING' });
    const result = await transport.manage(worldId);
    if (ticket !== manageRead || state.manage.worldId !== worldId) return;
    if (result.kind === 'READ') {
      publishManage(worldId, { status: 'READY', data: result.manage });
      return;
    }
    // The World is no longer the reader's to manage (left, removed, or ended): nothing of it stays on screen.
    if (result.kind === 'DENIED') {
      returnToRoot(null, true);
      return;
    }
    publishManage(worldId, { status: state.manage.status === 'READY' ? 'READY' : 'UNAVAILABLE' });
  }

  /** One lifecycle act on the managed World: one command per logical act, one act at a time, then the truth re-read. */
  async function act<K extends string>(key: string, run: (worldId: string, commandId: string) => Promise<{ readonly kind: K }>, noticeOf: (kind: K) => SharedManageNotice): Promise<K | null> {
    const worldId = managedWorldId();
    if (worldId === null || state.manage.busy !== null || state.manage.status !== 'READY') return null;
    const fullKey = `${worldId}|${key}`;
    const commandId = lifecycleCommands.get(fullKey) ?? newCommandId();
    lifecycleCommands.set(fullKey, commandId);
    publishManage(worldId, { busy: key, notice: null });
    const result = await run(worldId, commandId);
    // A delivered answer ends the act; only a lost one keeps its command for a retry of the same act.
    if (result.kind !== 'UNAVAILABLE') lifecycleCommands.delete(fullKey);
    publishManage(worldId, { busy: null, notice: noticeOf(result.kind) });
    await readManage(worldId);
    return result.kind;
  }

  async function readClosed(worldId: string, before: SharedMaterialCursor | null): Promise<void> {
    const ticket = ++closedRead;
    if (before === null) publish({ ...state, closed: { ...state.closed, status: state.closed.status === 'READY' ? 'READY' : 'LOADING' } });
    else publish({ ...state, closed: { ...state.closed, loadingOlder: true } });
    const result = await transport.closedWorld(worldId, before);
    if (ticket !== closedRead || state.closed.worldId !== worldId) return;
    if (result.kind === 'DENIED') {
      publish({ ...state, closed: { ...NO_CLOSED, worldId, status: 'DENIED' } });
      return;
    }
    if (result.kind !== 'READ') {
      publish({ ...state, closed: { ...state.closed, loadingOlder: false, status: state.closed.status === 'READY' ? 'READY' : 'UNAVAILABLE' } });
      return;
    }
    if (before === null || state.closed.world === null) {
      publish({ ...state, closed: { worldId, status: 'READY', world: result.world, loadingOlder: false } });
      return;
    }
    const held = new Set(state.closed.world.materials.map((m) => m.materialId));
    publish({ ...state, closed: { worldId, status: 'READY', loadingOlder: false,
      world: { ...state.closed.world, hasOlder: result.world.hasOlder, materials: [...result.world.materials.filter((m) => !held.has(m.materialId)), ...state.closed.world.materials] } } });
  }

  async function readCandidates(worldId: string, memberHandle: string, before: SharedMaterialCursor | null): Promise<void> {
    const result = await transport.historyCandidates(worldId, memberHandle, before);
    const held = state.manage.candidates;
    if (state.manage.worldId !== worldId || held?.memberHandle !== memberHandle) return;
    if (result.kind === 'DENIED') {
      returnToRoot(null, true);
      return;
    }
    if (result.kind !== 'READ') {
      publishManage(worldId, { candidates: { ...held, status: before === null ? 'UNAVAILABLE' : held.status, loadingOlder: false } });
      return;
    }
    if (before === null) {
      publishManage(worldId, { candidates: { memberHandle, status: 'READY', list: result.candidates, hasOlder: result.hasOlder, loadingOlder: false } });
      return;
    }
    // The older page goes beneath what the reader holds, only where it still joins it.
    if (held.list[0]?.materialId !== before.materialId) {
      publishManage(worldId, { candidates: { ...held, loadingOlder: false } });
      return;
    }
    const seen = new Set(held.list.map((c) => c.materialId));
    publishManage(worldId, { candidates: { ...held, loadingOlder: false, hasOlder: result.hasOlder,
      list: [...result.candidates.filter((c) => !seen.has(c.materialId)), ...held.list] } });
  }

  const PROPOSE_NOTICE = (kind: SharedProposeResult['kind']): SharedManageNotice =>
    (kind === 'PROPOSED' ? 'PROPOSED' : kind === 'UNCHANGED' ? 'UNCHANGED' : kind === 'REFUSED' ? 'REFUSED' : 'UNAVAILABLE');

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
      returnToRoot(state.notice);
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
    openManage() {
      const worldId = openWorldId();
      if (worldId === null) return;
      threadRead += 1;
      olderRead += 1;
      sendCommand = null;
      field?.close();
    publish({ ...state, place: { kind: 'MANAGE', worldId }, thread: NO_THREAD, manage: { ...NO_MANAGE, worldId, status: 'LOADING' }, worldView: 'MAP' });
      void readManage(worldId);
    },
    refreshManage() {
      const worldId = managedWorldId();
      if (worldId !== null) void readManage(worldId);
    },
    closeManage() {
      const worldId = managedWorldId();
      if (worldId === null) return;
      manageRead += 1;
      publish({ ...state, manage: NO_MANAGE });
      void resolve(worldId);
    },
    async leaveWorld() {
      const worldId = managedWorldId() ?? openWorldId();
      if (worldId === null || state.manage.busy !== null) return null;
      const key = `${worldId}|leave`;
      const commandId = lifecycleCommands.get(key) ?? newCommandId();
      lifecycleCommands.set(key, commandId);
      if (state.manage.worldId === worldId) publishManage(worldId, { busy: 'leave', notice: null });
      const result = await transport.leave(worldId, commandId);
      if (result.kind !== 'UNAVAILABLE') lifecycleCommands.delete(key);
      if (result.kind === 'LEFT') {
        // The World is no longer the reader's: straight back to the Shared root, nothing of it kept.
        returnToRoot('LEFT');
        return 'LEFT';
      }
      if (state.manage.worldId === worldId) publishManage(worldId, { busy: null, notice: result.kind === 'REFUSED' ? 'REFUSED' : 'UNAVAILABLE' });
      return result.kind;
    },
    proposeSettings(values) {
      const key = `settings|${values.name}|${values.description}|${values.topic}`;
      return act(key, (worldId, commandId) => transport.proposeSettings(worldId, commandId, values), PROPOSE_NOTICE);
    },
    proposeRemoval(memberHandle) {
      return act(`removal|${memberHandle}`, (worldId, commandId) => transport.proposeRemoval(worldId, commandId, memberHandle), PROPOSE_NOTICE);
    },
    proposeEnd() {
      return act('end', (worldId, commandId) => transport.proposeEnd(worldId, commandId), PROPOSE_NOTICE);
    },
    approve(proposalId) {
      return act(`approve|${proposalId}`, (worldId, commandId) => transport.approve(worldId, proposalId, commandId),
        (kind) => (kind === 'APPROVED' ? 'APPROVED' : kind === 'COMMITTED' ? 'COMMITTED' : kind === 'INVITED' ? 'INVITED' : kind === 'STALE' ? 'STALE'
          : kind === 'REFUSED' ? 'REFUSED' : 'UNAVAILABLE'));
    },
    proposeMember(sharedId) {
      const value = sharedId.trim();
      return act(`member|${value}`, (worldId, commandId) => transport.proposeMember(worldId, commandId, value),
        (kind) => (kind === 'SUBMITTED' ? 'MEMBER_SUBMITTED' : kind === 'INVALID_SHARED_ID' ? 'INVALID_SHARED_ID' : kind === 'REFUSED' ? 'REFUSED' : 'UNAVAILABLE'));
    },
    async acceptMembershipRequest(requestId) {
      const request = state.root.data?.memberRequests.find((r) => r.requestId === requestId);
      if (request === undefined || state.busy !== null) return;
      const key = `join|${request.worldId}|${requestId}`;
      const commandId = lifecycleCommands.get(key) ?? newCommandId();
      lifecycleCommands.set(key, commandId);
      publish({ ...state, busy: requestId, notice: null });
      const result = await transport.acceptMembershipRequest(request.worldId, requestId, commandId);
      if (result.kind !== 'UNAVAILABLE') lifecycleCommands.delete(key);
      publish({ ...state, busy: null, notice: result.kind === 'JOINED' ? null : 'ACTION_UNAVAILABLE' });
      void readRoot();
      // JOINED: enter the World through the same authority-first entry as any other (FROM_JOIN_FORWARD is the server's).
      if (result.kind === 'JOINED') await resolve(request.worldId);
    },
    loadHistoryCandidates(memberHandle) {
      const worldId = managedWorldId();
      if (worldId === null || state.manage.status !== 'READY') return;
      publishManage(worldId, { candidates: { memberHandle, status: 'LOADING', list: [], hasOlder: false, loadingOlder: false } });
      void readCandidates(worldId, memberHandle, null);
    },
    loadOlderHistoryCandidates() {
      const worldId = managedWorldId();
      const held = state.manage.candidates;
      const oldest = held?.list[0];
      if (worldId === null || held === null || oldest === undefined || held.status !== 'READY' || !held.hasOlder || held.loadingOlder) return;
      publishManage(worldId, { candidates: { ...held, loadingOlder: true } });
      void readCandidates(worldId, held.memberHandle, { materialId: oldest.materialId, establishedAt: oldest.establishedAt });
    },
    async proposeHistoryShare(memberHandle, materialIds) {
      const ids = [...materialIds].sort();
      const result = await act(`share|${memberHandle}|${ids.join(',')}`, (worldId, commandId) => transport.proposeHistoryShare(worldId, commandId, memberHandle, ids), PROPOSE_NOTICE);
      if (result === 'PROPOSED') {
        const worldId = managedWorldId();
        if (worldId !== null) publishManage(worldId, { candidates: null });
      }
      return result;
    },
    approveHistoryShare(packageId) {
      return act(`shareApprove|${packageId}`, (worldId, commandId) => transport.approveHistoryShare(worldId, packageId, commandId),
        (kind) => (kind === 'APPROVED' ? 'APPROVED' : kind === 'GRANTED' ? 'GRANTED' : kind === 'STALE' ? 'STALE' : kind === 'REFUSED' ? 'REFUSED' : 'UNAVAILABLE'));
    },
    openClosed(worldId) {
      entryRead += 1;
      threadRead += 1;
      olderRead += 1;
      manageRead += 1;
      sendCommand = null;
      field?.close();
      publish({ ...state, place: { kind: 'CLOSED', worldId }, entry: { status: 'NONE', world: null }, thread: NO_THREAD, manage: NO_MANAGE,
        closed: { ...NO_CLOSED, worldId, status: 'LOADING' }, notice: null });
      void readClosed(worldId, null);
    },
    loadOlderClosed() {
      const world = state.closed.world;
      const oldest = world?.materials[0];
      if (state.place.kind !== 'CLOSED' || world === null || oldest === undefined || !world.hasOlder || state.closed.loadingOlder) return;
      void readClosed(state.place.worldId, { materialId: oldest.materialId, establishedAt: oldest.establishedAt });
    },
    field,
    openConversation() {
      const worldId = openWorldId();
      if (worldId === null) return;
      publish({ ...state, worldView: 'CONVERSATION' });
      // The conversation is read again on the way in: nothing older is shown as current.
      void readThread(worldId);
    },
    closeConversation() {
      if (openWorldId() === null || state.worldView !== 'CONVERSATION') return;
      publish({ ...state, worldView: 'MAP' });
      field?.revalidate();
    },
    retire() {
      retired = true;
      unsubscribeForeground?.();
      field?.retire();
      listeners.clear();
    },
  };
}
