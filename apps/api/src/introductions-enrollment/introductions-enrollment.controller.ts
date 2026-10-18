import { Body, Controller, Get, Header, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { IntroductionsEnrollmentService } from './introductions-enrollment.service';

const NO_STORE = ['Cache-Control', 'no-store'] as const;

/**
 * S6-07 (CP1) — the owner's governed Matching enrollment. Owner-only.
 *
 *   GET  /introductions/enrollment   — availability (the ENROLLMENT gate AND the three current consent texts), the current
 *                                      consent texts, the caller's own setup state and last enrollment act
 *   POST /introductions/enrollment   — { commandId, kind, expectedDraftVersion, consents: { participation, contextGrant,
 *                                      disclosureAuthority } } -> { outcome, view }
 *   POST /introductions/enrollment/revocation — (S6-07 CP3) { commandId, consent: participation | contextGrant |
 *                                      disclosureAuthority } -> { outcome: REVOKED | NOT_ACTIVE | CHANGED | COMMAND_CONFLICT, view }
 *
 * Identity is the verified token only; no route takes a user id, a profile field, a requirement or a fact. The gate is
 * closed in production, so every act answers NOT_AVAILABLE_NOW until a Stage 9 launch decision opens it.
 */
@Controller('introductions')
@UseGuards(SupabaseAuthGuard)
export class IntroductionsEnrollmentController {
  constructor(private readonly enrollment: IntroductionsEnrollmentService) {}

  @Get('enrollment')
  @Header(...NO_STORE)
  read(@Req() request: AuthenticatedRequest) {
    return this.enrollment.read(request.authenticatedUser.accessToken);
  }

  @Post('enrollment')
  @HttpCode(200)
  @Header(...NO_STORE)
  act(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.enrollment.act(request.authenticatedUser.accessToken, body);
  }

  @Post('enrollment/revocation')
  @HttpCode(200)
  @Header(...NO_STORE)
  revoke(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.enrollment.revoke(request.authenticatedUser.accessToken, body);
  }
}
