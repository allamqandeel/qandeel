/**
 * T-08 R3-04 — "the original inspection" is never manufactured from an arbitrary checkpoint.
 *
 * Same-store provenance is necessary and T-07 proves it. It is NOT sufficient to call a checkpoint
 * the ORIGIN of an explicit inspection journey: a checkpoint recorded by Return to World is a
 * perfectly valid handle and is not an inspection at all, so a mint over an arbitrary target would
 * let a caller manufacture a Product capability whose name is false — which is exactly what the
 * earlier tests did when they bound a Return-World checkpoint and labelled it the original
 * inspection.
 *
 * ## What changed at T-12, and why this file got STRONGER rather than weaker
 *
 * R3 answered the defect by removing the mint from the public barrel. That stopped it, and it left
 * the legitimate journey binding with no route at all — the state `QAN-BL-T12-01` recorded, and the
 * reason the Exact Return control could never appear in the Product.
 *
 * T-12 §14 closes it at the mint instead. `bindExactReturnOrigin` now admits only a target T-07
 * confirms was recorded by an act that can BEGIN an explicit inspection journey, so the defect is
 * refused by construction and the capability can be public again.
 *
 * That turns this file from an absence check into a BEHAVIOURAL one, which is the stronger claim: it
 * no longer asserts that nobody can reach the mint, it demonstrates that reaching it with the exact
 * checkpoint R3-04 named produces nothing. An absence proof would have silently passed if the mint
 * had later been re-exported unchanged; this one cannot.
 *
 * The provenance and non-resurrection behaviour of a legitimately supplied origin is unchanged and is
 * proved in `exact-return.test.tsx`; this file guards the BOUNDARY.
 */
import { latestReturnCheckpoint, returnWorld } from '../../return-navigation';
import { sessionPosition, type CanonicalStore } from '../../state';
import * as barrel from '../index';
import { beginInspectionJourney, chromeStore, chromeSurface } from '../__fixtures__/chrome';

const reader = (): CanonicalStore =>
  chromeStore({ liveHead: 6, temporal: { kind: 'PINNED', at: sessionPosition(4) }, depth: 'ANALYTICAL_OBJECT' });

describe('R3-04 — the public surface offers no way to mint an Original Inspection', () => {
  it('75, 76 — a Return-to-World checkpoint is a valid handle and is refused as an origin', () => {
    const store = reader();
    returnWorld(chromeSurface(store));
    const target = latestReturnCheckpoint(store);

    // It is a real, current, same-store target: everything the old predicate asked for holds, and an
    // ordinal check would have accepted it outright.
    expect(target).not.toBeNull();
    expect(store.getState().history).toHaveLength(1);

    // And it is still not an inspection. The mint refuses it, so the Product capability whose name
    // would have been false cannot be constructed at all — through the barrel or anywhere else.
    expect(barrel.bindExactReturnOrigin(store, target)).toBeNull();
  });

  it('77, 78 — only a checkpoint a real inspection journey started from binds', () => {
    const store = reader();
    const origin = barrel.bindExactReturnOrigin(store, beginInspectionJourney(store));
    expect(origin).not.toBeNull();
    expect(barrel.isExactReturnOrigin(origin)).toBe(true);
    // The capability and its consumer-side helpers stay public alongside it.
    expect(typeof barrel.exactReturnTargetFor).toBe('function');
    expect(typeof barrel.isExactReturnOrigin).toBe('function');
  });

  it('the mint is the ONLY constructor on the barrel, and nothing else claims to make one', () => {
    // A second constructor is how the defect would come back: one narrow mint that checks the act,
    // beside a broad one that does not. There is exactly one, by name.
    expect(Object.keys(barrel).filter((name) => /^bind/u.test(name))).toEqual(['bindExactReturnOrigin']);
    for (const name of Object.keys(barrel)) {
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
    // Neither is a plausible checkpoint-shaped payload a caller could build by hand.
    const store = reader();
    for (const forgery of [{ index: 0 }, Object.freeze({ index: 0 }), null, undefined, 0, 'origin']) {
      expect(barrel.bindExactReturnOrigin(store, forgery)).toBeNull();
    }
  });
});
