// S7-02 - static contract for the Personal Replay entry and conversation selection (apps/mobile/src/replay-entry, the
// S7-02 client apps/mobile/src/runtime-entry/replay-api.ts and the Conversation surface's composition seams).
//
// The behaviour is proven by the mobile suites (replay-anchors, replay-entry-controller, replay-entry-surface,
// replay-api and integration/s7-02-replay-entry). This contract pins the shape those proofs rely on, so a later edit
// cannot quietly widen it:
//   - the entry and its selection draw and hold no Analysis, map, graphic or motion state, and the existing Living
//     Analysis and map components are reused, never copied or replaced;
//   - the Conversation layer holds no Replay state: it offers presentation seams only (chromeEnd, overlay, selection);
//   - Session Positions come from the committed-unit events alone: no list index, no message count, no arithmetic
//     over exchanges;
//   - the client uses the S7-01 API as it is: only the entry's routes, the identity from the token alone, one command id
//     per attempt re-used on retry, a revision that names expectedDraftRevision;
//   - the entry exists only in the Personal world, behind the capability hint, and is retired with the generation;
//   - the S7-02 Product Copy Gate is OPEN and every PROPOSED row is listed in the record;
//   - the record, the locators and the CI wiring exist.
// Each detector is shown to catch a planted defect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/gu, '\n');
// The root locators are not part of every tree this contract runs in (the forward-safety mirror omits them).
const readIfPresent = (path) => (existsSync(join(root, path)) ? read(path) : null);
const tsCode = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`])\/\/[^\n]*/gu, '$1');
const files = (dir) => readdirSync(join(root, dir)).flatMap((name) => {
  const path = `${dir}/${name}`;
  return statSync(join(root, path)).isDirectory() ? files(path) : [path];
});

const ENTRY = 'apps/mobile/src/replay-entry';
const CLIENT = 'apps/mobile/src/runtime-entry/replay-api.ts';
const SURFACE = 'apps/mobile/src/conversation/ConversationSurface.tsx';
const RECORD = 'docs/e2e/QANDEEL_S7_02_IMPLEMENTATION_RECORD_v1.md';
const REUSED = {
  LivingAnalysisSurface: 'apps/mobile/src/living-analysis/LivingAnalysisSurface.tsx',
  MapSurface: 'apps/mobile/src/map/renderer/MapSurface.tsx',
  LivingAnalysisMap: 'apps/mobile/src/integration/composition/LivingAnalysisMap.tsx',
  AnalysisReturnBar: 'apps/mobile/src/conversation/AnalysisReturnBar.tsx',
};

const shipped = () => ({
  entry: files(ENTRY).filter((path) => /\.(ts|tsx)$/u.test(path) && !/__(tests|fixtures)__/u.test(path)).map((path) => [path, read(path)]),
  client: read(CLIENT),
  surface: read(SURFACE),
  conversationLayer: files('apps/mobile/src/conversation').filter((path) => /\.(ts|tsx)$/u.test(path) && !/__(tests|fixtures)__|canonical-visual\.generated/u.test(path)).map((path) => [path, read(path)]),
  mobile: files('apps/mobile/src').filter((path) => /\.(ts|tsx)$/u.test(path) && !/__(tests|fixtures)__/u.test(path)).map((path) => [path, read(path)]),
  runtime: read('apps/mobile/src/integration/runtime/integration-runtime.ts'),
  entryFactory: read('apps/mobile/src/runtime-entry/mobile-runtime-entry.ts'),
  depth: read('apps/mobile/src/integration/composition/DepthComposition.tsx'),
  copy: read(`${ENTRY}/copy.ts`),
  record: read(RECORD),
  state: readIfPresent('QANDEEL_CURRENT_STATE.md'),
  map: readIfPresent('QANDEEL_PROJECT_MAP.md'),
  pkg: read('package.json'),
  workflow: read('.github/workflows/api-ci.yml'),
});

const DETECTORS = {
  graphicsViolations(w) {
    const out = [];
    for (const [path, text] of w.entry) {
      const imports = [...tsCode(text).matchAll(/from '([^']+)'/gu)].map((m) => m[1]);
      for (const source of imports) {
        if (/living-analysis|\/map\b|\/map\/|projection|temporal-navigation|motion|reanimated|skia|LivingAnalysis/iu.test(source)) out.push(`${path} imports ${source}`);
      }
      if (/LivingAnalysis|MapSurface|useReduceMotion|Animated\b|withTiming/u.test(tsCode(text))) out.push(`${path} reaches Analysis, map or motion code`);
    }
    // Reused, never copied or replaced: each component is declared once, in its own file, and the Analysis depth still
    // renders the one Living Analysis map.
    for (const [name, path] of Object.entries(REUSED)) {
      const declared = w.mobile.filter(([, text]) => new RegExp(`export function ${name}\\b`, 'u').test(text)).map(([p]) => p);
      if (declared.length !== 1 || declared[0] !== path) out.push(`${name} is declared exactly once, in ${path}`);
    }
    if ((tsCode(w.depth).match(/<LivingAnalysisMap\b/gu) ?? []).length !== 1) out.push('the Analysis depth renders the one Living Analysis map');
    return out;
  },

  conversationLayerViolations(w) {
    const out = [];
    for (const [path, text] of w.conversationLayer) {
      if (/replay/iu.test(tsCode(text))) out.push(`${path}: the Conversation layer holds no Replay code`);
    }
    const surface = tsCode(w.surface);
    for (const seam of ['readonly chromeEnd?: ReactElement | null;', 'readonly overlay?: ReactElement | null;', 'readonly selection?: ConversationSelection | null;']) {
      if (!surface.includes(seam)) out.push(`the surface offers the seam: ${seam}`);
    }
    // While a selection mode is on, the composer is not drawn, and its words are never written by the mode.
    if (!/\{selection !== null \? null : \(\n\s*<View\n\s*testID="qandeel-conversation-composer"/u.test(surface)) out.push('the selection bar stands where the composer is');
    if (/selection[^\n]*setDraft|setDraft[^\n]*selection/u.test(surface)) out.push('the selection never writes the composer');
    return out;
  },

  positionViolations(w) {
    const out = [];
    const anchors = tsCode(w.entry.find(([path]) => path.endsWith('replay-anchors.ts'))?.[1] ?? '');
    const controller = tsCode(w.entry.find(([path]) => path.endsWith('replay-entry-controller.ts'))?.[1] ?? '');
    if (!/event\.firstSp !== expected/u.test(anchors)) out.push('positions are proven dense from the events');
    if (!/expected - 1 !== liveHead/u.test(anchors)) out.push('the events must reach the Live Head the server reports');
    if (!/lower\(event\.sessionId\) !== lower\(sessionId\)/u.test(anchors)) out.push('every event must be this Session’s');
    if (!/firstTc: 1, lastTc: proof\.liveHead, messageCount: proof\.order\.length/u.test(anchors)) out.push('the whole conversation is 1 .. Live Head, counted from the proof');
    for (const [path, text] of w.entry) {
      const code = tsCode(text);
      if (/exchanges\.length\s*\*|index\s*\*\s*2|\*\s*2\s*\+|messageCount\s*\*/u.test(code)) out.push(`${path}: no position arithmetic over exchanges`);
      if (/firstTc:\s*(?:index|i|from|at)\b|lastTc:\s*(?:index|i|to|at)\b/u.test(code)) out.push(`${path}: a list index is never a Session Position`);
    }
    if (!/committedEvents\(sessionId, cursor\)/u.test(controller)) out.push('the proof reads the committed-unit events');
    return out;
  },

  clientViolations(w) {
    const out = [];
    const code = tsCode(w.client);
    const routes = [...code.matchAll(/(?:read|command)\(\s*[`'](\/replay[^`']*)[`']/gu)].map((m) => m[1].replace(/\$\{[^}]+\}/gu, ':id'));
    const allowed = ['/replay/capability', '/replay/conversations/:id', '/replay/:id', '/replay/drafts', '/replay/:id/revisions'];
    if (routes.sort().join('|') !== [...allowed].sort().join('|')) out.push(`the client calls exactly the entry's routes (got ${routes.join(', ')})`);
    const bodies = [...code.matchAll(/\{ (commandId[^}]*) \}/gu)].map((m) => m[1].split(',').map((part) => part.trim().split(':')[0].trim()));
    const keys = new Set(bodies.flat());
    for (const key of keys) {
      if (!['commandId', 'sessionId', 'expectedDraftRevision', 'firstTc', 'lastTc'].includes(key)) out.push(`a request body carries ${key}`);
    }
    if (!keys.has('expectedDraftRevision')) out.push('a revision names expectedDraftRevision');
    if (/userId|ownerId|user_id|owner_id|unitId|unit_id|sourceClass|source_class|Authorization/u.test(code)) out.push('the client sends no identity of its own');
    if (!/if \(exchange\.kind === 'NETWORK' \|\| exchange\.status >= 500\) return \{ kind: 'OUTCOME_UNKNOWN' \};/u.test(code)) out.push('an unreadable command answer is OUTCOME_UNKNOWN, never a guess');
    return out;
  },

  commandViolations(w) {
    const out = [];
    const controller = tsCode(w.entry.find(([path]) => path.endsWith('replay-entry-controller.ts'))?.[1] ?? '');
    const minted = controller.match(/newId\(\)/gu) ?? [];
    if (minted.length !== 1 || !/save\(\) \{[\s\S]*?issue\(\{ id: newId\(\)/u.test(controller)) out.push('a command id is minted only when Save is pressed');
    if (!/retry\(\) \{[\s\S]*?issue\(selection\.command\);/u.test(controller)) out.push('Try again re-issues the same command');
    if (!/if \(unresolved !== null\) \{\s*const attempt = unresolved;\s*enter\(attempt\.scope, attempt\.target/u.test(controller)) out.push('an unresolved attempt is resumed, never replaced');
    if (!/selection\.range === null \|\| unresolved !== null\) return;/u.test(controller)) out.push('no range that is not proven, and no second attempt while one is unresolved');
    return out;
  },

  wiringViolations(w) {
    const out = [];
    const runtime = tsCode(w.runtime);
    if (!/replayEntry: createReplayEntryController\(\{ sessionId: bundle\.sessionId, transport: entry\.replayFor\(bundle\), conversation, isCurrent \}\)/u.test(runtime)) out.push('one entry per generation, on THIS Session and THIS identity');
    if (!/session\.replayEntry\.retire\(\);/u.test(runtime)) out.push('the entry is retired with the generation');
    if (!/replayFor\(bundle\) \{\n\s*const authorized = authorizedFetchFor\(bundle\.authGeneration\);/u.test(tsCode(w.entryFactory))) out.push('the client is on the AC-01 seam of the bundle’s own auth generation');
    const depth = tsCode(w.depth);
    for (const prop of ['chromeEnd', 'overlay', 'selection']) {
      if (!new RegExp(`${prop}=\\{onSignOut === undefined \\? null : `, 'u').test(depth)) out.push(`${prop} is handed only in the Personal product world`);
    }
    if (/SharedWorldArea[^\n]*replay|PublicWorldArea[^\n]*replay/iu.test(depth)) out.push('the entry is not in the Shared or Public areas');
    const pkg = JSON.parse(w.pkg).scripts;
    if (pkg['test:s7-02-replay-entry-selection-contract'] !== 'node --test tests/s7-02-replay-entry-selection-contract.test.mjs') out.push('this contract script');
    if (!w.workflow.includes('run: npm run test:s7-02-replay-entry-selection-contract}')) out.push('CI runs this contract');
    return out;
  },

  copyViolations(w) {
    const out = [];
    if (!w.copy.includes("status: 'S7-02 PRODUCT COPY GATE — OPEN — PROPOSED rows await the Product Owner'")) out.push('the S7-02 Product Copy Gate is OPEN');
    const rows = [...w.copy.matchAll(/^ {2}(\w+): \{ ar: '([^']*)', en: (?:'([^']*)'|"([^"]*)"), status: '(\w+)'/gmu)];
    const multi = [...w.copy.matchAll(/^ {2}(\w+): \{\n\s*ar: '([^']*)',[\s\S]*?status: '(\w+)'/gmu)];
    const proposed = [...rows.filter((m) => m[5] === 'PROPOSED').map((m) => m[2]), ...multi.filter((m) => m[3] === 'PROPOSED').map((m) => m[2])];
    if (proposed.length < 10) out.push('the copy rows are readable');
    for (const ar of proposed) if (!w.record.includes(ar)) out.push(`the record lists the PROPOSED row «${ar}»`);
    for (const word of ['تشغيل', 'معاينة', 'Play', 'Preview']) if (w.copy.includes(word)) out.push(`no player word ships in S7-02: ${word}`);
    return out;
  },

  recordViolations(w) {
    const out = [];
    for (const text of ['STOP: S7-02 — INDEPENDENT REVIEW GATE', 'S7-03 HANDOVER', 'MOMENT_NOT_SEALED', 'c152cb4b', 'QAN-BL-PROD-09', 'CW2-08', 'BG-08', 'BG-09']) {
      if (!w.record.includes(text)) out.push(`the record carries ${text}`);
    }
    if (!/\*\*Task:\*\* S7-02/u.test(w.record)) out.push('the record carries its lifecycle banner');
    for (const [name, text] of [['QANDEEL_CURRENT_STATE.md', w.state], ['QANDEEL_PROJECT_MAP.md', w.map]]) {
      if (text === null) continue;
      if (!text.includes(RECORD)) out.push(`${name} points to the S7-02 record`);
      if (!/S7-01[^\n]*MERGED[^\n]*#347|#347[^\n]*S7-01[^\n]*MERGED|S7-01[^\n]*#347[^\n]*c152cb4b/u.test(text)) out.push(`${name} records S7-01 merged via #347`);
    }
    return out;
  },
};

test('the shipped S7-02 change satisfies every detector', () => {
  const w = shipped();
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(w), [], name);
});

const edit = (key, path, from, to) => () => {
  const w = shipped();
  if (key === 'entry') return { ...w, entry: w.entry.map(([p, t]) => [p, p.endsWith(path) ? t.replace(from, to) : t]) };
  const next = w[key].replace(from, to);
  if (next === w[key]) throw new Error(`plant did not apply: ${from}`);
  return { ...w, [key]: next };
};

const PLANTED = [
  ['a Living Analysis import in the entry', 'graphicsViolations', () => {
    const w = shipped();
    return { ...w, entry: [...w.entry, [`${ENTRY}/Preview.tsx`, "import { LivingAnalysisSurface } from '../living-analysis';"]] };
  }],
  ['a copied map surface', 'graphicsViolations', () => {
    const w = shipped();
    return { ...w, mobile: [...w.mobile, [`${ENTRY}/ReplayMap.tsx`, 'export function MapSurface() { return null; }']] };
  }],
  ['Replay state in the Conversation layer', 'conversationLayerViolations', () => {
    const w = shipped();
    return { ...w, conversationLayer: [...w.conversationLayer, ['apps/mobile/src/conversation/x.ts', 'const replayRange = 1;']] };
  }],
  ['a position from a list index', 'positionViolations', () => {
    const w = shipped();
    return { ...w, entry: [...w.entry, [`${ENTRY}/x.ts`, 'const range = { firstTc: index, lastTc: index + 1 };']] };
  }],
  ['two positions per exchange', 'positionViolations', () => {
    const w = shipped();
    return { ...w, entry: [...w.entry, [`${ENTRY}/x.ts`, 'const lastTc = exchanges.length * 2;']] };
  }],
  ['a player route in the client', 'clientViolations', edit('client', '', "return this.command('/replay/drafts',", "void this.read(`/replay/${id}/preview`); return this.command('/replay/drafts',")],
  ['an identity in a request body', 'clientViolations', edit('client', '', '{ commandId, sessionId, firstTc: range.firstTc, lastTc: range.lastTc }', '{ commandId, sessionId, userId, firstTc: range.firstTc, lastTc: range.lastTc }')],
  ['a new command id on retry', 'commandViolations', edit('entry', 'replay-entry-controller.ts', 'issue(selection.command);', 'issue({ ...selection.command, id: newId() });')],
  ['an entry outside the generation', 'wiringViolations', edit('runtime', '', 'session.replayEntry.retire();', '')],
  ['an entry in every world', 'wiringViolations', edit('depth', '', 'chromeEnd={onSignOut === undefined ? null : ', 'chromeEnd={')],
  ['a PROPOSED row approved silently', 'copyViolations', edit('copy', '', "status: 'S7-02 PRODUCT COPY GATE — OPEN — PROPOSED rows await the Product Owner'", "status: 'S7-02 PRODUCT COPY GATE — CLOSED'")],
  ['a missing review gate', 'recordViolations', edit('record', '', 'STOP: S7-02 — INDEPENDENT REVIEW GATE', 'merged')],
];

for (const [name, detector, plant] of PLANTED) {
  test(`the ${detector} detector catches ${name}`, () => {
    assert.notDeepEqual(DETECTORS[detector](plant()), [], name);
  });
}
