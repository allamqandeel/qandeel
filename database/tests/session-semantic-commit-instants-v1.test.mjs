import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// S8B-07 RB-2 / S1 — the semantic commit instants (migration 0201), under the Product Owner's authorization "RB-2/S1 ONLY"
// of 2026-11-23 (D-RB2-1, D-RB2-5a, D-RB2-7a, D-RB2-9, D-RB2-11). This is the STATIC contract; the behaviour — the ten
// mandatory proofs, the transaction-identity proofs and the planted defects — is proven against real PostgreSQL by
// database/verify-migration-0201.mjs in API CI.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION = '0201_s8b_07_semantic_commit_instants_v1.sql';
const migration = read(`../migrations/${MIGRATION}`);
const verifier = read('../verify-migration-0201.mjs');
const packageJson = JSON.parse(read('../../package.json'));
const workflow = read('../../.github/workflows/api-ci.yml');
const code = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
/** One function's body, from its CREATE to the closing dollar quote. */
const body = (name) => {
  const start = code.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `${name} is defined`);
  const open = code.indexOf('AS $$', start);
  return code.slice(open, code.indexOf('END$$;', open) + 'END$$;'.length);
};
const RECORDER = body('record_session_semantic_commit_instant_v1');
const GUARD = body('guard_session_semantic_commit_instant_mutation_v1');
const OBSERVER = body('server_observe_session_semantic_commits_v1');
const SWEEPER = body('server_observe_unobserved_semantic_commits_v1');

test('0201 follows 0200, forward-only, one transaction, adds one table and four functions and replaces nothing', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  const at = migrations.indexOf(MIGRATION);
  assert.ok(at >= 0, '0201 exists');
  assert.equal(migrations[at - 1], '0200_cosmos_e2_reading_reliance_gate_v1.sql', 'exactly 0201 follows 0200');
  assert.equal(migrations.filter((name) => name.startsWith('0201_')).length, 1);
  assert.doesNotMatch(MIGRATION, /thread|home|establish|spatial|placement/u, 'the name claims no Thread / Home / placement substrate');
  assert.equal((code.match(/^BEGIN;$/gmu) ?? []).length, 1);
  assert.equal((code.match(/^COMMIT;$/gmu) ?? []).length, 1);
  assert.doesNotMatch(code, /CREATE OR REPLACE|\bDROP\s+(?:TABLE|FUNCTION|TRIGGER|INDEX|POLICY|VIEW)\b/u, 'nothing existing is replaced or dropped');
  assert.deepEqual([...code.matchAll(/CREATE TABLE (\S+)/gu)].map((m) => m[1]), ['public.session_semantic_commit_instants']);
  assert.deepEqual([...code.matchAll(/CREATE FUNCTION (public\.\w+)/gu)].map((m) => m[1]).sort(), [
    'public.guard_session_semantic_commit_instant_mutation_v1', 'public.record_session_semantic_commit_instant_v1',
    'public.server_observe_session_semantic_commits_v1', 'public.server_observe_unobserved_semantic_commits_v1']);
  assert.deepEqual([...code.matchAll(/ALTER TABLE (\S+)/gu)].map((m) => m[1]), ['public.session_semantic_commit_instants'],
    'no existing table is altered: the clock gains a trigger, never a column');
  assert.doesNotMatch(code, /^\s*(?:INSERT INTO|UPDATE)\s+public\.session_semantic_clocks/mu, 'the clock is never written here');
});

test('A — the ledger: one row per Session and transaction, an exact chain, xid8 identity, restricted, leaving with its Session', () => {
  assert.match(code, /xact_id xid8 NOT NULL,/u);
  assert.match(code, /covers_from_sp1 boolean GENERATED ALWAYS AS \(from_sp = 0\) STORED,/u);
  assert.match(code, /observed_at timestamptz,\n/u, 'observed_at is NULL until observed');
  assert.match(code, /PRIMARY KEY \(session_id, through_sp, through_event_sequence\)/u);
  assert.match(code, /UNIQUE \(session_id, xact_id\)/u, 'one row per (Session, transaction)');
  assert.match(code, /UNIQUE \(session_id, from_sp, from_event_sequence\)/u, 'no fork');
  assert.match(code, /FOREIGN KEY \(session_id, user_id\) REFERENCES public\.conversation_sessions \(id, user_id\) ON DELETE CASCADE/u);
  assert.match(code, /CHECK \(\(from_sp, from_event_sequence\) < \(through_sp, through_event_sequence\)\)/u);
  assert.match(code, /CHECK \(observed_at IS NULL OR observed_at >= trigger_at\)/u);
  assert.match(code, /ALTER TABLE public\.session_semantic_commit_instants ENABLE ROW LEVEL SECURITY;/u);
  assert.doesNotMatch(code, /CREATE POLICY/u);
  assert.match(code, /REVOKE ALL ON TABLE public\.session_semantic_commit_instants FROM PUBLIC;/u);
  assert.match(code, /ARRAY\['anon', 'authenticated', 'service_role', 'qandeel_replay_media'\]/u);
  assert.doesNotMatch(code, /GRANT [^;]*ON TABLE/u, 'no table privilege is granted to anyone');
});

test('B — the recorder: a deferred row constraint trigger that reads the clock as it stands and keys every decision on transaction identity', () => {
  assert.match(code, /CREATE CONSTRAINT TRIGGER session_semantic_clocks_record_commit_instant\n\s+AFTER UPDATE ON public\.session_semantic_clocks\n\s+DEFERRABLE INITIALLY DEFERRED\n\s+FOR EACH ROW EXECUTE FUNCTION public\.record_session_semantic_commit_instant_v1\(\);/u);
  assert.match(RECORDER, /this_xact xid8 := pg_catalog\.pg_current_xact_id\(\);/u);
  assert.match(RECORDER, /SELECT \* INTO clock_row FROM public\.session_semantic_clocks c WHERE c\.session_id = NEW\.session_id;/u);
  assert.doesNotMatch(RECORDER, /NEW\.(?:current_sp|same_sp_event_sequence)/u, 'NEW is never trusted for the position');
  assert.match(RECORDER, /IF has_latest AND latest\.xact_id = this_xact THEN/u, 'the fold is decided by identity');
  assert.match(RECORDER, /WHERE l\.session_id = clock_row\.session_id AND l\.xact_id = this_xact;/u, 'and targets the transaction\'s own row');
  assert.match(RECORDER, /GET DIAGNOSTICS folded = ROW_COUNT;\n\s+IF folded <> 1 THEN/u, 'a fold that writes nothing fails closed');
  assert.match(RECORDER, /IF \(final_sp, final_sequence\) = \(start_sp, start_sequence\) THEN\n\s+RETURN NULL;/u, 'a no-op records nothing and aborts nothing');
  assert.match(RECORDER, /ELSIF OLD\.current_sp IS NULL THEN\n\s+start_sp := 0;/u, 'the origin');
  assert.match(RECORDER, /start_sp := OLD\.current_sp;\n\s+start_sequence := OLD\.same_sp_event_sequence;/u, 'the deploy boundary');
  assert.equal((RECORDER.match(/RAISE EXCEPTION 'SEMANTIC_COMMIT_INSTANT_INTEGRITY' USING ERRCODE = '55000'/gu) ?? []).length, 3,
    'backwards inside a transaction, a failed fold, a clock behind its ledger: each aborts');
  assert.match(code, /CREATE FUNCTION public\.record_session_semantic_commit_instant_v1\(\) RETURNS trigger\nLANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS \$\$/u,
    'the recorder writes under its own authority: no client role needs a ledger privilege');
});

test('C — the guard: identity, chain, one fold shape, one observation shape, and DELETE only inside the governed erasure', () => {
  assert.match(code, /CREATE TRIGGER session_semantic_commit_instants_guard\n\s+BEFORE INSERT OR UPDATE OR DELETE ON public\.session_semantic_commit_instants/u);
  assert.match(GUARD, /IF pg_catalog\.current_setting\('qandeel\.personal_erasure', true\) = pg_catalog\.txid_current\(\)::text THEN\n\s+IF personal_data_private\.personal_erasure_authorized_v1\(\) THEN RETURN OLD; END IF;/u,
    'the 0130 erasure test, exactly');
  assert.match(GUARD, /IF NEW\.xact_id IS DISTINCT FROM this_xact OR NEW\.observed_at IS NOT NULL THEN/u);
  assert.match(GUARD, /predecessor\.xact_id = NEW\.xact_id/u, 'never a second row for a transaction already in the chain');
  assert.match(GUARD, /\(NEW\.from_sp, NEW\.from_event_sequence\) <> \(predecessor\.through_sp, predecessor\.through_event_sequence\)/u);
  assert.match(GUARD, /IF OLD\.observed_at IS NULL AND NEW\.observed_at IS NOT NULL AND OLD\.xact_id <> this_xact/u, 'observed once, by a later transaction');
  assert.match(GUARD, /IF OLD\.xact_id = this_xact AND NEW\.xact_id = this_xact AND OLD\.observed_at IS NULL AND NEW\.observed_at IS NULL/u, 'folded only by its own transaction');
  assert.match(GUARD, /\(NEW\.through_sp, NEW\.through_event_sequence\) > \(OLD\.through_sp, OLD\.through_event_sequence\)/u, 'forward only');
});

test('D — the observer and the sweeper: service_role only, see-then-stamp, skip the caller\'s own rows, idempotent, wired only as S2 allows', () => {
  for (const fn of [OBSERVER, SWEEPER]) {
    assert.match(fn, /SET observed_at = GREATEST\(pg_catalog\.clock_timestamp\(\), l\.trigger_at\)/u);
    assert.match(fn, /l\.observed_at IS NULL/u, 'a stamped row is never stamped again');
    assert.match(fn, /l\.xact_id <> pg_catalog\.pg_current_xact_id\(\)/u, 'the calling transaction never observes its own rows');
  }
  assert.match(SWEEPER, /IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN/u);
  assert.match(SWEEPER, /FOR UPDATE SKIP LOCKED/u);
  assert.match(code, /FOREACH fn IN ARRAY servers LOOP EXECUTE format\('GRANT EXECUTE ON FUNCTION %s TO service_role', fn\); END LOOP;/u);
  assert.doesNotMatch(code, /GRANT [^;]*TO (?:anon|authenticated)\b/u);
  const apiSources = readdirSync(new URL('../../apps/api/src/', import.meta.url), { recursive: true }).filter((p) => /\.ts$/u.test(p));
  // RE-ANCHORED by RB-2 / S2 (Alternative A, PO direction D-S2-12; scope v1.2 §1): S1 wired nothing. S2 wires exactly one
  // definer - the bounded sweeper - called from one place, the semantic runtime repository, by one worker.
  // Nothing in the API reads the ledger, and nothing ever calls 0201's unbounded per-Session observer.
  const sweepSites = [];
  for (const path of apiSources) {
    const file = path.replace(/\\/gu, '/');
    const text = read(`../../apps/api/src/${file}`);
    assert.doesNotMatch(text, /session_semantic_commit_instants|observe_session_semantic_commits/u, `no ledger read and no per-Session observer: ${file}`);
    if (/observe_unobserved_semantic_commits/u.test(text) && !/\.spec\.ts$/u.test(file)) sweepSites.push(file);
  }
  assert.deepEqual(sweepSites.sort(), ['live-focus/conversation-semantic-runtime.repository.ts', 'live-focus/semantic-commit-sweeper.worker.ts'],
    'the sweeper definer is named only by its repository method and its worker');
  assert.equal(readdirSync(new URL('../migrations/', import.meta.url)).some((name) => name.startsWith('0202_')), false, '0202 is neither S1 nor S2 (it stays with S3)');
});

test('E — no handler, no dynamic SQL, no retryable SQLSTATE in any body (PROD-RETRY-01); the failure of a recording is the failure of the commit', () => {
  for (const [name, fn] of [['recorder', RECORDER], ['guard', GUARD], ['observer', OBSERVER], ['sweeper', SWEEPER]]) {
    assert.doesNotMatch(fn, /\bEXCEPTION\s+WHEN\b/iu, `${name}: no handler`);
    assert.doesNotMatch(fn, /\bEXECUTE\b/u, `${name}: no dynamic SQL`);
    assert.doesNotMatch(fn, /40001|40P01|PT409/u, `${name}: no retryable SQLSTATE`);
    const codes = [...fn.matchAll(/ERRCODE = '([^']+)'/gu)].map((m) => m[1]);
    assert.ok(codes.every((c) => ['55000', '22023'].includes(c)), `${name}: ${codes}`);
  }
  assert.match(code, /RAISE EXCEPTION 'RB-2 S1: % must not hold a handler, dynamic SQL or a retryable SQLSTATE', fn;/u, 'the migration asserts it of itself');
});

test('F — the verifier makes the ten mandatory proofs, the identity proofs and the planted defects; API CI runs it after verify-0200', () => {
  for (const scenario of ['B-01 proof 1/2/10', 'B-02 proof 2', 'B-03 proof 3', 'B-04 proof 4', 'B-05 proof 5', 'B-06 proof 6', 'B-07 proof 7', 'B-08 proof 8',
    'L-01', 'L-02', 'L-03', 'L-04', 'P-05 DIAGNOSTIC']) {
    assert.ok(verifier.includes(`'${scenario}`), `the verifier runs ${scenario}`);
  }
  for (const defect of ['D-01', 'D-02', 'D-02b', 'D-03', 'D-04', 'D-05', 'D-06a', 'D-06b', 'D-07', 'D-08', 'D-09', 'D-10', 'D-11']) {
    assert.ok(verifier.includes(`['${defect} `), `the verifier plants ${defect}`);
  }
  assert.match(verifier, /C-\$\{check\} canonical control passes/u, 'every planted defect has its canonical control');
  assert.doesNotMatch(verifier, /assert\.ok\([^)]*trigger_at\s*[<>]=?\s*[^)]*observed_at|assert\.ok\([^)]*observed_at\s*[<>]=?/u, 'no wall-clock inequality is asserted as an order proof');
  assert.equal(packageJson.scripts['verify:semantic-commit-instants:integration'], 'node --env-file-if-exists=.env database/verify-migration-0201.mjs');
  assert.equal(packageJson.scripts['test:semantic-commit-instants-contract'], 'node --test database/tests/session-semantic-commit-instants-v1.test.mjs');
  const at0200 = workflow.indexOf('run: npm run verify:reading-reliance:integration');
  const at0201 = workflow.indexOf('run: npm run verify:semantic-commit-instants:integration');
  assert.ok(at0200 > 0 && at0201 > at0200, 'API CI runs verify-0201 against real PostgreSQL after verify-0200');
});
