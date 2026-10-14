import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { IntroductionsPreparationService } from './introductions-preparation.service';

/**
 * S6-01 — «التعارف مع قنديل» / Introductions with QANDEEL: the owner's pre-enrollment preparation. Owner-only.
 *
 *   GET  /introductions/availability                     — presentation hints (preparation / assistance available,
 *                                                          enrollment never, whether a draft exists)
 *   GET  /introductions/preparation                      — the owner's draft, authorized prior items and the objective plan
 *   POST /introductions/preparation/commands             — { commandId, expectedVersion, kind, payload }
 *   POST /introductions/preparation/discard              — { commandId }
 *   POST /introductions/preparation/assistance/grant     — { commandId, consentVersion }
 *   POST /introductions/preparation/assistance/revoke    — { commandId }
 *
 * Identity is the verified token only; no route takes a user id. No route enrolls, evaluates or proposes.
 */
@Controller('introductions')
@UseGuards(SupabaseAuthGuard)
export class IntroductionsPreparationController {
  constructor(private readonly preparation: IntroductionsPreparationService) {}

  @Get('availability')
  availability(@Req() request: AuthenticatedRequest) {
    return this.preparation.availability(request.authenticatedUser.accessToken);
  }

  @Get('preparation')
  read(@Req() request: AuthenticatedRequest) {
    return this.preparation.view(request.authenticatedUser.accessToken);
  }

  @Post('preparation/commands')
  @HttpCode(200)
  command(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.preparation.command(request.authenticatedUser.accessToken, body);
  }

  @Post('preparation/discard')
  @HttpCode(200)
  discard(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.preparation.discard(request.authenticatedUser.accessToken, body);
  }

  @Post('preparation/assistance/grant')
  @HttpCode(200)
  grant(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.preparation.grantAssistance(request.authenticatedUser.accessToken, body);
  }

  @Post('preparation/assistance/revoke')
  @HttpCode(200)
  revoke(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.preparation.revokeAssistance(request.authenticatedUser.accessToken, body);
  }
}
