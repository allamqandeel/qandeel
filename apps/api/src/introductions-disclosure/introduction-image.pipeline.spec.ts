import sharp from 'sharp';
import {
  declaredImageFormat, INTRODUCTION_IMAGE_MAX_BYTES, prepareIntroductionImage, PROPOSED_IMAGE_PARAMETERS,
} from './introduction-image.pipeline';

/** A synthetic photo: a gradient, a fine 2px checkerboard patch (detail that blur must remove), and planted EXIF + GPS. */
async function syntheticPhoto(width = 900, height = 1200, format: 'jpeg' | 'png' | 'webp' = 'jpeg'): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      const checker = x > 500 && x < 700 && y > 300 && y < 500 ? (((x >> 1) + (y >> 1)) % 2 === 0 ? 0 : 255) : null;
      pixels[i] = checker ?? Math.round((x / width) * 255);
      pixels[i + 1] = checker ?? Math.round((y / height) * 255);
      pixels[i + 2] = checker ?? 128;
    }
  }
  const image = sharp(pixels, { raw: { width, height, channels: 3 } }).withExif({ IFD0: { Artist: 'fixture' }, IFD3: { GPSLatitudeRef: 'N' } });
  return format === 'jpeg' ? image.jpeg({ quality: 92 }).toBuffer() : format === 'png' ? image.png().toBuffer() : image.webp().toBuffer();
}

async function laplacian(jpeg: Buffer): Promise<number> {
  const { data, info } = await sharp(jpeg).greyscale().resize(240, 320, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let y = 1; y < info.height - 1; y += 1) {
    for (let x = 1; x < info.width - 1; x += 1) {
      const i = y * info.width + x;
      const l = 4 * data[i] - data[i - 1] - data[i + 1] - data[i - info.width] - data[i + info.width];
      sum += l * l;
    }
  }
  return sum / ((info.width - 2) * (info.height - 2));
}

jest.setTimeout(60_000);

describe('S6-06 the Introduction photo pipeline (D-02, D-04)', () => {
  it('accepts JPEG, PNG and WebP, and every rendition is a fresh JPEG with no EXIF, GPS or ICC', async () => {
    for (const format of ['jpeg', 'png', 'webp'] as const) {
      const result = await prepareIntroductionImage(await syntheticPhoto(900, 1200, format));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      for (const rendition of [result.renditions.strong, result.renditions.medium, result.renditions.clear]) {
        const meta = await sharp(rendition).metadata();
        expect(meta.format).toBe('jpeg');
        expect(meta.exif).toBeUndefined();
        expect(meta.icc).toBeUndefined();
        expect(meta.xmp).toBeUndefined();
      }
    }
  });

  it('orders the information strictly: strong < medium < clear, and the strong stage flattens fine detail', async () => {
    const result = await prepareIntroductionImage(await syntheticPhoto());
    if (!result.ok) throw new Error('fixture refused');
    const [s, m, c] = await Promise.all([result.renditions.strong, result.renditions.medium, result.renditions.clear].map(laplacian));
    expect(s).toBeLessThan(m);
    expect(m).toBeLessThan(c);
    const strongMeta = await sharp(result.renditions.strong).metadata();
    expect(Math.max(strongMeta.width ?? 0, strongMeta.height ?? 0)).toBe(PROPOSED_IMAGE_PARAMETERS.strong.displayEdge);
  });

  it('is deterministic: the same photo gives the same bytes, so a blurred stage is a function of its tiny sample alone', async () => {
    const photo = await syntheticPhoto();
    const [a, b] = await Promise.all([prepareIntroductionImage(photo), prepareIntroductionImage(photo)]);
    if (!a.ok || !b.ok) throw new Error('fixture refused');
    expect(a.renditions.strong.equals(b.renditions.strong)).toBe(true);
    expect(a.renditions.medium.equals(b.renditions.medium)).toBe(true);
  });

  it('bounds the clear stage to its edge and never enlarges', async () => {
    const big = await prepareIntroductionImage(await syntheticPhoto(2400, 3000));
    const small = await prepareIntroductionImage(await syntheticPhoto(400, 600));
    if (!big.ok || !small.ok) throw new Error('fixture refused');
    const bigMeta = await sharp(big.renditions.clear).metadata();
    const smallMeta = await sharp(small.renditions.clear).metadata();
    expect(Math.max(bigMeta.width ?? 0, bigMeta.height ?? 0)).toBe(PROPOSED_IMAGE_PARAMETERS.clear.edge);
    expect([smallMeta.width, smallMeta.height]).toEqual([400, 600]);
  });

  it('refuses what is not a single photo it accepts', async () => {
    const gif = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#808080' } }).gif().toBuffer();
    const tiff = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#808080' } }).tiff().toBuffer();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400"/></svg>');
    expect(await prepareIntroductionImage(gif)).toEqual({ ok: false, rejection: 'UNSUPPORTED' });
    expect(await prepareIntroductionImage(tiff)).toEqual({ ok: false, rejection: 'UNSUPPORTED' });
    expect(await prepareIntroductionImage(svg)).toEqual({ ok: false, rejection: 'UNSUPPORTED' });
    expect(await prepareIntroductionImage(Buffer.alloc(0))).toEqual({ ok: false, rejection: 'MALFORMED' });
    expect(await prepareIntroductionImage(await syntheticPhoto(200, 400))).toEqual({ ok: false, rejection: 'TOO_SMALL' });
    expect(await prepareIntroductionImage(Buffer.alloc(INTRODUCTION_IMAGE_MAX_BYTES + 1))).toEqual({ ok: false, rejection: 'TOO_LARGE' });
    // A JPEG header over garbage: the decoder must agree, so it is malformed, not accepted.
    expect(await prepareIntroductionImage(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(4000, 7)]))).toEqual({ ok: false, rejection: 'MALFORMED' });
    // Bytes that declare PNG but decode as JPEG would disagree with themselves; the magic decides the declaration.
    const jpeg = await syntheticPhoto(400, 400);
    expect(declaredImageFormat(jpeg)).toBe('jpeg');
    expect(declaredImageFormat(await syntheticPhoto(300, 300, 'png'))).toBe('png');
    expect(declaredImageFormat(await syntheticPhoto(300, 300, 'webp'))).toBe('webp');
  });

  it('refuses an animation', async () => {
    const frames = await Promise.all([0, 1].map((n) => sharp({ create: { width: 300, height: 300, channels: 3, background: n ? '#000' : '#fff' } }).png().toBuffer()));
    const animated = await sharp(frames, { join: { animated: true } }).webp({ loop: 0 }).toBuffer();
    expect((await sharp(animated).metadata()).pages).toBe(2);
    expect(await prepareIntroductionImage(animated)).toEqual({ ok: false, rejection: 'UNSUPPORTED' });
  });
});
