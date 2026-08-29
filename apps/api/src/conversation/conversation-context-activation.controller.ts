import { Body, Controller, Delete, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ConversationContextActivationService } from './conversation-context-activation.service';

// QHIA-011A: the ONE authenticated product entry for explicit session context
// activation.
//
//   PUT    /conversation/sessions/:sessionId/context-bindings/:contextKind
//   DELETE /conversation/sessions/:sessionId/context-bindings/:contextKind
//   GET    /conversation/sessions/:sessionId/context-bindings
//
// It is a separate command surface on purpose. Activation is NEVER part of
// create-turn input, is never mutated during session resume, and is never
// issued on a normal conversation turn: a turn reads the already-explicit
// state through the existing aggregate, and this controller is the only thing
// in QANDEEL that can change it.
//
// The controller holds no authority and decides nothing. userId and
// accessToken come ONLY from AuthenticatedRequest.authenticatedUser, which the
// real SupabaseAuthGuard populated from the verified bearer token: no
// caller-supplied user id, no service-role token, no admin token, no JWT
// reconstruction, and no set_config path exists here. There is no raw SQL, no
// Data API call, and no binding-table access - every request is handed
// verbatim to the narrow facade, which delegates to the existing QHIA-006
// authority.
@Controller('conversation')
@UseGuards(SupabaseAuthGuard)
export class ConversationContextActivationController {
  constructor(private readonly activation: ConversationContextActivationService) {}

  // Set or replace the exact active context of one kind. The body carries
  // exactly one field - the exact context id - and is validated before
  // transport. Replacement is the same single command, never clear + set.
  @Put('sessions/:sessionId/context-bindings/:contextKind')
  activateContext(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Param('contextKind') contextKind: string,
    @Body() body: unknown,
  ) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.activation.activateContext(userId, accessToken, sessionId, contextKind, body);
  }

  // Clear the active context of exactly one kind. No body is read and no
  // "clear all" route exists in v1.
  @Delete('sessions/:sessionId/context-bindings/:contextKind')
  deactivateContext(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Param('contextKind') contextKind: string,
  ) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.activation.deactivateContext(userId, accessToken, sessionId, contextKind);
  }

  // Read the exact current explicit activations of one owned ACTIVE session.
  @Get('sessions/:sessionId/context-bindings')
  readActiveContexts(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.activation.readActiveContexts(userId, accessToken, sessionId);
  }
}
