// S6-06 (CP1) - migration 0162: Introduction progressive disclosure, photos and the full-name display consent.
//
// Runs against a FULLY migrated database (0001 .. 0163) and proves, through the real authenticated and service_role
// boundaries as the humans and the API call them:
//
//   A  posture         every human boundary is postgres-owned, SECURITY DEFINER, pinned and authenticated-only; every
//                      storage boundary is service_role-only; the private relations have RLS, no policy, no privilege
//                      and no column that could hold a verifier of content; the frozen core and seams stay closed; with
//                      the seams as production has them, nothing can be shared, stored or shown and nothing is written
//   B  text            the owner shares one bounded resource at a time to the derived counterpart only; the four keys
//                      and no other; the contact floor; deletion makes a retry DELETED, a stranger's guess a conflict
//   C  photos          write-ahead begin, service_role completion, strict stage order, per-request authorization,
//                      removal through the frozen owner deletion with only the storage key queued, retirement after a
//                      generic deletion, the sweep, the erasure lease / defer / confirm, and no surviving trace
//   D  display name    an independent grant bound to one exact FULL_NAME version; revoke in every state; deleting the
//                      disclosure makes the grant inert; a new version needs a new grant; no account Name anywhere
//   G  races           removal against a stage delivery and an upload completion, on two real connections
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { APP_ROLES, D, DFN, PFN, createIntroductionRuntime, runVerifier } from './introduction-lifecycle-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';

const rt = createIntroductionRuntime(process.env.DATABASE_URL);
const { q, rows, asRole, rejected } = rt;

const P = 'introduction_sharing_private';
const HUMAN = [
  'public.disclose_my_introduction_text_v1(uuid,uuid,text,text,text)',
  'public.begin_my_introduction_image_v1(uuid,uuid)',
  'public.disclose_my_introduction_image_stage_v1(uuid,uuid,uuid,integer)',
  'public.remove_my_introduction_image_v1(uuid,uuid,uuid)',
  'public.read_my_introduction_disclosures_v1(uuid)',
  'public.list_my_introduction_shares_v1()',
  'public.authorize_my_introduction_media_v1(uuid,uuid)',
  'public.grant_my_introduction_name_display_v1(uuid,uuid,uuid)',
  'public.revoke_my_introduction_name_display_v1(uuid,uuid)',
  'public.read_my_introduction_display_names_v1(uuid)',
];
const SERVER = [
  'public.server_read_introduction_image_upload_v1(uuid)',
  'public.server_complete_introduction_image_v1(uuid)',
  'public.server_read_introduction_media_key_v1(uuid)',
  'public.server_sweep_introduction_media_v1(integer)',
  'public.server_claim_introduction_media_erasures_v1(integer,integer)',
  'public.server_confirm_introduction_media_erased_v1(text,uuid)',
  'public.server_defer_introduction_media_erasure_v1(text,uuid)',
  'public.server_enqueue_unknown_introduction_media_v1(text[])',
  'public.server_read_introduction_media_erasure_state_v1()',
];
const PRIVATE_FUNCTIONS = [
  `${P}.derive_identity_v1(text,uuid,uuid,uuid)`,
  `${P}.introduction_state_v1(uuid,uuid)`,
  `${P}.retire_image_series_v1(uuid,boolean)`,
  `${P}.disclosure_refusal_v1(text,text)`,
  `${P}.refuse_name_display_event_rewrite_v1()`,
];
const RELATIONS = ['image_series', 'image_renditions', 'image_stage_disclosures', 'media_erasure_queue', 'name_display_events', 'name_display_state'];
const MIGRATION = readFileSync(new URL('./migrations/0162_introduction_progressive_disclosure_media_v1.sql', import.meta.url), 'utf8');
const SEAMS = [PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE];
const capturedSeams = [];

// ------------------------------------------------------------------ helpers
const as = (uid) => asRole('authenticated', uid);
const owner = () => asRole('postgres');
async function call(uid, sql, values = []) {
  await as(uid);
  try { return await rows(sql, values); } finally { await owner(); }
}
async function svc(sql, values = []) {
  await asRole('service_role');
  try { return await rows(sql, values); } finally { await owner(); }
}
const one = async (promise) => (await promise)[0];
const count = async (sql, values = []) => { await owner(); return Number((await rows(sql, values))[0].n); };

const shareText = async (uid, world, type, text, key = null, command = randomUUID()) =>
  ({ ...(await one(call(uid, 'SELECT * FROM public.disclose_my_introduction_text_v1($1, $2, $3, $4, $5)', [command, world, type, key, text]))), command });
const begin = async (uid, world, command = randomUUID()) =>
  ({ ...(await one(call(uid, 'SELECT * FROM public.begin_my_introduction_image_v1($1, $2)', [command, world]))), command });
const stage = async (uid, world, series, n, command = randomUUID()) =>
  ({ ...(await one(call(uid, 'SELECT * FROM public.disclose_my_introduction_image_stage_v1($1, $2, $3, $4)', [command, world, series, n]))), command });
const removeImage = async (uid, world, series, command = randomUUID()) =>
  (await one(call(uid, 'SELECT * FROM public.remove_my_introduction_image_v1($1, $2, $3)', [command, world, series]))).outcome;
const readOf = (uid, world) => call(uid, 'SELECT * FROM public.read_my_introduction_disclosures_v1($1)', [world]);
const sharesOf = (uid) => call(uid, 'SELECT * FROM public.list_my_introduction_shares_v1()');
const authorize = async (uid, world, handle) =>
  (await one(call(uid, 'SELECT * FROM public.authorize_my_introduction_media_v1($1, $2)', [world, handle]))).outcome;
const grantName = async (uid, world, version, command = randomUUID()) =>
  (await one(call(uid, 'SELECT * FROM public.grant_my_introduction_name_display_v1($1, $2, $3)', [command, world, version]))).outcome;
const revokeName = async (uid, world, command = randomUUID()) =>
  (await one(call(uid, 'SELECT * FROM public.revoke_my_introduction_name_display_v1($1, $2)', [command, world]))).outcome;
const namesOf = (uid, world) => call(uid, 'SELECT * FROM public.read_my_introduction_display_names_v1($1)', [world]);
const deleteOwn = async (uid, world, material, command = randomUUID()) =>
  (await one(call(uid, 'SELECT * FROM public.delete_own_shared_world_material_v1($1, $2, $3)', [command, world, material]))).outcome;
const endAs = async (uid, world) => (await one(call(uid, 'SELECT * FROM public.end_own_introduction_v1($1, $2)', [randomUUID(), world]))).outcome;
const keyOf = async (handle) => (await svc('SELECT * FROM public.server_read_introduction_media_key_v1($1)', [handle]))[0]?.storage_key ?? null;
const sweep = async () => one(svc('SELECT * FROM public.server_sweep_introduction_media_v1(50)'));
const queue = async () => { await owner(); return rows(`SELECT * FROM ${P}.media_erasure_queue ORDER BY storage_key`); };
const renditionsOf = async (series) => { await owner(); return rows(`SELECT * FROM ${P}.image_renditions WHERE series_id = $1 ORDER BY stage`, [series]); };
const seriesRow = async (series) => { await owner(); return (await rows(`SELECT * FROM ${P}.image_series WHERE id = $1`, [series]))[0] ?? null; };

async function introduction(first, candidate) {
  await rt.recordFacts(first, { sex: 'FEMALE', firstName: 'Mona' });
  await rt.recordFacts(candidate, { sex: 'MALE', firstName: 'Omar' });
  const f = await rt.bringToIntroduction(first, candidate);
  await owner();
  return f;
}
/** A READY photo: begin as the owner, then the API's completion as service_role. */
async function readyPhoto(uid, world) {
  const b = await begin(uid, world);
  assert.equal(b.outcome, 'BEGUN', 'the fixture photo begins');
  const keys = await svc('SELECT * FROM public.server_read_introduction_image_upload_v1($1)', [b.image_series_id]);
  assert.equal(keys.length, 3, 'three storage keys to upload');
  assert.equal((await one(svc('SELECT * FROM public.server_complete_introduction_image_v1($1)', [b.image_series_id]))).outcome, 'READY');
  const renditions = await renditionsOf(b.image_series_id);
  return { series: b.image_series_id, handles: renditions.map((r) => r.handle), keys: renditions.map((r) => r.storage_key) };
}
/** Everything a refused attempt could have written about one World. */
async function footprint(world) {
  return {
    versions: await count(`SELECT count(*) n FROM ${D.VERSIONS} WHERE world_id = $1`, [world]),
    commands: await count(`SELECT count(*) n FROM ${D.COMMANDS} WHERE world_id = $1`, [world]),
    materials: await count('SELECT count(*) n FROM public.shared_world_materials WHERE world_id = $1', [world]),
    series: await count(`SELECT count(*) n FROM ${P}.image_series WHERE world_id = $1`, [world]),
    renditions: await count(`SELECT count(*) n FROM ${P}.image_renditions r JOIN ${P}.image_series s ON s.id = r.series_id WHERE s.world_id = $1`, [world]),
    names: await count(`SELECT count(*) n FROM ${P}.name_display_events WHERE world_id = $1`, [world]),
    queue: await count(`SELECT count(*) n FROM ${P}.media_erasure_queue`),
  };
}
async function restoreSeams() { for (const seam of capturedSeams) await rt.restoreMatchingSeam(seam); }

// ------------------------------------------------------------------ A. posture
async function verifyPosture(report) {
  await report.section('A01 every human boundary is postgres-owned, DEFINER, pinned and authenticated-only, and takes no human identity', async () => {
    for (const fn of HUMAN) {
      const p = await rt.functionPosture(fn);
      assert.deepEqual([p.owner, p.secdef, p.config], ['postgres', true, ['search_path=""']], `A01 ${fn} posture`);
      assert.equal(await rt.canExecute('authenticated', fn), true, `A01 authenticated executes ${fn}`);
      for (const role of ['public', 'anon', 'service_role']) assert.equal(await rt.canExecute(role, fn), false, `A01 ${role} must not execute ${fn}`);
      for (const name of await rt.inputParameters(fn)) assert.doesNotMatch(name, /user|owner|actor|counterpart|recipient|audience|viewer/iu, `A01 ${fn} takes no human`);
      const src = p.prosrc.replace(/--[^\n]*/gu, '');
      assert.match(src, /v_user uuid := \(SELECT auth\.uid\(\)\);/u, `A01 ${fn}: the human is auth.uid()`);
      assert.doesNotMatch(src, /public\.users|EXECUTE\s|qandeel_|activity|push_|personal_context|memory/iu, `A01 ${fn} reaches nothing beyond its boundary`);
    }
  });

  await report.section('A02 every storage boundary is service_role-only; every private helper is executable by no application role', async () => {
    for (const fn of SERVER) {
      const p = await rt.functionPosture(fn);
      assert.deepEqual([p.owner, p.secdef, p.config], ['postgres', true, ['search_path=""']], `A02 ${fn} posture`);
      assert.equal(await rt.canExecute('service_role', fn), true, `A02 service_role executes ${fn}`);
      for (const role of ['public', 'anon', 'authenticated']) assert.equal(await rt.canExecute(role, fn), false, `A02 ${role} must not execute ${fn}`);
    }
    for (const fn of [...PRIVATE_FUNCTIONS, DFN.DISCLOSE, DFN.DISCLOSURE_GATE, DFN.DELETE_MATERIAL]) {
      for (const role of ['public', ...APP_ROLES]) assert.equal(await rt.canExecute(role, fn), false, `A02 ${role} must not execute ${fn}`);
    }
  });

  await report.section('A02b the storage-erasure queue boundaries reach no Introduction disclosure relation or function (0122: only owner deletion erases a disclosure)', async () => {
    for (const fn of SERVER.filter((x) => /claim|confirm|defer|enqueue|erasure_state/u.test(x))) {
      const src = (await rt.functionPosture(fn)).prosrc;
      assert.doesNotMatch(src, /public.introduction_disclosure_|commit_introduction_progressive_disclosure|delete_shared_world_owned_material|delete_own_shared_world_material/iu,
        `A02b ${fn} touches only the storage-key queue`);
    }
  });

  await report.section('A03 the private relations: RLS on, no policy, no privilege, and no column that could verify content (0122)', async () => {
    for (const rel of RELATIONS) {
      const [{ rls }] = await rows('SELECT c.relrowsecurity rls FROM pg_class c WHERE c.oid = $1::regclass', [`${P}.${rel}`]);
      assert.equal(rls, true, `A03 ${rel} has row level security`);
      for (const role of ['public', ...APP_ROLES]) {
        const [{ any }] = await rows(`SELECT bool_or(has_table_privilege($1, $2::regclass, p)) AS any
          FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p`, [role, `${P}.${rel}`]);
        assert.equal(any, false, `A03 ${role} holds nothing on ${rel}`);
      }
    }
    assert.equal(Number((await rows('SELECT count(*) n FROM pg_policies WHERE schemaname = $1', [P]))[0].n), 0, 'A03 no policy');
    const columns = await rows(`SELECT c.relname rel, a.attname col FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped`, [P]);
    for (const { rel, col } of columns) {
      assert.doesNotMatch(col, /digest|hash|etag|size|bytes|width|height|dimension|checksum|md5|sha|text_value|name/iu, `A03 ${rel}.${col} holds no content verifier`);
    }
    const queueColumns = columns.filter((c) => c.rel === 'media_erasure_queue').map((c) => c.col).sort();
    assert.deepEqual(queueColumns, ['attempts', 'lease_id', 'lease_until', 'not_before', 'storage_key'],
      'A03 an erasure is one storage key and its retry state: no World, human, series, handle or stage');
  });

  await report.section('A04 0162 is forward-only: it creates, it replaces nothing frozen, and the seams stay NOT_EVALUATED', async () => {
    assert.doesNotMatch(MIGRATION, /CREATE OR REPLACE|ALTER TABLE public\.|DROP\s/iu, 'A04 no replacement, no change to a public relation, no drop');
    for (const seam of SEAMS) assert.equal(await rt.seamClearance(seam.slice(0, seam.indexOf('('))), 'NOT_EVALUATED', `A04 ${seam}`);
  });
}

// ------------------------------------------------------------------ B. text, C. photos, D. display name
async function verifyBehaviour(report, H) {
  const [a, b, outsider] = H;
  await owner();
  await q('BEGIN');
  try {
    await report.isolated('A05 production shape: with the seams NOT_EVALUATED nothing is shared, stored or shown, and nothing is written', async () => {
      const f = await introduction(a, b);
      await restoreSeams();
      const before = await footprint(f.world);
      assert.equal((await shareText(a, f.world, 'FULL_NAME', 'Mona Adel')).outcome, 'NOT_AVAILABLE_NOW', 'A05 no text disclosure');
      assert.equal((await shareText(a, f.world, 'CONTACT_METHOD', '+20 100 000 0000')).outcome, 'NOT_AVAILABLE_NOW', 'A05 no contact');
      assert.equal((await begin(a, f.world)).outcome, 'NOT_AVAILABLE_NOW', 'A05 no photo is stored');
      assert.equal((await stage(a, f.world, randomUUID(), 1)).outcome, 'UNAVAILABLE', 'A05 no stage');
      assert.equal(await grantName(a, f.world, randomUUID()), 'NOT_SHARED', 'A05 no display grant');
      assert.equal(await revokeName(a, f.world), 'REVOKED', 'A05 the revoke is ungated and writes nothing when there is nothing to revoke');
      assert.deepEqual(await footprint(f.world), before, 'A05 not one row was written');
      for (const role of APP_ROLES) {
        await asRole(role, a);
        await rejected(() => q(`SELECT * FROM ${DFN.DISCLOSE.replace(/\(.*/u, '')}($1,$2,$3,$4,$5,$6,'FULL_NAME',NULL,'x',NULL)`,
          [randomUUID(), f.world, randomUUID(), randomUUID(), randomUUID(), randomUUID()]), ['42501']);
        await owner();
      }
    });

    await report.isolated('B01 a text share reaches exactly the derived counterpart; a retry is the same share; a changed retry conflicts', async () => {
      const f = await introduction(a, b);
      const s = await shareText(a, f.world, 'FULL_NAME', 'Mona Adel Elsayed');
      assert.equal(s.outcome, 'DISCLOSED', 'B01 shared');
      const mine = (await readOf(a, f.world)).filter((r) => r.item_kind === 'TEXT');
      const theirs = (await readOf(b, f.world)).filter((r) => r.item_kind === 'TEXT');
      assert.deepEqual(mine.map((r) => [r.is_mine, r.resource_type, r.text_value]), [[true, 'FULL_NAME', 'Mona Adel Elsayed']]);
      assert.deepEqual(theirs.map((r) => [r.is_mine, r.resource_type, r.text_value]), [[false, 'FULL_NAME', 'Mona Adel Elsayed']]);
      assert.deepEqual(await readOf(outsider, f.world), [], 'B01 an outsider sees not even the World');
      const again = await shareText(a, f.world, 'FULL_NAME', 'Mona Adel Elsayed', null, s.command);
      assert.deepEqual([again.outcome, again.disclosed_material_id], ['DISCLOSED', s.disclosed_material_id], 'B01 a retry is the same share');
      assert.equal((await shareText(a, f.world, 'FULL_NAME', 'Someone Else', null, s.command)).outcome, 'COMMAND_CONFLICT', 'B01 a changed retry conflicts');
      assert.equal((await shareText(b, f.world, 'FULL_NAME', 'Mona Adel Elsayed', null, s.command)).outcome, 'COMMAND_CONFLICT',
        'B01 another human reusing the id conflicts');
      assert.equal((await readOf(a, f.world)).filter((r) => r.item_kind === 'TEXT' && !r.is_mine).length, 0, 'B01 non-reciprocal: nothing for A from B');
    });

    await report.isolated('B02 exactly four personal keys pass the live 0115 CHECK; any other key, a long home town and a contact route are refused', async () => {
      const f = await introduction(a, b);
      for (const [key, value] of [['work_field', 'Software'], ['education', 'Cairo University'], ['hometown_city', 'Mansoura'], ['about_me', 'I like long walks.']]) {
        assert.equal((await shareText(a, f.world, 'DEEPER_PERSONAL_FIELD', value, key)).outcome, 'DISCLOSED', `B02 ${key} is accepted by the frozen schema`);
      }
      for (const key of ['favourite_food', 'phone_number', 'home_address', 'instagram']) {
        await as(a);
        await rejected(() => q('SELECT * FROM public.disclose_my_introduction_text_v1($1, $2, $3, $4, $5)',
          [randomUUID(), f.world, 'DEEPER_PERSONAL_FIELD', key, 'x']), ['22023']);
        await owner();
      }
      await as(a);
      await rejected(() => q('SELECT * FROM public.disclose_my_introduction_text_v1($1, $2, $3, $4, $5)',
        [randomUUID(), f.world, 'DEEPER_PERSONAL_FIELD', 'hometown_city', 'x'.repeat(65)]), ['22023']);
      await rejected(() => q('SELECT * FROM public.disclose_my_introduction_text_v1($1, $2, $3, $4, $5)',
        [randomUUID(), f.world, 'FULL_NAME', 'work_field', 'Mona']), ['22023']);
      await owner();
      for (const [type, key, value] of [['FULL_NAME', null, 'Mona 01001234567'], ['DEEPER_PERSONAL_FIELD', 'about_me', 'find me on instagram'],
        ['DEEPER_PERSONAL_FIELD', 'hometown_city', 'mona@example.com']]) {
        assert.equal((await shareText(a, f.world, type, value, key)).outcome, 'CONTACT_REFUSED', `B02 the contact floor refuses ${type}/${key}`);
      }
      assert.equal((await shareText(a, f.world, 'CONTACT_METHOD', '+20 100 123 4567')).outcome, 'DISCLOSED', 'B02 CONTACT_METHOD is the one path');
    });

    await report.isolated('B03 after the owner deletes it: gone for both, a retry is DELETED with no verifier, a stranger\'s guess is a conflict', async () => {
      const f = await introduction(a, b);
      const s = await shareText(a, f.world, 'CONTACT_METHOD', '+20 100 123 4567');
      assert.equal(await deleteOwn(a, f.world, s.disclosed_material_id), 'DELETED');
      for (const human of [a, b]) assert.equal((await readOf(human, f.world)).filter((r) => r.item_kind === 'TEXT').length, 0, 'B03 gone');
      assert.equal((await shareText(a, f.world, 'CONTACT_METHOD', '+20 100 123 4567', null, s.command)).outcome, 'DELETED', 'B03 the retry is DELETED');
      assert.equal((await shareText(b, f.world, 'CONTACT_METHOD', '+20 100 123 4567', null, s.command)).outcome, 'COMMAND_CONFLICT',
        'B03 the other human guessing it learns only a conflict');
      const [c] = await rows(`SELECT payload_digest, request_ref, verifier_state FROM ${D.COMMANDS} WHERE id = $1`, [s.command]);
      assert.deepEqual(c, { payload_digest: null, request_ref: null, verifier_state: 'ERASED_BY_OWNER' }, 'B03 no verifier survives (0122)');
    });

    await report.isolated('B04 after END: no new share, the read is ENDED, deletion still works', async () => {
      const f = await introduction(a, b);
      const s = await shareText(a, f.world, 'DEEPER_PERSONAL_FIELD', 'Software', 'work_field');
      assert.equal(await endAs(b, f.world), 'ENDED');
      assert.equal((await shareText(a, f.world, 'FULL_NAME', 'Mona')).outcome, 'UNAVAILABLE', 'B04 no share after END');
      assert.ok((await readOf(b, f.world)).every((r) => r.introduction_state === 'ENDED'), 'B04 the read says ENDED');
      assert.equal(await deleteOwn(a, f.world, s.disclosed_material_id), 'DELETED', 'B04 the owner still deletes');
      assert.equal((await readOf(b, f.world)).filter((r) => r.item_kind === 'TEXT').length, 0, 'B04 and it is gone from the closed history');
    });

    await report.isolated('C01 begin writes intent before any byte; keys go only to service_role; one active photo; a retry is the same series', async () => {
      const f = await introduction(a, b);
      const bg = await begin(a, f.world);
      assert.equal(bg.outcome, 'BEGUN');
      const series = await seriesRow(bg.image_series_id);
      assert.equal(series.series_state, 'PENDING', 'C01 PENDING');
      assert.equal((await renditionsOf(bg.image_series_id)).length, 3, 'C01 three renditions, written before any upload');
      for (const role of ['authenticated', 'anon']) {
        await asRole(role, a);
        await rejected(() => q('SELECT * FROM public.server_read_introduction_image_upload_v1($1)', [bg.image_series_id]), ['42501']);
        await owner();
      }
      assert.deepEqual((await readOf(a, f.world)).filter((r) => r.item_kind === 'MY_IMAGE_STAGE').map((r) => Object.keys(r).includes('storage_key')), [false, false, false],
        'C01 the reader never sees a storage key');
      assert.equal((await begin(a, f.world, bg.command)).image_series_id, bg.image_series_id, 'C01 the retry is the same series');
      assert.equal((await begin(a, f.world)).outcome, 'PHOTO_ACTIVE', 'C01 one active photo');
      assert.equal((await begin(b, f.world, bg.command)).outcome, 'COMMAND_CONFLICT', 'C01 the other human reusing the id conflicts');
      assert.equal(await authorize(a, f.world, (await renditionsOf(bg.image_series_id))[0].handle), 'UNAVAILABLE', 'C01 nothing is shown before READY');
      assert.equal((await one(svc('SELECT * FROM public.server_complete_introduction_image_v1($1)', [bg.image_series_id]))).outcome, 'READY');
    });

    await report.isolated('C02 three stages strictly in order, each its own delivery; the counterpart sees exactly the shared stages', async () => {
      const f = await introduction(a, b);
      const p = await readyPhoto(a, f.world);
      assert.equal((await stage(a, f.world, p.series, 2)).outcome, 'UNAVAILABLE', 'C02 no skip to 2');
      assert.equal((await stage(a, f.world, p.series, 3)).outcome, 'UNAVAILABLE', 'C02 no skip to 3');
      const s1 = await stage(a, f.world, p.series, 1);
      assert.equal(s1.outcome, 'DISCLOSED');
      assert.equal((await stage(a, f.world, p.series, 1)).outcome, 'UNAVAILABLE', 'C02 a stage is never delivered twice');
      assert.equal((await stage(b, f.world, p.series, 2)).outcome, 'UNAVAILABLE', 'C02 only the owner advances it');
      assert.equal(await authorize(b, f.world, p.handles[0]), 'AUTHORIZED', 'C02 the counterpart receives stage 1');
      assert.equal(await authorize(b, f.world, p.handles[1]), 'UNAVAILABLE', 'C02 and not stage 2');
      assert.equal(await authorize(b, f.world, p.handles[2]), 'UNAVAILABLE', 'C02 nor the clear photo');
      assert.equal(await authorize(a, f.world, p.handles[2]), 'AUTHORIZED', 'C02 the owner previews their own next stages');
      assert.equal(await authorize(outsider, f.world, p.handles[0]), 'UNAVAILABLE', 'C02 an outsider receives nothing');
      assert.equal((await stage(a, f.world, p.series, 2)).outcome, 'DISCLOSED');
      assert.equal(await authorize(b, f.world, p.handles[2]), 'UNAVAILABLE', 'C02 stage 2 does not open stage 3');
      assert.equal((await stage(a, f.world, p.series, 3)).outcome, 'DISCLOSED');
      const theirs = (await readOf(b, f.world)).filter((r) => r.item_kind === 'IMAGE');
      assert.deepEqual(theirs.map((r) => [r.image_stage, r.resource_type, r.image_series_id]), [[1, 'PARTIAL_IMAGE', null], [2, 'PARTIAL_IMAGE', null], [3, 'FULL_IMAGE', null]],
        'C02 three independent versions, and the counterpart never learns the series');
      assert.equal(new Set(theirs.map((r) => r.disclosure_version_id)).size, 3, 'C02 three resource versions');
      assert.equal(await keyOf(p.handles[0]), p.keys[0], 'C02 the API resolves the key behind an authorized handle');
    });

    await report.isolated('C03 remove: every shared stage deleted by the frozen owner deletion, renditions gone, only keys queued, access refused at once', async () => {
      const f = await introduction(a, b);
      const p = await readyPhoto(a, f.world);
      const s1 = await stage(a, f.world, p.series, 1);
      await stage(a, f.world, p.series, 2);
      const queued = (await queue()).length;
      assert.equal(await removeImage(a, f.world, p.series), 'REMOVED');
      for (const handle of p.handles) {
        assert.equal(await authorize(b, f.world, handle), 'UNAVAILABLE', 'C03 the counterpart is refused immediately');
        assert.equal(await authorize(a, f.world, handle), 'UNAVAILABLE', 'C03 and so is the owner');
        assert.equal(await keyOf(handle), null, 'C03 the API can no longer resolve a key');
      }
      assert.equal((await renditionsOf(p.series)).length, 0, 'C03 no rendition row survives');
      const q2 = await queue();
      assert.equal(q2.length - queued, 3, 'C03 exactly the three storage keys are queued');
      assert.deepEqual(q2.filter((r) => p.keys.includes(r.storage_key)).map((r) => r.storage_key).sort(), [...p.keys].sort());
      assert.equal((await seriesRow(p.series)).series_state, 'RETIRED', 'C03 the series is retired');
      assert.equal(Number((await rows(`SELECT count(*) n FROM ${D.MEDIA} m JOIN ${D.VERSIONS} v ON v.id = m.resource_version_id WHERE v.world_id = $1`, [f.world]))[0].n), 0,
        'C03 no media payload survives');
      assert.equal((await stage(a, f.world, p.series, 1, s1.command)).outcome, 'DELETED', 'C03 a replayed stage is DELETED');
      assert.equal((await stage(a, f.world, p.series, 3)).outcome, 'RETIRED', 'C03 the removed photo cannot continue');
      const next = await readyPhoto(a, f.world);
      assert.notEqual(next.series, p.series, 'C03 a new photo is a new series');
      assert.equal(next.handles.filter((h) => p.handles.includes(h)).length, 0, 'C03 with new handles');
      assert.equal((await stage(a, f.world, next.series, 2)).outcome, 'UNAVAILABLE', 'C03 a new photo starts at stage 1 again');
      assert.equal((await stage(a, f.world, next.series, 1)).outcome, 'DISCLOSED', 'C03 with a new approval');
    });

    await report.isolated('C04 a stage deleted through the generic owner deletion: refused at once, the photo retires, the sweep releases the rest', async () => {
      const f = await introduction(a, b);
      const p = await readyPhoto(a, f.world);
      const s1 = await stage(a, f.world, p.series, 1);
      await stage(a, f.world, p.series, 2);
      assert.equal(await deleteOwn(a, f.world, s1.disclosed_material_id), 'DELETED');
      assert.equal(await authorize(b, f.world, p.handles[0]), 'UNAVAILABLE', 'C04 stage 1 is refused before any sweep');
      assert.equal(await authorize(b, f.world, p.handles[1]), 'AUTHORIZED', 'C04 stage 2 stays visible until its owner deletes it');
      assert.equal((await stage(a, f.world, p.series, 3)).outcome, 'RETIRED', 'C04 the photo cannot continue');
      assert.equal((await begin(a, f.world)).outcome, 'PHOTO_ACTIVE', 'C04 no new photo while a stage of the old one is visible');
      await sweep();
      const left = await renditionsOf(p.series);
      assert.deepEqual(left.map((r) => r.stage), [2], 'C04 only the still-visible stage keeps its rendition');
      assert.equal(await removeImage(a, f.world, p.series), 'REMOVED');
      assert.equal((await begin(a, f.world)).outcome, 'BEGUN', 'C04 once nothing is visible, a new photo may begin');
    });

    await report.isolated('C05 an expired upload is discarded by the sweep and its keys wait out the upload deadline (condition 1)', async () => {
      const f = await introduction(a, b);
      const bg = await begin(a, f.world);
      const keys = (await renditionsOf(bg.image_series_id)).map((r) => r.storage_key);
      await q(`UPDATE ${P}.image_series SET upload_deadline = clock_timestamp() - interval '1 second' WHERE id = $1`, [bg.image_series_id]);
      assert.deepEqual(await svc('SELECT * FROM public.server_read_introduction_image_upload_v1($1)', [bg.image_series_id]), [], 'C05 no key after the deadline');
      assert.equal((await one(svc('SELECT * FROM public.server_complete_introduction_image_v1($1)', [bg.image_series_id]))).outcome, 'UNAVAILABLE',
        'C05 a late completion is refused');
      await sweep();
      assert.equal((await seriesRow(bg.image_series_id)).series_state, 'DISCARDED', 'C05 DISCARDED');
      const waiting = (await queue()).filter((r) => keys.includes(r.storage_key));
      assert.equal(waiting.length, 3, 'C05 all three keys queued');
      const [{ ok }] = await rows(`SELECT bool_and(q.not_before >= s.upload_deadline + interval '60 seconds') ok
        FROM ${P}.media_erasure_queue q, ${P}.image_series s WHERE s.id = $1 AND q.storage_key = ANY($2::text[])`, [bg.image_series_id, keys]);
      assert.equal(ok, true, 'C05 none is erased before the upload deadline plus the grace period');
      const claimed = await svc('SELECT * FROM public.server_claim_introduction_media_erasures_v1(50, 60)');
      assert.equal(claimed.filter((c) => keys.includes(c.storage_key)).length, 0, 'C05 not claimable yet');
    });

    await report.isolated('C06 the erasure queue: a lease, a deferral that keeps the row, a confirmation only by the lease holder, and the listing reconciliation', async () => {
      await q(`DELETE FROM ${P}.media_erasure_queue`);
      const k1 = `intro-media/${randomUUID()}`;
      const k2 = `intro-media/${randomUUID()}`;
      assert.equal((await one(svc('SELECT * FROM public.server_enqueue_unknown_introduction_media_v1($1)', [[k1, k2, 'not-a-key', '../etc/passwd']]))).enqueued, 2,
        'C06 unknown well-formed keys are enqueued, anything else is ignored');
      const first = await svc('SELECT * FROM public.server_claim_introduction_media_erasures_v1(10, 60)');
      assert.deepEqual(first.map((c) => c.storage_key).sort(), [k1, k2].sort());
      assert.deepEqual(await svc('SELECT * FROM public.server_claim_introduction_media_erasures_v1(10, 60)'), [], 'C06 a leased key is not claimed twice');
      const lease = first[0].lease_id;
      assert.equal((await one(svc('SELECT * FROM public.server_confirm_introduction_media_erased_v1($1, $2)', [k1, randomUUID()]))).outcome, 'NOT_HELD',
        'C06 only the lease holder confirms');
      assert.equal((await one(svc('SELECT * FROM public.server_defer_introduction_media_erasure_v1($1, $2)', [k2, lease]))).outcome, 'DEFERRED');
      const [deferred] = await rows(`SELECT attempts, lease_id, not_before > clock_timestamp() later FROM ${P}.media_erasure_queue WHERE storage_key = $1`, [k2]);
      assert.deepEqual(deferred, { attempts: 1, lease_id: null, later: true }, 'C06 a failure keeps the row, backs off and is never dropped');
      assert.equal((await one(svc('SELECT * FROM public.server_confirm_introduction_media_erased_v1($1, $2)', [k1, lease]))).outcome, 'CONFIRMED');
      assert.deepEqual((await queue()).map((r) => r.storage_key), [k2], 'C06 only the confirmed key is gone');
      const f = await introduction(a, b);
      const p = await readyPhoto(a, f.world);
      assert.equal((await one(svc('SELECT * FROM public.server_enqueue_unknown_introduction_media_v1($1)', [p.keys]))).enqueued, 0,
        'C06 a key with a live rendition is never enqueued');
      const [state] = await svc('SELECT * FROM public.server_read_introduction_media_erasure_state_v1()');
      assert.deepEqual(Object.keys(state).sort(), ['oldest_due_seconds', 'pending'], 'C06 the operational state is counts only');
    });

    await report.isolated('C07 END: unshared stages are released by the sweep, shared ones stay for the closed history, the owner preview ends', async () => {
      const f = await introduction(a, b);
      const p = await readyPhoto(a, f.world);
      await stage(a, f.world, p.series, 1);
      assert.equal(await endAs(a, f.world), 'ENDED');
      assert.equal(await authorize(a, f.world, p.handles[1]), 'UNAVAILABLE', 'C07 no preview after END');
      await sweep();
      assert.deepEqual((await renditionsOf(p.series)).map((r) => r.stage), [1], 'C07 only the shared stage remains');
      assert.equal(await authorize(b, f.world, p.handles[0]), 'AUTHORIZED', 'C07 the closed history still shows it to its entitled reader');
      assert.equal(await removeImage(a, f.world, p.series), 'REMOVED', 'C07 the owner removes it after END');
      assert.equal(await authorize(b, f.world, p.handles[0]), 'UNAVAILABLE', 'C07 and it is gone');
    });

    await report.isolated('C08 after removal and confirmed erasure, no relation holds the handle, the key or the media reference (0122)', async () => {
      await q(`DELETE FROM ${P}.media_erasure_queue`);
      const f = await introduction(a, b);
      const p = await readyPhoto(a, f.world);
      await stage(a, f.world, p.series, 1);
      await removeImage(a, f.world, p.series);
      for (const claim of await svc('SELECT * FROM public.server_claim_introduction_media_erasures_v1(10, 60)')) {
        await svc('SELECT * FROM public.server_confirm_introduction_media_erased_v1($1, $2)', [claim.storage_key, claim.lease_id]);
      }
      const needles = [...p.handles.map(String), ...p.keys];
      const tables = await rows(`SELECT n.nspname s, c.relname t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND n.nspname IN ('public', $1, 'shared_private')`, [P]);
      for (const { s, t } of tables) {
        const [{ hit }] = await rows(`SELECT count(*)::int hit FROM ${s}.${t} x WHERE ${needles.map((_, i) => `strpos(x::text, $${i + 1}) > 0`).join(' OR ')}`, needles);
        assert.equal(hit, 0, `C08 ${s}.${t} holds no trace of the removed photo`);
      }
    });

    await report.isolated('D01 the display consent is its own grant of one exact FULL_NAME version; the other reads the disclosed text, never the account Name', async () => {
      const f = await introduction(a, b);
      assert.equal(await grantName(a, f.world, randomUUID()), 'NOT_SHARED', 'D01 nothing to show yet');
      const theirs = await shareText(b, f.world, 'FULL_NAME', 'Omar Fathy');
      const theirVersion = (await readOf(b, f.world)).find((r) => r.disclosure_material_id === theirs.disclosed_material_id).disclosure_version_id;
      assert.equal(await grantName(a, f.world, theirVersion), 'NOT_SHARED', 'D01 nobody grants a display of someone else\'s name');
      const s = await shareText(a, f.world, 'FULL_NAME', 'Mona Adel Elsayed');
      assert.deepEqual((await namesOf(b, f.world))[0].other_display_name, null, 'D01 a FULL_NAME disclosure alone is not a display consent');
      const version = (await readOf(a, f.world)).find((r) => r.disclosure_material_id === s.disclosed_material_id).disclosure_version_id;
      const command = randomUUID();
      assert.equal(await grantName(a, f.world, version, command), 'GRANTED');
      assert.equal(await grantName(a, f.world, version, command), 'GRANTED', 'D01 a retry is the same grant');
      assert.equal((await namesOf(b, f.world))[0].other_display_name, 'Mona Adel Elsayed', 'D01 the other human now reads the disclosed text');
      assert.equal((await namesOf(a, f.world))[0].my_displayed_version_id, version, 'D01 the owner reads their own choice');
      assert.equal((await namesOf(a, f.world))[0].other_display_name, null, 'D01 and is not shown the other\'s name without the other\'s grant');
      assert.deepEqual(await namesOf(outsider, f.world), [], 'D01 an outsider reads nothing');
      const src = (await rt.functionPosture('public.read_my_introduction_display_names_v1(uuid)')).prosrc;
      assert.doesNotMatch(src, /public\.users|users\.name/iu, 'D01 no account Name is read');
    });

    await report.isolated('D02 revoke is one ungated act, idempotent, in every state - live, after END and after the gate closes', async () => {
      const f = await introduction(a, b);
      const s = await shareText(a, f.world, 'FULL_NAME', 'Mona Adel Elsayed');
      const version = (await readOf(a, f.world)).find((r) => r.disclosure_material_id === s.disclosed_material_id).disclosure_version_id;
      await grantName(a, f.world, version);
      await restoreSeams();
      assert.equal(await revokeName(a, f.world), 'REVOKED', 'D02 revoke works with the gate closed');
      assert.equal((await namesOf(b, f.world))[0].other_display_name, null, 'D02 the first name is back on the next read');
      const events = await count(`SELECT count(*) n FROM ${P}.name_display_events WHERE world_id = $1`, [f.world]);
      assert.equal(await revokeName(a, f.world), 'REVOKED', 'D02 a second revoke');
      assert.equal(await count(`SELECT count(*) n FROM ${P}.name_display_events WHERE world_id = $1`, [f.world]), events, 'D02 writes nothing more');
      assert.equal(await grantName(a, f.world, version), 'NOT_AVAILABLE_NOW', 'D02 a new grant needs the gate');
      await rt.clearAllSeams();
      await grantName(a, f.world, version);
      assert.equal(await endAs(b, f.world), 'ENDED');
      assert.equal(await grantName(a, f.world, version), 'UNAVAILABLE', 'D02 no new grant after END');
      assert.equal(await revokeName(a, f.world), 'REVOKED', 'D02 but the revoke still works after END');
      assert.equal((await namesOf(b, f.world))[0].other_display_name, null, 'D02 and the closed history shows the first name');
    });

    await report.isolated('D03 deleting the bound disclosure makes the grant inert; a new FULL_NAME version needs a new grant', async () => {
      const f = await introduction(a, b);
      const s = await shareText(a, f.world, 'FULL_NAME', 'Mona Adel');
      const version = (await readOf(a, f.world)).find((r) => r.disclosure_material_id === s.disclosed_material_id).disclosure_version_id;
      await grantName(a, f.world, version);
      assert.equal(await deleteOwn(a, f.world, s.disclosed_material_id), 'DELETED');
      assert.equal((await namesOf(b, f.world))[0].other_display_name, null, 'D03 inert at once, with no trigger and no revoke');
      const s2 = await shareText(a, f.world, 'FULL_NAME', 'Mona Adel Elsayed');
      assert.equal((await namesOf(b, f.world))[0].other_display_name, null, 'D03 the grant does not move to the new version');
      const v2 = (await readOf(a, f.world)).find((r) => r.disclosure_material_id === s2.disclosed_material_id).disclosure_version_id;
      assert.equal(await grantName(a, f.world, v2), 'GRANTED');
      assert.equal((await namesOf(b, f.world))[0].other_display_name, 'Mona Adel Elsayed', 'D03 the new grant shows the new text');
    });

    await report.isolated('D04 the Settings list: the reader\'s own shares in every World and state, with the display flag, never the other\'s', async () => {
      const f = await introduction(a, b);
      const s = await shareText(a, f.world, 'FULL_NAME', 'Mona Adel');
      await shareText(b, f.world, 'FULL_NAME', 'Omar Fathy');
      const version = (await readOf(a, f.world)).find((r) => r.disclosure_material_id === s.disclosed_material_id).disclosure_version_id;
      await grantName(a, f.world, version);
      assert.equal(await endAs(b, f.world), 'ENDED');
      const list = await sharesOf(a);
      assert.deepEqual(list.filter((r) => r.world_id === f.world).map((r) => [r.introduction_state, r.resource_type, r.text_value, r.is_displayed]),
        [['ENDED', 'FULL_NAME', 'Mona Adel', true]], 'D04 own rows only, after END, with the display flag');
      assert.ok(list.every((r) => r.text_value !== 'Omar Fathy'), 'D04 never the other human\'s share');
      assert.equal(await revokeName(a, f.world), 'REVOKED');
      assert.equal((await sharesOf(a)).find((r) => r.world_id === f.world).is_displayed, false, 'D04 revoked from the list');
      assert.deepEqual((await sharesOf(outsider)).filter((r) => r.world_id === f.world), [], 'D04 an outsider lists nothing');
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ G. races on two real connections
async function removeCommittedDisclosureMediaState(humans) {
  await owner();
  await q('BEGIN');
  try {
    await q(`ALTER TABLE ${P}.name_display_events DISABLE TRIGGER name_display_events_immutable`);
    const worlds = `(SELECT r.world_id FROM public.introduction_records r WHERE r.lower_user_id = ANY($1::uuid[]) OR r.higher_user_id = ANY($1::uuid[]))`;
    await q(`DELETE FROM ${P}.name_display_state WHERE world_id IN ${worlds}`, [humans]);
    await q(`DELETE FROM ${P}.name_display_events WHERE world_id IN ${worlds}`, [humans]);
    const series = `(SELECT s.id FROM ${P}.image_series s WHERE s.world_id IN ${worlds})`;
    await q(`DELETE FROM ${P}.image_stage_disclosures WHERE series_id IN ${series}`, [humans]);
    await q(`DELETE FROM ${P}.image_renditions WHERE series_id IN ${series}`, [humans]);
    await q(`DELETE FROM ${P}.image_series WHERE world_id IN ${worlds}`, [humans]);
    await q(`ALTER TABLE ${P}.name_display_events ENABLE TRIGGER name_display_events_immutable`);
    await q('COMMIT');
  } catch (error) {
    await q('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

async function verifyRaces(report, H) {
  const [one_, two] = H;
  const race = (name, body) => report.section(name, async () => {
    try { await body(); } finally {
      await owner();
      await removeCommittedDisclosureMediaState([one_, two]);
      await rt.cleanupIntroductionRace([one_, two]);
    }
  });
  async function contend(label, { mineAs, mine, theirsAs, theirs }) {
    const extra = await rt.openExtra();
    try {
      await q('BEGIN');
      await as(mineAs);
      const [first] = await rows(mine.sql, mine.values);
      await owner();
      await extra.qx('BEGIN');
      await extra.qx('SET LOCAL ROLE authenticated');
      await extra.qx("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: theirsAs, role: 'authenticated' })]);
      const pending = extra.qx(theirs.sql, theirs.values).then((r) => r.rows[0], (error) => error);
      assert.equal(await rt.waitForLockWait((t, v) => q(t, v), extra.pid), true, `${label}: the second attempt waits on the World lock`);
      await q('COMMIT');
      const late = await pending;
      await extra.qx('COMMIT');
      assert.ok(!(late instanceof Error), `${label}: the waiting attempt is answered, not failed: ${late?.code ?? ''} ${late?.message ?? ''}`);
      return { first, late };
    } finally {
      await q('ROLLBACK').catch(() => undefined);
      await owner();
      await extra.close();
    }
  }
  const committedPhoto = async (world, uid) => {
    await q('BEGIN');
    try { const p = await readyPhoto(uid, world); await q('COMMIT'); return p; } catch (e) { await q('ROLLBACK'); throw e; }
  };
  const committedIntroduction = async () => {
    await q('BEGIN');
    try { const f = await introduction(one_, two); await q('COMMIT'); return f; } catch (e) { await q('ROLLBACK'); throw e; }
  };

  await race('G01 removal first, a stage delivery waiting: the stage is refused and nothing of the photo survives', async () => {
    const f = await committedIntroduction();
    const p = await committedPhoto(f.world, one_);
    const { first, late } = await contend('G01', {
      mineAs: one_, mine: { sql: 'SELECT * FROM public.remove_my_introduction_image_v1($1, $2, $3)', values: [randomUUID(), f.world, p.series] },
      theirsAs: one_, theirs: { sql: 'SELECT * FROM public.disclose_my_introduction_image_stage_v1($1, $2, $3, 1)', values: [randomUUID(), f.world, p.series] },
    });
    assert.deepEqual([first.outcome, late.outcome], ['REMOVED', 'UNAVAILABLE']);
    assert.equal(Number((await rows(`SELECT count(*) n FROM ${P}.image_renditions WHERE series_id = $1`, [p.series]))[0].n), 0, 'G01 no rendition');
    assert.equal(Number((await rows(`SELECT count(*) n FROM ${D.VERSIONS} WHERE world_id = $1`, [f.world]))[0].n), 0, 'G01 no delivery');
    await q(`DELETE FROM ${P}.media_erasure_queue WHERE storage_key = ANY($1::text[])`, [p.keys]);
  });

  await race('G02 a stage delivery first, removal waiting: the removal deletes the stage it delivered', async () => {
    const f = await committedIntroduction();
    const p = await committedPhoto(f.world, one_);
    const { first, late } = await contend('G02', {
      mineAs: one_, mine: { sql: 'SELECT * FROM public.disclose_my_introduction_image_stage_v1($1, $2, $3, 1)', values: [randomUUID(), f.world, p.series] },
      theirsAs: one_, theirs: { sql: 'SELECT * FROM public.remove_my_introduction_image_v1($1, $2, $3)', values: [randomUUID(), f.world, p.series] },
    });
    assert.deepEqual([first.outcome, late.outcome], ['DISCLOSED', 'REMOVED']);
    assert.equal(Number((await rows(`SELECT count(*) n FROM ${D.MEDIA} m JOIN ${D.VERSIONS} v ON v.id = m.resource_version_id WHERE v.world_id = $1`, [f.world]))[0].n), 0,
      'G02 the delivered stage is deleted too');
    await q(`DELETE FROM ${P}.media_erasure_queue WHERE storage_key = ANY($1::text[])`, [p.keys]);
  });

  await race('G03 removal while the upload is still running: the late completion is refused and the keys wait for the deadline (condition 1)', async () => {
    const f = await committedIntroduction();
    await q('BEGIN');
    const bg = await begin(one_, f.world);
    await q('COMMIT');
    const keys = (await rows(`SELECT storage_key FROM ${P}.image_renditions WHERE series_id = $1`, [bg.image_series_id])).map((r) => r.storage_key);
    await q('BEGIN');
    assert.equal(await removeImage(one_, f.world, bg.image_series_id), 'REMOVED');
    await q('COMMIT');
    await q('BEGIN');
    try {
      assert.equal((await one(svc('SELECT * FROM public.server_complete_introduction_image_v1($1)', [bg.image_series_id]))).outcome, 'UNAVAILABLE',
        'G03 the upload that finishes after the removal cannot complete');
      assert.deepEqual(await svc('SELECT * FROM public.server_read_introduction_image_upload_v1($1)', [bg.image_series_id]), [], 'G03 nor read its keys again');
      const [{ ok }] = await rows(`SELECT bool_and(q.not_before >= s.upload_deadline + interval '60 seconds') ok
        FROM ${P}.media_erasure_queue q, ${P}.image_series s WHERE s.id = $1 AND q.storage_key = ANY($2::text[])`, [bg.image_series_id, keys]);
      assert.equal(ok, true, 'G03 the erasure waits until no upload can still land');
    } finally {
      await q('ROLLBACK');
      await owner();
    }
    await q(`DELETE FROM ${P}.media_erasure_queue WHERE storage_key = ANY($1::text[])`, [keys]);
  });
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID()];
const raceHumans = [randomUUID(), randomUUID()];
await runVerifier('0162', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '60s'");
  setStage('fixtures');
  await rt.provisionHumans([...humans, ...raceHumans]);
  const report = createScenarioReport('0162', { query: q, restore: () => owner() });

  setStage('posture');
  await verifyPosture(report);

  for (const fn of SEAMS) capturedSeams.push(await rt.captureMatchingSeam(fn));
  try {
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();
    setStage('behaviour');
    await verifyBehaviour(report, humans);
    setStage('races');
    await verifyRaces(report, raceHumans);
  } finally {
    await owner();
    await restoreSeams();
  }
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  for (const seam of SEAMS) {
    assert.equal(await rt.seamClearance(seam.slice(0, seam.indexOf('('))), 'NOT_EVALUATED', `${seam} is fail-closed again`);
  }
  await removeCommittedDisclosureMediaState([...humans, ...raceHumans]);
  await rt.cleanupIntroductionRace([...humans, ...raceHumans]);
  await rt.removeFixtureHumans([...humans, ...raceHumans]);
  const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM ${P}.image_series) + (SELECT count(*) FROM ${P}.name_display_events) AS residue`, [[...humans, ...raceHumans]]);
  assert.equal(Number(residue), 0, 'the run leaves nothing behind');
}, () => rt.client.end().catch(() => undefined));
