/**
 * T-03C — runtime validation of the server historical disclosure wire (`V`).
 *
 * A TypeScript interface is a compile-time claim about a value the client did
 * not produce. A delivered disclosure is untrusted at runtime, so every field is
 * checked here against its exact shape and bounds before it can be read as
 * history: exact keys (allowlist, never a blacklist), the five frozen semantic
 * depths, safe-integer Session Positions with `1 <= sp <= tc <= liveHead`,
 * `sealed === tc < liveHead`, exactly the Moments `SP(1) .. SP(TC)` when the
 * Session rung is disclosed, closed vocabularies for every state and mapping,
 * and rungs that are either DISCLOSED with a value or DEPTH_WITHHELD — never
 * both, never neither.
 *
 * Three absences stay distinct on this side of the wire exactly as the frozen
 * constitution keeps them apart on the server: a rung that is DEPTH_WITHHELD is
 * not empty knowledge; an identity absent from a DISCLOSED rung is unknown at TC;
 * and a disclosure the client has not fetched yet is NOT_FETCHED (see
 * `historical-projection-cache.ts`), never any of the two.
 *
 * The shape rules are the T-02 kernel's own (`exactShapeIssue`,
 * `isSessionPosition`, `isSemanticDepth`), so there is exactly one definition
 * of "exact shape" on the client. Nothing here writes canonical state.
 */
import type {
  DisclosedAnalyticalObjectRung,
  DisclosedConfidence,
  DisclosedEmergingFocus,
  DisclosedEvidenceParticipation,
  DisclosedGap,
  DisclosedLiveFocusAtTc,
  DisclosedMaterial,
  DisclosedMoment,
  DisclosedQuestion,
  DisclosedQuestionAppearance,
  DisclosedReading,
  DisclosedReadingLineageStep,
  DisclosedReadingRelation,
  DisclosedSessionRung,
  DisclosedSourceProvenanceRung,
  DisclosedThread,
  DisclosedThreadReadingAppearance,
  DisclosedThreadRung,
  DisclosedWorldRung,
  HistoricalDisclosure,
  HistoricalInspectionResolution,
  HistoricalProjectionUnavailableBody,
  HistoricalRung,
  HistoricalSemanticDepth,
  LiveFocusWireValue,
} from '@qandeel/runtime';
import { exactShapeIssue, isPlainRecord, isSemanticDepth, isSessionPosition } from '../state';

export type HistoricalWireRejectionReason =
  | 'MALFORMED_SHAPE'
  | 'INVALID_IDENTITY'
  | 'INVALID_SESSION_POSITION'
  | 'INVALID_DEPTH'
  | 'INVALID_VOCABULARY'
  | 'INCOHERENT_HEADER'
  | 'INCOHERENT_FAMILY'
  | 'INVALID_RUNG';

export type HistoricalWireDecode<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: HistoricalWireRejectionReason; readonly detail: string };

const DISCLOSURE_KEYS = ['sessionId', 'liveHead', 'tc', 'sealed', 'depth', 'revision', 'world', 'thread', 'session', 'analyticalObject', 'sourceProvenance', 'inspection'] as const;
const REVISION_KEYS = ['liveHead', 'worldVersion', 'pendingExpiries'] as const;
const WORLD_KEYS = ['threads', 'liveFocus'] as const;
const THREAD_KEYS = ['id', 'establishmentPath', 'establishedInSession', 'establishedSp', 'groundingEmergingFocusId', 'home', 'state'] as const;
const LIVE_FOCUS_KEYS = ['value', 'atSp'] as const;
const THREAD_RUNG_KEYS = ['threadReadingAppearances'] as const;
const THREAD_APPEARANCE_KEYS = ['bindingId', 'threadId', 'readingId', 'boundSp', 'current'] as const;
const SESSION_RUNG_KEYS = ['moments', 'emergingFocuses', 'questionAppearances'] as const;
const MOMENT_KEYS = ['id', 'sp', 'sourceRole', 'sourceTurnId', 'ordinalWithinTurn', 'committedText', 'spanStart', 'spanEnd'] as const;
const FOCUS_KEYS = ['id', 'startedSp', 'lastAttentionSp', 'promotedThreadId', 'state'] as const;
const QUESTION_APPEARANCE_KEYS = ['bindingId', 'gapId', 'gapOpenEpoch', 'readingId', 'readingVersion', 'questionType', 'sourceTurnId', 'assistantTurnId', 'appearedAtSp'] as const;
const ANALYTICAL_RUNG_KEYS = ['readings', 'readingRelations', 'materials', 'gaps', 'questions', 'confidences'] as const;
const READING_KEYS = ['id', 'statement', 'type', 'domain', 'scope', 'origin', 'assumptions', 'disconfirmingConditions', 'statusAtTc', 'versionAtTc', 'lineage'] as const;
const LINEAGE_KEYS = ['kind', 'fromStatus', 'toStatus', 'fromVersion', 'toVersion'] as const;
const RELATION_KEYS = ['a', 'b'] as const;
const MATERIAL_KEYS = ['id', 'type', 'content', 'source', 'confidence', 'importance', 'version', 'supersedesMaterialId', 'supersededByMaterialId', 'statusAtTc', 'expiry'] as const;
const EXPIRY_KEYS = ['mapping', 'sp'] as const;
const GAP_KEYS = ['id', 'informationNeeded', 'whyItMatters', 'userAnswerability', 'preferredQuestionType', 'readingIds', 'statusAtTc', 'openEpochAtTc', 'closureReasonAtTc'] as const;
const QUESTION_KEYS = ['id', 'gapId', 'questionText', 'questionType', 'answerFormat', 'informationNeeded', 'targetReadingIds'] as const;
const CONFIDENCE_KEYS = ['id', 'readingId', 'targetVersion', 'resolution', 'missingInformationCodes', 'supportingEvidenceIds', 'contradictingEvidenceIds', 'assumptions', 'alternativeReadingIds'] as const;
const PROVENANCE_RUNG_KEYS = ['evidenceParticipations'] as const;
const PARTICIPATION_KEYS = ['readingId', 'materialId', 'evidenceId', 'role'] as const;
const THREAD_STATES = ['ESTABLISHED_ACTIVE', 'ESTABLISHED_DORMANT', 'ESTABLISHED_REOPENED', 'ESTABLISHED_UNBOUND_IN_SESSION'] as const;
const LINEAGE_KINDS = ['LEGACY_BASELINE', 'CREATED', 'STATUS_TRANSITION', 'VERSION_ADVANCED'] as const;
const EXPIRY_MAPPINGS = ['NO_EXPIRY', 'PRE_FIRST_SP', 'SP', 'PENDING', 'NOT_IN_SESSION'] as const;
const CONFIDENCE_RESOLUTIONS = ['CURRENT', 'SUPERSEDED', 'PREVALID'] as const;
const UNAVAILABLE_CODES = ['HISTORICAL_COVERAGE_UNAVAILABLE', 'LIVE_HEAD_NOT_ESTABLISHED', 'HISTORICAL_BASELINE_MISSING', 'SESSION_POSITION_NOT_ADDRESSABLE', 'SESSION_NOT_VISIBLE'] as const;

class Rejection extends Error {
  constructor(readonly reason: HistoricalWireRejectionReason, readonly detail: string) {
    super(detail);
  }
}
const reject = (reason: HistoricalWireRejectionReason, detail: string): never => { throw new Rejection(reason, detail); };

function shape(value: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  const issue = exactShapeIssue(value, path, keys);
  if (issue) return reject('MALFORMED_SHAPE', issue);
  return value as Record<string, unknown>;
}
function identity(value: unknown, path: string): string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 ? value : reject('INVALID_IDENTITY', `${path}: must be a non-empty identity string`);
}
function identityOrNull(value: unknown, path: string): string | null {
  return value === null ? null : identity(value, path);
}
function text(value: unknown, path: string): string {
  return typeof value === 'string' && value.length > 0 ? value : reject('MALFORMED_SHAPE', `${path}: must be a non-empty string`);
}
function textOrNull(value: unknown, path: string): string | null {
  return value === null ? null : text(value, path);
}
function texts(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value)) return reject('MALFORMED_SHAPE', `${path}: must be an array`);
  return value.map((entry, index) => text(entry, `${path}[${index}]`));
}
function integer(value: unknown, path: string): number {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : reject('MALFORMED_SHAPE', `${path}: must be a safe integer`);
}
function integerOrNull(value: unknown, path: string): number | null {
  return value === null ? null : integer(value, path);
}
function finiteOrNull(value: unknown, path: string): number | null {
  if (value === null) return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : reject('MALFORMED_SHAPE', `${path}: must be a finite number`);
}
function sp(value: unknown, path: string, tc: number): number {
  if (!isSessionPosition(value) || !Number.isSafeInteger(value)) return reject('INVALID_SESSION_POSITION', `${path}: must be a safe-integer Session Position >= 1`);
  if (value > tc) return reject('INCOHERENT_FAMILY', `${path}: ${value} lies beyond TC ${tc}`);
  return value;
}
function spOrNull(value: unknown, path: string, tc: number): number | null {
  return value === null ? null : sp(value, path, tc);
}
function flag(value: unknown, path: string): boolean {
  return typeof value === 'boolean' ? value : reject('MALFORMED_SHAPE', `${path}: must be a boolean`);
}
function vocabulary<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : reject('INVALID_VOCABULARY', `${path}: must be one of ${allowed.join(', ')}`);
}
function integerText(value: unknown, path: string): string {
  return typeof value === 'string' && /^-?[0-9]{1,20}$/u.test(value) ? value : reject('MALFORMED_SHAPE', `${path}: must be exact integer text`);
}
function list<T>(value: unknown, path: string, decode: (entry: unknown, entryPath: string) => T): readonly T[] {
  if (!Array.isArray(value)) return reject('MALFORMED_SHAPE', `${path}: must be an array`);
  return value.map((entry, index) => decode(entry, `${path}[${index}]`));
}

function liveFocusValue(raw: unknown, path: string): LiveFocusWireValue {
  if (!isPlainRecord(raw)) return reject('MALFORMED_SHAPE', `${path}: must be a plain object`);
  switch (raw.kind) {
    case 'NONE': shape(raw, path, ['kind']); return { kind: 'NONE' };
    case 'EMERGING': shape(raw, path, ['kind', 'emergingFocusId']); return { kind: 'EMERGING', emergingFocusId: identity(raw.emergingFocusId, `${path}.emergingFocusId`) };
    case 'THREAD': shape(raw, path, ['kind', 'threadId']); return { kind: 'THREAD', threadId: identity(raw.threadId, `${path}.threadId`) };
    default: return reject('INVALID_VOCABULARY', `${path}.kind: must be NONE, EMERGING or THREAD`);
  }
}

function decodeWorld(raw: unknown, tc: number): DisclosedWorldRung {
  const world = shape(raw, 'world', WORLD_KEYS);
  const threads = list(world.threads, 'world.threads', (entry, path): DisclosedThread => {
    const thread = shape(entry, path, THREAD_KEYS);
    const home = shape(thread.home, `${path}.home`, ['x', 'y']);
    const establishedInSession = flag(thread.establishedInSession, `${path}.establishedInSession`);
    const establishedSp = spOrNull(thread.establishedSp, `${path}.establishedSp`, tc);
    if (establishedInSession !== (establishedSp !== null)) return reject('INCOHERENT_FAMILY', `${path}: an establishing Session Position exists exactly for a Thread established in this Session`);
    return {
      id: identity(thread.id, `${path}.id`),
      establishmentPath: text(thread.establishmentPath, `${path}.establishmentPath`),
      establishedInSession,
      establishedSp,
      groundingEmergingFocusId: identityOrNull(thread.groundingEmergingFocusId, `${path}.groundingEmergingFocusId`),
      home: { x: integerText(home.x, `${path}.home.x`), y: integerText(home.y, `${path}.home.y`) },
      state: vocabulary(thread.state, `${path}.state`, THREAD_STATES),
    };
  });
  const liveFocusRaw = shape(world.liveFocus, 'world.liveFocus', LIVE_FOCUS_KEYS);
  const liveFocus: DisclosedLiveFocusAtTc = { value: liveFocusValue(liveFocusRaw.value, 'world.liveFocus.value'), atSp: spOrNull(liveFocusRaw.atSp, 'world.liveFocus.atSp', tc) };
  if ((liveFocus.value.kind === 'NONE') !== (liveFocus.atSp === null) && liveFocus.value.kind !== 'NONE') return reject('INCOHERENT_FAMILY', 'world.liveFocus: a non-NONE Live Focus became effective at a Session Position');
  if (liveFocus.value.kind === 'THREAD' && !threads.some((thread) => thread.id === (liveFocus.value as { threadId: string }).threadId)) return reject('INCOHERENT_FAMILY', 'world.liveFocus: a Thread that is not known at TC');
  return { threads, liveFocus };
}

function rung<T>(raw: unknown, path: string, decode: (value: unknown) => T): HistoricalRung<T> {
  if (!isPlainRecord(raw)) return reject('INVALID_RUNG', `${path}: must be a plain object`);
  if (raw.status === 'DEPTH_WITHHELD') { shape(raw, path, ['status']); return { status: 'DEPTH_WITHHELD' }; }
  if (raw.status === 'DISCLOSED') { shape(raw, path, ['status', 'value']); return { status: 'DISCLOSED', value: decode(raw.value) }; }
  return reject('INVALID_RUNG', `${path}.status: must be DISCLOSED or DEPTH_WITHHELD`);
}

function decodeThreadRung(raw: unknown, tc: number): DisclosedThreadRung {
  const value = shape(raw, 'thread.value', THREAD_RUNG_KEYS);
  return {
    threadReadingAppearances: list(value.threadReadingAppearances, 'thread.value.threadReadingAppearances', (entry, path): DisclosedThreadReadingAppearance => {
      const appearance = shape(entry, path, THREAD_APPEARANCE_KEYS);
      return {
        bindingId: identity(appearance.bindingId, `${path}.bindingId`),
        threadId: identity(appearance.threadId, `${path}.threadId`),
        readingId: identity(appearance.readingId, `${path}.readingId`),
        boundSp: sp(appearance.boundSp, `${path}.boundSp`, tc),
        current: flag(appearance.current, `${path}.current`),
      };
    }),
  };
}

function decodeSessionRung(raw: unknown, tc: number): DisclosedSessionRung {
  const value = shape(raw, 'session.value', SESSION_RUNG_KEYS);
  const moments = list(value.moments, 'session.value.moments', (entry, path): DisclosedMoment => {
    const moment = shape(entry, path, MOMENT_KEYS);
    const spanStart = integer(moment.spanStart, `${path}.spanStart`);
    const spanEnd = integer(moment.spanEnd, `${path}.spanEnd`);
    if (spanStart < 0 || spanEnd <= spanStart) return reject('INCOHERENT_FAMILY', `${path}: an empty or negative span`);
    return {
      id: identity(moment.id, `${path}.id`),
      sp: sp(moment.sp, `${path}.sp`, tc),
      sourceRole: vocabulary(moment.sourceRole, `${path}.sourceRole`, ['USER', 'ASSISTANT'] as const),
      sourceTurnId: identity(moment.sourceTurnId, `${path}.sourceTurnId`),
      ordinalWithinTurn: integer(moment.ordinalWithinTurn, `${path}.ordinalWithinTurn`),
      committedText: text(moment.committedText, `${path}.committedText`),
      spanStart,
      spanEnd,
    };
  });
  if (moments.length !== tc || moments.some((moment, index) => moment.sp !== index + 1)) return reject('INCOHERENT_FAMILY', 'session.value.moments: not exactly SP(1) .. SP(TC) in order');
  const emergingFocuses = list(value.emergingFocuses, 'session.value.emergingFocuses', (entry, path): DisclosedEmergingFocus => {
    const focus = shape(entry, path, FOCUS_KEYS);
    const startedSp = sp(focus.startedSp, `${path}.startedSp`, tc);
    const lastAttentionSp = spOrNull(focus.lastAttentionSp, `${path}.lastAttentionSp`, tc);
    if (lastAttentionSp !== null && lastAttentionSp < startedSp) return reject('INCOHERENT_FAMILY', `${path}: attention before the focus started`);
    return {
      id: identity(focus.id, `${path}.id`), startedSp, lastAttentionSp,
      promotedThreadId: identityOrNull(focus.promotedThreadId, `${path}.promotedThreadId`),
      state: vocabulary(focus.state, `${path}.state`, ['EMERGING_PREGEOGRAPHIC'] as const),
    };
  });
  const questionAppearances = list(value.questionAppearances, 'session.value.questionAppearances', (entry, path): DisclosedQuestionAppearance => {
    const appearance = shape(entry, path, QUESTION_APPEARANCE_KEYS);
    return {
      bindingId: identity(appearance.bindingId, `${path}.bindingId`),
      gapId: identity(appearance.gapId, `${path}.gapId`),
      gapOpenEpoch: integer(appearance.gapOpenEpoch, `${path}.gapOpenEpoch`),
      readingId: identity(appearance.readingId, `${path}.readingId`),
      readingVersion: integer(appearance.readingVersion, `${path}.readingVersion`),
      questionType: text(appearance.questionType, `${path}.questionType`),
      sourceTurnId: identity(appearance.sourceTurnId, `${path}.sourceTurnId`),
      assistantTurnId: identityOrNull(appearance.assistantTurnId, `${path}.assistantTurnId`),
      appearedAtSp: sp(appearance.appearedAtSp, `${path}.appearedAtSp`, tc),
    };
  });
  return { moments, emergingFocuses, questionAppearances };
}

function decodeAnalyticalRung(raw: unknown, tc: number): DisclosedAnalyticalObjectRung {
  const value = shape(raw, 'analyticalObject.value', ANALYTICAL_RUNG_KEYS);
  const base = 'analyticalObject.value';
  const readings = list(value.readings, `${base}.readings`, (entry, path): DisclosedReading => {
    const reading = shape(entry, path, READING_KEYS);
    const versionAtTc = integer(reading.versionAtTc, `${path}.versionAtTc`);
    const lineage = list(reading.lineage, `${path}.lineage`, (stepRaw, stepPath): DisclosedReadingLineageStep => {
      const step = shape(stepRaw, stepPath, LINEAGE_KEYS);
      return {
        kind: vocabulary(step.kind, `${stepPath}.kind`, LINEAGE_KINDS),
        fromStatus: textOrNull(step.fromStatus, `${stepPath}.fromStatus`),
        toStatus: text(step.toStatus, `${stepPath}.toStatus`),
        fromVersion: integerOrNull(step.fromVersion, `${stepPath}.fromVersion`),
        toVersion: integer(step.toVersion, `${stepPath}.toVersion`),
      };
    });
    if (lineage.length === 0 || versionAtTc < 1 || lineage.some((step) => step.toVersion > versionAtTc)) return reject('INCOHERENT_FAMILY', `${path}: lineage must exist and never exceed the then-current version`);
    return {
      id: identity(reading.id, `${path}.id`),
      statement: text(reading.statement, `${path}.statement`),
      type: text(reading.type, `${path}.type`),
      domain: text(reading.domain, `${path}.domain`),
      scope: text(reading.scope, `${path}.scope`),
      origin: text(reading.origin, `${path}.origin`),
      assumptions: texts(reading.assumptions, `${path}.assumptions`),
      disconfirmingConditions: texts(reading.disconfirmingConditions, `${path}.disconfirmingConditions`),
      statusAtTc: text(reading.statusAtTc, `${path}.statusAtTc`),
      versionAtTc,
      lineage,
    };
  });
  const readingIds = new Set(readings.map((reading) => reading.id));
  const versionOf = new Map(readings.map((reading) => [reading.id, reading.versionAtTc]));
  const readingRelations = list(value.readingRelations, `${base}.readingRelations`, (entry, path): DisclosedReadingRelation => {
    const relation = shape(entry, path, RELATION_KEYS);
    const a = identity(relation.a, `${path}.a`);
    const b = identity(relation.b, `${path}.b`);
    if (!(a < b) || !readingIds.has(a) || !readingIds.has(b)) return reject('INCOHERENT_FAMILY', `${path}: an unordered pair or an endpoint that is not known at TC`);
    return { a, b };
  });
  const materials = list(value.materials, `${base}.materials`, (entry, path): DisclosedMaterial => {
    const material = shape(entry, path, MATERIAL_KEYS);
    const expiryRaw = shape(material.expiry, `${path}.expiry`, EXPIRY_KEYS);
    const mapping = vocabulary(expiryRaw.mapping, `${path}.expiry.mapping`, EXPIRY_MAPPINGS);
    const expirySp = expiryRaw.sp === null ? null : (isSessionPosition(expiryRaw.sp) && Number.isSafeInteger(expiryRaw.sp) ? expiryRaw.sp : reject('INVALID_SESSION_POSITION', `${path}.expiry.sp`));
    if ((mapping === 'SP') !== (expirySp !== null)) return reject('INCOHERENT_FAMILY', `${path}.expiry: exactly the SP mapping carries a Session Position`);
    const statusAtTc = text(material.statusAtTc, `${path}.statusAtTc`);
    if (mapping === 'SP' && expirySp !== null && expirySp <= tc && statusAtTc === 'ACTIVE') return reject('INCOHERENT_FAMILY', `${path}: expired inside a Session Position <= TC yet ACTIVE`);
    return {
      id: identity(material.id, `${path}.id`),
      type: text(material.type, `${path}.type`),
      content: text(material.content, `${path}.content`),
      source: text(material.source, `${path}.source`),
      confidence: finiteOrNull(material.confidence, `${path}.confidence`),
      importance: finiteOrNull(material.importance, `${path}.importance`),
      version: integer(material.version, `${path}.version`),
      supersedesMaterialId: identityOrNull(material.supersedesMaterialId, `${path}.supersedesMaterialId`),
      supersededByMaterialId: identityOrNull(material.supersededByMaterialId, `${path}.supersededByMaterialId`),
      statusAtTc,
      expiry: { mapping, sp: expirySp },
    };
  });
  const gaps = list(value.gaps, `${base}.gaps`, (entry, path): DisclosedGap => {
    const gap = shape(entry, path, GAP_KEYS);
    const readingIdsOfGap = texts(gap.readingIds, `${path}.readingIds`);
    if (readingIdsOfGap.some((id) => !readingIds.has(id))) return reject('INCOHERENT_FAMILY', `${path}: a related Reading that is not known at TC`);
    return {
      id: identity(gap.id, `${path}.id`),
      informationNeeded: text(gap.informationNeeded, `${path}.informationNeeded`),
      whyItMatters: textOrNull(gap.whyItMatters, `${path}.whyItMatters`),
      userAnswerability: textOrNull(gap.userAnswerability, `${path}.userAnswerability`),
      preferredQuestionType: textOrNull(gap.preferredQuestionType, `${path}.preferredQuestionType`),
      readingIds: readingIdsOfGap,
      statusAtTc: text(gap.statusAtTc, `${path}.statusAtTc`),
      openEpochAtTc: integer(gap.openEpochAtTc, `${path}.openEpochAtTc`),
      closureReasonAtTc: textOrNull(gap.closureReasonAtTc, `${path}.closureReasonAtTc`),
    };
  });
  const gapIds = new Set(gaps.map((gap) => gap.id));
  const questions = list(value.questions, `${base}.questions`, (entry, path): DisclosedQuestion => {
    const question = shape(entry, path, QUESTION_KEYS);
    const gapId = identity(question.gapId, `${path}.gapId`);
    const targetReadingIds = texts(question.targetReadingIds, `${path}.targetReadingIds`);
    if (!gapIds.has(gapId) || targetReadingIds.some((id) => !readingIds.has(id))) return reject('INCOHERENT_FAMILY', `${path}: a Gap or Reading that is not known at TC`);
    return {
      id: identity(question.id, `${path}.id`), gapId,
      questionText: text(question.questionText, `${path}.questionText`),
      questionType: text(question.questionType, `${path}.questionType`),
      answerFormat: text(question.answerFormat, `${path}.answerFormat`),
      informationNeeded: text(question.informationNeeded, `${path}.informationNeeded`),
      targetReadingIds,
    };
  });
  const confidences = list(value.confidences, `${base}.confidences`, (entry, path): DisclosedConfidence => {
    const confidence = shape(entry, path, CONFIDENCE_KEYS);
    const readingId = identity(confidence.readingId, `${path}.readingId`);
    const targetVersion = integer(confidence.targetVersion, `${path}.targetVersion`);
    const resolution = vocabulary(confidence.resolution, `${path}.resolution`, CONFIDENCE_RESOLUTIONS);
    const versionAtTc = versionOf.get(readingId);
    if (versionAtTc === undefined) return reject('INCOHERENT_FAMILY', `${path}: a Reading that is not known at TC`);
    if ((resolution === 'PREVALID') !== (targetVersion > versionAtTc) || (resolution === 'CURRENT' && targetVersion !== versionAtTc)) return reject('INCOHERENT_FAMILY', `${path}: resolution disagrees with the then-current version`);
    return {
      id: identity(confidence.id, `${path}.id`), readingId, targetVersion, resolution,
      missingInformationCodes: texts(confidence.missingInformationCodes, `${path}.missingInformationCodes`),
      supportingEvidenceIds: texts(confidence.supportingEvidenceIds, `${path}.supportingEvidenceIds`),
      contradictingEvidenceIds: texts(confidence.contradictingEvidenceIds, `${path}.contradictingEvidenceIds`),
      assumptions: texts(confidence.assumptions, `${path}.assumptions`),
      alternativeReadingIds: texts(confidence.alternativeReadingIds, `${path}.alternativeReadingIds`),
    };
  });
  return { readings, readingRelations, materials, gaps, questions, confidences };
}

function decodeProvenanceRung(raw: unknown): DisclosedSourceProvenanceRung {
  const value = shape(raw, 'sourceProvenance.value', PROVENANCE_RUNG_KEYS);
  return {
    evidenceParticipations: list(value.evidenceParticipations, 'sourceProvenance.value.evidenceParticipations', (entry, path): DisclosedEvidenceParticipation => {
      const participation = shape(entry, path, PARTICIPATION_KEYS);
      const materialId = identity(participation.materialId, `${path}.materialId`);
      const evidenceId = text(participation.evidenceId, `${path}.evidenceId`);
      if (evidenceId !== `memory:${materialId}`) return reject('INCOHERENT_FAMILY', `${path}: the evidence identity names another Material`);
      return { readingId: identity(participation.readingId, `${path}.readingId`), materialId, evidenceId, role: vocabulary(participation.role, `${path}.role`, ['SUPPORTING', 'CONTRADICTING'] as const) };
    }),
  };
}

function decodeInspection(raw: unknown): HistoricalInspectionResolution | null {
  if (raw === null) return null;
  if (!isPlainRecord(raw)) return reject('MALFORMED_SHAPE', 'inspection: must be null or a plain object');
  if (raw.knowledge === 'UNKNOWN_AT_TC') { shape(raw, 'inspection', ['knowledge']); return { knowledge: 'UNKNOWN_AT_TC' }; }
  const resolution = shape(raw, 'inspection', ['knowledge', 'noncurrent', 'context', 'disclosure', 'requiredDepth']);
  const knowledge = vocabulary(resolution.knowledge, 'inspection.knowledge', ['KNOWN_AND_CURRENT_AT_TC', 'KNOWN_NONCURRENT_AT_TC'] as const);
  const noncurrent = resolution.noncurrent === null ? null : vocabulary(resolution.noncurrent, 'inspection.noncurrent', ['PREVALID', 'SUPERSEDED'] as const);
  if ((knowledge === 'KNOWN_NONCURRENT_AT_TC') !== (noncurrent !== null)) return reject('INCOHERENT_HEADER', 'inspection: a noncurrent kind exists exactly for KNOWN_NONCURRENT_AT_TC');
  const requiredDepth = resolution.requiredDepth;
  if (!isSemanticDepth(requiredDepth)) return reject('INVALID_DEPTH', 'inspection.requiredDepth: must be one of the five frozen rungs');
  return {
    knowledge, noncurrent,
    context: vocabulary(resolution.context, 'inspection.context', ['NOT_REQUESTED', 'CONTEXT_AVAILABLE_AT_TC', 'CONTEXT_UNAVAILABLE_AT_TC'] as const),
    disclosure: vocabulary(resolution.disclosure, 'inspection.disclosure', ['AVAILABLE_AND_RENDERABLE', 'AVAILABLE_BUT_DEPTH_WITHHELD'] as const),
    requiredDepth,
  };
}

const DEPTH_RANK: Readonly<Record<HistoricalSemanticDepth, number>> = { WORLD: 0, THREAD: 1, SESSION: 2, ANALYTICAL_OBJECT: 3, SOURCE_PROVENANCE: 4 };

/** Decodes one `HistoricalDisclosure` (V). Every failure names its path; nothing partial is ever returned. */
export function decodeHistoricalDisclosure(raw: unknown): HistoricalWireDecode<HistoricalDisclosure> {
  try {
    const envelope = shape(raw, 'disclosure', DISCLOSURE_KEYS);
    const sessionId = identity(envelope.sessionId, 'disclosure.sessionId');
    if (!isSessionPosition(envelope.liveHead) || !Number.isSafeInteger(envelope.liveHead)) return reject('INVALID_SESSION_POSITION', 'disclosure.liveHead: must be a safe-integer Session Position >= 1');
    const liveHead = envelope.liveHead;
    const tc = sp(envelope.tc, 'disclosure.tc', liveHead);
    const sealed = flag(envelope.sealed, 'disclosure.sealed');
    if (sealed !== tc < liveHead) return reject('INCOHERENT_HEADER', 'disclosure.sealed: sealed means TC < LH');
    const depthRaw = envelope.depth;
    if (!isSemanticDepth(depthRaw)) return reject('INVALID_DEPTH', 'disclosure.depth: must be one of the five frozen rungs');
    const depth: HistoricalSemanticDepth = depthRaw;
    const revisionRaw = shape(envelope.revision, 'disclosure.revision', REVISION_KEYS);
    const revision = {
      liveHead: integer(revisionRaw.liveHead, 'disclosure.revision.liveHead'),
      worldVersion: integer(revisionRaw.worldVersion, 'disclosure.revision.worldVersion'),
      pendingExpiries: integer(revisionRaw.pendingExpiries, 'disclosure.revision.pendingExpiries'),
    };
    if (revision.liveHead !== liveHead) return reject('INCOHERENT_HEADER', 'disclosure.revision.liveHead: a different Live Head than the header');
    const world = decodeWorld(envelope.world, tc);
    const thread = rung(envelope.thread, 'thread', (value) => decodeThreadRung(value, tc));
    const session = rung(envelope.session, 'session', (value) => decodeSessionRung(value, tc));
    const analyticalObject = rung(envelope.analyticalObject, 'analyticalObject', (value) => decodeAnalyticalRung(value, tc));
    const sourceProvenance = rung(envelope.sourceProvenance, 'sourceProvenance', decodeProvenanceRung);
    // Depth is monotonic on the wire too: exactly the rungs at or below `depth` are disclosed.
    const rank = DEPTH_RANK[depth];
    for (const [name, value, own] of [['thread', thread, 1], ['session', session, 2], ['analyticalObject', analyticalObject, 3], ['sourceProvenance', sourceProvenance, 4]] as const) {
      if ((value.status === 'DISCLOSED') !== (rank >= own)) return reject('INVALID_RUNG', `${name}: ${value.status} disagrees with depth ${depth}`);
    }
    const inspection = decodeInspection(envelope.inspection);
    return { ok: true, value: { sessionId, liveHead, tc, sealed, depth, revision, world, thread, session, analyticalObject, sourceProvenance, inspection } };
  } catch (error) {
    if (error instanceof Rejection) return { ok: false, reason: error.reason, detail: error.detail };
    throw error;
  }
}

/** Decodes the typed refusal body `{ code }` of a 400 / 409 answer; anything else is not a typed refusal. */
export function decodeUnavailableBody(raw: unknown): HistoricalWireDecode<HistoricalProjectionUnavailableBody> {
  const issue = exactShapeIssue(raw, 'refusal', ['code']);
  if (issue) return { ok: false, reason: 'MALFORMED_SHAPE', detail: issue };
  const code = (raw as { code: unknown }).code;
  if (typeof code !== 'string' || !(UNAVAILABLE_CODES as readonly string[]).includes(code)) return { ok: false, reason: 'INVALID_VOCABULARY', detail: `refusal.code: ${String(code)}` };
  return { ok: true, value: { code: code as HistoricalProjectionUnavailableBody['code'] } };
}
