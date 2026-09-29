import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { AccountController } from './account.controller';
import { AccountRepository } from './account.repository';
import { AccountService } from './account.service';
import { LoginIdSignInController } from './login-id-sign-in.controller';
import { LoginIdSignInRepository } from './login-id-sign-in.repository';
import { LoginIdSignInService } from './login-id-sign-in.service';
import { SupabasePasswordGrantService } from './supabase-password-grant.service';

/**
 * W1B-01 — the account owner, composed by the application root: account identity is not a
 * Conversation capability. It provides its own guard and transports exactly as the Conversation
 * module does.
 *
 * W2-01 adds the Login ID sign-in exchange beside it, in files of its own: the only place on the server
 * that handles an account's Email, and it never returns one to anyone who has not proved the password.
 */
@Module({
  controllers: [AccountController, LoginIdSignInController],
  providers: [
    SupabaseAuthService,
    SupabaseAuthGuard,
    SupabaseDataApiService,
    SupabaseServiceRoleApiService,
    AccountRepository,
    AccountService,
    LoginIdSignInRepository,
    SupabasePasswordGrantService,
    LoginIdSignInService,
  ],
})
export class AccountModule {}
