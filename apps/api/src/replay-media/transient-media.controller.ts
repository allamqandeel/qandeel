import { Controller, Delete, Get, Header, HttpCode, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { REPLAY_DATABASE, TRANSIENT_STREAM_TIMING } from './replay-tokens';
import type { ReplayDatabase } from './replay-database';
import { TransientPlaybackService } from './transient-playback.service';
import { streamTransient, type StreamReport, type TransientStreamTiming } from './transient-stream';

const PRIVATE_NO_STORE = 'no-store, private';

/** A test seam of the V-32 / V-35 proofs: the content-free report of each finished response (bytes and instants only). */
export const TRANSIENT_STREAM_REPORTS = Symbol('TRANSIENT_STREAM_REPORTS');
export type StreamReportSink = (report: StreamReport) => void;

/** An AbortSignal that fires when the client goes away before the answer is complete. */
function clientGone(response: ServerResponse): AbortSignal {
  const controller = new AbortController();
  response.once('close', () => {
    if (!response.writableFinished) controller.abort();
  });
  return controller.signal;
}

/**
 * S8B-07 CP1-B step 3 — the five routes of the Replay Media Service (contract §6; INFRA-07 P-1: the Replay pool only,
 * never the API). Each route is the verified bearer's own (the same Supabase bearer check as the Voice Note read: the
 * token travels in a header, never in a URL); no route takes a user, a key or a URL. Every answer is
 * `Cache-Control: no-store, private`, and the audio never carries a Content-Disposition: it is private playback, not a
 * download (V-16).
 */
@Controller()
@UseGuards(SupabaseAuthGuard)
export class TransientMediaController {
  constructor(
    private readonly playback: TransientPlaybackService,
    @Inject(TRANSIENT_STREAM_TIMING) private readonly timing: TransientStreamTiming,
    @Inject(TRANSIENT_STREAM_REPORTS) private readonly reports: StreamReportSink | null,
  ) {}

  @Post('voice/listening/:callId/:commandId')
  @HttpCode(200)
  @Header('Cache-Control', PRIVATE_NO_STORE)
  requestListening(@Req() request: AuthenticatedRequest, @Param('callId') callId: string, @Param('commandId') commandId: string) {
    return this.playback.requestListening(request.authenticatedUser.userId, callId, commandId);
  }

  @Post('replay/:replayId/versions/:versionId/playback/:commandId')
  @HttpCode(200)
  @Header('Cache-Control', PRIVATE_NO_STORE)
  requestReplay(@Req() request: AuthenticatedRequest, @Param('replayId') replayId: string, @Param('versionId') versionId: string,
    @Param('commandId') commandId: string) {
    return this.playback.requestReplay(request.authenticatedUser.userId, replayId, versionId, commandId);
  }

  @Get('voice/transient/:artifactId/status')
  @Header('Cache-Control', PRIVATE_NO_STORE)
  status(@Req() request: AuthenticatedRequest, @Param('artifactId') artifactId: string) {
    return this.playback.status(request.authenticatedUser.userId, artifactId);
  }

  @Get('voice/transient/:artifactId')
  async read(@Req() request: AuthenticatedRequest & IncomingMessage, @Res() response: ServerResponse,
    @Param('artifactId') artifactId: string): Promise<void> {
    response.setHeader('Cache-Control', PRIVATE_NO_STORE);
    const userId = request.authenticatedUser.userId;
    const opened = await this.playback.open(userId, artifactId, request.headers.range, clientGone(response));
    const report = await streamTransient(response, opened, this.timing,
      () => this.playback.recheck(userId, artifactId, this.timing.recheckTimeoutMs));
    this.playback.recordStream(report.outcome.toLowerCase());
    this.reports?.(report);
  }

  @Delete('voice/transient/:artifactId')
  @Header('Cache-Control', PRIVATE_NO_STORE)
  release(@Req() request: AuthenticatedRequest, @Param('artifactId') artifactId: string) {
    return this.playback.release(request.authenticatedUser.userId, artifactId);
  }
}

/** The content-free uptime target of the managed alerting (contract §18.3): the process answers, and its database does. */
@Controller()
export class ReplayHealthController {
  constructor(@Inject(REPLAY_DATABASE) private readonly db: ReplayDatabase) {}

  @Get('health')
  @Header('Cache-Control', PRIVATE_NO_STORE)
  async health(@Res({ passthrough: true }) response: ServerResponse): Promise<{ status: 'ok' | 'unavailable' }> {
    let timer: NodeJS.Timeout | undefined;
    const late = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), 2_000);
    });
    const ok = await Promise.race([this.db.query('SELECT 1', []).then(() => true, () => false), late]).finally(() => clearTimeout(timer));
    response.statusCode = ok ? 200 : 503;
    return { status: ok ? 'ok' : 'unavailable' };
  }
}
