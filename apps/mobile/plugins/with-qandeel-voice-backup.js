// S8B-03 (CP2, OD-6, contract §8.2 / B4) — the NARROW Android backup exclusion of the Voice Note drafts.
//
// An unsent voice draft stays on this device only. Android's Auto Backup (API 23–30: `android:fullBackupContent`) and
// its cloud backup / device-to-device transfer (API 31+: `android:dataExtractionRules`) would otherwise copy the app's
// files, so both rule files EXCLUDE exactly:
//
//   file      qandeel-voice-drafts/                    every account's draft audio (`Paths.document` is `filesDir`)
//   file      Audio/                                   expo-audio's in-progress recording folder (directory "document")
//   file      SQLite/qandeel-voice-drafts.db (+ -wal, -shm, -journal)   the drafts' metadata (expo-sqlite/kv-store)
//
// Rules that only exclude keep every other file in backup exactly as before: the app-wide `allowBackup` decision is
// QAN-BL-SEC-01's and is not touched here. The two XML resources are not written by this plugin: the local module
// `modules/qandeel-backup-exclusion` ships them in its Android `res/xml`, and Android merges a library's resources into
// the app. This plugin only points <application> at them, through the typed manifest mod — no dangerous mod, no
// permission, no service and no other file.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const FULL_BACKUP_RESOURCE = 'qandeel_backup_rules';
const DATA_EXTRACTION_RESOURCE = 'qandeel_data_extraction_rules';

function withQandeelVoiceBackup(config) {
  return withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    application.$['android:fullBackupContent'] = `@xml/${FULL_BACKUP_RESOURCE}`;
    application.$['android:dataExtractionRules'] = `@xml/${DATA_EXTRACTION_RESOURCE}`;
    return mod;
  });
}

module.exports = withQandeelVoiceBackup;
module.exports.FULL_BACKUP_RESOURCE = FULL_BACKUP_RESOURCE;
module.exports.DATA_EXTRACTION_RESOURCE = DATA_EXTRACTION_RESOURCE;
