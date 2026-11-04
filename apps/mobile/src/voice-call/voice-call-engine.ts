/**
 * S8B-06 CP1 + CP2 — the port to QANDEEL's native call audio engine and the call's platform lifecycle
 * (`modules/qandeel-voice-call`: Android CP1 + CP2, iOS CP2).
 *
 * The engine owns the microphone and the speaker for a live call: capture through the platform's voice-communication path
 * with its echo canceller, Opus both ways, the speech-onset detector after the canceller, the local barge-in cut, and the
 * heard (PRESENTED) playout position. This file only types it. `expo-audio` is not used for calls (contract v1.0 §9).
 *
 * CP2: the same module carries the platform call (Android Core-Telecom with its foreground service and CallStyle
 * notification; iOS CallKit with its audio session) behind {@link CallPlatform}, the engine's hold / resume (another call
 * took the audio), and the 60-minute warning cue (`playCue` now, `scheduleCue` on the engine's own clock, which keeps
 * running with the screen locked). `loadVoiceCallEngine()` / `loadCallPlatform()` are null under Jest and wherever the
 * module is not linked, and every caller treats null as "a live call is not available".
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
  /**
   * CP2: `PLATFORM_CALL` — the production call: the platform call (Telecom / CallKit) owns the audio mode, the route and
   * the focus, and the engine starts only inside its ACTIVE call. `SELF` (the default) is CP1's engine-owned audio, for
   * the device proofs.
   */
  readonly audioOwner?: 'SELF' | 'PLATFORM_CALL';
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
  | { readonly type: 'route'; readonly change: string; readonly devices: readonly string[] }
  /** CP2: the microphone and the speaker stopped for another call; `captureMs` is the first frame NOT produced. */
  | { readonly type: 'hold'; readonly captureMs: number; readonly cause: string }
  /** CP2: they started again; the next packet is at `captureMs` (the held time is a hole the client brackets). */
  | { readonly type: 'resume'; readonly captureMs: number }
  /** CP2: a warning cue. HEARD only once the platform presented its last frame. */
  | { readonly type: 'cue'; readonly event: CueEvent; readonly id: string; readonly forced: boolean; readonly source: string | null }
  /** The engine's own clock (every 250 ms while it runs, held included): paces the call's timers when JS timers pause. */
  | { readonly type: 'tick'; readonly nowMs: number };

export type CueEvent = 'QUEUED' | 'DUE' | 'STARTED' | 'HEARD' | 'REQUEUED' | 'SUPERSEDED' | 'DROPPED' | 'REPEATED';
export type CueKind = 'T5' | 'T1';
export type CueRequest = 'QUEUED' | 'SCHEDULED' | 'REPEATED' | 'SUPERSEDED' | 'NOT_RUNNING';

export type ReplyAdmission = 'ACCEPT' | 'LATE_AFTER_CUT' | 'STALE_REPLY' | 'REPEATED_OR_REORDERED' | 'OVERFLOW' | 'HELD' | 'NOT_RUNNING';

/** What the call layer needs from the engine. A fake implements it in tests. */
export interface VoiceCallEngine {
  start(options: EngineStartOptions): Promise<EngineDescription>;
  stop(): Promise<void>;
  setMuted(muted: boolean): void;
  enqueueReply(callTurnIndex: number, chunkSeq: number, offsetMs: number, packet: Uint8Array): ReplyAdmission;
  describe(): EngineDescription | null;
  subscribe(listener: (event: EngineEvent) => void): () => void;
  /** CP2: queue a warning cue now (`notificationText`: the call notification's line from then, Android). */
  playCue?(id: string, kind: CueKind, forceAfterMs: number, notificationText: string | null): CueRequest;
  /** CP2: queue it `dueInMs` from now, on the engine's own clock (the local trigger). */
  scheduleCue?(id: string, kind: CueKind, dueInMs: number, forceAfterMs: number, notificationText: string | null): CueRequest;
  /**
   * CP3 (D-05-07 T1): stop QANDEEL's voice here, now, without speech — the same local cut as a detected barge-in (fade, the
   * reply's queued packets dropped, its later packets refused), reported as a forced `bargeIn`. False when nothing runs.
   */
  cutReply?(): boolean;
}

export type CallRoute = 'EARPIECE' | 'SPEAKER' | 'WIRED_HEADSET' | 'BLUETOOTH';

export interface CallCapability {
  readonly supported: boolean;
  /** API_BELOW_26, NO_TELECOM (Android); CALLKIT_UNAVAILABLE (iOS). */
  readonly reason: string | null;
  readonly microphoneGranted: boolean;
  readonly inCall: boolean;
}

export interface CallStartOptions {
  readonly callId: string;
  readonly displayName: string;
  readonly notificationTitle: string;
  readonly notificationText: string;
  readonly channelName: string;
  readonly route: 'EARPIECE' | 'SPEAKER';
}

export type CallEndSource =
  | 'APP' | 'NOTIFICATION' | 'SYSTEM' | 'MICROPHONE' | 'ENGINE' | 'SERVICE' | 'TASK_REMOVED' | 'APP_GONE' | 'START_FAILED';

/** The platform call's lifecycle, as the module reports it (content-free). */
export type CallLifecycleEvent =
  | { readonly type: 'ACTIVE' | 'HELD' | 'RESUMED'; readonly callId: string; readonly state: string; readonly ignoredLate: number }
  | { readonly type: 'ENDED'; readonly callId: string; readonly state: string; readonly ignoredLate: number; readonly source: CallEndSource; readonly detail: string | null }
  | { readonly type: 'ENDPOINTS'; readonly callId: string; readonly endpoints: readonly { readonly type: string }[] }
  | { readonly type: 'ENDPOINT'; readonly callId: string; readonly endpoint: { readonly type: string } }
  | { readonly type: 'SYSTEM_MUTE'; readonly callId: string; readonly muted: boolean }
  | { readonly type: 'ENDPOINT_REQUEST'; readonly callId: string; readonly endpoint: { readonly type: string }; readonly result: 'SUCCESS' | 'ERROR' };

/** The platform call (Android Core-Telecom + foreground service + notification; iOS CallKit). A fake implements it in tests. */
export interface CallPlatform {
  capability(): CallCapability;
  /** Resolves once the platform call is ACTIVE (and, on Android, its foreground service is up); rejects with a code. */
  startCall(options: CallStartOptions): Promise<Readonly<Record<string, unknown>>>;
  /** The app's end (the person's, or the server's relayed). Idempotent. */
  endCall(detail: string | null): boolean;
  /** Ask the platform to make a held call active again. */
  resumeCall(): boolean;
  requestRoute(route: CallRoute): boolean;
  /** The ongoing-call notification's line (Android; false on iOS, which has none). */
  updateCallNotification(text: string): boolean;
  subscribe(listener: (event: CallLifecycleEvent) => void): () => void;
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
  playCue(id: string, kind: string, forceAfterMs: number, notificationText: string | null): CueRequest;
  scheduleCue(id: string, kind: string, dueInMs: number, forceAfterMs: number, notificationText: string | null): CueRequest;
  callCapability(): CallCapability;
  startCall(options: CallStartOptions): Promise<Readonly<Record<string, unknown>>>;
  endCall(detail: string | null): boolean;
  resumeCall(): boolean;
  requestRoute(route: string): boolean;
  updateCallNotification(text: string): boolean;
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
  ['onHold', (p) => ({ type: 'hold', captureMs: p.captureMs as number, cause: p.cause as string })],
  ['onResume', (p) => ({ type: 'resume', captureMs: p.captureMs as number })],
  ['onCue', (p) => ({ type: 'cue', event: p.event as CueEvent, id: p.id as string, forced: p.forced === true, source: (p.source as string | null) ?? null })],
  ['onTick', (p) => ({ type: 'tick', nowMs: p.nowMs as number })],
];

function bind(native: NativeVoiceCall): VoiceCallEngine & { forceBargeIn(): boolean } {
  return {
    start: (options) => native.start(options),
    stop: () => native.stop(),
    setMuted: (muted) => native.setMuted(muted),
    enqueueReply: (callTurnIndex, chunkSeq, offsetMs, packet) => native.enqueueReply(callTurnIndex, chunkSeq, offsetMs, packet),
    describe: () => native.describe(),
    forceBargeIn: () => native.forceBargeIn(),
    cutReply: () => native.forceBargeIn(),
    playCue: (id, kind, forceAfterMs, notificationText) => native.playCue(id, kind, forceAfterMs, notificationText),
    scheduleCue: (id, kind, dueInMs, forceAfterMs, notificationText) => native.scheduleCue(id, kind, dueInMs, forceAfterMs, notificationText),
    subscribe(listener) {
      const subscriptions = NATIVE_EVENTS.map(([name, map]) => native.addListener(name, (payload) => listener(map(payload))));
      return () => subscriptions.forEach((s) => s.remove());
    },
  };
}

function bindPlatform(native: NativeVoiceCall): CallPlatform {
  return {
    capability: () => native.callCapability(),
    startCall: (options) => native.startCall(options),
    endCall: (detail) => native.endCall(detail),
    resumeCall: () => native.resumeCall(),
    requestRoute: (route) => native.requestRoute(route),
    updateCallNotification: (text) => native.updateCallNotification(text),
    subscribe(listener) {
      const subscription = native.addListener('onCallLifecycle', (payload) => listener(payload as unknown as CallLifecycleEvent));
      return () => subscription.remove();
    },
  };
}

function nativeModule(): NativeVoiceCall | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  return requireOptionalNativeModule<NativeVoiceCall>('QandeelVoiceCall');
}

/** The native engine (Android, iOS), or null (Jest, an unlinked build). */
export function loadVoiceCallEngine(): (VoiceCallEngine & { forceBargeIn(): boolean }) | null {
  const native = nativeModule();
  return native ? bind(native) : null;
}

/** The platform call (Android Core-Telecom, iOS CallKit), or null (Jest, an unlinked build). */
export function loadCallPlatform(): CallPlatform | null {
  const native = nativeModule();
  return native ? bindPlatform(native) : null;
}
