/**
 * S8B-03 (CP2, P4-C3 §1, contract §8.2 «الفقاعة») — playing the reader's own Voice Notes in the conversation.
 *
 *   - ONE note plays at a time; starting another pauses nothing in the background, it releases the first.
 *   - The bytes are read by the platform player straight from the server with Range and the bearer in a HEADER, never a
 *     URL that carries it, and nothing is kept on the device (no cache file).
 *   - A note's position is stored state (P4-C3: "once played, a stored position") for this runtime only; it advances
 *     with the file's own clock, and Reduced Motion does not stop it because it is information.
 *   - Nothing plays unseen: the app leaving the foreground pauses it (no background playback, decision D3).
 *   - A note that cannot be played now says C-39 and stays playable later.
 *   - The reader may move a note's position (seek): it is stored at once, the held player is moved there, and the
 *     player's own reports of the old position are not taken while it moves.
 *
 * The player sits behind `VoiceNotePlayerPort`, so every rule is tested without a device; production binds it to
 * `expo-audio` (voice-note-player-port.ts). No URL, header or position is logged.
 */
import type { ForegroundSignal } from '../runtime-entry';

export interface VoiceNotePlayerStatus {
  readonly loaded: boolean;
  readonly playing: boolean;
  readonly positionMs: number;
  readonly durationMs: number;
  readonly finished: boolean;
  readonly failed: boolean;
}

export interface VoiceNotePlayer {
  play(): void;
  pause(): void;
  seekTo(positionMs: number): Promise<void>;
  release(): void;
  /** S8B-07 CP1-B (§19.2): the played position read now from the player itself, not the last status tick. */
  currentPositionMs?(): number;
}

export interface VoiceNotePlayerPort {
  /** A player for one URL with the headers the request must carry. It loads on its own and reports through `onStatus`. */
  create(url: string, headers: Record<string, string>, onStatus: (status: VoiceNotePlayerStatus) => void): Promise<VoiceNotePlayer>;
}

export type VoiceNotePlaybackPhase = 'LOADING' | 'PLAYING' | 'PAUSED' | 'FAILED';

export interface VoiceNotePlaybackState {
  /** The one note the player holds, or null. */
  readonly current: { readonly recordingId: string; readonly phase: VoiceNotePlaybackPhase } | null;
  /** Each note's stored position (ms); a note absent here was never played in this runtime. */
  readonly positions: Readonly<Record<string, number>>;
}

export interface VoiceNotePlaybackOptions {
  readonly player: VoiceNotePlayerPort;
  readonly urlOf: (recordingId: string) => string;
  /** The bearer header at this moment, or null when this identity is no longer the reader's. */
  readonly authorization: () => Record<string, string> | null;
  readonly foreground: ForegroundSignal;
  readonly setTimer?: (callback: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
  /**
   * S8B-07 CP1-B (§7): the phone's one playback slot, keyed `note:<recordingId>`. A note that starts releases a call's or a
   * Replay's audio, and one that starts after it releases the note (as starting another note does). Absent: the S8B-03
   * behaviour, unchanged.
   */
  readonly owner?: { claim(key: string, release: () => void): { drop(): void } | null };
}

export interface VoiceNotePlayback {
  getState(): VoiceNotePlaybackState;
  subscribe(listener: () => void): () => void;
  /** The reader's play / pause on one note. */
  toggle(recordingId: string): Promise<void>;
  /** The reader moves one note's position; it plays (or not) as it did, from there. */
  seek(recordingId: string, positionMs: number): Promise<void>;
  /** The reader left the conversation: whatever plays is paused (nothing plays unseen). */
  pause(): void;
  /** The note is gone (deleted, expired): it is released if held, and its position forgotten. */
  forget(recordingId: string): void;
  retire(): void;
}

/** A note that has not loaded by then cannot be played now (C-39). */
export const VOICE_NOTE_LOAD_TIMEOUT_MS = 15000;

export function createVoiceNotePlayback(options: VoiceNotePlaybackOptions): VoiceNotePlayback {
  const { player, urlOf, authorization, foreground } = options;
  const setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let state: VoiceNotePlaybackState = { current: null, positions: {} };
  const listeners = new Set<() => void>();
  let held: { recordingId: string; player: VoiceNotePlayer | null; token: number; loadTimer: unknown; seeking: number; claim: { drop(): void } | null } | null = null;
  let tokens = 0;
  let retired = false;

  const set = (next: VoiceNotePlaybackState) => {
    state = next;
    for (const listener of Array.from(listeners)) listener();
  };
  const setPhase = (recordingId: string, phase: VoiceNotePlaybackPhase) => set({ ...state, current: { recordingId, phase } });
  const setPosition = (recordingId: string, positionMs: number) => {
    if (state.positions[recordingId] === positionMs) return;
    set({ ...state, positions: { ...state.positions, [recordingId]: positionMs } });
  };

  function release(): void {
    if (held === null) return;
    if (held.loadTimer !== null) clearTimer(held.loadTimer);
    held.claim?.drop();
    try {
      held.player?.release();
    } catch {
      // A player that is already gone has nothing left to release.
    }
    held = null;
  }

  function pause(): void {
    if (held === null || state.current === null) return;
    if (state.current.phase === 'PLAYING') {
      held.player?.pause();
      setPhase(held.recordingId, 'PAUSED');
    } else if (state.current.phase === 'LOADING') {
      // Not yet playing: it is let go rather than left to start on its own.
      release();
      set({ ...state, current: null });
    }
  }

  // Nothing plays while the reader is not looking at it.
  const unsubscribeForeground = foreground.subscribe(() => {
    if (foreground.current() !== 'ACTIVE') pause();
  });

  function onStatus(recordingId: string, token: number, status: VoiceNotePlayerStatus): void {
    if (retired || held === null || held.token !== token) return;
    if (status.failed) {
      release();
      setPhase(recordingId, 'FAILED');
      return;
    }
    if (status.loaded && held.loadTimer !== null) {
      clearTimer(held.loadTimer);
      held.loadTimer = null;
    }
    if (status.finished) {
      // At the end the note rests at its start again, with its played mark kept.
      setPosition(recordingId, 0);
      setPhase(recordingId, 'PAUSED');
      void held.player?.seekTo(0).catch(() => undefined);
      return;
    }
    if (status.loaded && held.seeking === 0) setPosition(recordingId, Math.max(0, Math.round(status.positionMs)));
    if (status.loaded && state.current?.recordingId === recordingId && state.current.phase === 'LOADING' && status.playing) setPhase(recordingId, 'PLAYING');
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async toggle(recordingId) {
      if (retired || foreground.current() !== 'ACTIVE') return;
      if (held !== null && held.recordingId === recordingId && held.player !== null) {
        const phase = state.current?.phase;
        if (phase === 'PLAYING' || phase === 'LOADING') {
          held.player.pause();
          setPhase(recordingId, 'PAUSED');
          return;
        }
        if (phase === 'PAUSED') {
          held.player.play();
          setPhase(recordingId, 'PLAYING');
          return;
        }
      }
      release();
      const headers = authorization();
      if (headers === null) {
        setPhase(recordingId, 'FAILED');
        return;
      }
      tokens += 1;
      const token = tokens;
      held = { recordingId, player: null, token, loadTimer: null, seeking: 0, claim: null };
      held.claim = options.owner?.claim(`note:${recordingId}`, () => {
        // Another subject started: this note is let go, its position kept.
        if (held === null || held.token !== token) return;
        held.claim = null;
        release();
        set({ ...state, current: null });
      }) ?? null;
      setPhase(recordingId, 'LOADING');
      held.loadTimer = setTimer(() => {
        if (held === null || held.token !== token) return;
        release();
        setPhase(recordingId, 'FAILED');
      }, VOICE_NOTE_LOAD_TIMEOUT_MS);
      let created: VoiceNotePlayer;
      try {
        created = await player.create(urlOf(recordingId), headers, (status) => onStatus(recordingId, token, status));
      } catch {
        if (held !== null && held.token === token) {
          release();
          setPhase(recordingId, 'FAILED');
        }
        return;
      }
      if (retired || held === null || held.token !== token) {
        created.release();
        return;
      }
      held.player = created;
      const from = state.positions[recordingId] ?? 0;
      if (from > 0) await created.seekTo(from).catch(() => undefined);
      if (held === null || held.token !== token) return;
      created.play();
    },
    async seek(recordingId, positionMs) {
      if (retired) return;
      const to = Math.max(0, Math.round(positionMs));
      setPosition(recordingId, to);
      // Not held (or still loading): the stored position is where its next play starts.
      if (held === null || held.recordingId !== recordingId || held.player === null) return;
      const moving = held;
      moving.seeking += 1;
      try {
        await moving.player?.seekTo(to);
      } catch {
        // A player that cannot move keeps its place; the stored position is still the reader's.
      } finally {
        moving.seeking -= 1;
      }
    },
    pause,
    forget(recordingId) {
      if (held !== null && held.recordingId === recordingId) {
        release();
        set({ ...state, current: null });
      }
      if (recordingId in state.positions) {
        const positions = { ...state.positions };
        delete positions[recordingId];
        set({ ...state, positions });
      }
    },
    retire() {
      retired = true;
      unsubscribeForeground();
      release();
      listeners.clear();
    },
  };
}
