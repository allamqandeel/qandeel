import { Module } from '@nestjs/common';
import { MemoryModule } from '../memory/memory.module';
import { HimDefinitionRegistry } from './him-definition.registry';
import { HimRepository } from './him.repository';
import { HimService } from './him.service';
import { HimCalculationModelRegistry } from './him-calculation.registry';
import { HimCalculationService } from './him-calculation.service';
import { HimIntelligenceSnapshotService } from './him-intelligence-snapshot.service';
import { HimReasoningConsumptionService } from './him-reasoning-consumption.service';
import { HimTurnContextSelectionService } from './him-turn-context-selection.service';
import { HimFastDeepConsumptionService } from './him-fast-deep-consumption.service';
import { HimInteractionAdaptationService } from './him-interaction-adaptation.service';
import { HimContextualCurrentIntelligenceService } from './him-contextual-current-intelligence.service';

@Module({ imports: [MemoryModule], providers: [HimDefinitionRegistry, HimRepository, HimService, HimCalculationModelRegistry, HimCalculationService, HimIntelligenceSnapshotService, HimReasoningConsumptionService, HimTurnContextSelectionService, HimFastDeepConsumptionService, HimInteractionAdaptationService, HimContextualCurrentIntelligenceService], exports: [HimDefinitionRegistry, HimRepository, HimService, HimCalculationModelRegistry, HimCalculationService, HimIntelligenceSnapshotService, HimReasoningConsumptionService, HimTurnContextSelectionService, HimFastDeepConsumptionService, HimInteractionAdaptationService, HimContextualCurrentIntelligenceService] })
export class HimModule {}
