import { authorizeSubjectGroundingHandles, parseSubjectGroundingUniverse, parseSubjectGroundingUniverseResolution } from './hypothesis-subject-grounding.authority';
import { MAX_SUBJECT_GROUNDING_CANDIDATES, MAX_SUBJECT_GROUNDINGS_PER_CANDIDATE, SOURCE_SEMANTIC_FRONTIER_NOT_ESTABLISHED } from './hypothesis-subject-grounding.types';

const EXECUTION = '10000000-0000-4000-8000-000000000005';
const HANDLE_A = '22d3c5d1-02cc-55e5-97c8-7b5563e5332f';
const HANDLE_B = '5f2c1e6a-1b2c-5d4e-8f9a-0b1c2d3e4f5a';
const FOCUS_UUID = '4ef8538d-ddda-5e11-b7d9-052be85de59a';
const entry = (handle: string, overrides: Record<string, unknown> = {}) => ({ handle, subjectText: 'أحمد', startedSp: 3, lastAttentionSp: 5, ...overrides });
const universe = (overrides: Record<string, unknown> = {}) => ({ executionId: EXECUTION, frontierSp: 7, entries: [entry(HANDLE_A), entry(HANDLE_B, { subjectText: 'المدير', startedSp: 1, lastAttentionSp: 1 })], ...overrides });

describe('the subject-grounding authority (T-03C R2)', () => {
  it('parses exactly the bounded server presentation and nothing else', () => {
    expect(parseSubjectGroundingUniverse(universe())).toEqual(universe());
    expect(parseSubjectGroundingUniverse({ executionId: EXECUTION, frontierSp: null, entries: [] })).toEqual({ executionId: EXECUTION, frontierSp: null, entries: [] });
    for (const malformed of [
      null, [], 'universe',
      universe({ extra: true }),
      universe({ executionId: 'not-a-uuid' }),
      universe({ frontierSp: 0 }),
      universe({ frontierSp: null }),
      universe({ entries: [entry(HANDLE_A), entry(HANDLE_A)] }),
      universe({ entries: [entry(FOCUS_UUID.replace('5e11', '4e11'))] }),
      universe({ entries: [{ ...entry(HANDLE_A), emergingFocusId: FOCUS_UUID }] }),
      universe({ entries: [entry(HANDLE_A, { subjectText: '' })] }),
      universe({ entries: [entry(HANDLE_A, { startedSp: 9 })] }),
      universe({ entries: [entry(HANDLE_A, { lastAttentionSp: 2 })] }),
      universe({ entries: [entry(HANDLE_A, { lastAttentionSp: 8 })] }),
      universe({ entries: Array.from({ length: MAX_SUBJECT_GROUNDING_CANDIDATES + 1 }, (_, index) => entry(`${HANDLE_A.slice(0, -4)}${(1000 + index).toString(16)}`)) }),
    ]) {
      expect(parseSubjectGroundingUniverse(malformed)).toBeUndefined();
    }
  });

  it('authorizes only a duplicate-free subset of the supplied handles; absence means "grounds nothing"', () => {
    const entries = universe().entries;
    expect(authorizeSubjectGroundingHandles(undefined, entries)).toEqual({ status: 'AUTHORIZED', handles: [] });
    expect(authorizeSubjectGroundingHandles([], entries)).toEqual({ status: 'AUTHORIZED', handles: [] });
    expect(authorizeSubjectGroundingHandles([HANDLE_B, HANDLE_A], entries)).toEqual({ status: 'AUTHORIZED', handles: [HANDLE_B, HANDLE_A] });
    expect(authorizeSubjectGroundingHandles([HANDLE_A, HANDLE_A], entries)).toEqual({ status: 'REJECTED', reason: 'SUBJECT_GROUNDING_DUPLICATE' });
    expect(authorizeSubjectGroundingHandles('handle', entries)).toEqual({ status: 'REJECTED', reason: 'SUBJECT_GROUNDING_MALFORMED' });
    expect(authorizeSubjectGroundingHandles([1], entries)).toEqual({ status: 'REJECTED', reason: 'SUBJECT_GROUNDING_MALFORMED' });
    expect(authorizeSubjectGroundingHandles([''], entries)).toEqual({ status: 'REJECTED', reason: 'SUBJECT_GROUNDING_MALFORMED' });
    expect(authorizeSubjectGroundingHandles(Array.from({ length: MAX_SUBJECT_GROUNDINGS_PER_CANDIDATE + 1 }, (_, index) => `h${index}`), entries)).toEqual({ status: 'REJECTED', reason: 'SUBJECT_GROUNDING_LIMIT_EXCEEDED' });
  });

  it('SG-05 / SG-16 / SG-17: an out-of-universe handle, a raw focus UUID and a handle of another universe are refused, never mapped', () => {
    const entries = universe().entries;
    expect(authorizeSubjectGroundingHandles([FOCUS_UUID], entries)).toEqual({ status: 'REJECTED', reason: 'SUBJECT_GROUNDING_OUTSIDE_UNIVERSE' });
    expect(authorizeSubjectGroundingHandles([HANDLE_A, 'other-execution-handle'], entries)).toEqual({ status: 'REJECTED', reason: 'SUBJECT_GROUNDING_OUTSIDE_UNIVERSE' });
    // A request without a universe admits no grounding at all: the HTTP generation path can never ground.
    expect(authorizeSubjectGroundingHandles([HANDLE_A], undefined)).toEqual({ status: 'REJECTED', reason: 'SUBJECT_GROUNDING_OUTSIDE_UNIVERSE' });
    expect(authorizeSubjectGroundingHandles([HANDLE_A], [])).toEqual({ status: 'REJECTED', reason: 'SUBJECT_GROUNDING_OUTSIDE_UNIVERSE' });
  });

  // T-03C R3: the not-yet-established causal frontier is a first-class,
  // distinct answer. It is never an empty universe, and an empty universe is
  // never a not-yet-established frontier.
  it('R3: distinguishes a not-yet-established causal frontier from an established but empty universe', () => {
    expect(parseSubjectGroundingUniverseResolution({ status: SOURCE_SEMANTIC_FRONTIER_NOT_ESTABLISHED }))
      .toEqual({ status: SOURCE_SEMANTIC_FRONTIER_NOT_ESTABLISHED });
    expect(parseSubjectGroundingUniverseResolution({ executionId: EXECUTION, frontierSp: null, entries: [] }))
      .toEqual({ status: 'ESTABLISHED', universe: { executionId: EXECUTION, frontierSp: null, entries: [] } });
    expect(parseSubjectGroundingUniverseResolution(universe())).toEqual({ status: 'ESTABLISHED', universe: universe() });
    for (const malformed of [
      null, [], 'not established',
      { status: 'SOMETHING_ELSE' },
      { status: SOURCE_SEMANTIC_FRONTIER_NOT_ESTABLISHED, executionId: EXECUTION },
      universe({ executionId: 'not-a-uuid' }),
    ]) {
      expect(parseSubjectGroundingUniverseResolution(malformed)).toBeUndefined();
    }
  });
});
