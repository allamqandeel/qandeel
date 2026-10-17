import { Body, Controller, Get, Header, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { IntroductionContinuationService } from './introduction-continuation.service';

const NO_STORE = ['Cache-Control', 'no-store'] as const;

/**
 * S6-06 — continuing an Introduction as a Shared World (SUCCESS) and resuming Introductions afterwards. Each route is
 * the caller's own: no user, approver, counterpart or audience is ever accepted, and no route prepares a transition
 * (Stage 8A). In production there is no transition to approve and every resume answers NOT_AVAILABLE_NOW (CW2-08).
 */
@Controller('introductions')
@UseGuards(SupabaseAuthGuard)
export class IntroductionContinuationController {
  constructor(private readonly service: IntroductionContinuationService) {}

  @Get('worlds/:worldId/success')
  @Header(...NO_STORE)
  readSuccess(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string) {
    return this.service.readSuccess(request.authenticatedUser.accessToken, worldId);
  }

  @Post('worlds/:worldId/success/approval')
  @HttpCode(200)
  @Header(...NO_STORE)
  approve(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    return this.service.approve(request.authenticatedUser.accessToken, worldId, body);
  }

  @Post('worlds/:worldId/success/withdrawal')
  @HttpCode(200)
  @Header(...NO_STORE)
  withdraw(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    return this.service.withdraw(request.authenticatedUser.accessToken, worldId, body);
  }

  @Get('participation')
  @Header(...NO_STORE)
  readParticipation(@Req() request: AuthenticatedRequest) {
    return this.service.readParticipation(request.authenticatedUser.accessToken);
  }

  @Post('participation/resume')
  @HttpCode(200)
  @Header(...NO_STORE)
  reactivate(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.reactivate(request.authenticatedUser.accessToken, body);
  }
}
