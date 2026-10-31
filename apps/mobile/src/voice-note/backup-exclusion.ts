/**
 * S8B-03 (CP2, OD-6, contract §8.2 / B4) — the narrow backup exclusion of the Voice Note drafts.
 *
 *   Android: the app's backup rules (plugins/with-qandeel-voice-backup.js) exclude the drafts folder, the recorder's
 *            in-progress folder and the drafts database from cloud backup and device transfer. Nothing to do at runtime.
 *   iOS:     the local module `QandeelBackupExclusion` sets NSURLIsExcludedFromBackupKey on the same items and reads it
 *            back. A folder's flag covers what is inside it.
 *
 * Nothing else in the app is excluded (the app-wide `allowBackup` is QAN-BL-SEC-01's, untouched). Nothing is logged.
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

interface QandeelBackupExclusionModule {
  exclude(uri: string): boolean;
  isExcluded(uri: string): boolean;
}

/** `null` off iOS, under Jest, and on any host where the module is not linked. */
const iosBackupExclusion =
  Platform.OS === 'ios' ? requireOptionalNativeModule<QandeelBackupExclusionModule>('QandeelBackupExclusion') : null;

/** EXCLUDED: the flag reads back set (iOS). BY_RULES: the platform's backup rules exclude it (Android). */
export type BackupExclusion = 'EXCLUDED' | 'BY_RULES' | 'NOT_EXCLUDED';

export function excludeFromBackup(uri: string, os: string = Platform.OS): BackupExclusion {
  if (os === 'android') return 'BY_RULES';
  if (os !== 'ios' || iosBackupExclusion === null) return 'NOT_EXCLUDED';
  try {
    return iosBackupExclusion.exclude(uri) ? 'EXCLUDED' : 'NOT_EXCLUDED';
  } catch {
    return 'NOT_EXCLUDED';
  }
}

export function backupExclusionOf(uri: string, os: string = Platform.OS): BackupExclusion {
  if (os === 'android') return 'BY_RULES';
  if (os !== 'ios' || iosBackupExclusion === null) return 'NOT_EXCLUDED';
  try {
    return iosBackupExclusion.isExcluded(uri) ? 'EXCLUDED' : 'NOT_EXCLUDED';
  } catch {
    return 'NOT_EXCLUDED';
  }
}

/** The folder holding a file URI (the recorder's in-progress folder). */
export function folderOf(uri: string): string {
  const trimmed = uri.replace(/\/+$/u, '');
  return trimmed.slice(0, trimmed.lastIndexOf('/') + 1);
}
