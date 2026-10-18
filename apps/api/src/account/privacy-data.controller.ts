import { Body, Controller, Get, Header, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { EXPORT_MANIFEST_HEADER, PrivacyDataService } from './privacy-data.service';

type OwnerRequest = AuthenticatedRequest & { readonly ip?: string };

/**
 * W3-MEGA-S — the owner's Privacy & Data routes (W3-PDG-01 §7 / §8). Every route is guarded and acts only for the
 * verified token's account: no route takes an account, user or internal id, and values travel in the body.
 *
 *   GET  /account/privacy                    { export: { status, availableUntil }, deletion: { status, finalAt } }
 *   POST /account/privacy/export             { commandId, password } → ACCEPTED | PASSWORD_REJECTED
 *   GET  /account/privacy/export/download    { status, availableUntil, package } — the package only while READY
 *   GET  /account/privacy/export/download/bundle   S6-07 (CP4): the same package, the photo manifest beside it, the
 *                                            leading photo files and the manifest token (QAN-BL-PRIV-04)
 *   GET  /account/privacy/export/download/bundle/files/:fileName   one listed photo file, under the manifest token
 *                                            (header x-qandeel-export-manifest); 409 CHANGED when the photos moved
 *   POST /account/privacy/deletion           { commandId, password } → ACCEPTED | CANCELLED | PASSWORD_REJECTED
 *   POST /account/privacy/deletion/cancel    {}                      → CANCELLED | NONE | NOT_CANCELLABLE
 *
 * 400 for any other body, 503 whenever there is no usable answer. No answer is stored by any cache on the way: the package
 * carries the owner's whole Personal record and Email (`Cache-Control: no-store` on every route).
 */
const NO_STORE = ['Cache-Control', 'no-store'] as const;

@Controller('account/privacy')
@UseGuards(SupabaseAuthGuard)
export class PrivacyDataController {
  constructor(private readonly privacy: PrivacyDataService) {}

  @Get()
  @Header(...NO_STORE)
  readState(@Req() request: OwnerRequest) {
    return this.privacy.readState(request.authenticatedUser.accessToken);
  }

  @Post('export')
  @Header(...NO_STORE)
  @HttpCode(200)
  requestExport(@Req() request: OwnerRequest, @Body() body: unknown) {
    return this.privacy.requestExport(request.authenticatedUser.accessToken, body, request.ip);
  }

  @Get('export/download')
  @Header(...NO_STORE)
  downloadExport(@Req() request: OwnerRequest) {
    return this.privacy.downloadExport(request.authenticatedUser.accessToken, request.ip);
  }

  @Get('export/download/bundle')
  @Header(...NO_STORE)
  downloadExportBundle(@Req() request: OwnerRequest) {
    return this.privacy.downloadExportBundle(request.authenticatedUser.accessToken, request.ip);
  }

  @Get('export/download/bundle/files/:fileName')
  @Header(...NO_STORE)
  downloadExportPhoto(@Req() request: OwnerRequest, @Param('fileName') fileName: string, @Headers(EXPORT_MANIFEST_HEADER) token: string | undefined) {
    return this.privacy.downloadExportPhoto(request.authenticatedUser.accessToken, fileName, token);
  }

  @Post('deletion')
  @Header(...NO_STORE)
  @HttpCode(200)
  requestDeletion(@Req() request: OwnerRequest, @Body() body: unknown) {
    return this.privacy.requestDeletion(request.authenticatedUser.accessToken, body, request.ip);
  }

  @Post('deletion/cancel')
  @Header(...NO_STORE)
  @HttpCode(200)
  cancelDeletion(@Req() request: OwnerRequest, @Body() body: unknown) {
    return this.privacy.cancelDeletion(request.authenticatedUser.accessToken, body);
  }
}
