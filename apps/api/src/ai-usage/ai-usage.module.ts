import { Module } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { ObservabilityModule } from '../observability/observability.module';
import { AiUsageOperationsWorker } from './ai-usage-operations.worker';

/** AI-COST-01: the accounting ledger's operational visibility. It exposes no route and no provider. */
@Module({ imports: [ObservabilityModule], providers: [SupabaseServiceRoleApiService, AiUsageOperationsWorker] })
export class AiUsageModule {}
