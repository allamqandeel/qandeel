// T-03B2b2 - the durable Thread canonicalizer suite.
//
// Pure, in-process, no provider and no database. It pins the three frozen
// namespace URIs and their derived namespaces, the exact identity vectors, the
// determinism and owner-scoping of `thread_id`, the typed NO_ESTABLISHMENT
// no-op, the evidence provenance shape, the symmetric Conversational Origin
// handling (canonical order, frozen cardinalities, no primary member) and the
// absence of every field the boundary must not be able to express.

import {
  HOME_ANCHOR_NAMESPACE,
  THREAD_EVENT_NAMESPACE,
  THREAD_NAMESPACE,
  canonicalizePreparedThreadEstablishment,
  canonicalizePreparedThreadSequence,
  compareThreadIds,
  durableHomeAnchorId,
  durableThreadEstablishedEventId,
  durableThreadId,
} from './durable-thread-canonicalizer';
import { ThreadCanonicalizationError, type PreparedConversationalOrigin } from './durable-thread-payload.types';
import {
  THREAD_ESTABLISHMENT_EVALUATOR_VERSION,
  THREAD_ESTABLISHMENT_POLICY_VERSION,
  type PreparedThreadEstablishmentResult,
} from './thread-establishment.types';
import { CANONICAL_UUID_PATTERN, RFC4122_URL_NAMESPACE, uuidV5 } from '../runtime-identity/uuid-v5';

const USER = '11111111-2222-4333-8444-555555555555';
const OTHER_USER = '99999999-2222-4333-8444-555555555555';
const SESSION = '22222222-3333-4444-8555-666666666666';
const FOCUS = '4ef8538d-ddda-5e11-b7d9-052be85de59a';
const CU1 = '33333333-4444-4555-8666-777777777777';
const CU2 = '44444444-5555-4666-8777-888888888888';
const TURN = '55555555-6666-4777-8888-999999999999';
const ORIGIN_A = 'aaaaaaaa-1111-4222-8333-444444444444';
const ORIGIN_B = 'bbbbbbbb-1111-4222-8333-444444444444';
const ORIGIN_C = '0ccccccc-1111-4222-8333-444444444444';

const PROVENANCE = {
  evaluatorVersion: THREAD_ESTABLISHMENT_EVALUATOR_VERSION,
  policyVersion: THREAD_ESTABLISHMENT_POLICY_VERSION,
  provider: 'FAKE',
  model: 'fake-thread-establishment',
  promptVersion: 'thread-establishment-evidence-path-v1',
  schemaVersion: 1,
};

const prepared = (overrides: Partial<PreparedThreadEstablishmentResult> = {}): PreparedThreadEstablishmentResult => ({
  sessionId: SESSION,
  cuId: CU2,
  sourceTurnId: TURN,
  sourceRole: 'USER',
  emergingFocusId: FOCUS,
  decision: 'ESTABLISH_THREAD',
  path: 'TE-02',
  noEstablishmentReason: null,
  evidenceCuIds: [CU1, CU2],
  explicitSelectionGrounding: null,
  provenance: PROVENANCE,
  ...overrides,
});

describe('durable Thread identity derivation', () => {
  it('derives the three namespaces from their frozen documented URIs', () => {
    expect(THREAD_NAMESPACE).toBe(uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/world/thread/v1'));
    expect(HOME_ANCHOR_NAMESPACE).toBe(uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/world/home-anchor/v1'));
    expect(THREAD_EVENT_NAMESPACE).toBe(uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-established/v1'));
    expect(THREAD_NAMESPACE).toBe('973d2e95-15d7-593c-953d-84ee94be343c');
    expect(HOME_ANCHOR_NAMESPACE).toBe('ca3acc01-e866-5d84-a15a-5be440c1919e');
    expect(THREAD_EVENT_NAMESPACE).toBe('47cd6b25-dbf8-5fd3-941f-eff9d2386990');
  });

  it('pins the exact identity vectors of one canonical promotion', () => {
    const threadId = durableThreadId(USER, FOCUS);
    expect(threadId).toBe('afc4fd81-fe54-5738-9545-e1053044d919');
    expect(durableHomeAnchorId(threadId)).toBe('61cbba23-76ef-5aea-a453-50aed3a8006b');
    expect(durableThreadEstablishedEventId(threadId)).toBe('76cb9266-87d0-53ac-8fae-f6242f9583ea');
    for (const id of [threadId, durableHomeAnchorId(threadId), durableThreadEstablishedEventId(threadId)]) {
      expect(CANONICAL_UUID_PATTERN.test(id)).toBe(true);
    }
  });

  it('scopes Thread identity to the user world, not the Session: the same focus under another owner is another Thread', () => {
    expect(durableThreadId(USER, FOCUS)).toBe(durableThreadId(USER, FOCUS));
    expect(durableThreadId(OTHER_USER, FOCUS)).not.toBe(durableThreadId(USER, FOCUS));
    // No Session participates in the derivation at all.
    expect(durableThreadId(USER, FOCUS)).toBe(uuidV5(THREAD_NAMESPACE, `${USER}:${FOCUS}`));
  });

  it('rejects a non-canonical identity rather than deriving from it', () => {
    for (const bad of ['prepared:focus:x', 'not-a-uuid', '', 'AFC4FD81-FE54-5738-9545-E1053044D919']) {
      expect(() => durableThreadId(USER, bad)).toThrow(ThreadCanonicalizationError);
      expect(() => durableThreadId(bad, FOCUS)).toThrow(ThreadCanonicalizationError);
    }
    expect(() => durableHomeAnchorId('nope')).toThrow(ThreadCanonicalizationError);
    expect(() => durableThreadEstablishedEventId('nope')).toThrow(ThreadCanonicalizationError);
  });
});

describe('canonicalizing one prepared decision', () => {
  it('carries exactly the twelve boundary keys and nothing geographic, graded or lifecycle-shaped', () => {
    const payload = canonicalizePreparedThreadEstablishment(prepared(), { userId: USER });
    expect(Object.keys(payload).sort()).toEqual([
      'decision', 'emerging_focus_id', 'evidence', 'explicit_selection_grounding', 'home_anchor_id',
      'no_establishment_reason', 'origin_state', 'origin_thread_ids', 'path', 'thread_established_event_id',
      'thread_id', 'unit_id',
    ]);
    const serialized = JSON.stringify(payload);
    for (const forbidden of ['placement', 'coordinate', 'attempt', 'fingerprint', 'score', 'confidence', 'similarity',
      'rank', 'parent', 'primary', 'lifecycle', 'status', 'live_focus', 'session_position', 'same_sp', 'timeline']) {
      expect(serialized.includes(forbidden)).toBe(false);
    }
  });

  it('derives the three identities and preserves the evidence path and provenance-bearing evidence order', () => {
    const payload = canonicalizePreparedThreadEstablishment(prepared(), { userId: USER });
    expect(payload.decision).toBe('ESTABLISH_THREAD');
    expect(payload.path).toBe('TE-02');
    expect(payload.no_establishment_reason).toBeNull();
    expect(payload.thread_id).toBe(durableThreadId(USER, FOCUS));
    expect(payload.home_anchor_id).toBe(durableHomeAnchorId(payload.thread_id as string));
    expect(payload.thread_established_event_id).toBe(durableThreadEstablishedEventId(payload.thread_id as string));
    expect(payload.evidence).toEqual([
      { evidence_ordinal: 0, cu_id: CU1, evidence_role: 'PRIOR_EVIDENCE' },
      { evidence_ordinal: 1, cu_id: CU2, evidence_role: 'ESTABLISHING_CU' },
    ]);
  });

  it('carries the TE-01 selection grounding as exact code-point coordinates, re-shaped and never re-measured', () => {
    const payload = canonicalizePreparedThreadEstablishment(
      prepared({ path: 'TE-01', evidenceCuIds: [CU2], explicitSelectionGrounding: { anchor: { text: 'أحمد', occurrence: 2 }, span: { start: 7, end: 11 } } }),
      { userId: USER },
    );
    expect(payload.explicit_selection_grounding).toEqual({ anchor_text: 'أحمد', anchor_occurrence: 2, span_start: 7, span_end: 11 });
    expect(payload.evidence).toEqual([{ evidence_ordinal: 0, cu_id: CU2, evidence_role: 'ESTABLISHING_CU' }]);
  });

  it('preserves NO_ESTABLISHMENT as a typed no-op payload rather than dropping the decision', () => {
    const payload = canonicalizePreparedThreadEstablishment(
      prepared({ decision: 'NO_ESTABLISHMENT', path: null, noEstablishmentReason: 'NO_PROMOTION_PATH_PROVEN', evidenceCuIds: [] }),
      { userId: USER },
    );
    expect(payload.decision).toBe('NO_ESTABLISHMENT');
    expect(payload.no_establishment_reason).toBe('NO_PROMOTION_PATH_PROVEN');
    expect(payload.emerging_focus_id).toBe(FOCUS);
    expect(payload.thread_id).toBeNull();
    expect(payload.home_anchor_id).toBeNull();
    expect(payload.thread_established_event_id).toBeNull();
    expect(payload.evidence).toEqual([]);
    expect(payload.origin_state).toBe('NONE');
    expect(payload.origin_thread_ids).toEqual([]);
  });

  it('accepts NO_INDEPENDENT_FOCUS with no focus identity at all', () => {
    const payload = canonicalizePreparedThreadEstablishment(
      prepared({ decision: 'NO_ESTABLISHMENT', path: null, noEstablishmentReason: 'NO_INDEPENDENT_FOCUS', emergingFocusId: null, evidenceCuIds: [] }),
      { userId: USER },
    );
    expect(payload.emerging_focus_id).toBeNull();
    expect(payload.thread_id).toBeNull();
  });

  it('refuses an establishment without a stable focus, without a path, or with a no-establishment reason', () => {
    expect(() => canonicalizePreparedThreadEstablishment(prepared({ emergingFocusId: null }), { userId: USER }))
      .toThrow(expect.objectContaining({ reason: 'ESTABLISHMENT_WITHOUT_FOCUS' }));
    expect(() => canonicalizePreparedThreadEstablishment(prepared({ path: null }), { userId: USER }))
      .toThrow(expect.objectContaining({ reason: 'INVALID_PROMOTION_PATH' }));
    expect(() => canonicalizePreparedThreadEstablishment(prepared({ noEstablishmentReason: 'ALREADY_ESTABLISHED' }), { userId: USER }))
      .toThrow(expect.objectContaining({ reason: 'INVALID_PROMOTION_PATH' }));
    expect(() => canonicalizePreparedThreadEstablishment(prepared({ emergingFocusId: 'prepared:focus:cu-1' }), { userId: USER }))
      .toThrow(expect.objectContaining({ reason: 'INVALID_DURABLE_IDENTITY' }));
  });

  it('refuses evidence that omits the establishing CU, repeats a CU, or does not end with it', () => {
    for (const evidenceCuIds of [[], [CU1], [CU2, CU1], [CU1, CU1, CU2], [CU2, CU2]]) {
      expect(() => canonicalizePreparedThreadEstablishment(prepared({ evidenceCuIds }), { userId: USER }))
        .toThrow(expect.objectContaining({ reason: 'INVALID_EVIDENCE_SHAPE' }));
    }
  });

  it('refuses a NO_ESTABLISHMENT that smuggles a path, evidence or an origin', () => {
    const no = { decision: 'NO_ESTABLISHMENT' as const, noEstablishmentReason: 'ALREADY_ESTABLISHED' as const };
    expect(() => canonicalizePreparedThreadEstablishment(prepared({ ...no, evidenceCuIds: [] }), { userId: USER }))
      .toThrow(expect.objectContaining({ reason: 'INVALID_PROMOTION_PATH' }));
    expect(() => canonicalizePreparedThreadEstablishment(prepared({ ...no, path: null }), { userId: USER }))
      .toThrow(expect.objectContaining({ reason: 'INVALID_EVIDENCE_SHAPE' }));
    expect(() => canonicalizePreparedThreadEstablishment(
      prepared({ ...no, path: null, evidenceCuIds: [] }),
      { userId: USER, originsByCuId: new Map<string, PreparedConversationalOrigin>([[CU2, { state: 'RESOLVED', originThreadIds: [ORIGIN_A] }]]) },
    )).toThrow(expect.objectContaining({ reason: 'ORIGIN_FORBIDDEN_WITHOUT_ESTABLISHMENT' }));
  });
});

describe('Conversational Origin provenance', () => {
  const withOrigin = (origin: PreparedConversationalOrigin) =>
    canonicalizePreparedThreadEstablishment(prepared(), { userId: USER, originsByCuId: new Map([[CU2, origin]]) });

  it('defaults to NONE with zero members when no origin is supplied', () => {
    const payload = canonicalizePreparedThreadEstablishment(prepared(), { userId: USER });
    expect(payload.origin_state).toBe('NONE');
    expect(payload.origin_thread_ids).toEqual([]);
  });

  it('stores MULTIPLE and AMBIGUOUS members in canonical textual order, symmetrically, with no primary', () => {
    const multiple = withOrigin({ state: 'MULTIPLE', originThreadIds: [ORIGIN_B, ORIGIN_A, ORIGIN_C] });
    const ambiguous = withOrigin({ state: 'AMBIGUOUS', originThreadIds: [ORIGIN_C, ORIGIN_B, ORIGIN_A] });
    expect(multiple.origin_thread_ids).toEqual([ORIGIN_C, ORIGIN_A, ORIGIN_B]);
    expect(ambiguous.origin_thread_ids).toEqual(multiple.origin_thread_ids);
    expect(multiple.origin_state).toBe('MULTIPLE');
    expect(ambiguous.origin_state).toBe('AMBIGUOUS');
    // The member order does not depend on the input order, and no member is marked.
    expect(JSON.stringify(multiple.origin_thread_ids)).not.toContain('primary');
    expect(compareThreadIds(ORIGIN_C, ORIGIN_A)).toBe(-1);
    expect(compareThreadIds(ORIGIN_A, ORIGIN_A)).toBe(0);
  });

  it('enforces the frozen cardinalities and rejects duplicate or non-canonical members', () => {
    expect(() => withOrigin({ state: 'RESOLVED', originThreadIds: [ORIGIN_A, ORIGIN_B] } as unknown as PreparedConversationalOrigin))
      .toThrow(expect.objectContaining({ reason: 'INVALID_ORIGIN_CARDINALITY' }));
    expect(() => withOrigin({ state: 'MULTIPLE', originThreadIds: [ORIGIN_A] }))
      .toThrow(expect.objectContaining({ reason: 'INVALID_ORIGIN_CARDINALITY' }));
    expect(() => withOrigin({ state: 'AMBIGUOUS', originThreadIds: [ORIGIN_A, ORIGIN_A] }))
      .toThrow(expect.objectContaining({ reason: 'DUPLICATE_ORIGIN_THREAD' }));
    expect(() => withOrigin({ state: 'RESOLVED', originThreadIds: ['prepared:thread:1'] }))
      .toThrow(expect.objectContaining({ reason: 'INVALID_DURABLE_IDENTITY' }));
    expect(withOrigin({ state: 'RESOLVED', originThreadIds: [ORIGIN_A] }).origin_thread_ids).toEqual([ORIGIN_A]);
  });
});

describe('canonicalizing an ordered sequence', () => {
  it('keeps one decision per CU, maps established focuses to their Threads, and is byte-stable across calls', () => {
    const results = [
      prepared({ cuId: CU1, decision: 'NO_ESTABLISHMENT', path: null, noEstablishmentReason: 'NO_INDEPENDENT_FOCUS', emergingFocusId: null, evidenceCuIds: [] }),
      prepared({ cuId: CU2 }),
    ];
    const first = canonicalizePreparedThreadSequence(results, { userId: USER });
    const second = canonicalizePreparedThreadSequence(results, { userId: USER });
    expect(first.units).toHaveLength(2);
    expect(JSON.stringify(first.units)).toBe(JSON.stringify(second.units));
    expect([...first.threadIds.entries()]).toEqual([[FOCUS, durableThreadId(USER, FOCUS)]]);
    expect(first.units[0].decision).toBe('NO_ESTABLISHMENT');
    expect(first.units[1].thread_id).toBe(durableThreadId(USER, FOCUS));
  });

  it('refuses a sequence whose CU identity is not canonical', () => {
    expect(() => canonicalizePreparedThreadSequence([prepared({ cuId: 'prepared:cu:1' })], { userId: USER }))
      .toThrow(expect.objectContaining({ reason: 'INVALID_CANONICAL_UNIT_ID' }));
    expect(() => canonicalizePreparedThreadSequence([prepared()], { userId: 'not-a-uuid' }))
      .toThrow(expect.objectContaining({ reason: 'INVALID_DURABLE_IDENTITY' }));
  });
});
