import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// W3-01 — General Settings Foundation + Appearance + Sign Out (E2E-D-01, D-10, D-07; D-02 advances only).
// Static contract.
//
// The behaviour is proven where it runs, by the mobile Jest suites this file names and checks are present:
//   apps/mobile/src/appearance/__tests__/appearance-authority.test.ts           (the ONE authority, persistence)
//   apps/mobile/src/integration/__tests__/w3-settings-appearance-signout.test.tsx (the production phase surface)
//   apps/mobile/src/runtime-entry/__tests__/sign-out-durability.test.ts         (the REAL SDK, restart)
// This gate guards what must be true BY CONSTRUCTION of the files W3-01 owns or changed. Every predicate that
// carries a critical invariant is shown to reject a planted defect before it is trusted. No whole-file hash.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const readJson = (path) => JSON.parse(read(path));
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

const SRC = 'apps/mobile/src';
const PRODUCTION = listFiles(SRC).filter((file) => /\.tsx?$/u.test(file) && !/__tests__|__fixtures__|__validation__/u.test(file));
const productionCode = Object.fromEntries(PRODUCTION.map((file) => [file, code(read(file))]));

const SURFACE = `${SRC}/conversation/ConversationSurface.tsx`;
const DEPTH = `${SRC}/integration/composition/DepthComposition.tsx`;
const ROOT = `${SRC}/integration/composition/ProductRoot.tsx`;
const SETTINGS = `${SRC}/settings/SettingsSurface.tsx`;
const SETTINGS_COPY = `${SRC}/settings/copy.ts`;
const AUTHORITY = `${SRC}/appearance/appearance-authority.ts`;
const STORAGE = `${SRC}/appearance/appearance-storage.ts`;
const NATIVE = `${SRC}/appearance/native-appearance.ts`;
const PORT = `${SRC}/runtime-entry/auth/supabase-auth-port.ts`;
const MODULE_DIR = 'apps/mobile/modules/qandeel-app-appearance';
const MODULE_KT = `${MODULE_DIR}/android/src/main/java/expo/modules/qandeelappappearance/QandeelAppAppearanceModule.kt`;
const PLUGIN = 'apps/mobile/plugins/with-qandeel-launch-identity.js';
const RECORD = 'docs/e2e/QANDEEL_W3_01_GENERAL_SETTINGS_APPEARANCE_SIGNOUT_IMPLEMENTATION_RECORD_v1.md';

// ---------------------------------------------------------------------------------------------------------
// Settings — E2E-D-01 (and D-02 advanced, not closed)
// ---------------------------------------------------------------------------------------------------------

test('S-B: the Settings entry is on the Personal row BENEATH the upper chrome, never in it, and 44 × 44', () => {
  const surface = code(read(SURFACE));
  // The upper chrome: from its frame to the start of the Personal row.
  const header = surface.slice(surface.indexOf('minHeight: insets.top + HEADER_MIN_HEIGHT'), surface.indexOf('onOpenSettings === undefined ? null'));
  assert.ok(header.length > 200, 'the upper chrome block was located');
  const chromeHasOnlyTheDoor = (text) => !/settings|Settings/u.test(text) && (text.match(/<Control\b/gu) ?? []).length === 1;
  guards('upper-chrome-has-no-settings', header, chromeHasOnlyTheDoor, '<Control accessibilityLabel={copy.settingsName} onPress={onOpenSettings}>');
  const rowStart = surface.indexOf('testID="qandeel-personal-row"');
  const row = surface.slice(rowStart, surface.indexOf('<FlatList', rowStart));
  assert.match(row, /height: PERSONAL_ROW_HEIGHT/u);
  assert.match(row, /justifyContent: endSide === 'right' \? 'flex-end' : 'flex-start'/u, 'logical END of the reader’s line');
  assert.match(row, /accessibilityLabel=\{copy\.settingsName\}/u);
  assert.match(row, /style=\{\{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center' \}\}/u, '44 × 44');
  assert.match(row, /<Glyph name="settings"/u, 'icon-only, P2’s own settings glyph');
  assert.match(surface, /const PERSONAL_ROW_HEIGHT = 44;/u);
  assert.equal(surface.indexOf('testID="qandeel-personal-row"') > surface.indexOf('testID="qandeel-depth-to-analysis"'), true, 'the row follows the chrome');
  // The one approved name: «الإعدادات» / Settings.
  const copy = read(`${SRC}/conversation/copy.ts`);
  assert.match(copy, /settingsName: 'الإعدادات',/u);
  assert.match(copy, /settingsName: 'Settings',/u);
});

test('Settings is not in the Analysis, and it is ONE destination with no extra route', () => {
  for (const file of [`${SRC}/conversation/AnalysisReturnBar.tsx`, `${SRC}/integration/composition/LivingAnalysisMap.tsx`]) {
    assert.doesNotMatch(code(read(file)), /settings|Settings/u, `${file} carries no Settings entry`);
  }
  const depth = code(read(DEPTH));
  assert.match(depth, /settingsShown && depth === 'CONVERSATION' && onSignOut !== undefined \?/u, 'only over the Personal Conversation');
  assert.equal((depth.match(/<SettingsSurface\b/gu) ?? []).length, 1, 'one destination');
  const onlyOneEntry = (text) => (text.match(/testID="qandeel-settings-entry"/gu) ?? []).length === 1;
  guards('one-settings-entry', Object.values(productionCode).join('\n'), onlyOneEntry, 'testID="qandeel-settings-entry"');
  // The one-Product-root model: the router root is still exactly two files; Settings pushes nothing.
  assert.deepEqual(readdirSync(new URL(`${SRC}/app`, root)).sort(), ['_layout.tsx', 'index.tsx']);
  const noNavigation = (text) => !/expo-router|router\.(push|navigate|replace)|useRouter|<Stack\b|<Modal\b/u.test(text);
  guards('settings-is-not-a-route', code(read(SETTINGS)) + depth, noNavigation, "import { router } from 'expo-router'; router.push('/settings');");
  // Android Back is Settings' own Back while it is shown.
  assert.match(depth, /if \(!settingsShown\) return undefined;\s*const subscription = BackHandler\.addEventListener\('hardwareBackPress', \(\) => \{\s*closeSettings\(\);\s*return true;/u);
});

// Re-anchored by W3-02 (E2E-D-09): Account & Identity (`gAccount`) is now a REAL group with one function, the Public
// ID. Every OTHER P4-C4 group name is still refused, and so is any placeholder; D-02 is still advanced, not closed.
test('exactly the functional groups that exist (W3-01’s two, W3-02’s Account & Identity) — no placeholder, no other group name — so D-02 is advanced, not closed', () => {
  const settings = code(read(SETTINGS));
  const copy = code(read(SETTINGS_COPY));
  // P4-C4 §4's other group names, exactly as the pinned registry carries them.
  const registry = readJson('docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/data/COPY_REGISTRY.json');
  const rows = Array.isArray(registry) ? registry : registry.rows ?? Object.values(registry).find(Array.isArray);
  const byKey = new Map(rows.map((row) => [row.k, row]));
  for (const key of ['gAccount', 'gAppearance', 'gSupport']) {
    assert.ok(copy.includes(`'${byKey.get(key).ar}'`) && copy.includes(`'${byKey.get(key).en}'`), `${key} is the approved text`);
  }
  const others = ['gSecurity', 'gQandeel', 'gPrivacy', 'gPlan'].flatMap((key) => [byKey.get(key).ar, byKey.get(key).en]);
  assert.equal(others.length, 8);
  const noOtherGroup = (text) => others.every((name) => !text.includes(name)) && !/coming soon|قريبًا|placeholder|disabled: true/iu.test(text);
  guards('no-other-group-or-placeholder', settings + copy, noOtherGroup, `const later = '${byKey.get('gSecurity').ar}';`);
  assert.equal((settings.match(/<GroupHeading\b/gu) ?? []).length, 3, 'three group headings: Account & Identity, Appearance & Accessibility, Support & About');
  // The record must not claim the nine-group hierarchy closed.
  const record = read(RECORD);
  const overClaimsD02 = (text) => /E2E-D-02[^\n]*\b(CLOSED|COMPLETE)\b(?! — NOT)/u.test(text.replace(/NOT (?:CLOSED|COMPLETE)/gu, ''));
  assert.equal(overClaimsD02(record), false);
  assert.equal(overClaimsD02(`${record}\n| E2E-D-02 | CLOSED |`), true, 'a planted D-02 over-claim is detected');
});

test('the Product Copy Gate strings are exactly the approved ones, and nothing else is written', () => {
  const copy = read(SETTINGS_COPY);
  for (const [ar, en] of [['الإعدادات', 'Settings'], ['رجوع', 'Back'], ['داكن', 'Dark'], ['فاتح', 'Light'], ['حسب الجهاز', 'System'], ['تسجيل الخروج', 'Sign out']]) {
    assert.ok(copy.includes(`'${ar}'`), `AR ${ar}`);
    assert.ok(copy.includes(`'${en}'`), `EN ${en}`);
  }
  // No helper text, no progress words, no failure words (approved absences).
  const settings = code(read(SETTINGS));
  const noInventedWords = (text) => !/['"`][^'"`\n]*[؀-ۿ][^'"`\n]*['"`]/u.test(text) && !/['"`](?:Signing out|Loading|Failed|Error)[^'"`]*['"`]/u.test(text);
  guards('settings-surface-writes-no-words', settings, noInventedWords, "const busy = 'جارٍ تسجيل الخروج';");
});

// ---------------------------------------------------------------------------------------------------------
// Appearance — E2E-D-10
// ---------------------------------------------------------------------------------------------------------

test('ONE appearance authority: no scattered useColorScheme, RN Appearance only at the platform edge, no native constant in Product code', () => {
  const all = Object.entries(productionCode);
  // Only the platform edge reads or declares the platform appearance; nothing else has a second authority.
  const onlyAtTheEdge = (entries) =>
    entries.every(([file, text]) => file === NATIVE || !/\bAppearance\.(?:getColorScheme|setColorScheme|addChangeListener)|useColorScheme\b|setApplicationNightMode/u.test(text));
  assert.equal(onlyAtTheEdge(all), true);
  assert.equal(onlyAtTheEdge([...all, [`${SRC}/settings/X.tsx`, 'const scheme = useColorScheme();']]), false, 'a planted second authority is rejected');
  // No Product code — the platform edge included — names a native night-mode constant: the module owns the mapping.
  const noNativeConstant = (text) => !/MODE_NIGHT_|UiModeManager|AppCompatDelegate/u.test(text);
  guards('no-native-constant-in-product-code', all.map(([, text]) => text).join('\n'), noNativeConstant, 'setApplicationNightMode(UiModeManager.MODE_NIGHT_AUTO);');
  // Exactly one module creates the authority, and exactly one place (the integration runtime) builds it.
  const creators = all.filter(([, text]) => /export function createAppearanceAuthority\b/u.test(text));
  assert.deepEqual(creators.map(([file]) => file), [AUTHORITY]);
  const builders = all.filter(([file, text]) => file !== AUTHORITY && /createAppearanceAuthority\(/u.test(text) && !/export \{/u.test(text.slice(text.indexOf('createAppearanceAuthority') - 40, text.indexOf('createAppearanceAuthority'))));
  assert.deepEqual(builders.map(([file]) => file), [`${SRC}/integration/runtime/integration-runtime.ts`]);
  // Components consume the appearance through the visual seam; the palette is chosen in ONE hook.
  assert.match(code(read(`${SRC}/conversation/visual/theme.ts`)), /const family = CANONICAL_VISUAL\.palettes\[useSurfaceAppearance\(\)\];/u);
});

test('P1 §12 semantics are the authority’s: Dark default, System follows the OS only while chosen, the Analysis scope is DARK', () => {
  const authority = code(read(AUTHORITY));
  assert.match(authority, /export const DEFAULT_APPEARANCE_PREFERENCE: AppearancePreference = 'DARK';/u);
  assert.match(authority, /return preference === 'SYSTEM' \? system : preference;/u);
  assert.match(authority, /if \(disposed \|\| state\.preference !== 'SYSTEM'\) return;/u, 'an explicit Dark or Light ignores the OS');
  assert.match(authority, /publish\(account === null \? DEFAULT_APPEARANCE_PREFERENCE : stored\(account\)\);/u, 'signed out is the default');
  const provider = code(read(`${SRC}/appearance/AppearanceProvider.tsx`));
  const analysisIsDark = (text) => /return analysis \? 'DARK' : effective;/u.test(text) && !/analysis \? effective/u.test(text);
  guards('analysis-is-always-dark', provider, analysisIsDark, "const repaint = analysis ? effective : 'DARK';");
  const depth = code(read(DEPTH));
  assert.match(depth, /\) : \(\s*<AnalysisAppearanceScope>\s*<View style=\{styles\.fill\}>/u, 'the whole Analysis layer stands in the dark scope');
  assert.match(depth, /depth === 'ANALYSIS' \? \(\s*<AnalysisAppearanceScope>\s*<AppearanceStatusBar \/>/u, 'and so does its status content');
  // No hard-coded status content remains on a surface that can be Light.
  for (const [file, text] of Object.entries(productionCode)) {
    if (file.includes('/__validation__/') || file === `${SRC}/shell/FoundationShell.tsx` || file === ROOT) continue;
    assert.doesNotMatch(text, /<StatusBar style="(?:light|dark)"/u, `${file} decides the status content itself`);
  }
});

test('persistence is device-local, per identity, in its OWN database — no server, no migration', () => {
  const storage = code(read(STORAGE));
  assert.match(storage, /export const APPEARANCE_DATABASE_NAME = 'qandeel-appearance\.db';/u);
  assert.match(storage, /import \{ SQLiteStorage \} from 'expo-sqlite\/kv-store';/u);
  assert.match(storage, /return `\$\{APPEARANCE_KEY_PREFIX\}\$\{userId\}`;/u, 'namespaced by identity');
  assert.notEqual('qandeel-appearance.db', 'qandeel-auth-session.db');
  assert.match(read(`${SRC}/runtime-entry/auth/auth-session-storage.ts`), /AUTH_SESSION_DATABASE_NAME = 'qandeel-auth-session\.db'/u);
  assert.match(read(`${SRC}/recovery/store/product-recovery-store.ts`), /PRODUCT_RECOVERY_DATABASE_NAME = 'qandeel-product-recovery\.db'/u);
  const noRemote = (text) => !/fetch\(|apiBaseUrl|supabase|console\./u.test(text);
  guards('appearance-is-local-and-silent', Object.entries(productionCode).filter(([file]) => file.startsWith(`${SRC}/appearance/`)).map(([, text]) => text).join('\n'), noRemote, 'console.log(preference);');
  // No database migration was added for it.
  for (const file of listFiles('database').filter((path) => /\.sql$/u.test(path))) assert.doesNotMatch(read(file), /appearance_preference|appearance preference/iu, `${file}`);
  // The runtime binds the identity before any world is composed, and releases it on sign-out.
  assert.match(code(read(`${SRC}/integration/runtime/integration-runtime.ts`)), /appearance\.bindAccount\(state\.kind === 'AUTHENTICATED' \? state\.userId : null\);\s*if \(state\.kind === 'AUTHENTICATED'\) \{/u);
});

test('canonical Light/Dark: generated from F2 FINAL’s own resolver, current, Dark unchanged, no colour literal in the new layers', () => {
  const result = spawnSync(process.execPath, ['apps/mobile/scripts/generate-conversation-visual.mjs', '--check'], { cwd: rootPath, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  const generator = read('apps/mobile/scripts/generate-conversation-visual.mjs');
  assert.match(generator, /const f2r = await import\(pathToFileURL\(join\(F2R, 'tools\/f2-resolve\.mjs'\)\)\.href\);/u);
  assert.match(generator, /if \(G32_COMPOSES_LIKE_F2\(appearance, contrast\)\) \{/u, 'the G3.2 agreement check is kept');
  // F2's own resolver composes Light + Increased from F1's increased file AND F2's Light file.
  assert.match(read('docs/design/canonical-artifacts/accessibility-appearance/i-08b3.1-f2r/tools/f2-resolve.mjs'), /light: \['vendor\/f1\/tokens\/contrast\/increased\.accessibility\.tokens\.json', 'tokens\/contrast\/light\.increased\.tokens\.json'\],/u);
  const generated = read(`${SRC}/conversation/visual/canonical-visual.generated.ts`);
  const palettes = JSON.parse(generated.slice(generated.indexOf('= {') + 2, generated.lastIndexOf('} as const') + 1)).palettes;
  assert.equal(palettes.DARK.standard.world, '#101010');
  assert.equal(palettes.LIGHT.standard.world, '#efeeeb', 'F2 FINAL Light World');
  assert.equal(palettes.LIGHT.standard.error, '#ad4739');
  // F1's law holds in both appearances: the control ink one rung up, the focus perimeter 2 → 3.
  for (const family of [palettes.DARK, palettes.LIGHT]) {
    assert.equal(family.standard.restInk, family.standard.tertiary);
    assert.equal(family.increased.restInk, family.increased.secondary);
    assert.deepEqual([family.standard.focusThickness, family.increased.focusThickness], [2, 3]);
  }
  for (const dir of [`${SRC}/settings`, `${SRC}/appearance`]) {
    for (const file of listFiles(dir).filter((path) => /\.tsx?$/u.test(path) && !path.includes('__tests__'))) {
      assert.doesNotMatch(code(read(file)), /#[0-9a-fA-F]{3,8}\b|rgba?\(/u, `${file} names a colour literal`);
    }
  }
  // The frozen token sources are consumed, never edited: the generator records their hashes and --check passed.
  assert.match(generated, /docs\/design\/canonical-artifacts\/accessibility-appearance\/i-08b3\.1-f2r\/tokens\/contrast\/light\.increased\.tokens\.json {2}[0-9a-f]{64}/u);
});

// ---------------------------------------------------------------------------------------------------------
// Native appearance — the W2-02 carry-forward
// ---------------------------------------------------------------------------------------------------------

test('Android: a Level-3 local Expo module maps Dark / Light / System to the platform service’s app-level meaning', () => {
  assert.deepEqual(readJson(`${MODULE_DIR}/expo-module.config.json`), {
    platforms: ['android'],
    android: { modules: ['expo.modules.qandeelappappearance.QandeelAppAppearanceModule'] },
  });
  const kt = read(MODULE_KT);
  const mapping = (text) =>
    /"DARK" -> UiModeManager\.MODE_NIGHT_YES/u.test(text) &&
    /"LIGHT" -> UiModeManager\.MODE_NIGHT_NO/u.test(text) &&
    /"SYSTEM" -> UiModeManager\.MODE_NIGHT_AUTO/u.test(text) &&
    !/MODE_NIGHT_CUSTOM|AppCompatDelegate/u.test(text);
  guards('android-night-mode-mapping', kt, mapping, '"SYSTEM" -> UiModeManager.MODE_NIGHT_CUSTOM');
  assert.match(kt, /if \(Build\.VERSION\.SDK_INT < Build\.VERSION_CODES\.S\) return@Function false/u, 'API 31+ only');
  assert.match(kt, /UI_MODE_NIGHT_UNDEFINED/u, 'the verified service semantics are recorded beside the mapping');
  // No new dangerous mod, and the W2-02 plugin no longer re-declares a night mode at every launch.
  const plugin = read(PLUGIN);
  assert.equal((code(plugin).match(/withDangerousMod\(config,/gu) ?? []).length, 2, 'the bounded W2-02 exception is not expanded');
  const noLaunchNightMode = (text) => !/setApplicationNightMode|MODE_NIGHT_|withMainApplication/u.test(code(text));
  guards('no-launch-night-mode', plugin, noLaunchNightMode, "config = withMainApplication(config, (m) => m); // setApplicationNightMode(MODE_NIGHT_YES)");
  assert.deepEqual(listFiles('apps/mobile/plugins'), [PLUGIN], 'no new plugin');
});

test('iOS: the Launch Screen still follows the device (W2-02 unchanged); the root view is the World asset for its own appearance', () => {
  const plugin = require(join(rootPath, PLUGIN));
  assert.deepEqual(plugin.internals.applyLaunchScreen({ UILaunchStoryboardName: 'x' }), { UILaunchScreen: { UIColorName: 'QandeelWorld' } });
  assert.equal(readJson('apps/mobile/app.json').expo.ios.userInterfaceStyle, 'automatic');
  const once = plugin.internals.applyRootViewWorld('class D {\n  // Extension point for config-plugins\n}\n');
  assert.match(once, /rootView\.backgroundColor = UIColor\(named: "QandeelWorld"\) \?\? UIColor\(red: 16\.0 \/ 255\.0/u);
  assert.equal(plugin.internals.applyRootViewWorld(once), once, 're-application is byte-identical');
});

// ---------------------------------------------------------------------------------------------------------
// Sign out — E2E-D-07
// ---------------------------------------------------------------------------------------------------------

test('Sign out uses the ONE existing auth sign-out, once, with no second path and no other-devices scope', () => {
  const rootText = code(read(ROOT));
  assert.match(rootText, /const signOut = useCallback\(\(\) => auth\.signOut\(\), \[auth\]\);/u);
  const settings = code(read(SETTINGS));
  const onePath = (text) => (text.match(/onSignOut\(\)/gu) ?? []).length === 1 && !/\.signOut\(|supabase|removeItem|scope:/u.test(text);
  guards('settings-has-one-sign-out-path', settings, onePath, "void auth.signOut({ scope: 'others' });");
  assert.match(settings, /if \(signingOutRef\.current\) return;\s*signingOutRef\.current = true;/u, 'double taps are refused');
  // No confirmation dialog, no session-management UI, no account deletion.
  assert.doesNotMatch(settings, /Alert\.alert|confirm\(|deleteAccount|sessions/u);
  // Across the whole app, no other-devices or global scope is requested by Product code.
  for (const [file, text] of Object.entries(productionCode)) assert.doesNotMatch(text, /scope: 'others'|scope: 'global'/u, file);
});

test('W3-01 R1 — the final Sign out asks the provider for LOCAL scope only, never the SDK default (global) nor others', () => {
  const port = code(read(PORT));
  const body = port.slice(port.indexOf('    async signOut() {'), port.indexOf('    onSessionChange('));
  assert.ok(body.length > 0, 'the port’s final sign-out body is located');
  // Exactly one provider sign-out, through the existing seam, with the explicit local scope. An omitted scope is
  // the SDK's `global`; any direct SDK call, or any other scope, is a second meaning of "Sign out".
  const localOnly = (text) =>
    (text.match(/signOutOwn\(\s*'local'\s*\)/gu) ?? []).length === 1 &&
    !/signOutOwn\(\s*\)/u.test(text) &&
    !/\.auth\.signOut\(/u.test(text) &&
    !/scope:\s*'(?:global|others)'|scope=(?:global|others)/u.test(text);
  guards('final-sign-out-omits-scope', body, localOnly, 'const again = await signOutOwn();');
  guards('final-sign-out-calls-the-sdk-bare', body, localOnly, 'await client.auth.signOut();');
  guards('final-sign-out-global-scope', body, localOnly, "await client.auth.signOut({ scope: 'global' });");
  guards('final-sign-out-others-scope', body, localOnly, "await client.auth.signOut({ scope: 'others' });");
  // The seam itself maps 'local' to the SDK's `{ scope: 'local' }` and admits no wider scope.
  assert.match(port, /const signOutOwn = async \(scope\?: 'local'\) => \{/u);
  assert.match(port, /: await client\.auth\.signOut\(\{ scope \}\);/u);
  // The real-SDK proof observes the request, and its non-vacuity shows the default really is global.
  const durability = read(`${SRC}/runtime-entry/__tests__/sign-out-durability.test.ts`);
  assert.match(durability, /\/logout\?scope=local`\);/u);
  assert.match(durability, /\/logout\\\?scope=global\$\/u\);/u);
});

test('sign-out durability: the port retires THIS device’s session material unconditionally, under the SDK’s own key', () => {
  const port = code(read(PORT));
  assert.match(port, /return `sb-\$\{new URL\(supabaseUrl\)\.hostname\.split\('\.'\)\[0\]\}-auth-token`;/u, 'exactly the SDK default key');
  assert.match(port, /auth: \{ storage, storageKey: sessionKey, \.\.\.SUPABASE_AUTH_OPTIONS \},/u);
  const body = port.slice(port.indexOf('    async signOut() {'), port.indexOf('    onSessionChange('));
  const unconditional = (text) => /await retireLocalSession\(\);\s*return result;/u.test(text) && !/if \([^)]*\) await retireLocalSession/u.test(text);
  guards('unconditional-local-retirement', body, unconditional, 'if (!result.ok) await retireLocalSession();');
  // The authority keeps its frozen ordering: the epoch is retired before the await, SIGNED_OUT after, never sessionEnded.
  const authority = code(read(`${SRC}/runtime-entry/auth/mobile-auth-authority.ts`));
  assert.match(authority, /operationEpoch \+= 1;\s*epochRetired = true;\s*const result = await port\.signOut\(\);\s*if \(disposed\) return result;\s*[\s\S]{0,300}?publish\(\{ kind: 'SIGNED_OUT' \}\);/u);
  // The real-SDK restart proof exists and is non-vacuous.
  const durability = read(`${SRC}/runtime-entry/__tests__/sign-out-durability.test.ts`);
  assert.match(durability, /NON-VACUITY — the SDK alone leaves the session stored/u);
  assert.match(durability, /the next app start is SIGNED OUT/u);
});

// ---------------------------------------------------------------------------------------------------------
// Wiring, proof and lifecycle truth
// ---------------------------------------------------------------------------------------------------------

test('the focused suites exist, and this contract runs in the mobile fast gate', () => {
  for (const suite of [
    `${SRC}/appearance/__tests__/appearance-authority.test.ts`,
    `${SRC}/integration/__tests__/w3-settings-appearance-signout.test.tsx`,
    `${SRC}/runtime-entry/__tests__/sign-out-durability.test.ts`,
    `${SRC}/settings/__tests__/settings-surface.test.tsx`,
  ]) assert.equal(existsSync(new URL(suite, root)), true, `${suite} is missing`);
  assert.equal(readJson('package.json').scripts['test:w3-01-general-settings-appearance-signout-contract'], 'node --test tests/w3-01-general-settings-appearance-signout-contract.test.mjs');
  const mobileCi = read('.github/workflows/mobile-ci.yml');
  assert.match(mobileCi, /run: npm run test:w3-01-general-settings-appearance-signout-contract\}/u);
  assert.match(mobileCi, /'tests\/w3-01-general-settings-appearance-signout-contract\.test\.mjs'/u);
});

// Re-anchored by W3-02's post-W3-01 reconciliation: W3-01 MERGED through PR #287, which closed D-01 / D-10 / D-07 and,
// with D-07, W2. The permanent claims stay: the baseline is W3-01's own, D-02 is advanced only, and W3 is NOT closed.
test('the implementation record tells the lifecycle truth', () => {
  const record = read(RECORD);
  assert.match(record, /\*\*Status:\*\* MERGED \/ CLOSED — merged through PR #287 at `023cb9874376ac69db5848db099d06034d5deb54`/u);
  assert.match(record, /\*\*Baseline:\*\* `b650b56f7436ce63d33c0af34036a963a03f5eee`/u);
  for (const moment of ['E2E-D-01', 'E2E-D-10', 'E2E-D-07', 'E2E-D-02']) assert.match(record, new RegExp(moment, 'u'));
  assert.match(record, /W2 is fully CLOSED\. W3 remains ACTIVE/u);
  const claimsMore = (text) => /W3 is (?:fully )?closed|W3 (?:is )?(?:CLOSED|COMPLETE)\b/iu.test(text.replace(/W3 is not closed|it is not closed|does not close W3/giu, ''));
  assert.equal(claimsMore(record), false);
  assert.equal(claimsMore(`${record}\nW3 is closed.`), true, 'a planted over-claim is detected');
});
