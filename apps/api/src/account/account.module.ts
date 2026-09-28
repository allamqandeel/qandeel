import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { AccountController } from './account.controller';
import { AccountRepository } from './account.repository';
import { AccountService } from './account.service';

/**
 * W1B-01 — the account owner, composed by the application root: account identity is not a
 * Conversation capability. It provides its own guard and transports exactly as the Conversation
 * module does.
 */
@Module({
  controllers: [AccountController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, SupabaseServiceRoleApiService, AccountRepository, AccountService],
})
export class AccountModule {}
