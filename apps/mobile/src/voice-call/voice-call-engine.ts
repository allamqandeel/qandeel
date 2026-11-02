/**
 * S8B-06 CP1 — the port to QANDEEL's native call audio engine (`modules/qandeel-voice-call`, Android).
 *
 * The engine owns the microphone and the speaker for a live call: capture through the platform's voice-communication path
 * with its echo canceller, Opus both ways, the speech-onset detector after the canceller, the local barge-in cut, and the
 * heard (PRESENTED) playout position. This file only types it. `expo-audio` is not used for calls (contract v1.0 §9).
 *
 * iOS has no engine in CP1 (CallKit and the iOS audio session are S8B-06 CP2): `loadVoiceCallEngine()` is null there,
 * under Jest, and wherever the module is not linked, and every caller treats null as "a live call is not available".
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { decodeBase64 } from './base64';

export type EngineRoute = 'EARPIECE' | 'SPEAKER';
/**
 * `UNPROCESSED_PROOF` (raw microphone, no canceller) and `RAW_MEDIA_PROOF` (no communication mode, media playback: the
 * positive control; the `RAW_*_PROOF` variants are the same control on another capture source) exist only for the device
 * proof's echo comparison.
 */
export type EngineCapture =
  | 'VOICE_COMMUNICATION' | 'UNPROCESSED_PROOF' | 'RAW_MEDIA_PROOF' | 'RAW_PERFORMANCE_PROOF' | 'RAW_CAMCORDER_PROOF' | 'RAW_UNPROCESSED_PROOF';
export type EngineBargeInAction = 'STOP' | 'REPORT_ONLY';

export interface EngineVadOptions {
  readonly onsetFrames?: number;
  readonly floorMarginDb?: number;
  readonly absoluteMinDb?: number;
  readonly echoGuardDb?: number;
}

export interface EngineStartOptions {
  readonly route: EngineRoute;
  readonly capture: EngineCapture;
  readonly aec: boolean;
  readonly bargeIn: EngineBargeInAction;
  readonly vad?: EngineVadOptions;
  /** Level traces (dBFS numbers, never samples) for the device proof. */
  readonly trace?: boolean;
}

export type EngineDescription = Readonly<Record<string, string | number | boolean | null>>;

/** One heard position: the last fully presented reply packet. */
export interface EnginePlayout {
  readonly callTurnIndex: number;
  readonly chunkSeq: number;
  readonly playedMs: number;
  readonly presentedFrame: number;
  readonly source: 'TIMESTAMP' | 'HEAD_MINUS_LATENCY';
}

export interface EngineBargeIn {
  readonly action: 'STOP' | 'REPORT_ONLY';
  readonly callTurnIndex: number;
  readonly onsetCaptureMs: number;
  readonly detectCaptureMs: number;
  readonly detectedAtNs: number;
  readonly forced: boolean;
  readonly fadeAppliedAtNs?: number;
  readonly headFrame?: number;
  readonly presentedFrame?: number;
  readonly stampFrame?: number | null;
  readonly stampNs?: number | null;
  readonly rampMs?: number;
  readonly stopAtNs?: number;
  readonly stopLatencyMs?: number;
  readonly stopSource?: 'TIMESTAMP' | 'LATENCY_ESTIMATE';
  /** The heard position at the cut (null when nothing of that reply was heard). */
  readonly finalChunkSeq?: number | null;
  readonly finalPlayedMs?: number | null;
}

export type EngineEvent =
  | { readonly type: 'uplink'; readonly captureMs: number; readonly packet: Uint8Array }
  | ({ readonly type: 'playout' } & EnginePlayout)
  | ({ readonly type: 'bargeIn' } & EngineBargeIn)
  | { readonly type: 'bargeInTrace'; readonly report: Readonly<Record<string, unknown>> }
  | { readonly type: 'levels'; readonly report: Readonly<Record<string, unknown>> }
  | { readonly type: 'speech'; readonly onsetCaptureMs: number; readonly detectCaptureMs: number }
  | { readonly type: 'replyDrained'; readonly callTurnIndex: number; readonly chunkSeq: number }
  | { readonly type: 'engineState'; readonly state: 'RUNNING' | 'STOPPED'; readonly reason: string | null }
  | { readonly type: 'fault'; readonly code: string }
  | { readonly type: 'focus'; readonly state: string }
  | { readonly type: 'route'; readonly change: string; readonly devices: readonly string[] };

export type ReplyAdmission = 'ACCEPT' | 'LATE_AFTER_CUT' | 'STALE_REPLY' | 'REPEATED_OR_REORDERED' | 'OVERFLOW' | 'NOT_RUNNING';

/** What the call layer needs from the engine. A fake implements it in tests. */
export interface VoiceCallEngine {
  start(options: EngineStartOptions): Promise<EngineDescription>;
  stop(): Promise<void>;
  setMuted(muted: boolean): void;
  enqueueReply(callTurnIndex: number, chunkSeq: number, offsetMs: number, packet: Uint8Array): ReplyAdmission;
  describe(): EngineDescription | null;
  subscribe(listener: (event: EngineEvent) => void): () => void;
}

interface Subscription {
  remove(): void;
}

interface NativeVoiceCall {
  start(options: EngineStartOptions): Promise<EngineDescription>;
  stop(): Promise<void>;
  setMuted(muted: boolean): void;
  enqueueReply(callTurnIndex: number, chunkSeq: number, offsetMs: number, packet: Uint8Array): ReplyAdmission;
  forceBargeIn(): boolean;
  describe(): EngineDescription | null;
  addListener(event: string, listener: (payload: Record<string, unknown>) => void): Subscription;
}

const NATIVE_EVENTS: readonly [string, (p: Record<string, unknown>) => EngineEvent][] = [
  ['onUplink', (p) => ({ type: 'uplink', captureMs: p.captureMs as number, packet: decodeBase64(p.packet as string) })],
  ['onPlayout', (p) => ({ type: 'playout', ...(p as unknown as EnginePlayout) })],
  ['onBargeIn', (p) => ({ type: 'bargeIn', ...(p as unknown as EngineBargeIn) })],
  ['onBargeInTrace', (p) => ({ type: 'bargeInTrace', report: p })],
  ['onLevels', (p) => ({ type: 'levels', report: p })],
  ['onSpeech', (p) => ({ type: 'speech', onsetCaptureMs: p.onsetCaptureMs as number, detectCaptureMs: p.detectCaptureMs as number })],
  ['onReplyDrained', (p) => ({ type: 'replyDrained', callTurnIndex: p.callTurnIndex as number, chunkSeq: p.chunkSeq as number })],
  ['onEngineState', (p) => ({ type: 'engineState', state: p.state as 'RUNNING' | 'STOPPED', reason: (p.reason as string | null) ?? null })],
  ['onFault', (p) => ({ type: 'fault', code: p.code as string })],
  ['onFocus', (p) => ({ type: 'focus', state: p.state as string })],
  ['onRoute', (p) => ({ type: 'route', change: p.change as string, devices: (p.devices as string[]) ?? [] })],
];

function bind(native: NativeVoiceCall): VoiceCallEngine & { forceBargeIn(): boolean } {
  return {
    start: (options) => native.start(options),
    stop: () => native.stop(),
    setMuted: (muted) => native.setMuted(muted),
    enqueueReply: (callTurnIndex, chunkSeq, offsetMs, packet) => native.enqueueReply(callTurnIndex, chunkSeq, offsetMs, packet),
    describe: () => native.describe(),
    forceBargeIn: () => native.forceBargeIn(),
    subscribe(listener) {
      const subscriptions = NATIVE_EVENTS.map(([name, map]) => native.addListener(name, (payload) => listener(map(payload))));
      return () => subscriptions.forEach((s) => s.remove());
    },
  };
}

/** The Android engine, or null (iOS in CP1, Jest, an unlinked build). */
export function loadVoiceCallEngine(): (VoiceCallEngine & { forceBargeIn(): boolean }) | null {
  if (Platform.OS !== 'android') return null;
  const native = requireOptionalNativeModule<NativeVoiceCall>('QandeelVoiceCall');
  return native ? bind(native) : null;
}
