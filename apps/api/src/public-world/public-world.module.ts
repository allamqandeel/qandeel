import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { ModelRouterModule } from '../model-router/model-router.module';
import { PublicActivityProducer } from './public-activity.producer';
import { PublicActivityRepository } from './public-activity.repository';
import { PublicDiscussionController } from './public-discussion.controller';
import { PublicDiscussionRepository } from './public-discussion.repository';
import { PublicDiscussionService } from './public-discussion.service';
import { PublicQandeelGenerator, PublicQandeelReplyService } from './public-qandeel-reply.service';
import { PublicAuthoringController } from './public-authoring.controller';
import { PublicAuthoringRepository } from './public-authoring.repository';
import { PublicAuthoringService } from './public-authoring.service';
import { PublicComposeController } from './public-compose.controller';
import { PublicComposeRepository } from './public-compose.repository';
import { PublicComposeService } from './public-compose.service';
import { PublicSemanticController } from './public-semantic.controller';
import { PUBLIC_SEMANTIC_INTERPRETER } from './public-semantic-interpreter';
import { createProductionPublicSemanticInterpreter } from './public-semantic-interpreter-provider';
import { PublicSemanticRepository } from './public-semantic.repository';
import { PublicSemanticService } from './public-semantic.service';
import { PublicFieldController } from './public-field.controller';
import { PublicFieldRepository } from './public-field.repository';
import { PublicFieldService } from './public-field.service';
import { PublicRelationController } from './public-relation.controller';
import { PublicRelationRepository } from './public-relation.repository';
import { PublicRelationService } from './public-relation.service';
import { PUBLIC_SPATIAL_PLACER, createConfiguredPublicSpatialPlacer } from './public-spatial-placer';
import { PublicSpatialController } from './public-spatial.controller';
import { PublicSpatialRepository } from './public-spatial.repository';
import { PublicSpatialService } from './public-spatial.service';
import { PublicWorldController } from './public-world.controller';
import { PublicWorldRepository } from './public-world.repository';
import { PublicWorldService } from './public-world.service';

/**
 * The Public World Product boundary (Stage 5), composed by the application root. It consumes the frozen I-05 runtime
 * only through migration 0142's three owner commands (S5-01: entry and display) and migration 0143's nine owner
 * commands (S5-02: authoring, rights and review), always on the caller's own token, and through migration 0144
 * (S5-03A: the semantic review) — five owner commands on the caller's own token and two server commands on the server
 * channel — with the provider-neutral semantic interpreter, which binds no production provider until Stage 8A; and
 * through migration 0145 (S5-03B: the semantic field) — two owner commands and five viewer reads on the caller's own
 * token, two server commands on the server channel — with the provider-neutral spatial placer, which likewise binds no
 * production provider until Stage 8A; and through migration 0146 (S5-03C: explicit relations) — two owner reads, the
 * request and four acts, and one viewer read (joined into the field's panel), all on the caller's own token, and nothing
 * on the server channel; and through migration 0147 (S5-04: discussion, @qandeel, Public Activity) — the post command
 * and two discussion reads on the caller's own token, the four Public QANDEEL work commands and the Activity source read
 * on the server channel — with the provider-neutral Model Router (no provider selected here; Stage 8A), the canonical
 * Safety Response Gate and the ONE A3-01 Activity boundary, `ActivityPublisher` (imported from `ActivityModule`, never re-provided);
 * and through migration 0179 (S8A-05 CP1: Write your topic) — eight owner commands and reads and two viewer reads (the
 * human title and section, joined into the field), all on the caller's own token, and nothing on the server channel.
 * S8A-05 CP3 (migration 0181, Controlled Amendment A-4) binds the semantic interpreter to DeepSeek Flash behind the
 * SYNTHETIC_ONLY gate and AI-COST-01 (`public-semantic-interpreter-provider.ts`); the spatial placer stays unbound, since
 * the final place is computed by the database inside the publication transaction.
 */
@Module({
  imports: [ModelRouterModule, ActivityModule],
  controllers: [PublicWorldController, PublicAuthoringController, PublicSemanticController, PublicSpatialController, PublicFieldController,
    PublicRelationController, PublicDiscussionController, PublicComposeController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, SupabaseServiceRoleApiService, PublicWorldRepository,
    PublicWorldService, PublicAuthoringRepository, PublicAuthoringService, PublicSemanticRepository, PublicSemanticService,
    { provide: PUBLIC_SEMANTIC_INTERPRETER, useFactory: () => createProductionPublicSemanticInterpreter(process.env) },
    PublicSpatialRepository, PublicSpatialService, PublicFieldRepository, PublicFieldService, PublicRelationRepository, PublicRelationService,
    { provide: PUBLIC_SPATIAL_PLACER, useFactory: () => createConfiguredPublicSpatialPlacer(process.env) },
    SafetyResponseGateService, PublicDiscussionRepository, PublicDiscussionService, PublicQandeelGenerator, PublicQandeelReplyService,
    PublicActivityRepository, PublicActivityProducer, PublicComposeRepository, PublicComposeService],
})
export class PublicWorldModule {}
