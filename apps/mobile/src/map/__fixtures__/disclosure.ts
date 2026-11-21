/**
 * T-04 — disclosure fixtures for the Map tests.
 *
 * These build a wire-legal `HistoricalDisclosure`: exactly the rungs the requested depth
 * discloses, `sealed === tc < liveHead`, and exactly the Moments `SP(1) .. SP(TC)` when the
 * Session rung is disclosed. One test decodes a fixture through the real T-03C wire validator, so
 * a fixture that drifted away from the frozen contract would fail rather than quietly prove
 * something about a shape the server can never send.
 */
import type {
  DisclosedAnalyticalObjectRung,
  DisclosedEmergingFocus,
  DisclosedMoment,
  DisclosedReading,
  DisclosedReadingEvidenceChange,
  DisclosedSessionRung,
  DisclosedSourceProvenanceRung,
  DisclosedThread,
  DisclosedThreadReadingAppearance,
  DisclosedThreadRung,
  HistoricalDisclosure,
  HistoricalFamily,
  HistoricalInspectionRequest,
  HistoricalInspectionResolution,
  HistoricalRung,
  HistoricalSemanticDepth,
  ThreadStateAtTc,
} from '@qandeel/runtime';

export interface ThreadFixture {
  readonly id: string;
  readonly x: string;
  readonly y: string;
  readonly state?: ThreadStateAtTc;
  readonly establishedSp?: number | null;
  /** COSMOS E-2 Slice A: the served name (absent or null = NONE) and its source (default GROUNDING_WORDING). */
  readonly name?: string | null;
  readonly nameSource?: 'USER_ALIAS' | 'GROUNDING_WORDING';
  /** Where the Thread was established; defaults to this Session at the establishing SP (else SP 1). */
  readonly origin?: { readonly sessionId: string; readonly sp: number };
}

export interface AppearanceFixture {
  readonly bindingId: string;
  readonly threadId: string;
  readonly readingId: string;
  readonly boundSp: number;
  readonly current?: boolean;
}

export interface FocusFixture {
  readonly id: string;
  readonly startedSp: number;
  readonly promotedThreadId?: string | null;
}

export interface ReadingFixture {
  readonly id: string;
  readonly versionAtTc?: number;
  /** COSMOS E-2 (0200): the served reliance; a withheld Reading carries no words of its own (as the server sends it). */
  readonly evidenceChange?: DisclosedReadingEvidenceChange;
}

export interface MaterialFixture {
  readonly id: string;
  readonly version?: number;
}

export interface DisclosureFixture {
  readonly depth: HistoricalSemanticDepth;
  readonly sessionId?: string;
  readonly tc?: number;
  readonly liveHead?: number;
  readonly threads?: readonly ThreadFixture[];
  readonly appearances?: readonly AppearanceFixture[];
  readonly focuses?: readonly FocusFixture[];
  readonly readings?: readonly ReadingFixture[];
  readonly materials?: readonly MaterialFixture[];
  /**
   * COSMOS-FINAL-01 F-1: the inspection the request carried. Answered over this fixture's world exactly as the server's
   * `resolveInspection` answers it (apps/api/src/historical-projection/historical-disclosure.ts); absent, `inspection: null`.
   */
  readonly inspection?: HistoricalInspectionRequest;
}

/** The server's FAMILY_DEPTH (Reading is an analytical object, never a depth of its own). */
const FAMILY_DEPTH: Readonly<Record<HistoricalFamily, HistoricalSemanticDepth>> = {
  THREAD: 'WORLD', EMERGING_FOCUS: 'SESSION', MOMENT: 'SESSION', READING: 'ANALYTICAL_OBJECT', MATERIAL: 'ANALYTICAL_OBJECT',
  GAP: 'ANALYTICAL_OBJECT', QUESTION: 'ANALYTICAL_OBJECT', CONFIDENCE: 'ANALYTICAL_OBJECT',
};

/** The server's `resolveInspection`, over a fixture world: knowledge, context and disclosure, three orthogonal answers. */
export function fixtureInspectionResolution(fixture: DisclosureFixture, request: HistoricalInspectionRequest): HistoricalInspectionResolution {
  const tc = fixture.tc ?? 4;
  const id = request.id;
  const known = ((): { readonly known: boolean; readonly version: number | null } => {
    switch (request.family) {
      case 'THREAD': return { known: (fixture.threads ?? []).some((each) => each.id === id), version: null };
      case 'EMERGING_FOCUS': return { known: (fixture.focuses ?? []).some((each) => each.id === id), version: null };
      case 'MOMENT': return { known: moments(tc).some((each) => each.id === id), version: null };
      case 'READING': {
        const found = (fixture.readings ?? []).find((each) => each.id === id);
        return { known: found !== undefined, version: found === undefined ? null : found.versionAtTc ?? 1 };
      }
      case 'MATERIAL': {
        const found = (fixture.materials ?? []).find((each) => each.id === id);
        return { known: found !== undefined, version: found === undefined ? null : found.version ?? 1 };
      }
      default: return { known: false, version: null };
    }
  })();
  if (!known.known) return { knowledge: 'UNKNOWN_AT_TC' };
  const noncurrent = request.version !== undefined && known.version !== null && request.version !== known.version
    ? (request.version > known.version ? 'PREVALID' as const : 'SUPERSEDED' as const) : null;
  const appearance = request.appearance === undefined ? null : request.appearance.kind === 'THREAD_READING'
    ? {
      available: (fixture.appearances ?? []).some((each) => each.bindingId === request.appearance?.bindingId
        && (request.family === 'THREAD' ? each.threadId === id : request.family === 'READING' ? each.readingId === id : false)),
      depth: 'THREAD' as HistoricalSemanticDepth,
    }
    : { available: false, depth: 'SESSION' as HistoricalSemanticDepth };
  const own = FAMILY_DEPTH[request.family];
  const requiredDepth = appearance !== null && DEPTH_RANK[appearance.depth] > DEPTH_RANK[own] ? appearance.depth : own;
  return {
    knowledge: noncurrent === null ? 'KNOWN_AND_CURRENT_AT_TC' : 'KNOWN_NONCURRENT_AT_TC',
    noncurrent,
    context: appearance === null ? 'NOT_REQUESTED' : appearance.available ? 'CONTEXT_AVAILABLE_AT_TC' : 'CONTEXT_UNAVAILABLE_AT_TC',
    disclosure: DEPTH_RANK[fixture.depth] >= DEPTH_RANK[requiredDepth] ? 'AVAILABLE_AND_RENDERABLE' : 'AVAILABLE_BUT_DEPTH_WITHHELD',
    requiredDepth,
  };
}

const DEPTH_RANK: Readonly<Record<HistoricalSemanticDepth, number>> = {
  WORLD: 0,
  THREAD: 1,
  SESSION: 2,
  ANALYTICAL_OBJECT: 3,
  SOURCE_PROVENANCE: 4,
};

const withheld = <T,>(): HistoricalRung<T> => ({ status: 'DEPTH_WITHHELD' });
const disclosed = <T,>(value: T): HistoricalRung<T> => ({ status: 'DISCLOSED', value });

function moments(tc: number): readonly DisclosedMoment[] {
  return Array.from({ length: tc }, (_unused, index): DisclosedMoment => {
    const sp = index + 1;
    return {
      id: `moment-${sp}`,
      sp,
      sourceRole: sp % 2 === 1 ? 'USER' : 'ASSISTANT',
      sourceTurnId: `turn-${Math.ceil(sp / 2)}`,
      ordinalWithinTurn: sp % 2 === 1 ? 0 : 1,
      committedText: `committed unit ${sp}`,
      spanStart: 0,
      spanEnd: 8,
    };
  });
}

function reading(fixture: ReadingFixture): DisclosedReading {
  const versionAtTc = fixture.versionAtTc ?? 1;
  return {
    id: fixture.id,
    statement: (fixture.evidenceChange ?? 'NONE') === 'NONE' ? `statement of ${fixture.id}` : null,
    type: 'HYPOTHESIS',
    domain: 'GENERAL',
    scope: 'SESSION',
    origin: 'DERIVED',
    assumptions: [],
    disconfirmingConditions: [],
    statusAtTc: 'ACTIVE',
    versionAtTc,
    lineage: Array.from({ length: versionAtTc }, (_unused, index) =>
      index === 0
        ? { kind: 'CREATED' as const, fromStatus: null, toStatus: 'ACTIVE', fromVersion: null, toVersion: 1 }
        : { kind: 'VERSION_ADVANCED' as const, fromStatus: 'ACTIVE', toStatus: 'ACTIVE', fromVersion: index, toVersion: index + 1 },
    ),
    subjectGroundings: [],
    evidenceChange: fixture.evidenceChange ?? 'NONE',
  };
}

export function disclosureFixture(fixture: DisclosureFixture): HistoricalDisclosure {
  const sessionId = fixture.sessionId ?? 'session-1';
  const tc = fixture.tc ?? 4;
  const liveHead = fixture.liveHead ?? tc;
  const rank = DEPTH_RANK[fixture.depth];

  const threads: readonly DisclosedThread[] = (fixture.threads ?? []).map((thread) => ({
    id: thread.id,
    establishmentPath: 'FIRST_ESTABLISHMENT',
    establishedInSession: thread.establishedSp !== undefined && thread.establishedSp !== null,
    establishedSp: thread.establishedSp ?? null,
    groundingEmergingFocusId: null,
    home: { x: thread.x, y: thread.y },
    state: thread.state ?? 'ESTABLISHED_ACTIVE',
    name: thread.name === undefined || thread.name === null ? { text: null, source: 'NONE' } : { text: thread.name, source: thread.nameSource ?? 'GROUNDING_WORDING' },
    origin: thread.origin ?? { sessionId, sp: thread.establishedSp ?? 1 },
  }));

  const appearances: readonly DisclosedThreadReadingAppearance[] = (fixture.appearances ?? []).map((appearance) => ({
    bindingId: appearance.bindingId,
    threadId: appearance.threadId,
    readingId: appearance.readingId,
    boundSp: appearance.boundSp,
    current: appearance.current ?? true,
  }));

  const focuses: readonly DisclosedEmergingFocus[] = (fixture.focuses ?? []).map((focus) => ({
    id: focus.id,
    startedSp: focus.startedSp,
    lastAttentionSp: focus.startedSp,
    promotedThreadId: focus.promotedThreadId ?? null,
    state: 'EMERGING_PREGEOGRAPHIC',
  }));

  const threadRung: DisclosedThreadRung = { threadReadingAppearances: appearances };
  const sessionRung: DisclosedSessionRung = { moments: moments(tc), emergingFocuses: focuses, questionAppearances: [] };
  const analyticalRung: DisclosedAnalyticalObjectRung = {
    readings: (fixture.readings ?? []).map(reading),
    readingRelations: [],
    materials: (fixture.materials ?? []).map((material) => ({
      id: material.id,
      type: 'NOTE',
      content: `content of ${material.id}`,
      source: 'USER',
      confidence: null,
      importance: null,
      version: material.version ?? 1,
      supersedesMaterialId: null,
      supersededByMaterialId: null,
      statusAtTc: 'ACTIVE',
      expiry: { mapping: 'NO_EXPIRY', sp: null },
    })),
    gaps: [],
    questions: [],
    confidences: [],
  };
  const provenanceRung: DisclosedSourceProvenanceRung = { evidenceParticipations: [] };

  return {
    sessionId,
    liveHead,
    tc,
    sealed: tc < liveHead,
    depth: fixture.depth,
    revision: { liveHead, worldVersion: 1, pendingExpiries: 0 },
    world: { threads, liveFocus: { value: { kind: 'NONE' }, atSp: null } },
    thread: rank >= 1 ? disclosed(threadRung) : withheld<DisclosedThreadRung>(),
    session: rank >= 2 ? disclosed(sessionRung) : withheld<DisclosedSessionRung>(),
    analyticalObject: rank >= 3 ? disclosed(analyticalRung) : withheld<DisclosedAnalyticalObjectRung>(),
    sourceProvenance: rank >= 4 ? disclosed(provenanceRung) : withheld<DisclosedSourceProvenanceRung>(),
    inspection: fixture.inspection === undefined ? null : fixtureInspectionResolution(fixture, fixture.inspection),
  };
}

/**
 * COSMOS-FINAL-01 F-1: the inspection a projection request's query carries, read exactly as the server's controller
 * reads it (inspectFamily, inspectId, inspectVersion, appearanceKind + appearanceBindingId together); none, undefined.
 */
export function inspectionFromQuery(get: (name: string) => string | null): HistoricalInspectionRequest | undefined {
  const family = get('inspectFamily');
  const id = get('inspectId');
  if (family === null || id === null) return undefined;
  const version = get('inspectVersion');
  const kind = get('appearanceKind');
  const bindingId = get('appearanceBindingId');
  return {
    family: family as HistoricalFamily,
    id,
    ...(version === null ? {} : { version: Number(version) }),
    ...(kind === null || bindingId === null ? {} : { appearance: { kind: kind as 'THREAD_READING' | 'QUESTION_TURN', bindingId } }),
  };
}
