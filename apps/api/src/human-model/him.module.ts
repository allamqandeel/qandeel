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
import { HimSessionReflectionConsumptionService } from './him-session-reflection-consumption.service';
import { HimSessionContextBindingRepository } from './him-session-context-binding.repository';
import { HimSessionContextBindingService } from './him-session-context-binding.service';
import { HimSituationStressRepository } from './him-situation-stress.repository';
import { HimSituationStressConsumptionService } from './him-situation-stress-consumption.service';
import { HimDecisionAttentionRepository } from './him-decision-attention.repository';
import { HimDecisionAttentionConsumptionService } from './him-decision-attention-consumption.service';
import { HimGoalMotivationRepository } from './him-goal-motivation.repository';
import { HimGoalMotivationConsumptionService } from './him-goal-motivation-consumption.service';
import { HimRelationshipCommunicationRepository } from './him-relationship-communication.repository';
import { HimRelationshipCommunicationConsumptionService } from './him-relationship-communication-consumption.service';
// QHIA-009/QHIA-010/QHIA-011: the cross-context foreground aggregate transport.
// The direct QHIA-007, QHIA-008, QHIA-010 and QHIA-011 boundaries above stay
// registered and exported unchanged - they remain canonical, independently
// callable authorities; the aggregate only replaces how the Conversation
// Orchestrator reaches them.
import { HimCrossContextForegroundRepository } from './him-cross-context-foreground.repository';
import { HimCrossContextForegroundAggregationService } from './him-cross-context-foreground-aggregation.service';
// QHIA-012: the Brain Context bridge. It is an ADDITIONAL independent optional
// foreground read, not an aggregate-v4 and not a replacement for the QHIA-007 /
// 008 / 010 / 011 channels above - all of which stay registered, exported and
// unchanged. It consumes only the durable materialization the post-response
// background path produced for the immediately preceding canonical USER turn.
import { HimBrainContextRepository } from './him-brain-context.repository';
import { HimBrainContextService } from './him-brain-context.service';

@Module({ imports: [MemoryModule], providers: [HimDefinitionRegistry, HimRepository, HimService, HimCalculationModelRegistry, HimCalculationService, HimIntelligenceSnapshotService, HimReasoningConsumptionService, HimTurnContextSelectionService, HimFastDeepConsumptionService, HimInteractionAdaptationService, HimContextualCurrentIntelligenceService, HimSessionReflectionConsumptionService, HimSessionContextBindingRepository, HimSessionContextBindingService, HimSituationStressRepository, HimSituationStressConsumptionService, HimDecisionAttentionRepository, HimDecisionAttentionConsumptionService, HimGoalMotivationRepository, HimGoalMotivationConsumptionService, HimRelationshipCommunicationRepository, HimRelationshipCommunicationConsumptionService, HimCrossContextForegroundRepository, HimCrossContextForegroundAggregationService, HimBrainContextRepository, HimBrainContextService], exports: [HimDefinitionRegistry, HimRepository, HimService, HimCalculationModelRegistry, HimCalculationService, HimIntelligenceSnapshotService, HimReasoningConsumptionService, HimTurnContextSelectionService, HimFastDeepConsumptionService, HimInteractionAdaptationService, HimContextualCurrentIntelligenceService, HimSessionReflectionConsumptionService, HimSessionContextBindingRepository, HimSessionContextBindingService, HimSituationStressRepository, HimSituationStressConsumptionService, HimDecisionAttentionRepository, HimDecisionAttentionConsumptionService, HimGoalMotivationRepository, HimGoalMotivationConsumptionService, HimRelationshipCommunicationRepository, HimRelationshipCommunicationConsumptionService, HimCrossContextForegroundRepository, HimCrossContextForegroundAggregationService, HimBrainContextRepository, HimBrainContextService] })
export class HimModule {}
