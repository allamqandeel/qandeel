import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AccountService } from './account.service';

/**
 * W1B-01 — the account's Product routes.
 *
 *   GET  /account/first-use                 — the caller's own Name and first-use state (guarded)
 *   POST /account/first-use/welcome         — complete the caller's own Welcome step (guarded)
 *   GET  /account/public-id                 — the caller's own Public ID and allowance (guarded, W3-02)
 *   POST /account/public-id/change          — the caller's one lifetime Public ID change (guarded, W3-02)
 *   POST /account/login-id-availability     — may this Login ID still be chosen? (pre-authentication)
 *
 * The guarded routes act only with the caller's own token; none takes an account id. The availability route is the only
 * one a signed-out reader can reach, because a Login ID is chosen before an account exists; it answers
 * a boolean, and the Login ID travels in the body, never in a URL.
 */
@Controller('account')
export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  @Get('first-use')
  @UseGuards(SupabaseAuthGuard)
  readFirstUse(@Req() request: AuthenticatedRequest) {
    return this.accounts.readFirstUse(request.authenticatedUser.accessToken);
  }

  @Post('first-use/welcome')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(204)
  async completeWelcome(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.accounts.completeWelcome(request.authenticatedUser.accessToken);
  }

  @Get('public-id')
  @UseGuards(SupabaseAuthGuard)
  readPublicId(@Req() request: AuthenticatedRequest) {
    return this.accounts.readPublicId(request.authenticatedUser.accessToken);
  }

  @Post('public-id/change')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(200)
  changePublicId(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.accounts.changePublicId(request.authenticatedUser.accessToken, body);
  }

  @Post('login-id-availability')
  @HttpCode(200)
  checkLoginIdAvailability(@Body() body: unknown) {
    return this.accounts.checkLoginIdAvailability(body);
  }
}
