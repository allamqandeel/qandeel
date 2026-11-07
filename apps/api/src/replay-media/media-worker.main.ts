import '../observability/instrumentation';
import { NestFactory } from '@nestjs/core';
import { MediaWorkerModule } from './media-worker.module';
import { REPLAY_DATABASE, TRANSIENT_AUDIO_STORE } from './replay-tokens';
import { MediaWorkerService } from './media-worker.service';
import { assertReplayPoolProcess, startupRefusalText } from './replay-compute-role';
import type { ReplayDatabase } from './replay-database';
import { ffmpegBinariesFrom } from './replay-ffmpeg';
import type { TransientAudioStore } from './transient-audio.store';

/**
 * S8B-07 CP1-B — the media worker's entry point (`npm run start:replay-media-worker --workspace @qandeel/api`).
 * It refuses to start unless the process is the Replay pool (role REPLAY_MEDIA, placement REPLAY_POOL), the database
 * session is the Replay role with its approved limits, the store is configured and ffmpeg is the pinned 9.0.2 (V-28).
 */
async function bootstrap(): Promise<void> {
  assertReplayPoolProcess('REPLAY_MEDIA', process.env);
  const app = await NestFactory.createApplicationContext(MediaWorkerModule, { logger: ['error', 'warn'] });
  app.enableShutdownHooks();
  const db = app.get<ReplayDatabase>(REPLAY_DATABASE);
  await MediaWorkerService.preflight(db, app.get<TransientAudioStore>(TRANSIENT_AUDIO_STORE), ffmpegBinariesFrom(process.env));
  const worker = app.get(MediaWorkerService);
  await worker.start();
  const shutdown = () => {
    void worker.stop().then(() => db.close()).finally(() => app.close());
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

bootstrap().catch((error: unknown) => {
  // Only a start-up refusal's own message (it names the failed check, never a value) is printed.
  process.stderr.write(`replay media worker refused to start: ${startupRefusalText(error)}\n`);
  process.exitCode = 1;
});
