import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ReplayService } from './replay.service';

/**
 * S7-01 - the Personal Replay boundary (migration 0169). Owner-only; identity is the verified token.
 *
 *   GET  /replay/capability                                              -> { creationAvailable }
 *   GET  /replay/conversations/:sessionId                                -> { replays }          (one conversation, the caller's own; not a library)
 *   POST /replay/drafts                 { commandId, sessionId, firstTc, lastTc }                -> CREATED | a bounded refusal
 *   POST /replay/:replayId/revisions    { commandId, expectedDraftRevision, firstTc, lastTc }    -> REVISED | a bounded refusal
 *   POST /replay/:replayId/preview      { commandId, expectedDraftRevision }                     -> PREVIEW_READY | a bounded refusal
 *   POST /replay/:replayId/finalize     { commandId, expectedVersionId }                         -> FINALIZED | a bounded refusal
 *   POST /replay/:replayId/reopen       { commandId, expectedVersionId }                         -> REOPENED | a bounded refusal
 *   GET  /replay/:replayId                                               -> FOUND | UNAVAILABLE
 *   GET  /replay/:replayId/versions/:versionId                           -> FOUND | UNAVAILABLE
 *   GET  /replay/:replayId/versions/:versionId/moments                   -> FOUND | UNAVAILABLE
 *   GET  /replay/:replayId/versions/:versionId/moments/:ordinal/analysis ?depth=<one of the five frozen depths, default WORLD>
 *                                                                        -> AVAILABLE | NOT_VIEWABLE | ANALYSIS_NOT_CURRENTLY_AVAILABLE | UNAVAILABLE
 *
 * No route takes a user id, an owner, a source class, a Conversation Unit or a manifest. A selection is one contiguous
 * range of whole messages, named by its first and last Session Position. No route exports, downloads, publishes,
 * distributes or shares a Replay: a finalized version is private.
 */
@Controller('replay')
@UseGuards(SupabaseAuthGuard)
export class ReplayController {
  constructor(private readonly replays: ReplayService) {}

  @Get('capability')
  capability(@Req() request: AuthenticatedRequest) {
    return this.replays.capability(request.authenticatedUser.accessToken);
  }

  @Get('conversations/:sessionId')
  conversationReplays(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.replays.conversationReplays(request.authenticatedUser.accessToken, sessionId);
  }

  @Post('drafts')
  @HttpCode(200)
  createDraft(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.replays.createDraft(request.authenticatedUser.accessToken, body);
  }

  @Post(':replayId/revisions')
  @HttpCode(200)
  reviseDraft(@Req() request: AuthenticatedRequest, @Param('replayId') replayId: string, @Body() body: unknown) {
    return this.replays.reviseDraft(request.authenticatedUser.accessToken, replayId, body);
  }

  @Post(':replayId/preview')
  @HttpCode(200)
  preparePreview(@Req() request: AuthenticatedRequest, @Param('replayId') replayId: string, @Body() body: unknown) {
    return this.replays.preparePreview(request.authenticatedUser.accessToken, replayId, body);
  }

  @Post(':replayId/finalize')
  @HttpCode(200)
  finalize(@Req() request: AuthenticatedRequest, @Param('replayId') replayId: string, @Body() body: unknown) {
    return this.replays.finalize(request.authenticatedUser.accessToken, replayId, body);
  }

  @Post(':replayId/reopen')
  @HttpCode(200)
  reopen(@Req() request: AuthenticatedRequest, @Param('replayId') replayId: string, @Body() body: unknown) {
    return this.replays.reopen(request.authenticatedUser.accessToken, replayId, body);
  }

  @Get(':replayId')
  replay(@Req() request: AuthenticatedRequest, @Param('replayId') replayId: string) {
    return this.replays.replay(request.authenticatedUser.accessToken, replayId);
  }

  @Get(':replayId/versions/:versionId')
  version(@Req() request: AuthenticatedRequest, @Param('replayId') replayId: string, @Param('versionId') versionId: string) {
    return this.replays.version(request.authenticatedUser.accessToken, replayId, versionId);
  }

  @Get(':replayId/versions/:versionId/moments')
  moments(@Req() request: AuthenticatedRequest, @Param('replayId') replayId: string, @Param('versionId') versionId: string) {
    return this.replays.moments(request.authenticatedUser.accessToken, replayId, versionId);
  }

  @Get(':replayId/versions/:versionId/moments/:ordinal/analysis')
  momentAnalysis(@Req() request: AuthenticatedRequest, @Param('replayId') replayId: string, @Param('versionId') versionId: string,
    @Param('ordinal') ordinal: string, @Query('depth') depth?: string) {
    return this.replays.momentAnalysis(request.authenticatedUser.accessToken, replayId, versionId, ordinal, depth);
  }
}
