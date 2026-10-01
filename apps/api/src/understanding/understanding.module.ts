import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { HypothesisModule } from '../hypothesis/hypothesis.module';
import { MemoryModule } from '../memory/memory.module';
import { ObservabilityModule } from '../observability/observability.module';
import { UnderstandingController } from './understanding.controller';
import { UnderstandingRepository } from './understanding.repository';
import { UnderstandingService } from './understanding.service';

/**
 * W3-MEGA-U — «فهم قنديل» / QANDEEL Understanding, a depth of Personal QANDEEL. It is composed by the application root
 * beside the Account module and consumes the Hypothesis, Evidence and Confidence runtimes through their exported
 * services; it owns no intelligence of its own and adds nothing to the Conversation module.
 *
 * PROD-OPS-01 adds the existing content-free telemetry (ObservabilityModule), only to make the Confidence
 * re-evaluation's outcome visible.
 */
@Module({
  imports: [MemoryModule, HypothesisModule, ObservabilityModule],
  controllers: [UnderstandingController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, UnderstandingRepository, UnderstandingService],
})
export class UnderstandingModule {}
