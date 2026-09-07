/**
 * T-10.0 MOTION LAB — ONE fixture world, shared by all three directions.
 *
 * The world is a scripted Session of twelve committed Moments. Every Thread, appearance, Reading
 * and Emerging Focus has the Session Position at which it legitimately became part of the record,
 * and `disclosureAt(tc, depth)` produces exactly the wire-legal `HistoricalDisclosure` the server
 * would deliver for `(Session, TC, depth)`: only what is known at `TC`, only the rungs the depth
 * discloses, `sealed = tc < liveHead`, and the Live Focus as it stood at `TC`.
 *
 * That is what makes every scenario truthful by construction: the Map derivation, entitlement,
 * locatability and the six return acts all run on the REAL T-03C/T-04/T-06/T-07 code over this
 * disclosure, and an object the record does not yet contain at `TC` is simply absent from the
 * scene — never ghosted, never hinted at, never known to the presentation.
 *
 * Geography is canonical and permanent: a Home is a fixed pair of exact integer coordinates that
 * never moves for any `TC`. Nothing here is a Product fixture, a real Session or a placement-engine
 * output; the addresses are hand-chosen so that a phone viewport shows a handful of Homes at the
 * WORLD rung and one Home with its contextual appearances at the THREAD rung.
 */
import type {
  DisclosedAnalyticalObjectRung,
  DisclosedEmergingFocus,
  DisclosedLiveFocusAtTc,
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
} from '../../projection';
import type { LiveFocus } from '../../state';

export const LAB_SESSION_ID = 'lab-session-motion-north-star';

/** The Session's full scripted length. The harness starts the Live Head earlier and advances it. */
export const LAB_FINAL_LIVE_HEAD = 12;
/**
 * The harness starts at SP 6: live attention is then an Emerging Focus (ungeographic), so the first
 * Go Live + Locate legitimately completes its temporal half with NO camera movement; two advances
 * later live attention is an established Thread and the same act lands.
 */
export const LAB_INITIAL_LIVE_HEAD = 6;

export interface LabThread {
  readonly id: string;
  /** Exact integer coordinate text, as the wire carries a Home. */
  readonly x: string;
  readonly y: string;
  readonly establishedSp: number;
  /** The Emerging Focus this Thread was promoted from, when it was. */
  readonly promotedFromFocusId: string | null;
}

export interface LabAppearance {
  readonly bindingId: string;
  readonly threadId: string;
  readonly readingId: string;
  readonly boundSp: number;
}

export interface LabFocus {
  readonly id: string;
  readonly startedSp: number;
  readonly promotedThreadId: string | null;
  readonly promotedSp: number | null;
}

export interface LabLooseReading {
  readonly id: string;
  /** First Moment at which the Reading exists with no Thread appearance at all. */
  readonly knownSp: number;
}

export interface LabLiveFocusTransition {
  readonly atSp: number;
  readonly value: LiveFocus;
}

export interface LabWorld {
  readonly sessionId: string;
  readonly finalLiveHead: number;
  readonly threads: readonly LabThread[];
  readonly appearances: readonly LabAppearance[];
  readonly focuses: readonly LabFocus[];
  readonly looseReadings: readonly LabLooseReading[];
  readonly liveFocusTransitions: readonly LabLiveFocusTransition[];
}

/** One Home step is 1 000 000 world units — about 122 points at the default presentation scale. */
export const LAB_WORLD: LabWorld = Object.freeze<LabWorld>({
  sessionId: LAB_SESSION_ID,
  finalLiveHead: LAB_FINAL_LIVE_HEAD,
  threads: [
    { id: 'thread-north', x: '0', y: '1000000', establishedSp: 1, promotedFromFocusId: null },
    { id: 'thread-east', x: '1100000', y: '-200000', establishedSp: 2, promotedFromFocusId: null },
    { id: 'thread-west', x: '-1000000', y: '-700000', establishedSp: 3, promotedFromFocusId: null },
    { id: 'thread-far', x: '2600000', y: '-1400000', establishedSp: 5, promotedFromFocusId: null },
    { id: 'thread-promoted', x: '-900000', y: '1300000', establishedSp: 10, promotedFromFocusId: 'focus-drift' },
  ],
  appearances: [
    { bindingId: 'binding-n1', threadId: 'thread-north', readingId: 'reading-north-1', boundSp: 2 },
    { bindingId: 'binding-e1', threadId: 'thread-east', readingId: 'reading-east-1', boundSp: 3 },
    { bindingId: 'binding-n2', threadId: 'thread-north', readingId: 'reading-north-2', boundSp: 4 },
    { bindingId: 'binding-w1', threadId: 'thread-west', readingId: 'reading-west-1', boundSp: 4 },
    { bindingId: 'binding-e2', threadId: 'thread-east', readingId: 'reading-east-2', boundSp: 6 },
    { bindingId: 'binding-f1', threadId: 'thread-far', readingId: 'reading-far-1', boundSp: 7 },
    // The same Reading appearing in a second Thread: a legitimate multi-locus identity.
    { bindingId: 'binding-e3', threadId: 'thread-east', readingId: 'reading-north-2', boundSp: 8 },
    { bindingId: 'binding-n3', threadId: 'thread-north', readingId: 'reading-north-3', boundSp: 9 },
    { bindingId: 'binding-e4', threadId: 'thread-east', readingId: 'reading-east-3', boundSp: 11 },
    { bindingId: 'binding-p1', threadId: 'thread-promoted', readingId: 'reading-promoted-1', boundSp: 12 },
  ],
  focuses: [{ id: 'focus-drift', startedSp: 6, promotedThreadId: 'thread-promoted', promotedSp: 10 }],
  looseReadings: [{ id: 'reading-loose', knownSp: 7 }],
  liveFocusTransitions: [
    { atSp: 1, value: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-north' } },
    { atSp: 5, value: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-far' } },
    { atSp: 6, value: { kind: 'EMERGING_FOCUS', emergingFocusId: 'focus-drift' } },
    { atSp: 7, value: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-far' } },
    { atSp: 9, value: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-north' } },
    { atSp: 11, value: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-promoted' } },
  ],
});

const DEPTH_RANK: Readonly<Record<HistoricalSemanticDepth, number>> = {
  WORLD: 0,
  THREAD: 1,
  SESSION: 2,
  ANALYTICAL_OBJECT: 3,
  SOURCE_PROVENANCE: 4,
};

const withheld = <T,>(): HistoricalRung<T> => ({ status: 'DEPTH_WITHHELD' });
const disclosed = <T,>(value: T): HistoricalRung<T> => ({ status: 'DISCLOSED', value });

/** The Live Focus as it stood at `tc`: the latest transition at or before it, `NONE` before any. */
export function liveFocusAt(world: LabWorld, tc: number): LabLiveFocusTransition | null {
  let latest: LabLiveFocusTransition | null = null;
  for (const transition of world.liveFocusTransitions) {
    if (transition.atSp <= tc && (latest === null || transition.atSp > latest.atSp)) latest = transition;
  }
  return latest;
}

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

function reading(id: string): DisclosedReading {
  return {
    id,
    statement: `statement of ${id}`,
    type: 'HYPOTHESIS',
    domain: 'GENERAL',
    scope: 'SESSION',
    origin: 'DERIVED',
    assumptions: [],
    disconfirmingConditions: [],
    statusAtTc: 'ACTIVE',
    versionAtTc: 1,
    lineage: [{ kind: 'CREATED', fromStatus: null, toStatus: 'ACTIVE', fromVersion: null, toVersion: 1 }],
    subjectGroundings: [],
  };
}

/** Threads known at `tc`: a Thread exists from the Moment it was established. */
export function threadsAt(world: LabWorld, tc: number): readonly LabThread[] {
  return world.threads.filter((thread) => thread.establishedSp <= tc);
}

/** Appearances bound at or before `tc`, whose host Thread is known at `tc`. */
export function appearancesAt(world: LabWorld, tc: number): readonly LabAppearance[] {
  const known = new Set(threadsAt(world, tc).map((thread) => thread.id));
  return world.appearances.filter((appearance) => appearance.boundSp <= tc && known.has(appearance.threadId));
}

/**
 * The disclosure the server would deliver for `(Session, tc, depth)` with the Live Head at
 * `liveHead`. Strict `K(tc)`: nothing after `tc` is known, whatever the Live Head is.
 */
export function disclosureAt(world: LabWorld, tc: number, depth: HistoricalSemanticDepth, liveHead: number): HistoricalDisclosure {
  if (!Number.isInteger(tc) || tc < 1 || tc > liveHead) throw new RangeError(`disclosureAt: TC ${tc} is not addressable at Live Head ${liveHead}`);
  const rank = DEPTH_RANK[depth];

  const threads: readonly DisclosedThread[] = threadsAt(world, tc).map((thread) => ({
    id: thread.id,
    establishmentPath: thread.promotedFromFocusId === null ? 'FIRST_ESTABLISHMENT' : 'PROMOTION',
    establishedInSession: true,
    establishedSp: thread.establishedSp,
    groundingEmergingFocusId: thread.promotedFromFocusId,
    home: { x: thread.x, y: thread.y },
    state: 'ESTABLISHED_ACTIVE',
  }));

  const appearances: readonly DisclosedThreadReadingAppearance[] = appearancesAt(world, tc).map((appearance) => ({
    bindingId: appearance.bindingId,
    threadId: appearance.threadId,
    readingId: appearance.readingId,
    boundSp: appearance.boundSp,
    current: true,
  }));

  // The promotion is disclosed only once the establishing Moment is itself known at `tc` (the
  // wire's own rule); the focus keeps its single frozen state either way.
  const focuses: readonly DisclosedEmergingFocus[] = world.focuses
    .filter((focus) => focus.startedSp <= tc)
    .map((focus) => {
      const promoted = focus.promotedSp !== null && focus.promotedSp <= tc;
      return {
        id: focus.id,
        startedSp: focus.startedSp,
        lastAttentionSp: focus.startedSp,
        promotedThreadId: promoted ? focus.promotedThreadId : null,
        state: 'EMERGING_PREGEOGRAPHIC',
      };
    });

  const readingIds = new Set<string>();
  for (const appearance of appearances) readingIds.add(appearance.readingId);
  for (const loose of world.looseReadings) if (loose.knownSp <= tc) readingIds.add(loose.id);

  const focus = liveFocusAt(world, tc);
  const liveFocus: DisclosedLiveFocusAtTc = {
    value: focus === null ? { kind: 'NONE' } : liveFocusWire(focus.value),
    atSp: focus === null ? null : focus.atSp,
  };

  const threadRung: DisclosedThreadRung = { threadReadingAppearances: appearances };
  const sessionRung: DisclosedSessionRung = { moments: moments(tc), emergingFocuses: focuses, questionAppearances: [] };
  const analyticalRung: DisclosedAnalyticalObjectRung = {
    readings: [...readingIds].sort().map(reading),
    readingRelations: [],
    materials: [],
    gaps: [],
    questions: [],
    confidences: [],
  };
  const provenanceRung: DisclosedSourceProvenanceRung = { evidenceParticipations: [] };

  return {
    sessionId: world.sessionId,
    liveHead,
    tc,
    sealed: tc < liveHead,
    depth,
    revision: { liveHead, worldVersion: 1, pendingExpiries: 0 },
    world: { threads, liveFocus },
    thread: rank >= 1 ? disclosed(threadRung) : withheld<DisclosedThreadRung>(),
    session: rank >= 2 ? disclosed(sessionRung) : withheld<DisclosedSessionRung>(),
    analyticalObject: rank >= 3 ? disclosed(analyticalRung) : withheld<DisclosedAnalyticalObjectRung>(),
    sourceProvenance: rank >= 4 ? disclosed(provenanceRung) : withheld<DisclosedSourceProvenanceRung>(),
    inspection: null,
  };
}

/** The kernel's Live Focus vocabulary, as the disclosure wire spells it. */
function liveFocusWire(value: LiveFocus): DisclosedLiveFocusAtTc['value'] {
  switch (value.kind) {
    case 'EMERGING_FOCUS':
      return { kind: 'EMERGING', emergingFocusId: value.emergingFocusId };
    case 'ESTABLISHED_THREAD':
      return { kind: 'THREAD', threadId: value.threadId };
    default:
      return { kind: 'NONE' };
  }
}

/** The identities that FIRST become known exactly at `sp`: what a live advance to `sp` legitimately adds. */
export function newlyKnownAt(world: LabWorld, sp: number): { readonly threadIds: readonly string[]; readonly bindingIds: readonly string[] } {
  return {
    threadIds: world.threads.filter((thread) => thread.establishedSp === sp).map((thread) => thread.id),
    bindingIds: world.appearances.filter((appearance) => appearance.boundSp === sp).map((appearance) => appearance.bindingId),
  };
}
