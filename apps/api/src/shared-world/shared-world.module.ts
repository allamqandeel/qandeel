import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SHARED_QANDEEL_REPLY_PROVIDERS } from '../connected-worlds/material-commit/shared-qandeel-reply.providers';
import { SHARED_QANDEEL_REPLY_GENERATOR } from '../connected-worlds/material-commit/shared-qandeel-reply.types';
import { SHARED_DISCLOSURE_JUDGE } from '../connected-worlds/member-knowledge/shared-member-knowledge.types';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { ModelRouterModule } from '../model-router/model-router.module';
import { SharedActivityProducer } from './shared-activity.producer';
import { SharedActivityRepository } from './shared-activity.repository';
import { SharedConversationReplyGenerator } from './shared-conversation-reply.generator';
import { createConfiguredSharedDisclosureJudge } from './shared-disclosure-judge-provider';
import { SharedIdSealing } from './shared-id-sealing';
import { SharedSemanticFieldService } from './shared-semantic-field.service';
import { SHARED_SEMANTIC_INTERPRETER } from './shared-semantic-interpreter';
import { createConfiguredSharedSemanticInterpreter } from './shared-semantic-interpreter-provider';
import { SharedSemanticPlaceService } from '../connected-worlds/material-commit/shared-semantic-place.service';
import { SHARED_SPATIAL_PLACER } from './shared-spatial-placer';
import { SHARED_KNOWLEDGE_RECALLER } from './shared-knowledge-recall';
import { createConfiguredSharedKnowledgeRecaller, createConfiguredSharedSpatialPlacer } from './shared-social-memory-provider';
import { SharedWorldAlertsRepository } from './shared-world-alerts.repository';
import { SharedWorldAlertsService } from './shared-world-alerts.service';
import { SharedWorldConversationRepository } from './shared-world-conversation.repository';
import { SharedWorldConversationService } from './shared-world-conversation.service';
import { SharedWorldLifecycleRepository } from './shared-world-lifecycle.repository';
import { SharedWorldLifecycleService } from './shared-world-lifecycle.service';
import { SharedWorldPermissionsRepository } from './shared-world-permissions.repository';
import { SharedWorldPermissionsService } from './shared-world-permissions.service';
import { SharedWorldController } from './shared-world.controller';
import { SharedWorldRepository } from './shared-world.repository';
import { SharedWorldService } from './shared-world.service';

/**
 * S4-01 — the Shared World Product execution boundary (Stage 4), composed by the application root beside Activity and
 * Push. It consumes the frozen I-04 runtime through migration 0138's owner commands on the caller's own token.
 *
 * S4-02 — the Shared conversation: the human's own commands through migration 0139 on the caller's own token, and the
 * request-driven QANDEEL reply through the Connected Worlds composition (`connected-worlds/material-commit`), which runs
 * the frozen I-03 / I-04G chain and commits through 0139's server-owned reply command. The Model Router is the
 * provider-neutral one; the Safety Response Gate is the canonical one.
 *
 * S4-03 — the Shared lifecycle: leave, governed removal / settings / World end, approvals, selective history sharing, the
 * closed World's read-only view and the reader's own words in former Worlds, through migration 0140's owner commands on
 * the caller's own token. The server channel is not used.
 *
 * S4-04 — Shared Activity: the producer hands each committed Shared fact's identity to ONE 0141 server pass, which
 * derives the recipients from durable Shared truth, and publishes through the ONE A3-01 boundary, `ActivityPublisher`
 * (imported from `ActivityModule`, never re-provided). The per-World alert rows run on the caller's own token (0141).
 *
 * SHARED-VIS-01 — the Shared World's Living Analysis geography: the member's field and place reads over migration 0148 on
 * the caller's own token, and QANDEEL's semantic places, produced by the server through the same frozen I-03 / I-04G
 * chain as the reply and committed through 0148's server-owned pass commands. The interpreter and the placer are
 * provider-neutral ports. S8A-04 CP1 binds the interpreter to DeepSeek Flash (`shared-semantic-interpreter-provider.ts`);
 * the placer still refuses, so no place is produced until CP2.
 *
 * S8A-04 CP2 — Shared social memory: the reply is given what the World already knows, chosen by the provider-neutral
 * knowledge recaller (`shared-social-memory-provider.ts`: DeepSeek Flash behind SYNTHETIC_ONLY). The placer is bound there
 * too (§7, 2026-10-25): DeepSeek Flash behind SYNTHETIC_ONLY, and the refusing placer wherever DeepSeek may not run.
 */
@Module({
  imports: [ModelRouterModule, ActivityModule],
  controllers: [SharedWorldController],
  providers: [
    SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, SharedIdSealing, SharedWorldRepository, SharedWorldService,
    SharedWorldConversationRepository, SharedWorldConversationService, SharedWorldLifecycleRepository, SharedWorldLifecycleService,
    SafetyResponseGateService,
    SharedActivityRepository, SharedActivityProducer, SharedWorldAlertsRepository, SharedWorldAlertsService,
    // S8A-04 CP3-C: the owner's permissions for their own knowledge (migration 0177), on the caller's own token.
    SharedWorldPermissionsRepository, SharedWorldPermissionsService,
    ...SHARED_QANDEEL_REPLY_PROVIDERS,
    { provide: SHARED_QANDEEL_REPLY_GENERATOR, useClass: SharedConversationReplyGenerator },
    SharedSemanticFieldService, SharedSemanticPlaceService,
    { provide: SHARED_SEMANTIC_INTERPRETER, useFactory: () => createConfiguredSharedSemanticInterpreter() },
    { provide: SHARED_SPATIAL_PLACER, useFactory: () => createConfiguredSharedSpatialPlacer() },
    { provide: SHARED_KNOWLEDGE_RECALLER, useFactory: () => createConfiguredSharedKnowledgeRecaller() },
    // S8A-04 CP3: the disclosure judge, or null where DeepSeek may not run (then no personal knowledge is collected).
    { provide: SHARED_DISCLOSURE_JUDGE, useFactory: () => createConfiguredSharedDisclosureJudge() },
  ],
})
export class SharedWorldModule {}
