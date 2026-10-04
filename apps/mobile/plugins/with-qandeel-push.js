// A3-02 — Native Push: the two Android facts `expo-notifications`' own plugin cannot express, as TYPED manifest mods
// (CNG Level 2: no file is generated, moved or deleted; `android/` stays generated and untracked).
//
//   1. The notification small icon is the I-08B2.5 brand's own monochrome layer, `@drawable/ic_launcher_monochrome`,
//      which the W2-02 launch-identity plugin already installs byte-for-byte. Without this the platform falls back to
//      the full-colour launcher icon, which Android renders as a flat white blob. No new brand asset is drawn, derived
//      or re-encoded: the ratified vector is referenced where it already is.
//   2. A message that names no channel lands on QANDEEL's neutral channel (`qandeel`, the L0 channel), never on a
//      library default whose name QANDEEL did not choose.
//
// It adds no permission (expo-notifications declares POST_NOTIFICATIONS itself), no background mode, no Firebase
// configuration and no credential. The Firebase client configuration (`google-services.json`) is a build-time input,
// supplied from the build's secret store through `QANDEEL_ANDROID_GOOGLE_SERVICES_FILE` (app.config.js) and never
// committed; a build without it simply has no FCM token, and nothing is delivered to it.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const SMALL_ICON = '@drawable/ic_launcher_monochrome';
const NEUTRAL_CHANNEL = 'qandeel';

const META = Object.freeze({
  'com.google.firebase.messaging.default_notification_icon': { resource: SMALL_ICON },
  'expo.modules.notifications.default_notification_icon': { resource: SMALL_ICON },
  'com.google.firebase.messaging.default_notification_channel_id': { value: NEUTRAL_CHANNEL },
});

function withQandeelPush(config) {
  return withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    for (const [name, entry] of Object.entries(META)) {
      AndroidConfig.Manifest.removeMetaDataItemFromMainApplication(application, name);
      if (entry.resource) {
        application['meta-data'] = application['meta-data'] ?? [];
        application['meta-data'].push({ $: { 'android:name': name, 'android:resource': entry.resource } });
      } else {
        AndroidConfig.Manifest.addMetaDataItemToMainApplication(application, name, entry.value);
      }
    }
    return mod;
  });
}

module.exports = withQandeelPush;
module.exports.SMALL_ICON = SMALL_ICON;
module.exports.NEUTRAL_CHANNEL = NEUTRAL_CHANNEL;
