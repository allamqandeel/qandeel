import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { ConversationController } from './conversation.controller';
import { ConversationContextActivationController } from './conversation-context-activation.controller';
import { ConversationContextActivationService } from './conversation-context-activation.service';
import { ConversationRepository } from './conversation.repository';
import { ConversationService } from './conversation.service';
import { SupabaseDataApiService } from './supabase-data-api.service';
import { SupabaseServiceRoleApiService } from './supabase-service-role-api.service';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import { ModelRouterModule } from '../model-router/model-router.module';
import { CONTEXT_BUILDER } from './context-builder.types';
import { ContextBuilderService } from './context-builder.service';
import { BehavioralResponsePolicyService } from './behavioral-response-policy.service';
import { BEHAVIORAL_RESPONSE_POLICY } from './behavioral-response-policy.types';
import { SafetyResponseGateService } from './safety-response-gate.service';
import { SAFETY_RESPONSE_GATE } from './safety-response-gate.types';
import { MemoryModule } from '../memory/memory.module';
import { HimModule } from '../human-model/him.module';
import { ObservabilityModule } from '../observability/observability.module';
import { HypothesisModule } from '../hypothesis/hypothesis.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { BoundedForegroundIntelligenceGathererService } from '../intelligence-runtime/bounded-foreground-intelligence-gatherer.service';

@Module({
  imports: [ModelRouterModule, MemoryModule, HimModule, HypothesisModule, RecommendationModule, ObservabilityModule],
  // QHIA-011A: the explicit session context activation entry is its own
  // authenticated controller. It is a separate product command surface, never
  // part of create-turn input and never reached from a normal turn.
  controllers: [ConversationController, ConversationContextActivationController],
  providers: [
    SupabaseAuthService,
    SupabaseAuthGuard,
    SupabaseDataApiService,
    SupabaseServiceRoleApiService,
    ConversationRepository,
    ContextBuilderService,
    { provide: CONTEXT_BUILDER, useExisting: ContextBuilderService },
    SafetyResponseGateService,
    { provide: SAFETY_RESPONSE_GATE, useExisting: SafetyResponseGateService },
    BehavioralResponsePolicyService,
    { provide: BEHAVIORAL_RESPONSE_POLICY, useExisting: BehavioralResponsePolicyService },
    // QIR-003: the narrow bounded Memory + Hypothesis foreground gatherer over
    // the EXISTING MemoryRetrieverService and HypothesisReasoningContextService
    // (exported by the already-imported MemoryModule and HypothesisModule). It
    // introduces no new repository, no new Data API boundary and no new
    // database authority.
    BoundedForegroundIntelligenceGathererService,
    ConversationOrchestratorService,
    ConversationService,
    // QHIA-011A: the narrow facade over the EXISTING QHIA-006 relevance
    // authority. HimModule already provides and exports
    // HimSessionContextBindingService and its one repository, so no second
    // binding repository, no second Data API boundary, and no new database
    // authority is introduced.
    ConversationContextActivationService,
  ],
})
export class ConversationModule {}
