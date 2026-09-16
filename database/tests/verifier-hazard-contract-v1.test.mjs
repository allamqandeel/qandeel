import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { MAGIC_COUNT_THRESHOLD, inspectRepository, inspectVerifier } from '../verifier-hazards.mjs';
import { createScenarioReport } from '../verifier-scenarios.mjs';

// QAN-INF-03 - the permanent verifier-hazard contract.
//
// ## Why this exists
//
// This host has no PostgreSQL, so a real-PostgreSQL verifier is written blind
// and every defect in it is found by CI. A verifier that stops at its first
// failure therefore converts N latent defects into N full API CI rounds of about
// twenty minutes each. I-06A paid that bill six times, and not one of the six
// was a defect in the migration being proven - all six were defects in the
// program doing the proving.
//
// Six is not bad luck. Each one belongs to a small, nameable class that a static
// reader CAN see, and the temporary scripts that eventually found them were
// thrown away after each round. This file is those scripts made permanent.
//
// ## The two halves
//
// A contract that only asserted "the repository is clean" would be satisfied by
// detectors that detect nothing, so every rule is also required to catch the
// exact defect it was written for - the real line, from the real commit, that
// really cost a CI round - and to accept the correction that replaced it.
//
// The rules are calibrated, not aspirational: they are required to be silent on
// every verifier this repository already has. A gate that fires on healthy
// historical code is worse than no gate, because it teaches the next author that
// this file is noise.

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (relative) => readFileSync(join(root, relative), 'utf8').replace(/\r\n/gu, '\n');

/** The hazard classes this contract owns. Adding a rule means adding its class here. */
const CLASSES = ['H1-transaction-timestamp', 'H2-aborted-transaction', 'H3-timestamp-precision',
  'H4-magic-fixture-count', 'H5-functiondef-anchor', 'H6-unproven-mutation', 'H7-transaction-context'];

const hazardsIn = (source, migration = null) => inspectVerifier('verify-migration-9999.mjs', source, migration).map((f) => f.hazard);
const supportHazardsIn = (source) => inspectVerifier('probe-support.mjs', source).map((f) => f.hazard);

// ---------------------------------------------------------------------------
// The positive half: every verifier this repository has is clean.
// ---------------------------------------------------------------------------

test('no verifier or support module in this repository carries a known hazard', () => {
  const findings = inspectRepository(root);
  assert.deepEqual(findings.map((f) => `${f.hazard} ${f.file}:${f.line} - ${f.detail}`), [],
    'each of these is a defect class that has already cost this repository a full API CI round');
});

// ---------------------------------------------------------------------------
// The negative half. Each fixture is the real line from the real commit.
// ---------------------------------------------------------------------------

test('H1 - an immutability probe that re-sets a creation stamp to now() is refused', () => {
  // I-06A, CI round #671. `now()` is the TRANSACTION timestamp: the row was
  // inserted moments earlier in the SAME transaction, so this writes back the
  // value already there, the immutability trigger correctly sees no change, and
  // the probe reports that an immutable column accepted an update.
  const defect = "await rejected(() => q(`UPDATE ${R.REPLAYS} SET created_at = now() WHERE id = $1`, [replay]), ['55000']);";
  assert.deepEqual(hazardsIn(defect), ['H1-transaction-timestamp']);

  const fixed = "await rejected(() => q(`UPDATE ${R.REPLAYS} SET created_at = created_at + interval '1 second' WHERE id = $1`, [replay]), ['55000']);";
  assert.deepEqual(hazardsIn(fixed), [], 'arithmetic on the stored instant is the correction, and is accepted');
});

test('H1 - ending a lifecycle at now() is NOT the hazard', () => {
  // A terminus starts NULL, so `now()` is a real change there. The corpus does
  // this correctly in four places and must keep being allowed to.
  const healthy = "await q(`UPDATE public.shared_world_membership_episodes SET ended_at = now() WHERE world_id = $1`, [world]);";
  assert.deepEqual(hazardsIn(healthy), []);
});

test('H2 - a refusal swallowed with .catch is refused', () => {
  // I-06A, CI round #671. The command raises, the catch hides it, and the
  // transaction is now ABORTED: every statement after this one fails 25P02 for
  // a reason that has nothing to do with what it was testing.
  const defect = "assert.equal((await rt.currency(closedSpec.manifest).catch((e) => [{ currency_state: e.code }]))[0].currency_state, 'P0002');";
  assert.deepEqual(hazardsIn(defect), ['H2-aborted-transaction']);

  const fixed = "await rejected(() => rt.currency(closedSpec.manifest), ['P0002']);";
  assert.deepEqual(hazardsIn(fixed), [], 'the savepoint-taking helper is the correction, and is accepted');
});

test('H2 - a best-effort teardown that swallows a DELETE is NOT the hazard', () => {
  // An established idiom here, in five verifiers, and harmless: plain DML in a
  // teardown that is already tearing down.
  const healthy = "await q('DELETE FROM public.conversation_units WHERE session_id=$1', [session]).catch(() => undefined);";
  assert.deepEqual(hazardsIn(healthy), []);
});

test('H3 - a timestamptz read into JavaScript and sent back is refused', () => {
  // I-06A, CI round #672. `clock_timestamp()` has MICROSECOND precision; a
  // timestamptz arrives in Node as a Date, which has milliseconds. Sending it
  // back truncates it, so the synthetic row no longer matches the real one and
  // a brand-new same-row guard correctly refused every fixture the verifier
  // built - which read as the migration being wrong.
  const defect = [
    'const [pair] = await rows(',
    '  `SELECT m.history_item_id "historyItem", i.occurred_at "occurredAt"',
    '     FROM public.shared_world_materials m JOIN public.shared_world_history_items i ON i.id = m.history_item_id',
    '    WHERE m.world_id = $1`, [f.world]);',
    'await q(`INSERT INTO ${R.ITEMS} (history_item_id, occurred_at) VALUES ($1, $2)`, [pair.historyItem, pair.occurredAt]);',
  ].join('\n');
  assert.deepEqual(hazardsIn(defect), ['H3-timestamp-precision']);

  const fixed = defect.replace('i.occurred_at "occurredAt"', 'i.occurred_at::text "occurredAt"');
  assert.deepEqual(hazardsIn(fixed), [], '::text keeps the microseconds, and is accepted');
});

test('H3 - an instant that is read and never sent back is NOT the hazard', () => {
  const healthy = [
    'const [row] = await rows(`SELECT r.created_at "createdAt" FROM ${R.REPLAYS} r WHERE r.id = $1`, [replay]);',
    'assert.ok(row.createdAt instanceof Date);',
  ].join('\n');
  assert.deepEqual(hazardsIn(healthy), []);
});

test('H4 - a literal running fixture total is refused', () => {
  // I-06A, CI round #673. The literal was right when it was written and wrong
  // the moment the same verifier grew three more manifests for its cross-pairing
  // proofs - and the failure read as the migration miscounting.
  const defect = "assert.equal(await count(R.MANIFESTS, 'replay_id = $1', [replay]), 4, 'S07 the manifests');";
  assert.deepEqual(hazardsIn(defect), ['H4-magic-fixture-count']);

  const fixed = [
    "const manifestsBefore = await count(R.MANIFESTS, 'replay_id = $1', [replay]);",
    "assert.equal(await count(R.MANIFESTS, 'replay_id = $1', [replay]), manifestsBefore + 1, 'S07 exactly one more');",
  ].join('\n');
  assert.deepEqual(hazardsIn(fixed), [], 'a snapshot and a delta is the correction, and is accepted');
});

test('H4 - a small semantic cardinality is NOT the hazard', () => {
  const healthy = "assert.equal(await count(T.WITHDRAWAL_COMMANDS, 'approval_id = $1', [approval]), 2, 'both commands recorded');";
  assert.deepEqual(hazardsIn(healthy), []);
  assert.equal(MAGIC_COUNT_THRESHOLD, 4, 'the threshold is the largest literal the existing corpus uses, plus one');
});

/**
 * A migration written the way migrations are written here - a RETURNS TABLE
 * wrapped across lines - so an anchor can be classified as signature or body.
 * `pg_get_functiondef` reproduces the BODY verbatim and REGENERATES the
 * signature on one line with `timestamp with time zone`.
 */
const MIGRATION = [
  'CREATE FUNCTION public.resolve_replay_draft_composition_v1(p_replay_id uuid)',
  '  RETURNS TABLE(replay_id uuid, currency_state text,',
  '                updated_at timestamptz)',
  "  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$",
  'BEGIN',
  '  RETURN QUERY SELECT r.id, cur.currency_state, s.updated_at FROM public.replays r;',
  'END$$;',
].join('\n');

const CAPTURE = "const composition = (await rows('SELECT pg_get_functiondef($1::regprocedure) def', [FN.COMPOSITION]))[0].def;\n";

test('H5 - a weakening anchored on the migration signature is refused', () => {
  // I-06A, CI rounds #674 and #675. The anchor carries the migration's own line
  // wrapping. PostgreSQL does not reproduce it, so the replace matched nothing,
  // the function was recreated unchanged, and the probe reported that the
  // canonical contract had ACCEPTED a weakening that was never made.
  const defect = `${CAPTURE}await q(composition.replace('currency_state text,\\n                updated_at timestamptz)', 'currency_state text, updated_at timestamptz, shared_world_id uuid)'));`;
  const hazards = hazardsIn(defect, MIGRATION);
  assert.ok(hazards.includes('H5-functiondef-anchor'), `the signature anchor is caught, got ${JSON.stringify(hazards)}`);
});

test('H5 - a weakening anchored on text no migration contains is refused', () => {
  const defect = `${CAPTURE}const weak = composition.replace('a phrase this migration never wrote', 'x');\nassert.notEqual(weak, composition);`;
  assert.deepEqual(hazardsIn(defect, MIGRATION), ['H5-functiondef-anchor']);
});

test('H5 - a weakening anchored on the function BODY is NOT the hazard', () => {
  // The body comes back from `pg_get_functiondef` byte for byte, so an anchor
  // taken from it is stable.
  const healthy = `${CAPTURE}const weak = composition.replace('cur.currency_state, s.updated_at', 'cur.currency_state, s.updated_at, m.shared_world_id');\nassert.notEqual(weak, composition, 'the mutation landed');`;
  assert.deepEqual(hazardsIn(healthy, MIGRATION), []);
});

test('H6 - a weakening applied inline, with nothing proving it landed, is refused', () => {
  const defect = `${CAPTURE}await q(composition.replace('cur.currency_state, s.updated_at', 'cur.currency_state, s.updated_at, m.shared_world_id'));`;
  assert.deepEqual(hazardsIn(defect, MIGRATION), ['H6-unproven-mutation']);
});

test('H6 - a named weakening that nothing asserts against is refused', () => {
  const defect = `${CAPTURE}const weak = composition.replace('cur.currency_state, s.updated_at', 'cur.currency_state, s.updated_at, m.shared_world_id');\nawait q(weak);`;
  assert.deepEqual(hazardsIn(defect, MIGRATION), ['H6-unproven-mutation']);
});

test('H7 - a shared helper that opens a savepoint must name the requirement', () => {
  // I-06A, CI round #676. A section that commits as it goes is in autocommit,
  // PostgreSQL answers 25P01, and the message talks about savepoints rather than
  // about the caller's transaction state.
  const defect = "export function make(q) {\n  return async (operation) => {\n    await q('SAVEPOINT s');\n    try { await operation(); } finally { await q('ROLLBACK TO SAVEPOINT s'); }\n  };\n}";
  assert.deepEqual(supportHazardsIn(defect), ['H7-transaction-context']);

  const fixed = defect.replace("await q('SAVEPOINT s');",
    "try { await q('SAVEPOINT s'); } catch (e) { if (e.code === '25P01') throw new Error('needs an open transaction'); throw e; }");
  assert.deepEqual(supportHazardsIn(fixed), []);
});

test('H7 does not police verifiers, which legitimately savepoint inline', () => {
  const healthy = "await q('SAVEPOINT s');\nawait q('ROLLBACK TO SAVEPOINT s');";
  assert.deepEqual(hazardsIn(healthy), [], 'ninety-eight verifiers do exactly this');
});

test('every hazard class this contract declares is reachable by at least one rule', () => {
  // Anti-vacuity for the anti-vacuity half: a class that no fixture above can
  // produce is a rule that was deleted or renamed without anyone noticing.
  const produced = new Set([
    ...hazardsIn("await q(`UPDATE x SET created_at = now() WHERE id = $1`, [a]);"),
    ...hazardsIn('await rt.currency(m).catch(() => []);'),
    ...hazardsIn('const [p] = await rows(`SELECT i.occurred_at "occurredAt" FROM t i`);\nawait q(`INSERT INTO t VALUES ($1)`, [p.occurredAt]);'),
    ...hazardsIn("assert.equal(await count(T.X, 'a = $1', [b]), 9);"),
    ...hazardsIn(`${CAPTURE}const w = composition.replace('nowhere in the migration', 'x');\nassert.notEqual(w, composition);`, MIGRATION),
    ...hazardsIn(`${CAPTURE}await q(composition.replace('cur.currency_state, s.updated_at', 'y'));`, MIGRATION),
    ...supportHazardsIn("await q('SAVEPOINT s');"),
  ]);
  assert.deepEqual([...produced].sort(), [...CLASSES].sort());
});

// ---------------------------------------------------------------------------
// The scenario helper: the aggregation contract of §5, proven behaviourally.
// ---------------------------------------------------------------------------

/** A query function that records what it was asked, and can be made to refuse. */
function fakeQuery({ failSavepoint = false } = {}) {
  const statements = [];
  const query = async (text) => {
    statements.push(text);
    if (failSavepoint && /^SAVEPOINT/u.test(text)) {
      const error = new Error('current transaction is not in a transaction block');
      error.code = '25P01';
      throw error;
    }
    return { rows: [] };
  };
  return { query, statements };
}

test('an independent scenario failure is recorded and does not stop the next one', async () => {
  const { query } = fakeQuery();
  const report = createScenarioReport('probe', { query });
  await report.isolated('first', () => { throw new Error('the first probe is wrong'); });
  await report.isolated('second', async () => undefined);
  await report.isolated('third', () => { throw new Error('and so is the third'); });

  assert.deepEqual(report.results.map((r) => [r.name, r.ok]), [['first', false], ['second', true], ['third', false]],
    'all three outcomes are known after ONE run - which is the whole point');
  assert.throws(() => report.assertAllPassed(), /first[\s\S]*third/u, 'and the run still fails, naming both');
});

test('each scenario is isolated by its own savepoint, released on every path', async () => {
  const { query, statements } = fakeQuery();
  const report = createScenarioReport('probe', { query });
  await report.isolated('good', async () => undefined);
  await report.isolated('bad', () => { throw new Error('no'); });

  const opened = statements.filter((s) => /^SAVEPOINT /u.test(s));
  assert.equal(opened.length, 2, 'one savepoint per scenario');
  for (const savepoint of opened.map((s) => s.slice('SAVEPOINT '.length))) {
    assert.ok(statements.includes(`ROLLBACK TO SAVEPOINT ${savepoint}`), `${savepoint} was rolled back`);
    assert.ok(statements.includes(`RELEASE SAVEPOINT ${savepoint}`), `${savepoint} was released`);
  }
});

test('the session state a failed scenario changed is restored before the next one', async () => {
  const { query } = fakeQuery();
  let restored = 0;
  const report = createScenarioReport('probe', { query, restore: async () => { restored += 1; } });
  await report.isolated('a', () => { throw new Error('no'); });
  await report.isolated('b', async () => undefined);
  assert.equal(restored, 2, 'a probe that failed half way through must not leak its role into the next one');
});

test('a scenario run outside a transaction says so', async () => {
  const { query } = fakeQuery({ failSavepoint: true });
  const report = createScenarioReport('probe', { query });
  await report.isolated('needs-a-transaction', async () => undefined);
  assert.match(report.results[0].detail, /open transaction/u,
    'the diagnostic is about the CALLER\'s transaction state, not about savepoints');
});

test('a weakening probe fails when the mutation matched nothing', async () => {
  const { query } = fakeQuery();
  const report = createScenarioReport('probe', { query });
  let installed = null;
  await report.probe('f1', {
    pristine: 'CREATE FUNCTION f() ...',
    mutate: (text) => text.replace('a phrase that is not there', 'x'),
    apply: async (text) => { installed = text; },
    // A canonical check that would have "passed" - which is exactly how a no-op
    // mutation reports itself as a contract failure.
    reject: async () => undefined,
  });
  assert.equal(report.results[0].ok, false);
  assert.match(report.results[0].detail, /matched nothing/u);
  assert.equal(installed, null, 'and nothing was installed');
});

test('a weakening probe fails when the canonical check accepted the weakening', async () => {
  const { query } = fakeQuery();
  const report = createScenarioReport('probe', { query });
  await report.probe('f2', {
    pristine: 'RETURNS TABLE(id uuid)',
    mutate: (text) => text.replace('id uuid', 'id uuid, user_id uuid'),
    marker: 'user_id uuid',
    apply: async () => undefined,
    reject: async () => undefined,
  });
  assert.equal(report.results[0].ok, false);
  assert.match(report.results[0].detail, /ACCEPTED the weakened state/u);
});

test('a weakening probe passes only when the mutation landed AND was refused', async () => {
  const { query } = fakeQuery();
  const report = createScenarioReport('probe', { query });
  await report.probe('f3', {
    pristine: 'RETURNS TABLE(id uuid)',
    mutate: (text) => text.replace('id uuid', 'id uuid, user_id uuid'),
    marker: 'user_id uuid',
    apply: async () => undefined,
    reject: async () => { throw new Error('no read boundary may return user_id'); },
  });
  assert.deepEqual(report.results.map((r) => r.ok), [true]);
  report.assertAllPassed();
});

test('the summary is printed on a passing run, not only on a failing one', () => {
  const report = createScenarioReport('probe');
  report.record('a', true, '');
  report.record('b', true, '');
  assert.deepEqual(report.print(), { total: 2, failed: 0 },
    'a green run must still say WHICH scenarios it exercised, or a probe that stopped running looks like a probe that passed');
});

// ---------------------------------------------------------------------------
// The focused gate itself: parity, registration, and a bounded selector.
// ---------------------------------------------------------------------------

test('the focused gate bootstraps a database at least as complete as full API CI does', () => {
  // The ONE parity claim that matters for a database-only verifier. The version
  // number is not it: these roles and this function are, because migrations
  // grant to them and read auth.uid(). A subset check rather than an equality
  // check on purpose - API CI may grow its bootstrap, and the focused gate must
  // never bootstrap LESS.
  const bootstrap = read('database/supabase-compatible-bootstrap.sql');
  const apiCi = read('.github/workflows/api-ci.yml');
  const statements = bootstrap.split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('--'))
    .join('\n').split(/;\s*\n/u).map((s) => s.trim().replace(/;$/u, '')).filter(Boolean);
  assert.ok(statements.length >= 8, `the bootstrap carries its statements, found ${statements.length}`);
  const normalized = apiCi.replace(/\s+/gu, ' ');
  for (const statement of statements) {
    assert.ok(normalized.includes(statement.replace(/\s+/gu, ' ')),
      `api-ci.yml must perform this too, or the focused gate is not parity:\n${statement}`);
  }
});

test('the focused gate is registered and needs no secret', () => {
  const workflow = read('.github/workflows/focused-database-verification.yml');
  assert.match(workflow, /image: postgres:17/u, 'the same PostgreSQL major version as API CI');
  assert.doesNotMatch(workflow, /secrets\./u, 'a PostgreSQL-only gate needs no secret and must never be given one');
  assert.match(workflow, /permissions:\s*\n\s*contents: read/u, 'read is the whole of its authority');
  assert.match(workflow, /focused-verification-runner\.mjs --check-inputs/u, 'the inputs are answered for before the ref under test is fetched');
  assert.match(workflow, /if: always\(\)/u, 'the artifact is uploaded on failure, which is when it is needed');
  assert.doesNotMatch(workflow, /image: redis/u, 'the Replay verifiers need no Redis, and parity is not "copy every service"');

  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['test:database'], 'node --test database/tests/*.test.mjs', 'this contract runs under test:database');
  assert.ok(manifest.scripts['verify:db:focused'], 'the one-command local form is registered');
});

test('a selector is a bounded name and can never become a command', () => {
  const runner = join(root, 'database', 'focused-verification-runner.mjs');
  const check = (selector, ref = 'main') => spawnSync(process.execPath, [runner, '--check-inputs'],
    { encoding: 'utf8', env: { ...process.env, FOCUSED_VERIFIER: selector, FOCUSED_TARGET_REF: ref, NODE_TEST_CONTEXT: undefined } });

  for (const accepted of ['i06a-all', 'i06a-0100', 'migration-0101']) {
    assert.equal(check(accepted).status, 0, `${accepted} resolves`);
  }
  for (const refused of ['i06a-all; whoami', 'i06a-all && whoami', '$(whoami)', '../../etc/passwd', 'unknown-group', '']) {
    assert.notEqual(check(refused).status, 0, `${JSON.stringify(refused)} is refused`);
  }
  for (const refused of ['main; whoami', '../../etc/passwd', '--upload-pack=whoami', 'refs/heads/x@{1}', '']) {
    assert.notEqual(check('i06a-all', refused).status, 0, `target ref ${JSON.stringify(refused)} is refused`);
  }
  assert.equal(check('i06a-all', '7aaa308df49d5146db4fae4713390ce05a4739cb').status, 0, 'a SHA is a legitimate target');

  // No path through the runner reaches a shell, so nothing a selector, a mapping
  // file or a workflow input can say is ever interpreted as a command.
  const source = read('database/focused-verification-runner.mjs');
  assert.match(source, /^import \{ spawnSync \} from 'node:child_process';$/mu, 'spawnSync is the only process primitive it imports');
  assert.match(source, /shell: false/u, 'every child is spawned with an argument vector');
  assert.doesNotMatch(source, /shell: true|execSync|execFileSync/u, 'and never through a shell');
});

test('every declared verifier group names verifiers and nothing else', () => {
  const mapping = JSON.parse(read('database/focused-verifiers.json'));
  const groups = Object.entries(mapping.groups);
  assert.ok(groups.length >= 3, 'the contract requires at least the three I-06A selectors');
  for (const required of ['i06a-0100', 'i06a-0101', 'i06a-all']) {
    assert.ok(mapping.groups[required], `${required} is a required selector`);
  }
  for (const [name, group] of groups) {
    assert.match(name, /^[a-z0-9][a-z0-9-]{0,63}$/u, `${name} is a bounded selector name`);
    assert.ok(group.title, `${name} says what it verifies`);
    assert.ok(Array.isArray(group.verifiers) && group.verifiers.length > 0, `${name} names at least one verifier`);
    for (const verifier of group.verifiers) {
      assert.match(verifier, /^database\/verify-[a-z0-9][a-z0-9-]*\.mjs$/u, `${name} may only name a repository verifier, not ${verifier}`);
    }
  }
});
