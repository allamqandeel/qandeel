import sharp from 'sharp';

/**
 * S6-06 — the server-side image pipeline for one Introduction photo (D-02, D-04).
 *
 * The uploaded bytes are decoded, checked and re-encoded in memory only; they are never stored and never served. Three
 * renditions are derived from the one cleaned image:
 *
 *   STRONG   the cleaned image reduced to at most `sampleEdge` px on its longer side, then enlarged and smoothed for display
 *   MEDIUM   the same, with a larger `sampleEdge`
 *   CLEAR    the cleaned image itself, at most `edge` px on its longer side
 *
 * A blurred rendition is a deterministic function of its tiny reduced image ALONE: the enlargement starts from the raw
 * pixels of that reduced image, so the bytes sent at a blurred stage carry no more information than `sampleEdge` x
 * `sampleEdge` colour samples. That bounds the information; it does not make anyone unrecognisable (PD-21b), and nothing
 * here claims it does. The numbers are technical candidates until the Visual Gate decides them (D-04).
 *
 * Nothing derived from the content is returned beside the bytes: no hash, no size record, no dimensions (0122).
 */

export interface BlurStageParameters {
  readonly sampleEdge: number;
  readonly displayEdge: number;
  readonly sigma: number;
  readonly quality: number;
}

export interface ClearStageParameters {
  readonly edge: number;
  readonly quality: number;
}

export interface IntroductionImageParameters {
  readonly strong: BlurStageParameters;
  readonly medium: BlurStageParameters;
  readonly clear: ClearStageParameters;
}

/** The technical candidates (D-04). The Visual Gate decides the final values. */
export const PROPOSED_IMAGE_PARAMETERS: IntroductionImageParameters = Object.freeze({
  strong: Object.freeze({ sampleEdge: 12, displayEdge: 640, sigma: 6, quality: 60 }),
  medium: Object.freeze({ sampleEdge: 48, displayEdge: 640, sigma: 2.5, quality: 70 }),
  clear: Object.freeze({ edge: 1600, quality: 82 }),
});

export const INTRODUCTION_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const INTRODUCTION_IMAGE_MIN_SHORT_EDGE = 256;
export const INTRODUCTION_IMAGE_MAX_EDGE = 8000;
const MAX_INPUT_PIXELS = 40_000_000;

export type IntroductionImageRejection = 'TOO_LARGE' | 'UNSUPPORTED' | 'MALFORMED' | 'TOO_SMALL';

export interface IntroductionImageRenditions {
  readonly strong: Buffer;
  readonly medium: Buffer;
  readonly clear: Buffer;
}

export type IntroductionImageResult =
  | { readonly ok: true; readonly renditions: IntroductionImageRenditions }
  | { readonly ok: false; readonly rejection: IntroductionImageRejection };

// libvips keeps decoded pixels in an operation cache by default. A photo shared in an Introduction must not outlive its
// request in this process, so the cache is off, and one image is processed at a time.
sharp.cache(false);
sharp.concurrency(1);

type Format = 'jpeg' | 'png' | 'webp';

/** The container the bytes declare, from their magic numbers. Anything else is not a photo this path accepts. */
export function declaredImageFormat(bytes: Buffer): Format | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

let queue: Promise<unknown> = Promise.resolve();

/** One image at a time through the pipeline (the API's memory bound, and a stable timing). */
export function prepareIntroductionImage(
  input: Buffer, parameters: IntroductionImageParameters = PROPOSED_IMAGE_PARAMETERS,
): Promise<IntroductionImageResult> {
  const run = queue.then(() => prepare(input, parameters));
  queue = run.catch(() => undefined);
  return run;
}

async function prepare(input: Buffer, parameters: IntroductionImageParameters): Promise<IntroductionImageResult> {
  if (input.length === 0) return { ok: false, rejection: 'MALFORMED' };
  if (input.length > INTRODUCTION_IMAGE_MAX_BYTES) return { ok: false, rejection: 'TOO_LARGE' };
  const declared = declaredImageFormat(input);
  if (declared === null) return { ok: false, rejection: 'UNSUPPORTED' };
  let cleaned: { data: Buffer; width: number; height: number };
  try {
    const source = sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS, animated: false });
    const metadata = await source.metadata();
    // The decoder's own answer must agree with the bytes' declaration, and an animation is not a photo.
    if (metadata.format !== declared) return { ok: false, rejection: 'UNSUPPORTED' };
    if ((metadata.pages ?? 1) !== 1) return { ok: false, rejection: 'UNSUPPORTED' };
    const width = metadata.autoOrient?.width ?? metadata.width;
    const height = metadata.autoOrient?.height ?? metadata.height;
    if (!width || !height || width > INTRODUCTION_IMAGE_MAX_EDGE || height > INTRODUCTION_IMAGE_MAX_EDGE) {
      return { ok: false, rejection: 'UNSUPPORTED' };
    }
    if (Math.min(width, height) < INTRODUCTION_IMAGE_MIN_SHORT_EDGE) return { ok: false, rejection: 'TOO_SMALL' };
    // Upright, flattened onto white, in sRGB, at the clear stage's bound; raw pixels, so no input metadata can follow.
    const { data, info } = await source
      .rotate()
      .flatten({ background: '#ffffff' })
      .toColourspace('srgb')
      .resize({ width: parameters.clear.edge, height: parameters.clear.edge, fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    cleaned = { data, width: info.width, height: info.height };
  } catch {
    return { ok: false, rejection: 'MALFORMED' };
  }
  const raw = { raw: { width: cleaned.width, height: cleaned.height, channels: 3 as const } };
  // Re-encoded from raw pixels: EXIF, GPS, XMP and ICC never reach a rendition, and a polyglot input is neutralised.
  const clear = await sharp(cleaned.data, raw).jpeg({ quality: parameters.clear.quality, mozjpeg: true }).toBuffer();
  const strong = await blurred(cleaned, parameters.strong);
  const medium = await blurred(cleaned, parameters.medium);
  return { ok: true, renditions: { strong, medium, clear } };
}

async function blurred(
  cleaned: { data: Buffer; width: number; height: number }, stage: BlurStageParameters,
): Promise<Buffer> {
  // 1. The tiny sample: area-averaged down to at most sampleEdge px. This raw buffer is ALL the next step may see.
  const tiny = await sharp(cleaned.data, { raw: { width: cleaned.width, height: cleaned.height, channels: 3 } })
    .resize({ width: stage.sampleEdge, height: stage.sampleEdge, fit: 'inside', kernel: 'mitchell' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  // 2. Enlarged from the sample alone and smoothed, so the display shows colour and shape, not blocks.
  const scale = stage.displayEdge / Math.max(tiny.info.width, tiny.info.height);
  return sharp(tiny.data, { raw: { width: tiny.info.width, height: tiny.info.height, channels: 3 } })
    .resize({
      width: Math.max(1, Math.round(tiny.info.width * scale)),
      height: Math.max(1, Math.round(tiny.info.height * scale)),
      kernel: 'cubic',
    })
    .blur(stage.sigma)
    .jpeg({ quality: stage.quality, mozjpeg: true })
    .toBuffer();
}
