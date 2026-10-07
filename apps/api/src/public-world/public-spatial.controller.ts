import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PublicSpatialService } from './public-spatial.service';

/**
 * S5-03B — preparing the stable Public location of a semantically ready Experience. Owner-only; identity is the verified
 * token.
 *
 *   GET  /public/authoring/drafts/:experienceId/place   whether its place exists: NOT_SEMANTICALLY_READY | NOT_PLACED | PLACED
 *   POST /public/authoring/drafts/:experienceId/place   ask QANDEEL to prepare it { commandId }
 *
 * No route takes or returns a coordinate, a region, a rank, a neighbour, a distance, a model, a readiness, a user or a
 * lifecycle, and no route publishes.
 */
@Controller('public/authoring/drafts/:experienceId/place')
@UseGuards(SupabaseAuthGuard)
export class PublicSpatialController {
  constructor(private readonly spatial: PublicSpatialService) {}

  @Get()
  preparation(@Req() request: AuthenticatedRequest, @Param('experienceId') experienceId: string) {
    return this.spatial.preparation(request.authenticatedUser.accessToken, experienceId);
  }

  @Post()
  prepare(@Req() request: AuthenticatedRequest, @Param('experienceId') experienceId: string, @Body() body: unknown) {
    return this.spatial.prepare(request.authenticatedUser.accessToken, experienceId, body);
  }
}
