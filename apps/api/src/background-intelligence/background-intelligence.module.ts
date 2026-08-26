import { Module } from '@nestjs/common';
import { BackgroundIntelligenceAuthorityService } from './background-intelligence-authority.service';
import { BackgroundIntelligenceContextFactory } from './background-intelligence-context.factory';
import { BackgroundIntelligenceDataApiService } from './background-intelligence-data-api.service';
import { BACKGROUND_INTELLIGENCE_DATA_API } from './background-intelligence.types';
import { MemoryWriteEvaluatorService } from '../memory/memory-write-evaluator.service';
import { HimReasoningConsumptionService } from '../human-model/him-reasoning-consumption.service';
import { HypothesisGenerationTriggerClassificationService } from '../hypothesis/hypothesis-generation-trigger-classification.service';
import { BackgroundIntelligenceEnrichmentService } from './background-intelligence-enrichment.service';

@Module({
  providers: [BackgroundIntelligenceContextFactory, { provide: BACKGROUND_INTELLIGENCE_DATA_API, useClass: BackgroundIntelligenceDataApiService }, MemoryWriteEvaluatorService, HimReasoningConsumptionService, HypothesisGenerationTriggerClassificationService, BackgroundIntelligenceAuthorityService, BackgroundIntelligenceEnrichmentService],
  exports: [BackgroundIntelligenceAuthorityService, BackgroundIntelligenceEnrichmentService],
})
export class BackgroundIntelligenceModule {}
