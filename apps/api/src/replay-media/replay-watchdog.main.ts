import '../observability/instrumentation';
import { NestFactory } from '@nestjs/core';
import { REPLAY_DATABASE, TRANSIENT_AUDIO_STORE } from './replay-tokens';
import { assertReplayPoolProcess, startupRefusalText } from './replay-compute-role';
import type { ReplayDatabase } from './replay-database';
import { ReplayWatchdogModule } from './replay-watchdog.module';
import { ReplayWatchdogService } from './replay-watchdog.service';
import type { TransientAudioStore } from './transient-audio.store';

/**
 * S8B-07 CP1-B — the independent Replay watchdog's entry point (`npm run start:replay-watchdog --workspace
 * @qandeel/api`): ONE run, then exit; an external scheduler starts it every 60 s. It refuses to start unless the role
 * is REPLAY_WATCHDOG, the placement REPLAY_POOL and the database session the Replay role with its limits (V-36 (1)).
 */
async function bootstrap(): Promise<void> {
  assertReplayPoolProcess('REPLAY_WATCHDOG', process.env);
  const app = await NestFactory.createApplicationContext(ReplayWatchdogModule, { logger: ['error', 'warn'] });
  const db = app.get<ReplayDatabase>(REPLAY_DATABASE);
  try {
    await ReplayWatchdogService.preflight(db, app.get<TransientAudioStore>(TRANSIENT_AUDIO_STORE));
    await app.get(ReplayWatchdogService).runOnce();
  } finally {
    await db.close();
    await app.close();
  }
}

bootstrap().catch((error: unknown) => {
  process.stderr.write(`replay watchdog refused to run: ${startupRefusalText(error)}\n`);
  process.exitCode = 1;
});
