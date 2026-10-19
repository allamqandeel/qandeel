/**
 * S7-02 — the Personal Replay entry and selection owner for ONE runtime generation and ONE conversation.
 *
 * It holds what the entry, the menu and the selection show, and nothing that is truth elsewhere. It is not a Replay
 * store, not a player and not persistence. It READS the conversation (the W1A-01 controller's exchanges) and never
 * writes it: the composer's words, an unresolved submission, the history and the reply all stay exactly where they
 * are, so cancelling a selection returns to the live conversation unchanged. It touches no Analysis, map, graphic or
 * motion state.
 *
 * ## The entry is a hint; the command is the permission
 *
 *   - `GET /replay/capability` is read as a HINT. While it is closed (or unreadable), no entry and no reserved slot
 *     exist, so the Conversation looks exactly as it did before S7-02. The Personal Replay gate ships closed.
 *   - With the hint open, the slot is reserved, and the entry is drawn once the conversation holds committed material
 *     (the Live Head the server reports is not null). A brand-new conversation advertises nothing (G1.1-R3 §B7).
 *   - Every command re-binds the gate on the server. `NOT_AVAILABLE_NOW` is answered as such, and the hint is read again.
 *
 * ## The send rules it enforces
 *
 *   - A range is sent only when `replay-anchors.ts` PROVES it from the committed-unit events. A selection that cannot be
 *     proven is shown as such and cannot be saved.
 *   - ONE command id per attempt, minted when the reader presses Save and kept with the exact range it names. An answer
 *     that cannot be read is UNCONFIRMED: "Try again" re-issues the SAME command, which the server answers from its
 *     committed history, so a retry can never create a second draft. While an attempt is unresolved no new attempt is
 *     offered, even after the selection was left: re-entering resumes the same command.
 *   - A revision names the draft revision it was composed against (`expectedDraftRevision`).
 *   - The identity is the token's: no user, owner, source class or unit id is ever sent.
 */
import type {
  CommittedEventsResult,
  ConversationExchangeView,
  ReplayCapabilityResult,
  ReplayCommandResult,
  ReplayCoverageView,
  ReplayDraftRefusal,
  ReplayDraftView,
  ReplayListResult,
  ReplayRange,
  ReplayReadResult,
  TemporalHeadResult,
} from '../runtime-entry';
import { MAX_TEMPORAL_EVENT_PAGE as REPLAY_EVENTS_PAGE } from '../temporal';
import {
  displayedMessageAt,
  displayedMessageIds,
  partRange,
  proveAnchors,
  wholeRange,
  type AnchorProof,
  type ProvenRange,
} from './replay-anchors';

/** The transport this owner needs. Production passes the S7-02 `ReplayApiClient`. */
export interface ReplayEntryTransport {
  capability(): Promise<ReplayCapabilityResult>;
  conversationReplays(sessionId: string): Promise<ReplayListResult>;
  replay(replayId: string): Promise<ReplayReadResult>;
  createDraft(commandId: string, sessionId: string, range: ReplayRange): Promise<ReplayCommandResult>;
  reviseDraft(commandId: string, replayId: string, expectedDraftRevision: number, range: ReplayRange): Promise<ReplayCommandResult>;
  liveHead(sessionId: string): Promise<TemporalHeadResult>;
  committedEvents(sessionId: string, afterSp?: number): Promise<CommittedEventsResult>;
}

/** The read-only view of the conversation this owner needs (the W1A-01 controller satisfies it). */
export interface ReplayConversationSource {
  getState(): { readonly exchanges: readonly ConversationExchangeView[] };
  subscribe(listener: () => void): () => void;
}

/**
 * UNKNOWN  — not read yet: nothing is drawn.
 * HIDDEN   — the capability hint is closed or unreadable: no entry and no slot.
 * RESERVED — the hint is open, nothing is committed yet: the slot is held, the entry is not drawn.
 * AVAILABLE — the entry is drawn.
 */
export type ReplayEntryStatus = 'UNKNOWN' | 'HIDDEN' | 'RESERVED' | 'AVAILABLE';
export type ReplayScope = 'WHOLE' | 'PART';
export type ReplayTarget =
  | { readonly kind: 'CREATE' }
  | { readonly kind: 'REVISE'; readonly replayId: string; readonly expectedDraftRevision: number };

/**
 * NOT_PROVABLE — the two ends chosen do not make one provable range;
 * CHANGED      — the server answered CHANGED / SOURCE_CHANGED: choose again;
 * FAILED       — the proof could not be read, or the command was refused for another reason;
 * UNCONFIRMED  — the command's answer could not be read: Try again re-issues the same command.
 */
export type ReplaySelectionProblem = 'NOT_PROVABLE' | 'CHANGED' | 'FAILED' | 'UNCONFIRMED';

export interface ReplayCommandAttempt {
  readonly id: string;
  readonly scope: ReplayScope;
  readonly target: ReplayTarget;
  readonly range: ProvenRange;
  readonly firstId: string | null;
  readonly lastId: string | null;
  readonly phase: 'SAVING' | 'UNCONFIRMED';
}

export interface ReplaySelectionState {
  readonly scope: ReplayScope;
  readonly target: ReplayTarget;
  /** The proof the selection is drawn and resolved against. */
  readonly proof: 'LOADING' | 'UNAVAILABLE' | AnchorProof;
  /** The two ends, as message ids — never list positions — so loading older turns or a new reply moves nothing. */
  readonly firstId: string | null;
  readonly lastId: string | null;
  /** The provable range, when there is one. */
  readonly range: ProvenRange | null;
  readonly problem: ReplaySelectionProblem | null;
  readonly command: ReplayCommandAttempt | null;
}

/**
 * The S7-03 handoff: a saved draft, by identity, revision and the proven selection. Never a reference to a screen
 * element. The player reads the Replay by its id; the draft revision is what a preview must name.
 */
export interface ReplayDraftHandoff {
  readonly sessionId: string;
  readonly replayId: string;
  readonly draftRevision: number;
  readonly coverage: ReplayCoverageView;
  /** The server's count of bound committed units. */
  readonly selectedMomentCount: number;
  readonly firstTc: number;
  readonly lastTc: number;
  /** At save time the range reached the open Live Head: a preview answers MOMENT_NOT_SEALED until it is sealed. */
  readonly reachesOpenHead: boolean;
}

export type ReplayNotice = 'SAVED_WHOLE' | 'SAVED_PART' | 'NOT_AVAILABLE';

export interface ReplayEntryState {
  readonly status: ReplayEntryStatus;
  /** The ASIDE, while open: its third choice is the conversation's own saved draft, once it is read. */
  readonly menu: { readonly savedDraft: 'LOADING' | ReplayDraftView | null } | null;
  readonly selection: ReplaySelectionState | null;
  readonly notice: ReplayNotice | null;
  /** The last draft saved here (the S7-03 handoff). */
  readonly saved: ReplayDraftHandoff | null;
}

export interface ReplayEntryController {
  getState(): ReplayEntryState;
  subscribe(listener: () => void): () => void;
  /** Read the hint and the Live Head once. Idempotent. */
  ensure(): void;
  openMenu(): void;
  closeMenu(): void;
  choose(choice: 'WHOLE' | 'PART' | 'SAVED_DRAFT'): void;
  /** PART only: the first tap names one message; the second makes the range; a third starts again. */
  toggle(messageId: string): void;
  save(): void;
  /** Re-issue the unconfirmed command: the same id, the same request. */
  retry(): void;
  /** Leave the selection. An unresolved command is kept, and re-entering resumes it. */
  cancel(): void;
  dismissNotice(): void;
  retire(): void;
}

export interface ReplayEntryControllerOptions {
  readonly sessionId: string;
  readonly transport: ReplayEntryTransport;
  readonly conversation: ReplayConversationSource;
  readonly isCurrent: () => boolean;
  /** Mints a command id. Injectable so a test can name ids; production uses the default. */
  readonly newCommandId?: () => string;
}

/** At most this many event pages are read for one proof (256 events each). Beyond it the proof is not attempted. */
export const MAX_PROOF_PAGES = 64;
/** A Live Head that moves while the proof is read is caught up at most this many times. */
const MAX_HEAD_CATCH_UPS = 3;

/** A UUID v4 command id. An idempotency key, not a secret; it carries no reader data. */
export function mintReplayCommandId(): string {
  const bytes = new Uint8Array(16);
  const source = (globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array } }).crypto;
  if (typeof source?.getRandomValues === 'function') source.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const completedReplies = (exchanges: readonly ConversationExchangeView[]) => exchanges.filter((e) => e.reply !== null).length;

export function createReplayEntryController(options: ReplayEntryControllerOptions): ReplayEntryController {
  const { sessionId, transport, conversation, isCurrent } = options;
  const newId = options.newCommandId ?? mintReplayCommandId;

  let state: ReplayEntryState = Object.freeze({ status: 'UNKNOWN', menu: null, selection: null, notice: null, saved: null });
  const listeners = new Set<() => void>();
  let retired = false;
  let ensured = false;
  let hintOpen = false;
  let headRead: Promise<void> | null = null;
  /** The command that is still unresolved, kept across leaving the selection. */
  let unresolved: ReplayCommandAttempt | null = null;
  let seenReplies = completedReplies(conversation.getState().exchanges);
  /** Bumped whenever a selection is entered or left, so a late proof never lands in another selection. */
  let selectionGeneration = 0;

  const live = () => !retired && isCurrent();
  const displayed = () => displayedMessageIds(conversation.getState().exchanges);

  function update(patch: Partial<ReplayEntryState>): void {
    state = Object.freeze({ ...state, ...patch });
    for (const listener of Array.from(listeners)) listener();
  }

  /** Re-derive the range from the ends, the proof and what is displayed now. Never moves an end. */
  function resolved(selection: Omit<ReplaySelectionState, 'range'> & { readonly range?: ProvenRange | null }): ReplaySelectionState {
    const { proof } = selection;
    let range: ProvenRange | null = null;
    let problem = selection.problem;
    if (typeof proof === 'object') {
      if (selection.scope === 'WHOLE') range = wholeRange(proof);
      else if (selection.firstId !== null && selection.lastId !== null) {
        range = partRange(proof, displayed(), selection.firstId, selection.lastId);
        if (range === null && problem === null) problem = 'NOT_PROVABLE';
        if (range !== null && problem === 'NOT_PROVABLE') problem = null;
      }
    }
    return Object.freeze({ ...selection, range, problem });
  }

  function setSelection(selection: ReplaySelectionState | null): void {
    update({ selection });
  }

  // -------------------------------------------------------------------------------- the hint and the head
  function readHead(): Promise<void> {
    if (headRead !== null) return headRead;
    headRead = transport.liveHead(sessionId).then((head) => {
      headRead = null;
      if (!live() || !hintOpen) return;
      if (head.kind === 'READ') update({ status: head.liveHead === null ? 'RESERVED' : 'AVAILABLE' });
      // An unreadable head changes nothing: what is drawn stays true until the next committed reply asks again.
      else if (state.status === 'UNKNOWN') update({ status: 'RESERVED' });
    });
    return headRead;
  }

  function readHint(): Promise<void> {
    return transport.capability().then(async (hint) => {
      if (!live()) return;
      hintOpen = hint.kind === 'READ' && hint.creationAvailable;
      if (!hintOpen) {
        update({ status: 'HIDDEN', menu: null });
        return;
      }
      await readHead();
    });
  }

  const unsubscribe = conversation.subscribe(() => {
    if (!live()) return;
    const replies = completedReplies(conversation.getState().exchanges);
    const grew = replies !== seenReplies;
    seenReplies = replies;
    if (grew && hintOpen && state.status !== 'AVAILABLE') void readHead();
    // A saved / unavailable line belongs to the moment it answered; the conversation moving on takes it away.
    if (grew && state.notice !== null) update({ notice: null });
    const selection = state.selection;
    if (selection === null) return;
    // A new committed reply extends the proof; an older page only re-draws. Neither moves an end of the selection.
    if (grew && typeof selection.proof === 'object') void extendProof(selection.proof);
    else setSelection(resolved(selection));
  });

  // -------------------------------------------------------------------------------------------- the proof
  async function readEvents(after: number | undefined, held: readonly ReplayEventPage[] = []): Promise<ReplayEventPage[] | null> {
    const pages = [...held];
    let cursor = after;
    for (let page = 0; page < MAX_PROOF_PAGES; page += 1) {
      const read = await transport.committedEvents(sessionId, cursor);
      if (read.kind !== 'READ') return null;
      pages.push(read.events);
      if (read.events.length < REPLAY_EVENTS_PAGE) return pages;
      cursor = read.events[read.events.length - 1].lastSp;
    }
    return null;
  }

  /** Read every committed-unit event and the Live Head, then prove them together. */
  async function loadProof(events: readonly ReplayEventPage[] = [], after?: number): Promise<AnchorProof | null> {
    let pages = await readEvents(after, events);
    for (let attempt = 0; pages !== null && attempt < MAX_HEAD_CATCH_UPS; attempt += 1) {
      const head = await transport.liveHead(sessionId);
      if (head.kind !== 'READ') return null;
      const flat = pages.flat();
      const end = flat.length === 0 ? null : flat[flat.length - 1].lastSp;
      if (head.liveHead !== null && end !== null && head.liveHead > end) {
        // A message was committed between the events and the head: catch up after the last event, then ask again.
        pages = await readEvents(end, pages);
        continue;
      }
      const proven = proveAnchors(sessionId, flat, head.liveHead);
      return proven.ok ? proven.proof : null;
    }
    return null;
  }

  function startProof(generation: number): void {
    void loadProof().then((proof) => {
      const selection = state.selection;
      if (!live() || selection === null || generation !== selectionGeneration) return;
      if (proof === null) {
        setSelection(resolved({ ...selection, proof: 'UNAVAILABLE', problem: selection.problem ?? 'FAILED' }));
        return;
      }
      let { firstId, lastId } = selection;
      // Re-entry into the saved draft: its ends are marked when both are on screen; otherwise the reader chooses anew.
      if (selection.target.kind === 'REVISE' && firstId === null && pendingDraftRange !== null) {
        const shown = displayed();
        const a = displayedMessageAt(proof, shown, 'first', pendingDraftRange.firstTc);
        const b = displayedMessageAt(proof, shown, 'last', pendingDraftRange.lastTc);
        if (a !== null && b !== null) [firstId, lastId] = [a, b];
        pendingDraftRange = null;
      }
      setSelection(resolved({ ...selection, proof, firstId, lastId, problem: selection.problem === 'FAILED' ? null : selection.problem }));
    });
  }

  async function extendProof(held: AnchorProof): Promise<void> {
    const generation = selectionGeneration;
    const proof = await loadProof([held.events], held.liveHead);
    const selection = state.selection;
    if (!live() || selection === null || generation !== selectionGeneration) return;
    // An extension that does not keep every earlier block exactly as it was is no proof: fail closed.
    const kept = proof !== null && [...held.blocks].every(([turn, block]) => {
      const now = proof.blocks.get(turn);
      return now !== undefined && now.firstSp === block.firstSp && (now.lastSp === block.lastSp || turn === held.order[held.order.length - 1]);
    });
    setSelection(resolved({ ...selection, proof: kept ? proof! : 'UNAVAILABLE', problem: kept ? selection.problem : 'FAILED' }));
  }

  /** The saved draft's range while its re-entry proof is read. */
  let pendingDraftRange: ReplayRange | null = null;

  function enter(scope: ReplayScope, target: ReplayTarget, ends: { firstId: string | null; lastId: string | null } = { firstId: null, lastId: null }): void {
    selectionGeneration += 1;
    setSelection(Object.freeze({ scope, target, proof: 'LOADING', firstId: ends.firstId, lastId: ends.lastId, range: null, problem: null, command: null }));
    update({ menu: null, notice: null });
    startProof(selectionGeneration);
  }

  // --------------------------------------------------------------------------------------------- commands
  function issue(attempt: ReplayCommandAttempt): void {
    const sending = Object.freeze({ ...attempt, phase: 'SAVING' as const });
    unresolved = sending;
    const selection = state.selection;
    if (selection !== null) setSelection(Object.freeze({ ...selection, command: sending, problem: null }));
    const range = { firstTc: attempt.range.firstTc, lastTc: attempt.range.lastTc };
    const sent = attempt.target.kind === 'CREATE'
      ? transport.createDraft(attempt.id, sessionId, range)
      : transport.reviseDraft(attempt.id, attempt.target.replayId, attempt.target.expectedDraftRevision, range);
    void sent.then((result) => settle(sending, result));
  }

  function settle(attempt: ReplayCommandAttempt, result: ReplayCommandResult): void {
    if (!live() || unresolved?.id !== attempt.id) return;
    const selection = state.selection;
    const mine = selection !== null && selection.command?.id === attempt.id;
    switch (result.kind) {
      case 'ANSWERED': {
        unresolved = null;
        const { answer } = result;
        const saved: ReplayDraftHandoff = Object.freeze({
          sessionId, replayId: answer.replayId, draftRevision: answer.draftRevision, coverage: answer.coverage,
          selectedMomentCount: answer.selectedMomentCount, firstTc: attempt.range.firstTc, lastTc: attempt.range.lastTc,
          reachesOpenHead: attempt.range.reachesOpenHead,
        });
        // The words follow what the SERVER says was saved, never what was asked for.
        update({ saved, notice: answer.coverage === 'FULL_SOURCE' ? 'SAVED_WHOLE' : 'SAVED_PART', ...(mine ? { selection: null } : {}) });
        if (mine) selectionGeneration += 1;
        return;
      }
      case 'REFUSED_BY_SERVER':
        unresolved = null;
        refused(result.refusal, attempt, mine);
        return;
      case 'NOT_ADMITTED':
        unresolved = null;
        if (mine) setSelection(resolved({ ...selection!, command: null, problem: 'FAILED' }));
        return;
      case 'OUTCOME_UNKNOWN': {
        const unconfirmed = Object.freeze({ ...attempt, phase: 'UNCONFIRMED' as const });
        unresolved = unconfirmed;
        if (mine) setSelection(Object.freeze({ ...selection!, command: unconfirmed, problem: 'UNCONFIRMED' }));
        return;
      }
    }
  }

  function refused(refusal: ReplayDraftRefusal, attempt: ReplayCommandAttempt, mine: boolean): void {
    if (refusal === 'NOT_AVAILABLE_NOW') {
      if (mine) selectionGeneration += 1;
      update({ notice: 'NOT_AVAILABLE', ...(mine ? { selection: null } : {}) });
      void readHint();
      return;
    }
    if (!mine) return;
    const selection = state.selection!;
    if (refusal === 'CHANGED' || refusal === 'SOURCE_CHANGED') {
      // Something moved since the range was proven: prove again, and the reader chooses again. A revision re-reads
      // the draft revision it must name.
      selectionGeneration += 1;
      const generation = selectionGeneration;
      setSelection(Object.freeze({ ...selection, proof: 'LOADING', firstId: null, lastId: null, range: null, command: null, problem: 'CHANGED' }));
      if (attempt.target.kind === 'REVISE') {
        const replayId = attempt.target.replayId;
        void transport.replay(replayId).then((read) => {
          const now = state.selection;
          if (!live() || now === null || generation !== selectionGeneration) return;
          if (read.kind === 'FOUND' && read.replay.lifecycle === 'DRAFT') {
            setSelection(Object.freeze({ ...now, target: { kind: 'REVISE' as const, replayId, expectedDraftRevision: read.replay.revision } }));
            startProof(generation);
          } else {
            setSelection(resolved({ ...now, proof: 'UNAVAILABLE', problem: 'FAILED' }));
          }
        });
      } else {
        startProof(generation);
      }
      return;
    }
    // NOT_WHOLE_MESSAGES, UNAVAILABLE, SELECTION_NOT_SUPPORTED, LIFECYCLE_NOT_ELIGIBLE, COMMAND_CONFLICT: nothing was
    // saved; the reader may choose again, under a new command.
    setSelection(resolved({ ...selection, command: null, problem: 'FAILED' }));
  }

  // -------------------------------------------------------------------------------------------- the menu
  function readSavedDraft(): void {
    void transport.conversationReplays(sessionId).then(async (list) => {
      if (!live() || state.menu === null) return;
      const drafts = list.kind === 'READ' ? list.replays.filter((r) => r.lifecycle === 'DRAFT') : [];
      const newest = drafts.reduce<(typeof drafts)[number] | null>((best, r) => (best === null || r.createdAt > best.createdAt ? r : best), null);
      if (newest === null) {
        update({ menu: { savedDraft: null } });
        return;
      }
      const read = await transport.replay(newest.replayId);
      if (!live() || state.menu === null) return;
      update({ menu: { savedDraft: read.kind === 'FOUND' && read.replay.lifecycle === 'DRAFT' ? read.replay : null } });
    });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    ensure() {
      if (!live() || ensured) return;
      ensured = true;
      void readHint();
    },
    openMenu() {
      if (!live() || state.status !== 'AVAILABLE' || state.selection !== null) return;
      if (unresolved !== null) {
        // An unresolved attempt is resumed, never replaced by a new one.
        const attempt = unresolved;
        enter(attempt.scope, attempt.target, { firstId: attempt.firstId, lastId: attempt.lastId });
        setSelection(Object.freeze({ ...state.selection!, command: attempt, problem: attempt.phase === 'UNCONFIRMED' ? 'UNCONFIRMED' : null }));
        return;
      }
      update({ menu: { savedDraft: 'LOADING' }, notice: null });
      readSavedDraft();
      // The hint is read again on every opening; a closed gate takes the entry away.
      void readHint();
    },
    closeMenu() {
      if (!live() || state.menu === null) return;
      update({ menu: null });
    },
    choose(choice) {
      if (!live() || state.menu === null) return;
      if (choice === 'SAVED_DRAFT') {
        const draft = state.menu.savedDraft;
        if (draft === 'LOADING' || draft === null) return;
        pendingDraftRange = { firstTc: draft.firstTc, lastTc: draft.lastTc };
        enter('PART', { kind: 'REVISE', replayId: draft.replayId, expectedDraftRevision: draft.revision });
        return;
      }
      pendingDraftRange = null;
      enter(choice, { kind: 'CREATE' });
    },
    toggle(messageId) {
      const selection = state.selection;
      if (!live() || selection === null || selection.scope !== 'PART' || selection.command !== null || typeof selection.proof !== 'object') return;
      const id = messageId.toLowerCase();
      if (!selection.proof.blocks.has(id)) return;
      const { firstId, lastId } = selection;
      const next = firstId === null || firstId !== lastId ? { firstId: id, lastId: id } : { firstId, lastId: id };
      setSelection(resolved({ ...selection, ...next, problem: null }));
    },
    save() {
      const selection = state.selection;
      if (!live() || selection === null || selection.command !== null || selection.range === null || unresolved !== null) return;
      issue({ id: newId(), scope: selection.scope, target: selection.target, range: selection.range, firstId: selection.firstId,
        lastId: selection.lastId, phase: 'SAVING' });
    },
    retry() {
      const selection = state.selection;
      if (!live() || selection === null || selection.command?.phase !== 'UNCONFIRMED') return;
      issue(selection.command);
    },
    cancel() {
      const selection = state.selection;
      if (!live() || selection === null || selection.command?.phase === 'SAVING') return;
      selectionGeneration += 1;
      update({ selection: null });
    },
    dismissNotice() {
      if (!live() || state.notice === null) return;
      update({ notice: null });
    },
    retire() {
      if (retired) return;
      retired = true;
      unsubscribe();
      listeners.clear();
    },
  };
}

type ReplayEventPage = Extract<CommittedEventsResult, { kind: 'READ' }>['events'];
