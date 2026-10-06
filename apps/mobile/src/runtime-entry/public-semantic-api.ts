/**
 * S5-03A — the client for the semantic review of a READY_FOR_REVIEW Public Experience, beside the S5-02 authoring client
 * on the same identity-bound transport (`PublicWorldApiClient.semantic`).
 *
 *   GET  /public/authoring/drafts/:id/semantic             QANDEEL's understanding of the exact current version
 *   POST /public/authoring/drafts/:id/semantic/proposal    { commandId } → ask QANDEEL to propose it
 *   POST /public/authoring/drafts/:id/semantic/accept      { commandId, interpretationId } → accept exactly the revision seen
 *   POST /public/authoring/drafts/:id/semantic/correction  { commandId, interpretationId, meaning, primaryThemes, secondaryThemes }
 *
 * A transport and nothing else: no credential of its own, no user id, no Public ref, no lens, no readiness, no retry, no
 * meaning of its own. A correction carries the publisher's own meaning and themes and nothing else — no place, no
 * neighbour, no rank. Every answer is decoded strictly; anything else is no answer. Nothing here can publish.
 */
import type { PublicAuthoringAnswer, PublicAuthoringApiConfig } from './public-authoring-api';

/** S5-03A — QANDEEL's understanding of the exact current version of a READY_FOR_REVIEW Experience. */
export type PublicSemanticReview =
  | { readonly state: 'NOT_READY_FOR_REVIEW' | 'UNAVAILABLE' | 'NO_PROPOSAL'; readonly ready: false }
  | {
    readonly state: 'AWAITING_REVIEW' | 'REVIEWED'; readonly interpretationId: string; readonly revision: number;
    readonly origin: 'QANDEEL' | 'PUBLISHER'; readonly meaning: string; readonly primaryThemes: ReadonlyArray<string>;
    readonly secondaryThemes: ReadonlyArray<string>; readonly explanation: string | null;
    readonly decision: 'ACCEPTED' | 'CORRECTED' | null; readonly ready: boolean;
  };
export type PublicSemanticProposalOutcome = 'PROPOSED' | 'ALREADY_INTERPRETED' | 'INTERPRETATION_UNAVAILABLE' | 'STALE' | 'UNAVAILABLE'
  | 'NOT_READY_FOR_REVIEW' | 'LIMITED';
export type PublicSemanticCorrectionOutcome = 'CORRECTED' | 'NOT_SUPPORTED' | 'UNCHANGED' | 'INTERPRETATION_UNAVAILABLE'
  | 'STALE' | 'NO_PROPOSAL' | 'UNAVAILABLE' | 'NOT_READY_FOR_REVIEW' | 'LIMITED';
export type PublicSemanticAcceptOutcome = 'ACCEPTED' | 'ALREADY_ACCEPTED' | 'ALREADY_REVIEWED' | 'STALE' | 'NO_PROPOSAL' | 'NOT_READY_FOR_REVIEW'
  | 'UNAVAILABLE';
/** The publisher's correction: a meaning and its themes — never a place. */
export interface PublicSemanticCorrectionInput {
  readonly meaning: string;
  readonly primaryThemes: ReadonlyArray<string>;
  readonly secondaryThemes: ReadonlyArray<string>;
}

type Exchange = { readonly kind: 'OK'; readonly body: unknown } | { readonly kind: 'STATUS'; readonly status: number } | { readonly kind: 'NETWORK' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');
const NO: { readonly kind: 'NO_ANSWER' } = Object.freeze({ kind: 'NO_ANSWER' as const });
const yes = <T>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });

function oneOf<T extends string>(body: unknown, key: string, allowed: readonly T[]): T | null {
  return isRecord(body) && typeof body[key] === 'string' && (allowed as readonly string[]).includes(body[key] as string) ? body[key] as T : null;
}

export class PublicSemanticApiClient {
  constructor(private readonly config: PublicAuthoringApiConfig) {}

  async semanticReview(experienceId: string): Promise<PublicAuthoringAnswer<PublicSemanticReview>> {
    const answer = await this.exchange('GET', `/public/authoring/drafts/${encodeURIComponent(experienceId)}/semantic`);
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return NO;
    const b = answer.body;
    if ((b.state === 'NOT_READY_FOR_REVIEW' || b.state === 'UNAVAILABLE' || b.state === 'NO_PROPOSAL') && b.ready === false) {
      return yes({ state: b.state, ready: false });
    }
    if ((b.state !== 'AWAITING_REVIEW' && b.state !== 'REVIEWED') || !isUuid(b.interpretationId) || !isCount(b.revision) || b.revision < 1
      || (b.origin !== 'QANDEEL' && b.origin !== 'PUBLISHER') || typeof b.meaning !== 'string' || !isTextList(b.primaryThemes)
      || !isTextList(b.secondaryThemes) || (b.explanation !== null && typeof b.explanation !== 'string')
      || (b.decision !== null && b.decision !== 'ACCEPTED' && b.decision !== 'CORRECTED') || typeof b.ready !== 'boolean') return NO;
    return yes({ state: b.state, interpretationId: b.interpretationId, revision: b.revision, origin: b.origin, meaning: b.meaning,
      primaryThemes: [...b.primaryThemes], secondaryThemes: [...b.secondaryThemes], explanation: b.explanation as string | null,
      decision: b.decision as 'ACCEPTED' | 'CORRECTED' | null, ready: b.ready });
  }

  async proposeSemantic(experienceId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicSemanticProposalOutcome>> {
    const answer = await this.exchange('POST', `/public/authoring/drafts/${encodeURIComponent(experienceId)}/semantic/proposal`, { commandId });
    if (answer.kind !== 'OK') return NO;
    const outcome = oneOf(answer.body, 'outcome', ['PROPOSED', 'ALREADY_INTERPRETED', 'INTERPRETATION_UNAVAILABLE', 'STALE', 'UNAVAILABLE',
      'NOT_READY_FOR_REVIEW', 'LIMITED'] as const);
    return outcome ? yes(outcome) : NO;
  }

  async acceptSemantic(experienceId: string, commandId: string, interpretationId: string): Promise<PublicAuthoringAnswer<PublicSemanticAcceptOutcome>> {
    const answer = await this.exchange('POST', `/public/authoring/drafts/${encodeURIComponent(experienceId)}/semantic/accept`, { commandId, interpretationId });
    if (answer.kind !== 'OK') return NO;
    const outcome = oneOf(answer.body, 'outcome', ['ACCEPTED', 'ALREADY_ACCEPTED', 'ALREADY_REVIEWED', 'STALE', 'NO_PROPOSAL',
      'NOT_READY_FOR_REVIEW', 'UNAVAILABLE'] as const);
    return outcome ? yes(outcome) : NO;
  }

  async correctSemantic(experienceId: string, commandId: string, interpretationId: string,
    correction: PublicSemanticCorrectionInput): Promise<PublicAuthoringAnswer<PublicSemanticCorrectionOutcome>> {
    const answer = await this.exchange('POST', `/public/authoring/drafts/${encodeURIComponent(experienceId)}/semantic/correction`, {
      commandId, interpretationId, meaning: correction.meaning, primaryThemes: [...correction.primaryThemes], secondaryThemes: [...correction.secondaryThemes],
    });
    if (answer.kind !== 'OK') return NO;
    const outcome = oneOf(answer.body, 'outcome', ['CORRECTED', 'NOT_SUPPORTED', 'UNCHANGED', 'INTERPRETATION_UNAVAILABLE',
      'STALE', 'NO_PROPOSAL', 'UNAVAILABLE', 'NOT_READY_FOR_REVIEW', 'LIMITED'] as const);
    return outcome ? yes(outcome) : NO;
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
