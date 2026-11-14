// NASIJ (experimental, isolated) — the Skia objects one cloth owns.
//
// A draw list is prepared ONCE: each batch becomes one static `SkPath` with many contours, so a frame costs one draw per
// batch however many entities the layer holds. Nothing here is cached at module level: every object made here is handed
// to the component that asked for it, and that component disposes it (`disposePrepared`, `disposeWeave`).

import { Skia, TileMode, type SkImage, type SkPath } from '@shopify/react-native-skia';

import type { NasijPalette } from '../core/palette';
import type { Batch, ColorKey, NasijDrawList } from '../core/scene';

export interface PreparedBatch {
  readonly key: string;
  readonly path: SkPath;
  readonly style: 'fill' | 'stroke';
  readonly color: ColorKey;
  readonly alpha: number;
  /** Stroke width in layer units (strokes only). */
  readonly width: number;
}

export interface PreparedCloth {
  readonly digest: string;
  readonly border: readonly PreparedBatch[];
  readonly layers: readonly (readonly PreparedBatch[])[];
}

function pathOf(batch: Batch): SkPath {
  const path = Skia.Path.Make();
  const d = batch.data;
  for (let i = 0; i < d.length;) {
    const n = d[i];
    path.moveTo(d[i + 1], d[i + 2]);
    for (let j = 1; j < n; j += 1) path.lineTo(d[i + 1 + j * 2], d[i + 2 + j * 2]);
    if (batch.t === 'fill') path.close();
    i += 1 + n * 2;
  }
  return path;
}

const prepareBatches = (batches: readonly Batch[], prefix: string): PreparedBatch[] => batches.map((batch, index) => ({
  key: `${prefix}:${index}`, path: pathOf(batch), style: batch.t === 'fill' ? 'fill' : 'stroke', color: batch.color, alpha: batch.alpha,
  width: batch.t === 'line' ? batch.width : 0,
}));

export function prepareCloth(list: NasijDrawList): PreparedCloth {
  return {
    digest: list.digest,
    border: prepareBatches(list.border, 'border'),
    layers: list.layers.map((layer) => prepareBatches(layer.batches, `rung${layer.rung}`)),
  };
}

type Disposable = { dispose?: () => void };
const dispose = (value: unknown): void => { try { (value as Disposable | null)?.dispose?.(); } catch { /* already released */ } };

export function disposePrepared(cloth: PreparedCloth): void {
  for (const batch of cloth.border) dispose(batch.path);
  for (const layer of cloth.layers) for (const batch of layer) dispose(batch.path);
}

export const WEAVE_TILE_PX = 96;

/**
 * One weave repeat: a 2x2 basket weave, each cell a thread lying over its neighbours and lit along its length (the
 * browser preview's `weaveTile`, cell for cell), over the ground colour. Drawn once into a 96 px raster; null when no surface can be made, and
 * the cloth is then drawn without its weave rather than with a wrong one.
 */
export function makeWeaveTile(palette: NasijPalette, night: boolean): SkImage | null {
  const surface = Skia.Surface.Make(WEAVE_TILE_PX, WEAVE_TILE_PX) ?? Skia.Surface.MakeOffscreen(WEAVE_TILE_PX, WEAVE_TILE_PX);
  if (surface === null) return null;
  const canvas = surface.getCanvas();
  const h = WEAVE_TILE_PX / 2;
  // The ground is baked INTO the tile, so the tile is opaque: at rest the weave IS the ground and the cloth needs no
  // separate full-screen ground pass under it (full-screen passes, not geometry, are what a frame costs).
  canvas.drawColor(Skia.Color(palette.colors.ground));
  const clear = Skia.Color('rgba(0,0,0,0)');
  const colors = [Skia.Color(palette.weave), clear, Skia.Color(night ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.4)'), clear, Skia.Color(palette.weave)];
  const stops = [0, 0.16, 0.5, 0.84, 1];
  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      const horizontal = (i + j) % 2 === 0;
      const x = i * h;
      const y = j * h;
      // Flag 1: interpolate premultiplied, as a 2D canvas does, so the clear stops do not darken their neighbours.
      const shader = horizontal
        ? Skia.Shader.MakeLinearGradient({ x: 0, y }, { x: 0, y: y + h }, colors, stops, TileMode.Clamp, undefined, 1)
        : Skia.Shader.MakeLinearGradient({ x, y: 0 }, { x: x + h, y: 0 }, colors, stops, TileMode.Clamp, undefined, 1);
      const paint = Skia.Paint();
      paint.setShader(shader);
      paint.setAlphaf(0.3);
      canvas.drawRect(Skia.XYWHRect(x, y, h, h), paint);
      dispose(paint);
      dispose(shader);
    }
  }
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  // A raster copy, so the tile does not hold the surface (or a texture of the context that made it) alive.
  const image = snapshot.makeNonTextureImage?.() ?? snapshot;
  if (image !== snapshot) dispose(snapshot);
  dispose(surface);
  return image;
}

export function disposeWeave(image: SkImage | null): void {
  dispose(image);
}

/** `rgba(r, g, b, a)` with another alpha: the lantern's shade is one colour at four strengths. */
export function withAlpha(rgba: string, alpha: number): string {
  return rgba.replace(/[\d.]+\)$/u, `${alpha.toFixed(3)})`);
}
