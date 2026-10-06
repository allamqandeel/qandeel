import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { PublicAuthoringController } from './public-authoring.controller';
import { PublicAuthoringRepository } from './public-authoring.repository';
import { PublicAuthoringService } from './public-authoring.service';
import { PublicWorldController } from './public-world.controller';
import { PublicWorldRepository } from './public-world.repository';
import { PublicWorldService } from './public-world.service';

/**
 * The Public World Product boundary (Stage 5), composed by the application root. It consumes the frozen I-05 runtime
 * only through migration 0142's three owner commands (S5-01: entry and display) and migration 0143's nine owner
 * commands (S5-02: authoring, rights and review), always on the caller's own token.
 */
@Module({
  controllers: [PublicWorldController, PublicAuthoringController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, PublicWorldRepository, PublicWorldService,
    PublicAuthoringRepository, PublicAuthoringService],
})
export class PublicWorldModule {}
