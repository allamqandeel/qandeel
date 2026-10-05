import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SharedWorldConversationService } from './shared-world-conversation.service';
import { SharedWorldLifecycleService } from './shared-world-lifecycle.service';
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
 * S4-03 — the Shared lifecycle over migration 0140:
 *
 *   GET  /shared/worlds/:worldId/manage                                  — the entry verdict, then «إدارة العالم» / Manage
 *                                                                          World: settings, members (opaque handles), the
 *                                                                          proposals and history requests that wait on THIS reader
 *   POST /shared/worlds/:worldId/leave                                   — { commandId } → LEFT / UNAVAILABLE (never gated)
 *   POST /shared/worlds/:worldId/proposals/settings                      — { commandId, name, description, topic }
 *   POST /shared/worlds/:worldId/proposals/removal                       — { commandId, memberHandle }
 *   POST /shared/worlds/:worldId/proposals/end                           — { commandId }
 *   POST /shared/worlds/:worldId/proposals/:proposalId/approve           — { commandId } → APPROVED / COMMITTED / STALE / UNAVAILABLE
 *   GET  /shared/worlds/:worldId/history-shares/candidates/:memberHandle — the earlier words the reader may offer one member
 *   POST /shared/worlds/:worldId/history-shares                          — { commandId, memberHandle, materialIds }
 *   POST /shared/worlds/:worldId/history-shares/:packageId/approve       — { commandId } → APPROVED / GRANTED / STALE / UNAVAILABLE
 *   GET  /shared/closed/:worldId[/before/:materialId/:establishedAt]     — an ended World, read-only, by closed-view entitlement
 *   GET  /shared/own-material[/before/:materialId/:establishedAt]        — the reader's own words in Worlds they no longer belong to
 *   POST /shared/own-material/:worldId/:materialId/delete                — { commandId } → the owner's deletion (0139, ungated)
 *
 * No route takes a user id, an inviter, a target, an author, a viewer or member list, an audience, a material kind, an
 * approver, an approval rule, a membership snapshot or a World authority.
 */
@Controller('shared')
@UseGuards(SupabaseAuthGuard)
export class SharedWorldController {
  constructor(
    private readonly shared: SharedWorldService,
    private readonly conversation: SharedWorldConversationService,
    private readonly lifecycle: SharedWorldLifecycleService,
  ) {}

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

  @Get('worlds/:worldId/manage')
  manage(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string) {
    return this.lifecycle.manage(request.authenticatedUser.accessToken, worldId);
  }

  @Post('worlds/:worldId/leave')
  @HttpCode(200)
  leave(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    return this.lifecycle.leave(request.authenticatedUser.accessToken, worldId, body);
  }

  @Post('worlds/:worldId/proposals/settings')
  @HttpCode(200)
  proposeSettings(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    return this.lifecycle.proposeSettings(request.authenticatedUser.accessToken, worldId, body);
  }

  @Post('worlds/:worldId/proposals/removal')
  @HttpCode(200)
  proposeRemoval(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    return this.lifecycle.proposeRemoval(request.authenticatedUser.accessToken, worldId, body);
  }

  @Post('worlds/:worldId/proposals/end')
  @HttpCode(200)
  proposeEnd(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    return this.lifecycle.proposeEnd(request.authenticatedUser.accessToken, worldId, body);
  }

  @Post('worlds/:worldId/proposals/member')
  @HttpCode(200)
  proposeMember(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    return this.lifecycle.proposeMember(request.authenticatedUser.accessToken, worldId, body);
  }

  @Post('membership-requests/:worldId/:requestId/accept')
  @HttpCode(200)
  acceptMembershipRequest(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Param('requestId') requestId: string, @Body() body: unknown) {
    return this.lifecycle.acceptMembershipRequest(request.authenticatedUser.accessToken, worldId, requestId, body);
  }

  @Post('worlds/:worldId/proposals/:proposalId/approve')
  @HttpCode(200)
  approve(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Param('proposalId') proposalId: string, @Body() body: unknown) {
    return this.lifecycle.approve(request.authenticatedUser.accessToken, worldId, proposalId, body);
  }

  @Get('worlds/:worldId/history-shares/candidates/:memberHandle')
  historyCandidates(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Param('memberHandle') memberHandle: string) {
    return this.lifecycle.historyCandidates(request.authenticatedUser.accessToken, worldId, memberHandle);
  }

  @Get('worlds/:worldId/history-shares/candidates/:memberHandle/before/:materialId/:establishedAt')
  olderHistoryCandidates(
    @Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Param('memberHandle') memberHandle: string,
    @Param('materialId') materialId: string, @Param('establishedAt') establishedAt: string,
  ) {
    return this.lifecycle.historyCandidates(request.authenticatedUser.accessToken, worldId, memberHandle, materialId, establishedAt);
  }

  @Post('worlds/:worldId/history-shares')
  @HttpCode(200)
  proposeHistoryShare(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    return this.lifecycle.proposeHistoryShare(request.authenticatedUser.accessToken, worldId, body);
  }

  @Post('worlds/:worldId/history-shares/:packageId/approve')
  @HttpCode(200)
  approveHistoryShare(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Param('packageId') packageId: string, @Body() body: unknown) {
    return this.lifecycle.approveHistoryShare(request.authenticatedUser.accessToken, worldId, packageId, body);
  }

  @Get('closed/:worldId')
  closedWorld(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string) {
    return this.lifecycle.closedWorld(request.authenticatedUser.accessToken, worldId);
  }

  @Get('closed/:worldId/before/:materialId/:establishedAt')
  olderClosedMaterial(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Param('materialId') materialId: string, @Param('establishedAt') establishedAt: string) {
    return this.lifecycle.closedWorld(request.authenticatedUser.accessToken, worldId, materialId, establishedAt);
  }

  @Get('own-material')
  ownMaterial(@Req() request: AuthenticatedRequest) {
    return this.lifecycle.ownMaterial(request.authenticatedUser.accessToken);
  }

  @Get('own-material/history-shares')
  formerHistoryRequests(@Req() request: AuthenticatedRequest) {
    return this.lifecycle.formerHistoryRequests(request.authenticatedUser.accessToken);
  }

  @Post('own-material/history-shares/:worldId/:packageId/approve')
  @HttpCode(200)
  approveFormerHistoryShare(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Param('packageId') packageId: string, @Body() body: unknown) {
    return this.lifecycle.approveHistoryShare(request.authenticatedUser.accessToken, worldId, packageId, body);
  }

  @Get('own-material/before/:materialId/:establishedAt')
  olderOwnMaterial(@Req() request: AuthenticatedRequest, @Param('materialId') materialId: string, @Param('establishedAt') establishedAt: string) {
    return this.lifecycle.ownMaterial(request.authenticatedUser.accessToken, materialId, establishedAt);
  }

  @Post('own-material/:worldId/:materialId/delete')
  @HttpCode(200)
  deleteOwnMaterial(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Param('materialId') materialId: string, @Body() body: unknown) {
    return this.lifecycle.deleteOwnMaterial(request.authenticatedUser.accessToken, worldId, materialId, body);
  }
}
