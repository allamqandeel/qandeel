import { Inject, Injectable, Optional, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { TelemetryService } from '../observability/telemetry.service';
import { PostResponseIntelligenceDispatcherService } from './post-response-intelligence-dispatcher.service';
import { POST_RESPONSE_REDIS_CONSUMER, type PostResponseRedisConsumer } from './post-response-intelligence.types';

@Injectable()
export class PostResponseIntelligenceConsumerService implements OnModuleInit, OnModuleDestroy {
  private stopped = false;
  private task: Promise<void> | undefined;
  constructor(@Inject(POST_RESPONSE_REDIS_CONSUMER) private readonly redis: PostResponseRedisConsumer, private readonly dispatcher: PostResponseIntelligenceDispatcherService,@Optional()private readonly telemetry?:TelemetryService) {}
  onModuleInit(): void { if (this.redis.enabled && process.env.NODE_ENV !== 'test') this.task = this.run(); }
  async onModuleDestroy(): Promise<void> { this.stopped = true; await this.redis.close(); await this.task?.catch(() => undefined); }
  private async run(): Promise<void> {
    try {
      await this.redis.connect();
      this.telemetry?.recordPostResponseDispatch('connect','success');
      while (!this.stopped) {
        await this.cycle();
      }
    } catch { this.telemetry?.recordPostResponseDispatch('connect','failure'); /* Redis unavailability never blocks API startup or a foreground response. */ }
  }
  private async cycle(): Promise<void> {
    const entries = [...await this.redis.reclaim(), ...await this.redis.read()];
    this.telemetry?.recordPostResponseDispatch('reclaim','success');this.telemetry?.recordPostResponseDispatch('read','success');
    for (const entry of entries) {
      try { if (await this.dispatcher.dispatch(entry.envelope)){this.telemetry?.recordPostResponseDispatch('event','terminal');await this.redis.ack(entry.id);this.telemetry?.recordPostResponseDispatch('ack','success');} }
      catch { /* The pending entry is left for bounded reclaim after a transient failure. */ }
    }
  }
}
