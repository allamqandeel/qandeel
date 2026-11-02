import { BadRequestException, Body, Controller, Delete, Header, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { LIVE_NOTE_MAX_CHUNK_BYTES, LiveVoiceNoteService } from './live-voice-note.service';

const PRIVATE_NO_STORE = 'no-store, private';
const invalid = () => new BadRequestException({ outcome: 'INVALID_REQUEST' });

/** The raw request as Nest hands it over: its headers and its body as a byte stream. */
type RawRequest = AsyncIterable<Buffer> & { readonly headers: Readonly<Record<string, string | string[] | undefined>> };

/** Reads one raw chunk body, refusing anything over the bound (never buffered beyond it). */
async function readChunk(request: RawRequest): Promise<Buffer> {
  if (String(request.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase() !== 'application/octet-stream') throw invalid();
  const declared = Number(request.headers['content-length']);
  if (!Number.isSafeInteger(declared) || declared <= 0 || declared > LIVE_NOTE_MAX_CHUNK_BYTES) throw invalid();
  const parts: Buffer[] = [];
  let seen = 0;
  for await (const part of request) {
    seen += part.length;
    if (seen > declared) throw invalid();
    parts.push(part);
  }
  if (seen !== declared) throw invalid();
  return Buffer.concat(parts, seen);
}

/**
 * S8B-04 (CP2, D-S1) — the owner's live voice note: audio streamed DURING a recording, after the CURRENT voice consent
 * only (the database refuses otherwise, and nothing reaches the provider). Guarded; another human's live note is 404.
 * The transcript never leaves through these routes: it is adopted only by the recording's upload (`?liveId=`), inside
 * the acceptance's own transaction, and only when it qualifies.
 *
 *   POST   /voice/live-notes                 {sessionId, liveId}   → OPENED (503 NOT_AVAILABLE_NOW: record without it)
 *   POST   /voice/live-notes/:liveId/audio?seq=N                    one PCM chunk (16 kHz mono s16le), in order from 0
 *   DELETE /voice/live-notes/:liveId                                the recording was cancelled: everything discarded
 */
@Controller('voice')
@UseGuards(SupabaseAuthGuard)
export class LiveVoiceNoteController {
  constructor(private readonly notes: LiveVoiceNoteService) {}

  @Post('live-notes')
  @HttpCode(200)
  @Header('Cache-Control', PRIVATE_NO_STORE)
  open(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const { sessionId, liveId } = (body ?? {}) as { sessionId?: unknown; liveId?: unknown };
    if (typeof sessionId !== 'string' || typeof liveId !== 'string') throw invalid();
    return this.notes.open(request.authenticatedUser.userId, sessionId, liveId);
  }

  @Post('live-notes/:liveId/audio')
  @HttpCode(200)
  @Header('Cache-Control', PRIVATE_NO_STORE)
  async audio(@Req() request: AuthenticatedRequest & RawRequest, @Param('liveId') liveId: string, @Query('seq') seq?: string) {
    if (seq === undefined || !/^\d{1,7}$/u.test(seq)) throw invalid();
    return this.notes.append(request.authenticatedUser.userId, liveId, Number(seq), await readChunk(request));
  }

  @Delete('live-notes/:liveId')
  @HttpCode(204)
  @Header('Cache-Control', PRIVATE_NO_STORE)
  async cancel(@Req() request: AuthenticatedRequest, @Param('liveId') liveId: string): Promise<void> {
    await this.notes.cancel(request.authenticatedUser.userId, liveId);
  }
}
