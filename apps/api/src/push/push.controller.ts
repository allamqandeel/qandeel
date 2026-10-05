import { Body, Controller, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PushService } from './push.service';

/**
 * A3-02 — the device side of platform delivery. Owner-only.
 *
 *   PUT  /push/device                 — register / refresh / rotate THIS installation's registration (token, OS
 *                                       permission, IANA zone, locale)
 *   POST /push/device/detach          — sign-out: this installation stops receiving and forgets its token
 *   POST /push/device/detach-others   — "sign out from other devices": every other installation stops receiving
 *   POST /push/opened                 — per-device evidence: this installation's notification was tapped
 *
 * Identity is the verified token only; no route takes a user id; no answer carries a token. Nothing here sends: the
 * dispatcher is server-only. A notification tap's Direct Entry is Activity's `POST /activity/items/:itemId/open` — the
 * ONE revalidation boundary (D38) — never a route of its own.
 */
@Controller('push')
@UseGuards(SupabaseAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Put('device')
  sync(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.push.sync(request.authenticatedUser.accessToken, body);
  }

  @Post('device/detach')
  @HttpCode(200)
  detach(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.push.detach(request.authenticatedUser.accessToken, body);
  }

  @Post('device/detach-others')
  @HttpCode(200)
  detachOthers(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.push.detachOthers(request.authenticatedUser.accessToken, body);
  }

  @Post('opened')
  @HttpCode(200)
  opened(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.push.recordOpen(request.authenticatedUser.accessToken, body);
  }
}
