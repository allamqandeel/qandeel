// COSMOS (experimental, isolated) — the proof's owners, headless: the PRODUCTION controllers over the labelled fixtures.
//
// What this proves before any device runs the proof: each world's owner drives the shipped authority (the Public and
// Shared field controllers over the production clients and decoders; the production integration runtime, store and
// T-04 / T-06 / T-07 executors for Personal), reads the canonical camera back as the COSMOS target camera, and never
// mistakes an empty viewport read for an empty world (Problem 7).

import { absenceOf } from '../core/absence';
import type { NasijCamera, NasijView } from '../core/camera';
import { settle as flush } from '../../runtime-entry/__fixtures__/runtime-entry';
import type { CosmosFault } from '../__validation__/fixture-transports';
import { CARD_PEEK, createPersonalOwner, createPublicOwner, createSharedOwner, focusYOf, gestureFixedPoint, type CosmosWorldOwner } from '../__validation__/owners';

const W = 390; const H = 844;
const view = (owner: CosmosWorldOwner): NasijView => ({ width: W, height: H, focusX: W / 2, focusY: focusYOf(owner.getSnapshot(), H) });
const settle = async () => { for (let i = 0; i < 6; i += 1) await flush(); };
let owner: CosmosWorldOwner | null = null;
let fault: CosmosFault = 'NONE';
const options = (language: 'ar' | 'en' = 'en') => ({ language, fault: () => fault, latency: 0 });
const open = async (make: typeof createPublicOwner, language: 'ar' | 'en' = 'en') => {
  owner = make(options(language));
  owner.setView(W, H);
  owner.enter();
  await settle();
  return owner;
};
afterEach(() => { owner?.dispose(); owner = null; fault = 'NONE'; });

describe('the Public owner (createPublicFieldController over PublicFieldApiClient)', () => {
  it('enters the World as a whole at FAR and captures the whole-world index', async () => {
    const o = await open(createPublicOwner);
    const s = o.getSnapshot();
    expect(s.status).toBe('READY');
    expect(s.rung).toBe(0);
    expect(s.camera).toEqual({ cx: 0, cy: 0, scale: 1 });
    expect(s.entityCount).toBe(29);
    expect(s.worldIndex).toHaveLength(29);
    expect(s.list.layers).toHaveLength(3);
  });

  it('a FAR tap discloses that place at MID, centred on the tapped world point', async () => {
    const o = await open(createPublicOwner);
    const before = o.getSnapshot().camera;
    expect(o.tap(W / 2 + 80, H / 2 - 40, before)).toBe('FIELD');
    const s = o.getSnapshot();
    expect(s.rung).toBe(1);
    expect(s.camera.scale).toBe(8);
    expect(s.camera.cx).toBeCloseTo(80, 1);
    expect(s.camera.cy).toBeCloseTo(-40, 1);
  });

  it('says REGION_EMPTY with a bearing (never WORLD_EMPTY) when the viewport read is empty, and goes to the nearest', async () => {
    const o = await open(createPublicOwner);
    o.step('IN', null, null);
    expect(o.pan({ cx: 5000, cy: 5000, scale: 8 })).toBe(true);
    await settle();
    let s = o.getSnapshot();
    expect(s.camera.cx).toBeCloseTo(5000, 1);
    expect(s.entityCount).toBe(0); // the viewport read served nothing
    expect(s.worldIndex).toHaveLength(29); // and the whole-world evidence is untouched by it
    const absence = absenceOf({ status: s.status, shown: s.shown, worldIndex: s.worldIndex }, s.camera, view(o));
    expect(absence.kind).toBe('REGION_EMPTY');
    if (absence.kind !== 'REGION_EMPTY' || absence.bearing === null) throw new Error('expected a bearing');
    o.goTo(s.camera.cx + absence.bearing.dx, s.camera.cy + absence.bearing.dy);
    await settle();
    s = o.getSnapshot();
    expect(s.entityCount).toBeGreaterThan(0);
    expect(absenceOf({ status: s.status, shown: s.shown, worldIndex: s.worldIndex }, s.camera, view(o)).kind).toBe('NONE');
  });

  it('a step IN at MID focuses the place nearest the fingers at NEAR, lifts the focus point and serves the card', async () => {
    const o = await open(createPublicOwner);
    o.step('IN', null, null);
    await settle();
    const mid = o.getSnapshot();
    const target = mid.list.layers[1].hits[0];
    const at = { x: W / 2 + (target.x - mid.camera.cx) * 8, y: H / 2 + (target.y - mid.camera.cy) * 8 };
    const stepped = o.step('IN', at, mid.camera);
    expect(stepped).toEqual({ applied: true, aboutFingers: false });
    let s = o.getSnapshot();
    expect(s.rung).toBe(2);
    expect(s.focusId).toBe(target.id);
    expect(s.camera).toEqual({ cx: target.x, cy: target.y, scale: 64 });
    expect(focusYOf(s, H)).toBe((H - CARD_PEEK) / 2);
    expect(s.card?.status).toBe('LOADING');
    await settle();
    s = o.getSnapshot();
    expect(s.card?.status).toBe('SERVED');
    expect(s.card?.lines.length).toBeGreaterThan(0);
    expect(s.card?.meta).toContain('fixture-lamp-');
    expect(o.back()).toBe(true);
    s = o.getSnapshot();
    expect(s.rung).toBe(1);
    expect(s.focusId).toBeNull();
    expect(focusYOf(s, H)).toBe(H / 2);
  });

  it('a pinch step lands where the fingers left the cloth: the world point under them stays under them', async () => {
    const o = await open(createPublicOwner);
    const canonical = o.getSnapshot().camera;
    // The fingers pinched about (120, 500) to 5x: the presentation camera at release.
    const focal = { x: 120, y: 500 };
    const v = view(o);
    const worldUnder = { x: canonical.cx + (focal.x - v.focusX) / 1, y: canonical.cy + (focal.y - v.focusY) / 1 };
    const released: NasijCamera = { scale: 5, cx: worldUnder.x - (focal.x - v.focusX) / 5, cy: worldUnder.y - (focal.y - v.focusY) / 5 };
    expect(gestureFixedPoint(canonical, released, v, focal, 1, 8).x).toBeCloseTo(focal.x, 6);
    expect(o.step('IN', focal, released)).toEqual({ applied: true, aboutFingers: true });
    const s = o.getSnapshot();
    expect(s.rung).toBe(1);
    expect((worldUnder.x - s.camera.cx) * 8 + v.focusX).toBeCloseTo(focal.x, 0);
    expect((worldUnder.y - s.camera.cy) * 8 + v.focusY).toBeCloseTo(focal.y, 0);
  });

  it('keeps the four other absences apart: unavailable, refused, world empty, and slow details', async () => {
    fault = 'FAIL';
    let o = await open(createPublicOwner);
    expect(o.getSnapshot().status).toBe('UNAVAILABLE');
    o.dispose();
    fault = 'REFUSED';
    o = await open(createPublicOwner);
    expect(o.getSnapshot().status).toBe('REFUSED');
    o.dispose();
    fault = 'EMPTY_WORLD';
    o = await open(createPublicOwner);
    const s = o.getSnapshot();
    expect(s.status).toBe('READY');
    expect(s.worldIndex).toEqual([]);
    expect(absenceOf({ status: s.status, shown: s.shown, worldIndex: s.worldIndex }, s.camera, view(o)).kind).toBe('WORLD_EMPTY');
  });
});

describe('the Shared owner (createSharedFieldController over SharedWorldApiClient)', () => {
  it('opens World A, serves only places the reader may see in full, and reads a place with its sources', async () => {
    const o = await open(createSharedOwner);
    let s = o.getSnapshot();
    expect(s.status).toBe('READY');
    expect(s.entityCount).toBe(9); // the tenth rests on a line the reader cannot see
    expect(s.list.horizon).not.toBeNull(); // the membership horizon encloses every served place
    expect(o.tap(W / 2, H / 2, s.camera)).toBe('FIELD');
    s = o.getSnapshot();
    expect(s.rung).toBe(1);
    const target = s.list.layers[1].hits[0];
    o.focus(target.id);
    s = o.getSnapshot();
    expect(s.rung).toBe(2);
    expect(s.card?.status).toBe('LOADING');
    await settle();
    s = o.getSnapshot();
    expect(s.card?.status).toBe('SERVED');
    expect(s.card?.title).toBe('Postponing the talk about moving');
    expect(s.card?.lines).toEqual(['We keep postponing the talk about moving', 'Because every time we start, it turns into a fight']);
    expect(o.labelOf(target.id)).toBe('Postponing the talk about moving');
  });

  it('speaks Arabic when asked, and reports a refusal, a failure and an empty World apart', async () => {
    let o = await open(createSharedOwner, 'ar');
    expect(o.labelOf(o.getSnapshot().list.layers[1].hits[0].id)).toBe('تأجيل الحديث عن الانتقال');
    o.dispose();
    fault = 'REFUSED';
    o = await open(createSharedOwner);
    expect(o.getSnapshot().status).toBe('REFUSED');
    o.dispose();
    fault = 'FAIL';
    o = await open(createSharedOwner);
    expect(o.getSnapshot().status).toBe('UNAVAILABLE');
    o.dispose();
    fault = 'EMPTY_WORLD';
    o = await open(createSharedOwner);
    const s = o.getSnapshot();
    expect(absenceOf({ status: s.status, shown: s.shown, worldIndex: s.worldIndex }, s.camera, view(o)).kind).toBe('WORLD_EMPTY');
  });
});

describe('the Personal owner (the production integration runtime over the VPORT-01 world)', () => {
  it('holds all five rungs, steps through the production executor and inspects a mark without moving the camera', async () => {
    const o = await open(createPersonalOwner);
    let s = o.getSnapshot();
    expect(s.status).toBe('READY');
    expect(s.rungs).toBe(5);
    expect(s.held).toEqual([true, true, true, true, true]);
    expect(s.rung).toBe(0);
    expect(s.camera).toEqual({ cx: 0, cy: 0, scale: 1 });
    expect(s.time).toMatchObject({ liveHead: 12, tc: 12, pinned: false });
    expect(s.list.layers[0].hits.length).toBe(8); // eight Thread Homes
    expect(s.worldIndex).toHaveLength(8);

    expect(o.step('IN', null, null).applied).toBe(true);
    await settle();
    s = o.getSnapshot();
    expect(s.rung).toBe(1);
    expect(s.camera.scale).toBe(8);

    const home = s.list.layers[1].hits.find((h) => h.id.startsWith('THREAD:'));
    if (home === undefined) throw new Error('expected a Thread Home');
    const before = s.camera;
    const v = view(o);
    expect(o.tap(v.focusX + (home.x - before.cx) * 8, v.focusY + (home.y - before.cy) * 8, before)).toBe('FOCUS');
    s = o.getSnapshot();
    expect(s.focusId).toBe(home.id);
    expect(s.camera).toEqual(before); // inspection writes no camera
    expect(s.card).toEqual({ status: 'SERVED', title: 'Thread', meta: 'At its permanent place', lines: ['This view does not cover what you are inspecting.'] });
    expect(focusYOf(s, H)).toBe(H / 2);
    expect(o.back()).toBe(true); // production Back: the inspection is undone
    expect(o.getSnapshot().focusId).toBeNull();
  });

  it('pans by one canonical PAN and commits a Moment and the Live Edge through the production temporal API', async () => {
    const o = await open(createPersonalOwner);
    expect(o.pan({ cx: 30, cy: -20, scale: 1 })).toBe(true);
    let s = o.getSnapshot();
    expect(s.camera.cx).toBeCloseTo(30, 2);
    expect(s.camera.cy).toBeCloseTo(-20, 2);
    o.commitMoment?.(3);
    await settle();
    s = o.getSnapshot();
    expect(s.time).toMatchObject({ liveHead: 12, tc: 3, pinned: true });
    expect(s.status).toBe('READY');
    o.goLive?.();
    await settle();
    expect(o.getSnapshot().time).toMatchObject({ tc: 12, pinned: false });
  });

  it('reports a failed read, a refusal and an empty world apart', async () => {
    fault = 'FAIL';
    let o = await open(createPersonalOwner);
    expect(o.getSnapshot().status).toBe('UNAVAILABLE');
    o.dispose();
    fault = 'REFUSED';
    o = await open(createPersonalOwner);
    expect(o.getSnapshot().status).toBe('REFUSED');
    o.dispose();
    fault = 'EMPTY_WORLD';
    o = await open(createPersonalOwner);
    const s = o.getSnapshot();
    expect(s.status).toBe('READY');
    expect(absenceOf({ status: s.status, shown: s.shown, worldIndex: s.worldIndex }, s.camera, view(o)).kind).toBe('WORLD_EMPTY');
  });
});
