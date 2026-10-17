// S6-06 native photo-permission gate (WP0 correction 4). It proves, on the REAL generated projects, what the app config
// declares for choosing an Introduction photo, and nothing more:
//
//   - Android: the system Photo Picker needs no permission. CAMERA and RECORD_AUDIO (expo-image-picker's `false`
//     options) and READ / WRITE_EXTERNAL_STORAGE (`android.blockedPermissions`) are declared `tools:node="remove"`, so no
//     library can bring them back at manifest merge; no READ_MEDIA_* permission is requested at all.
//   - iOS: PHPicker needs no library access either, but the app keeps its OWN Photos purpose string (PD-83, approved in
//     both languages) so the build stays valid (ITMS-90683): English in Info.plist, Arabic and English in InfoPlist.strings.
//     No camera, microphone or add-to-library purpose string exists.
//
// It then PLANTS a defect for every check family and requires each one to be caught, discards the generated `android/`
// and `ios/` output, and requires the repository state to be unchanged — the W2-02 gate's discipline.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectDir = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]+$/u, '');
const require = createRequire(import.meta.url);
const read = (file) => readFileSync(file, 'utf8');

const REMOVED = ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE'];
const NEVER = ['android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO', 'android.permission.READ_MEDIA_VISUAL_USER_SELECTED'];
const IOS_ABSENT = ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSPhotoLibraryAddUsageDescription'];

/** The approved PD-83 row, read from the generated copy module (one source for the app and the native build). */
export function purposeStrings() {
  const copy = read(join(projectDir, 'src/introductions/introduction-sharing-copy.ts'));
  const match = /photosPurpose: \{ id: 'PD-83', ar: ("[^"]*"), en: ("[^"]*") \}/u.exec(copy);
  if (match === null) throw new Error('PD-83 is not in the S6-06 copy module');
  return { ar: JSON.parse(match[1]), en: JSON.parse(match[2]) };
}

export function checkAndroid(androidRoot) {
  const failures = [];
  const manifestFile = join(androidRoot, 'app/src/main/AndroidManifest.xml');
  if (!existsSync(manifestFile)) return ['android: AndroidManifest.xml was not generated'];
  const manifest = read(manifestFile);
  const declarations = [...manifest.matchAll(/<uses-permission\b[^>]*>/gu)].map((m) => m[0]);
  const nameOf = (tag) => /android:name="([^"]+)"/u.exec(tag)?.[1] ?? '';
  for (const permission of REMOVED) {
    const tags = declarations.filter((tag) => nameOf(tag) === permission);
    if (!tags.some((tag) => /tools:node="remove"/u.test(tag))) failures.push(`android: ${permission} is not declared tools:node="remove"`);
    if (tags.some((tag) => !/tools:node="remove"/u.test(tag))) failures.push(`android: ${permission} is requested`);
  }
  for (const permission of NEVER) {
    if (declarations.some((tag) => nameOf(tag) === permission && !/tools:node="remove"/u.test(tag))) failures.push(`android: ${permission} is requested`);
  }
  return failures;
}

export function checkIos(iosRoot, purpose) {
  const failures = [];
  const project = join(iosRoot, 'QANDEEL');
  const plistFile = join(project, 'Info.plist');
  if (!existsSync(plistFile)) return ['ios: Info.plist was not generated'];
  const plist = read(plistFile);
  const value = /<key>NSPhotoLibraryUsageDescription<\/key>\s*<string>([^<]*)<\/string>/u.exec(plist)?.[1] ?? null;
  if (value !== purpose.en) failures.push(`ios: NSPhotoLibraryUsageDescription is ${JSON.stringify(value)}, not PD-83`);
  for (const key of IOS_ABSENT) if (plist.includes(`<key>${key}</key>`)) failures.push(`ios: ${key} must not exist`);
  for (const [lang, text] of [['ar', purpose.ar], ['en', purpose.en]]) {
    const stringsFile = join(project, 'Supporting', `${lang}.lproj`, 'InfoPlist.strings');
    const strings = existsSync(stringsFile) ? read(stringsFile) : '';
    if (!strings.includes(`NSPhotoLibraryUsageDescription = "${text}";`)) failures.push(`ios: ${lang}.lproj/InfoPlist.strings does not carry PD-83`);
  }
  return failures;
}

function runPlantedDefects(androidRoot, iosRoot, purpose) {
  const plants = [
    { id: 'android-camera-requested', file: join(androidRoot, 'app/src/main/AndroidManifest.xml'), check: () => checkAndroid(androidRoot),
      mutate: (text) => text.replace('<application', '<uses-permission android:name="android.permission.CAMERA"/>\n  <application') },
    { id: 'android-media-requested', file: join(androidRoot, 'app/src/main/AndroidManifest.xml'), check: () => checkAndroid(androidRoot),
      mutate: (text) => text.replace('<application', '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>\n  <application') },
    { id: 'android-storage-not-removed', file: join(androidRoot, 'app/src/main/AndroidManifest.xml'), check: () => checkAndroid(androidRoot),
      mutate: (text) => text.replace(/<uses-permission android:name="android\.permission\.READ_EXTERNAL_STORAGE"[^>]*\/>/u, '') },
    ...(iosRoot === null ? [] : [
      { id: 'ios-purpose-changed', file: join(iosRoot, 'QANDEEL/Info.plist'), check: () => checkIos(iosRoot, purpose),
        mutate: (text) => text.replace(purpose.en, 'Allow $(PRODUCT_NAME) to access your photos') },
      { id: 'ios-camera-key', file: join(iosRoot, 'QANDEEL/Info.plist'), check: () => checkIos(iosRoot, purpose),
        mutate: (text) => text.replace('<dict>', '<dict>\n    <key>NSCameraUsageDescription</key>\n    <string>x</string>') },
      { id: 'ios-arabic-missing', file: join(iosRoot, 'QANDEEL/Supporting/ar.lproj/InfoPlist.strings'), check: () => checkIos(iosRoot, purpose),
        mutate: () => '' },
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
    const caught = plant.check().length > 0;
    console.log(`${caught ? 'CAUGHT' : 'MISSED'} planted defect ${plant.id}`);
    if (!caught) missed += 1;
    writeFileSync(plant.file, before);
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
  const purpose = purposeStrings();
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
    const failures = [...checkAndroid(androidRoot), ...(iosRoot === null ? [] : checkIos(iosRoot, purpose))];
    for (const failure of failures) console.error(`FAIL ${failure}`);
    if (failures.length > 0) {
      failed = true;
    } else {
      console.log(`PASS: the generated ${platforms.join(' + ')} projects request no camera, microphone, storage or media permission${iosRoot === null ? '' : ' and carry PD-83 in Arabic and English'}.`);
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
    console.error('FAIL: the photo-permission gate changed the repository state.');
    failed = true;
  }
  if (failed) process.exit(1);
  console.log('PASS: generated native directories were discarded and the repository state is unchanged.');
}

if (process.argv[1] !== undefined && process.argv[1].replace(/\\/gu, '/').endsWith('scripts/verify-introduction-photo-native.mjs')) main();
