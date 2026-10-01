import { Inject, Injectable, Optional, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { TelemetryService } from '../observability/telemetry.service';
import { runWithAiUsageAttribution, type AiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import { PostResponseIntelligenceDispatcherService } from './post-response-intelligence-dispatcher.service';
import { POST_RESPONSE_REDIS_CONSUMER, type PostResponseRedisConsumer } from './post-response-intelligence.types';

@Injectable()
export class PostResponseIntelligenceConsumerService implements OnModuleInit, OnModuleDestroy {
  private stopped = false;
  private task: Promise<void> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private resumeRetry: (() => void) | undefined;
  private readonly retryDelayMs = boundedRetryDelay(process.env.POST_RESPONSE_REDIS_RETRY_MS);
  constructor(@Inject(POST_RESPONSE_REDIS_CONSUMER) private readonly redis: PostResponseRedisConsumer, private readonly dispatcher: PostResponseIntelligenceDispatcherService,@Optional()private readonly telemetry?:TelemetryService) {}
  onModuleInit(): void { if (this.redis.enabled && process.env.NODE_ENV !== 'test') this.task = this.run(); }
  async onModuleDestroy(): Promise<void> { this.stopped = true; this.interruptRetry(); await this.redis.close().catch(() => undefined); await this.task?.catch(() => undefined); await this.redis.close().catch(() => undefined); }
  private async run(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.redis.connect();
        this.telemetry?.recordPostResponseDispatch('connect','success');
        if (this.stopped) break;
        while (!this.stopped) await this.cycle();
      } catch {
        this.telemetry?.recordPostResponseDispatch('connect','failure');
        await this.redis.close().catch(() => undefined);
        if (!this.stopped) await this.waitForRetry();
      }
    }
  }
  private async cycle(): Promise<void> {
    const entries = [...await this.redis.reclaim(), ...await this.redis.read()];
    this.telemetry?.recordPostResponseDispatch('reclaim','success');this.telemetry?.recordPostResponseDispatch('read','success');
    for (const entry of entries) {
      try { if (await withPostResponseAiUsageAttribution(entry.envelope, () => this.dispatcher.dispatch(entry.envelope))){this.telemetry?.recordPostResponseDispatch('event','terminal');await this.redis.ack(entry.id);this.telemetry?.recordPostResponseDispatch('ack','success');} }
      catch { /* The pending entry is left for bounded reclaim after a transient failure. */ }
    }
  }
  private waitForRetry(): Promise<void> { return new Promise(resolve => { this.resumeRetry = resolve; this.retryTimer = setTimeout(() => this.interruptRetry(), this.retryDelayMs); }); }
  private interruptRetry(): void { if (this.retryTimer) clearTimeout(this.retryTimer); this.retryTimer = undefined; const resume = this.resumeRetry; this.resumeRetry = undefined; resume?.(); }
}

/**
 * AI-COST-01: the post-response provider attempts of one delivery are charged to the event's subject. The dispatcher
 * reaches a provider only after the canonical authority has verified that exact subject owns the session and turn, and
 * the ledger's begin command checks the session and turn against the account again; an envelope that names no valid
 * subject opens no scope, so any provider attempt it could reach is refused before it starts.
 */
export function withPostResponseAiUsageAttribution<T>(envelope: string, work: () => Promise<T>): Promise<T> {
  let attribution: AiUsageAttribution | undefined;
  try {
    const event = JSON.parse(envelope) as { subject_user_id?: unknown; subject_session_id?: unknown; subject_turn_id?: unknown; payload?: { processing_path?: unknown } };
    const path = event?.payload?.processing_path;
    // The identities are validated by runWithAiUsageAttribution itself, which opens no scope for a non-UUID value.
    if (typeof event?.subject_user_id === 'string' && typeof event.subject_session_id === 'string' && typeof event.subject_turn_id === 'string') {
      attribution = {
        userId: event.subject_user_id, sessionId: event.subject_session_id, sourceTurnId: event.subject_turn_id,
        ...(path === 'FAST' || path === 'DEEP' ? { processingPath: path } : {}),
      };
    }
  } catch {
    attribution = undefined;
  }
  return attribution ? runWithAiUsageAttribution(attribution, work) : work();
}

function boundedRetryDelay(value:string|undefined):number{const parsed=Number(value);return Number.isFinite(parsed)?Math.min(30_000,Math.max(100,Math.trunc(parsed))):1_000;}
