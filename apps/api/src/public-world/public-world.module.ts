import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { PublicWorldController } from './public-world.controller';
import { PublicWorldRepository } from './public-world.repository';
import { PublicWorldService } from './public-world.service';

/**
 * S5-01 — the Public World Product boundary (Stage 5), composed by the application root. It consumes the frozen I-05
 * runtime only through migration 0142's three owner commands, on the caller's own token.
 */
@Module({
  controllers: [PublicWorldController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, PublicWorldRepository, PublicWorldService],
})
export class PublicWorldModule {}
