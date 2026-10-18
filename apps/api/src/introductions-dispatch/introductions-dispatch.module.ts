import { Module } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { IntroductionsActivityModule } from '../introductions-activity/introductions-activity.module';
import { IntroductionsActivityProducer } from '../introductions-activity/introductions-activity.producer';
import { ObservabilityModule } from '../observability/observability.module';
import { IntroductionsForwardDispatchRepository } from './introductions-forward-dispatch.repository';
import { INTRODUCTIONS_DELIVERY_NOTIFIER, IntroductionsForwardDispatcherWorker } from './introductions-forward-dispatcher.worker';

/**
 * S6-07 (CP2, migration 0166, CA-SYS-02) — the forward dispatcher's server pass. Composed through AccountModule, because
 * the application root is pinned, like every other Introductions module. It has NO controller and no route: the one
 * database dispatcher is reached on the server channel only, never with a client token. It imports no Conversation,
 * Memory, Hypothesis, HIM, Model Router, Shared or Public module.
 *
 * S6-07 (CP3, migration 0167) binds the Introductions Activity producer (its own module) as the worker's notifier; this
 * module itself still reaches no Activity or Push code.
 */
@Module({
  imports: [ObservabilityModule, IntroductionsActivityModule],
  providers: [SupabaseServiceRoleApiService, IntroductionsForwardDispatchRepository, IntroductionsForwardDispatcherWorker,
    { provide: INTRODUCTIONS_DELIVERY_NOTIFIER, useExisting: IntroductionsActivityProducer }],
})
export class IntroductionsDispatchModule {}
