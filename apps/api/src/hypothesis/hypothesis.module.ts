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
@Module({ imports: [MemoryModule], providers: [HypothesisRepository, HypothesisService, HypothesisGenerationService, ConfidenceRepository, ConfidenceService, HypothesisUpdateRepository, HypothesisUpdateService, HypothesisReasoningContextService, HypothesisGenerationTriggerClassificationService], exports: [HypothesisService, HypothesisGenerationService, ConfidenceService, ConfidenceRepository, HypothesisUpdateService, HypothesisReasoningContextService, HypothesisGenerationTriggerClassificationService] })
export class HypothesisModule {}
