// S6-07 (CP3) - real-PostgreSQL proof of the governed install of the APPROVED Matching consent texts (version 1).
//
//   T01 the bounds: only a loopback database is accepted (a hosted host is refused before any connection); the CLI needs
//       the explicit confirmation; the module refuses a text that does not match its approved pin
//   T02 a fresh install: exactly the three approved texts, by their approved versions and digests, current; the reader's
//       view shows exactly those texts and versions; the ENROLLMENT gate is untouched and stays CLOSED - so the view is
//       still unavailable and an ENROLL with the approved versions answers NOT_AVAILABLE_NOW, writing nothing
//   T03 idempotent: a second run installs nothing (ALREADY_INSTALLED x 3), the catalogue is unchanged
//   T04 refusals, each writing NOTHING (not even the purposes before the refusal): an unknown current text of a purpose,
//       the approved version already installed with another text, the approved version no longer current
//   T05 with a FIXTURE gate opened here (a verifier fixture, never a launch decision), the approved versions are exactly
//       what an ENROLL names, for a reviewed draft with neither optional profile field (D-CP1-1 = B); a superseded
//       version is CONSENT_OUTDATED
//
// Everything runs in ONE transaction that is rolled back: the catalogue and the gate are left exactly as found (empty in
// CI). Every human is a SYNTHETIC fixture. Every scenario reports INDEPENDENTLY; the run fails ONCE.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { createMatchRuntime, runVerifier } from './matching-match-verifier-support.mjs';
import { MATCHING_CONSENT_TEXTS_V1 } from './matching-consent-texts-v1.mjs';
import { CONFIRMATION, ConsentInstallRefused, assertLoopbackDatabase, installMatchingConsentTextsV1 } from './install-matching-consent-texts.mjs';

const rt = createMatchRuntime(process.env.DATABASE_URL);
const { q, rows, asRole } = rt;
const S = 'matching_enrollment_private';
const PREP = 'introductions_preparation_private';
const INSTALLER = fileURLToPath(new URL('./install-matching-consent-texts.mjs', import.meta.url));
const BY_PURPOSE = Object.fromEntries(MATCHING_CONSENT_TEXTS_V1.map((t) => [t.purpose, t]));
const P = BY_PURPOSE.MATCHING_PARTICIPATION;
const C = BY_PURPOSE.MATCHING_CONTEXT_GRANT;
const D = BY_PURPOSE.PRE_MATCH_DISCLOSURE_AUTHORITY;

const owner = () => asRole('postgres');
const install = () => installMatchingConsentTextsV1(rt.client, { inTransaction: true });
const catalogue = async () => rows(`SELECT consent_version, purpose, text_ar, text_en, sha256_ar, sha256_en, is_current
  FROM ${S}.consent_texts ORDER BY consent_version`);
const gate = async () => (await rows(`SELECT (SELECT count(*) FROM ${S}.gate_states)::int AS states, (SELECT count(*) FROM ${S}.gate_events)::int AS events,
  ${S}.gate_open_v1() AS open`))[0];
async function refused(work, pattern) {
  await assert.rejects(work, (error) => error instanceof ConsentInstallRefused && pattern.test(error.message));
}
async function human() {
  const id = randomUUID();
  await q('INSERT INTO auth.users(id) VALUES ($1)', [id]);
  return id;
}
async function as(uid, sql, values = []) {
  await q('RESET ROLE');
  await q("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
  await q('SET LOCAL ROLE authenticated');
  try { return (await q(sql, values)).rows; } finally { await owner(); }
}
const view = async (uid) => (await as(uid, 'SELECT public.read_my_matching_enrollment_v1() AS r'))[0].r;
const enroll = async (uid, draft, versions = [P.version, C.version, D.version]) =>
  (await as(uid, 'SELECT * FROM public.enroll_my_matching_setup_v1($1, $2, $3, $4, $5, $6)', [randomUUID(), 'ENROLL', draft, ...versions]))[0];
const draftVersion = async (uid) => Number((await rows(`SELECT ${PREP}.draft_version_v1($1) AS v`, [uid]))[0].v);
/** A reviewed draft through the REAL S6-01 owner commands, with NEITHER optional profile field (D-CP1-1 = B). */
async function reviewedDraft(uid) {
  await q(`SELECT * FROM ${PREP}.set_gate_v1('PREPARATION', 'ENABLED', 'SATISFIED', 'verify-consent-texts', 'fixture gate')`);
  const steps = [
    ['SET_FACT', { fact: 'INTRODUCTION_FIRST_NAME', firstName: 'Sara' }], ['SET_FACT', { fact: 'SEX', sex: 'FEMALE' }],
    ['SET_FACT', { fact: 'BIRTH_YEAR_MONTH', year: 1995, month: 4 }], ['SET_FACT', { fact: 'BROAD_AREA', countryCode: 'EG', regionCode: 'EG-C' }],
    ['SET_FACT', { fact: 'MARITAL_STATUS', maritalStatus: 'NEVER_MARRIED' }],
    ...['INTRODUCTION_FIRST_NAME', 'SEX', 'BIRTH_YEAR_MONTH', 'BROAD_AREA', 'MARITAL_STATUS'].map((fact) => ['CONFIRM_FACT', { fact }]),
    ['SET_REQUIREMENTS', { strength: 'HARD', answer: 'NONE_ADDITIONAL', items: [] }], ['SET_REQUIREMENTS', { strength: 'SOFT', answer: 'NONE', items: [] }],
    ['CONFIRM_REVIEW', {}],
  ];
  for (const [kind, payload] of steps) {
    const expected = await draftVersion(uid);
    const [answer] = await as(uid, 'SELECT public.apply_own_matching_preparation_command_v1($1, $2, $3, $4) AS a', [randomUUID(), expected, kind, payload]);
    assert.ok(['APPLIED', 'NOT_READY_FOR_REVIEW'].includes(answer.a.outcome), `fixture ${kind}: ${JSON.stringify(answer.a)}`);
  }
  return draftVersion(uid);
}
const nothingFor = async (uid) => Number((await rows(`SELECT
  (SELECT count(*) FROM ${S}.enrollment_acts WHERE user_id = $1) + (SELECT count(*) FROM ${S}.command_ledger WHERE user_id = $1)
  + (SELECT count(*) FROM public.matching_setup_locks WHERE user_id = $1) + (SELECT count(*) FROM public.matching_participation_events WHERE participant_user_id = $1) AS n`, [uid]))[0].n);

async function verifyBounds(report) {
  await report.isolated('T01 only a loopback database; the explicit confirmation; the approved pins', async () => {
    for (const url of ['postgresql://u:p@db.abcdefghij.supabase.co:5432/postgres', 'postgresql://u:p@10.0.0.5:5432/q', 'postgres://u@example.com/q', 'not a url']) {
      assert.throws(() => assertLoopbackDatabase(url), ConsentInstallRefused, `T01 ${url} is refused`);
    }
    for (const url of ['postgresql://u:p@localhost:5432/q', 'postgresql://u:p@127.0.0.1:55433/q', 'postgresql://u:p@[::1]:5432/q']) assertLoopbackDatabase(url);
    const hosted = spawnSync(process.execPath, [INSTALLER, '--database-url', 'postgresql://u:p@db.abcdefghij.supabase.co:5432/postgres', '--confirm', CONFIRMATION], { encoding: 'utf8' });
    assert.equal(hosted.status, 1, 'T01 the CLI refuses a hosted database');
    assert.match(hosted.stderr, /not a loopback database/u);
    const unconfirmed = spawnSync(process.execPath, [INSTALLER, '--database-url', 'postgresql://u:p@localhost:1/q'], { encoding: 'utf8' });
    assert.equal(unconfirmed.status, 1, 'T01 the CLI refuses without the confirmation');
    assert.match(unconfirmed.stderr, /usage/u);
    assert.deepEqual(MATCHING_CONSENT_TEXTS_V1.map((t) => [t.copyId, t.purpose, t.version]), [
      ['CT-P', 'MATCHING_PARTICIPATION', 'MATCHING_PARTICIPATION_V1'],
      ['CT-C', 'MATCHING_CONTEXT_GRANT', 'MATCHING_CONTEXT_GRANT_V1'],
      ['CT-D', 'PRE_MATCH_DISCLOSURE_AUTHORITY', 'PRE_MATCH_DISCLOSURE_AUTHORITY_V1']]);
  });
}

async function verifyInstall(report) {
  await owner();
  await q('BEGIN');
  try {
    assert.deepEqual(await catalogue(), [], 'the catalogue starts empty');
    const gateBefore = await gate();
    assert.equal(gateBefore.open, false, 'the gate starts closed');

    await report.isolated('T02 a fresh install: the three approved texts exactly; the gate untouched and CLOSED; nothing can be enrolled', async () => {
      const answer = await install();
      assert.deepEqual(answer, { results: MATCHING_CONSENT_TEXTS_V1.map((t) => ({ version: t.version, result: 'INSTALLED' })), gateOpen: false });
      assert.deepEqual(await catalogue(), [C, P, D].map((t) => ({ consent_version: t.version, purpose: t.purpose, text_ar: t.textAr, text_en: t.textEn,
        sha256_ar: t.sha256Ar, sha256_en: t.sha256En, is_current: true })), 'T02 exactly the approved texts, versions and digests');
      // The database's own digest of the bytes it stored equals the approved pin (0165 consent_texts_digest_check).
      assert.deepEqual(await gate(), gateBefore, 'T02 no gate row and no gate event was written');
      const h = await human();
      const v = await view(h);
      assert.equal(v.available, false, 'T02 the view is still unavailable: the gate is closed');
      assert.deepEqual(v.consents, {
        participation: { version: P.version, textAr: P.textAr, textEn: P.textEn },
        contextGrant: { version: C.version, textAr: C.textAr, textEn: C.textEn },
        disclosureAuthority: { version: D.version, textAr: D.textAr, textEn: D.textEn },
      }, 'T02 the reader is shown exactly the approved texts with their versions');
      const draft = await reviewedDraft(h);
      assert.equal((await enroll(h, draft)).outcome, 'NOT_AVAILABLE_NOW', 'T02 the closed gate refuses an ENROLL with the approved versions');
      assert.equal(await nothingFor(h), 0, 'T02 and writes nothing');
    });

    await report.isolated('T03 idempotent: a second run installs nothing', async () => {
      await install();
      const before = await catalogue();
      const again = await install();
      assert.deepEqual(again.results.map((r) => r.result), ['ALREADY_INSTALLED', 'ALREADY_INSTALLED', 'ALREADY_INSTALLED']);
      assert.deepEqual(await catalogue(), before, 'T03 the catalogue is unchanged');
    });

    await report.isolated('T04 an unknown current text, a rewritten version, a superseded version: refused, nothing written', async () => {
      // An unknown current text of the LAST purpose: the two before it are not left installed either.
      await q(`SELECT ${S}.install_consent_text_v1('S6_07_UNKNOWN_DISCLOSURE_V1', 'PRE_MATCH_DISCLOSURE_AUTHORITY', 'نص غير معتمد', 'not an approved text')`);
      await refused(install, /already has a current text \(S6_07_UNKNOWN_DISCLOSURE_V1\)/u);
      assert.deepEqual((await catalogue()).map((r) => r.consent_version), ['S6_07_UNKNOWN_DISCLOSURE_V1'], 'T04 nothing of the approved set was written');
    });
    await report.isolated('T04b the approved version installed with another text is refused', async () => {
      await q(`SELECT ${S}.install_consent_text_v1($1, 'MATCHING_PARTICIPATION', 'نص آخر', 'another text')`, [P.version]);
      await refused(install, /installed with another text/u);
      assert.equal((await catalogue()).length, 1, 'T04b nothing written');
    });
    await report.isolated('T04c the approved version no longer current is refused', async () => {
      await install();
      await q(`SELECT ${S}.install_consent_text_v1('MATCHING_CONTEXT_GRANT_V2_FIXTURE', 'MATCHING_CONTEXT_GRANT', 'نص لاحق', 'a later text')`);
      await refused(install, /no longer current/u);
    });

    await report.isolated('T05 with a FIXTURE gate: the approved versions are what ENROLL names (empty optional profile); a superseded one is CONSENT_OUTDATED', async () => {
      await install();
      await q(`SELECT * FROM ${S}.set_gate_v1('ENABLED', 'SATISFIED', 'verify-consent-texts', 'fixture gate, not a launch decision')`);
      const h = await human();
      const draft = await reviewedDraft(h);
      assert.equal((await view(h)).available, true, 'T05 a fixture gate and the approved texts make the view available');
      assert.equal((await enroll(h, draft, ['MATCHING_PARTICIPATION_V0', C.version, D.version])).outcome, 'CONSENT_OUTDATED', 'T05 any other version is refused');
      assert.equal(await nothingFor(h), 0, 'T05 and writes nothing');
      const ok = await enroll(h, draft);
      assert.equal(ok.outcome, 'ENROLLED', 'T05 the three approved versions enroll');
      const [act] = await rows(`SELECT participation_consent_version p, context_consent_version c, disclosure_consent_version d FROM ${S}.enrollment_acts WHERE user_id = $1`, [h]);
      assert.deepEqual(act, { p: P.version, c: C.version, d: D.version }, 'T05 the act binds the three approved versions');
      const [profile] = await rows(`SELECT count(v.*)::int AS versions, count(f.*)::int AS fields FROM public.introduction_profile_versions v
        LEFT JOIN public.introduction_profile_field_values f ON f.profile_version_id = v.id WHERE v.owner_user_id = $1`, [h]);
      assert.equal(profile.versions, 1, 'T05 one real Introduction Profile version');
      assert.equal(profile.fields, 0, 'T05 no optional field was required (D-CP1-1 = B)');
    });
  } finally {
    await q('ROLLBACK');
  }
  assert.deepEqual(await catalogue(), [], 'the catalogue is left empty');
  assert.equal((await gate()).open, false, 'the gate is left closed');
}

await runVerifier('consent-texts', async (stage) => {
  await rt.client.connect();
  const report = createScenarioReport('consent-texts', { query: q, restore: () => owner() });
  stage('bounds');
  await owner();
  await q('BEGIN');
  try { await verifyBounds(report); } finally { await q('ROLLBACK'); }
  stage('install');
  await verifyInstall(report);
  stage('report');
  report.print();
  report.assertAllPassed();
}, () => rt.client.end().catch(() => undefined));
