import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { ConversationController } from './conversation.controller';
import { ConversationRepository } from './conversation.repository';
import { ConversationService } from './conversation.service';
import { SupabaseDataApiService } from './supabase-data-api.service';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import { ModelRouterModule } from '../model-router/model-router.module';
import { CONTEXT_BUILDER } from './context-builder.types';
import { ContextBuilderService } from './context-builder.service';
import { BehavioralResponsePolicyService } from './behavioral-response-policy.service';
import { BEHAVIORAL_RESPONSE_POLICY } from './behavioral-response-policy.types';

@Module({
  imports: [ModelRouterModule],
  controllers: [ConversationController],
  providers: [
    SupabaseAuthService,
    SupabaseAuthGuard,
    SupabaseDataApiService,
    ConversationRepository,
    ContextBuilderService,
    { provide: CONTEXT_BUILDER, useExisting: ContextBuilderService },
    BehavioralResponsePolicyService,
    { provide: BEHAVIORAL_RESPONSE_POLICY, useExisting: BehavioralResponsePolicyService },
    ConversationOrchestratorService,
    ConversationService,
  ],
})
export class ConversationModule {}
