import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { IntroductionsActivityProducer } from './introductions-activity.producer';
import { IntroductionsActivityRepository } from './introductions-activity.repository';

/**
 * S6-07 (CP3, migration 0167) — the Introductions Activity producer. It has no controller and no route: its sources are
 * read on the server channel only, and it publishes through the ONE A3-01 boundary, `ActivityPublisher`, imported from
 * `ActivityModule` and never re-provided. The forward dispatcher's module binds it as that worker's notifier; it imports
 * no Conversation, Memory, Hypothesis, HIM, Model Router, Shared or Public module.
 */
@Module({
  imports: [ActivityModule],
  providers: [SupabaseServiceRoleApiService, IntroductionsActivityRepository, IntroductionsActivityProducer],
  exports: [IntroductionsActivityProducer],
})
export class IntroductionsActivityModule {}
