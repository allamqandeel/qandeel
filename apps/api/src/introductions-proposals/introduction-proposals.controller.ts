import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { IntroductionProposalsService } from './introduction-proposals.service';

/**
 * S6-04 - a human's own private Introduction proposals (migration 0158). Owner-only; identity is the verified token.
 *
 *   GET  /introductions/proposals                                 ?after=&limit=  -> { proposals, next }
 *   GET  /introductions/proposals/:proposalId                                     -> { proposal | null }
 *   POST /introductions/proposals/:proposalId/forward-approval    { commandId, viewId } -> { outcome, proposal }
 *   POST /introductions/proposals/:proposalId/decline             { commandId, viewId } -> { outcome, proposal }
 *   POST /introductions/proposals/:proposalId/withdrawal          { commandId, viewId } -> { outcome, proposal }
 *   POST /introductions/proposals/:proposalId/acceptance          { commandId, viewId } -> { outcome, worldId, proposal }
 *
 * No route takes a user id, a counterpart, a role, a state or a World. The acceptance (S6-05, migration 0159) is the
 * second recipient's Mutual Match: the database derives everything else and answers the born World only on MATCHED.
 */
@Controller('introductions')
@UseGuards(SupabaseAuthGuard)
export class IntroductionProposalsController {
  constructor(private readonly proposals: IntroductionProposalsService) {}

  @Get('proposals')
  list(@Req() request: AuthenticatedRequest, @Query('after') after: unknown, @Query('limit') limit: unknown) {
    return this.proposals.list(request.authenticatedUser.accessToken, after, limit);
  }

  @Get('proposals/:proposalId')
  get(@Req() request: AuthenticatedRequest, @Param('proposalId') proposalId: string) {
    return this.proposals.get(request.authenticatedUser.accessToken, proposalId);
  }

  @Post('proposals/:proposalId/forward-approval')
  @HttpCode(200)
  approveForward(@Req() request: AuthenticatedRequest, @Param('proposalId') proposalId: string, @Body() body: unknown) {
    return this.proposals.decide(request.authenticatedUser.accessToken, 'forward-approval', proposalId, body);
  }

  @Post('proposals/:proposalId/decline')
  @HttpCode(200)
  decline(@Req() request: AuthenticatedRequest, @Param('proposalId') proposalId: string, @Body() body: unknown) {
    return this.proposals.decide(request.authenticatedUser.accessToken, 'decline', proposalId, body);
  }

  @Post('proposals/:proposalId/withdrawal')
  @HttpCode(200)
  withdraw(@Req() request: AuthenticatedRequest, @Param('proposalId') proposalId: string, @Body() body: unknown) {
    return this.proposals.decide(request.authenticatedUser.accessToken, 'withdrawal', proposalId, body);
  }

  @Post('proposals/:proposalId/acceptance')
  @HttpCode(200)
  accept(@Req() request: AuthenticatedRequest, @Param('proposalId') proposalId: string, @Body() body: unknown) {
    return this.proposals.accept(request.authenticatedUser.accessToken, proposalId, body);
  }
}
