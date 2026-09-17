// I-07A - Matching setup human authority commands and private self-inspection
// v1: secret-free structural contract over migration 0109.
//
// Prose comments explain WHY a construct is forbidden and therefore name it;
// every "must not contain" assertion runs against executable SQL only. Live
// semantics - refusals, idempotency, ACL behaviour, the resume ceiling, the
// committed race - are proven by the real PostgreSQL verifier this file also
// pins into the toolchain and CI.
//
// Two of the tests below are cross-checks rather than descriptions, and they are
// the reason this file exists at all: every function SIGNATURE the verifiers
// invoke is compared against the signature the migration really declares, and
// every ERROR LITERAL the verifiers assert on is compared against the literals
// the migrations really raise. A verifier written against a database this host
// cannot run is written blind, and a mistyped signature or error name is
// otherwise found only by a full CI round.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION_NAME = '0109_matching_setup_human_authority_commands_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const foundation = read('../migrations/0108_matching_participation_private_setup_foundation_v1.sql');
const verifier = read('../verify-migration-0109.mjs');
const foundationVerifier = read('../verify-migration-0108.mjs');
const support = read('../matching-setup-verifier-support.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const stripComments = (sql) => sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const executableSql = stripComments(migration);
const executableSlice = (from, to) => {
  const start = migration.indexOf(from);
  assert.ok(start >= 0, `migration contains "${from}"`);
  const end = to === undefined ? migration.length : migration.indexOf(to, start);
  assert.ok(end > start, `migration contains "${to}" after "${from}"`);
  return stripComments(migration.slice(start, end));
};
const acl = executableSlice('-- 12. OWNERSHIP AND LEAST-PRIVILEGE EXECUTE ACL.', '-- 13. TERMINAL SELF-ASSERTIONS.');
const selfAssertion = executableSlice('-- 13. TERMINAL SELF-ASSERTIONS.', 'COMMIT;');

/** Every boundary the migration declares: name, parameter list and $$ body. */
const boundaries = new Map([...migration.matchAll(
  /CREATE FUNCTION public\.(\w+)\(([^)]*)\)\s*RETURNS ([\s\S]*?)AS \$\$([\s\S]*?)\$\$;/gu)]
  .map(([, name, params, returns, body]) => [name, {
    params: params.replace(/\s+/gu, ' ').trim(),
    returns: returns.replace(/\s+/gu, ' ').trim(),
    body,
  }]));

/** `name(uuid, text, uuid)` - the identity form `::regprocedure` resolves. */
const identityOf = (name) => {
  const { params } = boundaries.get(name);
  const types = params === '' ? [] : params.split(',').map((piece) => {
    const trimmed = piece.trim().replace(/\s+DEFAULT\s+[\s\S]*$/iu, '');
    return trimmed.slice(trimmed.indexOf(' ') + 1).trim();
  });
  return `public.${name}(${types.join(', ')})`;
};

const MUTATIONS = [
  'activate_matching_participation_v1', 'pause_matching_participation_v1',
  'resume_matching_participation_v1', 'turn_off_matching_participation_v1',
  'grant_matching_context_v1', 'revoke_matching_context_v1',
  'set_introduction_profile_v1', 'set_matching_requirements_v1',
  'grant_pre_match_disclosure_authority_v1', 'revoke_pre_match_disclosure_authority_v1',
];
const PROJECTION = 'get_my_matching_setup_v1';
/** Commands whose authority must not depend on participation in any direction. */
const PARTICIPATION_FREE = MUTATIONS.filter((name) => !name.endsWith('_matching_participation_v1'));

test('0109 exists, is the forward migration after 0108, and edits no historical migration', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME), 'migration 0109 exists');
  assert.equal(migrations.filter((name) => name.startsWith('0109_')).length, 1, 'exactly one migration carries 0109');
  assert.equal(migrations.indexOf(MIGRATION_NAME),
    migrations.indexOf('0108_matching_participation_private_setup_foundation_v1.sql') + 1,
    '0109 orders directly after 0108');
  assert.equal(migrations[migrations.length - 1], MIGRATION_NAME, '0109 is the current migration tip');
  assert.match(migration, /^-- I-07A/u);
  assert.match(migration, /COMMIT;\n$/u);
  assert.doesNotMatch(executableSql, /DROP (?:TABLE|FUNCTION|TRIGGER|CONSTRAINT|POLICY|INDEX|COLUMN)/iu);
  assert.doesNotMatch(executableSql, /CREATE TABLE|CREATE TRIGGER|CREATE POLICY|CREATE (?:UNIQUE )?INDEX|ALTER TABLE/iu,
    '0109 is the authority boundary: it creates and alters no relation at all');
  assert.doesNotMatch(executableSql, /(?:INSERT INTO|UPDATE|DELETE FROM) public\.(?!matching_|introduction_|pre_match_)/u,
    '0109 writes only its own I-07A relations');
});

test('0109 declares exactly the ten human commands and the one self-inspection projection', () => {
  assert.deepEqual([...boundaries.keys()].sort(), [...MUTATIONS, PROJECTION].sort());
  for (const name of MUTATIONS) {
    assert.match(migration, new RegExp(`CREATE FUNCTION public\\.${name}\\(`, 'u'));
    assert.ok(boundaries.get(name).returns.includes('LANGUAGE plpgsql SECURITY DEFINER SET search_path=\'\''),
      `${name} is SECURITY DEFINER with a pinned empty search_path`);
    assert.ok(!boundaries.get(name).returns.includes('STABLE') && !boundaries.get(name).returns.includes('IMMUTABLE'),
      `${name} is a mutation and is VOLATILE`);
  }
  assert.ok(boundaries.get(PROJECTION).returns.includes('LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=\'\''),
    'the self-inspection projection is STABLE');
  // FOUR participation commands rather than one command with a kind parameter:
  // the act is fixed by FUNCTION IDENTITY, so a caller cannot spell one.
  assert.equal(MUTATIONS.filter((name) => name.endsWith('_matching_participation_v1')).length, 4);
  assert.doesNotMatch(executableSql, /p_participation_act|p_act|p_pause_reason|p_resulting_state|p_status/u,
    'no caller may spell an act, a state or a pause reason');
});

test('every boundary derives its human from auth.uid() and accepts no identity, state, reason or timestamp', () => {
  for (const [name, boundary] of boundaries) {
    assert.match(boundary.body, /auth\.uid\(\)/u, `${name} derives its human from auth.uid()`);
    assert.doesNotMatch(boundary.params,
      /user|human|actor|grantor|owner|participant|subject|on_behalf|recipient|candidate|pair|proposal/iu,
      `${name} must not accept an identity parameter: ${boundary.params}`);
    assert.doesNotMatch(boundary.params, /status|state|pause|reason|event_type|purpose|source|scope|permission/iu,
      `${name} must not accept a state, reason, purpose or scope parameter: ${boundary.params}`);
    assert.doesNotMatch(boundary.params, /timestamp|_at\b|occurred|granted|revoked/iu,
      `${name} must not accept a timestamp parameter: ${boundary.params}`);
  }
  assert.equal(boundaries.get(PROJECTION).params, '',
    'the self-inspection projection takes no parameter at all, so it can never be pointed at another human');
});

test('every consequential command serializes on the caller own lock row, first and always', () => {
  const LOCK = 'INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)\n'
    + '  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at\n'
    + '  RETURNING l.user_id INTO locked;';
  for (const name of MUTATIONS) {
    const { body } = boundaries.get(name);
    assert.ok(body.includes(LOCK), `${name} takes the caller's own Matching lock row through the canonical statement`);
    // ... and takes it BEFORE it reads, compares or changes anything. Only real
    // statements count: a DECLARE line naming a relation's ROW TYPE precedes the
    // lock by construction and reads nothing.
    const lockAt = body.indexOf(LOCK);
    for (const [, statement, relation] of body.matchAll(
      /\b(FROM|INSERT INTO|UPDATE|JOIN) public\.(matching_(?!setup_locks)\w+|introduction_\w+|pre_match_\w+)/gu)) {
      const at = body.indexOf(`${statement} public.${relation}`);
      assert.ok(at > lockAt, `${name} ${statement}s ${relation} only after taking the lock row`);
    }
  }
  assert.ok(!boundaries.get(PROJECTION).body.includes('matching_setup_locks'),
    'the read-only projection takes no lock and writes nothing');
  // ONE serialization point, and no substitute for it. Over the BODIES, because
  // the terminal self-assertion names those constructs in order to refuse them.
  for (const [name, { body }] of boundaries) {
    assert.doesNotMatch(body, /pg_advisory|LOCK TABLE|TRUNCATE/iu,
      `${name} takes no advisory lock, table lock or truncation`);
  }
  // The one command that reaches a second family reaches it READ-ONLY.
  const disclosure = boundaries.get('grant_pre_match_disclosure_authority_v1').body;
  assert.match(disclosure, /FROM public\.introduction_profile_state s WHERE s\.owner_user_id = u FOR SHARE/u);
  assert.match(disclosure, /FROM public\.introduction_profile_versions v\n\s+WHERE v\.id = p_profile_version_id AND v\.owner_user_id = u FOR SHARE/u);
  assert.doesNotMatch(disclosure, /(?:INSERT INTO|UPDATE|DELETE FROM) public\.introduction_profile/u,
    'the disclosure command reads the profile family and never writes it');
});

test('the three authorities stay independent in the bodies themselves', () => {
  for (const name of PARTICIPATION_FREE) {
    assert.doesNotMatch(boundaries.get(name).body, /matching_participation/iu,
      `${name} must not read or write participation state: revocation cannot be gated on still participating`);
  }
  for (const name of ['activate_matching_participation_v1', 'pause_matching_participation_v1',
    'resume_matching_participation_v1', 'turn_off_matching_participation_v1']) {
    assert.doesNotMatch(boundaries.get(name).body,
      /matching_context_grants|matching_context_consent_events|introduction_profile|matching_requirement|pre_match_disclosure/u,
      `${name} must not touch a separately owned authority: opting out revokes nothing`);
  }
});

test('no command reads Shared, Public, Replay or private MY_WORLD state', () => {
  for (const [name, boundary] of boundaries) {
    assert.doesNotMatch(boundary.body,
      /public\.(shared_world|public_world|public_experience|publication|replay|conversation_|him_|memories|hypothes)/u,
      `${name} creates authority, not the later candidate-evaluation context resolver`);
    assert.doesNotMatch(boundary.body, /public\.users/u,
      `${name} infers nothing from an account: the human is auth.uid() and the field values are the caller's own`);
  }
  // The profile command touches exactly its own family and the lock row.
  const relations = [...new Set([...boundaries.get('set_introduction_profile_v1').body
    .matchAll(/public\.(\w+)/gu)].map((m) => m[1]))].sort();
  assert.deepEqual(relations, ['introduction_profile_field_values', 'introduction_profile_state',
    'introduction_profile_versions', 'matching_setup_locks']);
});

test('the I-07A resume ceiling and the reactivation check are both in the code, not in a comment', () => {
  const resume = boundaries.get('resume_matching_participation_v1').body;
  assert.match(resume, /IF current_act\.resulting_pause_reason <> 'USER_PAUSED' THEN\s+RAISE EXCEPTION 'MATCHING_PAUSE_NOT_USER_RESUMABLE'/u,
    'the resume path lifts USER_PAUSED and refuses every other pause reason');
  // The prose inside the body names the four reserved reasons in order to say it
  // refuses them; the CODE must not enumerate them, or it would be a list some
  // later slice has to keep in step with the vocabulary.
  assert.doesNotMatch(stripComments(resume), /ACTIVE_INTRODUCTION|POST_INTRODUCTION|POST_SUCCESS|SYSTEM_POLICY/u,
    'and does so by naming the ONE resumable reason rather than enumerating four');
  const activate = boundaries.get('activate_matching_participation_v1').body;
  assert.match(activate, /IF prior_act\.resulting_state = 'PAUSED' AND prior_act\.resulting_pause_reason <> 'USER_PAUSED' THEN\s+RAISE EXCEPTION 'MATCHING_REACTIVATION_REQUIRES_REVALIDATION'/u,
    'activation refuses an OFF reached from a pause I-07A may not resume');
  assert.match(activate, /RAISE EXCEPTION 'MATCHING_PARTICIPATION_PAUSED'/u,
    'and never activates over a pause directly');
  // Turning off is never blocked: it is the human's own privacy authority.
  const turnOff = boundaries.get('turn_off_matching_participation_v1').body;
  assert.doesNotMatch(turnOff, /USER_PAUSED|NOT_USER_RESUMABLE|REVALIDATION/u,
    'opting out works from every state, including a pause I-07A cannot resume');
  // The four reserved pause reasons have NO producer anywhere in 0109.
  for (const reserved of ['ACTIVE_INTRODUCTION', 'POST_INTRODUCTION', 'POST_SUCCESS', 'SYSTEM_POLICY']) {
    assert.doesNotMatch(executableSql, new RegExp(`'${reserved}'`, 'u'),
      `${reserved} is representable in 0108 and has no I-07A producer`);
  }
  // Exactly ONE command WRITES a pause reason, and the reason it writes is
  // USER_PAUSED because that command is the user pause.
  const writers = [...boundaries].filter(([, { body }]) =>
    /INSERT INTO public\.matching_participation_events[\s\S]*?'USER_PAUSED'/u.test(stripComments(body)));
  assert.deepEqual(writers.map(([name]) => name), ['pause_matching_participation_v1'],
    'only the user pause command writes a pause reason at all');
});

test('durable idempotency compares the WHOLE immutable request against the committed row', () => {
  for (const name of MUTATIONS) {
    const { body } = boundaries.get(name);
    assert.match(body, /SELECT \* INTO committed FROM public\.\w+ \w+ WHERE \w+\.id = p_command_id;/u,
      `${name} reads the committed row the command id names`);
    assert.match(body, /RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';/u,
      `${name} fails closed when the same id carries a different request`);
    assert.match(body, /RETURN QUERY SELECT committed\./u,
      `${name} answers a retry FROM the committed row rather than echoing the retry's own arguments`);
    assert.match(body, /RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001';/u,
      `${name} refuses a stale expected state rather than applying to whatever is current`);
    assert.ok(body.includes('committed.'), `${name} compares the committed row field by field`);
  }
  // Every committed instant is the database clock, and no caller supplies one.
  assert.doesNotMatch(executableSql, /now\(\)|localtimestamp|statement_timestamp|clock_timestamp/iu);
  assert.ok((executableSql.match(/CURRENT_TIMESTAMP/gu) ?? []).length >= 6,
    'the database clock owns every committed instant');
});

test('the boundary is no existence oracle: a foreign authority answers exactly as a nonexistent one', () => {
  for (const [name, error] of [
    ['revoke_matching_context_v1', 'MATCHING_GRANT_NOT_FOUND'],
    ['revoke_pre_match_disclosure_authority_v1', 'MATCHING_DISCLOSURE_AUTHORITY_NOT_FOUND'],
  ]) {
    const { body } = boundaries.get(name);
    // ONE query filters by identity AND by human, so "not yours" and "not there"
    // are the same answer and neither discloses the other human's state.
    assert.match(body, new RegExp(`WHERE \\w+\\.id = p_expected_active_\\w+ AND \\w+\\.grantor_user_id = u FOR UPDATE;\\s+IF NOT FOUND THEN RAISE EXCEPTION '${error}'`, 'u'),
      `${name} collapses a foreign authority and a nonexistent one into one bounded answer`);
    assert.equal((body.match(new RegExp(error, 'gu')) ?? []).length, 1,
      `${name} raises ${error} from exactly one place`);
  }
  assert.doesNotMatch(executableSql, /RAISE EXCEPTION '\w*(?:NOT_YOURS|FOREIGN|ANOTHER|OTHER_USER|NOT_OWNER)\w*'/u,
    'no error names another human at all');
});

test('the execute ACL is authenticated-only, and service_role is revoked explicitly', () => {
  for (const name of [...MUTATIONS, PROJECTION]) {
    assert.ok(acl.includes(`'${identityOf(name).replace(/, /gu, ',')}'`),
      `${name} is in the ACL loop as ${identityOf(name)}`);
  }
  assert.match(acl, /ALTER FUNCTION %s OWNER TO postgres/u);
  assert.match(acl, /REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated/u);
  assert.match(acl, /IF EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = 'service_role'\) THEN\s+EXECUTE format\('REVOKE ALL ON FUNCTION %s FROM service_role', boundary\);/u,
    'a Supabase project grants EXECUTE to service_role by default privilege, so it is revoked explicitly');
  assert.match(acl, /GRANT EXECUTE ON FUNCTION %s TO authenticated/u);
  assert.doesNotMatch(acl, /GRANT EXECUTE[\s\S]*TO (?:PUBLIC|anon|service_role)/u,
    'the server may facilitate the experience later and must never manufacture the consent');
});

test('the terminal self-assertion refuses a service-role-executable, coupled or unsealed boundary', () => {
  assert.match(selfAssertion, /IF NOT p\.prosecdef THEN RAISE EXCEPTION 'I-07A: % must be SECURITY DEFINER'/u);
  assert.match(selfAssertion, /cfg IN \('search_path=', 'search_path=""'\)/u);
  assert.match(selfAssertion, /p\.prosrc !~ 'auth\\\.uid\\\(\\\)'/u);
  assert.match(selfAssertion, /RAISE EXCEPTION 'I-07A: % must serialize on the caller''s own Matching lock row'/u);
  assert.match(selfAssertion, /RAISE EXCEPTION 'I-07A: % may never rewrite or erase Matching history'/u);
  assert.match(selfAssertion, /RAISE EXCEPTION 'I-07A: % may not read Shared, Public, Replay or private MY_WORLD state'/u);
  assert.match(selfAssertion, /a system credential never manufactures human Matching consent/u);
  assert.match(selfAssertion, /the three authorities are independent/u);
  assert.match(selfAssertion, /RAISE EXCEPTION 'I-07A: the resume path must refuse every pause reason but USER_PAUSED'/u);
  assert.match(selfAssertion, /RAISE EXCEPTION 'I-07A: activation must refuse a reactivation over a pause that requires later revalidation'/u);
  assert.match(selfAssertion, /RAISE EXCEPTION 'I-07A: direct table access stays sealed/u);
  assert.match(selfAssertion, /the Shared Standing Context consent boundary must be exactly as I-03C left it/u);
  assert.match(selfAssertion, /\) <> 11 THEN/u, 'exactly the ten commands and the one projection may exist');
});

test('CROSS-CHECK: every signature the verifiers invoke is the signature the migration declares', () => {
  // A verifier written against a database this host cannot run is written blind.
  // `::regprocedure` fails at RUNTIME for a signature that does not exist, which
  // costs a whole CI round; this comparison costs nothing.
  const declared = new Map([...boundaries.keys()].map((name) => [name, identityOf(name)]));
  const referenced = [...support.matchAll(/'(public\.\w+\((?:[\w[\] ,]*)\))'/gu)].map((m) => m[1]);
  assert.ok(referenced.length >= 11, `the support module names the boundaries, found ${referenced.length}`);
  for (const signature of referenced) {
    const name = signature.slice('public.'.length, signature.indexOf('('));
    if (!declared.has(name)) {
      // A trigger function of 0108, which has no arguments and its own contract.
      assert.match(signature, /^public\.\w+\(\)$/u, `${signature} names no I-07A boundary`);
      assert.ok(foundation.includes(`CREATE FUNCTION ${signature.replace('()', '()')}`)
        || foundation.includes(`CREATE FUNCTION ${signature.slice(0, -2)}()`),
      `${signature} is declared by migration 0108`);
      continue;
    }
    assert.equal(signature, declared.get(name),
      `the support module invokes ${signature}, but 0109 declares ${declared.get(name)}`);
  }
  // And the positional SQL the wrappers send matches the declared arity exactly.
  for (const [name, { params }] of boundaries) {
    const arity = params === '' ? 0 : params.split(',').length;
    const call = support.match(new RegExp(`SELECT \\* FROM public\\.${name}\\(([^)]*)\\)`, 'u'));
    assert.ok(call, `the support module wraps ${name}`);
    const sent = call[1].trim() === '' ? 0 : call[1].split(',').length;
    assert.equal(sent, arity, `the ${name} wrapper sends ${sent} argument(s) to a function declaring ${arity}`);
  }
});

test('CROSS-CHECK: every error literal the verifiers assert on is a literal the migrations raise', () => {
  const raised = new Set([...`${foundation}\n${migration}`.matchAll(/RAISE EXCEPTION '(MATCHING_[A-Z_]+)'/gu)]
    .map((m) => m[1]));
  assert.ok(raised.size >= 15, `the migrations raise bounded Matching errors, found ${raised.size}`);
  // Everything the support module and the two verifiers spell as MATCHING_* that
  // is not one of this slice's own JavaScript identifiers must be one of them.
  const JS_IDENTIFIERS = new Set(['MATCHING_TABLES', 'MATCHING_IMMUTABLE', 'MATCHING_GUARDED', 'MATCHING_CHAINS',
    'MATCHING_COMMANDS', 'MATCHING_TRIGGER_FUNCTIONS', 'MATCHING_DISCLOSURE_BAN', 'MATCHING_PARTICIPATION_STATES',
    'MATCHING_PAUSE_REASONS', 'MATCHING_ACTIVATION_ENTRY_CHANNELS', 'MATCHING_PARTICIPATION_ACTS',
    'MATCHING_REQUIREMENT_STRENGTHS', 'MATCHING_AUTHORITY_EVENT_TYPES', 'MATCHING_AUTHORITY_STATUSES']);
  const referenced = new Set([...`${support}\n${verifier}\n${foundationVerifier}`.matchAll(/\bMATCHING_[A-Z_]+/gu)]
    .map((m) => m[0]).filter((name) => !JS_IDENTIFIERS.has(name)));
  assert.ok(referenced.size >= 12, `the verifiers assert on bounded Matching errors, found ${referenced.size}`);
  for (const literal of referenced) {
    assert.ok(raised.has(literal), `the verifiers assert on ${literal}, which no migration raises`);
  }
  // Every error the migrations raise carries a bounded SQLSTATE, never the default.
  for (const [, literal] of `${foundation}\n${migration}`.matchAll(/RAISE EXCEPTION '(MATCHING_[A-Z_]+)'\n?\s*(?!USING)/gu)) {
    const at = `${foundation}\n${migration}`.indexOf(`'${literal}'`);
    assert.match(`${foundation}\n${migration}`.slice(at, at + 200), /USING\s+ERRCODE='\w{5}'/u,
      `${literal} is raised with a bounded SQLSTATE`);
  }
});

test('the 0109 verifier proves the behaviour families the task requires, with rolled-back fixtures', () => {
  for (const proof of [
    'process.env.DATABASE_URL',
    'createScenarioReport',
    'A01 absence is OFF, and nothing infers ACTIVE from another authority',
    'A02 activation is explicit, authenticated and bounded in provenance',
    'A03 the human participation walk: activate, pause, resume, turn off',
    'pause is not resumable in I-07A',
    'A05 turning off never launders a pause I-07A may not resume',
    'A06 durable idempotency and command-id conflict',
    'A07 a stale expected state is refused and applied to nothing',
    'A08 a caller only ever sees and moves itself',
    'B01 turning participation off revokes no separately owned authority',
    'B03 revocation works while participation is OFF and while it is PAUSED',
    'B04 another human grant is reported exactly as a nonexistent one',
    'C01 a profile update is a NEW immutable version with an exact current identity',
    'D01 a requirement update is a NEW immutable version preserving hard vs soft',
    'D02 nothing evaluates, scores or ranks a candidate',
    'E01 an authority binds the CURRENT profile version and an exact approved subset',
    'E02 an authority over V1 never silently covers V2',
    'E03 a disclosure authority creates no proposal and names no recipient',
    'G01 authenticated is the only executor',
    'G02 no system credential manufactures human Matching consent',
    'G02 no application role reaches a Matching table directly',
    'X01 two concurrent first activations serialize on the caller own lock row',
    'f1 the USER_PAUSED resume ceiling is load-bearing',
    'f2 the reactivation check is load-bearing',
    'f3 a later reviewed slice may add its own boundary and column',
    'assert.notEqual(weakened, resumeFn.definition',
    'assert.notEqual(weakened, activateFn.definition',
    'restored.prosrc, resumeFn.prosrc',
    'restored.prosrc, activateFn.prosrc',
    'report.assertAllPassed()',
    'every fixture this verifier created was rolled back or removed',
  ]) {
    assert.ok(verifier.includes(proof), `the 0109 verifier is missing ${proof}`);
  }
  assert.doesNotMatch(verifier, /supabase\.co|postgres(?:ql)?:\/\//iu, 'no connection detail is embedded');
  assert.doesNotMatch(verifier, /\bGRANT EXECUTE\b|CREATE POLICY|DISABLE ROW LEVEL SECURITY/u,
    'the verifier never weakens an ACL or RLS to make a proof easy');
  // The four reserved pause reasons are reached as the table OWNER, inside a
  // scenario that rolls back - which is the only honest way to exercise a state
  // I-07A is forbidden to produce.
  assert.match(support, /async function simulatePause\(human, reason, prior = null\)/u);
  assert.match(support, /RESERVED_PAUSE_REASONS = PAUSE_REASONS\.filter\(\(reason\) => reason !== 'USER_PAUSED'\)/u);
});

test('the 0109 verifier is wired into the toolchain, API CI after fresh migrations, and the database README', () => {
  assert.match(packageJson, /"verify:matching-setup-human-authority-commands:integration": "node --env-file-if-exists=\.env database\/verify-migration-0109\.mjs"/u);
  assert.equal((workflow.match(/verify:matching-setup-human-authority-commands:integration/gu) ?? []).length, 1,
    'registered exactly once in API CI');
  const step = workflow.indexOf('npm run verify:matching-setup-human-authority-commands:integration');
  assert.ok(step > workflow.indexOf('name: Apply all migrations to fresh PostgreSQL'),
    'the verifier runs after fresh migrations are applied');
  assert.ok(step > workflow.indexOf('npm run verify:matching-participation-private-setup-foundation:integration'),
    'and after the 0108 verifier it is grouped with');
  assert.match(workflow, /Verify the two I-07A Matching foundation and human authority command verifiers against real PostgreSQL as one reported group/u);
  // The focused gate is untouched: a new migration is selectable generically.
  const focused = read('../focused-verifiers.json');
  assert.doesNotMatch(focused, /i07a|0108|0109/u,
    'a generic migration-NNNN selector needs no registry edit, so the focused gate is not changed to make this slice testable');
  assert.match(readme, /npm run verify:matching-setup-human-authority-commands:integration/u);
});
