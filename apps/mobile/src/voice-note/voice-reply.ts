/**
 * S8B-04 (CP2, the automatic voice reply) — QANDEEL's spoken reply to a Voice Note the reader has just sent.
 *
 *   - Only a reply this runtime asked for (the reader's own Send, through `?auto=1`) is held here and speaks by itself.
 *     A conversation reopened later shows its replies as text: nothing old plays on its own.
 *   - ONE stream per reply (the server's single audio stream), read by the platform player with the bearer in a HEADER
 *     and kept on no file. While the reply is produced its length is unknown; once the server announces it, the player
 *     stops itself there. Pause and resume act on that one player.
 *   - Replay after the end reads the stored audio again (no provider work). After the store's period (or any NOT_FOUND)
 *     the voice is no longer available; the text stays.
 *   - The text is never the voice's: the released text arrives through the status long-poll, the finished turn's answer
 *     replaces it in the conversation, and an audio failure only says so beside the text.
 *   - Nothing plays unseen and nothing is paid for in the background: leaving the conversation, the app leaving the
 *     foreground, or the reader starting a new recording pauses the voice and stops new synthesis of a reply still
 *     being produced (the text is unaffected).
 *
 * The player sits behind `VoiceNotePlayerPort`, so every rule is tested without a device. Nothing is logged.
 */
import type { ConversationExchangeView, ForegroundSignal } from '../runtime-entry';
import type { VoiceLiveReplyKnown, VoiceLiveReplyRead, VoiceNoteApiClient } from './voice-note-api';
import type { VoiceNotePlayer, VoiceNotePlayerPort, VoiceNotePlayerStatus } from './voice-note-playback';

export type VoiceReplyPhase =
  | 'PREPARING' //  the voice is being fetched (T2-05, an accessibility label only)
  | 'PLAYING'
  | 'PAUSED'
  | 'ENDED' //      heard to its end (or stopped there): replay is offered
  | 'FAILED' //     the voice could not play now; the text stays (T2-06)
  | 'GONE'; //      the stored voice is no longer available; the text stays (T2-07)

export interface VoiceReplyItem {
  readonly turnId: string;
  readonly replyId: string;
  /** The visible text released so far; the finished turn's answer is the record. */
  readonly text: string;
  readonly phase: VoiceReplyPhase;
  /** The reply has finished being produced and its whole length is known. */
  readonly final: boolean;
}

export interface VoiceReplyState {
  /** By voice-note turn id; only replies this runtime started. */
  readonly replies: Readonly<Record<string, VoiceReplyItem>>;
}

export interface VoiceRepliesOptions {
  readonly api: Pick<VoiceNoteApiClient, 'liveReplyStatus' | 'liveReplyAudioUrl' | 'cancelLiveReply'>;
  readonly player: VoiceNotePlayerPort;
  readonly authorization: () => Record<string, string> | null;
  readonly foreground: ForegroundSignal;
  /** The finished turn's answer (or null when the turn ended without one), for the conversation to merge. */
  readonly onExchange: (turnId: string, exchange: ConversationExchangeView | null) => void;
  readonly isCurrent: () => boolean;
  /** Another player is about to start (a recording's own playback): this one is paused first. */
  readonly onWillPlay?: () => void;
  readonly setTimer?: (callback: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

export interface VoiceReplies {
  getState(): VoiceReplyState;
  subscribe(listener: () => void): () => void;
  /** The reader's Send committed this turn and its reply is being produced under `replyId`: it speaks by itself. */
  start(turnId: string, replyId: string): void;
  /** The reader's pause / resume / replay on one reply. */
  toggle(turnId: string): Promise<void>;
  /** Pause whatever speaks and stop new synthesis of a reply still produced (leave, background, a new recording). */
  quiet(): void;
  retire(): void;
}

/** The long-poll's wait; the server answers sooner when something is new. */
export const VOICE_REPLY_STATUS_WAIT_MS = 20_000;
/** A read with no answer is tried again after these delays; then the conversation's own reads take over. */
export const VOICE_REPLY_STATUS_RETRY_MS = Object.freeze([1_000, 2_000, 4_000]);
/** A voice that has not started by then cannot play now. */
export const VOICE_REPLY_LOAD_TIMEOUT_MS = 15_000;
/** The player stops itself this close to the announced end (its clock reports in steps). */
const END_SLACK_MS = 60;

const NOTHING_KNOWN: VoiceLiveReplyKnown = { textLength: 0, final: false, exchange: false };

export function createVoiceReplies(options: VoiceRepliesOptions): VoiceReplies {
  const { api, player, authorization, foreground, onExchange, isCurrent } = options;
  const setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let state: VoiceReplyState = { replies: {} };
  const listeners = new Set<() => void>();
  let retired = false;
  const live = () => !retired && isCurrent();

  /** Per reply: what the phone has, the final length, the status loop, and the one player it holds. */
  const held = new Map<string, {
    replyId: string;
    known: VoiceLiveReplyKnown;
    finalDurationMs: number | null;
    polling: boolean;
    abort: AbortController | null;
    player: VoiceNotePlayer | null;
    token: number;
    loadTimer: unknown;
    stopped: boolean;
  }>();
  let tokens = 0;

  const set = (turnId: string, next: Partial<VoiceReplyItem>) => {
    const current = state.replies[turnId];
    if (current === undefined) return;
    state = { replies: { ...state.replies, [turnId]: { ...current, ...next } } };
    for (const listener of Array.from(listeners)) listener();
  };
  const phaseOf = (turnId: string) => state.replies[turnId]?.phase;

  function releasePlayer(turnId: string): void {
    const entry = held.get(turnId);
    if (entry === undefined) return;
    if (entry.loadTimer !== null) clearTimer(entry.loadTimer);
    entry.loadTimer = null;
    try {
      entry.player?.release();
    } catch {
      // A player that is already gone has nothing left to release.
    }
    entry.player = null;
    entry.token = 0;
  }

  /**
   * The voice cannot play. A finished reply's stored audio may have passed its period: the player cannot tell why it
   * failed, so ONE status read (our own server, no provider work) tells "no longer available" (T2-07) from "not now" (T2-06).
   */
  function cannotPlay(turnId: string): void {
    const entry = held.get(turnId);
    releasePlayer(turnId);
    set(turnId, { phase: 'FAILED' });
    if (entry === undefined || !entry.known.final) return;
    void api.liveReplyStatus(entry.replyId, entry.known, 0).then((read) => {
      if (live() && phaseOf(turnId) === 'FAILED' && read.kind === 'NOT_FOUND') set(turnId, { phase: 'GONE' });
    }, () => undefined);
  }

  /** The voice reached the announced end (or the stream ended): it rests, and replay is offered. */
  function ended(turnId: string): void {
    releasePlayer(turnId);
    set(turnId, { phase: 'ENDED' });
  }

  function onStatus(turnId: string, token: number, status: VoiceNotePlayerStatus): void {
    const entry = held.get(turnId);
    if (!live() || entry === undefined || entry.token !== token) return;
    if (status.failed) {
      cannotPlay(turnId);
      return;
    }
    if ((status.loaded || status.playing) && entry.loadTimer !== null) {
      clearTimer(entry.loadTimer);
      entry.loadTimer = null;
    }
    if (status.finished) {
      ended(turnId);
      return;
    }
    // The server announced the whole length: the player stops itself there (a stream of unknown length never ends).
    if (entry.finalDurationMs !== null && status.positionMs >= entry.finalDurationMs - END_SLACK_MS) {
      ended(turnId);
      return;
    }
    if (status.playing && phaseOf(turnId) === 'PREPARING') set(turnId, { phase: 'PLAYING' });
  }

  async function play(turnId: string): Promise<void> {
    const entry = held.get(turnId);
    if (!live() || entry === undefined || foreground.current() !== 'ACTIVE') return;
    releasePlayer(turnId);
    const headers = authorization();
    if (headers === null) {
      set(turnId, { phase: 'FAILED' });
      return;
    }
    options.onWillPlay?.();
    tokens += 1;
    const token = tokens;
    entry.token = token;
    entry.stopped = false;
    set(turnId, { phase: 'PREPARING' });
    entry.loadTimer = setTimer(() => {
      if (entry.token !== token) return;
      cannotPlay(turnId);
    }, VOICE_REPLY_LOAD_TIMEOUT_MS);
    let created: VoiceNotePlayer;
    try {
      created = await player.create(api.liveReplyAudioUrl(entry.replyId), headers, (status) => onStatus(turnId, token, status));
    } catch {
      if (entry.token === token) cannotPlay(turnId);
      return;
    }
    if (!live() || entry.token !== token) {
      created.release();
      return;
    }
    entry.player = created;
    created.play();
  }

  function apply(turnId: string, read: VoiceLiveReplyRead): 'AGAIN' | 'DONE' | 'RETRY' {
    const entry = held.get(turnId);
    if (entry === undefined) return 'DONE';
    if (read.kind === 'NOT_FOUND') {
      // Expired or never ours: the voice is gone; the conversation's history holds the text.
      // (A turn whose answer never reached the phone is shown by the conversation's next history read.)
      releasePlayer(turnId);
      set(turnId, { phase: 'GONE', final: true });
      return 'DONE';
    }
    if (read.kind === 'UNAVAILABLE') return 'RETRY';
    const view = read.view;
    const text = view.text ?? '';
    if (text.length > entry.known.textLength) {
      entry.known = { ...entry.known, textLength: text.length };
      set(turnId, { text });
    }
    if (view.finalDurationMs !== null && !entry.known.final) {
      entry.known = { ...entry.known, final: true };
      entry.finalDurationMs = view.finalDurationMs;
      set(turnId, { final: true });
      // No audio at all: nothing to play (the text stays).
      if (view.finalDurationMs === 0) {
        releasePlayer(turnId);
        set(turnId, { phase: 'FAILED' });
      }
    }
    if (view.exchange !== undefined && !entry.known.exchange) {
      entry.known = { ...entry.known, exchange: true };
      onExchange(turnId, view.exchange);
    }
    return entry.known.exchange && entry.known.final ? 'DONE' : 'AGAIN';
  }

  async function poll(turnId: string): Promise<void> {
    const entry = held.get(turnId);
    if (entry === undefined || entry.polling) return;
    entry.polling = true;
    let failures = 0;
    try {
      while (live() && held.get(turnId) === entry) {
        entry.abort = new AbortController();
        const read = await api.liveReplyStatus(entry.replyId, entry.known, VOICE_REPLY_STATUS_WAIT_MS, entry.abort.signal);
        entry.abort = null;
        if (!live()) return;
        const next = apply(turnId, read);
        if (next === 'DONE') return;
        if (next === 'RETRY') {
          if (failures >= VOICE_REPLY_STATUS_RETRY_MS.length) return;
          const delay = VOICE_REPLY_STATUS_RETRY_MS[failures];
          failures += 1;
          await new Promise<void>((resolve) => setTimer(resolve, delay));
        } else failures = 0;
      }
    } finally {
      entry.polling = false;
    }
  }

  function quiet(): void {
    for (const [turnId, entry] of held) {
      const phase = phaseOf(turnId);
      if (phase === 'PLAYING') {
        entry.player?.pause();
        set(turnId, { phase: 'PAUSED' });
      } else if (phase === 'PREPARING') {
        // Not yet speaking: let go rather than left to start on its own.
        releasePlayer(turnId);
        set(turnId, { phase: 'PAUSED' });
      }
      // A reply still produced stops paying for new synthesis; what was produced stays replayable.
      if (!entry.known.final && !entry.stopped) {
        entry.stopped = true;
        void api.cancelLiveReply(entry.replyId).catch(() => undefined);
      }
    }
  }

  const unsubscribeForeground = foreground.subscribe(() => {
    if (foreground.current() !== 'ACTIVE') quiet();
  });

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start(turnId, replyId) {
      if (!live() || held.has(turnId)) return;
      held.set(turnId, {
        replyId, known: NOTHING_KNOWN, finalDurationMs: null, polling: false, abort: null, player: null, token: 0, loadTimer: null, stopped: false,
      });
      state = { replies: { ...state.replies, [turnId]: { turnId, replyId, text: '', phase: 'PREPARING', final: false } } };
      for (const listener of Array.from(listeners)) listener();
      void poll(turnId);
      // It speaks by itself only while the reader is looking at it.
      if (foreground.current() === 'ACTIVE') void play(turnId);
      else set(turnId, { phase: 'PAUSED' });
    },
    async toggle(turnId) {
      const entry = held.get(turnId);
      const phase = phaseOf(turnId);
      if (!live() || entry === undefined || phase === undefined || foreground.current() !== 'ACTIVE') return;
      if (phase === 'PLAYING' || phase === 'PREPARING') {
        if (entry.player === null) releasePlayer(turnId);
        else entry.player.pause();
        set(turnId, { phase: 'PAUSED' });
        return;
      }
      if (phase === 'PAUSED' && entry.player !== null) {
        options.onWillPlay?.();
        entry.player.play();
        set(turnId, { phase: 'PLAYING' });
        return;
      }
      if (phase === 'GONE') return;
      // Ended, failed, or paused before it began: the stream again (once the reply is finished, the stored audio).
      await play(turnId);
    },
    quiet,
    retire() {
      retired = true;
      unsubscribeForeground();
      for (const [turnId, entry] of held) {
        entry.abort?.abort();
        releasePlayer(turnId);
      }
      held.clear();
      listeners.clear();
    },
  };
}
