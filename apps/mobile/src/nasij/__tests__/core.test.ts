// NASIJ (experimental, isolated) — the scene core's contracts.

import { canonicalWorldAddress } from '../../map/world';
import type { PublicFieldEntry } from '../../runtime-entry/public-field-api';
import type { SharedFieldEntry } from '../../runtime-entry/shared-field-api';
import { absenceOf } from '../core/absence';
import { FAR_UNITS_PER_POINT, fromFar, personalDrawList, publicScene, sharedScene, toFarX, toFarY } from '../core/adapters';
import { clampScale, depthOf, layerOpacities, matrixOf, project, stepFor, unproject, weaveOctaves, zoomAbout, type NasijCamera, type NasijView } from '../core/camera';
import { compileNasij, drawOpsAtRest, rungScale, type NasijSceneInput } from '../core/scene';

const ORIGIN = { x: 0n, y: 0n };
const VIEW: NasijView = { width: 390, height: 844, focusX: 195, focusY: 422 };
const address = (x: bigint, y: bigint) => { const a = canonicalWorldAddress(x, y); if (!a.ok) throw new Error('not canonical'); return a.address; };

/** 400 entries on a seeded lattice (the server's read bound), as the stress fixture builds them. */
function dense(count = 400): PublicFieldEntry[] {
  let seed = 20261114;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  return Array.from({ length: count }, (_unused, i) => {
    const cluster = i % 16;
    const cx = (cluster % 4 - 1.5) * 1_500_000; const cy = (Math.floor(cluster / 4) - 1.5) * 1_500_000;
    return { id: `dense-${i}`, address: address(BigInt(Math.round(cx + (rnd() - 0.5) * 900_000)), BigInt(Math.round(cy + (rnd() - 0.5) * 900_000))), meaning: `Stress entry ${i + 1}`, region: `c${cluster}` };
  });
}
const publicInput = (entries: PublicFieldEntry[], focusId: string | null = null): NasijSceneInput => publicScene({ entries, focusId, section: null, rtl: false }, ORIGIN);

describe('compileNasij', () => {
  it('is deterministic: the same input gives the same digest and the same list', () => {
    const a = compileNasij(publicInput(dense(), 'dense-7'));
    const b = compileNasij(publicInput(dense(), 'dense-7'));
    expect(b.digest).toBe(a.digest);
    expect(b).toEqual(a);
    expect(a.digest).toMatch(/^[0-9a-f]{8}$/u);
  });

  it('a different input gives a different digest', () => {
    expect(compileNasij(publicInput(dense(), 'dense-8')).digest).not.toBe(compileNasij(publicInput(dense(), 'dense-7')).digest);
    expect(compileNasij(publicInput(dense(399))).digest).not.toBe(compileNasij(publicInput(dense(400))).digest);
  });

  it('costs at most 16 draw operations at rest for a 400-entity Public scene, at every rung, focused or not', () => {
    for (const focusId of [null, 'dense-7']) {
      const list = compileNasij(publicInput(dense(), focusId));
      expect(list.layers).toHaveLength(3);
      for (let rung = 0; rung < 3; rung += 1) expect(drawOpsAtRest(list, rung)).toBeLessThanOrEqual(16);
    }
  });

  it('draws one layer per rung, each authored at its own rung size', () => {
    const list = compileNasij(publicInput(dense(8)));
    expect(list.layers.map((l) => l.rung)).toEqual([0, 1, 2]);
    // FAR has no object hit (a tap discloses the place under it); MID and NEAR offer every entry.
    expect(list.layers[0].hits).toHaveLength(0);
    expect(list.layers[1].hits).toHaveLength(8);
    expect(rungScale(2)).toBe(64);
  });

  it('gives a Shared field a woven border and a Public field none', () => {
    const shared: SharedFieldEntry[] = [{ id: 'a', address: address(0n, 0n), meaning: 'a', region: 'r' }, { id: 'b', address: address(819200n, 819200n), meaning: 'b', region: 'r' }];
    expect(compileNasij(sharedScene(shared, null, false, ORIGIN)).border.length).toBeGreaterThan(0);
    expect(compileNasij(publicInput(dense(4))).border).toHaveLength(0);
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

  it('shows one weave octave at a rung and two between', () => {
    expect(weaveOctaves(1)).toEqual([{ spacing: 26, alpha: 1 }]);
    expect(weaveOctaves(8)).toEqual([{ spacing: 26 / 8, alpha: 1 }]);
    expect(weaveOctaves(Math.pow(8, 0.5))).toHaveLength(2);
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

  it('says REGION_EMPTY, never WORLD_EMPTY, when a viewport read is empty but the world index is not (Problem 7)', () => {
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
    expect(toFarY(origin, a)).toBe(-5); // world +y is up; the cloth's y runs down
    expect(fromFar(origin, 3, -5)).toEqual({ x: a.x, y: a.y });
    // The same place relative to the true origin would not survive a float: the adapters never form that number.
    expect(Number(a.x) / FAR_UNITS_PER_POINT === Number(a.x + 1n) / FAR_UNITS_PER_POINT).toBe(true);
  });

  it('place every Public and Shared entry at exactly its served address', () => {
    const entries = dense(32);
    const input = publicInput(entries);
    input.entities.forEach((e, i) => {
      expect(e.x).toBe(Number(entries[i].address.x) / FAR_UNITS_PER_POINT);
      expect(e.y).toBe(-Number(entries[i].address.y) / FAR_UNITS_PER_POINT);
      expect(fromFar(ORIGIN, e.x, e.y)).toEqual({ x: entries[i].address.x, y: entries[i].address.y });
    });
    const shared = sharedScene([{ id: 's', address: address(-720000n, 630000n), meaning: 'm', region: 'r' }], 's', true, ORIGIN);
    expect(fromFar(ORIGIN, shared.entities[0].x, shared.entities[0].y)).toEqual({ x: -720000n, y: 630000n });
    expect(shared.rtl).toBe(true);
  });

  it('report an unheld Personal rung as unheld and give it no layer', () => {
    const held = compileNasij({ world: 'PERSONAL', rungs: 5, entities: [{ id: 'THREAD:t', kind: 'THREAD', x: 0, y: 0, dye: 0, label: null, fromRung: 0 }], focusId: null, rtl: false });
    const input: NasijSceneInput = { world: 'PERSONAL', rungs: 5, entities: [{ id: 'THREAD:t', kind: 'THREAD', x: 0, y: 0, dye: 0, label: null, fromRung: 0 }], focusId: null, rtl: false };
    const out = personalDrawList([input, null, input, null, null]);
    expect(out.held).toEqual([true, false, true, false, false]);
    expect(out.list.layers[1].batches).toHaveLength(0);
    expect(out.list.layers[0]).toEqual(held.layers[0]);
    expect(out.list.layers[2]).toEqual(held.layers[2]);
  });
});
