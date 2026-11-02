import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { LiveCallService } from './live-call.service';

/**
 * S8B-05 CP1 — call-truth (0189 `server_read_call_truth_v1`): the owner's own call as the server holds it (state,
 * epoch, started_at, end reason), so a phone that lost its socket learns whether to resume, and never starts a second
 * call for a call that is still open. Guarded; private; another human's call is never visible.
 *
 *   GET /voice/calls/truth
 */
@Controller('voice')
@UseGuards(SupabaseAuthGuard)
export class LiveCallTruthController {
  constructor(private readonly calls: LiveCallService) {}

  @Get('calls/truth')
  @Header('Cache-Control', 'no-store, private')
  truth(@Req() request: AuthenticatedRequest) {
    return this.calls.truth(request.authenticatedUser.userId);
  }
}
