import '../observability/instrumentation';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { parseProxyConfiguration } from '../http-security/client-address';
import { configureHttpSecurity } from '../http-security/http-security';
import { assertReplayPoolProcess, startupRefusalText } from './replay-compute-role';
import type { ReplayDatabase } from './replay-database';
import { ReplayMediaServiceModule } from './replay-media-service.module';
import { REPLAY_DATABASE, TRANSIENT_AUDIO_STORE } from './replay-tokens';
import type { TransientAudioStore } from './transient-audio.store';
import { TransientPlaybackService } from './transient-playback.service';

/**
 * S8B-07 CP1-B step 3 — the Replay Media Service's entry point (`npm run start:replay-media-service --workspace
 * @qandeel/api`): the five listening / Replay playback routes and `/health`, on the Replay pool only (INFRA-07 P-1).
 * It refuses to start unless the process is the Replay pool (role REPLAY_MEDIA, placement REPLAY_POOL), the database
 * session is the Replay role itself with its approved limits, the store is configured and the bearer check is (V-28).
 * The same HTTP boundary as the API (trust proxy from the parsed topology, Helmet); no service-role credential is read.
 */
async function bootstrap(): Promise<void> {
  assertReplayPoolProcess('REPLAY_MEDIA', process.env);
  const proxy = parseProxyConfiguration(process.env);
  const app = await NestFactory.create<NestExpressApplication>(ReplayMediaServiceModule, { logger: ['error', 'warn'] });
  configureHttpSecurity(app, proxy);
  const db = app.get<ReplayDatabase>(REPLAY_DATABASE);
  await TransientPlaybackService.preflight(db, app.get<TransientAudioStore>(TRANSIENT_AUDIO_STORE), process.env).catch(async (error: unknown) => {
    await db.close().catch(() => undefined);
    await app.close().catch(() => undefined);
    throw error;
  });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

bootstrap().catch((error: unknown) => {
  // Only a start-up refusal's own message (it names the failed check, never a value) is printed.
  process.stderr.write(`replay media service refused to start: ${startupRefusalText(error)}\n`);
  process.exitCode = 1;
});
