import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ActivityService } from './activity.service';

/**
 * A3-01 — the «النشاط» / Activity Product routes (I-08N-01 + P3). Owner-only.
 *
 *   GET  /activity/items?limit=N&before=<id>&category=C — the caller's Activity, newest first (keyset pages)
 *   GET  /activity/attention?timeZone=<IANA>            — presence + category indicators + interruption-eligible items
 *   POST /activity/items/seen                            — attention only: NEW → SEEN (never resolution)
 *   POST /activity/items/:itemId/open                    — attention only: OPENED, and Direct Entry revalidated now
 *   POST /activity/strip                                 — in-app presentation evidence (one strip; the rest settled)
 *   GET  /activity/preferences                           — Notifications & Activity
 *   PUT  /activity/preferences
 *   PUT  /activity/snooze                                — { minutes } or { minutes: null } to end it
 *   PUT  /activity/mutes                                 — { contextRef, muted } for one Shared context
 *
 * Identity is the verified token only; no route takes a user id. No route publishes: publication is server-only
 * (`ActivityPublisher`).
 */
@Controller('activity')
@UseGuards(SupabaseAuthGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get('items')
  page(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.activity.page(userId, accessToken, query);
  }

  @Get('attention')
  attention(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.activity.attention(userId, accessToken, query);
  }

  @Post('items/seen')
  @HttpCode(204)
  async markSeen(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<void> {
    await this.activity.markSeen(request.authenticatedUser.accessToken, body);
  }

  @Post('items/:itemId/open')
  @HttpCode(200)
  open(@Req() request: AuthenticatedRequest, @Param('itemId') itemId: string) {
    return this.activity.open(request.authenticatedUser.accessToken, itemId);
  }

  @Post('strip')
  @HttpCode(204)
  async recordStrip(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<void> {
    await this.activity.recordStrip(request.authenticatedUser.accessToken, body);
  }

  @Get('preferences')
  readPreferences(@Req() request: AuthenticatedRequest) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.activity.readPreferences(userId, accessToken);
  }

  @Put('preferences')
  savePreferences(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.activity.savePreferences(userId, accessToken, body);
  }

  @Put('snooze')
  setSnooze(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.activity.setSnooze(userId, accessToken, body);
  }

  @Put('mutes')
  setMute(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.activity.setMute(request.authenticatedUser.accessToken, body);
  }
}
