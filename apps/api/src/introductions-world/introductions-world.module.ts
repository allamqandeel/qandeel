import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { IntroductionWorldAlertsController, IntroductionWorldAlertsRepository, IntroductionWorldAlertsService } from './introduction-world-alerts.controller';
import { IntroductionWorldController } from './introduction-world.controller';
import { IntroductionWorldRepository } from './introduction-world.repository';
import { IntroductionWorldService } from './introduction-world.service';

/**
 * S6-05 (CP3, CP4) - the Introduction World's human conversation (migration 0160) and its closed history (0161). Composed through the Account module,
 * because the application root is pinned. It imports no Shared, Public, Conversation, Model Router, Matching or Activity
 * runtime module and no QANDEEL reply, weaving or Living Analysis service (R-1, R-7), and it shares nothing with the S6-01
 * preparation, the S6-02 lifecycle or the S6-04 proposals module.
 *
 * S6-07 (CP3, migration 0167) adds the per-Introduction alerts (D34) on the caller's own token: the one existing A3-01 mute
 * table, written only by the database's own owner command. It still imports no Activity module.
 */
@Module({
  controllers: [IntroductionWorldController, IntroductionWorldAlertsController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, IntroductionWorldRepository, IntroductionWorldService,
    IntroductionWorldAlertsRepository, IntroductionWorldAlertsService],
})
export class IntroductionsWorldModule {}
