import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { IntroductionDisclosureController } from './introduction-disclosure.controller';
import { IntroductionDisclosureRepository } from './introduction-disclosure.repository';
import { INTRODUCTION_MEDIA_STORE, IntroductionDisclosureService } from './introduction-disclosure.service';
import { IntroductionMediaErasureWorker } from './introduction-media-erasure.worker';
import { S3IntroductionMediaStore } from './introduction-media.store';

/**
 * S6-06 (CP1, migration 0162) — progressive disclosure, the three-stage photo and the full-name display consent of an
 * Introduction, with the private object store and its erasure worker. Composed through AccountModule, like every other
 * Introductions module.
 */
@Module({
  // S6-06 (CP2): the erasure worker's content-free operational outcomes (PROD-OPS-01's telemetry).
  imports: [ObservabilityModule],
  controllers: [IntroductionDisclosureController],
  providers: [
    SupabaseAuthService,
    SupabaseAuthGuard,
    SupabaseDataApiService,
    SupabaseServiceRoleApiService,
    IntroductionDisclosureRepository,
    IntroductionDisclosureService,
    IntroductionMediaErasureWorker,
    { provide: INTRODUCTION_MEDIA_STORE, useClass: S3IntroductionMediaStore },
  ],
  // S6-07 (CP4): Export My Data reads the reader's own photos through this service's own decisions (AccountModule).
  exports: [IntroductionDisclosureService],
})
export class IntroductionsDisclosureModule {}
