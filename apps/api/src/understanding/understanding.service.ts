import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfidenceRepository } from '../hypothesis/confidence.repository';
import { CONFIDENCE_MISSING_INFORMATION_CODES, CONFIDENCE_POLICY_VERSION, type ConfidenceEvaluationRecord, type ConfidenceMissingInformationCode } from '../hypothesis/confidence.types';
import { ConfidenceService } from '../hypothesis/confidence.service';
import { HypothesisService } from '../hypothesis/hypothesis.service';
import type { HypothesisRecord } from '../hypothesis/hypothesis.types';
import { EvidenceService } from '../memory/evidence.service';
import { classifyOperationalFailure, type OperationalFailureClass } from '../observability/operational-failure';
import { TelemetryService } from '../observability/telemetry.service';
import {
  auditUnderstandingDetail, auditUnderstandingList, isUnderstandingToken, projectUnderstandingConfidence,
  understandingItemRef, understandingRevision,
} from './understanding-projection';
import {
  UnderstandingRepository, type UnderstandingContestHistoryRow, type UnderstandingContestRow, type UnderstandingLifecycleTransitionRow,
} from './understanding.repository';
import {
  MAX_DETAIL_ALTERNATIVES, MAX_DETAIL_CONTEXT_ITEMS, MAX_DETAIL_EVOLUTION, THEME_BY_DOMAIN, UNDERSTANDING_LIST_DEFAULT_LIMIT,
  UNDERSTANDING_LIST_MAX_LIMIT, UNDERSTANDING_SURFACE_STATUSES, UnderstandingProjectionInvariantError,
  type UnderstandingEvolutionEntry, type UnderstandingEvolutionKind, type UnderstandingItemDetail, type UnderstandingItemSummary,
  type UnderstandingDisagreementView, type UnderstandingListView, type UnderstandingResolutionView,
} from './understanding.types';

/** The one owned read context both routes share. Every read uses the caller's own token under RLS. */
interface OwnedContext {
  readonly surfaced: readonly HypothesisRecord[];
  readonly eligibleEvidence: ReadonlyMap<string, string>;
  readonly exactVersion: ReadonlyMap<string, readonly ConfidenceMissingInformationCode[]>;
  /** U3: the reader's contests under review, by item. */
  readonly contests: ReadonlyMap<string, UnderstandingContestRow>;
}

const COMMAND_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EVALUATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const isEvaluationId = (value: unknown): value is string => typeof value === 'string' && EVALUATION_ID.test(value);

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
    // U3: the Confidence Runtime's own exact-version evaluation, for the re-evaluation after a disagreement.
    private readonly confidenceRuntime: ConfidenceService,
    // PROD-OPS-01: content-free visibility of the re-evaluation's outcome; never an input to any answer.
    private readonly telemetry: TelemetryService,
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
      const [updates, transitions, contestHistory] = await Promise.all([
        this.repository.listEvidenceUpdates(token, userId, hypothesis.id),
        this.repository.listLifecycleTransitions(token, userId, hypothesis.id),
        this.repository.listContestHistory(token, userId, hypothesis.id),
      ]);
      if (!Array.isArray(updates) || !Array.isArray(transitions) || !Array.isArray(contestHistory)) this.reject();
      for (const row of contestHistory) this.validateContestHistory(row);
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
        })), transitions, contestHistory),
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

  /**
   * U3 — an EXPLICIT disagreement with one of the caller's current items (P1 §11.4, PG-01), bound to the exact revision
   * the reader saw and to one command identity. The database records the contest and performs the re-evaluation's
   * lifecycle step in one transaction (migration 0127); the Confidence Runtime then evaluates the exact re-evaluated
   * version. Nothing is deleted, no statement is rewritten and no conversation text is stored.
   *   200  { underReview: true, revision }  — recorded now, the same command replayed, or already under review;
   *   409  UNDERSTANDING_ITEM_CHANGED        — the item changed since the reader saw it; nothing was recorded;
   *   409  UNDERSTANDING_COMMAND_CONFLICT    — this command identity was spent on another item or version;
   *   404                                    — not one of the caller's current items.
   */
  async disagree(userId: string, token: string, ref: unknown, body: unknown): Promise<UnderstandingDisagreementView> {
    const { commandId, revision } = this.validateDisagreementBody(body);
    if (!isUnderstandingToken(ref)) throw new NotFoundException('Understanding item not found.');
    return this.guard(async () => {
      const hypothesis = (await this.ownedActive(userId, token))
        .find((value) => UNDERSTANDING_SURFACE_STATUSES.includes(value.status) && understandingItemRef(userId, value.id) === ref);
      if (!hypothesis) throw new NotFoundException('Understanding item not found.');
      // The version the reader saw: the current one, or — when their own disagreement already moved the item on
      // (a lost answer, a replay) — the one just before it. The database decides which of those is true.
      const seen = [hypothesis.version, hypothesis.version - 1]
        .find((version) => version >= 1 && understandingRevision(userId, hypothesis.id, version) === revision);
      if (seen === undefined) {
        if (await this.hasContestUnderReview(userId, token, hypothesis.id)) return this.underReview(userId, hypothesis.id, hypothesis.version);
        throw this.changed();
      }
      const rows = await this.repository.recordDisagreement(token, commandId, hypothesis.id, seen);
      const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : this.reject();
      switch (row.outcome) {
        case 'RECORDED': {
          if (!Number.isSafeInteger(row.reevaluated_version) || !isEvaluationId(row.confidence_evaluation_id)) this.reject();
          // W3-CORR-U: a replayed command answers its committed contest, which the reader may since have resolved. It
          // is then not under review: the reader is told the item changed and reads the current truth.
          if (!(await this.hasContestUnderReview(userId, token, hypothesis.id))) throw this.changed();
          await this.reevaluateConfidence(userId, token, hypothesis.id, row.reevaluated_version as number, row.confidence_evaluation_id);
          // The revision the client keeps is the CURRENT interpretation's: a replay may answer an older committed
          // truth while the item has since moved on.
          return this.underReview(userId, hypothesis.id, Math.max(hypothesis.version, row.reevaluated_version as number));
        }
        case 'ALREADY_UNDER_REVIEW':
          // A missed exact-version evaluation of the re-evaluated version is repaired here too, under the EXISTING
          // contest's one evaluation identity (R2) — never a fresh one.
          if (!isEvaluationId(row.confidence_evaluation_id)) this.reject();
          if (Number.isSafeInteger(row.reevaluated_version) && row.reevaluated_version === hypothesis.version) {
            await this.reevaluateConfidence(userId, token, hypothesis.id, hypothesis.version, row.confidence_evaluation_id);
          }
          return this.underReview(userId, hypothesis.id, hypothesis.version);
        case 'STALE':
          throw this.changed();
        case 'NOT_FOUND':
          throw new NotFoundException('Understanding item not found.');
        case 'COMMAND_CONFLICT':
          throw new ConflictException({ code: 'UNDERSTANDING_COMMAND_CONFLICT' });
        default:
          return this.reject();
      }
    });
  }

  /**
   * W3-CORR-U (U-2) — «أوافق عليه الآن» / "I agree with this now": the reader's EXPLICIT agreement with the interpretation
   * they are looking at, bound to that exact revision and to one command identity, resolves the item's contest under
   * review (migration 0134). It is not an undo: the disagreement stays durable history. Nothing about the item changes —
   * no status, version, statement, Evidence or Confidence — and no provider and no Confidence Runtime is called.
   *   200  { underReview: false, revision }  — resolved now, or the same command replayed;
   *   409  UNDERSTANDING_ITEM_CHANGED         — the item changed since the reader saw it; nothing was resolved;
   *   409  UNDERSTANDING_NOT_UNDER_REVIEW     — the item has no contest under review any more; the reader reads it again;
   *   409  UNDERSTANDING_COMMAND_CONFLICT     — this command identity was spent on another item or version;
   *   404                                     — not one of the caller's current items.
   */
  async resolveDisagreement(userId: string, token: string, ref: unknown, body: unknown): Promise<UnderstandingResolutionView> {
    const { commandId, revision } = this.validateDisagreementBody(body);
    if (!isUnderstandingToken(ref)) throw new NotFoundException('Understanding item not found.');
    return this.guard(async () => {
      const hypothesis = (await this.ownedActive(userId, token))
        .find((value) => UNDERSTANDING_SURFACE_STATUSES.includes(value.status) && understandingItemRef(userId, value.id) === ref);
      if (!hypothesis) throw new NotFoundException('Understanding item not found.');
      // The version the reader saw: usually the current one (a resolution never moves it). An older one is sent too, so
      // that the SAME command, whose answer was lost before the item moved on, is answered its committed truth; the
      // database resolves only at the exact current version and answers STALE for anything else.
      const seen = seenVersion(hypothesis.version, (version) => understandingRevision(userId, hypothesis.id, version) === revision);
      if (seen === undefined) throw this.changed();
      const rows = await this.repository.resolveDisagreement(token, commandId, hypothesis.id, seen);
      const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : this.reject();
      switch (row.outcome) {
        case 'RESOLVED':
          if (row.resolved_version !== seen) this.reject();
          return { underReview: false, revision: understandingRevision(userId, hypothesis.id, hypothesis.version) };
        case 'NOT_UNDER_REVIEW':
          throw new ConflictException({ code: 'UNDERSTANDING_NOT_UNDER_REVIEW' });
        case 'STALE':
          throw this.changed();
        case 'NOT_FOUND':
          throw new NotFoundException('Understanding item not found.');
        case 'COMMAND_CONFLICT':
          throw new ConflictException({ code: 'UNDERSTANDING_COMMAND_CONFLICT' });
        default:
          return this.reject();
      }
    });
  }

  /**
   * The re-evaluation's Confidence step: the Confidence Runtime's own exact-version evaluation of the re-evaluated
   * version, ENSURED under the contest's ONE durable evaluation identity (R2, migration 0127) — so a lost answer, a
   * replay, a repair and simultaneous requests converge on one Confidence row rather than each creating its own — and
   * never against a later version (the database refuses one that is no longer current). A failure leaves the committed contest untouched and
   * changes nothing the reader or the provider relies on: the item is already MIXED and under review (projection rule
   * 1), and an absent exact-version record is NOT_EVALUATED_FOR_CURRENT_VERSION, never an older one. A later disagreement
   * request on the item (a replay, or another command answering ALREADY_UNDER_REVIEW) repairs it.
   *
   * PROD-OPS-01: the outcome is visible as one content-free signal — success, or retry_pending with a bounded failure
   * class — and carries no user, item, hypothesis or evaluation identity and no error text. It changes nothing here.
   */
  private async reevaluateConfidence(userId: string, token: string, hypothesisId: string, version: number, evaluationId: string): Promise<void> {
    try {
      await this.confidenceRuntime.ensureHypothesisVersionEvaluation(userId, token, hypothesisId, version, evaluationId);
    } catch (error) {
      // PENDING_RETRY, exactly as the Hypothesis Update Loop degrades: nothing else is claimed.
      this.recordReevaluation('retry_pending', classifyOperationalFailure(error));
      return;
    }
    this.recordReevaluation('success');
  }

  /** Fail-soft: a telemetry failure can never change the reader's answer. */
  private recordReevaluation(outcome: 'success' | 'retry_pending', failureClass?: OperationalFailureClass): void {
    try {
      this.telemetry.recordOperationalOutcome('UNDERSTANDING_CONFIDENCE', 'confidence_reevaluate', outcome, failureClass);
    } catch {
      // Losing a signal is acceptable; changing the answer is not.
    }
  }

  private async hasContestUnderReview(userId: string, token: string, hypothesisId: string): Promise<boolean> {
    const rows = await this.repository.listContestsUnderReview(token, userId, [hypothesisId]);
    if (!Array.isArray(rows)) this.reject();
    return rows.some((row) => row?.hypothesis_id === hypothesisId);
  }

  private underReview(userId: string, hypothesisId: string, version: number): UnderstandingDisagreementView {
    return { underReview: true, revision: understandingRevision(userId, hypothesisId, version) };
  }

  private validateDisagreementBody(body: unknown): { commandId: string; revision: string } {
    const value = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
    if (value === null || Object.keys(value).length !== 2 || typeof value.commandId !== 'string' || !COMMAND_ID.test(value.commandId) ||
      !isUnderstandingToken(value.revision)) {
      throw new BadRequestException('Request must contain exactly one commandId and one revision.');
    }
    return { commandId: value.commandId.toLowerCase(), revision: value.revision };
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
    if (surfaced.length === 0) return { surfaced, eligibleEvidence: new Map(), exactVersion: new Map(), contests: new Map() };
    const [eligible, evaluations, contestRows] = await Promise.all([
      this.evidence.listEligibleForUser(userId, token),
      this.confidence.listExactVersionsForTargets(token, userId, surfaced.map(({ id, version }) => ({ id, version }))),
      this.repository.listContestsUnderReview(token, userId, surfaced.map(({ id }) => id)),
    ]);
    if (!Array.isArray(eligible) || !Array.isArray(evaluations) || !Array.isArray(contestRows)) this.reject();
    const contests = new Map<string, UnderstandingContestRow>();
    for (const row of contestRows) {
      if (!row || typeof row.hypothesis_id !== 'string' || !Number.isSafeInteger(row.reevaluation_after_version) ||
        typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at)) || contests.has(row.hypothesis_id)) this.reject();
      contests.set(row.hypothesis_id, row);
    }
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
      contests,
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
        contested: context.contests.has(hypothesis.id),
      }),
      underReview: context.contests.has(hypothesis.id),
    };
  }

  private evolution(
    hypothesis: HypothesisRecord, updates: UnderstandingEvolutionEntry[], transitions: readonly UnderstandingLifecycleTransitionRow[],
    contests: readonly UnderstandingContestHistoryRow[],
  ): UnderstandingEvolutionEntry[] {
    // The MIXED steps a disagreement's own re-evaluation made. One made on an item already MIXED made no step, so the
    // earlier, independent MIXED step is still told.
    const reevaluationSteps = new Set(contests.filter((row) => row.reevaluation_before_status !== 'MIXED').map((row) => row.reevaluation_after_version));
    const lifecycle = transitions.flatMap((row): UnderstandingEvolutionEntry[] => {
      // The re-evaluation's own MIXED step is told as the reader's disagreement, once, not as a second event.
      if (row.after_status === 'MIXED' && reevaluationSteps.has(row.after_version)) return [];
      const kind = lifecycleKind(row);
      return kind === null ? [] : [{ kind, at: row.created_at }];
    });
    const first: UnderstandingEvolutionEntry = { kind: 'FIRST_SEEN', at: hypothesis.created_at };
    // W3-CORR-U: every disagreement stays history, resolved or not. Only the reader's OWN confirmation is told as their
    // agreement; a withdrawal is already told as WITHDRAWN and is never attributed to the reader.
    const contested = contests.flatMap((row): UnderstandingEvolutionEntry[] => [
      { kind: 'YOU_DISAGREED', at: row.created_at },
      ...(row.lifecycle === 'RESOLVED' && row.resolution_reason === 'USER_CONFIRMED_CURRENT_INTERPRETATION' && row.resolved_at !== null
        ? [{ kind: 'YOU_RESOLVED_DISAGREEMENT' as const, at: row.resolved_at }] : []),
    ]);
    return [...updates, ...lifecycle, ...contested, first]
      .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
      .slice(0, MAX_DETAIL_EVOLUTION);
  }

  private validateContestHistory(row: UnderstandingContestHistoryRow): void {
    const instant = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
    if (!row || !Number.isSafeInteger(row.reevaluation_after_version) || !instant(row.created_at) ||
      !UNDERSTANDING_SURFACE_STATUSES.includes(row.reevaluation_before_status)) this.reject();
    if (row.lifecycle === 'UNDER_REVIEW') {
      if (row.resolved_at !== null || row.resolution_reason !== null) this.reject();
    } else if (row.lifecycle === 'RESOLVED') {
      if (!instant(row.resolved_at) ||
        (row.resolution_reason !== 'USER_CONFIRMED_CURRENT_INTERPRETATION' && row.resolution_reason !== 'INTERPRETATION_WITHDRAWN')) this.reject();
    } else {
      this.reject();
    }
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

/** How far back a revision may be matched to the version it names: bounded, so a forged token costs bounded hashing. */
const MAX_SEEN_VERSION_LOOKBACK = 64;

function seenVersion(current: number, matches: (version: number) => boolean): number | undefined {
  for (let version = current; version >= Math.max(1, current - MAX_SEEN_VERSION_LOOKBACK + 1); version -= 1) {
    if (matches(version)) return version;
  }
  return undefined;
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
