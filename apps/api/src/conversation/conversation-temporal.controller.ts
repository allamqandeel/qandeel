// T-03A2 - the authenticated temporal read surface.
//
//   GET /conversation/sessions/:sessionId/temporal          -> { sessionId, liveHead }
//   GET /conversation/sessions/:sessionId/temporal/events   -> committed-CU catch-up
//
// This is explicit authenticated HTTP delivery and catch-up. There is no
// WebSocket and no SSE in T-03A2: realtime push infrastructure would be a
// separate, separately owned decision.
//
// The event route is a DELIVERY/RECOVERY transport for LH, not a Timeline API.
// It exposes no committed text, no analysis, no Reading, no Thread, no Live
// Focus, no K/V and no historical projection - T-03C owns history - and it
// never exposes the server-internal same-SP event sequence.

import { BadRequestException, Controller, Get, NotFoundException, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { ConversationalUnitsCommittedWireEvent, SessionTemporalSnapshot } from '@qandeel/runtime';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  MAX_TEMPORAL_EVENT_PAGE,
  TemporalDeliveryRepository,
} from '../conversation-unit/temporal-delivery.repository';

@Controller('conversation')
@UseGuards(SupabaseAuthGuard)
export class ConversationTemporalController {
  constructor(private readonly delivery: TemporalDeliveryRepository) {}

  /**
   * Current Session temporal truth. `liveHead` is `null` when no
   * user-addressable committed CU exists yet; zero is never returned.
   */
  @Get('sessions/:sessionId/temporal')
  async sessionTemporalState(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
  ): Promise<SessionTemporalSnapshot> {
    const { accessToken } = request.authenticatedUser;
    const snapshot = await this.delivery.getSessionTemporalState(accessToken, sessionId);
    if (!snapshot) throw new NotFoundException('Conversation session was not found.');
    return snapshot;
  }

  /**
   * Committed-CU delivery catch-up, ascending by `firstSp`.
   *
   * `afterSp` omitted means the start of available delivery events. When
   * supplied it must be an integer >= 1: SP(0) is not a cursor and is refused
   * here as well as in the database.
   */
  @Get('sessions/:sessionId/temporal/events')
  async committedEvents(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Query('afterSp') afterSp?: string,
    @Query('limit') limit?: string,
  ): Promise<{ sessionId: string; events: ConversationalUnitsCommittedWireEvent[] }> {
    const { accessToken } = request.authenticatedUser;
    const events = await this.delivery.getCommittedEvents(accessToken, sessionId, {
      ...(afterSp === undefined ? {} : { afterSp: parseBoundedInteger(afterSp, 'afterSp', 1, Number.MAX_SAFE_INTEGER) }),
      ...(limit === undefined ? {} : { limit: parseBoundedInteger(limit, 'limit', 1, MAX_TEMPORAL_EVENT_PAGE) }),
    });
    return { sessionId, events };
  }
}

function parseBoundedInteger(raw: string, name: string, min: number, max: number): number {
  if (!/^[0-9]{1,16}$/u.test(raw)) {
    throw new BadRequestException(`${name} must be a positive integer.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new BadRequestException(`${name} must be between ${min} and ${max}.`);
  }
  return value;
}
