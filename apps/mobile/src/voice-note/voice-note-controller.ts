/**
 * S8B-03 (CP2, decisions D3 / D4, contract §8.2) — the Voice Notes of ONE conversation Session, from an unsent draft to a
 * turn in the conversation.
 *
 *   DRAFT  a recording on this device. It is sent ONLY by the reader's Send, under the command id kept with it, so a
 *          retry is the same upload; the id is rotated only after an UNAVAILABLE answer (§8.2). An upload with no
 *          readable answer MAY have been stored: the draft stays, and its retry reuses the same id, which the server
 *          resolves to the same recording.
 *   NOTE   the server ACCEPTED it — stored, not yet transcribed. Its status is read with a growing delay; READY (or an
 *          already COMMITTED note whose answer was lost) is committed through `POST /voice/notes/:id/turn`, whose replay
 *          answers the same turn and reply, and the exchange is handed to the conversation (`onCommitted`), which merges
 *          it by turn id: never a second user turn or reply.
 *
 * Restoring (a restart, a return to the conversation) re-reads local state and `GET /voice/notes/pending`; it never
 * uploads anything. Polling pauses while the app is not in front of the reader. Nothing is logged.
 */
import type { ConversationExchangeView } from '../runtime-entry/conversation/conversation-turn-api';
import type { ForegroundSignal } from '../runtime-entry/lifecycle/foreground-signal';
import type { VoiceNoteApiClient, VoiceNoteServerStatus, VoiceNoteStatusView } from './voice-note-api';
import { VOICE_NOTE_MAX_BYTES } from './voice-note-limits';
import type { VoiceDraftFiles, VoiceDraftRecord, VoiceDraftStore } from './voice-draft-store';

/** What a draft row says (each maps to its approved line in the surface). */
export type VoiceDraftPhase =
  | 'READY_TO_SEND' //  C-16 / C-20
  | 'SENDING' //        C-24
  | 'NOT_SENT' //       C-25 + C-26 (the same upload again)
  | 'REFUSED' //        C-25, no retry: the server refused this file
  | 'GATE_CLOSED' //    C-31
  | 'CONSENT_REQUIRED'; // C-32

/** What an accepted note's row says. */
export type VoiceNotePhase =
  | 'PROCESSING' //     C-27
  | 'RETRYABLE' //      C-28 + C-26
  | 'FINAL' //          C-29
  | 'NO_SPEECH' //      C-30
  | 'HELD_CONSENT' //   C-33
  | 'GATE_CLOSED'; //   C-31

export type VoiceNoteItem =
  | { readonly kind: 'DRAFT'; readonly draft: VoiceDraftRecord; readonly phase: VoiceDraftPhase }
  | {
      readonly kind: 'NOTE';
      readonly recordingId: string;
      readonly durationMs: number | null;
      readonly availableUntil: string | null;
      readonly phase: VoiceNotePhase;
      /** The reader may ask again (the server's own answer). */
      readonly canRetry: boolean;
    };

export interface VoiceNotesState {
  readonly items: readonly VoiceNoteItem[];
  /** A draft could not be restored (C-23); cleared by `dismissNotice`. */
  readonly unrecoverable: boolean;
}

export interface VoiceNotesControllerOptions {
  readonly owner: string;
  readonly sessionId: string;
  readonly api: Pick<VoiceNoteApiClient, 'upload' | 'status' | 'pending' | 'retry' | 'commitTurn' | 'deleteRecording'>;
  readonly store: VoiceDraftStore;
  readonly files: Pick<VoiceDraftFiles, 'read'>;
  readonly foreground: ForegroundSignal;
  /** The committed exchange, for the conversation of `sessionId` to merge. */
  readonly onCommitted: (exchange: ConversationExchangeView, sessionId: string) => void;
  readonly isCurrent: () => boolean;
  readonly newId: () => string;
  readonly setTimer?: (callback: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

export interface VoiceNotesController {
  getState(): VoiceNotesState;
  subscribe(listener: () => void): () => void;
  /** Local drafts and accepted notes, then the server's pending notes. Sends nothing. */
  restore(): Promise<void>;
  /** A capture became a draft of this Session. */
  addDraft(draft: VoiceDraftRecord): void;
  /** The reader's Send (or Try again) of one draft. */
  send(draftId: string): Promise<void>;
  deleteDraft(draftId: string): Promise<void>;
  /** The reader's Try again of a note whose transcription failed. */
  retryNote(recordingId: string): Promise<void>;
  /** The recording was deleted (the reader's C-42 confirmation, done elsewhere) or is gone: the row goes. */
  forgetNote(recordingId: string): Promise<void>;
  dismissNotice(): void;
  retire(): void;
}

/** The status read's growing delay while a note is being transcribed; the last value repeats. */
export const VOICE_NOTE_POLL_DELAYS_MS = Object.freeze([1_500, 2_000, 3_000, 5_000, 8_000, 10_000]);
/** The upload is abandoned (as an unknown outcome, never "not sent") after this long. */
export const VOICE_NOTE_UPLOAD_TIMEOUT_MS = 120_000;

const NOTE_PHASE: Partial<Record<VoiceNoteServerStatus, VoiceNotePhase>> = {
  PROCESSING: 'PROCESSING',
  FAILED_RETRYABLE: 'RETRYABLE',
  FAILED_FINAL: 'FINAL',
  NO_SPEECH: 'NO_SPEECH',
  HELD_CONSENT: 'HELD_CONSENT',
};

export function createVoiceNotesController(options: VoiceNotesControllerOptions): VoiceNotesController {
  const { owner, sessionId, api, store, files, foreground, onCommitted, isCurrent, newId } = options;
  const setTimer = options.setTimer ?? ((callback: () => void, ms: number) => setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let state: VoiceNotesState = { items: [], unrecoverable: false };
  const listeners = new Set<() => void>();
  let retired = false;
  /** One poll per note: its attempt count, its timer, and whether a read or commit is in flight. */
  const polls = new Map<string, { attempt: number; timer: unknown; busy: boolean }>();
  const live = () => !retired && isCurrent();

  const set = (next: Partial<VoiceNotesState>) => {
    state = { ...state, ...next };
    for (const listener of Array.from(listeners)) listener();
  };
  const replace = (match: (item: VoiceNoteItem) => boolean, next: VoiceNoteItem | null) => {
    const items: VoiceNoteItem[] = [];
    let found = false;
    for (const item of state.items) {
      if (match(item)) {
        found = true;
        if (next !== null) items.push(next);
      } else items.push(item);
    }
    if (!found && next !== null) items.push(next);
    set({ items });
  };
  const isDraft = (draftId: string) => (item: VoiceNoteItem) => item.kind === 'DRAFT' && item.draft.draftId === draftId;
  const isNote = (recordingId: string) => (item: VoiceNoteItem) => item.kind === 'NOTE' && item.recordingId === recordingId;
  const noteOf = (recordingId: string) => state.items.find(isNote(recordingId)) as Extract<VoiceNoteItem, { kind: 'NOTE' }> | undefined;
  const draftOf = (draftId: string) => state.items.find(isDraft(draftId)) as Extract<VoiceNoteItem, { kind: 'DRAFT' }> | undefined;

  function stopPoll(recordingId: string): void {
    const poll = polls.get(recordingId);
    if (poll?.timer !== null && poll?.timer !== undefined) clearTimer(poll.timer);
    polls.delete(recordingId);
  }

  function schedule(recordingId: string): void {
    if (!live()) return;
    const poll = polls.get(recordingId) ?? { attempt: 0, timer: null, busy: false };
    polls.set(recordingId, poll);
    if (poll.timer !== null || poll.busy) return;
    // Paused while the app is not in front of the reader; resumed by the foreground listener.
    if (foreground.current() !== 'ACTIVE') return;
    const delay = VOICE_NOTE_POLL_DELAYS_MS[Math.min(poll.attempt, VOICE_NOTE_POLL_DELAYS_MS.length - 1)];
    poll.attempt += 1;
    poll.timer = setTimer(() => {
      poll.timer = null;
      void check(recordingId);
    }, delay);
  }

  async function forget(recordingId: string): Promise<void> {
    stopPoll(recordingId);
    replace(isNote(recordingId), null);
    await store.forgetAccepted(owner, recordingId).catch(() => undefined);
  }

  function showNote(view: Pick<VoiceNoteStatusView, 'recordingId' | 'durationMs' | 'availableUntil' | 'canRetry'>, phase: VoiceNotePhase): void {
    const held = noteOf(view.recordingId);
    replace(isNote(view.recordingId), {
      kind: 'NOTE', recordingId: view.recordingId, phase, canRetry: view.canRetry,
      durationMs: view.durationMs ?? held?.durationMs ?? null, availableUntil: view.availableUntil ?? held?.availableUntil ?? null,
    });
  }

  async function commit(recordingId: string): Promise<'DONE' | 'AGAIN' | 'STOP'> {
    const result = await api.commitTurn(recordingId);
    if (!live()) return 'STOP';
    switch (result.kind) {
      case 'COMMITTED': {
        // The turn's answer is a typed turn's shape; it joins the conversation marked as this note's, still playable.
        const held = noteOf(recordingId);
        onCommitted({
          ...result.exchange,
          voiceNote: { recordingId, available: true, availableUntil: held?.availableUntil ?? null, durationMs: held?.durationMs ?? null },
        }, sessionId);
        await forget(recordingId);
        return 'DONE';
      }
      case 'CONSENT_REQUIRED': {
        const held = noteOf(recordingId);
        if (held) replace(isNote(recordingId), { ...held, phase: 'HELD_CONSENT', canRetry: false });
        return 'STOP';
      }
      case 'NOT_AVAILABLE_NOW': {
        const held = noteOf(recordingId);
        if (held) replace(isNote(recordingId), { ...held, phase: 'GATE_CLOSED', canRetry: false });
        return 'AGAIN';
      }
      case 'NOT_FOUND':
        await forget(recordingId);
        return 'STOP';
      default:
        // Not READY yet, a racing commit, the admission bound, or no answer: read the status again later.
        return 'AGAIN';
    }
  }

  async function check(recordingId: string): Promise<void> {
    const poll = polls.get(recordingId);
    if (!live() || poll === undefined || poll.busy) return;
    poll.busy = true;
    let next: 'AGAIN' | 'STOP' = 'AGAIN';
    try {
      const read = await api.status(recordingId);
      if (!live()) return;
      if (read.kind === 'NOT_FOUND') {
        await forget(recordingId);
        next = 'STOP';
      } else if (read.kind === 'STATUS') {
        const view = read.view;
        if (view.status === 'READY' || view.status === 'COMMITTED') {
          const done = await commit(recordingId);
          next = done === 'AGAIN' ? 'AGAIN' : 'STOP';
        } else if (view.status === 'CANCELLED') {
          await forget(recordingId);
          next = 'STOP';
        } else {
          const phase = NOTE_PHASE[view.status] ?? 'PROCESSING';
          showNote(view, phase);
          next = phase === 'PROCESSING' ? 'AGAIN' : 'STOP';
        }
      }
    } finally {
      poll.busy = false;
    }
    if (next === 'STOP') stopPoll(recordingId);
    else schedule(recordingId);
  }

  /** An accepted note shown as processing until its first status read says otherwise. */
  function track(recordingId: string, durationMs: number | null, availableUntil: string | null): void {
    if (noteOf(recordingId) === undefined) {
      replace(isNote(recordingId), { kind: 'NOTE', recordingId, durationMs, availableUntil, phase: 'PROCESSING', canRetry: false });
    }
    schedule(recordingId);
  }

  const unsubscribeForeground = foreground.subscribe((now) => {
    if (now !== 'ACTIVE' || !live()) return;
    for (const recordingId of Array.from(polls.keys())) schedule(recordingId);
  });

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async restore() {
      if (!live()) return;
      const { unrecoverable } = await store.recover(owner);
      const local = await store.list(owner);
      if (!live()) return;
      if (unrecoverable > 0) set({ unrecoverable: true });
      for (const draft of local.drafts) {
        if (draft.sessionId === sessionId && draft.state === 'SAVED' && draftOf(draft.draftId) === undefined) {
          replace(isDraft(draft.draftId), { kind: 'DRAFT', draft, phase: 'READY_TO_SEND' });
        }
      }
      for (const note of local.accepted) if (note.sessionId === sessionId) track(note.recordingId, note.durationMs, note.availableUntil);
      const pending = await api.pending(sessionId);
      if (!live() || pending.kind !== 'NOTES') return;
      // Every pending note is confirmed by one status read, which also says whether the reader may ask again; READY and
      // COMMITTED ones are then committed (a replay answers the same turn).
      for (const note of pending.notes) {
        if (note.status !== 'CANCELLED') track(note.recordingId, note.durationMs, note.availableUntil);
      }
    },
    addDraft(draft) {
      if (!live() || draft.sessionId !== sessionId || draft.state !== 'SAVED') return;
      replace(isDraft(draft.draftId), { kind: 'DRAFT', draft, phase: 'READY_TO_SEND' });
    },
    async send(draftId) {
      const held = draftOf(draftId);
      if (!live() || held === undefined || held.phase === 'SENDING' || held.phase === 'REFUSED') return;
      // The command id is the one kept with the draft NOW (a rotation may have happened since it was shown).
      const current = (await store.list(owner)).drafts.find((d) => d.draftId === draftId) ?? held.draft;
      replace(isDraft(draftId), { kind: 'DRAFT', draft: current, phase: 'SENDING' });
      let bytes: Uint8Array;
      try {
        bytes = files.read(owner, draftId);
      } catch {
        replace(isDraft(draftId), { kind: 'DRAFT', draft: current, phase: 'NOT_SENT' });
        return;
      }
      if (bytes.length === 0 || bytes.length > VOICE_NOTE_MAX_BYTES) {
        replace(isDraft(draftId), { kind: 'DRAFT', draft: current, phase: 'REFUSED' });
        return;
      }
      const abort = new AbortController();
      const timer = setTimer(() => abort.abort(), VOICE_NOTE_UPLOAD_TIMEOUT_MS);
      const result = await api.upload(sessionId, current.commandId, bytes, abort.signal);
      clearTimer(timer);
      if (!live()) return;
      switch (result.kind) {
        case 'ACCEPTED':
          await store.accept(owner, draftId, { recordingId: result.recordingId, sessionId, durationMs: current.durationMs, availableUntil: result.availableUntil });
          if (!live()) return;
          replace(isDraft(draftId), null);
          track(result.recordingId, current.durationMs, result.availableUntil);
          return;
        case 'UNAVAILABLE': {
          // Nothing is known to be stored: the next Send is a NEW upload.
          const commandId = newId();
          await store.rotateCommand(owner, draftId, commandId);
          replace(isDraft(draftId), { kind: 'DRAFT', draft: { ...current, commandId }, phase: 'NOT_SENT' });
          return;
        }
        case 'UNKNOWN':
          replace(isDraft(draftId), { kind: 'DRAFT', draft: current, phase: 'NOT_SENT' });
          return;
        case 'NOT_AVAILABLE_NOW':
          replace(isDraft(draftId), { kind: 'DRAFT', draft: current, phase: 'GATE_CLOSED' });
          return;
        case 'CONSENT_REQUIRED':
          replace(isDraft(draftId), { kind: 'DRAFT', draft: current, phase: 'CONSENT_REQUIRED' });
          return;
        case 'REFUSED':
          replace(isDraft(draftId), { kind: 'DRAFT', draft: current, phase: 'REFUSED' });
          return;
      }
    },
    async deleteDraft(draftId) {
      const held = draftOf(draftId);
      if (!live() || held === undefined || held.phase === 'SENDING') return;
      await store.discard(owner, draftId);
      if (live()) replace(isDraft(draftId), null);
    },
    async retryNote(recordingId) {
      const held = noteOf(recordingId);
      if (!live() || held === undefined || !held.canRetry) return;
      const answer = await api.retry(recordingId);
      if (!live()) return;
      if (answer === 'RETRY_SCHEDULED') {
        replace(isNote(recordingId), { ...held, phase: 'PROCESSING', canRetry: false });
        const poll = polls.get(recordingId);
        if (poll) poll.attempt = 0;
        schedule(recordingId);
      } else if (answer === 'NOT_AVAILABLE_NOW') {
        replace(isNote(recordingId), { ...held, phase: 'GATE_CLOSED', canRetry: false });
      } else if (answer === 'NOT_RETRYABLE') {
        // The server's state moved on: one status read says what it is now.
        schedule(recordingId);
      }
      // FAILED: no readable answer; the row still says C-28 and offers Try again.
    },
    async forgetNote(recordingId) {
      if (!live()) return;
      await forget(recordingId);
    },
    dismissNotice() {
      if (state.unrecoverable) set({ unrecoverable: false });
    },
    retire() {
      retired = true;
      for (const recordingId of Array.from(polls.keys())) stopPoll(recordingId);
      unsubscribeForeground();
      listeners.clear();
    },
  };
}
