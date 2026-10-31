import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { VoiceNotesService } from './voice-notes.service';

const PRIVATE_NO_STORE = 'no-store, private';

/**
 * S8B-03 (CP1, §8.1) — the owner's voice consent and Voice Note routes. Guarded; no route takes a user, an owner, a key, a
 * job or a band, and another human's note is 404 exactly as one that does not exist. The commit of a note into the
 * conversation runs the turn through the Conversation module's runner (`voice-note-turn.port.ts`); this module imports no AI
 * runtime. This controller is registered BEFORE VoiceMediaController, so `notes/:recordingId/turn` is never read as the
 * upload route `notes/:sessionId/:commandId`.
 *
 *   GET  /voice/consent                                   the approved text (C-01 … C-11) and this person's consent state
 *   POST /voice/consent/grant      {commandId, version}   → GRANTED | VERSION_NOT_CURRENT
 *   POST /voice/consent/withdraw   {commandId}            → WITHDRAWN (deletes nothing)
 *   GET  /voice/capability                                whether Voice Notes are available now
 *   GET  /voice/notes/pending?sessionId=                  accepted notes of a Session not yet in the conversation
 *   GET  /voice/notes/:recordingId/status                 the note's client state, never its text, band or attempts
 *   POST /voice/notes/:recordingId/transcription/retry    the owner's explicit retry, within the total bound
 *   POST /voice/notes/:recordingId/turn                   commit a READY note as one turn and answer the turn's reply
 */
@Controller('voice')
@UseGuards(SupabaseAuthGuard)
export class VoiceNotesController {
  constructor(private readonly notes: VoiceNotesService) {}

  @Get('consent')
  @Header('Cache-Control', PRIVATE_NO_STORE)
  consent(@Req() request: AuthenticatedRequest) {
    return this.notes.consent(request.authenticatedUser.userId);
  }

  @Post('consent/grant')
  @HttpCode(200)
  @Header('Cache-Control', PRIVATE_NO_STORE)
  grant(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.notes.grant(request.authenticatedUser.userId, body);
  }

  @Post('consent/withdraw')
  @HttpCode(200)
  @Header('Cache-Control', PRIVATE_NO_STORE)
  withdraw(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.notes.withdraw(request.authenticatedUser.userId, body);
  }

  @Get('capability')
  @Header('Cache-Control', PRIVATE_NO_STORE)
  capability(@Req() request: AuthenticatedRequest) {
    return this.notes.capability(request.authenticatedUser.userId);
  }

  @Get('notes/pending')
  @Header('Cache-Control', PRIVATE_NO_STORE)
  pending(@Req() request: AuthenticatedRequest, @Query('sessionId') sessionId: unknown) {
    return this.notes.pending(request.authenticatedUser.userId, sessionId);
  }

  @Get('notes/:recordingId/status')
  @Header('Cache-Control', PRIVATE_NO_STORE)
  status(@Req() request: AuthenticatedRequest, @Param('recordingId') recordingId: string) {
    return this.notes.status(request.authenticatedUser.userId, recordingId);
  }

  @Post('notes/:recordingId/transcription/retry')
  @HttpCode(200)
  @Header('Cache-Control', PRIVATE_NO_STORE)
  retry(@Req() request: AuthenticatedRequest, @Param('recordingId') recordingId: string) {
    return this.notes.retry(request.authenticatedUser.userId, recordingId);
  }

  @Post('notes/:recordingId/turn')
  @HttpCode(200)
  @Header('Cache-Control', PRIVATE_NO_STORE)
  turn(@Req() request: AuthenticatedRequest, @Param('recordingId') recordingId: string) {
    const { userId, accessToken } = request.authenticatedUser;
    return this.notes.commitTurn(userId, accessToken, recordingId);
  }
}
