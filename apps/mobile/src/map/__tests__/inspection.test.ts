import { effectiveTC, inspectionRefEquals } from '../../state';
import { disclosureFixture } from '../__fixtures__/disclosure';
import { contextOf, testStore } from '../__fixtures__/store';
import {
  decodeInspectionRef,
  inspectEntitled,
  inspectObject,
  resolveEntitledInspection,
  switchContext,
} from '../inspection';

const WORLD = [
  { id: 'thread-a', x: '0', y: '0' },
  { id: 'thread-b', x: '1000000', y: '0' },
];

const twoContexts = () =>
  disclosureFixture({
    depth: 'ANALYTICAL_OBJECT',
    threads: WORLD,
    appearances: [
      { bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 },
      { bindingId: 'binding-2', threadId: 'thread-b', readingId: 'reading-1', boundSp: 3 },
    ],
    readings: [{ id: 'reading-1', versionAtTc: 3 }, { id: 'reading-2' }],
    materials: [{ id: 'material-1' }],
  });

describe('INSPECT_OBJECT (M04-06)', () => {
  it('M04-06 — an effective inspection sets the exact IF_ref and appends exactly one checkpoint', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, twoContexts());
    const before = store.getState();

    const outcome = inspectObject(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } });
    expect(outcome.outcome).toBe('APPLIED');

    const after = store.getState();
    const decoded = decodeInspectionRef(after.inspection);
    expect(decoded).toMatchObject({ family: 'READING', id: 'reading-1', version: null, depth: 'ANALYTICAL_OBJECT' });
    expect(decoded?.appearance).toEqual({ kind: 'THREAD_READING', bindingId: 'binding-1' });
    expect(decoded?.lineage).toBe('WORLD/THREAD:thread-a/THREAD_READING:binding-1/READING:reading-1');
    expect(after.history).toHaveLength(1);
    expect(after.history[0].act).toBe('INSPECT_OBJECT');
    // No temporal movement, no LF write, and no camera move at all.
    expect(after.temporal).toEqual(before.temporal);
    expect(effectiveTC(after)).toBe(effectiveTC(before));
    expect(after.live).toBe(before.live);
    expect(after.camera).toBe(before.camera);
  });

  it('M04-06 — an identical inspection is a true no-op: no write, no checkpoint', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, twoContexts());
    inspectObject(store, context, { family: 'READING', id: 'reading-1' });
    const after = store.getState();

    expect(inspectObject(store, context, { family: 'READING', id: 'reading-1' })).toEqual({ outcome: 'NO_OP' });
    expect(store.getState()).toBe(after);
    expect(store.getState().history).toHaveLength(1);
  });

  it('M04-05 — a future, off-depth or unknown identity is refused even when its id is known', () => {
    const store = testStore({ depth: 'THREAD' });
    const context = contextOf(
      store,
      disclosureFixture({
        depth: 'THREAD',
        threads: WORLD,
        appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
        readings: [{ id: 'reading-1' }],
      }),
    );
    const before = store.getState();

    // Off-depth: the ANALYTICAL_OBJECT rung is withheld, so a Material is not admitted.
    expect(inspectObject(store, context, { family: 'MATERIAL', id: 'material-1' })).toMatchObject({ outcome: 'REJECTED', code: 'NOT_ENTITLED' });
    // Unknown at TC: a plausible identifier is still not part of K(TC).
    expect(inspectObject(store, context, { family: 'THREAD', id: 'thread-future' })).toMatchObject({ outcome: 'REJECTED', code: 'NOT_ENTITLED' });
    // A Reading disclosed only as the endpoint of an appearance is entitled with identity only.
    expect(inspectObject(store, context, { family: 'READING', id: 'reading-1' }).outcome).toBe('APPLIED');
    expect(decodeInspectionRef(store.getState().inspection)?.depth).toBe('THREAD');
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().temporal).toEqual(before.temporal);
  });

  it('a version beyond the then-current one is future truth and is refused; a known one is admitted', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, twoContexts());
    const future = resolveEntitledInspection(context.disclosure, { family: 'READING', id: 'reading-1', version: 4 });
    expect(future).toMatchObject({ ok: false, reason: 'VERSION_NOT_KNOWN_AT_TC' });
    const known = resolveEntitledInspection(context.disclosure, { family: 'READING', id: 'reading-1', version: 2 });
    expect(known.ok).toBe(true);
    if (!known.ok) return;
    expect(known.entitled.version).toBe(2);
  });

  it('a forged entitlement is not an entitlement: the brand is checked at runtime', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, twoContexts());
    const real = resolveEntitledInspection(context.disclosure, { family: 'READING', id: 'reading-1' });
    expect(real.ok).toBe(true);
    if (!real.ok) return;
    const forged = { ...real.entitled };
    expect(inspectEntitled(store, forged)).toMatchObject({ outcome: 'REJECTED', code: 'NOT_ENTITLED' });
    expect(store.getState().history).toHaveLength(0);
    expect(inspectEntitled(store, real.entitled).outcome).toBe('APPLIED');
  });
});

describe('SWITCH_CONTEXT (M04-07)', () => {
  it('M04-07 — the same identity through another entitled appearance succeeds as one checkpoint', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, twoContexts());
    inspectObject(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } });
    const afterInspect = store.getState();

    const outcome = switchContext(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-2' } });
    expect(outcome.outcome).toBe('APPLIED');

    const after = store.getState();
    const decoded = decodeInspectionRef(after.inspection);
    expect(decoded?.id).toBe('reading-1');
    expect(decoded?.appearance).toEqual({ kind: 'THREAD_READING', bindingId: 'binding-2' });
    expect(decoded?.lineage).toBe('WORLD/THREAD:thread-b/THREAD_READING:binding-2/READING:reading-1');
    // One canonical identity, never a duplicate; no temporal movement and no LF write.
    expect(after.inspection?.canonicalIdentity).toEqual(afterInspect.inspection?.canonicalIdentity);
    expect(after.temporal).toEqual(afterInspect.temporal);
    expect(after.live).toBe(afterInspect.live);
    expect(after.camera).toBe(afterInspect.camera);
    expect(after.history.map((entry) => entry.act)).toEqual(['INSPECT_OBJECT', 'SWITCH_CONTEXT']);
  });

  it('M04-07 — a context unavailable at TC fails closed and elects nothing in its place', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, twoContexts());
    inspectObject(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } });
    const after = store.getState();

    expect(switchContext(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-unknown' } })).toMatchObject({
      outcome: 'REJECTED',
      code: 'NOT_ENTITLED',
    });
    expect(store.getState()).toBe(after);
    expect(store.getState().history).toHaveLength(1);
  });

  it('the canonical identity must remain identical: a different object is not a context switch', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, twoContexts());
    inspectObject(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } });
    const after = store.getState();

    const outcome = switchContext(store, context, { family: 'READING', id: 'reading-2', appearance: { kind: 'THREAD_READING', bindingId: 'binding-2' } });
    expect(outcome).toMatchObject({ outcome: 'REJECTED' });
    expect(store.getState()).toBe(after);
    expect(store.getState().history).toHaveLength(1);
  });

  it('an identical context switch is a true no-op, and a switch without a named context is refused', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, twoContexts());
    inspectObject(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } });
    const after = store.getState();

    expect(switchContext(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } })).toEqual({ outcome: 'NO_OP' });
    expect(store.getState()).toBe(after);
    expect(switchContext(store, context, { family: 'READING', id: 'reading-1' })).toMatchObject({ outcome: 'REJECTED', code: 'INVALID_INPUT' });
    expect(store.getState().history).toHaveLength(1);
    expect(inspectionRefEquals(store.getState().inspection, after.inspection)).toBe(true);
  });
});
