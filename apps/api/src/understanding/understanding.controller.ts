import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UnderstandingService } from './understanding.service';

/**
 * W3-MEGA-U — the «فهم قنديل» / QANDEEL Understanding Product routes. Owner-only reads.
 *
 *   GET /understanding/items?limit=N   — the caller's current understanding, most recently changed first (guarded)
 *   GET /understanding/items/:ref      — one of the caller's items, with its user-facing explanation (guarded)
 *   POST   /understanding/items/:ref/discussion — "talk to QANDEEL about this", at the revision seen (guarded, U2)
 *   DELETE /understanding/items/:ref/discussion — close that discussion focus (guarded, U2)
 *
 * Identity is the verified token only; no route takes a user id, and `:ref` is an opaque token that resolves only
 * against the caller's own items.
 */
@Controller('understanding')
@UseGuards(SupabaseAuthGuard)
export class UnderstandingController {
  constructor(private readonly understanding: UnderstandingService) {}

  @Get('items')
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.understanding.list(userId, accessToken, query);
  }

  @Get('items/:ref')
  detail(@Req() request: AuthenticatedRequest, @Param('ref') ref: string) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.understanding.detail(userId, accessToken, ref);
  }

  /** U2 — "talk to QANDEEL about this": the reader's explicit choice of this item, at the revision they saw. */
  @Post('items/:ref/discussion')
  @HttpCode(204)
  async openDiscussion(@Req() request: AuthenticatedRequest, @Param('ref') ref: string, @Body() body: unknown): Promise<void> {
    const { userId, accessToken } = request.authenticatedUser;
    await this.understanding.openDiscussion(userId, accessToken, ref, body);
  }

  @Delete('items/:ref/discussion')
  @HttpCode(204)
  async closeDiscussion(@Req() request: AuthenticatedRequest, @Param('ref') ref: string): Promise<void> {
    const { userId, accessToken } = request.authenticatedUser;
    await this.understanding.closeDiscussion(userId, accessToken, ref);
  }
}
