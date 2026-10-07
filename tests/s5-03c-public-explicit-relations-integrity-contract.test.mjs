// S5-03C — Public Explicit Relations + Integrity Closure: the cross-layer static contract.
//
// It pins what a text census can honestly pin — the one additive relation authority and its boundary, SIMILARITY IS NOT A
// RELATION, relations are not geography, no server channel, the API and mobile boundaries, the shared renderer left
// generic and unchanged, accessibility, the Copy Gate, and the lifecycle / backlog truth. Live behaviour (the lifecycle,
// integrity, disappearance and non-disclosure) is proven by database/verify-migration-0146.mjs against real PostgreSQL, the
// API specs and the mobile Jest suites.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
/** Source with comments removed, so a sentence that EXPLAINS a ban never satisfies or violates it. */
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
const sqlCode = (text) => text.replace(/--.*$/gmu, '');

const MIGRATION = 'database/migrations/0146_public_explicit_relations_integrity_v1.sql';
const VERIFIER = 'database/verify-migration-0146.mjs';
const RECORD = 'docs/e2e/QANDEEL_S5_03C_PUBLIC_EXPLICIT_RELATIONS_INTEGRITY_CLOSURE_IMPLEMENTATION_RECORD_v1.md';
const API = 'apps/api/src/public-world';
const MOBILE = 'apps/mobile/src';
const OWNER = ['read_own_public_relation_experiences_v1', 'read_own_public_relations_v1', 'request_public_relation_v1', 'accept_public_relation_v1',
  'decline_public_relation_v1', 'cancel_public_relation_v1', 'remove_public_relation_v1'];
const VIEWER = ['read_public_semantic_relations_v1'];

test('1 — registered in the toolchain and both CI workflows; one forward migration after 0145', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['verify:public-explicit-relations-integrity:integration'], 'node --env-file-if-exists=.env database/verify-migration-0146.mjs');
  assert.equal(manifest.scripts['test:s5-03c-public-explicit-relations-integrity-contract'], 'node --test tests/s5-03c-public-explicit-relations-integrity-contract.test.mjs');
  const api = read('.github/workflows/api-ci.yml');
  assert.match(api, /run: npm run verify:public-explicit-relations-integrity:integration/u);
  assert.match(api, /run: npm run test:s5-03c-public-explicit-relations-integrity-contract/u);
  const mobile = read('.github/workflows/mobile-ci.yml');
  assert.match(mobile, /run: npm run test:s5-03c-public-explicit-relations-integrity-contract/u);
  assert.match(mobile, /'tests\/s5-03c-public-explicit-relations-integrity-contract\.test\.mjs'/u);
  const migrations = readdirSync(new URL('database/migrations/', root)).filter((f) => /^\d{4}_/u.test(f)).sort();
  assert.equal(migrations.filter((f) => f.startsWith('0146_')).length, 1, 'exactly one 0146');
  assert.ok(migrations.indexOf('0146_public_explicit_relations_integrity_v1.sql') === migrations.indexOf('0145_public_semantic_field_location_viewer_v1.sql') + 1,
    '0146 directly follows 0145');
  assert.ok(existsSync(new URL(VERIFIER, root)));
});

test('2 — additive authority only: no frozen function replaced, no frozen table altered, nothing outside its own schema written', () => {
  const sql = sqlCode(read(MIGRATION));
  assert.doesNotMatch(sql, /CREATE OR REPLACE|ALTER TABLE public\.|ALTER TABLE public_(spatial|semantic|authoring|world)_private|DROP /u, 'nothing frozen is changed');
  assert.match(sql, /CREATE SCHEMA public_relation_private;/u);
  const tables = [...sql.matchAll(/CREATE TABLE ([a-z_.]+) \(/gu)].map((m) => m[1]).sort();
  assert.deepEqual(tables, ['public_relation_private.explicit_relation_acts', 'public_relation_private.explicit_relations']);
  assert.match(sql, /CHECK \(relation_type = 'EXPLICIT_PUBLIC_RELATION'\)/u, 'one relation type in v1');
  assert.match(sql, /CHECK \(source_experience_id <> target_experience_id\)/u);
  for (const side of ['source', 'target']) {
    assert.match(sql, new RegExp(`FOREIGN KEY \\(${side}_experience_version_id, ${side}_experience_id\\)\\s+REFERENCES public\\.public_experience_versions \\(id, experience_id\\) ON DELETE RESTRICT`, 'u'), `${side}: exact version`);
    assert.match(sql, new RegExp(`FOREIGN KEY \\(${side}_interpretation_id\\)\\s+REFERENCES public_semantic_private\\.semantic_interpretations \\(placement_id\\) ON DELETE RESTRICT`, 'u'), `${side}: exact reviewed revision`);
  }
  assert.match(sql, /act IN \('ACCEPT', 'DECLINE', 'CANCEL', 'REMOVE'\)/u);
  assert.match(sql, /\(act IN \('ACCEPT', 'DECLINE'\) AND acting_side = 'TARGET'\)\s+OR \(act = 'CANCEL' AND acting_side = 'SOURCE'\)/u, 'each act belongs to its side');
  const writes = [...sql.matchAll(/(INSERT INTO|UPDATE|DELETE FROM)\s+([a-z_]+\.[a-z_]+)/gu)].map((m) => m[2]);
  assert.ok(writes.every((t) => t.startsWith('public_relation_private.')), `writes only its own family: ${writes.join(', ')}`);
});

test('3 — SIMILARITY IS NOT A RELATION, and a relation is not geography', () => {
  const sql = sqlCode(read(MIGRATION));
  const bodies = sql.split(/CREATE FUNCTION /u).slice(1);
  for (const body of bodies) {
    const name = body.slice(0, body.indexOf('('));
    if (name.startsWith('public.')) continue;
    assert.doesNotMatch(body.slice(0, body.indexOf('$$;') > 0 ? body.indexOf('$$;') : undefined),
      /field_candidates_v1|read_public_semantic_nearby|search_public_semantic_field|\^ *2|semantic_region *(=|<>|IN)|primary_themes|secondary_themes|vitality|discussion|published_at|world_x *[-+<>=]|world_y *[-+<>=]/u,
      `${name} decides nothing from a distance, a region, a theme or any activity`);
  }
  // Exactly one writer of a relation (the human request) and one of an act (the human act recorder).
  const relationWriters = bodies.filter((b) => /INSERT INTO public_relation_private\.explicit_relations\s/u.test(b)).map((b) => b.slice(0, b.indexOf('(')));
  assert.deepEqual(relationWriters, ['public_relation_private.request_public_relation_v1']);
  const actWriters = bodies.filter((b) => /INSERT INTO public_relation_private\.explicit_relation_acts/u.test(b)).map((b) => b.slice(0, b.indexOf('(')));
  assert.deepEqual(actWriters, ['public_relation_private.record_act_v1']);
  // Validity is the ONE S5-03B visible-entry derivation, exactly bound — never a cache, never a stored flag.
  assert.match(sql, /derive_visible_spatial_entry_v1\(p_experience_id\) ve\s+WHERE ve\.experience_version_id = p_version_id AND ve\.interpretation_id = p_interpretation_id/u);
  assert.doesNotMatch(sql, /\b(is_current|is_stale|valid_until|cached|strength|score|weight)\b\s+(boolean|text|numeric|integer)/u, 'no stored validity, strength or score');
  // Geography is untouched by construction.
  assert.doesNotMatch(sql, /spatial_placements\s+SET|INSERT INTO public_spatial_private/u);
});

test('4 — the boundary: authenticated only, the server channel holds nothing, no input is an authority claim', () => {
  const sql = sqlCode(read(MIGRATION));
  assert.doesNotMatch(sql, /GRANT [A-Z, ]+ ON FUNCTION [^;]+ TO service_role/u, 'no server-channel command');
  assert.match(sql, /EXECUTE 'GRANT USAGE ON SCHEMA public_relation_private TO authenticated'/u);
  for (const name of [...OWNER, ...VIEWER]) {
    assert.match(sql, new RegExp(`CREATE FUNCTION public\\.${name}\\(`, 'u'), `public.${name} wrapper`);
    assert.match(sql, new RegExp(`'public\\.${name}\\(`, 'u'), `${name} is granted by name`);
  }
  for (const [, name, params] of sql.matchAll(/CREATE FUNCTION public\.([a-z_]+)\(([^)]*)\)/gu)) {
    assert.doesNotMatch(params, /user|viewer|actor|side|type|kind|strength|score|text|evidence|version|interpretation|region|distance/u, `public.${name}(${params})`);
  }
  assert.doesNotMatch(sql, /commit_[a-z_]*_v1/u, 'no commit_% name joins the 0071 / 0139–0141 census family');
});

test('5 — API: one controller in the SAME Public module, the caller token only, the census classes', () => {
  const module = code(`${API}/public-world.module.ts`);
  assert.match(module, /PublicFieldController,\s+PublicRelationController\]/u, 'the same Public module, not a parallel one');
  const repo = code(`${API}/public-relation.repository.ts`);
  assert.doesNotMatch(repo, /SupabaseServiceRoleApiService|server\.rpc/u, 'no server channel');
  const controller = code(`${API}/public-relation.controller.ts`);
  assert.match(controller, /@Controller\('public\/authoring\/relations'\)/u);
  for (const act of ['accept', 'decline', 'cancel', 'remove']) assert.match(controller, new RegExp(`@Post\\(':relationId/${act}'\\)`, 'u'));
  const census = code('apps/api/src/http-security/route-rate-limit.census.ts');
  assert.match(census, /'POST \/public\/authoring\/relations': 'SECURITY_SENSITIVE'/u);
  assert.match(census, /'GET \/public\/authoring\/relations': 'AUTHENTICATED'/u);
  const field = code(`${API}/public-field.repository.ts`);
  assert.match(field, /'read_public_semantic_relations_v1'/u, 'the panel reads the explicit relations from the database');
  for (const file of ['public-relation.repository.ts', 'public-relation.service.ts', 'public-relation.controller.ts']) {
    assert.doesNotMatch(code(`${API}/${file}`), /similar|proxim|nearby|distance|world_x|coordinate|strength|score|rank|console\.|Logger|notif|push|activity|publish_/iu, file);
  }
});

test('6 — mobile: the shared renderer stays generic and unchanged; the Public World supplies explicit relations only', () => {
  // The renderer draws; it never decides. Its connection slot is the generic, optional, empty-by-default one.
  const canvas = code(`${MOBILE}/map/renderer/WorldCanvas.tsx`);
  assert.match(canvas, /readonly renderConnections\?: \(planeNodes: readonly N\[\], frame: WorldPaintFrame\) => ReactNode;/u);
  for (const dir of ['map/renderer', 'map/visual', 'living-analysis']) {
    for (const file of readdirSync(new URL(`${MOBILE}/${dir}/`, root)).filter((f) => /\.tsx?$/u.test(f))) {
      assert.doesNotMatch(code(`${MOBILE}/${dir}/${file}`), /EXPLICIT_PUBLIC_RELATION|PublicRelation|public-relation|relationId/u, `${dir}/${file} knows nothing of Public relations`);
    }
  }
  const lines = code(`${MOBILE}/public-world/field/PublicRelationLines.tsx`);
  assert.match(lines, /camera\.depth !== 'NEAR' \|\| focusId === null \|\| relations\.length === 0\) return \[\]/u, 'only at NEAR, only for the selected Experience');
  assert.match(lines, /<WorldTether key=\{`explicit:\$\{segment\.relationId\}`\}/u, 'the canonical connection style');
  assert.doesNotMatch(lines, /WorldStrata|WorldAtmosphere|filament|nearby|region|similar|onPress|Pressable|accessibilityRole/u, 'no filament, no inference, not pressable');
  assert.match(lines, /accessible accessibilityLabel=\{fill\(relationWith, segment\.otherMeaning\)\}/u, 'one accessible name per line: the other endpoint');
  const view = code(`${MOBILE}/public-world/field/PublicFieldView.tsx`);
  assert.match(view, /state\.focus\?\.panel\.status === 'SERVED' \? state\.focus\.panel\.experience\.relations : null/u, 'relations come only from the served panel');
  const controller = code(`${MOBILE}/public-world/field/public-field-controller.ts`);
  assert.doesNotMatch(controller, /relations: \[\.\.\.|relationCache|lastRelations/u, 'no relation is merged or cached across reads');
  // The management lives inside the existing authoring workspace — no new destination, no graph screen.
  assert.match(code(`${MOBILE}/public-authoring/public-authoring-controller.ts`), /export type PublicAuthoringScreen = 'CLOSED' \| 'WORKSPACE' \| 'CHOOSE' \| 'REVIEW' \| 'RELATIONS';/u);
  assert.match(code(`${MOBILE}/integration/runtime/integration-runtime.ts`), /relation: publicTransport\.relation \?\? null, relationSearch: publicTransport\.field \?\? null/u, 'the SAME field search');
  const ui = code(`${MOBILE}/public-authoring/PublicRelations.tsx`);
  assert.doesNotMatch(ui, /WorldCanvas|Canvas|Skia|graph|nearby|region|similar|suggest|count|notif|push/iu, 'no map, graph, suggestion, count or notification');
  const client = code(`${MOBILE}/runtime-entry/public-relation-api.ts`);
  const posts = [...client.matchAll(/this\.exchange\('POST', [^\n]*?, (\{[^{}]*\})\);/gu)].map((m) => m[1]);
  assert.deepEqual(posts, ['{ commandId, experienceId, otherExperienceId }', '{ commandId }']);
});

test('7 — the S5-03C Product Copy Gate: one gate, OPEN, every new row PROPOSED in both languages, frozen words reused', () => {
  const copy = read(`${MOBILE}/public-authoring/relation-copy.ts`);
  assert.ok(copy.includes("status: 'S5-03C PRODUCT COPY GATE — OPEN — 13 rows PROPOSED (awaiting the Product Owner)'"));
  assert.equal((copy.match(/\/\/ PROPOSED — S5-03C Product Copy Gate/gu) ?? []).length, 26, '13 rows, Arabic and English');
  assert.ok(copy.includes('  approved: [],'), 'nothing approved silently');
  for (const reused of ['back: shared.back', 'retry: shared.retry', 'actionUnavailable: shared.actionUnavailable', 'cancel: shared.cancel',
    'searchLabel: field.searchLabel', 'noResults: field.noResults']) assert.ok(copy.includes(reused), reused);
  assert.ok(copy.includes("relationWith: 'علاقة مع {0}'") && copy.includes("relationWith: 'Relation with {0}'"), 'the line names the other endpoint');
  assert.doesNotMatch(code(`${MOBILE}/public-authoring/relation-copy.ts`), /Connected to|مرتبطة بـ|similar|near|strength|score|suggest|مشابه|اقتراح/u);
  for (const gate of [['public-world/field/field-copy.ts', "S5-03B PRODUCT COPY GATE — CLOSED — 13 rows APPROVED"],
    ['public-authoring/semantic-copy.ts', "S5-03A PRODUCT COPY GATE — CLOSED — 21 rows APPROVED"],
    ['public-authoring/copy.ts', "S5-02 PRODUCT COPY GATE — CLOSED — 27 rows APPROVED"]]) {
    assert.ok(read(`${MOBILE}/${gate[0]}`).includes(gate[1]), `${gate[0]} is untouched`);
  }
});

test('8 — governance: the record, the backlog and the locators tell the same truth', () => {
  const record = read(RECORD);
  assert.match(record, /^# QANDEEL — S5-03C Public Explicit Relations \+ Integrity Closure — Implementation Record v1/u);
  assert.match(record, /\*\*Status:\*\* `ACTIVE — IMPLEMENTED ON DRAFT PR — S5-03C PRODUCT COPY GATE OPEN/u, 'not closed before the Copy Gate is decided');
  assert.match(record, /afd5e8caecc06884b5adfdb381eef8e650e03c1f/u);
  assert.match(record, /\*\*SIMILARITY IS NOT A RELATION\.\*\*/u);
  assert.match(record, /\*\*`QAN-BL-ACCT-01 — HIGH \/ OPEN`:\*\*/u);
  assert.match(record, /\*\*Orphan gaps = 0\.\*\*/u);
  for (const section of ['Current-truth reconciliation', 'Anti-duplication / repo-truth gate', 'The Product decision applied', 'Integrity laws proven',
    'Similarity alone draws no line', 'Geography is untouched', 'S5-03C Product Copy Gate', 'Backlog reconciliation', 'Gap Matrix', 'Validation',
    'Failure classification']) assert.ok(record.includes(section), section);
  assert.match(record, /G04[^\n]*OPEN PRODUCT GAP — awaiting the Product Owner's ownership decision/u, 'G04 is not self-assigned');
  assert.match(record, /G05[^\n]*OPEN PRODUCT GAP — awaiting the Product Owner's ownership decision/u, 'G05 is not self-assigned');
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  assert.match(backlog, /\*\*Current-truth note \(S5-03C, 2026-10-07\)\.\*\*/u);
  assert.match(backlog, /\*\*S5-03C reconciliation \(2026-10-07; Draft PR, not merged, not closed\)\.\*\*/u);
  assert.match(backlog, /\| `S5-03C — Public Explicit Relations \+ Integrity Closure` \| none — no item names it;/u);
  assert.match(backlog, /\| `QAN-BL-VIS-01` \| [^\n]*\| `OPEN — UNASSIGNED` \|/u);
  assert.match(backlog, /\| `QAN-BL-CW-03` \| [^\n]*\| `DEFERRED — OWNED` \|/u);
  assert.match(backlog, /\| `QAN-BL-ACCT-01` \| [^\n]*\| `OPEN — UNASSIGNED` \|/u);
  // The locators are not mirrored by the forward-safety gate; read them only where they exist.
  if (existsSync(new URL('QANDEEL_CURRENT_STATE.md', root))) {
    const state = read('QANDEEL_CURRENT_STATE.md');
    assert.match(state, /S5-03B — Public Semantic Field \+ Stable Spatial Placement \+ Viewer Runtime \(migration `0145`\) \| \*\*`DONE \/ MERGED` through PR #317 at `afd5e8caecc06884b5adfdb381eef8e650e03c1f`\*\*/u);
    assert.match(state, /S5-03C — Public Explicit Relations \+ Integrity Closure \(migration `0146`\) \| \*\*ACTIVE — IMPLEMENTED/u);
    assert.doesNotMatch(state, /Stage 5 \(Public World Product Integration\) is \*\*DONE/u, 'Stage 5 is not DONE before S5-04');
  }
  if (existsSync(new URL('QANDEEL_PROJECT_MAP.md', root))) {
    const map = read('QANDEEL_PROJECT_MAP.md');
    assert.match(map, /> \*\*CURRENT IMPLEMENTATION TASK: S5-03C — Public Explicit Relations \+ Integrity Closure\*\*/u);
    assert.match(map, /`S5-04 — Discussion \+ Public QANDEEL \+ Final Public Integration` = \*\*NEXT \/ NOT STARTED\*\*/u);
  }
  const s503b = read('docs/e2e/QANDEEL_S5_03B_PUBLIC_SEMANTIC_FIELD_VIEWER_RUNTIME_IMPLEMENTATION_RECORD_v1.md');
  assert.doesNotMatch(s503b, /Public performance at scale \(G04, G05\)/u, 'the S5-03B §19 drift is corrected: G04 / G05 are not S5-04\'s');
});
