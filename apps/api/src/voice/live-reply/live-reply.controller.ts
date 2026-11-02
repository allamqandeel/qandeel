import { Controller, Delete, Get, Header, HttpCode, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { LiveReplyService } from './live-reply.service';

const PRIVATE_NO_STORE = 'no-store, private';

/** The raw response as Nest hands it over (`@Res()`): the parts of it this route writes. */
interface RawResponse {
  statusCode: number;
  readonly destroyed: boolean;
  readonly writableEnded: boolean;
  setHeader(name: string, value: string): unknown;
  write(chunk: Buffer): boolean;
  end(): unknown;
  once(event: 'close', listener: () => void): unknown;
}
const bounded = (value: unknown, max: number): number => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : 0;
};

/**
 * S8B-04 (CP2, D-S3 + the single-stream decision) — the owner's automatic voice reply. Guarded; another human's reply is
 * 404 exactly as one that does not exist. No route starts paid work: synthesis is server-started by the turn, and these
 * routes only read, stream what is produced or stored, or stop it.
 *
 *   GET    /voice/live-replies/:replyId?wait=&have=&final=&done=
 *                                                     status: state, the final audio length once known, the text released
 *                                                     so far and, once the turn is done, its answer; a long-poll (≤ 25 s)
 *                                                     answers when something is newer than what the phone has
 *   GET    /voice/live-replies/:replyId/audio         ONE WAV stream: every segment in order while produced (length unknown),
 *                                                     or the stored audio with its known length (replay: no provider work)
 *   DELETE /voice/live-replies/:replyId               stop: no new synthesis; the text is unaffected
 */
@Controller('voice')
@UseGuards(SupabaseAuthGuard)
export class LiveReplyController {
  constructor(private readonly replies: LiveReplyService) {}

  @Get('live-replies/:replyId')
  @Header('Cache-Control', PRIVATE_NO_STORE)
  status(@Req() request: AuthenticatedRequest, @Param('replyId') replyId: string, @Query('wait') wait?: string,
    @Query('have') have?: string, @Query('final') final?: string, @Query('done') done?: string) {
    return this.replies.status(request.authenticatedUser.userId, replyId, bounded(wait, 25_000),
      { textLength: bounded(have, 1_000_000), final: final === '1', exchange: done === '1' });
  }

  @Get('live-replies/:replyId/audio')
  async audio(@Req() request: AuthenticatedRequest, @Res() response: RawResponse, @Param('replyId') replyId: string): Promise<void> {
    response.setHeader('Cache-Control', PRIVATE_NO_STORE);
    const closed = new Promise<void>((resolve) => response.once('close', () => resolve()));
    let started = false;
    await this.replies.stream(request.authenticatedUser.userId, replyId, {
      header: (bytes) => {
        started = true;
        response.statusCode = 200;
        response.setHeader('Content-Type', 'audio/wav');
        // A known length (a replay of a finished reply) is announced; while produced, the body is chunked.
        if (bytes.readUInt32LE(40) !== 0xffffffff) response.setHeader('Content-Length', String(bytes.readUInt32LE(40) + bytes.length));
        response.write(bytes);
      },
      // `false` means the reader is GONE (the service stops for it), never ordinary backpressure: a reply is bounded
      // (at most 24 segments of 3 MiB), so what the socket has not taken yet is buffered.
      write: (bytes) => {
        if (response.destroyed || response.writableEnded) return false;
        response.write(bytes);
        return true;
      },
      end: () => {
        if (started) response.end();
      },
      closed,
    });
  }

  @Delete('live-replies/:replyId')
  @HttpCode(204)
  @Header('Cache-Control', PRIVATE_NO_STORE)
  async cancel(@Req() request: AuthenticatedRequest, @Param('replyId') replyId: string): Promise<void> {
    await this.replies.cancel(request.authenticatedUser.userId, replyId);
  }
}
