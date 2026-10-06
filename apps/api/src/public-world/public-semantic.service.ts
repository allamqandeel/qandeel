import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT, PUBLIC_SEMANTIC_INTERPRETER, SEMANTIC_MEANING_MAX, SEMANTIC_PRIMARY_THEMES,
  SEMANTIC_SECONDARY_THEMES, areDisjointThemes, decodePublicSemanticAssessment, decodePublicSemanticProposal, isSemanticText,
  isSemanticThemeSet, type PublicSemanticInterpreter, type PublicSemanticPackageInput, type PublicSemanticPackageItem,
} from './public-semantic-interpreter';
import type { PublicSemanticInputRow, PublicSemanticReviewRow } from './public-semantic.repository';
import { PublicSemanticRepository } from './public-semantic.repository';

export type PublicSemanticReviewView =
  | { readonly state: 'NOT_READY_FOR_REVIEW' | 'UNAVAILABLE' | 'NO_PROPOSAL'; readonly ready: false }
  | {
    readonly state: 'AWAITING_REVIEW' | 'REVIEWED'; readonly interpretationId: string; readonly revision: number;
    readonly origin: 'QANDEEL' | 'PUBLISHER'; readonly meaning: string; readonly primaryThemes: ReadonlyArray<string>;
    readonly secondaryThemes: ReadonlyArray<string>; readonly explanation: string | null;
    readonly decision: 'ACCEPTED' | 'CORRECTED' | null; readonly ready: boolean;
  };
export interface PublicSemanticProposalView {
  readonly outcome: 'PROPOSED' | 'ALREADY_INTERPRETED' | 'INTERPRETATION_UNAVAILABLE' | 'STALE' | 'UNAVAILABLE' | 'NOT_READY_FOR_REVIEW' | 'LIMITED';
}
export interface PublicSemanticCorrectionView {
  readonly outcome: 'CORRECTED' | 'NOT_SUPPORTED' | 'UNCHANGED' | 'QUOTES_CONTENT' | 'INTERPRETATION_UNAVAILABLE' | 'STALE' | 'NO_PROPOSAL'
    | 'UNAVAILABLE' | 'NOT_READY_FOR_REVIEW' | 'LIMITED';
}
export interface PublicSemanticAcceptView {
  readonly outcome: 'ACCEPTED' | 'ALREADY_ACCEPTED' | 'ALREADY_REVIEWED' | 'STALE' | 'NO_PROPOSAL' | 'NOT_READY_FOR_REVIEW' | 'UNAVAILABLE';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** One interpreter call is bounded: a hung provider is an unavailable interpretation, never a hung request. */
export const SEMANTIC_INTERPRETATION_TIMEOUT_MS = 20_000;
const ACCEPT_OUTCOMES: readonly string[] = ['ACCEPTED', 'ALREADY_ACCEPTED', 'ALREADY_REVIEWED', 'STALE', 'NO_PROPOSAL', 'NOT_READY_FOR_REVIEW', 'UNAVAILABLE'];

const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException('Public semantic review is unavailable.'); };
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

function commandOf(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  const value = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  if (!value || Object.keys(value).some((key) => !allowed.includes(key)) || !isUuid(value.commandId)) invalid();
  return value as Record<string, unknown>;
}

/** What one interpreter attempt came to, before the human's commit. */
type Interpreted = 'RECORDED' | 'INTERPRETATION_UNAVAILABLE' | 'STALE' | 'UNAVAILABLE';

/**
 * S5-03A — the semantic stage of «العالم العام» / Public World, between READY_FOR_REVIEW and any later publication:
 *
 *   - the exact controller's review of QANDEEL's proposed meaning for the exact current Experience Version;
 *   - ask QANDEEL to propose: a work is opened on the human's token, the PACKAGE-ONLY input is read and the interpreter's
 *     answer recorded on the server channel, and the human's own commit adopts it as revision 1;
 *   - accept exactly the revision seen;
 *   - correct the MEANING in one's own words (a short meaning and themes — never a location); QANDEEL checks the
 *     correction against the same package on the server channel; only a CONSISTENT correction becomes the next revision.
 *
 * The interpreter sees the package the database served and nothing else: this service holds no Personal, Shared,
 * memory, Human Intelligence or account context to give it, and a correction's words reach it as the database stored
 * them, not as the client sent them. Nothing here publishes; nothing here is logged.
 */
@Injectable()
export class PublicSemanticService {
  constructor(
    private readonly repository: PublicSemanticRepository,
    @Inject(PUBLIC_SEMANTIC_INTERPRETER) private readonly interpreter: PublicSemanticInterpreter,
  ) {}

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      return unavailable();
    }
  }

  review(token: string, experienceId: string): Promise<PublicSemanticReviewView> {
    if (!isUuid(experienceId)) return Promise.resolve({ state: 'UNAVAILABLE', ready: false });
    return this.guard(async () => {
      const rows = await this.repository.review(token, experienceId);
      if (!Array.isArray(rows)) return unavailable();
      // No row: not this human's Experience, or none at all. One neutral answer.
      if (rows.length === 0) return { state: 'UNAVAILABLE', ready: false };
      if (rows.length !== 1) return unavailable();
      return reviewOf(rows[0]);
    });
  }

  proposal(token: string, experienceId: string, body: unknown): Promise<PublicSemanticProposalView> {
    const { commandId } = commandOf(body, ['commandId']);
    if (!isUuid(experienceId)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      const [begun] = await this.repository.requestProposal(token, commandId as string, experienceId);
      if (!begun) return unavailable();
      switch (begun.outcome) {
        case 'ALREADY_INTERPRETED': case 'NOT_READY_FOR_REVIEW': case 'UNAVAILABLE': case 'STALE': case 'LIMITED':
          return { outcome: begun.outcome };
        case 'WORK_STAGED': case 'WORK_OPEN': break;
        default: return unavailable();
      }
      if (!isUuid(begun.work_id)) return unavailable();
      if (begun.outcome === 'WORK_OPEN') {
        const interpreted = await this.interpretProposal(begun.work_id);
        if (interpreted !== 'RECORDED') return { outcome: interpreted };
      }
      const [committed] = await this.repository.commit(token, begun.work_id);
      switch (committed?.outcome) {
        case 'PROPOSED': case 'ALREADY_COMMITTED': return { outcome: 'PROPOSED' };
        case 'PENDING': return { outcome: 'INTERPRETATION_UNAVAILABLE' };
        case 'STALE': case 'UNAVAILABLE': case 'NOT_READY_FOR_REVIEW': return { outcome: committed.outcome };
        default: return unavailable();
      }
    });
  }

  correction(token: string, experienceId: string, body: unknown): Promise<PublicSemanticCorrectionView> {
    const value = commandOf(body, ['commandId', 'interpretationId', 'meaning', 'primaryThemes', 'secondaryThemes']);
    const secondaryThemes = value.secondaryThemes ?? [];
    if (!isUuid(value.interpretationId) || !isSemanticText(value.meaning, SEMANTIC_MEANING_MAX)
      || !isSemanticThemeSet(value.primaryThemes, SEMANTIC_PRIMARY_THEMES) || !isSemanticThemeSet(secondaryThemes, SEMANTIC_SECONDARY_THEMES)
      || !areDisjointThemes(value.primaryThemes, secondaryThemes)) invalid();
    if (!isUuid(experienceId)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      const [begun] = await this.repository.requestCorrection(token, value.commandId as string, experienceId, value.interpretationId as string,
        value.meaning as string, value.primaryThemes as string[], secondaryThemes as string[]);
      if (!begun) return unavailable();
      switch (begun.outcome) {
        case 'UNCHANGED': case 'QUOTES_CONTENT': case 'NO_PROPOSAL': case 'STALE': case 'UNAVAILABLE': case 'NOT_READY_FOR_REVIEW': case 'LIMITED':
          return { outcome: begun.outcome };
        case 'WORK_STAGED': case 'WORK_OPEN': break;
        default: return unavailable();
      }
      if (!isUuid(begun.work_id)) return unavailable();
      if (begun.outcome === 'WORK_OPEN') {
        const interpreted = await this.assessCorrection(begun.work_id);
        if (interpreted !== 'RECORDED') return { outcome: interpreted };
      }
      const [committed] = await this.repository.commit(token, begun.work_id);
      switch (committed?.outcome) {
        case 'CORRECTED': case 'ALREADY_COMMITTED': return { outcome: 'CORRECTED' };
        case 'NOT_SUPPORTED': return { outcome: 'NOT_SUPPORTED' };
        case 'PENDING': return { outcome: 'INTERPRETATION_UNAVAILABLE' };
        case 'STALE': case 'UNAVAILABLE': case 'NOT_READY_FOR_REVIEW': return { outcome: committed.outcome };
        default: return unavailable();
      }
    });
  }

  accept(token: string, experienceId: string, body: unknown): Promise<PublicSemanticAcceptView> {
    const value = commandOf(body, ['commandId', 'interpretationId']);
    if (!isUuid(value.interpretationId)) invalid();
    if (!isUuid(experienceId)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      const [row] = await this.repository.accept(token, value.commandId as string, experienceId, value.interpretationId as string);
      if (!row || !ACCEPT_OUTCOMES.includes(row.outcome)) return unavailable();
      return { outcome: row.outcome as PublicSemanticAcceptView['outcome'] };
    });
  }

  // ------------------------------------------------------------------------------------------- the server channel

  private async interpretProposal(workId: string): Promise<Interpreted> {
    const rows = await this.repository.workInput(workId);
    const input = packageOf(rows, 'PROPOSAL');
    if (input === null) return 'STALE';
    const proposal = decodePublicSemanticProposal(await this.call((signal) => this.interpreter.propose(input.package, signal)));
    if (!proposal) return 'INTERPRETATION_UNAVAILABLE';
    return recorded(await this.repository.recordOutcome(workId, 'PROPOSED', {
      lensKey: proposal.placementIntent.lensKey, meaning: proposal.meaning, primaryThemes: proposal.primaryThemes,
      secondaryThemes: proposal.secondaryThemes, explanation: proposal.explanation,
    }).catch(() => null));
  }

  private async assessCorrection(workId: string): Promise<Interpreted> {
    const rows = await this.repository.workInput(workId);
    const input = packageOf(rows, 'CORRECTION');
    if (input === null || input.correction === null) return 'STALE';
    const correction = input.correction;
    const assessment = decodePublicSemanticAssessment(
      await this.call((signal) => this.interpreter.assessCorrection({ ...input.package, correction }, signal)));
    if (!assessment) return 'INTERPRETATION_UNAVAILABLE';
    const none = { lensKey: null, meaning: null, primaryThemes: null, secondaryThemes: null, explanation: null };
    return recorded(await (assessment.verdict === 'CONSISTENT'
      ? this.repository.recordOutcome(workId, 'CONSISTENT', { ...none, lensKey: assessment.placementIntent.lensKey })
      : this.repository.recordOutcome(workId, 'NOT_SUPPORTED', none)).catch(() => null));
  }

  /** One bounded interpreter attempt. Any failure — unavailable, refused, timed out — is no answer. */
  private async call(attempt: (signal: AbortSignal) => Promise<unknown>): Promise<unknown> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        attempt(controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, SEMANTIC_INTERPRETATION_TIMEOUT_MS);
        }),
      ]);
    } catch {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function recorded(rows: ReadonlyArray<{ readonly outcome: string }> | null): Interpreted {
  const outcome = rows?.[0]?.outcome;
  if (outcome === 'RECORDED' || outcome === 'ALREADY_RECORDED') return 'RECORDED';
  if (outcome === 'STALE' || outcome === 'UNAVAILABLE') return outcome;
  // COPIES_PACKAGE, a refused shape, or no answer: QANDEEL produced no usable interpretation.
  return 'INTERPRETATION_UNAVAILABLE';
}

/** The package-only input exactly as the database served it, decoded strictly; null when there is none to serve. */
function packageOf(rows: readonly PublicSemanticInputRow[], kind: 'PROPOSAL' | 'CORRECTION'):
  { readonly package: PublicSemanticPackageInput; readonly correction: { meaning: string; primaryThemes: string[]; secondaryThemes: string[] } | null } | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const items: PublicSemanticPackageItem[] = [];
  for (const row of rows) {
    if (row.work_kind !== kind || !Number.isInteger(row.item_ordinal) || row.item_ordinal < 1 || typeof row.item_text !== 'string'
      || (row.item_kind !== 'SOURCE_CONTENT' && row.item_kind !== 'ANALYSIS')) return null;
    items.push(Object.freeze({ ordinal: row.item_ordinal, kind: row.item_kind, text: row.item_text }));
  }
  const [head] = rows;
  const correction = kind === 'CORRECTION'
    ? (isSemanticText(head.correction_meaning, SEMANTIC_MEANING_MAX) && isSemanticThemeSet(head.correction_primary_themes, SEMANTIC_PRIMARY_THEMES)
      && isSemanticThemeSet(head.correction_secondary_themes, SEMANTIC_SECONDARY_THEMES)
      ? { meaning: head.correction_meaning, primaryThemes: [...head.correction_primary_themes], secondaryThemes: [...head.correction_secondary_themes] }
      : null)
    : null;
  if (kind === 'CORRECTION' && correction === null) return null;
  return { package: Object.freeze({ contract: PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT, items: Object.freeze(items) }), correction };
}

function reviewOf(row: PublicSemanticReviewRow): PublicSemanticReviewView {
  if (row.semantic_state === 'NOT_READY_FOR_REVIEW' || row.semantic_state === 'UNAVAILABLE' || row.semantic_state === 'NO_PROPOSAL') {
    return { state: row.semantic_state, ready: false };
  }
  if (row.semantic_state !== 'AWAITING_REVIEW' && row.semantic_state !== 'REVIEWED') return unavailable();
  const origin = row.interpretation_origin === 'QANDEEL_PROPOSAL' ? 'QANDEEL' : row.interpretation_origin === 'PUBLISHER_CORRECTION' ? 'PUBLISHER' : null;
  const decision = row.review_decision === null ? null : row.review_decision === 'ACCEPTED' || row.review_decision === 'CORRECTED' ? row.review_decision : undefined;
  if (!isUuid(row.interpretation_id) || !Number.isInteger(row.interpretation_revision) || (row.interpretation_revision ?? 0) < 1 || origin === null
    || typeof row.meaning !== 'string' || !Array.isArray(row.primary_themes) || !Array.isArray(row.secondary_themes)
    || (row.explanation !== null && typeof row.explanation !== 'string') || decision === undefined || typeof row.semantically_ready !== 'boolean'
    || (row.semantic_state === 'REVIEWED') !== (decision !== null)) return unavailable();
  return {
    state: row.semantic_state, interpretationId: row.interpretation_id, revision: row.interpretation_revision as number, origin,
    meaning: row.meaning, primaryThemes: [...row.primary_themes], secondaryThemes: [...row.secondary_themes], explanation: row.explanation,
    decision, ready: row.semantically_ready,
  };
}
