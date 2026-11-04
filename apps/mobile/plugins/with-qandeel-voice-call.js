// S8B-06 CP2 (contract v1.0 §9, A6 06-CP2) — the native declarations of QANDEEL's live call, as TYPED mods only (CNG
// Level 2: no file is generated, moved or deleted; `android/` and `ios/` stay generated and untracked; no dangerous mod).
//
// Android (the generated AndroidManifest.xml):
//   - the three permissions a self-managed Core-Telecom call with its foreground service needs: FOREGROUND_SERVICE,
//     FOREGROUND_SERVICE_PHONE_CALL and MANAGE_OWN_CALLS. RECORD_AUDIO is expo-audio's and POST_NOTIFICATIONS is
//     expo-notifications', both declared already; this plugin adds no other permission;
//   - the ONE foreground service, `CallForegroundService`, not exported, of exactly the types in SERVICE_TYPES. The
//     service reads its types back from this manifest, so the code can never claim a type the build did not declare;
//   - nothing for the SDK floor: Core-Telecom 1.0.1 declares minSdk 23 (the app's floor is 24), but a self-managed call
//     needs API 26, so below 26 the module refuses a call with `API_BELOW_26` before touching any Telecom class
//     (LiveCallRegistry.unsupportedReason).
//   Core-Telecom's OWN manifest is merged by Gradle, not by this plugin: its `JetpackConnectionService` (exported, but
//   bindable only by the system holding BIND_TELECOM_CONNECTION_SERVICE), its `MuteStateReceiver` (the system's
//   microphone-mute broadcast) and the permissions BLUETOOTH_CONNECT, MANAGE_OWN_CALLS and MODIFY_AUDIO_SETTINGS. QANDEEL
//   never asks the person for BLUETOOTH_CONNECT; Bluetooth routing is Telecom's.
//
// iOS (the generated Info.plist): `UIBackgroundModes` gains `audio`, and only `audio` — the call's audio keeps running
// with the screen locked or the app in the background. NOT `voip` (no PushKit, no incoming call: the contract's calls are
// outgoing only). Voice Notes are unaffected: their recorder is expo-audio's, whose own background recording stays off
// (app.json `enableBackgroundRecording: false`), and a Voice Note capture stops itself the moment the app leaves the
// foreground (src/voice-note/voice-note-capture.ts, C-17), so the `audio` mode never keeps a Voice Note recording.
const { AndroidConfig, withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

const SERVICE_NAME = 'expo.modules.qandeelvoicecall.CallForegroundService';
const SERVICE_TYPES = Object.freeze(['phoneCall']);
const PERMISSIONS = Object.freeze([
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
  'android.permission.MANAGE_OWN_CALLS',
]);
const IOS_BACKGROUND_MODES = Object.freeze(['audio']);

function withAndroidCall(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    for (const permission of PERMISSIONS) AndroidConfig.Permissions.ensurePermission(manifest, permission);

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    application.service = (application.service ?? []).filter((s) => s.$['android:name'] !== SERVICE_NAME);
    application.service.push({
      $: {
        'android:name': SERVICE_NAME,
        'android:exported': 'false',
        'android:foregroundServiceType': SERVICE_TYPES.join('|'),
      },
    });
    return mod;
  });
}

function withIosCall(config) {
  return withInfoPlist(config, (mod) => {
    const modes = Array.isArray(mod.modResults.UIBackgroundModes) ? mod.modResults.UIBackgroundModes : [];
    mod.modResults.UIBackgroundModes = [...new Set([...modes, ...IOS_BACKGROUND_MODES])];
    return mod;
  });
}

function withQandeelVoiceCall(config) {
  return withIosCall(withAndroidCall(config));
}

module.exports = withQandeelVoiceCall;
module.exports.SERVICE_NAME = SERVICE_NAME;
module.exports.SERVICE_TYPES = SERVICE_TYPES;
module.exports.PERMISSIONS = PERMISSIONS;
module.exports.IOS_BACKGROUND_MODES = IOS_BACKGROUND_MODES;
