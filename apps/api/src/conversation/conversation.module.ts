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
import type { CuSegmentationBinding, CuSegmentationBindingFactory } from '../conversation-unit/conversation-temporal-establishment.service';
import { TemporalDeliveryRepository } from '../conversation-unit/temporal-delivery.repository';
import {
  createOpenAiSegmentationClient,
  OpenAiCuSegmentationProvider,
} from '../conversation-unit/openai-cu-segmentation.provider';
import { loadCuSegmentationOpenAIConfig } from '../conversation-unit/cu-segmentation-provider.config';
import { openAiFocusResolutionBinding, type FocusResolutionBindingFactory } from '../conversational-focus/focus-resolution-binding';
import { openAiThreadEstablishmentBinding, type ThreadEstablishmentBindingFactory } from '../thread-establishment/thread-establishment-binding';
import { openAiThreadContinuityBinding, type ThreadContinuityBindingFactory } from '../thread-lifecycle/thread-continuity-binding';
import { ConversationSemanticEstablishmentService } from '../live-focus/conversation-semantic-establishment.service';
import { ConversationSemanticRuntimeRepository } from '../live-focus/conversation-semantic-runtime.repository';

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

/**
 * T-03D: the three semantic provider bindings the FINAL chain reuses - B1
 * focus resolution (T-03B1b2), B2 Thread establishment (T-03B2b3) and B3
 * Thread continuity (T-03B3). Each registered value is a FACTORY: creating it
 * reads nothing; calling it happens only inside an actual establishment run,
 * after the replay / partial gate. Effective Live Focus has NO provider
 * factory: it is a deterministic reduction (D-01).
 */
export const FOCUS_RESOLUTION_BINDING_FACTORY = Symbol('FOCUS_RESOLUTION_BINDING_FACTORY');
export const THREAD_ESTABLISHMENT_BINDING_FACTORY = Symbol('THREAD_ESTABLISHMENT_BINDING_FACTORY');
export const THREAD_CONTINUITY_BINDING_FACTORY = Symbol('THREAD_CONTINUITY_BINDING_FACTORY');

@Module({
  imports: [ModelRouterModule, MemoryModule, HimModule, HypothesisModule, RecommendationModule, ObservabilityModule],
  // QHIA-011A: the explicit session context activation entry is its own
  // authenticated controller. It is a separate product command surface, never
  // part of create-turn input and never reached from a normal turn.
  // T-03A2 / T-03D: the authenticated temporal + Live Focus read surface is its
  // own controller. It is delivery/catch-up transport only, never a Timeline
  // or history API.
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
    // T-03A2 / T-03D: the committed-CU / Session-clock / semantic-chain
    // boundary. The classes under `conversation-unit/` and `live-focus/` carry
    // no Nest decorator by design - those directories stay framework-agnostic -
    // so they are registered here through explicit factories with their exact
    // authority channel: the ONE final semantic coordinator through the
    // SERVICE-ROLE channel, and the owner-scoped live reads (LH + LF) through
    // the AUTHENTICATED channel. The temporary T-03A2-only temporal
    // establishment service and its unit repository are NOT registered any
    // more: after the T-03D cutover exactly one application path writes
    // Session Positions, and it always carries B1, the Thread layer and LF.
    {
      provide: TemporalDeliveryRepository,
      useFactory: (dataApi: SupabaseDataApiService) => new TemporalDeliveryRepository(dataApi),
      inject: [SupabaseDataApiService],
    },
    { provide: CU_SEGMENTATION_BINDING_FACTORY, useValue: openAiSegmentationBinding },
    { provide: FOCUS_RESOLUTION_BINDING_FACTORY, useValue: openAiFocusResolutionBinding() },
    { provide: THREAD_ESTABLISHMENT_BINDING_FACTORY, useValue: openAiThreadEstablishmentBinding() },
    { provide: THREAD_CONTINUITY_BINDING_FACTORY, useValue: openAiThreadContinuityBinding() },
    {
      provide: ConversationSemanticRuntimeRepository,
      useFactory: (serviceApi: SupabaseServiceRoleApiService) => new ConversationSemanticRuntimeRepository(serviceApi),
      inject: [SupabaseServiceRoleApiService],
    },
    {
      provide: ConversationSemanticEstablishmentService,
      useFactory: (
        repository: ConversationSemanticRuntimeRepository,
        segmentation: CuSegmentationBindingFactory,
        focus: FocusResolutionBindingFactory,
        thread: ThreadEstablishmentBindingFactory,
        continuity: ThreadContinuityBindingFactory,
      ) => new ConversationSemanticEstablishmentService(repository, segmentation, focus, thread, continuity),
      inject: [
        ConversationSemanticRuntimeRepository,
        CU_SEGMENTATION_BINDING_FACTORY,
        FOCUS_RESOLUTION_BINDING_FACTORY,
        THREAD_ESTABLISHMENT_BINDING_FACTORY,
        THREAD_CONTINUITY_BINDING_FACTORY,
      ],
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
