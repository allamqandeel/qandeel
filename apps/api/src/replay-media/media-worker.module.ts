import { Module } from '@nestjs/common';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import { MediaWorkerService, mediaWorkerOptionsFrom } from './media-worker.service';
import { replayDatabaseFrom, type ReplayDatabase } from './replay-database';
import { ffmpegBinariesFrom } from './replay-ffmpeg';
import { S3TransientAudioStore, type TransientAudioStore } from './transient-audio.store';
import { REPLAY_DATABASE, TRANSIENT_AUDIO_STORE } from './replay-tokens';
import { TransientMediaRepository } from './transient-media.repository';

/**
 * S8B-07 CP1-B (INFRA-07, contract §17.1) — the media worker's module: an application context with NO HTTP, loaded
 * only by `media-worker.main.ts` under `QANDEEL_COMPUTE_ROLE = REPLAY_MEDIA`. It imports no API module: no Voice
 * Gateway, no Redis, no PostgREST channel, no provider. The API's AppModule never imports this module (V-33, proven
 * statically by replay-module-graph.spec.ts).
 */
@Module({
  providers: [
    CorrelationService,
    TelemetryService,
    { provide: REPLAY_DATABASE, useFactory: () => replayDatabaseFrom(process.env) },
    { provide: TRANSIENT_AUDIO_STORE, useFactory: () => new S3TransientAudioStore(process.env) },
    { provide: TransientMediaRepository, useFactory: (db: ReplayDatabase) => new TransientMediaRepository(db), inject: [REPLAY_DATABASE] },
    {
      provide: MediaWorkerService,
      useFactory: (repository: TransientMediaRepository, store: TransientAudioStore, telemetry: TelemetryService) =>
        new MediaWorkerService(repository, store, ffmpegBinariesFrom(process.env), mediaWorkerOptionsFrom(process.env), telemetry),
      inject: [TransientMediaRepository, TRANSIENT_AUDIO_STORE, TelemetryService],
    },
  ],
})
export class MediaWorkerModule {}
