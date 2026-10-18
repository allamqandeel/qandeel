// S6-07 (CP1) / migration 0165 - real-PostgreSQL proof of the ONE governed Matching enrollment.
//
//   A  posture: the schema and its relations, every function's owner / security / search_path / executor, the six 0149
//      commands still executable by no application role, nothing configured at rest, the erasure coverage
//   B  behaviour (rolled back): the closed gate; the four acts; the empty requirement version (Q4', CA-10-impl); the
//      zero-field authority (Q3-A, CA-08-impl); exact consent versions (Q8(A)); every refusal writing NOTHING; the
//      deletion refusal; idempotency and reused ids; independent revocation; correction, resume and reconfirmation; the
//      promotion-evidence precondition (CW2-06B-02 §5); 40001 / PT409 absorbed; the governed erasure of an enrolled human
//   C  races on two real connections (committed fixtures, removed afterwards): enrollment x enrollment, the same command
//      twice, a draft edit both ways, a deletion request both ways, the operator closing the gate, a retained turn-off, a
//      consent text superseded
//
// Every human here is a SYNTHETIC fixture created and removed by this verifier; every consent text is a FIXTURE text, not
// approved Product copy (the Copy Gate owns the real ones). Every scenario reports INDEPENDENTLY; the run fails ONCE.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { createMatchRuntime, runVerifier, APP_ROLES } from './matching-match-verifier-support.mjs';
import { SEC_MATCH_00_SUSPENDED } from './matching-setup-verifier-support.mjs';

const rt = createMatchRuntime(process.env.DATABASE_URL);
const { q, rows, asRole, actAs, rejected } = rt;

const M0165 = new URL('./migrations/0165_matching_governed_enrollment_v1.sql', import.meta.url);
const S = 'matching_enrollment_private';
const PREP = 'introductions_preparation_private';
const ENROLL = 'public.enroll_my_matching_setup_v1(uuid,text,bigint,text,text,text)';
const READ = 'public.read_my_matching_enrollment_v1()';
const EMPTY_CORE = 'public.set_empty_matching_requirements_core_v1(uuid,uuid,uuid)';
const ZERO_CORE = 'public.grant_zero_field_pre_match_disclosure_authority_core_v1(uuid,uuid,uuid,uuid,uuid)';
const FACTS = 'public.resolve_matching_confirmed_facts_v1(uuid)';
const WRITER = 'public.record_matching_confirmed_facts_core_v1(uuid,uuid,uuid,text,timestamptz,text,timestamptz,integer,integer,timestamptz,text,text,timestamptz,text,timestamptz)';
const TABLES = ['command_ledger', 'consent_texts', 'enrollment_acts', 'fact_promotions', 'gate_events', 'gate_states'];
const INTERNAL = ['bind_gate_v1', 'derive_identity_v1', 'encode_requirement_items_v1', 'enter_own_setup_v1', 'fingerprint_v1',
  'gate_open_v1', 'install_consent_text_v1', 'reject_consent_text_rewrite_v1', 'reject_evidence_rewrite_v1', 'set_gate_v1'];
const EVIDENCE = ['command_ledger', 'enrollment_acts', 'fact_promotions'];
const V = Object.freeze({ P: 'S6_07_FIXTURE_PARTICIPATION_V1', C: 'S6_07_FIXTURE_CONTEXT_V1', D: 'S6_07_FIXTURE_DISCLOSURE_V1' });
const ALL = { p: V.P, c: V.C, d: V.D };
const PERMISSION_DENIED = /permission denied for function/iu;
const pause = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// ------------------------------------------------------------------ fixtures
const owner = () => asRole('postgres');
async function openGate(flag = 'ENABLED', requirements = 'SATISFIED', on = q) {
  await on(`SELECT * FROM ${S}.set_gate_v1($1, $2, 'verify-0165', 'fixture gate, not a launch decision')`, [flag, requirements]);
}
async function installTexts(versions = V, on = q) {
  for (const [purpose, version] of [['MATCHING_PARTICIPATION', versions.P], ['MATCHING_CONTEXT_GRANT', versions.C],
    ['PRE_MATCH_DISCLOSURE_AUTHORITY', versions.D]]) {
    await on(`SELECT ${S}.install_consent_text_v1($1, $2, $3, $4)`,
      [version, purpose, `نص تجريبي للتحقق (${purpose}) - ليس نصًا معتمدًا`, `verify-0165 fixture text (${purpose}), not approved copy`]);
  }
}
async function openPreparation(on = q) {
  await on(`SELECT * FROM ${PREP}.set_gate_v1('PREPARATION', 'ENABLED', 'SATISFIED', 'verify-0165', 'fixture gate')`);
}
async function asOn(on, uid) {
  await on('RESET ROLE');
  await on("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
  await on('SET LOCAL ROLE authenticated');
}
async function ownerOn(on) { await on('RESET ROLE'); }
/** As that human, carrying the fresh password proof a deletion request requires (0129 has_recent_password_proof_v1). */
async function asOnWithProof(on, uid) {
  await on('RESET ROLE');
  await on("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: uid, role: 'authenticated',
    amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] })]);
  await on('SET LOCAL ROLE authenticated');
}
const draftVersion = async (human, on = q) =>
  Number((await on(`SELECT ${PREP}.draft_version_v1($1) AS v`, [human])).rows[0].v);
/** One owner preparation command, as that human, at the draft's current version. */
async function prep(human, kind, payload, on = q) {
  await ownerOn(on);
  const expected = await draftVersion(human, on);
  await asOn(on, human);
  try {
    return (await on('SELECT public.apply_own_matching_preparation_command_v1($1, $2, $3, $4) AS a',
      [randomUUID(), expected, kind, payload])).rows[0].a;
  } finally { await ownerOn(on); }
}
const DEFAULT_FACTS = { firstName: 'Sara', sex: 'FEMALE', year: 1995, month: 4, countryCode: 'EG', regionCode: 'EG-C', maritalStatus: 'NEVER_MARRIED' };
/**
 * A reviewed draft built through the REAL S6-01 owner commands. Returns its version. `review: false` stops before the
 * review; `confirm` lists the facts that are confirmed (all by default).
 */
async function reviewedDraft(human, {
  facts = {}, profile = { shortIntroduction: 'I enjoy long walks and quiet evenings at home.', workField: 'HEALTH' },
  hard = { answer: 'NONE_ADDITIONAL', items: [] }, soft = { answer: 'NONE', items: [] },
  confirm = ['INTRODUCTION_FIRST_NAME', 'SEX', 'BIRTH_YEAR_MONTH', 'BROAD_AREA', 'MARITAL_STATUS'], review = true, on = q,
} = {}) {
  const f = { ...DEFAULT_FACTS, ...facts };
  const steps = [
    ['SET_FACT', { fact: 'INTRODUCTION_FIRST_NAME', firstName: f.firstName }],
    ['SET_FACT', { fact: 'SEX', sex: f.sex }],
    ['SET_FACT', { fact: 'BIRTH_YEAR_MONTH', year: f.year, month: f.month }],
    ['SET_FACT', { fact: 'BROAD_AREA', countryCode: f.countryCode, regionCode: f.regionCode }],
    ['SET_FACT', { fact: 'MARITAL_STATUS', maritalStatus: f.maritalStatus }],
    ...confirm.map((fact) => ['CONFIRM_FACT', { fact }]),
    ...(profile ? [['SET_PROFILE', profile]] : []),
    ['SET_REQUIREMENTS', { strength: 'HARD', ...hard }],
    ['SET_REQUIREMENTS', { strength: 'SOFT', ...soft }],
    ...(review ? [['CONFIRM_REVIEW', {}]] : []),
  ];
  for (const [kind, payload] of steps) {
    const answer = await prep(human, kind, payload, on);
    assert.ok(['APPLIED', 'NOT_READY_FOR_REVIEW'].includes(answer.outcome), `fixture ${kind}: ${JSON.stringify(answer)}`);
  }
  return draftVersion(human, on);
}
/** The boundary, as that human. */
async function act(human, kind, draft, consents = {}, command = randomUUID(), on = q) {
  await asOn(on, human);
  try {
    return (await on(`SELECT * FROM public.enroll_my_matching_setup_v1($1, $2, $3, $4, $5, $6)`,
      [command, kind, draft, consents.p ?? null, consents.c ?? null, consents.d ?? null])).rows[0];
  } finally { await ownerOn(on); }
}
const enroll = (human, draft, consents = ALL, command = randomUUID(), on = q) => act(human, 'ENROLL', draft, consents, command, on);
async function readView(human) {
  await asOn(q, human);
  try { return (await rows(`SELECT ${READ.slice(0, READ.indexOf('('))}() AS r`))[0].r; } finally { await owner(); }
}
const setupOf = async (human) => (await rows('SELECT * FROM public.resolve_matching_setup_state_v1($1)', [human]))[0];
/** Every row any part of an enrollment can leave for this human. */
async function footprint(human, on = q) {
  const n = async (sql) => Number((await on(sql, [human])).rows[0].n);
  return {
    locks: await n('SELECT count(*) n FROM public.matching_setup_locks WHERE user_id = $1'),
    participation: await n('SELECT count(*) n FROM public.matching_participation_events WHERE participant_user_id = $1'),
    grants: await n('SELECT count(*) n FROM public.matching_context_grants WHERE grantor_user_id = $1'),
    grantEvents: await n('SELECT count(*) n FROM public.matching_context_consent_events WHERE grantor_user_id = $1'),
    profiles: await n('SELECT count(*) n FROM public.introduction_profile_versions WHERE owner_user_id = $1'),
    requirements: await n('SELECT count(*) n FROM public.matching_requirement_versions WHERE owner_user_id = $1'),
    authorities: await n('SELECT count(*) n FROM public.pre_match_disclosure_authorities WHERE grantor_user_id = $1'),
    authorityEvents: await n('SELECT count(*) n FROM public.pre_match_disclosure_authority_events WHERE grantor_user_id = $1'),
    facts: await n('SELECT count(*) n FROM public.matching_confirmed_fact_versions WHERE owner_user_id = $1'),
    promotions: await n(`SELECT count(*) n FROM ${S}.fact_promotions WHERE user_id = $1`),
    acts: await n(`SELECT count(*) n FROM ${S}.enrollment_acts WHERE user_id = $1`),
    ledger: await n(`SELECT count(*) n FROM ${S}.command_ledger WHERE user_id = $1`),
  };
}
const ZERO = Object.freeze({ locks: 0, participation: 0, grants: 0, grantEvents: 0, profiles: 0, requirements: 0, authorities: 0,
  authorityEvents: 0, facts: 0, promotions: 0, acts: 0, ledger: 0 });
async function human() {
  const id = randomUUID();
  await q('INSERT INTO auth.users(id) VALUES ($1)', [id]);
  return id;
}
const actsOf = (who) => rows(`SELECT * FROM ${S}.enrollment_acts WHERE user_id = $1 ORDER BY committed_at, command_id`, [who]);
const derived = async (slot, who, command) => (await rows(`SELECT ${S}.derive_identity_v1($1, $2, $3) AS id`, [slot, who, command]))[0].id;
async function retained(who, sql, values) {
  await asOn(q, who);
  try { return (await rows(sql, values))[0]; } finally { await owner(); }
}

// ------------------------------------------------------------------ A. posture
async function verifyCatalog(report) {
  await owner();
  await report.section('A01 the schema holds exactly six relations, RLS on, no policy, and no application role reaches any of them', async () => {
    const relations = await rows(`SELECT c.relname, c.relkind, c.relrowsecurity FROM pg_class c
      WHERE c.relnamespace = '${S}'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'f') ORDER BY c.relname`);
    assert.deepEqual(relations.map((r) => r.relname), TABLES);
    assert.ok(relations.every((r) => r.relkind === 'r' && r.relrowsecurity), 'A01 every relation is a table with RLS enabled');
    assert.equal(Number((await rows(`SELECT count(*) n FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
      WHERE c.relnamespace = '${S}'::regnamespace`))[0].n), 0, 'A01 no row policy: RLS refuses every direct read');
    for (const table of TABLES) {
      for (const role of ['public', ...APP_ROLES]) {
        const [{ any }] = await rows(`SELECT bool_or(has_table_privilege($1, $2::regclass, p)) AS any
          FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p`, [role, `${S}.${table}`]);
        assert.equal(any, false, `A01 ${role} holds nothing on ${table}`);
      }
    }
    for (const role of APP_ROLES) {
      assert.equal((await rows(`SELECT has_schema_privilege($1, '${S}', 'USAGE') AS p`, [role]))[0].p, false, `A01 ${role} has no schema usage`);
    }
  });

  await report.section('A02 the function set: two authenticated entry points, two no-role cores, the redefined reader and private helpers', async () => {
    const functions = await rows(`SELECT p.proname FROM pg_proc p WHERE p.pronamespace = '${S}'::regnamespace ORDER BY 1`);
    assert.deepEqual(functions.map((f) => f.proname), INTERNAL, 'A02 exactly the private helpers');
    for (const fn of [ENROLL, READ, EMPTY_CORE, ZERO_CORE, FACTS,
      ...(await rows(`SELECT p.oid::regprocedure::text fn FROM pg_proc p WHERE p.pronamespace = '${S}'::regnamespace`)).map((r) => r.fn)]) {
      const p = await rt.functionPosture(fn);
      assert.equal(p.owner, 'postgres', `A02 ${fn} is postgres-owned`);
      assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'), `A02 ${fn} pins an empty search_path`);
      const entry = fn === ENROLL || fn === READ;
      for (const role of ['public', ...APP_ROLES]) {
        assert.equal(await rt.canExecute(role, fn), entry && role === 'authenticated', `A02 ${role} EXECUTE ${fn}`);
      }
    }
    for (const fn of [ENROLL, READ, EMPTY_CORE, ZERO_CORE, FACTS]) {
      assert.equal((await rt.functionPosture(fn)).secdef, true, `A02 ${fn} is SECURITY DEFINER`);
    }
    assert.equal((await rt.functionPosture(FACTS)).volatility, 's', 'A02 the facts reader is still STABLE');
    const [args] = await rows(`SELECT pg_get_function_identity_arguments($1::regprocedure) AS a`, [ENROLL]);
    assert.equal(args.a, 'p_command_id uuid, p_kind text, p_expected_draft_version bigint, p_participation_consent_version text, p_context_consent_version text, p_disclosure_consent_version text',
      'A02 the boundary takes no human, actor, owner, state or identity parameter');
    assert.equal((await rows(`SELECT count(*)::int n FROM pg_proc WHERE proname = 'enroll_my_matching_setup_v1'`))[0].n, 1, 'A02 one overload');
  });

  await report.section('A03 the six 0149 commands stay executable by no application role; their bodies are unchanged', async () => {
    for (const fn of SEC_MATCH_00_SUSPENDED) {
      for (const role of ['public', ...APP_ROLES]) assert.equal(await rt.canExecute(role, fn), false, `A03 ${role} cannot run ${fn}`);
    }
    const src = (await rt.functionPosture(ENROLL)).prosrc;
    assert.doesNotMatch(src, /grant_pre_match_disclosure_authority_v1/u, 'A03 the boundary never names the field-bearing disclosure grant');
    for (const core of [EMPTY_CORE, ZERO_CORE]) {
      const body = (await rt.functionPosture(core)).prosrc;
      for (const fn of SEC_MATCH_00_SUSPENDED) {
        const name = fn.slice('public.'.length, fn.indexOf('('));
        assert.ok(!body.includes(name), `A03 ${core} never names ${name}`);
      }
      assert.doesNotMatch(body, /auth\.uid/u, `A03 ${core} reads no session identity`);
    }
  });

  await report.section('A04 nothing is configured at rest: no gate row; 0165 installs no consent text', async () => {
    assert.equal(Number((await rows(`SELECT count(*) n FROM ${S}.gate_states`))[0].n), 0, 'A04 the ENROLLMENT gate is absent (DENY)');
    assert.equal(Number((await rows(`SELECT count(*) n FROM ${S}.gate_events`))[0].n), 0, 'A04 no gate change was ever made');
    const migration = readFileSync(M0165, 'utf8').replace(/--[^\n]*/gu, '');
    assert.doesNotMatch(migration, /INSERT INTO matching_enrollment_private\.consent_texts\s*\(consent_version[^;]*VALUES\s*\('/u,
      'A04 the migration seeds no consent text: every text is Product copy and goes through the Copy Gate');
    assert.doesNotMatch(migration, /set_gate_v1\(\s*'ENABLED'/u, 'A04 the migration opens no gate');
  });

  await report.section('A05 erasure coverage: the three evidence relations cascade with the account and are registered', async () => {
    const keys = await rows(`SELECT c.conrelid::regclass::text rel, c.confdeltype FROM pg_constraint c
      WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass AND c.connamespace = '${S}'::regnamespace ORDER BY 1`);
    assert.deepEqual(keys.map((k) => [k.rel, k.confdeltype]), EVIDENCE.map((t) => [`${S}.${t}`, 'c']));
    const registered = await rows(`SELECT relation, coverage FROM account_erasure_private.coverage_registry
      WHERE relation LIKE '${S}.%' ORDER BY 1`);
    assert.deepEqual(registered.map((r) => [r.relation, r.coverage]), EVIDENCE.map((t) => [`${S}.${t}`, 'ACCOUNT_CASCADE']));
    assert.equal(Number((await rows(`SELECT count(*) n FROM pg_constraint c WHERE c.contype = 'f'
      AND c.connamespace <> '${S}'::regnamespace AND c.confrelid IN (SELECT r.oid FROM pg_class r WHERE r.relnamespace = '${S}'::regnamespace)`))[0].n),
    0, 'A05 nothing outside references the schema');
    assert.equal(Number((await rows(`SELECT count(*) n FROM pg_constraint c WHERE c.contype = 'f'
      AND c.connamespace = '${S}'::regnamespace AND c.confrelid IN (SELECT r.oid FROM pg_class r WHERE r.relnamespace = '${PREP}'::regnamespace)`))[0].n),
    0, 'A05 nothing here references the preparation schema (0154 stays unreferenced)');
  });
}

// ------------------------------------------------------------------ B. behaviour
async function verifyBehaviour(report) {
  await owner();
  await q('BEGIN');
  try {
    await openPreparation();

    await report.isolated('B01 the gate absent or not ENABLED+SATISFIED answers NOT_AVAILABLE_NOW and leaves no footprint', async () => {
      await installTexts();
      const h = await human();
      const draft = await reviewedDraft(h);
      assert.equal((await enroll(h, draft)).outcome, 'NOT_AVAILABLE_NOW', 'B01 no gate row is DENY');
      for (const [flag, requirements] of [['DISABLED', 'SATISFIED'], ['INTERNAL', 'SATISFIED'], ['LIMITED_ROLLOUT', 'SATISFIED'],
        ['ENABLED', 'UNSATISFIED'], ['ENABLED', 'UNKNOWN'], ['EMERGENCY_DISABLED', 'SATISFIED']]) {
        await openGate(flag, requirements);
        assert.equal((await enroll(h, draft)).outcome, 'NOT_AVAILABLE_NOW', `B01 ${flag}/${requirements} is DENY`);
      }
      assert.deepEqual(await footprint(h), ZERO, 'B01 a refused act writes nothing at all - not even the lock row');
      assert.equal((await readView(h)).available, false, 'B01 the read says unavailable');
      await openGate('ENABLED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE');
      assert.equal((await enroll(h, draft)).outcome, 'ENROLLED', 'B01 ENABLED + WAIVED_BY_AUTHORIZED_GOVERNANCE allows');
    });

    await report.isolated('B02 anon and service_role cannot run the boundary or the read; a fresh authenticated human is answered', async () => {
      const h = await human();
      for (const role of ['anon', 'service_role']) {
        await asRole(role, h);
        await rejected(() => q(`SELECT * FROM public.enroll_my_matching_setup_v1($1, 'ENROLL', 1, 'A_1', 'B_1', 'C_1')`, [randomUUID()]),
          ['42501'], PERMISSION_DENIED);
        await rejected(() => q('SELECT public.read_my_matching_enrollment_v1()'), ['42501'], PERMISSION_DENIED);
      }
      await owner();
      assert.equal((await enroll(h, 1)).outcome, 'NOT_AVAILABLE_NOW', 'B02 authenticated is answered (closed gate)');
      await asRole('authenticated', null);
      await rejected(() => q(`SELECT * FROM public.enroll_my_matching_setup_v1($1, 'ENROLL', 1, 'A_1', 'B_1', 'C_1')`, [randomUUID()]),
        ['42501'], /MATCHING_AUTHENTICATION_REQUIRED/u);
      await owner();
    });

    await report.isolated('B03 ENROLL: one transaction promotes the reviewed draft and creates the three consent events, each with its exact version', async () => {
      await openGate();
      await installTexts();
      const h = await human();
      const draft = await reviewedDraft(h);
      const command = randomUUID();
      assert.deepEqual(await enroll(h, draft, ALL, command), { outcome: 'ENROLLED', participation_state: 'ACTIVE', matchable: true });
      const [a] = await actsOf(h);
      assert.deepEqual([a.command_id, a.act_kind, Number(a.draft_version), a.participation_consent_version, a.context_consent_version,
        a.disclosure_consent_version], [command, 'ENROLL', draft, V.P, V.C, V.D], 'B03 the act binds the exact draft and the three exact consent versions');
      const setup = await setupOf(h);
      assert.equal(a.participation_event_id, setup.participation_event_id, 'B03 the participation event is the current one');
      assert.equal(a.profile_version_id, setup.introduction_profile_version_id);
      assert.equal(a.requirement_version_id, setup.matching_requirement_version_id);
      const [event] = await rows('SELECT * FROM public.matching_participation_events WHERE id = $1', [a.participation_event_id]);
      assert.deepEqual([event.participation_act, event.resulting_state, event.activation_entry_channel], ['ACTIVATE', 'ACTIVE', 'MANUAL_MY_WORLD_ENTRY']);
      const [grantEvent] = await rows('SELECT * FROM public.matching_context_consent_events WHERE id = $1', [a.context_consent_event_id]);
      assert.equal(grantEvent.event_type, 'GRANTED', 'B03 the Matching Context Grant is its own GRANTED event');
      const [authorityEvent] = await rows('SELECT * FROM public.pre_match_disclosure_authority_events WHERE id = $1', [a.authority_event_id]);
      assert.equal(authorityEvent.event_type, 'GRANTED', 'B03 the disclosure authority is its own GRANTED event');
      assert.equal(new Set([a.participation_event_id, a.context_consent_event_id, a.authority_event_id]).size, 3, 'B03 three distinct events');
      const fields = await rows('SELECT field_key, field_value FROM public.introduction_profile_field_values WHERE profile_version_id = $1 ORDER BY 1',
        [setup.introduction_profile_version_id]);
      assert.deepEqual(fields, [{ field_key: 'short_introduction', field_value: 'I enjoy long walks and quiet evenings at home.' },
        { field_key: 'work_field', field_value: 'HEALTH' }], 'B03 the profile is exactly the draft\'s optional fields');
      const facts = (await rows(`SELECT * FROM ${FACTS.slice(0, FACTS.indexOf('('))}($1)`, [h]))[0];
      assert.deepEqual([facts.fact_version_id, facts.first_name, facts.sex, facts.birth_year, facts.birth_month, facts.country_code,
        facts.region_code, facts.marital_status], [a.fact_version_id, 'Sara', 'FEMALE', 1995, 4, 'EG', 'EG-C', 'NEVER_MARRIED'],
      'B03 the canonical reader answers the promoted facts');
      const [version] = await rows('SELECT f.*, d.first_name_confirmed_at AS draft_at FROM public.matching_confirmed_fact_versions f, '
        + `${PREP}.declared_facts d WHERE f.id = $1 AND d.user_id = $2`, [a.fact_version_id, h]);
      assert.equal(version.first_name_confirmed_at.getTime(), version.draft_at.getTime(), 'B03 the confirmation instant is the owner\'s own, from the draft');
      const [promotion] = await rows(`SELECT * FROM ${S}.fact_promotions WHERE fact_version_id = $1`, [a.fact_version_id]);
      assert.deepEqual([promotion.user_id, promotion.enrollment_command_id, Number(promotion.draft_version)], [h, command, draft],
        'B03 the promotion record names the exact fact version, the act and the reviewed draft version');
      const view = await readView(h);
      assert.equal(view.setup.matchable, true);
      assert.equal(view.enrollment.enrolledDraftVersion, draft);
      assert.deepEqual(Object.keys(view.consents).sort(), ['contextGrant', 'disclosureAuthority', 'participation']);
      assert.equal(view.consents.participation.version, V.P);
      const mine = await retained(h, 'SELECT * FROM public.get_my_matching_setup_v1()', []);
      assert.deepEqual([mine.participation_state, mine.approved_field_count], ['ACTIVE', 0], 'B03 self-inspection: ACTIVE, zero approved fields');
    });

    await report.isolated('B04 the requirement encoding is CW2-06B-03 v1 exactly, and the deterministic decoders read it', async () => {
      await openGate();
      await installTexts();
      const h = await human();
      const draft = await reviewedDraft(h, {
        hard: { answer: 'ITEMS', items: [{ dimension: 'AGE_RANGE', min: 25, max: 35 },
          { dimension: 'AREA', countryCode: 'EG', regionCodes: ['EG-GZ', 'EG-ALX', 'EG-C'] }] },
        soft: { answer: 'ITEMS', items: [{ dimension: 'MARITAL_STATUS', accepted: ['WIDOWED', 'DIVORCED', 'NEVER_MARRIED'] },
          { dimension: 'AGE_RANGE', min: 27, max: 33 }] },
      });
      assert.equal((await enroll(h, draft)).outcome, 'ENROLLED');
      const setup = await setupOf(h);
      const items = await rows(`SELECT requirement_key k, requirement_strength s, requirement_value v FROM public.matching_requirement_items
        WHERE requirement_version_id = $1 ORDER BY 1`, [setup.matching_requirement_version_id]);
      assert.deepEqual(items, [
        { k: 'age_range_preference_v1', s: 'SOFT_PREFERENCE', v: 'min=27;max=33' },
        { k: 'age_range_v1', s: 'HARD_DEALBREAKER', v: 'min=25;max=35' },
        { k: 'area_v1', s: 'HARD_DEALBREAKER', v: 'country=EG;regions=EG-ALX,EG-C,EG-GZ' },
        { k: 'marital_status_preference_v1', s: 'SOFT_PREFERENCE', v: 'accepted=DIVORCED,NEVER_MARRIED,WIDOWED' },
      ], 'B04 keys, strengths and byte-ordered values are the v1 encoding; nothing is added');
      assert.deepEqual((await rows("SELECT * FROM public.matching_structured_area_v1('country=EG;regions=EG-ALX,EG-C,EG-GZ')"))[0],
        { country_code: 'EG', region_codes: ['EG-ALX', 'EG-C', 'EG-GZ'] }, 'B04 the strict decoder reads the area');
      assert.deepEqual((await rows("SELECT * FROM public.matching_structured_marital_set_v1('accepted=DIVORCED,NEVER_MARRIED,WIDOWED')"))[0],
        { accepted: ['DIVORCED', 'NEVER_MARRIED', 'WIDOWED'] }, 'B04 the strict decoder reads the marital set');
    });

    await report.isolated('B05 Q4\': no additional dealbreaker and no preference is a requirement version with ZERO items, and the human is matchable', async () => {
      await openGate();
      await installTexts();
      const h = await human();
      const draft = await reviewedDraft(h);
      assert.deepEqual(await enroll(h, draft), { outcome: 'ENROLLED', participation_state: 'ACTIVE', matchable: true });
      const setup = await setupOf(h);
      assert.ok(setup.matching_requirement_version_id, 'B05 a current requirement version exists');
      assert.equal(Number((await rows('SELECT count(*) n FROM public.matching_requirement_items WHERE requirement_version_id = $1',
        [setup.matching_requirement_version_id]))[0].n), 0, 'B05 with zero items: no sentinel, no invented condition');
      // The frozen 0109 command still refuses an empty set: CA-10-impl did not loosen it.
      await actAs(h);
      await rejected(() => q("SELECT * FROM public.set_matching_requirements_v1(gen_random_uuid(), '{}'::text[], '{}'::text[], '{}'::text[], $1)",
        [setup.matching_requirement_version_id]), ['22023'], /MATCHING_REQUIREMENT_SET_INVALID/u);
      await owner();
      // The core's own durability law: replay, conflict, compare-and-swap.
      const replay = await rows(`SELECT * FROM ${EMPTY_CORE.slice(0, EMPTY_CORE.indexOf('('))}($1, $2, NULL)`, [setup.matching_requirement_version_id, h]);
      assert.deepEqual(replay[0], { matching_requirement_version_id: setup.matching_requirement_version_id, superseded_version_id: null, requirement_count: 0 },
        'B05 an equivalent retry answers the committed version');
      await rejected(() => q(`SELECT * FROM ${EMPTY_CORE.slice(0, EMPTY_CORE.indexOf('('))}($1, $2, $3)`,
        [setup.matching_requirement_version_id, h, randomUUID()]), ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
      await rejected(() => q(`SELECT * FROM ${EMPTY_CORE.slice(0, EMPTY_CORE.indexOf('('))}($1, $2, NULL)`, [randomUUID(), h]),
        ['40001'], /MATCHING_STALE_STATE/u);
    });

    await report.isolated('B06 Q3-A: the disclosure authority approves ZERO fields over the exact current profile version', async () => {
      await openGate();
      await installTexts();
      const h = await human();
      const draft = await reviewedDraft(h);
      assert.equal((await enroll(h, draft)).outcome, 'ENROLLED');
      const setup = await setupOf(h);
      const [authority] = await rows('SELECT * FROM public.pre_match_disclosure_authorities WHERE id = $1', [setup.pre_match_disclosure_authority_id]);
      assert.equal(authority.introduction_profile_version_id, setup.introduction_profile_version_id, 'B06 bound to the current profile version');
      assert.equal(Number((await rows('SELECT count(*) n FROM public.pre_match_disclosure_authority_fields WHERE authority_id = $1',
        [authority.id]))[0].n), 0, 'B06 no field row: no profile field is approved for pre-Match disclosure');
      await actAs(h);
      await rejected(() => q("SELECT * FROM public.grant_pre_match_disclosure_authority_v1(gen_random_uuid(), gen_random_uuid(), $1, '{}'::text[], $2)",
        [setup.introduction_profile_version_id, authority.id]), ['22023'], /MATCHING_APPROVED_FIELD_SET_INVALID/u);
      await owner();
      await rejected(() => q(`SELECT * FROM ${ZERO_CORE.slice(0, ZERO_CORE.indexOf('('))}(gen_random_uuid(), $1, gen_random_uuid(), $2, $3)`,
        [h, randomUUID(), authority.id]), ['40001'], /MATCHING_PROFILE_VERSION_NOT_CURRENT/u);
    });

    await report.isolated('B07 every refusal writes NOTHING: stale draft, unreviewed draft, unconfirmed fact, no profile field, consent versions', async () => {
      await openGate();
      await installTexts();
      const h = await human();
      const draft = await reviewedDraft(h);
      assert.equal((await enroll(h, draft - 1)).outcome, 'CHANGED', 'B07 a stale draft version');
      assert.equal((await enroll(h, draft + 1)).outcome, 'CHANGED', 'B07 a future draft version');
      for (const consents of [{ ...ALL, p: V.C }, { ...ALL, c: V.D }, { ...ALL, d: 'S6_07_NO_SUCH_TEXT_V1' }]) {
        assert.equal((await enroll(h, draft, consents)).outcome, 'CONSENT_OUTDATED', `B07 consent not current for its purpose: ${JSON.stringify(consents)}`);
      }
      await prep(h, 'SET_PROFILE', { shortIntroduction: 'I enjoy long walks and very quiet evenings at home.', workField: 'HEALTH' });
      const changed = await draftVersion(h);
      assert.equal((await enroll(h, changed)).outcome, 'INCOMPLETE', 'B07 changed since review');
      const unconfirmed = await human();
      const unconfirmedDraft = await reviewedDraft(unconfirmed, { confirm: ['INTRODUCTION_FIRST_NAME', 'SEX', 'BIRTH_YEAR_MONTH', 'BROAD_AREA'], review: false });
      assert.equal((await enroll(unconfirmed, unconfirmedDraft)).outcome, 'INCOMPLETE', 'B07 a fact not confirmed');
      const bare = await human();
      const bareDraft = await reviewedDraft(bare, { profile: null });
      assert.equal((await enroll(bare, bareDraft)).outcome, 'INCOMPLETE', 'B07 a reviewed draft with neither optional profile field is not promoted');
      const none = await human();
      assert.equal((await enroll(none, 1)).outcome, 'CHANGED', 'B07 no draft at all');
      for (const who of [h, unconfirmed, bare, none]) assert.deepEqual(await footprint(who), ZERO, 'B07 nothing at all was written');
      // Every act carries exactly what it exercises: anything else is not a request (22023) and writes nothing.
      for (const [kind, version, consents] of [['ENROLL', draft, { p: V.P, c: V.C }], ['ENROLL', null, ALL], ['RESUME', draft, { p: V.P }],
        ['RESUME', null, { p: V.P, c: V.C }], ['CORRECTION', draft, { p: V.P, d: V.D }], ['RECONFIRM_CONSENT', null, {}],
        ['RECONFIRM_CONSENT', null, { p: V.P, c: V.C }], ['SOMETHING', draft, ALL], ['ENROLL', 0, ALL]]) {
        await asOn(q, h);
        await rejected(() => q('SELECT * FROM public.enroll_my_matching_setup_v1($1, $2, $3, $4, $5, $6)',
          [randomUUID(), kind, version, consents.p ?? null, consents.c ?? null, consents.d ?? null]), ['22023'], /MATCHING_ENROLLMENT_COMMAND_INVALID/u);
        await owner();
      }
      assert.deepEqual(await footprint(h), ZERO, 'B07 still nothing');
    });

    await report.isolated('B08 no enrollment act during an account deletion (SCHEDULED, BLOCKED); a cancelled one does not block', async () => {
      await openGate();
      await installTexts();
      for (const status of ['SCHEDULED', 'BLOCKED']) {
        const h = await human();
        const draft = await reviewedDraft(h);
        await q(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at, blocked_at)
          VALUES ($1, gen_random_uuid(), $2, clock_timestamp(), clock_timestamp() + interval '7 days', CASE WHEN $2 = 'BLOCKED' THEN clock_timestamp() END)`, [h, status]);
        assert.equal((await enroll(h, draft)).outcome, 'DELETION_PENDING', `B08 ${status}`);
        assert.deepEqual(await footprint(h), ZERO, `B08 ${status}: nothing written, no lock taken`);
        assert.equal((await readView(h)).accountDeletionPending, true);
      }
      const h = await human();
      const draft = await reviewedDraft(h);
      await q(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at, cancelled_at)
        VALUES ($1, gen_random_uuid(), 'CANCELLED', clock_timestamp(), clock_timestamp() + interval '7 days', clock_timestamp())`, [h]);
      assert.equal((await enroll(h, draft)).outcome, 'ENROLLED', 'B08 a cancelled deletion is no deletion');
    });

    await report.isolated('B09 idempotency: a retry answers the committed act; a reused id with any other request is COMMAND_CONFLICT', async () => {
      await openGate();
      await installTexts();
      const h = await human();
      const draft = await reviewedDraft(h);
      const command = randomUUID();
      const first = await enroll(h, draft, ALL, command);
      const before = await footprint(h);
      assert.deepEqual(await enroll(h, draft, ALL, command), first, 'B09 an equivalent retry answers the committed result');
      assert.deepEqual(await footprint(h), before, 'B09 and writes nothing');
      assert.equal((await enroll(h, draft, { ...ALL, d: 'S6_07_OTHER_V1' }, command)).outcome, 'COMMAND_CONFLICT');
      assert.equal((await act(h, 'RECONFIRM_CONSENT', null, { c: V.C }, command)).outcome, 'COMMAND_CONFLICT', 'B09 another act under the same id');
      // The committed answer survives what changed since: the gate closed and a deletion scheduled.
      await openGate('DISABLED');
      await q(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
        VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp(), clock_timestamp() + interval '7 days')`, [h]);
      assert.deepEqual(await enroll(h, draft, ALL, command), first, 'B09 a retry still answers its first result');
      assert.deepEqual(await footprint(h), before);
      // A direct client call to a suspended command with an identity the boundary committed is still refused.
      const event = await derived('PARTICIPATION_EVENT', h, command);
      await asRole('authenticated', h);
      await rejected(() => q("SELECT * FROM public.activate_matching_participation_v1($1, 'MANUAL_MY_WORLD_ENTRY', NULL)", [event]),
        ['42501'], PERMISSION_DENIED);
      await owner();
    });

    await report.isolated('B10 the three consents are independent: each is revoked on its own through the retained commands', async () => {
      await openGate();
      await installTexts();
      const h = await human();
      assert.equal((await enroll(h, await reviewedDraft(h))).outcome, 'ENROLLED');
      let setup = await setupOf(h);
      const grant = setup.matching_context_grant_id;
      const authority = setup.pre_match_disclosure_authority_id;
      await retained(h, 'SELECT * FROM public.revoke_matching_context_v1($1, $2)', [randomUUID(), grant]);
      setup = await setupOf(h);
      assert.deepEqual([setup.participation_state, setup.matching_context_grant_id, setup.pre_match_disclosure_authority_id, setup.matchable],
        ['ACTIVE', null, authority, false], 'B10 revoking the grant leaves participation and the authority; not matchable');
      assert.equal((await act(h, 'RECONFIRM_CONSENT', null, { c: V.C })).outcome, 'RECONFIRMED', 'B10 the grant is given again on its own');
      setup = await setupOf(h);
      assert.deepEqual([setup.pre_match_disclosure_authority_id, setup.matchable], [authority, true], 'B10 the authority was not touched');
      const [again] = (await actsOf(h)).slice(-1);
      assert.deepEqual([again.context_consent_version, again.disclosure_consent_version, again.participation_consent_version],
        [V.C, null, null], 'B10 the act records exactly the one consent it exercised');
      assert.equal((await rows('SELECT event_type FROM public.matching_context_consent_events WHERE id = $1', [again.context_consent_event_id]))[0].event_type,
        'GRANTED', 'B10 a grant after a revocation is GRANTED, a new identity');
      await retained(h, 'SELECT * FROM public.revoke_pre_match_disclosure_authority_v1($1, $2)', [randomUUID(), authority]);
      setup = await setupOf(h);
      assert.deepEqual([setup.matching_context_grant_id !== null, setup.pre_match_disclosure_authority_id, setup.participation_state],
        [true, null, 'ACTIVE'], 'B10 revoking the authority leaves the grant and participation');
      await retained(h, 'SELECT * FROM public.turn_off_matching_participation_v1($1, $2)', [randomUUID(), setup.participation_event_id]);
      setup = await setupOf(h);
      assert.deepEqual([setup.participation_state, setup.matching_context_grant_id !== null], ['OFF', true], 'B10 turning off revokes nothing');
      assert.equal((await act(h, 'RECONFIRM_CONSENT', null, { d: V.D })).outcome, 'NOT_ENROLLED', 'B10 nothing but ENROLL after OFF');
    });

    await report.isolated('B11 a new consent text makes the old version CONSENT_OUTDATED; RECONFIRM_CONSENT moves an active grant to it', async () => {
      await openGate();
      await installTexts();
      const h = await human();
      assert.equal((await enroll(h, await reviewedDraft(h))).outcome, 'ENROLLED');
      const before = await setupOf(h);
      await q(`SELECT ${S}.install_consent_text_v1('S6_07_FIXTURE_CONTEXT_V2', 'MATCHING_CONTEXT_GRANT', 'نص تجريبي ثان', 'second fixture text')`);
      assert.equal((await act(h, 'RECONFIRM_CONSENT', null, { c: V.C })).outcome, 'CONSENT_OUTDATED', 'B11 the superseded version');
      assert.equal((await act(h, 'RECONFIRM_CONSENT', null, { c: 'S6_07_FIXTURE_CONTEXT_V2' })).outcome, 'RECONFIRMED');
      const after = await setupOf(h);
      assert.notEqual(after.matching_context_grant_id, before.matching_context_grant_id, 'B11 a NEW grant identity');
      const [last] = (await actsOf(h)).slice(-1);
      const [event] = await rows('SELECT * FROM public.matching_context_consent_events WHERE id = $1', [last.context_consent_event_id]);
      assert.deepEqual([event.event_type, event.prior_grant_id, last.context_consent_version],
        ['RECONFIRMED', before.matching_context_grant_id, 'S6_07_FIXTURE_CONTEXT_V2'], 'B11 RECONFIRMED over the old grant, under the new version');
      // A consent text is never rewritten and a referenced one never removed.
      await rejected(() => q(`UPDATE ${S}.consent_texts SET text_en = 'changed' WHERE consent_version = $1`, [V.P]), ['55000'], /IMMUTABLE/u);
      await rejected(() => q(`DELETE FROM ${S}.consent_texts WHERE consent_version = $1`, [V.C]), ['55000'], /IMMUTABLE/u);
      await rejected(() => q(`UPDATE ${S}.enrollment_acts SET draft_version = 99 WHERE user_id = $1`, [h]), ['55000'], /IMMUTABLE/u);
    });

    await report.isolated('B12 CORRECTION: only what changed moves; an active authority whose basis moved is re-granted only with a fresh consent', async () => {
      await openGate();
      await installTexts();
      const h = await human();
      assert.equal((await enroll(h, await reviewedDraft(h))).outcome, 'ENROLLED');
      const before = await setupOf(h);
      const beforeFoot = await footprint(h);
      assert.equal((await act(h, 'CORRECTION', await draftVersion(h), { d: V.D })).outcome, 'NO_CHANGE', 'B12 nothing to correct');
      assert.deepEqual(await footprint(h), beforeFoot, 'B12 and nothing written');
      await prep(h, 'SET_PROFILE', { shortIntroduction: 'I enjoy long walks and reading by the window.', workField: 'HEALTH' });
      await prep(h, 'CONFIRM_REVIEW', {});
      const corrected = await draftVersion(h);
      assert.equal((await act(h, 'CORRECTION', corrected, {})).outcome, 'CONSENT_OUTDATED', 'B12 the authority must move: a fresh consent is required');
      assert.deepEqual(await footprint(h), beforeFoot, 'B12 refused: nothing written');
      assert.deepEqual(await act(h, 'CORRECTION', corrected, { d: V.D }), { outcome: 'CORRECTED', participation_state: 'ACTIVE', matchable: true });
      const after = await setupOf(h);
      assert.notEqual(after.introduction_profile_version_id, before.introduction_profile_version_id, 'B12 a new profile version');
      assert.equal(after.matching_requirement_version_id, before.matching_requirement_version_id, 'B12 the requirements did not move');
      assert.equal(after.participation_event_id, before.participation_event_id, 'B12 participation is never touched');
      assert.equal(after.matching_context_grant_id, before.matching_context_grant_id, 'B12 the grant is never touched');
      const [authority] = await rows('SELECT * FROM public.pre_match_disclosure_authorities WHERE id = $1', [after.pre_match_disclosure_authority_id]);
      assert.equal(authority.introduction_profile_version_id, after.introduction_profile_version_id, 'B12 the new authority binds the new version');
      assert.equal((await rows('SELECT status FROM public.pre_match_disclosure_authorities WHERE id = $1', [before.pre_match_disclosure_authority_id]))[0].status,
        'REVOKED', 'B12 the old authority is superseded, never silently carried over');
      const [fact] = await rows(`SELECT fact_version_id FROM ${FACTS.slice(0, FACTS.indexOf('('))}($1)`, [h]);
      assert.equal((await actsOf(h)).length, 2);
      assert.equal(fact.fact_version_id, (await actsOf(h))[0].fact_version_id, 'B12 unchanged facts keep their promoted version');
      // A fact correction: a new promoted version along the chain.
      await prep(h, 'SET_FACT', { fact: 'MARITAL_STATUS', maritalStatus: 'DIVORCED' });
      await prep(h, 'CONFIRM_FACT', { fact: 'MARITAL_STATUS' });
      await prep(h, 'CONFIRM_REVIEW', {});
      assert.equal((await act(h, 'CORRECTION', await draftVersion(h), {})).outcome, 'CORRECTED', 'B12 no authority move: no consent needed');
      const [newFact] = await rows(`SELECT * FROM ${FACTS.slice(0, FACTS.indexOf('('))}($1)`, [h]);
      assert.equal(newFact.marital_status, 'DIVORCED');
      const [chain] = await rows('SELECT prior_fact_version_id FROM public.matching_confirmed_fact_versions WHERE id = $1', [newFact.fact_version_id]);
      assert.equal(chain.prior_fact_version_id, fact.fact_version_id, 'B12 the new version supersedes the old one');
      // A revoked authority is never re-granted by a correction.
      const current = await setupOf(h);
      await retained(h, 'SELECT * FROM public.revoke_pre_match_disclosure_authority_v1($1, $2)', [randomUUID(), current.pre_match_disclosure_authority_id]);
      await prep(h, 'SET_PROFILE', { shortIntroduction: 'I enjoy long walks and slow Friday mornings.', workField: 'HEALTH' });
      await prep(h, 'CONFIRM_REVIEW', {});
      assert.equal((await act(h, 'CORRECTION', await draftVersion(h), { d: V.D })).outcome, 'CORRECTED');
      assert.equal((await setupOf(h)).pre_match_disclosure_authority_id, null, 'B12 the revoked authority stays revoked');
      const never = await human();
      assert.equal((await act(never, 'CORRECTION', await reviewedDraft(never), { d: V.D })).outcome, 'NOT_ENROLLED');
      assert.deepEqual(await footprint(never), ZERO);
    });

    await report.isolated('B13 RESUME lifts only a USER_PAUSED pause; ENROLL after OFF is a fresh act; a reserved pause is never laundered', async () => {
      await openGate();
      await installTexts();
      const h = await human();
      assert.equal((await enroll(h, await reviewedDraft(h))).outcome, 'ENROLLED');
      assert.equal((await act(h, 'RESUME', null, { p: V.P })).outcome, 'NOT_RESUMABLE', 'B13 ACTIVE is not paused');
      let setup = await setupOf(h);
      await retained(h, 'SELECT * FROM public.pause_matching_participation_v1($1, $2)', [randomUUID(), setup.participation_event_id]);
      assert.deepEqual(await act(h, 'RESUME', null, { p: V.P }), { outcome: 'RESUMED', participation_state: 'ACTIVE', matchable: true });
      const [resumed] = (await actsOf(h)).slice(-1);
      assert.deepEqual([resumed.act_kind, resumed.participation_consent_version, resumed.context_consent_version], ['RESUME', V.P, null]);
      setup = await setupOf(h);
      await retained(h, 'SELECT * FROM public.turn_off_matching_participation_v1($1, $2)', [randomUUID(), setup.participation_event_id]);
      const facts = (await footprint(h)).facts;
      assert.deepEqual(await enroll(h, await draftVersion(h)), { outcome: 'ENROLLED', participation_state: 'ACTIVE', matchable: true },
        'B13 a second ENROLL after OFF');
      assert.equal((await footprint(h)).facts, facts, 'B13 unchanged promoted facts are not promoted again');
      const [reenrolled] = (await actsOf(h)).slice(-1);
      assert.equal((await rows('SELECT event_type FROM public.matching_context_consent_events WHERE id = $1', [reenrolled.context_consent_event_id]))[0].event_type,
        'RECONFIRMED', 'B13 the grant still active after OFF is reconfirmed under the fresh consent');
      // A reserved pause (I-07D) and an OFF reached from one are never lifted here.
      const r = await human();
      assert.equal((await enroll(r, await reviewedDraft(r))).outcome, 'ENROLLED');
      setup = await setupOf(r);
      const reserved = await rt.simulatePause(r, 'POST_INTRODUCTION', setup.participation_event_id);
      assert.equal((await act(r, 'RESUME', null, { p: V.P })).outcome, 'NOT_RESUMABLE', 'B13 POST_INTRODUCTION is not the user\'s pause');
      await retained(r, 'SELECT * FROM public.turn_off_matching_participation_v1($1, $2)', [randomUUID(), reserved]);
      const before = await footprint(r);
      assert.equal((await enroll(r, await draftVersion(r))).outcome, 'NOT_RESUMABLE', 'B13 an OFF reached from a reserved pause is not a clean slate');
      assert.deepEqual(await footprint(r), before, 'B13 and nothing was written');
    });

    await report.isolated('B14 the promotion record is a precondition: a fact version written any other way is UNKNOWN to the reader, capture and discovery', async () => {
      await openGate();
      await installTexts();
      const [a, b] = [await human(), await human()];
      const f = await rt.seedMatchable(a, b);
      const raw = async (who, sex) => {
        const [current] = await rows(`SELECT current_fact_version_id id FROM public.matching_confirmed_fact_state WHERE owner_user_id = $1`, [who]);
        const id = randomUUID();
        await rows(`SELECT * FROM ${WRITER.slice(0, WRITER.indexOf('('))}($1, $2, $3, 'Mona', now(), $4, now(), 1990, 1, now(), 'EG', NULL, now(), 'NEVER_MARRIED', now())`,
          [id, who, current?.id ?? null, sex]);
        return id;
      };
      await raw(a, 'MALE');
      await raw(b, 'FEMALE');
      for (const who of [a, b]) {
        const [facts] = await rows(`SELECT * FROM ${FACTS.slice(0, FACTS.indexOf('('))}($1)`, [who]);
        assert.deepEqual(Object.values(facts), [null, null, null, null, null, null, null, null], 'B14 the reader answers the empty row');
      }
      await rejected(() => rt.capture(randomUUID(), f.pair, a, b, { facts: false }), ['55000'], /MATCHING_PAIR_NOT_ELIGIBLE/u);
      assert.deepEqual((await rt.discover(a, 10)).map((c) => c.candidate_user_id), [], 'B14 discovery never sees an unpromoted human');
      for (const who of [a, b]) {
        const [current] = await rows('SELECT current_fact_version_id id FROM public.matching_confirmed_fact_state WHERE owner_user_id = $1', [who]);
        await q(`INSERT INTO ${S}.fact_promotions (fact_version_id, user_id, enrollment_command_id, draft_version) VALUES ($1, $2, gen_random_uuid(), 1)`,
          [current.id, who]);
      }
      assert.deepEqual((await rt.discover(a, 10)).map((c) => c.candidate_user_id), [b],
        'B14 control: with a promotion record the same human IS discovered, so the empty answer above was the precondition');
      const [captured] = await rt.capture(randomUUID(), f.pair, a, b, { facts: false });
      assert.ok(captured, 'B14 the same versions with a promotion record are eligible');
    });

    await report.isolated('B15 the human is auth.uid() and nothing else: another human\'s reviewed draft is never enrolled', async () => {
      await openGate();
      await installTexts();
      const [owner1, other] = [await human(), await human()];
      const draft = await reviewedDraft(owner1);
      assert.equal((await enroll(other, draft)).outcome, 'CHANGED', 'B15 the caller has no draft of their own');
      assert.deepEqual(await footprint(owner1), ZERO, 'B15 nothing of the draft owner moved');
      assert.deepEqual(await footprint(other), ZERO);
      assert.equal((await readView(other)).enrollment, null, 'B15 the read answers only the caller');
    });

    await report.isolated('B16 40001 and PT409 underneath the act are absorbed: one bounded CHANGED, nothing written, never sent to PostgREST', async () => {
      await openGate();
      await installTexts();
      for (const code of ['40001', 'PT409']) {
        const h = await human();
        const draft = await reviewedDraft(h);
        await q('SAVEPOINT injected');
        await q(`CREATE FUNCTION public.s6_07_probe_stale_v1() RETURNS trigger LANGUAGE plpgsql AS $probe$
                 BEGIN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE = '${code}'; END$probe$`);
        await q(`CREATE TRIGGER s6_07_probe_stale BEFORE INSERT ON ${S}.command_ledger FOR EACH ROW EXECUTE FUNCTION public.s6_07_probe_stale_v1()`);
        assert.equal((await enroll(h, draft)).outcome, 'CHANGED', `B16 ${code} becomes CHANGED`);
        assert.deepEqual(await footprint(h), ZERO, `B16 ${code}: the whole act rolled back, the lock row included`);
        await q('ROLLBACK TO SAVEPOINT injected');
        assert.equal((await enroll(h, draft)).outcome, 'ENROLLED', `B16 the same act succeeds once nothing is stale (${code})`);
      }
    });

    await report.isolated('B17 the governed erasure of an enrolled human ERASES every enrollment row with the account', async () => {
      await openGate();
      await installTexts();
      const h = await human();
      assert.equal((await enroll(h, await reviewedDraft(h))).outcome, 'ENROLLED');
      await retained(h, 'SELECT * FROM public.revoke_matching_context_v1($1, $2)', [randomUUID(), (await setupOf(h)).matching_context_grant_id]);
      const [deletion] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
        VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [h]);
      await asRole('service_role');
      const [{ outcome }] = await rows('SELECT public.server_erase_account_v1($1) AS outcome', [deletion.id]);
      await owner();
      assert.equal(outcome, 'ERASED', 'B17 the ACCT-DEL-01 erasure covers the enrollment footprint');
      assert.deepEqual(await footprint(h), ZERO, 'B17 nothing of the enrollment survives');
      assert.equal(Number((await rows('SELECT count(*) n FROM public.users WHERE id = $1', [h]))[0].n), 0);
    });

    await report.isolated('B18 the read: availability needs the open gate AND a current text of each purpose; it answers only the caller', async () => {
      const h = await human();
      let view = await readView(h);
      assert.deepEqual([view.available, view.enrollment, view.setup.participationState, view.setup.matchable, view.accountDeletionPending],
        [false, null, 'OFF', false, false]);
      assert.deepEqual(view.consents, { participation: null, contextGrant: null, disclosureAuthority: null }, 'B18 no text is installed');
      await openGate();
      assert.equal((await readView(h)).available, false, 'B18 the gate alone is not enough');
      await installTexts();
      view = await readView(h);
      assert.equal(view.available, true);
      assert.deepEqual([view.consents.disclosureAuthority.version, typeof view.consents.disclosureAuthority.textAr], [V.D, 'string']);
      assert.deepEqual(await footprint(h), ZERO, 'B18 reading writes nothing');
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ C. races
async function verifyRaces(report, created) {
  await owner();
  const { q2, close } = await rt.openSecondary();
  const fresh = async () => {
    const id = randomUUID();
    created.push(id);
    await q('INSERT INTO auth.users(id) VALUES ($1)', [id]);
    return id;
  };
  const commitDraft = async () => {
    await q('BEGIN');
    const h = await fresh();
    const draft = await reviewedDraft(h);
    await q('COMMIT');
    return { h, draft };
  };
  const committed = async (work) => { await q('BEGIN'); try { const r = await work(); await q('COMMIT'); return r; } catch (e) { await q('ROLLBACK'); throw e; } };
  // A race section that fails leaves either connection mid-transaction: roll both back so the next section, and the
  // teardown, start clean.
  const race = (name, body) => report.section(name, async () => {
    try { await body(); } catch (error) {
      await q('ROLLBACK').catch(() => undefined);
      await q2('ROLLBACK').catch(() => undefined);
      throw error;
    }
  });
  try {
    await committed(async () => { await openPreparation(); await openGate(); await installTexts(); });

    await race('C01 enrollment x enrollment of one human: the second waits on the lock row and is ALREADY_ENROLLED; one of everything', async () => {
      const { h, draft } = await commitDraft();
      await q('BEGIN');
      assert.equal((await enroll(h, draft)).outcome, 'ENROLLED');
      await q2('BEGIN');
      const contender = enroll(h, draft, ALL, randomUUID(), q2);
      assert.equal(await rt.stillPending(contender), true, 'C01 the second act waits on the caller\'s own lock row');
      await q('COMMIT');
      assert.equal((await contender).outcome, 'ALREADY_ENROLLED');
      await q2('COMMIT');
      const foot = await footprint(h);
      assert.deepEqual([foot.acts, foot.facts, foot.promotions, foot.participation, foot.profiles, foot.requirements, foot.authorities],
        [1, 1, 1, 1, 1, 1, 1], 'C01 exactly one of each');
    });

    await race('C02 the same command id twice at once: the second waits, then answers the committed act', async () => {
      const { h, draft } = await commitDraft();
      const command = randomUUID();
      await q('BEGIN');
      const first = await enroll(h, draft, ALL, command);
      await q2('BEGIN');
      const retry = enroll(h, draft, ALL, command, q2);
      assert.equal(await rt.stillPending(retry), true, 'C02 the retry waits');
      await q('COMMIT');
      assert.deepEqual(await retry, first, 'C02 the retry answers the committed result under the lock');
      await q2('COMMIT');
      assert.equal((await footprint(h)).acts, 1, 'C02 one act');
    });

    await race('C03 a draft edit in flight: the act waits and then answers CHANGED (nothing promoted); an act in flight holds the draft', async () => {
      const { h, draft } = await commitDraft();
      await q('BEGIN');
      await asOn(q, h);
      await q('SELECT public.apply_own_matching_preparation_command_v1($1, $2, $3, $4)',
        [randomUUID(), draft, 'SET_PROFILE', { shortIntroduction: 'A different introduction written just now.', workField: 'HEALTH' }]);
      await ownerOn(q);
      await q2('BEGIN');
      const waiting = enroll(h, draft, ALL, randomUUID(), q2);
      assert.equal(await rt.stillPending(waiting), true, 'C03 the act waits for the edit');
      await q('COMMIT');
      assert.equal((await waiting).outcome, 'CHANGED', 'C03 the reviewed version moved: nothing stale is promoted');
      await q2('COMMIT');
      assert.deepEqual(await footprint(h), ZERO, 'C03 nothing written');
      const { h: h2, draft: d2 } = await commitDraft();
      await q('BEGIN');
      assert.equal((await enroll(h2, d2)).outcome, 'ENROLLED');
      await q2('BEGIN');
      await asOn(q2, h2);
      const edit = q2('SELECT public.apply_own_matching_preparation_command_v1($1, $2, $3, $4) AS a',
        [randomUUID(), d2, 'SET_PROFILE', { shortIntroduction: 'Another introduction written in the meantime.', workField: 'HEALTH' }]);
      assert.equal(await rt.stillPending(edit), true, 'C03 the edit waits for the act that reads the draft');
      await q('COMMIT');
      assert.equal((await edit).rows[0].a.outcome, 'APPLIED', 'C03 then applies on top, as the next draft version');
      await q2('COMMIT');
      await ownerOn(q2);
      assert.equal(Number((await actsOf(h2))[0].draft_version), d2, 'C03 the act bound the version the owner reviewed');
    });

    await race('C04 a deletion request in flight: the act waits and answers DELETION_PENDING; an act in flight delays the request', async () => {
      const { h, draft } = await commitDraft();
      await q('BEGIN');
      await asOnWithProof(q, h);
      await q('SELECT * FROM public.request_own_account_deletion_v1($1)', [randomUUID()]);
      await ownerOn(q);
      await q2('BEGIN');
      const waiting = enroll(h, draft, ALL, randomUUID(), q2);
      assert.equal(await rt.stillPending(waiting), true, 'C04 the act waits on the account row');
      await q('COMMIT');
      assert.equal((await waiting).outcome, 'DELETION_PENDING');
      await q2('COMMIT');
      assert.deepEqual(await footprint(h), ZERO, 'C04 nothing written for a deleting account');
      const { h: h2, draft: d2 } = await commitDraft();
      await q('BEGIN');
      assert.equal((await enroll(h2, d2)).outcome, 'ENROLLED');
      await q2('BEGIN');
      await asOnWithProof(q2, h2);
      const request = q2('SELECT * FROM public.request_own_account_deletion_v1($1)', [randomUUID()]);
      assert.equal(await rt.stillPending(request), true, 'C04 the deletion request waits for the act');
      await q('COMMIT');
      await request;
      await q2('COMMIT');
      await ownerOn(q2);
      const [{ status }] = await rows('SELECT status FROM personal_data_private.account_deletions WHERE user_id = $1', [h2]);
      assert.equal(status, 'SCHEDULED', 'C04 and is then scheduled; the governed erasure covers the enrollment (B17)');
    });

    await race('C05 the operator closing the gate: the act waits for the decision and is NOT_AVAILABLE_NOW', async () => {
      const { h, draft } = await commitDraft();
      await q('BEGIN');
      await openGate('EMERGENCY_DISABLED');
      await q2('BEGIN');
      const waiting = enroll(h, draft, ALL, randomUUID(), q2);
      assert.equal(await rt.stillPending(waiting), true, 'C05 the act waits on the gate row');
      await q('COMMIT');
      assert.equal((await waiting).outcome, 'NOT_AVAILABLE_NOW');
      await q2('COMMIT');
      assert.deepEqual(await footprint(h), ZERO);
      await committed(() => openGate());
    });

    await race('C06 a retained turn-off in flight: a reconfirmation waits on the lock row and answers NOT_ENROLLED; no deadlock', async () => {
      const { h, draft } = await commitDraft();
      assert.equal((await committed(() => enroll(h, draft))).outcome, 'ENROLLED');
      const setup = await setupOf(h);
      await q('BEGIN');
      await asOn(q, h);
      await q('SELECT * FROM public.turn_off_matching_participation_v1($1, $2)', [randomUUID(), setup.participation_event_id]);
      await ownerOn(q);
      await q2('BEGIN');
      const waiting = act(h, 'RECONFIRM_CONSENT', null, { c: V.C }, randomUUID(), q2);
      assert.equal(await rt.stillPending(waiting), true, 'C06 serialized on the caller\'s own lock row');
      await q('COMMIT');
      assert.equal((await waiting).outcome, 'NOT_ENROLLED');
      await q2('COMMIT');
    });

    await race('C07 a consent text superseded in flight: the act holding the old version waits and answers CONSENT_OUTDATED', async () => {
      const { h, draft } = await commitDraft();
      await q('BEGIN');
      await q(`SELECT ${S}.install_consent_text_v1('S6_07_FIXTURE_PARTICIPATION_V2', 'MATCHING_PARTICIPATION', 'نص تجريبي ثان', 'second fixture text')`);
      await q2('BEGIN');
      const waiting = enroll(h, draft, ALL, randomUUID(), q2);
      assert.equal(await rt.stillPending(waiting), true, 'C07 the act waits on the current text');
      await q('COMMIT');
      assert.equal((await waiting).outcome, 'CONSENT_OUTDATED', 'C07 the version the human saw is no longer current');
      await q2('COMMIT');
      assert.deepEqual(await footprint(h), ZERO);
      assert.equal((await committed(() => enroll(h, draft, { ...ALL, p: 'S6_07_FIXTURE_PARTICIPATION_V2' }))).outcome, 'ENROLLED');
    });
  } finally {
    await close();
    await pause(50);
  }
}

// ------------------------------------------------------------------ teardown of the committed race fixtures
async function teardown(created) {
  await owner();
  await rt.removeCommittedProposalState(created);
  await rt.removeCommittedMatchingSetup(created);
  await q('BEGIN');
  try {
    await q('DELETE FROM personal_data_private.account_deletions WHERE user_id = ANY($1::uuid[])', [created]);
    await q(`DELETE FROM ${PREP}.drafts WHERE user_id = ANY($1::uuid[])`, [created]);
    await q(`DELETE FROM ${PREP}.command_ledger WHERE user_id = ANY($1::uuid[])`, [created]);
    await q('COMMIT');
  } catch (error) { await q('ROLLBACK'); throw error; }
  await rt.removeFixtureHumans(created);
  await q('BEGIN');
  try {
    await q(`ALTER TABLE ${S}.consent_texts DISABLE TRIGGER consent_texts_immutable`);
    await q(`DELETE FROM ${S}.consent_texts`);
    await q(`ALTER TABLE ${S}.consent_texts ENABLE TRIGGER consent_texts_immutable`);
    await q(`DELETE FROM ${S}.gate_events`);
    await q(`DELETE FROM ${S}.gate_states`);
    await q(`DELETE FROM ${PREP}.gate_events`);
    await q(`DELETE FROM ${PREP}.gate_states`);
    await q('COMMIT');
  } catch (error) { await q('ROLLBACK'); throw error; }
  assert.equal(await rt.triggerEnabled(`${S}.consent_texts`, 'consent_texts_immutable'), true, 'the consent-text guard is enabled again');
}

// ---------------------------------------------------------------------- main
const created = [];
await runVerifier('0165', async (stage) => {
  await rt.client.connect();
  const report = createScenarioReport('0165', { query: q, restore: () => owner() });
  try {
    stage('catalog');
    await verifyCatalog(report);
    stage('behaviour');
    await verifyBehaviour(report);
    stage('races');
    await verifyRaces(report, created);
  } finally {
    stage('teardown');
    await teardown(created);
  }
  stage('report');
  report.print();
  report.assertAllPassed();
  const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM ${S}.gate_states) + (SELECT count(*) FROM ${S}.consent_texts)
      + (SELECT count(*) FROM ${S}.enrollment_acts WHERE user_id = ANY($1::uuid[])) AS residue`, [created]);
  assert.equal(Number(residue), 0, 'every fixture this verifier created was rolled back or removed');
}, () => rt.client.end().catch(() => undefined));
