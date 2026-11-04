/**
 * S8B-06 CP2 — test doubles for the native call layer: an engine (CP1's surface plus CP2's cues, whose dedup mirrors
 * `CueSchedule.kt` / `CueSchedule.swift`) and a platform call (Telecom / CallKit). Test-only.
 */
import type {
  CallCapability, CallLifecycleEvent, CallPlatform, CallRoute, CallStartOptions, CueKind, CueRequest, EngineDescription, EngineEvent,
  EngineStartOptions, ReplyAdmission, VoiceCallEngine,
} from '../voice-call-engine';

export class FakeCallEngine implements VoiceCallEngine {
  listener: ((event: EngineEvent) => void) | null = null;
  started: EngineStartOptions[] = [];
  stops = 0;
  muted: boolean[] = [];
  running = false;
  failStart: { code: string } | null = null;
  readonly cues: { readonly op: 'play' | 'schedule'; readonly id: string; readonly kind: CueKind; readonly dueInMs?: number; readonly text: string | null; readonly result: CueRequest }[] = [];
  private readonly asked = new Set<string>();
  private highest = 0;

  async start(options: EngineStartOptions): Promise<EngineDescription> {
    this.started.push(options);
    if (this.failStart) throw this.failStart;
    this.running = true;
    this.emit({ type: 'engineState', state: 'RUNNING', reason: null });
    return {};
  }

  async stop(): Promise<void> {
    this.stops += 1;
    this.running = false;
  }

  setMuted(muted: boolean): void {
    this.muted.push(muted);
  }

  enqueueReply(): ReplyAdmission {
    return this.running ? 'ACCEPT' : 'NOT_RUNNING';
  }

  describe(): EngineDescription | null {
    return null;
  }

  subscribe(listener: (event: EngineEvent) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }

  playCue(id: string, kind: CueKind, _forceAfterMs: number, text: string | null): CueRequest {
    const result = this.admit(id, kind, true);
    this.cues.push({ op: 'play', id, kind, text, result });
    if (result === 'QUEUED') this.emit({ type: 'cue', event: 'QUEUED', id, forced: false, source: null });
    return result;
  }

  scheduleCue(id: string, kind: CueKind, dueInMs: number, _forceAfterMs: number, text: string | null): CueRequest {
    const result: CueRequest = !this.running ? 'NOT_RUNNING' : this.asked.has(id) ? 'REPEATED' : rank(kind) < this.highest ? 'SUPERSEDED' : 'SCHEDULED';
    this.cues.push({ op: 'schedule', id, kind, dueInMs, text, result });
    return result;
  }

  /** The engine's clock reached a scheduled cue. */
  fire(id: string, kind: CueKind): void {
    if (this.admit(id, kind, true) === 'QUEUED') this.emit({ type: 'cue', event: 'DUE', id, forced: false, source: kind });
  }

  emit(event: EngineEvent): void {
    this.listener?.(event);
  }

  private admit(id: string, kind: CueKind, take: boolean): CueRequest {
    if (!this.running) return 'NOT_RUNNING';
    if (this.asked.has(id)) return 'REPEATED';
    if (rank(kind) < this.highest) return 'SUPERSEDED';
    if (take) {
      this.asked.add(id);
      this.highest = Math.max(this.highest, rank(kind));
    }
    return 'QUEUED';
  }
}

const rank = (kind: CueKind) => (kind === 'T1' ? 2 : 1);

export class FakeCallPlatform implements CallPlatform {
  capabilityValue: CallCapability = { supported: true, reason: null, microphoneGranted: true, inCall: false };
  readonly startCalls: CallStartOptions[] = [];
  readonly endCalls: (string | null)[] = [];
  readonly notifications: string[] = [];
  readonly routes: CallRoute[] = [];
  resumes = 0;
  private listener: ((event: CallLifecycleEvent) => void) | null = null;
  private pending: { resolve: () => void; reject: (e: unknown) => void } | null = null;
  autoActivate = true;

  capability(): CallCapability {
    return this.capabilityValue;
  }

  startCall(options: CallStartOptions): Promise<Readonly<Record<string, unknown>>> {
    this.startCalls.push(options);
    return new Promise((resolve, reject) => {
      this.pending = { resolve: () => resolve({ state: 'ACTIVE' }), reject };
      if (this.autoActivate) this.activate();
    });
  }

  /** Telecom / CallKit made the call active. */
  activate(): void {
    this.pending?.resolve();
    this.pending = null;
  }

  refuse(code: string): void {
    this.pending?.reject({ code });
    this.pending = null;
  }

  endCall(detail: string | null): boolean {
    this.endCalls.push(detail);
    return true;
  }

  resumeCall(): boolean {
    this.resumes += 1;
    return true;
  }

  requestRoute(route: CallRoute): boolean {
    this.routes.push(route);
    return true;
  }

  updateCallNotification(text: string): boolean {
    this.notifications.push(text);
    return true;
  }

  subscribe(listener: (event: CallLifecycleEvent) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }

  get subscribed(): boolean {
    return this.listener !== null;
  }

  emit(event: CallLifecycleEvent): void {
    this.listener?.(event);
  }
}
