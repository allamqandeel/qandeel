import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { QandeelThrottlerGuard, rateLimitModuleOptions } from './rate-limit.policy';

/**
 * PROD-SEC-01 (SEC-A) — the global request rate limit. A global guard runs before every controller-level guard, so a
 * refused request reaches no authentication call, no database and no provider. Process-local by design: see
 * `rate-limit.policy.ts`.
 */
@Module({
  imports: [ThrottlerModule.forRoot(rateLimitModuleOptions())],
  providers: [{ provide: APP_GUARD, useClass: QandeelThrottlerGuard }],
})
export class HttpSecurityModule {}
