import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { HistoricalSemanticDepth } from '@qandeel/runtime';
import { DataApiError, readDataApiUpstreamIdentity } from '../conversation/supabase-data-api.service';
import { discloseAnalyticalRungs, isHistoricalSemanticDepth } from '../historical-projection/historical-disclosure';
import { mapHistoricalAnalyticalFamilies } from '../historical-projection/historical-projection-mapper';
import { ReplayRepository, type ReplayRow } from './replay.repository';
import type {
  ReplayCapabilityView, ReplayCoverageClass, ReplayDraftCommandView, ReplayFinalizeView, ReplayLifecycle, ReplayMoment,
  ReplayMomentAnalysisView, ReplayMomentsView, ReplayNotViewableClass, ReplayPreviewView, ReplayRefusal, ReplayReopenView,
  ReplaySummary, ReplayVersionView, ReplayView,
} from './replay.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** An instant exactly as the database returns it (ISO 8601 with an offset), never a free-form date. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u;
/** The largest Session Position / ordinal / revision the database's integer columns can hold. */
const INT4_MAX = 2147483647;
/** The bound migration 0169 applies to one conversation's Replays. */
export const REPLAY_CONVERSATION_LIST_LIMIT = 100;

const LIFECYCLES: readonly ReplayLifecycle[] = ['DRAFT', 'PREVIEW_READY', 'FINALIZED'];
const COVERAGE: readonly ReplayCoverageClass[] = ['FULL_SOURCE', 'SELECTED_EXCERPT', 'HIGHLIGHT_SELECTION'];
const NOT_VIEWABLE: readonly ReplayNotViewableClass[] = ['VERSION_SUPERSEDED', 'SOURCE_STATE_CONTRADICTORY', 'SOURCE_NOT_CURRENTLY_AVAILABLE', 'ANALYTICAL_EVIDENCE_INCOMPLETE'];
/** The refusal words each command can answer (migration 0169 section 3); any other word fails closed. */
const DRAFT_REFUSALS: readonly ReplayRefusal[] = ['NOT_AVAILABLE_NOW', 'UNAVAILABLE', 'NOT_WHOLE_MESSAGES', 'CHANGED', 'SOURCE_CHANGED',
  'SELECTION_NOT_SUPPORTED', 'LIFECYCLE_NOT_ELIGIBLE', 'COMMAND_CONFLICT'];
const PREVIEW_REFUSALS: readonly ReplayRefusal[] = ['NOT_AVAILABLE_NOW', 'UNAVAILABLE', 'CHANGED', 'SOURCE_CHANGED', 'MOMENT_NOT_SEALED',
  'ANALYSIS_UNAVAILABLE', 'SELECTION_NOT_SUPPORTED', 'LIFECYCLE_NOT_ELIGIBLE', 'COMMAND_CONFLICT'];
const FINALIZE_REFUSALS: readonly ReplayRefusal[] = ['NOT_AVAILABLE_NOW', 'UNAVAILABLE', 'CHANGED', 'SOURCE_CHANGED', 'ANALYSIS_CHANGED',
  'SELECTION_NOT_SUPPORTED', 'LIFECYCLE_NOT_ELIGIBLE', 'COMMAND_CONFLICT'];
const REOPEN_REFUSALS: readonly ReplayRefusal[] = ['NOT_AVAILABLE_NOW', 'UNAVAILABLE', 'CHANGED', 'LIFECYCLE_NOT_ELIGIBLE', 'COMMAND_CONFLICT'];

const DRAFT_COMMAND_KEYS = ['outcome', 'replay_id', 'replay_lifecycle', 'draft_revision', 'coverage_class', 'selected_item_count'];
const PREVIEW_KEYS = ['outcome', 'replay_id', 'replay_version_id', 'replay_version_revision', 'moment_count', 'temporal_discontinuity_count'];
const FINALIZE_KEYS = ['outcome', 'replay_id', 'replay_version_id', 'replay_version_revision'];
const REOPEN_KEYS = ['outcome', 'replay_id', 'replay_lifecycle', 'reopened_from_replay_version_id'];
const SUMMARY_KEYS = ['replay_id', 'replay_lifecycle', 'created_at', 'current_replay_version_id', 'current_version_finalized'];
const REPLAY_KEYS = ['replay_id', 'replay_lifecycle', 'created_at', 'draft_revision', 'draft_coverage_class', 'draft_selected_item_count',
  'draft_first_tc', 'draft_last_tc', 'draft_source_state', 'draft_updated_at', 'current_replay_version_id', 'current_replay_version_revision',
  'current_version_finalized'];
const POLICY_COLUMNS = {
  originalMedium: 'original_medium_policy', sourceText: 'source_text_policy', semanticCut: 'semantic_cut_policy',
  temporalDiscontinuity: 'temporal_discontinuity_policy', timingIntegrity: 'timing_integrity_policy',
  analyticalProjection: 'analytical_projection_policy', cameraEmphasis: 'camera_emphasis_policy', motion: 'motion_policy',
  captionProvenance: 'caption_provenance_policy', accessibilityParity: 'accessibility_parity_policy',
  reducedMotionParity: 'reduced_motion_parity_policy', editorialAnnotation: 'editorial_annotation_policy',
} as const;
const VERSION_KEYS = ['replay_id', 'replay_version_id', 'replay_version_revision', 'version_created_at', 'is_current', 'finalized', 'coverage_class',
  'moment_count', 'temporal_discontinuity_count', 'first_tc', 'last_tc', 'render_contract_revision', 'render_contract_schema', 'source_medium_class',
  ...Object.values(POLICY_COLUMNS), 'source_layer', 'analytical_layer', 'viewing_state', 'not_viewable_class'];
const MOMENT_KEYS = ['selected_ordinal', 'tc', 'source_role', 'original_medium', 'omitted_before', 'source_text'];
const ANALYSIS_KEYS = ['outcome', 'selected_ordinal', 'tc', 'analysis'];

const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' }); };
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isInstant = (value: unknown): value is string => typeof value === 'string' && INSTANT.test(value) && Number.isFinite(Date.parse(value));
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isPosition = (value: unknown): value is number => isCount(value) && value >= 1 && value <= INT4_MAX;
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isOneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T => typeof value === 'string' && (allowed as readonly string[]).includes(value);
const isRow = (row: unknown, keys: readonly string[]): row is ReplayRow => {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  const actual = Object.keys(row);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
};
/** Every column but `outcome` is null: the shape of a bounded refusal. */
const isRefusalRow = (row: ReplayRow): boolean => Object.entries(row).every(([key, value]) => key === 'outcome' || value === null);
const lower = (value: string): string => value.toLowerCase();

/** The request body as an object of exactly these keys; anything else is the client's own error. */
function bodyOf(body: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid();
  const value = body as Record<string, unknown>;
  const actual = Object.keys(value);
  if (actual.length !== keys.length || !keys.every((key) => actual.includes(key))) return invalid();
  if (!isUuid(value.commandId)) return invalid();
  return value;
}
function rangeOf(value: Record<string, unknown>): { readonly firstTc: number; readonly lastTc: number } {
  if (!isPosition(value.firstTc) || !isPosition(value.lastTc) || value.lastTc < value.firstTc) return invalid();
  return { firstTc: value.firstTc, lastTc: value.lastTc };
}
function revisionOf(value: unknown): number {
  return isCount(value) && value >= 1 ? value : invalid();
}
function ordinalOf(raw: string): number | null {
  if (!/^[0-9]{1,10}$/u.test(raw)) return null;
  const value = Number(raw);
  return isPosition(value) ? value : null;
}
function depthOf(raw: string | undefined): HistoricalSemanticDepth {
  if (raw === undefined) return 'WORLD';
  return isHistoricalSemanticDepth(raw) ? raw : invalid();
}
/** Exactly one row of exactly these columns, or nothing at all. */
function oneRow(rows: unknown, keys: readonly string[]): ReplayRow {
  const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : undefined;
  return isRow(row, keys) ? row : unavailable();
}
/** A command answer: the success shape, or exactly one of the command's refusal words with every other column null. */
function commandOf<V>(row: ReplayRow, success: string, refusals: readonly ReplayRefusal[], decode: () => V | null): V | { readonly outcome: ReplayRefusal } {
  if (row.outcome === success) return decode() ?? unavailable();
  if (isOneOf(row.outcome, refusals) && isRefusalRow(row)) return { outcome: row.outcome };
  return unavailable();
}

/**
 * S7-04 (G-1): 0169's list wrapper answers `current_version_finalized` with an EXISTS over the current version's
 * finalization, which is never null: a Replay with no version yet (a fresh draft) reads exactly `false` there. That one
 * answer is decoded as "no version" and leaves as null, the wire's shape since S7-01; a finalized nothing (`true`) or
 * anything else beside a null version is a contradiction, refused as before.
 */
function summaryOf(row: unknown): ReplaySummary {
  if (!isRow(row, SUMMARY_KEYS) || !isUuid(row.replay_id) || !isOneOf(row.replay_lifecycle, LIFECYCLES) || !isInstant(row.created_at)) return unavailable();
  const versionId = row.current_replay_version_id;
  const finalized = versionId === null && row.current_version_finalized === false ? null : row.current_version_finalized;
  if (versionId === null ? row.current_version_finalized !== false : !isUuid(versionId) || typeof finalized !== 'boolean') return unavailable();
  return { replayId: lower(row.replay_id), lifecycle: row.replay_lifecycle, createdAt: row.created_at,
    currentVersionId: versionId === null ? null : lower(versionId as string), currentVersionFinalized: finalized as boolean | null };
}

function momentOf(row: unknown, index: number): ReplayMoment {
  if (!isRow(row, MOMENT_KEYS) || row.selected_ordinal !== index + 1 || !isPosition(row.tc) || !isOneOf(row.source_role, ['USER', 'ASSISTANT'] as const)
      || !isOneOf(row.original_medium, ['ORIGINAL_TEXT', 'ORIGINAL_AUDIO', 'MIXED'] as const) || !isCount(row.omitted_before)
      || (index === 0 && row.omitted_before !== 0) || (row.source_text !== null && typeof row.source_text !== 'string')) return unavailable();
  return { ordinal: row.selected_ordinal as number, tc: row.tc, sourceRole: row.source_role, originalMedium: row.original_medium,
    omittedBefore: row.omitted_before, text: row.source_text as string | null };
}

/**
 * S7-01 - the Personal Replay boundary (migration 0169): the caller's own Replay of one of their own text conversations -
 * a draft over one contiguous range of whole messages, a real preview, a private final version, reopening - and the
 * graphics-independent reads a player needs. Identity is the verified token only. Every row is decoded exactly; anything
 * else fails closed with nothing of the database's answer passed on. The analysis of a moment is the canonical K(TC),
 * mapped and disclosed by the ONE T-03C mapper and depth law. No retry here: a repeated command is the same command,
 * answered from its committed history. Nothing is logged. No export, publication or distribution is reachable.
 */
@Injectable()
export class ReplayService {
  constructor(private readonly repository: ReplayRepository) {}

  async capability(token: string): Promise<ReplayCapabilityView> {
    const row = oneRow(await this.guard(() => this.repository.capability(token)), ['creation_available']);
    return typeof row.creation_available === 'boolean' ? { creationAvailable: row.creation_available } : unavailable();
  }

  async conversationReplays(token: string, sessionId: string): Promise<{ readonly replays: readonly ReplaySummary[] }> {
    if (!isUuid(sessionId)) return { replays: [] };
    const rows = await this.guard(() => this.repository.conversationReplays(token, lower(sessionId)));
    if (!Array.isArray(rows) || rows.length > REPLAY_CONVERSATION_LIST_LIMIT) return unavailable();
    return { replays: rows.map(summaryOf) };
  }

  async createDraft(token: string, body: unknown): Promise<ReplayDraftCommandView> {
    const value = bodyOf(body, ['commandId', 'sessionId', 'firstTc', 'lastTc']);
    if (!isUuid(value.sessionId)) return invalid();
    const { firstTc, lastTc } = rangeOf(value);
    const row = oneRow(await this.guard(() => this.repository.createDraft(token, lower(value.commandId as string), lower(value.sessionId as string), firstTc, lastTc)), DRAFT_COMMAND_KEYS);
    return commandOf(row, 'CREATED', DRAFT_REFUSALS, () => this.draftCommandOf(row, 'CREATED'));
  }

  async reviseDraft(token: string, replayId: string, body: unknown): Promise<ReplayDraftCommandView> {
    const value = bodyOf(body, ['commandId', 'expectedDraftRevision', 'firstTc', 'lastTc']);
    const expected = revisionOf(value.expectedDraftRevision);
    const { firstTc, lastTc } = rangeOf(value);
    if (!isUuid(replayId)) return { outcome: 'UNAVAILABLE' };
    const row = oneRow(await this.guard(() => this.repository.reviseDraft(token, lower(value.commandId as string), lower(replayId), expected, firstTc, lastTc)), DRAFT_COMMAND_KEYS);
    return commandOf(row, 'REVISED', DRAFT_REFUSALS, () => this.draftCommandOf(row, 'REVISED'));
  }

  async preparePreview(token: string, replayId: string, body: unknown): Promise<ReplayPreviewView> {
    const value = bodyOf(body, ['commandId', 'expectedDraftRevision']);
    const expected = revisionOf(value.expectedDraftRevision);
    if (!isUuid(replayId)) return { outcome: 'UNAVAILABLE' };
    const row = oneRow(await this.guard(() => this.repository.preparePreview(token, lower(value.commandId as string), lower(replayId), expected)), PREVIEW_KEYS);
    return commandOf(row, 'PREVIEW_READY', PREVIEW_REFUSALS, () => (isUuid(row.replay_id) && isUuid(row.replay_version_id) && isPosition(row.replay_version_revision)
      && isPosition(row.moment_count) && isCount(row.temporal_discontinuity_count)
      ? { outcome: 'PREVIEW_READY' as const, replayId: lower(row.replay_id), versionId: lower(row.replay_version_id), versionRevision: row.replay_version_revision,
        momentCount: row.moment_count, temporalDiscontinuityCount: row.temporal_discontinuity_count }
      : null));
  }

  async finalize(token: string, replayId: string, body: unknown): Promise<ReplayFinalizeView> {
    const value = bodyOf(body, ['commandId', 'expectedVersionId']);
    if (!isUuid(value.expectedVersionId)) return invalid();
    if (!isUuid(replayId)) return { outcome: 'UNAVAILABLE' };
    const row = oneRow(await this.guard(() => this.repository.finalize(token, lower(value.commandId as string), lower(replayId), lower(value.expectedVersionId as string))), FINALIZE_KEYS);
    return commandOf(row, 'FINALIZED', FINALIZE_REFUSALS, () => (isUuid(row.replay_id) && isUuid(row.replay_version_id) && isPosition(row.replay_version_revision)
      ? { outcome: 'FINALIZED' as const, replayId: lower(row.replay_id), versionId: lower(row.replay_version_id), versionRevision: row.replay_version_revision }
      : null));
  }

  async reopen(token: string, replayId: string, body: unknown): Promise<ReplayReopenView> {
    const value = bodyOf(body, ['commandId', 'expectedVersionId']);
    if (!isUuid(value.expectedVersionId)) return invalid();
    if (!isUuid(replayId)) return { outcome: 'UNAVAILABLE' };
    const row = oneRow(await this.guard(() => this.repository.reopen(token, lower(value.commandId as string), lower(replayId), lower(value.expectedVersionId as string))), REOPEN_KEYS);
    return commandOf(row, 'REOPENED', REOPEN_REFUSALS, () => (isUuid(row.replay_id) && isOneOf(row.replay_lifecycle, LIFECYCLES) && isUuid(row.reopened_from_replay_version_id)
      ? { outcome: 'REOPENED' as const, replayId: lower(row.replay_id), lifecycle: row.replay_lifecycle, reopenedFromVersionId: lower(row.reopened_from_replay_version_id) }
      : null));
  }

  async replay(token: string, replayId: string): Promise<ReplayView> {
    if (!isUuid(replayId)) return { outcome: 'UNAVAILABLE' };
    const rows = await this.guard(() => this.repository.replay(token, lower(replayId)));
    if (Array.isArray(rows) && rows.length === 0) return { outcome: 'UNAVAILABLE' };
    const row = oneRow(rows, REPLAY_KEYS);
    if (!isUuid(row.replay_id) || lower(row.replay_id) !== lower(replayId) || !isOneOf(row.replay_lifecycle, LIFECYCLES) || !isInstant(row.created_at)
        || !isPosition(row.draft_revision) || !isOneOf(row.draft_coverage_class, COVERAGE) || !isPosition(row.draft_selected_item_count)
        || !isPosition(row.draft_first_tc) || !isPosition(row.draft_last_tc) || row.draft_last_tc < row.draft_first_tc
        || !isOneOf(row.draft_source_state, ['CURRENT', 'STALE'] as const) || !isInstant(row.draft_updated_at)) return unavailable();
    const versionId = row.current_replay_version_id;
    let currentVersion: { readonly versionId: string; readonly revision: number; readonly finalized: boolean } | null = null;
    if (versionId === null) {
      if (row.current_replay_version_revision !== null || row.current_version_finalized !== null) return unavailable();
    } else {
      if (!isUuid(versionId) || !isPosition(row.current_replay_version_revision) || typeof row.current_version_finalized !== 'boolean') return unavailable();
      currentVersion = { versionId: lower(versionId), revision: row.current_replay_version_revision, finalized: row.current_version_finalized };
    }
    return {
      outcome: 'FOUND', replayId: lower(row.replay_id), lifecycle: row.replay_lifecycle, createdAt: row.created_at,
      draft: { revision: row.draft_revision, coverageClass: row.draft_coverage_class, selectedMomentCount: row.draft_selected_item_count,
        firstTc: row.draft_first_tc, lastTc: row.draft_last_tc, sourceState: row.draft_source_state, updatedAt: row.draft_updated_at },
      currentVersion,
    };
  }

  async version(token: string, replayId: string, versionId: string): Promise<ReplayVersionView> {
    if (!isUuid(replayId) || !isUuid(versionId)) return { outcome: 'UNAVAILABLE' };
    const rows = await this.guard(() => this.repository.version(token, lower(replayId), lower(versionId)));
    if (Array.isArray(rows) && rows.length === 0) return { outcome: 'UNAVAILABLE' };
    const row = oneRow(rows, VERSION_KEYS);
    const viewable = row.viewing_state === 'VIEWABLE';
    if (!isUuid(row.replay_id) || lower(row.replay_id) !== lower(replayId) || !isUuid(row.replay_version_id) || lower(row.replay_version_id) !== lower(versionId)
        || !isPosition(row.replay_version_revision) || !isInstant(row.version_created_at) || typeof row.is_current !== 'boolean' || typeof row.finalized !== 'boolean'
        || !isOneOf(row.coverage_class, COVERAGE) || !isPosition(row.moment_count) || !isCount(row.temporal_discontinuity_count)
        || !isPosition(row.first_tc) || !isPosition(row.last_tc) || row.last_tc < row.first_tc
        || !isPosition(row.render_contract_revision) || !isText(row.render_contract_schema) || !isText(row.source_medium_class)
        || Object.values(POLICY_COLUMNS).some((column) => !isText(row[column]))
        || !isOneOf(row.source_layer, ['DEREFERENCEABLE', 'NOT_DEREFERENCEABLE'] as const)
        || !isOneOf(row.analytical_layer, ['SEALED_HISTORICAL_EVIDENCE', 'SEALED_EVIDENCE_INCOMPLETE'] as const)
        || !isOneOf(row.viewing_state, ['VIEWABLE', 'NOT_VIEWABLE'] as const)
        || (viewable ? row.not_viewable_class !== null : !isOneOf(row.not_viewable_class, NOT_VIEWABLE))) return unavailable();
    const policies = Object.fromEntries(Object.entries(POLICY_COLUMNS).map(([key, column]) => [key, row[column] as string])) as ReplayVersionRenderPolicies;
    return {
      outcome: 'FOUND', replayId: lower(row.replay_id), versionId: lower(row.replay_version_id), revision: row.replay_version_revision,
      createdAt: row.version_created_at, isCurrent: row.is_current, finalized: row.finalized, coverageClass: row.coverage_class,
      momentCount: row.moment_count, temporalDiscontinuityCount: row.temporal_discontinuity_count, firstTc: row.first_tc, lastTc: row.last_tc,
      renderContract: { revision: row.render_contract_revision, schema: row.render_contract_schema, sourceMediumClass: row.source_medium_class, policies },
      viewing: { state: row.viewing_state, notViewableClass: (row.not_viewable_class as ReplayNotViewableClass | null), sourceLayer: row.source_layer,
        analyticalLayer: row.analytical_layer },
    };
  }

  async moments(token: string, replayId: string, versionId: string): Promise<ReplayMomentsView> {
    if (!isUuid(replayId) || !isUuid(versionId)) return { outcome: 'UNAVAILABLE' };
    const rows = await this.guard(() => this.repository.moments(token, lower(replayId), lower(versionId)));
    if (!Array.isArray(rows)) return unavailable();
    if (rows.length === 0) return { outcome: 'UNAVAILABLE' };
    const moments = rows.map(momentOf);
    // Canonical chronology, and one viewing answer for the whole version: the text of every moment, or of none.
    if (moments.some((moment, index) => index > 0 && moment.tc <= moments[index - 1].tc)) return unavailable();
    if (new Set(moments.map((moment) => moment.text === null)).size !== 1) return unavailable();
    return { outcome: 'FOUND', moments };
  }

  async momentAnalysis(token: string, replayId: string, versionId: string, rawOrdinal: string, rawDepth: string | undefined): Promise<ReplayMomentAnalysisView> {
    const depth = depthOf(rawDepth);
    const ordinal = ordinalOf(rawOrdinal);
    if (!isUuid(replayId) || !isUuid(versionId) || ordinal === null) return { outcome: 'UNAVAILABLE' };
    const rows = await this.guard(() => this.repository.momentAnalysis(token, lower(replayId), lower(versionId), ordinal));
    if (Array.isArray(rows) && rows.length === 0) return { outcome: 'UNAVAILABLE' };
    const row = oneRow(rows, ANALYSIS_KEYS);
    if (row.selected_ordinal !== ordinal || !isPosition(row.tc)) return unavailable();
    const tc = row.tc;
    if (row.outcome === 'NOT_VIEWABLE' || row.outcome === 'ANALYSIS_NOT_CURRENTLY_AVAILABLE') {
      return row.analysis === null ? { outcome: row.outcome, ordinal, tc } : unavailable();
    }
    if (row.outcome !== 'AVAILABLE') return unavailable();
    let rungs;
    try {
      rungs = discloseAnalyticalRungs(mapHistoricalAnalyticalFamilies(row.analysis, tc), depth);
    } catch {
      // A malformed or incoherent analysis is transport corruption, never an empty understanding.
      return unavailable();
    }
    // No Turn crosses: a Question's appearance is its binding, its Gap epoch, its Reading version and its Session Position.
    const session: ReplayMomentAnalysisSession = rungs.sessionAnalytics.status === 'DISCLOSED'
      ? { status: 'DISCLOSED', value: { emergingFocuses: rungs.sessionAnalytics.value.emergingFocuses,
        questionAppearances: rungs.sessionAnalytics.value.questionAppearances.map(({ sourceTurnId: _source, assistantTurnId: _assistant, ...appearance }) => appearance) } }
      : { status: 'DEPTH_WITHHELD' };
    return { outcome: 'AVAILABLE', ordinal, tc, depth, world: rungs.world, thread: rungs.thread, session,
      analyticalObject: rungs.analyticalObject, sourceProvenance: rungs.sourceProvenance };
  }

  private draftCommandOf(row: ReplayRow, outcome: 'CREATED' | 'REVISED'): ReplayDraftCommandView | null {
    return isUuid(row.replay_id) && isOneOf(row.replay_lifecycle, LIFECYCLES) && isPosition(row.draft_revision) && isOneOf(row.coverage_class, COVERAGE)
      && isPosition(row.selected_item_count)
      ? { outcome, replayId: lower(row.replay_id), lifecycle: row.replay_lifecycle, draftRevision: row.draft_revision, coverageClass: row.coverage_class,
        selectedMomentCount: row.selected_item_count }
      : null;
  }

  private async guard<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      // Only a request the database refuses as malformed (22023) is the client's own contradiction. Every other refusal
      // is unavailable, with nothing of the database's answer passed on.
      if (error instanceof DataApiError && error.status === 400 && readDataApiUpstreamIdentity(error).databaseCode === '22023') return invalid();
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      return unavailable();
    }
  }
}

type ReplayMomentAnalysisSession = Extract<ReplayMomentAnalysisView, { outcome: 'AVAILABLE' }>['session'];
type ReplayVersionRenderPolicies = Extract<ReplayVersionView, { outcome: 'FOUND' }>['renderContract']['policies'];
