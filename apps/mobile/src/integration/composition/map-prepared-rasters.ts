/**
 * MAP-PERF-01 — the file store behind the Map's prepared rasters (`installPreparedRasterStore`).
 *
 * The Map paints its world rasters once (the nebula, deep-space and thread tiles, the place masses) and keeps each one,
 * as a lossless PNG named by the content of its drawing, so the next launch reads it back instead of painting it again.
 * This module owns where that is: one folder in the app's CACHE directory (the system may clear it at any time; nothing
 * is lost but time), versioned and bounded.
 *
 *   version — a folder per VERSION; a launch removes every other version's folder, so a change of rasterizer or encoding
 *             never reads an image painted by the old one.
 *   bound   — at most LIMIT.files files and LIMIT.bytes bytes, oldest out first: once per launch, and again after every
 *             BOUND_EVERY writes, so a long session preparing many masses stays bounded too.
 *
 * The files hold only the world's non-semantic paint; their names are hashes. Every failure is silent: the Map paints.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { installPreparedRasterStore, type PreparedRasterStore } from '../../map';

const VERSION = 1;
const PREFIX = 'map-prepared-v';
const FOLDER = `${PREFIX}${VERSION}`;
/** About four times what the three worlds prepare (5 tiles and at most 48 masses at a time: ~12 MB). */
const LIMIT = Object.freeze({ files: 200, bytes: 48 * 1024 * 1024 });
const BOUND_EVERY = 25;

function bound(folder: Directory): void {
  const files = folder
    .list()
    .filter((entry): entry is File => entry instanceof File)
    .map((file) => ({ file, size: file.size ?? 0, at: file.lastModified ?? 0 }))
    .sort((x, y) => x.at - y.at);
  let count = files.length;
  let bytes = files.reduce((sum, entry) => sum + entry.size, 0);
  for (const entry of files) {
    if (count <= LIMIT.files && bytes <= LIMIT.bytes) break;
    entry.file.delete();
    count -= 1;
    bytes -= entry.size;
  }
}

/** The store over one versioned, bounded folder in the cache directory. */
export function createMapPreparedRasterStore(): PreparedRasterStore {
  let folder: Directory | null | undefined;
  let writes = 0;
  const open = (): Directory | null => {
    if (folder !== undefined) return folder;
    folder = null;
    try {
      for (const entry of new Directory(Paths.cache).list()) {
        if (entry instanceof Directory && entry.name.startsWith(PREFIX) && entry.name !== FOLDER) entry.delete();
      }
      const own = new Directory(Paths.cache, FOLDER);
      if (!own.exists) own.create({ intermediates: true });
      bound(own);
      folder = own;
    } catch {
      folder = null;
    }
    return folder;
  };
  return {
    read(name) {
      const own = open();
      if (own === null) return null;
      try {
        const file = new File(own, name);
        return file.exists ? file.bytesSync() : null;
      } catch {
        return null;
      }
    },
    write(name, bytes) {
      const own = open();
      if (own === null) return;
      try {
        const file = new File(own, name);
        if (file.exists) file.delete();
        file.create();
        file.write(bytes);
        writes += 1;
        if (writes % BOUND_EVERY === 0) bound(own);
      } catch {
        // nothing kept
      }
    },
  };
}

let installed = false;

/** Hands the Map its prepared-raster store, once per process. */
export function installMapPreparedRasters(): void {
  if (installed) return;
  installed = true;
  installPreparedRasterStore(createMapPreparedRasterStore());
}
