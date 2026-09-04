import { inspectionRefEquals, isInspectionRef, opaqueRef, sessionPosition, type InspectionRef } from '../classes';
import { isEffectiveChange, phiEff, phiEffEquals } from '../history';
import { committedNavigationIntent } from '../selectors';
import { createCanonicalStore, type CanonicalStateInit } from '../store';

const SP = sessionPosition;

function init(overrides: Partial<CanonicalStateInit> = {}): CanonicalStateInit {
  return {
    session: { id: 'session-1' },
    live: { LH: SP(5), LF: { value: { kind: 'NONE' }, atSp: null } },
    temporal: { kind: 'PINNED', at: SP(3) },
    inspection: null,
    camera: { anchor: opaqueRef('WORLD_ANCHOR', 'a0'), scale: opaqueRef('SCALE_INTENT', 's0'), depth: 'ANALYTICAL_OBJECT' },
    ...overrides,
  };
}

const lineage = opaqueRef('LINEAGE', { chain: 'World/Work/Session-12/R1' });

describe('IF_ref is an open compound of opaque references', () => {
  it('a future canonical identity family participates without a state-schema change (row 17)', () => {
    const futureFamily: InspectionRef = {
      canonicalIdentity: opaqueRef('CANONICAL_IDENTITY', { family: 'FUTURE_FAMILY', id: 'x' }),
      depth: 'ANALYTICAL_OBJECT',
      lineage,
    };
    const store = createCanonicalStore(init({ inspection: futureFamily }));
    const state = store.getState();
    expect(Object.keys(state).sort()).toEqual(['camera', 'history', 'inspection', 'live', 'session', 'temporal']);
    expect(state.inspection).toEqual(futureFamily);
    expect(committedNavigationIntent(state).inspection).toBe(state.inspection);

    const otherFamily = createCanonicalStore(
      init({ inspection: { ...futureFamily, canonicalIdentity: opaqueRef('CANONICAL_IDENTITY', { family: 'OTHER', id: 'x' }) } }),
    ).getState();
    expect(phiEffEquals(phiEff(state), phiEff(otherFamily))).toBe(false);
    expect(isEffectiveChange(state, otherFamily)).toBe(true);
    const sameFamilyReordered = createCanonicalStore(
      init({ inspection: { ...futureFamily, canonicalIdentity: opaqueRef('CANONICAL_IDENTITY', { id: 'x', family: 'FUTURE_FAMILY' }) } }),
    ).getState();
    expect(phiEffEquals(phiEff(state), phiEff(sameFamilyReordered))).toBe(true);
  });

  it('a non-Reading analytical identity retains an IF_ref at ANALYTICAL_OBJECT depth (row 23, EX02-01)', () => {
    const material: InspectionRef = {
      canonicalIdentity: opaqueRef('CANONICAL_IDENTITY', { family: 'MATERIAL', id: 'M-27' }),
      contextualAppearance: opaqueRef('CONTEXTUAL_APPEARANCE', 'Ahmed-context'),
      version: opaqueRef('VERSION', 'v3'),
      depth: 'ANALYTICAL_OBJECT',
      lineage,
    };
    const state = createCanonicalStore(init({ inspection: material })).getState();
    expect(state.inspection?.depth).toBe('ANALYTICAL_OBJECT');
    expect(state.inspection?.contextualAppearance).toEqual(opaqueRef('CONTEXTUAL_APPEARANCE', 'Ahmed-context'));
    expect(isInspectionRef({ ...material, depth: 'READING' })).toBe(false);
  });

  it('the exact requested reference is retained through passive events and spatial acts (no silent rebind)', () => {
    const requested: InspectionRef = {
      canonicalIdentity: opaqueRef('CANONICAL_IDENTITY', 'thread-7'),
      version: opaqueRef('VERSION', 'future-version-not-yet-known-at-TC'),
      depth: 'SESSION',
      lineage,
    };
    const store = createCanonicalStore(init({ inspection: requested }));
    const inspection = store.getState().inspection;
    store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(9) });
    store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-9' }, atSp: SP(9) });
    store.dispatch({ type: 'PAN', to: { anchor: opaqueRef('WORLD_ANCHOR', 'a1') } });
    store.dispatch({ type: 'ZOOM_SEMANTIC', depth: 'SOURCE_PROVENANCE' });
    store.dispatch({ type: 'COMMIT_MOMENT', moment: SP(1) });
    expect(store.getState().inspection).toBe(inspection);
    expect(inspectionRefEquals(store.getState().inspection, requested)).toBe(true);
    expect(store.getState().history.every((entry) => entry.captured.ifRef === inspection)).toBe(true);
  });

  it('validates reference kinds and depth without interpreting opaque payloads', () => {
    expect(isInspectionRef({ canonicalIdentity: opaqueRef('VERSION', 'x'), depth: 'WORLD', lineage })).toBe(false);
    expect(isInspectionRef({ canonicalIdentity: opaqueRef('CANONICAL_IDENTITY', 'x'), depth: 'WORLD' })).toBe(false);
    expect(isInspectionRef({ canonicalIdentity: opaqueRef('CANONICAL_IDENTITY', 'x'), depth: 'WORLD', lineage, version: opaqueRef('LINEAGE', 'v') })).toBe(false);
    expect(isInspectionRef({ canonicalIdentity: opaqueRef('CANONICAL_IDENTITY', { any: 'shape', n: 1, ok: true, z: null }), depth: 'THREAD', lineage })).toBe(true);
    expect(() => opaqueRef('CANONICAL_IDENTITY', { nested: { not: 'allowed' } } as never)).toThrow(TypeError);
    expect(() => opaqueRef('CANONICAL_IDENTITY', { n: Number.NaN })).toThrow(TypeError);
    expect(() => opaqueRef('OBJECT_FAMILY' as never, 'x')).toThrow(TypeError);
  });
});
