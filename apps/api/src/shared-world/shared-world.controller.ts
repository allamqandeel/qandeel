import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SharedWorldConversationService } from './shared-world-conversation.service';
import { SharedWorldService } from './shared-world.service';

/**
 * S4-01 — the «العالم المشترك» / Shared World Product routes. Owner-only; identity is the verified token.
 *
 *   GET  /shared                                   — the root: current Worlds, incoming invitations, capability hints
 *   GET  /shared/identity                          — the owner's current Shared ID (provisioned on first read)
 *   POST /shared/identity/regenerate               — { commandId }
 *   POST /shared/invitations                       — { commandId, sharedId } → one non-enumerating outcome
 *   POST /shared/invitations/:invitationId/accept  — { commandId } → the launch-gated birth
 *   POST /shared/invitations/:invitationId/decline — { commandId }
 *   GET  /shared/worlds/:worldId                   — the entry verdict, then the World shell, current members only
 *
 * S4-02 — the Shared conversation over migration 0139:
 *
 *   GET  /shared/worlds/:worldId/materials                     — the entry verdict, then the newest page of visible material
 *   GET  /shared/worlds/:worldId/materials/before/:materialId/:establishedAt
 *                                                              — the entry verdict, then the one page strictly older than
 *                                                                the oldest material the reader holds
 *   POST /shared/worlds/:worldId/messages                      — { commandId, content } → the human's words, then
 *                                                                QANDEEL's one reply as a separate outcome
 *   POST /shared/worlds/:worldId/materials/:materialId/delete  — { commandId } → the owner's own words only
 *
 * No route takes a user id, an inviter, a target, an author, a viewer or member list, an audience, a material kind or a
 * World authority.
 */
@Controller('shared')
@UseGuards(SupabaseAuthGuard)
export class SharedWorldController {
  constructor(private readonly shared: SharedWorldService, private readonly conversation: SharedWorldConversationService) {}

  @Get()
  root(@Req() request: AuthenticatedRequest) {
    return this.shared.root(request.authenticatedUser.accessToken);
  }

  @Get('identity')
  identity(@Req() request: AuthenticatedRequest) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.shared.identity(userId, accessToken);
  }

  @Post('identity/regenerate')
  @HttpCode(200)
  regenerate(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.shared.regenerate(userId, accessToken, body);
  }

  @Post('invitations')
  @HttpCode(200)
  invite(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.shared.invite(request.authenticatedUser.accessToken, body);
  }

  @Post('invitations/:invitationId/accept')
  @HttpCode(200)
  accept(@Req() request: AuthenticatedRequest, @Param('invitationId') invitationId: string, @Body() body: unknown) {
    return this.shared.accept(request.authenticatedUser.accessToken, invitationId, body);
  }

  @Post('invitations/:invitationId/decline')
  @HttpCode(200)
  decline(@Req() request: AuthenticatedRequest, @Param('invitationId') invitationId: string, @Body() body: unknown) {
    return this.shared.decline(request.authenticatedUser.accessToken, invitationId, body);
  }

  @Get('worlds/:worldId')
  entry(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string) {
    return this.shared.entry(request.authenticatedUser.accessToken, worldId);
  }

  @Get('worlds/:worldId/materials')
  materials(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string) {
    return this.conversation.materials(request.authenticatedUser.accessToken, worldId);
  }

  @Get('worlds/:worldId/materials/before/:materialId/:establishedAt')
  olderMaterials(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Param('materialId') materialId: string, @Param('establishedAt') establishedAt: string) {
    return this.conversation.olderMaterials(request.authenticatedUser.accessToken, worldId, materialId, establishedAt);
  }

  @Post('worlds/:worldId/messages')
  @HttpCode(200)
  send(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.conversation.send(userId, accessToken, worldId, body);
  }

  @Post('worlds/:worldId/materials/:materialId/delete')
  @HttpCode(200)
  deleteMaterial(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Param('materialId') materialId: string, @Body() body: unknown) {
    return this.conversation.deleteMaterial(request.authenticatedUser.accessToken, worldId, materialId, body);
  }
}
