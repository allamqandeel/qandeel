/**
 * @jest-environment node
 */
// COSMOS (experimental, isolated) — the frame's parts, rasterised headlessly with CanvasKit (the same Skia, as wasm).
//
// What this proves WITHOUT a device: the very elements the device canvas mounts (`../skia/parts`) and the very
// instances `prepareStage` builds draw the intended picture: the white atlas is tinted (MODULATE) and added (PLUS),
// the sprite transforms land each sprite on its entity, the plates tile, the overdraw modes hide what they say.
// What it does NOT prove: anything about the phone's GPU, its frame pacing, or React Native Skia's native recorder
// (this run goes through RN Skia's JS recorder onto CanvasKit; the device goes through its C++ recorder). One known
// difference: this version's JS recorder hands an image shader's (filter, mipmap) to the CUBIC resampler, so the plates
// are slightly softer here than on a device, and a mip-mapped plate would not draw here at all.
//
// Set COSMOS_PIXELS_OUT=<dir> to keep the rendered PNGs.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TextDecoder } from 'node:util';

import type { SkImage, SkSurface } from '@shopify/react-native-skia';

import { SHARED_VIS_WORLD_A } from '../../integration/__validation__/shared-vis-proof-field';
import { fixtureField } from '../../integration/__validation__/s503b-visual-field';
import { canonicalWorldAddress } from '../../map/world';
import { publicScene, sharedScene } from '../core/adapters';
import { layerOpacities, depthOf, matrixOf, project, type NasijCamera, type NasijView } from '../core/camera';
import { compileStage, type Stage } from '../core/stage';
import { Lens, PlateFill, RungDraws, type OverdrawMode } from '../skia/parts';
import { disposePrepared, prepareStage } from '../skia/prepare';
import { plateMotions, plateOffsetOf, type PlateMotion } from '../skia/worklets';

jest.mock('@shopify/react-native-skia', () => {
  // The library's own headless entry, with its web (CanvasKit) parts in place of the native ones this preset resolves.
  const lib = '@shopify/react-native-skia/lib/commonjs';
  const noop = () => undefined;
  jest.mock(`${lib}/Platform`, () => ({ Platform: { OS: 'web', PixelRatio: 1, resolveAsset: noop, findNodeHandle: noop, View: noop } }));
  jest.mock(`${lib}/sksg/Container`, () => jest.requireActual(`${lib}/sksg/Container.web`));
  jest.mock(`${lib}/skia/Skia`, () => jest.requireActual(`${lib}/skia/Skia.web`));
  const headless = jest.requireActual(`${lib}/headless`);
  // CanvasKit is initialised in `beforeAll`; until then nothing may touch the Skia API, so it is reached lazily.
  const Skia = new Proxy({}, { get: (_target, key) => headless.getSkiaExports().Skia[key] });
  return { ...headless, Skia };
});

interface Headless {
  makeOffscreenSurface(width: number, height: number): SkSurface;
  drawOffscreen(surface: SkSurface, element: React.ReactNode): Promise<SkImage>;
  getSkiaExports(): { Skia: typeof import('@shopify/react-native-skia').Skia };
  Group: typeof import('@shopify/react-native-skia').Group;
  Fill: typeof import('@shopify/react-native-skia').Fill;
}
const headless = jest.requireMock<Headless>('@shopify/react-native-skia');
const { Group } = headless;

const W = 390; const H = 844;
const ASSETS = join(__dirname, '..', 'assets');
const OUT = process.env.COSMOS_PIXELS_OUT ?? null;
const address = (x: string | number, y: string | number) => { const a = canonicalWorldAddress(BigInt(x), BigInt(y)); if (!a.ok) throw new Error('not canonical'); return a.address; };
const ORIGIN = { x: 0n, y: 0n };
const WHOLE = `minX=${-(2n ** 62n)}&minY=${-(2n ** 62n)}&maxX=${2n ** 62n - 1n}&maxY=${2n ** 62n - 1n}`;

let images: { deep: SkImage; gas: SkImage; veil: SkImage; atlas: SkImage; sharedDeep: SkImage; sharedGas: SkImage; sharedVeil: SkImage };
const load = (name: string): SkImage => {
  const { Skia } = headless.getSkiaExports();
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(readFileSync(join(ASSETS, name)))));
  if (image === null) throw new Error(`could not decode ${name}`);
  return image;
};

jest.setTimeout(120_000);

beforeAll(async () => {
  // The Skia reconciler commits outside React's test `act`: this file renders no React Native tree at all.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  // CanvasKit's loader asks for a UTF-16 decoder, which the Expo preset's TextDecoder stand-in does not offer: Node's does.
  (globalThis as { TextDecoder?: unknown }).TextDecoder = TextDecoder;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const init = require('canvaskit-wasm/bin/full/canvaskit') as (options: object) => Promise<unknown>;
  (globalThis as { CanvasKit?: unknown }).CanvasKit = await init({});
  images = { deep: load('public-deep.jpg'), gas: load('public-gas.jpg'), veil: load('public-veil.jpg'), atlas: load('light-atlas.png'),
    sharedDeep: load('shared-deep.jpg'), sharedGas: load('shared-gas.jpg'), sharedVeil: load('shared-veil.jpg') };
});

const publicStage = (focusId: string | null = null): Stage => {
  const field = fixtureField(WHOLE);
  if (field === null) throw new Error('no fixture field');
  const entries = field.experiences.map((e) => ({ id: e.id, address: address(e.x, e.y), meaning: e.meaning, region: e.region }));
  return compileStage(publicScene({ entries, focusId, section: null, focusMotes: focusId === null ? undefined : 3, rtl: false }, ORIGIN));
};
const sharedStage = (): Stage => compileStage(sharedScene(SHARED_VIS_WORLD_A.places.map((p, i) => ({ id: `shared-${i}`, address: address(p.x, p.y), meaning: p.meaning.en, region: p.region })), null, false, ORIGIN));

/** One frame, exactly as `CosmosCanvas` composes it, from plain numbers. */
async function frame(stage: Stage, camera: NasijCamera, mode: OverdrawMode, plates: { deep: SkImage; gas: SkImage; veil: SkImage }, name: string): Promise<Uint8Array> {
  const view: NasijView = { width: W, height: H, focusX: W / 2, focusY: H / 2 };
  const prepared = prepareStage(stage);
  const alphas = layerOpacities(depthOf(camera.scale), stage.layers.length);
  const m = matrixOf(camera, view);
  const motions = plateMotions(stage.layers.length);
  const at = (motion: PlateMotion, image: SkImage) => {
    const o = plateOffsetOf(camera.cx, camera.cy, Math.log(camera.scale), view.focusX, view.focusY, 0, motion.zExp, motion.pan, motion.driftX, motion.driftY, image.width());
    return [{ translateX: o.x }, { translateY: o.y }, { scale: o.k }];
  };
  const surface = headless.makeOffscreenSurface(W, H);
  const snapshot = await headless.drawOffscreen(surface, (
    <Group>
      <PlateFill image={plates.deep} transform={at(motions.deep, plates.deep)} additive={false} alpha={1} />
      <PlateFill image={plates.gas} transform={at(motions.gas, plates.gas)} additive alpha={0.9} />
      {mode === 'PLATES_ONLY' ? null : (
        <Group matrix={[m[0], 0, m[4], 0, m[3], m[5], 0, 0, 1]}>
          {prepared.rungs.map((layer) => (
            <RungDraws key={layer.rung} layer={layer} atlas={images.atlas} mode={mode} opacity={alphas[layer.rung]} hair={1 / camera.scale} />
          ))}
        </Group>
      )}
      <PlateFill image={plates.veil} transform={at(motions.veil, plates.veil)} additive alpha={1} />
      <Lens width={W} height={H} />
    </Group>
  ));
  const pixels = snapshot.readPixels(0, 0, { width: W, height: H, colorType: 4, alphaType: 3 }) as Uint8Array | null; // RGBA_8888, unpremultiplied
  if (pixels === null) throw new Error('no pixels');
  if (OUT !== null) { mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, `${name}.png`), snapshot.encodeToBytes()); }
  disposePrepared(prepared);
  return pixels;
}
const at = (pixels: Uint8Array, x: number, y: number): [number, number, number] => { const i = (Math.round(y) * W + Math.round(x)) * 4; return [pixels[i], pixels[i + 1], pixels[i + 2]]; };
const luma = (c: readonly number[]): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const sumAround = (pixels: Uint8Array, x: number, y: number, r: number): number => { let s = 0; for (let dy = -r; dy <= r; dy += 4) for (let dx = -r; dx <= r; dx += 4) { const px = x + dx; const py = y + dy; if (px >= 0 && px < W && py >= 0 && py < H) s += luma(at(pixels, px, py)); } return s; };

describe('the frame, rasterised headlessly', () => {
  it('Public at MID: every body is tinted light added to the atmosphere, with a white-hot core on its entity', async () => {
    const stage = publicStage();
    const hit = stage.layers[1].hits[0];
    const camera: NasijCamera = { cx: hit.x, cy: hit.y, scale: 8 };
    const view: NasijView = { width: W, height: H, focusX: W / 2, focusY: H / 2 };
    const full = await frame(stage, camera, 'FULL', images, 'public-mid-full');
    const plates = await frame(stage, camera, 'PLATES_ONLY', images, 'public-mid-plates');
    const noBodies = await frame(stage, camera, 'NO_BODIES', images, 'public-mid-no-bodies');
    const p = project(camera, view, hit.x, hit.y);
    // The core sits exactly on the entity and is white-hot there.
    const core = at(full, p.x, p.y);
    expect(Math.min(...core)).toBeGreaterThan(225);
    // Additive: nowhere is the full frame darker than the atmosphere alone (but for rounding).
    let darker = 0;
    for (let i = 0; i < full.length; i += 4) if (full[i] + 2 < plates[i] || full[i + 1] + 2 < plates[i + 1] || full[i + 2] + 2 < plates[i + 2]) darker += 1;
    expect(darker).toBe(0);
    // The body about the entity is coloured light, not white and not grey: its channels differ.
    const body = at(full, p.x + 26, p.y + 18);
    expect(luma(body)).toBeGreaterThan(luma(at(plates, p.x + 26, p.y + 18)) + 8);
    expect(Math.max(...body) - Math.min(...body)).toBeGreaterThan(20);
    // NO_BODIES keeps the node and its halo and loses the nebula body's light.
    expect(Math.min(...at(noBodies, p.x, p.y))).toBeGreaterThan(225);
    expect(sumAround(noBodies, p.x, p.y, 90)).toBeLessThan(sumAround(full, p.x, p.y, 90) * 0.97);
    expect(sumAround(noBodies, p.x, p.y, 90)).toBeGreaterThan(sumAround(plates, p.x, p.y, 90));
  });

  it('Public at FAR and at NEAR with a focus, and Shared at FAR with its horizon, all draw', async () => {
    const far = await frame(publicStage(), { cx: 0, cy: 0, scale: 1 }, 'FULL', images, 'public-far-full');
    const farPlates = await frame(publicStage(), { cx: 0, cy: 0, scale: 1 }, 'PLATES_ONLY', images, 'public-far-plates');
    expect(sumAround(far, W / 2, H / 2, 180)).toBeGreaterThan(sumAround(farPlates, W / 2, H / 2, 180) * 1.05);
    const focused = publicStage(publicStage().layers[1].hits[4].id);
    const hit = focused.layers[2].hits.find((h) => h.r === 44) as { x: number; y: number };
    const near = await frame(focused, { cx: hit.x, cy: hit.y, scale: 64 }, 'FULL', images, 'public-near-focus');
    expect(Math.min(...at(near, W / 2, H / 2))).toBeGreaterThan(225);
    const shared = sharedStage();
    const plates = { deep: images.sharedDeep, gas: images.sharedGas, veil: images.sharedVeil };
    const horizon = shared.horizon as NonNullable<Stage['horizon']>;
    const sharedFar = await frame(shared, { cx: horizon.cx, cy: horizon.cy, scale: 1 }, 'FULL', plates, 'shared-far-full');
    const sharedPlates = await frame(shared, { cx: horizon.cx, cy: horizon.cy, scale: 1 }, 'PLATES_ONLY', plates, 'shared-far-plates');
    expect(sumAround(sharedFar, W / 2, H / 2, 180)).toBeGreaterThan(sumAround(sharedPlates, W / 2, H / 2, 180));
  });
});
