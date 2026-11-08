/**
 * S8B-03 (CP2) — Voice Notes for ONE runtime generation: the device parts (built once per app runtime) and the Session's
 * own composition (built per generation, retired with it).
 *
 * The drafts belong to the ACCOUNT on this device, not to the generation: they survive a sign-out and are shown again
 * only to the same account (decision D3, OD-6). The recorder and the player are the platform's, created per use.
 */
import type { ConversationExchangeView, ForegroundSignal } from '../runtime-entry';
import {
  createDeviceVoiceDraftFiles,
  createEphemeralVoiceDraftKeyValue,
  createVoiceDraftKeyValue,
  createVoiceDraftStore,
  type VoiceDraftFiles,
  type VoiceDraftStore,
} from './voice-draft-store';
import type { VoiceNoteApiClient } from './voice-note-api';
import { createVoiceNoteCapture, type VoiceRecorderPort } from './voice-note-capture';
import { createVoiceNotesController } from './voice-note-controller';
import { createVoiceNotePlayback, type VoiceNotePlayerPort } from './voice-note-playback';
import { createExpoVoiceNotePlayerPort } from './voice-note-player-port';
import { createCaptureScreenHold, createExpoVoiceRecorderPort } from './voice-note-recorder-port';
import { createVoiceNoteSession, withRecordingDeleted, type VoiceNoteSession } from './voice-note-session';
import { createVoiceLiveNotes, type VoicePcmStreamPort } from './voice-live-note';
import { createExpoVoicePcmStreamPort } from './voice-pcm-stream-port';
import { createVoiceReplies } from './voice-reply';

export interface VoiceNoteDevice {
  readonly store: VoiceDraftStore;
  readonly files: VoiceDraftFiles;
  readonly recorder: () => VoiceRecorderPort;
  readonly player: VoiceNotePlayerPort;
  readonly screen: { hold(): void; release(): void };
  /** S8B-04 (CP2, D-S1): the PCM stream beside the recorder for the live note; null: no live note on this device. */
  readonly pcmStream: VoicePcmStreamPort | null;
}

/** The platform's parts. Building them touches nothing: the store opens, and a recorder is made, on first use. */
export function createDeviceVoiceNotes(): VoiceNoteDevice {
  const files = createDeviceVoiceDraftFiles();
  return {
    files,
    store: createVoiceDraftStore(createVoiceDraftKeyValue(), files),
    recorder: createExpoVoiceRecorderPort,
    player: createExpoVoiceNotePlayerPort(),
    screen: createCaptureScreenHold(),
    pcmStream: createExpoVoicePcmStreamPort(),
  };
}

/**
 * For tests and proofs that do not exercise Voice Notes: an in-memory store with no files, a microphone that is never
 * granted and a player that never loads. Nothing here touches the platform.
 */
export function createInertVoiceNoteDevice(): VoiceNoteDevice {
  const files: VoiceDraftFiles = {
    adopt: async () => {
      throw new Error('no recorder in an inert device');
    },
    size: () => null,
    check: () => 'INCOMPLETE',
    checkUri: () => 'INCOMPLETE',
    read: () => new Uint8Array(0),
    remove: () => undefined,
    removeUri: () => undefined,
    removeOwner: () => undefined,
  };
  return {
    files,
    store: createVoiceDraftStore(createEphemeralVoiceDraftKeyValue(), files),
    recorder: () => ({
      permission: async () => 'DENIED',
      requestPermission: async () => 'DENIED',
      prepare: async () => {
        throw new Error('no recorder in an inert device');
      },
      record: () => undefined,
      stop: async () => undefined,
      status: () => ({ isRecording: false, durationMillis: 0 }),
      currentInput: async () => null,
      onEnded: () => () => undefined,
    }),
    player: {
      create: async () => {
        throw new Error('no player in an inert device');
      },
    },
    screen: { hold: () => undefined, release: () => undefined },
    pcmStream: null,
  };
}

/**
 * S8B-06 CP3 — the microphone for a live call, at the moment of the reader's press (G1.2 §5): the same recorder port and the
 * same rule as a Voice Note's capture (the OS prompt only while the answer is still undetermined). True only when granted.
 */
export async function microphoneForCall(device: VoiceNoteDevice): Promise<boolean> {
  const recorder = device.recorder();
  let permission = await recorder.permission();
  if (permission === 'UNDETERMINED') permission = await recorder.requestPermission();
  return permission === 'GRANTED';
}

/** A command or draft id: a random version-4 UUID. It carries no reader data. */
export function mintVoiceNoteId(): string {
  const hex = (count: number) => Array.from({ length: count }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const variant = (8 + Math.floor(Math.random() * 4)).toString(16);
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}

export interface VoiceNoteSessionRuntimeOptions {
  readonly owner: string;
  readonly sessionId: string;
  readonly transport: { readonly api: VoiceNoteApiClient; readonly authorization: () => Record<string, string> | null };
  readonly device: VoiceNoteDevice;
  readonly foreground: ForegroundSignal;
  readonly isCurrent: () => boolean;
  /** THIS Session's conversation: a committed note joins it, and a deleted recording's turn is shown as deleted. */
  readonly conversation: {
    adopt(exchange: ConversationExchangeView, sessionId: string): void;
    getState(): { readonly exchanges: readonly ConversationExchangeView[] };
  };
  readonly newId?: () => string;
  /** S8B-07 CP1-B (§7): the phone's one playback slot; absent, the S8B-03 behaviour, unchanged. */
  readonly playbackOwner?: { claim(key: string, release: () => void): { drop(): void } | null };
}

export function createVoiceNoteSessionRuntime(options: VoiceNoteSessionRuntimeOptions): VoiceNoteSession {
  const { owner, sessionId, transport, device, foreground, isCurrent, conversation } = options;
  const newId = options.newId ?? mintVoiceNoteId;
  const playback = createVoiceNotePlayback({
    player: device.player, urlOf: (recordingId) => transport.api.playbackUrl(recordingId), authorization: transport.authorization, foreground,
    ...(options.playbackOwner === undefined ? {} : { owner: options.playbackOwner }),
  });
  // S8B-04 (CP2): the turn of a note sent here joins the conversation at once (its words arrive with its answer); the
  // answer, once the turn is done, is merged over it by turn id like any server report.
  const provisional = new Map<string, ConversationExchangeView>();
  const replies = createVoiceReplies({
    api: transport.api, player: device.player, authorization: transport.authorization, foreground, isCurrent,
    onWillPlay: () => playback.pause(),
    onExchange: (turnId, exchange) => {
      const held = provisional.get(turnId);
      provisional.delete(turnId);
      if (exchange !== null) conversation.adopt(held?.voiceNote === undefined ? exchange : { ...exchange, voiceNote: held.voiceNote }, sessionId);
      else if (held !== undefined) conversation.adopt({ ...held, replyState: 'FAILED' }, sessionId);
    },
  });
  const liveNotes = createVoiceLiveNotes({ api: transport.api, stream: device.pcmStream, newId });
  return createVoiceNoteSession({
    api: transport.api,
    capture: createVoiceNoteCapture({ owner, sessionId, recorder: device.recorder(), store: device.store, foreground, newId, screen: device.screen }),
    notes: createVoiceNotesController({
      owner, sessionId, api: transport.api, store: device.store, files: device.files, foreground, isCurrent, newId,
      onCommitted: (exchange, of) => conversation.adopt(exchange, of),
      onReplying: ({ recordingId, turnId, replyId, durationMs, availableUntil }) => {
        const exchange: ConversationExchangeView = {
          userTurn: { id: turnId, content: '', idempotencyKey: null, createdAt: new Date().toISOString() },
          replyState: 'PENDING',
          reply: null,
          voiceNote: { recordingId, available: true, availableUntil, durationMs },
        };
        provisional.set(turnId, exchange);
        conversation.adopt(exchange, sessionId);
        replies.start(turnId, replyId);
      },
    }),
    playback,
    replies,
    liveNote: { begin: () => liveNotes.begin(sessionId), finish: () => liveNotes.finish(), cancel: () => liveNotes.cancel() },
    foreground,
    newId,
    isCurrent,
    exportAccess: { url: (fileName) => transport.api.exportVoiceUrl(fileName), authorization: transport.authorization },
    onRecordingDeleted: (recordingId) => {
      const turn = conversation.getState().exchanges.find((exchange) => exchange.voiceNote?.recordingId === recordingId);
      if (turn !== undefined) conversation.adopt(withRecordingDeleted(turn, recordingId), sessionId);
    },
  });
}
