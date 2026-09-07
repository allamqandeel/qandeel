/**
 * T-08 — A: the orientation dimensions stay separate and stay truthful.
 *
 * Every fact here is entailed by Class A alone, so it must remain correct with no projection at all,
 * and it must never be contradicted or coloured by what a disclosure happens to contain.
 */
import { CANONICAL_STATE_KEYS, sessionPosition } from '../../state';
import { orientationModel, type ChromeProjection } from '../model';
import { opportunity } from '../return-orientation';
import { chromeStore, fetched, historicalStore, projectionFor, TWO_CONTEXT_WORLD, world } from '../__fixtures__/chrome';

const NO_PROJECTION: ChromeProjection = { held: false, derivation: { status: 'PROJECTION_NOT_FETCHED' } };

describe('OC08-A — temporal orientation', () => {
  it('A1 — following Live is reported as following Live, at the authoritative Live Head', () => {
    const store = chromeStore({ liveHead: 6, temporal: { kind: 'FOLLOW_LIVE' } });
    const model = orientationModel(store, NO_PROJECTION);
    expect(model.temporal.mode).toBe('FOLLOW_LIVE');
    expect(model.temporal.at).toBe(6);
    expect(model.temporal.earlierThanLiveHead).toBe(false);
    expect(model.live.advancedWhileHistorical).toBe(false);
  });

  it('A2 — a pinned position behind Live is historical, and Live is reported as having continued', () => {
    const model = orientationModel(historicalStore(), NO_PROJECTION);
    expect(model.temporal.mode).toBe('PINNED');
    expect(model.temporal.at).toBe(4);
    expect(model.temporal.earlierThanLiveHead).toBe(true);
    expect(model.live.advancedWhileHistorical).toBe(true);
    expect(model.live.routeBackToLiveAvailable).toBe(true);
  });

  it('A3 — PINNED at the Live Head is NOT following Live, and returning to Live is still meaningful', () => {
    const store = chromeStore({ liveHead: 6, temporal: { kind: 'PINNED', at: sessionPosition(6) } });
    const model = orientationModel(store, NO_PROJECTION);
    expect(model.temporal.mode).toBe('PINNED');
    // The reader is at the same POSITION as Live, so nothing has continued past them...
    expect(model.temporal.earlierThanLiveHead).toBe(false);
    expect(model.live.advancedWhileHistorical).toBe(false);
    // ...but the MODE is the effect, and the two modes are different Product states.
    expect(opportunity(model.returns, 'RETURN_LIVE_HEAD').available).toBe(true);

    const following = orientationModel(chromeStore({ liveHead: 6, temporal: { kind: 'FOLLOW_LIVE' } }), NO_PROJECTION);
    expect(opportunity(following.returns, 'RETURN_LIVE_HEAD').available).toBe(false);
    expect(following.temporal).not.toEqual(model.temporal);
  });

  it('A4 — with no mirrored Live Head, no Live edge is invented and no Live act is offered', () => {
    const model = orientationModel(chromeStore({ liveHead: null }), NO_PROJECTION);
    expect(model.temporal.at).toBeNull();
    expect(model.temporal.liveHeadEstablished).toBe(false);
    expect(model.live.liveEstablished).toBe(false);
    expect(model.live.routeBackToLiveAvailable).toBe(false);
    expect(model.live.advancedWhileHistorical).toBe(false);
    expect(opportunity(model.returns, 'RETURN_LIVE_HEAD').available).toBe(false);
    expect(opportunity(model.returns, 'GO_LIVE_AND_LOCATE').available).toBe(false);
  });
});

describe('OC08-A — spatial orientation', () => {
  it('A5 — the depth is the canonical camera rung, whatever the disclosure contains', () => {
    const store = historicalStore();
    const rich = orientationModel(store, projectionFor(store, fetched(TWO_CONTEXT_WORLD())));
    const bare = orientationModel(
      store,
      projectionFor(store, fetched(world({ depth: 'ANALYTICAL_OBJECT', tc: 4, liveHead: 6 }))),
    );
    expect(rich.spatial.depth).toBe(store.getState().camera.depth);
    expect(bare.spatial.depth).toBe(store.getState().camera.depth);
    expect(rich.spatial).toEqual(bare.spatial);
  });

  it('A6 — an empty disclosed viewport does not imply the camera is at the World viewpoint', () => {
    const store = historicalStore();
    // A disclosure with no Threads at all: a correct, sparse Map.
    const empty = projectionFor(store, fetched(world({ depth: 'ANALYTICAL_OBJECT', tc: 4, liveHead: 6 })));
    const model = orientationModel(store, empty);
    expect(model.projection.status).toBe('CURRENT');
    expect(model.spatial.atWorldViewpoint).toBe(false);
    expect(opportunity(model.returns, 'RETURN_WORLD').available).toBe(true);
  });
});

describe('OC08-A — inspection and the absence of new state', () => {
  it('A7 — inspecting nothing is neutral, and needs no projection to be knowable', () => {
    const store = historicalStore();
    for (const projection of [NO_PROJECTION, projectionFor(store, fetched(TWO_CONTEXT_WORLD()))]) {
      const model = orientationModel(store, projection);
      expect(model.inspection.requested).toBe(false);
      expect(model.inspection.render).toEqual({ kind: 'NO_INSPECTION' });
      expect(model.context.appearances).toEqual([]);
      expect(model.context.lineage).toEqual([]);
    }
  });

  it('A8 — building the model adds no canonical state and mutates nothing', () => {
    const store = historicalStore();
    const before = store.getState();
    const projection = projectionFor(store, fetched(TWO_CONTEXT_WORLD()));
    for (let index = 0; index < 5; index += 1) orientationModel(store, projection);
    const after = store.getState();
    expect(after).toBe(before);
    expect(Object.keys(after).sort()).toEqual([...CANONICAL_STATE_KEYS].sort());
    expect(after.history).toEqual([]);
  });

  it('A8b — the model is frozen through and through, so no consumer can edit the answer', () => {
    const store = historicalStore();
    const model = orientationModel(store, projectionFor(store, fetched(TWO_CONTEXT_WORLD())));
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.returns)).toBe(true);
    expect(Object.isFrozen(model.returns.opportunities)).toBe(true);
    for (const candidate of model.returns.opportunities) expect(Object.isFrozen(candidate)).toBe(true);
  });
});
