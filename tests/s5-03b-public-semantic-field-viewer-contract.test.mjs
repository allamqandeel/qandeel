// S5-03B — Public Semantic Field + Stable Spatial Placement + Viewer Runtime: the cross-layer static contract.
//
// It pins what a text census can honestly pin — scope, authority, the provider boundary, the 0096 / 0097 reconciliation,
// the absence of any publication path, relation line or popularity geography, Public-only viewer state, the Copy Gate and
// the lifecycle / backlog truth. Live behaviour (stable placement, version / revision binding, visibility, disappearance)
// is proven by database/verify-migration-0145.mjs against real PostgreSQL, the API spec and the mobile Jest suite.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
/** Source with comments removed, so a sentence that EXPLAINS a ban never satisfies or violates it. */
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
const sqlCode = (text) => text.replace(/--.*$/gmu, '');

const MIGRATION = 'database/migrations/0145_public_semantic_field_location_viewer_v1.sql';
const VERIFIER = 'database/verify-migration-0145.mjs';
const RECORD = 'docs/e2e/QANDEEL_S5_03B_PUBLIC_SEMANTIC_FIELD_VIEWER_RUNTIME_IMPLEMENTATION_RECORD_v1.md';
const API = 'apps/api/src/public-world';
const MOBILE = 'apps/mobile/src';
const OWNER = ['read_own_public_spatial_preparation_v1', 'request_own_public_spatial_placement_v1'];
const VIEWER = ['read_public_semantic_field_v1', 'search_public_semantic_field_v1', 'read_public_semantic_experience_v1',
  'read_public_semantic_experience_content_v1', 'read_public_semantic_nearby_v1'];
const SERVER = ['read_public_spatial_placement_input_v1', 'commit_public_spatial_placement_v1'];
// R2 (controlled re-anchor): `PublicSemanticField.tsx` — the Public field's own full-screen composition — is deleted; the
// field is `PublicLivingAnalysis.tsx` (its consumption of the ONE Living Analysis surface) and `PublicFieldView.tsx` (its
// world in the surface's world view).
const FIELD_FILES = ['public-world/field/public-field-camera.ts', 'public-world/field/public-field-controller.ts',
  'public-world/field/PublicLivingAnalysis.tsx', 'public-world/field/PublicFieldView.tsx', 'public-world/field/public-field-projection.ts', 'public-world/field/PublicExperienceMark.tsx',
  'public-world/field/field-copy.ts', 'runtime-entry/public-field-api.ts',
  'public-authoring/PublicPlacePreparation.tsx'];

test('1 — registered in the toolchain and both CI workflows; one forward migration after 0144', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['verify:public-semantic-field-placement-viewer:integration'], 'node --env-file-if-exists=.env database/verify-migration-0145.mjs');
  assert.equal(manifest.scripts['test:s5-03b-public-semantic-field-viewer-contract'], 'node --test tests/s5-03b-public-semantic-field-viewer-contract.test.mjs');
  const api = read('.github/workflows/api-ci.yml');
  assert.match(api, /run: npm run verify:public-semantic-field-placement-viewer:integration/u);
  assert.match(api, /run: npm run test:s5-03b-public-semantic-field-viewer-contract/u);
  const mobile = read('.github/workflows/mobile-ci.yml');
  assert.match(mobile, /run: npm run test:s5-03b-public-semantic-field-viewer-contract/u);
  assert.match(mobile, /'tests\/s5-03b-public-semantic-field-viewer-contract\.test\.mjs'/u);
  const files = readdirSync(new URL('database/migrations/', root)).filter((f) => f.endsWith('.sql')).sort();
  assert.equal(files[files.indexOf('0145_public_semantic_field_location_viewer_v1.sql') - 1], '0144_public_semantic_interpretation_publisher_review_v1.sql');
  assert.ok(read(VERIFIER).length > 0);
});

test('2 — additive: no frozen object replaced; two append-only relations holding geometry, never meaning', () => {
  const sql = sqlCode(read(MIGRATION));
  assert.doesNotMatch(sql, /CREATE OR REPLACE FUNCTION|DROP FUNCTION|DROP TRIGGER|DISABLE TRIGGER|ALTER TABLE public\.|ALTER TABLE public_semantic_private\./u);
  assert.doesNotMatch(sql, /INSERT INTO public(_semantic_private|_authoring_private|_world_private)?\.|UPDATE public(_semantic_private)?\.|DELETE FROM public/u,
    'S5-03B writes no frozen or S5-03A relation');
  assert.match(sql, /CREATE SCHEMA public_spatial_private;/u);
  assert.match(sql, /CHECK \(coordinate_scheme = 'QANDEEL_PUBLIC_FIELD_V1'\)/u, 'the Public field has its own coordinate space');
  assert.doesNotMatch(read(MIGRATION), /osdap/iu, 'never the Personal World Home scheme (T-03B2b1 / T-03B2b2 own it)');
  assert.deepEqual([...sql.matchAll(/CREATE TABLE ([a-z_.]+)/gu)].map((m) => m[1]).sort(),
    ['public_spatial_private.spatial_placements', 'public_spatial_private.spatial_requests']);
  assert.match(sql, /CONSTRAINT spatial_placements_target_key UNIQUE \(experience_version_id, interpretation_id\)/u, 'one place per exact version and revision, ever');
  assert.match(sql, /REFERENCES public_semantic_private\.semantic_interpretations \(placement_id\) ON DELETE RESTRICT/u, 'bound to the exact reviewed revision');
  assert.match(sql, /REFERENCES public\.public_experience_versions \(id, experience_id\) ON DELETE RESTRICT/u, 'bound to the exact version');
  assert.doesNotMatch(sql, /REFERENCES (public|auth)\.users|REFERENCES public\.public_identities/u, 'no direct account edge (QAN-BL-ACCT-01)');
  const tables = [...sql.matchAll(/CREATE TABLE public_spatial_private\.[a-z_]+ \(([\s\S]*?)\n\);/gu)].map((m) => m[1]).join('\n');
  assert.equal((tables.match(/CONSTRAINT/gu) ?? []).length > 0, true);
  assert.doesNotMatch(tables, /\bmeaning\b|theme|lens_key|semantic_label|display_label|public_text|explanation|tsvector|jsonb/u, 'no semantic content is copied');
  assert.equal((sql.match(/EXECUTE FUNCTION public_spatial_private\.reject_spatial_history_mutation_v1\(\)/gu) ?? []).length, 2, 'both append-only');
});

test('3 — the 0096 / 0097 reconciliation: the private constants and the frozen descriptor readers never reach the Product', () => {
  const sql = sqlCode(read(MIGRATION));
  const owned = sql.slice(sql.indexOf('CREATE SCHEMA public_spatial_private;'), sql.indexOf('ALTER TABLE public_spatial_private.spatial_requests OWNER TO postgres;'));
  assert.ok(owned.length > 1000, 'the owned section is found');
  assert.doesNotMatch(owned, /semantic_label|s5-03a\.private|S5-03A_PRIVATE|resolve_public_experience_semantic_placement_v1|search_public_experiences_v1|resolve_public_lens_v1|resolve_public_panel_v1|public_experience_search_projection/u);
  assert.match(owned, /SELECT cp\.placement_id INTO v_current FROM public\.derive_public_experience_current_placement_v1/u, 'only the revision IDENTITY is taken from 0096');
  assert.match(owned, /FROM public_semantic_private\.semantic_interpretations i\s+JOIN public_semantic_private\.semantic_reviews r/u, 'meaning comes from the reviewed S5-03A row');
  for (const file of ['public-field.repository.ts', 'public-field.service.ts', 'public-spatial.repository.ts', 'public-spatial.service.ts']) {
    assert.doesNotMatch(code(`${API}/${file}`), /semantic_label|s5-03a\.private|S5-03A_PRIVATE|search_public_experiences_v1|resolve_public_lens_v1|resolve_public_panel_v1/u, file);
  }
});

test('4 — authority: the server derives the viewer, visibility, readiness and coordinates; a client sends navigation only', () => {
  const sql = sqlCode(read(MIGRATION));
  for (const name of [...OWNER, ...VIEWER]) {
    assert.match(sql, new RegExp(`'public\\.${name}\\(`, 'u'), `${name} is in the authenticated census`);
  }
  for (const name of SERVER) {
    assert.match(sql, new RegExp(`'public\\.${name}\\(`, 'u'), `${name} is in the server census`);
  }
  assert.match(sql, /FOREACH v_fn IN ARRAY v_server_commands LOOP\s+EXECUTE format\('GRANT EXECUTE ON FUNCTION %s TO service_role', v_fn\);/u);
  assert.doesNotMatch(sql, /GRANT[^;]*(derive_public_spatial_readiness_v1|derive_public_semantic_readiness_v1|publish_public_experience_v1|record_public_experience_semantic_placement_v1)/u);
  for (const [name, args] of [...sql.matchAll(/CREATE FUNCTION public\.([a-z_0-9]+)\(([^)]*)\)\s*RETURNS/gu)].map((m) => [m[1], m[2]])) {
    if (!OWNER.includes(name) && !VIEWER.includes(name)) continue;
    assert.doesNotMatch(args, /user|viewer|actor|identity|label|controller|authority|audience|visib|lifecycle|ready|readiness|version|lens|region|layout|model|rank|weight|popular|neighbo|distance|vector/u,
      `${name} takes no authority claim and no placement control`);
    if (name !== 'read_public_semantic_field_v1') assert.doesNotMatch(args, /_x|_y|coordinate/u, `${name} takes no coordinate`);
  }
  assert.match(sql, /v_user uuid := \(SELECT auth\.uid\(\)\);/u, 'the viewer is auth.uid()');
  assert.match(sql, /a\.admission = 'ADMITTED' AND a\.viewer_class = 'REGISTERED'/u, 'admitted by the frozen gate; signed-out stays closed');
  const spatial = code(`${API}/public-spatial.service.ts`);
  assert.match(spatial, /Object\.keys\(value\)\.some\(\(key\) => key !== 'commandId'\)/u, 'the owner sends a command id and nothing else');
});

test('5 — the provider-neutral placer: meaning in, one point out, refusing outside tests, no provider bound', () => {
  const port = code(`${API}/public-spatial-placer.ts`);
  assert.doesNotMatch(port, /from 'openai'|@anthropic-ai|anthropic|@google|gemini|qwen|deepseek|claude|kimi|glm|gpt-/iu, 'no provider is bound');
  assert.match(port, /if \(environment\.NODE_ENV === 'test'\) return new FakePublicSpatialPlacer\(\);\n\s+return new UnconfiguredPublicSpatialPlacer\(\);/u);
  assert.match(port, /exactKeys\(value, \['x', 'y', 'layoutVersion'\]\)/u, 'exactly one point and its layout version');
  const input = port.slice(port.indexOf('export interface PublicSpatialPlacementInput'), port.indexOf('export interface PublicSpatialPlacement {'));
  assert.deepEqual([...input.matchAll(/readonly ([a-zA-Z]+):/gu)].map((m) => m[1]),
    ['contract', 'semanticRevision', 'meaning', 'primaryThemes', 'secondaryThemes', 'semanticRegion'], 'the placer input is the reviewed meaning only');
  assert.match(code(`${API}/public-world.module.ts`), /provide: PUBLIC_SPATIAL_PLACER, useFactory: \(\) => createConfiguredPublicSpatialPlacer\(process\.env\)/u);
  const sql = sqlCode(read(MIGRATION));
  const reader = sql.slice(sql.indexOf('CREATE FUNCTION public_spatial_private.read_public_spatial_placement_input_v1'),
    sql.indexOf('CREATE FUNCTION public_spatial_private.commit_public_spatial_placement_v1'));
  assert.doesNotMatch(reader, /public_identit|display_label|label_mode|vitality|discussion|published_at|text_derivative_bodies|auth\.uid|provenance|shared_world|memor/u);
});

test('6 — the API boundary: five viewer reads, two owner routes, census classes, nothing published', () => {
  const field = code(`${API}/public-field.controller.ts`);
  assert.match(field, /@Controller\('public\/field'\)\n@UseGuards\(SupabaseAuthGuard\)/u);
  assert.deepEqual([...field.matchAll(/@(Get|Post|Put|Delete|Patch)\(([^)]*)\)/gu)].map((m) => `${m[1]} ${m[2]}`), ['Get ', "Get 'search'", "Get 'experiences/:experienceId'"]);
  const spatial = code(`${API}/public-spatial.controller.ts`);
  assert.match(spatial, /@Controller\('public\/authoring\/drafts\/:experienceId\/place'\)\n@UseGuards\(SupabaseAuthGuard\)/u);
  assert.deepEqual([...spatial.matchAll(/@(Get|Post|Put|Delete|Patch)\(([^)]*)\)/gu)].map((m) => `${m[1]} ${m[2]}`), ['Get ', 'Post ']);
  const census = code('apps/api/src/http-security/route-rate-limit.census.ts');
  for (const [route, cls] of [['GET /public/authoring/drafts/:experienceId/place', 'AUTHENTICATED'], ['POST /public/authoring/drafts/:experienceId/place', 'SECURITY_SENSITIVE'],
    ['GET /public/field', 'AUTHENTICATED'], ['GET /public/field/search', 'AUTHENTICATED'], ['GET /public/field/experiences/:experienceId', 'AUTHENTICATED']]) {
    assert.match(census, new RegExp(`'${route.replace(/\//gu, '\\/')}': '${cls}'`, 'u'));
  }
  assert.doesNotMatch(census, /'[A-Z]+ \/public\/[^']*publish/u, 'no publish route exists');
  for (const file of ['public-field.controller.ts', 'public-field.service.ts', 'public-field.repository.ts', 'public-spatial.controller.ts',
    'public-spatial.service.ts', 'public-spatial.repository.ts', 'public-spatial-placer.ts']) {
    const text = code(`${API}/${file}`);
    assert.doesNotMatch(text, /publish_|PUBLISHED|prerequisite|clearance|CLEARED/u, `${file} names no publication`);
    assert.doesNotMatch(text, /console\.|Logger|memory|humanIntelligence|hypothes|provenance|matching|ModelRouter/iu, `${file} logs nothing and holds no private context`);
  }
});

test('7 — mobile: one Public field with its own camera and state; FAR / MID / NEAR; no relation line, rank or feed', () => {
  for (const file of FIELD_FILES) {
    const text = code(`${MOBILE}/${file}`);
    assert.doesNotMatch(text, /from '\.\.\/\.\.\/state'|CanonicalStore|SemanticDepth|useMapPanGesture|useMapSemanticZoomGesture|integration\//u, `${file} holds no Personal Map state`);
    assert.doesNotMatch(text, /<Line|<Path|<Svg|viewCount|view_count|\brank\b|popular|trending|similar|proxim/iu, `${file} draws nothing inferred and ranks nothing`);
    // RE-ANCHORED by S5-03C (validation only): the field now carries the EXPLICIT relations the server serves — through
    // the panel read (client, controller) into the view's connection slot. Every other S5-03B field file still names no
    // relation at all; S5-03C's own contract pins that the relation comes from the server's explicit read alone.
    if (!['public-world/field/public-field-controller.ts', 'public-world/field/PublicFieldView.tsx', 'runtime-entry/public-field-api.ts'].includes(file)) {
      assert.doesNotMatch(text, /relation/iu, `${file} names no relation`);
    }
    if (!file.endsWith('field-copy.ts')) assert.doesNotMatch(text, /['"`][^'"`\n]*[؀-ۿ][^'"`\n]*['"`]/u, `${file} carries no Arabic literal`);
    assert.doesNotMatch(text, /publish_|'PUBLISHED'|"PUBLISHED"|s5-03a\.private|S5-03A_PRIVATE/u, `${file} names no publication and no placeholder`);
  }
  const camera = code(`${MOBILE}/public-world/field/public-field-camera.ts`);
  assert.match(camera, /PUBLIC_FIELD_DEPTHS = Object\.freeze\(\['FAR', 'MID', 'NEAR'\] as const\)/u);
  // Phase 2: the Map's own metric and math. FAR is DEFAULT_MAP_SCALE, each rung one frozen ×8 reinforcement, the pan is
  // the Map's pan; no camera is fitted to the content, and no projection / footprint / pan arithmetic of its own remains.
  assert.match(camera, /FAR: DEFAULT_MAP_SCALE,/u, 'FAR is the Map default scale');
  assert.match(camera, /reinforcedScale\(DEFAULT_MAP_SCALE, 'IN'\)/u, 'the frozen ×8 reinforcement is reused');
  assert.match(camera, /panFromTranslation\(camera, translationX, translationY\)/u, 'the Map pan is reused');
  assert.match(camera, /from '\.\.\/\.\.\/map\/world'/u, 'the exact world primitives are reused');
  assert.doesNotMatch(camera, /fittedCamera|ratioToFinite|roundDiv|clampBigInt|POINT_SUBDIVISION|scaleBy|canonicalWorldAddress\(/u, 'no second projection, footprint, pan or zoom math');
  assert.doesNotMatch(code(`${MOBILE}/public-world/field/public-field-controller.ts`), /fittedCamera|ratioToFinite|roundDiv/u, 'no camera fitted to what the World holds');
  const area = code(`${MOBILE}/public-world/PublicWorldArea.tsx`);
  assert.match(area, /<PublicLivingAnalysis controller=\{controller\.field\}/u);
  assert.match(code(`${MOBILE}/integration/runtime/integration-runtime.ts`), /field: createPublicFieldController\(\{ transport: publicTransport\.field \?\? null, isCurrent, foreground: entry\.foreground \}\)/u);
  assert.match(code(`${MOBILE}/runtime-entry/public-world-api.ts`), /this\.field = new PublicFieldApiClient\(config\);/u, 'on the same identity-bound transport');
  assert.doesNotMatch(code(`${MOBILE}/runtime-entry/index.ts`), /export \{[^}]*PublicFieldApiClient/u, 'no new runtime-barrel value');
  const surface = code(`${MOBILE}/public-world/field/PublicLivingAnalysis.tsx`);
  assert.match(surface, /if \(!local\) return undefined;\n\s+const subscription = BackHandler\.addEventListener/u, 'Back is registered only for the panel or the search');
  // Phase 2: the field declares no animation of its own; any travel is the shared presentation camera's, which honours
  // reduced motion exactly as it does for the Personal Map.
  for (const file of ['PublicLivingAnalysis.tsx', 'PublicFieldView.tsx']) {
    assert.doesNotMatch(code(`${MOBILE}/public-world/field/${file}`), /withTiming|withSpring|withDecay|Animated\./u, `${file}: no animation of its own`);
  }
  const client = code(`${MOBILE}/runtime-entry/public-field-api.ts`);
  const posts = [...client.matchAll(/this\.exchange\('POST', [^\n]*?, (\{[^{}]*\})\);/gu)].map((m) => m[1]);
  assert.deepEqual(posts, ['{ commandId }'], 'one POST, carrying a command id only');
});

test('8 — the S5-03B Product Copy Gate: one gate, CLOSED by the Product Owner, every new row APPROVED, frozen words reused', () => {
  const copy = read(`${MOBILE}/public-world/field/field-copy.ts`);
  // R2 census (Product Owner decision D3): the rows of the removed + / − / ○ controls are RETIRED, not approved.
  assert.ok(copy.includes("status: 'S5-03B PRODUCT COPY GATE — CLOSED — 13 rows APPROVED (Product Owner, 2026-10-07; 3 rows RETIRED)'"));
  assert.equal((copy.match(/\/\/ APPROVED — S5-03B Product Copy Gate \(Product Owner, 2026-10-07/gu) ?? []).length, 26, '13 rows, Arabic and English');
  assert.ok(copy.includes('  proposed: [],'), 'no row is left PROPOSED');
  assert.doesNotMatch(copy, /PROPOSED — S5-03B/u, 'no row is left PROPOSED');
  for (const approved of ["fieldLabel: 'خريطة المعاني في العالم العام'", "empty: 'لا يوجد شيء في العالم العام بعد.'"]) {
    assert.ok(copy.includes(approved), `the Product Owner's Arabic wording: ${approved}`);
  }
  assert.ok(copy.includes("retired: ['closer', 'farther', 'wholeWorld'],"), 'the three control rows are retired');
  assert.doesNotMatch(copy, /^\s+(closer|farther|wholeWorld):/mu, 'a retired row has no text in either language');
  for (const reused of ['moreDetail: analysis.moreDetail', 'lessDetail: analysis.lessDetail']) assert.ok(copy.includes(reused), `the accessible step reuses ${reused}`);
  for (const reused of ['back: shared.back', 'cancel: shared.cancel', 'retry: shared.retry', 'analysisItem: authoring.analysisItem',
    'primaryHeading: semantic.primaryHeading', 'secondaryHeading: semantic.secondaryHeading']) assert.ok(copy.includes(reused), reused);
  assert.doesNotMatch(code(`${MOBILE}/public-world/field/field-copy.ts`), /coordinate|إحداثي|\brank\b|popular|views|lens|PUBLISHED/u);
  assert.ok(read(`${MOBILE}/public-authoring/semantic-copy.ts`).includes("status: 'S5-03A PRODUCT COPY GATE — CLOSED — 21 rows APPROVED (Product Owner, 2026-10-06)'"), 'the S5-03A gate is untouched');
});

test('9 — governance: the record, the backlog and the locators tell the same truth', () => {
  const record = read(RECORD);
  assert.match(record, /^# QANDEEL — S5-03B Public Semantic Field \+ Stable Spatial Placement \+ Viewer Runtime — Implementation Record v1/u);
  assert.match(record, /c9338af9ecbfcecccc281f96f52fab335ad9bc7b/u);
  assert.match(record, /\*\*`QAN-BL-ACCT-01 — HIGH \/ OPEN`\*\*/u);
  assert.match(record, /\*\*Orphan gaps = 0\*\*/u);
  for (const section of ['Stable spatial placement', 'The placer boundary', 'The viewer read boundary', 'FAR / MID / NEAR', 'Search and panel',
    'Relation lines', 'MATERIAL / REASONING', 'Product Copy Gate', 'Validation', 'Failure classification', 'Gap Matrix', 'Remaining Stage-5 ownership']) {
    assert.ok(record.includes(section), `the record carries: ${section}`);
  }
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  assert.match(backlog, /\| `QAN-BL-ACCT-01` \| [^\n]* \| `UNASSIGNED` \| `HIGH` \| `OPEN — UNASSIGNED` \|/u);
  assert.match(backlog, /\*\*Current-truth note \(S5-03B, 2026-10-06\)\.\*\*/u);
  assert.match(backlog, /\*\*S5-03B reconciliation \(2026-10-06; not merged\)\.\*\*/u);
  assert.match(backlog, /\| `S5-03B — Public Semantic Field \+ Stable Spatial Placement \+ Viewer Runtime` \| none — no item names it;/u);
  // RE-ANCHORED by S5-03C (validation only): PR #317 is merged. The record and the backlog keep their pre-merge evidence
  // (the "(2026-10-06; not merged)" reconciliation heading above is history, not current truth); the locators now say
  // S5-03B is DONE / MERGED, S5-03C is ACTIVE and the current implementation task.
  if (existsSync(new URL('QANDEEL_CURRENT_STATE.md', root))) {
    const state = read('QANDEEL_CURRENT_STATE.md');
    assert.match(state, /\| S5-03B — Public Semantic Field \+ Stable Spatial Placement \+ Viewer Runtime \(migration `0145`\) \| \*\*`DONE \/ MERGED` through PR #317 at `afd5e8caecc06884b5adfdb381eef8e650e03c1f`\*\*/u);
    assert.doesNotMatch(state, /\| S5-03B — Public Semantic Field \+ Stable Spatial Placement \+ Viewer Runtime \(migration `0145`\) \| \*\*ACTIVE/u, 'S5-03B is no longer ACTIVE');
    assert.match(state, /\| S5-03C — Public Explicit Relations \+ Integrity Closure \(migration `0146`\) \| \*\*(ACTIVE|`?CLOSED)/u, 'S5-03C is the current Stage-5 task');
    assert.match(state, /\| S5-03A — [^\n]*\*\*`MERGED \/ CLOSED` through PR #316 at `c9338af9ecbfcecccc281f96f52fab335ad9bc7b`\*\*/u);
  }
  if (existsSync(new URL('QANDEEL_PROJECT_MAP.md', root))) {
    const map = read('QANDEEL_PROJECT_MAP.md');
    assert.match(map, /> \*\*CURRENT IMPLEMENTATION TASK: S5-03C — Public Explicit Relations \+ Integrity Closure\*\*/u);
    assert.doesNotMatch(map, /> \*\*CURRENT IMPLEMENTATION TASK: S5-03B/u, 'S5-03B is no longer the current task');
    assert.match(map, /`S5-03B — Public Semantic Field \+ Viewer Runtime` = \*\*`DONE \/ MERGED` through PR #317 at `afd5e8caecc06884b5adfdb381eef8e650e03c1f`\*\*/u);
    assert.match(map, /\*\(Historical: S5-03B was the current task until PR #317 merged as `afd5e8caecc06884b5adfdb381eef8e650e03c1f`/u);
  }
});

test('10 — R1/R2: the field is painted in the frozen Living Analysis World, and no client cache is a source of display', () => {
  // Phase 2: the field is painted by the ONE generic Living Analysis World renderer the Personal Map paints through, and
  // its distance is read from its camera on the Map's own footing (FAR 0, MID ½, NEAR 1 at the Map's own metric).
  assert.equal(existsSync(new URL(`${MOBILE}/public-world/field/PublicFieldWorld.tsx`, root)), false, 'no parallel world module');
  // R2 (controlled re-anchor): the presentation camera, the frame and the world's expression are no longer the field's
  // own calls — they are the ONE Living Analysis world view's (`useWorldView`), which the field consumes.
  const surface = code(`${MOBILE}/public-world/field/PublicFieldView.tsx`);
  for (const seam of ['<WorldCanvas<PublicWorldNode>', 'useWorldView<PublicFieldCamera, PublicWorldNode, PublicFieldOutcome>({', 'inspection: null,',
    'membership: null,', 'hostOf={() => undefined}']) assert.ok(surface.includes(seam), seam);
  const mark = code(`${MOBILE}/public-world/field/PublicExperienceMark.tsx`);
  assert.ok(mark.includes('<WorldMark'), 'a Public Experience is made of the world material');
  assert.ok(mark.includes('shape={{ path: neutralCircle(x, y, r), stroked: false, limbAngle: 0 }}'), 'in a neutral circle (D2)');
  assert.ok(code(`${MOBILE}/public-world/field/public-field-projection.ts`).includes('projectAddress(camera, envelope, entry.address)'), 'the Map projection');
  // A Public Experience is not a Personal Thread / Reading: no Personal morphology, no tether, no line, no colour of its own.
  for (const file of ['PublicLivingAnalysis.tsx', 'PublicFieldView.tsx', 'PublicExperienceMark.tsx', 'public-field-projection.ts']) {
    const text = code(`${MOBILE}/public-world/field/${file}`);
    // RE-ANCHORED by S5-03C (validation only): PublicFieldView may fill the renderer's optional connection slot, and only
    // with the S5-03C explicit relation lines (`PublicRelationLines`); it still draws no tether, Path or Line itself.
    assert.doesNotMatch(text, /WorldObject|WorldTether|RegisterMark|morphologyPath|<Path|<Line/u, `${file}: no Personal morphology and no line of its own`);
    if (file === 'PublicFieldView.tsx') {
      assert.match(text, /renderConnections=\{\(_plane, \{ S, response \}\) => \(\n\s+<PublicRelationLines segments=\{segments\}/u, 'the only connection is the explicit relation line');
    } else {
      assert.doesNotMatch(text, /renderConnections/u, `${file}: no connection`);
    }
    assert.doesNotMatch(text, /['"]#[0-9a-fA-F]{3,8}['"]|rgba?\(\d|hsla?\(\d/u, `${file}: no colour of its own`);
  }
  const controller = code(`${MOBILE}/public-world/field/public-field-controller.ts`);
  assert.equal(controller.includes('mergeServed'), false, 'a read replaces the field; nothing older is kept to be shown again');
  assert.equal(controller.includes("state.camera.depth === 'FAR'"), false, 'FAR navigation is not exempt from reading again');
  // R2 (Product Owner decision D3): the ○ control and its act are removed. The World as a whole is where every ENTRY
  // starts, read fresh, with nothing held — no field place, no focus, no search result — on display while it is read.
  assert.doesNotMatch(controller, /\bwholeWorld\(|reloadWorld/u, 'no whole-World act without its control');
  assert.ok(controller.includes("publish({ ...INITIAL, status: 'LOADING' });"), 'an entry shows nothing held while the World is read');
  assert.ok(controller.includes('const answer = await transport.field(WHOLE_WORLD)'), 'an entry reads the whole World');
  // R2: every navigation asks again for everything on display — the glass, the open search, the focused panel.
  assert.ok(controller.includes(`  const revalidateShown = () => {
    void refreshViewport();
    if (state.focus !== null) void openPanel(state.focus.id);
    if (state.search.open && lastQuery !== null) runSearch(lastQuery);
  };`), 'one revalidation of everything shown');
  assert.ok(controller.includes(`  const setCamera = (camera: PublicFieldCamera) => {
    publish({ camera });
    revalidateShown();
  };`), 'every camera move revalidates everything shown');
  // R2: the whole-World act (and its re-run of the open search) left with the ○ control; see the assertions above.
  assert.match(controller, /const failClosed = \(\) => \{[\s\S]*?entries: \[\], focus: null, search: NO_SEARCH/u, 'a read that cannot be made holds nothing');
  // The foreground reads again — through the runtime entry's ONE foreground signal, never a second AppState listener.
  assert.ok(controller.includes("foreground?.subscribe((next) => { if (next === 'ACTIVE') controller?.revalidate(); })"), 'the foreground reads again');
  for (const file of FIELD_FILES) assert.equal(code(`${MOBILE}/${file}`).includes('AppState'), false, `${file} installs no second lifecycle listener`);
  assert.ok(read(RECORD).includes("OPEN PRODUCT GAP — awaiting the Product Owner's ownership decision"), 'scale is not self-assigned');
});

test('11 — Phase 1 + 2: ONE generic Living Analysis World seam, extracted from Stage 2; the Personal Map is unchanged and Public paints through it', () => {
  const RENDERER = `${MOBILE}/map/renderer`;
  const worldCanvas = code(`${RENDERER}/WorldCanvas.tsx`);
  const worldSurface = code(`${RENDERER}/useWorldSurface.ts`);
  // R1 (S5-03B Task Contract amendment, 2026-10-07): the world VIEW joined the generic layer.
  const worldView = code(`${RENDERER}/WorldViewSurface.tsx`);
  // The generic layer reads no Personal truth: no canonical store, no Personal state, no disclosure, no inspection,
  // no accessible Map, and it dispatches nothing.
  for (const [file, text] of [['WorldCanvas.tsx', worldCanvas], ['useWorldSurface.ts', worldSurface], ['WorldViewSurface.tsx', worldView]]) {
    assert.doesNotMatch(text, /from '\.\.\/\.\.\/state'|from '\.\.\/projection'|from '\.\.\/inspection'|from '\.\.\/accessibility'|CanonicalStore|useSyncExternalStore|dispatch\(|MapScene|InspectionRef|THREAD|READING|EMERGING_FOCUS/u, `${file} reads no Personal truth`);
  }
  // The rebase is still issued from INSIDE the Skia root, as the LAST child of the plane, after the positions.
  assert.match(worldCanvas, /<PresentationCameraRebase motion=\{motion\} cameraCommit=\{cameraCommit\} \/>\s*\n\s*<\/Group>\s*\n\s*<\/Group>\s*\n\s*<\/WorldTone>/u);
  // The element keys the arrival registry is keyed by are unchanged.
  assert.ok(worldCanvas.includes('<WorldPlaceAtmosphere key={`atmosphere:${node.key}`}'), 'place atmosphere keys');
  assert.ok(worldCanvas.includes('<DisclosureArrival key={node.key} nodeKey={node.key} plan={arrivalOf(node)}'), 'arrival keys');
  const personalCanvas = code(`${RENDERER}/MapCanvas.tsx`);
  assert.ok(personalCanvas.includes('key={`tether:${node.key}`}'), 'tether keys');
  assert.ok(personalCanvas.includes("isPlace={(node) => node.locus?.kind === 'THREAD_HOME'}"), 'a Thread Home is the Personal place');
  // MapSurface stays the Personal owner: the store, the ONE freshness rule, the acts its gestures become, inspection,
  // accessibility. R1 (controlled re-anchor): the drag and the pinch are the world view's ONE mechanic
  // (`useWorldPanGesture` / `useWorldSemanticStepGesture`, the bodies of the unchanged `useMapPanGesture` /
  // `useMapSemanticZoomGesture`), so what MapSurface owns is the act each becomes in THIS store: `PAN` and `ZOOM_SEMANTIC`.
  const personalSurface = code(`${RENDERER}/MapSurface.tsx`);
  for (const owned of ['useSyncExternalStore(store.subscribe, store.getState)', 'mapContextFreshness(state, context)', 'panByTranslation(store,', 'zoomSemanticStep(store,', 'inspectObject(store, context,', '<MapAccessibilityLayer', 'owner: store,']) {
    assert.ok(personalSurface.includes(owned), `MapSurface still owns ${owned}`);
  }
  // The Personal golden equivalence is recorded and enforced (never regenerated in CI).
  const golden = read(`${MOBILE}/map/__tests__/golden-equivalence.test.tsx`);
  assert.match(golden, /expect\(produced\[name\]\)\.toEqual\(recorded\[name\]\)/u);
  assert.ok(existsSync(new URL(`${MOBILE}/map/__tests__/__golden__/personal-map.golden.json`, root)), 'the golden is committed');
  // Phase 2: the Public field adopted the seam and its parallel world module is gone.
  assert.equal(existsSync(new URL(`${MOBILE}/public-world/field/PublicFieldWorld.tsx`, root)), false, 'PublicFieldWorld is deleted in Phase 2');
  // R2 (controlled re-anchor): the field paints through the generic renderer inside the generic world view.
  const field = code(`${MOBILE}/public-world/field/PublicFieldView.tsx`);
  for (const seam of [/\bWorldCanvas\b/u, /\buseWorldView\b/u, /<WorldViewSurface\b/u]) assert.match(field, seam, `the Public field paints through ${seam}`);
  // The Public field takes nothing of the Personal owner: no store, no freshness rule, no Personal gestures or inspection.
  assert.doesNotMatch(field, /MapCanvas|MapSurface|mapContextFreshness|inspectObject|MapAccessibilityLayer|useMapPanGesture|useMapSemanticZoomGesture/u);
});

test('12 — R1: ONE Living Analysis SCREEN (not only one renderer); the Personal Analysis is its first consumer, unchanged', () => {
  // The screen is the surface's own: the Analysis place, the top band, T-11's responsive column, the measured world
  // frame and ONE support band — and it holds nothing of any world.
  const screen = code(`${MOBILE}/living-analysis/LivingAnalysisSurface.tsx`);
  assert.match(screen, /<AnalysisAppearanceScope>/u, 'the surface is the Analysis place, dark under every preference');
  for (const owner of ['<ResponsiveSurface', '<ResponsiveMapFrame', '<ResponsiveSupportBand', '<ResponsiveTimelineRow', '<ResponsiveChromeBand']) {
    assert.ok(screen.includes(owner), `the surface composes ${owner}`);
  }
  assert.match(screen, /support=\{timeline === null \? 'CHROME_ONLY' : 'TIMELINE_AND_CHROME'\}/u, 'no temporal track is a capability, never an empty instrument');
  assert.match(screen, /style=\{\{ backgroundColor: ink\.world \}\}/u, 'the Analysis ground');
  const specifiers = [...screen.matchAll(/from '([^']+)'/gu)].map((match) => match[1]);
  assert.deepEqual(specifiers, ['react', 'react-native', '../analysis-visual', '../appearance', '../map/camera', '../responsive'], 'the screen imports no world');
  // The world view is the surface's too: one presentation camera, one drag, one semantic step, for every world.
  const worldView = code(`${MOBILE}/map/renderer/WorldViewSurface.tsx`);
  for (const seam of ['useWorldMotion<C>(envelope)', 'useAuthorityGeneration(owner)', 'useWorldPanGesture<O>(', 'useWorldSemanticStepGesture<O>(', 'Gesture.Simultaneous(panGesture, zoomGesture)', 'useWorldFrame<C, N>(']) {
    assert.ok(worldView.includes(seam), `the world view owns ${seam}`);
  }
  // The Personal hooks keep their names and signatures, and are bindings of the one mechanic to the Personal store.
  const pan = code(`${MOBILE}/map/camera/useMapPanGesture.ts`);
  assert.match(pan, /export function useMapPanGesture\(store: CanonicalStore, options: MapPanGestureOptions\): MapPanGestureBinding \{\n\s*const commit = useCallback\(\(translationX: number, translationY: number\) => panByTranslation\(store, translationX, translationY\), \[store\]\);\n\s*return useWorldPanGesture<MapActionOutcome>\(\{ \.\.\.options, commit \}\);/u);
  const pinch = code(`${MOBILE}/map/camera/useMapSemanticZoomGesture.ts`);
  assert.match(pinch, /export function useMapSemanticZoomGesture\(store: CanonicalStore, options: MapSemanticZoomGestureOptions\): MapSemanticZoomGestureBinding \{\n\s*const step = useCallback\(\(direction: SemanticZoomDirection\) => zoomSemanticStep\(store, direction\), \[store\]\);\n\s*return useWorldSemanticStepGesture<MapActionOutcome>\(\{ \.\.\.options, step \}\);/u);
  // The Personal Analysis is composed ON the surface, with its own projection and capabilities and nothing else.
  const personal = code(`${MOBILE}/integration/composition/LivingAnalysisMap.tsx`);
  assert.match(personal, /<LivingAnalysisSurface\b/u);
  for (const capability of ['<MapSurface', '<TemporalOrientationLine', '<TemporalTargetLayer', '<OrientationChrome']) {
    assert.ok(personal.includes(capability), `the Personal world brings ${capability}`);
  }
  assert.doesNotMatch(personal, /<Responsive(Surface|MapFrame|SupportBand|TimelineRow|ChromeBand)\b/u, 'the Personal world builds no screen of its own');
  const depth = code(`${MOBILE}/integration/composition/DepthComposition.tsx`);
  assert.match(depth, /top=\{\{\s*content: \(\s*<AnalysisReturnBar/u, 'the way back to the Conversation stands in the surface top band');
  // The responsive default is the frozen composition.
  const plan = code(`${MOBILE}/responsive/plan.ts`);
  assert.match(plan, /export const SUPPORT_CAPABILITIES = Object\.freeze\(\['TIMELINE_AND_CHROME', 'CHROME_ONLY'\] as const\);/u);
  assert.match(plan, /if \(options\.support === 'CHROME_ONLY'\) \{/u, 'the default path is the frozen one; only CHROME_ONLY branches');
  // The screen golden was recorded BEFORE the extraction and is enforced, never regenerated in CI.
  const screenGolden = read(`${MOBILE}/integration/__tests__/living-analysis-screen-golden.test.tsx`);
  assert.match(screenGolden, /expect\(produced\[name\]\)\.toEqual\(recorded\[name\]\)/u);
  assert.ok(existsSync(new URL(`${MOBILE}/integration/__tests__/__golden__/living-analysis-screen.golden.json`, root)), 'the screen golden is committed');
  // R1 adopted nothing for Public; R2 (after the Product Owner approved R1) is test 13.
});

test('13 — R2: Public is a consumer of the ONE Living Analysis surface — no second screen, no second world view', () => {
  const FIELD = `${MOBILE}/public-world/field`;
  // The Public field's own full-screen composition is gone.
  assert.equal(existsSync(new URL(`${FIELD}/PublicSemanticField.tsx`, root)), false, 'no second screen implementation');
  // The root keeps the entry verdict, its states and authoring routing, and hands its field to the shared surface.
  const area = code(`${MOBILE}/public-world/PublicWorldArea.tsx`);
  assert.match(area, /<PublicLivingAnalysis controller=\{controller\.field\} language=\{language\} insets=\{insets\} heading=\{heading\} \/>/u);
  assert.match(area, /<AnalysisAppearanceScope><AppearanceStatusBar \/><\/AnalysisAppearanceScope>/u, 'the status bar is decided for the Analysis ground (D1)');
  // The Public screen IS the Living Analysis surface, with Public capabilities: no temporal track (CHROME_ONLY), the
  // heading and search in the top band (D4), the field's panel / results / state in the chrome band (D2).
  const screen = code(`${FIELD}/PublicLivingAnalysis.tsx`);
  assert.match(screen, /<LivingAnalysisSurface\b/u);
  assert.ok(screen.includes('timeline={null}'), 'no Timeline, no Live, no Return-to-Live');
  assert.match(screen, /top=\{\{\s*content: \(\s*<PublicBand\b[\s\S]*?<SearchRow\b/u, 'the heading and the search stand in the top band');
  assert.match(screen, /chrome=\{\(composition\) => <FieldChrome\b/u, 'the field speaks in the chrome band');
  assert.match(screen, /world=\{\(envelope\) => <PublicFieldView\b/u, 'the field is the world in the measured frame');
  assert.doesNotMatch(screen, /<Responsive(Surface|MapFrame|SupportBand|TimelineRow|ChromeBand)\b|AnalysisAppearanceScope/u, 'Public builds no screen of its own');
  assert.doesNotMatch(screen, /PANEL_MAX|SEARCH_ROW|RESULTS_MAX|position: 'absolute'|maxHeight/u, 'no fixed full-screen geometry, no floating overlay panel');
  // The world view is the shared one: no recogniser, presentation camera or frame of Public's own.
  const world = code(`${FIELD}/PublicFieldView.tsx`);
  assert.match(world, /useWorldView<PublicFieldCamera, PublicWorldNode, PublicFieldOutcome>\(\{\s*owner: controller,/u, 'the Public controller is the authority the world view draws under');
  assert.match(world, /<WorldViewSurface\b/u);
  for (const file of FIELD_FILES.filter((path) => path.startsWith('public-world/field/'))) {
    assert.doesNotMatch(code(`${MOBILE}/${file}`), /GestureDetector|Gesture\.(Pan|Pinch|Simultaneous)|useWorldMotion|useWorldFrame|worldPresentation\(|PINCH_STEP|SEMANTIC_ZOOM_REINFORCEMENT/u, `${file} has no world-view mechanics of its own`);
    assert.doesNotMatch(code(`${MOBILE}/${file}`), /CameraIntent|decodeCameraIntent|panByTranslation|zoomSemanticStep|from '\.\.\/\.\.\/state'/u, `${file} takes no Personal camera semantics`);
  }
  // The acts the shared drag and step become are the Public controller's own, along the Public ladder.
  const controller = code(`${FIELD}/public-field-controller.ts`);
  assert.match(controller, /step\(direction: SemanticZoomDirection\): PublicFieldOutcome;/u);
  assert.match(controller, /pan\(translationX: number, translationY: number\): PublicFieldOutcome;/u);
  assert.doesNotMatch(controller, /closer\(|farther\(|wholeWorld\(/u);
  // D3: no visible + / − / ○; the non-gesture semantic step is the generic surface's accessible route.
  for (const file of ['PublicLivingAnalysis.tsx', 'PublicFieldView.tsx']) {
    const text = code(`${FIELD}/${file}`);
    assert.doesNotMatch(text, /\{'\+'\}|\{'−'\}|\{'○'\}|copy\.(closer|farther|wholeWorld)/u, `${file} draws no zoom control`);
  }
  assert.match(world, /semanticStep=\{\{ label: copy\.fieldLabel, language, moreDetail: copy\.moreDetail, lessDetail: copy\.lessDetail, onStep: view\.semanticStep \}\}/u);
  const worldView = code(`${MOBILE}/map/renderer/WorldViewSurface.tsx`);
  assert.match(worldView, /const semanticStep = useCallback\(\s*\(direction: SemanticZoomDirection\) => \{\s*if \(!enabled\) return;\s*const outcome = step\(direction\);/u, 'the accessible step is the same step the pinch commits');
  // The Personal Map does not use it (its own accessible layer already offers the step), so its tree is unchanged.
  assert.doesNotMatch(code(`${MOBILE}/map/renderer/MapSurface.tsx`), /semanticStep=/u);
  // Public's content stays Public's: the projection, the neutral mark, the MID labels inside the world frame.
  assert.ok(world.includes('placePublicField({ camera, envelope,'), 'the Public projection');
  assert.ok(world.includes('<PublicExperienceMark'), 'the neutral Public Experience shape');
  assert.ok(world.includes('layoutFieldLabels(labelled, presented, envelope, language)'), 'the MID labels, inside the world frame');
});
