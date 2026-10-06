import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PublicFieldService } from './public-field.service';

/**
 * S5-03B — the «العالم العام» / Public World semantic field. Viewer routes; identity is the verified token, and the
 * database admits the viewer itself.
 *
 *   GET /public/field?minX&minY&maxX&maxY        the Experiences placed inside one world rectangle (exact integer text)
 *   GET /public/field/search?q                   search over the same field: each result carries its place in it
 *   GET /public/field/experiences/:experienceId  the contextual panel of one Experience the field showed
 *
 * No route takes a viewer, an audience, a visibility, a lifecycle, a version, a region, a rank or a coordinate to
 * assign; the rectangle is a viewport request and nothing else. No route publishes, ranks by popularity or draws a
 * relation.
 */
@Controller('public/field')
@UseGuards(SupabaseAuthGuard)
export class PublicFieldController {
  constructor(private readonly field: PublicFieldService) {}

  @Get()
  read(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.field.field(request.authenticatedUser.accessToken, query);
  }

  @Get('search')
  search(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.field.search(request.authenticatedUser.accessToken, query);
  }

  @Get('experiences/:experienceId')
  experience(@Req() request: AuthenticatedRequest, @Param('experienceId') experienceId: string) {
    return this.field.experience(request.authenticatedUser.accessToken, experienceId);
  }
}
