import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { ActivityPublisher } from './activity-publisher.service';
import { ActivityController } from './activity.controller';
import { ActivityRepository } from './activity.repository';
import { ActivityService } from './activity.service';

/**
 * A3-01 — the Product notification / Activity spine, composed by the application root beside the Account and
 * Understanding modules. It provides its own guard and transports exactly as they do. It exports ONE thing: the
 * server-side `ActivityPublisher`, the single boundary through which a future source domain publishes a candidate.
 *
 * It is not the HIM / HSE "attention" measurement (human-model), reads no source domain, and holds no Push transport,
 * device registration or provider (A3-02).
 */
@Module({
  controllers: [ActivityController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, SupabaseServiceRoleApiService, ActivityRepository, ActivityService, ActivityPublisher],
  exports: [ActivityPublisher],
})
export class ActivityModule {}
