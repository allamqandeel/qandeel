/**
 * T-12 — A65…A75: `QAN-BL-MOT-02`, the exact composite spatial cause.
 *
 * The required property is one exact transition, one owner generation, one shot, invalidated by a
 * stale, replacement or intervening act, and never borrowed by an unrelated camera action. Every one
 * of those is asserted below against real `GO_LIVE_AND_LOCATE` executions, and the two that a
 * plausible-looking implementation would get wrong are asserted first: a composite that only went
 * Live moved no camera and must arm nothing, and a binding must be consumed by the QUESTION rather
 * than by a matching answer, or an intervening act leaves it lying around to be borrowed.
 */
import { goLiveAndLocate, returnWorld } from '../../return-navigation';
import { panByTranslation } from '../../map';
import { cameraIntentEquals, sessionPosition, type CanonicalStore } from '../../state';
import { contextAt, providing, providingNothing, returnSurface, returnTestStore } from '../../return-navigation/__fixtures__/return';
import { TWO_CONTEXT_WORLD } from '../../orientation-chrome/__fixtures__/chrome';
import { createSpatialCauseBinding } from '../motion/spatial-cause';
import { createCanonicalTransitionWitness } from '../motion/canonical-transition-witness';

/** A pinned reader whose Live Focus is disclosed, so the composite's spatial half can land. */
const reader = (): CanonicalStore =>
  returnTestStore({
    liveHead: 6,
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    depth: 'ANALYTICAL_OBJECT',
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
  });

function composite() {
  const store = reader();
  const binding = createSpatialCauseBinding(1);
  const witness = createCanonicalTransitionWitness(store);
  const live = contextAt(TWO_CONTEXT_WORLD({ tc: 6, liveHead: 6 }));
  /** Runs the real composite act and arms exactly as the composition does. */
  const goLive = (provider = providing(live)) => {
    const outcome = goLiveAndLocate(returnSurface(store), { liveContext: provider });
    const armed = outcome.outcome === 'APPLIED' ? binding.arm(store, witness.before(), witness.after()) : false;
    return { outcome, armed };
  };
  return { store, binding, witness, live, goLive };
}

describe('T12-A65…A75 — one exact transition, one shot, never borrowed', () => {
  it('T12-A65, T12-A71 — a legitimate landing arms the exact destination, and it is consumed once', () => {
    const { store, binding, goLive } = composite();
    const { outcome, armed } = goLive();
    expect(outcome.outcome).toBe('APPLIED');
    expect(armed).toBe(true);

    const destination = store.getState().camera;
    expect(binding.take(store, destination)).toBe('GO_LIVE_AND_LOCATE');
    // One shot: the same transition asked again is no longer a composite.
    expect(binding.take(store, destination)).toBeNull();
    expect(binding.isArmed()).toBe(false);
  });

  it('T12-A66 — a composite with no landing arms nothing, however APPLIED it is', () => {
    const { store, binding, goLive } = composite();
    const before = store.getState().camera;
    // The live projection is not held, so the temporal half stands alone. The act is still effective
    // — `TM` changed — and `locate` still reports a status, which is exactly why arming on the
    // outcome rather than on the camera would give a beat to a transition that never happens.
    const { outcome, armed } = goLive(providingNothing);
    expect(outcome.outcome).toBe('APPLIED');
    expect(cameraIntentEquals(before, store.getState().camera)).toBe(true);
    expect(armed).toBe(false);
    expect(binding.isArmed()).toBe(false);
  });

  it('T12-A67 — already at the landing invents no travel', () => {
    const { store, binding, goLive } = composite();
    goLive();
    binding.take(store, store.getState().camera);
    const settled = store.getState().camera;

    // A second composite from the same viewpoint moves nothing: `Φ_eff` sees no change.
    const again = goLive();
    expect(cameraIntentEquals(settled, store.getState().camera)).toBe(true);
    expect(again.armed).toBe(false);
  });

  it('T12-A68, T12-A69 — an unrelated camera act retires the binding instead of borrowing it', () => {
    const { store, binding, goLive } = composite();
    expect(goLive().armed).toBe(true);

    // An intervening act publishes a DIFFERENT camera. The Map asks about THAT destination.
    const pan = panByTranslation(store, 24, 0);
    expect(pan.outcome).toBe('APPLIED');
    const unrelated = store.getState().camera;
    expect(binding.take(store, unrelated)).toBeNull();
    // And the question consumed it, so the act AFTER the intervening one cannot find it either.
    expect(binding.isArmed()).toBe(false);
  });

  it('T12-A70 — a replaced store can never satisfy a binding armed under the previous one', () => {
    const { store, binding, goLive } = composite();
    goLive();
    const destination = store.getState().camera;

    const replacement = reader();
    expect(binding.take(replacement, destination)).toBeNull();
  });

  it('T12-A70 — retirement drops the binding without consuming it', () => {
    const { store, binding, goLive } = composite();
    goLive();
    expect(binding.isArmed()).toBe(true);
    binding.retire();
    expect(binding.isArmed()).toBe(false);
    expect(binding.take(store, store.getState().camera)).toBeNull();
  });

  it('T12-A75 — an ordinary act never arms a composite beat', () => {
    const { store, binding, witness } = composite();
    const outcome = returnWorld(returnSurface(store));
    expect(outcome.outcome).toBe('APPLIED');
    // Return to World moves the camera — and it is not the composite, so nothing arms it. Only the
    // composition's own `GO_LIVE_AND_LOCATE` branch calls `arm` at all.
    expect(binding.isArmed()).toBe(false);
    expect(binding.take(store, witness.after().camera)).toBeNull();
  });

  it('T12-A72 — correctness depends on identity, never on a clock or an order', () => {
    const source = createSpatialCauseBinding.toString();
    for (const forbidden of ['Date.now', 'setTimeout', 'performance.now', 'timestamp', 'expires']) {
      expect(source.includes(forbidden)).toBe(false);
    }
  });

  it('a binding built for another generation answers nothing', () => {
    const { store, witness, goLive } = composite();
    goLive();
    const other = createSpatialCauseBinding(2);
    // Nothing was armed in the other generation, so there is nothing for it to answer with.
    expect(other.take(store, witness.after().camera)).toBeNull();
  });
});
