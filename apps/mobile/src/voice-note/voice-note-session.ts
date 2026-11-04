/**
 * S8B-03 (CP2) — Voice Notes in ONE conversation Session: the capture, the drafts and notes in flight, playback, the
 * consent sheet and the notices, composed for the surface. It owns no rule of its own beyond the order of the reader's
 * acts; each part keeps its own (voice-note-capture.ts, voice-note-controller.ts, voice-note-playback.ts).
 *
 *   - The microphone is offered only while the server says Voice Notes are available to this reader (the four launch
 *     gates). While they are DISABLED nothing is offered; drafts and notes already here still show and can be removed.
 *   - Consent comes first (C-01 … C-11, read from the server and shown only when they are the approved rows), then the
 *     OS permission at the moment of intent, then the capture. Nothing is sent before the reader's Send.
 *   - Leaving the screen stops a capture and keeps it as a draft (C-17); retire does the same and stops everything.
 *   - S8B-04 (CP2): a capture begun after consent opens its live note beside it (D-S1); Send names it with the upload,
 *     anything else discards it. QANDEEL's spoken reply to a note sent here plays by itself (`replies`); a new recording,
 *     leaving the screen or the app leaving the foreground quiets it, and nothing new is synthesized for it then.
 */
import type { ConversationExchangeView, ForegroundSignal } from '../runtime-entry';
import type { VoiceConsentState, VoiceLiveNoteRef, VoiceNoteApiClient, VoiceConsentRowView } from './voice-note-api';
import { VOICE_CONSENT_COPY_ROWS, VOICE_CONSENT_VERSION } from './voice-note-copy';
import type { VoiceNoteCapture } from './voice-note-capture';
import type { VoiceNotesController } from './voice-note-controller';
import type { VoiceNotePlayback } from './voice-note-playback';
import type { VoiceReplies } from './voice-reply';

/** S8B-04 (CP2, D-S1): this Session's live note, beside its capture. */
export interface VoiceSessionLiveNote {
  begin(): Promise<void>;
  finish(): Promise<VoiceLiveNoteRef | undefined>;
  cancel(): void;
}
const NO_LIVE_NOTE: VoiceSessionLiveNote = { begin: async () => undefined, finish: async () => undefined, cancel: () => undefined };
/** A store snapshot must be the same object while nothing changes. */
const NO_REPLY_STATE = Object.freeze({ replies: Object.freeze({}) });
const NO_REPLIES: VoiceReplies = {
  getState: () => NO_REPLY_STATE, subscribe: () => () => undefined, start: () => undefined, toggle: async () => undefined,
  quiet: () => undefined, retire: () => undefined,
};

export type VoiceNoteSessionNotice =
  | 'PERMISSION_DENIED' // C-21 + C-22
  | 'GATE_CLOSED'; //      C-31

export type VoiceConsentSheet =
  | { readonly phase: 'LOADING' }
  /** `renewal`: the reader agreed to an earlier version; R-01 says the terms changed, above the current text. */
  | { readonly phase: 'READY'; readonly rows: readonly VoiceConsentRowView[]; readonly granting: boolean; readonly renewal: boolean }
  /** The rows could not be read, or are not the approved ones: no consent is asked on words we cannot vouch for. */
  | { readonly phase: 'UNAVAILABLE' };

export interface VoiceNoteSessionState {
  /** Whether the microphone is offered (the server's capability for this reader). */
  readonly offered: boolean;
  readonly consentCurrent: boolean;
  /** The reader's consent as the server holds it (null until read): Settings offers C-46 while a consent is held, current or OUTDATED (OD-4). */
  readonly consentState: VoiceConsentState | null;
  /** Settings' withdrawal in flight, and its last failure (said with the approved line only — none exists, so nothing). */
  readonly withdrawing: boolean;
  readonly sheet: VoiceConsentSheet | null;
  readonly notice: VoiceNoteSessionNotice | null;
}

export interface VoiceNoteSessionOptions {
  readonly api: Pick<VoiceNoteApiClient, 'capability' | 'consent' | 'grant' | 'withdraw' | 'deleteRecording'>;
  readonly capture: VoiceNoteCapture;
  readonly notes: VoiceNotesController;
  readonly playback: VoiceNotePlayback;
  /** S8B-04 (CP2): QANDEEL's spoken replies to notes sent here (absent: text only, as before). */
  readonly replies?: VoiceReplies;
  /** S8B-04 (CP2, D-S1): the live note beside each capture (absent: none). */
  readonly liveNote?: VoiceSessionLiveNote;
  readonly foreground: ForegroundSignal;
  readonly newId: () => string;
  readonly isCurrent: () => boolean;
  /** The conversation learns that a recording is gone (C-38), so its turn shows it without a new read. */
  readonly onRecordingDeleted?: (recordingId: string) => void;
  readonly exportAccess?: VoiceNoteSession['exportAccess'];
}

export interface VoiceNoteSession {
  /** Where an export's voice file is read from, and the bearer header for it (Settings' C-49 save). */
  readonly exportAccess: { url(fileName: string): string | null; authorization(): Record<string, string> | null };
  readonly capture: VoiceNoteCapture;
  readonly notes: VoiceNotesController;
  readonly playback: VoiceNotePlayback;
  readonly replies: VoiceReplies;
  getState(): VoiceNoteSessionState;
  subscribe(listener: () => void): () => void;
  /** The capability read and the drafts / notes of this Session. Sends nothing. */
  restore(): Promise<void>;
  /** The reader's tap on the microphone. */
  begin(): Promise<void>;
  /** C-16 on a draft row: its send, after the consent when there is none. */
  sendDraft(draftId: string): Promise<void>;
  /**
   * S8B-06 CP3 — a live call asks for the same recording consent (VOICE_RECORDING_V3) before it starts: READY when it is
   * current (the caller starts the call now), ASKED when the consent sheet was opened instead (its C-10 then runs `start`),
   * UNAVAILABLE when the consent cannot be read. A call never starts on a consent we cannot vouch for.
   */
  prepareCall(start: () => Promise<void>): Promise<'READY' | 'ASKED' | 'UNAVAILABLE'>;
  /** C-10 on the consent sheet: grant, then the act that asked for it (the capture, a draft's send, or a call). */
  agree(): Promise<void>;
  /** C-11: nothing changes. */
  decline(): void;
  /** C-16 while capturing: stop, keep, and send. */
  send(): Promise<void>;
  /** C-15: the capture is discarded; the history is unchanged. */
  cancel(): Promise<void>;
  /** The reader left the conversation screen: a capture stops and is kept (C-17). */
  leave(): Promise<void>;
  /**
   * C-46 confirmed after C-47 (Settings, OD-4): no new note is sent and notes not yet converted are not processed; the
   * recordings already kept stay playable, deletable and exportable until their period ends.
   */
  withdrawConsent(): Promise<'DONE' | 'FAILED'>;
  /** C-42 confirmed: the recording is deleted on the server. */
  deleteRecording(recordingId: string): Promise<'DELETED' | 'FAILED'>;
  dismissNotice(): void;
  retire(): void;
}

/** The consent rows the server shows are exactly the approved rows of the current version (B13), or none are shown. */
export function consentRowsAreApproved(version: string, rows: readonly VoiceConsentRowView[]): boolean {
  if (version !== VOICE_CONSENT_VERSION || rows.length !== VOICE_CONSENT_COPY_ROWS.length) return false;
  return rows.every((row, index) => {
    const approved = VOICE_CONSENT_COPY_ROWS[index];
    return row.id === approved.id && row.ar === approved.ar && row.en === approved.en;
  });
}

export function createVoiceNoteSession(options: VoiceNoteSessionOptions): VoiceNoteSession {
  const { api, capture, notes, playback, newId, isCurrent } = options;
  const replies = options.replies ?? NO_REPLIES;
  const liveNote = options.liveNote ?? NO_LIVE_NOTE;
  let state: VoiceNoteSessionState = { offered: false, consentCurrent: false, consentState: null, withdrawing: false, sheet: null, notice: null };
  const listeners = new Set<() => void>();
  let retired = false;
  let consentVersion = VOICE_CONSENT_VERSION;
  /** What the consent sheet was opened for. */
  let afterConsent: { readonly kind: 'CAPTURE' } | { readonly kind: 'SEND'; readonly draftId: string } | { readonly kind: 'CALL'; readonly start: () => Promise<void> } = { kind: 'CAPTURE' };
  const live = () => !retired && isCurrent();

  const set = (next: Partial<VoiceNoteSessionState>) => {
    state = { ...state, ...next };
    for (const listener of Array.from(listeners)) listener();
  };

  const unsubscribeCapture = capture.subscribe(() => {
    const current = capture.getState();
    if (current.kind === 'PERMISSION_DENIED') set({ notice: 'PERMISSION_DENIED' });
    // A recorder that failed kept nothing; no approved line names it, so the microphone is simply offered again.
    if (current.kind === 'FAILED') capture.reset();
    // A capture that stopped on its own (left, interrupted, the limit) becomes a draft row with its own line.
    if (current.kind === 'STOPPED' && current.draft.stoppedBy !== 'USER') {
      // Not the reader's Send: the live note is discarded; the draft is transcribed after it is sent.
      liveNote.cancel();
      notes.addDraft(current.draft);
      capture.reset();
    }
  });

  async function readCapability(): Promise<boolean> {
    const read = await api.capability();
    if (!live()) return false;
    if (read.kind !== 'CAPABILITY') return state.offered;
    set({ offered: read.view.voiceNotesAvailable, consentCurrent: read.view.consentCurrent, consentState: read.view.consentState });
    return read.view.voiceNotesAvailable;
  }

  async function openSheet(): Promise<void> {
    set({ sheet: { phase: 'LOADING' } });
    const read = await api.consent();
    if (!live()) return;
    if (read.kind !== 'CONSENT' || !consentRowsAreApproved(read.version, read.rows)) {
      set({ sheet: { phase: 'UNAVAILABLE' } });
      return;
    }
    consentVersion = read.version;
    set({ sheet: { phase: 'READY', rows: read.rows, granting: false, renewal: read.state === 'OUTDATED' } });
  }

  /** A capture, with its live note once it records (and a spoken reply quieted first: the reader is speaking now). */
  async function startCapture(): Promise<void> {
    replies.quiet();
    playback.pause();
    await capture.start();
    if (live() && capture.getState().kind === 'RECORDING') await liveNote.begin();
  }

  return {
    exportAccess: options.exportAccess ?? { url: () => null, authorization: () => null },
    capture,
    notes,
    playback,
    replies,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async restore() {
      await Promise.all([readCapability(), notes.restore()]);
    },
    async begin() {
      if (!live()) return;
      set({ notice: null });
      // The gate is read at the moment of intent: a launch gate closed since the screen opened is said, not hidden.
      if (!(await readCapability())) {
        if (live()) set({ notice: 'GATE_CLOSED' });
        return;
      }
      if (!state.consentCurrent) {
        afterConsent = { kind: 'CAPTURE' };
        await openSheet();
        return;
      }
      await startCapture();
    },
    async prepareCall(start) {
      if (!live()) return 'UNAVAILABLE';
      set({ notice: null });
      const read = await api.capability();
      if (!live()) return 'UNAVAILABLE';
      if (read.kind !== 'CAPABILITY') return 'UNAVAILABLE';
      // The consent is the same; the Voice Notes gate is not the call's (the call authority refuses a closed call gate).
      set({ consentCurrent: read.view.consentCurrent, consentState: read.view.consentState });
      if (read.view.consentCurrent) return 'READY';
      afterConsent = { kind: 'CALL', start };
      await openSheet();
      return 'ASKED';
    },
    async sendDraft(draftId) {
      if (!live()) return;
      set({ notice: null });
      if (!state.consentCurrent) {
        await readCapability();
        if (!live()) return;
        if (!state.consentCurrent) {
          afterConsent = { kind: 'SEND', draftId };
          await openSheet();
          return;
        }
      }
      await notes.send(draftId);
    },
    async agree() {
      const sheet = state.sheet;
      if (!live() || sheet === null || sheet.phase !== 'READY' || sheet.granting) return;
      set({ sheet: { ...sheet, granting: true } });
      const outcome = await api.grant(newId(), consentVersion);
      if (!live()) return;
      if (outcome !== 'DONE') {
        // A version that moved on is read again; anything else leaves the sheet as it was, to try again.
        if (outcome === 'VERSION_NOT_CURRENT') await openSheet();
        else set({ sheet: { ...sheet, granting: false } });
        return;
      }
      set({ sheet: null, consentCurrent: true, consentState: 'GRANTED' });
      if (afterConsent.kind === 'SEND') await notes.send(afterConsent.draftId);
      else if (afterConsent.kind === 'CALL') await afterConsent.start();
      else await startCapture();
    },
    decline() {
      set({ sheet: null });
    },
    async send() {
      const draft = await capture.stop();
      if (draft === null || !live()) return;
      notes.addDraft(draft);
      capture.reset();
      const reference = await liveNote.finish();
      await notes.send(draft.draftId, reference);
    },
    async cancel() {
      liveNote.cancel();
      await capture.cancel();
    },
    async leave() {
      playback.pause();
      replies.quiet();
      liveNote.cancel();
      await capture.leave();
    },
    async withdrawConsent() {
      if (!live() || state.withdrawing) return 'FAILED';
      set({ withdrawing: true });
      const outcome = await api.withdraw(newId());
      if (!live()) return 'FAILED';
      set({ withdrawing: false });
      if (outcome !== 'DONE') return 'FAILED';
      // A withdrawal stops spoken replies too (the server refuses their audio from now on).
      replies.quiet();
      set({ consentCurrent: false, consentState: 'WITHDRAWN' });
      await readCapability();
      return 'DONE';
    },
    async deleteRecording(recordingId) {
      const outcome = await api.deleteRecording(recordingId);
      if (outcome !== 'DELETED') return 'FAILED';
      playback.forget(recordingId);
      await notes.forgetNote(recordingId);
      if (live()) options.onRecordingDeleted?.(recordingId);
      return 'DELETED';
    },
    dismissNotice() {
      set({ notice: null });
      notes.dismissNotice();
    },
    retire() {
      retired = true;
      unsubscribeCapture();
      liveNote.cancel();
      capture.retire();
      notes.retire();
      playback.retire();
      replies.retire();
      listeners.clear();
    },
  };
}

/** The deleted recording's turn, as the conversation now holds it: still its words, no longer playable (C-38). */
export function withRecordingDeleted(exchange: ConversationExchangeView, recordingId: string): ConversationExchangeView {
  if (exchange.voiceNote?.recordingId !== recordingId) return exchange;
  return { ...exchange, voiceNote: { ...exchange.voiceNote, available: false, availableUntil: null } };
}
