import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

// S8B-07 RB-2 / M-2 — the live call's certified clock marks (migration 0203), under the Product Owner's execution
// authorization "RB-2 / M-2 + S3 PRODUCTION IMPLEMENTATION — Direct Historical Binding" of 2026-11-24 (CP2 / CP4). This
// is the STATIC contract; the behaviour is proven against real PostgreSQL by database/verify-migration-0203.mjs in API CI.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION = '0203_s8b_07_live_call_clock_marks_v1.sql';
const migration = read(`../migrations/${MIGRATION}`);
const verifier = read('../verify-migration-0203.mjs');
const packageJson = JSON.parse(read('../../package.json'));
const workflow = read('../../.github/workflows/api-ci.yml');
const code = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const fn = (name) => {
  const at = code.indexOf(`FUNCTION ${name}(`);
  assert.ok(at >= 0, `${name} exists`);
  const open = code.indexOf('$$', at);
  return code.slice(at, code.indexOf('$$', open + 2) + 2);
};

test('0203 follows 0202, forward-only, one transaction; 0201 stays frozen and the S3 read is untouched', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  const at = migrations.indexOf(MIGRATION);
  assert.equal(migrations[at - 1], '0202_s8b_07_replay_historical_availability_v1.sql', 'exactly 0203 follows 0202');
  assert.equal(migrations.filter((name) => name.startsWith('0203_')).length, 1);
  assert.equal((code.match(/^BEGIN;$/gmu) ?? []).length, 1);
  assert.equal((code.match(/^COMMIT;$/gmu) ?? []).length, 1);
  assert.doesNotMatch(code, /\bDROP\s|ALTER\s+TABLE\s+(?!%s)|CREATE\s+(?:TRIGGER|POLICY|VIEW|ROLE)\b/u, 'nothing is dropped, altered or triggered');
  assert.deepEqual([...code.matchAll(/CREATE OR REPLACE FUNCTION (\S+)\(/gu)].map((m) => m[1]), ['voice_private.replay_call_certified_capture_ms_v1'],
    'the only replaced function is the 0202 seam');
  assert.deepEqual([...code.matchAll(/CREATE TABLE (\S+) \(/gu)].map((m) => m[1]),
    ['voice_private.call_clock_snapshots', 'voice_private.call_clock_marks', 'voice_private.call_clock_cert_ranges']);
  assert.doesNotMatch(code, /server_read_replay_version_availability_v1|session_semantic_clocks_record_commit_instant/u);
  const s1 = read('../migrations/0201_s8b_07_semantic_commit_instants_v1.sql');
  assert.equal(createHash('sha256').update(s1).digest('hex'), '66e01ee577c850fcef6d03cb7d5543d560bc713b76d4c0da2d23e095c69af7d5');
});

test('certification: snapshot visibility of the writer\'s xact, contiguous prefix, write-on-change, min echo', () => {
  const visible = fn('voice_private.call_clock_visible_prefix_v1');
  assert.match(visible, /pg_visible_in_snapshot\(l\.xact_id, p_snapshot\)/u, 'MVCC visibility of the ledger row\'s own transaction');
  assert.match(visible, /WHERE a\.seen AND NOT EXISTS \(SELECT 1 FROM hole h/u, 'the prefix stops at the first unseen row');
  const held = fn('voice_private.call_clock_held_prefix_v1');
  assert.match(held, /m\.echo_capture_ms <= p_echo_capture_ms/u, 'dominance is judged at or before the echo');
  assert.match(held, /u\.e <= p_echo_capture_ms/u);
  const seam = fn('voice_private.replay_call_certified_capture_ms_v1');
  assert.match(seam, /LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''/u);
  assert.equal((seam.match(/min\(/gu) ?? []).length, 2, 'the earliest echo of the marks and of the ranges');
  assert.equal((seam.match(/>= \(p_through_sp, p_through_event_sequence\)/gu) ?? []).length, 2, 'whose prefix reaches the row');
  const slot = fn('public.server_call_clock_slot_v1');
  assert.match(slot, /AND s\.instance_id = p_instance_id\n\s+AND s\.taken_at >= clock_timestamp\(\) - interval '120 seconds'/u,
    'only the instance\'s own, unexpired snapshots certify');
  assert.match(slot, /x\.echo IS NOT NULL AND x\.echo >= 0 AND x\.echo % 20 = 0/u, 'NOCLOCK and malformed echoes are dropped');
  assert.ok(slot.lastIndexOf('pg_current_snapshot()') > slot.lastIndexOf('DELETE FROM'), 'the fresh snapshot is taken last');
  assert.match(fn('voice_private.compact_call_clock_marks_v1'), /c\.state = 'ENDED' FOR SHARE/u, 'only an ENDED call is compacted');
  for (const body of [visible, held, seam, slot, fn('voice_private.compact_call_clock_marks_v1')]) {
    assert.doesNotMatch(body, /observed_at|trigger_at|EXCEPTION\s+WHEN|\bEXECUTE\b|40001|40P01|PT409/u);
  }
});

test('posture: sealed relations, service_role reaches the slot batch only, the marks and ranges registered for erasure', () => {
  assert.deepEqual([...code.matchAll(/GRANT EXECUTE ON FUNCTION (\S+) TO (\w+)/gu)].map((m) => [m[1], m[2]]),
    [['public.server_call_clock_slot_v1(uuid,uuid[],bigint[],integer[],bigint[],bigint[],uuid[])', 'service_role']]);
  assert.doesNotMatch(code, /GRANT [^;]*ON TABLE/u);
  assert.match(code, /\('voice_private\.call_clock_marks', 'ACCOUNT_CASCADE'\),\n\s+\('voice_private\.call_clock_cert_ranges', 'ACCOUNT_CASCADE'\);/u);
  for (const t of ['call_clock_marks', 'call_clock_cert_ranges']) {
    assert.match(code, new RegExp(`CONSTRAINT ${t}_user_fk FOREIGN KEY \\(user_id\\) REFERENCES public\\.users \\(id\\) ON DELETE CASCADE`, 'u'));
    assert.match(code, new RegExp(`CONSTRAINT ${t}_call_fk FOREIGN KEY \\(call_id\\) REFERENCES voice_private\\.calls \\(id\\) ON DELETE CASCADE`, 'u'));
  }
});

test('the verifier proves the acceptance list and the planted defects; API CI runs it after verify-0202', () => {
  for (const s of ['C-01', 'C-02', 'M-01', 'M-02', 'M-03', 'M-04', 'M-05', 'M-06', 'M-07a', 'M-07b', 'M-07c', 'M-08a', 'M-08b', 'M-09',
    'M-10', 'M-11', 'M-12']) assert.ok(verifier.includes(`'${s} `), `the verifier runs ${s}`);
  for (const d of ['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06']) assert.ok(verifier.includes(`['${d} `), `the verifier plants ${d}`);
  assert.equal(packageJson.scripts['verify:live-call-clock-marks:integration'], 'node --env-file-if-exists=.env database/verify-migration-0203.mjs');
  assert.equal(packageJson.scripts['test:live-call-clock-marks-contract'], 'node --test database/tests/live-call-clock-marks-v1.test.mjs');
  const at0202 = workflow.indexOf('run: npm run verify:replay-historical-availability:integration');
  const at0203 = workflow.indexOf('run: npm run verify:live-call-clock-marks:integration');
  assert.ok(at0202 > 0 && at0203 > at0202, 'API CI runs verify-0203 after verify-0202');
  assert.ok(workflow.includes('run: npm run test:live-call-clock-marks-contract'));
});
