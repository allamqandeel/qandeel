// S5-01 — Public World Reachability, Entry & Identity Foundation v1: the real-PostgreSQL verifier for migration 0142.
//
// It proves, against a fully migrated database:
//   1. the boundary: every privileged function is a pinned `public_world_private` SECURITY DEFINER; the three `public`
//      wrappers are SECURITY INVOKER and executable by `authenticated` only; the derivation, the sync and the trigger
//      function are nobody's; the server channel reaches nothing; no table is granted; no frozen I-05 consequential
//      primitive (identity creation, label update, Draft, manifest, approval, review, publish, placement, discussion,
//      Public QANDEEL, vitality, disappearance) became reachable by any application role; no new function reads sealed
//      provenance or accepts an account, ref, label, audience or authority parameter;
//   2. entry: auth is required (anon cannot run it; no claims is 42501); the CURRENT registered policy governs it
//      (REGISTERED_ONLY → ALLOW; a policy that admits nobody registered → UNAVAILABLE); the signed-out policy is still
//      UNRESOLVED and S5-01 never reaches the gate for a signed-out caller; a second Public World is unrepresentable;
//   3. the display choice: the default is PSEUDONYM = the CURRENT canonical Public ID; REAL_NAME = the CURRENT Name; no
//      label bytes can be supplied; an invalid mode is 22023; REAL_NAME without a Name is UNAVAILABLE; switching edits
//      neither the Public ID nor the Name; another reader's choice is untouched and unreadable;
//   4. the I-05 bridge: with an I-05 Public Identity, the display row follows the mode, a Public ID change and a Name
//      change (new label_revision, no stale label), touches no Experience / version / identity row; a label the frozen
//      relation cannot hold is refused, never truncated; an account WITHOUT an identity gains none;
//   5. erasure: the choice row cascades with the account (its foreign key rule; the governed erasure is 0130's).
//
// Everything runs inside one transaction that is rolled back.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const rows = async (text, values = []) => (await client.query(text, values)).rows;
const first = async (text, values = []) => (await rows(text, values))[0];

/** Expect `operation` to be refused with one of `codes`. Must run inside an open transaction. */
async function rejected(operation, codes) {
  let refusal;
  await client.query('SAVEPOINT expected_refusal');
  try {
    await operation();
  } catch (error) {
    refusal = error;
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await client.query('RELEASE SAVEPOINT expected_refusal');
  }
  assert.ok(refusal, 'the operation was expected to be refused, and it succeeded');
  assert.ok(codes.includes(refusal.code), `expected one of ${codes.join(', ')}, got ${refusal.code}: ${refusal.message}`);
}

async function actAs(role, userId = null) {
  await client.query('RESET ROLE');
  await client.query(`SET LOCAL ROLE ${role}`);
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId, role } : { role })]);
}
async function asOwner(userId = null) {
  await client.query('RESET ROLE');
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId } : {})]);
}

const WRAPPERS = ['read_public_world_entry_v1', 'read_own_public_display_v1', 'set_own_public_display_mode_v1'];
const INTERNAL = ['derive_account_public_display_v1', 'sync_account_public_display_v1', 'sync_public_display_after_account_change_v1'];
// Every frozen I-05 function that creates, moves, publishes, serves or discusses anything (0093 … 0099, 0121).
const FROZEN_CONSEQUENTIAL = [
  'ensure_public_identity_v1', 'update_public_display_label_v1', 'create_public_experience_draft_v1',
  'prepare_public_experience_manifest_v1', 'approve_public_experience_manifest_v1', 'commit_public_experience_ready_for_review_v1',
  'withdraw_publication_approval_v1', 'publish_public_experience_v1', 'record_public_experience_semantic_placement_v1',
  'post_public_discussion_v1', 'record_public_qandeel_response_v1', 'recompute_public_experience_vitality_v1',
  'rebuild_public_experience_projection_v1', 'apply_public_experience_disappearance_v1',
  'remove_public_experience_from_public_world_v1', 'reconcile_public_experience_disappearance_v1',
  'resolve_public_publication_prerequisites_v1', 'resolve_public_audience_admission_v1',
];

const entry = async () => (await first('SELECT * FROM public.read_public_world_entry_v1()')).verdict;
const display = async () => first('SELECT * FROM public.read_own_public_display_v1()');
const setMode = async (mode) => first('SELECT * FROM public.set_own_public_display_mode_v1($1::text)', [mode]);

async function signUp(id, name, loginId) {
  await asOwner();
  await client.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  if (name !== null) await client.query('UPDATE public.users SET name = $2, login_id = $3 WHERE id = $1', [id, name, loginId]);
}
const account = async (id) => {
  await asOwner();
  return first('SELECT name, public_id, public_id_changed_at FROM public.users WHERE id = $1', [id]);
};
const displayRow = async (id) => {
  await asOwner();
  return first(`SELECT d.label_mode, d.display_label, d.label_revision FROM public.public_identities i
    JOIN public.public_identity_display_state d ON d.public_identity_ref = i.public_identity_ref WHERE i.user_id = $1`, [id]);
};

async function verifyBoundary() {
  stage = 'boundary: privileged functions are pinned private definers; wrappers are invokers';
  const fns = await rows(`SELECT n.nspname, p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS owner,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public_world_private' ORDER BY p.proname`);
  assert.deepEqual(fns.map((f) => f.proname).sort(), [...WRAPPERS, ...INTERNAL].sort(), 'the private schema holds exactly the S5-01 functions');
  for (const f of fns) {
    assert.equal(f.prosecdef, true, `${f.proname} is a definer`);
    assert.equal(f.owner, 'postgres');
    assert.deepEqual(f.proconfig, ['search_path=""'], `${f.proname} pins an empty search_path`);
    assert.doesNotMatch(f.args, /user|account|actor|owner|ref|label_text|display_label|audience|authority|viewer/u, `${f.proname} accepts no trusted identity input`);
  }
  const wrappers = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = ANY($1::text[]) ORDER BY 1`, [WRAPPERS]);
  assert.equal(wrappers.length, 3);
  for (const w of wrappers) {
    assert.equal(w.prosecdef, false, `public.${w.proname} is an INVOKER wrapper`);
    assert.deepEqual(w.proconfig, ['search_path=""']);
  }
  assert.deepEqual(wrappers.map((w) => w.args), ['', '', 'p_label_mode text'], 'the only input anywhere is the mode');

  stage = 'boundary: exact executable set';
  const executable = await rows(`SELECT r.rolname, n.nspname || '.' || p.proname AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT 'anon' AS rolname UNION ALL SELECT 'authenticated' UNION ALL SELECT 'service_role') r
    WHERE EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname)
      AND ((n.nspname = 'public_world_private') OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2`, [WRAPPERS]);
  assert.deepEqual(executable.map((e) => `${e.rolname} ${e.fn}`), [
    'authenticated public.read_own_public_display_v1', 'authenticated public.read_public_world_entry_v1',
    'authenticated public.set_own_public_display_mode_v1',
    'authenticated public_world_private.read_own_public_display_v1', 'authenticated public_world_private.read_public_world_entry_v1',
    'authenticated public_world_private.set_own_public_display_mode_v1',
  ], 'authenticated runs the three owner commands only; anon and the server channel run nothing');
  const publicExec = await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname = 'public_world_private' OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')`, [WRAPPERS]);
  assert.deepEqual(publicExec, [], 'no S5-01 function keeps PUBLIC EXECUTE');

  stage = 'boundary: the one table is closed';
  const tables = await rows(`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public_world_private' AND c.relkind IN ('r', 'p', 'v', 'm') ORDER BY 1`);
  assert.deepEqual(tables, [{ relname: 'account_public_display_choices', relrowsecurity: true }]);
  const columns = (await rows(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public_world_private'
    AND table_name = 'account_public_display_choices' ORDER BY ordinal_position`)).map((c) => c.column_name);
  assert.deepEqual(columns, ['user_id', 'label_mode', 'choice_revision', 'updated_at'], 'a mode, never a label');
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const [{ any }] = await rows(`SELECT bool_or(has_table_privilege($1, 'public_world_private.account_public_display_choices', x)) AS any
      FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) x`, [role]);
    assert.equal(any, false, `${role} holds no privilege on the choice table`);
  }
  const [fk] = await rows(`SELECT confdeltype, confrelid::regclass::text AS target FROM pg_constraint
    WHERE conrelid = 'public_world_private.account_public_display_choices'::regclass AND contype = 'f'`);
  assert.deepEqual(fk, { confdeltype: 'c', target: 'public.users' }, 'the choice cascades with the account');

  stage = 'boundary: no frozen I-05 consequential primitive became reachable';
  const reach = await rows(`SELECT r.rolname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT 'anon' AS rolname UNION ALL SELECT 'authenticated' UNION ALL SELECT 'service_role') r
    WHERE EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname)
      AND n.nspname = 'public' AND p.proname = ANY($1::text[]) AND has_function_privilege(r.rolname, p.oid, 'EXECUTE')`, [FROZEN_CONSEQUENTIAL]);
  assert.deepEqual(reach, [], 'no application role reaches identity creation, label update, Draft, publication, discussion or serving writes');
  const bodies = await rows(`SELECT p.proname, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public_world_private' OR (n.nspname = 'public' AND p.proname = ANY($1::text[]))`, [WRAPPERS]);
  for (const b of bodies) {
    for (const name of FROZEN_CONSEQUENTIAL.filter((f) => f !== 'resolve_public_audience_admission_v1')) {
      assert.ok(!b.prosrc.includes(name), `${b.proname} does not call ${name}`);
    }
    assert.doesNotMatch(b.prosrc, /provenance|public_experience|publication_|discussion|semantic_placement|shared_world|login_id|email/u,
      `${b.proname} reads no Experience, sealed provenance, Shared state, Login ID or Email`);
  }
  const [{ reads }] = await rows(`SELECT count(*)::int AS reads FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public_world_private' AND p.prosrc ~ 'resolve_public_audience_admission_v1'`);
  assert.equal(reads, 1, 'only the entry verdict asks the frozen audience gate');

  stage = 'boundary: the trigger';
  const [trigger] = await rows(`SELECT pg_get_triggerdef(t.oid) AS def, n.nspname || '.' || p.proname AS fn FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE t.tgrelid = 'public.users'::regclass AND t.tgname = 'sync_public_display_after_account_change'`);
  assert.equal(trigger.fn, 'public_world_private.sync_public_display_after_account_change_v1');
  assert.match(trigger.def, /AFTER UPDATE OF public_id, name ON public\.users FOR EACH ROW/u);
}

async function verifyEntry(h) {
  stage = 'entry: auth is required';
  await actAs('anon');
  await rejected(() => client.query('SELECT * FROM public.read_public_world_entry_v1()'), ['42501']);
  await actAs('authenticated');
  await rejected(() => client.query('SELECT * FROM public.read_public_world_entry_v1()'), ['42501']);

  stage = 'entry: the current registered policy governs it';
  await asOwner();
  const [policy] = await rows('SELECT registered_viewing_policy, signed_out_viewing_policy FROM public.public_audience_policy_state');
  assert.deepEqual(policy, { registered_viewing_policy: 'REGISTERED_ONLY', signed_out_viewing_policy: 'UNRESOLVED' },
    'S5-01 sets no policy; signed-out viewing is still UNRESOLVED');
  await actAs('authenticated', h.a);
  assert.equal(await entry(), 'ALLOW', 'a registered reader may enter under REGISTERED_ONLY');
  assert.deepEqual(Object.keys(await first('SELECT * FROM public.read_public_world_entry_v1()')), ['verdict'], 'nothing of the policy is returned');
  // A reader whose account is not a QANDEEL account row (claims only) is not admitted: one neutral answer.
  await actAs('authenticated', randomUUID());
  assert.equal(await entry(), 'UNAVAILABLE');
  // The verdict reads the policy NOW: a (fixture-only) policy that admits nobody registered closes it.
  await asOwner();
  await client.query('ALTER TABLE public.public_audience_policy_state DROP CONSTRAINT public_audience_policy_registered_check');
  await client.query("UPDATE public.public_audience_policy_state SET registered_viewing_policy = 'NOBODY_FIXTURE'");
  await actAs('authenticated', h.a);
  assert.equal(await entry(), 'UNAVAILABLE', 'the current policy, not a cached ALLOW, decides');
  await asOwner();
  await client.query("UPDATE public.public_audience_policy_state SET registered_viewing_policy = 'REGISTERED_ONLY'");
  // Signed-out ALLOWED (fixture-only) still opens nothing through S5-01: a signed-out caller never reaches the gate.
  await client.query("UPDATE public.public_audience_policy_state SET signed_out_viewing_policy = 'ALLOWED'");
  await actAs('anon');
  await rejected(() => client.query('SELECT * FROM public.read_public_world_entry_v1()'), ['42501']);
  await asOwner();
  await client.query("UPDATE public.public_audience_policy_state SET signed_out_viewing_policy = 'UNRESOLVED'");

  stage = 'entry: one Public World';
  await rejected(() => client.query("INSERT INTO public.public_world_state VALUES (true, 'PUBLIC_WORLD', 1, now())"), ['23505']);
  await rejected(() => client.query("INSERT INTO public.public_world_state VALUES (false, 'PUBLIC_WORLD', 1, now())"), ['23514']);
}

async function verifyChoice(h) {
  stage = 'choice: auth is required';
  await actAs('anon');
  await rejected(() => client.query('SELECT * FROM public.read_own_public_display_v1()'), ['42501']);
  await rejected(() => client.query("SELECT * FROM public.set_own_public_display_mode_v1('REAL_NAME')"), ['42501']);

  stage = 'choice: default PSEUDONYM = the current Public ID';
  const a0 = await account(h.a);
  await actAs('authenticated', h.a);
  assert.deepEqual(await display(), { label_mode: 'PSEUDONYM', display_label: a0.public_id, real_name_available: true });
  assert.deepEqual(Object.keys(await display()).sort(), ['display_label', 'label_mode', 'real_name_available'], 'no ref, no user id');

  stage = 'choice: REAL_NAME = the current Name; no label bytes; switching edits neither source';
  await rejected(() => client.query("SELECT * FROM public.set_own_public_display_mode_v1('Lamplighter')"), ['22023']);
  await rejected(() => client.query('SELECT * FROM public.set_own_public_display_mode_v1(NULL)'), ['22023']);
  await rejected(() => client.query("SELECT * FROM public.set_own_public_display_mode_v1('REAL_NAME', 'Someone Else')"), ['42883']);
  assert.deepEqual(await setMode('REAL_NAME'), { outcome: 'UPDATED', label_mode: 'REAL_NAME', display_label: 'Amal One' });
  assert.deepEqual(await setMode('REAL_NAME'), { outcome: 'UNCHANGED', label_mode: 'REAL_NAME', display_label: 'Amal One' });
  assert.deepEqual(await account(h.a), a0, 'choosing the mode changes neither the Public ID nor the Name');
  await actAs('authenticated', h.a);
  assert.deepEqual(await setMode('PSEUDONYM'), { outcome: 'UPDATED', label_mode: 'PSEUDONYM', display_label: a0.public_id });
  assert.deepEqual(await account(h.a), a0);

  stage = 'choice: own-account only; no direct table access';
  await actAs('authenticated', h.b);
  const b = await display();
  assert.equal(b.label_mode, 'PSEUDONYM', "A's choices never touched B");
  assert.equal(b.display_label, (await account(h.b)).public_id);
  await actAs('authenticated', h.a);
  await rejected(() => client.query('SELECT * FROM public_world_private.account_public_display_choices'), ['42501']);
  await rejected(() => client.query('SELECT * FROM public_world_private.derive_account_public_display_v1($1)', [h.b]), ['42501']);
  await rejected(() => client.query('SELECT public_world_private.sync_account_public_display_v1($1)', [h.b]), ['42501']);

  stage = 'choice: REAL_NAME needs a Name';
  await actAs('authenticated', h.n);
  const n = await display();
  assert.equal(n.real_name_available, false);
  const refused = await setMode('REAL_NAME');
  assert.equal(refused.outcome, 'UNAVAILABLE');
  assert.equal(refused.label_mode, 'PSEUDONYM');

  stage = 'choice: no I-05 identity is provisioned by reading, choosing or entering';
  await asOwner();
  const [{ identities }] = await rows('SELECT count(*)::int AS identities FROM public.public_identities WHERE user_id = ANY($1::uuid[])', [[h.a, h.b, h.n]]);
  assert.equal(identities, 0);
}

async function verifyBridge(h) {
  stage = 'bridge: an I-05 identity (fixture through the frozen primitive, as its owner) follows the derivation';
  const a0 = await account(h.c);
  await asOwner(h.c);
  await rows('SELECT * FROM public.ensure_public_identity_v1($1, $2, $3, $4)', [randomUUID(), randomUUID(), 'PSEUDONYM', a0.public_id]);
  const r0 = await displayRow(h.c);
  assert.deepEqual([r0.label_mode, r0.display_label], ['PSEUDONYM', a0.public_id]);
  const [{ experiences: e0 }] = await rows('SELECT count(*)::int AS experiences FROM public.public_experiences');
  const [{ versions: v0 }] = await rows('SELECT count(*)::int AS versions FROM public.public_experience_versions');
  const [ident0] = await rows('SELECT public_identity_ref, user_id, created_at FROM public.public_identities WHERE user_id = $1', [h.c]);

  stage = 'bridge: the mode';
  await actAs('authenticated', h.c);
  await setMode('REAL_NAME');
  const r1 = await displayRow(h.c);
  assert.deepEqual([r1.label_mode, r1.display_label], ['REAL_NAME', 'Chadi Three']);
  assert.ok(Number(r1.label_revision) > Number(r0.label_revision));

  stage = 'bridge: a Name change while REAL_NAME leaves no stale Name';
  await actAs('authenticated', h.c);
  assert.equal((await first('SELECT * FROM public.change_own_account_name_v1($1)', ['Chadi Renamed'])).outcome, 'CHANGED');
  const r2 = await displayRow(h.c);
  assert.deepEqual([r2.label_mode, r2.display_label], ['REAL_NAME', 'Chadi Renamed']);
  await actAs('authenticated', h.c);
  assert.equal((await display()).display_label, 'Chadi Renamed');

  stage = 'bridge: a Public ID change while PSEUDONYM leaves no stale pseudonym';
  await actAs('authenticated', h.c);
  await setMode('PSEUDONYM');
  const fresh = `s501c${randomUUID().slice(0, 8).replace(/-/gu, '')}`;
  const changed = await first('SELECT * FROM public.change_own_public_id_v1($1, $2)', [randomUUID(), fresh]);
  assert.equal(changed.current_public_id, fresh);
  const r3 = await displayRow(h.c);
  assert.deepEqual([r3.label_mode, r3.display_label], ['PSEUDONYM', fresh]);
  await actAs('authenticated', h.c);
  assert.equal((await display()).display_label, fresh);
  // A Name change while PSEUDONYM changes nothing displayed; a revision is not spent on it.
  await actAs('authenticated', h.c);
  await first('SELECT * FROM public.change_own_account_name_v1($1)', ['Chadi Again']);
  const r4 = await displayRow(h.c);
  assert.deepEqual([r4.display_label, r4.label_revision], [fresh, r3.label_revision]);

  stage = 'bridge: a display change touches the display row alone';
  await asOwner();
  const [{ experiences: e1 }] = await rows('SELECT count(*)::int AS experiences FROM public.public_experiences');
  const [{ versions: v1 }] = await rows('SELECT count(*)::int AS versions FROM public.public_experience_versions');
  assert.deepEqual([e1, v1], [e0, v0], 'no Experience or version is created by a display change');
  const [ident1] = await rows('SELECT public_identity_ref, user_id, created_at FROM public.public_identities WHERE user_id = $1', [h.c]);
  assert.deepEqual(ident1, ident0, 'the stable internal ref never moves');

  stage = 'bridge: an unrepresentable label is refused, never truncated';
  await actAs('authenticated', h.c);
  await setMode('REAL_NAME');
  const long = 'L'.repeat(70);
  await rejected(() => client.query('SELECT * FROM public.change_own_account_name_v1($1)', [long]), ['P0001']);
  const r5 = await displayRow(h.c);
  assert.equal(r5.display_label, 'Chadi Again', 'the display row keeps the last true label');
}

async function main() {
  await client.connect();
  try {
    await verifyBoundary();
    await client.query('BEGIN');
    try {
      const h = { a: randomUUID(), b: randomUUID(), c: randomUUID(), n: randomUUID() };
      const suffix = randomUUID().slice(0, 8).replace(/[^a-z0-9]/gu, 'x');
      await signUp(h.a, 'Amal One', `s501a${suffix}`);
      await signUp(h.b, 'Badr Two', `s501b${suffix}`);
      await signUp(h.c, 'Chadi Three', `s501c${suffix}`);
      await signUp(h.n, null, null);
      await verifyEntry(h);
      await verifyChoice(h);
      await verifyBridge(h);
    } finally {
      await client.query('ROLLBACK');
    }
    console.log('Verified migration 0142: the Public World entry verdict requires auth and reads the CURRENT registered policy through the frozen audience gate (signed-out still UNRESOLVED and never reached; one Public World); the display choice defaults to PSEUDONYM = the current Public ID, REAL_NAME = the current Name, accepts a mode and never label bytes, edits neither source and is own-account only; an existing I-05 display row follows mode, Public ID and Name changes with no stale label and no Experience / version / ref change, refusing an unrepresentable label; no identity is provisioned; no frozen I-05 consequential primitive is reachable; the choice cascades with the account.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Database verification failed at ${stage} (${code}). Connection details were suppressed.`);
  if (error instanceof assert.AssertionError) console.error(error.message);
  else if (typeof error?.code === 'string' && typeof error?.message === 'string') console.error(error.message.slice(0, 300));
  process.exitCode = 1;
});
