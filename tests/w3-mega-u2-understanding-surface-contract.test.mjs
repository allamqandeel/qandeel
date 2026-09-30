import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// W3-MEGA-U U2 — the «فهم قنديل» / QANDEEL Understanding Product surface (E2E-D-14 mobile half) and the "talk to QANDEEL
// about this" context seam. Static contract. Every detector passes on the shipped source and fails on a planted defect.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`])\/\/[^\n]*/gu, '$1');
function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(join(rootPath, dir))) {
    const full = `${dir}/${entry}`;
    if (statSync(join(rootPath, full)).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}
const MOBILE = 'apps/mobile/src';
const LAYER = `${MOBILE}/understanding`;
const PRODUCTION = listFiles(MOBILE).filter((file) => /\.tsx?$/u.test(file) && !/__tests__|__fixtures__|__validation__/u.test(file));
const LAYER_FILES = listFiles(LAYER).filter((file) => !/__tests__/u.test(file));
const src = {
  copy: read(`${LAYER}/copy.ts`),
  controller: read(`${LAYER}/understanding-controller.ts`),
  surface: read(`${LAYER}/UnderstandingSurface.tsx`),
  entry: read(`${LAYER}/UnderstandingEntry.tsx`),
  strip: read(`${LAYER}/UnderstandingDiscussionStrip.tsx`),
  api: read(`${MOBILE}/runtime-entry/understanding-api.ts`),
  depth: read(`${MOBILE}/integration/composition/DepthComposition.tsx`),
  conversation: read(`${MOBILE}/conversation/ConversationSurface.tsx`),
  settings: read(`${MOBILE}/settings/SettingsSurface.tsx`) + read(`${MOBILE}/settings/copy.ts`),
  analysis: read(`${MOBILE}/conversation/AnalysisReturnBar.tsx`) + read(`${MOBILE}/integration/composition/LivingAnalysisMap.tsx`),
  signals: read('apps/api/src/hypothesis/hypothesis-user-signal.repository.ts'),
  reasoning: read('apps/api/src/hypothesis/hypothesis-reasoning-context.service.ts'),
};
const plant = (key, from, to) => {
  assert.ok(src[key].includes(from), `planting anchor missing in ${key}: ${from}`);
  return { ...src, [key]: src[key].replace(from, to) };
};

// ---------------------------------------------------------------------------------------------------------------
// Detectors.

function placementViolations(world) {
  const out = [];
  const production = PRODUCTION.map((file) => (file.endsWith('UnderstandingEntry.tsx') ? world.entry : read(file))).join('\n');
  if ((production.match(/testID="qandeel-understanding-entry"/gu) ?? []).length !== 1) out.push('not exactly one Understanding entry');
  if ((code(world.depth).match(/<UnderstandingEntry\b/gu) ?? []).length !== 1) out.push('the entry is not composed once, by the Personal world');
  if (!/personalEntry=\{onSignOut === undefined \? null : \(\n\s*<UnderstandingEntry /u.test(world.depth)) out.push('the entry is not the Personal row’s start entry');
  if (/Understanding|فهم قنديل/u.test(code(world.analysis))) out.push('an Understanding entry in the Analysis');
  if (/understanding|فهم قنديل/iu.test(code(world.settings))) out.push('Understanding inside General Settings');
  // The upper chrome (from its minHeight to the Personal row) holds only the depth control.
  const chrome = world.conversation.slice(world.conversation.indexOf('minHeight: insets.top + HEADER_MIN_HEIGHT'), world.conversation.indexOf('onOpenSettings === undefined ? null'));
  if (/personalEntry|Understanding/u.test(chrome)) out.push('the entry is in the upper chrome');
  if (!/understandingShown && depth === 'CONVERSATION' && onSignOut !== undefined \?/u.test(world.depth)) out.push('Understanding reachable from the Analysis');
  return out;
}

function notARouteViolations(world) {
  const out = [];
  const all = [world.depth, world.surface, world.controller, world.entry, world.strip].map(code).join('\n');
  if (/expo-router|router\.push|useRouter|<Stack|<Modal|navigate\(/u.test(all)) out.push('a route, stack or modal');
  if (/AsyncStorage|SecureStore|expo-sqlite|kv-store/u.test(all)) out.push('Understanding persisted on the device');
  if (!/const reachable = current && !settingsShown && !understandingShown;/u.test(world.depth)) out.push('the Personal world is not kept mounted and out of reach beneath it');
  if (!/if \(!understandingShown\) return undefined;\n\s*const subscription = BackHandler\.addEventListener\('hardwareBackPress', \(\) => \{\n\s*closeUnderstanding\(\);\n\s*return true;/u.test(world.depth)) out.push('Android Back does not close Understanding');
  return out;
}

const APPROVED_CONFIDENCE = {
  ar: { CLEAR: 'واضح', TAKING_SHAPE: 'يتشكّل', MIXED: 'يوجد تعارض', NEEDS_MORE: 'يحتاج سياقًا أكثر', name: 'الثقة: ${state}' },
  en: { CLEAR: 'Clear', TAKING_SHAPE: 'Taking shape', MIXED: 'Mixed', NEEDS_MORE: 'Needs more to go on', name: 'Confidence: ${state}' },
};
function copyViolations(world) {
  const out = [];
  for (const [language, words] of Object.entries(APPROVED_CONFIDENCE)) {
    const block = world.copy.slice(world.copy.indexOf(`const ${language.toUpperCase()}: UnderstandingCopy`));
    for (const [state, word] of Object.entries(words)) {
      if (state === 'name') { if (!block.includes(`\`${word}\``)) out.push(`${language} confName altered`); continue; }
      if (!block.includes(`${state}: '${word}'`)) out.push(`${language} ${state} is not the approved word`);
    }
  }
  if (!world.copy.includes("name: 'فهم قنديل'") || !world.copy.includes("name: 'QANDEEL Understanding'")) out.push('the frozen name altered');
  for (const frozen of ["evidence: 'الأدلة'", "contradictions: 'التناقضات'", "alternatives: 'البدائل'", "unresolved: 'نقاط غير محسومة'", "evolution: 'تطور التحليل'",
    "evidence: 'Evidence'", "contradictions: 'Contradictions'", "alternatives: 'Alternatives'", "unresolved: 'Unresolved points'", "evolution: 'Analysis evolution'"]) {
    if (!world.copy.includes(frozen)) out.push(`a frozen I-08A4 detail name altered: ${frozen}`);
  }
  const literals = [...code(world.copy).matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`([^`]*)`/gu)].map((m) => m[1] ?? m[2] ?? m[3]);
  // No internal term, no score word, no diagnosis in anything the reader can read.
  const forbidden = /hypothes|PG-0|policy|runtime|evidence role|\bid\b|score|percent|%|probab|diagnos|personality|فرضي|نسبة|تشخيص|شخصيت/iu;
  for (const literal of literals) if (forbidden.test(literal) && !literal.startsWith('../')) out.push(`an internal or scoring term in copy: ${literal}`);
  return out;
}

function numericViolations(world) {
  const all = [world.surface, world.strip, world.entry, world.controller].map(code).join('\n');
  return /toFixed|toPrecision|Intl\.NumberFormat|Math\.round|\$\{[^}]*\}%|numericScore|confidenceBand/u.test(all) ? ['a number is formatted for the reader'] : [];
}

function strictDecodingViolations(world) {
  const out = [];
  if (!/if \(!isRecord\(entry\) \|\| !hasExactly\(entry, SUMMARY_KEYS\)\) return null;/u.test(world.api)) out.push('list items are not decoded with an exact key set');
  if (!/if \(!isRecord\(body\) \|\| !hasExactly\(body, DETAIL_KEYS\)\) return null;/u.test(world.api)) out.push('the detail is not decoded with an exact key set');
  if (!/const CONFIDENCES: readonly string\[\] = Object\.freeze\(\['CLEAR', 'TAKING_SHAPE', 'MIXED', 'NEEDS_MORE'\]\);/u.test(world.api)) out.push('the confidence vocabulary drifted');
  if (/userId|user_id|accessToken|Authorization/u.test(code(world.api))) out.push('the client sends an identity of its own');
  return out;
}

function talkViolations(world) {
  const out = [];
  if (!/transport\.openDiscussion\(view\.ref, view\.revision\)/u.test(world.controller)) out.push('talk is not bound to the exact revision shown');
  if (!/case 'CHANGED':\n\s*\/\/[^\n]*\n\s*update\(\{ talk: 'IDLE' \}\);\n\s*await readDetail\(view\.ref\);/u.test(world.controller)) out.push('a changed item is not re-read before the reader chooses again');
  const all = [world.surface, world.controller, world.strip, world.depth].map(code).join('\n');
  if (/setDraft|submitTurn|\.send\(|controller\.issue/u.test(all)) out.push('talk writes or sends words for the reader');
  if (!/discussion=\{<UnderstandingDiscussionStrip /u.test(world.depth)) out.push('the context line is not carried into the Conversation');
  return out;
}

// R2: the provider consumes the discussion focus only at the EXACT revision the reader chose.
function exactRevisionFocusViolations(world) {
  const out = [];
  if (!/readonly hypothesis_version: number;/u.test(world.signals)) out.push('the focus row has no stored version');
  if (!/select: 'hypothesis_id,hypothesis_version,opened_at'/u.test(world.signals)) out.push('the focus reader does not fetch the stored version');
  if (!/!Number\.isSafeInteger\(focus\.hypothesis_version\) \|\| focus\.hypothesis_version < 1/u.test(world.reasoning)) out.push('a focus without a well-formed version is not refused');
  const match = code(world.reasoning).match(/candidates\.some\(\(\{[^}]*\}\) => ([^)]*)\)\s*\?\s*focus\.hypothesis_id/u);
  if (!match || match[1].trim() !== 'id === focus.hypothesis_id && version === focus.hypothesis_version') out.push('the focus is not bound to the exact id AND version — a stale focus can be rebound');
  if ((code(world.reasoning).match(/userDiscussion: 'OPENED_FROM_UNDERSTANDING'/gu) ?? []).length !== 1 ||
    !/\.\.\.\(candidate\.id === discussedId \? \{ userDiscussion: 'OPENED_FROM_UNDERSTANDING' as const \} : \{\}\)/u.test(world.reasoning)) out.push('the marker is set by anything other than the exact-revision resolver');
  return out;
}

function privacyViolations(world) {
  const all = [world.surface, world.controller, world.strip, world.entry, world.api].map(code).join('\n');
  return /console\.|Logger|logger\.|Sentry|captureMessage|analytics|telemetry/u.test(all) ? ['Understanding content can reach a log or telemetry'] : [];
}

const DETECTORS = { placementViolations, notARouteViolations, copyViolations, numericViolations, strictDecodingViolations, talkViolations, exactRevisionFocusViolations, privacyViolations };

test('the Understanding layer and its transport exist, with one barrel and no route file', () => {
  for (const file of ['copy.ts', 'index.ts', 'understanding-controller.ts', 'UnderstandingEntry.tsx', 'UnderstandingSurface.tsx', 'UnderstandingDiscussionStrip.tsx']) {
    assert.ok(LAYER_FILES.includes(`${LAYER}/${file}`), file);
  }
  assert.deepEqual(readdirSync(new URL(`${MOBILE}/app`, root)).sort(), ['_layout.tsx', 'index.tsx'], 'no new route');
  assert.equal(existsSync(new URL(`${MOBILE}/runtime-entry/understanding-api.ts`, root)), true);
  assert.match(read(`${MOBILE}/runtime-entry/index.ts`), /export \{ UnderstandingApiClient \} from '\.\/understanding-api';/u);
  assert.match(read(`${MOBILE}/integration/runtime/integration-runtime.ts`), /understanding: createUnderstandingController\(\{ transport: entry\.understandingFor\(bundle\), isCurrent \}\),/u);
  assert.match(read(`${MOBILE}/integration/runtime/integration-runtime.ts`), /session\.understanding\.retire\(\);/u);
});

test('the shipped surface is clean under every detector', () => {
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(src), [], name);
});

const PLANTED = [
  ['a second entry in the upper chrome', 'placementViolations', () => plant('conversation', "testID=\"qandeel-depth-to-analysis\"", "testID=\"qandeel-depth-to-analysis\"\n          personalEntry={personalEntry}")],
  ['an entry inside General Settings', 'placementViolations', () => ({ ...src, settings: `${src.settings}\n<UnderstandingEntry />` })],
  ['an entry in the Analysis', 'placementViolations', () => ({ ...src, analysis: `${src.analysis}\nconst x = <UnderstandingEntry />;` })],
  ['reachable from the Analysis', 'placementViolations', () => plant('depth', "understandingShown && depth === 'CONVERSATION' && onSignOut !== undefined ?", 'understandingShown ?')],
  ['a route instead of a depth', 'notARouteViolations', () => plant('surface', "import { AppearanceStatusBar } from '../appearance';", "import { AppearanceStatusBar } from '../appearance';\nimport { useRouter } from 'expo-router';")],
  ['the Personal world rebuilt instead of kept', 'notARouteViolations', () => plant('depth', 'const reachable = current && !settingsShown && !understandingShown;', 'const reachable = current && !settingsShown;')],
  ['an altered confidence word', 'copyViolations', () => plant('copy', "MIXED: 'يوجد تعارض'", "MIXED: 'متناقض'")],
  ['an invented fifth state word', 'copyViolations', () => plant('copy', "NEEDS_MORE: 'Needs more to go on',", "NEEDS_MORE: 'Needs more to go on',\n    UNKNOWN: 'Hypothesis pending',")],
  ['an internal term shown to the reader', 'copyViolations', () => plant('copy', "empty: \"QANDEEL hasn't formed an understanding to show yet.\"", "empty: 'No hypothesis passed PG-01 policy yet.'")],
  ['a percentage shown', 'numericViolations', () => plant('surface', '{confidence}', '{`${Math.round(0.72 * 100)}%`}')],
  ['a loose decoder', 'strictDecodingViolations', () => plant('api', 'if (!isRecord(entry) || !hasExactly(entry, SUMMARY_KEYS)) return null;', 'if (!isRecord(entry)) return null;')],
  ['a client-supplied user id', 'strictDecodingViolations', () => plant('api', 'body: JSON.stringify({ revision })', 'body: JSON.stringify({ revision, userId: "me" })')],
  ['talk against a newer interpretation', 'talkViolations', () => plant('controller', 'transport.openDiscussion(view.ref, view.revision)', 'transport.openDiscussion(view.ref, latestRevision)')],
  ['talk that types for the reader', 'talkViolations', () => plant('depth', 'const talkedAboutItem = useCallback(() => {', 'const talkedAboutItem = useCallback(() => {\n    runtime.conversation.setDraft("I disagree");')],
  ['R2: the focus reader omits the stored version', 'exactRevisionFocusViolations', () => plant('signals', "select: 'hypothesis_id,hypothesis_version,opened_at'", "select: 'hypothesis_id,opened_at'")],
  ['R2: a v3 focus marks the current v4 (id-only match)', 'exactRevisionFocusViolations', () => plant('reasoning', 'id === focus.hypothesis_id && version === focus.hypothesis_version', 'id === focus.hypothesis_id')],
  ['R2: a stale focus silently rebound to a newer version', 'exactRevisionFocusViolations', () => plant('reasoning', 'version === focus.hypothesis_version)', 'version >= focus.hypothesis_version)')],
  ['R2: a missing stored version read as "any version"', 'exactRevisionFocusViolations', () => plant('reasoning', '!Number.isSafeInteger(focus.hypothesis_version) || focus.hypothesis_version < 1 ||', '')],
  ['Understanding text logged', 'privacyViolations', () => plant('controller', "if (outcome.kind === 'READ') update({ list: 'READY', items: outcome.items });", "if (outcome.kind === 'READ') { console.log(outcome.items); update({ list: 'READY', items: outcome.items }); }")],
];

for (const [name, detector, world] of PLANTED) {
  test(`planted defect is rejected: ${name}`, () => {
    assert.notDeepEqual(DETECTORS[detector](world()), [], `${detector} missed: ${name}`);
  });
}

test('the delegated copy is recorded, verbatim, in the implementation record', () => {
  const record = read('docs/e2e/QANDEEL_W3_MEGA_U_UNDERSTANDING_CONTESTED_IMPLEMENTATION_RECORD_v1.md');
  for (const word of ['عنك', 'About you', 'طريقة حديثنا', 'How we talk', 'لم يتكوّن لدى قنديل فهمٌ يعرضه بعد.', "QANDEEL hasn't formed an understanding to show yet.",
    'الحديث مع قنديل عن هذا', 'Talk to QANDEEL about this', 'تعذّر نقل هذا إلى المحادثة.', 'إنهاء الحديث عن هذا']) {
    assert.ok(record.includes(word), `the record does not carry: ${word}`);
  }
  assert.match(record, /TASK-APPROVED DELEGATED COPY/u);
});

test('the contract is registered in package scripts and Mobile CI', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:w3-mega-u2-understanding-surface-contract'], 'node --test tests/w3-mega-u2-understanding-surface-contract.test.mjs');
  const ci = read('.github/workflows/mobile-ci.yml');
  assert.match(ci, /run: npm run test:w3-mega-u2-understanding-surface-contract\}/u);
  assert.match(ci, /'tests\/w3-mega-u2-understanding-surface-contract\.test\.mjs'/u);
});
