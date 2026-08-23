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

@Module({ imports: [MemoryModule], providers: [HimDefinitionRegistry, HimRepository, HimService, HimCalculationModelRegistry, HimCalculationService, HimIntelligenceSnapshotService, HimReasoningConsumptionService, HimTurnContextSelectionService], exports: [HimDefinitionRegistry, HimRepository, HimService, HimCalculationModelRegistry, HimCalculationService, HimIntelligenceSnapshotService, HimReasoningConsumptionService, HimTurnContextSelectionService] })
export class HimModule {}
