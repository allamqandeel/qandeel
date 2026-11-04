/**
 * S8B-06 CP3 — a nebula raster tile is painted in bands, with the JS thread released before each one.
 *
 * On a phone each nebula pass cost about a second of the JS thread, and the three passes in one go held it for 3.3 s:
 * a live call's audio, which passes through the JS thread, stopped and the server closed the call (4008 SILENCE). These
 * tests prove the banding over a recording stand-in surface: every row of the image is painted exactly once, under the
 * same transform as the single pass, each band after a release, and the image is snapshotted once and drawn back as
 * before. The pixels themselves are proved on the device.
 */
import { Skia } from '@shopify/react-native-skia';

import { RASTER_BANDS, rasterTile } from '../visual/WorldStrata';

type Op = readonly [string, ...unknown[]];

function recordingSurface(log: Op[]) {
  const canvas = {
    save: () => log.push(['save']),
    restore: () => log.push(['restore']),
    clipRect: (rect: { y: number; height: number; x: number; width: number }, op: number, antiAlias: boolean) =>
      log.push(['clip', rect.x, rect.y, rect.width, rect.height, op, antiAlias]),
    scale: (x: number, y: number) => log.push(['scale', x, y]),
    translate: (x: number, y: number) => log.push(['translate', x, y]),
  };
  const image = Object.freeze({ __standIn: 'SkImage' });
  return {
    getCanvas: () => canvas,
    flush: () => log.push(['flush']),
    makeImageSnapshot: () => {
      log.push(['snapshot']);
      return { makeNonTextureImage: () => image };
    },
  };
}

describe('S8B-06 CP3: a raster tile is painted in bands', () => {
  const skia = Skia as unknown as { Surface: { Make: (w: number, h: number) => unknown; MakeOffscreen: (w: number, h: number) => unknown } };
  const original = skia.Surface;
  afterEach(() => {
    skia.Surface = original;
  });

  it('paints every row exactly once, one band per release, under the single pass transform, and snapshots once', async () => {
    const log: Op[] = [];
    const sizes: number[][] = [];
    skia.Surface = {
      Make: (w, h) => {
        sizes.push([w, h]);
        return recordingSurface(log);
      },
      MakeOffscreen: () => null,
    };
    const size = 2048;
    const margin = 16;
    const share = 0.7;
    const pixels = Math.round((size + 2 * margin) * share);

    await rasterTile(size, margin, share, () => log.push(['draw']), async () => {
      log.push(['release']);
    });

    expect(sizes).toEqual([[pixels, pixels]]);
    const clips = log.filter(([kind]) => kind === 'clip');
    expect(clips).toHaveLength(RASTER_BANDS);
    // The bands tile the image's rows with no gap and no overlap, the full width, without anti-aliasing.
    let next = 0;
    for (const [, x, y, width, height, , antiAlias] of clips) {
      expect([x, y, width, antiAlias]).toEqual([0, next, pixels, false]);
      expect(Number.isInteger(height)).toBe(true);
      next += height as number;
    }
    expect(next).toBe(pixels);
    // Each band: a release, then the drawing under its clip with the single pass's own transform.
    const band = [['release'], ['save'], ['clip'], ['scale', share, share], ['translate', margin, margin], ['draw'], ['restore']];
    const shape = log.map((op) => (op[0] === 'clip' ? ['clip'] : op));
    expect(shape).toEqual([...Array.from({ length: RASTER_BANDS }, () => band).flat(), ['flush'], ['snapshot']]);
  });

  it('never paints a band before the JS thread was released for it', async () => {
    const log: Op[] = [];
    skia.Surface = { Make: () => recordingSurface(log), MakeOffscreen: () => null };
    let released = 0;
    let painted = 0;
    const order: string[] = [];
    await rasterTile(
      2048,
      16,
      0.7,
      () => {
        painted += 1;
        order.push(`paint ${painted} after ${released} releases`);
      },
      async () => {
        released += 1;
      },
    );
    expect(order).toEqual(Array.from({ length: RASTER_BANDS }, (_, index) => `paint ${index + 1} after ${index + 1} releases`));
  });

  it('with no raster surface, records the drawing directly, as before, and releases nothing', async () => {
    skia.Surface = { Make: () => null, MakeOffscreen: () => null };
    const release = jest.fn(async () => undefined);
    const picture = await rasterTile(2048, 16, 0.7, () => undefined, release);
    expect(picture).toBeDefined();
    expect(release).not.toHaveBeenCalled();
  });
});
