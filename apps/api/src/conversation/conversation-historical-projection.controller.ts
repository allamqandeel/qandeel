// T-03C - the authenticated historical disclosure read surface.
//
//   GET /conversation/sessions/:sessionId/historical-projection
//       ?tc=<SP>&depth=<WORLD|THREAD|SESSION|ANALYTICAL_OBJECT|SOURCE_PROVENANCE>
//       [&inspectFamily=&inspectId=&inspectVersion=&appearanceKind=&appearanceBindingId=]
//     -> HistoricalDisclosure (V = Disclose(K(TC), depth, inspection))
//
// Explicit authenticated HTTP read; no WebSocket, no SSE, no write, no
// Product action. The database projects K(TC) for the caller's own Session
// (Layer A); the server discloses exactly the rungs the requested depth earns
// (Layer B). K(TC) itself never leaves the server.
//
// Refusals are typed and fail closed, never `UNKNOWN_AT_TC`:
//   409 { code: HISTORICAL_COVERAGE_UNAVAILABLE }  a LEGACY UNCOVERED SESSION
//   409 { code: LIVE_HEAD_NOT_ESTABLISHED }        no addressable Session Position yet
//   409 { code: HISTORICAL_BASELINE_MISSING }      technical corruption
//   400 { code: SESSION_POSITION_NOT_ADDRESSABLE } TC outside [1, LH]
//   404                                            a Session this caller cannot see

import { BadRequestException, ConflictException, Controller, Get, NotFoundException, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { HistoricalDisclosure, HistoricalInspectionRequest, HistoricalProjectionUnavailableBody, HistoricalSemanticDepth } from '@qandeel/runtime';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { disclose, isHistoricalFamily, isHistoricalSemanticDepth } from '../historical-projection/historical-disclosure';
import { HistoricalProjectionRepository } from '../historical-projection/historical-projection.repository';
import { HistoricalProjectionUnavailableError } from '../historical-projection/historical-projection.types';

@Controller('conversation')
@UseGuards(SupabaseAuthGuard)
export class ConversationHistoricalProjectionController {
  constructor(private readonly projection: HistoricalProjectionRepository) {}

  @Get('sessions/:sessionId/historical-projection')
  async historicalProjection(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Query('tc') tc?: string,
    @Query('depth') depth?: string,
    @Query('inspectFamily') inspectFamily?: string,
    @Query('inspectId') inspectId?: string,
    @Query('inspectVersion') inspectVersion?: string,
    @Query('appearanceKind') appearanceKind?: string,
    @Query('appearanceBindingId') appearanceBindingId?: string,
  ): Promise<HistoricalDisclosure> {
    const { accessToken } = request.authenticatedUser;
    const selected = parseSessionPosition(tc);
    const semanticDepth = parseDepth(depth);
    const inspection = parseInspection(inspectFamily, inspectId, inspectVersion, appearanceKind, appearanceBindingId);
    try {
      const knowledge = await this.projection.project(accessToken, sessionId, selected);
      return disclose(knowledge, semanticDepth, inspection);
    } catch (error) {
      if (error instanceof HistoricalProjectionUnavailableError) throw toHttp(error);
      throw error;
    }
  }
}

function toHttp(error: HistoricalProjectionUnavailableError): Error {
  const body: HistoricalProjectionUnavailableBody = { code: error.code };
  switch (error.code) {
    case 'SESSION_NOT_VISIBLE': return new NotFoundException('Conversation session was not found.');
    case 'SESSION_POSITION_NOT_ADDRESSABLE': return new BadRequestException(body);
    default: return new ConflictException(body);
  }
}

function parseSessionPosition(raw: string | undefined): number {
  if (raw === undefined || !/^[0-9]{1,16}$/u.test(raw)) throw new BadRequestException('tc must be an addressable Session Position (an integer >= 1).');
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new BadRequestException('tc must be an addressable Session Position (an integer >= 1).');
  return value;
}

function parseDepth(raw: string | undefined): HistoricalSemanticDepth {
  if (raw === undefined) return 'WORLD';
  if (!isHistoricalSemanticDepth(raw)) throw new BadRequestException('depth must be one of the five frozen semantic depths.');
  return raw;
}

function parseInspection(family?: string, id?: string, version?: string, appearanceKind?: string, appearanceBindingId?: string): HistoricalInspectionRequest | null {
  if (family === undefined && id === undefined && version === undefined && appearanceKind === undefined && appearanceBindingId === undefined) return null;
  if (!isHistoricalFamily(family)) throw new BadRequestException('inspectFamily must name one historical family.');
  if (typeof id !== 'string' || id.length === 0 || id.length > 128) throw new BadRequestException('inspectId must be a non-empty identity.');
  let parsedVersion: number | undefined;
  if (version !== undefined) {
    if (!/^[0-9]{1,16}$/u.test(version) || !Number.isSafeInteger(Number(version)) || Number(version) < 1) throw new BadRequestException('inspectVersion must be an integer >= 1.');
    parsedVersion = Number(version);
  }
  if ((appearanceKind === undefined) !== (appearanceBindingId === undefined)) throw new BadRequestException('appearanceKind and appearanceBindingId come together.');
  if (appearanceKind !== undefined) {
    if (appearanceKind !== 'THREAD_READING' && appearanceKind !== 'QUESTION_TURN') throw new BadRequestException('appearanceKind must be THREAD_READING or QUESTION_TURN.');
    if (typeof appearanceBindingId !== 'string' || appearanceBindingId.length === 0 || appearanceBindingId.length > 128) throw new BadRequestException('appearanceBindingId must be a non-empty identity.');
    return { family, id, ...(parsedVersion === undefined ? {} : { version: parsedVersion }), appearance: { kind: appearanceKind, bindingId: appearanceBindingId } };
  }
  return { family, id, ...(parsedVersion === undefined ? {} : { version: parsedVersion }) };
}
