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
const FIELD_FILES = ['public-world/field/public-field-camera.ts', 'public-world/field/public-field-controller.ts',
  'public-world/field/PublicSemanticField.tsx', 'public-world/field/PublicFieldWorld.tsx', 'public-world/field/field-copy.ts', 'runtime-entry/public-field-api.ts',
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
    assert.doesNotMatch(text, /relation|<Line|<Path|<Svg|viewCount|view_count|\brank\b|popular|trending/iu, `${file} draws no relation and ranks nothing`);
    if (!file.endsWith('field-copy.ts')) assert.doesNotMatch(text, /['"`][^'"`\n]*[؀-ۿ][^'"`\n]*['"`]/u, `${file} carries no Arabic literal`);
    assert.doesNotMatch(text, /publish_|'PUBLISHED'|"PUBLISHED"|s5-03a\.private|S5-03A_PRIVATE/u, `${file} names no publication and no placeholder`);
  }
  const camera = code(`${MOBILE}/public-world/field/public-field-camera.ts`);
  assert.match(camera, /PUBLIC_FIELD_DEPTHS = Object\.freeze\(\['FAR', 'MID', 'NEAR'\] as const\)/u);
  assert.match(camera, /SEMANTIC_ZOOM_REINFORCEMENT_DENOMINATOR/u, 'the frozen ×8 reinforcement is reused');
  assert.match(camera, /from '\.\.\/\.\.\/map\/world'/u, 'the exact world primitives are reused');
  const area = code(`${MOBILE}/public-world/PublicWorldArea.tsx`);
  assert.match(area, /<PublicSemanticField controller=\{controller\.field\}/u);
  assert.match(code(`${MOBILE}/integration/runtime/integration-runtime.ts`), /field: createPublicFieldController\(\{ transport: publicTransport\.field \?\? null, isCurrent, foreground: entry\.foreground \}\)/u);
  assert.match(code(`${MOBILE}/runtime-entry/public-world-api.ts`), /this\.field = new PublicFieldApiClient\(config\);/u, 'on the same identity-bound transport');
  assert.doesNotMatch(code(`${MOBILE}/runtime-entry/index.ts`), /export \{[^}]*PublicFieldApiClient/u, 'no new runtime-barrel value');
  const surface = code(`${MOBILE}/public-world/field/PublicSemanticField.tsx`);
  assert.match(surface, /if \(!local\) return undefined;\n\s+const subscription = BackHandler\.addEventListener/u, 'Back is registered only for the panel or the search');
  assert.doesNotMatch(surface, /withTiming|withSpring|Animated\./u, 'nothing animates: reduced-motion parity by construction');
  const client = code(`${MOBILE}/runtime-entry/public-field-api.ts`);
  const posts = [...client.matchAll(/this\.exchange\('POST', [^\n]*?, (\{[^{}]*\})\);/gu)].map((m) => m[1]);
  assert.deepEqual(posts, ['{ commandId }'], 'one POST, carrying a command id only');
});

test('8 — the S5-03B Product Copy Gate: one gate, OPEN, every new row PROPOSED, frozen words reused', () => {
  const copy = read(`${MOBILE}/public-world/field/field-copy.ts`);
  assert.ok(copy.includes("status: 'S5-03B PRODUCT COPY GATE — OPEN — 16 rows PROPOSED'"));
  assert.equal((copy.match(/\/\/ PROPOSED — S5-03B Product Copy Gate/gu) ?? []).length, 32, '16 rows, Arabic and English');
  assert.doesNotMatch(copy, /\/\/ APPROVED — S5-03B/u, 'nothing self-approved');
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
  if (existsSync(new URL('QANDEEL_CURRENT_STATE.md', root))) {
    const state = read('QANDEEL_CURRENT_STATE.md');
    assert.match(state, /\| S5-03B — Public Semantic Field \+ Stable Spatial Placement \+ Viewer Runtime \(migration `0145`\) \| \*\*ACTIVE/u);
    assert.match(state, /\| S5-03A — [^\n]*\*\*`MERGED \/ CLOSED` through PR #316 at `c9338af9ecbfcecccc281f96f52fab335ad9bc7b`\*\*/u);
  }
  if (existsSync(new URL('QANDEEL_PROJECT_MAP.md', root))) {
    assert.match(read('QANDEEL_PROJECT_MAP.md'), /> \*\*CURRENT IMPLEMENTATION TASK: S5-03B — Public Semantic Field \+ Stable Spatial Placement \+ Viewer Runtime/u);
  }
});

test('10 — R1/R2: the field is painted in the frozen Living Analysis World, and no client cache is a source of display', () => {
  const world = code(`${MOBILE}/public-world/field/PublicFieldWorld.tsx`);
  // The Stage-2 VPORT-01 owner is imported, never copied or re-styled: its strata and its mark material.
  assert.ok(world.includes("import { WorldAtmosphere, WorldGround, WorldPlaceAtmosphere, WorldTone, WorldVeil, scheduleAt, stratumDrift, useWorldResponse } from '../../map/visual';"));
  for (const element of ['<WorldTone>', '<WorldGround ', '<WorldAtmosphere ', '<WorldVeil ', '<WorldPlaceAtmosphere ']) assert.ok(world.includes(element), element);
  assert.ok(world.includes('markMaterial, mediumHue, worldPalette'), 'the canonical mark material and SELECTED tokens');
  // A Public Experience is not a Personal Thread / Reading: no Personal morphology, no tether, no line.
  assert.doesNotMatch(world, /WorldObject|WorldTether|RegisterMark|morphologyPath|<Path|<Line/u);
  // No colour of its own: every value comes from the generated world tokens.
  assert.doesNotMatch(world, /['"]#[0-9a-fA-F]{3,8}['"]|rgba?\(\d|hsla?\(\d/u);
  // Distance is read from the Public depth (the authority), on the Map's own logarithmic footing.
  assert.ok(world.includes('PUBLIC_FIELD_APPROACH: Readonly<Record<PublicFieldDepth, number>> = Object.freeze({ FAR: 0, MID: 0.5, NEAR: 1 })'));
  const controller = code(`${MOBILE}/public-world/field/public-field-controller.ts`);
  assert.equal(controller.includes('mergeServed'), false, 'a read replaces the field; nothing older is kept to be shown again');
  assert.equal(controller.includes("state.camera.depth === 'FAR'"), false, 'FAR navigation is not exempt from reading again');
  assert.match(controller, /wholeWorld\(\) \{[\s\S]*?void reloadWorld\(\);/u, 'the whole World is read again, never re-framed from what is held');
  assert.ok(controller.includes("publish({ status: 'LOADING', entries: [], search: state.search.open ? { open: true, status: 'IDLE', results: [] } : NO_SEARCH });"), 'nothing held — no field place, no search result — is on display while the World is read');
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
  assert.ok(controller.includes(`      void reloadWorld();
      if (state.search.open && lastQuery !== null) runSearch(lastQuery);`), 'the whole World re-runs the open search');
  assert.match(controller, /const failClosed = \(\) => \{[\s\S]*?entries: \[\], focus: null, search: NO_SEARCH/u, 'a read that cannot be made holds nothing');
  // The foreground reads again — through the runtime entry's ONE foreground signal, never a second AppState listener.
  assert.ok(controller.includes("foreground?.subscribe((next) => { if (next === 'ACTIVE') controller?.revalidate(); })"), 'the foreground reads again');
  for (const file of FIELD_FILES) assert.equal(code(`${MOBILE}/${file}`).includes('AppState'), false, `${file} installs no second lifecycle listener`);
  assert.ok(read(RECORD).includes("OPEN PRODUCT GAP — awaiting the Product Owner's ownership decision"), 'scale is not self-assigned');
});

test('11 — Phase 1: ONE generic Living Analysis World seam, extracted from Stage 2; the Personal Map is unchanged and Public has not adopted it yet', () => {
  const RENDERER = `${MOBILE}/map/renderer`;
  const worldCanvas = code(`${RENDERER}/WorldCanvas.tsx`);
  const worldSurface = code(`${RENDERER}/useWorldSurface.ts`);
  // The generic layer reads no Personal truth: no canonical store, no Personal state, no disclosure, no inspection,
  // no accessible Map, and it dispatches nothing.
  for (const [file, text] of [['WorldCanvas.tsx', worldCanvas], ['useWorldSurface.ts', worldSurface]]) {
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
  // MapSurface stays the Personal owner: the store, the ONE freshness rule, the gestures, inspection, accessibility.
  const personalSurface = code(`${RENDERER}/MapSurface.tsx`);
  for (const owned of ['useSyncExternalStore(store.subscribe, store.getState)', 'mapContextFreshness(state, context)', 'useMapPanGesture(store,', 'useMapSemanticZoomGesture(store,', 'inspectObject(store, context,', '<MapAccessibilityLayer', 'owner: store,']) {
    assert.ok(personalSurface.includes(owned), `MapSurface still owns ${owned}`);
  }
  // The Personal golden equivalence is recorded and enforced (never regenerated in CI).
  const golden = read(`${MOBILE}/map/__tests__/golden-equivalence.test.tsx`);
  assert.match(golden, /expect\(produced\[name\]\)\.toEqual\(recorded\[name\]\)/u);
  assert.ok(existsSync(new URL(`${MOBILE}/map/__tests__/__golden__/personal-map.golden.json`, root)), 'the golden is committed');
  // No Public adoption in Phase 1: the Public field still paints through its own module, which still exists.
  assert.ok(existsSync(new URL(`${MOBILE}/public-world/field/PublicFieldWorld.tsx`, root)), 'PublicFieldWorld is not deleted in Phase 1');
  for (const file of FIELD_FILES) assert.doesNotMatch(code(`${MOBILE}/${file}`), /WorldCanvas|useWorldMotion|useWorldFrame|WorldMark\b/u, `${file} has not adopted the seam yet (Phase 2)`);
});
