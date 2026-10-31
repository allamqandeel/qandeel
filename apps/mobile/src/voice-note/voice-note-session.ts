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
 */
import type { ConversationExchangeView } from '../runtime-entry/conversation/conversation-turn-api';
import type { ForegroundSignal } from '../runtime-entry/lifecycle/foreground-signal';
import type { VoiceConsentState, VoiceNoteApiClient, VoiceConsentRowView } from './voice-note-api';
import { VOICE_CONSENT_COPY_ROWS, VOICE_CONSENT_VERSION } from './voice-note-copy';
import type { VoiceNoteCapture } from './voice-note-capture';
import type { VoiceNotesController } from './voice-note-controller';
import type { VoiceNotePlayback } from './voice-note-playback';

export type VoiceNoteSessionNotice =
  | 'PERMISSION_DENIED' // C-21 + C-22
  | 'GATE_CLOSED'; //      C-31

export type VoiceConsentSheet =
  | { readonly phase: 'LOADING' }
  | { readonly phase: 'READY'; readonly rows: readonly VoiceConsentRowView[]; readonly granting: boolean }
  /** The rows could not be read, or are not the approved ones: no consent is asked on words we cannot vouch for. */
  | { readonly phase: 'UNAVAILABLE' };

export interface VoiceNoteSessionState {
  /** Whether the microphone is offered (the server's capability for this reader). */
  readonly offered: boolean;
  readonly consentCurrent: boolean;
  /** The reader's consent as the server holds it (null until read): Settings offers C-46 only while GRANTED (OD-4). */
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
  getState(): VoiceNoteSessionState;
  subscribe(listener: () => void): () => void;
  /** The capability read and the drafts / notes of this Session. Sends nothing. */
  restore(): Promise<void>;
  /** The reader's tap on the microphone. */
  begin(): Promise<void>;
  /** C-16 on a draft row: its send, after the consent when there is none. */
  sendDraft(draftId: string): Promise<void>;
  /** C-10 on the consent sheet: grant, then the act that asked for it (the capture, or a draft's send). */
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
  let state: VoiceNoteSessionState = { offered: false, consentCurrent: false, consentState: null, withdrawing: false, sheet: null, notice: null };
  const listeners = new Set<() => void>();
  let retired = false;
  let consentVersion = VOICE_CONSENT_VERSION;
  /** What the consent sheet was opened for. */
  let afterConsent: { readonly kind: 'CAPTURE' } | { readonly kind: 'SEND'; readonly draftId: string } = { kind: 'CAPTURE' };
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
    set({ sheet: { phase: 'READY', rows: read.rows, granting: false } });
  }

  return {
    exportAccess: options.exportAccess ?? { url: () => null, authorization: () => null },
    capture,
    notes,
    playback,
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
      await capture.start();
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
      else await capture.start();
    },
    decline() {
      set({ sheet: null });
    },
    async send() {
      const draft = await capture.stop();
      if (draft === null || !live()) return;
      notes.addDraft(draft);
      capture.reset();
      await notes.send(draft.draftId);
    },
    cancel: () => capture.cancel(),
    async leave() {
      playback.pause();
      await capture.leave();
    },
    async withdrawConsent() {
      if (!live() || state.withdrawing) return 'FAILED';
      set({ withdrawing: true });
      const outcome = await api.withdraw(newId());
      if (!live()) return 'FAILED';
      set({ withdrawing: false });
      if (outcome !== 'DONE') return 'FAILED';
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
      capture.retire();
      notes.retire();
      playback.retire();
      listeners.clear();
    },
  };
}

/** The deleted recording's turn, as the conversation now holds it: still its words, no longer playable (C-38). */
export function withRecordingDeleted(exchange: ConversationExchangeView, recordingId: string): ConversationExchangeView {
  if (exchange.voiceNote?.recordingId !== recordingId) return exchange;
  return { ...exchange, voiceNote: { ...exchange.voiceNote, available: false, availableUntil: null } };
}
