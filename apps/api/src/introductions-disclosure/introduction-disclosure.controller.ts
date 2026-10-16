import { Body, Controller, Get, Header, HttpCode, Param, Post, Req, StreamableFile, UseGuards } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { INTRODUCTION_IMAGE_MAX_BYTES } from './introduction-image.pipeline';
import { IntroductionDisclosureService } from './introduction-disclosure.service';

const NO_STORE = ['Cache-Control', 'no-store'] as const;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * The raw photo body, at most INTRODUCTION_IMAGE_MAX_BYTES, held in memory only (never a temporary file). The JSON parser
 * leaves an image body untouched. A larger body answers null, and the rest of the stream is drained and discarded.
 */
async function readImageBody(request: IncomingMessage): Promise<Buffer | null | 'UNSUPPORTED'> {
  const type = String(request.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (!IMAGE_TYPES.includes(type)) return 'UNSUPPORTED';
  const declared = Number(request.headers['content-length']);
  if (Number.isFinite(declared) && declared > INTRODUCTION_IMAGE_MAX_BYTES) {
    request.resume();
    return null;
  }
  const chunks: Buffer[] = [];
  let total = 0;
  let over = false;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > INTRODUCTION_IMAGE_MAX_BYTES) over = true;
    if (!over) chunks.push(chunk);
  }
  return over ? null : Buffer.concat(chunks);
}

/**
 * S6-06 — the Introduction sharing surface: text shares, the three-stage photo, the display-name consent, and the
 * reader's own shares across every Introduction. Every route is the caller's own; none accepts a user, owner,
 * counterpart or audience. Deleting a text share is the existing Shared World owner deletion route, unchanged.
 */
@Controller('introductions')
@UseGuards(SupabaseAuthGuard)
export class IntroductionDisclosureController {
  constructor(private readonly service: IntroductionDisclosureService) {}

  @Get('worlds/:worldId/disclosures')
  @Header(...NO_STORE)
  read(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string) {
    return this.service.read(request.authenticatedUser.accessToken, worldId);
  }

  @Post('worlds/:worldId/disclosures/text')
  @HttpCode(200)
  @Header(...NO_STORE)
  shareText(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    return this.service.shareText(request.authenticatedUser.accessToken, worldId, body);
  }

  @Post('worlds/:worldId/image/:commandId')
  @HttpCode(200)
  @Header(...NO_STORE)
  async uploadImage(@Req() request: AuthenticatedRequest & IncomingMessage, @Param('worldId') worldId: string, @Param('commandId') commandId: string) {
    const bytes = await readImageBody(request);
    if (bytes === 'UNSUPPORTED') return { outcome: 'IMAGE_REFUSED', reason: 'UNSUPPORTED' };
    return this.service.uploadImage(request.authenticatedUser.accessToken, worldId, commandId, bytes);
  }

  @Post('worlds/:worldId/image-stages')
  @HttpCode(200)
  @Header(...NO_STORE)
  shareStage(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    return this.service.shareStage(request.authenticatedUser.accessToken, worldId, body);
  }

  @Post('worlds/:worldId/image-removal')
  @HttpCode(200)
  @Header(...NO_STORE)
  removeImage(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    return this.service.removeImage(request.authenticatedUser.accessToken, worldId, body);
  }

  @Get('worlds/:worldId/media/:handle')
  @Header('Cache-Control', 'no-store, private')
  @Header('Pragma', 'no-cache')
  async media(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Param('handle') handle: string) {
    const bytes = await this.service.media(request.authenticatedUser.accessToken, worldId, handle);
    return new StreamableFile(bytes, { type: 'image/jpeg', length: bytes.length });
  }

  @Post('worlds/:worldId/display-name/grant')
  @HttpCode(200)
  @Header(...NO_STORE)
  grantDisplayName(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    return this.service.grantDisplayName(request.authenticatedUser.accessToken, worldId, body);
  }

  @Post('worlds/:worldId/display-name/revoke')
  @HttpCode(200)
  @Header(...NO_STORE)
  revokeDisplayName(@Req() request: AuthenticatedRequest, @Param('worldId') worldId: string, @Body() body: unknown) {
    return this.service.revokeDisplayName(request.authenticatedUser.accessToken, worldId, body);
  }

  @Get('shares')
  @Header(...NO_STORE)
  shares(@Req() request: AuthenticatedRequest) {
    return this.service.shares(request.authenticatedUser.accessToken);
  }
}
