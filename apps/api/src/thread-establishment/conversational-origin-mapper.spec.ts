import type { CanonicalCuFocusSemanticPayload, CanonicalReferenceResolution } from '../conversational-focus/durable-focus-payload.types';
import { ConversationThreadIntegrityError } from './conversation-thread-runtime.types';
import {
  CONVERSATIONAL_ORIGIN_MAPPER_VERSION,
  deriveConversationalOrigin,
  type ConversationalOriginContext,
  type OriginEstablishedThread,
} from './conversational-origin-mapper';

const CU_P1 = '11111111-1111-4111-8111-111111111111';
const CU_P2 = '22222222-2222-4222-8222-222222222222';
const CU_X = '33333333-3333-4333-8333-333333333333';
const CU_LATER = '44444444-4444-4444-8444-444444444444';
const H_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const H_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const H_UNBOUND = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const F_A = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
const F_B = 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';
const F_X = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0';
const T_A = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a';
const T_B = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b';

const NO_FOCUS = { kind: 'NO_INDEPENDENT_FOCUS', reason: 'INCIDENTAL_OR_SUBORDINATE', emerging_focus_id: null, creates_focus: false, grounding_reference_index: null } as const;
const attend = (focusId: string) => ({ kind: 'ATTEND_EXISTING_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: focusId, creates_focus: false, grounding_reference_index: null } as const);

function bundle(unitId: string, overrides: Partial<CanonicalCuFocusSemanticPayload> = {}): CanonicalCuFocusSemanticPayload {
  return {
    unit_id: unitId,
    functions: ['INFORM_REPORT'],
    sequence_position: 'UNMARKED',
    target_cu_id: null,
    references: [],
    claim_attributions: [],
    attention: NO_FOCUS,
    ...overrides,
  };
}
function reference(
  index: number,
  state: CanonicalReferenceResolution['state'],
  resolvedHandleId: string | null,
  candidateHandleIds: readonly string[] = [],
  anchorText = 'أحمد',
): CanonicalReferenceResolution {
  return {
    reference_index: index,
    anchor_text: anchorText,
    anchor_occurrence: 1,
    span_start: 0,
    span_end: Array.from(anchorText).length,
    state,
    resolved_handle_id: resolvedHandleId,
    creates_handle: false,
    candidate_handle_ids: candidateHandleIds,
  };
}

/** The same shape the mapper reads, with mutable maps so a fixture can be bent. */
interface MutableOriginContext {
  semanticsByCuId: Map<string, CanonicalCuFocusSemanticPayload>;
  focusGroundingHandleIds: Map<string, readonly string[]>;
  establishedThreads: OriginEstablishedThread[];
}

/** The shared world: prior CU P1 attends focus A, prior CU P2 attends focus B; both are canonical Threads. */
function context(overrides: Partial<MutableOriginContext> = {}): MutableOriginContext {
  const semanticsByCuId = new Map<string, CanonicalCuFocusSemanticPayload>([
    [CU_P1, bundle(CU_P1, { attention: attend(F_A) })],
    [CU_P2, bundle(CU_P2, { attention: attend(F_B) })],
    [CU_X, bundle(CU_X)],
  ]);
  const focusGroundingHandleIds = new Map<string, readonly string[]>([[F_A, [H_A]], [F_B, [H_B]]]);
  const establishedThreads: OriginEstablishedThread[] = [
    { threadId: T_A, emergingFocusId: F_A },
    { threadId: T_B, emergingFocusId: F_B },
  ];
  return { semanticsByCuId, focusGroundingHandleIds, establishedThreads, ...overrides };
}
const episode = (bundleOfX: CanonicalCuFocusSemanticPayload, base: MutableOriginContext = context()): MutableOriginContext =>
  ({ ...base, semanticsByCuId: new Map(base.semanticsByCuId).set(CU_X, bundleOfX) });
const derive = (base: ConversationalOriginContext, evidenceCuIds: readonly string[] = [CU_X]) =>
  deriveConversationalOrigin({ establishingCuId: CU_X, targetEmergingFocusId: F_X, evidenceCuIds }, base);
const failure = (run: () => unknown) => {
  try { run(); } catch (error) {
    expect(error).toBeInstanceOf(ConversationThreadIntegrityError);
    return (error as ConversationThreadIntegrityError).reason;
  }
  throw new Error('expected a fail-closed rejection');
};

describe('Origin NONE (cases 1-4)', () => {
  it('1. the FIRST Thread of a world has no prior Thread to originate from', () => {
    expect(derive(context({ establishedThreads: [] }))).toEqual({ state: 'NONE' });
  });

  it('2. an abrupt new subject with no canonical link stays NONE even though prior Threads exist', () => {
    expect(derive(context())).toEqual({ state: 'NONE' });
  });

  it('3. adjacency alone is not a link: an immediate predecessor Thread never becomes an origin', () => {
    // P2 is the immediate predecessor and carries an established Thread, but
    // the establishing CU points at nothing and references nothing.
    const base = context();
    expect(base.semanticsByCuId.get(CU_P2)?.attention.emerging_focus_id).toBe(F_B);
    expect(derive(base)).toEqual({ state: 'NONE' });
  });

  it('4. a canonical target_cu_id into a CU with NO independent focus is not an origin link', () => {
    const base = context();
    base.semanticsByCuId.set(CU_P1, bundle(CU_P1, { attention: NO_FOCUS }));
    expect(derive(episode(bundle(CU_X, { target_cu_id: CU_P1 }), base))).toEqual({ state: 'NONE' });
  });
});

describe('Origin RESOLVED (cases 5-8)', () => {
  it('5. path A: a canonical target_cu_id whose target attends an established Thread resolves exactly one origin', () => {
    expect(derive(episode(bundle(CU_X, { target_cu_id: CU_P1 })))).toEqual({ state: 'RESOLVED', originThreadIds: [T_A] });
  });

  it('6. path B: a RESOLVED reference whose handle grounds an established Thread resolves exactly one origin', () => {
    expect(derive(episode(bundle(CU_X, { references: [reference(0, 'RESOLVED', H_B)] })))).toEqual({ state: 'RESOLVED', originThreadIds: [T_B] });
  });

  it('7. a prior EVIDENCE CU carries the grounded link just as the establishing CU does', () => {
    const base = context();
    // Exactly as T-03B2a supplies it: a prior evidence CU attends the TARGET
    // focus, and its own canonical reference grounding carries the link.
    base.semanticsByCuId.set(CU_P2, bundle(CU_P2, { attention: attend(F_X), references: [reference(0, 'RESOLVED', H_A)] }));
    expect(derive(base, [CU_P2, CU_X])).toEqual({ state: 'RESOLVED', originThreadIds: [T_A] });
  });

  it('8. an unresolved candidate set that adds nothing new leaves the resolved origin intact', () => {
    const bundleX = bundle(CU_X, { references: [reference(0, 'RESOLVED', H_A), reference(1, 'AMBIGUOUS', null, [H_A, H_UNBOUND])] });
    expect(derive(episode(bundleX))).toEqual({ state: 'RESOLVED', originThreadIds: [T_A] });
  });
});

describe('Origin MULTIPLE (cases 9-10)', () => {
  it('9. two INDEPENDENT resolved links produce a symmetric MULTIPLE with no primary', () => {
    const bundleX = bundle(CU_X, { target_cu_id: CU_P1, references: [reference(0, 'RESOLVED', H_B)] });
    const origin = derive(episode(bundleX));
    expect(origin).toEqual({ state: 'MULTIPLE', originThreadIds: [T_A, T_B] });
    // No field marks a primary, a parent or a preferred member.
    expect(Object.keys(origin)).toEqual(['state', 'originThreadIds']);
  });

  it('10. MULTIPLE membership and order are deterministic and independent of input order', () => {
    const forward = derive(episode(bundle(CU_X, { references: [reference(0, 'RESOLVED', H_B), reference(1, 'RESOLVED', H_A)] })));
    const reversed = derive(episode(bundle(CU_X, { references: [reference(0, 'RESOLVED', H_A), reference(1, 'RESOLVED', H_B)] })));
    expect(forward).toEqual(reversed);
    expect(forward).toEqual({ state: 'MULTIPLE', originThreadIds: [T_A, T_B] });
    const swapped = derive(episode(bundle(CU_X, { references: [reference(0, 'RESOLVED', H_A), reference(1, 'RESOLVED', H_B)] }),
      context({ establishedThreads: [{ threadId: T_B, emergingFocusId: F_B }, { threadId: T_A, emergingFocusId: F_A }] })));
    expect(swapped).toEqual(forward);
  });
});

describe('Origin AMBIGUOUS (cases 11-13)', () => {
  it('11. canonical B1 ambiguity over two grounded Threads is AMBIGUOUS, never a pick', () => {
    expect(derive(episode(bundle(CU_X, { references: [reference(0, 'AMBIGUOUS', null, [H_A, H_B])] }))))
      .toEqual({ state: 'AMBIGUOUS', originThreadIds: [T_A, T_B] });
  });

  it('12. one resolved link plus a genuinely competing candidate set is AMBIGUOUS over all of them', () => {
    const bundleX = bundle(CU_X, { target_cu_id: CU_P1, references: [reference(0, 'AMBIGUOUS', null, [H_B, H_UNBOUND])] });
    expect(derive(episode(bundleX))).toEqual({ state: 'AMBIGUOUS', originThreadIds: [T_A, T_B] });
  });

  it('13. a single grounded candidate behind B1 ambiguity is NONE: certainty is never invented', () => {
    expect(derive(episode(bundle(CU_X, { references: [reference(0, 'AMBIGUOUS', null, [H_A, H_UNBOUND])] }))))
      .toEqual({ state: 'NONE' });
  });
});

describe('forbidden origin authority (cases 14-18)', () => {
  it('14. repeated names are not identity: identical anchor wording on an unbound handle creates no origin', () => {
    const bundleX = bundle(CU_X, { references: [reference(0, 'RESOLVED', H_UNBOUND, [], 'أحمد')] });
    expect(derive(episode(bundleX))).toEqual({ state: 'NONE' });
    // The very same wording resolved to the ACTUAL handle is what creates the link.
    expect(derive(episode(bundle(CU_X, { references: [reference(0, 'RESOLVED', H_A, [], 'أحمد')] })))).toEqual({ state: 'RESOLVED', originThreadIds: [T_A] });
  });

  it('15. an UNRESOLVED reference contributes nothing at all', () => {
    expect(derive(episode(bundle(CU_X, { references: [reference(0, 'UNRESOLVED', null)] })))).toEqual({ state: 'NONE' });
  });

  it('16. chronology alone is not origin: the newest prior Thread wins nothing without a canonical link', () => {
    const base = context();
    // Both Threads exist and P2 is the most recent; the result is still NONE.
    expect(derive(base)).toEqual({ state: 'NONE' });
    // And a link to the OLDER one is honoured over the newer, because order is irrelevant.
    expect(derive(episode(bundle(CU_X, { target_cu_id: CU_P1 }), base))).toEqual({ state: 'RESOLVED', originThreadIds: [T_A] });
  });

  it('17. no similarity, importance, confidence, distance or model input is representable', () => {
    const base = context();
    // @ts-expect-error - a similarity score has no channel into the mapping.
    const withSimilarity: ConversationalOriginContext = { ...base, similarity: 0.99 };
    // @ts-expect-error - neither has an importance rank or a model-picked parent.
    const withParent: ConversationalOriginContext = { ...base, bestParentThreadId: T_A, importance: 1 };
    expect(derive(withSimilarity)).toEqual({ state: 'NONE' });
    expect(derive(withParent)).toEqual({ state: 'NONE' });
    expect(CONVERSATIONAL_ORIGIN_MAPPER_VERSION).toBe('conversational-origin-grounded-v1');
  });

  it('18. a Thread is never its own Conversational Origin', () => {
    const base = context();
    base.semanticsByCuId.set(CU_P1, bundle(CU_P1, { attention: attend(F_X) }));
    base.focusGroundingHandleIds.set(F_X, [H_UNBOUND]);
    // The target focus grounds nothing of its own, so both paths stay empty.
    expect(derive(episode(bundle(CU_X, { target_cu_id: CU_P1, references: [reference(0, 'RESOLVED', H_UNBOUND)] }), base)))
      .toEqual({ state: 'NONE' });
  });
});

describe('no hindsight and fail-closed context (cases 19-22)', () => {
  it('19. a later CU is structurally absent: only supplied evidence CUs are ever read', () => {
    const base = context();
    // A later CU that WOULD carry a link is simply not in the visible map.
    expect(base.semanticsByCuId.has(CU_LATER)).toBe(false);
    expect(failure(() => derive(base, [CU_LATER, CU_X]))).toBe('INVALID_CONVERSATIONAL_ORIGIN_CONTEXT');
  });

  it('20. a canonical link into material this decision cannot see fails closed, never silently drops', () => {
    expect(failure(() => derive(episode(bundle(CU_X, { target_cu_id: CU_LATER }))))).toBe('INVALID_CONVERSATIONAL_ORIGIN_CONTEXT');
  });

  it('21. a contradictory Thread world fails closed', () => {
    for (const establishedThreads of [
      [{ threadId: T_A, emergingFocusId: F_A }, { threadId: T_A, emergingFocusId: F_B }],
      [{ threadId: T_A, emergingFocusId: F_A }, { threadId: T_B, emergingFocusId: F_A }],
      [{ threadId: T_A, emergingFocusId: F_X }],
      [{ threadId: 'not-a-uuid', emergingFocusId: F_A }],
    ]) {
      expect(failure(() => derive(context({ establishedThreads })))).toBe('INVALID_CONVERSATIONAL_ORIGIN_CONTEXT');
    }
    // One handle canonically grounding two different focuses is impossible.
    expect(failure(() => derive(context({ focusGroundingHandleIds: new Map([[F_A, [H_A]], [F_B, [H_A]]]) }))))
      .toBe('INVALID_CONVERSATIONAL_ORIGIN_CONTEXT');
  });

  it('22. a malformed episode fails closed: no bundle, a mismatched bundle, or evidence not ending at the establishing CU', () => {
    const base = context();
    const withoutX = new Map(base.semanticsByCuId);
    withoutX.delete(CU_X);
    expect(failure(() => derive({ ...base, semanticsByCuId: withoutX }))).toBe('INVALID_CONVERSATIONAL_ORIGIN_CONTEXT');
    expect(failure(() => derive(episode(bundle(CU_P1))))).toBe('INVALID_CONVERSATIONAL_ORIGIN_CONTEXT');
    expect(failure(() => derive(base, [CU_X, CU_P1]))).toBe('INVALID_CONVERSATIONAL_ORIGIN_CONTEXT');
    expect(failure(() => derive(base, []))).toBe('INVALID_CONVERSATIONAL_ORIGIN_CONTEXT');
    expect(failure(() => derive(base, [CU_X, CU_X]))).toBe('INVALID_CONVERSATIONAL_ORIGIN_CONTEXT');
    expect(failure(() => deriveConversationalOrigin({ establishingCuId: CU_X, targetEmergingFocusId: 'prepared:focus:x', evidenceCuIds: [CU_X] }, base)))
      .toBe('INVALID_CONVERSATIONAL_ORIGIN_CONTEXT');
  });
});
