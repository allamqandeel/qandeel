import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PublicDiscussionService } from './public-discussion.service';

/**
 * S5-04 — the dependent discussion of ONE Public Experience, reached from its panel at NEAR. Viewer routes; identity is
 * the verified token, and the database decides admission, visibility, the exact version, entitlement and everything the
 * discussion stores.
 *
 *   GET  /public/field/experiences/:experienceId/discussion                       the discussion (?after=<ordinal> pages)
 *   POST /public/field/experiences/:experienceId/discussion                       { commandId, text, replyTo } → post / reply
 *   POST /public/field/experiences/:experienceId/discussion/:postId/qandeel       {} — ask again for the one response of
 *                                                                                 the reader's own invoking post
 *
 * No route takes a user, an author, an identity, a version, a visibility, an ordinal, an instant, a recipient or an
 * entitlement verdict. There is no like, follow, rank, count-as-score, contact or private-message route.
 */
@Controller('public/field/experiences/:experienceId/discussion')
@UseGuards(SupabaseAuthGuard)
export class PublicDiscussionController {
  constructor(private readonly discussion: PublicDiscussionService) {}

  @Get()
  read(@Req() request: AuthenticatedRequest, @Param('experienceId') experienceId: string, @Query() query: unknown) {
    return this.discussion.read(request.authenticatedUser.accessToken, experienceId, query);
  }

  @Post()
  post(@Req() request: AuthenticatedRequest, @Param('experienceId') experienceId: string, @Body() body: unknown) {
    return this.discussion.post(request.authenticatedUser.userId, request.authenticatedUser.accessToken, experienceId, body);
  }

  @Post(':postId/qandeel')
  retryQandeel(@Req() request: AuthenticatedRequest, @Param('experienceId') experienceId: string, @Param('postId') postId: string,
    @Body() body: unknown) {
    return this.discussion.retryQandeel(request.authenticatedUser.userId, experienceId, postId, body);
  }
}
