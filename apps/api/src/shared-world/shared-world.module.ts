import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SHARED_QANDEEL_REPLY_PROVIDERS } from '../connected-worlds/material-commit/shared-qandeel-reply.providers';
import { SHARED_QANDEEL_REPLY_GENERATOR } from '../connected-worlds/material-commit/shared-qandeel-reply.types';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { ModelRouterModule } from '../model-router/model-router.module';
import { SharedConversationReplyGenerator } from './shared-conversation-reply.generator';
import { SharedIdSealing } from './shared-id-sealing';
import { SharedWorldConversationRepository } from './shared-world-conversation.repository';
import { SharedWorldConversationService } from './shared-world-conversation.service';
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
 */
@Module({
  imports: [ModelRouterModule],
  controllers: [SharedWorldController],
  providers: [
    SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, SharedIdSealing, SharedWorldRepository, SharedWorldService,
    SharedWorldConversationRepository, SharedWorldConversationService, SafetyResponseGateService,
    ...SHARED_QANDEEL_REPLY_PROVIDERS,
    { provide: SHARED_QANDEEL_REPLY_GENERATOR, useClass: SharedConversationReplyGenerator },
  ],
})
export class SharedWorldModule {}
