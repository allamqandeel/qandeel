/**
 * T-12 — A56…A64: `QAN-BL-T12-01`, the Original Inspection journey origin.
 *
 * The frozen Product copy is the specification: "Restores exactly the viewpoint this inspection
 * started from." So the origin is the checkpoint appended by the act that BEGAN the journey — not the
 * latest checkpoint, not the oldest, not a plausible ordinal, and not any later act inside the same
 * journey. Every case below is driven through the real executors against a real store.
 */
import { exactReturnTargetFor } from '../../orientation-chrome';
import { backOneStep, exactReturn, returnWorld } from '../../return-navigation';
import { inspectObject } from '../../map';
import { sessionPosition, type CanonicalStore } from '../../state';
import { contextAt, returnSurface, returnTestStore } from '../../return-navigation/__fixtures__/return';
import { TWO_CONTEXT_WORLD } from '../../orientation-chrome/__fixtures__/chrome';
import { createInspectionJourneyCoordinator } from '../journey/inspection-journey';
import { createCanonicalTransitionWitness } from '../motion/canonical-transition-witness';

const reader = (): CanonicalStore =>
  returnTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: sessionPosition(4) }, depth: 'ANALYTICAL_OBJECT' });

/** Runs one real act and reports it to the coordinator exactly as the composition does. */
function act(
  store: CanonicalStore,
  coordinator: ReturnType<typeof createInspectionJourneyCoordinator>,
  witness: ReturnType<typeof createCanonicalTransitionWitness>,
  run: () => { readonly outcome: string; readonly entry?: unknown },
) {
  const outcome = run();
  if (outcome.outcome === 'APPLIED') {
    coordinator.observeAct(store, witness.before(), witness.after(), (outcome.entry ?? null) as never);
  } else {
    coordinator.observeState(store, store.getState());
  }
  return outcome;
}

function journeyReader() {
  const store = reader();
  const coordinator = createInspectionJourneyCoordinator(1);
  const witness = createCanonicalTransitionWitness(store);
  const context = contextAt(TWO_CONTEXT_WORLD());
  const inspectAs = (id: string) => act(store, coordinator, witness, () => inspectObject(store, context, { family: 'THREAD', id }));
  return { store, coordinator, witness, context, inspectAs, surface: returnSurface(store) };
}

describe('T12-A56…A64 — the origin is the journey boundary, and nothing else', () => {
  it('T12-A58 — the act that begins a journey binds the viewpoint it began from', () => {
    const { store, coordinator, inspectAs } = journeyReader();
    const before = store.getState();
    expect(coordinator.origin()).toBeNull();

    expect(inspectAs('thread-a').outcome).toBe('APPLIED');
    const origin = coordinator.origin();
    expect(origin).not.toBeNull();

    // What it names is the PRE-act viewpoint: pressing Exact Return restores exactly that.
    const target = exactReturnTargetFor(store, origin);
    expect(target).not.toBeNull();
    exactReturn(returnSurface(store), target as NonNullable<typeof target>);
    expect(store.getState().inspection).toBe(before.inspection);
    expect(store.getState().camera).toEqual(before.camera);
  });

  it('T12-A63 — a later inspection CONTINUES the journey and never replaces its origin', () => {
    const { coordinator, inspectAs } = journeyReader();
    inspectAs('thread-a');
    const first = coordinator.origin();
    expect(first).not.toBeNull();

    inspectAs('thread-b');
    // Rebinding here would silently turn Exact Return into a second Back One Step.
    expect(coordinator.origin()).toBe(first);
  });

  it('T12-A57 — a Return-to-World checkpoint can never become an origin', () => {
    const { store, coordinator, witness } = journeyReader();
    act(store, coordinator, witness, () => returnWorld(returnSurface(store)) as never);
    expect(store.getState().history).toHaveLength(1);
    // A perfectly valid, current, same-store checkpoint — and not an inspection at all.
    expect(coordinator.origin()).toBeNull();
  });

  it('T12-A60, T12-A61 — a consumed origin disappears forever, and history regrowth cannot revive it', () => {
    const { store, coordinator, inspectAs } = journeyReader();
    inspectAs('thread-a');
    const origin = coordinator.origin();
    const target = exactReturnTargetFor(store, origin);
    exactReturn(returnSurface(store), target as NonNullable<typeof target>);
    // Consumed: T-07 no longer records the entry, so the opportunity is gone at the source.
    expect(exactReturnTargetFor(store, origin)).toBeNull();

    // Regrow history well past the old ordinal. An ordinal-based rule would resurrect it here.
    const { context } = journeyReader();
    for (const id of ['thread-a', 'thread-b', 'thread-a']) inspectObject(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'THREAD', id });
    expect(store.getState().history.length).toBeGreaterThan(1);
    expect(exactReturnTargetFor(store, origin)).toBeNull();
    expect(context).toBeDefined();
  });

  it('T12-A64 — the journey ends when the reader stops inspecting, and the origin goes with it', () => {
    const { store, coordinator, witness, inspectAs } = journeyReader();
    inspectAs('thread-a');
    expect(coordinator.origin()).not.toBeNull();

    // Return to World is deliberately NOT the end of a journey: T-07 moves the camera to World/Z0
    // and explicitly does not erase `IF_ref`, so the reader is still inspecting and the origin still
    // means what it said. Treating a spatial return as the end would have retired a live origin.
    act(store, coordinator, witness, () => returnWorld(returnSurface(store)) as never);
    expect(store.getState().inspection).not.toBeNull();
    expect(coordinator.origin()).not.toBeNull();

    // What ends it is `IF_ref` returning to nothing. Backing out of the spatial return first, and
    // then out of the inspection itself, restores the pre-inspection viewpoint — so the reader is no
    // longer inspecting and the origin is dropped rather than left to attach itself to whatever they
    // do next. Two steps, because Return to World recorded one of its own.
    act(store, coordinator, witness, () => backOneStep(returnSurface(store)) as never);
    expect(store.getState().inspection).not.toBeNull();
    act(store, coordinator, witness, () => backOneStep(returnSurface(store)) as never);
    expect(store.getState().inspection).toBeNull();
    expect(coordinator.origin()).toBeNull();
  });

  it('T12-A59, T12-A62 — an origin is bound to ONE store and one generation', () => {
    const { store, coordinator, inspectAs } = journeyReader();
    inspectAs('thread-a');
    const origin = coordinator.origin();
    expect(origin).not.toBeNull();

    // A different store never sees it, however valid it is in its own.
    const other = reader();
    expect(exactReturnTargetFor(other, origin)).toBeNull();
    // And the coordinator drops it the moment the store it watches is replaced.
    coordinator.observeState(other, other.getState());
    expect(coordinator.origin()).toBeNull();
    expect(store).not.toBe(other);
  });

  it('T12-A56 — a Back One Step checkpoint is not an origin either', () => {
    const { store, coordinator, witness, inspectAs } = journeyReader();
    inspectAs('thread-a');
    inspectAs('thread-b');
    const held = coordinator.origin();
    expect(held).not.toBeNull();

    // Back consumes; it never appends, so it can record no origin — and it does not disturb the one
    // the journey already has while the reader is still inspecting.
    act(store, coordinator, witness, () => backOneStep(returnSurface(store)) as never);
    expect(store.getState().inspection).not.toBeNull();
    expect(coordinator.origin()).toBe(held);
  });

  it('an act that applied but appended nothing yields no origin rather than a nearby substitute', () => {
    const store = reader();
    const coordinator = createInspectionJourneyCoordinator(1);
    const witness = createCanonicalTransitionWitness(store);
    const context = contextAt(TWO_CONTEXT_WORLD());
    const outcome = inspectObject(store, context, { family: 'THREAD', id: 'thread-a' });
    expect(outcome.outcome).toBe('APPLIED');
    // The composition would pass the real entry; passing none must produce nothing at all.
    coordinator.observeAct(store, witness.before(), witness.after(), null);
    expect(coordinator.origin()).toBeNull();
  });
});
