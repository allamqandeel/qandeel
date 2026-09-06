// T-03C - the strict mapping of the database's Layer-A row into `K(TC)`.
//
// A projection row is produced by a SECURITY DEFINER function the caller
// cannot influence, but it still crosses a transport: every field is checked
// against its exact shape and its coherence with the header before it can
// become knowledge. A missing family, an unknown key, an SP beyond TC, a
// relation whose endpoint is not a known Reading, a Moment gap - each is a
// transport / integrity failure that fails closed. Nothing here is inferred,
// defaulted, repaired or ranked.

import type {
  ConfidenceResolutionAtTc,
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
  DisclosedSubjectGrounding,
  DisclosedThread,
  DisclosedThreadReadingAppearance,
  HistoricalExpiryMapping,
  LiveFocusWireValue,
  ReadingLineageStepKind,
  ThreadStateAtTc,
} from '@qandeel/runtime';
import { HistoricalProjectionIntegrityError, type HistoricalKnowledge } from './historical-projection.types';

type Row = Record<string, unknown>;

const fail = (detail: string): never => { throw new HistoricalProjectionIntegrityError('HISTORICAL_PROJECTION_ROW_MALFORMED', detail); };
const incoherent = (detail: string): never => { throw new HistoricalProjectionIntegrityError('HISTORICAL_PROJECTION_INCOHERENT', detail); };

function isRecord(value: unknown): value is Row {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function record(value: unknown, path: string, keys: readonly string[]): Row {
  if (!isRecord(value)) return fail(`${path}: must be an object`);
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(value, key)) return fail(`${path}: missing ${key}`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) return fail(`${path}: unknown key ${key}`);
  return value;
}
function list(value: unknown, path: string): readonly unknown[] {
  return Array.isArray(value) ? value : fail(`${path}: must be an array`);
}
function text(value: unknown, path: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fail(`${path}: must be a non-empty string`);
}
function textOrNull(value: unknown, path: string): string | null {
  return value === null ? null : text(value, path);
}
function integer(value: unknown, path: string): number {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : fail(`${path}: must be a safe integer`);
}
function integerOrNull(value: unknown, path: string): number | null {
  return value === null ? null : integer(value, path);
}
function sessionPosition(value: unknown, path: string): number {
  const sp = integer(value, path);
  return sp >= 1 ? sp : fail(`${path}: a Session Position is >= 1`);
}
function sessionPositionOrNull(value: unknown, path: string): number | null {
  return value === null ? null : sessionPosition(value, path);
}
function boolean(value: unknown, path: string): boolean {
  return typeof value === 'boolean' ? value : fail(`${path}: must be a boolean`);
}
function finiteOrNull(value: unknown, path: string): number | null {
  if (value === null) return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : fail(`${path}: must be a finite number`);
}
function texts(value: unknown, path: string): readonly string[] {
  return list(value, path).map((entry, index) => text(entry, `${path}[${index}]`));
}
function oneOf<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fail(`${path}: must be one of ${allowed.join(', ')}`);
}
/** Exact integer text: a Home coordinate never passes through a float. */
function integerText(value: unknown, path: string): string {
  return typeof value === 'string' && /^-?[0-9]{1,20}$/u.test(value) ? value : fail(`${path}: must be exact integer text`);
}

const MOMENT_KEYS = ['id', 'sp', 'sourceRole', 'sourceTurnId', 'ordinalWithinTurn', 'committedText', 'spanStart', 'spanEnd'] as const;
const FOCUS_KEYS = ['id', 'startedSp', 'lastAttentionSp', 'promotedThreadId'] as const;
const LIVE_FOCUS_KEYS = ['kind', 'ref', 'atSp', 'reasonCode'] as const;
const THREAD_KEYS = ['id', 'establishmentPath', 'establishedInSession', 'establishedSp', 'groundingEmergingFocusId', 'home', 'sessionLifecycle'] as const;
const THREAD_APPEARANCE_KEYS = ['bindingId', 'threadId', 'hypothesisId', 'boundSp', 'current'] as const;
const READING_KEYS = ['id', 'statement', 'type', 'domain', 'scope', 'origin', 'assumptions', 'disconfirmingConditions', 'statusAtTc', 'versionAtTc', 'lineage', 'subjectGroundings'] as const;
const LINEAGE_KEYS = ['kind', 'fromStatus', 'toStatus', 'fromVersion', 'toVersion'] as const;
const SUBJECT_GROUNDING_KEYS = ['emergingFocusId', 'groundedAtSp'] as const;
const RELATION_KEYS = ['a', 'b'] as const;
const PARTICIPATION_KEYS = ['hypothesisId', 'evidenceId', 'memoryId', 'role'] as const;
const MATERIAL_KEYS = ['id', 'type', 'content', 'source', 'confidence', 'importance', 'version', 'supersedesMemoryId', 'supersededByMemoryId', 'statusAtTc', 'expiry'] as const;
const EXPIRY_KEYS = ['mapping', 'sp'] as const;
const GAP_KEYS = ['id', 'informationNeeded', 'whyItMatters', 'userAnswerability', 'preferredQuestionType', 'readingIds', 'statusAtTc', 'openEpochAtTc', 'closureReasonAtTc'] as const;
const QUESTION_KEYS = ['id', 'informationGapId', 'questionText', 'questionType', 'answerFormat', 'informationNeeded', 'targetReadingIds'] as const;
const QUESTION_APPEARANCE_KEYS = ['bindingId', 'informationGapId', 'gapOpenEpoch', 'hypothesisId', 'hypothesisVersion', 'questionType', 'sourceTurnId', 'assistantTurnId', 'appearedAtSp'] as const;
const CONFIDENCE_KEYS = ['id', 'targetReadingId', 'targetVersion', 'missingInformationCodes', 'supportingEvidenceIds', 'contradictingEvidenceIds', 'assumptions', 'alternativeReadingIds', 'resolution'] as const;
const REVISION_KEYS = ['liveHead', 'sameSpEventSequence', 'worldVersion', 'pendingExpiries'] as const;
const ROW_KEYS = ['session_id', 'live_head', 'tc', 'sealed', 'revision', 'moments', 'emerging_focuses', 'live_focus', 'threads', 'thread_reading_appearances', 'readings',
  'reading_relations', 'evidence_participations', 'materials', 'gaps', 'questions', 'question_appearances', 'confidences'] as const;
const LINEAGE_KINDS: readonly ReadingLineageStepKind[] = ['LEGACY_BASELINE', 'CREATED', 'STATUS_TRANSITION', 'VERSION_ADVANCED'];
const EXPIRY_MAPPINGS: readonly HistoricalExpiryMapping[] = ['NO_EXPIRY', 'PRE_FIRST_SP', 'SP', 'PENDING', 'NOT_IN_SESSION'];
const RESOLUTIONS: readonly ConfidenceResolutionAtTc[] = ['CURRENT', 'SUPERSEDED', 'PREVALID'];

function mapLiveFocus(raw: unknown, tc: number): DisclosedLiveFocusAtTc {
  const row = record(raw, 'live_focus', LIVE_FOCUS_KEYS);
  const kind = oneOf(row.kind, 'live_focus.kind', ['NONE', 'EMERGING', 'THREAD'] as const);
  const ref = textOrNull(row.ref, 'live_focus.ref');
  const atSp = sessionPositionOrNull(row.atSp, 'live_focus.atSp');
  if ((kind === 'NONE') !== (ref === null)) return incoherent('live_focus: NONE carries no reference, EMERGING / THREAD always do');
  if (kind !== 'NONE' && atSp === null) return incoherent('live_focus: a non-NONE Live Focus became effective at a Session Position');
  if (atSp !== null && atSp > tc) return incoherent('live_focus: effective beyond TC');
  const value: LiveFocusWireValue = kind === 'NONE' ? { kind } : kind === 'EMERGING' ? { kind, emergingFocusId: ref as string } : { kind, threadId: ref as string };
  return { value, atSp };
}

function mapThreadState(raw: unknown): ThreadStateAtTc {
  if (raw === null) return 'ESTABLISHED_UNBOUND_IN_SESSION';
  switch (oneOf(raw, 'threads[].sessionLifecycle', ['ACTIVE', 'DORMANT', 'REOPENED'] as const)) {
    case 'ACTIVE': return 'ESTABLISHED_ACTIVE';
    case 'DORMANT': return 'ESTABLISHED_DORMANT';
    default: return 'ESTABLISHED_REOPENED';
  }
}

function mapThread(raw: unknown, index: number, tc: number): DisclosedThread {
  const path = `threads[${index}]`;
  const row = record(raw, path, THREAD_KEYS);
  const home = record(row.home, `${path}.home`, ['x', 'y']);
  const establishedInSession = boolean(row.establishedInSession, `${path}.establishedInSession`);
  const establishedSp = sessionPositionOrNull(row.establishedSp, `${path}.establishedSp`);
  if (establishedInSession !== (establishedSp !== null)) return incoherent(`${path}: an establishing Session Position exists exactly for a Thread established in this Session`);
  if (establishedSp !== null && establishedSp > tc) return incoherent(`${path}: established beyond TC`);
  return {
    id: text(row.id, `${path}.id`),
    establishmentPath: text(row.establishmentPath, `${path}.establishmentPath`),
    establishedInSession,
    establishedSp,
    groundingEmergingFocusId: textOrNull(row.groundingEmergingFocusId, `${path}.groundingEmergingFocusId`),
    home: { x: integerText(home.x, `${path}.home.x`), y: integerText(home.y, `${path}.home.y`) },
    state: mapThreadState(row.sessionLifecycle),
  };
}

function mapReading(raw: unknown, index: number, tc: number, emergingFocusIds: ReadonlySet<string>): DisclosedReading {
  const path = `readings[${index}]`;
  const row = record(raw, path, READING_KEYS);
  // T-03C R2: the canonical subject groundings known at TC - each anchored at
  // its own Session Position and naming an Emerging Focus this Session knows
  // at TC. Never inferred here from statement, scope, Evidence or appearance.
  const subjectGroundings: DisclosedSubjectGrounding[] = list(row.subjectGroundings, `${path}.subjectGroundings`).map((entry, groundingIndex) => {
    const groundingPath = `${path}.subjectGroundings[${groundingIndex}]`;
    const grounding = record(entry, groundingPath, SUBJECT_GROUNDING_KEYS);
    const groundedAtSp = sessionPosition(grounding.groundedAtSp, `${groundingPath}.groundedAtSp`);
    const emergingFocusId = text(grounding.emergingFocusId, `${groundingPath}.emergingFocusId`);
    if (groundedAtSp > tc) return incoherent(`${groundingPath}: grounded beyond TC`);
    if (!emergingFocusIds.has(emergingFocusId)) return incoherent(`${groundingPath}: an Emerging Focus that is not known at TC`);
    return { emergingFocusId, groundedAtSp };
  });
  if (new Set(subjectGroundings.map((grounding) => grounding.emergingFocusId)).size !== subjectGroundings.length) return incoherent(`${path}: a subject grounding appears twice`);
  const lineage: DisclosedReadingLineageStep[] = list(row.lineage, `${path}.lineage`).map((step, stepIndex) => {
    const stepPath = `${path}.lineage[${stepIndex}]`;
    const entry = record(step, stepPath, LINEAGE_KEYS);
    return {
      kind: oneOf(entry.kind, `${stepPath}.kind`, LINEAGE_KINDS),
      fromStatus: textOrNull(entry.fromStatus, `${stepPath}.fromStatus`),
      toStatus: text(entry.toStatus, `${stepPath}.toStatus`),
      fromVersion: integerOrNull(entry.fromVersion, `${stepPath}.fromVersion`),
      toVersion: integer(entry.toVersion, `${stepPath}.toVersion`),
    };
  });
  if (lineage.length === 0) return incoherent(`${path}: a known Reading carries its creation step`);
  const versionAtTc = integer(row.versionAtTc, `${path}.versionAtTc`);
  if (versionAtTc < 1 || lineage.some((step) => step.toVersion > versionAtTc)) return incoherent(`${path}: lineage beyond the then-current version`);
  return {
    id: text(row.id, `${path}.id`),
    statement: text(row.statement, `${path}.statement`),
    type: text(row.type, `${path}.type`),
    domain: text(row.domain, `${path}.domain`),
    scope: text(row.scope, `${path}.scope`),
    origin: text(row.origin, `${path}.origin`),
    assumptions: texts(row.assumptions, `${path}.assumptions`),
    disconfirmingConditions: texts(row.disconfirmingConditions, `${path}.disconfirmingConditions`),
    statusAtTc: text(row.statusAtTc, `${path}.statusAtTc`),
    versionAtTc,
    lineage,
    subjectGroundings,
  };
}

function mapMaterial(raw: unknown, index: number, tc: number): DisclosedMaterial {
  const path = `materials[${index}]`;
  const row = record(raw, path, MATERIAL_KEYS);
  const expiry = record(row.expiry, `${path}.expiry`, EXPIRY_KEYS);
  const mapping = oneOf(expiry.mapping, `${path}.expiry.mapping`, EXPIRY_MAPPINGS);
  const sp = sessionPositionOrNull(expiry.sp, `${path}.expiry.sp`);
  if ((mapping === 'SP') !== (sp !== null)) return incoherent(`${path}.expiry: exactly the SP mapping carries a Session Position`);
  const statusAtTc = text(row.statusAtTc, `${path}.statusAtTc`);
  if (mapping === 'SP' && sp !== null && sp <= tc && statusAtTc === 'ACTIVE') return incoherent(`${path}: expired inside a Session Position <= TC yet ACTIVE`);
  return {
    id: text(row.id, `${path}.id`),
    type: text(row.type, `${path}.type`),
    content: text(row.content, `${path}.content`),
    source: text(row.source, `${path}.source`),
    confidence: finiteOrNull(row.confidence, `${path}.confidence`),
    importance: finiteOrNull(row.importance, `${path}.importance`),
    version: integer(row.version, `${path}.version`),
    supersedesMaterialId: textOrNull(row.supersedesMemoryId, `${path}.supersedesMemoryId`),
    supersededByMaterialId: textOrNull(row.supersededByMemoryId, `${path}.supersededByMemoryId`),
    statusAtTc,
    expiry: { mapping, sp },
  };
}

/** Maps one projection row into `K(TC)`; throws `HistoricalProjectionIntegrityError` on any shape or coherence defect. */
export function mapHistoricalProjectionRow(raw: unknown): HistoricalKnowledge {
  const row = record(raw, 'projection', ROW_KEYS);
  const sessionId = text(row.session_id, 'projection.session_id');
  const liveHead = sessionPosition(row.live_head, 'projection.live_head');
  const tc = sessionPosition(row.tc, 'projection.tc');
  const sealed = boolean(row.sealed, 'projection.sealed');
  if (tc > liveHead) return incoherent('projection: TC beyond the Live Head');
  if (sealed !== tc < liveHead) return incoherent('projection: sealed means TC < LH');
  const revisionRow = record(row.revision, 'projection.revision', REVISION_KEYS);
  const revision = {
    liveHead: sessionPosition(revisionRow.liveHead, 'projection.revision.liveHead'),
    worldVersion: integer(revisionRow.worldVersion, 'projection.revision.worldVersion'),
    pendingExpiries: integer(revisionRow.pendingExpiries, 'projection.revision.pendingExpiries'),
  };
  if (revision.liveHead !== liveHead) return incoherent('projection.revision: a different Live Head than the header');

  const moments: DisclosedMoment[] = list(row.moments, 'moments').map((entry, index) => {
    const path = `moments[${index}]`;
    const moment = record(entry, path, MOMENT_KEYS);
    const spanStart = integer(moment.spanStart, `${path}.spanStart`);
    const spanEnd = integer(moment.spanEnd, `${path}.spanEnd`);
    if (spanStart < 0 || spanEnd <= spanStart) return incoherent(`${path}: an empty or negative span`);
    return {
      id: text(moment.id, `${path}.id`),
      sp: sessionPosition(moment.sp, `${path}.sp`),
      sourceRole: oneOf(moment.sourceRole, `${path}.sourceRole`, ['USER', 'ASSISTANT'] as const),
      sourceTurnId: text(moment.sourceTurnId, `${path}.sourceTurnId`),
      ordinalWithinTurn: integer(moment.ordinalWithinTurn, `${path}.ordinalWithinTurn`),
      committedText: text(moment.committedText, `${path}.committedText`),
      spanStart,
      spanEnd,
    };
  });
  // Every Session Position <= TC is exactly one committed Moment: gapless, in order.
  if (moments.length !== tc || moments.some((moment, index) => moment.sp !== index + 1)) return incoherent('moments: not exactly SP(1) .. SP(TC) in order');

  const emergingFocuses: DisclosedEmergingFocus[] = list(row.emerging_focuses, 'emerging_focuses').map((entry, index) => {
    const path = `emerging_focuses[${index}]`;
    const focus = record(entry, path, FOCUS_KEYS);
    const startedSp = sessionPosition(focus.startedSp, `${path}.startedSp`);
    const lastAttentionSp = sessionPositionOrNull(focus.lastAttentionSp, `${path}.lastAttentionSp`);
    if (startedSp > tc || (lastAttentionSp !== null && (lastAttentionSp > tc || lastAttentionSp < startedSp))) return incoherent(`${path}: attention outside [startedSp, TC]`);
    return { id: text(focus.id, `${path}.id`), startedSp, lastAttentionSp, promotedThreadId: textOrNull(focus.promotedThreadId, `${path}.promotedThreadId`), state: 'EMERGING_PREGEOGRAPHIC' };
  });

  const liveFocus = mapLiveFocus(row.live_focus, tc);
  const threads = list(row.threads, 'threads').map((entry, index) => mapThread(entry, index, tc));
  const threadIds = new Set(threads.map((thread) => thread.id));
  if (threadIds.size !== threads.length) return incoherent('threads: a Thread appears twice');
  for (const focus of emergingFocuses) {
    if (focus.promotedThreadId !== null && !threadIds.has(focus.promotedThreadId)) return incoherent('emerging_focuses: promoted to a Thread that is not known at TC');
  }
  if (liveFocus.value.kind === 'THREAD' && !threadIds.has(liveFocus.value.threadId)) return incoherent('live_focus: a Thread that is not known at TC');
  if (liveFocus.value.kind === 'EMERGING' && !emergingFocuses.some((focus) => focus.id === (liveFocus.value as { emergingFocusId: string }).emergingFocusId)) {
    return incoherent('live_focus: an Emerging Focus that is not known at TC');
  }

  const emergingFocusIds = new Set(emergingFocuses.map((focus) => focus.id));
  const readings = list(row.readings, 'readings').map((entry, index) => mapReading(entry, index, tc, emergingFocusIds));
  const readingIds = new Set(readings.map((reading) => reading.id));
  if (readingIds.size !== readings.length) return incoherent('readings: a Reading appears twice');
  const versionOf = new Map(readings.map((reading) => [reading.id, reading.versionAtTc]));

  const threadReadingAppearances: DisclosedThreadReadingAppearance[] = list(row.thread_reading_appearances, 'thread_reading_appearances').map((entry, index) => {
    const path = `thread_reading_appearances[${index}]`;
    const appearance = record(entry, path, THREAD_APPEARANCE_KEYS);
    const boundSp = sessionPosition(appearance.boundSp, `${path}.boundSp`);
    const threadId = text(appearance.threadId, `${path}.threadId`);
    const readingId = text(appearance.hypothesisId, `${path}.hypothesisId`);
    if (boundSp > tc) return incoherent(`${path}: bound beyond TC`);
    if (!threadIds.has(threadId) || !readingIds.has(readingId)) return incoherent(`${path}: an endpoint that is not known at TC`);
    return { bindingId: text(appearance.bindingId, `${path}.bindingId`), threadId, readingId, boundSp, current: boolean(appearance.current, `${path}.current`) };
  });

  const readingRelations: DisclosedReadingRelation[] = list(row.reading_relations, 'reading_relations').map((entry, index) => {
    const path = `reading_relations[${index}]`;
    const relation = record(entry, path, RELATION_KEYS);
    const a = text(relation.a, `${path}.a`);
    const b = text(relation.b, `${path}.b`);
    if (!(a < b) || !readingIds.has(a) || !readingIds.has(b)) return incoherent(`${path}: an unordered pair or an endpoint that is not known at TC`);
    return { a, b };
  });

  const materials = list(row.materials, 'materials').map((entry, index) => mapMaterial(entry, index, tc));
  const materialIds = new Set(materials.map((material) => material.id));
  if (materialIds.size !== materials.length) return incoherent('materials: a Material appears twice');
  for (const material of materials) {
    if (material.supersedesMaterialId !== null && !materialIds.has(material.supersedesMaterialId)) return incoherent('materials: lineage to a predecessor that is not known at TC');
    if (material.supersededByMaterialId !== null && !materialIds.has(material.supersededByMaterialId)) return incoherent('materials: lineage to a successor that is not known at TC');
  }

  const evidenceParticipations: DisclosedEvidenceParticipation[] = list(row.evidence_participations, 'evidence_participations').map((entry, index) => {
    const path = `evidence_participations[${index}]`;
    const participation = record(entry, path, PARTICIPATION_KEYS);
    const readingId = text(participation.hypothesisId, `${path}.hypothesisId`);
    const materialId = text(participation.memoryId, `${path}.memoryId`);
    const evidenceId = text(participation.evidenceId, `${path}.evidenceId`);
    if (evidenceId !== `memory:${materialId}`) return incoherent(`${path}: the evidence identity names another Material`);
    if (!readingIds.has(readingId) || !materialIds.has(materialId)) return incoherent(`${path}: an endpoint that is not known at TC`);
    return { readingId, materialId, evidenceId, role: oneOf(participation.role, `${path}.role`, ['SUPPORTING', 'CONTRADICTING'] as const) };
  });

  const gaps: DisclosedGap[] = list(row.gaps, 'gaps').map((entry, index) => {
    const path = `gaps[${index}]`;
    const gap = record(entry, path, GAP_KEYS);
    const readingIdsOfGap = texts(gap.readingIds, `${path}.readingIds`);
    if (readingIdsOfGap.some((id) => !readingIds.has(id))) return incoherent(`${path}: a related Reading that is not known at TC`);
    return {
      id: text(gap.id, `${path}.id`),
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
  if (gapIds.size !== gaps.length) return incoherent('gaps: a Gap appears twice');

  const questions: DisclosedQuestion[] = list(row.questions, 'questions').map((entry, index) => {
    const path = `questions[${index}]`;
    const question = record(entry, path, QUESTION_KEYS);
    const gapId = text(question.informationGapId, `${path}.informationGapId`);
    const targetReadingIds = texts(question.targetReadingIds, `${path}.targetReadingIds`);
    if (!gapIds.has(gapId) || targetReadingIds.some((id) => !readingIds.has(id))) return incoherent(`${path}: a Gap or Reading that is not known at TC`);
    return {
      id: text(question.id, `${path}.id`),
      gapId,
      questionText: text(question.questionText, `${path}.questionText`),
      questionType: text(question.questionType, `${path}.questionType`),
      answerFormat: text(question.answerFormat, `${path}.answerFormat`),
      informationNeeded: text(question.informationNeeded, `${path}.informationNeeded`),
      targetReadingIds,
    };
  });

  const questionAppearances: DisclosedQuestionAppearance[] = list(row.question_appearances, 'question_appearances').map((entry, index) => {
    const path = `question_appearances[${index}]`;
    const appearance = record(entry, path, QUESTION_APPEARANCE_KEYS);
    const gapId = text(appearance.informationGapId, `${path}.informationGapId`);
    const readingId = text(appearance.hypothesisId, `${path}.hypothesisId`);
    const appearedAtSp = sessionPosition(appearance.appearedAtSp, `${path}.appearedAtSp`);
    if (appearedAtSp > tc) return incoherent(`${path}: appeared beyond TC`);
    if (!gapIds.has(gapId) || !readingIds.has(readingId)) return incoherent(`${path}: a Gap or Reading that is not known at TC`);
    return {
      bindingId: text(appearance.bindingId, `${path}.bindingId`),
      gapId,
      gapOpenEpoch: integer(appearance.gapOpenEpoch, `${path}.gapOpenEpoch`),
      readingId,
      readingVersion: integer(appearance.hypothesisVersion, `${path}.hypothesisVersion`),
      questionType: text(appearance.questionType, `${path}.questionType`),
      sourceTurnId: text(appearance.sourceTurnId, `${path}.sourceTurnId`),
      assistantTurnId: textOrNull(appearance.assistantTurnId, `${path}.assistantTurnId`),
      appearedAtSp,
    };
  });

  const confidences: DisclosedConfidence[] = list(row.confidences, 'confidences').map((entry, index) => {
    const path = `confidences[${index}]`;
    const confidence = record(entry, path, CONFIDENCE_KEYS);
    const readingId = text(confidence.targetReadingId, `${path}.targetReadingId`);
    const targetVersion = integer(confidence.targetVersion, `${path}.targetVersion`);
    const resolution = oneOf(confidence.resolution, `${path}.resolution`, RESOLUTIONS);
    const versionAtTc = versionOf.get(readingId);
    if (versionAtTc === undefined) return incoherent(`${path}: a Reading that is not known at TC`);
    // Z66-04, re-derived: PREVALID iff the target version is beyond the then-current version; CURRENT never below it.
    if (resolution === 'PREVALID' && targetVersion <= versionAtTc) return incoherent(`${path}: PREVALID for a version already known at TC`);
    if (resolution !== 'PREVALID' && targetVersion > versionAtTc) return incoherent(`${path}: a version beyond TC that is not PREVALID`);
    if (resolution === 'CURRENT' && targetVersion !== versionAtTc) return incoherent(`${path}: CURRENT for a version other than the then-current one`);
    const alternativeReadingIds = texts(confidence.alternativeReadingIds, `${path}.alternativeReadingIds`);
    if (alternativeReadingIds.some((id) => !readingIds.has(id))) return incoherent(`${path}: an alternative Reading that is not known at TC`);
    return {
      id: text(confidence.id, `${path}.id`),
      readingId,
      targetVersion,
      resolution,
      missingInformationCodes: texts(confidence.missingInformationCodes, `${path}.missingInformationCodes`),
      supportingEvidenceIds: texts(confidence.supportingEvidenceIds, `${path}.supportingEvidenceIds`),
      contradictingEvidenceIds: texts(confidence.contradictingEvidenceIds, `${path}.contradictingEvidenceIds`),
      assumptions: texts(confidence.assumptions, `${path}.assumptions`),
      alternativeReadingIds,
    };
  });

  return {
    sessionId, liveHead, tc, sealed, revision, moments, emergingFocuses, liveFocus, threads, threadReadingAppearances,
    readings, readingRelations, evidenceParticipations, materials, gaps, questions, questionAppearances, confidences,
  };
}
