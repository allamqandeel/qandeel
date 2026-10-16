import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { IntroductionProposalsController } from './introduction-proposals.controller';
import { IntroductionProposalsRepository } from './introduction-proposals.repository';
import { IntroductionProposalsService } from './introduction-proposals.service';

/**
 * S6-04 - the private proposal review and decision boundary (migration 0158), and - S6-05 - the second recipient's
 * acceptance (migration 0159), which imports no Introduction World runtime either. Composed through the Account module,
 * because the application root is pinned. It imports no Shared, Public, Conversation, Model Router or Matching runtime
 * module, and it shares nothing with the S6-01 preparation or the S6-02 lifecycle module.
 */
@Module({
  controllers: [IntroductionProposalsController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, IntroductionProposalsRepository, IntroductionProposalsService],
})
export class IntroductionsProposalsModule {}
