// S6-03 - static contract for migrations 0156 / 0157 (Controlled Amendment CW2-06B) and their TypeScript vocabulary.
//
// The real-PostgreSQL proof is verify-migration-0156.mjs and verify-migration-0157.mjs; this file pins what can be
// read from the source alone: forward-only, no grant, no suspended command, no 0114 or 0120 decision core replaced,
// the encoding hygiene of the privacy floor, and the vocabulary the TypeScript module repeats.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const M0156 = read('../migrations/0156_matching_confirmed_facts_eligibility_neutral_disclosure_v1.sql');
const M0157 = read('../migrations/0157_matching_reproposal_admission_orchestration_v1.sql');
const M0154 = read('../migrations/0154_matching_onboarding_preparation_v1.sql');
const M0114 = read('../migrations/0114_matching_mutual_match_commit_transaction_v1.sql');
const M0116 = read('../migrations/0116_introduction_terminal_lifecycle_v1.sql');
const M0117 = read('../migrations/0117_post_introduction_matching_reactivation_v1.sql');
const TYPES = read('../../apps/api/src/connected-worlds/matching/matching-proposal-pipeline.types.ts');
const PACKAGE = JSON.parse(read('../../package.json'));
const CI = read('../../.github/workflows/api-ci.yml');

const SUSPENDED = ['activate_matching_participation', 'resume_matching_participation', 'grant_matching_context',
  'set_introduction_profile', 'set_matching_requirements', 'grant_pre_match_disclosure_authority'];
const created = (text) => [...text.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.([a-z0-9_]+)\(/gu)].map((m) => m[1]);

test('both migrations are forward-only, transactional S6-03 slices that grant nothing', () => {
  for (const [name, text] of [['0156', M0156], ['0157', M0157]]) {
    assert.match(text, /^-- S6-03 - /u, `${name} is an S6-03 migration, not an I-07A / I-07C / I-07D one`);
    assert.match(text, /\nBEGIN;\n/u, `${name} opens one transaction`);
    assert.match(text, /\nCOMMIT;\n$/u, `${name} commits it last`);
    assert.doesNotMatch(text, /^\s*GRANT\b/imu, `${name} grants nothing`);
    assert.doesNotMatch(text, /ALTER\s+DEFAULT\s+PRIVILEGES|ON\s+ALL\s+FUNCTIONS/iu, `${name} touches no default or bulk privilege`);
    // The only place a suspended name may appear is the terminal self-assertion that refuses any function naming one.
    const outsideTheRefusal = text.split('\n').filter((line) => !line.includes("AND p.prosrc ~ '(activate_matching_participation|")).join('\n');
    for (const fn of SUSPENDED) assert.ok(!outsideTheRefusal.includes(fn), `${name} never names the suspended ${fn}`);
    assert.doesNotMatch(text, /\b(UPDATE|DELETE\s+FROM)\s+introductions_preparation_private\./u, `${name} writes nothing in the 0154 schema`);
    assert.doesNotMatch(text, /REFERENCES\s+introductions_preparation_private\./u, `${name} binds no foreign key into the 0154 schema`);
  }
});

test('no 0114 function and no 0116 / 0117 core is replaced, nor any 0120 delivery or decision core (R4-B)', () => {
  const replaced = [...created(M0156), ...created(M0157)];
  for (const name of [...created(M0114), ...created(M0116), ...created(M0117),
    'offer_matching_proposal_to_first_core_v1', 'forward_matching_proposal_to_second_core_v1',
    'decline_matching_proposal_as_first_core_v1', 'decline_matching_proposal_as_second_core_v1',
    'withdraw_matching_proposal_core_v1', 'expire_matching_proposal_core_v1', 'revalidate_matching_proposal_core_v1',
    'append_matching_proposal_transition_v1']) {
    assert.ok(!replaced.includes(name), `S6-03 does not replace ${name}`);
  }
  assert.deepEqual(created(M0157).filter((n) => ['prepare_matching_proposal_core_v1', 'discover_matching_candidates_core_v1'].includes(n)).sort(),
    ['discover_matching_candidates_core_v1', 'prepare_matching_proposal_core_v1'], 'preparation and discovery are replaced once, in 0157');
  assert.ok(!created(M0156).includes('prepare_matching_proposal_core_v1'), 'and not in 0156');
});

test('encoding hygiene: non-ASCII appears only in comments and the one reused S6-01 first-name shape', () => {
  for (const [name, text] of [['0156', M0156], ['0157', M0157]]) {
    for (const [i, line] of text.split('\n').entries()) {
      if (!/[^\x00-\x7f]/u.test(line) || /^\s*--/u.test(line)) continue;
      assert.ok(name === '0156' && line.includes('first_name ~ '), `${name}:${i + 1} carries non-ASCII outside a comment`);
    }
  }
  const shape = (text) => text.match(/AND first_name ~ ('[^\n]*')\)\),/u)[1];
  assert.equal(shape(M0156), shape(M0154), 'the confirmed first-name shape is the exact S6-01 expression');
  assert.match(M0156, /chr\(1632\) \|\| '-' \|\| chr\(1641\)/u, 'the Arabic-Indic digits are built from code points');
});

test('the privacy floor is delta-only: each classifier keeps its 0111 rule and ORs in its delta', () => {
  for (const name of ['contact_route', 'hidden_provenance', 'quoted_span', 'visible_ranking', 'sensitive_fact']) {
    assert.ok(M0156.includes(`CREATE FUNCTION public.matching_text_carries_${name}_delta_v1(p_text text)`), `the ${name} delta exists`);
    assert.ok(M0156.includes(`      OR public.matching_text_carries_${name}_delta_v1(p_text);`), `the ${name} classifier ORs it in`);
  }
  assert.equal((M0156.match(/_floor_check\n\s+CHECK \(NOT public\.matching_text_carries_[a-z_]+_delta_v1\([a-z_]+\)\)/gu) ?? []).length, 13,
    'thirteen delta CHECKs, each exactly NOT its delta classifier');
});

test('the TypeScript vocabulary repeats the SQL exactly', () => {
  const list = (name) => [...TYPES.match(new RegExp(`export const ${name} = \\[([^\\]]*)\\]`, 'u'))[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]);
  assert.deepEqual(list('S6_03_PROPOSAL_PRIVATE_REASONS'), ['MATCHING_FACT_VERSION_CHANGED']);
  assert.ok(M0156.includes("'COMPETING_MATCH_COMMITTED', 'MATCHING_FACT_VERSION_CHANGED'));"), 'the reason is the 0156 DROP / ADD addition');
  const block = M0157.match(/t\.resulting_state IN \(([^)]*)\)/u)[1];
  assert.deepEqual([...block.matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]), list('REPROPOSAL_BLOCKING_STATES'),
    'the blocking states are exactly the block resolver\'s');
  const admissions = [...M0157.matchAll(/RETURN QUERY SELECT '([A-Z_]+)'::text;/gu)].map((m) => m[1]);
  assert.deepEqual([...new Set(admissions)].filter((a) => list('PAIR_ADMISSION_ANSWERS').includes(a)).sort(),
    list('PAIR_ADMISSION_ANSWERS').sort(), 'every admission answer the TypeScript names is one the SQL returns');
  assert.ok(M0156.includes("pair_rule text NOT NULL DEFAULT 'OPPOSITE_SEX_CONFIRMED_V1'") && TYPES.includes("'OPPOSITE_SEX_CONFIRMED_V1'"));
  for (const key of ['age_range_v1', 'marital_status_v1', 'area_v1']) {
    assert.ok(M0156.includes(`item.requirement_key = '${key}'`) && TYPES.includes(`'${key}'`), `the hard key ${key} is shared`);
  }
  assert.doesNotMatch(TYPES, /^import /mu, 'the module imports nothing: no runtime, no router');
});

test('both verifiers are wired into the toolchain and API CI', () => {
  assert.equal(PACKAGE.scripts['verify:matching-confirmed-facts-eligibility:integration'],
    'node --env-file-if-exists=.env database/verify-migration-0156.mjs');
  assert.equal(PACKAGE.scripts['verify:matching-reproposal-admission:integration'],
    'node --env-file-if-exists=.env database/verify-migration-0157.mjs');
  const s602 = CI.indexOf('run: npm run verify:introduction-privacy-end-boundary:integration');
  const v156 = CI.indexOf('run: npm run verify:matching-confirmed-facts-eligibility:integration');
  const v157 = CI.indexOf('run: npm run verify:matching-reproposal-admission:integration');
  assert.ok(s602 > 0 && v156 > s602 && v157 > v156, 'API CI runs them after S6-02, 0156 first');
});
