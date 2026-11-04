/**
 * S8B-06 CP2 — ONE live call on the phone, from the person's Start to its one end: the platform call (Android Core-Telecom
 * with its foreground service and notification, iOS CallKit; {@link CallPlatform}), the audio engine and the protocol
 * session (CP1's {@link LiveCallSession}, reused as is) joined by one end latch. In memory only; nothing persists.
 *
 *   - **One call.** A controller runs one call and is never restarted; the platform refuses a second call
 *     (ALREADY_IN_CALL) before any socket opens or any microphone starts, so a refused start leaks nothing.
 *   - **Order.** The platform call first (it must start in the foreground), then the socket; the engine starts inside the
 *     ACTIVE platform call on the server's first STATE (`audioOwner: PLATFORM_CALL`).
 *   - **One end, every source.** The person's End, the notification's End, the system (Telecom / CallKit, a Bluetooth or car
 *     button, another call), a microphone or engine failure, the service or the task going away, the server (STATE ENDED,
 *     FENCED, a refusal) and the reconnect grace passing all close the SAME latch; the first wins, the rest are counted.
 *     A local end stops the microphone at once (the platform's end stops the engine natively) and sends END, then waits
 *     at most `serverEndWaitMs` for the server's verdict. A server end ends the platform call.
 *   - **Server authority is final.** The outcome's `reason` is the server's when it gave one (`serverConfirmed`); a call
 *     whose server never confirmed (the grace passed, the wait ran out) says so, never "completed".
 *   - **Three different things.** A HOLD (another call took the audio: a real microphone release, a MUTED gap) is not a
 *     link loss (LOST, reconnecting within the 30 s grace, the audio still running) and neither is an end.
 *   - The notification's line follows the call: held, reconnecting, the warning due, or the ongoing line.
 *   - **Timers that survive the background.** Android pauses JS timers in the background; every timer of the call
 *     (the client's heartbeat and reconnect backoff, the server-verdict wait) is also fired by the native engine's events
 *     ({@link NativePacedTimers}), so a held call keeps its link and a lost link reconnects with the screen locked.
 *
 * Nothing here logs, stores or inspects audio or words.
 */
import { CallEndingWarning } from './call-ending-warning';
import type { LiveCallEnd, LiveCallTimers } from './live-call-client';
import type { LiveCallSurfaceCopy } from './live-call-copy';
import { LiveCallSession, type LiveCallSessionEvent, type LiveCallSessionOptions } from './live-call-session';
import { NativePacedTimers } from './native-paced-timers';
import type { CallEndSource, CallLifecycleEvent, CallPlatform, EngineStartOptions, VoiceCallEngine } from './voice-call-engine';

export type LiveCallPhase = 'IDLE' | 'STARTING' | 'ACTIVE' | 'ENDING' | 'ENDED';

/** Who closed the latch. */
export type LiveCallEndOrigin = 'PERSON' | 'PLATFORM' | 'SERVER' | 'START_FAILED';

export interface LiveCallOutcome {
  readonly origin: LiveCallEndOrigin;
  /** The platform source (NOTIFICATION, SYSTEM, MICROPHONE…) when the platform ended it. */
  readonly platformSource: CallEndSource | null;
  /** The server's reason when it gave one; otherwise the local code (a start failure, LOST, NO_SERVER_VERDICT). */
  readonly reason: LiveCallEnd | string;
  readonly serverConfirmed: boolean;
}

export type LiveCallControllerEvent =
  | { readonly type: 'phase'; readonly phase: LiveCallPhase }
  | { readonly type: 'held'; readonly held: boolean }
  | { readonly type: 'reconnecting'; readonly reconnecting: boolean }
  | { readonly type: 'warning'; readonly kind: 'T5' | 'T1'; readonly phase: string }
  | { readonly type: 'notification'; readonly text: string }
  | { readonly type: 'ended'; readonly outcome: LiveCallOutcome }
  | { readonly type: 'session'; readonly event: LiveCallSessionEvent }
  | { readonly type: 'platform'; readonly event: CallLifecycleEvent };

export interface LiveCallControllerOptions {
  readonly platform: CallPlatform;
  readonly engine: VoiceCallEngine;
  readonly session: Omit<LiveCallSessionOptions, 'engine' | 'engineOptions' | 'onEvent' | 'timers'>;
  readonly engineOptions: Omit<EngineStartOptions, 'audioOwner'>;
  readonly copy: LiveCallSurfaceCopy;
  readonly timers?: LiveCallTimers;
  readonly onEvent?: (event: LiveCallControllerEvent) => void;
  /** How long a local end waits for the server's STATE ENDED before the call is closed without it. */
  readonly serverEndWaitMs?: number;
}

const DEFAULT_SERVER_END_WAIT_MS = 5000;

const defaultTimers: LiveCallTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
  now: () => Date.now(),
};

export class LiveCallStartError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export class LiveCallController {
  phase: LiveCallPhase = 'IDLE';
  outcome: LiveCallOutcome | null = null;
  session: LiveCallSession | null = null;
  readonly warning: CallEndingWarning;
  /** Ends and late callbacks that arrived after the latch closed (content-free). */
  ignoredLate = 0;
  private readonly timers: NativePacedTimers;
  private unsubscribePlatform: (() => void) | null = null;
  private endRequestedDuringStart = false;
  private pendingOrigin: { origin: LiveCallEndOrigin; platformSource: CallEndSource | null } | null = null;
  private serverWait: unknown = null;
  private held = false;
  private reconnecting = false;
  private notificationText: string;

  constructor(private readonly options: LiveCallControllerOptions) {
    this.timers = new NativePacedTimers(options.timers ?? defaultTimers);
    this.notificationText = options.copy.ongoing;
    const engine = options.engine;
    this.warning = new CallEndingWarning(
      {
        playCue: (id, kind, force, text) => engine.playCue?.(id, kind, force, text) ?? 'NOT_RUNNING',
        scheduleCue: (id, kind, due, force, text) => engine.scheduleCue?.(id, kind, due, force, text) ?? 'NOT_RUNNING',
      },
      options.copy,
    );
  }

  /** Starts the one call. Rejects with a {@link LiveCallStartError} code; a refused start opens nothing. */
  async start(): Promise<void> {
    if (this.phase !== 'IDLE') throw new LiveCallStartError('ALREADY_STARTED');
    const { platform, copy } = this.options;
    const capability = platform.capability();
    if (!capability.supported) return this.refuse(capability.reason ?? 'UNSUPPORTED');
    if (!capability.microphoneGranted) return this.refuse('MIC_PERMISSION_DENIED');
    if (capability.inCall) return this.refuse('ALREADY_IN_CALL');
    this.setPhase('STARTING');
    this.unsubscribePlatform = platform.subscribe((event) => this.onPlatform(event));
    try {
      await platform.startCall({
        callId: this.options.session.callId,
        displayName: copy.displayName,
        notificationTitle: copy.notificationTitle,
        notificationText: copy.ongoing,
        channelName: copy.channelName,
        route: this.options.engineOptions.route,
      });
    } catch (error) {
      const code = (error as { code?: string })?.code ?? 'CALL_START_FAILED';
      return this.refuse(code);
    }
    if (this.endRequestedDuringStart || this.currentPhase() !== 'STARTING') {
      // The person ended (or the platform ended) while the platform was still starting: nothing more opens.
      platform.endCall('ENDED_DURING_START');
      this.close({ origin: this.pendingOrigin?.origin ?? 'PERSON', platformSource: this.pendingOrigin?.platformSource ?? null, reason: 'ENDED_DURING_START', serverConfirmed: false });
      return;
    }
    this.session = new LiveCallSession({
      ...this.options.session,
      timers: this.timers,
      engine: this.options.engine,
      engineOptions: { ...this.options.engineOptions, audioOwner: 'PLATFORM_CALL' },
      onEvent: (event) => this.onSession(event),
    });
    this.setPhase('ACTIVE');
    this.session.start();
  }

  /** The person's End. Idempotent; the first end from any source wins. */
  end(): void {
    if (this.phase === 'STARTING') {
      this.endRequestedDuringStart = true;
      this.pendingOrigin = { origin: 'PERSON', platformSource: null };
      return;
    }
    if (this.phase !== 'ACTIVE') {
      this.ignoredLate += 1;
      return;
    }
    this.beginLocalEnd('PERSON', null);
  }

  setMuted(muted: boolean): boolean {
    return this.session?.setMuted(muted) ?? false;
  }

  // ------------------------------------------------------------------ S8B-06 CP3: what the call UI reads and asks

  /** Another call holds the audio (the platform's HELD), as the platform last said. */
  get isHeld(): boolean {
    return this.held;
  }

  /** The link is lost and the client is reconnecting inside the grace. */
  get isReconnecting(): boolean {
    return this.reconnecting;
  }

  /** The person's (or the system's) mute, as sent to the server. */
  get isMuted(): boolean {
    return this.session?.isPersonMuted === true;
  }

  /** The person's route choice; the platform owns the route and answers with ENDPOINT. False when there is no call. */
  requestRoute(route: 'EARPIECE' | 'SPEAKER'): boolean {
    if (this.phase !== 'ACTIVE') return false;
    return this.options.platform.requestRoute(route);
  }

  /** QANDEEL's voice is being heard now (the engine's heard marks). */
  get isQandeelAudible(): boolean {
    return this.session?.isQandeelAudible === true;
  }

  /**
   * A message typed during the call (D-05-07 T1): its msgId, or null when the call cannot carry it now — not ACTIVE on the
   * server yet (TEXT_TURN exists only in an ACTIVE call), or no longer there. A message sent while the link is lost waits
   * in the client's log and goes out after the resume.
   */
  sendText(clientTurnId: string, text: string): number | null {
    if (this.phase !== 'ACTIVE' || this.session === null || this.session.client.callState !== 'ACTIVE') return null;
    return this.session.sendText(clientTurnId, text);
  }

  // ------------------------------------------------------------------ sources

  private onPlatform(event: CallLifecycleEvent): void {
    this.timers.pump();
    this.emit({ type: 'platform', event });
    if (event.callId !== this.options.session.callId) return;
    switch (event.type) {
      case 'HELD':
        this.held = true;
        this.emit({ type: 'held', held: true });
        this.refreshNotification();
        return;
      case 'RESUMED':
        this.held = false;
        this.emit({ type: 'held', held: false });
        this.refreshNotification();
        return;
      case 'ENDED':
        if (event.source === 'APP') return; // our own endCall, already latched
        if (this.phase === 'STARTING') {
          this.endRequestedDuringStart = true;
          this.pendingOrigin = { origin: 'PLATFORM', platformSource: event.source };
          return;
        }
        if (this.phase !== 'ACTIVE') {
          this.ignoredLate += 1;
          return;
        }
        // The platform already stopped the engine and the platform call; tell the server, wait for its verdict.
        this.beginLocalEnd('PLATFORM', event.source, false);
        return;
      case 'SYSTEM_MUTE':
        // The system's mute (CallKit's button, a headset or car, Telecom) is the person's mute: the same MUTE / UNMUTE.
        if (this.phase === 'ACTIVE') this.session?.setMuted(event.muted);
        return;
      default:
    }
  }

  private onSession(event: LiveCallSessionEvent): void {
    // A native engine event (at least the 250 ms tick) reaches JS even when JS timers are paused.
    if (event.source === 'engine') this.timers.pump();
    this.emit({ type: 'session', event });
    if (event.source === 'client') {
      const e = event.event;
      switch (e.type) {
        case 'connection':
          if (e.phase === 'LOST' && !this.reconnecting && this.phase === 'ACTIVE') {
            this.reconnecting = true;
            this.emit({ type: 'reconnecting', reconnecting: true });
            this.refreshNotification();
          }
          return;
        case 'state':
          if (this.reconnecting && e.message.state !== 'ENDED') {
            this.reconnecting = false;
            this.emit({ type: 'reconnecting', reconnecting: false });
            this.refreshNotification();
          }
          if (e.message.state !== 'ENDED') this.warning.onState(e.message.endsAt, this.timers.now());
          return;
        case 'callEnding':
          this.warning.onCallEnding(e.endsInMs);
          this.refreshNotification();
          return;
        case 'ended':
          this.onServerEnded(e.reason);
          return;
        default:
          return;
      }
    }
    if (event.source === 'session') {
      // The session already sent END; the latch records the platform-side cause.
      if (event.event.type === 'engineStartFailed' && this.phase === 'ACTIVE') this.beginLocalEnd('PLATFORM', 'ENGINE');
      if (event.event.type === 'holdBeforeActive' && this.phase === 'ACTIVE') this.beginLocalEnd('PLATFORM', 'SYSTEM');
      return;
    }
    if (event.source === 'engine') {
      const e = event.event;
      if (e.type === 'engineState' && e.state === 'RUNNING') this.warning.onEngineRunning(this.timers.now());
      if (e.type === 'cue') {
        this.warning.onCue(e.event, e.id);
        if (e.id === 'T5' || e.id === 'T1') this.emit({ type: 'warning', kind: e.id, phase: this.warning.phase[e.id] });
        this.refreshNotification();
      }
    }
  }

  // ------------------------------------------------------------------ the latch

  private beginLocalEnd(origin: LiveCallEndOrigin, platformSource: CallEndSource | null, endPlatform = true): void {
    this.setPhase('ENDING');
    this.pendingOrigin = { origin, platformSource };
    // The microphone stops now: the platform's end stops the engine natively (STOP_AUDIO), whatever the server does.
    if (endPlatform) this.options.platform.endCall(origin === 'PERSON' ? 'PERSON' : null);
    this.session?.end();
    this.serverWait = this.timers.setTimeout(() => {
      this.serverWait = null;
      this.close({ origin, platformSource, reason: 'NO_SERVER_VERDICT', serverConfirmed: false });
    }, this.options.serverEndWaitMs ?? DEFAULT_SERVER_END_WAIT_MS);
  }

  private onServerEnded(reason: LiveCallEnd): void {
    if (this.phase === 'ENDED') {
      this.ignoredLate += 1;
      return;
    }
    const confirmed = reason !== 'LOST';
    if (this.phase === 'ENDING') {
      const pending = this.pendingOrigin!;
      this.close({ origin: pending.origin, platformSource: pending.platformSource, reason, serverConfirmed: confirmed });
      return;
    }
    // The server (or the grace passing) ended an ACTIVE call: the platform call ends with it.
    this.setPhase('ENDING');
    this.options.platform.endCall(`SERVER_${reason}`);
    this.close({ origin: 'SERVER', platformSource: null, reason, serverConfirmed: confirmed });
  }

  private refuse(code: string): never {
    this.close({ origin: 'START_FAILED', platformSource: null, reason: code, serverConfirmed: false });
    throw new LiveCallStartError(code);
  }

  private close(outcome: LiveCallOutcome): void {
    if (this.phase === 'ENDED') return;
    if (this.serverWait !== null) this.timers.clearTimeout(this.serverWait);
    this.serverWait = null;
    this.outcome = outcome;
    this.setPhase('ENDED');
    void this.session?.dispose();
    this.unsubscribePlatform?.();
    this.unsubscribePlatform = null;
    this.emit({ type: 'ended', outcome });
  }

  // ------------------------------------------------------------------ surface

  private refreshNotification(): void {
    if (this.phase !== 'ACTIVE') return;
    const { copy } = this.options;
    const text = this.held ? copy.held : this.reconnecting ? copy.reconnecting : (this.warning.notificationLine ?? copy.ongoing);
    if (text === this.notificationText) return;
    this.notificationText = text;
    this.options.platform.updateCallNotification(text);
    this.emit({ type: 'notification', text });
  }

  /** Read through a call: TypeScript would keep a narrowing of `phase` across the awaited start. */
  private currentPhase(): LiveCallPhase {
    return this.phase;
  }

  private setPhase(phase: LiveCallPhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.emit({ type: 'phase', phase });
  }

  private emit(event: LiveCallControllerEvent): void {
    this.options.onEvent?.(event);
  }
}
