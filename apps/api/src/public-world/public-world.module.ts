import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { PublicAuthoringController } from './public-authoring.controller';
import { PublicAuthoringRepository } from './public-authoring.repository';
import { PublicAuthoringService } from './public-authoring.service';
import { PublicSemanticController } from './public-semantic.controller';
import { PUBLIC_SEMANTIC_INTERPRETER, createConfiguredPublicSemanticInterpreter } from './public-semantic-interpreter';
import { PublicSemanticRepository } from './public-semantic.repository';
import { PublicSemanticService } from './public-semantic.service';
import { PublicWorldController } from './public-world.controller';
import { PublicWorldRepository } from './public-world.repository';
import { PublicWorldService } from './public-world.service';

/**
 * The Public World Product boundary (Stage 5), composed by the application root. It consumes the frozen I-05 runtime
 * only through migration 0142's three owner commands (S5-01: entry and display) and migration 0143's nine owner
 * commands (S5-02: authoring, rights and review), always on the caller's own token, and through migration 0144
 * (S5-03A: the semantic review) — five owner commands on the caller's own token and two server commands on the server
 * channel — with the provider-neutral semantic interpreter, which binds no production provider until Stage 8A.
 */
@Module({
  controllers: [PublicWorldController, PublicAuthoringController, PublicSemanticController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, SupabaseServiceRoleApiService, PublicWorldRepository,
    PublicWorldService, PublicAuthoringRepository, PublicAuthoringService, PublicSemanticRepository, PublicSemanticService,
    { provide: PUBLIC_SEMANTIC_INTERPRETER, useFactory: () => createConfiguredPublicSemanticInterpreter(process.env) }],
})
export class PublicWorldModule {}
