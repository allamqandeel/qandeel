import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PublicSemanticService } from './public-semantic.service';

/**
 * S5-03A — the semantic review of a READY_FOR_REVIEW Public Experience. Owner-only; identity is the verified token.
 *
 *   GET  /public/authoring/drafts/:experienceId/semantic              QANDEEL's understanding of the exact current version
 *   POST /public/authoring/drafts/:experienceId/semantic/proposal     ask QANDEEL to propose it { commandId }
 *   POST /public/authoring/drafts/:experienceId/semantic/accept       accept exactly the revision seen { commandId, interpretationId }
 *   POST /public/authoring/drafts/:experienceId/semantic/correction   correct the meaning { commandId, interpretationId, meaning,
 *                                                                     primaryThemes, secondaryThemes }
 *
 * No route takes a user id, a Public ref, a controller, a lifecycle, a readiness, a fingerprint, a lens, a coordinate,
 * a rank, a proximity target or a vector, and no route publishes: the lifecycle stays READY_FOR_REVIEW.
 */
@Controller('public/authoring/drafts/:experienceId/semantic')
@UseGuards(SupabaseAuthGuard)
export class PublicSemanticController {
  constructor(private readonly semantic: PublicSemanticService) {}

  @Get()
  review(@Req() request: AuthenticatedRequest, @Param('experienceId') experienceId: string) {
    return this.semantic.review(request.authenticatedUser.accessToken, experienceId);
  }

  @Post('proposal')
  proposal(@Req() request: AuthenticatedRequest, @Param('experienceId') experienceId: string, @Body() body: unknown) {
    return this.semantic.proposal(request.authenticatedUser.accessToken, experienceId, body);
  }

  @Post('accept')
  accept(@Req() request: AuthenticatedRequest, @Param('experienceId') experienceId: string, @Body() body: unknown) {
    return this.semantic.accept(request.authenticatedUser.accessToken, experienceId, body);
  }

  @Post('correction')
  correction(@Req() request: AuthenticatedRequest, @Param('experienceId') experienceId: string, @Body() body: unknown) {
    return this.semantic.correction(request.authenticatedUser.accessToken, experienceId, body);
  }
}
