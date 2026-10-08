import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { PublicRelationAct, PublicRelationExperienceRow, PublicRelationRow } from './public-relation.repository';
import { PublicRelationRepository } from './public-relation.repository';
import { PublicActivityProducer } from './public-activity.producer';

/** One of the reader's own Experiences served in the Public World now, named by its reviewed meaning. */
export interface PublicRelationExperienceView { readonly id: string; readonly meaning: string }
/** One current relation from the reader's side; the other Experience is named by its reviewed meaning only. */
export interface PublicRelationView {
  readonly relationId: string;
  readonly experienceId: string;
  readonly other: { readonly id: string; readonly meaning: string };
  readonly state: 'ACTIVE' | 'REQUEST_SENT' | 'REQUEST_RECEIVED';
}
export interface PublicRelationsView {
  readonly experiences: ReadonlyArray<PublicRelationExperienceView>;
  readonly relations: ReadonlyArray<PublicRelationView>;
}
export interface PublicRelationRequestView { readonly outcome: 'REQUESTED' | 'ALREADY_PENDING' | 'ALREADY_RELATED' | 'UNAVAILABLE' }
export interface PublicRelationActView {
  readonly outcome: 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'REMOVED' | 'NOT_PENDING' | 'NOT_ACTIVE' | 'UNAVAILABLE';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** The database's bounds: at most 100 own served Experiences and 200 current relations per read. */
export const PUBLIC_RELATION_EXPERIENCES_MAX = 100;
export const PUBLIC_RELATIONS_MAX = 200;
const STATES: readonly string[] = ['ACTIVE', 'REQUEST_SENT', 'REQUEST_RECEIVED'];
const REQUEST_OUTCOMES: readonly string[] = ['REQUESTED', 'ALREADY_PENDING', 'ALREADY_RELATED', 'UNAVAILABLE'];
const DONE: Readonly<Record<PublicRelationAct, PublicRelationActView['outcome']>> = Object.freeze({
  accept: 'ACCEPTED', decline: 'DECLINED', cancel: 'CANCELLED', remove: 'REMOVED',
});
/** What each act may answer besides its own word: a request that no longer waits, or a relation that is not active. */
const OTHER: Readonly<Record<PublicRelationAct, PublicRelationActView['outcome']>> = Object.freeze({
  accept: 'NOT_PENDING', decline: 'NOT_PENDING', cancel: 'NOT_PENDING', remove: 'NOT_ACTIVE',
});

const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException('Public relations are unavailable.'); };
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isMeaning = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** Exactly the keys given, each a uuid. */
function commandBody(body: unknown, keys: readonly string[]): Record<string, string> {
  const value = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  if (!value || Object.keys(value).length !== keys.length || !keys.every((key) => isUuid(value[key]))) return invalid();
  return value as Record<string, string>;
}

/**
 * S5-03C — the reader's management of explicit Public relations, inside the Public authoring workspace:
 *
 *   - their own Experiences served in the Public World now, and every current relation from their side: ACTIVE, a
 *     request they sent (which they may cancel), a request they received (which they may accept or decline);
 *   - asking for a relation from one of their own served Experiences to another served Experience;
 *   - the four acts. Which side may act is decided by the database from the caller's own token, never by a body.
 *
 * Every answer is re-derived by the database now. A relation whose bound endpoints are no longer exactly what is served,
 * or whose other endpoint the reader cannot see, is simply absent; an act on it is one neutral UNAVAILABLE. Nothing here
 * suggests a relation, ranks, counts, publishes, notifies or logs.
 */
@Injectable()
export class PublicRelationService {
  constructor(private readonly repository: PublicRelationRepository, private readonly activity: PublicActivityProducer) {}

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      return unavailable();
    }
  }

  relations(token: string): Promise<PublicRelationsView> {
    return this.guard(async () => {
      const [experiences, relations] = await Promise.all([this.repository.experiences(token), this.repository.relations(token)]);
      return { experiences: experiencesOf(experiences), relations: relationsOf(relations) };
    });
  }

  /** { commandId, experienceId, otherExperienceId }: from the reader's own served Experience to another served one. */
  request(token: string, body: unknown): Promise<PublicRelationRequestView> {
    const value = commandBody(body, ['commandId', 'experienceId', 'otherExperienceId']);
    if (value.experienceId.toLowerCase() === value.otherExperienceId.toLowerCase()) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      const rows = await this.repository.request(token, value.commandId, value.experienceId, value.otherExperienceId);
      if (!Array.isArray(rows) || rows.length !== 1 || !REQUEST_OUTCOMES.includes(rows[0].outcome)) return unavailable();
      // S5-04: a committed request is projected to the target side's Activity (recipients derived by the database).
      if (rows[0].outcome === 'REQUESTED' && isUuid(rows[0].relation_id)) await this.activity.relationRequested(rows[0].relation_id).catch(() => undefined);
      return { outcome: rows[0].outcome as PublicRelationRequestView['outcome'] };
    });
  }

  /** { commandId } on one relation the reader's side may act on. */
  act(token: string, act: PublicRelationAct, relationId: string, body: unknown): Promise<PublicRelationActView> {
    const value = commandBody(body, ['commandId']);
    if (!isUuid(relationId)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      const rows = await this.repository.act(token, act, value.commandId, relationId);
      if (!Array.isArray(rows) || rows.length !== 1) return unavailable();
      const { outcome } = rows[0];
      if (outcome !== DONE[act] && outcome !== OTHER[act] && outcome !== 'UNAVAILABLE') return unavailable();
      // S5-04: Activity is a projection only — an acceptance tells the requester; every ending withdraws the request item.
      if (outcome === DONE[act]) {
        await (act === 'accept' ? this.activity.relationAccepted(relationId) : this.activity.relationEnded(relationId)).catch(() => undefined);
      }
      return { outcome: outcome as PublicRelationActView['outcome'] };
    });
  }
}

function experiencesOf(rows: readonly PublicRelationExperienceRow[]): PublicRelationExperienceView[] {
  if (!Array.isArray(rows) || rows.length > PUBLIC_RELATION_EXPERIENCES_MAX) return unavailable();
  return rows.map((row) => (isUuid(row?.experience_id) && isMeaning(row.meaning) ? { id: row.experience_id, meaning: row.meaning } : unavailable()));
}

function relationsOf(rows: readonly PublicRelationRow[]): PublicRelationView[] {
  if (!Array.isArray(rows) || rows.length > PUBLIC_RELATIONS_MAX) return unavailable();
  return rows.map((row) => (isUuid(row?.relation_id) && isUuid(row.experience_id) && isUuid(row.other_experience_id)
    && isMeaning(row.other_meaning) && STATES.includes(row.relation_state)
    ? {
      relationId: row.relation_id, experienceId: row.experience_id,
      other: { id: row.other_experience_id, meaning: row.other_meaning }, state: row.relation_state as PublicRelationView['state'],
    }
    : unavailable()));
}
