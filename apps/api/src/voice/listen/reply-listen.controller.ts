import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post, Req, StreamableFile, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { ReplyListenService } from './reply-listen.service';

const PRIVATE_NO_STORE = 'no-store, private';

/**
 * S8B-04 (CP1, contract v1.2 §8.2) — «استمع» on a voice-note reply. Guarded; no route takes a user, an owner, a text, a
 * style, a hint or a call; another human's reply, a typed turn's reply and a reply that does not exist are one 404. The
 * ONE paid command is a POST; the GET reads the 15-minute store only and never starts any provider work (RJ-06).
 *
 *   POST   /voice/replies/:turnId/listen                              {listenId} → {listenId, segmentCount, expiresAt}  free
 *   POST   /voice/replies/:turnId/listen/:listenId/segments/:i/synthesis       → {segmentIndex, state}             paid once
 *   GET    /voice/replies/:turnId/listen/:listenId/segments/:i/audio           → audio/wav                         free
 *   DELETE /voice/replies/:turnId/listen/:listenId                                                                 free
 */
@Controller('voice')
@UseGuards(SupabaseAuthGuard)
export class ReplyListenController {
  constructor(private readonly listen: ReplyListenService) {}

  @Post('replies/:turnId/listen')
  @HttpCode(200)
  @Header('Cache-Control', PRIVATE_NO_STORE)
  start(@Req() request: AuthenticatedRequest, @Param('turnId') turnId: string, @Body() body: unknown) {
    return this.listen.start(request.authenticatedUser.userId, turnId, body);
  }

  @Post('replies/:turnId/listen/:listenId/segments/:index/synthesis')
  @HttpCode(200)
  @Header('Cache-Control', PRIVATE_NO_STORE)
  synthesize(@Req() request: AuthenticatedRequest, @Param('turnId') turnId: string, @Param('listenId') listenId: string, @Param('index') index: string) {
    return this.listen.synthesize(request.authenticatedUser.userId, turnId, listenId, index);
  }

  @Get('replies/:turnId/listen/:listenId/segments/:index/audio')
  @Header('Cache-Control', PRIVATE_NO_STORE)
  async audio(@Req() request: AuthenticatedRequest, @Param('turnId') turnId: string, @Param('listenId') listenId: string, @Param('index') index: string) {
    const wav = await this.listen.audio(request.authenticatedUser.userId, turnId, listenId, index);
    return new StreamableFile(wav, { type: 'audio/wav', length: wav.length });
  }

  @Delete('replies/:turnId/listen/:listenId')
  @HttpCode(204)
  @Header('Cache-Control', PRIVATE_NO_STORE)
  async cancel(@Req() request: AuthenticatedRequest, @Param('turnId') turnId: string, @Param('listenId') listenId: string): Promise<void> {
    await this.listen.cancel(request.authenticatedUser.userId, turnId, listenId);
  }
}
