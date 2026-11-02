/**
 * S8B-04 (CP2, D-S1) — the live note: the recording's audio streamed DURING the recording to a realtime transcription,
 * so the note can be answered as soon as it is sent.
 *
 *   - It is opened only after the reader's CURRENT consent (the server refuses otherwise, and then nothing is streamed:
 *     the samples held so far are dropped on the device). Anything but OPENED: the recording goes on exactly as before,
 *     and the note is transcribed after it is sent.
 *   - The samples are 16 kHz mono 16-bit PCM from the platform's own stream, sent in order as small chunks, each exactly
 *     once. Any failure (a refused chunk, a gap, a different sample rate) makes the live note unusable: it is discarded
 *     and the upload does not name it.
 *   - Send names it (its id and how many chunks were sent) with the recording's upload; the server decides whether its
 *     transcript stands. Cancel, leave, or any stop the reader did not ask for discards it at once.
 *
 * Nothing is logged and nothing is written to the device.
 */
import type { VoiceLiveNoteRef, VoiceNoteApiClient } from './voice-note-api';

/** The platform's PCM stream: 16 kHz mono 16-bit samples, delivered as they are captured. */
export interface VoicePcmStreamPort {
  /** Starts streaming; resolves to its stop. Each buffer reports its sample rate (anything but 16 kHz is unusable). */
  start(onBuffer: (pcm: Uint8Array, sampleRate: number) => void): Promise<() => void>;
}

export interface VoiceLiveNotesOptions {
  readonly api: Pick<VoiceNoteApiClient, 'openLiveNote' | 'appendLiveNote' | 'cancelLiveNote'>;
  readonly stream: VoicePcmStreamPort | null;
  readonly newId: () => string;
  readonly setTimer?: (callback: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

export interface VoiceLiveNotes {
  /** The recording of `sessionId` has begun (after consent): a live note opens beside it. */
  begin(sessionId: string): Promise<void>;
  /** Send: the live note's reference for the upload, or nothing when it is not usable. */
  finish(): Promise<VoiceLiveNoteRef | undefined>;
  /** Cancel, leave, or a stop the reader did not ask for: discarded. */
  cancel(): void;
}

export const LIVE_NOTE_SAMPLE_RATE = 16_000;
/** About a quarter of a second of audio per chunk (well under the server's 64 KiB). */
export const LIVE_NOTE_CHUNK_BYTES = 8_000;
/** Send waits at most this long for the chunks still in flight; then the live note is not used. */
export const LIVE_NOTE_FINISH_WAIT_MS = 1_500;

/** One live note in this runtime: its open, what is held, its next chunk number and whether it is still usable. */
interface LiveNote {
  liveId: string;
  opened: Promise<boolean>;
  stop: (() => void) | null;
  pending: Uint8Array[];
  pendingBytes: number;
  seq: number;
  chain: Promise<void>;
  usable: boolean;
  stopped: boolean;
}

export function createVoiceLiveNotes(options: VoiceLiveNotesOptions): VoiceLiveNotes {
  const { api, stream, newId } = options;
  const setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let current: LiveNote | null = null;

  function discard(note: LiveNote): void {
    note.usable = false;
    note.pending = [];
    note.pendingBytes = 0;
    if (!note.stopped) {
      note.stopped = true;
      try {
        note.stop?.();
      } catch {
        // A stream that already ended has nothing to stop.
      }
    }
    void note.opened.then((opened) => (opened ? api.cancelLiveNote(note.liveId) : undefined)).catch(() => undefined);
  }

  /** Sends what is held as one chunk, after the open and every earlier chunk. */
  function flush(note: LiveNote): void {
    if (!note.usable || note.pendingBytes === 0) return;
    const chunk = new Uint8Array(note.pendingBytes);
    let offset = 0;
    for (const part of note.pending) {
      chunk.set(part, offset);
      offset += part.length;
    }
    note.pending = [];
    note.pendingBytes = 0;
    note.chain = note.chain.then(async () => {
      if (!note.usable || !(await note.opened)) {
        note.usable = false;
        return;
      }
      const seq = note.seq;
      note.seq += 1;
      if (!(await api.appendLiveNote(note.liveId, seq, chunk))) note.usable = false;
    });
  }

  return {
    async begin(sessionId) {
      if (current !== null) discard(current);
      current = null;
      if (stream === null) return;
      const liveId = newId();
      const note: LiveNote = {
        liveId, opened: api.openLiveNote(sessionId, liveId).then((outcome) => outcome === 'OPENED', () => false),
        stop: null, pending: [], pendingBytes: 0, seq: 0, chain: Promise.resolve(), usable: true, stopped: false,
      };
      current = note;
      // Refused (no current consent, the gate, the budget, no realtime route): nothing held is ever sent.
      void note.opened.then((opened) => {
        if (!opened && current === note) discard(note);
      });
      try {
        note.stop = await stream.start((pcm, sampleRate) => {
          if (!note.usable || note.stopped) return;
          if (sampleRate !== LIVE_NOTE_SAMPLE_RATE || pcm.length % 2 !== 0) {
            discard(note);
            return;
          }
          note.pending.push(pcm);
          note.pendingBytes += pcm.length;
          if (note.pendingBytes >= LIVE_NOTE_CHUNK_BYTES) flush(note);
        });
      } catch {
        discard(note);
        return;
      }
      // Cancelled while the stream was starting.
      if (note.stopped || current !== note) {
        try {
          note.stop?.();
        } catch {
          // Nothing left to stop.
        }
      }
    },
    async finish() {
      const note = current;
      current = null;
      if (note === null) return undefined;
      if (!note.stopped) {
        note.stopped = true;
        try {
          note.stop?.();
        } catch {
          // A stream that already ended has nothing to stop.
        }
      }
      flush(note);
      let timer: unknown = null;
      const drained = await Promise.race([
        note.chain.then(() => true),
        new Promise<boolean>((resolve) => {
          timer = setTimer(() => resolve(false), LIVE_NOTE_FINISH_WAIT_MS);
        }),
      ]);
      if (timer !== null) clearTimer(timer);
      if (!drained || !note.usable || note.seq === 0 || !(await note.opened)) {
        discard(note);
        return undefined;
      }
      return { liveId: note.liveId, chunks: note.seq };
    },
    cancel() {
      if (current !== null) discard(current);
      current = null;
    },
  };
}
