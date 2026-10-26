import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PublicComposeService } from './public-compose.service';

/**
 * S8A-05 CP1 — «اكتب موضوعك» / Write your topic inside «العالم العام». Owner-only; identity is the verified token.
 *
 *   GET  /public/compose/drafts                                  the caller's own private topic drafts
 *   GET  /public/compose/drafts/:draftId                         one own draft, whole
 *   PUT  /public/compose/drafts/:draftId                         create (revision 0) or save { expectedRevision, title, text, section }
 *   POST /public/compose/drafts/:draftId/delete                  delete it, its words gone { commandId }
 *   GET  /public/compose/drafts/:draftId/preview                 exactly what the Public World would show, and the privacy notes
 *   POST /public/compose/drafts/:draftId/prepare                 prepare it for publication { commandId, expectedRevision } —
 *                                                                CLOSED until Stage 9 (PUBLICATION_NOT_OPEN, nothing written)
 *   POST /public/compose/topics/:experienceId/discard            return a never-published topic to its draft { commandId }
 *   POST /public/compose/topics/:experienceId/section            change its section — never its place { commandId, section }
 *
 * No route takes a user id, a Public ref, a label, an approver, an authority, an audience or a clearance, and no route
 * publishes.
 */
@Controller('public/compose')
@UseGuards(SupabaseAuthGuard)
export class PublicComposeController {
  constructor(private readonly compose: PublicComposeService) {}

  @Get('drafts')
  drafts(@Req() request: AuthenticatedRequest) {
    return this.compose.drafts(request.authenticatedUser.accessToken);
  }

  @Get('drafts/:draftId')
  draft(@Req() request: AuthenticatedRequest, @Param('draftId') draftId: string) {
    return this.compose.draft(request.authenticatedUser.accessToken, draftId);
  }

  @Put('drafts/:draftId')
  save(@Req() request: AuthenticatedRequest, @Param('draftId') draftId: string, @Body() body: unknown) {
    return this.compose.save(request.authenticatedUser.accessToken, draftId, body);
  }

  @Post('drafts/:draftId/delete')
  remove(@Req() request: AuthenticatedRequest, @Param('draftId') draftId: string, @Body() body: unknown) {
    return this.compose.remove(request.authenticatedUser.accessToken, draftId, body);
  }

  @Get('drafts/:draftId/preview')
  preview(@Req() request: AuthenticatedRequest, @Param('draftId') draftId: string) {
    return this.compose.preview(request.authenticatedUser.accessToken, draftId);
  }

  @Post('drafts/:draftId/prepare')
  prepare(@Req() request: AuthenticatedRequest, @Param('draftId') draftId: string, @Body() body: unknown) {
    return this.compose.prepare(request.authenticatedUser.accessToken, draftId, body);
  }

  @Post('topics/:experienceId/discard')
  discard(@Req() request: AuthenticatedRequest, @Param('experienceId') experienceId: string, @Body() body: unknown) {
    return this.compose.discard(request.authenticatedUser.accessToken, experienceId, body);
  }

  @Post('topics/:experienceId/section')
  section(@Req() request: AuthenticatedRequest, @Param('experienceId') experienceId: string, @Body() body: unknown) {
    return this.compose.section(request.authenticatedUser.accessToken, experienceId, body);
  }
}
