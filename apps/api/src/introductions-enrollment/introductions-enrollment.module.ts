import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { IntroductionsEnrollmentController } from './introductions-enrollment.controller';
import { IntroductionsEnrollmentRepository } from './introductions-enrollment.repository';
import { IntroductionsEnrollmentService } from './introductions-enrollment.service';

/**
 * S6-07 (CP1, migration 0165) — Governed Enrollment. Composed through AccountModule, because the application root is
 * pinned. It imports no Conversation, Memory, Hypothesis, HIM, Model Router, Shared or Public module and holds no
 * service_role path: the human's own token reaches the one governed boundary and nothing else.
 */
@Module({
  controllers: [IntroductionsEnrollmentController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, IntroductionsEnrollmentRepository, IntroductionsEnrollmentService],
})
export class IntroductionsEnrollmentModule {}
