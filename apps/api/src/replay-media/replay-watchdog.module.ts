import { Module } from '@nestjs/common';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import { REPLAY_DATABASE, TRANSIENT_AUDIO_STORE } from './replay-tokens';
import { replayDatabaseFrom, type ReplayDatabase } from './replay-database';
import { ReplayWatchdogService } from './replay-watchdog.service';
import { S3TransientAudioStore, type TransientAudioStore } from './transient-audio.store';
import { TransientMediaRepository } from './transient-media.repository';

/**
 * S8B-07 CP1-B (P-4 as approved, contract §18.2) — the independent watchdog's module, loaded only by
 * `replay-watchdog.main.ts` under `QANDEEL_COMPUTE_ROLE = REPLAY_WATCHDOG`. No ffmpeg, no mix, no HTTP, no API module.
 */
@Module({
  providers: [
    CorrelationService,
    TelemetryService,
    { provide: REPLAY_DATABASE, useFactory: () => replayDatabaseFrom(process.env) },
    { provide: TRANSIENT_AUDIO_STORE, useFactory: () => new S3TransientAudioStore(process.env) },
    { provide: TransientMediaRepository, useFactory: (db: ReplayDatabase) => new TransientMediaRepository(db), inject: [REPLAY_DATABASE] },
    {
      provide: ReplayWatchdogService,
      useFactory: (repository: TransientMediaRepository, store: TransientAudioStore, telemetry: TelemetryService) =>
        new ReplayWatchdogService(repository, store, telemetry),
      inject: [TransientMediaRepository, TRANSIENT_AUDIO_STORE, TelemetryService],
    },
  ],
})
export class ReplayWatchdogModule {}
