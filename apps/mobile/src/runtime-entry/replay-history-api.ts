/**
 * S7-03 — the read-only client for one Personal Replay version's historical truth (the S7-01 boundary, migration 0169):
 *
 *   GET /replay/:replayId/versions/:versionId                                   — FOUND | UNAVAILABLE
 *   GET /replay/:replayId/versions/:versionId/moments                           — FOUND | UNAVAILABLE
 *   GET /replay/:replayId/versions/:versionId/moments/:ordinal/analysis?depth=  — AVAILABLE | NOT_VIEWABLE
 *                                                                                 | ANALYSIS_NOT_CURRENTLY_AVAILABLE | UNAVAILABLE
 *
 * Three reads and nothing else: no command (no draft, preview, finalize or reopen — S7-04 owns those), no user id, no
 * owner, no Session, no Conversation Unit, no state, no retry, no cache and no persistence. The identity is the verified
 * token on the server, decided at each request by the AC-01 seam its caller hands it.
 *
 * It decodes STRICTLY, exactly as the T-03C client decodes `V` (`projection/historical-projection-wire.ts`): exact keys at
 * every level, closed vocabularies, safe-integer Session Positions, every Session Position inside a moment's analysis at
 * or before that moment's own `tc` (an answer that knows something later is not history and is refused whole), and the
 * frozen depth law — every rung at or below the requested depth DISCLOSED, every rung above it DEPTH_WITHHELD. An extra
 * field, a missing one or an unknown word makes the answer unusable; nothing is repaired or defaulted.
 *
 * The Replay wire is narrower than `V`, and this client keeps it narrower: the Session rung carries no Moments (the
 * version's own source layer is the moments read), a Question appearance names no Turn, a Material carries no wall-clock
 * lifetime (hindsight at TC), and no K(TC) header (Session, Live Head, revision) exists to decode.
 *
 * S7-05 (F-2): nor does a Reading name a Session. Its scope arrives as its class alone, `CONVERSATION_SESSION`, and is
 * decoded as exactly that word: it is not the Reading's historical scope, nothing here reads it as one, and an answer whose
 * scope names a Session (or anything else) is refused whole.
 */
import type {
  DisclosedAnalyticalObjectRung,
  DisclosedEmergingFocus,
  DisclosedMaterial,
  DisclosedQuestionAppearance,
  DisclosedSourceProvenanceRung,
  DisclosedThreadRung,
  DisclosedWorldRung,
  HistoricalRung,
  HistoricalSemanticDepth,
  LiveFocusWireValue,
} from '@qandeel/runtime';

import type { RuntimeHttpFetch } from './conversation/conversation-session-api';

export interface ReplayHistoryApiConfig {
  /** Origin plus any base path, without a trailing slash. */
  readonly baseUrl: string;
  /** Always the AC-01 authorized seam in production: the bearer is decided at each request. */
  readonly fetch: RuntimeHttpFetch;
}

export type ReplayHistoryCoverage = 'FULL_SOURCE' | 'SELECTED_EXCERPT' | 'HIGHLIGHT_SELECTION';
export type ReplayNotViewableClass = 'VERSION_SUPERSEDED' | 'SOURCE_STATE_CONTRADICTORY' | 'SOURCE_NOT_CURRENTLY_AVAILABLE' | 'ANALYTICAL_EVIDENCE_INCOMPLETE';
export type ReplayOriginalMedium = 'ORIGINAL_TEXT' | 'ORIGINAL_AUDIO' | 'MIXED';

/** The version's own render truth contract (I-06B): each policy an exact versioned word, never a client choice. */
export interface ReplayRenderContractView {
  readonly revision: number;
  readonly schema: string;
  readonly sourceMediumClass: string;
  readonly policies: {
    readonly originalMedium: string;
    readonly sourceText: string;
    readonly semanticCut: string;
    readonly temporalDiscontinuity: string;
    readonly timingIntegrity: string;
    readonly analyticalProjection: string;
    readonly cameraEmphasis: string;
    readonly motion: string;
    readonly captionProvenance: string;
    readonly accessibilityParity: string;
    readonly reducedMotionParity: string;
    readonly editorialAnnotation: string;
  };
}

/** Both layers are always reported: the analysis never stands in for a missing source. */
export interface ReplayViewingView {
  readonly state: 'VIEWABLE' | 'NOT_VIEWABLE';
  readonly notViewableClass: ReplayNotViewableClass | null;
  readonly sourceLayer: 'DEREFERENCEABLE' | 'NOT_DEREFERENCEABLE';
  readonly analyticalLayer: 'SEALED_HISTORICAL_EVIDENCE' | 'SEALED_EVIDENCE_INCOMPLETE';
}

export interface ReplayHistoryVersion {
  readonly replayId: string;
  readonly versionId: string;
  readonly revision: number;
  readonly isCurrent: boolean;
  readonly finalized: boolean;
  readonly coverage: ReplayHistoryCoverage;
  readonly momentCount: number;
  readonly temporalDiscontinuityCount: number;
  readonly firstTc: number;
  readonly lastTc: number;
  readonly renderContract: ReplayRenderContractView;
  readonly viewing: ReplayViewingView;
}

export interface ReplayHistoryMoment {
  /** 1 .. momentCount, in canonical chronology. */
  readonly ordinal: number;
  /** The Session Position the moment represents: the TC of its historical analysis. */
  readonly tc: number;
  readonly sourceRole: 'USER' | 'ASSISTANT';
  readonly originalMedium: ReplayOriginalMedium;
  /** Source messages omitted immediately before this moment: absence named, nothing omitted shown. */
  readonly omittedBefore: number;
  /** The exact committed text while the version is viewable; null otherwise. */
  readonly text: string | null;
}

/** A Question appearance at TC without the Turns it was asked in. */
export type ReplayQuestionAppearanceView = Omit<DisclosedQuestionAppearance, 'sourceTurnId' | 'assistantTurnId'>;
/** The SESSION rung of a Replay moment's analysis; its Moments are the version's own source layer, read apart. */
export interface ReplaySessionAnalyticsView {
  readonly emergingFocuses: readonly DisclosedEmergingFocus[];
  readonly questionAppearances: readonly ReplayQuestionAppearanceView[];
}
/** A Material at TC, without its wall-clock lifetime (the wire carries none: hindsight at TC). */
export type ReplayMaterialAtTcView = Pick<DisclosedMaterial, 'id' | 'type' | 'content' | 'source' | 'confidence' | 'importance' | 'version'
  | 'supersedesMaterialId' | 'supersededByMaterialId' | 'statusAtTc'>;
export type ReplayAnalyticalObjectView = Omit<DisclosedAnalyticalObjectRung, 'materials'> & { readonly materials: readonly ReplayMaterialAtTcView[] };

export type ReplayMomentAnalysis =
  | {
    readonly outcome: 'AVAILABLE';
    readonly ordinal: number;
    readonly tc: number;
    readonly depth: HistoricalSemanticDepth;
    readonly world: DisclosedWorldRung;
    readonly thread: HistoricalRung<DisclosedThreadRung>;
    readonly session: HistoricalRung<ReplaySessionAnalyticsView>;
    readonly analyticalObject: HistoricalRung<ReplayAnalyticalObjectView>;
    readonly sourceProvenance: HistoricalRung<DisclosedSourceProvenanceRung>;
  }
  | { readonly outcome: 'NOT_VIEWABLE'; readonly ordinal: number; readonly tc: number }
  | { readonly outcome: 'ANALYSIS_NOT_CURRENTLY_AVAILABLE'; readonly ordinal: number; readonly tc: number };

/** NOT_FOUND: not the caller's, or no such Replay or version — one answer. UNAVAILABLE: nothing usable arrived. */
export type ReplayVersionResult = { readonly kind: 'FOUND'; readonly version: ReplayHistoryVersion } | { readonly kind: 'NOT_FOUND' } | { readonly kind: 'UNAVAILABLE' };
export type ReplayMomentsResult = { readonly kind: 'FOUND'; readonly moments: readonly ReplayHistoryMoment[] } | { readonly kind: 'NOT_FOUND' } | { readonly kind: 'UNAVAILABLE' };
export type ReplayAnalysisResult = { readonly kind: 'ANSWERED'; readonly analysis: ReplayMomentAnalysis } | { readonly kind: 'NOT_FOUND' } | { readonly kind: 'UNAVAILABLE' };

export const REPLAY_HISTORY_DEPTHS: readonly HistoricalSemanticDepth[] = Object.freeze(['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE']);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u;
const INT4_MAX = 2147483647;
const COVERAGE: readonly ReplayHistoryCoverage[] = ['FULL_SOURCE', 'SELECTED_EXCERPT', 'HIGHLIGHT_SELECTION'];
const NOT_VIEWABLE: readonly ReplayNotViewableClass[] = ['VERSION_SUPERSEDED', 'SOURCE_STATE_CONTRADICTORY', 'SOURCE_NOT_CURRENTLY_AVAILABLE', 'ANALYTICAL_EVIDENCE_INCOMPLETE'];
const POLICY_KEYS = ['originalMedium', 'sourceText', 'semanticCut', 'temporalDiscontinuity', 'timingIntegrity', 'analyticalProjection', 'cameraEmphasis',
  'motion', 'captionProvenance', 'accessibilityParity', 'reducedMotionParity', 'editorialAnnotation'] as const;
const THREAD_STATES = ['ESTABLISHED_ACTIVE', 'ESTABLISHED_DORMANT', 'ESTABLISHED_REOPENED', 'ESTABLISHED_UNBOUND_IN_SESSION'] as const;
const LINEAGE_KINDS = ['LEGACY_BASELINE', 'CREATED', 'STATUS_TRANSITION', 'VERSION_ADVANCED'] as const;
/** S7-05 (F-2): the one word a Reading's scope crosses the Replay wire as — its class, never its Session. */
const READING_SCOPE_CLASSES = ['CONVERSATION_SESSION'] as const;
const CONFIDENCE_RESOLUTIONS = ['CURRENT', 'SUPERSEDED', 'PREVALID'] as const;

/** One refused answer, thrown inside a decoder and caught at its edge: an answer is used whole or not at all. */
class Refused extends Error {}
const refuse = (detail: string): never => { throw new Refused(detail); };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= INT4_MAX;
const isPosition = (value: unknown): value is number => isCount(value) && value >= 1;
const isOneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T => typeof value === 'string' && (allowed as readonly string[]).includes(value);

function shape(value: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  if (!isRecord(value)) return refuse(`${path}: not an object`);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || !keys.every((key) => actual.includes(key))) return refuse(`${path}: not exactly ${keys.join(', ')}`);
  return value;
}
const identity = (value: unknown, path: string): string => (typeof value === 'string' && value.length > 0 && value.length <= 128 ? value : refuse(`${path}: an identity`));
const identityOrNull = (value: unknown, path: string): string | null => (value === null ? null : identity(value, path));
const text = (value: unknown, path: string): string => (typeof value === 'string' && value.length > 0 ? value : refuse(`${path}: a non-empty string`));
const textOrNull = (value: unknown, path: string): string | null => (value === null ? null : text(value, path));
const integer = (value: unknown, path: string): number => (typeof value === 'number' && Number.isSafeInteger(value) ? value : refuse(`${path}: a safe integer`));
const integerOrNull = (value: unknown, path: string): number | null => (value === null ? null : integer(value, path));
const finiteOrNull = (value: unknown, path: string): number | null =>
  (value === null ? null : typeof value === 'number' && Number.isFinite(value) ? value : refuse(`${path}: a finite number`));
const flag = (value: unknown, path: string): boolean => (typeof value === 'boolean' ? value : refuse(`${path}: a boolean`));
const vocabulary = <T extends string>(value: unknown, path: string, allowed: readonly T[]): T => (isOneOf(value, allowed) ? value : refuse(`${path}: one of ${allowed.join(', ')}`));
const integerText = (value: unknown, path: string): string => (typeof value === 'string' && /^-?[0-9]{1,20}$/u.test(value) ? value : refuse(`${path}: exact integer text`));
function list<T>(value: unknown, path: string, decode: (entry: unknown, entryPath: string) => T): readonly T[] {
  if (!Array.isArray(value)) return refuse(`${path}: an array`);
  return Object.freeze(value.map((entry, index) => decode(entry, `${path}[${index}]`)));
}
const texts = (value: unknown, path: string): readonly string[] => list(value, path, text);
/** A Session Position inside an analysis at `tc`: never later than the moment it describes. */
function sp(value: unknown, path: string, tc: number): number {
  if (!isPosition(value)) return refuse(`${path}: a Session Position`);
  if (value > tc) return refuse(`${path}: ${value} lies beyond the moment's own TC ${tc}`);
  return value;
}
const spOrNull = (value: unknown, path: string, tc: number): number | null => (value === null ? null : sp(value, path, tc));

/** `GET /replay/:replayId/versions/:versionId`, for exactly the version that was asked for. */
export function decodeReplayVersion(value: unknown, replayId: string, versionId: string): ReplayVersionResult {
  if (isRecord(value) && Object.keys(value).length === 1 && value.outcome === 'UNAVAILABLE') return { kind: 'NOT_FOUND' };
  try {
    const row = shape(value, 'version', ['outcome', 'replayId', 'versionId', 'revision', 'createdAt', 'isCurrent', 'finalized', 'coverageClass', 'momentCount',
      'temporalDiscontinuityCount', 'firstTc', 'lastTc', 'renderContract', 'viewing']);
    if (row.outcome !== 'FOUND') return refuse('version.outcome');
    if (!isUuid(row.replayId) || row.replayId.toLowerCase() !== replayId.toLowerCase()) return refuse('version.replayId: another Replay');
    if (!isUuid(row.versionId) || row.versionId.toLowerCase() !== versionId.toLowerCase()) return refuse('version.versionId: another version');
    if (typeof row.createdAt !== 'string' || !INSTANT.test(row.createdAt)) return refuse('version.createdAt');
    if (!isPosition(row.revision) || !isPosition(row.momentCount) || !isCount(row.temporalDiscontinuityCount) || !isPosition(row.firstTc) || !isPosition(row.lastTc)
        || row.lastTc < row.firstTc || row.momentCount > row.lastTc - row.firstTc + 1) return refuse('version: its counts and range');
    const contract = shape(row.renderContract, 'version.renderContract', ['revision', 'schema', 'sourceMediumClass', 'policies']);
    const policies = shape(contract.policies, 'version.renderContract.policies', POLICY_KEYS);
    if (!isPosition(contract.revision)) return refuse('version.renderContract.revision');
    const viewing = shape(row.viewing, 'version.viewing', ['state', 'notViewableClass', 'sourceLayer', 'analyticalLayer']);
    const state = vocabulary(viewing.state, 'version.viewing.state', ['VIEWABLE', 'NOT_VIEWABLE'] as const);
    const notViewableClass = state === 'VIEWABLE'
      ? (viewing.notViewableClass === null ? null : refuse('version.viewing: a viewable version names no reason'))
      : vocabulary(viewing.notViewableClass, 'version.viewing.notViewableClass', NOT_VIEWABLE);
    return {
      kind: 'FOUND',
      version: Object.freeze({
        replayId: row.replayId.toLowerCase(),
        versionId: row.versionId.toLowerCase(),
        revision: row.revision,
        isCurrent: flag(row.isCurrent, 'version.isCurrent'),
        finalized: flag(row.finalized, 'version.finalized'),
        coverage: vocabulary(row.coverageClass, 'version.coverageClass', COVERAGE),
        momentCount: row.momentCount,
        temporalDiscontinuityCount: row.temporalDiscontinuityCount,
        firstTc: row.firstTc,
        lastTc: row.lastTc,
        renderContract: Object.freeze({
          revision: contract.revision,
          schema: text(contract.schema, 'version.renderContract.schema'),
          sourceMediumClass: text(contract.sourceMediumClass, 'version.renderContract.sourceMediumClass'),
          policies: Object.freeze(Object.fromEntries(POLICY_KEYS.map((key) => [key, text(policies[key], `version.renderContract.policies.${key}`)]))) as ReplayRenderContractView['policies'],
        }),
        viewing: Object.freeze({
          state,
          notViewableClass,
          sourceLayer: vocabulary(viewing.sourceLayer, 'version.viewing.sourceLayer', ['DEREFERENCEABLE', 'NOT_DEREFERENCEABLE'] as const),
          analyticalLayer: vocabulary(viewing.analyticalLayer, 'version.viewing.analyticalLayer', ['SEALED_HISTORICAL_EVIDENCE', 'SEALED_EVIDENCE_INCOMPLETE'] as const),
        }),
      }),
    };
  } catch (error) {
    if (error instanceof Refused) return { kind: 'UNAVAILABLE' };
    throw error;
  }
}

/** `GET …/moments`: ordinals 1 .. n in canonical chronology, and one viewing answer for all of them (every text, or none). */
export function decodeReplayMoments(value: unknown): ReplayMomentsResult {
  if (isRecord(value) && Object.keys(value).length === 1 && value.outcome === 'UNAVAILABLE') return { kind: 'NOT_FOUND' };
  try {
    const body = shape(value, 'moments', ['outcome', 'moments']);
    if (body.outcome !== 'FOUND') return refuse('moments.outcome');
    const moments = list(body.moments, 'moments.moments', (entry, path): ReplayHistoryMoment => {
      const moment = shape(entry, path, ['ordinal', 'tc', 'sourceRole', 'originalMedium', 'omittedBefore', 'text']);
      if (!isPosition(moment.ordinal) || !isPosition(moment.tc) || !isCount(moment.omittedBefore)) return refuse(`${path}: its coordinates`);
      if (moment.text !== null && (typeof moment.text !== 'string' || moment.text.length === 0)) return refuse(`${path}.text`);
      return Object.freeze({
        ordinal: moment.ordinal,
        tc: moment.tc,
        sourceRole: vocabulary(moment.sourceRole, `${path}.sourceRole`, ['USER', 'ASSISTANT'] as const),
        originalMedium: vocabulary(moment.originalMedium, `${path}.originalMedium`, ['ORIGINAL_TEXT', 'ORIGINAL_AUDIO', 'MIXED'] as const),
        omittedBefore: moment.omittedBefore,
        text: moment.text as string | null,
      });
    });
    if (moments.length === 0) return refuse('moments: none');
    if (moments.some((moment, index) => moment.ordinal !== index + 1 || (index > 0 && moment.tc <= moments[index - 1].tc))) return refuse('moments: not 1 .. n in chronology');
    if (moments[0].omittedBefore !== 0) return refuse('moments[0]: nothing is omitted before the first moment');
    if (new Set(moments.map((moment) => moment.text === null)).size !== 1) return refuse('moments: the text of every moment, or of none');
    return { kind: 'FOUND', moments };
  } catch (error) {
    if (error instanceof Refused) return { kind: 'UNAVAILABLE' };
    throw error;
  }
}

function liveFocusValue(raw: unknown, path: string): LiveFocusWireValue {
  if (!isRecord(raw)) return refuse(`${path}: an object`);
  switch (raw.kind) {
    case 'NONE': shape(raw, path, ['kind']); return { kind: 'NONE' };
    case 'EMERGING': shape(raw, path, ['kind', 'emergingFocusId']); return { kind: 'EMERGING', emergingFocusId: identity(raw.emergingFocusId, `${path}.emergingFocusId`) };
    case 'THREAD': shape(raw, path, ['kind', 'threadId']); return { kind: 'THREAD', threadId: identity(raw.threadId, `${path}.threadId`) };
    default: return refuse(`${path}.kind`);
  }
}

function decodeWorld(raw: unknown, tc: number): DisclosedWorldRung {
  const world = shape(raw, 'world', ['threads', 'liveFocus']);
  const threads = list(world.threads, 'world.threads', (entry, path) => {
    const thread = shape(entry, path, ['id', 'establishmentPath', 'establishedInSession', 'establishedSp', 'groundingEmergingFocusId', 'home', 'state']);
    const home = shape(thread.home, `${path}.home`, ['x', 'y']);
    const establishedInSession = flag(thread.establishedInSession, `${path}.establishedInSession`);
    const establishedSp = spOrNull(thread.establishedSp, `${path}.establishedSp`, tc);
    if (establishedInSession !== (establishedSp !== null)) return refuse(`${path}: an establishing position exists exactly for a Thread established in this conversation`);
    return Object.freeze({
      id: identity(thread.id, `${path}.id`),
      establishmentPath: text(thread.establishmentPath, `${path}.establishmentPath`),
      establishedInSession,
      establishedSp,
      groundingEmergingFocusId: identityOrNull(thread.groundingEmergingFocusId, `${path}.groundingEmergingFocusId`),
      home: Object.freeze({ x: integerText(home.x, `${path}.home.x`), y: integerText(home.y, `${path}.home.y`) }),
      state: vocabulary(thread.state, `${path}.state`, THREAD_STATES),
    });
  });
  if (new Set(threads.map((thread) => thread.id)).size !== threads.length) return refuse('world.threads: a Thread twice');
  const focus = shape(world.liveFocus, 'world.liveFocus', ['value', 'atSp']);
  const value = liveFocusValue(focus.value, 'world.liveFocus.value');
  const atSp = spOrNull(focus.atSp, 'world.liveFocus.atSp', tc);
  if (value.kind !== 'NONE' && atSp === null) return refuse('world.liveFocus: a Live Focus became effective at a position');
  if (value.kind === 'THREAD' && !threads.some((thread) => thread.id === value.threadId)) return refuse('world.liveFocus: a Thread that is not known at TC');
  return Object.freeze({ threads, liveFocus: Object.freeze({ value, atSp }) });
}

function rung<T>(raw: unknown, path: string, disclosed: boolean, decode: (value: unknown) => T): HistoricalRung<T> {
  if (!isRecord(raw)) return refuse(`${path}: an object`);
  if (!disclosed) {
    shape(raw, path, ['status']);
    return raw.status === 'DEPTH_WITHHELD' ? { status: 'DEPTH_WITHHELD' } : refuse(`${path}: above the requested depth, it is withheld`);
  }
  shape(raw, path, ['status', 'value']);
  return raw.status === 'DISCLOSED' ? Object.freeze({ status: 'DISCLOSED', value: decode(raw.value) }) : refuse(`${path}: at or below the requested depth, it is disclosed`);
}

function decodeThreadRung(raw: unknown, tc: number): DisclosedThreadRung {
  const value = shape(raw, 'thread.value', ['threadReadingAppearances']);
  return Object.freeze({
    threadReadingAppearances: list(value.threadReadingAppearances, 'thread.value.threadReadingAppearances', (entry, path) => {
      const appearance = shape(entry, path, ['bindingId', 'threadId', 'readingId', 'boundSp', 'current']);
      return Object.freeze({
        bindingId: identity(appearance.bindingId, `${path}.bindingId`),
        threadId: identity(appearance.threadId, `${path}.threadId`),
        readingId: identity(appearance.readingId, `${path}.readingId`),
        boundSp: sp(appearance.boundSp, `${path}.boundSp`, tc),
        current: flag(appearance.current, `${path}.current`),
      });
    }),
  });
}

function decodeSessionRung(raw: unknown, tc: number): ReplaySessionAnalyticsView {
  const value = shape(raw, 'session.value', ['emergingFocuses', 'questionAppearances']);
  return Object.freeze({
    emergingFocuses: list(value.emergingFocuses, 'session.value.emergingFocuses', (entry, path) => {
      const focus = shape(entry, path, ['id', 'startedSp', 'lastAttentionSp', 'promotedThreadId', 'state']);
      const startedSp = sp(focus.startedSp, `${path}.startedSp`, tc);
      const lastAttentionSp = spOrNull(focus.lastAttentionSp, `${path}.lastAttentionSp`, tc);
      if (lastAttentionSp !== null && lastAttentionSp < startedSp) return refuse(`${path}: attention before the focus started`);
      return Object.freeze({
        id: identity(focus.id, `${path}.id`), startedSp, lastAttentionSp,
        promotedThreadId: identityOrNull(focus.promotedThreadId, `${path}.promotedThreadId`),
        state: vocabulary(focus.state, `${path}.state`, ['EMERGING_PREGEOGRAPHIC'] as const),
      });
    }),
    questionAppearances: list(value.questionAppearances, 'session.value.questionAppearances', (entry, path) => {
      const appearance = shape(entry, path, ['bindingId', 'gapId', 'gapOpenEpoch', 'readingId', 'readingVersion', 'questionType', 'appearedAtSp']);
      return Object.freeze({
        bindingId: identity(appearance.bindingId, `${path}.bindingId`),
        gapId: identity(appearance.gapId, `${path}.gapId`),
        gapOpenEpoch: integer(appearance.gapOpenEpoch, `${path}.gapOpenEpoch`),
        readingId: identity(appearance.readingId, `${path}.readingId`),
        readingVersion: integer(appearance.readingVersion, `${path}.readingVersion`),
        questionType: text(appearance.questionType, `${path}.questionType`),
        appearedAtSp: sp(appearance.appearedAtSp, `${path}.appearedAtSp`, tc),
      });
    }),
  });
}

function decodeAnalyticalRung(raw: unknown, tc: number): ReplayAnalyticalObjectView {
  const base = 'analyticalObject.value';
  const value = shape(raw, base, ['readings', 'readingRelations', 'materials', 'gaps', 'questions', 'confidences']);
  const readings = list(value.readings, `${base}.readings`, (entry, path) => {
    const reading = shape(entry, path, ['id', 'statement', 'type', 'domain', 'scope', 'origin', 'assumptions', 'disconfirmingConditions', 'statusAtTc', 'versionAtTc', 'lineage', 'subjectGroundings']);
    const versionAtTc = integer(reading.versionAtTc, `${path}.versionAtTc`);
    const lineage = list(reading.lineage, `${path}.lineage`, (stepRaw, stepPath) => {
      const step = shape(stepRaw, stepPath, ['kind', 'fromStatus', 'toStatus', 'fromVersion', 'toVersion']);
      return Object.freeze({
        kind: vocabulary(step.kind, `${stepPath}.kind`, LINEAGE_KINDS),
        fromStatus: textOrNull(step.fromStatus, `${stepPath}.fromStatus`),
        toStatus: text(step.toStatus, `${stepPath}.toStatus`),
        fromVersion: integerOrNull(step.fromVersion, `${stepPath}.fromVersion`),
        toVersion: integer(step.toVersion, `${stepPath}.toVersion`),
      });
    });
    if (lineage.length === 0 || versionAtTc < 1 || lineage.some((step) => step.toVersion > versionAtTc)) return refuse(`${path}: its lineage`);
    const subjectGroundings = list(reading.subjectGroundings, `${path}.subjectGroundings`, (groundingRaw, groundingPath) => {
      const grounding = shape(groundingRaw, groundingPath, ['emergingFocusId', 'groundedAtSp']);
      return Object.freeze({ emergingFocusId: identity(grounding.emergingFocusId, `${groundingPath}.emergingFocusId`), groundedAtSp: sp(grounding.groundedAtSp, `${groundingPath}.groundedAtSp`, tc) });
    });
    return Object.freeze({
      id: identity(reading.id, `${path}.id`),
      statement: text(reading.statement, `${path}.statement`),
      type: text(reading.type, `${path}.type`),
      domain: text(reading.domain, `${path}.domain`),
      scope: vocabulary(reading.scope, `${path}.scope`, READING_SCOPE_CLASSES),
      origin: text(reading.origin, `${path}.origin`),
      assumptions: texts(reading.assumptions, `${path}.assumptions`),
      disconfirmingConditions: texts(reading.disconfirmingConditions, `${path}.disconfirmingConditions`),
      statusAtTc: text(reading.statusAtTc, `${path}.statusAtTc`),
      versionAtTc,
      lineage,
      subjectGroundings,
    });
  });
  const readingIds = new Set(readings.map((reading) => reading.id));
  const versionOf = new Map(readings.map((reading) => [reading.id, reading.versionAtTc]));
  const readingRelations = list(value.readingRelations, `${base}.readingRelations`, (entry, path) => {
    const relation = shape(entry, path, ['a', 'b']);
    const a = identity(relation.a, `${path}.a`);
    const b = identity(relation.b, `${path}.b`);
    return a < b && readingIds.has(a) && readingIds.has(b) ? Object.freeze({ a, b }) : refuse(`${path}: an endpoint not known at TC`);
  });
  const materials = list(value.materials, `${base}.materials`, (entry, path) => {
    const material = shape(entry, path, ['id', 'type', 'content', 'source', 'confidence', 'importance', 'version', 'supersedesMaterialId', 'supersededByMaterialId', 'statusAtTc']);
    return Object.freeze({
      id: identity(material.id, `${path}.id`),
      type: text(material.type, `${path}.type`),
      content: text(material.content, `${path}.content`),
      source: text(material.source, `${path}.source`),
      confidence: finiteOrNull(material.confidence, `${path}.confidence`),
      importance: finiteOrNull(material.importance, `${path}.importance`),
      version: integer(material.version, `${path}.version`),
      supersedesMaterialId: identityOrNull(material.supersedesMaterialId, `${path}.supersedesMaterialId`),
      supersededByMaterialId: identityOrNull(material.supersededByMaterialId, `${path}.supersededByMaterialId`),
      statusAtTc: text(material.statusAtTc, `${path}.statusAtTc`),
    });
  });
  const gaps = list(value.gaps, `${base}.gaps`, (entry, path) => {
    const gap = shape(entry, path, ['id', 'informationNeeded', 'whyItMatters', 'userAnswerability', 'preferredQuestionType', 'readingIds', 'statusAtTc', 'openEpochAtTc', 'closureReasonAtTc']);
    const ids = texts(gap.readingIds, `${path}.readingIds`);
    if (ids.some((id) => !readingIds.has(id))) return refuse(`${path}: a Reading not known at TC`);
    return Object.freeze({
      id: identity(gap.id, `${path}.id`),
      informationNeeded: text(gap.informationNeeded, `${path}.informationNeeded`),
      whyItMatters: textOrNull(gap.whyItMatters, `${path}.whyItMatters`),
      userAnswerability: textOrNull(gap.userAnswerability, `${path}.userAnswerability`),
      preferredQuestionType: textOrNull(gap.preferredQuestionType, `${path}.preferredQuestionType`),
      readingIds: ids,
      statusAtTc: text(gap.statusAtTc, `${path}.statusAtTc`),
      openEpochAtTc: integer(gap.openEpochAtTc, `${path}.openEpochAtTc`),
      closureReasonAtTc: textOrNull(gap.closureReasonAtTc, `${path}.closureReasonAtTc`),
    });
  });
  const gapIds = new Set(gaps.map((gap) => gap.id));
  const questions = list(value.questions, `${base}.questions`, (entry, path) => {
    const question = shape(entry, path, ['id', 'gapId', 'questionText', 'questionType', 'answerFormat', 'informationNeeded', 'targetReadingIds']);
    const gapId = identity(question.gapId, `${path}.gapId`);
    const targetReadingIds = texts(question.targetReadingIds, `${path}.targetReadingIds`);
    if (!gapIds.has(gapId) || targetReadingIds.some((id) => !readingIds.has(id))) return refuse(`${path}: a Gap or Reading not known at TC`);
    return Object.freeze({
      id: identity(question.id, `${path}.id`), gapId,
      questionText: text(question.questionText, `${path}.questionText`),
      questionType: text(question.questionType, `${path}.questionType`),
      answerFormat: text(question.answerFormat, `${path}.answerFormat`),
      informationNeeded: text(question.informationNeeded, `${path}.informationNeeded`),
      targetReadingIds,
    });
  });
  const confidences = list(value.confidences, `${base}.confidences`, (entry, path) => {
    const confidence = shape(entry, path, ['id', 'readingId', 'targetVersion', 'resolution', 'missingInformationCodes', 'supportingEvidenceIds', 'contradictingEvidenceIds', 'assumptions', 'alternativeReadingIds']);
    const readingId = identity(confidence.readingId, `${path}.readingId`);
    const targetVersion = integer(confidence.targetVersion, `${path}.targetVersion`);
    const resolution = vocabulary(confidence.resolution, `${path}.resolution`, CONFIDENCE_RESOLUTIONS);
    const versionAtTc = versionOf.get(readingId);
    if (versionAtTc === undefined) return refuse(`${path}: a Reading not known at TC`);
    if ((resolution === 'PREVALID') !== (targetVersion > versionAtTc) || (resolution === 'CURRENT' && targetVersion !== versionAtTc)) return refuse(`${path}: its resolution`);
    return Object.freeze({
      id: identity(confidence.id, `${path}.id`), readingId, targetVersion, resolution,
      missingInformationCodes: texts(confidence.missingInformationCodes, `${path}.missingInformationCodes`),
      supportingEvidenceIds: texts(confidence.supportingEvidenceIds, `${path}.supportingEvidenceIds`),
      contradictingEvidenceIds: texts(confidence.contradictingEvidenceIds, `${path}.contradictingEvidenceIds`),
      assumptions: texts(confidence.assumptions, `${path}.assumptions`),
      alternativeReadingIds: texts(confidence.alternativeReadingIds, `${path}.alternativeReadingIds`),
    });
  });
  return Object.freeze({ readings, readingRelations, materials, gaps, questions, confidences });
}

function decodeProvenanceRung(raw: unknown): DisclosedSourceProvenanceRung {
  const value = shape(raw, 'sourceProvenance.value', ['evidenceParticipations']);
  return Object.freeze({
    evidenceParticipations: list(value.evidenceParticipations, 'sourceProvenance.value.evidenceParticipations', (entry, path) => {
      const participation = shape(entry, path, ['readingId', 'materialId', 'evidenceId', 'role']);
      const materialId = identity(participation.materialId, `${path}.materialId`);
      const evidenceId = text(participation.evidenceId, `${path}.evidenceId`);
      if (evidenceId !== `memory:${materialId}`) return refuse(`${path}: the evidence names another Material`);
      return Object.freeze({ readingId: identity(participation.readingId, `${path}.readingId`), materialId, evidenceId,
        role: vocabulary(participation.role, `${path}.role`, ['SUPPORTING', 'CONTRADICTING'] as const) });
    }),
  });
}

/** `GET …/moments/:ordinal/analysis?depth=`, for exactly the moment and the depth that were asked for. */
export function decodeReplayMomentAnalysis(value: unknown, ordinal: number, depth: HistoricalSemanticDepth): ReplayAnalysisResult {
  if (isRecord(value) && Object.keys(value).length === 1 && value.outcome === 'UNAVAILABLE') return { kind: 'NOT_FOUND' };
  try {
    if (!isRecord(value)) return refuse('analysis: an object');
    if (value.outcome === 'NOT_VIEWABLE' || value.outcome === 'ANALYSIS_NOT_CURRENTLY_AVAILABLE') {
      shape(value, 'analysis', ['outcome', 'ordinal', 'tc']);
      if (value.ordinal !== ordinal || !isPosition(value.tc)) return refuse('analysis: another moment');
      return { kind: 'ANSWERED', analysis: Object.freeze({ outcome: value.outcome, ordinal, tc: value.tc }) };
    }
    const body = shape(value, 'analysis', ['outcome', 'ordinal', 'tc', 'depth', 'world', 'thread', 'session', 'analyticalObject', 'sourceProvenance']);
    if (body.outcome !== 'AVAILABLE' || body.ordinal !== ordinal || !isPosition(body.tc) || body.depth !== depth) return refuse('analysis: another moment or depth');
    const tc = body.tc;
    const level = REPLAY_HISTORY_DEPTHS.indexOf(depth);
    return {
      kind: 'ANSWERED',
      analysis: Object.freeze({
        outcome: 'AVAILABLE',
        ordinal,
        tc,
        depth,
        world: decodeWorld(body.world, tc),
        thread: rung(body.thread, 'thread', level >= 1, (raw) => decodeThreadRung(raw, tc)),
        session: rung(body.session, 'session', level >= 2, (raw) => decodeSessionRung(raw, tc)),
        analyticalObject: rung(body.analyticalObject, 'analyticalObject', level >= 3, (raw) => decodeAnalyticalRung(raw, tc)),
        sourceProvenance: rung(body.sourceProvenance, 'sourceProvenance', level >= 4, decodeProvenanceRung),
      }),
    };
  } catch (error) {
    if (error instanceof Refused) return { kind: 'UNAVAILABLE' };
    throw error;
  }
}

type Exchange = { readonly kind: 'BODY'; readonly body: unknown } | { readonly kind: 'NONE' };

export class ReplayHistoryApiClient {
  constructor(private readonly config: ReplayHistoryApiConfig) {}

  async version(replayId: string, versionId: string): Promise<ReplayVersionResult> {
    const answer = await this.read(`/replay/${encodeURIComponent(replayId)}/versions/${encodeURIComponent(versionId)}`);
    return answer.kind === 'NONE' ? { kind: 'UNAVAILABLE' } : decodeReplayVersion(answer.body, replayId, versionId);
  }

  async moments(replayId: string, versionId: string): Promise<ReplayMomentsResult> {
    const answer = await this.read(`/replay/${encodeURIComponent(replayId)}/versions/${encodeURIComponent(versionId)}/moments`);
    return answer.kind === 'NONE' ? { kind: 'UNAVAILABLE' } : decodeReplayMoments(answer.body);
  }

  async momentAnalysis(replayId: string, versionId: string, ordinal: number, depth: HistoricalSemanticDepth): Promise<ReplayAnalysisResult> {
    if (!isPosition(ordinal) || !REPLAY_HISTORY_DEPTHS.includes(depth)) return { kind: 'UNAVAILABLE' };
    const answer = await this.read(`/replay/${encodeURIComponent(replayId)}/versions/${encodeURIComponent(versionId)}/moments/${ordinal}/analysis?depth=${depth}`);
    return answer.kind === 'NONE' ? { kind: 'UNAVAILABLE' } : decodeReplayMomentAnalysis(answer.body, ordinal, depth);
  }

  /** One GET. Anything but a readable 2xx body is NONE: there is no write here whose outcome could be unknown. */
  private async read(path: string): Promise<Exchange> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}${path}`, { method: 'GET', headers: { Accept: 'application/json' } });
    } catch {
      // No credential, no network: nothing arrived, and a read has nothing to reconcile.
      return { kind: 'NONE' };
    }
    if (!response.ok) return { kind: 'NONE' };
    try {
      return { kind: 'BODY', body: (await response.json()) as unknown };
    } catch {
      return { kind: 'NONE' };
    }
  }
}
