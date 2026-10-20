/**
 * S7-04 — the Personal Replay player for ONE runtime generation: which Replay is open, which version is shown, the
 * current moment (its ordinal), whether it is playing, and the one private lifecycle command in flight.
 *
 * It owns presentation state and nothing that is truth elsewhere:
 *
 *   - the historical truth and the moment order are the Replay's: a version, its moments and each moment's analysis
 *     come only from the S7-03 composite controller over the three S7-01 reads, and the moments are navigated by their
 *     own `ordinal`. Nothing is re-derived, re-analysed or re-ordered here;
 *   - the graphics are Living Analysis's: this owner draws nothing and holds no camera, map or motion state;
 *   - the live conversation is the conversation's: nothing here reads or writes it, its composer, its store, its
 *     Session state or its Timeline. The overlay's visibility lives HERE, so a new generation's player starts closed.
 *
 * ## Commands: one stable id per attempt, and no guess
 *
 * Preview, finalize and reopen are minted ONE command id when the reader presses them, and that id is kept with the
 * exact request it names. An answer that cannot be read is UNCONFIRMED — never success and never failure — and "Try
 * again" re-issues the SAME command (same id, same body), which the server answers from its committed history. While a
 * command is unresolved no other command is offered; closing the player keeps it, and reopening the same Replay
 * resumes it. A bounded refusal is said as what it is; after CHANGED, SOURCE_CHANGED, ANALYSIS_CHANGED or
 * LIFECYCLE_NOT_ELIGIBLE the Replay is read again, and only the server's answer decides what is shown next.
 *
 * ## Playback: a declared reading pace, never the original timing
 *
 * Play steps through the version's moments in ordinal order at a presentation pace derived from the length of the
 * moment's text — not audio, not video and not the conversation's original timing. The step is armed only once the
 * current moment is settled (its text is here and its analysis read has answered), and is cancelled whenever it is not.
 * Playing stops at the last moment, on pause, on close, on retirement, whenever a command is issued, and whenever the
 * version stops being viewable (REVOKED, NOT_VIEWABLE, FAILED, NOT_FOUND). No timer and no answer outlives the epoch it
 * belongs to: closing, reopening or retiring bumps it, and anything that lands later is dropped.
 */
import type { HistoricalSemanticDepth } from '@qandeel/runtime';

import { createReplayCompositeController, type ReplayCompositeController, type ReplayHistoryReader } from '../replay-composite';
import { mintReplayCommandId, type ReplayDraftHandoff } from '../replay-entry';
import type {
  ReplayCurrentVersionView,
  ReplayFinalizeResult,
  ReplayLifecycleRefusal,
  ReplayLifecycleView,
  ReplayListResult,
  ReplayPreviewResult,
  ReplayReadResult,
  ReplayReopenResult,
} from '../runtime-entry';

/** The reads this owner needs (the S7-02 `ReplayApiClient` satisfies them). */
export interface ReplayPlayerReads {
  replay(replayId: string): Promise<ReplayReadResult>;
  conversationReplays(sessionId: string): Promise<ReplayListResult>;
}

/** The three lifecycle commands (the S7-04 `ReplayLifecycleApiClient` satisfies them). */
export interface ReplayPlayerCommands {
  preview(commandId: string, replayId: string, expectedDraftRevision: number): Promise<ReplayPreviewResult>;
  finalize(commandId: string, replayId: string, expectedVersionId: string): Promise<ReplayFinalizeResult>;
  reopen(commandId: string, replayId: string, expectedVersionId: string): Promise<ReplayReopenResult>;
}

/** A presentation timer. Injectable so a test steps it; production uses the platform's. */
export interface ReplayPlayerScheduler {
  set(run: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export type ReplayPlayerOrigin = 'CONVERSATION' | 'ANALYSIS';
export type ReplayPlayerAct = 'PREVIEW' | 'FINALIZE' | 'REOPEN';

/**
 * READ_FAILED          — the Replay (or the conversation's list) could not be read: Try again reads it again;
 * NOT_FOUND            — not this reader's, or no longer there; nothing of it is shown;
 * NONE                 — this conversation has no Replay to open;
 * CHANGED              — CHANGED / SOURCE_CHANGED: something moved; the Replay was read again;
 * ANALYSIS_CHANGED     — finalize refused: the analysis moved since the preview;
 * MOMENT_NOT_SEALED    — the preview reaches the open Live Head;
 * ANALYSIS_UNAVAILABLE — the conversation has no sealed analysis to replay;
 * NOT_AVAILABLE_NOW    — the gate refused the command;
 * FAILED               — refused for another reason, or refused before admission: nothing was done;
 * UNCONFIRMED          — the command's answer could not be read: Try again re-issues the SAME command.
 */
export type ReplayPlayerProblem =
  | 'READ_FAILED' | 'NOT_FOUND' | 'NONE' | 'CHANGED' | 'ANALYSIS_CHANGED' | 'MOMENT_NOT_SEALED' | 'ANALYSIS_UNAVAILABLE'
  | 'NOT_AVAILABLE_NOW' | 'FAILED' | 'UNCONFIRMED';

export interface ReplayPlayerCommand {
  readonly id: string;
  readonly act: ReplayPlayerAct;
  readonly replayId: string;
  /** The draft revision a preview names, or the version id a finalize / reopen names. */
  readonly expected: number | string;
  readonly phase: 'SENDING' | 'UNCONFIRMED';
}

export interface ReplayPlayerView {
  readonly origin: ReplayPlayerOrigin;
  /** `null` only while the Analysis entry is still finding which Replay to open. */
  readonly replayId: string | null;
  readonly reading: boolean;
  readonly lifecycle: ReplayLifecycleView | null;
  readonly draftRevision: number | null;
  /** The version shown. After a reopen it is still the finalized one, until a new preview replaces it. */
  readonly version: ReplayCurrentVersionView | null;
  readonly composite: ReplayCompositeController | null;
  /** The current moment, by its ordinal in the version (1 .. momentCount). */
  readonly ordinal: number;
  readonly playing: boolean;
  readonly command: ReplayPlayerCommand | null;
  readonly problem: ReplayPlayerProblem | null;
  readonly notice: 'FINALIZED' | 'DRAFT_AGAIN' | null;
}

export interface ReplayPlayerState {
  readonly open: ReplayPlayerView | null;
}

/** What the transport may offer for the moment shown, derived from the composite's own state. */
export interface ReplayPlayerTransportView {
  /** The moments may be navigated: the version is READY and VIEWABLE. */
  readonly available: boolean;
  readonly count: number;
  readonly index: number;
  readonly atFirst: boolean;
  readonly atLast: boolean;
}

export interface ReplayPlayerController {
  getState(): ReplayPlayerState;
  subscribe(listener: () => void): () => void;
  /** From the Conversation: the draft just saved there, and the reader pressed Preview. */
  openSaved(handoff: ReplayDraftHandoff): void;
  /** From the Analysis: this conversation's newest Replay (the one saved in this generation, if any). */
  openLatest(saved: ReplayDraftHandoff | null): void;
  close(): void;
  preview(): void;
  finalize(): void;
  reopen(): void;
  /** Re-issue the unconfirmed command (same id, same body), or read again what could not be read. */
  retry(): void;
  play(): void;
  pause(): void;
  previous(): void;
  next(): void;
  /**
   * The Replay Temporal Spine's commit: go to one moment OF THIS VERSION, by its ordinal. Anything else is refused and
   * changes nothing. Like a step, it only moves the ordinal; the composite commits that moment's TC through T-06.
   */
  seek(ordinal: number): void;
  transport(): ReplayPlayerTransportView;
  dismissNotice(): void;
  retire(): void;
}

export interface ReplayPlayerControllerOptions {
  readonly sessionId: string;
  readonly reads: ReplayPlayerReads;
  readonly commands: ReplayPlayerCommands;
  readonly history: ReplayHistoryReader;
  readonly isCurrent: () => boolean;
  /** Mints a command id. Injectable so a test can name ids; production uses the S7-02 minting. */
  readonly newCommandId?: () => string;
  readonly scheduler?: ReplayPlayerScheduler;
}

const DEPTHS: readonly HistoricalSemanticDepth[] = ['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'];

/**
 * The declared presentation pace: long enough to read the moment's text, never its original timing. A base, plus a
 * share per character, within fixed bounds.
 */
export const REPLAY_READING_PACE = Object.freeze({ baseMs: 2500, perCharacterMs: 45, minMs: 3500, maxMs: 12000 });

export function readingPaceMs(text: string): number {
  const { baseMs, perCharacterMs, minMs, maxMs } = REPLAY_READING_PACE;
  return Math.min(maxMs, Math.max(minMs, baseMs + Array.from(text).length * perCharacterMs));
}

const platformScheduler: ReplayPlayerScheduler = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createReplayPlayerController(options: ReplayPlayerControllerOptions): ReplayPlayerController {
  const { sessionId, reads, commands, history, isCurrent } = options;
  const newId = options.newCommandId ?? mintReplayCommandId;
  const scheduler = options.scheduler ?? platformScheduler;

  let state: ReplayPlayerState = Object.freeze({ open: null });
  const listeners = new Set<() => void>();
  let retired = false;
  /** Bumped on every open, close and retirement: an answer or a timer from an earlier epoch is dropped. */
  let epoch = 0;
  /** The commands that are still unresolved, by Replay, kept across closing the player. */
  const unresolved = new Map<string, ReplayPlayerCommand>();
  let timer: { readonly handle: unknown; readonly ordinal: number } | null = null;
  let unsubscribeComposite: (() => void) | null = null;
  /** The last read that failed, so Try again repeats exactly it. */
  let failedRead: (() => void) | null = null;

  const live = () => !retired && isCurrent();
  const view = () => state.open;

  function publish(open: ReplayPlayerView | null): void {
    state = Object.freeze({ open: open === null ? null : Object.freeze(open) });
    for (const listener of Array.from(listeners)) listener();
    rearm();
  }
  function patch(next: Partial<ReplayPlayerView>): void {
    const current = view();
    if (current !== null) publish({ ...current, ...next });
  }

  // ------------------------------------------------------------------------------------------- the version
  function attach(composite: ReplayCompositeController | null): void {
    unsubscribeComposite?.();
    unsubscribeComposite = composite === null ? null : composite.subscribe(onComposite);
    composite?.open();
  }
  function showVersion(version: ReplayCurrentVersionView, replayId: string): Partial<ReplayPlayerView> {
    const composite = createReplayCompositeController(history, replayId, version.versionId);
    attach(composite);
    return { version, composite, ordinal: 1, playing: false };
  }
  function dropVersion(): Partial<ReplayPlayerView> {
    attach(null);
    return { version: null, composite: null, ordinal: 1, playing: false };
  }

  /** The moments of the version shown, when they may be navigated (READY and VIEWABLE), in ordinal order. */
  function ordinals(): readonly number[] | null {
    const composite = view()?.composite ?? null;
    if (composite === null) return null;
    const read = composite.state();
    if (read.status !== 'READY' || read.version.viewing.state !== 'VIEWABLE') return null;
    return read.moments.map((moment) => moment.ordinal).sort((a, b) => a - b);
  }

  function onComposite(): void {
    if (!live()) return;
    const current = view();
    if (current === null) return;
    // Viewing withdrawn, or never granted: nothing plays.
    if (current.playing && ordinals() === null) {
      patch({ playing: false });
      return;
    }
    rearm();
  }

  // ---------------------------------------------------------------------------------------------- playback
  /** The current moment is here and its analysis read has answered: the reader can see what is shown. */
  function settledText(): string | null {
    const current = view();
    const composite = current?.composite ?? null;
    if (current === null || composite === null) return null;
    const read = composite.state();
    if (read.status !== 'READY' || read.version.viewing.state !== 'VIEWABLE') return null;
    const moment = read.moments.find((candidate) => candidate.ordinal === current.ordinal);
    if (moment === undefined || moment.text === null) return null;
    const answers = DEPTHS.map((depth) => composite.analysis(current.ordinal, depth));
    if (answers.every((answer) => answer === null) || answers.some((answer) => answer?.status === 'LOADING')) return null;
    return moment.text;
  }

  function disarm(): void {
    if (timer === null) return;
    scheduler.clear(timer.handle);
    timer = null;
  }

  function rearm(): void {
    const current = view();
    if (!live() || current === null || !current.playing || current.command !== null) {
      disarm();
      return;
    }
    const text = settledText();
    if (text === null) {
      disarm();
      return;
    }
    if (timer !== null && timer.ordinal === current.ordinal) return;
    disarm();
    const armedIn = epoch;
    const armedAt = current.ordinal;
    timer = {
      ordinal: armedAt,
      handle: scheduler.set(() => {
        timer = null;
        const now = view();
        if (!live() || armedIn !== epoch || now === null || !now.playing || now.ordinal !== armedAt) return;
        const order = ordinals();
        const at = order === null ? -1 : order.indexOf(armedAt);
        if (order === null || at < 0) {
          patch({ playing: false });
          return;
        }
        // Stop at the end: the last moment stays on screen.
        if (at === order.length - 1) patch({ playing: false });
        else patch({ ordinal: order[at + 1] });
      }, readingPaceMs(text)),
    };
  }

  // ---------------------------------------------------------------------------------------------- reading
  /** Read the Replay, and let the server's answer decide what is shown. */
  function readReplay(replayId: string, then: 'VIEW' | 'PREVIEW' = 'VIEW'): void {
    const started = epoch;
    patch({ reading: true });
    void reads.replay(replayId).then((read) => {
      const current = view();
      if (!live() || started !== epoch || current === null || current.replayId !== replayId) return;
      if (read.kind === 'NOT_FOUND') {
        // Not this reader's, or gone: nothing of it stays on screen.
        failedRead = null;
        publish({ ...current, ...dropVersion(), reading: false, lifecycle: null, draftRevision: null, problem: 'NOT_FOUND', notice: null });
        return;
      }
      if (read.kind !== 'FOUND') {
        failedRead = () => readReplay(replayId, then);
        publish({ ...current, reading: false, problem: current.problem ?? 'READ_FAILED' });
        return;
      }
      failedRead = null;
      const { replay } = read;
      const shown = current.version;
      const version: Partial<ReplayPlayerView> = replay.currentVersion === null ? dropVersion()
        : shown === null || shown.versionId !== replay.currentVersion.versionId ? showVersion(replay.currentVersion, replayId)
          : { version: replay.currentVersion };
      publish({ ...current, reading: false, lifecycle: replay.lifecycle, draftRevision: replay.lifecycle === 'DRAFT' ? replay.revision : null, ...version });
      if (then === 'PREVIEW' && replay.lifecycle === 'DRAFT' && current.command === null) issueNew('PREVIEW');
    });
  }

  function readLatest(saved: ReplayDraftHandoff | null): void {
    if (saved !== null && saved.sessionId.toLowerCase() === sessionId.toLowerCase()) {
      patch({ replayId: saved.replayId.toLowerCase() });
      resume(saved.replayId.toLowerCase());
      readReplay(saved.replayId.toLowerCase());
      return;
    }
    const started = epoch;
    patch({ reading: true });
    void reads.conversationReplays(sessionId).then((list) => {
      const current = view();
      if (!live() || started !== epoch || current === null) return;
      if (list.kind !== 'READ') {
        failedRead = () => readLatest(null);
        publish({ ...current, reading: false, problem: 'READ_FAILED' });
        return;
      }
      failedRead = null;
      const newest = list.replays.reduce<(typeof list.replays)[number] | null>((best, r) => (best === null || r.createdAt > best.createdAt ? r : best), null);
      if (newest === null) {
        publish({ ...current, reading: false, problem: 'NONE' });
        return;
      }
      publish({ ...current, replayId: newest.replayId });
      resume(newest.replayId);
      readReplay(newest.replayId);
    });
  }

  function resume(replayId: string): void {
    const kept = unresolved.get(replayId);
    if (kept !== undefined) patch({ command: kept, problem: kept.phase === 'UNCONFIRMED' ? 'UNCONFIRMED' : null });
  }

  // --------------------------------------------------------------------------------------------- commands
  function issueNew(act: ReplayPlayerAct): void {
    const current = view();
    if (current === null || current.replayId === null || current.command !== null || unresolved.has(current.replayId)) return;
    let expected: number | string;
    if (act === 'PREVIEW') {
      if (current.lifecycle !== 'DRAFT' || current.draftRevision === null) return;
      expected = current.draftRevision;
    } else if (act === 'FINALIZE') {
      if (current.lifecycle !== 'PREVIEW_READY' || current.version === null || current.version.finalized) return;
      expected = current.version.versionId;
    } else {
      // Reopen applies to a previewed or a finalized Replay (0103 `reopen_replay_for_revision_v1`): it is also the way on
      // after a finalize the server refused.
      if ((current.lifecycle !== 'PREVIEW_READY' && current.lifecycle !== 'FINALIZED') || current.version === null) return;
      expected = current.version.versionId;
    }
    issue({ id: newId(), act, replayId: current.replayId, expected, phase: 'SENDING' });
  }

  function issue(command: ReplayPlayerCommand): void {
    const sending = Object.freeze({ ...command, phase: 'SENDING' as const });
    unresolved.set(sending.replayId, sending);
    patch({ command: sending, problem: null, notice: null, playing: false });
    const sent: Promise<ReplayPreviewResult | ReplayFinalizeResult | ReplayReopenResult> = sending.act === 'PREVIEW'
      ? commands.preview(sending.id, sending.replayId, sending.expected as number)
      : sending.act === 'FINALIZE'
        ? commands.finalize(sending.id, sending.replayId, sending.expected as string)
        : commands.reopen(sending.id, sending.replayId, sending.expected as string);
    void sent.then((result) => settle(sending, result), () => settle(sending, { kind: 'OUTCOME_UNKNOWN' }));
  }

  function settle(command: ReplayPlayerCommand, result: ReplayPreviewResult | ReplayFinalizeResult | ReplayReopenResult): void {
    if (!live() || unresolved.get(command.replayId)?.id !== command.id) return;
    if (result.kind === 'OUTCOME_UNKNOWN') {
      const unconfirmed = Object.freeze({ ...command, phase: 'UNCONFIRMED' as const });
      unresolved.set(command.replayId, unconfirmed);
      if (mine(command)) patch({ command: unconfirmed, problem: 'UNCONFIRMED' });
      return;
    }
    unresolved.delete(command.replayId);
    // Closed, or another Replay is open: the server committed what it committed; the next opening reads it.
    if (!mine(command)) return;
    const current = view()!;
    if (result.kind === 'NOT_ADMITTED') {
      patch({ command: null, problem: 'FAILED' });
      return;
    }
    if (result.kind === 'REFUSED_BY_SERVER') {
      refused(command, result.refusal);
      return;
    }
    const { answer } = result;
    if (answer.outcome === 'PREVIEW_READY') {
      publish({ ...current, command: null, problem: null, lifecycle: 'PREVIEW_READY', draftRevision: null,
        ...showVersion({ versionId: answer.versionId, revision: answer.versionRevision, finalized: false }, command.replayId) });
      return;
    }
    if (answer.outcome === 'FINALIZED') {
      if (current.version !== null && current.version.versionId === answer.versionId) {
        // The same version, now the reader's private copy: the moment on screen stays where it is.
        publish({ ...current, command: null, problem: null, lifecycle: 'FINALIZED', version: { ...current.version, finalized: true }, notice: 'FINALIZED' });
      } else {
        publish({ ...current, command: null, problem: null });
        readReplay(command.replayId);
      }
      return;
    }
    // Reopen answered: a draft again. The finalized version stays the one shown until a new preview; the draft revision a
    // preview must name is read, never assumed.
    publish({ ...current, command: null, problem: null, lifecycle: answer.lifecycle, notice: 'DRAFT_AGAIN' });
    readReplay(command.replayId);
  }

  function mine(command: ReplayPlayerCommand): boolean {
    const current = view();
    return current !== null && current.replayId === command.replayId && current.command?.id === command.id;
  }

  function refused(command: ReplayPlayerCommand, refusal: ReplayLifecycleRefusal): void {
    const current = view()!;
    switch (refusal) {
      case 'MOMENT_NOT_SEALED':
      case 'ANALYSIS_UNAVAILABLE':
      case 'NOT_AVAILABLE_NOW':
        patch({ command: null, problem: refusal });
        return;
      case 'CHANGED':
      case 'SOURCE_CHANGED':
      case 'ANALYSIS_CHANGED':
        // What was shown may no longer be what the server holds: the version is read afresh (a source change makes it
        // NOT_VIEWABLE, and its text must not stay on screen), and the Replay is read again.
        publish({ ...current, command: null, problem: refusal === 'ANALYSIS_CHANGED' ? 'ANALYSIS_CHANGED' : 'CHANGED',
          ...(current.version === null ? {} : showVersion(current.version, command.replayId)) });
        readReplay(command.replayId);
        return;
      case 'LIFECYCLE_NOT_ELIGIBLE':
        // Already done elsewhere, or not in that state any more: the server's own record decides what is shown.
        patch({ command: null });
        readReplay(command.replayId);
        return;
      default:
        // UNAVAILABLE, SELECTION_NOT_SUPPORTED, COMMAND_CONFLICT: nothing was done.
        patch({ command: null, problem: 'FAILED' });
    }
  }

  // ------------------------------------------------------------------------------------------------ opening
  function opening(origin: ReplayPlayerOrigin, replayId: string | null): void {
    epoch += 1;
    disarm();
    attach(null);
    failedRead = null;
    publish({ origin, replayId, reading: false, lifecycle: null, draftRevision: null, version: null, composite: null, ordinal: 1, playing: false,
      command: null, problem: null, notice: null });
  }

  function step(delta: 1 | -1): void {
    const current = view();
    const order = ordinals();
    if (!live() || current === null || order === null) return;
    const at = order.indexOf(current.ordinal);
    const target = order[at + delta];
    if (at < 0 || target === undefined) return;
    patch({ ordinal: target });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    openSaved(handoff) {
      if (!live() || handoff.sessionId.toLowerCase() !== sessionId.toLowerCase()) return;
      const replayId = handoff.replayId.toLowerCase();
      opening('CONVERSATION', replayId);
      resume(replayId);
      // The reader pressed Preview: read first, so a Replay already previewed elsewhere is shown, not previewed twice.
      readReplay(replayId, 'PREVIEW');
    },
    openLatest(saved) {
      if (!live()) return;
      opening('ANALYSIS', null);
      readLatest(saved);
    },
    close() {
      if (view() === null) return;
      epoch += 1;
      disarm();
      attach(null);
      failedRead = null;
      publish(null);
    },
    preview() {
      if (live()) issueNew('PREVIEW');
    },
    finalize() {
      if (live()) issueNew('FINALIZE');
    },
    reopen() {
      if (live()) issueNew('REOPEN');
    },
    retry() {
      const current = view();
      if (!live() || current === null) return;
      if (current.command?.phase === 'UNCONFIRMED') {
        issue(current.command);
        return;
      }
      if (current.problem === 'READ_FAILED' && failedRead !== null) {
        const again = failedRead;
        failedRead = null;
        patch({ problem: null });
        again();
      }
    },
    play() {
      const current = view();
      const order = ordinals();
      if (!live() || current === null || order === null || current.command !== null) return;
      // At the last moment, Play starts again from the first.
      const atLast = order.indexOf(current.ordinal) === order.length - 1;
      patch({ playing: true, ...(atLast ? { ordinal: order[0] } : {}) });
    },
    pause() {
      if (live() && view()?.playing) patch({ playing: false });
    },
    previous() {
      step(-1);
    },
    next() {
      step(1);
    },
    seek(ordinal) {
      const current = view();
      const order = ordinals();
      if (!live() || current === null || order === null || current.command !== null || !order.includes(ordinal)) return;
      if (ordinal !== current.ordinal) patch({ ordinal });
    },
    transport() {
      const current = view();
      const order = ordinals();
      if (current === null || order === null) return { available: false, count: 0, index: 0, atFirst: true, atLast: true };
      const index = Math.max(0, order.indexOf(current.ordinal));
      return { available: true, count: order.length, index, atFirst: index === 0, atLast: index === order.length - 1 };
    },
    dismissNotice() {
      const notice = view()?.notice;
      if (live() && notice !== undefined && notice !== null) patch({ notice: null });
    },
    retire() {
      if (retired) return;
      retired = true;
      epoch += 1;
      disarm();
      attach(null);
      unresolved.clear();
      state = Object.freeze({ open: null });
      for (const listener of Array.from(listeners)) listener();
      listeners.clear();
    },
  };
}
