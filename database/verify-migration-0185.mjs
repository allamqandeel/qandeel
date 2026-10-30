// Real-PostgreSQL verifier for migration 0185 (S8B-02 CP2, Secure Media Lifecycle).
//
//   C0   catalogue: both functions postgres-owned, SECURITY DEFINER, search_path pinned, executable by service_role alone;
//        no new relation and no voice_private function; every scope still DISABLED; 0183's other functions untouched
//   L1   the export listing: exactly the STORED objects of the owner's READABLE recordings - not a pending, discarded,
//        expired, deleted or another human's - each with its stable file name and NO storage key; two recordings of one
//        kind at one instant are told apart; the expiry instant cuts the listing with no worker; a due account erasure
//        hides everything
//   R1   the voice reconciliation: an unknown key, a DISCARDED object's key and every key of an EXPIRED, DELETED or
//        DISCARDED recording are queued; a live key (a STORED object of a live recording, a pending object of a pending
//        note) and a key that is not a voice key are never queued; a key already queued is not queued twice
//
// Every scenario runs in one transaction that is rolled back.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createPersonalReplayRuntime } from './replay-personal-verifier-support.mjs';
import { runVerifier } from './public-runtime-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';

const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows, asRole } = rt;
const owner = () => asRole('postgres');
const LIST = 'public.server_list_voice_recordings_v1(uuid)';
const RECONCILE = 'public.server_enqueue_unknown_voice_media_v1(text[])';

async function server(sql, values = []) {
  await asRole('service_role');
  const result = await rows(sql, values);
  await owner();
  return result;
}
async function human() {
  const id = randomUUID();
  await rt.provisionHumans([id]);
  return id;
}
async function session(user) {
  const id = randomUUID();
  await owner();
  await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [id, user]);
  return id;
}
/** A recording and its objects written directly (fixture surgery; every definer is proven by verify-0183). */
async function note(user, sess, { state = 'STORED', acceptedAgo = '1 hour', objectState = 'STORED', at = null } = {}) {
  const id = randomUUID();
  const key = `voice-note/${randomUUID()}`;
  await owner();
  if (state === 'PENDING_UPLOAD' || state === 'DISCARDED') {
    await q(`INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, begin_command_id, recording_state, upload_deadline)
             VALUES ($1, $2, $3, 'VOICE_NOTE', gen_random_uuid(), 'PENDING_UPLOAD', clock_timestamp() + interval '10 minutes')`, [id, user, sess]);
  } else {
    await q(`WITH n AS (SELECT coalesce($4::timestamptz, clock_timestamp() - $5::interval) AS t)
             INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, begin_command_id, accepted_at,
                                                   retention_expires_at, recording_state)
             SELECT $1, $2, $3, 'VOICE_NOTE', gen_random_uuid(), n.t, n.t + interval '30 days', 'STORED' FROM n`, [id, user, sess, at, acceptedAgo]);
  }
  await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state, content_type,
                                                        byte_size, upload_deadline, stored_at)
           VALUES ($1, 'NOTE', 0, $2, $3, 'audio/mp4', 2048, clock_timestamp() + interval '10 minutes',
                   CASE WHEN $3 = 'STORED' THEN clock_timestamp() END)`, [id, key, state === 'STORED' || state === 'EXPIRED' || state === 'DELETED' ? objectState : 'PENDING_UPLOAD']);
  if (state === 'DISCARDED') {
    await q("UPDATE voice_private.recording_objects SET object_state = 'DISCARDED' WHERE recording_id = $1", [id]);
    await q("UPDATE voice_private.recordings SET recording_state = 'DISCARDED', terminal_at = clock_timestamp() WHERE id = $1", [id]);
  }
  if (state === 'DELETED') {
    await q("UPDATE voice_private.recordings SET recording_state = 'DELETED', deleted_reason = 'OWNER', terminal_at = clock_timestamp() WHERE id = $1", [id]);
  }
  return { id, key };
}
/** A sealed call recording with USER 0, 1 and QANDEEL 0 stored and USER 2 discarded. */
async function sealedCall(user, sess, startedAgo = '1 hour') {
  const id = randomUUID();
  await owner();
  await q(`WITH n AS (SELECT clock_timestamp() - $4::interval AS t)
           INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, call_id, started_at, retention_expires_at,
                                                 recording_state, writer_lease_until)
           SELECT $1, $2, $3, 'LIVE_CALL', gen_random_uuid(), n.t, n.t + interval '30 days', 'RECORDING', clock_timestamp() + interval '60 seconds'
             FROM n`, [id, user, sess, startedAgo]);
  const keys = {};
  for (const [track, index, start, end, state] of [['USER', 0, 0, 1000, 'STORED'], ['USER', 1, 1000, 2000, 'STORED'], ['QANDEEL', 0, 0, 800, 'STORED'],
    ['USER', 2, 2000, 3000, 'PENDING_UPLOAD']]) {
    const key = `voice-call/${randomUUID()}`;
    keys[`${track}${index}`] = key;
    await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state, content_type, byte_size,
                                                          clock_start_ms, clock_end_ms, upload_deadline, stored_at)
             VALUES ($1, $2, $3, $4, $5, 'audio/ogg', 1000, $6, $7, clock_timestamp() + interval '2 minutes', CASE WHEN $5 = 'STORED' THEN clock_timestamp() END)`,
    [id, track, index, key, state, start, end]);
  }
  await q("SELECT voice_private.seal_call_recording_v1($1, 'WRITER')", [id]);
  return { id, keys };
}
const list = (user) => server(`SELECT * FROM ${LIST.replace('(uuid)', '')}($1)`, [user]);
const reconcile = async (keys) => Number((await server('SELECT * FROM public.server_enqueue_unknown_voice_media_v1($1::text[])', [keys]))[0].enqueued);
const queued = async (keys) => (await rows('SELECT storage_key FROM introduction_sharing_private.media_erasure_queue WHERE storage_key = ANY($1::text[]) ORDER BY 1', [keys]))
  .map((r) => r.storage_key);
const stampOf = async (instant) => (await rows(`SELECT to_char($1::timestamptz AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISSUS"Z"') AS s`, [instant]))[0].s;

async function verifyCatalogue(report) {
  await report.section('C0 catalogue: two service_role definers, nothing else added, every gate closed', async () => {
    for (const fn of [LIST, RECONCILE]) {
      const [f] = await rows(`SELECT pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS definer, p.proconfig AS config
                                FROM pg_proc p WHERE p.oid = $1::regprocedure`, [fn]);
      assert.deepEqual([f.owner, f.definer, f.config], ['postgres', true, ['search_path=""']], `C0 ${fn} shape`);
      for (const role of ['anon', 'authenticated', 'service_role']) {
        assert.equal(await rt.canExecute(role, fn), role === 'service_role', `C0 ${role} executes ${fn}: ${role === 'service_role'}`);
      }
      const [{ to_public: toPublic }] = await rows(`SELECT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                                    WHERE p.oid = $1::regprocedure AND a.grantee = 0) AS to_public`, [fn]);
      assert.equal(toPublic, false, `C0 PUBLIC does not execute ${fn}`);
    }
    const cols = (await rows(`SELECT unnest(p.proargnames) AS n FROM pg_proc p WHERE p.oid = $1::regprocedure`, [LIST])).map((r) => r.n);
    assert.equal(cols.some((c) => /key|url/u.test(c)), false, 'C0 the listing returns no key or URL column');
    const [{ n }] = await rows("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace WHERE s.nspname = 'voice_private'");
    assert.equal(n, 20, 'C0 voice_private still holds exactly the twenty 0183 functions');
    const [{ closed }] = await rows(`SELECT count(*)::int closed FROM voice_private.voice_launch_capability_states
                                      WHERE feature_flag_state = 'DISABLED' AND launch_requirements_state = 'UNSATISFIED'`);
    assert.equal(closed, 4, 'C0 all four voice scopes are DISABLED');
  });
}

async function verifyBehaviour(report) {
  await q('BEGIN');
  try {
    await report.isolated('L1 the export listing: readable STORED objects only, named, no key', async () => {
      const [a, b] = [await human(), await human()];
      const [sa, sb] = [await session(a), await session(b)];
      const stored = await note(a, sa);
      const call = await sealedCall(a, sa);
      await note(a, sa, { state: 'PENDING_UPLOAD' });
      await note(a, sa, { state: 'DISCARDED' });
      await note(a, sa, { state: 'DELETED' });
      const expiring = await note(a, sa, { acceptedAgo: '30 days -2 seconds' });
      await note(b, sb);
      // Two notes of one human accepted at the same instant are told apart by recording-id order.
      const at = new Date(Date.now() - 3_600_000).toISOString();
      const twins = [await note(a, sa, { at }), await note(a, sa, { at })].sort((x, y) => (x.id < y.id ? -1 : 1));
      let listed = await list(a);
      assert.equal(listed.some((r) => Object.keys(r).some((k) => /key|url/u.test(k))), false, 'L1 no key or URL in any row');
      assert.equal(JSON.stringify(listed).includes('voice-note/') || JSON.stringify(listed).includes('voice-call/'), false, 'L1 no storage key value');
      const ids = new Set(listed.map((r) => r.recording_id));
      assert.deepEqual([...ids].sort(), [stored.id, call.id, expiring.id, ...twins.map((t) => t.id)].sort(), 'L1 exactly the readable recordings');
      const callRows = listed.filter((r) => r.recording_id === call.id).map((r) => [r.track, r.segment_index, r.content_type]);
      assert.deepEqual(callRows, [['QANDEEL', 0, 'audio/ogg'], ['USER', 0, 'audio/ogg'], ['USER', 1, 'audio/ogg']], 'L1 the STORED segments only, in order');
      const [{ started }] = await rows('SELECT started_at::text AS started FROM voice_private.recordings WHERE id = $1', [call.id]);
      const callStamp = await stampOf(started);
      assert.deepEqual(listed.filter((r) => r.recording_id === call.id).map((r) => r.file_name),
        [`qandeel-voice-call-${callStamp}-qandeel-000000.ogg`, `qandeel-voice-call-${callStamp}-user-000000.ogg`, `qandeel-voice-call-${callStamp}-user-000001.ogg`],
        `L1 the call file names: anchor instant, track and six-digit index (${JSON.stringify(listed.filter((r) => r.recording_id === call.id).map((r) => r.file_name))} vs ${callStamp})`);
      const twinStamp = await stampOf(at);
      assert.deepEqual(twins.map((t) => listed.find((r) => r.recording_id === t.id).file_name),
        [`qandeel-voice-note-${twinStamp}.m4a`, `qandeel-voice-note-${twinStamp}-2.m4a`], 'L1 two notes at one instant are told apart');
      assert.equal(new Set(listed.map((r) => r.file_name)).size, listed.length, 'L1 every file name is unique');
      assert.deepEqual((await list(b)).map((r) => r.recording_id).includes(stored.id), false, 'L1 another human lists nothing of A');
      await q("SELECT pg_sleep(2.5)");
      listed = await list(a);
      assert.equal(listed.some((r) => r.recording_id === expiring.id), false, 'L1 the expiry instant cuts the listing, with no worker');
      const [{ state }] = await rows('SELECT recording_state AS state FROM voice_private.recordings WHERE id = $1', [expiring.id]);
      assert.equal(state, 'STORED', 'L1 (no sweep has run)');
      await owner();
      await q(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
               VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 second')`, [a]);
      assert.deepEqual(await list(a), [], 'L1 a due account erasure hides every recording');
      await assert.rejects(server('SELECT * FROM public.server_list_voice_recordings_v1(NULL)'), /VOICE_REQUEST_INVALID/u);
    });

    await report.isolated('R1 the reconciliation: what is no longer live is queued; a live key never', async () => {
      const a = await human();
      const sa = await session(a);
      const live = await note(a, sa);
      const pending = await note(a, sa, { state: 'PENDING_UPLOAD' });
      const discardedNote = await note(a, sa, { state: 'DISCARDED' });
      const deleted = await note(a, sa, { state: 'DELETED' });
      const expired = await note(a, sa);
      await owner();
      // The guard admits STORED -> EXPIRED only at the expiry (the sweep's own path): written as it is after the sweep.
      await q("SET LOCAL session_replication_role = 'replica'");
      await q("UPDATE voice_private.recordings SET recording_state = 'EXPIRED', terminal_at = clock_timestamp() WHERE id = $1", [expired.id]);
      await q("SET LOCAL session_replication_role = 'origin'");
      const call = await sealedCall(a, sa);
      const unknown = `voice-call/${randomUUID()}`;
      const keys = [live.key, pending.key, discardedNote.key, deleted.key, expired.key, call.keys.USER0, call.keys.USER2, unknown,
        `intro-media/${randomUUID()}`, 'voice-note/not-a-key'];
      // The seal already queued the discarded segment (USER 2); it must not be queued twice.
      const before = await queued(keys);
      assert.deepEqual(before, [call.keys.USER2], 'R1 the seal queued its discarded segment');
      const n = await reconcile(keys);
      const after = await queued(keys);
      assert.deepEqual(after, [discardedNote.key, deleted.key, expired.key, call.keys.USER2, unknown].sort(), 'R1 exactly the keys no longer live');
      assert.equal(n, 4, 'R1 four new rows; the already-queued key is not queued twice');
      assert.equal(after.includes(live.key) || after.includes(pending.key) || after.includes(call.keys.USER0), false, 'R1 a live key is never touched');
      assert.equal(await reconcile(keys), 0, 'R1 a second run queues nothing');
      await assert.rejects(server('SELECT * FROM public.server_enqueue_unknown_voice_media_v1(NULL)'), /VOICE_REQUEST_INVALID/u);
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

runVerifier('0185', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  const report = createScenarioReport('0185', { query: q, restore: () => owner() });
  setStage('catalogue');
  await verifyCatalogue(report);
  setStage('behaviour');
  await verifyBehaviour(report);
  report.print();
  report.assertAllPassed();
}, () => rt.client.end().catch(() => undefined));
