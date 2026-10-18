// S6-03 / migration 0156 - real-PostgreSQL proof of CW2-06B-01 .. -13 and -16.
//
//   A  posture: the three relations, the function ACL, nothing installed, the first-name shape, the gate's one clock
//   B  the confirmed-fact source: the one internal writer, versions, compare-and-swap, idempotency, the catalogue
//   C  the first-name resolver: the confirmed Introduction First Name only, never Name, Public identity or draft
//   D  the structured encoding: strict decoders, the R3 all-possible-days age rule, the R4 horizon
//   E  the deterministic evaluator and the manual recorder's refusal
//   F  the Product pair rule, the snapshot fact binding, currentness and the race against the writer
//   G  B4: zero fields under an explicitly empty allowlist; the NULL projection; the zero-field Handoff
//   H  the Arabic/English privacy floor: delta-only, CHECK = classifier, the shared corpus and its false positives
//   I  the owner-only policy primitive
//   J  deletion: no footprint is ERASED; a confirmed fact version is BLOCKED with nothing erased
//
// Every fact row written here belongs to a SYNTHETIC fixture human created and removed by this verifier. It proves how
// the runtime behaves, never that anybody confirmed anything (CW2-06B-02, R5).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createMatchRuntime, P, PFN, MATCH, matchIds, CLEAN, runVerifier, APP_ROLES,
} from './matching-match-verifier-support.mjs';

const rt = createMatchRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const M0156 = new URL('./migrations/0156_matching_confirmed_facts_eligibility_neutral_disclosure_v1.sql', import.meta.url);
const M0157 = new URL('./migrations/0157_matching_reproposal_admission_orchestration_v1.sql', import.meta.url);
const M0114 = new URL('./migrations/0114_matching_mutual_match_commit_transaction_v1.sql', import.meta.url);
const source = (url) => readFileSync(url, 'utf8').replace(/\r\n/gu, '\n');

const FN = Object.freeze({
  WRITER: 'public.record_matching_confirmed_facts_core_v1(uuid,uuid,uuid,text,timestamptz,text,timestamptz,integer,integer,timestamptz,text,text,timestamptz,text,timestamptz)',
  FACTS: 'public.resolve_matching_confirmed_facts_v1(uuid)',
  FAMILY: 'public.matching_structured_requirement_family_v1(text)',
  AGE_RANGE: 'public.matching_structured_age_range_v1(text)',
  MARITAL: 'public.matching_structured_marital_set_v1(text)',
  AREA: 'public.matching_structured_area_v1(text)',
  AGE: 'public.matching_structured_age_outcome_v1(integer,integer,date,integer,integer)',
  HORIZON: 'public.matching_structured_age_horizon_v1(integer,integer,integer)',
  EVALUATOR: 'public.evaluate_matching_structured_requirements_core_v1(uuid)',
  INSTALL: 'public.install_matching_proposal_policy_version_core_v1(uuid,text,uuid,integer,integer,integer,text[])',
  CONTACT_DELTA: 'public.matching_text_carries_contact_route_delta_v1(text)',
  PROVENANCE_DELTA: 'public.matching_text_carries_hidden_provenance_delta_v1(text)',
  QUOTED_DELTA: 'public.matching_text_carries_quoted_span_delta_v1(text)',
  RANKING_DELTA: 'public.matching_text_carries_visible_ranking_delta_v1(text)',
  SENSITIVE_DELTA: 'public.matching_text_carries_sensitive_fact_delta_v1(text)',
});
const NEW_FUNCTIONS = [...Object.values(FN),
  'public.reject_matching_confirmed_fact_mutation_v1()', 'public.matching_confirmed_fact_state_truth_v1()',
  'public.matching_snapshot_fact_binding_truth_v1()'];
const REPLACED = [PFN.FIRST_NAME, PFN.CAPTURE, PFN.SNAPSHOT_VALIDITY, PFN.EVALUATE, PFN.GATE, PFN.MY_PROPOSAL,
  PFN.CONTACT_ROUTE, PFN.PROVENANCE, PFN.QUOTED, PFN.RANKING, PFN.SENSITIVE];
const OWN_TABLES = [P.FACT_VERSIONS, P.FACT_STATE, P.FACT_BINDINGS];
const DELTAS = [
  [PFN.CONTACT_ROUTE, FN.CONTACT_DELTA], [PFN.PROVENANCE, FN.PROVENANCE_DELTA], [PFN.QUOTED, FN.QUOTED_DELTA],
  [PFN.RANKING, FN.RANKING_DELTA], [PFN.SENSITIVE, FN.SENSITIVE_DELTA]];
/** The thirteen delta CHECKs: relation, constraint, column, delta classifier. */
const FLOOR_CHECKS = [
  [P.FACT_VERSIONS, 'matching_confirmed_fact_versions_name_contact_floor_check', 'first_name', FN.CONTACT_DELTA],
  [P.VIEWS, 'matching_recipient_proposal_views_name_contact_floor_check', 'subject_first_name', FN.CONTACT_DELTA],
  [P.VIEW_FIELDS, 'matching_recipient_proposal_view_fields_value_contact_floor_check', 'disclosed_value', FN.CONTACT_DELTA],
  [P.VIEW_FIELDS, 'matching_recipient_proposal_view_fields_value_provenance_floor_check', 'disclosed_value', FN.PROVENANCE_DELTA],
  [P.PERMITTED_CONCLUSIONS, 'matching_permitted_safe_conclusions_text_contact_floor_check', 'permitted_text', FN.CONTACT_DELTA],
  [P.PERMITTED_CONCLUSIONS, 'matching_permitted_safe_conclusions_text_provenance_floor_check', 'permitted_text', FN.PROVENANCE_DELTA],
  [P.PERMITTED_CONCLUSIONS, 'matching_permitted_safe_conclusions_text_quote_floor_check', 'permitted_text', FN.QUOTED_DELTA],
  [P.PERMITTED_CONCLUSIONS, 'matching_permitted_safe_conclusions_text_ranking_floor_check', 'permitted_text', FN.RANKING_DELTA],
  [MATCH.SUBJECTS, 'matching_match_handoff_subjects_name_contact_floor_check', 'presented_first_name', FN.CONTACT_DELTA],
  [MATCH.SUBJECTS, 'matching_match_handoff_subjects_conclusion_contact_floor_check', 'safe_compatibility_conclusion', FN.CONTACT_DELTA],
  [MATCH.SUBJECTS, 'matching_match_handoff_subjects_conclusion_provenance_floor_check', 'safe_compatibility_conclusion', FN.PROVENANCE_DELTA],
  [MATCH.FIELDS, 'matching_match_handoff_fields_value_contact_floor_check', 'disclosed_value', FN.CONTACT_DELTA],
  [MATCH.FIELDS, 'matching_match_handoff_fields_value_provenance_floor_check', 'disclosed_value', FN.PROVENANCE_DELTA],
];
const PROFILE = [['life_stage', 'settled and ready'], ['children_plan', 'yes in time']];
const APPROVED = ['life_stage', 'children_plan'];
const AT = '2026-10-01T00:00:00Z';

/**
 * A birth year and month whose full-year age is EXACTLY `age` on every possible day at today's UTC date, whatever
 * today is: the birth month is six months away from the current month, so no possible birthday is today.
 */
async function bornAged(age) {
  const [{ y, m }] = await rows("SELECT extract(year FROM (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::int y, extract(month FROM (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::int m");
  const birthMonth = m <= 6 ? m + 6 : m - 6;
  return { birthYear: birthMonth < m ? y - age : y - age - 1, birthMonth };
}

// ------------------------------------------------------------------ the shared Arabic/English corpus (CW2-06B-09 §5)
/** Each text with the ONE delta that must refuse it. Every one is new: no 0110 / 0111 ASCII rule refuses it. */
const NEW_PATTERN_CORPUS = [
  ['رقمي ٠١٠٠١٢٣٤٥٦٧', FN.CONTACT_DELTA], // my number, Arabic-Indic digits
  ['اتصل على ۰۱۰۰ ۱۲۳ ۴۵۶۷', FN.CONTACT_DELTA], // Persian digits with spaces
  ['0100–123–4567', FN.CONTACT_DELTA], // Western digits joined by en dashes
  ['01٠0 1٢3 4567', FN.CONTACT_DELTA], // mixed Western and Arabic-Indic digits
  ['0100​123​4567', FN.CONTACT_DELTA], // invisible zero-width spaces between digits
  ['كلمني على الواتس', FN.CONTACT_DELTA], // call me on WhatsApp
  ['ابعتلي على التليجرام', FN.CONTACT_DELTA], // send me on Telegram
  ['حسابي على انستجرام', FN.CONTACT_DELTA], // my account on Instagram
  ['تواصل معي على البريد الإلكتروني', FN.CONTACT_DELTA], // contact me by e-mail
  ['تابعني @سارة', FN.CONTACT_DELTA], // an Arabic-script handle
  ['موقعي سارة.com', FN.CONTACT_DELTA], // an Arabic-script name before a domain
  ['زوروا sara.مصر', FN.CONTACT_DELTA], // an Arabic-script top-level domain
  ['اكتب سارة دوت كوم', FN.CONTACT_DELTA], // "dot com" spelled out
  ['ref ٣f2504e0-4f89-11d3-9a0c-0305e82c3301', FN.PROVENANCE_DELTA], // a UUID with an Arabic-Indic digit
  ['قال «هذه جملة طويلة جدا من الذاكرة الخاصة بها»', FN.QUOTED_DELTA], // a long span in Arabic quotation marks
  ['he said “this is a long verbatim private sentence”', FN.QUOTED_DELTA], // typographic quotation marks
  ['نسبة التوافق بينكما عالية', FN.RANKING_DELTA], // compatibility percentage
  ['توافق ٩٠٪', FN.RANKING_DELTA], // an Arabic percent sign
  ['90٪ match', FN.RANKING_DELTA], // Western digits with an Arabic percent sign
  ['عانى من الاكتئاب', FN.SENSITIVE_DELTA], // depression
  ['لديها تشخيص بالسكري', FN.SENSITIVE_DELTA], // a diabetes diagnosis
  ['كان في السجن', FN.SENSITIVE_DELTA], // prison
  ['عليه ديون كثيرة', FN.SENSITIVE_DELTA], // debts
  ['طلب لجوء', FN.SENSITIVE_DELTA], // asylum
  ['مشكلة إدمان', FN.SENSITIVE_DELTA], // addiction
];
/** Legitimate Arabic and English names: every shape and every classifier lets them through. */
const LEGITIMATE_NAMES = ['محمد', 'فاطمة', 'عبد الله', 'نور', 'سارة', 'يوسف', 'مريم', 'أحمد', 'Sara', 'Omar', "O'Neil", 'Jean-Luc'];
/** Ordinary non-sensitive sentences in both languages: no classifier refuses them. */
const LEGITIMATE_SENTENCES = [
  'كلاكما يحب الهدوء ويقدّر وقت العائلة',
  'تحبان القراءة والسفر وتخططان قبل أن تقررا',
  'لديكما نظرة متأنية إلى الحياة اليومية',
  'You both treat a calm ordinary week as the point of a week.',
  'A shared sense of humour and the same unhurried pace.',
];
/** The documented fail-closed cost: innocent sentences the floor refuses, deliberately (CW2-06B-09 §5). */
const DOCUMENTED_FALSE_POSITIVES = [
  ['كلاكما حامل لقيم العائلة', PFN.SENSITIVE], // "bearer of family values" - the word also means "pregnant"
  ['يحب الحديث في الهاتف مع أهله', PFN.CONTACT_ROUTE], // "likes talking with his family on the phone"
  ['يحب البريد الإلكتروني أكثر من الرسائل', PFN.CONTACT_ROUTE], // "prefers e-mail to letters"
  ['هاتف', PFN.CONTACT_ROUTE], // the rare given name Hatif is also the word "phone": refused as a confirmed first name
];

// ------------------------------------------------------------------ small helpers
const fact = (overrides = {}) => ({
  firstName: null, sex: null, birthYear: null, birthMonth: null, countryCode: null, regionCode: null,
  maritalStatus: null, ...overrides,
});
/**
 * The writer, called directly as the owner of the database, with explicit arguments.
 *
 * RE-ANCHORED by S6-07 CP1 (migration 0165, CW2-06B-02 §5): the canonical facts reader answers only for a version that
 * carries a promotion record, which only the governed enrollment boundary writes in production. A version this helper
 * writes gets a FIXTURE promotion record beside it - test data, exactly like the version - so the writer's own behaviour
 * below is proven unchanged through the one reader. verify-migration-0165 proves a version without one is UNKNOWN.
 */
const write = async (version, owner, expected, f, at = AT) => {
  const answer = await rows(`SELECT * FROM ${FN.WRITER.split('(')[0]}(
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`, [
    version, owner, expected,
    f.firstName ?? null, f.firstName == null ? null : at, f.sex ?? null, f.sex == null ? null : at,
    f.birthYear ?? null, f.birthMonth ?? null, f.birthYear == null ? null : at,
    f.countryCode ?? null, f.regionCode ?? null, f.countryCode == null ? null : at,
    f.maritalStatus ?? null, f.maritalStatus == null ? null : at]);
  await rows(`INSERT INTO matching_enrollment_private.fact_promotions (fact_version_id, user_id, enrollment_command_id, draft_version)
              VALUES ($1, $2, $3, 1) ON CONFLICT (fact_version_id) DO NOTHING`, [version, owner, randomUUID()]);
  return answer;
};
const ageOf = async (year, month, reference, min, max) =>
  (await rows('SELECT public.matching_structured_age_outcome_v1($1, $2, $3::date, $4, $5) AS o',
    [year, month, reference, min, max]))[0].o;
const classify = async (fn, text) => (await rows(`SELECT ${fn.split('(')[0]}($1) AS hit`, [text]))[0].hit;
const nameOf = async (human) => (await rows('SELECT * FROM public.resolve_matching_canonical_first_name_v1($1)', [human]))[0];
const validityOf = async (snapshot) => (await rows('SELECT * FROM public.resolve_matching_snapshot_validity_v1($1)', [snapshot]))[0];
const evaluateAll = (snapshot) => rows('SELECT * FROM public.evaluate_matching_structured_requirements_core_v1($1)', [snapshot]);
const outcomes = async (snapshot) => Object.fromEntries((await rows(
  `SELECT r.evaluated_for_user_id u, r.requirement_key k, r.requirement_outcome o, r.evidence_source_class s
     FROM ${P.HARD_RESULTS} r WHERE r.eligibility_snapshot_id = $1`, [snapshot])).map((r) => [`${r.u}/${r.k}`, `${r.o}/${r.s}`]));

/** One matchable human with exactly these requirement items, through the real I-07A commands. */
const provision = (human, requirements = [['faith_practice_level', 'SOFT_PREFERENCE', 'practising']]) =>
  rt.provisionMatchableHuman(human, { profile: PROFILE, requirements, approvedKeys: APPROVED });

/** Configured policies, a pair, and a captured snapshot, without the support module's opposite-sex convenience. */
async function captured(a, b, { policies = true } = {}) {
  await asRole('postgres');
  if (policies && (await count(P.POLICY_STATE, 'true', [])) === 0) await rt.installPolicies({ safeFieldKeys: APPROVED });
  const pair = randomUUID();
  const [ensured] = await rt.ensurePair(pair, a, b);
  const snapshot = randomUUID();
  await rt.capture(snapshot, ensured.pair_id, a, b, { facts: false });
  return { pair: ensured.pair_id, snapshot };
}

// ------------------------------------------------------------------ A. posture
async function verifyPosture(report) {
  await report.section('A01 the three relations are private, RESTRICT-bound and carry no consent or source claim', async () => {
    for (const table of OWN_TABLES) {
      const [c] = await rows(`SELECT pg_get_userbyid(c.relowner) owner, c.relrowsecurity rls,
          (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) policies
          FROM pg_class c WHERE c.oid = $1::regclass`, [table]);
      assert.deepEqual(c, { owner: 'postgres', rls: true, policies: 0 }, `A01 ${table} is postgres-owned, RLS on, no policy`);
      for (const role of APP_ROLES) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
          assert.equal((await rows('SELECT has_table_privilege($1, $2, $3) p', [role, table, privilege]))[0].p, false,
            `A01 ${role} holds no ${privilege} on ${table}`);
        }
      }
    }
    const keys = await rows(`SELECT cl.relname, con.conname, con.confdeltype, con.confrelid::regclass::text parent
        FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
       WHERE con.contype = 'f' AND con.conrelid = ANY($1::regclass[])`, [OWN_TABLES]);
    assert.equal(keys.length, 8, 'A01 the eight foreign keys of CW2-06B-01 / -05');
    assert.ok(keys.every((k) => k.confdeltype === 'r'), 'A01 every foreign key is ON DELETE RESTRICT');
    assert.ok(keys.every((k) => !k.parent.startsWith('introductions_preparation_private.')),
      'A01 and none reaches the 0154 preparation schema');
    const columns = (await rows(`SELECT table_name || '.' || column_name c FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])`, [OWN_TABLES.map((t) => t.replace('public.', ''))]))
      .map((r) => r.c);
    assert.deepEqual(columns.filter((c) => /consent|source|evidence|confirmed_by|provenance|declared|corrected|score|rank/u.test(c)), [],
      'A01 a fact version carries no consent, source or evidence claim of its own (R5)');
  });

  await report.section('A02 every new and replaced function is postgres-owned, pinned, and executable by no role', async () => {
    for (const fn of [...NEW_FUNCTIONS, ...REPLACED]) {
      const p = await rt.functionPosture(fn);
      assert.equal(p.owner, 'postgres', `A02 ${fn} is postgres-owned`);
      assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'), `A02 ${fn} pins an empty search_path`);
      for (const role of ['public', ...APP_ROLES]) {
        assert.equal(await rt.canExecute(role, fn), false, `A02 ${role} must not execute ${fn}`);
      }
    }
    // NO WRAPPER: no function any application role can run reaches the writer.
    // RE-ANCHORED by S6-07 CP1 (CA-R5-impl, migration 0165): CW2-06B-02 §3 named S6-07's reviewed, human-authorized
    // enrollment as the writer's one intended caller. Exactly that ONE named boundary wraps it - authenticated only, the
    // human from auth.uid(), every promoted version bound to its promotion record - and nothing else may (verify-0149 f16).
    const wrappers = await rows(`SELECT p.oid::regprocedure::text fn FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.prosrc LIKE '%record_matching_confirmed_facts_core_v1%'
         AND p.oid <> $1::regprocedure`, [FN.WRITER]);
    assert.deepEqual(wrappers.map((w) => w.fn), ['enroll_my_matching_setup_v1(uuid,text,bigint,text,text,text)'],
      'A02 exactly the one S6-07 enrollment boundary wraps the internal writer (CA-R5-impl)');
    for (const role of ['public', 'anon', 'service_role']) {
      assert.equal(await rt.canExecute(role, 'public.enroll_my_matching_setup_v1(uuid,text,bigint,text,text,text)'), false,
        `A02 ${role} cannot run the one wrapper`);
    }
  });

  await report.section('A03 nothing is installed, promoted or bound at rest', async () => {
    for (const table of [...OWN_TABLES, P.POLICY_VERSIONS, P.POLICY_STATE]) {
      assert.equal(await count(table, 'true', []), 0, `A03 ${table} holds no row`);
    }
  });

  await report.section('A04 the confirmed first-name shape is exactly the S6-01 declared first-name shape', async () => {
    const def = async (table, name) => (await rows(`SELECT pg_get_constraintdef(c.oid) d FROM pg_constraint c
        WHERE c.conrelid = $1::regclass AND c.conname = $2`, [table, name]))[0]?.d;
    const ours = await def(P.FACT_VERSIONS, 'matching_confirmed_fact_versions_first_name_check');
    assert.ok(ours, 'A04 the shape exists');
    assert.equal(ours, await def('introductions_preparation_private.declared_facts', 'declared_facts_first_name_check'),
      'A04 byte for byte');
  });

  await report.section('A05 R4-B: the gate keeps its one clock and order, and no 0114 or 0120 decision core is replaced', async () => {
    const gate = (await rt.functionPosture(PFN.GATE)).prosrc;
    assert.equal(gate.split('clock_timestamp()').length - 1, 1, 'A05 the gate reads exactly one real instant');
    assert.doesNotMatch(gate, /now\(\)|localtimestamp|current_timestamp|transaction_timestamp|statement_timestamp/iu,
      'A05 and no transaction clock');
    const at = (needle) => { const i = gate.indexOf(needle); assert.ok(i >= 0, `A05 the gate carries ${needle}`); return i; };
    const order = ['lock_matching_pair_humans_v1', 'IF disclosed = 0 THEN', 'delivery_at := clock_timestamp()',
      'proposal.expires_at <= delivery_at', 'INSERT INTO public.matching_recipient_proposal_views ('].map(at);
    for (let i = 1; i < order.length; i += 1) assert.ok(order[i] > order[i - 1], `A05 gate step ${i} follows step ${i - 1}`);
    const frozen0114 = [...source(M0114).matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.([a-z0-9_]+)\(/gu)].map((m) => m[1]);
    assert.ok(frozen0114.includes('commit_matching_mutual_match_v1') && frozen0114.includes('approve_matching_proposal_forward_core_v1'));
    const decisions0120 = ['offer_matching_proposal_to_first_core_v1', 'forward_matching_proposal_to_second_core_v1',
      'decline_matching_proposal_as_first_core_v1', 'decline_matching_proposal_as_second_core_v1', 'withdraw_matching_proposal_core_v1',
      'expire_matching_proposal_core_v1', 'revalidate_matching_proposal_core_v1'];
    for (const text of [source(M0156), source(M0157)]) {
      const replaced = [...text.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.([a-z0-9_]+)\(/gu)].map((m) => m[1]);
      for (const name of [...frozen0114, ...decisions0120]) {
        assert.ok(!replaced.includes(name), `A05 S6-03 does not replace ${name}`);
      }
      assert.doesNotMatch(text, /^\s*GRANT\b/imu, 'A05 S6-03 grants nothing');
    }
  });

  await report.section('A06 the private reason vocabulary is the twelve existing codes and MATCHING_FACT_VERSION_CHANGED', async () => {
    const [{ d }] = await rows(`SELECT pg_get_constraintdef(c.oid) d FROM pg_constraint c
        WHERE c.conrelid = $1::regclass AND c.conname = 'matching_proposal_transitions_reason_check'`, [P.TRANSITIONS]);
    assert.equal((d.match(/'[A-Z_]+'/gu) ?? []).length, 13, 'A06 thirteen codes');
    assert.ok(d.includes("'MATCHING_FACT_VERSION_CHANGED'") && d.includes("'COMPETING_MATCH_COMMITTED'"));
    const projection = (await rt.functionPosture(PFN.MY_PROPOSAL)).prosrc;
    assert.doesNotMatch(projection, /private_reason/u, 'A06 no recipient projection returns a private reason');
  });

  await report.section('A07 every new helper and delta classifier is IMMUTABLE, invoker-rights and reads no relation', async () => {
    for (const fn of [FN.FAMILY, FN.AGE_RANGE, FN.MARITAL, FN.AREA, FN.AGE, FN.HORIZON,
      FN.CONTACT_DELTA, FN.PROVENANCE_DELTA, FN.QUOTED_DELTA, FN.RANKING_DELTA, FN.SENSITIVE_DELTA]) {
      const p = await rt.functionPosture(fn);
      assert.equal(p.volatility, 'i', `A07 ${fn} is IMMUTABLE`);
      assert.doesNotMatch(p.prosrc, /\bFROM\s+public\./iu, `A07 ${fn} reads no relation`);
    }
    for (const fn of [FN.FACTS, PFN.FIRST_NAME, PFN.SNAPSHOT_VALIDITY, PFN.MY_PROPOSAL]) {
      const p = await rt.functionPosture(fn);
      assert.equal(p.volatility, 's', `A07 ${fn} is STABLE`);
      assert.doesNotMatch(p.prosrc, /INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE/u, `A07 ${fn} writes nothing`);
    }
  });
}

// ------------------------------------------------------------------ B / C. the fact source and the first name
async function verifyFacts(report, [one, two]) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('B01 one internal writer: first version, retry, conflict, compare-and-swap, chain, pointer', async () => {
      const v1 = randomUUID();
      const [first] = await write(v1, one, null, fact({ sex: 'FEMALE', firstName: 'Sara' }));
      assert.deepEqual(first, { fact_version_id: v1, superseded_fact_version_id: null }, 'B01 a first version roots its chain');
      assert.deepEqual(await write(v1, one, null, fact({ sex: 'FEMALE', firstName: 'Sara' })), [first],
        'B01 an equivalent retry answers from the committed row');
      await rejected(() => write(v1, one, null, fact({ sex: 'MALE', firstName: 'Sara' })), ['23505'], /COMMAND_ID_CONFLICT/u);
      await rejected(() => write(randomUUID(), one, null, fact({ sex: 'FEMALE' })), ['40001'], /MATCHING_STALE_STATE/u);
      const v2 = randomUUID();
      await write(v2, one, v1, fact({ sex: 'FEMALE', firstName: 'Sarah', birthYear: 1994, birthMonth: 5 }));
      assert.equal((await rt.currentFacts(one)).fact_version_id, v2, 'B01 the pointer moves to the superseding version');
      const [historical] = await rows(`SELECT first_name FROM ${P.FACT_VERSIONS} WHERE id = $1`, [v1]);
      assert.equal(historical.first_name, 'Sara', 'B01 the historical version is never rewritten');
      await rejected(() => q(`UPDATE ${P.FACT_VERSIONS} SET first_name = 'X' WHERE id = $1`, [v1]), ['55000'], /IMMUTABLE/u);
      await rejected(() => q(`DELETE FROM ${P.FACT_VERSIONS} WHERE id = $1`, [v1]), ['55000'], /IMMUTABLE/u);
      await rejected(() => q(`UPDATE ${P.FACT_STATE} SET current_fact_version_id = $1 WHERE owner_user_id = $2`, [v1, one]),
        ['55000'], /NOT_A_FORWARD_MOVE/u);
      await rejected(() => q(`DELETE FROM ${P.FACT_STATE} WHERE owner_user_id = $1`, [one]), ['55000'], /DURABLE/u);
      // A version chain never crosses owners.
      await rejected(() => write(randomUUID(), two, v2, fact({ sex: 'MALE' })), ['40001'], /MATCHING_STALE_STATE/u);
      assert.equal(await count(P.FACT_VERSIONS, 'owner_user_id = $1', [two]), 0, 'B01 nothing was written for the other human');
    });

    await report.isolated('B02 every shape is refused before anything is written, and so is an unsupported area', async () => {
      const refusedShape = [
        fact({ firstName: 'Sara1' }), fact({ firstName: 'sara@x' }), fact({ firstName: ' Sara' }), fact({ firstName: 'x'.repeat(33) }),
        fact({ firstName: 'واتساب' }), fact({ sex: 'OTHER' }), fact({ birthYear: 1899, birthMonth: 1 }),
        fact({ birthYear: 1990, birthMonth: 13 }), fact({ maritalStatus: 'ENGAGED' }),
      ];
      for (const f of refusedShape) {
        await rejected(() => write(randomUUID(), one, null, f), ['22023'], /MATCHING_CONFIRMED_FACT_INVALID/u);
      }
      // A value without its confirmation instant is never present, and a region needs its country.
      await rejected(() => rows(`SELECT * FROM ${FN.WRITER.split('(')[0]}($1, $2, NULL, 'Sara', NULL, NULL, NULL, NULL, NULL, NULL,
          NULL, NULL, NULL, NULL, NULL)`, [randomUUID(), one]), ['22023'], /MATCHING_CONFIRMED_FACT_INVALID/u);
      await rejected(() => rows(`SELECT * FROM ${FN.WRITER.split('(')[0]}($1, $2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
          NULL, 'EG-C', NULL, NULL, NULL)`, [randomUUID(), one]), ['22023'], /MATCHING_CONFIRMED_FACT_INVALID/u);
      // A malformed code is not in the catalogue either, and the catalogue is asked first.
      for (const f of [fact({ countryCode: 'US' }), fact({ countryCode: 'EG', regionCode: 'EG-ZZ' }),
        fact({ countryCode: 'DJ', regionCode: 'DJ-AR' }), fact({ countryCode: 'eg' }), fact({ countryCode: 'EG', regionCode: 'SA-01' })]) {
        await rejected(() => write(randomUUID(), one, null, f), ['22023'], /MATCHING_CONFIRMED_AREA_UNSUPPORTED/u);
      }
      assert.equal(await count(P.FACT_VERSIONS, 'owner_user_id = $1', [one]), 0, 'B02 nothing was written');
      await write(randomUUID(), one, null, fact({ countryCode: 'EG', regionCode: 'EG-ALX', maritalStatus: 'NEVER_MARRIED' }));
      assert.equal((await rt.currentFacts(one)).region_code, 'EG-ALX', 'B02 a supported country and region are accepted');
    });

    await report.isolated('C01 the first name is the confirmed Introduction First Name only', async () => {
      assert.deepEqual(await nameOf(one), { resolution: 'UNRESOLVED_NO_CANONICAL_SOURCE', first_name: null },
        'C01 no confirmed fact version: unresolved, with a NULL name');
      // Not the account Name, not a Public identity, not the mutable preparation draft - even one marked confirmed.
      await q("UPDATE public.users SET name = 'Account Name', login_id = $2 WHERE id = $1", [one, `s603.${one.slice(0, 8)}`]);
      await q('INSERT INTO introductions_preparation_private.drafts (user_id, draft_version) VALUES ($1, 1)', [one]);
      await q(`INSERT INTO introductions_preparation_private.declared_facts (user_id, first_name, first_name_state,
                 first_name_confirmed_at, sex, sex_state, sex_confirmed_at)
               VALUES ($1, 'Huda', 'CONFIRMED', CURRENT_TIMESTAMP, 'FEMALE', 'CONFIRMED', CURRENT_TIMESTAMP)`, [one]);
      assert.equal((await nameOf(one)).resolution, 'UNRESOLVED_NO_CANONICAL_SOURCE',
        'C01 the account Name and a confirmed-but-unpromoted draft are never the source');
      const v1 = randomUUID();
      await write(v1, one, null, fact({ sex: 'FEMALE' }));
      assert.equal((await nameOf(one)).resolution, 'UNRESOLVED_NO_CANONICAL_SOURCE',
        'C01 a version with no confirmed first name is still unresolved');
      const v2 = randomUUID();
      await write(v2, one, v1, fact({ sex: 'FEMALE', firstName: 'فاطمة' }));
      assert.deepEqual(await nameOf(one), { resolution: 'RESOLVED', first_name: 'فاطمة' },
        'C01 the confirmed Introduction First Name of the current version resolves');
      await write(randomUUID(), one, v2, fact({ sex: 'FEMALE' }));
      assert.equal((await nameOf(one)).resolution, 'UNRESOLVED_NO_CANONICAL_SOURCE',
        'C01 a later version without the name withdraws it from the source');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ D. the encoding, the age rule and the horizon
async function verifyEncoding(report) {
  await report.section('D01 the strict decoders: exact grammar, canonical order, no free text', async () => {
    const age = async (v) => rows(`SELECT * FROM ${FN.AGE_RANGE.split('(')[0]}($1)`, [v]);
    const marital = async (v) => rows(`SELECT * FROM ${FN.MARITAL.split('(')[0]}($1)`, [v]);
    const area = async (v) => rows(`SELECT * FROM ${FN.AREA.split('(')[0]}($1)`, [v]);
    assert.deepEqual(await age('min=18;max=99'), [{ min_age: 18, max_age: 99 }]);
    assert.deepEqual(await age('min=30;max=30'), [{ min_age: 30, max_age: 30 }]);
    for (const bad of ['min=17;max=40', 'min=30;max=100', 'min=08;max=40', 'min=41;max=40', 'max=40;min=30', 'min=30; max=40',
      'min=30;max=40;', 'thirty to forty', '']) {
      assert.deepEqual(await age(bad), [], `D01 ${JSON.stringify(bad)} decodes to nothing`);
    }
    assert.deepEqual(await marital('accepted=DIVORCED,NEVER_MARRIED,WIDOWED'), [{ accepted: ['DIVORCED', 'NEVER_MARRIED', 'WIDOWED'] }]);
    for (const bad of ['accepted=NEVER_MARRIED,DIVORCED', 'accepted=DIVORCED,DIVORCED', 'accepted=', 'accepted=SINGLE',
      'accepted=divorced', 'DIVORCED']) {
      assert.deepEqual(await marital(bad), [], `D01 ${JSON.stringify(bad)} decodes to nothing`);
    }
    assert.deepEqual(await area('country=EG'), [{ country_code: 'EG', region_codes: null }]);
    assert.deepEqual(await area('country=EG;regions=EG-ALX,EG-C'), [{ country_code: 'EG', region_codes: ['EG-ALX', 'EG-C'] }]);
    for (const bad of ['country=EG;regions=EG-C,EG-ALX', 'country=EG;regions=SA-01', 'country=EG;regions=EG-C,EG-C', 'country=eg',
      'country=EG;regions=', 'Cairo']) {
      assert.deepEqual(await area(bad), [], `D01 ${JSON.stringify(bad)} decodes to nothing`);
    }
    const family = async (k) => (await rows(`SELECT ${FN.FAMILY.split('(')[0]}($1) f`, [k]))[0].f;
    for (const k of ['age_range_v1', 'age_range_v2', 'marital_status_preference_v1', 'area_v1']) assert.equal(await family(k), true, k);
    for (const k of ['age_range', 'faith_practice_level', 'shared_language']) assert.equal(await family(k), false, k);
  });

  await report.section('D02 R3: the age is decided only by the all-possible-days rule', async () => {
    const cases = [
      // December 1990 at an October 2026 reference: 35 on every possible day.
      [1990, 12, '2026-10-15', 30, 40, 'PASS'], [1990, 12, '2026-10-15', 36, 40, 'FAIL'],
      [1990, 12, '2026-10-01', 35, 35, 'PASS'], [1990, 12, '2026-10-31', 36, 99, 'FAIL'],
      // The boundary inside the birth month: born October 1990, reference 2026-10-15.
      [1990, 10, '2026-10-15', 36, 40, 'UNKNOWN'], [1990, 10, '2026-10-15', 30, 35, 'UNKNOWN'],
      [1990, 10, '2026-10-15', 30, 40, 'PASS'], [1990, 10, '2026-10-15', 37, 40, 'FAIL'],
      // The first and the last day of the month on both sides of the reference date.
      [1990, 10, '2026-09-30', 35, 35, 'PASS'], [1990, 10, '2026-10-01', 36, 36, 'UNKNOWN'],
      [1990, 10, '2026-10-31', 36, 36, 'PASS'], [1990, 10, '2026-11-01', 36, 36, 'PASS'],
      // 31-, 30- and 28-day months.
      [1990, 1, '2027-01-31', 37, 37, 'PASS'], [1990, 4, '2026-04-30', 36, 36, 'PASS'], [1990, 4, '2026-04-29', 36, 36, 'UNKNOWN'],
      [1991, 2, '2026-02-28', 35, 35, 'PASS'],
      // 29 February: a leap birth month, reached on 1 March in a non-leap year.
      [2008, 2, '2026-02-28', 18, 18, 'UNKNOWN'], [2008, 2, '2026-03-01', 18, 18, 'PASS'], [2008, 2, '2028-02-29', 20, 20, 'PASS'],
      // A birth month later than the reference month in an earlier year is decided by the rule, not automatically UNKNOWN.
      [2000, 11, '2026-10-15', 25, 25, 'PASS'], [2000, 11, '2026-10-15', 26, 99, 'FAIL'],
      // Only a month with no possible day on or before R is UNKNOWN for that reason.
      [2026, 11, '2026-10-15', 18, 99, 'UNKNOWN'], [2026, 10, '2026-10-15', 18, 99, 'FAIL'],
    ];
    for (const [y, m, r, min, max, expected] of cases) {
      assert.equal(await ageOf(y, m, r, min, max), expected, `D02 born ${y}-${m}, reference ${r}, range [${min},${max}]`);
    }
  });

  await report.section('D03 R4: the age-certainty horizon H = (year + max + 1)-month-01 UTC, before which PASS is certain', async () => {
    const [{ h }] = await rows(`SELECT to_char(${FN.HORIZON.split('(')[0]}(1990, 10, 40) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') h`, []);
    assert.equal(h, '2031-10-01 00:00:00', 'D03 H for born October 1990, max 40, at 00:00 UTC');
    for (const [y, m, min, max] of [[1990, 10, 30, 40], [1996, 2, 18, 30], [1990, 12, 30, 35]]) {
      const [{ horizon }] = await rows(`SELECT (${FN.HORIZON.split('(')[0]}($1, $2, $3) AT TIME ZONE 'UTC')::date::text horizon`, [y, m, max]);
      const dayBefore = (await rows("SELECT ($1::date - 1)::text d", [horizon]))[0].d;
      assert.equal(await ageOf(y, m, dayBefore, min, max), 'PASS', `D03 born ${y}-${m} [${min},${max}] is PASS the day before H`);
      assert.notEqual(await ageOf(y, m, horizon, min, max), 'PASS', `D03 and is no longer PASS on H itself`);
    }
  });
}

// ------------------------------------------------------------------ E / F. evaluator, pair rule, binding, currentness
async function verifyEligibility(report, [one, two, three]) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('F01 the Product pair rule at capture: only one confirmed MALE and one confirmed FEMALE', async () => {
      await provision(one);
      await provision(two);
      await provision(three);
      await rt.installPolicies({ safeFieldKeys: APPROVED });
      const pairOf = async (a, b) => (await rt.ensurePair(randomUUID(), a, b))[0].pair_id;
      const tryCapture = async (a, b) => {
        const pair = await pairOf(a, b);
        try {
          await q('SAVEPOINT f01');
          await rt.capture(randomUUID(), pair, a, b, { facts: false });
          await q('RELEASE SAVEPOINT f01');
          return null;
        } catch (error) {
          await q('ROLLBACK TO SAVEPOINT f01');
          return error;
        }
      };
      const expectRefused = async (a, b, why) => {
        const error = await tryCapture(a, b);
        assert.ok(error, `F01 ${why}: refused`);
        assert.equal(error.code, '55000', `F01 ${why}: 55000`);
        assert.match(error.message, /^MATCHING_PAIR_NOT_ELIGIBLE$/u, `F01 ${why}: the same single bounded answer`);
        assert.ok(![one, two, three].some((h) => `${error.message} ${error.detail ?? ''}`.includes(h)), `F01 ${why}: names neither human`);
      };
      await expectRefused(one, two, 'no confirmed facts at all');
      await rt.recordFacts(one, { sex: 'MALE' });
      await expectRefused(one, two, 'one human has no confirmed fact version');
      await rt.recordFacts(two, { firstName: 'Mona' });
      await expectRefused(one, two, 'a version without a confirmed sex');
      await rt.recordFacts(two, { sex: 'MALE' });
      await expectRefused(one, two, 'MALE / MALE');
      await rt.recordFacts(one, { sex: 'FEMALE' });
      await rt.recordFacts(two, { sex: 'FEMALE' });
      await expectRefused(one, two, 'FEMALE / FEMALE');
      // A sex confirmed only in the 0154 preparation draft is not a confirmed Matching fact.
      await q('INSERT INTO introductions_preparation_private.drafts (user_id, draft_version) VALUES ($1, 1)', [three]);
      await q(`INSERT INTO introductions_preparation_private.declared_facts (user_id, sex, sex_state, sex_confirmed_at)
               VALUES ($1, 'MALE', 'CONFIRMED', CURRENT_TIMESTAMP)`, [three]);
      await expectRefused(one, three, 'a draft-only confirmed sex');
      assert.equal(await count(P.SNAPSHOTS, 'lower_user_id = ANY($1::uuid[])', [[one, two, three]]), 0, 'F01 no snapshot was written');
      await rt.recordFacts(three, { sex: 'MALE' });
      assert.equal(await tryCapture(one, three), null, 'F01 FEMALE / MALE captures');
      const [binding] = await rows(`SELECT b.* FROM ${P.FACT_BINDINGS} b JOIN ${P.SNAPSHOTS} s ON s.id = b.eligibility_snapshot_id
          WHERE s.pair_id = $1`, [await pairOf(one, three)]);
      const lo = one < three ? one : three;
      const hi = one < three ? three : one;
      assert.equal(binding.pair_rule, 'OPPOSITE_SEX_CONFIRMED_V1', 'F01 the binding records the rule identity');
      assert.equal(binding.lower_fact_version_id, (await rt.currentFacts(lo)).fact_version_id, 'F01 and the exact current versions');
      assert.equal(binding.higher_fact_version_id, (await rt.currentFacts(hi)).fact_version_id);
      assert.equal(await count(P.HARD_RESULTS, 'eligibility_snapshot_id = $1', [binding.eligibility_snapshot_id]), 0,
        'F01 the pair rule is never a hard requirement result');
    });

    await report.isolated('F02 the binding is load-bearing: the pair rule and the pair are properties of the row', async () => {
      await provision(one);
      await provision(two);
      await rt.installPolicies({ safeFieldKeys: APPROVED });
      await rt.recordFacts(one, { sex: 'MALE' });
      await rt.recordFacts(two, { sex: 'FEMALE' });
      const { snapshot } = await captured(one, two);
      const [b] = await rows(`SELECT * FROM ${P.FACT_BINDINGS} WHERE eligibility_snapshot_id = $1`, [snapshot]);
      await rejected(() => q(`UPDATE ${P.FACT_BINDINGS} SET bound_at = bound_at WHERE eligibility_snapshot_id = $1`, [snapshot]),
        ['55000'], /IMMUTABLE/u);
      // A same-sex binding cannot be written even directly, and neither can a binding of somebody else's version.
      await q(`ALTER TABLE ${P.FACT_BINDINGS} DISABLE TRIGGER matching_eligibility_snapshot_fact_bindings_immutable`);
      await q(`DELETE FROM ${P.FACT_BINDINGS} WHERE eligibility_snapshot_id = $1`, [snapshot]);
      await q(`ALTER TABLE ${P.FACT_BINDINGS} ENABLE TRIGGER matching_eligibility_snapshot_fact_bindings_immutable`);
      const low = one < two ? one : two;
      const lowVersion = (await rt.currentFacts(low)).fact_version_id;
      const sameSex = await rt.recordFacts(low === one ? two : one, { sex: low === one ? 'MALE' : 'FEMALE' });
      const insert = (lv, hv) => q(`INSERT INTO ${P.FACT_BINDINGS}
          (eligibility_snapshot_id, pair_id, lower_user_id, higher_user_id, lower_fact_version_id, higher_fact_version_id)
          VALUES ($1, $2, $3, $4, $5, $6)`, [snapshot, b.pair_id, b.lower_user_id, b.higher_user_id, lv, hv]);
      await rejected(() => insert(lowVersion, sameSex), ['55000'], /MATCHING_PAIR_RULE_NOT_SATISFIED/u);
      await rejected(() => insert(lowVersion, lowVersion), ['55000', '23503'], /PAIR_RULE_NOT_SATISFIED|fact_fk/u);
    });

    await report.isolated('E01 the deterministic evaluator: every family dimension, against the OTHER human\'s BOUND facts', async () => {
      await provision(one, [
        ['age_range_v1', 'HARD_DEALBREAKER', 'min=30;max=40'],
        ['marital_status_v1', 'HARD_DEALBREAKER', 'accepted=DIVORCED,NEVER_MARRIED'],
        ['area_v1', 'HARD_DEALBREAKER', 'country=EG;regions=EG-ALX,EG-C'],
        ['age_range_preference_v1', 'SOFT_PREFERENCE', 'min=32;max=34'],
        ['area_preference_v1', 'SOFT_PREFERENCE', 'country=SA']]);
      await provision(two, [
        ['age_range_v1', 'HARD_DEALBREAKER', 'min=36;max=40'],
        ['marital_status_v1', 'HARD_DEALBREAKER', 'accepted=WIDOWED'],
        ['area_v1', 'HARD_DEALBREAKER', 'country=EG;regions=EG-GZ'],
        ['age_range_v2', 'HARD_DEALBREAKER', 'min=18;max=99'],
        ['area_preference_v1', 'HARD_DEALBREAKER', 'country=EG']]);
      await rt.installPolicies({ safeFieldKeys: APPROVED });
      await rt.recordFacts(one, { sex: 'MALE', ...(await bornAged(35)), maritalStatus: 'NEVER_MARRIED', countryCode: 'EG' });
      await rt.recordFacts(two, { sex: 'FEMALE', ...(await bornAged(35)), maritalStatus: 'DIVORCED', countryCode: 'EG', regionCode: 'EG-ALX' });
      const { snapshot } = await captured(one, two);
      const first = await evaluateAll(snapshot);
      assert.equal(first.length, 8, 'E01 every HARD family item of both humans and nothing else');
      const got = await outcomes(snapshot);
      const E = 'EXPLICIT_MATCHING_ANSWER';
      assert.deepEqual(got, {
        [`${one}/age_range_v1`]: `PASS/${E}`, // two is 35 on every possible day of the birth month at the capture date
        [`${one}/marital_status_v1`]: `PASS/${E}`,
        [`${one}/area_v1`]: `PASS/${E}`,
        [`${two}/age_range_v1`]: `FAIL/${E}`, // one is 35 too, outside [36, 40] on every possible day
        [`${two}/marital_status_v1`]: `FAIL/${E}`,
        [`${two}/area_v1`]: 'UNKNOWN/NOT_ESTABLISHED', // regions listed, and one has no confirmed region
        [`${two}/age_range_v2`]: 'UNKNOWN/NOT_ESTABLISHED', // an encoding version other than v1 is never PASS
        [`${two}/area_preference_v1`]: 'UNKNOWN/NOT_ESTABLISHED', // a preference key written with the hard strength
      }, 'E01 PASS, FAIL and UNKNOWN exactly as CW2-06B-05 §6-7 define them; soft preferences are never gates');
      assert.deepEqual(await evaluateAll(snapshot), first, 'E01 an equivalent re-run answers from the committed rows');
      await rejected(() => rt.prepare(randomUUID(), snapshot, one), ['55000'], /HARD_REQUIREMENT_NOT_SATISFIED/u);
      // The manual recorder refuses every family key, whatever outcome it is handed.
      await rejected(() => rt.evaluate(snapshot, two, 'area_v1', 'PASS', E), ['22023'], /EVALUATED_DETERMINISTICALLY/u);
    });

    await report.isolated('E02 missing or unusable facts are UNKNOWN, never PASS, and a malformed value is UNKNOWN', async () => {
      await provision(one, [['age_range_v1', 'HARD_DEALBREAKER', 'min=30;max=40'],
        ['marital_status_v1', 'HARD_DEALBREAKER', 'accepted=DIVORCED'], ['area_v1', 'HARD_DEALBREAKER', 'country=EG']]);
      await provision(two, [['age_range_v1', 'HARD_DEALBREAKER', 'thirty to forty'],
        ['area_v1', 'HARD_DEALBREAKER', 'country=SA']]);
      await rt.installPolicies({ safeFieldKeys: APPROVED });
      await rt.recordFacts(one, { sex: 'FEMALE', countryCode: 'EG', birthYear: 1990, birthMonth: 1 });
      await rt.recordFacts(two, { sex: 'MALE' });
      const { snapshot } = await captured(one, two);
      await evaluateAll(snapshot);
      const got = await outcomes(snapshot);
      for (const key of ['age_range_v1', 'marital_status_v1', 'area_v1']) {
        assert.equal(got[`${one}/${key}`], 'UNKNOWN/NOT_ESTABLISHED', `E02 ${key} against a missing fact is UNKNOWN`);
      }
      assert.equal(got[`${two}/age_range_v1`], 'UNKNOWN/NOT_ESTABLISHED', 'E02 free text is never interpreted');
      assert.equal(got[`${two}/area_v1`], 'FAIL/EXPLICIT_MATCHING_ANSWER', 'E02 a confirmed different country is FAIL');
    });

    await report.isolated('F03 currentness: a fact change stales progress with MATCHING_FACT_VERSION_CHANGED', async () => {
      await provision(one);
      await provision(two);
      await rt.installPolicies({ safeFieldKeys: APPROVED });
      await rt.recordFacts(one, { sex: 'MALE' });
      await rt.recordFacts(two, { sex: 'FEMALE' });
      const { snapshot } = await captured(one, two);
      assert.deepEqual(await validityOf(snapshot), { still_valid: true, private_reason_code: null });
      const proposal = randomUUID();
      await rt.prepare(proposal, snapshot, one);
      await rt.recordFacts(two, { sex: 'FEMALE', maritalStatus: 'NEVER_MARRIED' });
      assert.deepEqual(await validityOf(snapshot), { still_valid: false, private_reason_code: 'MATCHING_FACT_VERSION_CHANGED' },
        'F03 a moved version is invalid, with the private reason');
      await rejected(() => rt.prepare(randomUUID(), snapshot, two), ['40001'], /ELIGIBILITY_NO_LONGER_CURRENT/u);
      const [stale] = await rt.revalidate(randomUUID(), proposal);
      assert.deepEqual([stale.current_state, stale.private_reason_code], ['STALE', 'MATCHING_FACT_VERSION_CHANGED'],
        'F03 the existing protective revalidation ends the live proposal');
      // A snapshot with no binding at all is invalid for the same reason.
      await q(`ALTER TABLE ${P.FACT_BINDINGS} DISABLE TRIGGER matching_eligibility_snapshot_fact_bindings_immutable`);
      await q(`DELETE FROM ${P.FACT_BINDINGS} WHERE eligibility_snapshot_id = $1`, [snapshot]);
      await q(`ALTER TABLE ${P.FACT_BINDINGS} ENABLE TRIGGER matching_eligibility_snapshot_fact_bindings_immutable`);
      assert.equal((await validityOf(snapshot)).private_reason_code, 'MATCHING_FACT_VERSION_CHANGED', 'F03 an unbound snapshot too');
      await rejected(() => evaluateAll(snapshot), ['55000'], /MATCHING_SNAPSHOT_FACTS_UNBOUND/u);
    });
  } finally {
    await q('ROLLBACK');
  }
}

/** F04 - the two-connection race: preparation that waits on a fact change it cannot see yet is refused. */
async function verifyFactRace(report, [one, two]) {
  await report.section('F04 a fact change racing preparation: the writer holds the lock, preparation waits and is refused', async () => {
    await provision(one);
    await provision(two);
    await rt.installPolicies({ safeFieldKeys: APPROVED });
    await rt.recordFacts(one, { sex: 'MALE' });
    await rt.recordFacts(two, { sex: 'FEMALE' });
    const { snapshot } = await captured(one, two);
    const extra = await rt.openExtra();
    try {
      await extra.qx('BEGIN');
      const current = (await rt.currentFacts(two)).fact_version_id;
      await extra.qx(`SELECT * FROM ${FN.WRITER.split('(')[0]}($1, $2, $3, NULL, NULL, 'FEMALE', $4, 1990, 1, $4,
          NULL, NULL, NULL, NULL, NULL)`, [randomUUID(), two, current, AT]);
      const proposal = randomUUID();
      const [{ pid }] = await rows('SELECT pg_backend_pid() pid');
      const waiting = rt.prepare(proposal, snapshot, one).then(() => null, (error) => error);
      assert.equal(await rt.waitForLockWait(extra.qx, pid), true, 'F04 preparation is observably waiting on the human the writer holds');
      await extra.qx('COMMIT');
      const outcome = await waiting;
      assert.ok(outcome, 'F04 preparation is refused');
      assert.equal(outcome.code, '40001', 'F04 as a stale snapshot');
      assert.match(outcome.message, /ELIGIBILITY_NO_LONGER_CURRENT/u);
      assert.equal(await count(P.PROPOSALS, 'id = $1', [proposal]), 0, 'F04 and nothing was prepared');
    } finally {
      await extra.close();
      await rt.cleanupRace([one, two]);
    }
  });
}

// ------------------------------------------------------------------ G. B4 and the neutral projection
async function verifyNeutral(report, [one, two, three, four]) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('G01 B4: an explicitly empty Product allowlist yields a zero-field view, the NULL projection and a zero-field Handoff', async () => {
      await rt.recordFacts(one, { sex: 'FEMALE', firstName: 'Sara' });
      await rt.recordFacts(two, { sex: 'MALE', firstName: 'عمر' });
      const f = await rt.bringToForwarded(one, two, { safeFieldKeys: [] });
      assert.equal(await count(P.POLICY_FIELDS, 'policy_version_id = $1', [f.policy.fields]), 0, 'G01 the current policy permits zero keys');
      const views = await rows(`SELECT * FROM ${P.VIEWS} WHERE proposal_id = $1 ORDER BY recipient_role`, [f.proposal]);
      assert.equal(views.length, 2, 'G01 both recipients have a view');
      assert.equal(await count(P.VIEW_FIELDS, 'view_id = ANY($1::uuid[])', [views.map((v) => v.id)]), 0, 'G01 with zero fields');
      const byRole = Object.fromEntries(views.map((v) => [v.recipient_role, v]));
      assert.equal(byRole.FIRST_RECIPIENT.subject_first_name, 'عمر', 'G01 bound internally to the confirmed first name');
      assert.equal(byRole.CANDIDATE.subject_first_name, 'Sara');
      for (const v of views) {
        assert.ok(v.subject_disclosure_authority_id && v.permitted_conclusion_id, 'G01 the authority and the conclusion stay bound');
      }
      for (const human of [one, two]) {
        await actAs(human);
        const [answer] = await rt.myProposal(f.proposal);
        assert.equal(answer.presented_first_name, null, 'G01 no first name is presented');
        assert.equal(answer.safe_compatibility_conclusion, null, 'G01 and no conclusion');
        assert.deepEqual(await rt.myFields(f.proposal), [], 'G01 and no field');
      }
      await actAs(two);
      const ids = matchIds();
      await rt.commitMatch(ids, f.proposal, f.secondView);
      await asRole('postgres');
      const subjects = await rt.subjectsOf(ids.handoff);
      assert.equal(subjects.length, 2, 'G01 the Handoff carries both subjects');
      assert.deepEqual(subjects.map((s) => s.presented_first_name).sort(), ['Sara', 'عمر'].sort(),
        'G01 with exactly the names the views bound');
      assert.equal((await rt.fieldsOf(ids.handoff)).length, 0, 'G01 and zero field rows');
      for (const human of [one, two]) {
        await actAs(human);
        const [after] = await rt.myProposal(f.proposal);
        assert.equal(after.presented_first_name, null, 'G01 the proposal projection stays neutral after Mutual Match');
        assert.equal(after.neutral_outcome, 'MATCH_CONCLUDED');
      }
      await asRole('postgres');
      // A later fact version rewrites neither a view nor the Handoff copy.
      await rt.recordFacts(two, { sex: 'MALE', firstName: 'Omar' });
      assert.equal((await rows(`SELECT subject_first_name n FROM ${P.VIEWS} WHERE id = $1`, [byRole.FIRST_RECIPIENT.id]))[0].n, 'عمر');
      assert.deepEqual((await rt.subjectsOf(ids.handoff)).map((s) => s.presented_first_name).sort(), ['Sara', 'عمر'].sort());
    });

    await report.isolated('G02 an empty intersection under a NON-empty policy is still refused, and so is a missing policy', async () => {
      await rt.recordFacts(three, { sex: 'FEMALE', firstName: 'Mona' });
      await rt.recordFacts(four, { sex: 'MALE', firstName: 'Ali' });
      // Product permits a key neither human approved: the intersection is empty and the policy is not.
      await assert.rejects(() => rt.bringToOffered(three, four, { safeFieldKeys: ['favourite_season'] }),
        (error) => error.code === '55000' && /MATCHING_PROPOSAL_DISCLOSURE_EMPTY/u.test(error.message));
    });

    await report.isolated('G03 a missing Product field policy discloses nothing', async () => {
      await rt.recordFacts(three, { sex: 'FEMALE', firstName: 'Mona' });
      await rt.recordFacts(four, { sex: 'MALE', firstName: 'Ali' });
      const f = await rt.seedEligible(three, four, { safeFieldKeys: [] });
      const proposal = randomUUID();
      await rt.prepare(proposal, f.snapshot, three);
      const conclusion = await rt.permitted(f.snapshot, three, four, CLEAN);
      await q(`ALTER TABLE ${P.POLICY_STATE} DISABLE TRIGGER matching_proposal_policy_state_truth`);
      await q(`DELETE FROM ${P.POLICY_STATE} WHERE policy_kind = 'PROPOSAL_SAFE_FIELDS'`);
      await q(`ALTER TABLE ${P.POLICY_STATE} ENABLE TRIGGER matching_proposal_policy_state_truth`);
      await rejected(() => rt.materialize(randomUUID(), proposal, three, conclusion.id), ['55000'], /POLICY_UNCONFIGURED/u);
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ H. the privacy floor
async function verifyFloor(report, [one, two]) {
  await report.section('H01 each classifier is its 0111 rule verbatim OR its delta, and each delta CHECK IS its delta classifier', async () => {
    for (const [classifier, delta] of DELTAS) {
      const body = (await rt.functionPosture(classifier)).prosrc;
      assert.ok(body.includes(`OR ${delta.split('(')[0]}(p_text)`), `H01 ${classifier} ORs in ${delta}`);
      assert.equal((await rt.functionPosture(classifier)).volatility, 'i', `H01 ${classifier} stays IMMUTABLE`);
    }
    for (const [table, name, column, delta] of FLOOR_CHECKS) {
      const [c] = await rows(`SELECT pg_get_constraintdef(c.oid) d FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.conname = $2`,
        [table, name]);
      // pg_get_constraintdef leaves out the schema of a function on the search path.
      assert.equal(c?.d?.replace('(NOT public.', '(NOT '), `CHECK ((NOT ${delta.split('(')[0].replace('public.', '')}(${column})))`,
        `H01 ${name} refuses exactly what ${delta} refuses`);
    }
    // Every existing CHECK stays.
    for (const [table, name] of [[P.VIEW_FIELDS, 'matching_recipient_view_fields_route_ban_check'],
      [P.PERMITTED_CONCLUSIONS, 'matching_permitted_safe_conclusions_route_ban_check'],
      [P.PERMITTED_CONCLUSIONS, 'matching_permitted_safe_conclusions_quote_ban_check'],
      [P.VIEWS, 'matching_recipient_proposal_views_name_check'], [MATCH.SUBJECTS, 'matching_match_handoff_subjects_route_ban_check']]) {
      assert.equal(await count('pg_constraint', 'conrelid = $1::regclass AND conname = $2', [table, name]), 1, `H01 ${name} stays`);
    }
  });

  await report.section('H02 the shared corpus: every new pattern is refused by its delta and its classifier, and is new', async () => {
    for (const [text, delta] of NEW_PATTERN_CORPUS) {
      assert.equal(await classify(delta, text), true, `H02 ${delta} refuses ${JSON.stringify(text)}`);
      const classifier = DELTAS.find(([, d]) => d === delta)[0];
      assert.equal(await classify(classifier, text), true, `H02 and so does ${classifier}`);
      // NEW: the classifier's old rule alone does not refuse it, so the delta is what refuses it.
      const old = (await rt.functionPosture(classifier)).prosrc.match(/SELECT \(([\s\S]*)\)\n\s+OR public\./u)[1];
      const [{ hit }] = await rows(`SELECT (${old.replaceAll('p_text', '$1::text')}) AS hit`, [text]);
      assert.equal(hit, false, `H02 the 0111 rule alone does not refuse ${JSON.stringify(text)}: it is a new pattern`);
    }
  });

  await report.section('H03 ASCII-only text is decided exactly as before, so every existing proof stays true', async () => {
    const ascii = ['reach me at sara.nour@example.com', 'my handle is @sara_nour', 'call 0100 123 4567', 'we both use WhatsApp a lot',
      'settled - call me on 0100 123 4567', 'You both value a quiet home life.', 'ref 3f2504e0-4f89-11d3-9a0c-0305e82c3301',
      'a "very long verbatim private quotation here" ok', '90% compatible', 'she had cancer'];
    for (const text of ascii) {
      for (const [, delta] of DELTAS) {
        assert.equal(await classify(delta, text), false, `H03 ${delta} is silent on ASCII ${JSON.stringify(text)}`);
      }
    }
  });

  await report.section('H04 legitimate Arabic and English names and ordinary sentences pass; the documented false positives are refused', async () => {
    for (const text of [...LEGITIMATE_NAMES, ...LEGITIMATE_SENTENCES]) {
      for (const [classifier] of DELTAS) {
        assert.equal(await classify(classifier, text), false, `H04 ${classifier} lets ${JSON.stringify(text)} through`);
      }
    }
    for (const [text, classifier] of DOCUMENTED_FALSE_POSITIVES) {
      assert.equal(await classify(classifier, text), true,
        `H04 the documented fail-closed cost: ${classifier} refuses the innocent ${JSON.stringify(text)}`);
    }
  });

  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('H05 the CHECKs and the real filter agree with the classifiers on real rows', async () => {
      for (const name of LEGITIMATE_NAMES) {
        await rt.recordFacts(one, { firstName: name });
      }
      await rejected(() => rt.recordFacts(one, { firstName: 'واتساب' }), ['22023'], /MATCHING_CONFIRMED_FACT_INVALID/u);
      // The documented fail-closed cost at the name level: the given name «هاتف» is refused too.
      await rejected(() => rt.recordFacts(one, { firstName: 'هاتف' }), ['22023'], /MATCHING_CONFIRMED_FACT_INVALID/u);
      await rt.recordFacts(one, { sex: 'MALE' });
      await rt.recordFacts(two, { sex: 'FEMALE' });
      const f = await rt.seedEligible(one, two, { safeFieldKeys: APPROVED });
      const conclusionRow = async (text) => {
        const candidate = randomUUID();
        await q(`INSERT INTO ${P.CONCLUSION_CANDIDATES} (id, eligibility_snapshot_id, for_recipient_user_id, about_user_id, conclusion_text)
                 VALUES ($1, $2, $3, $4, $5)`, [candidate, f.snapshot, one, two, text]);
        return () => q(`INSERT INTO ${P.PERMITTED_CONCLUSIONS}
            (id, conclusion_candidate_id, for_recipient_user_id, about_user_id, filter_policy_version_id, permitted_text)
            VALUES ($1, $2, $3, $4, $5, $6)`, [randomUUID(), candidate, one, two, f.policy.filter, text]);
      };
      for (const [text, delta] of NEW_PATTERN_CORPUS.filter(([, d]) => d !== FN.SENSITIVE_DELTA)) {
        const kind = { [FN.CONTACT_DELTA]: 'contact', [FN.PROVENANCE_DELTA]: 'provenance', [FN.QUOTED_DELTA]: 'quote', [FN.RANKING_DELTA]: 'ranking' }[delta];
        await rejected(await conclusionRow(text), ['23514'], new RegExp(`text_${kind}_floor_check`, 'u'));
      }
      for (const text of LEGITIMATE_SENTENCES) await (await conclusionRow(text))();
      // The real filter, on Arabic input: the refusal class is the deterministic one, and it stays private.
      for (const [text, refusal] of [['كلمني على الواتس', 'CONTACT_ROUTE'], ['عانى من الاكتئاب', 'SENSITIVE_FACT'],
        ['نسبة التوافق بينكما عالية', 'VISIBLE_RANKING']]) {
        const candidate = randomUUID();
        await rt.submitConclusion(candidate, f.snapshot, one, two, text);
        const [verdict] = await rt.filterConclusion(randomUUID(), candidate);
        assert.deepEqual([verdict.filter_verdict, verdict.private_refusal_class], ['REFUSED', refusal], `H05 the filter refuses ${text}`);
      }
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ I. the policy primitive
async function verifyPolicy(report) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('I01 the owner-only primitive installs exactly the five kinds, an empty field set included, along each chain', async () => {
      const install = (id, kind, expected, w, m, e, keys) =>
        rows(`SELECT * FROM ${FN.INSTALL.split('(')[0]}($1, $2, $3, $4, $5, $6, $7::text[])`, [id, kind, expected, w, m, e, keys]);
      const cadence = randomUUID();
      assert.deepEqual(await install(cadence, 'PROPOSAL_CADENCE', null, 7, 5, null, null),
        [{ policy_version_id: cadence, policy_kind: 'PROPOSAL_CADENCE', superseded_policy_version_id: null }]);
      assert.equal((await install(cadence, 'PROPOSAL_CADENCE', null, 7, 5, null, null)).length, 1, 'I01 an equivalent retry');
      await rejected(() => install(cadence, 'PROPOSAL_CADENCE', null, 7, 6, null, null), ['23505'], /COMMAND_ID_CONFLICT/u);
      await rejected(() => install(randomUUID(), 'PROPOSAL_CADENCE', null, 7, 5, null, null), ['40001'], /MATCHING_STALE_STATE/u);
      const next = randomUUID();
      await install(next, 'PROPOSAL_CADENCE', cadence, 7, 4, null, null);
      assert.equal((await rows(`SELECT current_policy_version_id c FROM ${P.POLICY_STATE} WHERE policy_kind = 'PROPOSAL_CADENCE'`))[0].c, next);
      const fields = randomUUID();
      await install(fields, 'PROPOSAL_SAFE_FIELDS', null, null, null, null, []);
      assert.equal(await count(P.POLICY_FIELDS, 'policy_version_id = $1', [fields]), 0, 'I01 an explicitly empty allowlist');
      const fields2 = randomUUID();
      await install(fields2, 'PROPOSAL_SAFE_FIELDS', fields, null, null, null, ['life_stage']);
      assert.equal(await count(P.POLICY_FIELDS, 'policy_version_id = $1', [fields2]), 1);
      for (const [kind, w, m, e, keys] of [['NEW_KIND', null, null, null, null], ['PROPOSAL_EXPIRY', null, null, null, null],
        ['PROPOSAL_EXPIRY', null, 3, 72, null], ['PENDING_PROPOSAL_LIMIT', null, -1, null, null],
        ['PROPOSAL_SAFE_FIELDS', null, null, null, null], ['PROPOSAL_EXPIRY', null, null, 72, []],
        ['PROPOSAL_SAFE_FIELDS', null, null, null, ['phone_number']]]) {
        const current = (await rows(`SELECT current_policy_version_id c FROM ${P.POLICY_STATE} WHERE policy_kind = $1`, [kind]))[0]?.c ?? null;
        await rejected(() => install(randomUUID(), kind, current, w, m, e, keys), ['22023'], /POLICY_(KIND|VALUES)_INVALID/u);
      }
      for (const role of ['public', ...APP_ROLES]) assert.equal(await rt.canExecute(role, FN.INSTALL), false, `I01 ${role} cannot install`);
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('I02 and nothing of it survives: no policy is installed', async () => {
    assert.equal(await count(P.POLICY_VERSIONS, 'true', []), 0);
    assert.equal(await count(P.POLICY_STATE, 'true', []), 0);
  });
}

// ------------------------------------------------------------------ J. deletion
async function verifyDeletion(report) {
  const eraseInTransaction = async (user) => {
    const proof = [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) - 1 }];
    await q('SET LOCAL ROLE authenticated');
    await q("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role: 'authenticated', amr: proof })]);
    await rows('SELECT * FROM public.request_own_account_deletion_v1($1)', [randomUUID()]);
    await q('RESET ROLE');
    await q(`UPDATE personal_data_private.account_deletions
                SET requested_at = clock_timestamp() - interval '8 days', final_at = clock_timestamp() - interval '1 day'
              WHERE user_id = $1 AND status = 'SCHEDULED'`, [user]);
    const [{ id }] = await rows("SELECT id FROM personal_data_private.account_deletions WHERE user_id = $1 AND status <> 'CANCELLED'", [user]);
    await q('SET LOCAL ROLE service_role');
    await q("SELECT set_config('request.jwt.claims', '{}', true)");
    const [{ outcome }] = await rows('SELECT public.server_erase_personal_account_v1($1) AS outcome', [id]);
    await q('RESET ROLE');
    return outcome;
  };
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('J01 a synthetic account with no I-07 footprint is ERASED', async () => {
      const fresh = randomUUID();
      await rt.provisionHumans([fresh]);
      assert.equal(await eraseInTransaction(fresh), 'ERASED');
      assert.equal(await count('public.users', 'id = $1', [fresh]), 0, 'J01 the account row is gone');
    });
    await report.isolated('J02 a synthetic account whose only footprint is a confirmed fact version is BLOCKED, with nothing erased', async () => {
      const held = randomUUID();
      await rt.provisionHumans([held]);
      // Written directly, without the writer's serialization row, so the fact relations are the ONLY footprint.
      const version = randomUUID();
      await q(`INSERT INTO ${P.FACT_VERSIONS} (id, owner_user_id, sex, sex_confirmed_at) VALUES ($1, $2, 'MALE', CURRENT_TIMESTAMP)`, [version, held]);
      await q(`INSERT INTO ${P.FACT_STATE} (owner_user_id, current_fact_version_id) VALUES ($1, $2)`, [held, version]);
      assert.equal(await count('public.matching_setup_locks', 'user_id = $1', [held]), 0, 'J02 no lock row holds the account');
      assert.equal(await eraseInTransaction(held), 'BLOCKED', 'J02 the RESTRICT keys make the governed erasure answer BLOCKED');
      assert.equal(await count('public.users', 'id = $1', [held]), 1, 'J02 and nothing of the account was erased');
      assert.equal(await count(P.FACT_VERSIONS, 'owner_user_id = $1', [held]), 1);
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];

await runVerifier('0156', async (setStage) => {
  await rt.client.connect();
  setStage('fixtures');
  await rt.provisionHumans(humans);
  const report = createScenarioReport('0156', { query: q, restore: () => asRole('postgres') });

  setStage('posture');
  await verifyPosture(report);
  setStage('facts');
  await verifyFacts(report, humans);
  setStage('encoding');
  await verifyEncoding(report);
  setStage('eligibility');
  await verifyEligibility(report, humans);

  const nameSeam = await rt.captureMatchingSeam(PFN.FIRST_NAME);
  const gateSeam = await rt.captureMatchingSeam(PFN.PREREQUISITES);
  try {
    // The CW2-08 seam answers NOT_EVALUATED in production; it is cleared for these scenarios and restored byte for
    // byte below. The FIRST-NAME seam is NOT replaced: G01 runs on the real resolver over confirmed facts.
    await rt.clearProposalPrerequisites();
    setStage('fact race');
    await verifyFactRace(report, humans);
    setStage('neutral presentation');
    await verifyNeutral(report, humans);
    setStage('privacy floor');
    await verifyFloor(report, humans);
  } finally {
    await asRole('postgres');
    await rt.restoreMatchingSeam(nameSeam);
    await rt.restoreMatchingSeam(gateSeam);
  }
  setStage('policy');
  await verifyPolicy(report);
  setStage('deletion');
  await verifyDeletion(report);
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  await asRole('postgres');
  assert.equal((await rows('SELECT * FROM public.resolve_matching_proposal_prerequisites_v1($1)', [randomUUID()]))[0].clearance,
    'NOT_EVALUATED', 'the CW2-08 seam is fail-closed again after the run');
  await rt.removeCommittedProposalState(humans);
  await rt.removeCommittedPolicies();
  await rt.removeCommittedMatchingSetup(humans);
  await rt.removeFixtureHumans(humans);
  for (const table of [...OWN_TABLES, P.PROPOSALS, P.POLICY_STATE]) {
    assert.equal(await count(table, 'true', []), 0, `${table} is empty again: every fixture this verifier committed was removed`);
  }
}, () => rt.client.end().catch(() => undefined));
