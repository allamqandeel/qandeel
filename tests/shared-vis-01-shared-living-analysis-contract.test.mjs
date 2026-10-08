// SHARED-VIS-01 — Shared World Living Analysis Map Product Integration: the cross-layer static contract.
//
// It pins what a text census can honestly pin: ONE additive migration (0148) that composes the frozen I-04G QANDEEL core
// rather than a second material model; provider neutrality (both Shared ports refuse outside tests); the I-03 chain
// composed inside Connected Worlds; ONE renderer family (the Shared World consumes the common Living Analysis surface and
// the semantic-field policy, never a renderer of its own); no Personal state in the Shared field; the conversation kept
// free of semantic places; the Copy Gate; and the lifecycle / backlog truth. Live behaviour is proven by
// database/verify-migration-0148.mjs against real PostgreSQL, the API specs and the mobile Jest suites.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
/** Source with comments removed, so a sentence that EXPLAINS a ban never satisfies or violates it. */
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
const sqlCode = (text) => text.replace(/--.*$/gmu, '');

const MIGRATION = 'database/migrations/0148_shared_semantic_field_living_analysis_v1.sql';
const RECORD = 'docs/e2e/QANDEEL_SHARED_VIS_01_SHARED_WORLD_LIVING_ANALYSIS_IMPLEMENTATION_RECORD_v1.md';
const FIELD = 'apps/mobile/src/shared-world/field';

test('1 — registered in the toolchain and both CI workflows; one forward migration after 0147', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['verify:shared-semantic-field:integration'], 'node --env-file-if-exists=.env database/verify-migration-0148.mjs');
  assert.equal(manifest.scripts['test:shared-vis-01-shared-living-analysis-contract'], 'node --test tests/shared-vis-01-shared-living-analysis-contract.test.mjs');
  const api = read('.github/workflows/api-ci.yml');
  assert.match(api, /run: npm run verify:shared-semantic-field:integration/u);
  assert.match(api, /run: npm run test:shared-vis-01-shared-living-analysis-contract/u);
  const mobile = read('.github/workflows/mobile-ci.yml');
  assert.match(mobile, /run: npm run test:shared-vis-01-shared-living-analysis-contract/u);
  assert.match(mobile, /'tests\/shared-vis-01-shared-living-analysis-contract\.test\.mjs'/u);
  const migrations = readdirSync(new URL('database/migrations/', root)).filter((f) => f.endsWith('.sql')).sort();
  assert.equal(migrations.filter((f) => f.startsWith('0148_')).length, 1, 'exactly one 0148');
  assert.equal(migrations.indexOf('0148_shared_semantic_field_living_analysis_v1.sql'), migrations.indexOf('0147_public_discussion_qandeel_activity_integration_v1.sql') + 1);
});

test('2 — the place is the frozen I-04G vocabulary: QANDEEL_ANALYSIS through the frozen core, MATERIAL_DEPENDENCY on human text, erased with its meaning', () => {
  const sql = sqlCode(read(MIGRATION));
  assert.match(sql, /public\.commit_shared_world_qandeel_material_v1\(\s*v_command, p_world_id, v_material, v_item, 'QANDEEL_ANALYSIS'/u);
  assert.match(sql, /m\.material_kind = 'HUMAN_TEXT'/u, 'sources are the World\'s human text only');
  assert.match(sql, /FOREIGN KEY \(material_id\) REFERENCES public\.shared_world_text_material_bodies \(material_id\) ON DELETE CASCADE/u);
  // No second material, history, audience or provenance model; nothing frozen replaced.
  assert.doesNotMatch(sql, /CREATE TABLE public\.|CREATE OR REPLACE FUNCTION|ALTER TABLE public\.|DROP (TABLE|FUNCTION|CONSTRAINT)/u);
  assert.doesNotMatch(sql, /INSERT INTO public\.shared_world_(materials|history_items|material_dependencies|text_material_bodies)/u);
  assert.match(sql, /CREATE SCHEMA shared_semantic_private;/u);
  assert.doesNotMatch(sql, /CREATE FUNCTION shared_private\./u, 'the S4-01 … S4-04 shared_private surface gains nothing');
  assert.doesNotMatch(sql, /CREATE FUNCTION public\.commit_/u, 'no `commit_%` name joins the T-03D census');
  // The member reads serve a place only when the reader may see every source, through the frozen resolver.
  assert.match(sql, /public\.resolve_shared_world_material_v1\(p_world_id, p_user\)/u);
  assert.match(sql, /coordinate_scheme = 'QANDEEL_SHARED_FIELD_V1'/u);
});

test('3 — provider-neutral and fail-closed: both Shared ports refuse outside tests; the I-03 chain stays inside Connected Worlds', () => {
  for (const port of ['apps/api/src/shared-world/shared-semantic-interpreter.ts', 'apps/api/src/shared-world/shared-spatial-placer.ts']) {
    const source = code(port);
    assert.match(source, /environment\.NODE_ENV === 'test'/u, `${port} binds its fake only in tests`);
    assert.match(source, /return new Unconfigured\w+\(\);\s*\}\s*$/u, `${port} refuses everywhere else`);
    assert.doesNotMatch(source, /ModelRouter|model-router|fetch\(|https?:\/\//u, `${port} reaches no provider`);
  }
  const pass = code('apps/api/src/connected-worlds/material-commit/shared-semantic-place.service.ts');
  assert.match(pass, /materialKind: 'QANDEEL_ANALYSIS'/u);
  assert.match(pass, /reason: 'NO_PROVIDER'/u, 'nothing is leased, read or spent while no provider is bound');
  assert.ok(!existsSync(new URL('apps/api/src/shared-world/shared-semantic-place.service.ts', root)), 'the pass composes I-03 inside Connected Worlds only');
});

test('4 — the conversation stays the conversation: a semantic place is never a message', () => {
  const service = code('apps/api/src/shared-world/shared-world-conversation.service.ts');
  assert.match(service, /row\.material_kind !== 'QANDEEL_ANALYSIS'/u);
  assert.match(service, /\.filter\(isConversation\)\.map\(viewOf\)/u);
  assert.match(service, /rows\.filter\(isConversation\)/u, 'the reply never reads a place as conversation');
  assert.match(code('apps/api/src/shared-world/shared-world-lifecycle.repository.ts'), /'list_own_closed_shared_world_material_v2'/u);
});

test('5 — ONE renderer family: the Shared World consumes the common surface and the semantic-field policy, nothing of its own', () => {
  const surface = code(`${FIELD}/SharedLivingAnalysis.tsx`);
  assert.match(surface, /<LivingAnalysisSurface\b/u);
  assert.match(surface, /timeline=\{null\}/u, 'no Shared Timeline (D5)');
  const view = code(`${FIELD}/SharedFieldView.tsx`);
  assert.match(view, /import \{ WorldCanvas, WorldViewSurface, useWorldView \} from '\.\.\/\.\.\/map\/renderer';/u);
  assert.match(view, /PublicExperienceMark/u, 'the semantic field\'s neutral mark, reused');
  assert.match(code(`${FIELD}/shared-field-camera.ts`), /from '\.\.\/\.\.\/public-world\/field\/public-field-camera'/u, 'the semantic-field camera, reused');
  assert.match(code(`${FIELD}/shared-field-projection.ts`), /placePublicField\(/u, 'the semantic-field disclosure policy, reused');
  for (const name of readdirSync(new URL(`${FIELD}/`, root)).filter((f) => /\.(ts|tsx)$/u.test(f))) {
    const source = code(`${FIELD}/${name}`);
    assert.doesNotMatch(source, /@shopify\/react-native-skia['"]|<Canvas\b/u, `${name} paints nothing of its own`);
    assert.doesNotMatch(source, /from '[^']*\/(store|projection|temporal|timeline|integration)['/]/u, `${name} reads nothing of the Personal world`);
    assert.doesNotMatch(source, /\bmembers\b|QANDEEL_FIGURE|memberMark/u, `${name} draws no member or QANDEEL object (D6)`);
  }
});

test('6 — the Copy Gate: reused words exactly; CLOSED — 6 / 6 APPROVED by the Product Owner', () => {
  const copy = read(`${FIELD}/field-copy.ts`);
  assert.match(copy, /status: 'SHARED-VIS-01 PRODUCT COPY GATE — CLOSED — 6 \/ 6 APPROVED[^']*'/u);
  const proposed = [...copy.matchAll(/\/\/ PROPOSED — SHARED-VIS-01 Product Copy Gate/gu)].length;
  const approved = [...copy.matchAll(/\/\/ APPROVED — SHARED-VIS-01 Product Copy Gate/gu)].length;
  assert.equal(proposed, 0, 'nothing is left PROPOSED');
  assert.equal(approved, 12, 'six rows, in Arabic and English, approved');
});

test('7 — lifecycle and backlog truth: Stage 5 DONE / MERGED; SHARED-VIS-01 the current task, not merged; Stage 6 not started', () => {
  const record = read(RECORD);
  assert.match(record, /^\*\*Status:\*\* `(ACTIVE — IMPLEMENTED ON feat\/shared-vis-01-shared-living-analysis — NOT MERGED; NOT CLOSED|CLOSED[^`]*|DONE \/ MERGED[^`]*)`/mu);
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  assert.match(backlog, /\| `QAN-BL-CW-03` \|[^\n]*\| `(DEFERRED — OWNED|CLOSED — TOMBSTONE)` \|/u);
  for (const id of ['QAN-BL-CW-05', 'QAN-BL-CW-06', 'QAN-BL-CW-07']) assert.match(backlog, new RegExp(`\\| \`${id}\` \\|`, 'u'), `${id} is admitted`);
  if (existsSync(new URL('QANDEEL_CURRENT_STATE.md', root))) {
    const state = read('QANDEEL_CURRENT_STATE.md');
    assert.match(state, /Stage 5 \(Public World Product Integration\) is \*\*DONE \/ MERGED\*\*/u);
    assert.match(state, /\| SHARED-VIS-01 — Shared World Living Analysis Map Product Integration \(migration `0148`\) \|/u);
    assert.doesNotMatch(state, /Stage 6[^\n]*\*\*ACTIVE/u, 'Stage 6 is not started');
  }
  if (existsSync(new URL('QANDEEL_PROJECT_MAP.md', root))) {
    assert.match(read('QANDEEL_PROJECT_MAP.md'), /> \*\*CURRENT IMPLEMENTATION TASK: SHARED-VIS-01 — Shared World Living Analysis Map Product Integration\*\*/u);
  }
});
