// S8B-03 (CP2, contract §5.6, VA-6 by the narrow reading of OD-7) — the native Voice Note gate. It proves, on the REAL
// generated projects and the sources that shape them, that the app may record a Voice Note in the foreground and nothing
// more:
//
//   - Android: RECORD_AUDIO is requested (never `tools:node="remove"`); no FOREGROUND_SERVICE* permission and no
//     foreground service exist; the unsent drafts are excluded from Auto Backup and from cloud backup / device transfer
//     (OD-6: both rule files, wired on <application>).
//   - iOS: NSMicrophoneUsageDescription is the approved C-12 — English in Info.plist, Arabic and English in
//     InfoPlist.strings; no UIBackgroundModes (so no `audio` and no `voip`) exists.
//   - The config: expo-audio with background recording AND background playback switched off (its plugin defaults
//     playback ON); expo-image-picker carrying C-12 instead of `false`, which would strip the microphone app-wide.
//   - The picker never captures sound: the one picker call asks for images only and no camera is ever launched.
//
// Background audio, calls and any early call permission are S8B-06's, not this task's. It then PLANTS a defect for every
// check family and requires each one to be caught, discards the generated `android/` and `ios/` output, and requires the
// repository state to be unchanged — the W2-02 / S6-06 gates' discipline.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectDir = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]+$/u, '');
const require = createRequire(import.meta.url);
const read = (file) => readFileSync(file, 'utf8');

const RECORD_AUDIO = 'android.permission.RECORD_AUDIO';
const BACKUP_EXCLUDED = ['qandeel-voice-drafts/', 'Audio/', 'SQLite/qandeel-voice-drafts.db'];
const PICKER_SOURCE = 'src/introductions/photo-source.ts';

/** The approved C-12 row, read from the copy module the app shows (one source for the app and the native build). */
export function microphonePurpose() {
  const copy = read(join(projectDir, 'src/voice-note/voice-note-copy.ts'));
  const match = /id: 'C-12',\s*ar: '((?:[^'\\]|\\.)*)',\s*en: '((?:[^'\\]|\\.)*)'/u.exec(copy);
  if (match === null) throw new Error('C-12 is not in the S8B-03 copy module');
  const unquote = (text) => text.replace(/\\(.)/gu, '$1');
  return { ar: unquote(match[1]), en: unquote(match[2]) };
}

export function checkConfig(appJson, localeFiles, purpose) {
  const failures = [];
  const app = JSON.parse(appJson).expo;
  const plugin = (name) => app.plugins.find((p) => Array.isArray(p) && p[0] === name)?.[1] ?? null;
  const audio = plugin('expo-audio');
  if (audio === null) failures.push('config: expo-audio is not configured');
  else {
    if (audio.enableBackgroundRecording !== false) failures.push('config: expo-audio enableBackgroundRecording is not false');
    if (audio.enableBackgroundPlayback !== false) failures.push('config: expo-audio enableBackgroundPlayback is not false');
    if (audio.microphonePermission !== purpose.en) failures.push('config: expo-audio microphonePermission is not C-12');
  }
  const picker = plugin('expo-image-picker');
  if (picker === null || picker.microphonePermission !== purpose.en) failures.push('config: expo-image-picker microphonePermission is not C-12');
  if (picker !== null && picker.cameraPermission !== false) failures.push('config: expo-image-picker cameraPermission is not false');
  if (app.ios?.infoPlist?.UIBackgroundModes !== undefined) failures.push('config: ios.infoPlist declares UIBackgroundModes');
  for (const [lang, text] of [['ar', purpose.ar], ['en', purpose.en]]) {
    const value = JSON.parse(localeFiles[lang]).ios?.NSMicrophoneUsageDescription ?? null;
    if (value !== text) failures.push(`config: locales/${lang}.json NSMicrophoneUsageDescription is not C-12`);
  }
  return failures;
}

/** VA-6: the one picker call asks for images only, and nothing in the app launches a camera. */
export function checkPickerSource(source) {
  const failures = [];
  const calls = [...source.matchAll(/launchImageLibraryAsync\(\{([\s\S]*?)\}\);/gu)];
  if (calls.length !== 1) failures.push(`picker: expected exactly one launchImageLibraryAsync call, found ${calls.length}`);
  for (const [, options] of calls) {
    if (!/mediaTypes: \['images'\],/u.test(options)) failures.push("picker: mediaTypes is not exactly ['images']");
  }
  if (/launchCameraAsync|requestCameraPermissionsAsync|['"](?:videos|livePhotos)['"]|MediaTypeOptions\.(?:All|Videos)/u.test(source)) {
    failures.push('picker: a camera, video or live-photo capture is reachable');
  }
  return failures;
}

export function checkAndroid(androidRoot) {
  const failures = [];
  const manifestFile = join(androidRoot, 'app/src/main/AndroidManifest.xml');
  if (!existsSync(manifestFile)) return ['android: AndroidManifest.xml was not generated'];
  const manifest = read(manifestFile);
  const declarations = [...manifest.matchAll(/<uses-permission\b[^>]*>/gu)].map((m) => m[0]);
  const nameOf = (tag) => /android:name="([^"]+)"/u.exec(tag)?.[1] ?? '';
  const removed = (tag) => /tools:node="remove"/u.test(tag);
  const audio = declarations.filter((tag) => nameOf(tag) === RECORD_AUDIO);
  if (audio.length === 0 || audio.some(removed)) failures.push('android: RECORD_AUDIO is not requested');
  for (const tag of declarations) {
    if (nameOf(tag).startsWith('android.permission.FOREGROUND_SERVICE') && !removed(tag)) failures.push(`android: ${nameOf(tag)} is requested`);
  }
  if (/<service\b[^>]*android:foregroundServiceType=/u.test(manifest)) failures.push('android: a foreground service is declared');
  const application = /<application\b[^>]*>/u.exec(manifest)?.[0] ?? '';
  for (const [attribute, resource] of [['android:fullBackupContent', 'qandeel_backup_rules'], ['android:dataExtractionRules', 'qandeel_data_extraction_rules']]) {
    if (!application.includes(`${attribute}="@xml/${resource}"`)) failures.push(`android: <application> does not carry ${attribute}="@xml/${resource}"`);
    const rules = join(androidRoot, 'app/src/main/res/xml', `${resource}.xml`);
    const text = existsSync(rules) ? read(rules) : '';
    for (const path of BACKUP_EXCLUDED) {
      const sections = resource === 'qandeel_backup_rules' ? 1 : 2;
      const found = text.split(`<exclude domain="file" path="${path}" />`).length - 1;
      if (found !== sections) failures.push(`android: ${resource}.xml does not exclude ${path}`);
    }
    if (/<include\b/u.test(text)) failures.push(`android: ${resource}.xml narrows backup to an include list`);
  }
  return failures;
}

export function checkIos(iosRoot, purpose) {
  const failures = [];
  const project = join(iosRoot, 'QANDEEL');
  const plistFile = join(project, 'Info.plist');
  if (!existsSync(plistFile)) return ['ios: Info.plist was not generated'];
  const plist = read(plistFile);
  const value = /<key>NSMicrophoneUsageDescription<\/key>\s*<string>([^<]*)<\/string>/u.exec(plist)?.[1] ?? null;
  const xml = (text) => text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/'/gu, '&apos;');
  if (value !== purpose.en && value !== xml(purpose.en)) failures.push(`ios: NSMicrophoneUsageDescription is ${JSON.stringify(value)}, not C-12`);
  if (plist.includes('<key>UIBackgroundModes</key>')) failures.push('ios: UIBackgroundModes must not exist');
  if (/<string>voip<\/string>/u.test(plist)) failures.push('ios: voip must not exist');
  for (const [lang, text] of [['ar', purpose.ar], ['en', purpose.en]]) {
    const stringsFile = join(project, 'Supporting', `${lang}.lproj`, 'InfoPlist.strings');
    const strings = existsSync(stringsFile) ? read(stringsFile) : '';
    if (!strings.includes(`NSMicrophoneUsageDescription = ${JSON.stringify(text)};`)) failures.push(`ios: ${lang}.lproj/InfoPlist.strings does not carry C-12`);
  }
  return failures;
}

function sourceChecks(purpose) {
  return [
    ...checkConfig(read(join(projectDir, 'app.json')), { ar: read(join(projectDir, 'locales/ar.json')), en: read(join(projectDir, 'locales/en.json')) }, purpose),
    ...checkPickerSource(read(join(projectDir, PICKER_SOURCE))),
  ];
}

function runPlantedDefects(androidRoot, iosRoot, purpose) {
  const manifest = join(androidRoot, 'app/src/main/AndroidManifest.xml');
  const appJson = join(projectDir, 'app.json');
  const plants = [
    { id: 'config-background-playback', file: appJson, check: () => sourceChecks(purpose),
      mutate: (text) => text.replace('"enableBackgroundPlayback": false', '"enableBackgroundPlayback": true') },
    { id: 'config-background-recording', file: appJson, check: () => sourceChecks(purpose),
      mutate: (text) => text.replace('"enableBackgroundRecording": false', '"enableBackgroundRecording": true') },
    { id: 'config-picker-strips-microphone', file: appJson, check: () => sourceChecks(purpose),
      mutate: (text) => text.replace(/("expo-image-picker",\s*\{[\s\S]*?"microphonePermission": )"[^"]*"/u, '$1false') },
    { id: 'locale-arabic-purpose-changed', file: join(projectDir, 'locales/ar.json'), check: () => sourceChecks(purpose),
      mutate: (text) => text.replace(JSON.stringify(purpose.ar), JSON.stringify(`${purpose.ar} `)) },
    { id: 'picker-captures-video', file: join(projectDir, PICKER_SOURCE), check: () => sourceChecks(purpose),
      mutate: (text) => text.replace("mediaTypes: ['images'],", "mediaTypes: ['images', 'videos'],") },
    { id: 'picker-launches-camera', file: join(projectDir, PICKER_SOURCE), check: () => sourceChecks(purpose),
      mutate: (text) => text.replace('ImagePicker.launchImageLibraryAsync({', 'ImagePicker.launchCameraAsync({ });\n        result = await ImagePicker.launchImageLibraryAsync({') },
    { id: 'android-record-audio-removed', file: manifest, check: () => checkAndroid(androidRoot),
      mutate: (text) => text.replace(/<uses-permission android:name="android\.permission\.RECORD_AUDIO"\s*\/>/u, '<uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove"/>') },
    { id: 'android-foreground-service', file: manifest, check: () => checkAndroid(androidRoot),
      mutate: (text) => text.replace('<application', '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE"/>\n  <application') },
    { id: 'android-backup-unwired', file: manifest, check: () => checkAndroid(androidRoot),
      mutate: (text) => text.replace(' android:dataExtractionRules="@xml/qandeel_data_extraction_rules"', '') },
    { id: 'android-backup-rule-dropped', file: join(androidRoot, 'app/src/main/res/xml/qandeel_backup_rules.xml'), check: () => checkAndroid(androidRoot),
      mutate: (text) => text.replace('<exclude domain="file" path="Audio/" />', '') },
    ...(iosRoot === null ? [] : [
      { id: 'ios-purpose-changed', file: join(iosRoot, 'QANDEEL/Info.plist'), check: () => checkIos(iosRoot, purpose),
        mutate: (text) => text.replace(/(<key>NSMicrophoneUsageDescription<\/key>\s*<string>)[^<]*/u, '$1Allow $(PRODUCT_NAME) to access your microphone') },
      { id: 'ios-background-audio', file: join(iosRoot, 'QANDEEL/Info.plist'), check: () => checkIos(iosRoot, purpose),
        mutate: (text) => text.replace('<dict>', '<dict>\n    <key>UIBackgroundModes</key>\n    <array><string>audio</string></array>') },
      { id: 'ios-arabic-missing', file: join(iosRoot, 'QANDEEL/Supporting/ar.lproj/InfoPlist.strings'), check: () => checkIos(iosRoot, purpose),
        mutate: (text) => text.replace(/NSMicrophoneUsageDescription = .*;\n?/u, '') },
    ]),
  ];
  let missed = 0;
  for (const plant of plants) {
    const before = read(plant.file);
    const after = plant.mutate(before);
    if (after === before) {
      console.error(`FAIL planted defect ${plant.id} could not be planted`);
      missed += 1;
      continue;
    }
    writeFileSync(plant.file, after);
    let caught;
    try {
      caught = plant.check().length > 0;
    } finally {
      writeFileSync(plant.file, before);
    }
    console.log(`${caught ? 'CAUGHT' : 'MISSED'} planted defect ${plant.id}`);
    if (!caught) missed += 1;
  }
  return missed;
}

function capture(command, args) {
  const result = spawnSync(command, args, { cwd: projectDir, encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited ${result.status}`);
  return result.stdout;
}

function main() {
  // Expo CLI refuses to generate the iOS project on Windows hosts; CI (Linux) proves both.
  const platforms = process.platform === 'win32' ? ['android'] : ['android', 'ios'];
  const expoCli = join(dirname(require.resolve('expo/package.json')), 'bin', 'cli');
  const purpose = microphonePurpose();
  if (capture('git', ['ls-files', '--', 'android', 'ios']).trim()) throw new Error('generated native directories must never be tracked');
  const statusBefore = capture('git', ['status', '--porcelain', '--untracked-files=all']);
  const removeGenerated = () => ['android', 'ios'].forEach((directory) => rmSync(join(projectDir, directory), { recursive: true, force: true }));
  removeGenerated();
  let failed = false;
  try {
    for (const platform of platforms) {
      const result = spawnSync(process.execPath, [expoCli, 'prebuild', '--platform', platform, '--no-install'], {
        cwd: projectDir, stdio: 'inherit', windowsHide: true, env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
      });
      if (result.status !== 0) throw new Error(`expo prebuild --platform ${platform} exited ${result.status}`);
    }
    const androidRoot = join(projectDir, 'android');
    const iosRoot = platforms.includes('ios') ? join(projectDir, 'ios') : null;
    const failures = [...sourceChecks(purpose), ...checkAndroid(androidRoot), ...(iosRoot === null ? [] : checkIos(iosRoot, purpose))];
    for (const failure of failures) console.error(`FAIL ${failure}`);
    if (failures.length > 0) {
      failed = true;
    } else {
      console.log(`PASS: the generated ${platforms.join(' + ')} projects record in the foreground only, with the approved C-12${iosRoot === null ? '' : ' in Arabic and English'}, drafts kept out of backup, and a picker that never captures sound.`);
      const missed = runPlantedDefects(androidRoot, iosRoot, purpose);
      if (missed > 0) {
        console.error(`FAIL: ${missed} planted defect(s) were not caught`);
        failed = true;
      } else {
        console.log('PASS: every planted defect was caught.');
      }
    }
  } finally {
    removeGenerated();
  }
  const statusAfter = capture('git', ['status', '--porcelain', '--untracked-files=all']);
  if (statusBefore !== statusAfter) {
    console.error('FAIL: the Voice Note native gate changed the repository state.');
    failed = true;
  }
  if (failed) process.exit(1);
  console.log('PASS: generated native directories were discarded and the repository state is unchanged.');
}

if (process.argv[1] !== undefined && process.argv[1].replace(/\\/gu, '/').endsWith('scripts/verify-voice-note-native.mjs')) main();
