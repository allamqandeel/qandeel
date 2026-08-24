import { Module } from '@nestjs/common';
import { BackgroundIntelligenceAuthorityService } from './background-intelligence-authority.service';
import { BackgroundIntelligenceContextFactory } from './background-intelligence-context.factory';
import { BackgroundIntelligenceDataApiService } from './background-intelligence-data-api.service';
import { BACKGROUND_INTELLIGENCE_DATA_API } from './background-intelligence.types';

@Module({
  providers: [BackgroundIntelligenceContextFactory, { provide: BACKGROUND_INTELLIGENCE_DATA_API, useClass: BackgroundIntelligenceDataApiService }, BackgroundIntelligenceAuthorityService],
  exports: [BackgroundIntelligenceAuthorityService],
})
export class BackgroundIntelligenceModule {}
