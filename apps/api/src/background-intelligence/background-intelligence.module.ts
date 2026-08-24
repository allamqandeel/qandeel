import { Module } from '@nestjs/common';
import { BackgroundIntelligenceAuthorityService } from './background-intelligence-authority.service';
import { BackgroundIntelligenceContextFactory } from './background-intelligence-context.factory';
import { BackgroundIntelligenceDataApiService } from './background-intelligence-data-api.service';

@Module({
  providers: [BackgroundIntelligenceContextFactory, BackgroundIntelligenceDataApiService, BackgroundIntelligenceAuthorityService],
  exports: [BackgroundIntelligenceAuthorityService, BackgroundIntelligenceDataApiService],
})
export class BackgroundIntelligenceModule {}
