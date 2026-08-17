import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { ConversationController } from './conversation.controller';
import { ConversationRepository } from './conversation.repository';
import { ConversationService } from './conversation.service';
import { SupabaseDataApiService } from './supabase-data-api.service';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import { ModelRouterModule } from '../model-router/model-router.module';

@Module({
  imports: [ModelRouterModule],
  controllers: [ConversationController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, ConversationRepository, ConversationOrchestratorService, ConversationService],
})
export class ConversationModule {}
