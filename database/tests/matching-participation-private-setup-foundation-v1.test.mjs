// I-07A - Matching participation, private authority and versioned setup
// foundation v1: secret-free structural contract over migration 0108.
//
// Prose comments explain WHY a construct is forbidden and therefore name it;
// every "must not contain" assertion runs against executable SQL only, and the
// vocabulary assertions run against the DDL alone (the terminal self-assertion
// block names those words precisely in order to refuse them at deploy time).
// Live semantics - rejections, ACL behaviour, trigger behaviour, rollback - are
// proven by the real PostgreSQL verifier this file also pins into the toolchain
// and CI.
//
// The load-bearing cross-check is the last test: the frozen CW2-06 vocabularies
// exist in TWO places - a PostgreSQL CHECK constraint and a TypeScript const
// array - and nothing but this file would notice if one of them drifted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION_NAME = '0108_matching_participation_private_setup_foundation_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0108.mjs');
const support = read('../matching-setup-verifier-support.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');
const vocabulary = read('../../apps/api/src/connected-worlds/matching/matching-setup.types.ts');
const kernelAuthority = read('../../apps/api/src/connected-worlds/kernel/authority.types.ts');

const stripComments = (sql) => sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const executableSql = stripComments(migration);
const executableSlice = (from, to) => {
  const start = migration.indexOf(from);
  assert.ok(start >= 0, `migration contains "${from}"`);
  const end = to === undefined ? migration.length : migration.indexOf(to, start);
  assert.ok(end > start, `migration contains "${to}" after "${from}"`);
  return stripComments(migration.slice(start, end));
};
// The CREATION DDL alone: no COMMENT ON string literal and no terminal
// self-assertion, both of which NAME the vocabulary they refuse and would
// otherwise make every `must not contain` assertion below match itself.
const ddl = executableSlice('BEGIN;', '-- 7. IMMUTABILITY AND TRUTH TRIGGERS.')
  .replace(/COMMENT ON TABLE[\s\S]*?';\n/gu, '');
const selfAssertion = executableSlice('-- 9. TERMINAL SELF-ASSERTIONS.', 'COMMIT;');
/** Identifier-aware token search: `_` is a separator, so `world_id` never matches `worldly`. */
const token = (words) => new RegExp(`(?<![A-Za-z0-9])(?:${words})(?![A-Za-z0-9])`, 'iu');
/** Every column of one CREATE TABLE block, as [name, type]. */
const columnsOf = (table) => [...table.matchAll(/^ {4}(\w+) (uuid|text|timestamptz)\b/gmu)].map((m) => [m[1], m[2]]);
/** The literals of one IN-list CHECK constraint. */
const vocabularyOf = (constraint) => {
  const match = executableSql.match(new RegExp(`CONSTRAINT ${constraint}\\s+CHECK \\([^)]*IN\\s*\\(([^)]+)\\)\\)`, 'u'));
  assert.ok(match, `${constraint} exists as an IN-list CHECK`);
  return [...match[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]);
};
/** The literals of one TypeScript `as const` array. */
const typescriptVocabularyOf = (name) => {
  const match = vocabulary.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`, 'u'));
  assert.ok(match, `the vocabulary module exports ${name}`);
  return [...match[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]);
};

const TABLES = [
  'introduction_profile_field_values', 'introduction_profile_state', 'introduction_profile_versions',
  'matching_context_consent_events', 'matching_context_grants', 'matching_participation_events',
  'matching_participation_state', 'matching_requirement_items', 'matching_requirement_state',
  'matching_requirement_versions', 'matching_setup_locks', 'pre_match_disclosure_authorities',
  'pre_match_disclosure_authority_events', 'pre_match_disclosure_authority_fields',
];

test('0108 exists, is the forward migration after 0107, and edits no historical migration', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME), 'migration 0108 exists');
  assert.equal(migrations.filter((name) => name.startsWith('0108_')).length, 1, 'exactly one migration carries 0108');
  assert.equal(migrations.indexOf(MIGRATION_NAME),
    migrations.indexOf('0107_replay_distribution_current_eligibility_reconciliation_v1.sql') + 1,
    '0108 orders directly after the reviewed 0107 tip');
  assert.match(migration, /^-- I-07A/u);
  assert.match(migration, /\nBEGIN;\n/u);
  assert.match(migration, /COMMIT;\n$/u);
  // Forward-only: nothing existing is dropped, altered, rewritten or renumbered.
  assert.doesNotMatch(executableSql, /DROP (?:TABLE|FUNCTION|TRIGGER|CONSTRAINT|POLICY|INDEX|COLUMN)/iu);
  assert.doesNotMatch(executableSql, /(?:INSERT INTO|UPDATE|DELETE FROM|TRUNCATE) public\./iu,
    'the migration performs no data write');
  // No predecessor relation is restructured; public.users is a foreign-key parent only.
  const altered = [...executableSql.matchAll(/ALTER TABLE public\.(\w+)/gu)].map((m) => m[1]);
  assert.deepEqual([...new Set(altered)].sort(), [], 'ALTER TABLE is issued only through the posture loop, by name');
  assert.doesNotMatch(executableSql, /REFERENCES public\.(?!users|matching_|introduction_|pre_match_)\w+/u,
    '0108 references only public.users and its own relations');
});

test('every identifier 0108 creates fits PostgreSQL 63-byte limit, so nothing is silently truncated', () => {
  const identifiers = [...executableSql.matchAll(
    /(?:CREATE TABLE public\.|CONSTRAINT |CREATE (?:UNIQUE )?INDEX |CREATE TRIGGER |CREATE FUNCTION public\.)(\w+)/gu)]
    .map((m) => m[1]);
  assert.ok(identifiers.length >= 80, `the migration names its objects explicitly, found ${identifiers.length}`);
  for (const identifier of identifiers) {
    assert.ok(Buffer.byteLength(identifier) <= 63,
      `${identifier} (${Buffer.byteLength(identifier)} bytes) would be truncated by PostgreSQL`);
  }
  assert.equal(new Set(identifiers).size, identifiers.length, 'every created identifier is unique');
});

test('0108 introduces exactly the fourteen private Matching relations and no candidate, proposal or Introduction state', () => {
  const tables = [...executableSql.matchAll(/CREATE TABLE public\.(\w+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(tables, TABLES);
  assert.doesNotMatch(executableSql,
    /public\.(?:\w*candidate\w*|\w*proposal\w*|\w*pair_key\w*|\w*mutual_match\w*|\w*match_commit\w*|\w*introduction_slot\w*|\w*introduction_record\w*)\b/iu,
    'no candidate, proposal, PAIR_KEY, Mutual Match, match commit or Introduction lifecycle relation');
  assert.doesNotMatch(executableSql, /CREATE (?:POLICY|VIEW|MATERIALIZED VIEW|EXTENSION|TYPE)|EXCLUDE USING/iu,
    'no policy, view, extension or enum type is introduced');
  // Only trigger functions: 0108 is persistence, 0109 is the authority.
  const functions = [...executableSql.matchAll(/CREATE FUNCTION public\.(\w+)\(\)\nRETURNS (\w+)/gu)];
  assert.equal(functions.length, 6, 'exactly six functions exist');
  for (const [, , returns] of functions) assert.equal(returns, 'trigger', 'and every one of them is a trigger function');
  assert.doesNotMatch(executableSql, /SECURITY DEFINER/u, '0108 creates no callable boundary at all');
});

test('the participation act is immutable history with a frozen vocabulary and three coherence rules', () => {
  const table = executableSlice('CREATE TABLE public.matching_participation_events', 'CREATE UNIQUE INDEX matching_participation_events_prior_event_idx');
  assert.deepEqual(columnsOf(table), [
    ['id', 'uuid'],
    ['participant_user_id', 'uuid'],
    ['participation_act', 'text'],
    ['resulting_state', 'text'],
    ['resulting_pause_reason', 'text'],
    ['activation_entry_channel', 'text'],
    ['prior_event_id', 'uuid'],
    ['occurred_at', 'timestamptz'],
  ]);
  assert.match(table, /occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP/u,
    'the committed instant is the database clock, never a caller value');
  // The row id IS the command id, so the primary key is the durable idempotency record.
  assert.match(table, /^ {4}id uuid PRIMARY KEY,$/mu);
  // The exact-row identity a current pointer binds to.
  assert.match(table, /CONSTRAINT matching_participation_events_participant_identity_key\s+UNIQUE \(id, participant_user_id\)/u);
  assert.match(table, /FOREIGN KEY \(prior_event_id, participant_user_id\)\s+REFERENCES public\.matching_participation_events \(id, participant_user_id\) ON DELETE RESTRICT/u);
  // The three coherence rules, each stated once and structurally.
  assert.match(executableSql, /CONSTRAINT matching_participation_events_pause_coherence_check\s+CHECK \(\(resulting_pause_reason IS NOT NULL\) = \(resulting_state = 'PAUSED'\)\)/u);
  assert.match(executableSql, /CONSTRAINT matching_participation_events_entry_coherence_check\s+CHECK \(\(activation_entry_channel IS NOT NULL\) = \(participation_act = 'ACTIVATE'\)\)/u);
  assert.match(executableSql, /CONSTRAINT matching_participation_events_act_state_check\s+CHECK \(resulting_state = CASE participation_act/u);
  // An act is superseded at most once: the history is a chain, never a tree.
  assert.match(executableSql, /CREATE UNIQUE INDEX matching_participation_events_prior_event_idx\s+ON public\.matching_participation_events \(prior_event_id\)\s+WHERE prior_event_id IS NOT NULL;/u);
});

test('the current participation pointer duplicates no state and is bound to one exact act of one exact human', () => {
  const table = executableSlice('CREATE TABLE public.matching_participation_state', 'COMMENT ON TABLE public.matching_participation_state');
  assert.deepEqual(columnsOf(table), [
    ['participant_user_id', 'uuid'],
    ['current_event_id', 'uuid'],
    ['updated_at', 'timestamptz'],
  ], 'the pointer stores an identity, never a second copy of the state it names');
  assert.match(table, /participant_user_id uuid PRIMARY KEY/u, 'exactly one current pointer per human');
  assert.match(table, /FOREIGN KEY \(current_event_id, participant_user_id\)\s+REFERENCES public\.matching_participation_events \(id, participant_user_id\) ON DELETE RESTRICT/u,
    'the pointer names an exact act OF THIS EXACT HUMAN: one row, not two independent references');
  const pointerColumns = columnsOf(table).map(([name]) => name);
  for (const forbidden of ['participation_state', 'resulting_state', 'pause_reason', 'latest', 'most_recent']) {
    assert.ok(!pointerColumns.includes(forbidden),
      `there is no second copy of the state and no latest-timestamp-wins column: ${forbidden}`);
  }
});

test('the Matching Context Grant is capability-scoped, worldless and fixed by table identity', () => {
  const table = executableSlice('CREATE TABLE public.matching_context_grants', 'CREATE UNIQUE INDEX matching_context_grants_one_active_idx');
  assert.deepEqual(columnsOf(table), [
    ['id', 'uuid'], ['grantor_user_id', 'uuid'], ['status', 'text'],
    ['granted_at', 'timestamptz'], ['revoked_at', 'timestamptz'],
  ]);
  assert.deepEqual(vocabularyOf('matching_context_grants_status_check'), ['ACTIVE', 'REVOKED']);
  assert.match(executableSql, /CREATE UNIQUE INDEX matching_context_grants_one_active_idx\s+ON public\.matching_context_grants \(grantor_user_id\)\s+WHERE status = 'ACTIVE';/u,
    'exactly one CURRENT ACTIVE grant per human; revoked history coexists freely');
  // Matching Context Admission has NO target World, so there is no world column
  // anywhere in the migration, and no Shared grant table is widened.
  assert.doesNotMatch(ddl, token('world_id|target_world_id|world_type|target_type|target_kind'),
    'Matching capability scope is worldless: no relation carries a World target');
  assert.doesNotMatch(ddl, /shared_world_standing_context/u,
    'the I-02B Shared grant family is neither reused nor generalized into Matching');
  // REASON_FROM_PRIVATE_CONTEXT != DISCLOSE_PRIVATE_FACT. The scan is over
  // COLUMN NAMES rather than over the DDL text, because the disclosure-authority
  // family is legitimately NAMED for the authority it records and a text scan
  // would refuse the very tables this slice exists to create.
  const columns = [...ddl.matchAll(/CREATE TABLE public\.(\w+) \(\n([\s\S]*?)\n\);/gu)]
    .flatMap(([, table, body]) => columnsOf(body).map(([column]) => [table, column]));
  assert.equal(columns.length, 60, 'every column of every Matching relation is checked');
  for (const [table, column] of columns) {
    assert.doesNotMatch(column,
      token('scope|purpose|action|permission|permissions|disclos\\w*|quote|copy|publish\\w*|share|export|provenance|transfer|attribution|admin|actor|world\\w*|ttl|expir\\w*'),
      `${table}.${column} would make grant semantics data rather than table identity`);
  }
});

test('the Introduction Profile and requirement families are immutable versions with one current identity each', () => {
  for (const [versions, state, prior, current] of [
    ['introduction_profile_versions', 'introduction_profile_state', 'prior_profile_version_id', 'current_profile_version_id'],
    ['matching_requirement_versions', 'matching_requirement_state', 'prior_requirement_version_id', 'current_requirement_version_id'],
  ]) {
    assert.match(executableSql, new RegExp(`CREATE TABLE public\\.${versions} \\(\\n {4}id uuid PRIMARY KEY,\\n {4}owner_user_id uuid NOT NULL,\\n {4}${prior} uuid,`, 'u'));
    assert.match(executableSql, new RegExp(`CONSTRAINT ${versions}_owner_identity_key UNIQUE \\(id, owner_user_id\\)`, 'u'));
    assert.match(executableSql, new RegExp(`CREATE UNIQUE INDEX ${versions}_prior_version_idx\\s+ON public\\.${versions} \\(${prior}\\)\\s+WHERE ${prior} IS NOT NULL;`, 'u'),
      `a ${versions} identity is superseded at most once`);
    assert.match(executableSql, new RegExp(`CREATE TABLE public\\.${state} \\(\\n {4}owner_user_id uuid PRIMARY KEY,\\n {4}${current} uuid NOT NULL,`, 'u'),
      `exactly one current ${versions} identity per human`);
    assert.match(executableSql, new RegExp(`FOREIGN KEY \\(${current}, owner_user_id\\)\\s+REFERENCES public\\.${versions} \\(id, owner_user_id\\) ON DELETE RESTRICT`, 'u'));
  }
});

test('a profile or requirement KEY is bounded and can never name a contact route, a media handle or an identity document', () => {
  const BAN_TOKENS = ['phone', 'mobile', 'email', 'whatsapp', 'telegram', 'instagram', 'snapchat', 'tiktok',
    'facebook', 'twitter', 'linkedin', 'handle', 'username', 'contact', 'address', 'street', 'geo', 'gps',
    'latitude', 'longitude', 'coordinates', 'url', 'uri', 'link', 'photo', 'image', 'avatar', 'selfie',
    'video', 'audio', 'passport', 'ssn', 'nid', 'kyc', 'password', 'token', 'id'];
  for (const [table, key] of [['introduction_profile_field_values', 'field_key'],
    ['matching_requirement_items', 'requirement_key']]) {
    assert.match(executableSql, new RegExp(`CHECK \\(${key} ~ '\\^\\[a-z\\]\\[a-z0-9_\\]\\{2,47\\}\\$'\\)`, 'u'),
      `${table}.${key} is a bounded lower-case identifier`);
    const ban = executableSql.match(new RegExp(`CHECK \\(${key} !~ \\(([\\s\\S]*?)\\)\\)`, 'u'));
    assert.ok(ban, `${table}.${key} carries the contact-route ban`);
    const tokens = [...ban[1].matchAll(/([a-z]+)(?=\||\)|')/gu)].map((m) => m[1]);
    for (const banned of BAN_TOKENS) {
      assert.ok(tokens.includes(banned), `${table}.${key} must refuse the token ${banned}`);
    }
    // The ban is token-delimited, so an ordinary descriptive key still works.
    assert.match(ban[1], /\(\^\|_\)/u, `${table}.${key} bans TOKENS, not substrings`);
    assert.match(ban[1], /\(_\|\$\)/u);
  }
  // Values are structurally bounded, and there is no JSON or array anywhere.
  assert.match(executableSql, /CHECK \(btrim\(field_value\) <> '' AND length\(field_value\) <= 4096\)/u);
  assert.match(executableSql, /CHECK \(btrim\(requirement_value\) <> '' AND length\(requirement_value\) <= 4096\)/u);
  assert.doesNotMatch(ddl, /\bjsonb?\b|\btext\[\]|\buuid\[\]/u,
    'no JSON and no array column: the field representation is bounded, not a payload channel');
});

test('the requirement item carries the frozen hard / soft distinction and nothing that could score or rank', () => {
  const table = executableSlice('CREATE TABLE public.matching_requirement_items', 'COMMENT ON TABLE public.matching_requirement_items');
  assert.deepEqual(columnsOf(table), [
    ['requirement_version_id', 'uuid'], ['requirement_key', 'text'],
    ['requirement_strength', 'text'], ['requirement_value', 'text'],
  ], 'a requirement item is a key, a strength and a value');
  assert.deepEqual(vocabularyOf('matching_requirement_items_strength_check'), ['HARD_DEALBREAKER', 'SOFT_PREFERENCE']);
  assert.doesNotMatch(ddl, token('score|rank|ranking|weight|priority|percent|percentage|compatibility'),
    'I-07A stores self-declared requirement truth and evaluates no candidate');
  assert.doesNotMatch(ddl, /'(?:PASS|FAIL|UNKNOWN)'/u,
    'candidate-side evaluation state belongs to I-07B and has no literal here');
});

test('the Pre-Match Disclosure Authority binds ONE exact profile version of its OWN human, field by field', () => {
  const table = executableSlice('CREATE TABLE public.pre_match_disclosure_authorities', 'CREATE UNIQUE INDEX pre_match_disclosure_authorities_one_active_idx');
  assert.deepEqual(columnsOf(table), [
    ['id', 'uuid'], ['grantor_user_id', 'uuid'], ['introduction_profile_version_id', 'uuid'],
    ['status', 'text'], ['granted_at', 'timestamptz'], ['revoked_at', 'timestamptz'],
  ]);
  // The authority can only ever bind the GRANTOR'S OWN version.
  assert.match(table, /FOREIGN KEY \(introduction_profile_version_id, grantor_user_id\)\s+REFERENCES public\.introduction_profile_versions \(id, owner_user_id\) ON DELETE RESTRICT/u);
  // Each approved field belongs to THIS authority AND is a real field of THAT
  // EXACT version: two composite references, so a V1 authority cannot name a V2
  // field even by accident.
  const fields = executableSlice('CREATE TABLE public.pre_match_disclosure_authority_fields', 'CREATE INDEX pre_match_disclosure_authority_fields_version_idx');
  assert.deepEqual(columnsOf(fields), [
    ['authority_id', 'uuid'], ['introduction_profile_version_id', 'uuid'], ['field_key', 'text'],
  ], 'an approved field carries no value, no recipient and no proposal');
  assert.match(fields, /FOREIGN KEY \(authority_id, introduction_profile_version_id\)\s+REFERENCES public\.pre_match_disclosure_authorities \(id, introduction_profile_version_id\) ON DELETE RESTRICT/u);
  assert.match(fields, /FOREIGN KEY \(introduction_profile_version_id, field_key\)\s+REFERENCES public\.introduction_profile_field_values \(profile_version_id, field_key\) ON DELETE RESTRICT/u);
  // No proposal exists in I-07A, so no identifier for one is invented.
  assert.doesNotMatch(ddl, token('recipient|recipient_user_id|proposal_id|pair_id|candidate_id|match_id|conclusion'),
    'no proposal, recipient, pair or candidate identifier exists in the authority substrate');
});

test('the consent and authority histories are append-only, exact-human and coherent', () => {
  for (const [events, subject, prior, parent, key] of [
    ['matching_context_consent_events', 'subject_grant_id', 'prior_grant_id', 'matching_context_grants', 'grantor_user_id'],
    ['pre_match_disclosure_authority_events', 'subject_authority_id', 'prior_authority_id', 'pre_match_disclosure_authorities', 'grantor_user_id'],
  ]) {
    assert.match(executableSql, new RegExp(`CREATE TABLE public\\.${events} \\(\\n {4}id uuid PRIMARY KEY,`, 'u'),
      `${events}: the row id IS the command id, so the primary key is the durable idempotency record`);
    assert.match(executableSql, new RegExp(`FOREIGN KEY \\(${subject}, ${key}\\)\\s+REFERENCES public\\.${parent} \\(id, ${key}\\) ON DELETE RESTRICT`, 'u'),
      `${events}: a consent act can only ever concern the actor's OWN authority`);
    assert.match(executableSql, new RegExp(`FOREIGN KEY \\(${prior}, ${key}\\)\\s+REFERENCES public\\.${parent} \\(id, ${key}\\) ON DELETE RESTRICT`, 'u'));
    assert.match(executableSql, new RegExp(`WHERE event_type IN \\('GRANTED', 'RECONFIRMED'\\)`, 'u'));
    assert.match(executableSql, new RegExp(`CREATE UNIQUE INDEX ${events}_revoke\\w*_idx\\s+ON public\\.${events} \\(${subject}\\)\\s+WHERE event_type = 'REVOKED';`, 'u'));
  }
  assert.deepEqual(vocabularyOf('matching_context_consent_events_event_type_check'), ['GRANTED', 'RECONFIRMED', 'REVOKED']);
  assert.deepEqual(vocabularyOf('pre_match_disclosure_authority_events_event_type_check'), ['GRANTED', 'RECONFIRMED', 'REVOKED']);
});

test('every relation is append-only or truth-guarded, and nothing cascades', () => {
  const immutable = ['matching_participation_events', 'matching_context_consent_events',
    'introduction_profile_versions', 'introduction_profile_field_values', 'matching_requirement_versions',
    'matching_requirement_items', 'pre_match_disclosure_authority_fields', 'pre_match_disclosure_authority_events'];
  for (const table of immutable) {
    assert.match(executableSql, new RegExp(`CREATE TRIGGER ${table}_immutable\\s+BEFORE UPDATE OR DELETE ON public\\.${table}\\s+FOR EACH ROW EXECUTE FUNCTION public\\.reject_matching_setup_mutation_v1\\(\\);`, 'u'),
      `${table} is append-only for every role including the table owner`);
  }
  for (const [table, trigger, events] of [
    ['matching_context_grants', 'matching_context_grants_status_truth', 'UPDATE OR DELETE'],
    ['pre_match_disclosure_authorities', 'pre_match_disclosure_authorities_status_truth', 'UPDATE OR DELETE'],
    ['matching_participation_state', 'matching_participation_state_truth', 'INSERT OR UPDATE OR DELETE'],
    ['introduction_profile_state', 'introduction_profile_state_truth', 'INSERT OR UPDATE OR DELETE'],
    ['matching_requirement_state', 'matching_requirement_state_truth', 'INSERT OR UPDATE OR DELETE'],
    ['matching_setup_locks', 'matching_setup_locks_truth', 'UPDATE OR DELETE'],
  ]) {
    assert.match(executableSql, new RegExp(`CREATE TRIGGER ${trigger}\\s+BEFORE ${events} ON public\\.${table}`, 'u'),
      `${table} carries its truth guard`);
  }
  // A one-way authority transition, compared over the WHOLE row so a later
  // reviewed column is frozen by the same rule without editing the function.
  assert.match(executableSql, /MATCHING_AUTHORITY_TRANSITION_INVALID/u);
  assert.match(executableSql, /o\.key NOT IN \('status', 'revoked_at'\)/u);
  // Forward-only pointer movement, enforced against the table owner too.
  assert.match(executableSql, /MATCHING_CURRENT_STATE_NOT_A_FORWARD_MOVE/u);
  assert.doesNotMatch(executableSql, /ON DELETE (?:CASCADE|SET NULL|SET DEFAULT)/iu, 'Matching authority truth never cascades away');
  assert.equal((executableSql.match(/ON DELETE RESTRICT/gu) ?? []).length,
    (executableSql.match(/FOREIGN KEY/gu) ?? []).length, 'every foreign key is restrictive');
});

test('every relation is private operational state: postgres-owned, RLS-enabled, policy-free and revoked', () => {
  const posture = executableSlice('-- 8. DENY-BY-DEFAULT ACCESS POSTURE.', '-- 9. TERMINAL SELF-ASSERTIONS.');
  for (const table of TABLES) {
    assert.ok(posture.includes(`'public.${table}'`), `${table} is in the deny-by-default posture loop`);
  }
  assert.match(posture, /ALTER TABLE %s OWNER TO postgres/u);
  assert.match(posture, /ALTER TABLE %s ENABLE ROW LEVEL SECURITY/u);
  assert.match(posture, /REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated/u);
  assert.match(posture, /REVOKE ALL ON TABLE %s FROM service_role/u);
  // The trigger functions are revoked too: a role that could call one directly
  // could forge a trigger context.
  for (const fn of ['reject_matching_setup_mutation_v1', 'matching_authority_status_truth_v1',
    'matching_participation_state_truth_v1', 'introduction_profile_state_truth_v1',
    'matching_requirement_state_truth_v1', 'matching_setup_lock_truth_v1']) {
    assert.ok(posture.includes(`'public.${fn}()'`), `${fn} is revoked from every application role`);
  }
  assert.doesNotMatch(executableSql, /\bGRANT\b/u, 'no GRANT of any kind: 0108 opens no path at all');
  assert.doesNotMatch(executableSql, /CREATE POLICY|DISABLE ROW LEVEL SECURITY|FORCE ROW LEVEL SECURITY/iu);
});

test('the terminal self-assertion refuses a reachable, generic, world-scoped or candidate-shaped substrate', () => {
  assert.match(selfAssertion, /IF NOT rls_enabled THEN\s+RAISE EXCEPTION 'I-07A: row level security must be enabled/u);
  assert.match(selfAssertion, /FROM pg_policy p WHERE p\.polrelid = qualified::regclass/u);
  assert.match(selfAssertion, /privilege\.grantee = 0\s*\) THEN\s+RAISE EXCEPTION 'I-07A: PUBLIC must hold no privilege/u);
  assert.match(selfAssertion, /FOREACH target_role IN ARRAY ARRAY\['anon','authenticated','service_role'\]/u);
  assert.match(selfAssertion, /FOREACH target_privilege IN ARRAY ARRAY\['SELECT','INSERT','UPDATE','DELETE'\]/u);
  assert.match(selfAssertion, /c\.column_name ~\* '\(scope\|permission\|privilege\|admin\|actor\|on_behalf\|impersonat\|service'/u);
  assert.match(selfAssertion, /c\.data_type IN \('json','jsonb','ARRAY'\)/u);
  assert.match(selfAssertion, /RAISE EXCEPTION 'I-07A: the per-human serialization row carries a human and a birth instant, and nothing else'/u);
  // The candidate / proposal scan is deliberately bounded to the Matching
  // namespace, because reviewed predecessors carry those words legitimately.
  assert.match(selfAssertion, /c\.relname ~\* '\^\(matching_\|introduction_\|pre_match_\)'/u);
  assert.match(selfAssertion, /c\.relname ~\* '\(candidate\|proposal\|pair\|mutual\|commit\|slot\|snapshot\|eligibility\|compatib\|leaderboard\|rank\|score\)'/u);
  for (const predecessor of ['question_candidates', 'conversation_reference_resolution_candidates',
    'shared_world_governance_proposals', 'hypothesis_subject_grounding_proposals']) {
    assert.doesNotMatch(predecessor, /^(matching_|introduction_|pre_match_)/u,
      `the namespace-bounded scan cannot reach the reviewed predecessor ${predecessor}`);
  }
  assert.match(selfAssertion, /RAISE EXCEPTION 'I-07A: migration 0108 creates no Matching command or read boundary; that is 0109/u);
});

test('the frozen CW2-06 vocabularies are identical in the database and in the TypeScript contract', () => {
  // The load-bearing cross-check. Each vocabulary lives in a PostgreSQL CHECK
  // and in a TypeScript const array, and nothing but this assertion would notice
  // if one of them drifted from the other.
  assert.deepEqual(vocabularyOf('matching_participation_events_state_check'),
    typescriptVocabularyOf('MATCHING_PARTICIPATION_STATES'));
  assert.deepEqual(vocabularyOf('matching_participation_events_pause_reason_check'),
    typescriptVocabularyOf('MATCHING_PAUSE_REASONS'));
  assert.deepEqual(vocabularyOf('matching_participation_events_entry_channel_check'),
    typescriptVocabularyOf('MATCHING_ACTIVATION_ENTRY_CHANNELS'));
  assert.deepEqual(vocabularyOf('matching_participation_events_act_check'),
    typescriptVocabularyOf('MATCHING_PARTICIPATION_ACTS'));
  assert.deepEqual(vocabularyOf('matching_requirement_items_strength_check'),
    typescriptVocabularyOf('MATCHING_REQUIREMENT_STRENGTHS'));
  assert.deepEqual(vocabularyOf('matching_context_grants_status_check'),
    typescriptVocabularyOf('MATCHING_AUTHORITY_STATUSES'));
  assert.deepEqual(vocabularyOf('matching_context_consent_events_event_type_check'),
    typescriptVocabularyOf('MATCHING_AUTHORITY_EVENT_TYPES'));
  // Exactly one pause reason is resumable in I-07A, and it is a NARROWED TYPE
  // rather than a comment, so a later caller cannot pass one of the other four.
  assert.deepEqual(typescriptVocabularyOf('I07A_USER_RESUMABLE_PAUSE_REASONS'), ['USER_PAUSED']);
  const reserved = typescriptVocabularyOf('MATCHING_PAUSE_REASONS').filter((r) => r !== 'USER_PAUSED');
  assert.deepEqual(reserved, ['ACTIVE_INTRODUCTION', 'POST_INTRODUCTION', 'POST_SUCCESS', 'SYSTEM_POLICY'],
    'the four reserved pause reasons have no I-07A producer');
  // The vocabulary module is import-closed and evaluates nothing.
  assert.doesNotMatch(vocabulary, /^import\b/mu, 'the vocabulary module imports nothing at all');
  assert.doesNotMatch(vocabulary, /\bfunction\b|=>|\bclass\b|\brequire\(/u, 'and defines no behaviour');
  // Over the EXECUTABLE TypeScript only: the header prose names the deferred
  // I-07B and I-07C concepts precisely in order to say they are absent.
  const executableTypescript = vocabulary.split('\n').filter((line) => !line.trim().startsWith('*')
    && !line.trim().startsWith('//') && !line.trim().startsWith('/*')).join('\n');
  assert.doesNotMatch(executableTypescript, /score|rank|percent|compatib|PAIR_KEY|proposal|candidate/iu,
    'and invents no candidate, ranking or proposal vocabulary');
  // The merged kernel is unchanged: Matching admission is still worldless there.
  assert.match(kernelAuthority, /export interface MatchingAdmission \{\s+readonly scope: 'MATCHING';\s+readonly owner: ConsentPrincipal;\s+readonly purpose: 'MATCHING_CAPABILITY';\s+\}/u,
    'the frozen kernel Matching admission still carries no target World');
});

test('the 0108 verifier proves live catalog, trigger, constraint and forward-safety behaviour with rolled-back fixtures', () => {
  for (const proof of [
    'process.env.DATABASE_URL',
    'createScenarioReport',
    'assertExactBinding',
    'has_table_privilege($1, $2::regclass, $3)',
    'relkind IN (\'r\',\'v\',\'m\',\'p\')',
    "con.confdeltype <> 'r'",
    'S01 all five CW2-06 pause reasons are representable',
    'S02 act coherence is structural, not a convention',
    'S03 the act chain is a chain, per human',
    'S04 the participation pointer is exact, forward-only and undeletable',
    'S05 every append-only relation refuses UPDATE and DELETE for its OWNER',
    'S06 an authority moves ACTIVE to REVOKED and nowhere else',
    'S08 a profile field key can never name a contact route, a media handle or a document',
    'S11 an authority binds the GRANTOR OWN profile version',
    'S12 a V1 authority cannot name a V2 field, structurally',
    'f1 the append-only guard is what refuses an owner rewrite',
    'f2 the pointer guard is what stops a human history forking',
    'f3 the authority guard is what stops a revoked authority coming back',
    'f4 a later reviewed slice may add relations, a column and an index',
    'assert.notEqual(weakened, guard.definition',
    'restored.prosrc, guard.prosrc',
    'report.assertAllPassed()',
    'every fixture this verifier created was rolled back or removed',
  ]) {
    assert.ok(verifier.includes(proof), `the 0108 verifier is missing ${proof}`);
  }
  assert.doesNotMatch(verifier, /supabase\.co|postgres(?:ql)?:\/\//iu, 'no connection detail is embedded');
  assert.doesNotMatch(verifier, /\bGRANT\b|CREATE POLICY|DISABLE ROW LEVEL SECURITY/u,
    'the verifier never weakens RLS or an ACL to make a proof easy');
  // Every relation and guard the support module names really exists in the migration.
  for (const relation of [...support.matchAll(/'public\.(matching_\w+|introduction_\w+|pre_match_\w+)'/gu)].map((m) => m[1])) {
    assert.ok(executableSql.includes(`CREATE TABLE public.${relation}`) || executableSql.includes(`public.${relation}()`),
      `the support module names public.${relation}, which migration 0108 does not create`);
  }
  for (const trigger of [...support.matchAll(/'(\w+_immutable|\w+_truth)'/gu)].map((m) => m[1])) {
    assert.ok(executableSql.includes(`CREATE TRIGGER ${trigger}`),
      `the support module names the trigger ${trigger}, which migration 0108 does not create`);
  }
});

test('the 0108 verifier is wired into the toolchain, API CI after fresh migrations, and the database README', () => {
  assert.match(packageJson, /"verify:matching-participation-private-setup-foundation:integration": "node --env-file-if-exists=\.env database\/verify-migration-0108\.mjs"/u);
  assert.equal((workflow.match(/verify:matching-participation-private-setup-foundation:integration/gu) ?? []).length, 1,
    'registered exactly once in API CI');
  const step = workflow.indexOf('npm run verify:matching-participation-private-setup-foundation:integration');
  assert.ok(step > workflow.indexOf('name: Apply all migrations to fresh PostgreSQL'),
    'the verifier runs after fresh migrations are applied');
  assert.ok(step > workflow.indexOf('npm run verify:replay-distribution-reconciliation-closure:integration'),
    'and after the I-06D group it follows');
  assert.match(readme, /## I-07A - Matching Participation, Private Authority and Versioned Setup Foundation v1 \(migrations 0108-0109\)/u);
  assert.match(readme, /npm run verify:matching-participation-private-setup-foundation:integration/u);
});
