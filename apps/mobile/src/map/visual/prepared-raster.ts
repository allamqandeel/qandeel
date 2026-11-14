/**
 * MAP-PERF-01 (Product Owner, 2026-11-12, "candidate F to production, a clean port"): the rasters the world paints once
 * — the nebula, deep-space and thread tiles and the place masses — kept between launches.
 *
 * Painting them costs the JS thread seconds on a phone at every launch (S8B-06 CP3: about one second per nebula pass on
 * the HONOR), and until they are painted the world shows less than itself. Each is a pure function of its own drawing,
 * so the first paint is kept as a LOSSLESS PNG in the app's cache folder and read back on the next launch. A PNG returns
 * every premultiplied pixel exactly (measured on the Product Owner's phone, 2026-11-11), so a prepared raster IS the
 * raster. The system may clear the cache folder at any time; nothing is lost but the time to paint again.
 *
 * A file is named by the CONTENT of what it holds: the serialized drawing (or, for a mass, its recipe and the drawing's
 * own fingerprint) and every size it was painted at, hashed. A changed drawing is a new name, never a stale image; an
 * old file ages out. Nothing but the world's non-semantic paint is kept: no place, key, name, text or user fact reaches
 * a file or its name.
 *
 * The Map reads and writes no file itself (M04-15: it adds no dependency): it is handed a store (`installPreparedRasterStore`)
 * by the app's composition, which owns the folder, its version and its bound. Every step fails closed to painting: no
 * store, no serialization, a missing or unreadable file, a failed write.
 */
import { Skia, type SkImage, type SkPicture } from '@shopify/react-native-skia';

/** A raster the world draws back as an image, with the margin and the share it was painted at. */
export interface PreparedRaster {
  readonly image: SkImage;
  readonly margin: number;
  readonly share: number;
}

const rasters = new WeakMap<SkPicture, PreparedRaster>();

/** Marks a picture as the drawing-back of a raster, so a weighted draw can sample the image itself (no layer). */
export function rememberRaster(picture: SkPicture, raster: PreparedRaster): void {
  rasters.set(picture, raster);
}

/** The raster behind a picture, when the picture only draws one back. */
export function rasterBehind(picture: SkPicture): PreparedRaster | undefined {
  return rasters.get(picture);
}

// ------------------------------------------------------------------------------------- names

/** Two FNV-1a hashes with different bases: 64 bits of name, for a folder of a few hundred files. */
function digest(bytes: ArrayLike<number>): string {
  let a = 0x811c9dc5;
  let b = 0x050c5d1f;
  for (let index = 0; index < bytes.length; index += 1) {
    a = Math.imul(a ^ bytes[index], 0x01000193);
    b = Math.imul(b ^ bytes[index], 0x01000193);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

function textBytes(text: string): number[] {
  const bytes: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    bytes.push(code & 0xff, code >>> 8);
  }
  return bytes;
}

/** The name of a raster painted from a drawing at the given sizes, or null where the drawing cannot be serialized. */
export function drawingName(kind: string, drawing: SkPicture, ...sizes: readonly number[]): string | null {
  const serialize = (drawing as Partial<SkPicture>).serialize;
  if (typeof serialize !== 'function') return null;
  try {
    const bytes = serialize.call(drawing);
    if (bytes === null || bytes.length === 0) return null;
    return `${kind}-${digest(bytes)}-${digest(textBytes(sizes.join(',')))}`;
  } catch {
    return null;
  }
}

/** The name of a raster painted from a recipe, under a fingerprint of the drawing code that paints every recipe. */
export function recipeName(kind: string, fingerprint: string, recipe: string): string {
  return `${kind}-${fingerprint}-${digest(textBytes(recipe))}`;
}

// ------------------------------------------------------------------------------------- the store

/** Where prepared rasters are kept: named PNG bytes, best effort. Owned by the app's composition, never by the Map. */
export interface PreparedRasterStore {
  /** The bytes kept under that name, or null. */
  read(name: string): Uint8Array | null;
  /** Keeps the bytes under that name; a failure is silent (the next launch paints again). */
  write(name: string, bytes: Uint8Array): void;
}

let store: PreparedRasterStore | null = null;

/** Hands the Map its store (or none: every raster is painted, as before). */
export function installPreparedRasterStore(next: PreparedRasterStore | null): void {
  store = next;
}

/** The prepared raster of that name, decoded into memory, or null. */
export function loadPrepared(name: string | null): SkImage | null {
  if (name === null || store === null) return null;
  try {
    const bytes = store.read(`${name}.png`);
    if (bytes === null) return null;
    const decoded = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
    return decoded?.makeNonTextureImage?.() ?? decoded;
  } catch {
    return null;
  }
}

/** Keeps a painted raster under that name, as a lossless PNG. */
export function savePrepared(name: string | null, image: SkImage): void {
  if (name === null || store === null) return;
  try {
    store.write(`${name}.png`, image.encodeToBytes());
  } catch {
    // nothing kept
  }
}
