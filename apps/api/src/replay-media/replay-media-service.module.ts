import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { HttpSecurityModule } from '../http-security/http-security.module';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import { replayDatabaseFrom, type ReplayDatabase } from './replay-database';
import { REPLAY_DATABASE, TRANSIENT_AUDIO_STORE, TRANSIENT_STREAM_TIMING } from './replay-tokens';
import { S3TransientAudioStore, type TransientAudioStore } from './transient-audio.store';
import { ReplayHealthController, TRANSIENT_STREAM_REPORTS, TransientMediaController } from './transient-media.controller';
import { TransientMediaRepository } from './transient-media.repository';
import { TransientPlaybackService } from './transient-playback.service';
import { streamTimingFrom } from './transient-stream';

/**
 * S8B-07 CP1-B step 3 (INFRA-07 P-1, contract §17.1) — the Replay Media Service: the HTTP half of the Replay pool, loaded
 * only by `replay-media-service.main.ts` under `QANDEEL_COMPUTE_ROLE = REPLAY_MEDIA`. It imports no API module: no Voice
 * Gateway, no Redis, no PostgREST service-role channel, no provider, no ffmpeg. It reaches PostgreSQL only as the Replay
 * role, and the store only through the Replay pool's own client. The API's AppModule never imports it (V-33, proven
 * statically by replay-module-graph.spec.ts).
 *
 * Every answer of the service is `Cache-Control: no-store, private` (V-16), a refusal too: the header is set before the
 * bearer check runs, so a 401 from the guard carries it as well as the routes' own answers. The same global request rate
 * limit as the API bounds every route (PROD-SEC-01 SEC-A: the one route census classifies them).
 */
@Module({
  imports: [HttpSecurityModule],
  controllers: [TransientMediaController, ReplayHealthController],
  providers: [
    CorrelationService,
    TelemetryService,
    SupabaseAuthService,
    SupabaseAuthGuard,
    { provide: REPLAY_DATABASE, useFactory: () => replayDatabaseFrom(process.env) },
    { provide: TRANSIENT_AUDIO_STORE, useFactory: () => new S3TransientAudioStore(process.env) },
    { provide: TRANSIENT_STREAM_TIMING, useFactory: () => streamTimingFrom(process.env) },
    { provide: TRANSIENT_STREAM_REPORTS, useValue: null },
    { provide: TransientMediaRepository, useFactory: (db: ReplayDatabase) => new TransientMediaRepository(db), inject: [REPLAY_DATABASE] },
    {
      provide: TransientPlaybackService,
      useFactory: (repository: TransientMediaRepository, store: TransientAudioStore, telemetry: TelemetryService) =>
        new TransientPlaybackService(repository, store, telemetry),
      inject: [TransientMediaRepository, TRANSIENT_AUDIO_STORE, TelemetryService],
    },
  ],
})
export class ReplayMediaServiceModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply((_request: IncomingMessage, response: ServerResponse, next: () => void) => {
      response.setHeader('Cache-Control', 'no-store, private');
      next();
    }).forRoutes('{*splat}');
  }
}
