import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PublicWorldService } from './public-world.service';

/**
 * S5-01 — the «العالم العام» / Public World Product routes. Owner-only; identity is the verified token.
 *
 *   GET /public/entry     the Public World entry verdict: { outcome: ALLOW | UNAVAILABLE }
 *   GET /public/display   the reader's own Public display choice: { mode, label, realNameAvailable }
 *   PUT /public/display   choose the mode: body { mode: PSEUDONYM | REAL_NAME } — never label text
 *
 * No route takes a user id, a Public ref, a label, an audience or an authority; no route serves, creates or lists
 * anything inside Public World.
 */
@Controller('public')
@UseGuards(SupabaseAuthGuard)
export class PublicWorldController {
  constructor(private readonly publicWorld: PublicWorldService) {}

  @Get('entry')
  entry(@Req() request: AuthenticatedRequest) {
    return this.publicWorld.entry(request.authenticatedUser.accessToken);
  }

  @Get('display')
  display(@Req() request: AuthenticatedRequest) {
    return this.publicWorld.display(request.authenticatedUser.accessToken);
  }

  @Put('display')
  setDisplay(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.publicWorld.setDisplay(request.authenticatedUser.accessToken, body);
  }
}
