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
  DisclosedSessionRung,
  DisclosedSourceProvenanceRung,
  DisclosedThread,
  DisclosedThreadReadingAppearance,
  DisclosedThreadRung,
  HistoricalDisclosure,
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
    statement: `statement of ${fixture.id}`,
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
    inspection: null,
  };
}
