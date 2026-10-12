import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { InteractionPreferencesService } from './interaction-preferences.service';

/**
 * IP-IMP-01 — the «تفضيلات التعامل» / Interaction Preferences routes. Owner-only.
 *
 *   GET  /interaction-preferences                    — the four preferences and the record version
 *   PUT  /interaction-preferences                    — { field, value, expectedVersion }: one field, compare-and-set
 *   GET  /interaction-preferences/legacy-review      — the owner's eligible SELF legacy preference Memories (may be empty)
 *   POST /interaction-preferences/legacy-review      — { memoryId, expectedVersion }: adopt what that Memory states
 *
 * Identity is the verified token only; no route takes a user id.
 */
@Controller('interaction-preferences')
@UseGuards(SupabaseAuthGuard)
export class InteractionPreferencesController {
  constructor(private readonly preferences: InteractionPreferencesService) {}

  @Get()
  read(@Req() request: AuthenticatedRequest) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.preferences.view(userId, accessToken);
  }

  @Put()
  set(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.preferences.set(userId, accessToken, body);
  }

  @Get('legacy-review')
  legacyReview(@Req() request: AuthenticatedRequest) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.preferences.legacyReview(userId, accessToken);
  }

  @Post('legacy-review')
  applyLegacy(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.preferences.applyLegacy(userId, accessToken, body);
  }
}
