import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PublicAuthoringService } from './public-authoring.service';

/**
 * S5-02 — Public authoring inside «العالم العام» / Public World. Owner-only; identity is the verified token.
 *
 *   GET  /public/authoring                                   the caller's own non-public Drafts
 *   GET  /public/authoring/sources                           the caller's own eligible EXISTING material
 *   POST /public/authoring/drafts                            start a Draft { commandId }
 *   POST /public/authoring/drafts/:experienceId/package      prepare the exact package { commandId, personal, shared }
 *   GET  /public/authoring/drafts/:experienceId/review       the controller's review of exactly what would become public
 *   POST /public/authoring/drafts/:experienceId/ready        DRAFT → READY_FOR_REVIEW { commandId }
 *   GET  /public/authoring/approvals                         the caller's own content-approval requests
 *   POST /public/authoring/approvals/:manifestId/approve     approve one exact package { commandId }
 *   POST /public/authoring/approvals/:manifestId/withdraw    withdraw one's own approval { commandId }
 *
 * No route takes a user id, a Public ref, a label, an approver, an authority, an audience, a body text or a clearance,
 * and no route publishes: the lifecycle reachable here ends at READY_FOR_REVIEW, which is not public.
 */
@Controller('public/authoring')
@UseGuards(SupabaseAuthGuard)
export class PublicAuthoringController {
  constructor(private readonly authoring: PublicAuthoringService) {}

  @Get()
  drafts(@Req() request: AuthenticatedRequest) {
    return this.authoring.drafts(request.authenticatedUser.accessToken);
  }

  @Get('sources')
  sources(@Req() request: AuthenticatedRequest) {
    return this.authoring.sources(request.authenticatedUser.accessToken);
  }

  @Post('drafts')
  startDraft(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.authoring.startDraft(request.authenticatedUser.accessToken, body);
  }

  @Post('drafts/:experienceId/package')
  preparePackage(@Req() request: AuthenticatedRequest, @Param('experienceId') experienceId: string, @Body() body: unknown) {
    return this.authoring.preparePackage(request.authenticatedUser.accessToken, experienceId, body);
  }

  @Get('drafts/:experienceId/review')
  review(@Req() request: AuthenticatedRequest, @Param('experienceId') experienceId: string) {
    return this.authoring.review(request.authenticatedUser.accessToken, experienceId);
  }

  @Post('drafts/:experienceId/ready')
  ready(@Req() request: AuthenticatedRequest, @Param('experienceId') experienceId: string, @Body() body: unknown) {
    return this.authoring.ready(request.authenticatedUser.accessToken, experienceId, body);
  }

  @Get('approvals')
  approvalRequests(@Req() request: AuthenticatedRequest) {
    return this.authoring.approvalRequests(request.authenticatedUser.accessToken);
  }

  @Post('approvals/:manifestId/approve')
  approve(@Req() request: AuthenticatedRequest, @Param('manifestId') manifestId: string, @Body() body: unknown) {
    return this.authoring.approve(request.authenticatedUser.accessToken, manifestId, body);
  }

  @Post('approvals/:manifestId/withdraw')
  withdraw(@Req() request: AuthenticatedRequest, @Param('manifestId') manifestId: string, @Body() body: unknown) {
    return this.authoring.withdraw(request.authenticatedUser.accessToken, manifestId, body);
  }
}
