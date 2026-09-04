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
import { IntegratedContextBudgetAssemblerService } from '../intelligence-runtime/integrated-context-budget-assembler.service';
import { QuestionForegroundSelectionService } from '../question/question-foreground-selection.service';
import { ConversationTemporalController } from './conversation-temporal.controller';
import {
  ConversationTemporalEstablishmentService,
  type CuSegmentationBinding,
} from '../conversation-unit/conversation-temporal-establishment.service';
import { ConversationUnitRepository } from '../conversation-unit/conversation-unit.repository';
import { TemporalDeliveryRepository } from '../conversation-unit/temporal-delivery.repository';
import {
  createOpenAiSegmentationClient,
  OpenAiCuSegmentationProvider,
} from '../conversation-unit/openai-cu-segmentation.provider';
import { loadCuSegmentationOpenAIConfig } from '../conversation-unit/cu-segmentation-provider.config';

/**
 * T-03A2: the LAZY CU segmentation binding.
 *
 * `useValue` registers the FACTORY, never its product, so nothing is
 * constructed and no configuration is read at Nest bootstrap. The real OpenAI
 * adapter - and therefore the `OPENAI_API_KEY` requirement - materializes only
 * on the first actual CU evaluation, so starting the application and running
 * unrelated tests never depends on a provider credential.
 */
export const CU_SEGMENTATION_BINDING_FACTORY = Symbol('CU_SEGMENTATION_BINDING_FACTORY');

function openAiSegmentationBinding(): CuSegmentationBinding {
  const config = loadCuSegmentationOpenAIConfig();
  return {
    provider: new OpenAiCuSegmentationProvider(config, createOpenAiSegmentationClient(config)),
    providerName: config.provider,
    providerModel: config.model,
  };
}

@Module({
  imports: [ModelRouterModule, MemoryModule, HimModule, HypothesisModule, RecommendationModule, ObservabilityModule],
  // QHIA-011A: the explicit session context activation entry is its own
  // authenticated controller. It is a separate product command surface, never
  // part of create-turn input and never reached from a normal turn.
  // T-03A2: the authenticated temporal read surface is its own controller. It
  // is delivery/catch-up transport only, never a Timeline or history API.
  controllers: [ConversationController, ConversationContextActivationController, ConversationTemporalController],
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
    // QIR-006: the narrow bounded formal Question foreground selection service
    // over the EXISTING explicit service-role channel and telemetry - exactly
    // one selection RPC per provider-generating ALLOW turn, no new repository,
    // no new Data API boundary, and no provider call of any kind.
    QuestionForegroundSelectionService,
    // QIR-004: the ONE final normalized provider-request assembly boundary. It
    // depends only on the already-imported ObservabilityModule telemetry and
    // the provider-neutral guidance renderer: no new repository, no new Data
    // API boundary, no new database authority, and no migration.
    IntegratedContextBudgetAssemblerService,
    ConversationOrchestratorService,
    // T-03A2: the committed-CU / Session-clock boundary. The classes under
    // `conversation-unit/` carry no Nest decorator by design - that directory
    // stays framework-agnostic - so they are registered here through explicit
    // factories with their exact authority channel: the canonical producer and
    // the atomic exchange coordinator through the SERVICE-ROLE channel, and the
    // owner-scoped temporal reads through the AUTHENTICATED channel.
    {
      provide: ConversationUnitRepository,
      useFactory: (serviceApi: SupabaseServiceRoleApiService) => new ConversationUnitRepository(serviceApi),
      inject: [SupabaseServiceRoleApiService],
    },
    {
      provide: TemporalDeliveryRepository,
      useFactory: (dataApi: SupabaseDataApiService) => new TemporalDeliveryRepository(dataApi),
      inject: [SupabaseDataApiService],
    },
    { provide: CU_SEGMENTATION_BINDING_FACTORY, useValue: openAiSegmentationBinding },
    {
      provide: ConversationTemporalEstablishmentService,
      useFactory: (units: ConversationUnitRepository, binding: () => CuSegmentationBinding) =>
        new ConversationTemporalEstablishmentService(units, binding),
      inject: [ConversationUnitRepository, CU_SEGMENTATION_BINDING_FACTORY],
    },
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
