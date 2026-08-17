import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ConversationService } from './conversation.service';

@Controller('conversation')
@UseGuards(SupabaseAuthGuard)
export class ConversationController {
  constructor(private readonly conversations: ConversationService) {}

  @Post('sessions')
  createSession(@Req() request: AuthenticatedRequest) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.conversations.createSession(userId, accessToken);
  }

  @Get('sessions/:sessionId')
  resumeSession(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.conversations.resumeSession(userId, accessToken, sessionId);
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
