import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { ConversationController } from './conversation.controller';
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

@Module({
  imports: [ModelRouterModule, MemoryModule, HimModule, HypothesisModule, ObservabilityModule],
  controllers: [ConversationController],
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
    ConversationOrchestratorService,
    ConversationService,
  ],
})
export class ConversationModule {}
