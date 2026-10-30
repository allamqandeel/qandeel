import { Controller, Delete, Get, Header, HttpCode, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Transform, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { VoiceMediaService, type OpenedAudio } from './voice-media.service';

/** A read that sends nothing for this long is cancelled, with its store request. */
export const VOICE_STREAM_IDLE_MS = 30_000;
const PRIVATE_NO_STORE = 'no-store, private';

/** An AbortSignal that fires when the client goes away before the answer is complete. */
export function clientGone(response: ServerResponse): AbortSignal {
  const controller = new AbortController();
  response.once('close', () => {
    if (!response.writableFinished) controller.abort();
  });
  return controller.signal;
}

/**
 * Streams one opened voice object to the client: its status and headers, then the store's body, never buffered whole.
 * A client disconnect or an idle stream cancels the store read. The caller set `Cache-Control: no-store, private` first,
 * so an error answer carries it too.
 */
export async function sendAudio(response: ServerResponse, open: (signal: AbortSignal) => Promise<OpenedAudio>, fileName: string | null = null): Promise<void> {
  const signal = clientGone(response);
  const opened = await open(signal);
  response.statusCode = opened.status;
  response.setHeader('Content-Type', opened.contentType);
  response.setHeader('Content-Length', String(opened.contentLength));
  response.setHeader('Accept-Ranges', 'bytes');
  if (opened.contentRange !== null) response.setHeader('Content-Range', opened.contentRange);
  if (fileName !== null) response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  let idle: NodeJS.Timeout | null = null;
  const watch = new Transform({
    transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback) {
      if (idle) idle.refresh();
      done(null, chunk);
    },
  });
  idle = setTimeout(() => watch.destroy(new Error('voice stream idle')), VOICE_STREAM_IDLE_MS);
  try {
    await pipeline(opened.body, watch, response);
  } catch {
    // The client left, the store failed mid-stream or the stream idled: the headers are sent, so the connection is cut
    // (a short body is never a complete answer). Nothing is logged.
    opened.body.destroy();
    response.destroy();
  } finally {
    clearTimeout(idle);
  }
}

/**
 * S8B-02 (CP2) — the owner's voice media routes. Every route is guarded and the caller's own: no route takes a user, an
 * owner or a storage key, and another human's recording is 404 exactly as one that does not exist. Read and delete never
 * consult the voice gate; the upload is refused by the database while the gate is closed (B12).
 *
 *   POST   /voice/notes/:sessionId/:commandId     the raw `audio/mp4` body with its Content-Length, streamed to the store
 *                                                 → ACCEPTED | NOT_AVAILABLE_NOW | CONSENT_REQUIRED | TOO_LARGE | ...
 *   GET    /voice/recordings/:recordingId         the readable recording's objects (track, index, type, size, clock)
 *   GET    /voice/recordings/:recordingId/objects/:track/:segmentIndex   the bytes, whole (200) or one Range (206)
 *   DELETE /voice/recordings/:recordingId         the owner's early deletion → DELETED | ALREADY_GONE
 *
 * Every answer is `Cache-Control: no-store, private`. There is no URL, signed link or redirect.
 */
@Controller('voice')
@UseGuards(SupabaseAuthGuard)
export class VoiceMediaController {
  constructor(private readonly voice: VoiceMediaService) {}

  @Post('notes/:sessionId/:commandId')
  @HttpCode(200)
  @Header('Cache-Control', PRIVATE_NO_STORE)
  async uploadNote(@Req() request: AuthenticatedRequest & IncomingMessage, @Res({ passthrough: true }) response: ServerResponse,
    @Param('sessionId') sessionId: string, @Param('commandId') commandId: string) {
    const signal = clientGone(response);
    try {
      return await this.voice.uploadNote(request.authenticatedUser.userId, sessionId, commandId, request.headers['content-type'],
        request.headers['content-length'], request, signal);
    } finally {
      // A refused upload's body is drained and discarded, never stored.
      if (!request.readableEnded) request.resume();
    }
  }

  @Get('recordings/:recordingId')
  @Header('Cache-Control', PRIVATE_NO_STORE)
  readRecording(@Req() request: AuthenticatedRequest, @Param('recordingId') recordingId: string) {
    return this.voice.readRecording(request.authenticatedUser.userId, recordingId);
  }

  @Get('recordings/:recordingId/objects/:track/:segmentIndex')
  async readObject(@Req() request: AuthenticatedRequest & IncomingMessage, @Res() response: ServerResponse,
    @Param('recordingId') recordingId: string, @Param('track') track: string, @Param('segmentIndex') segmentIndex: string): Promise<void> {
    response.setHeader('Cache-Control', PRIVATE_NO_STORE);
    await sendAudio(response, (signal) => this.voice.openObject(request.authenticatedUser.userId, recordingId, track, segmentIndex,
      request.headers.range, signal));
  }

  @Delete('recordings/:recordingId')
  @Header('Cache-Control', PRIVATE_NO_STORE)
  deleteRecording(@Req() request: AuthenticatedRequest, @Param('recordingId') recordingId: string) {
    return this.voice.deleteRecording(request.authenticatedUser.userId, recordingId);
  }
}
