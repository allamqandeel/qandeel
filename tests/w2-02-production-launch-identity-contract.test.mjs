import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { classifyMobileNativeImpact } from '../scripts/classify-mobile-native-impact.mjs';
import { classifyBuildInput } from '../scripts/phase-m/native-build-fingerprint.mjs';
import { STABLE_LAUNCH_FRAMES, VERDICT, judgeLaunch } from '../scripts/w2/analyze-w2-02-launch-recording.mjs';

// W2-02 — Production Launch Identity (E2E-A-01 static launch → system handoff, E2E-A-02 final app icon).
// Static contract.
//
// `apps/mobile/scripts/verify-launch-identity-native.mjs` proves the GENERATED native projects (and plants a
// defect for every check family). This gate guards what must be true BY CONSTRUCTION of the files W2-02 owns:
// the Brand bytes are I-08B2.5's, unchanged; the launch is the World and nothing else; the Android splash keeps
// the launcher icon and has no second splash; nothing waits; the Lantern is untouched; W3's appearance
// preference is not invented; and the native gates stay wired.
//
// Forward safety: every claim is about a file or seam W2-02 created. Every predicate is proven to reject a
// planted defect before it is trusted.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const readJson = (path) => JSON.parse(read(path));
const bytes = (path) => readFileSync(new URL(path, root));
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
/** Code only: a comment may name a forbidden thing in order to forbid it. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`])\/\/[^\n]*/gu, '$1');
const require = createRequire(import.meta.url);

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(join(rootPath, dir)).sort()) {
    const full = `${dir}/${entry}`;
    if (statSync(join(rootPath, full)).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

/** `predicate(corpus)` must be true, and `predicate(corpus + defect)` must be false. */
function guards(name, corpus, predicate, defect) {
  assert.equal(predicate(corpus), true, `${name}: the real source must satisfy the invariant`);
  assert.equal(predicate(`${corpus}\n${defect}\n`), false, `${name}: the guard does not reject its own planted defect`);
}

/** PNG IHDR: width, height, bit depth and colour type (2 = RGB, no alpha; 6 = RGBA). */
function pngHeader(buffer) {
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'not a PNG');
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'IHDR');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bitDepth: buffer[24], colorType: buffer[25] };
}

const CANONICAL = 'docs/design/canonical-artifacts/brand/i-08b2.5/app-icon';
const VENDORED = 'apps/mobile/assets/brand/i-08b2.5/app-icon';
const MANIFEST_PATH = 'apps/mobile/assets/brand/i-08b2.5/VENDORED_FROM_CANONICAL.json';
const PLUGIN_PATH = 'apps/mobile/plugins/with-qandeel-launch-identity.js';
const VERIFIER_PATH = 'apps/mobile/scripts/verify-launch-identity-native.mjs';
const FROZEN_APP_ICON_SVG_SHA256 = '859665d86a7bbf4248ff479034031a8df1f08833c7db36336b3d29832bcddd09';
const DENSITY_SCALE = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
/** The files W2-02 created or owns. Every scan in this contract is scoped to them, never to the whole repository. */
const W2_02_OWNED_FILES = Object.freeze([
  PLUGIN_PATH,
  VERIFIER_PATH,
  MANIFEST_PATH,
  'apps/mobile/app.json',
  'scripts/w2/analyze-w2-02-launch-recording.mjs',
  'scripts/w2/run-w2-02-android-proof.sh',
  'scripts/w2/run-w2-02-ios-proof.sh',
  'scripts/w2/w2-02-ios-home-screen.yaml',
  '.github/workflows/w2-02-native-launch-proof.yml',
]);

const manifest = readJson(MANIFEST_PATH);
const appJson = readJson('apps/mobile/app.json').expo;
const pluginText = read(PLUGIN_PATH);
const verifierText = read(VERIFIER_PATH);
const plugin = require(join(rootPath, PLUGIN_PATH));
const { WORLD } = plugin.internals;

// ---------------------------------------------------------------------------------------------------------
// Brand integrity
// ---------------------------------------------------------------------------------------------------------

test('the canonical I-08B2.5 app-icon source is the frozen file, and the package is untouched', () => {
  const svg = `${CANONICAL}/APP_ICON_B_DARK_LUMINOUS.svg`;
  assert.equal(sha256(bytes(svg)), FROZEN_APP_ICON_SVG_SHA256, 'the frozen I-08B2.4 Variant B hash (I-08B2.5 report §2)');
  assert.equal(manifest.canonicalSource.path, svg);
  assert.equal(manifest.canonicalSource.sha256, FROZEN_APP_ICON_SVG_SHA256);
  // Every consumed canonical export still hashes to what W2-02 vendored: the canonical package was not edited.
  for (const entry of manifest.files) {
    assert.equal(sha256(bytes(entry.canonical)), entry.sha256, `${entry.canonical} changed after it was vendored`);
  }
});

test('every production icon file is a byte-for-byte copy of its canonical export, and the manifest is complete', () => {
  const vendored = listFiles(VENDORED);
  assert.deepEqual(manifest.files.map((entry) => entry.vendored).sort(), vendored, 'the manifest lists exactly the vendored tree');
  assert.equal(vendored.length, 33, '19 Android resources + 14 iOS asset-catalog files');
  for (const entry of manifest.files) {
    assert.equal(entry.canonical, entry.vendored.replace(VENDORED, CANONICAL), 'same relative path as the canonical export');
    const copy = bytes(entry.vendored);
    assert.equal(sha256(copy), entry.sha256, `${entry.vendored} is not the recorded bytes`);
    assert.equal(copy.length, entry.bytes);
    assert.ok(copy.equals(bytes(entry.canonical)), `${entry.vendored} differs from ${entry.canonical}`);
  }
  // The copy is pinned against line-ending conversion on every checkout.
  assert.match(read('apps/mobile/assets/brand/.gitattributes'), /^\* -text$/mu);
  // Nothing outside the vendored tree is used as an icon source.
  for (const unused of manifest.notConsumed) assert.equal(existsSync(new URL(unused, root)), true, `${unused} is listed but missing`);
});

test('the plugin installs bytes and never re-renders, resizes, re-encodes or re-frames an icon', () => {
  const noImagePipeline = (text) =>
    !/sharp|jimp|@expo\/image-utils|generateImageAsync|compositeImagesAsync|resize|\.webp['"]\s*\)/u.test(code(text)) &&
    /fs\.copyFileSync\(/u.test(code(text));
  guards('no-image-pipeline', pluginText, noImagePipeline, "const { generateImageAsync } = require('@expo/image-utils');");
  // Expo's own icon generation stays OFF: no app-config icon key reaches it.
  const noExpoIconConfig = (config) =>
    config.icon === undefined &&
    config.splash === undefined &&
    config.ios?.icon === undefined &&
    config.android?.icon === undefined &&
    config.android?.adaptiveIcon === undefined;
  assert.equal(noExpoIconConfig(appJson), true);
  assert.equal(noExpoIconConfig({ ...appJson, icon: './assets/icon.png' }), false, 'planted default icon must be rejected');
});

test('iOS: the square composition unchanged, no alpha, no baked corners, no dark / tinted variant', () => {
  const contents = readJson(`${VENDORED}/ios/AppIcon.appiconset/Contents.json`);
  const hasVariant = (json) => json.images.some((image) => 'appearances' in image);
  assert.equal(hasVariant(contents), false, 'no dedicated iOS dark / tinted icon in v1 (P4-C2 §1)');
  assert.equal(hasVariant({ images: [...contents.images, { appearances: [{ appearance: 'luminosity', value: 'dark' }] }] }), true, 'planted variant must be detected');
  const pngs = listFiles(`${VENDORED}/ios/AppIcon.appiconset`).filter((file) => file.endsWith('.png'));
  assert.equal(pngs.length, 13, '13 distinct pixel sizes (I-08B2.5 report §4.2)');
  for (const file of pngs) {
    const header = pngHeader(bytes(file));
    const size = Number(file.match(/AppIcon-(\d+)\.png$/u)[1]);
    assert.deepEqual([header.width, header.height], [size, size], `${file} is not ${size}×${size}`);
    assert.equal(header.colorType, 2, `${file} must carry no alpha channel`);
  }
  for (const image of contents.images) assert.ok(pngs.some((file) => file.endsWith(`/${image.filename}`)), `${image.filename} is missing`);
  assert.equal(appJson.ios?.icon, undefined, 'no ios.icon object (light / dark / tinted) is configured');
});

test('Android: the frozen 48 dp adaptive framing, the canonical monochrome and the #0A0B0D icon ground', () => {
  const report = read('docs/design/canonical-artifacts/brand/i-08b2.5/docs/I-08B2.5_FINAL_ASSET_REPORT.md');
  assert.match(report, /\*\*48 dp\*\* was used/u, 'the report records the 48 dp framing');
  assert.match(read('docs/canonical-authority/final-product-experience/p4/QANDEEL_P4C2_BRAND_SCOPE_VOICE_COPY_APP_OPS_PRODUCT_DECISIONS_v1.0.md'), /Confirm Android adaptive-icon framing at \*\*48 dp\*\*/u);
  const res = `${VENDORED}/android/res`;
  for (const [density, scale] of Object.entries(DENSITY_SCALE)) {
    const foreground = pngHeader(bytes(`${res}/mipmap-${density}/ic_launcher_foreground.png`));
    assert.deepEqual([foreground.width, foreground.height], [108 * scale, 108 * scale], `${density} foreground is the 108 dp adaptive canvas`);
    for (const legacy of ['ic_launcher', 'ic_launcher_round']) {
      const header = pngHeader(bytes(`${res}/mipmap-${density}/${legacy}.png`));
      assert.deepEqual([header.width, header.height], [48 * scale, 48 * scale], `${density} ${legacy} is the 48 dp legacy icon`);
    }
  }
  const adaptive = read(`${res}/mipmap-anydpi-v26/ic_launcher.xml`);
  assert.equal(read(`${res}/mipmap-anydpi-v26/ic_launcher_round.xml`), adaptive);
  const isCanonicalAdaptive = (xml) =>
    xml.includes('<background android:drawable="@color/ic_launcher_background"/>') &&
    xml.includes('<foreground android:drawable="@mipmap/ic_launcher_foreground"/>') &&
    xml.includes('<monochrome android:drawable="@drawable/ic_launcher_monochrome"/>') &&
    !/<monochrome android:drawable="@mipmap/u.test(xml);
  guards('adaptive-icon', adaptive, isCanonicalAdaptive, '<monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>');
  assert.match(read(`${res}/values/ic_launcher_background.xml`), /<color name="ic_launcher_background">#0A0B0D<\/color>/u);
  const monochrome = read(`${res}/drawable/ic_launcher_monochrome.xml`);
  assert.equal((monochrome.match(/android:scaleX="0\.02397948"/gu) ?? []).length, 1, 'the declared uniform group transform (report §10.6)');
  assert.equal((monochrome.match(/android:fillType="nonZero"/gu) ?? []).length, 3, 'ring, tail and light core, non-zero winding');
});

test('the launcher / home-screen label is the frozen Product casing QANDEEL', () => {
  const isFrozenName = (config) => config.name === 'QANDEEL';
  assert.equal(isFrozenName(appJson), true, 'P4-C2 §5 English Product-name casing');
  assert.equal(isFrozenName({ ...appJson, name: 'Qandeel' }), false, 'planted casing must be rejected');
  assert.equal(appJson.slug, 'qandeel', 'the slug is an identifier, not a label, and stays unchanged');
});

// ---------------------------------------------------------------------------------------------------------
// Launch
// ---------------------------------------------------------------------------------------------------------

test('the launch ground is the QANDEEL World, never the app-icon ground', () => {
  assert.deepEqual({ ...WORLD }, { light: '#efeeeb', dark: '#101010' });
  // The World values are the frozen ones: Dark (A3R2, carried into B4R) and Light (F2 FINAL).
  assert.match(read('docs/design/canonical-artifacts/QANDEEL_CANONICAL_ARTIFACT_INDEX.md'), /Final Light: World `#efeeeb`/u);
  assert.match(read('apps/mobile/src/conversation/visual/canonical-visual.generated.ts'), /"world": "#101010"/u);
  const worldIsNotIconGround = (text) => !/0A0B0D/iu.test(code(text));
  guards('launch-world-not-icon-ground', pluginText, worldIsNotIconGround, "const WORLD_DARK = '#0A0B0D';");
});

test('iOS: the Launch Screen is the World colour asset only (UILaunchScreen, R2), and it follows the device appearance', () => {
  // R2: Apple's Info.plist launch screen replaces the storyboard, which compiled correctly yet rendered black.
  const template = { CFBundleName: 'QANDEEL', UILaunchStoryboardName: 'SplashScreen', UIUserInterfaceStyle: 'Automatic' };
  const launched = plugin.internals.applyLaunchScreen(template);
  const worldOnly = (plist) =>
    plist.UILaunchStoryboardName === undefined &&
    plist.UILaunchImages === undefined &&
    JSON.stringify(plist.UILaunchScreen) === JSON.stringify({ UIColorName: 'QandeelWorld' });
  assert.equal(worldOnly(launched), true);
  assert.deepEqual(plugin.internals.applyLaunchScreen(launched), launched, 're-application is identical');
  assert.equal(launched.CFBundleName, 'QANDEEL', 'every other key is kept');
  assert.equal(worldOnly({ ...launched, UILaunchScreen: { ...launched.UILaunchScreen, UIImageName: 'AppIcon' } }), false, 'a planted image is rejected');
  assert.equal(worldOnly({ ...launched, UILaunchStoryboardName: 'SplashScreen' }), false, 'a planted storyboard path is rejected');
  const noStoryboardWrite = (text) => !/\.storyboard['"`]\s*\)\s*,\s*render|writeFileSync\([^)]*SplashScreen/u.test(code(text)) && /fs\.rmSync\(path\.join\(appDirectory, IOS_TEMPLATE_LAUNCH_STORYBOARD\)/u.test(code(text));
  guards('no-launch-storyboard-written', pluginText, noStoryboardWrite, "fs.writeFileSync(path.join(appDirectory, 'SplashScreen.storyboard'), xml);");
  // The template storyboard leaves the Xcode project entirely (file reference, build file, group, resources phase).
  const objects = {
    PBXFileReference: { REF: { path: 'QANDEEL/SplashScreen.storyboard' }, REF_comment: 'SplashScreen.storyboard', ASSETS: { path: 'QANDEEL/Images.xcassets' } },
    PBXBuildFile: { BUILD: { fileRef: 'REF' }, BUILD_comment: 'SplashScreen.storyboard in Resources', BUILDA: { fileRef: 'ASSETS' } },
    PBXResourcesBuildPhase: { PHASE: { files: [{ value: 'BUILDA' }, { value: 'BUILD' }] } },
    PBXGroup: { GROUP: { children: [{ value: 'ASSETS' }, { value: 'REF' }] } },
  };
  plugin.internals.removeTemplateLaunchStoryboard({ hash: { project: { objects } } });
  assert.deepEqual(Object.keys(objects.PBXFileReference), ['ASSETS']);
  assert.deepEqual(Object.keys(objects.PBXBuildFile), ['BUILDA']);
  assert.deepEqual(objects.PBXResourcesBuildPhase.PHASE.files, [{ value: 'BUILDA' }]);
  assert.deepEqual(objects.PBXGroup.GROUP.children, [{ value: 'ASSETS' }]);
  const colors = JSON.parse(plugin.internals.renderWorldColorSet()).colors;
  assert.deepEqual(colors.map((entry) => [entry.appearances?.[0]?.value ?? 'any', entry.color.components.red, entry.color.components.green, entry.color.components.blue]), [
    ['any', '0xEF', '0xEE', '0xEB'],
    ['dark', '0x10', '0x10', '0x10'],
  ]);
  // Expo writes UIUserInterfaceStyle=Light when nothing is set, which would pin the Launch Screen to Light.
  const followsDevice = (config) => config.ios?.userInterfaceStyle === 'automatic' && config.userInterfaceStyle === undefined;
  assert.equal(followsDevice(appJson), true, 'P4-C3R §1: the iOS Launch Screen follows the device appearance');
  assert.equal(followsDevice({ ...appJson, ios: { ...appJson.ios, userInterfaceStyle: 'dark' } }), false, 'planted forced Dark must be rejected');
});

test('Android: one system splash with the launcher icon on the World, and the World under the first app-owned frame', () => {
  const noCustomSplashIcon = (text) => !/windowSplashScreen(AnimatedIcon|BrandingImage|IconBackgroundColor|AnimationDuration)|postSplashScreenTheme|Theme\.SplashScreen|installSplashScreen/u.test(code(text));
  guards('no-custom-splash-icon', pluginText, noCustomSplashIcon, "name: 'android:windowSplashScreenAnimatedIcon',");
  assert.match(pluginText, /name: 'android:windowSplashScreenBackground',\s*value: world,\s*targetApi: '31'/u);
  assert.match(pluginText, /parent: AndroidConfig\.Styles\.getAppThemeGroup\(\),\s*name: 'android:windowBackground',\s*value: world/u, 'the first app-owned window keeps the ground');
  assert.match(pluginText, /withAndroidColorsNight\(config, \(modConfig\) => \{\s*modConfig\.modResults = setWorldColor\(modConfig\.modResults, WORLD\.dark\)/u);
  const mobilePackage = readJson('apps/mobile/package.json');
  const noSplashLibrary = (pkg) => !Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((name) => /splash/u.test(name));
  assert.equal(noSplashLibrary(mobilePackage), true, 'no expo-splash-screen: it would replace the launcher icon on the Android 12+ splash');
  assert.equal(noSplashLibrary({ dependencies: { 'expo-splash-screen': '~57.0.8' } }), false);
});

test('the Android splash follows the effective QANDEEL appearance through the application night mode — a constant, not a preference', () => {
  const template = 'class MainApplication : Application() {\n  override fun onCreate() {\n    super.onCreate()\n    loadReactNative(this)\n  }\n}\n';
  const once = plugin.internals.applyApplicationNightMode(template);
  assert.equal(plugin.internals.applyApplicationNightMode(once), once, 're-application is byte-identical');
  assert.equal((once.match(/setApplicationNightMode\(android\.app\.UiModeManager\.MODE_NIGHT_YES\)/gu) ?? []).length, 1);
  assert.ok(once.indexOf('setApplicationNightMode') > once.indexOf('super.onCreate()'), 'set after the Application is created');
  assert.match(once, /Build\.VERSION_CODES\.S\)/u, 'API 31+ only, where the platform supports it');
  assert.throws(() => plugin.internals.applyApplicationNightMode('class MainApplication {}'), /anchor/u, 'a moved template must fail the build');
  // No preference subsystem: nothing reads, stores or exposes an appearance choice (that is W3).
  const noPreference = (text) => !/AsyncStorage|SharedPreferences|UserDefaults|MODE_NIGHT_(NO|AUTO|FOLLOW)|setDefaultNightMode|appearancePreference/u.test(code(text));
  guards('no-appearance-preference', pluginText, noPreference, 'const stored = getSharedPreferences("appearance", 0)');
  assert.equal(existsSync(new URL('apps/mobile/src/appearance', root)), false);
});

test('iOS: the first app-owned pixels are the World, not React Native\'s systemBackgroundColor', () => {
  const template = 'class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {\n  // Extension point for config-plugins\n\n  override func bundleURL() -> URL? { nil }\n}\n';
  const once = plugin.internals.applyRootViewWorld(template);
  assert.equal(plugin.internals.applyRootViewWorld(once), once, 're-application is byte-identical');
  assert.match(once, /override func customize\(_ rootView: UIView\) \{\n    super\.customize\(rootView\)\n    rootView\.backgroundColor = UIColor\(red: 16\.0 \/ 255\.0, green: 16\.0 \/ 255\.0, blue: 16\.0 \/ 255\.0, alpha: 1\.0\)/u);
  assert.throws(() => plugin.internals.applyRootViewWorld('class AppDelegate {}'), /anchor/u);
});

test('no timer, hold or minimum launch duration exists anywhere W2-02 touches', () => {
  const noHold = (text) => !/setTimeout|setKeepOnScreenCondition|Thread\.sleep|postDelayed|asyncAfter|usleep|minimumDuration|preventAutoHideAsync/u.test(code(text));
  guards('no-hold-plugin', pluginText, noHold, 'Thread.sleep(800)');
  for (const file of ['apps/mobile/src/app/_layout.tsx', 'apps/mobile/src/app/index.tsx', 'apps/mobile/src/integration/composition/ProductRoot.tsx']) {
    assert.doesNotMatch(code(read(file)), /expo-splash-screen|SplashScreen\.|preventAutoHideAsync/u, `${file} holds the launch`);
  }
});

test('the Lantern is untouched: W2-02 adds no Lantern asset, component, route, animation or placeholder', () => {
  // Scoped to what W2-02 owns — no repository-wide scan, so the claim holds in a mirror without `.git` and sets no
  // ceiling on the future Lantern task.
  const owned = [...W2_02_OWNED_FILES, ...listFiles('apps/mobile/plugins'), ...listFiles('apps/mobile/assets/brand')];
  assert.deepEqual(owned.filter((file) => /lantern/iu.test(file)), [], 'no Lantern-named file is part of W2-02');
  const noLanternCode = (text) => !/lantern/iu.test(code(text));
  for (const file of W2_02_OWNED_FILES.filter((path) => /\.(?:js|mjs|json|sh|ya?ml)$/u.test(path))) {
    guards(`no-lantern-code:${file}`, read(file), noLanternCode, 'const lanternReveal = startLantern();');
  }
  // W2-02's own mention is its non-scope statement, and only in a comment.
  assert.match(pluginText, /QAN-BL-LANTERN-01 and the W3 appearance setting are untouched/u);
  assert.deepEqual(readdirSync(new URL('apps/mobile/src/app', root)).sort(), ['_layout.tsx', 'index.tsx'], 'no launch or Lantern route');
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  assert.match(backlog, /\| `QAN-BL-LANTERN-01` \| Lantern Gateway Identity Moment v1 — Creative \/ Motion \/ Interaction Realization \| `QANDEEL — Lantern Gateway Identity Moment v1` \| `HIGH` \| `DEFERRED — OWNED` \|/u);
});

test('the Product root stays the first Product destination after launch', () => {
  assert.match(read('apps/mobile/src/app/index.tsx'), /return <ProductRoot \/>;/u);
  assert.equal(readJson('apps/mobile/package.json').main, 'expo-router/entry');
  assert.equal(appJson.plugins[0], 'expo-router');
});

// ---------------------------------------------------------------------------------------------------------
// CNG
// ---------------------------------------------------------------------------------------------------------

test('generated native projects are never W2-02 source, and the Level-4 install step is confined to this one plugin', () => {
  // Generated output is ignored by the workspace, and the plugin writes only inside the generated project it is
  // handed. (That no generated file is TRACKED is a working-tree fact, owned by the mobile foundation contract.)
  const ignoresNative = (gitignore) => /^\/ios$/mu.test(gitignore) && /^\/android$/mu.test(gitignore);
  assert.equal(ignoresNative(read('apps/mobile/.gitignore')), true);
  assert.equal(ignoresNative(read('apps/mobile/.gitignore').replace(/^\/android$/mu, '')), false, 'a dropped ignore rule is detected');
  const writesOnlyIntoGeneratedProject = (text) =>
    (code(text).match(/install(?:Android|Ios)Resources\(modConfig\.modRequest\.platformProjectRoot/gu) ?? []).length === 2 &&
    !/projectRoot,\s*['"](?:src|assets|plugins)|__dirname,\s*['"]\.\.['"],\s*['"](?:src|app)/u.test(code(text));
  guards('writes-only-into-generated-project', pluginText, writesOnlyIntoGeneratedProject, "fs.writeFileSync(path.join(modConfig.modRequest.projectRoot, 'src', 'x.ts'), '');");
  assert.deepEqual(appJson.plugins, ['expo-router', './plugins/with-qandeel-launch-identity']);
  // Exactly two dangerous mods: one Android install, one iOS install. Everything else is a typed mod.
  const dangerousCount = (text) => (code(text).match(/withDangerousMod\(config,/gu) ?? []).length;
  assert.equal(dangerousCount(pluginText), 2);
  assert.equal(dangerousCount(`${pluginText}\nconfig = withDangerousMod(config, ['android', patchGradle]);`), 3, 'a planted third dangerous mod is counted');
  // No other W2-02 file uses a dangerous mod, the W2-02 plugins directory holds only this plugin, and the
  // repository-wide guard (the mobile foundation working-tree contract) excepts exactly this one file.
  for (const file of W2_02_OWNED_FILES.filter((path) => path !== PLUGIN_PATH)) {
    assert.doesNotMatch(read(file), /withDangerousMod/u, `${file} must not use a dangerous mod`);
  }
  assert.deepEqual(listFiles('apps/mobile/plugins'), [PLUGIN_PATH]);
  assert.match(read('tests/mobile-foundation-toolchain-contract.test.mjs'), /const level4Exceptions = new Set\(\['apps\/mobile\/plugins\/with-qandeel-launch-identity\.js'\]\);/u);
  const readme = read('apps/mobile/README.md');
  assert.match(readme, /\*\*W2-02 Level-4 exception — APPROVED \(bounded\)\.\*\*/u, 'the approved, bounded exception is recorded in the CNG policy');
  assert.match(readme, /does not authorize any future expansion/u);
});

test('the native launch-identity gate is wired, plants a defect per family, and runs in the fast gate', () => {
  for (const family of ['A-ICON-BYTES', 'A-NO-TEMPLATE-ICON', 'A-WORLD-DARK', 'A-WORLD-LIGHT', 'A-THEME', 'A-MANIFEST', 'A-LABEL', 'A-NIGHT-MODE', 'I-ICON-SET', 'I-WORLD-COLOR', 'I-LAUNCH', 'I-PLIST', 'I-ROOT-VIEW']) {
    assert.match(verifierText, new RegExp(`\\['(android|ios)', '${family}', `, 'u'), `no planted defect for ${family}`);
  }
  assert.equal(readJson('apps/mobile/package.json').scripts['prebuild:verify-launch-identity'], 'node scripts/verify-launch-identity-native.mjs');
  const rootPackage = readJson('package.json');
  assert.equal(rootPackage.scripts['prebuild:launch-identity:mobile'], 'npm run prebuild:verify-launch-identity --workspace @qandeel/mobile');
  assert.equal(rootPackage.scripts['test:w2-02-production-launch-identity-contract'], 'node --test tests/w2-02-production-launch-identity-contract.test.mjs');
  const mobileCi = read('.github/workflows/mobile-ci.yml');
  assert.match(mobileCi, /run: npm run test:w2-02-production-launch-identity-contract\}/u);
  assert.match(mobileCi, /run: npm run prebuild:launch-identity:mobile\}/u);
  assert.match(mobileCi, /'tests\/w2-02-production-launch-identity-contract\.test\.mjs'/u);
});

test('the native launch proof: observed defect = FAIL, observed correct launch = PASS, missed capture = CAPTURE_MISSED (R3)', () => {
  const run = (...parts) => parts.flatMap(([state, groundName, count]) => Array.from({ length: count }, () => ({ state, groundName, ground: groundName })))
    .map((frame, index) => ({ ...frame, index, time: index / 30 }));
  const judge = (frames, platform, expectGround, thenGround = '') => judgeLaunch(frames, { platform, expectGround, thenGround });
  const stable = STABLE_LAUNCH_FRAMES + 2;
  const springboard = ['other', 'other', 20];
  const launcher = ['product', 'dark', 20];
  // What follows the launch belongs to the boot smoke, and is never judged: Apple's interpolated greys, the Dark
  // app root, the unconfigured build's CONFIG_REFUSED screen, a white frame inside the app.
  const iosAfter = [['other', 'other', 7], ['world', 'dark', 20], ['content', 'light', 10], ['white', 'white', 3]];

  // iOS
  assert.equal(judge(run(springboard, ['world', 'light', stable], ...iosAfter), 'ios', 'light').verdict, VERDICT.PASS, 'correct Light launch → grey Apple transition → Dark app');
  assert.equal(judge(run(springboard, ['world', 'dark', stable], ['content', 'light', 10]), 'ios', 'dark').verdict, VERDICT.PASS, 'correct Dark launch → app');
  const black = judge(run(springboard, ['black', 'black', 20], ['world', 'light', stable]), 'ios', 'light');
  assert.equal(black.verdict, VERDICT.FAIL, 'black before the Light World');
  assert.match(black.failures.join('\n'), /black/u);
  assert.equal(judge(run(springboard, ['splash', 'light', 12], ['world', 'light', stable]), 'ios', 'light').verdict, VERDICT.FAIL, 'a Q / logo / image on the Launch Screen');
  assert.equal(judge(run(springboard, ['content', 'light', 12], ['world', 'light', stable]), 'ios', 'light').verdict, VERDICT.FAIL, 'text on the Launch Screen');
  assert.equal(judge(run(springboard, ['world', 'dark', stable], ...iosAfter), 'ios', 'light').verdict, VERDICT.FAIL, 'the wrong World on a Light device');
  assert.equal(judge(run(springboard, ['white', 'white', 10], ['world', 'light', stable]), 'ios', 'light').verdict, VERDICT.FAIL, 'a default white launch');
  assert.equal(judge(run(springboard), 'ios', 'light').verdict, VERDICT.CAPTURE_MISSED, 'iOS: nothing sampled is not a defect');

  // Android
  const app = ['content', 'light', 12];
  assert.equal(judge(run(launcher, ['splash', 'dark', 20], app), 'android', 'dark').verdict, VERDICT.PASS, 'captured correct splash → app (no empty World frame required)');
  assert.equal(judge(run(launcher, ['splash', 'light', 20], ['world', 'dark', 4], app), 'android', 'light', 'dark').verdict, VERDICT.PASS, 'first launch on a Light system');
  assert.equal(judge(run(launcher, ['splash', 'light', 20], app), 'android', 'dark').verdict, VERDICT.FAIL, 'captured splash on the wrong World');
  assert.equal(judge(run(launcher, ['white', 'white', 3], ['splash', 'dark', 20], app), 'android', 'dark').verdict, VERDICT.FAIL, 'captured white flash before the splash');
  assert.equal(judge(run(launcher, ['splash', 'dark', 20], ['white', 'white', 2], app), 'android', 'dark').verdict, VERDICT.FAIL, 'captured white flash at the splash exit (Expo default)');
  assert.equal(judge(run(launcher, app), 'android', 'dark').verdict, VERDICT.CAPTURE_MISSED, 'splash not sampled at all');
  assert.equal(judge(run(launcher, ['world', 'dark', 2], app), 'android', 'dark').verdict, VERDICT.CAPTURE_MISSED, 'only the app-owned World sampled — the splash was missed, nothing wrong was seen');
  assert.equal(judge(run(launcher), 'android', 'dark').verdict, VERDICT.CAPTURE_MISSED, 'the recording caught nothing');
  assert.equal(judge(run(launcher, ['white', 'white', 2], app), 'android', 'dark').verdict, VERDICT.FAIL, 'splash missed, but a white flash WAS observed');
  const duplicate = judge(run(launcher, ['splash', 'dark', 20], ['world', 'dark', 3], ['splash', 'dark', 10], app), 'android', 'dark');
  assert.equal(duplicate.verdict, VERDICT.FAIL, 'an observed second icon splash');
  assert.match(duplicate.failures.join('\n'), /second splash/u);
  // The app surface after the splash is never judged: a light CONFIG_REFUSED screen, or anything else.
  assert.equal(judge(run(launcher, ['splash', 'dark', 20], ['content', 'light', 30], ['white', 'white', 5], ['other', 'other', 10]), 'android', 'dark').verdict, VERDICT.PASS);

  // Only an observed defect gates: the CLI exits non-zero for FAIL alone.
  assert.match(read('scripts/w2/analyze-w2-02-launch-recording.mjs'), /if \(result\.verdict === VERDICT\.FAIL\) process\.exitCode = 1;/u);
});

test('the implementation record tells the lifecycle truth and carries the W3 boundary', () => {
  const record = read('docs/e2e/QANDEEL_W2_02_PRODUCTION_LAUNCH_IDENTITY_IMPLEMENTATION_RECORD_v1.md');
  assert.match(record, /\*\*Status:\*\* IMPLEMENTED ON A DRAFT PR — NOT MERGED/u, 'lifecycle truth: not merged until merged');
  assert.match(record, /\*\*Baseline:\*\* `df194edf6d70a2a300a0251ed114e7ad8715485e`/u);
  assert.match(record, /\*\*No applicable Skill was used\.\*\*/u, 'Skills / G1');
  assert.match(record, /\*\*W3 integration carry-forward\*\*/u);
  assert.match(record, /APPROVED — bounded W2-02 Level-4 exception/u, 'the Architecture disposition is recorded');
  assert.doesNotMatch(record, /submitted for review, not granted/u, 'the superseded pending wording is gone');
  const claimsMore = (text) => /Lantern (?:is )?implemented|Sign out (?:is )?implemented|W2 is (?:fully )?closed|appearance preference (?:is )?implemented/u.test(text.replace(/\bnot implemented\b|is not implemented/gu, ''));
  assert.equal(claimsMore(record), false);
  assert.equal(claimsMore(`${record}\nThe Lantern is implemented.`), true, 'a planted over-claim is detected');
});

test('W2-02 source, config and assets are native impact and native build inputs', () => {
  const paths = [PLUGIN_PATH, 'apps/mobile/app.json', `${VENDORED}/android/res/mipmap-xxxhdpi/ic_launcher_foreground.png`, `${VENDORED}/ios/AppIcon.appiconset/AppIcon-1024.png`, MANIFEST_PATH];
  for (const path of paths) {
    assert.equal(classifyMobileNativeImpact([path]), true, `${path} must trigger the Android + iOS Release builds`);
    assert.equal(classifyBuildInput(path).included, true, `${path} must be in the native build-input fingerprint`);
  }
  // The canonical copy is prose-tree evidence and is NOT a build input — which is why production consumes the vendored copy.
  assert.equal(classifyBuildInput(`${CANONICAL}/ios/AppIcon.appiconset/AppIcon-1024.png`).included, false);
});
