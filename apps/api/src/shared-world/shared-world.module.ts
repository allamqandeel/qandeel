import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SharedIdSealing } from './shared-id-sealing';
import { SharedWorldController } from './shared-world.controller';
import { SharedWorldRepository } from './shared-world.repository';
import { SharedWorldService } from './shared-world.service';

/**
 * S4-01 — the Shared World Product execution boundary (Stage 4), composed by the application root beside Activity and
 * Push. It consumes the frozen I-04 runtime through migration 0138's owner commands only, on the caller's own token:
 * no server channel, no Shared material, no Activity producer. The kernel and authority services under
 * `connected-worlds/` are not imported: they stay the internal runtime's.
 */
@Module({
  controllers: [SharedWorldController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, SharedIdSealing, SharedWorldRepository, SharedWorldService],
})
export class SharedWorldModule {}
