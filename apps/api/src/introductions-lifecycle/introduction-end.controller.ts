import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { IntroductionEndService } from './introduction-end.service';

/**
 * S6-02 — the Introduction's one unilateral exit (GATE-34; migration 0155). Owner-only; identity is the verified token.
 *
 *   POST /introductions/worlds/:worldId/end   — { commandId } → ENDED / ALREADY_SETTLED / UNAVAILABLE (never gated)
 *
 * No route takes a user id, a counterpart, a participation event or a consent.
 */
@Controller('introductions')
@UseGuards(SupabaseAuthGuard)
export class IntroductionEndController {
  constructor(private readonly introductions: IntroductionEndService) {}

  @Post('worlds/:worldId/end')
  @HttpCode(200)
  end(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    return this.introductions.end(request.authenticatedUser.accessToken, worldId, body);
  }
}
