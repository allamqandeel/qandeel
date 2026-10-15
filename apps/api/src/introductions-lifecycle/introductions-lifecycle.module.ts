import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { IntroductionEndController } from './introduction-end.controller';
import { IntroductionEndRepository } from './introduction-end.repository';
import { IntroductionEndService } from './introduction-end.service';

/**
 * S6-02 — the Introduction lifecycle boundary: today only the unilateral END (GATE-34, migration 0155). Composed through
 * the Account module, because the application root is pinned. It imports no Shared, Public, Conversation, Model Router
 * or Matching runtime module, and it shares nothing with the S6-01 preparation module.
 */
@Module({
  controllers: [IntroductionEndController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, IntroductionEndRepository, IntroductionEndService],
})
export class IntroductionsLifecycleModule {}
