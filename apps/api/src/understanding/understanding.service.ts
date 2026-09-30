import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfidenceRepository } from '../hypothesis/confidence.repository';
import { CONFIDENCE_MISSING_INFORMATION_CODES, CONFIDENCE_POLICY_VERSION, type ConfidenceEvaluationRecord, type ConfidenceMissingInformationCode } from '../hypothesis/confidence.types';
import { HypothesisService } from '../hypothesis/hypothesis.service';
import type { HypothesisRecord } from '../hypothesis/hypothesis.types';
import { EvidenceService } from '../memory/evidence.service';
import {
  auditUnderstandingDetail, auditUnderstandingList, isUnderstandingToken, projectUnderstandingConfidence,
  understandingItemRef, understandingRevision,
} from './understanding-projection';
import { UnderstandingRepository, type UnderstandingLifecycleTransitionRow } from './understanding.repository';
import {
  MAX_DETAIL_ALTERNATIVES, MAX_DETAIL_CONTEXT_ITEMS, MAX_DETAIL_EVOLUTION, THEME_BY_DOMAIN, UNDERSTANDING_LIST_DEFAULT_LIMIT,
  UNDERSTANDING_LIST_MAX_LIMIT, UNDERSTANDING_SURFACE_STATUSES, UnderstandingProjectionInvariantError,
  type UnderstandingEvolutionEntry, type UnderstandingEvolutionKind, type UnderstandingItemDetail, type UnderstandingItemSummary,
  type UnderstandingListView,
} from './understanding.types';

/** The one owned read context both routes share. Every read uses the caller's own token under RLS. */
interface OwnedContext {
  readonly surfaced: readonly HypothesisRecord[];
  readonly eligibleEvidence: ReadonlyMap<string, string>;
  readonly exactVersion: ReadonlyMap<string, readonly ConfidenceMissingInformationCode[]>;
}

/**
 * W3-MEGA-U U1 — the owner-only «فهم قنديل» projection.
 *
 * Sources, all canonical and all already owner-scoped: the caller's current Hypotheses (Hypothesis Runtime), the
 * caller's currently eligible Evidence (Evidence Layer), exact-current-version Confidence structure (Confidence
 * Runtime), and the owner-readable update / lifecycle audits for evolution. Nothing is written, generated or scored,
 * and no provider is called: the projection is deterministic.
 *
 * The caller's identity comes only from the verified token (SupabaseAuthGuard). No route accepts a user id.
 */
@Injectable()
export class UnderstandingService {
  constructor(
    private readonly hypotheses: HypothesisService,
    private readonly evidence: EvidenceService,
    private readonly confidence: ConfidenceRepository,
    private readonly repository: UnderstandingRepository,
  ) {}

  async list(userId: string, token: string, query: unknown): Promise<UnderstandingListView> {
    const limit = this.validateListQuery(query);
    return this.guard(async () => {
      const context = await this.ownedContext(userId, token);
      const items = context.surfaced.slice(0, limit).map((hypothesis) => this.summary(userId, hypothesis, context));
      const view: UnderstandingListView = { items };
      auditUnderstandingList(view);
      return view;
    });
  }

  async detail(userId: string, token: string, ref: unknown): Promise<UnderstandingItemDetail> {
    // A malformed reference and a reference that is not one of the caller's current items answer the SAME 404, so
    // the route is no oracle for another reader's items or for withdrawn ones.
    if (!isUnderstandingToken(ref)) throw new NotFoundException('Understanding item not found.');
    return this.guard(async () => {
      const context = await this.ownedContext(userId, token);
      const hypothesis = context.surfaced.find((value) => understandingItemRef(userId, value.id) === ref);
      if (!hypothesis) throw new NotFoundException('Understanding item not found.');
      const [updates, transitions] = await Promise.all([
        this.repository.listEvidenceUpdates(token, userId, hypothesis.id),
        this.repository.listLifecycleTransitions(token, userId, hypothesis.id),
      ]);
      if (!Array.isArray(updates) || !Array.isArray(transitions)) this.reject();
      const texts = (ids: readonly string[]) => ids.flatMap((id) => {
        const statement = context.eligibleEvidence.get(id);
        return statement === undefined ? [] : [statement];
      }).slice(0, MAX_DETAIL_CONTEXT_ITEMS);
      const alternatives = hypothesis.competing_hypothesis_ids
        .flatMap((id) => context.surfaced.filter((value) => value.id === id).map((value) => value.statement))
        .slice(0, MAX_DETAIL_ALTERNATIVES);
      const view: UnderstandingItemDetail = {
        ...this.summary(userId, hypothesis, context),
        evidence: texts(hypothesis.supporting_evidence_ids),
        contradictions: texts(hypothesis.contradicting_evidence_ids),
        alternatives,
        unresolved: hypothesis.assumptions.slice(0, MAX_DETAIL_CONTEXT_ITEMS),
        evolution: this.evolution(hypothesis, updates.map((row): UnderstandingEvolutionEntry => ({
          kind: row.evidence_role === 'SUPPORTING' ? 'SUPPORT_ADDED' : 'CHALLENGE_ADDED', at: row.created_at,
        })), transitions),
      };
      auditUnderstandingDetail(view);
      return view;
    });
  }

  /**
   * U2 — "talk to QANDEEL about this" (P1 §11.4). Records the reader's explicit choice of ONE of their own current
   * items, at the exact revision they saw, as their discussion focus. It edits nothing about the item.
   *   204  the focus now names this item;
   *   409  the item changed since the reader saw it (`UNDERSTANDING_ITEM_CHANGED`): nothing was written — read again;
   *   404  not one of the caller's current items.
   */
  async openDiscussion(userId: string, token: string, ref: unknown, body: unknown): Promise<void> {
    const revision = this.validateRevisionBody(body);
    if (!isUnderstandingToken(ref)) throw new NotFoundException('Understanding item not found.');
    return this.guard(async () => {
      const active = await this.ownedActive(userId, token);
      const hypothesis = active.find((value) => UNDERSTANDING_SURFACE_STATUSES.includes(value.status) && understandingItemRef(userId, value.id) === ref);
      if (!hypothesis) throw new NotFoundException('Understanding item not found.');
      if (understandingRevision(userId, hypothesis.id, hypothesis.version) !== revision) throw this.changed();
      const answer = await this.repository.openDiscussion(token, hypothesis.id, hypothesis.version);
      if (answer === 'OPENED') return;
      if (answer === 'STALE') throw this.changed();
      if (answer === 'NOT_FOUND') throw new NotFoundException('Understanding item not found.');
      this.reject();
    });
  }

  /** Close the reader's discussion focus on this item. Idempotent: nothing open, or an item no longer current, is 204. */
  async closeDiscussion(userId: string, token: string, ref: unknown): Promise<void> {
    if (!isUnderstandingToken(ref)) return;
    return this.guard(async () => {
      const hypothesis = (await this.ownedActive(userId, token)).find((value) => understandingItemRef(userId, value.id) === ref);
      if (!hypothesis) return;
      const answer = await this.repository.closeDiscussion(token, hypothesis.id);
      if (answer !== 'CLOSED' && answer !== 'NONE') this.reject();
    });
  }

  private async ownedActive(userId: string, token: string): Promise<readonly HypothesisRecord[]> {
    const active = await this.hypotheses.listActiveForUser(userId, token);
    if (!Array.isArray(active)) this.reject();
    for (const value of active) if (!value || value.user_id !== userId) this.reject();
    return active;
  }

  private validateRevisionBody(body: unknown): string {
    const value = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
    if (value === null || Object.keys(value).length !== 1 || !isUnderstandingToken(value.revision)) {
      throw new BadRequestException('Request must contain exactly one revision.');
    }
    return value.revision;
  }

  private changed(): ConflictException {
    return new ConflictException({ code: 'UNDERSTANDING_ITEM_CHANGED' });
  }

  private async ownedContext(userId: string, token: string): Promise<OwnedContext> {
    // Owner re-checked defensively on every row (ownedActive), then only CURRENT understanding is kept. The
    // repository order (updated_at DESC, id ASC) is the recency order the first view needs: most recently changed first.
    const surfaced = (await this.ownedActive(userId, token)).filter((value) => UNDERSTANDING_SURFACE_STATUSES.includes(value.status));
    if (surfaced.length === 0) return { surfaced, eligibleEvidence: new Map(), exactVersion: new Map() };
    const [eligible, evaluations] = await Promise.all([
      this.evidence.listEligibleForUser(userId, token),
      this.confidence.listExactVersionsForTargets(token, userId, surfaced.map(({ id, version }) => ({ id, version }))),
    ]);
    if (!Array.isArray(eligible) || !Array.isArray(evaluations)) this.reject();
    const exactVersion = new Map<string, readonly ConfidenceMissingInformationCode[]>();
    for (const evaluation of evaluations) {
      const target = surfaced.find(({ id }) => id === evaluation.target_id);
      if (!target) this.reject();
      this.validateEvaluation(evaluation, userId, target);
      // Newest valid exact-version record first (created_at DESC, id ASC); an older version is never a fallback.
      if (!exactVersion.has(target.id)) exactVersion.set(target.id, [...evaluation.missing_information_codes]);
    }
    return {
      surfaced,
      eligibleEvidence: new Map(eligible.map((item) => [item.evidenceId, item.statement])),
      exactVersion,
    };
  }

  private summary(userId: string, hypothesis: HypothesisRecord, context: OwnedContext): UnderstandingItemSummary {
    const eligible = (ids: readonly string[]) => ids.filter((id) => context.eligibleEvidence.has(id)).length;
    return {
      ref: understandingItemRef(userId, hypothesis.id),
      revision: understandingRevision(userId, hypothesis.id, hypothesis.version),
      theme: THEME_BY_DOMAIN[hypothesis.domain] ?? this.reject(),
      summary: hypothesis.statement,
      confidence: projectUnderstandingConfidence({
        status: hypothesis.status,
        eligibleSupporting: eligible(hypothesis.supporting_evidence_ids),
        eligibleContradicting: eligible(hypothesis.contradicting_evidence_ids),
        exactVersionMissingInformation: context.exactVersion.get(hypothesis.id) ?? null,
        contested: false,
      }),
    };
  }

  private evolution(
    hypothesis: HypothesisRecord, updates: UnderstandingEvolutionEntry[], transitions: readonly UnderstandingLifecycleTransitionRow[],
  ): UnderstandingEvolutionEntry[] {
    const lifecycle = transitions.flatMap((row): UnderstandingEvolutionEntry[] => {
      const kind = lifecycleKind(row);
      return kind === null ? [] : [{ kind, at: row.created_at }];
    });
    const first: UnderstandingEvolutionEntry = { kind: 'FIRST_SEEN', at: hypothesis.created_at };
    return [...updates, ...lifecycle, first]
      .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
      .slice(0, MAX_DETAIL_EVOLUTION);
  }

  private validateEvaluation(value: ConfidenceEvaluationRecord, userId: string, target: HypothesisRecord): void {
    if (value.user_id !== userId || value.target_type !== 'HYPOTHESIS' || value.target_version !== target.version ||
      value.lifecycle_state !== 'EVALUATED' || value.numeric_score !== null || value.confidence_band !== null ||
      value.calibration_state !== 'UNCALIBRATED' || value.stability !== 'UNASSESSED' ||
      value.policy_version !== CONFIDENCE_POLICY_VERSION || value.provenance !== 'QANDEEL_CONFIDENCE_RUNTIME' ||
      !Array.isArray(value.missing_information_codes) ||
      value.missing_information_codes.some((code) => !CONFIDENCE_MISSING_INFORMATION_CODES.includes(code))) this.reject();
  }

  private validateListQuery(query: unknown): number {
    const value = (query && typeof query === 'object' ? query : {}) as Record<string, unknown>;
    if (Object.keys(value).some((key) => key !== 'limit')) throw new BadRequestException('Request contains unsupported query parameters.');
    if (value.limit === undefined) return UNDERSTANDING_LIST_DEFAULT_LIMIT;
    const limit = typeof value.limit === 'string' && /^[1-9][0-9]{0,1}$/u.test(value.limit) ? Number(value.limit) : Number.NaN;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > UNDERSTANDING_LIST_MAX_LIMIT) {
      throw new BadRequestException(`limit must be an integer between 1 and ${UNDERSTANDING_LIST_MAX_LIMIT}.`);
    }
    return limit;
  }

  // Refusals the reader may see stay as they are (404, 400). Everything else — an upstream failure, a malformed
  // canonical row, a projection invariant — fails closed as one sanitized 503 that names nothing internal.
  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException('Understanding is unavailable.');
    }
  }

  private reject(): never { throw new UnderstandingProjectionInvariantError(); }
}

function lifecycleKind(row: UnderstandingLifecycleTransitionRow): UnderstandingEvolutionKind | null {
  // The generation-time CANDIDATE -> ACTIVE admission is the item's first appearance, already FIRST_SEEN.
  if (row.source === 'SYSTEM_GENERATION_ACTIVATION') return null;
  switch (row.after_status) {
    case 'SUPPORTED': return 'STRENGTHENED';
    case 'WEAK': return 'WEAKENED';
    case 'MIXED': return 'BECAME_MIXED';
    case 'REJECTED': case 'RETIRED': return 'WITHDRAWN';
    case 'REOPENED': return 'RECONSIDERED';
    case 'ACTIVE': return row.before_status === 'WEAK' ? 'RECONSIDERED' : null;
    default: return null;
  }
}
