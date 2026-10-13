// S6-01 — Intelligent Matching Onboarding: the real-PostgreSQL verifier for migration 0154.
//
// It proves, against a FULLY migrated database, and by its OWN enumeration (it relies on no earlier verifier's name
// patterns — the Product Owner's D2 security warning):
//   1. catalog: the exact relation set of the preparation schema; every relation's RLS and that no application role
//      (PUBLIC, anon, authenticated, service_role) holds any privilege on it; the exact foreign-key set with its targets
//      and delete rules (every account reference cascades; nothing outside references the schema); the exact function
//      set, each with its security mode, empty search_path, owner and the exact roles that may run it; the seven public
//      entry points SECURITY INVOKER, authenticated only, without an account parameter; no function names an I-07
//      setup command or writes outside the schema; no dynamic SQL; both gates absent; the catalogues and the consent
//      text with its digests; the six 0149 commands still closed to every application role;
//   2. gates: absent = closed (every write UNAVAILABLE, the reader empty, the hints false); only ENABLED with SATISFIED
//      or WAIVED opens; the operator functions run for no application role;
//   3. the owner's draft: each declared fact DECLARED -> CONFIRMED -> CORRECTED -> CONFIRMED; the sex fact confirmed in
//      its own act; validation of every field (refusal 22023, nothing written); requirements, discrepancies, notes,
//      skips and review; compare-and-set (STALE_VERSION changes nothing); a retry answers its first result; a reused
//      id with another request changes nothing; refusals are not ledgered;
//   4. isolation and anti-oracle: another account neither reads nor changes the draft; anon and service_role run
//      nothing;
//   5. assistance: the grant needs both gates and the current consent version; the reader returns only the owner's
//      ACTIVE, unexpired, USER_STATED / USER_CONFIRMED, SELF Memory of the four classes, at most 12, newest first, with a
//      deterministic recency; a confirmation copies the words the server re-read, a correction keeps the owner's words,
//      decided items are not shown again; Memory, attributions, Hypotheses and HIM are never written; revocation empties
//      the reader and refuses a later decision;
//   6. races (committed, two connections): a revocation waits for an in-flight read and for an in-flight decision, and
//      a decision after a committed revocation is refused; two first writes serialize (one APPLIED, one
//      STALE_VERSION); two identical commands apply once; a deletion request waits for an in-flight write and every
//      later write is ACCOUNT_DELETION_PENDING, while read, revoke and discard stay available;
//   7. erasure: an account holding a full draft, notes, decisions, a consent and ledger rows completes the governed
//      Personal erasure (0130) — ERASED, not BLOCKED — with zero rows left here, and another account untouched.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';
import { cleanupVerifierUsers } from './verifier-fixture-cleanup.mjs';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const SCHEMA = 'introductions_preparation_private';
const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const rows = async (text, values = [], on = client) => (await on.query(text, values)).rows;
const one = async (text, values = [], on = client) => (await rows(text, values, on))[0];
const count = async (text, values = [], on = client) => Number((await one(text, values, on)).n);

async function rejected(operation, codes, on = client) {
  let refusal;
  await on.query('SAVEPOINT expected_refusal');
  try { await operation(); } catch (error) { refusal = error; } finally {
    await on.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await on.query('RELEASE SAVEPOINT expected_refusal');
  }
  assert.ok(refusal, 'the operation was expected to be refused, and it succeeded');
  assert.ok(codes.includes(refusal.code), `expected one of ${codes.join(', ')}, got ${refusal.code} (${refusal.message})`);
  return refusal;
}
async function actAs(role, userId = null, on = client) {
  await on.query('RESET ROLE');
  await on.query(`SET LOCAL ROLE ${role}`);
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [userId ? JSON.stringify({ sub: userId, role }) : '{}']);
}
async function asOwner(on = client) {
  await on.query('RESET ROLE');
  await on.query("SELECT set_config('request.jwt.claims', '{}', true)");
}
async function account(on = client) {
  const id = randomUUID();
  await on.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  return id;
}
async function inTransaction(work) {
  await client.query('BEGIN');
  try { await work(); } finally { await client.query('ROLLBACK'); }
}
async function openGates(on = client, scopes = ['PREPARATION', 'ONBOARDING_ASSISTANCE']) {
  await asOwner(on);
  for (const scope of scopes) {
    await on.query(`SELECT * FROM ${SCHEMA}.set_gate_v1($1, 'ENABLED', 'SATISFIED', 'verify-0154', 'validation-only fixture')`, [scope]);
  }
}
async function closeGate(scope, on = client) {
  await asOwner(on);
  await on.query(`SELECT * FROM ${SCHEMA}.set_gate_v1($1, 'EMERGENCY_DISABLED', 'SATISFIED', 'verify-0154', 'validation-only fixture')`, [scope]);
}

const CMD = 'SELECT public.apply_own_matching_preparation_command_v1($1, $2, $3, $4::jsonb) AS r';
/** One owner command as `authenticated`; the answer object. */
async function cmd(userId, kind, payload, expected, commandId = randomUUID(), on = client) {
  await actAs('authenticated', userId, on);
  const { r } = await one(CMD, [commandId, expected, kind, JSON.stringify(payload)], on);
  await asOwner(on);
  return r;
}
async function readOwn(userId, on = client) {
  await actAs('authenticated', userId, on);
  const { r } = await one('SELECT public.read_own_matching_preparation_v1() AS r', [], on);
  await asOwner(on);
  return r;
}
async function items(userId, on = client) {
  await actAs('authenticated', userId, on);
  const out = await rows('SELECT * FROM public.read_own_matching_onboarding_assistance_items_v1()', [], on);
  await asOwner(on);
  return out;
}
async function grant(userId, version = 'MATCHING_ONBOARDING_ASSISTANCE_V1', commandId = randomUUID(), on = client) {
  await actAs('authenticated', userId, on);
  const { r } = await one('SELECT public.grant_own_matching_onboarding_assistance_v1($1, $2) AS r', [commandId, version], on);
  await asOwner(on);
  return r;
}
async function revoke(userId, commandId = randomUUID(), on = client) {
  await actAs('authenticated', userId, on);
  const { r } = await one('SELECT public.revoke_own_matching_onboarding_assistance_v1($1) AS r', [commandId], on);
  await asOwner(on);
  return r;
}
async function discard(userId, commandId = randomUUID(), on = client) {
  await actAs('authenticated', userId, on);
  const { r } = await one('SELECT public.discard_own_matching_preparation_v1($1) AS r', [commandId], on);
  await asOwner(on);
  return r;
}
async function version(userId, on = client) {
  const draft = (await readOwn(userId, on)).draft;
  return draft === null ? 0 : draft.version;
}
/** One owned Memory written as the table owner (the 0152 insert guard: attribute while current). */
async function memory(userId, { content, type = 'STABLE_PREFERENCE', source = 'USER_STATED', subject = 'SELF', status = 'ACTIVE', ageDays = 0, expired = false }) {
  const id = randomUUID();
  if (expired) await client.query("SET LOCAL session_replication_role = 'replica'");
  await client.query(
    `INSERT INTO public.memories (id, user_id, type, content, source, confidence, importance, status, created_at, updated_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, 0.95, 0.9, 'ACTIVE', now() - make_interval(days => $6), now() - make_interval(days => $6),
             CASE WHEN $7 THEN now() - interval '1 hour' END)`,
    [id, userId, type, content, source, ageDays + (expired ? 2 : 0), expired],
  );
  if (subject) await client.query("INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis) VALUES ($1, $2, $3, 'EXPLICIT_STATEMENT')", [id, userId, subject]);
  if (expired) await client.query("SET LOCAL session_replication_role = 'origin'");
  if (status !== 'ACTIVE') await client.query('UPDATE public.memories SET status = $2, updated_at = now() WHERE id = $1', [id, status]);
  return id;
}
/** A complete, confirmed draft. */
async function fullDraft(userId, on = client) {
  let v = await version(userId, on);
  const step = async (kind, payload) => { const r = await cmd(userId, kind, payload, v, randomUUID(), on); assert.equal(r.outcome, 'APPLIED', `${kind}: ${JSON.stringify(r)}`); v = r.version; };
  await step('SET_FACT', { fact: 'INTRODUCTION_FIRST_NAME', firstName: 'سارة' });
  await step('CONFIRM_FACT', { fact: 'INTRODUCTION_FIRST_NAME' });
  await step('SET_FACT', { fact: 'SEX', sex: 'FEMALE' });
  await step('CONFIRM_FACT', { fact: 'SEX' });
  await step('SET_FACT', { fact: 'BIRTH_YEAR_MONTH', year: 1996, month: 5 });
  await step('CONFIRM_FACT', { fact: 'BIRTH_YEAR_MONTH' });
  await step('SET_FACT', { fact: 'BROAD_AREA', countryCode: 'EG', regionCode: 'EG-ALX' });
  await step('CONFIRM_FACT', { fact: 'BROAD_AREA' });
  await step('SET_FACT', { fact: 'MARITAL_STATUS', maritalStatus: 'NEVER_MARRIED' });
  await step('CONFIRM_FACT', { fact: 'MARITAL_STATUS' });
  await step('SET_REQUIREMENTS', { strength: 'HARD', answer: 'NONE_ADDITIONAL', items: [] });
  await step('SET_REQUIREMENTS', { strength: 'SOFT', answer: 'NONE', items: [] });
  return v;
}

// ------------------------------------------------------------------------------------------------------------------
const TABLES = ['area_countries', 'area_regions', 'assistance_consents', 'command_ledger', 'consent_texts', 'declared_facts',
  'drafts', 'gate_events', 'gate_states', 'notes', 'prior_understanding_decisions'];
// Every foreign key of the schema: [relation, constraint, target, delete rule ('c' cascade, 'r' restrict)].
const FOREIGN_KEYS = [
  ['area_regions', 'area_regions_country_fk', `${SCHEMA}.area_countries`, 'r'],
  ['assistance_consents', 'assistance_consents_user_fk', 'users', 'c'],
  ['assistance_consents', 'assistance_consents_version_fk', `${SCHEMA}.consent_texts`, 'r'],
  ['command_ledger', 'command_ledger_user_fk', 'users', 'c'],
  ['declared_facts', 'declared_facts_country_fk', `${SCHEMA}.area_countries`, 'r'],
  ['declared_facts', 'declared_facts_draft_fk', `${SCHEMA}.drafts`, 'c'],
  ['declared_facts', 'declared_facts_region_fk', `${SCHEMA}.area_regions`, 'r'],
  ['drafts', 'drafts_user_fk', 'users', 'c'],
  ['gate_events', 'gate_events_scope_fk', `${SCHEMA}.gate_states`, 'r'],
  ['notes', 'notes_draft_fk', `${SCHEMA}.drafts`, 'c'],
  ['prior_understanding_decisions', 'prior_understanding_decisions_draft_fk', `${SCHEMA}.drafts`, 'c'],
];
// Every function of the schema, and who may run it: OWNER_ENTRY = authenticated only; INTERNAL = no application role.
const OWNER_ENTRY = ['apply_own_command_v1', 'discard_own_v1', 'grant_own_assistance_v1', 'read_availability_v1',
  'read_own_assistance_items_v1', 'read_own_preparation_v1', 'revoke_own_assistance_v1'];
const INTERNAL = ['apply_command_v1', 'bind_gate_v1', 'canonical_requirement_items_v1', 'discard_v1', 'draft_version_v1',
  'eligible_prior_item_v1', 'enter_owner_command_v1', 'fingerprint_v1', 'gate_open_v1', 'grant_assistance_v1',
  'has_exact_keys_v1', 'replay_v1', 'requirement_discrepancies_v1', 'revoke_assistance_v1', 'set_gate_v1',
  'string_set_v1', 'whole_number_v1'];
const PURE = ['fingerprint_v1', 'has_exact_keys_v1', 'requirement_discrepancies_v1', 'string_set_v1', 'whole_number_v1'];
const PUBLIC_ENTRY = ['apply_own_matching_preparation_command_v1', 'discard_own_matching_preparation_v1',
  'grant_own_matching_onboarding_assistance_v1', 'read_matching_preparation_availability_v1',
  'read_own_matching_onboarding_assistance_items_v1', 'read_own_matching_preparation_v1',
  'revoke_own_matching_onboarding_assistance_v1'];
const SIX = ['activate_matching_participation_v1', 'resume_matching_participation_v1', 'grant_matching_context_v1',
  'set_introduction_profile_v1', 'set_matching_requirements_v1', 'grant_pre_match_disclosure_authority_v1'];
const ROLES = ['anon', 'authenticated', 'service_role'];

async function verifyCatalog() {
  stage = 'catalog: the exact relation set; RLS on; no application role holds any privilege on any of them';
  const relations = await rows(`SELECT c.relname, c.relkind, c.relrowsecurity FROM pg_class c
    WHERE c.relnamespace = '${SCHEMA}'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'f') ORDER BY c.relname`);
  assert.deepEqual(relations.map((r) => r.relname), TABLES);
  assert.ok(relations.every((r) => r.relkind === 'r' && r.relrowsecurity), 'every relation is a table with RLS enabled');
  for (const table of TABLES) {
    for (const role of ROLES) {
      assert.equal((await one(`SELECT has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS p`, [role, `${SCHEMA}.${table}`])).p,
        false, `${role} holds no privilege on ${table}`);
    }
    const acl = await one(`SELECT c.relacl::text AS acl FROM pg_class c WHERE c.oid = $1::regclass`, [`${SCHEMA}.${table}`]);
    assert.ok(acl.acl === null || !/(^|[{,])=/u.test(acl.acl), `PUBLIC holds nothing on ${table}`);
  }
  assert.equal(await count(`SELECT count(*) AS n FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid WHERE c.relnamespace = '${SCHEMA}'::regnamespace`), 0,
    'no row policy exists, so RLS refuses every direct read');
  for (const role of ['anon', 'service_role']) {
    assert.equal((await one(`SELECT has_schema_privilege($1, '${SCHEMA}', 'USAGE') AS p`, [role])).p, false, `${role} has no schema usage`);
  }

  stage = 'catalog: the exact foreign-key set; every account reference cascades; nothing outside references the schema';
  const fks = await rows(`SELECT c.conrelid::regclass::text AS rel, c.conname, c.confrelid::regclass::text AS target, c.confdeltype
    FROM pg_constraint c WHERE c.contype = 'f' AND c.connamespace = '${SCHEMA}'::regnamespace ORDER BY 1, 2`);
  assert.deepEqual(fks.map((f) => [f.rel.replace(`${SCHEMA}.`, ''), f.conname, f.target, f.confdeltype]), FOREIGN_KEYS);
  assert.equal(await count(`SELECT count(*) AS n FROM pg_constraint c WHERE c.contype = 'f'
      AND c.connamespace <> '${SCHEMA}'::regnamespace
      AND c.confrelid IN (SELECT r.oid FROM pg_class r WHERE r.relnamespace = '${SCHEMA}'::regnamespace)`), 0,
    'no relation outside the schema references it, so nothing here can be held by another domain');
  assert.equal(await count(`SELECT count(*) AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relnamespace = '${SCHEMA}'::regnamespace AND NOT t.tgisinternal`), 0, 'no trigger can refuse the erasure');
  const accountColumns = await rows(`SELECT table_name FROM information_schema.columns
      WHERE table_schema = '${SCHEMA}' AND column_name = 'user_id' ORDER BY 1`);
  assert.deepEqual(accountColumns.map((c) => c.table_name), ['assistance_consents', 'command_ledger', 'declared_facts', 'drafts', 'notes', 'prior_understanding_decisions'],
    'exactly these relations carry an account, and each reaches public.users through a cascading key');

  stage = 'catalog: the exact function set, security, search_path, owner and who may run each';
  const functions = await rows(`SELECT p.oid, p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS owner, p.prosrc,
      p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql') AS plpgsql
    FROM pg_proc p WHERE p.pronamespace = '${SCHEMA}'::regnamespace ORDER BY p.proname`);
  assert.deepEqual(functions.map((f) => f.proname), [...OWNER_ENTRY, ...INTERNAL].sort());
  for (const fn of functions) {
    assert.equal(fn.owner, 'postgres', `${fn.proname} is owned by postgres`);
    assert.ok(['search_path=""', 'search_path='].includes((fn.proconfig ?? [])[0]) && fn.proconfig.length === 1, `${fn.proname} pins an empty search_path`);
    assert.equal(fn.prosecdef, !PURE.includes(fn.proname), `${fn.proname}: SECURITY DEFINER exactly when it reads a relation`);
    assert.doesNotMatch(fn.prosrc, /\bEXECUTE\b/u, `${fn.proname} runs no dynamic SQL`);
    assert.doesNotMatch(fn.prosrc, /40001|PT409/u, `${fn.proname} raises no retryable or stale SQLSTATE`);
    for (const name of SIX) assert.ok(!fn.prosrc.includes(name), `${fn.proname} never names ${name}`);
    for (const write of fn.prosrc.matchAll(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-z_]+\.[a-z_]+)/giu)) {
      assert.ok(write[1].startsWith(`${SCHEMA}.`), `${fn.proname} writes only inside the schema, not ${write[1]}`);
    }
    for (const role of ROLES) {
      const can = (await one('SELECT has_function_privilege($1, $2::oid, \'EXECUTE\') AS p', [role, fn.oid])).p;
      assert.equal(can, role === 'authenticated' && OWNER_ENTRY.includes(fn.proname), `${role} EXECUTE ${fn.proname}`);
    }
  }
  const publics = await rows(`SELECT p.oid, p.proname, p.prosecdef, pg_get_function_identity_arguments(p.oid) AS args,
      pg_get_userbyid(p.proowner) AS owner, p.proconfig
    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND (p.proname LIKE '%matching_preparation%' OR p.proname LIKE '%matching_onboarding%') ORDER BY p.proname`);
  assert.deepEqual(publics.map((f) => f.proname), PUBLIC_ENTRY);
  for (const fn of publics) {
    assert.equal(fn.prosecdef, false, `${fn.proname} is a SECURITY INVOKER pass-through`);
    assert.equal(fn.owner, 'postgres');
    assert.ok(!/p_user|user_id|account/u.test(fn.args), `${fn.proname} takes no account parameter (${fn.args})`);
    for (const role of ROLES) {
      assert.equal((await one('SELECT has_function_privilege($1, $2::oid, \'EXECUTE\') AS p', [role, fn.oid])).p, role === 'authenticated', `${role} EXECUTE ${fn.proname}`);
    }
    assert.equal((await one(`SELECT coalesce(bool_or(a.grantee = 0), false) AS p FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE p.oid = $1`, [fn.oid])).p, false, `PUBLIC cannot run ${fn.proname}`);
  }

  stage = 'catalog: the six commands 0149 closed are still closed to every application role (D1)';
  for (const name of SIX) {
    const fn = await one(`SELECT p.oid FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = $1`, [name]);
    for (const role of ROLES) {
      assert.equal((await one('SELECT has_function_privilege($1, $2::oid, \'EXECUTE\') AS p', [role, fn.oid])).p, false, `${role} cannot run ${name}`);
    }
  }

  stage = 'catalog: gates absent (closed); the catalogues; the consent text and its digests';
  assert.equal(await count(`SELECT count(*) AS n FROM ${SCHEMA}.gate_states`), 0, 'no gate is configured');
  assert.equal(await count(`SELECT count(*) AS n FROM ${SCHEMA}.gate_events`), 0);
  assert.deepEqual((await rows(`SELECT country_code FROM ${SCHEMA}.area_countries ORDER BY 1`)).map((c) => c.country_code),
    ['AE', 'BH', 'DJ', 'DZ', 'EG', 'IQ', 'JO', 'KM', 'KW', 'LB', 'LY', 'MA', 'MR', 'OM', 'PS', 'QA', 'SA', 'SD', 'SO', 'SY', 'TN', 'YE'],
    'exactly the 22 member states of the Arab League (a preparation catalogue, not launch policy)');
  const perCountry = await rows(`SELECT c.country_code, c.regions_listed, count(r.region_code)::int AS n
    FROM ${SCHEMA}.area_countries c LEFT JOIN ${SCHEMA}.area_regions r ON r.country_code = c.country_code GROUP BY 1, 2 ORDER BY 1`);
  const listed = Object.fromEntries(perCountry.filter((c) => c.regions_listed).map((c) => [c.country_code, c.n]));
  assert.deepEqual(listed, { AE: 7, BH: 4, EG: 27, JO: 12, KW: 6, OM: 11, QA: 8, SA: 13 });
  assert.ok(perCountry.filter((c) => !c.regions_listed).every((c) => c.n === 0), 'a country without listed regions has none');
  const consent = await rows(`SELECT consent_version, purpose, is_current,
      sha256_ar = encode(sha256(convert_to(text_ar, 'UTF8')), 'hex') AND sha256_en = encode(sha256(convert_to(text_en, 'UTF8')), 'hex') AS digests
    FROM ${SCHEMA}.consent_texts`);
  assert.deepEqual(consent, [{ consent_version: 'MATCHING_ONBOARDING_ASSISTANCE_V1', purpose: 'MATCHING_ONBOARDING_ASSISTANCE', is_current: true, digests: true }]);
}

// ------------------------------------------------------------------------------------------------------------------
async function verifyGates() {
  await inTransaction(async () => {
    const alice = await account();
    await memory(alice, { content: 'أريد أن أتزوج هذا العام' , type: 'GOAL' });

    stage = 'gates: absent = closed - every write UNAVAILABLE, the reader empty, every hint false, nothing written';
    assert.deepEqual(await cmd(alice, 'SET_FACT', { fact: 'SEX', sex: 'FEMALE' }, 0), { outcome: 'UNAVAILABLE' });
    assert.deepEqual(await grant(alice), { outcome: 'UNAVAILABLE' });
    assert.deepEqual(await items(alice), []);
    await actAs('authenticated', alice);
    assert.deepEqual(await one('SELECT * FROM public.read_matching_preparation_availability_v1()'),
      { preparation_available: false, assistance_available: false, enrollment_available: false, has_draft: false });
    await asOwner();
    const view = await readOwn(alice);
    assert.equal(view.draft, null);
    assert.deepEqual(view.availability, { preparation: false, assistance: false, enrollment: false });
    assert.equal(await count(`SELECT count(*) AS n FROM ${SCHEMA}.drafts`), await count(`SELECT count(*) AS n FROM ${SCHEMA}.drafts WHERE user_id <> $1`, [alice]));

    stage = 'gates: only ENABLED with SATISFIED / WAIVED opens; every other state denies';
    const eventsBefore = await count(`SELECT count(*) AS n FROM ${SCHEMA}.gate_events WHERE scope = 'PREPARATION'`);
    for (const [flag, requirement] of [['ENABLED', 'UNKNOWN'], ['ENABLED', 'UNSATISFIED'], ['INTERNAL', 'SATISFIED'],
      ['LIMITED_ROLLOUT', 'SATISFIED'], ['DISABLED', 'SATISFIED'], ['EMERGENCY_DISABLED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE']]) {
      await client.query(`SELECT * FROM ${SCHEMA}.set_gate_v1('PREPARATION', $1, $2, 'verify-0154', 'fixture')`, [flag, requirement]);
      assert.equal((await cmd(alice, 'SET_FACT', { fact: 'SEX', sex: 'FEMALE' }, 0)).outcome, 'UNAVAILABLE', `${flag} / ${requirement} denies`);
    }
    await client.query(`SELECT * FROM ${SCHEMA}.set_gate_v1('PREPARATION', 'ENABLED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE', 'verify-0154', 'fixture')`);
    assert.equal((await cmd(alice, 'SET_FACT', { fact: 'SEX', sex: 'FEMALE' }, 0)).outcome, 'APPLIED');
    const changes = 7; // the six denying states above and the one opening state
    assert.equal(await count(`SELECT count(*) AS n FROM ${SCHEMA}.gate_events WHERE scope = 'PREPARATION'`) - eventsBefore, changes, 'every gate change is audited');

    stage = 'gates: preparation open but assistance closed - no grant, no reader';
    assert.deepEqual(await grant(alice), { outcome: 'UNAVAILABLE' });
    assert.deepEqual(await items(alice), []);

    stage = 'gates: the operator functions run for no application role';
    for (const role of ROLES) {
      await actAs(role, role === 'authenticated' ? alice : null);
      await rejected(() => client.query(`SELECT * FROM ${SCHEMA}.set_gate_v1('PREPARATION', 'ENABLED', 'SATISFIED', 'x', 'y')`), ['42501']);
      await rejected(() => client.query(`SELECT ${SCHEMA}.bind_gate_v1('PREPARATION')`), ['42501']);
      await rejected(() => client.query(`SELECT ${SCHEMA}.apply_command_v1($1, $2, 0, 'SET_FACT', '{}')`, [alice, randomUUID()]), ['42501']);
    }
    await asOwner();
  });
}

// ------------------------------------------------------------------------------------------------------------------
async function verifyDraft() {
  await inTransaction(async () => {
    await openGates();
    const alice = await account();
    const bob = await account();

    stage = 'draft: a declared fact is DECLARED, CONFIRMED in its own act, CORRECTED when changed, CONFIRMED again';
    let r = await cmd(alice, 'SET_FACT', { fact: 'SEX', sex: 'MALE' }, 0);
    assert.deepEqual(r, { outcome: 'APPLIED', version: 1 });
    let view = await readOwn(alice);
    assert.deepEqual(view.draft.facts.sex, { value: 'MALE', state: 'DECLARED' });
    r = await cmd(alice, 'CONFIRM_FACT', { fact: 'SEX' }, 1);
    assert.deepEqual(r, { outcome: 'APPLIED', version: 2 });
    assert.deepEqual((await readOwn(alice)).draft.facts.sex, { value: 'MALE', state: 'CONFIRMED' });
    r = await cmd(alice, 'SET_FACT', { fact: 'SEX', sex: 'FEMALE' }, 2);
    assert.deepEqual((await readOwn(alice)).draft.facts.sex, { value: 'FEMALE', state: 'CORRECTED' }, 'a change to a confirmed fact needs confirming again');
    assert.equal(await count(`SELECT count(*) AS n FROM ${SCHEMA}.declared_facts WHERE user_id = $1 AND sex_confirmed_at IS NULL`, [alice]), 1);
    r = await cmd(alice, 'CONFIRM_FACT', { fact: 'SEX' }, 3);
    assert.deepEqual((await readOwn(alice)).draft.facts.sex, { value: 'FEMALE', state: 'CONFIRMED' });
    assert.deepEqual(await cmd(alice, 'CONFIRM_FACT', { fact: 'SEX' }, 4), { outcome: 'NOTHING_TO_CONFIRM', version: 4 });
    assert.deepEqual(await cmd(alice, 'CONFIRM_FACT', { fact: 'MARITAL_STATUS' }, 4), { outcome: 'NOTHING_TO_CONFIRM', version: 4 });
    assert.deepEqual(await cmd(bob, 'CONFIRM_FACT', { fact: 'SEX' }, 0), { outcome: 'NOTHING_TO_CONFIRM', version: 0 });
    assert.equal((await readOwn(bob)).draft, null, 'a refused first command leaves no empty draft');

    stage = 'draft: every field is validated; a refusal is 22023 and writes nothing';
    const before = JSON.stringify(await readOwn(alice));
    const invalid = [
      ['SET_FACT', { fact: 'INTRODUCTION_FIRST_NAME', firstName: 'Sara1' }],
      ['SET_FACT', { fact: 'INTRODUCTION_FIRST_NAME', firstName: '' }],
      ['SET_FACT', { fact: 'INTRODUCTION_FIRST_NAME', firstName: 'a'.repeat(33) }],
      ['SET_FACT', { fact: 'INTRODUCTION_FIRST_NAME', firstName: 'سارة@' }],
      ['SET_FACT', { fact: 'INTRODUCTION_FIRST_NAME', firstName: 'Sara', extra: 1 }],
      ['SET_FACT', { fact: 'SEX', sex: 'OTHER' }],
      ['SET_FACT', { fact: 'SEX', sex: 'male' }],
      ['SET_FACT', { fact: 'BIRTH_YEAR_MONTH', year: 1899, month: 1 }],
      ['SET_FACT', { fact: 'BIRTH_YEAR_MONTH', year: 1990, month: 13 }],
      ['SET_FACT', { fact: 'BIRTH_YEAR_MONTH', year: 1990.5, month: 1 }],
      ['SET_FACT', { fact: 'BIRTH_YEAR_MONTH', year: new Date().getUTCFullYear() + 1, month: 1 }],
      ['SET_FACT', { fact: 'BIRTH_YEAR_MONTH', year: '1990', month: 1 }],
      ['SET_FACT', { fact: 'BROAD_AREA', countryCode: 'EG', regionCode: null }],
      ['SET_FACT', { fact: 'BROAD_AREA', countryCode: 'EG', regionCode: 'SA-01' }],
      ['SET_FACT', { fact: 'BROAD_AREA', countryCode: 'LB', regionCode: 'LB-BA' }],
      ['SET_FACT', { fact: 'BROAD_AREA', countryCode: 'FR', regionCode: null }],
      ['SET_FACT', { fact: 'MARITAL_STATUS', maritalStatus: 'ENGAGED' }],
      ['SET_FACT', { fact: 'HEIGHT', value: 170 }],
      ['SET_PROFILE', { shortIntroduction: 'too short', workField: null }],
      ['SET_PROFILE', { shortIntroduction: null, workField: 'ASTRONAUT' }],
      ['SET_PROFILE', { shortIntroduction: null }],
      ['SET_REQUIREMENTS', { strength: 'HARD', answer: 'NONE', items: [] }],
      ['SET_REQUIREMENTS', { strength: 'SOFT', answer: 'NONE_ADDITIONAL', items: [] }],
      ['SET_REQUIREMENTS', { strength: 'HARD', answer: 'ITEMS', items: [] }],
      ['SET_REQUIREMENTS', { strength: 'HARD', answer: 'NONE_ADDITIONAL', items: [{ dimension: 'AGE_RANGE', min: 25, max: 30 }] }],
      ['SET_REQUIREMENTS', { strength: 'HARD', answer: 'ITEMS', items: [{ dimension: 'AGE_RANGE', min: 17, max: 30 }] }],
      ['SET_REQUIREMENTS', { strength: 'HARD', answer: 'ITEMS', items: [{ dimension: 'AGE_RANGE', min: 35, max: 30 }] }],
      ['SET_REQUIREMENTS', { strength: 'HARD', answer: 'ITEMS', items: [{ dimension: 'AGE_RANGE', min: 25, max: 30 }, { dimension: 'AGE_RANGE', min: 26, max: 30 }] }],
      ['SET_REQUIREMENTS', { strength: 'HARD', answer: 'ITEMS', items: [{ dimension: 'MARITAL_STATUS', accepted: [] }] }],
      ['SET_REQUIREMENTS', { strength: 'HARD', answer: 'ITEMS', items: [{ dimension: 'MARITAL_STATUS', accepted: ['DIVORCED', 'DIVORCED'] }] }],
      ['SET_REQUIREMENTS', { strength: 'HARD', answer: 'ITEMS', items: [{ dimension: 'AREA', countryCode: 'EG', regionCodes: ['SA-01'] }] }],
      ['SET_REQUIREMENTS', { strength: 'HARD', answer: 'ITEMS', items: [{ dimension: 'RELIGIOSITY', level: 'HIGH' }] }],
      ['SET_REQUIREMENTS', { strength: 'HARD', answer: 'ITEMS', items: [{ dimension: 'AGE_RANGE', min: 25, max: 30, note: 'x' }] }],
      ['ADD_NOTE', { kind: 'ABOUT_ME', body: 'x' }],
      ['ADD_NOTE', { kind: 'SECRET', body: 'I like long walks' }],
      ['REMOVE_NOTE', { noteId: randomUUID() }],
      ['SKIP_STEP', { step: 'SEX' }],
      ['CONFIRM_REVIEW', { force: true }],
      ['DELETE_EVERYTHING', {}],
    ];
    for (const [kind, payload] of invalid) {
      await actAs('authenticated', alice);
      await rejected(() => client.query(CMD, [randomUUID(), 4, kind, JSON.stringify(payload)]), ['22023']);
      await asOwner();
    }
    assert.equal(JSON.stringify(await readOwn(alice)), before, 'no refused command changed anything');
    const appliedSoFar = ['SET_FACT', 'CONFIRM_FACT', 'SET_FACT', 'CONFIRM_FACT'];
    assert.deepEqual((await rows(`SELECT command_kind FROM ${SCHEMA}.command_ledger WHERE user_id = $1 ORDER BY result_version`, [alice])).map((l) => l.command_kind),
      appliedSoFar, 'only the applied commands are ledgered');

    stage = 'draft: valid names, areas, marital statuses, profile, requirements, notes and skips';
    let v = 4;
    const ok = async (kind, payload) => { const a = await cmd(alice, kind, payload, v); assert.equal(a.outcome, 'APPLIED', `${kind} ${JSON.stringify(payload)}: ${JSON.stringify(a)}`); v = a.version; };
    for (const name of ['سارة', 'Sara', 'عبد الرحمن', "O'Neil", 'Anne-Marie', 'مُحمّد', 'Zoë']) await ok('SET_FACT', { fact: 'INTRODUCTION_FIRST_NAME', firstName: name });
    await ok('SET_FACT', { fact: 'INTRODUCTION_FIRST_NAME', firstName: '  ليلى  ' });
    assert.equal((await readOwn(alice)).draft.facts.firstName.value, 'ليلى', 'stored trimmed');
    await ok('SET_FACT', { fact: 'BROAD_AREA', countryCode: 'LB', regionCode: null });
    await ok('SET_FACT', { fact: 'BROAD_AREA', countryCode: 'SA', regionCode: 'SA-14' });
    for (const status of ['NEVER_MARRIED', 'DIVORCED', 'WIDOWED', 'CURRENTLY_MARRIED']) await ok('SET_FACT', { fact: 'MARITAL_STATUS', maritalStatus: status });
    await ok('SET_FACT', { fact: 'BIRTH_YEAR_MONTH', year: 1994, month: 11 });
    await ok('SET_PROFILE', { shortIntroduction: 'أحب القراءة والسفر وأقدّر الصدق.', workField: 'EDUCATION' });
    await ok('SET_REQUIREMENTS', { strength: 'HARD', answer: 'ITEMS', items: [
      { dimension: 'AGE_RANGE', min: 28, max: 38 }, { dimension: 'MARITAL_STATUS', accepted: ['NEVER_MARRIED', 'DIVORCED'] }] });
    await ok('SET_REQUIREMENTS', { strength: 'SOFT', answer: 'ITEMS', items: [
      { dimension: 'AGE_RANGE', min: 30, max: 40 }, { dimension: 'AREA', countryCode: 'SA', regionCodes: ['SA-01', 'SA-02'] }] });
    view = await readOwn(alice);
    assert.deepEqual(view.draft.requirements.discrepancies, ['AGE_RANGE'], 'a soft age range outside the hard range is a discrepancy');
    assert.deepEqual(view.draft.requirements.hard.items[1], { dimension: 'MARITAL_STATUS', accepted: ['DIVORCED', 'NEVER_MARRIED'] }, 'stored canonical');
    for (let i = 0; i < 8; i += 1) await ok('ADD_NOTE', { kind: i % 2 ? 'ABOUT_ME' : 'WHAT_MATTERS', body: `ملاحظة رقم ${i + 1}` });
    assert.deepEqual(await cmd(alice, 'ADD_NOTE', { kind: 'ABOUT_ME', body: 'واحدة أخرى' }, v), { outcome: 'NOTE_LIMIT_REACHED', version: v });
    const noteId = (await readOwn(alice)).draft.notes[0].id;
    await ok('REMOVE_NOTE', { noteId });
    await ok('SKIP_STEP', { step: 'WORK_FIELD' });
    await ok('SKIP_STEP', { step: 'WORK_FIELD' });
    assert.deepEqual((await readOwn(alice)).draft.skippedSteps, ['WORK_FIELD']);

    stage = 'draft: review needs every fact confirmed, both answers and no discrepancy; any later change marks it changed';
    assert.equal((await cmd(alice, 'CONFIRM_REVIEW', {}, v)).outcome, 'NOT_READY_FOR_REVIEW');
    for (const fact of ['INTRODUCTION_FIRST_NAME', 'BIRTH_YEAR_MONTH', 'BROAD_AREA', 'MARITAL_STATUS']) await ok('CONFIRM_FACT', { fact });
    assert.equal((await cmd(alice, 'CONFIRM_REVIEW', {}, v)).outcome, 'NOT_READY_FOR_REVIEW', 'the discrepancy still blocks review');
    await ok('SET_REQUIREMENTS', { strength: 'SOFT', answer: 'ITEMS', items: [{ dimension: 'AGE_RANGE', min: 30, max: 35 }] });
    await ok('CONFIRM_REVIEW', {});
    assert.deepEqual((await readOwn(alice)).draft.review, { state: 'REVIEWED', reviewedVersion: v });
    await ok('SET_FACT', { fact: 'MARITAL_STATUS', maritalStatus: 'WIDOWED' });
    assert.equal((await readOwn(alice)).draft.review.state, 'CHANGED_SINCE_REVIEW');
    assert.equal((await readOwn(alice)).draft.facts.maritalStatus.state, 'CORRECTED');

    stage = 'draft: "no additional hard dealbreakers" and zero soft preferences are valid confirmed answers';
    await ok('SET_REQUIREMENTS', { strength: 'HARD', answer: 'NONE_ADDITIONAL', items: [] });
    await ok('SET_REQUIREMENTS', { strength: 'SOFT', answer: 'NONE', items: [] });
    await ok('CONFIRM_FACT', { fact: 'MARITAL_STATUS' });
    await ok('CONFIRM_REVIEW', {});
    view = await readOwn(alice);
    assert.deepEqual(view.draft.requirements, { hard: { answer: 'NONE_ADDITIONAL', items: [] }, soft: { answer: 'NONE', items: [] }, discrepancies: [] });
    assert.equal(view.availability.enrollment, false, 'a reviewed draft is never enrollment');

    stage = 'draft: compare-and-set - a stale expectation changes nothing';
    const snapshot = JSON.stringify(await readOwn(alice));
    assert.deepEqual(await cmd(alice, 'SET_FACT', { fact: 'SEX', sex: 'MALE' }, v - 1), { outcome: 'STALE_VERSION', version: v });
    assert.deepEqual(await cmd(alice, 'SET_FACT', { fact: 'SEX', sex: 'MALE' }, v + 5), { outcome: 'STALE_VERSION', version: v });
    assert.equal(JSON.stringify(await readOwn(alice)), snapshot);

    stage = 'draft: a retry answers its first result; a reused id with another request changes nothing; refusals are not ledgered';
    const id = randomUUID();
    const first = await cmd(alice, 'ADD_NOTE', { kind: 'ABOUT_ME', body: 'أعمل معلمة' }, v, id);
    assert.deepEqual(first, { outcome: 'APPLIED', version: v + 1 });
    assert.deepEqual(await cmd(alice, 'ADD_NOTE', { kind: 'ABOUT_ME', body: 'أعمل معلمة' }, v, id), { outcome: 'APPLIED', version: v + 1, replayed: true });
    assert.deepEqual(await cmd(alice, 'ADD_NOTE', { kind: 'ABOUT_ME', body: 'شيء آخر' }, v, id), { outcome: 'COMMAND_ID_REUSED' });
    assert.deepEqual(await cmd(alice, 'SKIP_STEP', { step: 'NOTES' }, v, id), { outcome: 'COMMAND_ID_REUSED' });
    assert.equal((await readOwn(alice)).draft.notes.filter((n) => n.body === 'أعمل معلمة').length, 1, 'applied once');
    v += 1;
    const staleId = randomUUID();
    assert.equal((await cmd(alice, 'SKIP_STEP', { step: 'NOTES' }, v - 1, staleId)).outcome, 'STALE_VERSION');
    assert.equal((await cmd(alice, 'SKIP_STEP', { step: 'NOTES' }, v, staleId)).outcome, 'APPLIED', 'a refused command id is judged again');

    stage = 'isolation: another account neither reads nor changes the draft; anon and service_role run nothing';
    assert.equal((await readOwn(bob)).draft, null);
    assert.equal((await cmd(bob, 'SET_FACT', { fact: 'SEX', sex: 'MALE' }, 0)).outcome, 'APPLIED');
    assert.equal((await readOwn(alice)).draft.facts.sex.value, 'FEMALE');
    const aliceNote = (await readOwn(alice)).draft.notes[0].id;
    await actAs('authenticated', bob);
    await rejected(() => client.query(CMD, [randomUUID(), 1, 'REMOVE_NOTE', JSON.stringify({ noteId: aliceNote })]), ['22023']);
    await asOwner();
    assert.ok((await readOwn(alice)).draft.notes.some((n) => n.id === aliceNote), 'another account cannot remove the note');
    for (const role of ['anon', 'service_role']) {
      await actAs(role, null);
      for (const sql of [CMD, 'SELECT public.read_own_matching_preparation_v1()', 'SELECT * FROM public.read_own_matching_onboarding_assistance_items_v1()',
        'SELECT * FROM public.read_matching_preparation_availability_v1()']) {
        await rejected(() => client.query(sql, sql === CMD ? [randomUUID(), 0, 'SET_FACT', '{}'] : []), ['42501']);
      }
      await rejected(() => client.query(`SELECT * FROM ${SCHEMA}.drafts`), ['42501']);
    }
    await asOwner();
    await actAs('authenticated', bob);
    for (const table of TABLES) await rejected(() => client.query(`SELECT * FROM ${SCHEMA}.${table}`), ['42501']);
    await asOwner();
    await actAs('authenticated', null);
    await rejected(() => client.query(CMD, [randomUUID(), 0, 'SET_FACT', JSON.stringify({ fact: 'SEX', sex: 'MALE' })]), ['42501']);
    await asOwner();
  });
}

// ------------------------------------------------------------------------------------------------------------------
async function verifyAssistance() {
  await inTransaction(async () => {
    await openGates();
    const alice = await account();
    const bob = await account();
    const goal = await memory(alice, { content: 'هدفي أن أتزوج خلال هذا العام', type: 'GOAL' });
    const value = await memory(alice, { content: 'أحب الهدوء والصدق', type: 'STABLE_PREFERENCE', ageDays: 3 });
    const fact = await memory(alice, { content: 'أنا ساكنة في الإسكندرية', type: 'PERSONAL_FACT', ageDays: 5, source: 'USER_CONFIRMED' });
    const decision = await memory(alice, { content: 'قررت أن أعود للدراسة', type: 'DECISION_COMMITMENT', ageDays: 400 });
    const excluded = [
      await memory(alice, { content: 'أختي تحب السفر', type: 'PERSONAL_FACT', subject: 'OTHER' }),
      await memory(alice, { content: 'شيء غير منسوب', type: 'PERSONAL_FACT', subject: null }),
      await memory(alice, { content: 'رد عليّ باختصار', type: 'INTERACTION_PREFERENCE' }),
      await memory(alice, { content: 'علاقتي بأمي قوية', type: 'RELATIONSHIP_CONTEXT' }),
      await memory(alice, { content: 'متعبة اليوم', type: 'TEMPORARY_STATE' }),
      await memory(alice, { content: 'نسيت هذا', type: 'GOAL', status: 'DELETED' }),
      await memory(alice, { content: 'لا تعتمد على هذا', type: 'GOAL', status: 'DISABLED' }),
      await memory(alice, { content: 'منتهية', type: 'GOAL', expired: true }),
      await memory(alice, { content: 'مستوردة', type: 'GOAL', source: 'IMPORTED' }),
      await memory(bob, { content: 'هدف بوب', type: 'GOAL' }),
    ];
    const memoryState = async () => JSON.stringify(await rows(`SELECT m.*, a.subject, a.basis FROM public.memories m
      LEFT JOIN public.memory_subject_attributions a ON a.memory_id = m.id WHERE m.user_id = ANY($1) ORDER BY m.id`, [[alice, bob]]));
    const intelligenceCounts = async () => JSON.stringify(await one(`SELECT
        (SELECT count(*) FROM public.memories) AS memories, (SELECT count(*) FROM public.memory_subject_attributions) AS attributions,
        (SELECT count(*) FROM public.memory_control_commands) AS commands, (SELECT count(*) FROM public.hypotheses) AS hypotheses,
        (SELECT count(*) FROM public.him_measurement_events) AS him`));
    const memoryBefore = await memoryState();
    const countsBefore = await intelligenceCounts();

    stage = 'assistance: off by default - the reader is empty and a decision is NOT_ELIGIBLE';
    assert.deepEqual(await items(alice), []);
    assert.equal((await readOwn(alice)).assistance.consent, 'NOT_GRANTED');
    assert.equal((await cmd(alice, 'RECORD_PRIOR_UNDERSTANDING', { memoryId: goal, decision: 'CONFIRMED' }, 0)).outcome, 'NOT_ELIGIBLE');
    assert.equal((await readOwn(alice)).draft, null);

    stage = 'assistance: only the current consent version can be granted; a grant is idempotent by its id';
    assert.deepEqual(await grant(alice, 'MATCHING_ONBOARDING_ASSISTANCE_V0'), { outcome: 'CONSENT_VERSION_NOT_CURRENT' });
    const grantId = randomUUID();
    assert.deepEqual(await grant(alice, undefined, grantId), { outcome: 'GRANTED' });
    assert.deepEqual(await grant(alice, undefined, grantId), { outcome: 'GRANTED', version: 0, replayed: true });
    assert.deepEqual(await grant(alice), { outcome: 'ALREADY_GRANTED' });
    assert.deepEqual((await readOwn(alice)).assistance, { consent: 'GRANTED', grantedVersion: 'MATCHING_ONBOARDING_ASSISTANCE_V1', currentVersion: 'MATCHING_ONBOARDING_ASSISTANCE_V1' });

    stage = 'assistance: the reader returns exactly the owner\'s qualifying SELF Memory, newest first, words as stored';
    const shown = await items(alice);
    assert.deepEqual(shown.map((i) => i.memory_id), [goal, value, fact, decision]);
    assert.deepEqual(shown.map((i) => i.memory_type), ['GOAL', 'STABLE_PREFERENCE', 'PERSONAL_FACT', 'DECISION_COMMITMENT']);
    assert.deepEqual(shown.map((i) => i.recency), ['CURRENT', 'CURRENT', 'CURRENT', 'NEEDS_RECHECK']);
    assert.equal(shown[2].content, 'أنا ساكنة في الإسكندرية', 'the words exactly as stored (no masculine rewrite)');
    for (const id of excluded) assert.ok(!shown.some((i) => i.memory_id === id), 'an excluded item is never shown');
    assert.deepEqual(await items(bob), [], 'another account sees nothing without its own consent');
    for (let i = 0; i < 14; i += 1) await memory(alice, { content: `تفضيل رقم ${i}`, ageDays: 10 + i });
    assert.equal((await items(alice)).length, 12, 'at most 12 items');

    stage = 'assistance: a confirmation copies the words the server re-read; a correction keeps the owner\'s words';
    let r = await cmd(alice, 'RECORD_PRIOR_UNDERSTANDING', { memoryId: fact, decision: 'CONFIRMED' }, 0);
    assert.deepEqual(r, { outcome: 'APPLIED', version: 1 });
    r = await cmd(alice, 'RECORD_PRIOR_UNDERSTANDING', { memoryId: value, decision: 'CORRECTED', correctedBody: 'أحب الهدوء، والصدق أهم شيء عندي' }, 1);
    assert.equal(r.outcome, 'APPLIED');
    r = await cmd(alice, 'RECORD_PRIOR_UNDERSTANDING', { memoryId: decision, decision: 'NO_LONGER_ACCURATE' }, 2);
    assert.equal(r.outcome, 'APPLIED');
    r = await cmd(alice, 'RECORD_PRIOR_UNDERSTANDING', { memoryId: goal, decision: 'DECLINED' }, 3);
    assert.equal(r.outcome, 'APPLIED');
    const notes = (await readOwn(alice)).draft.notes;
    assert.deepEqual(notes.map((n) => [n.kind, n.origin, n.body]), [
      ['ABOUT_ME', 'CONFIRMED_FROM_PRIOR_UNDERSTANDING', 'أنا ساكنة في الإسكندرية'],
      ['WHAT_MATTERS', 'CORRECTED_FROM_PRIOR_UNDERSTANDING', 'أحب الهدوء، والصدق أهم شيء عندي'],
    ]);
    assert.ok(!(await items(alice)).some((i) => [goal, value, fact, decision].includes(i.memory_id)), 'a decided item is not shown again');
    assert.equal((await cmd(alice, 'RECORD_PRIOR_UNDERSTANDING', { memoryId: fact, decision: 'DECLINED' }, 4)).outcome, 'ALREADY_DECIDED');
    for (const id of excluded) {
      assert.equal((await cmd(alice, 'RECORD_PRIOR_UNDERSTANDING', { memoryId: id, decision: 'CONFIRMED' }, 4)).outcome, 'NOT_ELIGIBLE', 'a client cannot name an excluded item');
    }
    await actAs('authenticated', alice);
    await rejected(() => client.query(CMD, [randomUUID(), 4, 'RECORD_PRIOR_UNDERSTANDING', JSON.stringify({ memoryId: goal, decision: 'CONFIRMED', correctedBody: 'x' })]), ['22023']);
    await asOwner();

    stage = 'assistance: Memory, attributions, memory commands, Hypotheses and HIM are never written';
    const after = JSON.parse(await memoryState());
    const before = JSON.parse(memoryBefore);
    for (const row of before) assert.deepEqual(after.find((x) => x.id === row.id), row, 'a Memory shown, confirmed, corrected or rejected is unchanged');
    const countsAfter = JSON.parse(await intelligenceCounts());
    const countsStart = JSON.parse(countsBefore);
    assert.equal(countsAfter.memories - countsStart.memories, 14, 'only the 14 fixtures written by this verifier were added');
    assert.equal(countsAfter.attributions - countsStart.attributions, 14);
    assert.equal(countsAfter.commands, countsStart.commands);
    assert.equal(countsAfter.hypotheses, countsStart.hypotheses);
    assert.equal(countsAfter.him, countsStart.him);

    stage = 'assistance: revocation empties the reader at once and refuses a later decision; the confirmed notes stay';
    assert.deepEqual(await revoke(alice), { outcome: 'REVOKED' });
    assert.deepEqual(await items(alice), []);
    const remaining = await memory(alice, { content: 'أحب العمل التطوعي', ageDays: 1 });
    assert.equal((await cmd(alice, 'RECORD_PRIOR_UNDERSTANDING', { memoryId: remaining, decision: 'CONFIRMED' }, 4)).outcome, 'NOT_ELIGIBLE');
    assert.equal((await readOwn(alice)).draft.notes.length, 2);
    assert.deepEqual(await revoke(alice), { outcome: 'NOT_GRANTED' });
    assert.equal(await count(`SELECT count(*) AS n FROM ${SCHEMA}.assistance_consents WHERE user_id = $1`, [alice]), 1, 'the grant evidence is kept, revoked');

    stage = 'assistance: closing the assistance gate empties the reader even with a current consent';
    assert.deepEqual(await grant(alice), { outcome: 'GRANTED' });
    assert.ok((await items(alice)).length > 0);
    await closeGate('ONBOARDING_ASSISTANCE');
    assert.deepEqual(await items(alice), []);
    assert.equal((await cmd(alice, 'RECORD_PRIOR_UNDERSTANDING', { memoryId: remaining, decision: 'CONFIRMED' }, 4)).outcome, 'UNAVAILABLE');
    assert.deepEqual(await revoke(alice), { outcome: 'REVOKED' }, 'revocation needs no open gate');

    stage = 'discard: removes the draft, its notes and decisions, revokes a current consent; the evidence stays content-free';
    await openGates();
    assert.deepEqual(await grant(alice), { outcome: 'GRANTED' });
    const discardId = randomUUID();
    assert.deepEqual(await discard(alice, discardId), { outcome: 'DISCARDED', version: 0, removedDraft: true });
    assert.deepEqual(await discard(alice, discardId), { outcome: 'DISCARDED', version: 0, replayed: true });
    for (const table of ['drafts', 'declared_facts', 'notes', 'prior_understanding_decisions']) {
      assert.equal(await count(`SELECT count(*) AS n FROM ${SCHEMA}.${table} WHERE user_id = $1`, [alice]), 0, `${table} removed`);
    }
    assert.equal(await count(`SELECT count(*) AS n FROM ${SCHEMA}.assistance_consents WHERE user_id = $1 AND revoked_at IS NULL`, [alice]), 0);
    const ledgerColumns = (await rows(`SELECT column_name FROM information_schema.columns WHERE table_schema = '${SCHEMA}' AND table_name = 'command_ledger' ORDER BY ordinal_position`)).map((c) => c.column_name);
    assert.deepEqual(ledgerColumns, ['user_id', 'command_id', 'command_kind', 'fingerprint', 'outcome', 'result_version', 'created_at'], 'the ledger holds no content');
  });
}

// ------------------------------------------------------------------------------------------------------------------
async function withTwoConnections(work) {
  const second = new Client({ connectionString: databaseUrl });
  await second.connect();
  const created = [];
  try {
    await client.query('BEGIN');
    await openGates();
    const alice = await account();
    created.push(alice);
    await client.query('COMMIT');
    await work(alice, second);
  } finally {
    try { await second.query('ROLLBACK'); } catch { /* none open */ }
    await second.end();
    try { await client.query('ROLLBACK'); } catch { /* none open */ }
    await client.query('RESET ROLE');
    await client.query(`DELETE FROM ${SCHEMA}.drafts WHERE user_id = ANY($1)`, [created]);
    await client.query(`DELETE FROM ${SCHEMA}.assistance_consents WHERE user_id = ANY($1)`, [created]);
    await client.query(`DELETE FROM ${SCHEMA}.command_ledger WHERE user_id = ANY($1)`, [created]);
    // Fixture Memory and the deletion request are append-only / guarded outside the governed erasure: replica mode.
    await client.query('BEGIN');
    await client.query("SET LOCAL session_replication_role = 'replica'");
    await client.query('DELETE FROM personal_data_private.account_deletions WHERE user_id = ANY($1)', [created]);
    await client.query('DELETE FROM public.memory_subject_attributions WHERE user_id = ANY($1)', [created]);
    await client.query('DELETE FROM public.memories WHERE user_id = ANY($1)', [created]);
    await client.query('COMMIT');
    await cleanupVerifierUsers(client, created);
    await client.query('BEGIN');
    await client.query(`DELETE FROM ${SCHEMA}.gate_events`);
    await client.query(`DELETE FROM ${SCHEMA}.gate_states`);
    await client.query('COMMIT');
  }
}
const pause = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
async function isWaiting(promise) {
  const marker = Symbol('pending');
  return (await Promise.race([promise.then(() => 'done', () => 'done'), pause(300).then(() => marker)])) === marker;
}

async function verifyRaces() {
  stage = 'races: a revocation waits for an in-flight read; afterwards the reader is empty';
  await withTwoConnections(async (alice, second) => {
    await client.query('BEGIN');
    const goal = await memory(alice, { content: 'هدفي الاستقرار', type: 'GOAL' });
    await client.query('COMMIT');
    await client.query('BEGIN');
    assert.deepEqual(await grant(alice), { outcome: 'GRANTED' });
    await client.query('COMMIT');
    await client.query('BEGIN');
    assert.equal((await items(alice)).length, 1, 'the read holds the consent FOR SHARE until it ends');
    await second.query('BEGIN');
    const revoking = revoke(alice, randomUUID(), second);
    assert.equal(await isWaiting(revoking), true, 'the revocation waits for the in-flight read');
    await client.query('COMMIT');
    assert.deepEqual(await revoking, { outcome: 'REVOKED' });
    await second.query('COMMIT');
    await client.query('BEGIN');
    assert.deepEqual(await items(alice), [], 'after the revocation commits, nothing is read');

    stage = 'races: a decision after a committed revocation is refused; a revocation waits for an in-flight decision';
    assert.equal((await cmd(alice, 'RECORD_PRIOR_UNDERSTANDING', { memoryId: goal, decision: 'CONFIRMED' }, 0)).outcome, 'NOT_ELIGIBLE');
    assert.deepEqual(await grant(alice), { outcome: 'GRANTED' });
    await client.query('COMMIT');
    await client.query('BEGIN');
    assert.equal((await cmd(alice, 'RECORD_PRIOR_UNDERSTANDING', { memoryId: goal, decision: 'CONFIRMED' }, 0)).outcome, 'APPLIED');
    await second.query('BEGIN');
    const late = revoke(alice, randomUUID(), second);
    assert.equal(await isWaiting(late), true, 'the revocation waits for the decision that relied on the consent');
    await client.query('COMMIT');
    assert.deepEqual(await late, { outcome: 'REVOKED' });
    await second.query('COMMIT');
  });

  stage = 'races: two concurrent first writes serialize - one APPLIED, one STALE_VERSION - and identical retries apply once';
  await withTwoConnections(async (alice, second) => {
    await client.query('BEGIN');
    await second.query('BEGIN');
    const first = await cmd(alice, 'SET_FACT', { fact: 'SEX', sex: 'FEMALE' }, 0, randomUUID(), client);
    const blocked = cmd(alice, 'SET_FACT', { fact: 'SEX', sex: 'MALE' }, 0, randomUUID(), second);
    assert.equal(await isWaiting(blocked), true);
    await client.query('COMMIT');
    assert.deepEqual(first, { outcome: 'APPLIED', version: 1 });
    assert.deepEqual(await blocked, { outcome: 'STALE_VERSION', version: 1 });
    await second.query('COMMIT');
    const id = randomUUID();
    await client.query('BEGIN');
    await second.query('BEGIN');
    const a = await cmd(alice, 'CONFIRM_FACT', { fact: 'SEX' }, 1, id, client);
    const b = cmd(alice, 'CONFIRM_FACT', { fact: 'SEX' }, 1, id, second);
    await client.query('COMMIT');
    assert.deepEqual(a, { outcome: 'APPLIED', version: 2 });
    assert.deepEqual(await b, { outcome: 'APPLIED', version: 2, replayed: true }, 'the same command applied once');
    await second.query('COMMIT');
    assert.equal(await count(`SELECT count(*) AS n FROM ${SCHEMA}.command_ledger WHERE user_id = $1`, [alice]), 2);
  });

  stage = 'races: a deletion request waits for an in-flight write; every later write is ACCOUNT_DELETION_PENDING';
  await withTwoConnections(async (alice, second) => {
    await client.query('BEGIN');
    assert.equal((await cmd(alice, 'SET_FACT', { fact: 'SEX', sex: 'FEMALE' }, 0)).outcome, 'APPLIED');
    // The deletion request takes the account row FOR UPDATE first (0130); so does this emulation of it.
    await second.query('BEGIN');
    const scheduling = second.query(`WITH locked AS (SELECT u.id FROM public.users u WHERE u.id = $1 FOR UPDATE)
      INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, final_at)
      SELECT id, $2, 'SCHEDULED', clock_timestamp() + interval '7 days' FROM locked`, [alice, randomUUID()]);
    assert.equal(await isWaiting(scheduling), true, 'the deletion request waits for the in-flight preparation write');
    await client.query('COMMIT');
    await scheduling;
    await second.query('COMMIT');

    // And the other way round: a write that arrives while a request holds the account row waits, then refuses.
    await client.query('BEGIN');
    await client.query("SET LOCAL session_replication_role = 'replica'");
    await client.query('DELETE FROM personal_data_private.account_deletions WHERE user_id = $1', [alice]);
    await client.query('COMMIT');
    await second.query('BEGIN');
    await second.query(`WITH locked AS (SELECT u.id FROM public.users u WHERE u.id = $1 FOR UPDATE)
      INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, final_at)
      SELECT id, $2, 'SCHEDULED', clock_timestamp() + interval '7 days' FROM locked`, [alice, randomUUID()]);
    await client.query('BEGIN');
    const arriving = cmd(alice, 'CONFIRM_FACT', { fact: 'SEX' }, 1);
    assert.equal(await isWaiting(arriving), true, 'a write waits for the deletion request holding the account row');
    await second.query('COMMIT');
    assert.deepEqual(await arriving, { outcome: 'ACCOUNT_DELETION_PENDING' }, 'and then sees the committed request');
    assert.deepEqual(await grant(alice), { outcome: 'ACCOUNT_DELETION_PENDING' });
    const view = await readOwn(alice);
    assert.equal(view.accountDeletionPending, true);
    assert.equal(view.draft.facts.sex.state, 'DECLARED', 'nothing was written');
    assert.deepEqual(await revoke(alice), { outcome: 'NOT_GRANTED' }, 'a revocation is always answered');
    assert.equal((await discard(alice)).outcome, 'DISCARDED', 'discarding stays available during a pending deletion');
    await client.query('COMMIT');
  });
}

// ------------------------------------------------------------------------------------------------------------------
async function verifyErasure() {
  await inTransaction(async () => {
    stage = 'erasure: an account with a full preparation footprint completes the governed Personal erasure';
    await openGates();
    const alice = await account();
    const bob = await account();
    const goal = await memory(alice, { content: 'هدفي أن أبني أسرة', type: 'GOAL' });
    let v = await fullDraft(alice);
    assert.deepEqual(await grant(alice), { outcome: 'GRANTED' });
    let r = await cmd(alice, 'RECORD_PRIOR_UNDERSTANDING', { memoryId: goal, decision: 'CONFIRMED' }, v);
    v = r.version;
    r = await cmd(alice, 'ADD_NOTE', { kind: 'ABOUT_ME', body: 'أحب الطبخ' }, v);
    await fullDraft(bob);
    const footprint = async (userId) => {
      const out = {};
      for (const table of ['assistance_consents', 'command_ledger', 'declared_facts', 'drafts', 'notes', 'prior_understanding_decisions']) {
        out[table] = await count(`SELECT count(*) AS n FROM ${SCHEMA}.${table} WHERE user_id = $1`, [userId]);
      }
      return out;
    };
    const aliceBefore = await footprint(alice);
    assert.ok(Object.values(aliceBefore).every((n) => n > 0), `a full footprint exists: ${JSON.stringify(aliceBefore)}`);
    const bobBefore = await footprint(bob);
    const deletionId = randomUUID();
    await client.query(`INSERT INTO personal_data_private.account_deletions (id, user_id, command_id, status, requested_at, final_at)
      VALUES ($1, $2, $3, 'SCHEDULED', now() - interval '8 days', now() - interval '1 day')`, [deletionId, alice, randomUUID()]);
    await actAs('service_role');
    assert.equal((await one('SELECT public.server_erase_personal_account_v1($1) AS outcome', [deletionId])).outcome, 'ERASED',
      'ERASED, never BLOCKED: the preparation adds no deletion-blocking footprint');
    await asOwner();
    assert.deepEqual(await footprint(alice), Object.fromEntries(Object.keys(aliceBefore).map((k) => [k, 0])), 'zero rows left');
    assert.equal(await count('SELECT count(*) AS n FROM public.users WHERE id = $1', [alice]), 0);
    assert.deepEqual(await footprint(bob), bobBefore, 'another account is untouched');
  });
}

try {
  await client.connect();
  await verifyCatalog();
  await verifyGates();
  await verifyDraft();
  await verifyAssistance();
  await verifyRaces();
  await verifyErasure();
  console.log('verify-migration-0154: Matching Onboarding Preparation v1 verified (catalog by own enumeration, closed gates, owner draft with CAS and idempotency, validation, isolation, assistance consent and bounded reader, no Memory write, revocation and deletion races, governed erasure ERASED with zero footprint).');
} catch (error) {
  console.error(`verify-migration-0154 FAILED at stage: ${stage}`);
  throw error;
} finally {
  await client.end();
}
