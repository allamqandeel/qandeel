import { Module } from '@nestjs/common';
import { MemoryModule } from '../memory/memory.module';
import { HypothesisRepository } from './hypothesis.repository';
import { HypothesisGenerationService } from './hypothesis-generation.service';
import { HypothesisService } from './hypothesis.service';
import { ConfidenceRepository } from './confidence.repository';
import { ConfidenceService } from './confidence.service';
import { HypothesisUpdateRepository } from './hypothesis-update.repository';
import { HypothesisUpdateService } from './hypothesis-update.service';
import { HypothesisReasoningContextService } from './hypothesis-reasoning-context.service';
import { HypothesisGenerationTriggerClassificationService } from './hypothesis-generation-trigger-classification.service';
import { HypothesisGenerationEligibilityService } from './hypothesis-generation-eligibility.service';
import { HypothesisGenerationIntentAuthorityService } from './hypothesis-generation-intent-authority.service';
import { HypothesisIntentExtractionProviderModule } from './hypothesis-intent-extraction-provider.module';
import { HypothesisGenerationIntentExtractionService } from './hypothesis-generation-intent-extraction.service';
@Module({ imports: [MemoryModule, HypothesisIntentExtractionProviderModule], providers: [HypothesisRepository, HypothesisService, HypothesisGenerationService, ConfidenceRepository, ConfidenceService, HypothesisUpdateRepository, HypothesisUpdateService, HypothesisReasoningContextService, HypothesisGenerationTriggerClassificationService, HypothesisGenerationEligibilityService, HypothesisGenerationIntentAuthorityService, HypothesisGenerationIntentExtractionService], exports: [HypothesisService, HypothesisGenerationService, ConfidenceService, ConfidenceRepository, HypothesisUpdateService, HypothesisReasoningContextService, HypothesisGenerationTriggerClassificationService, HypothesisGenerationEligibilityService, HypothesisGenerationIntentAuthorityService, HypothesisGenerationIntentExtractionService] })
export class HypothesisModule {}
