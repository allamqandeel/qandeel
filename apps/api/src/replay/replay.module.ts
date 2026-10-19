import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { ReplayController } from './replay.controller';
import { ReplayRepository } from './replay.repository';
import { ReplayService } from './replay.service';

/**
 * S7-01 - the Personal Replay boundary (migration 0169). Composed through the Account module, because the application
 * root is pinned. It owns playback data, selection and historical truth - never graphics: it imports no mobile, map,
 * Living Analysis, temporal-navigation or renderer code, and no Conversation, Model Router or AI runtime. The analysis of
 * a moment is mapped and disclosed by the T-03C historical-projection functions, imported directly; it holds no
 * service_role path.
 */
@Module({
  controllers: [ReplayController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, ReplayRepository, ReplayService],
})
export class ReplayModule {}
