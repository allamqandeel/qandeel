// W2-02 native launch-identity gate. It proves, on the REAL generated projects, what the W2-02 plugin
// (plugins/with-qandeel-launch-identity.js) is for:
//
//   - the installed app icons are the vendored I-08B2.5 bytes, unchanged, and no Expo template icon or
//     splash logo survives;
//   - the Android 12+ system splash and the first app-owned Android window are the World (Light #efeeeb,
//     Dark #101010 under `values-night`), the splash keeps the launcher icon, and there is one activity and
//     no splash library, animated icon or hold;
//   - the Android application night mode is set to the effective QANDEEL appearance (Dark);
//   - the iOS Launch Screen is the World colour asset and nothing else, follows the device appearance
//     (`UIUserInterfaceStyle` Automatic), and the first app-owned iOS pixels are the World;
//   - the launcher / home-screen label is QANDEEL.
//
// It then PLANTS a defect for every check family into the generated tree and requires each one to be
// caught, so no check here can pass by being unable to fail. Generated `android/` and `ios/` output is
// discarded afterwards and the repository state must be unchanged, exactly as `prebuild:verify` requires.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectDir = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]+$/u, '');
const require = createRequire(import.meta.url);
const { internals } = require('../plugins/with-qandeel-launch-identity.js');

export const WORLD = internals.WORLD;
const VENDORED_ANDROID_RES = internals.VENDORED_ANDROID_RES;
const VENDORED_IOS_APP_ICON_SET = internals.VENDORED_IOS_APP_ICON_SET;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (file) => readFileSync(file, 'utf8');

function listFiles(directory, base = directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .flatMap((entry) => {
      const full = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(full, base) : [relative(base, full).split(sep).join('/')];
    });
}

function compareVendoredTree(id, vendoredDirectory, generatedDirectory, failures) {
  for (const file of listFiles(vendoredDirectory)) {
    const generated = join(generatedDirectory, file);
    if (!existsSync(generated)) {
      failures.push(`${id}: missing ${file}`);
    } else if (sha256(readFileSync(generated)) !== sha256(readFileSync(join(vendoredDirectory, file)))) {
      failures.push(`${id}: ${file} is not byte-identical to the vendored I-08B2.5 export`);
    }
  }
}

function styleItems(stylesXml, styleName) {
  const match = stylesXml.match(new RegExp(`<style name="${styleName.replace(/\./gu, '\\.')}"([^>]*)>([\\s\\S]*?)</style>`, 'u'));
  if (!match) return null;
  const items = {};
  for (const item of match[2].matchAll(/<item name="([^"]+)"[^>]*>([^<]*)<\/item>/gu)) items[item[1]] = item[2].trim();
  return { attributes: match[1], items };
}

function colorValue(colorsXml, name) {
  return colorsXml.match(new RegExp(`<color name="${name}">([^<]*)</color>`, 'u'))?.[1]?.trim().toLowerCase() ?? null;
}

/** Every Android failure found in a generated `android/` project; empty when it is correct. */
export function checkAndroid(androidRoot) {
  const failures = [];
  const main = join(androidRoot, 'app', 'src', 'main');
  const res = join(main, 'res');

  compareVendoredTree('A-ICON-BYTES', VENDORED_ANDROID_RES, res, failures);
  for (const file of listFiles(res)) {
    if (/(^|\/)ic_launcher[^/]*\.webp$/u.test(file)) failures.push(`A-NO-TEMPLATE-ICON: Expo template icon ${file} survives`);
    if (/splashscreen_logo/u.test(file)) failures.push(`A-NO-TEMPLATE-ICON: Expo splash logo ${file} survives`);
  }
  if (existsSync(join(res, 'drawable', 'ic_launcher_background.xml'))) {
    failures.push('A-NO-TEMPLATE-ICON: the template splash layer-list drawable/ic_launcher_background.xml survives');
  }

  const colors = read(join(res, 'values', 'colors.xml'));
  if (colorValue(colors, 'qandeel_world') !== WORLD.light) failures.push(`A-WORLD-LIGHT: values qandeel_world must be ${WORLD.light}`);
  if (/splashscreen_background/u.test(colors)) failures.push('A-WORLD-LIGHT: the template splashscreen_background colour survives');
  const nightFile = join(res, 'values-night', 'colors.xml');
  const night = existsSync(nightFile) ? read(nightFile) : '';
  if (colorValue(night, 'qandeel_world') !== WORLD.dark) failures.push(`A-WORLD-DARK: values-night qandeel_world must be ${WORLD.dark}`);

  const styles = read(join(res, 'values', 'styles.xml'));
  const appTheme = styleItems(styles, 'AppTheme');
  const splashTheme = styleItems(styles, 'Theme.App.SplashScreen');
  if (!appTheme || !/parent="Theme\.AppCompat\.DayNight\.NoActionBar"/u.test(appTheme.attributes)) {
    failures.push('A-THEME: AppTheme must stay a DayNight theme so the night resources apply');
  }
  if (appTheme?.items['android:windowBackground'] !== '@color/qandeel_world') {
    failures.push('A-THEME: the first app-owned window (AppTheme windowBackground) must be @color/qandeel_world');
  }
  for (const attribute of ['android:windowBackground', 'android:windowSplashScreenBackground']) {
    if (splashTheme?.items[attribute] !== '@color/qandeel_world') failures.push(`A-THEME: Theme.App.SplashScreen ${attribute} must be @color/qandeel_world`);
  }
  for (const forbidden of ['windowSplashScreenAnimatedIcon', 'windowSplashScreenBrandingImage', 'windowSplashScreenIconBackgroundColor', 'windowSplashScreenAnimationDuration', 'postSplashScreenTheme', 'Theme.SplashScreen', 'splashscreen_logo']) {
    if (styles.includes(forbidden)) failures.push(`A-THEME: ${forbidden} must not appear; the system splash keeps the launcher icon`);
  }

  const manifest = read(join(main, 'AndroidManifest.xml'));
  const application = manifest.match(/<application\b[^>]*>/u)?.[0] ?? '';
  for (const [attribute, value] of [['android:icon', '@mipmap/ic_launcher'], ['android:roundIcon', '@mipmap/ic_launcher_round'], ['android:label', '@string/app_name']]) {
    if (!application.includes(`${attribute}="${value}"`)) failures.push(`A-MANIFEST: <application> must declare ${attribute}="${value}"`);
  }
  const activities = [...manifest.matchAll(/<activity\b[^>]*>/gu)].map((match) => match[0]);
  if (activities.length !== 1) failures.push(`A-MANIFEST: exactly one activity is allowed (no second splash); found ${activities.length}`);
  if (!activities[0]?.includes('android:theme="@style/Theme.App.SplashScreen"')) failures.push('A-MANIFEST: MainActivity must launch in Theme.App.SplashScreen');
  if ((manifest.match(/android\.intent\.category\.LAUNCHER/gu) ?? []).length !== 1) failures.push('A-MANIFEST: exactly one LAUNCHER entry is allowed');

  const strings = read(join(res, 'values', 'strings.xml'));
  if (!/<string name="app_name">QANDEEL<\/string>/u.test(strings)) failures.push('A-LABEL: the launcher label (app_name) must be QANDEEL');

  const javaFiles = listFiles(join(main, 'java')).map((file) => join(main, 'java', file));
  const mainApplication = javaFiles.find((file) => file.endsWith('MainApplication.kt'));
  const mainActivity = javaFiles.find((file) => file.endsWith('MainActivity.kt'));
  const application_kt = mainApplication ? read(mainApplication) : '';
  const nightModeCalls = application_kt.match(/setApplicationNightMode\(android\.app\.UiModeManager\.MODE_NIGHT_YES\)/gu) ?? [];
  if (nightModeCalls.length !== 1 || !application_kt.includes(internals.NIGHT_MODE_BEGIN)) {
    failures.push('A-NIGHT-MODE: MainApplication must set the application night mode to the effective (Dark) appearance exactly once');
  }
  for (const [name, text] of [['MainApplication', application_kt], ['MainActivity', mainActivity ? read(mainActivity) : '']]) {
    for (const forbidden of ['setKeepOnScreenCondition', 'Thread.sleep', 'postDelayed', 'installSplashScreen']) {
      if (text.includes(forbidden)) failures.push(`A-NO-HOLD: ${name} must not contain ${forbidden}`);
    }
  }
  const appGradle = read(join(androidRoot, 'app', 'build.gradle'));
  if (/core-splashscreen/u.test(appGradle)) failures.push('A-NO-HOLD: no splash-screen library is added');
  return failures;
}

function plistString(plist, key) {
  return plist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`, 'u'))?.[1] ?? null;
}

/** Every iOS failure found in a generated `ios/` project; empty when it is correct. */
export function checkIos(iosRoot) {
  const failures = [];
  const projectName = readdirSync(iosRoot).find((name) => name.endsWith('.xcodeproj'))?.replace(/\.xcodeproj$/u, '');
  if (!projectName) return ['I-PROJECT: no .xcodeproj was generated'];
  const app = join(iosRoot, projectName);
  const catalog = join(app, 'Images.xcassets');
  const iconSet = join(catalog, 'AppIcon.appiconset');

  compareVendoredTree('I-ICON-SET', VENDORED_IOS_APP_ICON_SET, iconSet, failures);
  const expected = new Set(listFiles(VENDORED_IOS_APP_ICON_SET));
  for (const file of listFiles(iconSet)) {
    if (!expected.has(file)) failures.push(`I-ICON-SET: ${file} is not part of the canonical icon set`);
  }
  const iconContents = existsSync(join(iconSet, 'Contents.json')) ? read(join(iconSet, 'Contents.json')) : '';
  if (/"appearances"/u.test(iconContents)) failures.push('I-ICON-SET: no dark / tinted icon variant exists in v1');

  const catalogEntries = readdirSync(catalog).sort();
  const allowedEntries = ['AppIcon.appiconset', 'Contents.json', `${internals.IOS_WORLD_COLOR}.colorset`];
  if (JSON.stringify(catalogEntries) !== JSON.stringify(allowedEntries.slice().sort())) {
    failures.push(`I-ASSETS: the asset catalog must hold only ${allowedEntries.join(', ')}; found ${catalogEntries.join(', ')}`);
  }

  const colorSetFile = join(catalog, `${internals.IOS_WORLD_COLOR}.colorset`, 'Contents.json');
  const colors = existsSync(colorSetFile) ? JSON.parse(read(colorSetFile)).colors : [];
  const hexOf = (entry) => `#${['red', 'green', 'blue'].map((channel) => entry.color.components[channel].replace(/^0x/u, '')).join('')}`.toLowerCase();
  const any = colors.filter((entry) => !entry.appearances);
  const dark = colors.filter((entry) => entry.appearances?.some((appearance) => appearance.appearance === 'luminosity' && appearance.value === 'dark'));
  if (colors.length !== 2 || any.length !== 1 || hexOf(any[0]) !== WORLD.light) failures.push(`I-WORLD-COLOR: the any-appearance World must be ${WORLD.light}`);
  if (dark.length !== 1 || hexOf(dark[0]) !== WORLD.dark) failures.push(`I-WORLD-COLOR: the dark-appearance World must be ${WORLD.dark}`);

  const storyboard = read(join(app, 'SplashScreen.storyboard'));
  if (!/launchScreen="YES"/u.test(storyboard)) failures.push('I-LAUNCH: SplashScreen.storyboard must be a launch screen');
  if (!storyboard.includes(`<color key="backgroundColor" name="${internals.IOS_WORLD_COLOR}"/>`)) failures.push('I-LAUNCH: the launch view must be filled with the World colour asset');
  for (const forbidden of ['<imageView', '<image ', '<label', '<textView', '<button', 'SplashScreenLogo', 'systemBackgroundColor']) {
    if (storyboard.includes(forbidden)) failures.push(`I-LAUNCH: the Launch Screen must carry the World only; found ${forbidden}`);
  }

  const plist = read(join(app, 'Info.plist'));
  if (plistString(plist, 'UILaunchStoryboardName') !== 'SplashScreen') failures.push('I-PLIST: UILaunchStoryboardName must be SplashScreen');
  if (plistString(plist, 'UIUserInterfaceStyle') !== 'Automatic') failures.push('I-PLIST: UIUserInterfaceStyle must be Automatic so the Launch Screen follows the device');
  if (plistString(plist, 'CFBundleDisplayName') !== 'QANDEEL') failures.push('I-PLIST: the home-screen label (CFBundleDisplayName) must be QANDEEL');
  if (/<key>UILaunchScreen<\/key>|<key>UILaunchImages<\/key>/u.test(plist)) failures.push('I-PLIST: no second launch definition is allowed');

  const appDelegate = read(join(app, 'AppDelegate.swift'));
  if ((appDelegate.match(/override func customize\(_ rootView: UIView\)/gu) ?? []).length !== 1 || !appDelegate.includes(internals.ROOT_VIEW_BEGIN)) {
    failures.push('I-ROOT-VIEW: AppDelegate must paint the root view with the World exactly once');
  }
  if (!appDelegate.includes('UIColor(red: 16.0 / 255.0, green: 16.0 / 255.0, blue: 16.0 / 255.0, alpha: 1.0)')) failures.push('I-ROOT-VIEW: the root view must be the Dark World #101010');
  for (const forbidden of ['asyncAfter', 'usleep', 'Thread.sleep', 'sleep(']) {
    if (appDelegate.includes(forbidden)) failures.push(`I-NO-HOLD: AppDelegate must not contain ${forbidden}`);
  }
  return failures;
}

function flipLastByte(file) {
  const bytes = readFileSync(file);
  bytes[bytes.length - 1] ^= 0x01;
  writeFileSync(file, bytes);
}
const replaceIn = (file, from, to) => writeFileSync(file, read(file).replace(from, to));

/** Each planted defect mutates the generated tree; the named check family must catch it. */
export function plantedDefects(androidRoot, iosRoot) {
  const res = join(androidRoot, 'app', 'src', 'main', 'res');
  const main = join(androidRoot, 'app', 'src', 'main');
  const defects = [
    ['android', 'A-ICON-BYTES', 'one byte of the xxxhdpi adaptive foreground changes', join(res, 'mipmap-xxxhdpi', 'ic_launcher_foreground.png'), (file) => flipLastByte(file)],
    ['android', 'A-NO-TEMPLATE-ICON', 'an Expo template icon comes back', join(res, 'mipmap-mdpi', 'ic_launcher.webp'), (file) => writeFileSync(file, 'webp')],
    ['android', 'A-WORLD-DARK', 'the Dark launch ground becomes the icon ground #0A0B0D', join(res, 'values-night', 'colors.xml'), (file) => replaceIn(file, WORLD.dark, '#0A0B0D')],
    ['android', 'A-WORLD-LIGHT', 'the Light launch ground becomes white', join(res, 'values', 'colors.xml'), (file) => replaceIn(file, WORLD.light, '#ffffff')],
    ['android', 'A-THEME', 'a custom splash icon replaces the launcher icon', join(res, 'values', 'styles.xml'), (file) => replaceIn(file, '</style>\n</resources>', '  <item name="android:windowSplashScreenAnimatedIcon">@drawable/rn_edit_text_material</item>\n  </style>\n</resources>')],
    ['android', 'A-MANIFEST', 'a second splash activity is declared', join(main, 'AndroidManifest.xml'), (file) => replaceIn(file, '</application>', '<activity android:name=".SplashActivity" android:exported="false"/></application>')],
    ['android', 'A-LABEL', 'the launcher label reverts to Qandeel', join(res, 'values', 'strings.xml'), (file) => replaceIn(file, '>QANDEEL<', '>Qandeel<')],
    ['android', 'A-NIGHT-MODE', 'the application night mode is not set', null, () => {
      const file = listFiles(join(main, 'java')).map((name) => join(main, 'java', name)).find((name) => name.endsWith('MainApplication.kt'));
      replaceIn(file, 'MODE_NIGHT_YES', 'MODE_NIGHT_AUTO');
      return file;
    }],
  ];
  if (iosRoot) {
    const projectName = readdirSync(iosRoot).find((name) => name.endsWith('.xcodeproj')).replace(/\.xcodeproj$/u, '');
    const app = join(iosRoot, projectName);
    const catalog = join(app, 'Images.xcassets');
    defects.push(
      ['ios', 'I-ICON-SET', 'one byte of the 1024 marketing icon changes', join(catalog, 'AppIcon.appiconset', 'AppIcon-1024.png'), (file) => flipLastByte(file)],
      ['ios', 'I-ICON-SET', 'a dark icon variant is introduced', join(catalog, 'AppIcon.appiconset', 'Contents.json'), (file) => replaceIn(file, '"idiom": "ios-marketing",', '"idiom": "ios-marketing", "appearances": [{"appearance": "luminosity", "value": "dark"}],')],
      ['ios', 'I-WORLD-COLOR', 'the Dark launch ground becomes the icon ground #0A0B0D', join(catalog, `${internals.IOS_WORLD_COLOR}.colorset`, 'Contents.json'), (file) => replaceIn(file, /"blue": "0x10",\s*"green": "0x10",\s*"red": "0x10"/u, '"blue": "0x0D", "green": "0x0B", "red": "0x0A"')],
      ['ios', 'I-LAUNCH', 'the Q is placed on the Launch Screen', join(app, 'SplashScreen.storyboard'), (file) => replaceIn(file, '</view>', '<imageView image="AppIcon" id="QANDEEL-Q"/></view>')],
      ['ios', 'I-PLIST', 'the Launch Screen is forced Light', join(app, 'Info.plist'), (file) => replaceIn(file, '<string>Automatic</string>', '<string>Light</string>')],
      ['ios', 'I-ROOT-VIEW', 'the root view goes back to the system background', join(app, 'AppDelegate.swift'), (file) => replaceIn(file, 'rootView.backgroundColor = UIColor(red: 16.0 / 255.0, green: 16.0 / 255.0, blue: 16.0 / 255.0, alpha: 1.0)', 'rootView.backgroundColor = UIColor.systemBackground')],
    );
  }
  return defects;
}

function runPlantedDefects(androidRoot, iosRoot) {
  let missed = 0;
  for (const [platform, family, description, target, plant] of plantedDefects(androidRoot, iosRoot)) {
    const snapshotFile = target;
    const existed = snapshotFile ? existsSync(snapshotFile) : false;
    const before = existed ? readFileSync(snapshotFile) : null;
    const plantedFile = plant(snapshotFile) ?? snapshotFile;
    const restoreBytes = plantedFile === snapshotFile ? before : null;
    const failures = platform === 'android' ? checkAndroid(androidRoot) : checkIos(iosRoot);
    const caught = failures.some((failure) => failure.startsWith(`${family}:`));
    console.log(`${caught ? 'CAUGHT' : 'MISSED'}  planted ${family}: ${description}`);
    if (!caught) missed += 1;
    if (plantedFile !== snapshotFile) {
      replaceIn(plantedFile, 'MODE_NIGHT_AUTO', 'MODE_NIGHT_YES');
    } else if (restoreBytes) {
      writeFileSync(snapshotFile, restoreBytes);
    } else {
      rmSync(snapshotFile, { force: true });
    }
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
  if (capture('git', ['ls-files', '--', 'android', 'ios']).trim()) throw new Error('generated native directories must never be tracked');
  const statusBefore = capture('git', ['status', '--porcelain', '--untracked-files=all']);
  const removeGenerated = () => ['android', 'ios'].forEach((directory) => rmSync(join(projectDir, directory), { recursive: true, force: true }));

  removeGenerated();
  let failed = false;
  try {
    for (const platform of platforms) {
      const result = spawnSync(process.execPath, [expoCli, 'prebuild', '--platform', platform, '--no-install'], {
        cwd: projectDir,
        stdio: 'inherit',
        windowsHide: true,
        env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
      });
      if (result.status !== 0) throw new Error(`expo prebuild --platform ${platform} exited ${result.status}`);
    }
    const androidRoot = join(projectDir, 'android');
    const iosRoot = platforms.includes('ios') ? join(projectDir, 'ios') : null;
    const failures = [...checkAndroid(androidRoot), ...(iosRoot ? checkIos(iosRoot) : [])];
    for (const failure of failures) console.error(`FAIL ${failure}`);
    if (failures.length > 0) {
      failed = true;
    } else {
      console.log(`PASS: the generated ${platforms.join(' + ')} launch identity matches W2-02 (${platforms.length === 1 ? 'iOS is proved on Linux / macOS' : 'both platforms'}).`);
      const missed = runPlantedDefects(androidRoot, iosRoot);
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
    console.error('FAIL: the launch-identity gate changed the repository state.');
    failed = true;
  }
  if (failed) process.exit(1);
  console.log('PASS: generated native directories were discarded and the repository state is unchanged.');
}

if (process.argv[1] !== undefined && process.argv[1].replace(/\\/gu, '/').endsWith('scripts/verify-launch-identity-native.mjs')) main();
