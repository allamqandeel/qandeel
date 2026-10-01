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
 */
import { Directory } from 'expo-file-system';

export type ExportSaveResult = 'SAVED' | 'CANCELLED' | 'FAILED';

/** `qandeel-data-YYYY-MM-DD.json` — a file name that says what it is, in Latin letters on every device. */
export function exportFileName(now: Date = new Date(), copy = 1): string {
  return `qandeel-data-${now.toISOString().slice(0, 10)}${copy > 1 ? `-${copy}` : ''}.json`;
}

const MAX_SAME_DAY_COPIES = 20;

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
