// S5-03A — Public Semantic Interpretation + Publisher Review: the cross-layer static contract.
//
// It pins what a text census can honestly pin — scope, the package-only input path, authority, the provider boundary, the
// absence of any publication path or map control, the Copy Gate and the lifecycle / backlog truth. Live behaviour (the
// flow, the version binding, the erasure, the race) is proven by database/verify-migration-0144.mjs against real
// PostgreSQL, the API spec and the mobile Jest suite; nothing here substitutes for them.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
/** Source with comments removed, so a sentence that EXPLAINS a ban never satisfies or violates it. */
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
const sqlCode = (text) => text.replace(/--.*$/gmu, '');

const MIGRATION = 'database/migrations/0144_public_semantic_interpretation_publisher_review_v1.sql';
const VERIFIER = 'database/verify-migration-0144.mjs';
const RECORD = 'docs/e2e/QANDEEL_S5_03A_PUBLIC_SEMANTIC_INTERPRETATION_PUBLISHER_REVIEW_IMPLEMENTATION_RECORD_v1.md';
const API = 'apps/api/src/public-world';
const MOBILE = 'apps/mobile/src';
const OWNER_COMMANDS = ['read_own_public_semantic_review_v1', 'request_own_public_semantic_proposal_v1',
  'request_own_public_semantic_correction_v1', 'commit_own_public_semantic_work_v1', 'accept_own_public_semantic_proposal_v1'];
const SERVER_COMMANDS = ['read_public_semantic_work_input_v1', 'record_public_semantic_work_outcome_v1'];
const MAP_CONTROL = /coordinate|\bx\b|\by\b|latitude|longitude|position|rank|weight|popular|proxim|near|vector|embedding|lens/iu;

test('1 — registered in the toolchain and both CI workflows; one forward migration after 0143', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['verify:public-semantic-interpretation-review:integration'], 'node --env-file-if-exists=.env database/verify-migration-0144.mjs');
  assert.equal(manifest.scripts['test:s5-03a-public-semantic-review-contract'], 'node --test tests/s5-03a-public-semantic-review-contract.test.mjs');
  const api = read('.github/workflows/api-ci.yml');
  assert.match(api, /run: npm run verify:public-semantic-interpretation-review:integration/u);
  assert.match(api, /run: npm run test:s5-03a-public-semantic-review-contract/u);
  const mobile = read('.github/workflows/mobile-ci.yml');
  assert.match(mobile, /run: npm run test:s5-03a-public-semantic-review-contract/u);
  assert.match(mobile, /'tests\/s5-03a-public-semantic-review-contract\.test\.mjs'/u);
  const files = readdirSync(new URL('database/migrations/', root)).filter((f) => f.endsWith('.sql')).sort();
  assert.equal(files[files.indexOf('0144_public_semantic_interpretation_publisher_review_v1.sql') - 1], '0143_public_authoring_rights_privacy_v1.sql');
  assert.ok(read(VERIFIER).length > 0);
});

test('2 — the frozen I-05 runtime is consumed, never replaced; no second interpretation history', () => {
  const sql = sqlCode(read(MIGRATION));
  assert.doesNotMatch(sql, /CREATE OR REPLACE FUNCTION|DROP FUNCTION|DROP TRIGGER|DISABLE TRIGGER|ALTER TABLE public\./u, 'no frozen object is replaced, dropped or altered');
  assert.doesNotMatch(sql, /INSERT INTO public\.|UPDATE public\.|DELETE FROM public\./u, 'S5-03A writes no frozen relation directly');
  assert.match(sql, /FROM public\.record_public_experience_semantic_placement_v1\(/u, 'every revision goes through the frozen 0096 writer');
  assert.match(sql, /public\.derive_public_experience_current_placement_v1\(/u, 'the current revision is the frozen derivation');
  assert.match(sql, /RAISE EXCEPTION 'PUBLIC_SEMANTIC_REVISION_ORDER_VIOLATED'/u, 'origin and frozen basis must agree');
  assert.match(sql, /CREATE SCHEMA public_semantic_private;/u);
  assert.deepEqual([...sql.matchAll(/CREATE TABLE ([a-z_.]+)/gu)].map((m) => m[1]).sort(), [
    'public_semantic_private.semantic_interpretations', 'public_semantic_private.semantic_reviews',
    'public_semantic_private.semantic_work', 'public_semantic_private.semantic_work_outcomes']);
  assert.doesNotMatch(sql, /REFERENCES (public|auth)\.users|REFERENCES public\.public_identities/u, 'no account edge (QAN-BL-ACCT-01)');
  assert.equal((sql.match(/EXECUTE FUNCTION public_semantic_private\.reject_semantic_history_mutation_v1\(\)/gu) ?? []).length, 4, 'four append-only relations');
});

test('3 — PUBLIC PACKAGE ONLY: one server-channel reader that touches nothing but the package', () => {
  const sql = sqlCode(read(MIGRATION));
  const reader = sql.slice(sql.indexOf('CREATE FUNCTION public_semantic_private.read_public_semantic_work_input_v1'),
    sql.indexOf('CREATE FUNCTION public_semantic_private.record_public_semantic_work_outcome_v1'));
  const tables = [...reader.matchAll(/(?:FROM|JOIN) (public(?:_semantic_private)?\.[a-z_]+)/gu)].map((m) => m[1]);
  assert.deepEqual([...new Set(tables)].sort(), ['public.public_experience_text_derivative_bodies', 'public.public_experience_versions',
    'public.publication_package_manifest_items', 'public_semantic_private.semantic_work', 'public_semantic_private.semantic_work_outcomes'],
  'the input reads the work, the version, the package items and their public bodies — nothing else');
  const owned = sql.slice(sql.indexOf('-- C. INTERNAL DERIVATIONS'), sql.indexOf('-- G. PRIVILEGES'));
  assert.doesNotMatch(owned, /provenance|shared_world|conversation_|memor|human_model|(^|[^a-z])him_|hypothes|matching|introduction|public\.users|public_identit|display_label|label_mode/u,
    'no S5-03A function reads anything private or the alias');
  // The deploy-time ban is part of the migration itself.
  assert.match(sql, /RAISE EXCEPTION 'S5-03A: % reaches beyond the exact public package or beyond READY_FOR_REVIEW'/u);
  // The API composes only the reader's rows.
  const service = code(`${API}/public-semantic.service.ts`);
  assert.match(service, /this\.repository\.workInput\(workId\)/u);
  for (const file of ['public-semantic.service.ts', 'public-semantic.repository.ts', 'public-semantic-interpreter.ts', 'public-semantic.controller.ts']) {
    assert.doesNotMatch(code(`${API}/${file}`), /memory|humanIntelligence|hypothes|SharedWorld|shared_world|provenance|matching|MODEL_ROUTER|ModelRouter|console\.|Logger/iu, `${file} holds no private context`);
  }
});

test('4 — authority: the client authors no proposal and supplies no identity, readiness or map control', () => {
  const sql = sqlCode(read(MIGRATION));
  const grants = [...sql.matchAll(/'(public(?:_semantic_private)?\.[a-z_0-9]+)\(/gu)].map((m) => m[1]);
  for (const name of [...OWNER_COMMANDS, ...SERVER_COMMANDS]) {
    assert.ok(grants.includes(`public.${name}`) && grants.includes(`public_semantic_private.${name}`), `${name} is in the privilege census`);
  }
  assert.match(sql, /FOREACH v_fn IN ARRAY v_server_commands LOOP\s+EXECUTE format\('GRANT EXECUTE ON FUNCTION %s TO service_role', v_fn\);/u, 'the server commands are the server channel\'s');
  assert.match(sql, /FOREACH v_fn IN ARRAY v_owner_commands LOOP\s+EXECUTE format\('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_fn\);/u);
  assert.doesNotMatch(sql, /GRANT[^;]*(record_public_experience_semantic_placement_v1|derive_public_semantic_readiness_v1|publish_public_experience_v1)/u);
  for (const [name, args] of [...sql.matchAll(/CREATE FUNCTION public\.([a-z_0-9]+)\(([^)]*)\)\s*RETURNS/gu)].map((m) => [m[1], m[2]])) {
    if (!OWNER_COMMANDS.includes(name)) continue;
    assert.doesNotMatch(args, /user|actor|identity|label|controller|approver|authority|audience|visib|lifecycle|readiness|fingerprint|digest|lens|placement/u, `${name} takes no authority input`);
    assert.doesNotMatch(args, MAP_CONTROL, `${name} takes no map control`);
  }
  // A commit re-derives the request from auth.uid(): only the requester adopts a work.
  assert.match(sql, /v_work\.request_ref IS DISTINCT FROM public_semantic_private\.derive_work_request_ref_v1\(\s+v_user,/u);
  // ASSURE-F05 by lineage, never by inspecting text (R1): no similarity threshold exists; nothing derived from the package
  // enters the immutable 0096 revision; an erasure of any package item erases the semantic content of that package.
  assert.doesNotMatch(sql, /copies_package|QUOTES_CONTENT|COPIES_PACKAGE|v_needle|strpos\(/u, 'no text is judged by its content');
  assert.match(sql, /'s5-03a\.private', 'S5-03A_PRIVATE_SEMANTIC_INTERPRETATION_V1'\) d;/u, 'the 0096 descriptor is content-free');
  assert.match(sql, /CREATE TRIGGER publication_package_item_erasure_reaches_semantics\s+AFTER UPDATE OF content_state ON public\.publication_package_manifest_items\s+FOR EACH ROW WHEN \(OLD\.content_state = 'CONTENT_PRESENT' AND NEW\.content_state = 'ERASED_BY_OWNER'\)/u);
  assert.equal((sql.match(/PERFORM public_semantic_private\.lock_current_package_v1\(/gu) ?? []).length, 5, 'every writer locks the package items');
});

test('5 — the provider boundary: neutral, deterministic under test, refusing otherwise, never the conversational router', () => {
  const port = code(`${API}/public-semantic-interpreter.ts`);
  assert.doesNotMatch(port, /from 'openai'|@anthropic-ai|anthropic|@google|gemini|qwen|deepseek|claude|gpt-/iu, 'no provider is bound');
  assert.match(port, /if \(environment\.NODE_ENV === 'test'\) return new FakePublicSemanticInterpreter\(\);\n\s+return new UnconfiguredPublicSemanticInterpreter\(\);/u,
    'the test implementation only under test; otherwise refuse — no fallback');
  assert.match(port, /throw new PublicSemanticInterpreterUnavailableError\(\);/u);
  assert.match(port, /exactKeys\(value, \['meaning', 'primaryThemes', 'secondaryThemes', 'explanation', 'placementIntent'\]\)/u, 'exactly the structured proposal');
  assert.match(code(`${API}/public-world.module.ts`), /provide: PUBLIC_SEMANTIC_INTERPRETER, useFactory: \(\) => createConfiguredPublicSemanticInterpreter\(process\.env\)/u);
  const types = read('apps/api/src/model-router/model-router.types.ts');
  assert.match(types, /task: 'CONVERSATIONAL_RESPONSE';/u, 'the conversational contract is not widened');
});

test('6 — the API boundary: four routes, owner RPCs on the caller token, server RPCs on the server channel', () => {
  const repository = code(`${API}/public-semantic.repository.ts`);
  assert.deepEqual([...repository.matchAll(/this\.rpc<[A-Za-z]+>\(token, '([a-z_]+_v1)'/gu)].map((m) => m[1]).sort(), [...OWNER_COMMANDS].sort());
  assert.deepEqual([...repository.matchAll(/this\.server\.rpc<[^>]+>\('([a-z_]+_v1)'/gu)].map((m) => m[1]).sort(), [...SERVER_COMMANDS].sort());
  assert.doesNotMatch(repository, /p_user|p_public_identity|p_controller|p_readiness|p_fingerprint/u);
  const controller = code(`${API}/public-semantic.controller.ts`);
  assert.match(controller, /@Controller\('public\/authoring\/drafts\/:experienceId\/semantic'\)\n@UseGuards\(SupabaseAuthGuard\)/u);
  assert.deepEqual([...controller.matchAll(/@(Get|Post|Put|Delete|Patch)\(([^)]*)\)/gu)].map((m) => `${m[1]} ${m[2]}`),
    ['Get ', "Post 'proposal'", "Post 'accept'", "Post 'correction'"]);
  assert.doesNotMatch(controller, /@Query\(/u);
  const census = code('apps/api/src/http-security/route-rate-limit.census.ts');
  for (const [route, cls] of [['GET /public/authoring/drafts/:experienceId/semantic', 'AUTHENTICATED'],
    ['POST /public/authoring/drafts/:experienceId/semantic/proposal', 'SECURITY_SENSITIVE'],
    ['POST /public/authoring/drafts/:experienceId/semantic/accept', 'AUTHENTICATED'],
    ['POST /public/authoring/drafts/:experienceId/semantic/correction', 'SECURITY_SENSITIVE']]) {
    assert.match(census, new RegExp(`'${route.replace(/\//gu, '\\/')}': '${cls}'`, 'u'));
  }
  const service = code(`${API}/public-semantic.service.ts`);
  assert.match(service, /commandOf\(body, \['commandId', 'interpretationId', 'meaning', 'primaryThemes', 'secondaryThemes'\]\)/u, 'a correction carries only the publisher\'s words');
});

test('7 — publication stays impossible from every layer', () => {
  const sql = sqlCode(read(MIGRATION));
  const owned = sql.slice(sql.indexOf('-- A. THE PRIVATE SCHEMA'), sql.indexOf('-- G. PRIVILEGES'));
  assert.doesNotMatch(owned, /publish_public_experience_v1|resolve_public_publication_prerequisites_v1|'PUBLISHED'|ABSENT_FROM_PUBLIC_WORLD|public_discussion|public_qandeel/u);
  assert.match(sql, /IF p\.prosrc !~ 'NOT_EVALUATED' OR p\.prosrc ~ '''CLEARED''' THEN/u, 'the seam must still answer NOT_EVALUATED');
  for (const file of ['public-semantic.controller.ts', 'public-semantic.service.ts', 'public-semantic.repository.ts', 'public-semantic-interpreter.ts']) {
    assert.doesNotMatch(code(`${API}/${file}`), /publish_|PUBLISHED|prerequisite|clearance|CLEARED/u, `${file}`);
  }
  for (const file of ['public-authoring/PublicSemanticReview.tsx', 'public-authoring/public-authoring-controller.ts', 'runtime-entry/public-semantic-api.ts']) {
    assert.doesNotMatch(code(`${MOBILE}/${file}`), /publish_|'PUBLISHED'|"PUBLISHED"/u, `${file} names no publication`);
  }
  assert.doesNotMatch(code('apps/api/src/http-security/route-rate-limit.census.ts'), /'[A-Z]+ \/public\/[^']*publish/u, 'no publish route exists');
});

test('8 — mobile: the semantic stage inside the S5-02 review, meaning only, no map, no Arabic literal in a surface', () => {
  const review = code(`${MOBILE}/public-authoring/PublicSemanticReview.tsx`);
  assert.doesNotMatch(review, /coordinate|latitude|longitude|vector|embedding|lens|placement|prompt|model/iu, 'no map control or internal term');
  assert.doesNotMatch(code(`${MOBILE}/public-authoring/PublicAuthoringWorkspace.tsx`), /TextInput/u, 'the S5-02 workspace still composes nothing');
  for (const file of ['public-authoring/PublicSemanticReview.tsx', 'public-authoring/public-authoring-controller.ts', 'runtime-entry/public-semantic-api.ts']) {
    assert.doesNotMatch(code(`${MOBILE}/${file}`), /['"`][^'"`\n]*[؀-ۿ][^'"`\n]*['"`]/u, `${file} carries no Arabic literal`);
  }
  const workspace = code(`${MOBILE}/public-authoring/PublicAuthoringWorkspace.tsx`);
  assert.match(workspace, /review\.lifecycle === 'READY_FOR_REVIEW' && understanding !== null/u, 'only for READY_FOR_REVIEW');
  const api = code(`${MOBILE}/runtime-entry/public-semantic-api.ts`);
  const sent = [...api.matchAll(/this\.exchange\('POST', [^{]*(\{[\s\S]*?\})\);/gu)].map((m) => m[1]);
  assert.equal(sent.length, 3, 'three commands');
  for (const body of sent) {
    assert.doesNotMatch(body, /user|label|audience|approver|readiness|fingerprint|lens|coordinate|rank|vector/u, `the client sends no such field: ${body}`);
  }
  assert.match(code(`${MOBILE}/runtime-entry/public-world-api.ts`), /this\.semantic = new PublicSemanticApiClient\(config\);/u, 'on the same identity-bound transport');
  assert.match(code(`${MOBILE}/integration/runtime/integration-runtime.ts`), /semantic: publicTransport\.semantic \?\? null/u);
  const barrel = code(`${MOBILE}/runtime-entry/index.ts`);
  assert.doesNotMatch(barrel, /export \{[^}]*PublicSemanticApiClient/u, 'no new runtime-barrel value');
});

test('9 — the S5-03A Product Copy Gate: one gate, CLOSED by Product Owner approval, frozen words reused, no collision', () => {
  const copy = read(`${MOBILE}/public-authoring/semantic-copy.ts`);
  assert.ok(copy.includes("status: 'S5-03A PRODUCT COPY GATE — CLOSED — 21 rows APPROVED (Product Owner, 2026-10-06)'"));
  assert.equal((copy.match(/\/\/ APPROVED — S5-03A Product Copy Gate \(Product Owner, 2026-10-06\)/gu) ?? []).length, 42, '21 rows, Arabic and English');
  assert.doesNotMatch(copy, /\/\/ PROPOSED — S5-03A Product Copy Gate/gu);
  assert.match(copy, /proposed: \[\],/u);
  assert.ok(copy.includes('cancel: sharedCopy(language).cancel'));
  assert.ok(copy.includes('actionUnavailable: publicAuthoringCopy(language).actionUnavailable'));
  assert.doesNotMatch(copy, /heading: 'فهم قنديل'|heading: "QANDEEL Understanding"/u, 'the heading does not reuse P1\'s Personal surface name');
  assert.doesNotMatch(code(`${MOBILE}/public-authoring/semantic-copy.ts`), /PUBLISHED|نُشرت|Published successfully|coordinate|إحداثي/u);
  const s502 = read(`${MOBILE}/public-authoring/copy.ts`);
  assert.ok(s502.includes("status: 'S5-02 PRODUCT COPY GATE — CLOSED — 27 rows APPROVED (Product Owner, 2026-10-06)'"), 'the S5-02 gate is untouched');
});

test('10 — governance: the record, the backlog and the locators tell the same truth', () => {
  const record = read(RECORD);
  assert.match(record, /^# QANDEEL — S5-03A Public Semantic Interpretation \+ Publisher Review — Implementation Record v1/u);
  assert.ok(record.includes('**Status:** **`S5-03A IMPLEMENTED — DRAFT PR #316 — R1 (ASSURE-F05 semantic erasure) APPLIED — S5-03A PRODUCT COPY GATE CLOSED (21 rows APPROVED, Product Owner, 2026-10-06) — NOT MERGED`**'));
  assert.match(record, /\| F13 \| [^\n]* \| B — Validation \/ Baseline \|/u, 'the locale baseline is B, not C');
  assert.match(record, /\*\*`QAN-BL-ACCT-01 — HIGH \/ OPEN`\*\*/u, 'the new RESTRICT dependents are recorded as part of the blocker');
  assert.match(record, /1a10127672f8db7ff475bca4732635bf88536730/u);
  assert.match(record, /\*\*Orphan gaps = 0\*\*/u);
  for (const section of ['PUBLIC PACKAGE ONLY', 'The model / provider boundary', 'Correction semantics', 'Version binding and semantic readiness',
    'Stale and deletion behaviour', 'CW2-08 unchanged, PUBLISHED unreachable', 'Product Copy Gate', 'Failure classification', 'Gap Matrix',
    'Remaining Stage-5 ownership', '`QAN-BL-ACCT-01` — still `HIGH`, `OPEN — UNASSIGNED`']) {
    assert.ok(record.includes(section), `the record carries: ${section}`);
  }
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  assert.match(backlog, /\| `QAN-BL-ACCT-01` \| [^\n]* \| `UNASSIGNED` \| `HIGH` \| `OPEN — UNASSIGNED` \|/u);
  assert.match(backlog, /\*\*Current-truth note \(S5-03A, 2026-10-06\)\.\*\*/u);
  assert.match(backlog, /\*\*S5-03A reconciliation \(2026-10-06; Draft PR #316, not merged\)\.\*\*/u);
  assert.match(backlog, /\| `S5-03A — Public Semantic Interpretation \+ Publisher Review` \| none — no item names it;/u);
  assert.match(backlog, /- \*\*PR \/ SHA:\*\* PR #315, merged as `1a10127672f8db7ff475bca4732635bf88536730`/u);
  // The root locators are asserted wherever they exist: always in the repository, never in the forward-safety mirror,
  // which carries only the source trees.
  if (existsSync(new URL('QANDEEL_CURRENT_STATE.md', root))) {
    const state = read('QANDEEL_CURRENT_STATE.md');
    assert.match(state, /\| S5-03A — Public Semantic Interpretation \+ Publisher Review \(migration `0144`\) \| \*\*IMPLEMENTED — DRAFT PR #316 — NOT MERGED/u);
    assert.match(state, /\*\*8A QANDEEL AI Brain \/ Production LLM Runtime\*\* \(before\s+Voice\)/u);
  }
  if (existsSync(new URL('QANDEEL_PROJECT_MAP.md', root))) {
    const map = read('QANDEEL_PROJECT_MAP.md');
    assert.match(map, /> \*\*CURRENT IMPLEMENTATION TASK: S5-03A — Public Semantic Interpretation \+ Publisher Review/u);
    assert.ok(map.indexOf('| **8A — QANDEEL AI Brain / Production LLM Runtime** |') < map.indexOf('| **8B — Voice Runtime** |'), '8A before Voice');
    assert.ok(map.indexOf('| **7 — Replay Product Integration** |') < map.indexOf('| **8A — QANDEEL AI Brain / Production LLM Runtime** |'), 'the order is unchanged');
  }
});
