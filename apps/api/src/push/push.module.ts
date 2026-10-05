import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { ObservabilityModule } from '../observability/observability.module';
import { PushDispatcherWorker } from './push-dispatcher.worker';
import { PushController } from './push.controller';
import { PushRepository } from './push.repository';
import { PushService } from './push.service';

/**
 * A3-02 — Native Push, Permission & Platform Delivery (QAN-BL-NOTIF-01), composed beside the A3-01 Activity module. It
 * owns the device boundary (registration, token lifecycle, detach, per-device open evidence) and the server-only
 * dispatcher that delivers ELIGIBLE A3-01 items to the platforms' own push services. It holds no notification model of
 * its own (A3-01's projection is the one), exports nothing, and no route of it sends.
 */
@Module({
  imports: [ObservabilityModule],
  controllers: [PushController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, SupabaseServiceRoleApiService, PushRepository, PushService, PushDispatcherWorker],
})
export class PushModule {}
