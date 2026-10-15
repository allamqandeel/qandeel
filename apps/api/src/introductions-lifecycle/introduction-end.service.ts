import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError, readDataApiUpstreamIdentity } from '../conversation/supabase-data-api.service';
import { IntroductionEndRepository } from './introduction-end.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * ENDED: this human's Introduction is ended (also the answer to a retry of the committed command).
 * ALREADY_SETTLED: it had already reached its one terminal outcome; never which one, or who.
 * UNAVAILABLE: anything else - not one of its two humans, no such World, or a command id bound to another request.
 */
export type IntroductionEndOutcome = 'ENDED' | 'ALREADY_SETTLED' | 'UNAVAILABLE';
const OUTCOMES: readonly IntroductionEndOutcome[] = ['ENDED', 'ALREADY_SETTLED', 'UNAVAILABLE'];

const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException('Introductions are unavailable.'); };

/**
 * S6-02 — either matched human ends their Introduction alone (GATE-34, decision D1). The request carries the World
 * (route) and one command id (body) and nothing else; there is no gate, no counterpart and no retry here: a repeated
 * request is the same command, answered by the database from its committed row. Nothing is logged.
 */
@Injectable()
export class IntroductionEndService {
  constructor(private readonly repository: IntroductionEndRepository) {}

  async end(token: string, worldId: string, body: unknown): Promise<{ readonly outcome: IntroductionEndOutcome }> {
    const value = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
    if (Object.keys(value).some((key) => key !== 'commandId') || typeof value.commandId !== 'string' || !UUID.test(value.commandId)) invalid();
    if (!UUID.test(worldId)) return { outcome: 'UNAVAILABLE' };
    try {
      const [row] = await this.repository.end(token, value.commandId as string, worldId);
      const outcome = OUTCOMES.find((candidate) => candidate === row?.outcome);
      return outcome === undefined ? unavailable() : { outcome };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      // Only a request the database refuses as malformed (22023) is the client's own contradiction. Any other refusal -
      // a contradictory server state included - is unavailable: an exit is never blamed on the person leaving.
      if (error instanceof DataApiError && error.status === 400 && readDataApiUpstreamIdentity(error).databaseCode === '22023') return invalid();
      return unavailable();
    }
  }
}
