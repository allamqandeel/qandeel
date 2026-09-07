/**
 * T-08 R3-04 — "the original inspection" is consumed, never manufactured.
 *
 * Same-store provenance is necessary and T-07 proves it. It is NOT sufficient to call a checkpoint
 * the ORIGIN of an explicit inspection journey: a checkpoint recorded by Return to World is a
 * perfectly valid handle and is not an inspection at all, so a public mint over an arbitrary target
 * would let any caller manufacture a Product capability whose name is false — which is exactly what
 * the earlier tests did when they bound a Return-World checkpoint and labelled it the original
 * inspection.
 *
 * T-08 is not app-shell integrated and owns no inspection-journey coordinator, so it cannot know
 * which checkpoint began the journey. The honest boundary is therefore consumer-only: the opaque
 * capability is public, the mint is not, and establishing the real origin at the real journey
 * boundary is explicitly the T-12 integration gate's.
 *
 * The provenance and non-resurrection behaviour of a legitimately supplied origin is unchanged and
 * is proved in `exact-return.test.tsx`; this file guards the BOUNDARY.
 */
import * as barrel from '../index';

describe('R3-04 — the public surface offers no way to mint an Original Inspection', () => {
  it('75, 76, 77, 78 — no arbitrary checkpoint target can be converted into an origin through the barrel', () => {
    // The capability and its consumer-side helpers are public...
    expect(typeof barrel.exactReturnTargetFor).toBe('function');
    expect(typeof barrel.isExactReturnOrigin).toBe('function');

    // ...and the mint is not. 77 and 78 follow structurally rather than by inspection: with no
    // public constructor, a non-inspection checkpoint and "the oldest checkpoint" are equally
    // unable to become a Product Original Inspection, because nothing outside this layer can build
    // an origin from a target at all.
    expect(barrel).not.toHaveProperty('bindExactReturnOrigin');
    for (const name of Object.keys(barrel)) {
      expect(name).not.toMatch(/^bind/u);
      expect(name).not.toMatch(/mint/iu);
    }
  });

  it('79, 80, 81 — the barrel exposes no checkpoint metadata, no history browser and no serialization', () => {
    for (const forbidden of [
      'returnCheckpoints',
      'latestReturnCheckpoint',
      'resolveCheckpointTarget',
      'checkpointCount',
      'serializeExactReturnOrigin',
      'exactReturnOriginToJSON',
    ]) {
      expect(barrel).not.toHaveProperty(forbidden);
    }
  });

  it('an origin that was never legitimately bound resolves to nothing, whatever it looks like', () => {
    // A structural look-alike is not an origin, so nothing can be pressed with it.
    for (const impostor of [{}, Object.freeze({}), { ORIGIN: true }, JSON.parse('{}')]) {
      expect(barrel.isExactReturnOrigin(impostor)).toBe(false);
    }
  });
});
