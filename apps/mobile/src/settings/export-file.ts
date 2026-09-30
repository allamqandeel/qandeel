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
export function exportFileName(now: Date = new Date()): string {
  return `qandeel-data-${now.toISOString().slice(0, 10)}.json`;
}

export async function saveExportDocument(document: Record<string, unknown>, now: Date = new Date()): Promise<ExportSaveResult> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch {
    return 'CANCELLED';
  }
  try {
    const file = directory.createFile(exportFileName(now), 'application/json');
    file.write(JSON.stringify(document, null, 2));
    return 'SAVED';
  } catch {
    return 'FAILED';
  }
}
