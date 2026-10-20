// S7-05 — Replay Final Integration, Device Proof & Stage Closure: the static contract.
//
// What S7-05 changes, and what it must leave alone (the Product Owner's CP0 decisions, 2026-10-20):
//   - D1, F-2 Option B: `ReplayService` verifies a Reading's scope against its one canonical form
//     (`CONVERSATION_SESSION:<lowercase uuid>`) and sends its class alone; anything else refuses the moment's analysis
//     whole and is never repaired. The Replay Reading's type says the same. No Session id reaches either captured wire,
//     and the mobile decoder accepts the class and nothing else;
//   - no consumer of the Replay wire (the composite, the player, the Map, the Living Analysis surface) reads a Reading's
//     scope, so none can take the class for the full scope;
//   - migration 0169 and the frozen historical projection (`packages/runtime`, T-03C's wire) are byte-identical: the
//     narrowing is the Replay wire's alone, not a new meaning of scope;
//   - D2: the English of the 27 S7-02 / S7-03 rows is APPROVED and no English row of either file is PROPOSED;
//   - D5: the four focused proofs stay in their existing suites, none skipped — the account switch after a sign-out and
//     NOT_VIEWABLE through the real path (the production composition over the captured real-path wire), the revise retry
//     with the same command id (the entry owner; the server's answer is 0169 verifier E10), and an existing Replay read
//     after the Creation Capability Gate closes (0169 verifier E15, real PostgreSQL);
//   - the record carries the decisions and its lifecycle, and the locators name it; this contract runs in CI.
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
const tsCode = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const files = (dir) => readdirSync(join(root, dir)).flatMap((name) => {
  const path = `${dir}/${name}`;
  return statSync(join(root, path)).isDirectory() ? files(path) : [path];
});
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const SERVICE = 'apps/api/src/replay/replay.service.ts';
const TYPES = 'apps/api/src/replay/replay.types.ts';
const CLIENT = 'apps/mobile/src/runtime-entry/replay-history-api.ts';
const WIRES = ['apps/mobile/src/replay-composite/__fixtures__/replay-wire.json', 'apps/mobile/src/replay-player/__fixtures__/replay-player-wire.json'];
const ENTRY_COPY = 'apps/mobile/src/replay-entry/copy.ts';
const COMPOSITE_COPY = 'apps/mobile/src/replay-composite/copy.ts';
const RECORD = 'docs/e2e/QANDEEL_S7_05_IMPLEMENTATION_RECORD_v1.md';
const D5_SUITES = {
  composition: 'apps/mobile/src/integration/__tests__/s7-04-replay-player.test.tsx',
  entry: 'apps/mobile/src/replay-entry/__tests__/replay-entry-controller.test.ts',
  verifier: 'database/verify-migration-0169.mjs',
};
const D5_PROOFS = [
  ['composition', "describe('S7-05 D5 — an account switch after a sign-out shows nothing of the previous account'"],
  ['composition', 'h.auth.signInWith({ ok: true, value: USER_2 });'],
  ['composition', "describe('S7-05 D5 — NOT_VIEWABLE through the real path, in the production composition'"],
  ['composition', 'server.withdrawSource();'],
  ['entry', "it('S7-05 D5 — an unconfirmed revision is retried with the SAME command id, Replay, expected revision and range'"],
  ['verifier', "assert.deepEqual(await rt.revise(A, reviseCmd, created.replay_id, 1, 3, 6), revised, 'E10 revise retried');"],
  ['verifier', "await report.isolated('E15 the gate closes after a Replay exists: its version, moments, analysis and list answer unchanged; every act is refused'"],
];
const CONSUMERS = ['apps/mobile/src/replay-composite', 'apps/mobile/src/replay-player', 'apps/mobile/src/map', 'apps/mobile/src/living-analysis'];
/** Byte-identical to the base `f9bc3947` (LF-normalised): the narrowing changes neither the migration nor the frozen wire. */
const UNCHANGED = [
  ['database/migrations/0169_replay_personal_secure_integration_erasure_v1.sql', '319435d8514b8d4621667d75dbd62efb645ed4beb38e769fcc479066eb52fa2d'],
  ['packages/runtime/src/historical-projection.d.ts', '17b9e91511d2cb47938e36dccd94e57dce6ca83d600509584792c33dc3d9b9b1'],
  ['apps/mobile/src/projection/historical-projection-wire.ts', '7bc8f628268b503d6c5f8a80b204138cc3dfe7db9d1b07ec81eae14d0069f451'],
];

const CANONICAL = "const CANONICAL_READING_SCOPE = /^CONVERSATION_SESSION:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;";
const CLASS = "const REPLAY_READING_SCOPE_CLASS = 'CONVERSATION_SESSION';";
const VERIFY = 'if (!CANONICAL_READING_SCOPE.test(reading.scope)) return unavailable();';
const NARROW = 'return { ...reading, scope: REPLAY_READING_SCOPE_CLASS };';
const MAPPED = 'readings: rungs.analyticalObject.value.readings.map(readingOf)';
const TYPED = "export type ReplayReading = Omit<DisclosedReading, 'scope'> & { readonly scope: 'CONVERSATION_SESSION' };";
const DECODED = "const READING_SCOPE_CLASSES = ['CONVERSATION_SESSION'] as const;";
const DECODE = 'scope: vocabulary(reading.scope, `${path}.scope`, READING_SCOPE_CLASSES),';

const shipped = () => ({
  service: read(SERVICE),
  types: read(TYPES),
  client: read(CLIENT),
  wires: WIRES.map((path) => [path, read(path)]),
  consumers: CONSUMERS.flatMap((dir) => files(dir)).filter((path) => /\.(ts|tsx)$/u.test(path) && !/\/__(tests|fixtures)__\//u.test(path)).map((path) => [path, read(path)]),
  unchanged: UNCHANGED.map(([path]) => [path, read(path)]),
  entryCopy: read(ENTRY_COPY),
  compositeCopy: read(COMPOSITE_COPY),
  record: readIfPresent(RECORD) ?? '',
  state: readIfPresent('QANDEEL_CURRENT_STATE.md'),
  map: readIfPresent('QANDEEL_PROJECT_MAP.md'),
  roadmap: readIfPresent('QANDEEL_PRODUCT_ROADMAP.md'),
  pkg: read('package.json'),
  mobilePkg: read('apps/mobile/package.json'),
  selector: read('apps/mobile/scripts/select-s705-proof-entry.mjs'),
  proofWorld: read('apps/mobile/src/integration/__validation__/s705-proof-world.ts'),
  proofRoot: read('apps/mobile/src/integration/__validation__/S705ProofRoot.tsx'),
  mobile: files('apps/mobile/src').filter((path) => /\.(ts|tsx)$/u.test(path) && !/\/__(tests|fixtures|validation)__\//u.test(path)).map((path) => [path, read(path)]),
  workflow: read('.github/workflows/api-ci.yml'),
  d5: Object.fromEntries(Object.entries(D5_SUITES).map(([key, path]) => [key, read(path)])),
});

const DETECTORS = {
  apiViolations(w) {
    const out = [];
    const code = tsCode(w.service);
    for (const [line, why] of [[CANONICAL, 'the one canonical scope form'], [CLASS, 'its class'], [VERIFY, 'the exact form verified, anything else refused whole'],
      [NARROW, 'the class alone leaves'], [MAPPED, 'every disclosed Reading goes through the narrowing']]) {
      if (!code.includes(line)) out.push(`${SERVICE}: ${why}`);
    }
    if (/\.replace\([^)]*scope|scope\.(trim|toLowerCase|split|slice)\(/u.test(code)) out.push(`${SERVICE}: a scope is never repaired`);
    if (!tsCode(w.types).includes(TYPED)) out.push(`${TYPES}: the Replay Reading's scope is typed as its class alone`);
    return out;
  },

  wireViolations(w) {
    const out = [];
    for (const [path, text] of w.wires) {
      if (text.includes('CONVERSATION_SESSION:')) out.push(`${path}: no Session id crosses the wire`);
      const scopes = [...text.matchAll(/"scope":\s*"([^"]*)"/gu)].map(([, scope]) => scope);
      if (scopes.length === 0) out.push(`${path}: the captured wire carries its Readings`);
      for (const scope of new Set(scopes)) if (scope !== 'CONVERSATION_SESSION') out.push(`${path}: a Reading's scope is its class (${scope})`);
    }
    return out;
  },

  clientViolations(w) {
    const out = [];
    const code = tsCode(w.client);
    if (!code.includes(DECODED) || !code.includes(DECODE)) out.push(`${CLIENT}: a Reading's scope is decoded as exactly its class`);
    for (const [path, text] of w.consumers) {
      if (/\breadings?\b[^;\n]*\.scope\b|\breading\.scope\b|\bscope\s*[:=]\s*reading/u.test(tsCode(text))) out.push(`${path}: no consumer reads a Reading's scope`);
    }
    return out;
  },

  unchangedViolations(w) {
    const out = [];
    for (const [path, text] of w.unchanged) {
      if (sha(text) !== UNCHANGED.find(([candidate]) => candidate === path)?.[1]) out.push(`${path}: unchanged by S7-05`);
    }
    return out;
  },

  copyViolations(w) {
    const out = [];
    // S7-02: 16 rows and the count, each with its own enStatus. S7-03: the one row helper, position and gap.
    for (const [path, text, count] of [[ENTRY_COPY, w.entryCopy, 17], [COMPOSITE_COPY, w.compositeCopy, 3]]) {
      const code = tsCode(text);
      if (/enStatus: 'PROPOSED'/u.test(code)) out.push(`${path}: no English row is PROPOSED (D2)`);
      if (!code.includes("englishApproval: 'S7-05 ENGLISH COPY APPROVAL — 2026-10-20, Product Owner decision D2")) out.push(`${path}: the S7-05 English approval is recorded`);
      const approved = (code.match(/enStatus: 'APPROVED'/gu) ?? []).length;
      if (approved !== count) out.push(`${path}: every English row is APPROVED (${approved} of ${count})`);
    }
    const composite = tsCode(w.compositeCopy);
    if ((composite.match(/: approved\(/gu) ?? []).length !== 12) out.push(`${COMPOSITE_COPY}: all 12 rows go through the approved row helper`);
    if (!/englishProposed: \[\] as string\[\]/u.test(composite)) out.push(`${COMPOSITE_COPY}: nothing is left PROPOSED`);
    return out;
  },

  recordViolations(w) {
    const out = [];
    if (w.record === '') return [`${RECORD} exists`];
    if (!/^\*\*Status:\*\* /mu.test(w.record)) out.push('the record states its lifecycle');
    for (const decision of ['D1', 'D2', 'D3', 'D4', 'D5']) if (!w.record.includes(decision)) out.push(`the record carries decision ${decision}`);
    if (!w.record.includes('f9bc3947d840646385c618ea8db400914ca5aac4')) out.push('the record names its base');
    if (/\bMERGED\b(?! \/)/u.test(w.record.split('\n').find((line) => line.startsWith('**Status:**')) ?? '')) out.push('the record never claims its own merge');
    for (const [name, text] of [['Current State', w.state], ['the Project Map', w.map], ['the Roadmap', w.roadmap]]) {
      // A checkout without the root locators (the forward-safety mirror) has nothing to check here.
      if (text !== null && !text.includes('QANDEEL_S7_05_IMPLEMENTATION_RECORD_v1.md')) out.push(`${name} names the S7-05 record`);
    }
    return out;
  },

  proofViolations(w) {
    const out = [];
    if (JSON.parse(w.mobilePkg).main !== 'expo-router/entry') out.push('the Product entry stays the Product entry');
    if (!w.selector.includes("process.env.S705_DEVICE_PROOF !== '1'")) out.push('the proof selector refuses without S705_DEVICE_PROOF=1');
    if (!w.proofWorld.includes('const base = createS704ProofWorld();')) out.push('the device proof stands on the S7-04 proof world and its captured wire');
    if (!w.proofWorld.includes('PLAYER_WIRE.scenes.sourceWithdrawn')) out.push('revocation is the captured withdrawn scene');
    if (/answer\(200, \{/u.test(w.proofWorld)) out.push('no Replay answer is invented');
    if (!w.proofRoot.includes('<RuntimePhaseSurface runtime={runtime} />')) out.push('the proof renders the production composition');
    for (const [path, text] of w.mobile) {
      if (/S705ProofRoot|s705-proof/u.test(text)) out.push(`${path}: no production module reaches the proof`);
    }
    return out;
  },

  d5Violations(w) {
    const out = [];
    for (const [key, text] of D5_PROOFS) if (!w.d5[key].includes(text)) out.push(`${D5_SUITES[key]}: the D5 proof is present (${text.slice(0, 60)}…)`);
    for (const [key, text] of Object.entries(w.d5)) {
      if (/\b(describe|it|test)\.(skip|only|todo)\(|\bx(describe|it|test)\(/u.test(text)) out.push(`${D5_SUITES[key]}: no proof is skipped or singled out`);
    }
    return out;
  },
  wiringViolations(w) {
    const out = [];
    if (!w.pkg.includes('"test:s7-05-replay-final-integration-contract": "node --test tests/s7-05-replay-final-integration-contract.test.mjs"')) out.push('package.json runs this contract');
    if (!w.workflow.includes('run: npm run test:s7-05-replay-final-integration-contract')) out.push('API CI runs this contract');
    return out;
  },
};

test('S7-05 narrows a Reading\'s scope to its class on the Replay wire alone, refuses anything else, and records the 27 approved English rows', () => {
  const w = shipped();
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(w), [], name);
});

const edit = (key, from, to) => () => {
  const w = shipped();
  assert.ok(w[key].includes(from), `the plant's anchor exists: ${from}`);
  return { ...w, [key]: w[key].replace(from, to) };
};
const editList = (key, path, from, to) => () => {
  const w = shipped();
  const entry = w[key].find(([candidate]) => candidate === path);
  assert.ok(entry !== undefined && entry[1].includes(from), `the plant's anchor exists: ${from}`);
  return { ...w, [key]: w[key].map(([candidate, text]) => [candidate, candidate === path ? text.replace(from, to) : text]) };
};
const add = (key, path, text) => () => {
  const w = shipped();
  return { ...w, [key]: [...w[key], [path, text]] };
};

const PLANTED = [
  ['the Session id passed through', 'apiViolations', edit('service', NARROW, 'return reading;')],
  ['a non-canonical scope repaired', 'apiViolations', edit('service', VERIFY, 'if (!CANONICAL_READING_SCOPE.test(reading.scope.trim().toLowerCase())) return unavailable();')],
  ['a looser scope form', 'apiViolations', edit('service', CANONICAL, 'const CANONICAL_READING_SCOPE = /^CONVERSATION_SESSION:/u;')],
  ['Readings that skip the narrowing', 'apiViolations', edit('service', MAPPED, 'readings: rungs.analyticalObject.value.readings')],
  ['the full scope typed', 'apiViolations', edit('types', TYPED, "export type ReplayReading = DisclosedReading;")],
  ['a Session id in a wire', 'wireViolations', editList('wires', WIRES[0], '"scope": "CONVERSATION_SESSION"', '"scope": "CONVERSATION_SESSION:a7050000-0000-4000-8000-000000000001"')],
  ['another scope in a wire', 'wireViolations', editList('wires', WIRES[1], '"scope": "CONVERSATION_SESSION"', '"scope": "USER"')],
  ['a decoder that takes any text', 'clientViolations', edit('client', DECODE, 'scope: text(reading.scope, `${path}.scope`),')],
  ['a consumer reading a Reading\'s scope', 'clientViolations', add('consumers', 'apps/mobile/src/replay-composite/x.ts', 'export const s = (reading) => reading.scope;')],
  ['0169 changed', 'unchangedViolations', editList('unchanged', UNCHANGED[0][0], 'replay', 'replay ')],
  ['an English row back to PROPOSED', 'copyViolations', edit('compositeCopy', "enStatus: 'APPROVED', source:", "enStatus: 'PROPOSED', source:")],
  ['the English approval unrecorded', 'copyViolations', edit('entryCopy', "englishApproval: 'S7-05 ENGLISH COPY APPROVAL", "englishApproval: 'PENDING")],
  ['a record without its lifecycle', 'recordViolations', edit('record', '**Status:** ', '**State:** ')],
  ['a locator without the record', 'recordViolations', () => {
    const w = shipped();
    return { ...w, map: (w.map ?? '').replaceAll('QANDEEL_S7_05_IMPLEMENTATION_RECORD_v1.md', 'QANDEEL_S7_05.md') };
  }],
  ['the Product entry replaced', 'proofViolations', edit('mobilePkg', '"main": "expo-router/entry"', '"main": "src/integration/__validation__/s705-proof-entry.tsx"')],
  ['an ungated selector', 'proofViolations', edit('selector', "process.env.S705_DEVICE_PROOF !== '1'", 'false')],
  ['an invented Replay answer', 'proofViolations', edit('proofWorld', 'return answer(200, withdrawn.version);', "return answer(200, { outcome: 'FOUND' });")],
  ['a production module reaching the proof', 'proofViolations', add('mobile', 'apps/mobile/src/replay-player/x.ts', "import { S705ProofRoot } from '../integration/__validation__/S705ProofRoot';")],
  ['the account-switch proof removed', 'd5Violations', () => {
    const w = shipped();
    return { ...w, d5: { ...w.d5, composition: w.d5.composition.replace('S7-05 D5 — an account switch', 'an account switch') } };
  }],
  ['the read-after-close scenario removed', 'd5Violations', () => {
    const w = shipped();
    return { ...w, d5: { ...w.d5, verifier: w.d5.verifier.replace("report.isolated('E15", "report.isolated('E15-off") } };
  }],
  ['a D5 proof skipped', 'd5Violations', () => {
    const w = shipped();
    return { ...w, d5: { ...w.d5, entry: w.d5.entry.replace("it('S7-05 D5 —", "it.skip('S7-05 D5 —") } };
  }],
  ['this contract left out of CI', 'wiringViolations', edit('workflow', 'run: npm run test:s7-05-replay-final-integration-contract', 'run: true')],
];

for (const [name, detector, plant] of PLANTED) {
  test(`the ${detector} detector catches ${name}`, () => {
    assert.notDeepEqual(DETECTORS[detector](plant()), [], name);
  });
}
