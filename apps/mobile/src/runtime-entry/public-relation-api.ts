/**
 * S5-03C — the client for explicit Public relations, managed inside the «العالم العام» / Public World authoring workspace,
 * beside the S5-01 … S5-03B clients on the same identity-bound transport (`PublicWorldApiClient.relation`).
 *
 *   GET  /public/authoring/relations                       the reader's own served Experiences and current relations
 *   POST /public/authoring/relations                       { commandId, experienceId, otherExperienceId } → ask for one
 *   POST /public/authoring/relations/:id/accept|decline|cancel|remove     { commandId }
 *
 * A transport and nothing else: no credential of its own, no viewer id, no side, no type, no strength, no text, no
 * retry. Which side may act is decided by the server from the reader's own token. Every answer is decoded strictly;
 * anything else is no answer.
 */
import type { PublicAuthoringAnswer, PublicAuthoringApiConfig } from './public-authoring-api';

/** One of the reader's own Experiences served in the Public World now, named by its reviewed meaning. */
export interface PublicRelationExperience { readonly id: string; readonly meaning: string }
/** One current relation from the reader's side; the other Experience is named by its reviewed meaning only. */
export interface PublicRelation {
  readonly relationId: string;
  readonly experienceId: string;
  readonly other: { readonly id: string; readonly meaning: string };
  readonly state: 'ACTIVE' | 'REQUEST_SENT' | 'REQUEST_RECEIVED';
}
export interface PublicRelations {
  readonly experiences: ReadonlyArray<PublicRelationExperience>;
  readonly relations: ReadonlyArray<PublicRelation>;
}
export type PublicRelationRequestOutcome = 'REQUESTED' | 'ALREADY_PENDING' | 'ALREADY_RELATED' | 'UNAVAILABLE';
export type PublicRelationAct = 'accept' | 'decline' | 'cancel' | 'remove';
export type PublicRelationActOutcome = 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'REMOVED' | 'NOT_PENDING' | 'NOT_ACTIVE' | 'UNAVAILABLE';

type Exchange = { readonly kind: 'OK'; readonly body: unknown } | { readonly kind: 'STATUS'; readonly status: number } | { readonly kind: 'NETWORK' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isMeaning = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
};
const NO: { readonly kind: 'NO_ANSWER' } = Object.freeze({ kind: 'NO_ANSWER' as const });
const yes = <T>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });

/** The bounds the server holds the management read to; an answer beyond them is no answer. */
export const PUBLIC_RELATION_EXPERIENCES_MAX = 100;
export const PUBLIC_RELATIONS_MAX = 200;
const STATES: readonly string[] = ['ACTIVE', 'REQUEST_SENT', 'REQUEST_RECEIVED'];
const REQUEST_OUTCOMES: readonly string[] = ['REQUESTED', 'ALREADY_PENDING', 'ALREADY_RELATED', 'UNAVAILABLE'];
const ACT_OUTCOMES: Readonly<Record<PublicRelationAct, readonly string[]>> = Object.freeze({
  accept: ['ACCEPTED', 'NOT_PENDING', 'UNAVAILABLE'],
  decline: ['DECLINED', 'NOT_PENDING', 'UNAVAILABLE'],
  cancel: ['CANCELLED', 'NOT_PENDING', 'UNAVAILABLE'],
  remove: ['REMOVED', 'NOT_ACTIVE', 'UNAVAILABLE'],
});

function experienceOf(value: unknown): PublicRelationExperience | null {
  return isRecord(value) && hasExactly(value, ['id', 'meaning']) && isUuid(value.id) && isMeaning(value.meaning)
    ? Object.freeze({ id: value.id, meaning: value.meaning }) : null;
}

function relationOf(value: unknown): PublicRelation | null {
  if (!isRecord(value) || !hasExactly(value, ['relationId', 'experienceId', 'other', 'state']) || !isUuid(value.relationId)
    || !isUuid(value.experienceId) || typeof value.state !== 'string' || !STATES.includes(value.state)) return null;
  const other = experienceOf(value.other);
  return other ? Object.freeze({ relationId: value.relationId, experienceId: value.experienceId, other, state: value.state as PublicRelation['state'] }) : null;
}

export class PublicRelationApiClient {
  constructor(private readonly config: PublicAuthoringApiConfig) {}

  async relations(): Promise<PublicAuthoringAnswer<PublicRelations>> {
    const answer = await this.exchange('GET', '/public/authoring/relations');
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['experiences', 'relations'])) return NO;
    const { experiences, relations } = answer.body;
    if (!Array.isArray(experiences) || experiences.length > PUBLIC_RELATION_EXPERIENCES_MAX
      || !Array.isArray(relations) || relations.length > PUBLIC_RELATIONS_MAX) return NO;
    const ownExperiences = experiences.map(experienceOf);
    const ownRelations = relations.map(relationOf);
    if (!ownExperiences.every((e): e is PublicRelationExperience => e !== null) || !ownRelations.every((r): r is PublicRelation => r !== null)) return NO;
    return yes({ experiences: ownExperiences, relations: ownRelations });
  }

  async request(experienceId: string, otherExperienceId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicRelationRequestOutcome>> {
    const answer = await this.exchange('POST', '/public/authoring/relations', { commandId, experienceId, otherExperienceId });
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['outcome'])) return NO;
    const outcome = answer.body.outcome;
    return typeof outcome === 'string' && REQUEST_OUTCOMES.includes(outcome) ? yes(outcome as PublicRelationRequestOutcome) : NO;
  }

  async act(act: PublicRelationAct, relationId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicRelationActOutcome>> {
    const answer = await this.exchange('POST', `/public/authoring/relations/${encodeURIComponent(relationId)}/${act}`, { commandId });
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['outcome'])) return NO;
    const outcome = answer.body.outcome;
    return typeof outcome === 'string' && ACT_OUTCOMES[act].includes(outcome) ? yes(outcome as PublicRelationActOutcome) : NO;
  }

  private async exchange(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<Exchange> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: payload === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      if (!response.ok) return { kind: 'STATUS', status: response.status };
      return { kind: 'OK', body: (await response.json()) as unknown };
    } catch {
      return { kind: 'NETWORK' };
    }
  }
}
