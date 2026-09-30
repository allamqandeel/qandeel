import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AccountSecurityService } from './account-security.service';

type OwnerRequest = AuthenticatedRequest & { readonly ip?: string };

/**
 * W3-MEGA-A — the owner's Account & Identity and Security & Sign-in routes. Every route is guarded and acts only for
 * the verified token's account: no route takes an account, user or internal id. Values travel in the body, never a
 * URL. Every answer is `{ outcome, ... }` with the owner's own resulting state and nothing else.
 *
 *   GET  /account/identity                    { name, loginId, email, emailVerified } — the owner's own
 *   POST /account/name/change                 { name }                                 → CHANGED | UNCHANGED | INVALID
 *   POST /account/login-id/change             { commandId, loginId, password }         → CHANGED | UNCHANGED | INVALID |
 *                                                                                        UNAVAILABLE | PASSWORD_REJECTED; 409 conflict
 *   POST /account/email/change                { password, email }                      → ACCEPTED | UNCHANGED | INVALID_EMAIL | PASSWORD_REJECTED
 *   POST /account/email/confirm               { email, newEmailCode, currentEmailCode } → CHANGED | CODE_REJECTED
 *   POST /account/password/change             { password, newPassword }                → CHANGED | CHANGED_SIGNED_OUT | POLICY | PASSWORD_REJECTED
 *   POST /account/sessions/sign-out-others    {}                                       → SIGNED_OUT_OTHERS
 *
 * 400 for any other body, 503 whenever there is no usable answer (the client never guesses from it).
 */
@Controller('account')
@UseGuards(SupabaseAuthGuard)
export class AccountSecurityController {
  constructor(private readonly security: AccountSecurityService) {}

  @Get('identity')
  readIdentity(@Req() request: OwnerRequest) {
    return this.security.readIdentity(request.authenticatedUser.accessToken, request.ip);
  }

  @Post('name/change')
  @HttpCode(200)
  changeName(@Req() request: OwnerRequest, @Body() body: unknown) {
    return this.security.changeName(request.authenticatedUser.accessToken, body);
  }

  @Post('login-id/change')
  @HttpCode(200)
  changeLoginId(@Req() request: OwnerRequest, @Body() body: unknown) {
    return this.security.changeLoginId(request.authenticatedUser.accessToken, body, request.ip);
  }

  @Post('email/change')
  @HttpCode(200)
  requestEmailChange(@Req() request: OwnerRequest, @Body() body: unknown) {
    return this.security.requestEmailChange(request.authenticatedUser.accessToken, body, request.ip);
  }

  @Post('email/confirm')
  @HttpCode(200)
  confirmEmailChange(@Req() request: OwnerRequest, @Body() body: unknown) {
    return this.security.confirmEmailChange(request.authenticatedUser.accessToken, body, request.ip);
  }

  @Post('password/change')
  @HttpCode(200)
  changePassword(@Req() request: OwnerRequest, @Body() body: unknown) {
    return this.security.changePassword(request.authenticatedUser.accessToken, body, request.ip);
  }

  @Post('sessions/sign-out-others')
  @HttpCode(200)
  signOutOtherDevices(@Req() request: OwnerRequest) {
    return this.security.signOutOtherDevices(request.authenticatedUser.accessToken, request.ip);
  }
}
