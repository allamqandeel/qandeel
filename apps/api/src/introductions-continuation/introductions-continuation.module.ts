import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { IntroductionContinuationController } from './introduction-continuation.controller';
import { IntroductionContinuationRepository } from './introduction-continuation.repository';
import { IntroductionContinuationService } from './introduction-continuation.service';

/** S6-06 (CP1, migration 0163) — SUCCESS and post-Introduction reactivation. Composed through AccountModule. */
@Module({
  controllers: [IntroductionContinuationController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, IntroductionContinuationRepository, IntroductionContinuationService],
})
export class IntroductionsContinuationModule {}
