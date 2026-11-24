import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

// S8B-07 RB-2 / S3 — the Replay historical availability read (migration 0202), under the Product Owner's execution
// authorization "RB-2 / M-2 + S3 PRODUCTION IMPLEMENTATION — Direct Historical Binding" of 2026-11-24 (CP1). This is the
// STATIC contract; the behaviour — the historical-accuracy acceptance list as it applies to the read, and the planted
// defects — is proven against real PostgreSQL by database/verify-migration-0202.mjs in API CI.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION = '0202_s8b_07_replay_historical_availability_v1.sql';
const migration = read(`../migrations/${MIGRATION}`);
const verifier = read('../verify-migration-0202.mjs');
const packageJson = JSON.parse(read('../../package.json'));
const workflow = read('../../.github/workflows/api-ci.yml');
const code = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const READ = code.slice(code.indexOf('CREATE FUNCTION public.server_read_replay_version_availability_v1('), code.indexOf('END$$;') + 6);

test('0202 follows 0201, forward-only, one transaction, adds two functions, no relation, and replaces nothing', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  const at = migrations.indexOf(MIGRATION);
  assert.ok(at >= 0, '0202 exists');
  assert.equal(migrations[at - 1], '0201_s8b_07_semantic_commit_instants_v1.sql', 'exactly 0202 follows 0201');
  assert.equal(migrations.filter((name) => name.startsWith('0202_')).length, 1);
  assert.equal((code.match(/^BEGIN;$/gmu) ?? []).length, 1);
  assert.equal((code.match(/^COMMIT;$/gmu) ?? []).length, 1);
  assert.doesNotMatch(code, /CREATE OR REPLACE|\bDROP\s|ALTER\s+TABLE|CREATE\s+(?:TABLE|INDEX|TRIGGER|POLICY|VIEW|ROLE)\b/u,
    'no relation, trigger or role is created, and nothing existing is replaced or dropped');
  assert.deepEqual([...code.matchAll(/CREATE FUNCTION (\S+)\(/gu)].map((m) => m[1]),
    ['voice_private.replay_call_certified_capture_ms_v1', 'public.server_read_replay_version_availability_v1']);
});

test('0201 is frozen: byte-identical to the S1 migration merged on main', () => {
  const s1 = read('../migrations/0201_s8b_07_semantic_commit_instants_v1.sql');
  assert.equal(createHash('sha256').update(s1).digest('hex'), '66e01ee577c850fcef6d03cb7d5543d560bc713b76d4c0da2d23e095c69af7d5');
});

test('the read: the completing row SEALS TC; the projection sequence, observed_at and trigger_at are never a coordinate or a time', () => {
  assert.match(READ, /WHERE l\.session_id = v_session AND l\.through_sp > pt\.tc\s+ORDER BY l\.through_sp, l\.through_event_sequence LIMIT 1/u,
    'the completing row is the first row whose through passes TC');
  assert.doesNotMatch(READ, /projection_same_sp_event_sequence|projection_live_head|observed_at|trigger_at/u);
  assert.match(READ, /WHEN v_ledger_rows = 0 OR v_first_from_sp <> 0 THEN 'UNESTABLISHED'/u, 'no ledger or a deploy boundary claims nothing');
  assert.match(READ, /WHEN v_breaks > 0 THEN 'BROKEN'/u, 'a broken chain fails closed');
  assert.match(READ, /derive_replay_version_current_availability_v1/u, 'only a CURRENT version answers');
  assert.match(READ, /resolve_replay_version_audio_plan_v1\(p_user_id, v_version\.id\)/u, 'the runs are the plan the media service mixes');
  assert.match(READ, /AND c\.session_id = v_session AND c\.user_id = p_user_id/u, 'only a call of the version\'s own Session certifies');
  assert.match(READ, /JOIN runs ru ON ru\.rec = ce\.rec AND ru\.b > ce\.x/u, 'a position after a run is never pulled into it');
  assert.match(READ, /ORDER BY ce\.ord, ru\.n, greatest\(ce\.x, ru\.a\)/u, 'the earliest presented placement wins');
  assert.match(READ, /voice_private\.replay_call_certified_capture_ms_v1\(cl\.call, k\.sp, k\.seq\)/u, 'certification comes only from the seam');
  assert.doesNotMatch(READ, /\bEXCEPTION\s+WHEN\b|\bEXECUTE\b|40001|40P01|PT409/u);
  assert.match(code, /CREATE FUNCTION voice_private\.replay_call_certified_capture_ms_v1\([\s\S]*?\$\$\n\s+SELECT NULL::bigint\n\$\$;/u,
    'in 0202 the seam certifies nothing');
});

test('posture: the read to the Replay pool only, the seam to nobody', () => {
  assert.deepEqual([...code.matchAll(/GRANT EXECUTE ON FUNCTION (\S+) TO (\w+)/gu)].map((m) => [m[1], m[2]]),
    [['public.server_read_replay_version_availability_v1(uuid,uuid,uuid)', 'qandeel_replay_media']]);
  assert.doesNotMatch(code, /GRANT [^;]*TO (?:anon|authenticated|service_role|PUBLIC)\b/u);
  assert.match(code, /RAISE EXCEPTION 'RB-2 S3: the Replay pool must reach exactly the read'/u, 'the migration asserts it of itself');
});

test('the verifier proves the acceptance list and the planted defects; API CI runs it after verify-0201', () => {
  for (const scenario of ['C-01', 'C-02', 'A-01', 'A-02', 'A-03', 'A-04', 'A-05a', 'A-05b', 'A-06', 'A-07a', 'A-07b', 'A-08a', 'A-08b',
    'A-09', 'A-10', 'A-11', 'A-12']) {
    assert.ok(verifier.includes(`'${scenario} `), `the verifier runs ${scenario}`);
  }
  for (const defect of ['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06', 'D-07', 'D-08']) {
    assert.ok(verifier.includes(`['${defect} `), `the verifier plants ${defect}`);
  }
  assert.match(verifier, /canonical control passes/u, 'every planted defect has its canonical control');
  assert.equal(packageJson.scripts['verify:replay-historical-availability:integration'], 'node --env-file-if-exists=.env database/verify-migration-0202.mjs');
  assert.equal(packageJson.scripts['test:replay-historical-availability-contract'], 'node --test database/tests/replay-historical-availability-v1.test.mjs');
  const at0201 = workflow.indexOf('run: npm run verify:semantic-commit-instants:integration');
  const at0202 = workflow.indexOf('run: npm run verify:replay-historical-availability:integration');
  assert.ok(at0201 > 0 && at0202 > at0201, 'API CI runs verify-0202 against real PostgreSQL after verify-0201');
  assert.ok(workflow.includes('run: npm run test:replay-historical-availability-contract'), 'API CI runs this static contract');
});
