import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { IntroductionWorldService } from './introduction-world.service';

/**
 * S6-05 (CP3, CP4) - the Introduction World's human conversation (migration 0160) and, after END, the closed history each
 * human is entitled to keep (migration 0161). Owner-only; identity is the verified token.
 *
 *   GET  /introductions/worlds                                                           -> { worlds }
 *   GET  /introductions/worlds/:worldId/messages                                         -> { outcome: ACTIVE, messages, hasOlder } | ENDED | UNAVAILABLE
 *   GET  /introductions/worlds/:worldId/messages/before/:materialId/:establishedAt       -> the same, strictly older
 *   POST /introductions/worlds/:worldId/messages        { commandId, content }           -> { outcome: COMMITTED, materialId, establishedAt } | ENDED | UNAVAILABLE | COMMAND_CONFLICT
 *   GET  /introductions/worlds/:worldId/history                                          -> { outcome: ENDED, messages, hasOlder } | UNAVAILABLE   (CP4, 0161)
 *   GET  /introductions/worlds/:worldId/history/before/:materialId/:establishedAt        -> the same, strictly older                                 (CP4, 0161)
 *
 * No route takes a user id, a counterpart, an audience or a kind. Deleting one's own message is the existing Shared owner
 * deletion (R-5): POST /shared/worlds/:worldId/materials/:materialId/delete. END is the S6-02 route.
 */
@Controller('introductions')
@UseGuards(SupabaseAuthGuard)
export class IntroductionWorldController {
  constructor(private readonly introductions: IntroductionWorldService) {}

  @Get('worlds')
  worlds(@Req() request: AuthenticatedRequest) {
    return this.introductions.worlds(request.authenticatedUser.accessToken);
  }

  @Get('worlds/:worldId/messages')
  messages(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string) {
    return this.introductions.messages(request.authenticatedUser.accessToken, worldId);
  }

  @Get('worlds/:worldId/messages/before/:materialId/:establishedAt')
  olderMessages(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Param('materialId') materialId: string,
    @Param('establishedAt') establishedAt: string) {
    return this.introductions.olderMessages(request.authenticatedUser.accessToken, worldId, materialId, establishedAt);
  }

  @Post('worlds/:worldId/messages')
  @HttpCode(200)
  send(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    return this.introductions.send(request.authenticatedUser.accessToken, worldId, body);
  }

  @Get('worlds/:worldId/history')
  history(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string) {
    return this.introductions.history(request.authenticatedUser.accessToken, worldId);
  }

  @Get('worlds/:worldId/history/before/:materialId/:establishedAt')
  olderHistory(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Param('materialId') materialId: string,
    @Param('establishedAt') establishedAt: string) {
    return this.introductions.olderHistory(request.authenticatedUser.accessToken, worldId, materialId, establishedAt);
  }
}
