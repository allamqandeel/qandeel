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
import { Directory, File, Paths } from 'expo-file-system';
import type { ExportVoiceSet } from '../runtime-entry';
import { sha256Hex } from '../voice-note/sha256';
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

// ------------------------------------------------------------------------------------------------ S8B-03 voice files

/**
 * S8B-03 (CP2, contract §8.2 «حافظ التصدير», B9) — the reader's own voice recordings, saved by their separate act (C-49)
 * into ONE folder, `qandeel-voice-YYYY-MM-DD/`, in the place they choose:
 *
 *   - each listed file is STREAMED by the platform to a temporary file in the app's cache, with the bearer in a request
 *     header (never in a URL); its length must be the listed length, its SHA-256 is taken, it is copied into the folder,
 *     read back and checked against both, and the temporary file is deleted — nothing stays in the cache;
 *   - a file the server no longer has (expired, deleted) is skipped and said once (C-52); the others are saved;
 *   - the server's voice manifest is written LAST, verbatim, so a folder holding it holds every file it could;
 *   - any other failure removes the folder and then checks that it is gone: C-51 when it is, C-53 when it may remain.
 *
 *   SAVED             every listed file is in the folder (C-50);
 *   SOME_UNAVAILABLE  the rest are; some were no longer available (C-52);
 *   FAILED_REMOVED    nothing was kept (C-51);
 *   FAILED_REMAINS    the folder could not be confirmed removed (C-53);
 *   CANCELLED         the reader closed the picker (nothing is said).
 */
export type VoiceExportSaveResult = 'SAVED' | 'SOME_UNAVAILABLE' | 'FAILED_REMOVED' | 'FAILED_REMAINS' | 'CANCELLED';

export interface VoiceExportFolder {
  /** Writes one file and answers its bytes as read back from the folder. */
  write(fileName: string, mimeType: string, bytes: Uint8Array): Uint8Array;
  writeText(fileName: string, text: string): void;
  delete(): void;
  exists(): boolean;
}

export interface VoiceExportDevice {
  /** The reader's folder choice, then a fresh folder in it; null when the picker was closed. */
  pickFolder(name: (copy: number) => string): Promise<VoiceExportFolder | null>;
  /** Streams one file to a temporary place and answers its bytes; 'GONE' for a file no longer available (404). */
  download(url: string, headers: Record<string, string>): Promise<Uint8Array | 'GONE'>;
}

export interface VoiceExportAccess {
  url(fileName: string): string | null;
  authorization(): Record<string, string> | null;
}

/** `qandeel-voice-YYYY-MM-DD` — the folder of one save of the reader's voice recordings. */
export function exportVoiceFolderName(now: Date = new Date(), copy = 1): string {
  return `qandeel-voice-${now.toISOString().slice(0, 10)}${copy > 1 ? `-${copy}` : ''}`;
}
/** `qandeel-voice-YYYY-MM-DD.json` — the server's voice manifest, saved verbatim. */
export function exportVoiceManifestName(now: Date = new Date()): string {
  return `qandeel-voice-${now.toISOString().slice(0, 10)}.json`;
}

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((value, i) => value === b[i]);

export async function saveExportVoices(
  voices: ExportVoiceSet,
  access: VoiceExportAccess,
  device: VoiceExportDevice = createVoiceExportDevice(),
  now: Date = new Date(),
): Promise<VoiceExportSaveResult> {
  const folder = await device.pickFolder((copy) => exportVoiceFolderName(now, copy)).catch(() => null);
  if (folder === null) return 'CANCELLED';
  let gone = 0;
  try {
    for (const { fileName, bytes } of voices.files) {
      const url = access.url(fileName);
      const headers = access.authorization();
      if (url === null || headers === null) throw new Error('not this reader');
      const body = await device.download(url, headers);
      if (body === 'GONE') {
        gone += 1;
        continue;
      }
      if (body.length !== bytes) throw new Error('file length differs from its listing');
      const digest = sha256Hex(body);
      const written = folder.write(fileName, fileName.endsWith('.ogg') ? 'audio/ogg' : 'audio/mp4', body);
      if (written.length !== bytes || sha256Hex(written) !== digest || !sameBytes(written, body)) throw new Error('file not written whole');
    }
    if (gone === voices.files.length) throw new Error('nothing to save');
    folder.writeText(exportVoiceManifestName(now), JSON.stringify(voices.manifest, null, 2));
    return gone > 0 ? 'SOME_UNAVAILABLE' : 'SAVED';
  } catch {
    try {
      folder.delete();
    } catch {
      // checked below
    }
    let remains = true;
    try {
      remains = folder.exists();
    } catch {
      remains = true;
    }
    return remains ? 'FAILED_REMAINS' : 'FAILED_REMOVED';
  }
}

/** The platform's half: the system folder picker (SAF on Android) and a streamed download into the app's cache. */
export function createVoiceExportDevice(): VoiceExportDevice {
  return {
    async pickFolder(name) {
      let directory: Directory;
      try {
        directory = await Directory.pickDirectoryAsync();
      } catch {
        return null;
      }
      for (let copy = 1; copy <= MAX_SAME_DAY_COPIES; copy += 1) {
        let folder: Directory;
        try {
          folder = directory.createDirectory(name(copy));
        } catch {
          continue;
        }
        return {
          write(fileName, mimeType, bytes) {
            const file = folder.createFile(fileName, mimeType);
            file.write(bytes);
            return file.bytesSync();
          },
          writeText(fileName, text) {
            folder.createFile(fileName, 'application/json').write(text);
          },
          delete: () => folder.delete(),
          exists: () => folder.exists,
        };
      }
      throw new Error('no folder could be made');
    },
    async download(url, headers) {
      const temp = new File(Paths.cache, `qandeel-voice-export-${Date.now()}-${Math.floor(Math.random() * 1e9)}.tmp`);
      try {
        let downloaded: File;
        try {
          downloaded = await File.downloadFileAsync(url, temp, { headers, idempotent: true });
        } catch (cause) {
          // expo-file-system rejects a non-2xx answer; the server's 404 is NO_LONGER_AVAILABLE for this file.
          if (String(cause).includes('404')) return 'GONE';
          throw cause;
        }
        return downloaded.bytesSync();
      } finally {
        try {
          if (temp.exists) temp.delete();
        } catch {
          // A temporary file the platform already removed.
        }
      }
    },
  };
}
