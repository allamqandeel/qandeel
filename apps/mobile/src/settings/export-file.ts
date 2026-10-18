/**
 * W3-MEGA-S (E2E-D-16) — the download of a ready export package, inside the app (W3-PDG-01 §7.2 step 5).
 *
 * The server built the package; the app never builds, edits or keeps one. The reader chooses where it goes through the
 * system's own folder picker, and the package is written there as one readable JSON document. Nothing is cached, and no
 * copy stays in the app's own storage. Emailing the file is not a route (§7.2 step 7).
 *
 *   SAVED      the file is written where the reader chose;
 *   CANCELLED  the reader closed the picker (nothing is said);
 *   FAILED     the file could not be written.
 *
 * S6-07 (CP4, QAN-BL-PRIV-04): with the reader's own photos the export is ONE folder, `qandeel-data-YYYY-MM-DD/` in the
 * place the reader chose: the photo files first, the server's photo manifest next, the package LAST - so a folder holding
 * the package always holds every file its manifest lists. Each photo is checked on disk (it exists, with exactly its
 * length) before the next is written. Any failure removes the folder and is FAILED: there is no partial SAVED. Without a
 * photo, and with nothing to say about one, the package is saved exactly as before.
 */
import { Directory } from 'expo-file-system';
import type { ExportPhotosToSave } from './privacy-data-controller';

export type ExportSaveResult = 'SAVED' | 'CANCELLED' | 'FAILED';

/** `qandeel-data-YYYY-MM-DD.json` — a file name that says what it is, in Latin letters on every device. */
export function exportFileName(now: Date = new Date(), copy = 1): string {
  return `qandeel-data-${now.toISOString().slice(0, 10)}${copy > 1 ? `-${copy}` : ''}.json`;
}

const MAX_SAME_DAY_COPIES = 20;

/** `qandeel-data-YYYY-MM-DD` — the folder of one export with photos (the next free name the same day). */
export function exportFolderName(now: Date = new Date(), copy = 1): string {
  return `qandeel-data-${now.toISOString().slice(0, 10)}${copy > 1 ? `-${copy}` : ''}`;
}
/** `qandeel-photos-YYYY-MM-DD.json` — the server's photo manifest, saved verbatim. */
export function exportManifestName(now: Date = new Date()): string {
  return `qandeel-photos-${now.toISOString().slice(0, 10)}.json`;
}

/** The package and the reader's own photos, as one folder; the package alone when there is no photo to speak of. */
export async function saveExportBundle(document: Record<string, unknown>, photos: ExportPhotosToSave | null, now: Date = new Date()): Promise<ExportSaveResult> {
  if (photos === null) return saveExportDocument(document, now);
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch {
    return 'CANCELLED';
  }
  let folder: ReturnType<Directory['createDirectory']> | null = null;
  // A fresh folder: inside it no name is taken, so every file keeps exactly the name its manifest gives it.
  for (let copy = 1; copy <= MAX_SAME_DAY_COPIES && folder === null; copy += 1) {
    try {
      folder = directory.createDirectory(exportFolderName(now, copy));
    } catch {
      // the name is taken, or the place cannot be written; the next name is tried, then FAILED.
    }
  }
  if (folder === null) return 'FAILED';
  try {
    for (const [i, fileName] of photos.fileNames.entries()) {
      const photo = photos.inline[i] ?? await photos.fetch(fileName);
      if (photo === null || photo.fileName !== fileName) throw new Error('photo not available');
      const file = folder.createFile(fileName, 'image/jpeg');
      file.write(photo.bytesBase64, { encoding: 'base64' });
      if (!file.exists || file.size !== photo.bytes) throw new Error('photo not written whole');
    }
    const manifest = folder.createFile(exportManifestName(now), 'application/json');
    manifest.write(JSON.stringify(photos.manifest, null, 2));
    const pkg = folder.createFile(exportFileName(now), 'application/json');
    pkg.write(JSON.stringify(document, null, 2));
    if (!manifest.exists || !pkg.exists) throw new Error('documents not written');
    return 'SAVED';
  } catch {
    try {
      folder.delete();
    } catch {
      // What may remain has no package in it: visibly not a complete export.
    }
    return 'FAILED';
  }
}

export async function saveExportDocument(document: Record<string, unknown>, now: Date = new Date()): Promise<ExportSaveResult> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch {
    return 'CANCELLED';
  }
  const text = JSON.stringify(document, null, 2);
  // A second copy saved the same day never replaces the first: iOS refuses to create a file that exists, so the next
  // free name is used (`qandeel-data-YYYY-MM-DD-2.json`, …). Android's document provider numbers it on its own.
  for (let copy = 1; copy <= MAX_SAME_DAY_COPIES; copy += 1) {
    try {
      const file = directory.createFile(exportFileName(now, copy), 'application/json');
      file.write(text);
      return 'SAVED';
    } catch {
      // the name is taken, or the folder cannot be written; the next name is tried, then FAILED.
    }
  }
  return 'FAILED';
}
