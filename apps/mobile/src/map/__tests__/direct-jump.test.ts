import { effectiveTC } from '../../state';
import { disclosureFixture } from '../__fixtures__/disclosure';
import { contextOf, testStore } from '../__fixtures__/store';
import { directJump, decodeInspectionRef, entitledLoci, inspectObject } from '../inspection';
import { canonicalCoordinateText, decodeSpatialDestinationRef, decodeWorldAnchorRef } from '../world';

const WORLD = [
  { id: 'thread-a', x: '0', y: '0' },
  { id: 'thread-b', x: '5000000', y: '-7000000' },
];

const oneContext = () =>
  disclosureFixture({
    depth: 'ANALYTICAL_OBJECT',
    threads: WORLD,
    appearances: [{ bindingId: 'binding-1', threadId: 'thread-b', readingId: 'reading-1', boundSp: 2 }],
    readings: [{ id: 'reading-1' }, { id: 'reading-orphan' }],
  });

const manyContexts = () =>
  disclosureFixture({
    depth: 'ANALYTICAL_OBJECT',
    threads: WORLD,
    appearances: [
      { bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 },
      { bindingId: 'binding-2', threadId: 'thread-b', readingId: 'reading-1', boundSp: 3 },
    ],
    readings: [{ id: 'reading-1' }],
  });

describe('DIRECT_JUMP (M04-08, M04-09)', () => {
  it('M04-08 — a unique locus lands the exact IF_ref and the camera in ONE effective transaction', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, oneContext());
    const before = store.getState();

    const outcome = directJump(store, context, { family: 'READING', id: 'reading-1' });
    expect(outcome.outcome).toBe('APPLIED');

    const after = store.getState();
    expect(decodeInspectionRef(after.inspection)).toMatchObject({ family: 'READING', id: 'reading-1' });

    const anchor = decodeWorldAnchorRef(after.camera.anchor);
    expect(anchor.ok).toBe(true);
    if (!anchor.ok) return;
    // The landing anchor is the host Thread's own permanent Home, exactly.
    expect(`${canonicalCoordinateText(anchor.address.x)},${canonicalCoordinateText(anchor.address.y)}`).toBe('5000000,-7000000');

    const destination = after.camera.destination === undefined ? null : decodeSpatialDestinationRef(after.camera.destination);
    expect(destination?.ok).toBe(true);
    if (!destination?.ok) return;
    expect(destination.value).toMatchObject({ locus: 'CONTEXTUAL_APPEARANCE', threadId: 'thread-b', bindingId: 'binding-1' });

    // ONE transaction, therefore exactly one checkpoint; no temporal movement and no LF write.
    expect(after.history.map((entry) => entry.act)).toEqual(['DIRECT_JUMP']);
    expect(after.temporal).toEqual(before.temporal);
    expect(effectiveTC(after)).toBe(effectiveTC(before));
    expect(after.live).toBe(before.live);
    expect(after.camera.depth).toBe(before.camera.depth);
  });

  it('the landing retains the contextual route, so the target is not an isolated floating object', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, oneContext());
    directJump(store, context, { family: 'READING', id: 'reading-1' });
    expect(decodeInspectionRef(store.getState().inspection)?.lineage).toBe('WORLD/THREAD:thread-b/THREAD_READING:binding-1/READING:reading-1');
  });

  it('M04-09 — several legitimate loci and no explicit choice: no selection, no state, no RH', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, manyContexts());
    const before = store.getState();

    const outcome = directJump(store, context, { family: 'READING', id: 'reading-1' });
    expect(outcome.outcome).toBe('CONTEXT_SELECTION_REQUIRED');
    if (outcome.outcome !== 'CONTEXT_SELECTION_REQUIRED') return;
    expect(outcome.loci.map((locus) => locus.key).sort()).toEqual([
      'READING:reading-1@THREAD_READING:binding-1',
      'READING:reading-1@THREAD_READING:binding-2',
    ]);

    // Nothing was written and nothing was recorded.
    expect(store.getState()).toBe(before);
    expect(store.getState().inspection).toBeNull();
    expect(store.getState().camera).toBe(before.camera);
    expect(store.getState().history).toHaveLength(0);
  });

  it('M04-09 — an explicit entitled choice completes the jump; a forged one does not', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, manyContexts());
    const loci = entitledLoci(context.scene, 'READING', 'reading-1');
    expect(loci).toHaveLength(2);

    const forged = { ...loci[1] };
    expect(directJump(store, context, { family: 'READING', id: 'reading-1', locus: forged })).toMatchObject({ outcome: 'REJECTED', code: 'INVALID_INPUT' });
    expect(store.getState().history).toHaveLength(0);

    expect(directJump(store, context, { family: 'READING', id: 'reading-1', locus: loci[1] }).outcome).toBe('APPLIED');
    const destination = store.getState().camera.destination;
    const decoded = destination === undefined ? null : decodeSpatialDestinationRef(destination);
    expect(decoded?.ok && decoded.value.bindingId).toBe('binding-2');
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['DIRECT_JUMP']);
  });

  it('naming a disclosed appearance identifies the locus without any selection step', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, manyContexts());
    const outcome = directJump(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } });
    expect(outcome.outcome).toBe('APPLIED');
    const anchor = decodeWorldAnchorRef(store.getState().camera.anchor);
    expect(anchor.ok && canonicalCoordinateText(anchor.address.x)).toBe('0');
  });

  it('a target with no legitimate locus is refused: nothing invents a landing for it', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, oneContext());
    const before = store.getState();
    expect(directJump(store, context, { family: 'READING', id: 'reading-orphan' })).toMatchObject({ outcome: 'REJECTED', code: 'NOT_LOCATABLE' });
    expect(directJump(store, context, { family: 'MATERIAL', id: 'material-x' })).toMatchObject({ outcome: 'REJECTED' });
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('a landing depth the held projection was not disclosed at is refused, never guessed', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, oneContext());
    expect(directJump(store, context, { family: 'THREAD', id: 'thread-a', depth: 'WORLD' })).toMatchObject({
      outcome: 'REJECTED',
      code: 'PROJECTION_NOT_AVAILABLE',
    });
    expect(store.getState().history).toHaveLength(0);
  });

  it('a jump onto the place already inspected and looked at is a true no-op', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, oneContext());
    expect(directJump(store, context, { family: 'READING', id: 'reading-1' }).outcome).toBe('APPLIED');
    const after = store.getState();
    expect(directJump(store, context, { family: 'READING', id: 'reading-1' })).toEqual({ outcome: 'NO_OP' });
    expect(store.getState()).toBe(after);
    expect(store.getState().history).toHaveLength(1);
  });

  it('an ordinary inspection never smuggles a locate: it leaves the camera object-identical', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, oneContext());
    const before = store.getState();
    expect(inspectObject(store, context, { family: 'READING', id: 'reading-1' }).outcome).toBe('APPLIED');
    expect(store.getState().camera).toBe(before.camera);
    expect(store.getState().camera.destination).toBeUndefined();
  });
});
