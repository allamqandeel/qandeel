import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PublicRelationService } from './public-relation.service';

/**
 * S5-03C — explicit Public relations, managed inside the «العالم العام» / Public World authoring workspace. Owner routes;
 * identity is the verified token, and the database decides which side the caller may act for.
 *
 *   GET  /public/authoring/relations                         own served Experiences and every current relation from the
 *                                                            reader's side (ACTIVE, REQUEST_SENT, REQUEST_RECEIVED)
 *   POST /public/authoring/relations                         { commandId, experienceId, otherExperienceId } → ask for one
 *   POST /public/authoring/relations/:relationId/accept      { commandId } — the target side
 *   POST /public/authoring/relations/:relationId/decline     { commandId } — the target side
 *   POST /public/authoring/relations/:relationId/cancel      { commandId } — the requesting side
 *   POST /public/authoring/relations/:relationId/remove      { commandId } — either side, once ACTIVE
 *
 * No route takes a user, a side, a version, a revision, a type, a strength, a distance or any text, and no route
 * suggests a relation, publishes or notifies.
 */
@Controller('public/authoring/relations')
@UseGuards(SupabaseAuthGuard)
export class PublicRelationController {
  constructor(private readonly relations: PublicRelationService) {}

  @Get()
  read(@Req() request: AuthenticatedRequest) {
    return this.relations.relations(request.authenticatedUser.accessToken);
  }

  @Post()
  request(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.relations.request(request.authenticatedUser.accessToken, body);
  }

  @Post(':relationId/accept')
  accept(@Req() request: AuthenticatedRequest, @Param('relationId') relationId: string, @Body() body: unknown) {
    return this.relations.act(request.authenticatedUser.accessToken, 'accept', relationId, body);
  }

  @Post(':relationId/decline')
  decline(@Req() request: AuthenticatedRequest, @Param('relationId') relationId: string, @Body() body: unknown) {
    return this.relations.act(request.authenticatedUser.accessToken, 'decline', relationId, body);
  }

  @Post(':relationId/cancel')
  cancel(@Req() request: AuthenticatedRequest, @Param('relationId') relationId: string, @Body() body: unknown) {
    return this.relations.act(request.authenticatedUser.accessToken, 'cancel', relationId, body);
  }

  @Post(':relationId/remove')
  remove(@Req() request: AuthenticatedRequest, @Param('relationId') relationId: string, @Body() body: unknown) {
    return this.relations.act(request.authenticatedUser.accessToken, 'remove', relationId, body);
  }
}
