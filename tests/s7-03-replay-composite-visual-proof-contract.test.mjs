// S7-03 - static contract for the Historical Replay composite visual proof (apps/mobile/src/replay-composite, the read-only
// client apps/mobile/src/runtime-entry/replay-history-api.ts, and the real-path proof chain behind tests/fixtures/
// s7-03-replay-history). The Jest suites prove behaviour; this contract pins the shape those proofs rely on:
//
//   - the composite renders through the EXISTING Living Analysis components (LivingAnalysisSurface, T-04 MapSurface,
//     T-04's own context derivation, T-06's own commitMoment) and has no map, canvas, Skia, animation or copy of
//     LivingAnalysisMap of its own (Product Owner: «الجرافيك ملك نظام Living Analysis الحالي»);
//   - no Replay state enters the live conversation and nothing live enters the Replay viewpoint: no integration runtime,
//     no projection cache, no ingestion, no Live act, and the viewpoint store has no Map, Temporal or Return authority;
//   - no model and no new analysis at display time; the client only GETs the three S7-01 reads;
//   - the Replay engine is independent of the graphics: the API module and migration 0169 name no composite or Living
//     Analysis code, and the adapter speaks the frozen T-03C `HistoricalDisclosure`;
//   - the frozen authority and privacy files are byte-identical to the branch base (criterion 12);
//   - the gap G-1 bridge stays sound: no T-04 consumer reads `scene.liveHead` or `scene.sealed`;
//   - the S7-03 Product Copy Gate is CLOSED (Product Owner, 2026-10-19): the 14 Arabic rows are APPROVED and pinned
//     word for word, every English row stays PROPOSED, and the S7-02 approved rows are reused, not rewritten;
//   - the proof build is validation-only and the derived gap specimen is labelled; the record stops at the review gate.
// Each detector is shown to catch a planted defect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/gu, '\n');
const readIfPresent = (path) => (existsSync(join(root, path)) ? read(path) : null);
const tsCode = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '').replace(/\{\/\*[\s\S]*?\*\/\}/gu, '');
const files = (dir) => readdirSync(join(root, dir)).flatMap((name) => {
  const path = `${dir}/${name}`;
  return statSync(join(root, path)).isDirectory() ? files(path) : [path];
});
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const COMPOSITE = 'apps/mobile/src/replay-composite';
const CLIENT = 'apps/mobile/src/runtime-entry/replay-history-api.ts';
const RECORD = 'docs/e2e/QANDEEL_S7_03_IMPLEMENTATION_RECORD_v1.md';
const COPY_GATE_CLOSED = 'S7-03 PRODUCT COPY GATE — CLOSED — 2026-10-19';
// The 14 Arabic rows the Product Owner APPROVED on 2026-10-19, exactly as proposed (the two counting templates by their
// source text). Not one character may change without a new decision.
const ARABIC_APPROVED = [
  "'هذه النسخة من إعادة العرض لم تعد الحالية.'",
  "'تغيّرت الرسائل الأصلية بطريقة لا تسمح بعرضها كما كانت.'",
  "'الرسائل الأصلية غير متاحة الآن.'",
  "'التحليل المحفوظ لهذه اللحظات غير مكتمل.'",
  "'الرسائل الأصلية: متاحة.'",
  "'الرسائل الأصلية: غير متاحة الآن.'",
  "'التحليل المحفوظ: محفوظ كما كان.'",
  "'التحليل المحفوظ: غير مكتمل.'",
  "'لا يُعرض التحليل من دون الرسائل التي يخصّها.'",
  "'التحليل كما كان عند هذه اللحظة غير متاح الآن.'",
  "'تعذّر عرض التحليل الآن. هذا لا يعني أنه غير موجود.'",
  "'لا يتوفر تحليل محفوظ لهذه المحادثة، فلا يمكن إعادة عرضها.'",
  'ar: (ordinal: number, count: number) => `في إعادة العرض: ${ordinal} من ${count}.`,',
  'ar: (count: string) => `لم تُعرض هنا ${count} من المحادثة.`,',
];

/** Criterion 12: the frozen authority and privacy files, byte-identical to the branch base 3ad4e414 (LF-normalised). */
const FROZEN = [
  ['apps/mobile/src/living-analysis/LivingAnalysisSurface.tsx', '08687f8e87ff34a9c37ea69260041fc55cc3138ea42c272697763586a72407ab'],
  ['apps/mobile/src/map/renderer/MapSurface.tsx', '5f5d75518909c7df18694ad0d8847d5a3dabe35d7ee7db64b87f92fdeb85cf82'],
  ['apps/mobile/src/map/renderer/WorldViewSurface.tsx', 'f5ccf7583514109bb17b043510e215f922d1bd344a581e7f27244a1d7314cad7'],
  ['apps/mobile/src/map/projection/map-scene.ts', '8ef371bdcbaacde1456e98ed58592ab71c3521fe835a097e5b418fd66e67211e'],
  ['apps/mobile/src/map/inspection/map-actions.ts', 'd2291a0399ab7389b014dc9daed32e59996311c1f01a52e7b1ba573451814957'],
  ['apps/mobile/src/map/inspection/entitlement.ts', '3c916840363d088ebe34cf12d501dc5717d25adfb261c3b493a72e165fb0f243'],
  ['apps/mobile/src/integration/composition/LivingAnalysisMap.tsx', '667fb2c56c78781367a43cc42c1e349319f573ad66dde4f1edc56d97bc54ea64'],
  ['apps/mobile/src/projection/historical-projection-wire.ts', '7bc8f628268b503d6c5f8a80b204138cc3dfe7db9d1b07ec81eae14d0069f451'],
  ['apps/mobile/src/state/store.ts', '3177b9b6a322dc506a5095018b4dd9b14dddacc21bcfd77297decd5dbe62fff3'],
  ['packages/runtime/src/historical-projection.d.ts', '17b9e91511d2cb47938e36dccd94e57dce6ca83d600509584792c33dc3d9b9b1'],
  ['apps/api/src/replay/replay.controller.ts', 'f7fb49fdfbcc2d936b3c4a9dea89bfe24a0466acd861600959312d53452c4a0a'],
  ['apps/api/src/replay/replay.module.ts', '76d7012b0a76cfea0bad39d264e1d011a3b4c0089231538b31f50381a6e0e985'],
  ['apps/api/src/replay/replay.repository.ts', '5921784cd2e14323304ea5b5d37b5f5c201b1f6915950d467f527dcb3f6df874'],
  ['apps/api/src/replay/replay.service.ts', '127f901ebf2001b368542df9c334dd0d4c06c09113239ca5d77f2183b0ea135b'],
  ['apps/api/src/replay/replay.types.ts', 'f8bfb198002bf28e911f00bb2a12d262d95020647a88b1c930313eed161c6af3'],
  ['database/migrations/0169_replay_personal_secure_integration_erasure_v1.sql', '319435d8514b8d4621667d75dbd62efb645ed4beb38e769fcc479066eb52fa2d'],
  ['apps/mobile/src/runtime-entry/replay-api.ts', 'a3db1e39dfd38dc543e5a63b6116a46dce1debf902ce539bb171364badfd59d7'],
  ['apps/mobile/src/replay-entry/copy.ts', '5fbf1adfd4a316a2ecc8296204c143e541d8404ba0ad83a2b20a6def1f2bb46b'],
];

const shipped = () => {
  const composite = files(COMPOSITE).filter((path) => /\.(ts|tsx)$/u.test(path) && !/\/__(tests|fixtures)__\//u.test(path));
  return {
    composite: Object.fromEntries(composite.map((path) => [path.slice(COMPOSITE.length + 1), read(path)])),
    client: read(CLIENT),
    fixture: read(`${COMPOSITE}/__fixtures__/replay-wire.ts`),
    mobile: files('apps/mobile/src').filter((path) => /\.(ts|tsx)$/u.test(path) && !/\/__(tests|fixtures|validation)__\//u.test(path)).map((path) => [path, read(path)]),
    frozen: FROZEN.map(([path]) => [path, read(path)]),
    api: files('apps/api/src/replay').filter((path) => /\.ts$/u.test(path) && !/\.spec\.ts$/u.test(path)).map((path) => [path, read(path)]),
    migration: read('database/migrations/0169_replay_personal_secure_integration_erasure_v1.sql'),
    proofRoot: read('apps/mobile/src/integration/__validation__/S703ProofRoot.tsx'),
    selector: read('apps/mobile/scripts/select-s703-proof-entry.mjs'),
    mobilePkg: read('apps/mobile/package.json'),
    pkg: read('package.json'),
    workflow: read('.github/workflows/api-ci.yml'),
    record: readIfPresent(RECORD),
    state: readIfPresent('QANDEEL_CURRENT_STATE.md'),
    map: readIfPresent('QANDEEL_PROJECT_MAP.md'),
  };
};

const DETECTORS = {
  rendererViolations(w) {
    const out = [];
    const view = tsCode(w.composite['ReplayMomentComposite.tsx'] ?? '');
    if (!/import \{ LivingAnalysisSurface \} from '\.\.\/living-analysis';/u.test(view)) out.push('the screen is the ONE LivingAnalysisSurface');
    if (!/import \{ MapSurface, mapInspectionContext, mapProjectionRequest \} from '\.\.\/map';/u.test(view)) out.push('the world is T-04 MapSurface over T-04 context');
    if (!/<MapSurface store=\{store\} context=\{context\.context\}/u.test(view)) out.push('MapSurface is given the viewpoint store and T-04 context');
    if (!/import \{ commitMoment \} from '\.\.\/temporal-navigation';/u.test(view)) out.push('a moment change is T-06 commitMoment');
    if ((view.match(/timeline=\{null\}/gu) ?? []).length < 1) out.push('no Timeline: the player is S7-04');
    for (const [name, text] of Object.entries(w.composite)) {
      const code = tsCode(text);
      if (/@shopify\/react-native-skia|react-native-reanimated|\bAnimated\b|LayoutAnimation|\bCanvas\b/u.test(code)) out.push(`${name}: no drawing or motion of its own`);
      if (/integration\/composition|LivingAnalysisMap|WorldCanvas|MapCanvas|placeScene|world-chroma|world-visual/u.test(code)) out.push(`${name}: no copy or reach into the Map's graphics`);
      if (/function\s+\w*Map\w*\s*\(|const\s+\w*Map\w*\s*=\s*\(/u.test(code)) out.push(`${name}: no Replay map`);
    }
    return out;
  },

  liveStateViolations(w) {
    const out = [];
    for (const [name, text] of Object.entries(w.composite)) {
      const code = tsCode(text);
      if (/integration\/runtime|IntegrationRuntime|createHistoricalProjectionCache|projection\.ensure|\.ingest\(|LIVE_HEAD_ADVANCED|commitLiveEdge|COMMIT_LIVE_EDGE|conversation-session|ConversationSessionApiClient/u.test(code)) {
        out.push(`${name}: nothing live enters, and no Replay state leaves`);
      }
    }
    const store = tsCode(w.composite['viewpoint-store.ts'] ?? '');
    if (/mapActionAuthority|temporalActionAuthority|returnActionAuthority|MAP_ACTION_AUTHORITY|TEMPORAL_ACTION_AUTHORITY|RETURN_ACTION_AUTHORITY/u.test(store)) out.push('the viewpoint store authorises no promoted act');
    if (!/session: \{ id: replayViewpointKey\(version\) \}/u.test(store)) out.push('the viewpoint is keyed by the Replay version, never the conversation Session');
    if (!/LF: \{ value: \{ kind: 'NONE' \}, atSp: null \}/u.test(store)) out.push('no live Live Focus in the viewpoint');
    if (!/temporal: \{ kind: 'PINNED', at: sessionPosition\(tc\) \}/u.test(store)) out.push('the viewpoint is pinned at a moment');
    return out;
  },

  modelViolations(w) {
    const out = [];
    for (const [name, text] of [...Object.entries(w.composite), ['client', w.client]]) {
      const code = tsCode(text);
      if (/understanding|model-router|ModelRouter|openai|anthropic|provider|UnderstandingApiClient/iu.test(code)) out.push(`${name}: no model at display time`);
    }
    const client = tsCode(w.client);
    if (/method: '(?!GET')/u.test(client)) out.push('the history client only GETs');
    const routes = [...client.matchAll(/this\.read\(\s*`([^`]*)`/gu)].map((m) => m[1].replace(/\$\{[^}]+\}/gu, ':x'));
    const allowed = ['/replay/:x/versions/:x', '/replay/:x/versions/:x/moments', '/replay/:x/versions/:x/moments/:x/analysis?depth=:x'];
    if (routes.length !== allowed.length || routes.some((route) => !allowed.includes(route))) out.push(`only the three S7-01 reads: ${routes.join(', ')}`);
    if (/userId|ownerId|sessionId/u.test(client.replace(/sessionId: replayViewpointKey/gu, ''))) out.push('the client sends no identity and names no Session');
    return out;
  },

  engineViolations(w) {
    const out = [];
    for (const [path, text] of w.api) {
      if (/replay-composite|LivingAnalysis|MapSurface|apps\/mobile/u.test(text)) out.push(`${path}: the Replay engine knows nothing of the graphics`);
    }
    if (/replay-composite|LivingAnalysis|MapSurface/u.test(w.migration)) out.push('migration 0169 knows nothing of the graphics');
    const adapter = tsCode(w.composite['projection-adapter.ts'] ?? '');
    if (!/import type \{ HistoricalDisclosure, HistoricalSemanticDepth \} from '@qandeel\/runtime';/u.test(adapter)) out.push('the adapter speaks the frozen T-03C disclosure');
    if (/\b(?:color|colour|opacity|radius|fontSize|transform|easing|duration)\b|\b[xy]: /u.test(adapter)) out.push('the adapter decides no graphics');
    if (!/moments: \[\], emergingFocuses: analysis\.session\.value\.emergingFocuses, questionAppearances: \[\]/u.test(adapter)) out.push('the narrowed families are carried empty, never fabricated');
    // Gap G-1 guard: the bridge's horizon and seal reach no reader.
    for (const [path, text] of w.mobile) {
      if (path.startsWith(`${COMPOSITE}/`)) continue;
      if (/\bscene\.(?:liveHead|sealed)\b|context\.scene\.(?:liveHead|sealed)\b/u.test(tsCode(text))) out.push(`${path}: a T-04 consumer reads scene.liveHead / scene.sealed (gap G-1)`);
    }
    return out;
  },

  frozenViolations(w) {
    const out = [];
    for (const [path, text] of w.frozen) {
      const expected = FROZEN.find(([candidate]) => candidate === path)?.[1];
      if (sha(text) !== expected) out.push(`${path}: changed (criterion 12)`);
    }
    return out;
  },

  copyViolations(w) {
    const out = [];
    const copy = w.composite['copy.ts'] ?? '';
    if (!copy.includes(COPY_GATE_CLOSED)) out.push('the S7-03 Copy Gate is CLOSED by the Product Owner (2026-10-19)');
    const code = tsCode(copy);
    if (/enStatus: 'APPROVED'/u.test(code)) out.push('no English row is approved: the decision approved Arabic only');
    if (/status: 'PROPOSED'|status: 'LOCKED'/u.test(code.replace(/enStatus: '[A-Z]+'/gu, ''))) out.push('every Arabic row is APPROVED');
    for (const row of ARABIC_APPROVED) if (!copy.includes(row)) out.push(`the approved Arabic row is unchanged: ${row}`);
    const arabicLiterals = [...code.matchAll(/'[^'\n]*[\u0600-\u06FF][^'\n]*'|`[^`\n]*[\u0600-\u06FF][^`\n]*`/gu)].length;
    if (arabicLiterals !== ARABIC_APPROVED.length) out.push(`exactly the 14 approved Arabic rows are written here (found ${arabicLiterals})`);
    for (const [name, text] of Object.entries(w.composite)) {
      if (name === 'copy.ts') continue;
      if (/[؀-ۿ]/u.test(tsCode(text))) out.push(`${name}: every reader-facing word comes from a copy owner`);
    }
    const view = tsCode(w.composite['ReplayMomentComposite.tsx'] ?? '');
    for (const reused of ['replayEntryCopy(language).openHead', 'replayEntryCopy(language).notAvailable', 'replayEntryCopy(language).failed', 'turns.userTurnName(text)', 'turns.replyTurnName(text)',
      'sharedCopy(language).you', 'temporalSentence(language', 'spatialSentence(language']) {
      if (!view.includes(reused)) out.push(`the approved row is reused: ${reused}`);
    }
    return out;
  },

  proofViolations(w) {
    const out = [];
    if (JSON.parse(w.mobilePkg).main !== 'expo-router/entry') out.push('the Product entry stays the Product entry');
    if (!w.selector.includes("process.env.S703_VISUAL_PROOF !== '1'")) out.push('the proof selector refuses without S703_VISUAL_PROOF=1');
    if (!/derivedGap \(DERIVED SPECIMEN — not the real path\)/u.test(w.fixture)) out.push('the derived gap specimen is labelled');
    if (!/DERIVED SPECIMEN/u.test(w.proofRoot)) out.push('the proof build says the derived specimen on screen');
    if (!/require\('\.\/replay-wire\.json'\)/u.test(w.fixture)) out.push('the proof serves the one real-path wire');
    for (const [path, text] of w.mobile) {
      if (/__fixtures__\/replay-wire|S703ProofRoot|s703-proof/u.test(text)) out.push(`${path}: no production module reaches the proof`);
    }
    return out;
  },

  wiringViolations(w) {
    const out = [];
    const pkg = JSON.parse(w.pkg).scripts;
    if (pkg['test:s7-03-replay-composite-visual-proof-contract'] !== 'node --test tests/s7-03-replay-composite-visual-proof-contract.test.mjs') out.push('this contract script');
    if (!w.workflow.includes('run: npm run test:s7-03-replay-composite-visual-proof-contract')) out.push('CI runs this contract');
    return out;
  },

  recordViolations(w) {
    const out = [];
    if (w.record === null) return out;
    if (!w.record.includes('STOP — S7-03 INDEPENDENT VISUAL & TECHNICAL REVIEW GATE')) out.push('the record stops at the review gate');
    for (const evidence of ['AUTOMATED TEST', 'RENDER PROOF ON THE REAL COMPONENTS', 'REVIEWED SCREENSHOT', 'REAL DEVICE TEST']) {
      if (!w.record.includes(evidence)) out.push(`the record names the evidence class ${evidence}`);
    }
    if (!/PR #348/u.test(w.record)) out.push('the record proves S7-02 merged via PR #348');
    if (w.state !== null && !/S7-02[^\n]*MERGED[^\n]*#348|#348[^\n]*S7-02/u.test(w.state)) out.push('Current State proves S7-02 merged via PR #348');
    if (w.map !== null && !/^> \*\*CURRENT IMPLEMENTATION TASK: S7-03 — Historical Replay Composite Visual Proof\*\*/mu.test(w.map)) out.push('the Project Map names S7-03 as current');
    return out;
  },
};

test('S7-03 ships a composite on the existing Living Analysis components, with no Replay map, no live state, no model, and its gates in place', () => {
  const w = shipped();
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(w), [], name);
});

const edit = (key, file, from, to) => () => {
  const w = shipped();
  if (file === '') {
    assert.ok(w[key].includes(from), `planted text not found in ${key}: ${from}`);
    return { ...w, [key]: w[key].replace(from, to) };
  }
  assert.ok(w[key][file].includes(from), `planted text not found in ${key}/${file}: ${from}`);
  return { ...w, [key]: { ...w[key], [file]: w[key][file].replace(from, to) } };
};
const editList = (key, path, from, to) => () => {
  const w = shipped();
  const entry = w[key].find(([candidate]) => candidate === path);
  assert.ok(entry && entry[1].includes(from), `planted text not found in ${path}`);
  return { ...w, [key]: w[key].map(([candidate, text]) => [candidate, candidate === path ? text.replace(from, to) : text]) };
};
const add = (key, path, text) => () => {
  const w = shipped();
  return Array.isArray(w[key]) ? { ...w, [key]: [...w[key], [path, text]] } : { ...w, [key]: { ...w[key], [path]: text } };
};

const PLANTED = [
  ['a Replay map of its own', 'rendererViolations', add('composite', 'ReplayMap.tsx', 'export function ReplayMap() { return null; }')],
  ['a Skia canvas in the composite', 'rendererViolations', add('composite', 'Glow.tsx', "import { Canvas } from '@shopify/react-native-skia';")],
  ['a copy of LivingAnalysisMap', 'rendererViolations', add('composite', 'Copied.tsx', "import { LivingAnalysisMap } from '../integration/composition/LivingAnalysisMap';")],
  ['an animation of its own', 'rendererViolations', add('composite', 'Fade.tsx', "import Animated from 'react-native-reanimated';")],
  ['MapSurface replaced', 'rendererViolations', edit('composite', 'ReplayMomentComposite.tsx', '<MapSurface store={store} context={context.context}', '<View store={store} context={context.context}')],
  ['the live runtime in the composite', 'liveStateViolations', add('composite', 'live.ts', "import type { IntegrationRuntime } from '../integration/runtime/integration-runtime';")],
  ['an authorised Map act on the viewpoint', 'liveStateViolations', edit('composite', 'viewpoint-store.ts', '    camera: initialCameraIntent(WORLD_ORIGIN, undefined, depth),\n  });', '    camera: initialCameraIntent(WORLD_ORIGIN, undefined, depth),\n  }, { mapActionAuthority: MAP_ACTION_AUTHORITY });')],
  ['the conversation Session as the viewpoint', 'liveStateViolations', edit('composite', 'viewpoint-store.ts', 'session: { id: replayViewpointKey(version) }', 'session: { id: sessionId }')],
  ['a model at display time', 'modelViolations', add('composite', 'explain.ts', "import { UnderstandingApiClient } from '../runtime-entry';")],
  ['a command route in the history client', 'modelViolations', edit('client', '', 'async moments(replayId: string, versionId: string): Promise<ReplayMomentsResult> {', 'async preview(replayId: string) { return this.read(`/replay/${replayId}/preview`); }\n\n  async moments(replayId: string, versionId: string): Promise<ReplayMomentsResult> {')],
  ['a POST in the history client', 'modelViolations', edit('client', '', "{ method: 'GET',", "{ method: 'POST',")],
  ['graphics in the Replay engine', 'engineViolations', editList('api', 'apps/api/src/replay/replay.service.ts', "import { ReplayRepository", "// replay-composite\nimport { ReplayRepository")],
  ['a colour decided by the adapter', 'engineViolations', edit('composite', 'projection-adapter.ts', 'inspection: null,', "inspection: null, color: '#fff',")],
  ['a fabricated Session Moment', 'engineViolations', edit('composite', 'projection-adapter.ts', 'moments: [], emergingFocuses', 'moments: [{ id: moment.ordinal }], emergingFocuses')],
  ['a T-04 consumer reading the bridged horizon', 'engineViolations', add('mobile', 'apps/mobile/src/map/renderer/Horizon.ts', 'export const h = (context) => context.scene.liveHead;')],
  ['a frozen file changed', 'frozenViolations', editList('frozen', 'apps/mobile/src/map/renderer/MapSurface.tsx', "export const MAP_SURFACE_TEST_ID = 'qandeel-map-surface';", "export const MAP_SURFACE_TEST_ID = 'qandeel-replay-map';")],
  ['an S7-02 approved row reworded', 'frozenViolations', editList('frozen', 'apps/mobile/src/replay-entry/copy.ts', "ar: 'هذا غير متاح الآن.'", "ar: 'غير متاح.'")],
  ['a reopened S7-03 Copy Gate', 'copyViolations', edit('composite', 'copy.ts', COPY_GATE_CLOSED, 'S7-03 PRODUCT COPY GATE — OPEN')],
  ['an approved Arabic row reworded', 'copyViolations', edit('composite', 'copy.ts', "'الرسائل الأصلية: متاحة.'", "'الرسائل الأصلية متاحة.'")],
  ['an approved counting rule changed', 'copyViolations', edit('composite', 'copy.ts', '`لم تُعرض هنا ${count} من المحادثة.`', '`لم يُعرض هنا ${count} من المحادثة.`')],
  ['an English row approved with the Arabic', 'copyViolations', edit('composite', 'copy.ts', "status: 'APPROVED', enStatus: 'PROPOSED'", "status: 'APPROVED', enStatus: 'APPROVED'")],
  ['an Arabic row left PROPOSED', 'copyViolations', edit('composite', 'copy.ts', "  status: 'APPROVED' as ReplayCompositeCopyStatus,", "  status: 'PROPOSED' as ReplayCompositeCopyStatus,")],
  ['Arabic written in the view', 'copyViolations', edit('composite', 'ReplayMomentComposite.tsx', "const speaker = moment.sourceRole === 'USER' ? sharedCopy(language).you : turns.product;", "const speaker = moment.sourceRole === 'USER' ? 'أنت' : turns.product;")],
  ['the Product entry replaced', 'proofViolations', edit('mobilePkg', '', '"main": "expo-router/entry"', '"main": "src/integration/__validation__/s703-proof-entry.tsx"')],
  ['an unlabelled derived specimen', 'proofViolations', edit('fixture', '', 'derivedGap (DERIVED SPECIMEN — not the real path)', 'derivedGap')],
  ['a production module reaching the proof', 'proofViolations', add('mobile', 'apps/mobile/src/replay-composite/x.ts', "import { replayScene } from './__fixtures__/replay-wire';")],
  ['this contract left out of CI', 'wiringViolations', edit('workflow', '', 'run: npm run test:s7-03-replay-composite-visual-proof-contract', 'run: true')],
  ['a missing review gate', 'recordViolations', () => ({ ...shipped(), record: (shipped().record ?? 'STOP — S7-03 INDEPENDENT VISUAL & TECHNICAL REVIEW GATE').replace('STOP — S7-03 INDEPENDENT VISUAL & TECHNICAL REVIEW GATE', 'merged') })],
];

for (const [name, detector, plant] of PLANTED) {
  test(`the ${detector} detector catches ${name}`, () => {
    assert.notDeepEqual(DETECTORS[detector](plant()), [], name);
  });
}
