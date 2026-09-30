import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PrivacyDataService } from './privacy-data.service';

type OwnerRequest = AuthenticatedRequest & { readonly ip?: string };

/**
 * W3-MEGA-S — the owner's Privacy & Data routes (W3-PDG-01 §7 / §8). Every route is guarded and acts only for the
 * verified token's account: no route takes an account, user or internal id, and values travel in the body.
 *
 *   GET  /account/privacy                    { export: { status, availableUntil }, deletion: { status, finalAt } }
 *   POST /account/privacy/export             { commandId, password } → ACCEPTED | PASSWORD_REJECTED
 *   GET  /account/privacy/export/download    { status, availableUntil, package } — the package only while READY
 *   POST /account/privacy/deletion           { commandId, password } → ACCEPTED | CANCELLED | PASSWORD_REJECTED
 *   POST /account/privacy/deletion/cancel    {}                      → CANCELLED | NONE | NOT_CANCELLABLE
 *
 * 400 for any other body, 503 whenever there is no usable answer.
 */
@Controller('account/privacy')
@UseGuards(SupabaseAuthGuard)
export class PrivacyDataController {
  constructor(private readonly privacy: PrivacyDataService) {}

  @Get()
  readState(@Req() request: OwnerRequest) {
    return this.privacy.readState(request.authenticatedUser.accessToken);
  }

  @Post('export')
  @HttpCode(200)
  requestExport(@Req() request: OwnerRequest, @Body() body: unknown) {
    return this.privacy.requestExport(request.authenticatedUser.accessToken, body, request.ip);
  }

  @Get('export/download')
  downloadExport(@Req() request: OwnerRequest) {
    return this.privacy.downloadExport(request.authenticatedUser.accessToken, request.ip);
  }

  @Post('deletion')
  @HttpCode(200)
  requestDeletion(@Req() request: OwnerRequest, @Body() body: unknown) {
    return this.privacy.requestDeletion(request.authenticatedUser.accessToken, body, request.ip);
  }

  @Post('deletion/cancel')
  @HttpCode(200)
  cancelDeletion(@Req() request: OwnerRequest, @Body() body: unknown) {
    return this.privacy.cancelDeletion(request.authenticatedUser.accessToken, body);
  }
}
