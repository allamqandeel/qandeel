import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { InteractionPreferencesController } from './interaction-preferences.controller';
import { InteractionPreferencesRepository } from './interaction-preferences.repository';
import { InteractionPreferencesService } from './interaction-preferences.service';

/**
 * IP-IMP-01 — the canonical Interaction Preferences authority. It exports ONE thing: the service the Conversation
 * Orchestrator reads each eligible Personal turn and plans durable conversation commands with. No Shared or Public
 * module imports it: Personal preferences never enter a Shared or Public model input.
 */
@Module({
  controllers: [InteractionPreferencesController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, InteractionPreferencesRepository, InteractionPreferencesService],
  exports: [InteractionPreferencesService],
})
export class InteractionPreferencesModule {}
