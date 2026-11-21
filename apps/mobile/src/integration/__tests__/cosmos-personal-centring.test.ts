/**
 * COSMOS-INT-01 — the Personal target centring after a semantic zoom (Product Owner authorisation, 2026-11-16; contract
 * §18), headless over the PRODUCTION integration runtime. A pinch IN whose fingers rest on ONE disclosed mark is still
 * ONE `ZOOM_SEMANTIC` through `zoomSemanticStep`, taken about the point that brings that mark, where the next rung draws
 * it, to the usable centre. Everything else is the finger-anchored step exactly as before: no mark, two marks, OUT,
 * no aim (a double tap, the accessible route), a rung not held.
 */
import { harness, settle, SESSION_A } from '../__fixtures__/integration';
import { mapProjectionRequest } from '../../map';
import { viewportEnvelope, type ScreenPoint } from '../../map/camera';
import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import type { HistoricalSemanticDepth } from '../../projection';
import type { Responder } from '../../runtime-entry/__fixtures__/runtime-entry';
import { aimFixedPoint, createPersonalCosmosOwner, gestureFixedPoint, soleHit, viewOf, type CosmosWorldOwner } from '../../cosmos/product';
import { project, unproject, zoomAbout, type NasijCamera } from '../../cosmos/core/camera';
import { compileStage, rungScale } from '../../cosmos/core/stage';

const GLASS = viewportEnvelope(390, 844, { top: 104, bottom: 220 })!;
const VIEW = viewOf(GLASS);
/** The usable centre the view hands with a pinch: across, the glass centre; down, between the controls and the rail. */
const AIM: ScreenPoint = { x: VIEW.focusX, y: 300 };
const LIVE_HEAD = 6;
const projection: Responder = (request) => {
  const params = new URL(request.url).searchParams;
  return {
    status: 200,
    body: disclosureFixture({
      depth: (params.get('depth') ?? 'WORLD') as HistoricalSemanticDepth,
      sessionId: SESSION_A,
      tc: Number(params.get('tc') ?? LIVE_HEAD),
      liveHead: LIVE_HEAD,
      threads: [{ id: 'thread-a', x: '0', y: '0' }, { id: 'thread-b', x: '500000', y: '0' }],
      appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
      readings: [{ id: 'reading-1' }],
      focuses: [],
    }),
  };
};

/** One owner over a fresh production runtime, at WORLD, with every rung held and Thread A drawn off-centre. */
async function personal() {
  const h = await harness({ liveHead: LIVE_HEAD, projection });
  const runtime = h.ready();
  const outcomes: string[] = [];
  const owner = createPersonalCosmosOwner({ runtime, language: 'en', onOutcome: (outcome) => { outcomes.push(outcome.outcome); } });
  owner.setGlass(GLASS);
  const read = async () => {
    const request = mapProjectionRequest(runtime.store.getState());
    if (request !== null) await runtime.projection.ensure(request);
    for (let n = 0; n < 3; n += 1) await settle();
  };
  await read();
  // Thread A 120 points left of and 90 points above the camera's centre: an off-centre target.
  const a = hitOf(owner, 0, 'THREAD:thread-a');
  const s = owner.getSnapshot();
  expect(owner.goTo(a.x + 120 / s.camera.scale, a.y + 90 / s.camera.scale)).toBe(true);
  await read();
  outcomes.length = 0;
  const kinds = () => runtime.store.getState();
  return { h, runtime, owner, outcomes, read, kinds, done: () => { owner.dispose(); h.dispose(); } };
}

function hitOf(owner: CosmosWorldOwner, rung: number, id: string) {
  const hit = owner.getSnapshot().list.layers[rung]?.hits.find((h) => h.id === id);
  if (hit === undefined) throw new Error(`no ${id} at rung ${rung}`);
  return hit;
}
const screenOf = (owner: CosmosWorldOwner, rung: number, id: string) => { const hit = hitOf(owner, rung, id); return project(owner.getSnapshot().camera, VIEW, hit.x, hit.y); };
/** The camera a released pinch hands to the step (the fingers stood still: the rung's own camera). */
const releasedAt = (owner: CosmosWorldOwner): NasijCamera => owner.getSnapshot().camera;

describe('Personal target centring after a semantic zoom (PO, 2026-11-16; contract §18)', () => {
  it('a pinch IN on ONE disclosed mark is ONE applied ZOOM_SEMANTIC that lands the mark at the usable centre', async () => {
    const p = await personal();
    const fingers = screenOf(p.owner, 0, 'THREAD:thread-a');
    expect(Math.hypot(fingers.x - AIM.x, fingers.y - AIM.y)).toBeGreaterThan(100);
    const result = p.owner.step('IN', fingers, releasedAt(p.owner), AIM);
    // One act, applied, through the production authority; the settle keeps the gesture's anchor (it glides, no snap).
    expect(result).toEqual({ applied: true, aboutFingers: true });
    expect(p.outcomes).toEqual(['APPLIED']);
    expect(p.kinds().camera.depth).toBe('THREAD');
    await p.read();
    const landed = screenOf(p.owner, 1, 'THREAD:thread-a');
    expect(landed.x).toBeCloseTo(AIM.x, 0);
    expect(landed.y).toBeCloseTo(AIM.y, 0);
    p.done();
  });

  it('repeated zoom into the same mark needs no manual pan: it stays at the usable centre rung after rung; Back is one rung OUT as before', async () => {
    const p = await personal();
    p.owner.step('IN', screenOf(p.owner, 0, 'THREAD:thread-a'), releasedAt(p.owner), AIM);
    await p.read();
    for (const rung of [1, 2, 3]) {
      const fingers = screenOf(p.owner, rung, 'THREAD:thread-a');
      expect(p.owner.step('IN', fingers, releasedAt(p.owner), AIM).applied).toBe(true);
      await p.read();
      expect(p.owner.getSnapshot().rung).toBe(rung + 1);
      const landed = screenOf(p.owner, rung + 1, 'THREAD:thread-a');
      expect(Math.hypot(landed.x - AIM.x, landed.y - AIM.y)).toBeLessThan(0.5);
    }
    // The deepest rung refuses another step, centring or not.
    const last = screenOf(p.owner, 4, 'THREAD:thread-a');
    expect(p.owner.step('IN', last, releasedAt(p.owner), AIM).applied).toBe(false);
    expect(p.owner.back()).toBe(true);
    await p.read();
    expect(p.owner.getSnapshot().rung).toBe(3);
    p.done();
  });

  it('a Reading is centred where the NEXT rung draws it (its orbit is rung-relative), not where the fingers found it', async () => {
    const p = await personal();
    p.owner.step('IN', screenOf(p.owner, 0, 'THREAD:thread-a'), releasedAt(p.owner), AIM);
    await p.read();
    const reading = p.owner.getSnapshot().list.layers[1].hits.find((h) => h.id.startsWith('READING:'));
    expect(reading).toBeDefined();
    const fingers = project(p.owner.getSnapshot().camera, VIEW, reading!.x, reading!.y);
    expect(p.owner.step('IN', fingers, releasedAt(p.owner), AIM).applied).toBe(true);
    await p.read();
    const landed = screenOf(p.owner, 2, reading!.id);
    expect(Math.hypot(landed.x - AIM.x, landed.y - AIM.y)).toBeLessThan(0.5);
    p.done();
  });

  describe('the old pinch is unchanged wherever no unambiguous target is named', () => {
    /** The same gesture on two fresh runtimes, with and without the aim: the canonical cameras must be identical. */
    async function same(direction: 'IN' | 'OUT', at: (owner: CosmosWorldOwner) => ScreenPoint, setup?: (p: Awaited<ReturnType<typeof personal>>) => Promise<void>) {
      const runs = [];
      for (const aim of [null, AIM]) {
        const p = await personal();
        if (setup) await setup(p);
        const fingers = at(p.owner);
        const before = p.owner.getSnapshot().camera;
        const world = unproject(before, VIEW, fingers.x, fingers.y);
        const result = p.owner.step(direction, fingers, releasedAt(p.owner), aim);
        await p.read();
        runs.push({ result, camera: p.kinds().camera, after: p.owner.getSnapshot().camera, world, fingers });
        p.done();
      }
      expect(runs[1].result).toEqual(runs[0].result);
      expect(runs[1].camera).toEqual(runs[0].camera);
      return runs[1];
    }

    it('empty space: the step stays about the fingers (the world point under them stays under them)', async () => {
      const run = await same('IN', () => ({ x: 340, y: 600 }));
      expect(run.result.applied).toBe(true);
      const now = project(run.after, VIEW, run.world.x, run.world.y);
      expect(now.x).toBeCloseTo(run.fingers.x, 0);
      expect(now.y).toBeCloseTo(run.fingers.y, 0);
    });

    it('zoom OUT on a mark: no centring', async () => {
      await same('OUT', (owner) => screenOf(owner, 1, 'THREAD:thread-a'), async (p) => {
        p.owner.step('IN', null, null);
        await p.read();
      });
    });

    it('the refused step OUT at the first rung: refused either way, nothing written', async () => {
      const run = await same('OUT', (owner) => screenOf(owner, 0, 'THREAD:thread-a'));
      expect(run.result).toEqual({ applied: false, aboutFingers: false });
    });

    it('a step without fingers (the accessible route) names no target even with an aim', async () => {
      const p = await personal();
      expect(p.owner.step('IN', null, null, AIM)).toEqual({ applied: true, aboutFingers: false });
      p.done();
    });
  });
});

describe('the centring helpers', () => {
  const camera: NasijCamera = { cx: 10, cy: -4, scale: 2 };
  it('aimFixedPoint: a step about the point it returns lands the target exactly on the aim', () => {
    const target = { x: -30, y: 25 };
    for (const [from, to] of [[1, 8], [8, 64]] as const) {
      const at = { ...camera, scale: from };
      const point = aimFixedPoint(at, VIEW, target, AIM, from, to)!;
      const after = zoomAbout(at, VIEW, point.x, point.y, to);
      const drawn = project(after, VIEW, target.x, target.y);
      expect(drawn.x).toBeCloseTo(AIM.x, 6);
      expect(drawn.y).toBeCloseTo(AIM.y, 6);
    }
    expect(aimFixedPoint(camera, VIEW, target, AIM, 8, 8)).toBeNull();
  });

  it('aimFixedPoint with the target already at the aim is the aim itself (a centred target is zoomed about itself)', () => {
    const at = { ...camera, scale: 8 };
    const target = unproject(at, VIEW, AIM.x, AIM.y);
    const point = aimFixedPoint(at, VIEW, target, AIM, 8, 64)!;
    expect(point.x).toBeCloseTo(AIM.x, 6);
    expect(point.y).toBeCloseTo(AIM.y, 6);
  });

  it('gestureFixedPoint is unchanged: a still pinch is taken about the fingers', () => {
    const at = { ...camera, scale: 1 };
    expect(gestureFixedPoint(at, at, VIEW, { x: 100, y: 200 }, 1, 8)).toEqual({ x: 100, y: 200 });
  });

  it('soleHit: one covering mark names it; none or two name nothing', () => {
    const stage = compileStage({
      world: 'PERSONAL', rungs: 5, focusId: null, rtl: false,
      entities: [
        { id: 'THREAD:a', kind: 'THREAD', x: 0, y: 0, dye: 0, label: null, fromRung: 0 },
        { id: 'THREAD:b', kind: 'THREAD', x: 30, y: 0, dye: 1, label: null, fromRung: 0 },
        { id: 'THREAD:c', kind: 'THREAD', x: 400, y: 0, dye: 2, label: null, fromRung: 0 },
      ],
    });
    const at: NasijCamera = { cx: 0, cy: 0, scale: 1 };
    const screen = (x: number, y: number) => project(at, VIEW, x, y);
    const c = screen(400, 0);
    expect(soleHit(stage, 0, at, VIEW, c.x, c.y)).toBe('THREAD:c');
    const between = screen(15, 0); // inside both A's and B's 26-point hits
    expect(soleHit(stage, 0, at, VIEW, between.x, between.y)).toBeNull();
    const nothing = screen(200, 160);
    expect(soleHit(stage, 0, at, VIEW, nothing.x, nothing.y)).toBeNull();
    expect(rungScale(1)).toBe(8);
  });
});
