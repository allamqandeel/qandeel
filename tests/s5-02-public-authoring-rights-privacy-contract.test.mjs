// S5-02 — Public Publishing, Rights, Draft / Review & Privacy Closure: the cross-layer static contract.
//
// It pins what a text census can honestly pin — scope, authority, the absence of raw-primitive exposure and of any
// publication path, the Copy Gate and the backlog / lifecycle truth. Live behaviour (the erasure, the races, the
// rights, the identity) is proven by database/verify-migration-0143.mjs against real PostgreSQL, the API spec and the
// mobile Jest suite; nothing here substitutes for them.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
/** Source with comments removed, so a sentence that EXPLAINS a ban never satisfies or violates it. */
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
const sqlCode = (text) => text.replace(/--.*$/gmu, '');

const MIGRATION = 'database/migrations/0143_public_authoring_rights_privacy_v1.sql';
const VERIFIER = 'database/verify-migration-0143.mjs';
const RECORD = 'docs/e2e/QANDEEL_S5_02_PUBLIC_PUBLISHING_RIGHTS_DRAFT_REVIEW_PRIVACY_CLOSURE_IMPLEMENTATION_RECORD_v1.md';
const API = 'apps/api/src/public-world';
const MOBILE = 'apps/mobile/src';
const OWNER_COMMANDS = ['start_own_public_experience_draft_v1', 'list_own_public_drafts_v1', 'list_own_public_authoring_sources_v1',
  'prepare_own_public_experience_package_v1', 'read_own_public_experience_review_v1', 'list_own_public_approval_requests_v1',
  'approve_own_public_package_v1', 'withdraw_own_public_approval_v1', 'commit_own_public_experience_ready_v1'];
const FROZEN = ['ensure_public_identity_v1', 'update_public_display_label_v1', 'create_public_experience_draft_v1',
  'prepare_public_experience_manifest_v1', 'approve_public_experience_manifest_v1', 'withdraw_publication_approval_v1',
  'commit_public_experience_ready_for_review_v1', 'publish_public_experience_v1', 'resolve_public_publication_prerequisites_v1'];

test('1 — registered in the toolchain and both CI workflows; one forward migration after 0142', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['verify:public-authoring-rights-privacy:integration'], 'node --env-file-if-exists=.env database/verify-migration-0143.mjs');
  assert.equal(manifest.scripts['test:s5-02-public-authoring-rights-privacy-contract'], 'node --test tests/s5-02-public-authoring-rights-privacy-contract.test.mjs');
  const api = read('.github/workflows/api-ci.yml');
  assert.match(api, /run: npm run verify:public-authoring-rights-privacy:integration/u);
  assert.match(api, /run: npm run test:s5-02-public-authoring-rights-privacy-contract/u);
  const mobile = read('.github/workflows/mobile-ci.yml');
  assert.match(mobile, /run: npm run test:s5-02-public-authoring-rights-privacy-contract/u);
  assert.match(mobile, /'tests\/s5-02-public-authoring-rights-privacy-contract\.test\.mjs'/u);
  const files = readdirSync(new URL('database/migrations/', root)).filter((f) => f.endsWith('.sql')).sort();
  assert.equal(files[files.indexOf('0143_public_authoring_rights_privacy_v1.sql') - 1], '0142_public_world_entry_identity_product_v1.sql');
  assert.ok(read(VERIFIER).length > 0);
});

test('2 — ASSURE-F05: physical erasure inside canonical owner deletion, through a one-way exception, never a disabled guard', () => {
  const sql = sqlCode(read(MIGRATION));
  // The 0092 guard keeps its name; nothing disables or drops a package trigger.
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.reject_publication_package_mutation_v1\(\)/u);
  assert.doesNotMatch(sql, /DISABLE TRIGGER|DROP TRIGGER|DROP FUNCTION/u, 'no guard is lifted, dropped or removed');
  assert.match(sql, /RAISE EXCEPTION 'PUBLICATION_PACKAGE_IS_IMMUTABLE'/u, 'everything else is still refused');
  // Exactly the three permitted operations, each on its own relation.
  for (const relation of ['publication_package_item_provenance', 'publication_package_manifest_items', 'public_experience_text_derivative_bodies']) {
    assert.match(sql, new RegExp(`TG_TABLE_NAME = '${relation}'`, 'u'));
  }
  // Canonical truth read inside the guard.
  for (const needle of ["i.availability_state = 'DELETED_BY_OWNER'", "i.availability_state = 'UNAVAILABLE'", 'shared_world_material_deleted_events ev',
    'WITH RECURSIVE upstream(material_id)', 'NOT EXISTS (SELECT 1 FROM public.shared_world_text_material_bodies b']) {
    assert.ok(sql.includes(needle), `the guard proves ${needle}`);
  }
  // Structural one-way state; no replacement digest.
  assert.match(sql, /content_state = 'ERASED_BY_OWNER' AND public_body_digest IS NULL AND content_erased_at IS NOT NULL/u);
  assert.match(sql, /captured_source_digest IS NULL AND captured_digest_erased_at IS NOT NULL AND source_class = 'SHARED_WORLD'/u);
  assert.match(sql, /CREATE TRIGGER public_experience_text_derivative_bodies_no_resurrection\s+BEFORE INSERT ON public\.public_experience_text_derivative_bodies/u);
  // Same transaction, same instant, inside the canonical deletion.
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.delete_shared_world_owned_material_v1\(/u);
  assert.match(sql, /PERFORM public_authoring_private\.erase_owner_deleted_public_derivatives_v1\(p_material_id, delete_instant\);/u);
  assert.equal((sql.match(/DELETE FROM public\.public_experience_text_derivative_bodies/gu) ?? []).length, 2,
    'bodies are deleted only by the ONE erasure and by the reconciliation of rows already deleted');
  // Reconciliation refuses contradictory state rather than normalizing it.
  assert.match(sql, /contradictory Shared erasure state; refused, not normalized/u);
  // S5-02 R1 (G16): Shared PHYSICAL erasure decides, not the Public label. The erasure, guard, retry proof and
  // reconciliation never gate on a classification, and they follow MATERIAL_DEPENDENCY edges only — a
  // REASONING_DEPENDENCY is never a reason to erase.
  assert.doesNotMatch(sql, /derivative_classification = '(SOURCE_CONTENT_BEARING|ANALYTICAL)_DERIVATIVE'/u, 'no erasure path gates on the Public label');
  assert.doesNotMatch(sql, /dependency_kind (=|IN) \(?'REASONING_DEPENDENCY'/u, 'no erasure path follows a REASONING_DEPENDENCY edge');
  const erase = sql.slice(sql.indexOf('CREATE FUNCTION public_authoring_private.erase_owner_deleted_public_derivatives_v1'),
    sql.indexOf('CREATE FUNCTION public_authoring_private.refuse_erased_body_resurrection_v1'));
  assert.match(erase, /WITH RECURSIVE reachable\(material_id\)[\s\S]*dependency_kind = 'MATERIAL_DEPENDENCY'[\s\S]*shared_material_id = ANY\(v_erased\)/u,
    'the erasure set is the deleted material plus its MATERIAL_DEPENDENCY closure');
  // The review boundaries are dark for a non-whole package.
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.resolve_public_experience_review_v1\(/u);
  assert.match(sql, /public_authoring_private\.public_package_state_v1\(v\.package_manifest_version_id\) = 'INTACT'/u);
});

test('3 — authority: no raw primitive exposure, no caller-supplied identity, approver, body or audience', () => {
  const sql = sqlCode(read(MIGRATION));
  for (const fn of FROZEN) {
    assert.doesNotMatch(sql, new RegExp(`GRANT[^;]*${fn}`, 'u'), `${fn} is granted to nobody`);
  }
  assert.match(sql, /'public_authoring_private\.provision_own_public_identity_v1\(uuid\)'/u, 'provisioning is internal');
  assert.match(sql, /gen_random_uuid\(\), gen_random_uuid\(\), v_mode, v_label/u, 'ref random server-side; mode and label derived');
  assert.match(sql, /public_world_private\.derive_account_public_display_v1\(p_actor\)/u, 'from the ONE S5-01 derivation');
  // Every application-reachable input is a command id, an id the database returned, or the chosen sources.
  for (const [name, args] of [...sql.matchAll(/CREATE FUNCTION public\.([a-z_0-9]+)\(([^)]*)\)\s*RETURNS/gu)].map((m) => [m[1], m[2]])) {
    if (!OWNER_COMMANDS.includes(name)) continue;
    assert.doesNotMatch(args, /user|actor|identity|label|approver|rightsholder|authority|audience|body|digest|fingerprint|clearance/u, `${name} takes no authority input`);
  }
  // The READY gate requires EFFECTIVE approvals under the canonical Public prefix.
  assert.match(sql, /WHERE s\.effective_state <> 'EFFECTIVE' OR s\.bound_authority_fingerprint IS DISTINCT FROM v_fingerprint/u);
  const ready = sql.slice(sql.indexOf('CREATE FUNCTION public_authoring_private.commit_own_public_experience_ready_v1'));
  assert.ok(ready.indexOf('FROM public.public_world_state w WHERE w.singleton FOR UPDATE') < ready.indexOf('derive_publication_manifest_effective_approvals_v1'));
  // The 64 → 80 reconciliation, with no truncation anywhere.
  assert.match(sql, /length\(display_label\) <= 80/u);
  assert.match(sql, /length\(committed_display_label\) <= 80/u);
  assert.doesNotMatch(sql, /left\(|substr\(v_label|substring\(v_label/u, 'no label is truncated');
});

test('4 — publication stays impossible from every layer', () => {
  const sql = sqlCode(read(MIGRATION));
  const owned = sql.slice(sql.indexOf('-- C. THE S5-02 AUTHORING PRODUCT BOUNDARY'), sql.indexOf('-- D. PRIVILEGES'));
  assert.doesNotMatch(owned, /publish_public_experience_v1|resolve_public_publication_prerequisites_v1|'PUBLISHED'|ABSENT_FROM_PUBLIC_WORLD/u);
  assert.match(sql, /IF p\.prosrc !~ 'NOT_EVALUATED' OR p\.prosrc ~ '''CLEARED''' THEN/u, 'the seam must still answer NOT_EVALUATED');
  for (const file of ['public-authoring.controller.ts', 'public-authoring.service.ts', 'public-authoring.repository.ts']) {
    assert.doesNotMatch(code(`${API}/${file}`), /publish_|PUBLISHED|prerequisite|clearance|service_role|ServiceRole|serviceApi|console\.|logger\./u, `${file}`);
  }
  for (const file of ['public-authoring/public-authoring-controller.ts', 'public-authoring/PublicAuthoringWorkspace.tsx', 'runtime-entry/public-authoring-api.ts']) {
    assert.doesNotMatch(code(`${MOBILE}/${file}`), /publish_|'PUBLISHED'|"PUBLISHED"/u, `${file} names no publication`);
  }
  const census = code('apps/api/src/http-security/route-rate-limit.census.ts');
  assert.doesNotMatch(census, /'[A-Z]+ \/public\/[^']*publish/u, 'no publish route exists');
});

test('5 — the API boundary: nine routes on the caller token, owner RPCs only', () => {
  const repository = code(`${API}/public-authoring.repository.ts`);
  assert.deepEqual([...repository.matchAll(/'([a-z_]+_v1)'/gu)].map((m) => m[1]).sort(), [...OWNER_COMMANDS].sort());
  assert.doesNotMatch(repository, /p_user|p_public_identity|p_display_label|p_label|p_approver|p_audience|p_body/u);
  const controller = code(`${API}/public-authoring.controller.ts`);
  assert.match(controller, /@Controller\('public\/authoring'\)\n@UseGuards\(SupabaseAuthGuard\)/u);
  assert.deepEqual([...controller.matchAll(/@(Get|Post|Put|Delete|Patch)\(([^)]*)\)/gu)].map((m) => `${m[1]} ${m[2]}`), [
    'Get ', "Get 'sources'", "Post 'drafts'", "Post 'drafts/:experienceId/package'", "Get 'drafts/:experienceId/review'",
    "Post 'drafts/:experienceId/ready'", "Get 'approvals'", "Post 'approvals/:manifestId/approve'", "Post 'approvals/:manifestId/withdraw'"]);
  assert.doesNotMatch(controller, /@Query\(/u);
  const census = code('apps/api/src/http-security/route-rate-limit.census.ts');
  for (const [route, cls] of [['GET /public/authoring', 'AUTHENTICATED'], ['GET /public/authoring/sources', 'AUTHENTICATED'],
    ['POST /public/authoring/drafts', 'SECURITY_SENSITIVE'], ['POST /public/authoring/drafts/:experienceId/package', 'SECURITY_SENSITIVE'],
    ['GET /public/authoring/drafts/:experienceId/review', 'AUTHENTICATED'], ['POST /public/authoring/drafts/:experienceId/ready', 'AUTHENTICATED'],
    ['GET /public/authoring/approvals', 'AUTHENTICATED'], ['POST /public/authoring/approvals/:manifestId/approve', 'AUTHENTICATED'],
    ['POST /public/authoring/approvals/:manifestId/withdraw', 'AUTHENTICATED']]) {
    assert.match(census, new RegExp(`'${route.replace(/\//gu, '\\/')}': '${cls}'`, 'u'));
  }
  assert.match(code(`${API}/public-world.module.ts`), /controllers: \[PublicWorldController, PublicAuthoringController\]/u, 'one Public module, not a parallel one');
});

test('6 — mobile: existing material only, inside the Public root, never "published", no Arabic literal in a surface', () => {
  const workspace = code(`${MOBILE}/public-authoring/PublicAuthoringWorkspace.tsx`);
  assert.doesNotMatch(workspace, /TextInput/u, 'there is no composer: nothing is written here');
  for (const file of ['public-authoring/PublicAuthoringWorkspace.tsx', 'public-authoring/public-authoring-controller.ts', 'public-world/PublicWorldArea.tsx']) {
    assert.doesNotMatch(code(`${MOBILE}/${file}`), /['"`][^'"`\n]*[؀-ۿ][^'"`\n]*['"`]/u, `${file} carries no Arabic literal`);
  }
  const area = code(`${MOBILE}/public-world/PublicWorldArea.tsx`);
  assert.ok(area.indexOf("entry === 'NONE' || entry === 'RESOLVING'") < area.indexOf('qandeel-public-authoring-entry'), 'no authoring before ALLOW');
  assert.match(area, /<View testID="qandeel-public-field" style=\{\{ flex: 1 \}\} \/>/u, 'the field stays empty');
  assert.doesNotMatch(area, /BackHandler/u);
  assert.match(code(`${MOBILE}/integration/runtime/integration-runtime.ts`), /authoring: createPublicAuthoringController\(\{ transport: publicTransport\.authoring \?\? null, isCurrent \}\)/u);
  const api = code(`${MOBILE}/runtime-entry/public-authoring-api.ts`);
  assert.doesNotMatch(api, /userId|publicIdentityRef|approver/u);
  // What the client SENDS: a command id, and for a package the chosen sources — never a label, a body or an audience.
  const sent = [...api.matchAll(/this\.exchange\('POST', [^{]*(\{[\s\S]*?\})\);/gu)].map((m) => m[1]);
  assert.equal(sent.length, 5, 'five commands');
  for (const body of sent) {
    assert.doesNotMatch(body, /label|text|body|audience|approver|user/u, `the client sends no such field: ${body}`);
  }
});

test('7 — the S5-02 Product Copy Gate: one gate, CLOSED, every new row APPROVED, frozen words reused byte-exact', () => {
  const copy = read(`${MOBILE}/public-authoring/copy.ts`);
  assert.ok(copy.includes("status: 'S5-02 PRODUCT COPY GATE — CLOSED — 27 rows APPROVED (Product Owner, 2026-10-06)'"), 'the gate is closed by the Product Owner');
  assert.equal((copy.match(/\/\/ APPROVED — S5-02 Product Copy Gate \(Product Owner, 2026-10-06\)/gu) ?? []).length, 54, '27 rows, Arabic and English');
  assert.doesNotMatch(copy, /\/\/ PROPOSED/u, 'no row is left PROPOSED');
  assert.match(copy, /proposed: \[\],/u);
  // S5-02 R1 (G17): approval is over the exact content shown, never "my words", and nothing claims no one else can see it.
  assert.doesNotMatch(copy, /No one else can see|لا يراها أحد غيرك|yourWords|approveOwn/u, 'no Product-false or words-only approval copy');
  assert.ok(copy.includes("approvalScope: 'Your approval applies only to the content shown here; it does not approve the rest of the experience.'"));
  assert.ok(copy.includes("approvalScope: 'موافقتك تخص المحتوى المعروض هنا فقط، ولا تعني موافقتك على باقي محتوى التجربة.'"));
  for (const reuse of ['back: shared.back', 'retry: shared.retry', 'actionUnavailable: shared.actionUnavailable', 'you: shared.you',
    'shownAs: publicWorld.displayHeading', 'qandeel: shared.personalWorld', 'sharedWorld: shared.sharedWorld']) {
    assert.ok(copy.includes(reuse), `reused: ${reuse}`);
  }
  assert.doesNotMatch(copy, /PUBLISHED|نُشرت بنجاح|Published successfully/u, 'no fake publication state');
  const gates = readdirSync(new URL(`${MOBILE}/`, root), { recursive: true }).filter((f) => /copy\.ts$/u.test(String(f)))
    .filter((f) => read(`${MOBILE}/${String(f).replace(/\\/gu, '/')}`).includes('S5-02 PRODUCT COPY GATE'));
  assert.equal(gates.length, 1, 'exactly one S5-02 Copy Gate');
});

test('8 — governance: the record, QAN-BL-CW-01 tombstoned, QAN-BL-ACCT-01 still a launch blocker, E2E-H-08 closed', () => {
  const record = read(RECORD);
  assert.match(record, /^# QANDEEL — S5-02 Public Publishing, Rights, Draft \/ Review & Privacy Closure — Implementation Record v1/u);
  assert.ok(record.includes('**Status:** **`S5-02 IMPLEMENTED — REVIEW CANDIDATE (Draft PR) — S5-02 PRODUCT COPY GATE CLOSED — 27 rows APPROVED (Product Owner, 2026-10-06) — NOT MERGED`**'));
  assert.match(record, /8dfc7b38baa133c8cecbffea8c65ae17ddc245ff/u);
  assert.match(record, /\*\*`E2E-H-08` — CLOSED \(S5-02\)\*\*/u);
  assert.match(record, /\*\*Orphan gaps = 0\*\*/u);
  for (const section of ['Content-verifier census', 'Concurrency', 'Product Copy Gate', 'Failure classification', 'Gap Matrix', 'Remaining Stage-5 ownership']) {
    assert.ok(record.includes(section), `the record carries: ${section}`);
  }
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  assert.match(backlog, /\| `QAN-BL-CW-01` \| [^\n]* \| `S5-02 — Publishing \+ Rights \+ Draft\/Review \+ Privacy Closure` \| `HIGH` \| `CLOSED — TOMBSTONE` \|/u);
  assert.match(backlog, /\| `QAN-BL-ACCT-01` \| [^\n]* \| `UNASSIGNED` \| `HIGH` \| `OPEN — UNASSIGNED` \|/u);
  assert.match(backlog, /\*\*Current-truth note \(S5-02, 2026-10-06\)\.\*\* S5-02 creates a real Public authoring footprint/u);
  assert.match(backlog, /\*\*S5-02 reconciliation \(2026-10-06; Draft PR, not merged\)\.\*\*/u);
  // The root locators are asserted wherever they exist: always in the repository, never in the forward-safety mirror,
  // which carries only the source trees.
  if (existsSync(new URL('QANDEEL_CURRENT_STATE.md', root))) {
    const state = read('QANDEEL_CURRENT_STATE.md');
    assert.match(state, /\| S5-01 — Public World Reachability, Entry & Identity Foundation \(migration `0142`\) \| \*\*`MERGED \/ CLOSED` through PR #314 at `8dfc7b38baa133c8cecbffea8c65ae17ddc245ff`\*\*/u);
    assert.match(state, /\| S5-02 — Publishing \+ Rights \+ Draft\/Review \+ Privacy Closure \(migration `0143`\) \| \*\*IMPLEMENTED — REVIEW CANDIDATE \(Draft PR\)/u);
  }
  if (existsSync(new URL('QANDEEL_PROJECT_MAP.md', root))) {
    assert.match(read('QANDEEL_PROJECT_MAP.md'), /> \*\*CURRENT IMPLEMENTATION TASK: S5-02 — Publishing \+ Rights \+ Draft\/Review \+ Privacy Closure/u);
  }
});
