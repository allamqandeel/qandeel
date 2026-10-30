import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { ObservabilityModule } from '../observability/observability.module';
import { PRIVATE_AUDIO_OBJECT_STORE, S3PrivateAudioObjectStore } from './private-audio-object.store';
import { VoiceMediaController } from './voice-media.controller';
import { VoiceMediaRepository } from './voice-media.repository';
import { VoiceMediaService } from './voice-media.service';
import { VoiceRecordingRecoveryWorker } from './voice-recording-recovery.worker';
import { VoiceRetentionWorker } from './voice-retention.worker';

/**
 * S8B-02 (CP2) — the voice media module: the private audio store, the owner's routes, the retention and recovery workers.
 * Composed through AccountModule like the other owner-scoped modules (the application root is pinned). It exports the
 * service to Export My Data, and the store and repository to the ONE media erasure worker (IntroductionsDisclosureModule),
 * which erases photo and voice keys from the one queue. It imports no AI runtime, provider or client code.
 */
@Module({
  imports: [ObservabilityModule],
  controllers: [VoiceMediaController],
  providers: [
    SupabaseAuthService,
    SupabaseAuthGuard,
    SupabaseServiceRoleApiService,
    VoiceMediaRepository,
    VoiceMediaService,
    VoiceRetentionWorker,
    VoiceRecordingRecoveryWorker,
    { provide: PRIVATE_AUDIO_OBJECT_STORE, useClass: S3PrivateAudioObjectStore },
  ],
  exports: [VoiceMediaService, VoiceMediaRepository, PRIVATE_AUDIO_OBJECT_STORE],
})
export class VoiceMediaModule {}
