import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ConversationService } from './conversation.service';

@Controller('conversation')
@UseGuards(SupabaseAuthGuard)
export class ConversationController {
  constructor(private readonly conversations: ConversationService) {}

  // COSMOS E-2 corrections, Slice B (the Product Owner's D-2, 2026-11-20): an optional `clientRequestId` makes the
  // creation idempotent (migration 0197); without it the route is the unchanged 0030 creation.
  @Post('sessions')
  createSession(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.conversations.createSession(userId, accessToken, body);
  }

  // Slice B: the caller's own conversation catalog (the server-authoritative list behind New Chat / reopen). Read-only.
  @Get('sessions')
  listSessions(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.conversations.listSessions(userId, accessToken, query);
  }

  // Slice B: the durable manual title of one owned Session (an append to the 0197 ledger).
  @Patch('sessions/:sessionId/title')
  renameSession(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string, @Body() body: unknown) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.conversations.renameSession(userId, accessToken, sessionId, body);
  }

  @Get('sessions/:sessionId')
  resumeSession(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.conversations.resumeSession(userId, accessToken, sessionId);
  }

  // W1A-01 (E2E-B-04): the authoritative conversation-so-far of one owned Session. Read-only.
  @Get('sessions/:sessionId/turns')
  listTurns(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string, @Query() query: unknown) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.conversations.listTurns(userId, accessToken, sessionId, query);
  }

  @Post('sessions/:sessionId/turns')
  createTurn(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string, @Body() body: unknown) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.conversations.createTurn(userId, accessToken, sessionId, body);
  }

  @Patch('sessions/:sessionId/turns/:turnId/cancel')
  cancelTurn(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string, @Param('turnId') turnId: string) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.conversations.cancelTurn(userId, accessToken, sessionId, turnId);
  }
}
