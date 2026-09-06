/**
 * T-06 — TN06-22, plus the adversarial cases the promotion itself creates.
 *
 * Promoting an act to executable is the moment a boundary can quietly open. The guarantees proven
 * here are the ones a passing feature test would not notice: a forged act is refused, a granted act
 * cannot be replayed, neither promoted family can enter the other's seam, the raw dispatch surface
 * reaches neither, and every T-07 identity still fails closed on all three.
 */
import {
  ACTION_CATALOG,
  METADATA_ONLY_ACTION_TYPES,
  TEMPORAL_ACTION_TYPES,
  UnauthorizedActionClass,
  UnauthorizedMapAction,
  UnauthorizedTemporalAction,
  opaqueRef,
  sessionPosition,
  type CanonicalStore,
  type TemporalAction,
} from '../../state';
import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { commitMomentAndLocate } from '../targeting';
import { contextAt, temporalTestStore } from '../__fixtures__/temporal';

const T07_ACTS = ['RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'GO_LIVE_AND_LOCATE', 'RETURN_WORLD', 'EXACT_RETURN', 'BACK_ONE_STEP'] as const;

const world = () =>
  disclosureFixture({
    depth: 'SESSION',
    tc: 3,
    liveHead: 6,
    threads: [{ id: 'thread-1', x: '10', y: '10' }],
    appearances: [{ bindingId: 'binding-a', threadId: 'thread-1', readingId: 'reading-1', boundSp: 2 }],
  });

const forgedLanding = () => ({
  anchor: opaqueRef('WORLD_ANCHOR', { scheme: 'x', x: '10', y: '10' }),
  destination: opaqueRef('SPATIAL_DESTINATION', { scheme: 'x', kind: 'THREAD_HOME', threadId: 'thread-1' }),
});

describe('TN06-22 — the T-07 firewall', () => {
  it('keeps exactly the six T-07 identities as later-owner metadata', () => {
    expect([...METADATA_ONLY_ACTION_TYPES].sort()).toEqual([...T07_ACTS].sort());
    for (const id of T07_ACTS) {
      expect(ACTION_CATALOG[id].level).toBe('METADATA_ONLY');
      expect(ACTION_CATALOG[id].owner).toBe('T-07');
    }
  });

  it('leaves every T-07 identity failing closed on all three Product entry points', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const before = store.getState();
    for (const id of T07_ACTS) {
      expect(() => store.dispatch({ type: id } as never)).toThrow(/is owned by T-07/u);
      expect(() => store.dispatchMap({ type: id } as never)).toThrow(/is owned by T-07/u);
      expect(() => store.dispatchTemporal({ type: id } as never)).toThrow(/is owned by T-07/u);
    }
    expect(store.getState()).toBe(before);
  });

  it('promotes exactly the two frozen temporal identities and nothing else', () => {
    expect([...TEMPORAL_ACTION_TYPES]).toEqual(['COMMIT_MOMENT_AND_LOCATE', 'CHOOSE_LOCUS']);
    // The frozen names, owners, authorities and transactional categories are unchanged by promotion.
    expect(ACTION_CATALOG.COMMIT_MOMENT_AND_LOCATE).toMatchObject({
      frozenName: 'P3a Temporal + Locate',
      level: 'EXECUTABLE',
      owner: 'T-06',
      transactional: 'COMPOSITE_TRANSACTION',
    });
    expect([...ACTION_CATALOG.COMMIT_MOMENT_AND_LOCATE.authority].sort()).toEqual([
      'MC.anchor',
      'MC.destination',
      'MC.orientation',
      'MC.scale',
      'TM',
    ]);
    expect(ACTION_CATALOG.CHOOSE_LOCUS).toMatchObject({ level: 'EXECUTABLE', owner: 'T-06', transactional: 'EFFECTIVE_TRANSACTION' });
    expect([...ACTION_CATALOG.CHOOSE_LOCUS.authority].sort()).toEqual(['MC.anchor', 'MC.destination', 'MC.orientation', 'MC.scale']);
    // Neither may reach the semantic depth, the inspection or the live mirrors.
    for (const id of TEMPORAL_ACTION_TYPES) {
      for (const forbidden of ['MC.depth', 'IF_ref', 'LH', 'LF', 'RH']) {
        expect(ACTION_CATALOG[id].authority).not.toContain(forbidden);
      }
    }
  });

  it('registers the Class C temporal identities as non-store identities that never reach the kernel', () => {
    const store = temporalTestStore({ liveHead: 6 });
    for (const id of ['PREVIEW_TEMPORAL_TARGET', 'CANCEL_PREVIEW', 'RELATIVE_FORWARD_CONTINUATION', 'INPUT_CANCELLATION'] as const) {
      expect(ACTION_CATALOG[id].level).toBe('NOT_STORE_ACTION');
      expect(ACTION_CATALOG[id].cls).toBe('C');
      expect(ACTION_CATALOG[id].authority).toEqual([]);
      expect(() => store.dispatch({ type: id } as never)).toThrow(UnauthorizedActionClass);
      expect(() => store.dispatchTemporal({ type: id } as never)).toThrow(UnauthorizedActionClass);
    }
  });
});

describe('the temporal authorization boundary', () => {
  it('refuses a structurally perfect act this layer did not mint', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const before = store.getState();
    const forged: TemporalAction = { type: 'COMMIT_MOMENT_AND_LOCATE', moment: sessionPosition(3), to: forgedLanding() };

    expect(() => store.dispatchTemporal(forged)).toThrow(UnauthorizedTemporalAction);
    expect(store.getState()).toBe(before);
  });

  it('refuses a promoted temporal act on the raw dispatch surface', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const before = store.getState();
    expect(() => store.dispatch({ type: 'CHOOSE_LOCUS', to: forgedLanding() } as never)).toThrow(UnauthorizedTemporalAction);
    expect(() => store.dispatch({ type: 'COMMIT_MOMENT_AND_LOCATE', moment: sessionPosition(3), to: forgedLanding() } as never)).toThrow(
      UnauthorizedTemporalAction,
    );
    expect(store.getState()).toBe(before);
  });

  it('refuses a Map act on the temporal seam and a temporal act on the Map seam', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const before = store.getState();
    expect(() => store.dispatchTemporal({ type: 'INSPECT_OBJECT' } as never)).toThrow(UnauthorizedActionClass);
    expect(() => store.dispatchMap({ type: 'CHOOSE_LOCUS' } as never)).toThrow(UnauthorizedActionClass);
    // A raw Map act keeps its own refusal, so the two boundaries stay distinguishable.
    expect(() => store.dispatch({ type: 'INSPECT_OBJECT' } as never)).toThrow(UnauthorizedMapAction);
    expect(store.getState()).toBe(before);
  });

  it('consumes an authorization on use, so a granted act cannot be replayed', () => {
    const base = temporalTestStore({ liveHead: 6 });
    let captured: TemporalAction | null = null;
    const observed: CanonicalStore = {
      ...base,
      dispatchTemporal: (action) => {
        captured = action;
        return base.dispatchTemporal(action);
      },
    };

    expect(
      commitMomentAndLocate(observed, { moment: sessionPosition(3), context: contextAt(world()), target: { family: 'THREAD', id: 'thread-1' } }).outcome,
    ).toBe('APPLIED');
    expect(captured).not.toBeNull();

    const replay = captured as unknown as TemporalAction;
    expect(() => base.dispatchTemporal(replay)).toThrow(UnauthorizedTemporalAction);
    // One entry, from the one act that was actually authorized.
    expect(base.getState().history).toHaveLength(1);
  });

  it('refuses a structural copy of an act that WAS granted, because identity is the authorization', () => {
    const base = temporalTestStore({ liveHead: 6 });
    let captured: TemporalAction | null = null;
    const observed: CanonicalStore = {
      ...base,
      dispatchTemporal: (action) => {
        captured = action;
        // The copy is attempted BEFORE the genuine act runs, so the genuine authorization is
        // definitely still unconsumed: only object identity can be refusing the copy.
        expect(() => base.dispatchTemporal({ ...action })).toThrow(UnauthorizedTemporalAction);
        return base.dispatchTemporal(action);
      },
    };

    expect(
      commitMomentAndLocate(observed, { moment: sessionPosition(3), context: contextAt(world()), target: { family: 'THREAD', id: 'thread-1' } }).outcome,
    ).toBe('APPLIED');
    expect(captured).not.toBeNull();
    expect(base.getState().history).toHaveLength(1);
  });

  it('runs no promoted temporal act at all on a store built without a temporal authority', () => {
    const store = temporalTestStore({ liveHead: 6, temporalAuthority: false });
    const before = store.getState();
    expect(() => store.dispatchTemporal({ type: 'CHOOSE_LOCUS', to: forgedLanding() })).toThrow(/without a Temporal authority/u);
    expect(store.getState()).toBe(before);
  });
});
