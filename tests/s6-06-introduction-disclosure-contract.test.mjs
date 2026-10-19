// S6-06 (CP1) - static contract for Introduction sharing, photos, the display consent, SUCCESS and reactivation.
//
// The real behaviour is proven against PostgreSQL (verify-migration-0162 / 0163) and on the wire with the compiled API,
// PostgREST and a real S3 server (prove-0162 / 0163). This contract pins the shape those proofs rely on, so a later edit
// cannot quietly widen it: the migrations are forward-only shells beside the frozen cores; every human boundary is
// authenticated-only and every storage boundary service_role-only; no service_role path reaches SUCCESS or any Matching
// write; the approval never shares a transaction with the commit; the API composes two modules with exact routes and
// rate classes; and CI runs the verifiers and proofs with a pinned, checksum-verified rclone.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const noComments = (sql) => sql.replace(/--[^\n]*/gu, '');
const MIGRATIONS = 'database/migrations';
const M0162 = '0162_introduction_progressive_disclosure_media_v1.sql';
const M0163 = '0163_introduction_success_reactivation_v1.sql';

test('1 - 0162 directly follows 0161 and 0163 directly follows 0162; both are forward-only', () => {
  const files = readdirSync(new URL(`${MIGRATIONS}/`, root)).filter((f) => f.endsWith('.sql')).sort();
  for (const [file, previous] of [[M0162, '0161_introduction_closed_history_v1.sql'], [M0163, M0162]]) {
    assert.equal(files.filter((f) => f.startsWith(file.slice(0, 5))).length, 1, `${file} is the only file with its number`);
    assert.equal(files[files.indexOf(file) - 1], previous, `${file} directly follows ${previous}`);
    const sql = read(`${MIGRATIONS}/${file}`);
    assert.doesNotMatch(sql, /CREATE OR REPLACE|\bDROP\s|ALTER TABLE public\./iu, `${file} replaces, drops and alters nothing existing`);
    assert.doesNotMatch(noComments(sql), /\bSAVEPOINT\b/iu, `${file} uses no SAVEPOINT (correction 3)`);
  }
});

test('2 - 0162: the frozen disclosure core is reached only by the two share shells, and the frozen deletion only by removal', () => {
  const sql = noComments(read(`${MIGRATIONS}/${M0162}`));
  const fns = [...sql.matchAll(/CREATE FUNCTION ([a-z_]+\.[a-z0-9_]+)\(([\s\S]*?)\$\$;/gu)].map((m) => ({ name: m[1], body: m[2] }));
  const callers = (needle) => fns.filter((f) => f.body.includes(needle)).map((f) => f.name).sort();
  assert.deepEqual(callers('public.commit_introduction_progressive_disclosure_v1('),
    ['public.disclose_my_introduction_image_stage_v1', 'public.disclose_my_introduction_text_v1']);
  assert.deepEqual(callers('public.delete_own_shared_world_material_v1('), ['public.remove_my_introduction_image_v1']);
  assert.deepEqual(callers('public.users'), [], 'no account Name is read anywhere');
  assert.match(sql, /p_field_key NOT IN \('work_field', 'education', 'hometown_city', 'about_me'\)/u, 'exactly the four personal keys (D-11)');
  assert.match(sql, /public\.matching_text_carries_contact_route_v1\(p_text\)/u, 'the contact floor (D-10)');
  assert.match(sql, /GRANT EXECUTE ON FUNCTION\n {2}public\.disclose_my_introduction_text_v1[\s\S]*?\n {2}TO authenticated;/u);
  assert.match(sql, /public\.server_read_introduction_media_erasure_state_v1\(\)\n {6}TO service_role/u);
  assert.match(sql, /CREATE TABLE introduction_sharing_private\.media_erasure_queue \(\n {4}storage_key text NOT NULL,\n {4}not_before timestamptz NOT NULL,\n {4}attempts integer NOT NULL DEFAULT 0,\n {4}lease_id uuid,\n {4}lease_until timestamptz,/u,
    'an erasure is one storage key and its retry state');
});

test('3 - 0163: two transactions, no actor, no service_role, nothing prepared', () => {
  const sql = noComments(read(`${MIGRATIONS}/${M0163}`));
  const body = (name) => {
    const start = sql.indexOf(`CREATE FUNCTION ${name}(`);
    assert.ok(start >= 0, `${name} exists`);
    return sql.slice(start, sql.indexOf('$$;', sql.indexOf('AS $$', start) + 5));
  };
  assert.doesNotMatch(body('public.approve_my_introduction_success_v1'), /commit_introduction_success|attempt_introduction_success/u,
    'the approval never runs the commit in its own transaction');
  assert.doesNotMatch(body('introduction_sharing_private.attempt_introduction_success_v1'), /auth\.uid|approval_events|approval_state/u,
    'the system attempt reads no session subject and touches no approval');
  assert.match(body('introduction_sharing_private.attempt_introduction_success_v1'), /WHEN SQLSTATE '40001' OR SQLSTATE 'PT409'/u);
  const bodies = [...sql.matchAll(/CREATE FUNCTION [a-z_.0-9]+\(([\s\S]*?)\$\$;/gu)].map((m) => m[1]);
  assert.ok(bodies.length >= 6, 'every function is read');
  for (const fn of bodies) assert.doesNotMatch(fn, /prepare_introduction_success_transition_v1\s*\(/u, 'nothing calls the preparation (Stage 8A)');
  assert.doesNotMatch(sql, /TO service_role/u, 'no service_role path reaches SUCCESS or any Matching write (SEC-MATCH-00)');
});

test('4 - the census verifiers name the S6-06 exceptions exactly', () => {
  const nb = read('database/verify-migration-0149.mjs');
  assert.match(nb, /const S6_06_INTRODUCTION_CONTINUATION = \[\n {2}'public\.complete_my_introduction_success_v1\(uuid\)',\n {2}'public\.reactivate_my_introductions_v1\(uuid, uuid, text\)',\n\];/u);
  for (const probe of ['f10 the census refuses a third client-executable wrapper around the frozen SUCCESS commit',
    'f11 the census refuses an S6-06 continuation boundary granted beyond authenticated']) assert.ok(nb.includes(probe), probe);
  // RE-ANCHORED by S6-07 CP1 (2026-10-18, migration 0165, Controlled Amendment CA-01-impl): the ONE governed enrollment
  // boundary is appended after the S6-06 continuation boundaries in the 0149 census and after their absorbers in the 0150
  // ABSORBED list; everything pinned before it is unchanged.
  // RE-ANCHORED by S6-07 CP2 (2026-10-18, migration 0166): the forward dispatcher's absorber follows the enrollment's.
  assert.match(read('database/verify-migration-0150.mjs'), /'approve_my_introduction_success_v1', 'withdraw_my_introduction_success_v1', 'reactivate_my_introductions_v1',\n(?: {2}\/\/[^\n]*\n)* {2}'enroll_my_matching_setup_v1',\n(?: {2}\/\/[^\n]*\n)* {2}'server_forward_approved_matching_proposals_v1',\n(?: {2}\/\/[^\n]*\n)*(?: {2}'[a-z_]+_my_replay_[a-z_]+_v1',(?: '[a-z_]+_my_replay_[a-z_]+_v1',)*\n)*\];/u);
});

test('5 - the API: two modules composed through AccountModule, exact routes and rate classes, no service_role in continuation', () => {
  // RE-ANCHORED by S6-07 CP1 (2026-10-18): the governed enrollment module is composed after the S6-06 modules.
  // RE-ANCHORED by S6-07 CP2 (2026-10-18): the forward dispatcher's server pass is composed after it.
  // RE-ANCHORED by S7-01 (2026-10-19): the Personal Replay module (migration 0169) is composed after it, on its own line.
  assert.match(read('apps/api/src/account/account.module.ts'), /IntroductionsWorldModule,\n {4}IntroductionsDisclosureModule, IntroductionsContinuationModule, IntroductionsEnrollmentModule, IntroductionsDispatchModule,\n {4}ReplayModule\]/u);
  const census = read('apps/api/src/http-security/route-rate-limit.census.ts');
  for (const [route, rate] of [
    ['GET /introductions/worlds/:worldId/disclosures', 'AUTHENTICATED'],
    ['POST /introductions/worlds/:worldId/disclosures/text', 'SECURITY_SENSITIVE'],
    ['POST /introductions/worlds/:worldId/image/:commandId', 'SECURITY_SENSITIVE'],
    ['POST /introductions/worlds/:worldId/image-stages', 'SECURITY_SENSITIVE'],
    ['POST /introductions/worlds/:worldId/image-removal', 'AUTHENTICATED'],
    ['GET /introductions/worlds/:worldId/media/:handle', 'AUTHENTICATED'],
    ['POST /introductions/worlds/:worldId/display-name/grant', 'SECURITY_SENSITIVE'],
    ['POST /introductions/worlds/:worldId/display-name/revoke', 'AUTHENTICATED'],
    ['GET /introductions/shares', 'AUTHENTICATED'],
    ['GET /introductions/worlds/:worldId/success', 'AUTHENTICATED'],
    ['POST /introductions/worlds/:worldId/success/approval', 'AUTHENTICATED'],
    ['POST /introductions/worlds/:worldId/success/withdrawal', 'AUTHENTICATED'],
    ['GET /introductions/participation', 'AUTHENTICATED'],
    ['POST /introductions/participation/resume', 'AUTHENTICATED'],
  ]) assert.ok(census.includes(`'${route}': '${rate}'`), `${route} is ${rate}`);
  const continuation = readdirSync(new URL('apps/api/src/introductions-continuation/', root)).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
  const tsCode = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');
  for (const file of continuation) assert.doesNotMatch(tsCode(`apps/api/src/introductions-continuation/${file}`), /ServiceRole|service_role|server_/u, file);
  const controller = read('apps/api/src/introductions-disclosure/introduction-disclosure.controller.ts');
  assert.match(controller, /@Header\('Cache-Control', 'no-store, private'\)/u, 'the photo bytes are never cached');
  assert.doesNotMatch(controller, /@Query|signedUrl|presign|redirect/iu, 'no URL, no signed link, no redirect');
  const store = tsCode('apps/api/src/introductions-disclosure/introduction-media.store.ts');
  assert.doesNotMatch(store, /getSignedUrl|presign|ACL:|PublicRead|ETag/u, 'no signed URL, no public ACL, no ETag kept');
  assert.match(read('apps/api/src/introductions-disclosure/introduction-media-erasure.worker.ts'), /process\.env\.NODE_ENV !== 'test'/u);
  const api = JSON.parse(read('apps/api/package.json'));
  assert.equal(api.dependencies.sharp, '0.35.5', 'sharp is pinned exactly (D-03)');
  assert.equal(api.dependencies['@aws-sdk/client-s3'], '3.1142.0', 'the S3 client is pinned exactly (D-03)');
});

test('6 - CI: the verifiers and proofs run, with a pinned and checksum-verified rclone', () => {
  const pkg = JSON.parse(read('package.json')).scripts;
  for (const script of ['verify:introduction-disclosure-media:integration', 'verify:introduction-success-reactivation:integration',
    'prove:introduction-media-store:postgrest', 'prove:introduction-success:postgrest', 'test:s6-06-introduction-disclosure-contract']) {
    assert.ok(pkg[script], `${script} exists`);
  }
  const ci = read('.github/workflows/api-ci.yml');
  for (const run of ['npm run verify:introduction-disclosure-media:integration', 'npm run verify:introduction-success-reactivation:integration',
    'npm run --silent prove:introduction-media-store:postgrest', 'npm run --silent prove:introduction-success:postgrest',
    'npm run test:s6-06-introduction-disclosure-contract']) assert.ok(ci.includes(run), `CI runs ${run}`);
  assert.match(ci, /rclone_version=v1\.75\.1\n {10}rclone_sha256=982b5aa772841168f8e380f139e9e787b2a105403e32b94da8676a0e1c0a13ab/u);
  assert.match(ci, /echo "\$rclone_sha256 {2}\$rclone_zip" \| sha256sum --check --strict/u, 'refused unless the checksum is the pinned one');
  assert.doesNotMatch(ci, /docker pull [^\n]*rclone|ghcr\.io[^\n]*rclone|minio/iu, 'no registry image for the S3 server, and no MinIO');
});

test('7 - the photo proof witnesses storage by its data directory, never by a listing alone (condition 2)', () => {
  const proof = read('database/prove-0162-introduction-media-store.mjs');
  assert.match(proof, /function filesUnder\(root\)/u);
  assert.match(proof, /rclone_temp_put_/u, 'hidden temporary files are looked for');
  assert.match(proof, /ListObjects never shows the hidden file/u);
  assert.match(proof, /every object this run wrote is gone - proven by the directory, not by a listing/u);
});
