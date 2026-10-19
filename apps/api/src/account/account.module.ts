import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { IntroductionsContinuationModule } from '../introductions-continuation/introductions-continuation.module';
import { IntroductionsDisclosureModule } from '../introductions-disclosure/introductions-disclosure.module';
import { IntroductionsLifecycleModule } from '../introductions-lifecycle/introductions-lifecycle.module';
import { IntroductionsPreparationModule } from '../introductions-preparation/introductions-preparation.module';
import { IntroductionsProposalsModule } from '../introductions-proposals/introductions-proposals.module';
import { IntroductionsEnrollmentModule } from '../introductions-enrollment/introductions-enrollment.module';
import { IntroductionsDispatchModule } from '../introductions-dispatch/introductions-dispatch.module';
import { IntroductionsWorldModule } from '../introductions-world/introductions-world.module';
import { ObservabilityModule } from '../observability/observability.module';
import { ReplayModule } from '../replay/replay.module';
import { AccountErasureRecoveryWorker } from './account-erasure-recovery.worker';
import { AccountIdentityRepository } from './account-identity.repository';
import { AccountSecurityController } from './account-security.controller';
import { AccountSecurityService } from './account-security.service';
import { AccountController } from './account.controller';
import { AccountRepository } from './account.repository';
import { AccountService } from './account.service';
import { LoginIdSignInController } from './login-id-sign-in.controller';
import { LoginIdSignInRepository } from './login-id-sign-in.repository';
import { LoginIdSignInService } from './login-id-sign-in.service';
import { PrivacyDataController } from './privacy-data.controller';
import { PrivacyDataRepository } from './privacy-data.repository';
import { PrivacyDataService } from './privacy-data.service';
import { PrivacyMaintenanceRepository } from './privacy-maintenance.repository';
import { PrivacyMaintenanceWorker } from './privacy-maintenance.worker';
import { ProviderAccountRemovalService } from './provider-account-removal.service';
import { SupabasePasswordGrantService } from './supabase-password-grant.service';

/**
 * W1B-01 — the account owner, composed by the application root: account identity is not a
 * Conversation capability. It provides its own guard and transports exactly as the Conversation
 * module does.
 *
 * W2-01 adds the Login ID sign-in exchange beside it, in files of its own: the only place on the server
 * that handles an account's Email, and it never returns one to anyone who has not proved the password.
 *
 * W3-MEGA-A adds the owner's own identity and security routes beside them, in files of their own, on the same relay:
 * an owner reads and changes only their own account.
 *
 * W3-MEGA-S adds the owner's Privacy & Data routes (Export My Data; the Personal-world Delete Account) on the same relay,
 * and the server's own asynchronous pass that prepares exports and carries due deletions through the database's ONE
 * governed Personal erasure and the provider account's removal.
 *
 * PROD-OPS-01 makes that pass's outcomes visible through the existing content-free telemetry (ObservabilityModule).
 *
 * S6-01 composes the owner's Introductions preparation (IntroductionsPreparationModule) here, because the application
 * root is pinned: it is the owner's own account-scoped preparation, and it shares nothing with these providers.
 *
 * S6-02 composes the Introduction lifecycle boundary (IntroductionsLifecycleModule: the unilateral END) here for the same
 * reason. It shares nothing with these providers or with the preparation module.
 *
 * S6-04 composes the private proposal review and decision boundary (IntroductionsProposalsModule) here for the same
 * reason. It shares nothing with these providers, the preparation module or the lifecycle module.
 *
 * S6-05 (CP3) composes the Introduction World's human conversation (IntroductionsWorldModule) here for the same reason.
 * It shares nothing with these providers or with the other Introductions modules, and imports no AI runtime.
 *
 * S6-06 (CP1) composes sharing, photos and the display-name consent (IntroductionsDisclosureModule) and SUCCESS and the
 * explicit resume (IntroductionsContinuationModule) here for the same reason. Neither shares anything with these
 * providers or the other Introductions modules, and neither imports an AI runtime.
 *
 * ACCT-DEL-01 (CP1) moves the Privacy & Data pass onto the database's ONE governed account erasure (migration 0164:
 * Matching / Introductions plus the unchanged Personal erasure) and adds its recovery and visibility pass
 * (AccountErasureRecoveryWorker) beside it, on the same server channel.
 *
 * S6-07 (CP1) composes the owner's governed Matching enrollment (IntroductionsEnrollmentModule) here for the same reason
 * as the other Introductions modules. It shares nothing with these providers or with them, holds no service_role path
 * and imports no AI runtime.
 *
 * S6-07 (CP2) composes the forward dispatcher's server pass (IntroductionsDispatchModule) here for the same reason. It has
 * no controller and no route; its one service_role call reaches the ONE database dispatcher (migration 0166), and it
 * shares nothing with these providers or the other Introductions modules.
 *
 * S7-01 composes the owner's Personal Replay boundary (ReplayModule, migration 0169) here for the same reason: it is the
 * owner's own account-scoped Replay of their own conversations. It shares nothing with these providers, holds no
 * service_role path and imports no AI runtime, mobile or graphics code.
 */
@Module({
  imports: [ObservabilityModule, IntroductionsPreparationModule, IntroductionsLifecycleModule, IntroductionsProposalsModule, IntroductionsWorldModule,
    IntroductionsDisclosureModule, IntroductionsContinuationModule, IntroductionsEnrollmentModule, IntroductionsDispatchModule,
    ReplayModule],
  controllers: [AccountController, LoginIdSignInController, AccountSecurityController, PrivacyDataController],
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
    AccountIdentityRepository,
    AccountSecurityService,
    PrivacyDataRepository,
    PrivacyDataService,
    PrivacyMaintenanceRepository,
    ProviderAccountRemovalService,
    PrivacyMaintenanceWorker,
    AccountErasureRecoveryWorker,
  ],
})
export class AccountModule {}
