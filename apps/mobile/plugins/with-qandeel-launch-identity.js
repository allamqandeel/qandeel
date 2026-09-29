// W2-02 — Production Launch Identity: the final QANDEEL app icon and the native static launch / system
// handoff, applied through Continuous Native Generation. `android/` and `ios/` stay generated and untracked;
// this plugin is their only W2-02 source.
//
// What it does, and nothing else:
//   1. installs the I-08B2.5 platform icon exports (vendored byte-for-byte under assets/brand/i-08b2.5/) into
//      the generated projects, replacing the Expo template's default icon and splash-logo resources;
//   2. makes the launch ground the QANDEEL World — Light #efeeeb, Dark #101010 (F2 FINAL / A3R2) — on the
//      Android 12+ system splash and the first app-owned Android window, and as the only content of the iOS
//      Launch Screen (Info.plist `UILaunchScreen` / `UIColorName`, R2);
//   3. keeps the first app-owned iOS pixels the World instead of React Native's default systemBackgroundColor;
//   4. sets the Android application night mode to the effective QANDEEL appearance, so the system splash
//      follows it (P4-C3R §1).
//
// Why a plugin and not Expo's `icon` / `android.adaptiveIcon` config (W2-02 §6 Option A): Expo 57 re-encodes
// every Android layer to WebP from one source image, accepts only a RASTER monochrome layer (I-08B2.5's is a
// VectorDrawable carrying the approved path data verbatim), crops its own round icon, and on iOS writes one
// re-encoded 1024 image flattened onto white in place of the 13 canonical renders. Each of those is a
// derivative the Brand authority did not approve.
//
// Why files are installed with `withDangerousMod`: Expo's plugin guide reserves generating, moving and deleting
// files for dangerous mods. Under the T-01 CNG hierarchy (apps/mobile/README.md) that is Level 4 and needs its
// own Engineering Architecture review (APPROVED — bounded W2-02 Level-4 exception); W2-02 confines it to the two
// `install…` functions below, which only copy vendored bytes, delete named template resources and write the
// World colour asset. Every other change is a typed mod.
//
// It adds no timer, no minimum duration, no second splash, no Q / logo / text on the iOS Launch Screen, no
// Lantern content, and no appearance preference. QAN-BL-LANTERN-01 and the W3 appearance setting are untouched.
/* global __dirname -- a config plugin runs in Node during `expo prebuild`, never in the app bundle */
const fs = require('node:fs');
const path = require('node:path');
const {
  AndroidConfig,
  withAndroidColors,
  withAndroidColorsNight,
  withAndroidStyles,
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withMainApplication,
  withXcodeProject,
} = require('expo/config-plugins');

/** The QANDEEL World fill (`qandeel.world.fill`). NOT the app-icon ground #0A0B0D. */
const WORLD = Object.freeze({ light: '#efeeeb', dark: '#101010' });
/** Android colour resource holding the World, with a `values-night` variant. */
const ANDROID_WORLD_COLOR = 'qandeel_world';
/** iOS asset-catalog colour holding the World, with a dark-appearance variant. */
const IOS_WORLD_COLOR = 'QandeelWorld';

const VENDORED_APP_ICON = path.join(__dirname, '..', 'assets', 'brand', 'i-08b2.5', 'app-icon');
const VENDORED_ANDROID_RES = path.join(VENDORED_APP_ICON, 'android', 'res');
const VENDORED_IOS_APP_ICON_SET = path.join(VENDORED_APP_ICON, 'ios', 'AppIcon.appiconset');

const DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
/** The Expo template's default launcher icon and splash-logo resources, replaced by the canonical ones. */
const ANDROID_TEMPLATE_RESOURCES_REMOVED = Object.freeze([
  ...DENSITIES.flatMap((density) => [
    `mipmap-${density}/ic_launcher.webp`,
    `mipmap-${density}/ic_launcher_round.webp`,
    `drawable-${density}/splashscreen_logo.png`,
  ]),
  // The template's layer-list of the default splash logo; it shares its name with I-08B2.5's colour resource.
  'drawable/ic_launcher_background.xml',
]);
const ANDROID_TEMPLATE_COLORS_REMOVED = Object.freeze(['splashscreen_background']);

const NIGHT_MODE_BEGIN = '// @qandeel-w2-02 application-night-mode begin';
const NIGHT_MODE_END = '// @qandeel-w2-02 application-night-mode end';
const ROOT_VIEW_BEGIN = '// @qandeel-w2-02 root-view-world begin';
const ROOT_VIEW_END = '// @qandeel-w2-02 root-view-world end';

const NIGHT_MODE_BLOCK = [
  `    ${NIGHT_MODE_BEGIN}`,
  '    // P4-C3R §1: the Android 12+ system splash follows the EFFECTIVE QANDEEL appearance through the platform',
  '    // application night mode, which the platform itself persists. Production has no appearance preference yet',
  '    // (P1 §12 is W3\'s), and both P1\'s new-user default and the only appearance production renders are Dark,',
  '    // so the effective mode is DARK. W3 replaces this constant with the user\'s Dark / Light / System choice.',
  '    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {',
  '      getSystemService(android.app.UiModeManager::class.java)',
  '        ?.setApplicationNightMode(android.app.UiModeManager.MODE_NIGHT_YES)',
  '    }',
  `    ${NIGHT_MODE_END}`,
].join('\n');

const ROOT_VIEW_BLOCK = [
  `  ${ROOT_VIEW_BEGIN}`,
  '  // The first app-owned pixels are the QANDEEL World, never React Native\'s default systemBackgroundColor',
  '  // (white on a Light device). Dark #101010 is the only appearance production renders (P1 §12 default); W3',
  '  // makes it follow the user\'s appearance. The system Launch Screen before it follows the device (P4-C3R §1).',
  '  override func customize(_ rootView: UIView) {',
  '    super.customize(rootView)',
  '    rootView.backgroundColor = UIColor(red: 16.0 / 255.0, green: 16.0 / 255.0, blue: 16.0 / 255.0, alpha: 1.0)',
  '  }',
  `  ${ROOT_VIEW_END}`,
].join('\n');

/**
 * Inserts `block` after the first line containing `anchor`, or replaces a previously inserted block, so a
 * re-application is byte-identical. A missing anchor is an error: a template that moved must fail the build,
 * never silently lose the launch handoff.
 */
function upsertGeneratedBlock(source, { anchor, begin, end, block, label }) {
  const start = source.indexOf(begin);
  if (start !== -1) {
    const stop = source.indexOf(end, start);
    if (stop === -1) throw new Error(`W2-02: ${label} begins but never ends`);
    const lineStart = source.lastIndexOf('\n', start) + 1;
    const lineEnd = source.indexOf('\n', stop);
    return `${source.slice(0, lineStart)}${block}${lineEnd === -1 ? '' : source.slice(lineEnd)}`;
  }
  const at = source.indexOf(anchor);
  if (at === -1) throw new Error(`W2-02: cannot place ${label}: anchor ${JSON.stringify(anchor)} not found`);
  const lineEnd = source.indexOf('\n', at);
  if (lineEnd === -1) return `${source}\n${block}\n`;
  return `${source.slice(0, lineEnd + 1)}${block}\n${source.slice(lineEnd + 1)}`;
}

function applyApplicationNightMode(source) {
  return upsertGeneratedBlock(source, {
    anchor: 'super.onCreate()',
    begin: NIGHT_MODE_BEGIN,
    end: NIGHT_MODE_END,
    block: NIGHT_MODE_BLOCK,
    label: 'the application night mode',
  });
}

function applyRootViewWorld(source) {
  return upsertGeneratedBlock(source, {
    anchor: '// Extension point for config-plugins',
    begin: ROOT_VIEW_BEGIN,
    end: ROOT_VIEW_END,
    block: ROOT_VIEW_BLOCK,
    label: 'the root view World',
  });
}

function hexComponents(hex) {
  return [1, 3, 5].map((offset) => `0x${hex.slice(offset, offset + 2).toUpperCase()}`);
}

/** The iOS asset-catalog colour: the Light World, and the Dark World under the dark appearance. */
function renderWorldColorSet() {
  const entry = (hex, appearances) => {
    const [red, green, blue] = hexComponents(hex);
    return {
      ...(appearances ? { appearances } : {}),
      color: { 'color-space': 'srgb', components: { alpha: '1.000', blue, green, red } },
      idiom: 'universal',
    };
  };
  return `${JSON.stringify(
    {
      colors: [entry(WORLD.light), entry(WORLD.dark, [{ appearance: 'luminosity', value: 'dark' }])],
      info: { author: 'xcode', version: 1 },
    },
    null,
    2,
  )}\n`;
}

/** The Expo template's launch storyboard, replaced by the Info.plist launch screen (R2). */
const IOS_TEMPLATE_LAUNCH_STORYBOARD = 'SplashScreen.storyboard';

/**
 * The iOS Launch Screen, R2: Apple's Info.plist launch screen (`UILaunchScreen`, iOS 14+; this app's minimum is
 * 16.4) with `UIColorName` naming the World colour asset, which the system resolves for the device appearance.
 * Nothing else — no `UIImageName`, no bars, no storyboard. The storyboard path compiled correctly and still
 * rendered black on the iOS 26.5 simulator (W2-02 R2), so W2-02 no longer depends on it.
 */
function applyLaunchScreen(infoPlist) {
  const { UILaunchStoryboardName, UILaunchScreen, ...rest } = infoPlist;
  return { ...rest, UILaunchScreen: { UIColorName: IOS_WORLD_COLOR } };
}

/** Removes the template launch storyboard from the Xcode project: its file reference, build file and group entry. */
function removeTemplateLaunchStoryboard(project) {
  const objects = project.hash.project.objects;
  const isEntry = (key) => !key.endsWith('_comment');
  const fileReferences = objects.PBXFileReference ?? {};
  const references = Object.keys(fileReferences).filter(
    (key) => isEntry(key) && String(fileReferences[key].path ?? '').replace(/"/gu, '').endsWith(IOS_TEMPLATE_LAUNCH_STORYBOARD),
  );
  if (references.length === 0) return project;
  const buildFiles = objects.PBXBuildFile ?? {};
  const builds = Object.keys(buildFiles).filter((key) => isEntry(key) && references.includes(buildFiles[key].fileRef));
  for (const key of [...builds, ...references]) {
    delete buildFiles[key];
    delete buildFiles[`${key}_comment`];
    delete fileReferences[key];
    delete fileReferences[`${key}_comment`];
  }
  for (const phase of Object.values(objects.PBXResourcesBuildPhase ?? {})) {
    if (phase && Array.isArray(phase.files)) phase.files = phase.files.filter((file) => !builds.includes(file.value));
  }
  for (const group of Object.values(objects.PBXGroup ?? {})) {
    if (group && Array.isArray(group.children)) group.children = group.children.filter((child) => !references.includes(child.value));
  }
  return project;
}

function listFiles(directory, base = directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .flatMap((entry) => {
      const full = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full)];
    });
}

function copyVendored(fromDirectory, toDirectory) {
  for (const relative of listFiles(fromDirectory)) {
    const target = path.join(toDirectory, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(fromDirectory, relative), target);
  }
}

/** Level-4 (see header): replaces the template's icon / splash-logo files with the canonical resources. */
function installAndroidResources(platformProjectRoot) {
  const resDirectory = path.join(platformProjectRoot, 'app', 'src', 'main', 'res');
  for (const relative of ANDROID_TEMPLATE_RESOURCES_REMOVED) {
    fs.rmSync(path.join(resDirectory, relative), { force: true });
  }
  copyVendored(VENDORED_ANDROID_RES, resDirectory);
}

/** Level-4 (see header): the canonical app-icon set and the World colour; the template launch storyboard goes. */
function installIosResources(platformProjectRoot, projectName) {
  const appDirectory = path.join(platformProjectRoot, projectName);
  const assetCatalog = path.join(appDirectory, 'Images.xcassets');
  const appIconSet = path.join(assetCatalog, 'AppIcon.appiconset');
  fs.rmSync(appIconSet, { recursive: true, force: true });
  copyVendored(VENDORED_IOS_APP_ICON_SET, appIconSet);
  const colorSet = path.join(assetCatalog, `${IOS_WORLD_COLOR}.colorset`);
  fs.mkdirSync(colorSet, { recursive: true });
  fs.writeFileSync(path.join(colorSet, 'Contents.json'), renderWorldColorSet());
  fs.rmSync(path.join(appDirectory, IOS_TEMPLATE_LAUNCH_STORYBOARD), { force: true });
}

function setWorldColor(colors, value) {
  let result = colors;
  for (const name of ANDROID_TEMPLATE_COLORS_REMOVED) {
    result = AndroidConfig.Colors.removeColorItem(name, result);
  }
  return AndroidConfig.Colors.assignColorValue(result, { name: ANDROID_WORLD_COLOR, value });
}

function setWorldStyles(styles) {
  const world = `@color/${ANDROID_WORLD_COLOR}`;
  let result = AndroidConfig.Styles.assignStylesValue(styles, {
    add: true,
    parent: AndroidConfig.Styles.getAppThemeGroup(),
    name: 'android:windowBackground',
    value: world,
  });
  const splash = { name: 'Theme.App.SplashScreen', parent: 'AppTheme' };
  result = AndroidConfig.Styles.assignStylesValue(result, { add: true, parent: splash, name: 'android:windowBackground', value: world });
  return AndroidConfig.Styles.assignStylesValue(result, {
    add: true,
    parent: splash,
    name: 'android:windowSplashScreenBackground',
    value: world,
    targetApi: '31',
  });
}

const withQandeelLaunchIdentity = (config) => {
  config = withDangerousMod(config, [
    'android',
    (modConfig) => {
      installAndroidResources(modConfig.modRequest.platformProjectRoot);
      return modConfig;
    },
  ]);
  config = withAndroidColors(config, (modConfig) => {
    modConfig.modResults = setWorldColor(modConfig.modResults, WORLD.light);
    return modConfig;
  });
  config = withAndroidColorsNight(config, (modConfig) => {
    modConfig.modResults = setWorldColor(modConfig.modResults, WORLD.dark);
    return modConfig;
  });
  config = withAndroidStyles(config, (modConfig) => {
    modConfig.modResults = setWorldStyles(modConfig.modResults);
    return modConfig;
  });
  config = withMainApplication(config, (modConfig) => {
    if (modConfig.modResults.language !== 'kt') throw new Error('W2-02: MainApplication is expected to be Kotlin');
    modConfig.modResults.contents = applyApplicationNightMode(modConfig.modResults.contents);
    return modConfig;
  });
  config = withDangerousMod(config, [
    'ios',
    (modConfig) => {
      installIosResources(modConfig.modRequest.platformProjectRoot, modConfig.modRequest.projectName);
      return modConfig;
    },
  ]);
  config = withInfoPlist(config, (modConfig) => {
    modConfig.modResults = applyLaunchScreen(modConfig.modResults);
    return modConfig;
  });
  config = withXcodeProject(config, (modConfig) => {
    modConfig.modResults = removeTemplateLaunchStoryboard(modConfig.modResults);
    return modConfig;
  });
  config = withAppDelegate(config, (modConfig) => {
    if (modConfig.modResults.language !== 'swift') throw new Error('W2-02: AppDelegate is expected to be Swift');
    modConfig.modResults.contents = applyRootViewWorld(modConfig.modResults.contents);
    return modConfig;
  });
  return config;
};

module.exports = withQandeelLaunchIdentity;
module.exports.internals = Object.freeze({
  WORLD,
  ANDROID_WORLD_COLOR,
  IOS_WORLD_COLOR,
  ANDROID_TEMPLATE_RESOURCES_REMOVED,
  ANDROID_TEMPLATE_COLORS_REMOVED,
  VENDORED_ANDROID_RES,
  VENDORED_IOS_APP_ICON_SET,
  NIGHT_MODE_BEGIN,
  ROOT_VIEW_BEGIN,
  applyApplicationNightMode,
  applyRootViewWorld,
  applyLaunchScreen,
  removeTemplateLaunchStoryboard,
  renderWorldColorSet,
});
