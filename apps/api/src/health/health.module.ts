import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DatabaseHealthProbe } from './database-health.probe';
import { ModelProviderHealthProbe } from './model-provider-health.probe';
import { RuntimeEventsHealthProbe } from './runtime-events-health.probe';
import { ObservabilityHealthProbe } from './observability-health.probe';
import { RuntimeEventsModule } from '../runtime-events/runtime-events.module';

@Module({
  imports:[RuntimeEventsModule],controllers: [HealthController],providers:[HealthService,DatabaseHealthProbe,ModelProviderHealthProbe,RuntimeEventsHealthProbe,ObservabilityHealthProbe],
})
export class HealthModule {}
