import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { IntroductionsPreparationController } from './introductions-preparation.controller';
import { IntroductionsPreparationRepository } from './introductions-preparation.repository';
import { IntroductionsPreparationService } from './introductions-preparation.service';
import { ONBOARDING_PHRASING_PORT, UnboundOnboardingPhrasing } from './onboarding-phrasing.port';

/**
 * S6-01 — the owner's Introductions preparation (CW2-06A; migration 0154). Composed through the Account module, because
 * the application root is pinned. It imports no Conversation, Memory, Hypothesis, HIM, Model Router, Shared or Public
 * module: the database reader is its only access to prior understanding, and the phrasing seam is UNBOUND.
 */
@Module({
  controllers: [IntroductionsPreparationController],
  providers: [
    SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, IntroductionsPreparationRepository, IntroductionsPreparationService,
    { provide: ONBOARDING_PHRASING_PORT, useClass: UnboundOnboardingPhrasing },
  ],
})
export class IntroductionsPreparationModule {}
