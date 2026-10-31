/**
 * S8B-03 (CP2, decision D3 / G12-J1, R-VN) — one Voice Note capture, from the reader's tap to an unsent local draft.
 *
 *   - It starts ONLY on the reader's explicit tap, after the microphone permission and a current consent.
 *   - It never records unseen: leaving the conversation screen (in the app or to another app), the app leaving the
 *     foreground, an audio interruption (a call, another app taking the microphone), the input route changing (a
 *     headset unplugged) and the ten-minute limit all STOP the capture and keep it as a draft — C-17 / C-18 / C-19.
 *   - Nothing is ever sent from here. A stopped capture is a draft; only the reader's Send uploads it.
 *
 * The recorder sits behind `VoiceRecorderPort` so every rule above is tested without a device; production binds it to
 * `expo-audio` (voice-note-recorder-port.ts). No audio, transcript or path is logged.
 */
import type { ForegroundSignal } from '../runtime-entry/lifecycle/foreground-signal';
import { VOICE_NOTE_MAX_DURATION_MS } from './voice-note-limits';
import type { VoiceDraftRecord, VoiceDraftStop, VoiceDraftStore } from './voice-draft-store';

export type MicrophonePermission = 'GRANTED' | 'DENIED' | 'UNDETERMINED';

export interface VoiceRecorderPort {
  permission(): Promise<MicrophonePermission>;
  /** The OS prompt, at the moment of intent (G1.2 §5). */
  requestPermission(): Promise<MicrophonePermission>;
  /** Prepares a recording with the ONE configuration and answers the file it will write. */
  prepare(): Promise<string>;
  record(): void;
  stop(): Promise<void>;
  status(): { readonly isRecording: boolean; readonly durationMillis: number };
  /**
   * The current input's identity, to notice a route change; null when the platform cannot say. Read only WHILE
   * recording: on Android, asking before the first sample pins the built-in microphone as the preferred input.
   */
  currentInput(): Promise<string | null>;
  /** The platform ended the recording on its own (an error, the media server dying). Returns an unsubscribe. */
  onEnded(listener: () => void): () => void;
}

export type CaptureState =
  | { readonly kind: 'IDLE' }
  | { readonly kind: 'PERMISSION_DENIED' }
  | { readonly kind: 'STARTING' }
  | { readonly kind: 'RECORDING'; readonly draftId: string; readonly elapsedMs: number }
  | { readonly kind: 'STOPPING'; readonly draftId: string }
  /** A draft exists; `stoppedBy` names the approved line to show (USER: none). */
  | { readonly kind: 'STOPPED'; readonly draft: VoiceDraftRecord }
  /** The recorder failed to start or to finish its file. */
  | { readonly kind: 'FAILED' };

export interface VoiceNoteCaptureOptions {
  readonly owner: string;
  readonly sessionId: string;
  readonly recorder: VoiceRecorderPort;
  readonly store: VoiceDraftStore;
  readonly foreground: ForegroundSignal;
  readonly newId: () => string;
  /**
   * The screen is kept on WHILE recording only (Product Owner decision, 2026-10-31): a phone's own inactivity timeout
   * would otherwise lock it mid-message and end the capture as a draft. A lock the reader makes still stops it (C-17).
   */
  readonly screen?: { hold(): void; release(): void };
  readonly now?: () => Date;
  readonly setInterval?: (callback: () => void, ms: number) => unknown;
  readonly clearInterval?: (handle: unknown) => void;
}

export interface VoiceNoteCapture {
  getState(): CaptureState;
  subscribe(listener: () => void): () => void;
  /** The reader's tap. Refused unless IDLE, STOPPED or PERMISSION_DENIED. */
  start(): Promise<void>;
  /** The reader's own stop (to send or to keep). */
  stop(): Promise<VoiceDraftRecord | null>;
  /** Leaving the conversation screen: stop and keep (C-17). Safe in any state. */
  leave(): Promise<void>;
  /** The reader cancelled the capture: it is stopped and discarded; the history is unchanged (G12-VN). */
  cancel(): Promise<void>;
  /** Back to IDLE once the draft was handled elsewhere (sent, deleted). */
  reset(): void;
  retire(): void;
}

/** The watch cadence: interruption, route and limit are noticed within half a second. */
export const CAPTURE_WATCH_MS = 500;

export function createVoiceNoteCapture(options: VoiceNoteCaptureOptions): VoiceNoteCapture {
  const { owner, sessionId, recorder, store, foreground, newId } = options;
  const screen = options.screen ?? { hold: () => undefined, release: () => undefined };
  let holding = false;
  const hold = (on: boolean) => {
    if (on === holding) return;
    holding = on;
    try {
      if (on) screen.hold();
      else screen.release();
    } catch {
      // The screen hold is a convenience; the capture's rules never depend on it.
    }
  };
  const now = options.now ?? (() => new Date());
  const every = options.setInterval ?? ((callback, ms) => setInterval(callback, ms));
  const cancelEvery = options.clearInterval ?? ((handle) => clearInterval(handle as ReturnType<typeof setInterval>));
  let state: CaptureState = { kind: 'IDLE' };
  const listeners = new Set<() => void>();
  let watch: unknown = null;
  let unsubscribeForeground: (() => void) | null = null;
  let unsubscribeEnded: (() => void) | null = null;
  let input: string | null = null;
  let retired = false;
  let routeCheckInFlight = false;

  const set = (next: CaptureState) => {
    state = next;
    for (const listener of Array.from(listeners)) listener();
  };

  function stopWatching(): void {
    if (watch !== null) cancelEvery(watch);
    watch = null;
    unsubscribeForeground?.();
    unsubscribeForeground = null;
    unsubscribeEnded?.();
    unsubscribeEnded = null;
    hold(false);
  }

  async function finish(reason: VoiceDraftStop): Promise<VoiceDraftRecord | null> {
    if (state.kind !== 'RECORDING') return state.kind === 'STOPPED' ? state.draft : null;
    const { draftId, elapsedMs } = state;
    set({ kind: 'STOPPING', draftId });
    stopWatching();
    const durationMs = Math.min(Math.max(recorder.status().durationMillis, elapsedMs), VOICE_NOTE_MAX_DURATION_MS);
    try {
      await recorder.stop();
    } catch {
      // The recorder may have stopped itself (an interruption); its file is checked below either way.
    }
    try {
      const draft = await store.finish(owner, draftId, durationMs, reason);
      if (draft === null) throw new Error('draft not finished');
      if (!retired) set({ kind: 'STOPPED', draft });
      return draft;
    } catch {
      // The file could not become a draft: what is left is removed so no broken draft is offered.
      await store.discard(owner, draftId).catch(() => undefined);
      if (!retired) set({ kind: 'FAILED' });
      return null;
    }
  }

  function tick(): void {
    if (state.kind !== 'RECORDING') return;
    const status = recorder.status();
    // The platform paused or ended the recorder on its own: an audio interruption (iOS pauses on a call).
    if (!status.isRecording) {
      void finish('INTERRUPTION');
      return;
    }
    if (status.durationMillis >= VOICE_NOTE_MAX_DURATION_MS) {
      void finish('LIMIT');
      return;
    }
    set({ ...state, elapsedMs: status.durationMillis });
    if (routeCheckInFlight) return;
    routeCheckInFlight = true;
    void recorder.currentInput().then((current) => {
      routeCheckInFlight = false;
      // A different input than the one the capture began with: the headset (or its microphone) went away.
      if (state.kind === 'RECORDING' && input !== null && current !== null && current !== input) void finish('INTERRUPTION');
    }, () => {
      routeCheckInFlight = false;
    });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async start() {
      if (retired || !(state.kind === 'IDLE' || state.kind === 'STOPPED' || state.kind === 'PERMISSION_DENIED' || state.kind === 'FAILED')) return;
      // A capture begins only while the conversation is in front of the reader.
      if (foreground.current() !== 'ACTIVE') return;
      set({ kind: 'STARTING' });
      let permission = await recorder.permission();
      if (permission === 'UNDETERMINED') permission = await recorder.requestPermission();
      if (retired) return;
      if (permission !== 'GRANTED') {
        set({ kind: 'PERMISSION_DENIED' });
        return;
      }
      const draftId = newId();
      try {
        const recorderUri = await recorder.prepare();
        await store.begin(owner, {
          draftId, sessionId, commandId: newId(), state: 'RECORDING', recorderUri,
          durationMs: null, bytes: null, stoppedBy: null, createdAt: now().toISOString(),
        });
        // The app left the foreground while preparing: nothing is recorded.
        if (retired || foreground.current() !== 'ACTIVE') {
          await store.discard(owner, draftId);
          if (!retired) set({ kind: 'IDLE' });
          return;
        }
        recorder.record();
      } catch {
        await store.discard(owner, draftId).catch(() => undefined);
        if (!retired) set({ kind: 'FAILED' });
        return;
      }
      input = null;
      hold(true);
      set({ kind: 'RECORDING', draftId, elapsedMs: 0 });
      unsubscribeForeground = foreground.subscribe(() => {
        if (foreground.current() !== 'ACTIVE') void finish('LEFT_SCREEN');
      });
      unsubscribeEnded = recorder.onEnded(() => {
        void finish('INTERRUPTION');
      });
      watch = every(tick, CAPTURE_WATCH_MS);
      // The input the capture began with, read once the recorder is routed.
      recorder.currentInput().then((current) => {
        if (state.kind === 'RECORDING' && state.draftId === draftId) input = current;
      }, () => undefined);
    },
    stop: () => finish('USER'),
    async leave() {
      await finish('LEFT_SCREEN');
    },
    async cancel() {
      const current = state;
      if (current.kind === 'RECORDING') {
        const draft = await finish('USER');
        if (draft !== null) await store.discard(owner, draft.draftId);
      } else if (current.kind === 'STOPPED') {
        await store.discard(owner, current.draft.draftId);
      }
      if (!retired) set({ kind: 'IDLE' });
    },
    reset() {
      if (state.kind === 'STOPPED' || state.kind === 'FAILED' || state.kind === 'PERMISSION_DENIED') set({ kind: 'IDLE' });
    },
    retire() {
      // Torn down mid-recording (the screen unmounted, the account changed): the recorder is stopped and the draft kept.
      if (state.kind === 'RECORDING') void finish('LEFT_SCREEN');
      retired = true;
      stopWatching();
      listeners.clear();
    },
  };
}
