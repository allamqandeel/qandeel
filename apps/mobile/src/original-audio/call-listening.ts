/**
 * S8B-07 CP1-B (VA-10, Sheet A) — listening to a finished call's recording: one transient engine per call, made when the
 * reader first plays it, addressed by the call (no recording id is on the wire). Both tracks arrive mixed in one file on
 * the call's own clock (the server's mix, §4); the phone only plays it.
 *
 * "This session only" (CL-06 / CL-07 / CL-11): a record shows why it can no longer be heard only when this runtime saw it
 * available first. Held in memory; nothing is stored.
 */
import type { ForegroundSignal } from '../runtime-entry';
import type { VoiceNotePlayerPort } from '../voice-note/voice-note-playback';
import type { PlaybackOwner } from './playback-owner';
import type { TransientMediaApiClient, TransientRequestResult } from './transient-media-api';
import { createTransientPlayback, type TransientPlayback, type TransientPlaybackEvent } from './transient-playback';

export interface CallListeningOptions {
  /** The Replay Media Service's client; null when there is none (INFRA-07 `NONE`): every play is CL-05. */
  readonly api: TransientMediaApiClient | null;
  readonly owner: PlaybackOwner;
  readonly player: VoiceNotePlayerPort;
  readonly foreground: ForegroundSignal;
  readonly authorization: () => Record<string, string> | null;
  readonly newCommandId: () => string;
  readonly onEvent?: (event: TransientPlaybackEvent) => void;
}

export interface CallListening {
  /** The call's engine (made on first use). */
  engineFor(callId: string): TransientPlayback;
  /** This runtime saw the call's recording available. */
  markAvailable(callId: string): void;
  wasAvailable(callId: string): boolean;
  /** The reader left the conversation: every call's audio is released and its set let go. */
  leaveAll(): void;
  retire(): void;
}

const NONE: Promise<TransientRequestResult> = Promise.resolve({ kind: 'BUSY' });

export function createCallListening(options: CallListeningOptions): CallListening {
  const engines = new Map<string, TransientPlayback>();
  const available = new Set<string>();
  const { api } = options;
  return {
    engineFor(callId) {
      const known = engines.get(callId);
      if (known !== undefined) return known;
      const engine = createTransientPlayback({
        subjectKey: `call:${callId}`,
        request: (commandId) => (api === null ? NONE : api.requestListening(callId, commandId)),
        status: (artifactId) => (api === null ? Promise.resolve({ kind: 'UNKNOWN' as const }) : api.status(artifactId)),
        release: (artifactId) => (api === null ? Promise.resolve() : api.release(artifactId)),
        audioUrl: (artifactId) => (api === null ? '' : api.audioUrl(artifactId)),
        authorization: options.authorization,
        player: options.player,
        owner: options.owner,
        foreground: options.foreground,
        newCommandId: options.newCommandId,
        ...(options.onEvent === undefined ? {} : { onEvent: options.onEvent }),
      });
      engines.set(callId, engine);
      return engine;
    },
    markAvailable(callId) {
      available.add(callId);
    },
    wasAvailable: (callId) => available.has(callId),
    leaveAll() {
      for (const engine of engines.values()) if (engine.getState().phase !== 'IDLE' && engine.getState().phase !== 'ENDED') engine.leave();
    },
    retire() {
      for (const engine of engines.values()) engine.retire();
      engines.clear();
      available.clear();
    },
  };
}
