// COSMOS (experimental, isolated) — the stage core's contracts.

import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { deriveMapSceneFromDisclosure } from '../../map/projection/map-scene';
import { canonicalWorldAddress } from '../../map/world';
import type { PublicFieldEntry, SharedFieldEntry } from '../../runtime-entry';
import { absenceOf } from '../core/absence';
import { FAR_UNITS_PER_POINT, PERSONAL_DEPTHS, fromFar, personalDrawList, personalScene, publicScene, sharedScene, toFarX, toFarY } from '../core/adapters';
import { clampScale, depthOf, layerOpacities, matrixOf, project, stepFor, unproject, zoomAbout, type NasijCamera, type NasijView } from '../core/camera';
import { SPRITE_STRIDE, TINT, compileStage, drawOpsAtRest, dyeOfId, rungScale, type SceneInput } from '../core/stage';
import { parseProofLink } from '../__validation__/measure';

const ORIGIN = { x: 0n, y: 0n };
const VIEW: NasijView = { width: 390, height: 844, focusX: 195, focusY: 422 };
const address = (x: bigint, y: bigint) => { const a = canonicalWorldAddress(x, y); if (!a.ok) throw new Error('not canonical'); return a.address; };

/** Labelled synthetic entries on a seeded lattice. Not real analysis; the ids and meanings say so. */
function entries(count: number): PublicFieldEntry[] {
  let seed = 20261114;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  return Array.from({ length: count }, (_unused, i) => {
    const cluster = i % 16;
    const cx = (cluster % 4 - 1.5) * 1_500_000; const cy = (Math.floor(cluster / 4) - 1.5) * 1_500_000;
    return { id: `fixture-${i}`, address: address(BigInt(Math.round(cx + (rnd() - 0.5) * 900_000)), BigInt(Math.round(cy + (rnd() - 0.5) * 900_000))), meaning: `Synthetic entry ${i + 1}`, region: `c${cluster}` };
  });
}
const publicInput = (list: PublicFieldEntry[], focusId: string | null = null, relatedIds: string[] = []): SceneInput => publicScene({ entries: list, focusId, relatedIds, section: null, rtl: false }, ORIGIN);
const sharedEntries = (): SharedFieldEntry[] => entries(9).map((e) => ({ id: e.id, address: e.address, meaning: e.meaning, region: e.region }));

describe('compileStage', () => {
  it('is deterministic: the same input gives the same digest and the same stage', () => {
    const a = compileStage(publicInput(entries(64), 'fixture-7'));
    const b = compileStage(publicInput(entries(64), 'fixture-7'));
    expect(b.digest).toBe(a.digest);
    expect(b).toEqual(a);
    expect(a.digest).toMatch(/^[0-9a-f]{8}$/u);
  });

  it('a different input gives a different digest', () => {
    expect(compileStage(publicInput(entries(64), 'fixture-8')).digest).not.toBe(compileStage(publicInput(entries(64), 'fixture-7')).digest);
    expect(compileStage(publicInput(entries(63))).digest).not.toBe(compileStage(publicInput(entries(64))).digest);
  });

  it('builds one layer per rung with packed sprites, and a resting frame is one atlas draw plus the hairline sets', () => {
    const stage = compileStage(publicInput(entries(32), 'fixture-3'));
    expect(stage.layers.map((l) => l.rung)).toEqual([0, 1, 2]);
    for (const layer of stage.layers) expect(layer.sprites.length % SPRITE_STRIDE).toBe(0);
    // FAR offers no object hit (a tap discloses the place under it); MID offers every entry.
    expect(stage.layers[0].hits).toHaveLength(0);
    expect(stage.layers[1].hits).toHaveLength(32);
    expect(drawOpsAtRest(stage, 0)).toBe(1);
    expect(drawOpsAtRest(stage, 2)).toBe(1 + stage.layers[2].lines.length);
    expect(rungScale(2)).toBe(64);
  });

  it('gives a Shared world its membership horizon around every served place, and a Public world none', () => {
    const shared = compileStage(sharedScene(sharedEntries(), null, false, ORIGIN));
    expect(shared.horizon).not.toBeNull();
    const horizon = shared.horizon as NonNullable<typeof shared.horizon>;
    for (const e of sharedScene(sharedEntries(), null, false, ORIGIN).entities) expect(Math.hypot(e.x - horizon.cx, e.y - horizon.cy)).toBeLessThan(horizon.r);
    expect(compileStage(publicInput(entries(4))).horizon).toBeNull();
  });

  it('draws NO line between two Public or Shared entities when no relation was served', () => {
    // Unfocused: no line of any kind, at any rung.
    for (const stage of [compileStage(publicInput(entries(64))), compileStage(sharedScene(sharedEntries(), null, false, ORIGIN))]) {
      for (const layer of stage.layers) expect(layer.lines).toHaveLength(0);
    }
    // Focused with empty ties: only the ONE focused entity's gold instrument, never a strand in an entity's dye.
    for (const stage of [compileStage(publicInput(entries(64), 'fixture-7', [])), compileStage(sharedScene(sharedEntries(), 'fixture-3', false, ORIGIN))]) {
      for (const layer of stage.layers) for (const set of layer.lines) expect(set.tint).toBe(TINT.GOLD);
    }
    // A served relation of the focused Experience is the only strand: it appears at NEAR alone, in the focus's dye.
    const tied = compileStage(publicInput(entries(64), 'fixture-7', ['fixture-9']));
    expect(tied.layers[2].lines.some((set) => set.tint === dyeOfId('fixture-7'))).toBe(true);
    for (const rung of [0, 1]) for (const set of tied.layers[rung].lines) expect(set.tint).toBe(TINT.GOLD);
  });

  it('counts motes only from a served detail: none until served, exactly the count after', () => {
    const motes = (focusMotes: number | undefined) => {
      const stage = compileStage(publicScene({ entries: entries(8), focusId: 'fixture-2', section: null, focusMotes, rtl: false }, ORIGIN));
      const sp = stage.layers[2].sprites; let n = 0;
      for (let i = 0; i < sp.length; i += SPRITE_STRIDE) if (sp[i + 3] === 4) n += 1;
      return n;
    };
    expect(motes(undefined)).toBe(0);
    expect(motes(3)).toBe(3);
  });
});

describe('layerOpacities', () => {
  it('yields exactly one layer at every integer depth', () => {
    for (const rungs of [3, 5]) {
      for (let d = 0; d < rungs; d += 1) {
        const alphas = layerOpacities(d, rungs);
        expect(alphas).toHaveLength(rungs);
        expect(alphas.filter((a) => a === 1)).toHaveLength(1);
        expect(alphas.filter((a) => a === 0)).toHaveLength(rungs - 1);
        expect(alphas[d]).toBe(1);
      }
    }
  });

  it('cross-fades two neighbours between rungs and never shows a third', () => {
    for (let d = 0; d <= 2; d += 0.05) {
      const alphas = layerOpacities(d, 3);
      expect(alphas.filter((a) => a > 0).length).toBeLessThanOrEqual(2);
      expect(alphas.reduce((sum, a) => sum + a, 0)).toBeCloseTo(1, 10);
    }
  });

  it('never fades an unheld rung in: its held neighbour stays instead', () => {
    const held = [true, false, true];
    for (let d = 0; d <= 1; d += 0.02) {
      const alphas = layerOpacities(d, 3, held);
      expect(alphas[1]).toBe(0);
      expect(alphas[0]).toBe(1);
    }
    for (let d = 1.01; d <= 2; d += 0.02) {
      const alphas = layerOpacities(d, 3, held);
      expect(alphas[1]).toBe(0);
      expect(alphas[2]).toBe(1);
    }
  });

  it('clamps beyond the rungs (the rubber band shows the end rung)', () => {
    expect(layerOpacities(-0.3, 3)).toEqual([1, 0, 0]);
    expect(layerOpacities(2.3, 3)).toEqual([0, 0, 1]);
  });
});

describe('camera', () => {
  const camera: NasijCamera = { cx: 12.5, cy: -40, scale: 8 };
  it('projects and unprojects exactly', () => {
    const p = project(camera, VIEW, 20, -30);
    expect(unproject(camera, VIEW, p.x, p.y)).toEqual({ x: 20, y: -30 });
    expect(project(camera, VIEW, camera.cx, camera.cy)).toEqual({ x: VIEW.focusX, y: VIEW.focusY });
    const m = matrixOf(camera, VIEW);
    expect(m[0] * 20 + m[4]).toBeCloseTo(p.x, 9);
    expect(m[3] * -30 + m[5]).toBeCloseTo(p.y, 9);
  });

  it('keeps the world point under the fingers under them when zooming about a point', () => {
    const before = unproject(camera, VIEW, 100, 600);
    const zoomed = zoomAbout(camera, VIEW, 100, 600, 64);
    const after = unproject(zoomed, VIEW, 100, 600);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
    expect(zoomed.scale).toBe(64);
  });

  it('steps at the product threshold only, and holds the scale inside the rubber band', () => {
    expect(stepFor(1.125)).toBe('IN');
    expect(stepFor(1.12)).toBeNull();
    expect(stepFor(1 / 1.125)).toBe('OUT');
    expect(depthOf(64)).toBeCloseTo(2, 12);
    expect(clampScale(1e9, 3)).toBeCloseTo(Math.pow(8, 2.35), 9);
    expect(clampScale(1e-9, 3)).toBeCloseTo(Math.pow(8, -0.35), 9);
  });
});

describe('absenceOf', () => {
  const camera: NasijCamera = { cx: 0, cy: 0, scale: 8 };
  const far = [{ id: 'far', x: 500, y: 500 }];

  it('keeps the five facts apart', () => {
    expect(absenceOf({ status: 'LOADING', shown: [], worldIndex: null }, camera, VIEW).kind).toBe('LOADING');
    expect(absenceOf({ status: 'UNAVAILABLE', shown: [], worldIndex: null }, camera, VIEW).kind).toBe('UNAVAILABLE');
    expect(absenceOf({ status: 'REFUSED', shown: [], worldIndex: null }, camera, VIEW).kind).toBe('REFUSED');
    expect(absenceOf({ status: 'READY', shown: [], worldIndex: [] }, camera, VIEW).kind).toBe('WORLD_EMPTY');
    expect(absenceOf({ status: 'READY', shown: [{ id: 'here', x: 1, y: 1 }], worldIndex: far }, camera, VIEW).kind).toBe('NONE');
  });

  it('says REGION_EMPTY, never WORLD_EMPTY, when the view is empty but the world index is not', () => {
    const absence = absenceOf({ status: 'READY', shown: [], worldIndex: far }, camera, VIEW);
    expect(absence).toEqual({ kind: 'REGION_EMPTY', bearing: { dx: 500, dy: 500, id: 'far' } });
  });

  it('never calls the world empty without whole-world evidence', () => {
    expect(absenceOf({ status: 'READY', shown: [], worldIndex: null }, camera, VIEW)).toEqual({ kind: 'REGION_EMPTY', bearing: null });
  });

  it('points at the nearest entry the client was actually served', () => {
    const absence = absenceOf({ status: 'READY', shown: [], worldIndex: [{ id: 'a', x: 900, y: 0 }, { id: 'b', x: -300, y: 0 }] }, camera, VIEW);
    expect(absence.kind === 'REGION_EMPTY' && absence.bearing?.id).toBe('b');
  });
});

describe('adapters', () => {
  it('keep exact coordinates: integers are subtracted exactly and only the difference becomes a float', () => {
    const big = 2n ** 60n;
    const origin = { x: big, y: -big };
    const a = address(big + 8192n * 3n, -big + 8192n * 5n);
    expect(toFarX(origin, a)).toBe(3);
    expect(toFarY(origin, a)).toBe(-5); // world +y is up; the stage's y runs down
    expect(fromFar(origin, 3, -5)).toEqual({ x: a.x, y: a.y });
    // The same place relative to the true origin would not survive a float: the adapters never form that number.
    expect(Number(a.x) / FAR_UNITS_PER_POINT === Number(a.x + 1n) / FAR_UNITS_PER_POINT).toBe(true);
  });

  it('place every Public and Shared entry at exactly its served address', () => {
    const list = entries(32);
    const input = publicInput(list);
    input.entities.forEach((e, i) => {
      expect(e.x).toBe(Number(list[i].address.x) / FAR_UNITS_PER_POINT);
      expect(e.y).toBe(-Number(list[i].address.y) / FAR_UNITS_PER_POINT);
      expect(fromFar(ORIGIN, e.x, e.y)).toEqual({ x: list[i].address.x, y: list[i].address.y });
    });
    const shared = sharedScene([{ id: 's', address: address(-720000n, 630000n), meaning: 'm', region: 'r' }], 's', true, ORIGIN);
    expect(fromFar(ORIGIN, shared.entities[0].x, shared.entities[0].y)).toEqual({ x: -720000n, y: 630000n });
    expect(shared.rtl).toBe(true);
  });

  it("derive a Public Experience's dye from its id alone: not from its region, its section, its place or its neighbours", () => {
    const base: PublicFieldEntry = { id: 'fixture-a', address: address(0n, 0n), meaning: 'one', region: 'r1' };
    const moved: PublicFieldEntry = { id: 'fixture-a', address: address(5_000_000n, -3_000_000n), meaning: 'another meaning', region: 'r2', title: 'A title' };
    const alone = publicInput([base]).entities[0].dye;
    expect(alone).toBe(dyeOfId('fixture-a'));
    expect(publicInput([moved]).entities[0].dye).toBe(alone);
    expect(publicInput([...entries(40), base]).entities[40].dye).toBe(alone);
    expect(publicScene({ entries: [base], focusId: null, section: 'RELATIONSHIPS' as never, rtl: true }, ORIGIN).entities[0].dye).toBe(alone);
  });

  // RE-ANCHORED by COSMOS E-2 corrections, Slice A (Product Owner D-3 / D-4, 2026-11-20): the renderer still invents no
  // name; a Thread is labelled only with the name the SERVER disclosed for it, and a Reading never is.
  it('never invent a label for a Personal entity: a Thread carries only the server-disclosed name, a Reading none, at any depth', () => {
    const threads = [[0, 0, 1], [1, 0, 2], [-1, 1, 3]].map(([x, y, sp], i) => ({ id: `p-thread-${i}`, x: String(x * 1_000_000), y: String(y * 1_000_000), establishedSp: sp }));
    const appearances = [0, 0, 1, 2].map((t, i) => ({ bindingId: `p-binding-${t}-${i}`, threadId: `p-thread-${t}`, readingId: `p-reading-${t}-${i}`, boundSp: 4, current: i !== 1 }));
    const inputs = PERSONAL_DEPTHS.map((depth) => {
      const disclosure = disclosureFixture({ depth, sessionId: 'fixture-session', tc: 12, liveHead: 12, threads, appearances, readings: appearances.map((a) => ({ id: a.readingId })), focuses: [] });
      const derived = deriveMapSceneFromDisclosure(disclosure, { sessionId: 'fixture-session', tc: 12, depth } as never);
      if (derived.status !== 'SCENE') throw new Error('expected a scene');
      return personalScene(derived.scene, null, false, ORIGIN);
    });
    expect(inputs[0].entities.length).toBeGreaterThan(0);
    for (const input of inputs) for (const entity of input.entities) expect(entity.label).toBeNull();
    const { list, held } = personalDrawList(inputs);
    expect(held).toEqual([true, true, true, true, true]);
    for (const layer of list.layers) expect(layer.labels).toHaveLength(0);
    // With server-disclosed names: exactly the named Threads are labelled, with the served text; Readings never.
    const named = PERSONAL_DEPTHS.map((depth) => {
      const disclosure = disclosureFixture({ depth, sessionId: 'fixture-session', tc: 12, liveHead: 12, threads, appearances, readings: appearances.map((a) => ({ id: a.readingId })), focuses: [] });
      const derived = deriveMapSceneFromDisclosure(disclosure, { sessionId: 'fixture-session', tc: 12, depth } as never);
      if (derived.status !== 'SCENE') throw new Error('expected a scene');
      return personalScene(derived.scene, null, false, ORIGIN, new Map([['p-thread-1', 'مديري']]));
    });
    for (const input of named) for (const entity of input.entities) expect(entity.label).toBe(entity.id === 'THREAD:p-thread-1' ? 'مديري' : null);
    // Threads sit exactly at their served Homes.
    const home = inputs[0].entities.find((e) => e.id === 'THREAD:p-thread-1');
    expect(home && fromFar(ORIGIN, home.x, home.y)).toEqual({ x: 1_000_000n, y: 0n });
  });

  it('report an unheld Personal rung as unheld and give it no layer', () => {
    const input: SceneInput = { world: 'PERSONAL', rungs: 5, entities: [{ id: 'THREAD:t', kind: 'THREAD', x: 0, y: 0, dye: 0, label: null, fromRung: 0 }], focusId: null, rtl: false };
    const whole = compileStage(input);
    const out = personalDrawList([input, null, input, null, null]);
    expect(out.held).toEqual([true, false, true, false, false]);
    expect(out.list.layers[1].sprites).toHaveLength(0);
    expect(out.list.layers[1].lines).toHaveLength(0);
    expect(out.list.layers[0]).toEqual(whole.layers[0]);
    expect(out.list.layers[2]).toEqual(whole.layers[2]);
  });
});

describe('parseProofLink', () => {
  it('reads the proof scheme and nothing else', () => {
    expect(parseProofLink('qandeel-cosmos-proof://world/personal')).toEqual({ kind: 'world', world: 'PERSONAL' });
    expect(parseProofLink('qandeel-cosmos-proof://mode/no-bodies')).toEqual({ kind: 'mode', mode: 'NO_BODIES' });
    expect(parseProofLink('qandeel-cosmos-proof://mode/tile')).toBeNull();
    expect(parseProofLink('qandeel-cosmos-proof://step/in')).toEqual({ kind: 'step', direction: 'IN' });
    expect(parseProofLink('qandeel-cosmos-proof://step/out')).toEqual({ kind: 'step', direction: 'OUT' });
    expect(parseProofLink('qandeel-cosmos-proof://mode/plates')).toEqual({ kind: 'mode', mode: 'PLATES_ONLY' });
    expect(parseProofLink('qandeel-cosmos-proof://cycle/20')).toEqual({ kind: 'cycle', count: 20 });
    expect(parseProofLink('qandeel-cosmos-proof://cycle/0')).toBeNull();
    expect(parseProofLink('qandeel-cosmos-proof://world/constructor')).toBeNull();
    expect(parseProofLink('qandeel://world/personal')).toBeNull();
    expect(parseProofLink('qandeel-cosmos-proof://drift/off')).toEqual({ kind: 'drift', on: false });
  });
});
