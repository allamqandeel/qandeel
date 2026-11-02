import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseAuthService } from '../../auth/supabase-auth.service';
import { TelemetryService } from '../../observability/telemetry.service';
import { VoiceMediaService } from '../../voice-media/voice-media.service';
import { voiceWorkersEnabled } from '../../voice-media/voice-retention.worker';
import { LIVE_CALL_SPEECH_SINK, type LiveCallSpeechSink } from './live-call-speech.port';
import { LiveCallConnection, LiveCallRegistry, REAL_CLOCK, type CallClock, type CallTransport } from './live-call.connection';
import { LIVE_CALL_STORE, type CallTruth, type LiveCallStore } from './live-call.store';

/** The sweep runs this often (the shortest lapse it recovers is a 15 s connect timeout or a 20 s seat lease). */
export const LIVE_CALL_SWEEP_MS = 5000;
const SWEEP_LIMIT = 50;

/**
 * S8B-05 CP1 — the live calls this instance carries, and the call authority's recovery.
 *
 *   - `attach` gives an authenticated socket its connection (the gateway authenticates before anything is attached);
 *   - the sweep (`server_sweep_calls_v1`, SKIP LOCKED, every instance may run it) ends what lapsed with a truthful reason
 *     and seals its recording in the same transaction: a call no instance renews is never left ACTIVE, and no seat is held
 *     for ever. Off under tests and when the media store or the server channel is unconfigured, like the other voice
 *     workers;
 *   - `truth` reads call-truth from the server's state alone (0189).
 *
 * Content-free outcomes only (`VOICE_LIVE_CALL`): never a person, call, session, recording, epoch, word or byte.
 */
@Injectable()
export class LiveCallService implements OnModuleInit, OnModuleDestroy {
  readonly registry = new LiveCallRegistry();
  private readonly live = new Map<LiveCallConnection, string>();
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;

  constructor(
    @Inject(LIVE_CALL_STORE) private readonly store: LiveCallStore,
    private readonly media: VoiceMediaService,
    @Inject(LIVE_CALL_SPEECH_SINK) private readonly speech: LiveCallSpeechSink,
    private readonly auth: SupabaseAuthService,
    @Optional() private readonly telemetry?: TelemetryService,
  ) {}

  onModuleInit(): void {
    if (!voiceWorkersEnabled()) return;
    this.timer = setInterval(() => void this.sweepOnce(), LIVE_CALL_SWEEP_MS);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await Promise.all([...this.live.keys()].map((c) => c.goingAway().catch(() => undefined)));
  }

  get connectionCount(): number {
    return this.live.size;
  }

  connectionsOf(userId: string): number {
    let n = 0;
    for (const owner of this.live.values()) if (owner === userId) n += 1;
    return n;
  }

  /** The connection for one authenticated socket. `forget` must be called when the socket is gone. */
  attach(transport: CallTransport, userId: string, tokenExpiresAt: number, clock: CallClock = REAL_CLOCK, accessToken = ''): {
    connection: LiveCallConnection; forget: () => void;
  } {
    const connection = new LiveCallConnection(transport, userId, tokenExpiresAt, {
      store: this.store,
      media: this.media,
      speech: this.speech,
      authenticate: (authorization) => this.auth.authenticate(authorization),
      registry: this.registry,
      clock,
      signal: (operation, outcome) => this.signal(operation, outcome),
    }, accessToken);
    this.live.set(connection, userId);
    return { connection, forget: () => void this.live.delete(connection) };
  }

  async truth(userId: string): Promise<CallTruth> {
    try {
      return await this.store.truth(userId);
    } catch {
      this.signal('truth', 'transport_failure');
      throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' });
    }
  }

  /** One sweep. Returns how many calls it ended; never throws. */
  async sweepOnce(): Promise<number> {
    if (this.sweeping) return 0;
    this.sweeping = true;
    try {
      const ended = await this.store.sweep(SWEEP_LIMIT);
      this.signal('sweep', 'success');
      return ended;
    } catch {
      this.signal('sweep', 'transport_failure');
      return 0;
    } finally {
      this.sweeping = false;
    }
  }

  signal(operation: string, outcome: string): void {
    try {
      this.telemetry?.recordOperationalOutcome('VOICE_LIVE_CALL', operation, outcome);
    } catch {
      // Observability is best-effort.
    }
  }
}
