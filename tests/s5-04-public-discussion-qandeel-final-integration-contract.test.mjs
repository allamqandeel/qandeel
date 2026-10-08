// S5-04 — Public Discussion + @qandeel + Public Activity / Direct Entry + Final Public Integration: the cross-layer static
// contract.
//
// It pins what a text census can honestly pin: ONE additive integration boundary (0147) over the frozen 0096 / 0097
// runtime and no second one; the fail-closed entitlement seam; the Public QANDEEL context firewall and provider neutrality;
// the ONE Activity boundary and the Product Owner's D5 event matrix; executable, revalidated Public Direct Entry; the mobile
// discussion (no social affordance, QANDEEL attributed truthfully, the human count only); the Copy Gate; and the Stage-5
// lifecycle / backlog truth. Live behaviour is proven by database/verify-migration-0147.mjs against real PostgreSQL, the API
// specs and the mobile Jest suites.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
/** Source with comments removed, so a sentence that EXPLAINS a ban never satisfies or violates it. */
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
const sqlCode = (text) => text.replace(/--.*$/gmu, '');

const MIGRATION = 'database/migrations/0147_public_discussion_qandeel_activity_integration_v1.sql';
const RECORD = 'docs/e2e/QANDEEL_S5_04_PUBLIC_DISCUSSION_QANDEEL_FINAL_INTEGRATION_IMPLEMENTATION_RECORD_v1.md';
const API = 'apps/api/src/public-world';
const MOBILE = 'apps/mobile/src';
const fn = (sql, name) => {
  const start = sql.indexOf(`CREATE FUNCTION public_discussion_private.${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  return sql.slice(start, sql.indexOf('$$;', sql.indexOf('$$', start) + 2) + 3);
};

test('1 — registered in the toolchain and both CI workflows; one forward migration after 0146; nothing frozen edited', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['verify:public-discussion-qandeel-activity:integration'], 'node --env-file-if-exists=.env database/verify-migration-0147.mjs');
  assert.equal(manifest.scripts['test:s5-04-public-discussion-qandeel-final-integration-contract'],
    'node --test tests/s5-04-public-discussion-qandeel-final-integration-contract.test.mjs');
  const api = read('.github/workflows/api-ci.yml');
  assert.match(api, /run: npm run verify:public-discussion-qandeel-activity:integration/u);
  assert.match(api, /run: npm run test:s5-04-public-discussion-qandeel-final-integration-contract/u);
  const mobile = read('.github/workflows/mobile-ci.yml');
  assert.match(mobile, /run: npm run test:s5-04-public-discussion-qandeel-final-integration-contract/u);
  assert.match(mobile, /'tests\/s5-04-public-discussion-qandeel-final-integration-contract\.test\.mjs'/u);
  const migrations = readdirSync(new URL('database/migrations/', root)).filter((f) => /^\d{4}_/u.test(f)).sort();
  assert.equal(migrations.filter((f) => f.startsWith('0147_')).length, 1, 'exactly one 0147');
  assert.equal(migrations.indexOf('0147_public_discussion_qandeel_activity_integration_v1.sql'),
    migrations.indexOf('0146_public_explicit_relations_integrity_v1.sql') + 1, '0147 directly follows 0146');
  const sql = sqlCode(read(MIGRATION));
  assert.doesNotMatch(sql, /CREATE OR REPLACE FUNCTION|ALTER TABLE public\.|DROP (FUNCTION|TABLE)/u, 'no frozen object is replaced, altered or dropped');
});

test('2 — no second discussion runtime: 0147 consumes the frozen 0096 writers / resolvers and the 0097 recompute', () => {
  const sql = sqlCode(read(MIGRATION));
  const tables = [...sql.matchAll(/CREATE TABLE (\S+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(tables, ['public_discussion_private.qandeel_invocations', 'public_discussion_private.qandeel_work_grants',
    'public_discussion_private.qandeel_work_leases'], 'no discussion, reply, response or vitality table of its own');
  assert.match(fn(sql, 'post_own_public_discussion_v1'), /public\.post_public_discussion_v1\(/u, 'posts through the frozen writer');
  assert.match(fn(sql, 'complete_public_qandeel_work_v1'), /public\.record_public_qandeel_response_v1\(/u, 'responses through the frozen writer');
  assert.match(fn(sql, 'read_public_discussion_posts_v1'), /public\.resolve_public_discussion_v1\(p_experience_id, v_viewer\)/u);
  assert.match(fn(sql, 'read_public_discussion_posts_v1'), /public\.resolve_public_qandeel_responses_v1\(p_experience_id, v_viewer\)/u);
  assert.match(fn(sql, 'post_own_public_discussion_v1'), /public\.recompute_public_experience_vitality_v1\(p_experience_id\)/u, 'the frozen vitality');
  assert.doesNotMatch(sql, /INSERT INTO public\.public_discussion_posts|INSERT INTO public\.public_qandeel_responses|UPDATE public\.public_experience_vitality_state/u);
  for (const frozen of ['post_public_discussion_v1', 'record_public_qandeel_response_v1', 'recompute_public_experience_vitality_v1',
    'resolve_public_discussion_v1', 'resolve_public_qandeel_responses_v1']) {
    assert.doesNotMatch(sql, new RegExp(`GRANT[^;]*${frozen}`, 'u'), `${frozen} gains no grant`);
  }
  // The human command derives everything: the caller supplies only words, the Experience and the post it answers.
  assert.match(sql, /CREATE FUNCTION public\.post_own_public_discussion_v1\(p_command_id uuid, p_experience_id uuid, p_reply_to_post_id uuid, p_body text\)/u);
  assert.match(fn(sql, 'post_own_public_discussion_v1'), /v_root := coalesce\(v_parent\.parent_post_id, v_parent\.id\);/u, 'one visible depth (D2)');
  assert.match(fn(sql, 'invokes_qandeel_v1'), /~\* '\(\^\|\[\^\[:alnum:\]_@\.\]\)@qandeel\(\$\|\[\^\[:alnum:\]_@\]\)'/u, 'standalone, case-insensitive (D1)');
  assert.match(sql, /CONSTRAINT qandeel_invocations_one_response UNIQUE \(response_id\)/u, 'at most one response per invoking post (D1)');
});

test('3 — entitlement fails closed (D22 / CW2-08); publication stays closed', () => {
  const sql = sqlCode(read(MIGRATION));
  const seam = fn(sql, 'resolve_public_discussion_entitlement_v1');
  assert.match(seam, /'NOT_EVALUATED'::text/u);
  assert.doesNotMatch(seam, /'ENTITLED'|premium *= *true|price|credit/iu, 'no permissive constant, plan, price or Credit');
  assert.match(fn(sql, 'is_entitled_v1'), /e\.entitlement_state = 'ENTITLED'/u, 'only an exact ENTITLED opens contribution');
  for (const name of ['post_own_public_discussion_v1', 'begin_public_qandeel_work_v1', 'complete_public_qandeel_work_v1']) {
    assert.match(fn(sql, name), /public_discussion_private\.is_entitled_v1\(/u, `${name} asks the seam (an @qandeel post bypasses nothing)`);
  }
  assert.match(sql, /the CW2-08 publication seam must still answer NOT_EVALUATED/u);
  assert.doesNotMatch(sql, /(PERFORM|FROM|SELECT)\s+public\.publish_public_experience_v1\(/u, 'nothing publishes (only the deploy assertion names it)');
});

test('4 — the Public QANDEEL context firewall, structurally', () => {
  const sql = sqlCode(read(MIGRATION));
  const context = fn(sql, 'read_public_qandeel_context_v1');
  assert.doesNotMatch(context, /provenance|shared_|conversation_|memor|human_model|him_|hypothes|matching|introduction|standing|personal|users|display_label|label_mode|author_user_id|public_identit|controller|email|login/iu,
    'public-visible truth only: no private context, no account, no identity, no author');
  assert.match(context, /resolve_public_experience_serving_v1\(v_post\.experience_id, v_lease\.requester_user_id\)/u, 'the 0095 serving resolver');
  assert.match(context, /derive_relation_life_v1\(r\.id\) = 'ACTIVE'/u, 'current explicit relations only');
  assert.match(context, /SELECT 'RELATED'::text, NULL::text, row_number\(\) OVER \(ORDER BY o\.other_id\)::bigint, NULL::uuid, ve\.meaning/u,
    'the minimum relation fact: the reviewed meaning, never the related Experience\'s content');
  const assembler = code(`${API}/public-qandeel-model-input.ts`);
  assert.doesNotMatch(assembler, /shared-conversation-model-input|memory|human-intelligence|hypothesis|matching|introduction|connected-worlds|account|identity/iu);
  const service = code(`${API}/public-qandeel-reply.service.ts`);
  assert.match(service, /runWithAiUsageAttribution\(\{ userId: requesterUserId \}, \(\) => this\.router\.generate\(request\)\)/u, 'AI-COST-01');
  assert.match(service, /@Inject\(MODEL_ROUTER\)/u, 'the provider-neutral Model Router');
  for (const file of readdirSync(new URL(`${API}/`, root)).filter((f) => /^public-(discussion|qandeel|activity)/u.test(f) && !f.endsWith('.spec.ts'))) {
    const text = code(`${API}/${file}`);
    assert.doesNotMatch(text, /anthropic|openai|qwen|deepseek|gemini|Fake[A-Za-z]*Router|console\.|Logger/iu, `${file}: no provider selected, no fake outside tests, nothing logged`);
  }
});

test('5 — ONE Activity boundary and the Product Owner\'s D5 matrix; recipients derived by the database', () => {
  const producer = code(`${API}/public-activity.producer.ts`);
  assert.match(producer, /this\.publisher\.publish\(candidate\)/u);
  assert.doesNotMatch(producer, /PUBLIC_DISCOVERY|server_publish|activity_items/u, 'no discovery producer; only the A3-01 boundary');
  assert.match(producer, /REPLY_TO_OWN_POST: [^]*?interruptionClass: 3, actionable: false/u, 'a direct reply: Class 3');
  assert.match(producer, /POST_ON_OWN_EXPERIENCE: [^]*?interruptionClass: 4, actionable: false/u, 'a top-level post: Class 4 ambient (D5)');
  assert.match(producer, /'relation-request', interruptionClass: 3, actionable: true/u, 'a relation request: Class 3, actionable');
  assert.match(producer, /'relation-accepted', interruptionClass: 3, actionable: false/u);
  assert.match(producer, /relationEnded\(relationId: string\): Promise<void> \{\n\s+return this\.withdrawRequest\(relationId\);/u, 'endings create nothing');
  const repo = code(`${API}/public-activity.repository.ts`);
  assert.match(repo, /'server_read_public_activity_source_v1', \{ p_source_kind: kind, p_source_id: sourceId \}/u, 'a fact identity, never a recipient');
  const sql = sqlCode(read(MIGRATION));
  const source = fn(sql, 'server_read_public_activity_source_v1');
  assert.match(source, /v_parent\.author_user_id <> v_post\.author_user_id/u, 'never the actor');
  assert.match(source, /c\.controller_user_id <> v_post\.author_user_id/u, 'never the actor');
  assert.match(read(`${API}/public-world.module.ts`), /imports: \[ModelRouterModule, ActivityModule\]/u, 'ActivityPublisher imported, never re-provided');
});

test('6 — Public Direct Entry is executable and revalidated NOW; mobile opens the SAME field', () => {
  const types = code('apps/api/src/activity/activity.types.ts');
  assert.match(types, /new Set\(\['PERSONAL_CONVERSATION', 'QANDEEL_UNDERSTANDING', 'GENERAL_SETTINGS', 'SHARED_WORLD', 'PUBLIC_WORLD'\]\)/u);
  const service = code('apps/api/src/activity/activity.service.ts');
  assert.match(service, /this\.repository\.publicExperienceServed\(token, id\)/u);
  assert.match(service, /this\.repository\.ownPublicRelations\(token\)/u);
  const repo = code('apps/api/src/activity/activity.repository.ts');
  assert.match(repo, /'rpc\/read_public_semantic_experience_v1'/u, 'the existing viewer read, on the caller\'s token');
  const depth = code(`${MOBILE}/integration/composition/DepthComposition.tsx`);
  assert.match(depth, /runtime\.publicWorld\.enterAt\(destination\.target\);\n\s+setArea\('PUBLIC_WORLD'\);/u, 'through the same Public entry controller');
  const entry = code(`${MOBILE}/public-world/public-world-controller.ts`);
  assert.match(entry, /if \(result\.kind === 'ALLOW' && target !== null\)/u, 'only on ALLOW');
  assert.doesNotMatch(code(`${MOBILE}/public-world/public-link.ts`), /discussion|experience/iu, 'no new deep-link grammar');
});

test('7 — mobile: one dependent discussion, no social affordance, QANDEEL truthful, the human count only', () => {
  const view = code(`${MOBILE}/public-world/field/PublicDiscussion.tsx`);
  assert.doesNotMatch(view, /like|follow|rank|badge|popular|trending|contact|privateMessage|dm\b/iu);
  assert.match(view, /copy\.qandeelSays\(post\.qandeel\.text\)/u, 'QANDEEL is attributed as QANDEEL');
  assert.match(view, /state\.status === 'SERVED' && state\.canContribute \?/u, 'no composer without entitlement');
  const panel = code(`${MOBILE}/public-world/field/PublicLivingAnalysis.tsx`);
  assert.match(panel, /experience\.discussionCount > 0/u);
  assert.doesNotMatch(panel, /qandeelResponseCount/u, 'QANDEEL output is never a social metric (D7)');
  const wire = code(`${MOBILE}/runtime-entry/public-field-api.ts`);
  assert.match(wire, /publishedAt: e\.publishedAt as string, discussionCount: e\.discussionCount as number,/u);
  assert.doesNotMatch(code(`${MOBILE}/runtime-entry/index.ts`), /export \{[^}]*PublicDiscussionApiClient/u, 'no new runtime-barrel value');
});

test('8 — ONE S5-04 Product Copy Gate, both languages, nothing silently approved', () => {
  const mobile = read(`${MOBILE}/public-world/field/discussion-copy.ts`);
  const server = read(`${API}/public-activity-copy.ts`);
  for (const source of [mobile, server]) {
    assert.match(source, /S5-04 PRODUCT COPY GATE/u);
    assert.doesNotMatch(source, /APPROVED — S5-04/u);
  }
  assert.equal((mobile.match(/PROPOSED — S5-04 Product Copy Gate/gu) ?? []).length, 18, '9 rows × 2 languages');
  assert.equal((server.match(/PROPOSED — S5-04 Product Copy Gate/gu) ?? []).length, 3, '3 Activity rows (bilingual objects)');
});

test('9 — governance: the record, the backlog and the locators tell the same Stage-5 truth', () => {
  assert.ok(existsSync(new URL(RECORD, root)), 'the primary record exists');
  const record = read(RECORD);
  assert.match(record, /\*\*Status:\*\* `CLOSED \/ READY FOR PRODUCT OWNER MERGE DECISION — NOT MERGED`/u);
  assert.match(record, /ON MERGE OF S5-04: Stage 5 becomes DONE \/ MERGED/u);
  assert.match(record, /QAN-BL-CW-03 \/ SHARED-VIS-01 becomes NEXT/u);
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  assert.match(backlog, /\| `QAN-BL-VIS-01` \| Heavy-History \/ Long-Term Living Analysis World Density \+ LOD Stress Proof \| `LA-SCALE-01 — Living Analysis Heavy-History \/ Dense-World Scale & LOD Proof` \| `HIGH` \| `DEFERRED — OWNED` \|/u);
  assert.match(backlog, /\| `QAN-BL-CW-04` \| Public Lightweight Reactions Runtime \(PG-07\) \| `PUBLIC-REACTIONS-01 — Public Lightweight Reactions Runtime` \| `MEDIUM` \| `DEFERRED — OWNED` \|/u);
  assert.match(backlog, /\| `QAN-BL-CW-03` \|[^\n]*`DEFERRED — OWNED` \|/u, 'SHARED-VIS-01 is not started here');
  // The root locators are asserted wherever they exist: always in the repository, never in the forward-safety mirror,
  // which carries only the source trees.
  if (existsSync(new URL('QANDEEL_CURRENT_STATE.md', root))) {
    const state = read('QANDEEL_CURRENT_STATE.md');
    assert.match(state, /S5-03C[^\n]*DONE \/ MERGED[^\n]*PR #318/u);
    assert.match(state, /S5-04[^\n]*CLOSED \/ READY FOR PRODUCT OWNER MERGE DECISION/u);
  }
  if (existsSync(new URL('QANDEEL_PROJECT_MAP.md', root))) {
    assert.match(read('QANDEEL_PROJECT_MAP.md'), /S5-04[^\n]*CLOSED \/ READY FOR PRODUCT OWNER MERGE DECISION/u);
  }
});
