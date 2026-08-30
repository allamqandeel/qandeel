// Conversation Session Authority Hardening (migration 0030) adversarial verifier.
//
// Runs against a fully migrated database. It first reconstructs the pre-0030
// permissive Session authority (migration 0002 grants/policies plus the
// migration 0025 ownership-only turn admission) inside a rolled-back savepoint
// to prove the QAN-AUD-08 forgery vulnerability was real, seeds nontrivial
// historical sessions, re-applies the real migration 0030 file inside that
// savepoint, and proves the upgrade preserves every historical row
// byte-identically while removing the permissive authority. It then proves —
// against the live hardened state — that no role holds direct Session DML,
// that session creation is one narrow authenticated command deriving
// owner/status/channel/timestamps server-side, the full status × channel
// turn-admission matrix, that Finding-02 turn authority is intact, and that
// owner SELECT, tenant isolation, and the service-role background read
// privilege survive. Every fixture is rolled back; no data is retained.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const client = new Client({ connectionString: process.env.DATABASE_URL });
let stage = 'connect';

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;

async function identity(role, uid = null) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  await q("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}

async function rejected(operation, codes = ['42501']) {
  await q('SAVEPOINT s');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
  assert.ok(error, 'operation unexpectedly succeeded');
  assert.ok(codes.includes(error.code), `unexpected rejection code ${error.code} (wanted ${codes.join(',')})`);
}

const CREATE_SESSION = 'public.create_conversation_session_v1(uuid)';
const CREATE_TURN = 'public.create_user_conversation_turn(uuid,uuid,text,text)';
const CLAIM = 'public.claim_conversation_turn(uuid,uuid,uuid,text,text)';
const FINALIZE = 'public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid)';
const FAIL = 'public.fail_conversation_turn(uuid,uuid,uuid,uuid,uuid,uuid)';
const CANCEL = 'public.cancel_conversation_turn(uuid,uuid,uuid,uuid,uuid,uuid)';

// Exact pre-0030 definition of create_user_conversation_turn from migration
// 0025: ownership-only session admission, used to reproduce the baseline gap.
const PRE_0030_TURN_FUNCTION = `
CREATE OR REPLACE FUNCTION public.create_user_conversation_turn(
  p_id uuid, p_session_id uuid, p_content text, p_idempotency_key text DEFAULT NULL
) RETURNS SETOF public.conversation_turns
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := auth.uid(); new_row public.conversation_turns;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=u) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_content IS NULL OR length(btrim(p_content))=0 OR length(p_content)>20000 THEN
    RAISE EXCEPTION 'INVALID_CONTENT' USING ERRCODE='22023'; END IF;
  IF p_idempotency_key IS NOT NULL AND (length(p_idempotency_key)<1 OR length(p_idempotency_key)>128) THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY' USING ERRCODE='22023'; END IF;
  INSERT INTO public.conversation_turns(
    id,session_id,user_id,role,status,content,processing_path,routing_reason,source_turn_id,idempotency_key,completed_at
  ) VALUES(p_id,p_session_id,u,'USER','RECEIVED',p_content,NULL,NULL,NULL,p_idempotency_key,NULL)
  RETURNING * INTO new_row;
  RETURN NEXT new_row;
END;$$;`;

const snapshotSessions = async (ids) => rows(
  'SELECT id, to_jsonb(s) snap FROM public.conversation_sessions s WHERE id = ANY($1::uuid[]) ORDER BY id',
  [ids],
);

async function verifyEffectiveAcls() {
  stage = 'effective ACLs';
  const priv = [
    ['authenticated', 'public.conversation_sessions', 'SELECT', true],
    ['authenticated', 'public.conversation_sessions', 'INSERT', false],
    ['authenticated', 'public.conversation_sessions', 'UPDATE', false],
    ['authenticated', 'public.conversation_sessions', 'DELETE', false],
    // The server REST role keeps the background-read SELECT but no direct DML.
    ['service_role', 'public.conversation_sessions', 'SELECT', true],
    ['service_role', 'public.conversation_sessions', 'INSERT', false],
    ['service_role', 'public.conversation_sessions', 'UPDATE', false],
    ['service_role', 'public.conversation_sessions', 'DELETE', false],
    ['anon', 'public.conversation_sessions', 'SELECT', false],
    ['anon', 'public.conversation_sessions', 'INSERT', false],
    ['anon', 'public.conversation_sessions', 'UPDATE', false],
    ['anon', 'public.conversation_sessions', 'DELETE', false],
  ];
  for (const [role, table, p, expected] of priv) {
    const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, table, p]);
    assert.equal(allowed, expected, `${role} ${p} on ${table}`);
  }

  const fn = [
    ['authenticated', CREATE_SESSION, true],
    ['anon', CREATE_SESSION, false],
    ['service_role', CREATE_SESSION, false],
    ['authenticated', CREATE_TURN, true],
    ['anon', CREATE_TURN, false],
    ['service_role', CREATE_TURN, false],
  ];
  for (const [role, signature, expected] of fn) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1,$2,$3) allowed', [role, signature, 'EXECUTE']);
    assert.equal(allowed, expected, `${role} EXECUTE ${signature}`);
  }

  // PUBLIC authority is proven from the catalog ACL, not a fake role: an
  // aclitem whose grantee is empty ("=X/owner") is a PUBLIC grant.
  const [{ acl }] = await rows(
    'SELECT p.proacl::text[] acl FROM pg_proc p WHERE p.oid=$1::regprocedure', [CREATE_SESSION],
  );
  assert.ok(Array.isArray(acl), 'create_conversation_session_v1 has an explicit ACL (default PUBLIC EXECUTE is gone)');
  assert.ok(acl.every((item) => !item.startsWith('=')), 'no PUBLIC EXECUTE on create_conversation_session_v1');
  assert.ok(acl.some((item) => item.startsWith('authenticated=X')), 'authenticated holds exactly EXECUTE');
  assert.ok(acl.every((item) => !item.startsWith('anon=') && !item.startsWith('service_role=')), 'no anon/service_role entry in the session-create ACL');

  const [{ acl: tableAcl }] = await rows(
    "SELECT c.relacl::text[] acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='conversation_sessions'",
  );
  assert.ok((tableAcl ?? []).every((item) => !item.startsWith('=')), 'no PUBLIC grant on conversation_sessions');

  stage = 'policy set';
  const policies = (await rows(
    "SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='conversation_sessions' ORDER BY policyname",
  )).map((r) => r.policyname);
  assert.deepEqual(policies, ['conversation_sessions_select_own'], 'only the owner read policy survives on conversation_sessions');

  stage = 'function definitions';
  for (const signature of [CREATE_SESSION, CREATE_TURN]) {
    const [{ owner, definer, config }] = await rows(
      'SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config FROM pg_proc p WHERE p.oid=$1::regprocedure',
      [signature],
    );
    assert.equal(owner, 'postgres', `${signature} owner`);
    assert.equal(definer, true, `${signature} is SECURITY DEFINER`);
    assert.ok(Array.isArray(config) && config.length === 1 && config[0].startsWith('search_path='), `${signature} hardened search_path`);
  }
  // The RPC signature exposes exactly one uuid parameter: there is no argument
  // through which a caller could choose owner, status, channel, timestamps, or
  // closed_at.
  const [{ nargs, args }] = await rows(
    'SELECT p.pronargs nargs, pg_get_function_identity_arguments(p.oid) args FROM pg_proc p WHERE p.oid=$1::regprocedure',
    [CREATE_SESSION],
  );
  assert.equal(nargs, 1, 'create_conversation_session_v1 takes exactly one argument');
  assert.equal(args, 'p_id uuid', 'the only parameter is the session UUID');
  const [{ def }] = await rows('SELECT pg_get_functiondef($1::regprocedure::oid) def', [CREATE_SESSION]);
  assert.match(def, /auth\.uid\(\)/, 'owner identity is derived from auth.uid()');
  assert.match(def, /'ACTIVE','TEXT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL/, 'ACTIVE/TEXT and DB timestamps are forced');
  const [{ def: turnDef }] = await rows('SELECT pg_get_functiondef($1::regprocedure::oid) def', [CREATE_TURN]);
  assert.match(turnDef, /status<>'ACTIVE' OR session_row\.channel<>'TEXT'/, 'turn admission requires an ACTIVE/TEXT parent');
  assert.match(turnDef, /SESSION_NOT_ACTIVE_TEXT/, 'owned non-admissible parents use the bounded lifecycle error');
}

async function reproduceBaselineAndUpgradePath(owner) {
  stage = 'baseline vulnerability reconstruction';
  await identity('postgres');
  await q('SAVEPOINT baseline');
  // Reconstruct exactly the pre-0030 permissive Session authority from
  // migration 0002 and the pre-0030 (migration 0025) turn admission.
  await q('GRANT INSERT, UPDATE ON public.conversation_sessions TO authenticated');
  await q('CREATE POLICY conversation_sessions_insert_own ON public.conversation_sessions FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()))');
  await q('CREATE POLICY conversation_sessions_update_own ON public.conversation_sessions FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()))');
  await q(`DROP FUNCTION ${CREATE_SESSION}`);
  await q(PRE_0030_TURN_FUNCTION);

  // Explicitly prove the permissive pre-0030 state the upgrade starts from.
  for (const [p, expected] of [['INSERT', true], ['UPDATE', true]]) {
    const [{ allowed }] = await rows("SELECT has_table_privilege('authenticated','public.conversation_sessions',$1) allowed", [p]);
    assert.equal(allowed, expected, `baseline: authenticated ${p} restored`);
  }
  assert.equal((await rows(
    "SELECT count(*)::int n FROM pg_policies WHERE schemaname='public' AND tablename='conversation_sessions' AND policyname IN ('conversation_sessions_insert_own','conversation_sessions_update_own')",
  ))[0].n, 2, 'baseline: permissive write policies restored');

  // Exploit 12.1: an authenticated owner forges a Session at creation with
  // caller-selected lifecycle fields and timestamps.
  await identity('authenticated', owner);
  const forgedSession = randomUUID();
  await q(
    `INSERT INTO public.conversation_sessions(id,user_id,status,channel,created_at,updated_at,last_activity_at,closed_at)
     VALUES($1,$2,'CLOSED','VOICE','2001-02-03T04:05:06Z','2002-03-04T05:06:07Z','2003-04-05T06:07:08Z','2004-05-06T07:08:09Z')`,
    [forgedSession, owner],
  );
  const [forged] = await rows(
    `SELECT status, channel,
            created_at='2001-02-03T04:05:06Z'::timestamptz AS forged_created,
            last_activity_at='2003-04-05T06:07:08Z'::timestamptz AS forged_activity,
            closed_at='2004-05-06T07:08:09Z'::timestamptz AS forged_closed
       FROM public.conversation_sessions WHERE id=$1`,
    [forgedSession],
  );
  assert.equal(forged.status, 'CLOSED', 'baseline: caller chose a forged status');
  assert.equal(forged.channel, 'VOICE', 'baseline: caller chose a forged channel');
  assert.equal(forged.forged_created, true, 'baseline: caller forged created_at');
  assert.equal(forged.forged_activity, true, 'baseline: caller forged last_activity_at');
  assert.equal(forged.forged_closed, true, 'baseline: caller forged closed_at');

  // Exploit 12.2: an authenticated owner rewrites the lifecycle fields of an
  // owned canonical ACTIVE/TEXT session.
  await identity('postgres');
  const rewriteSession = randomUUID();
  await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [rewriteSession, owner]);
  await identity('authenticated', owner);
  await q(
    `UPDATE public.conversation_sessions
        SET status='EXPIRED', channel='VOICE', updated_at='2005-06-07T08:09:10Z',
            last_activity_at='2006-07-08T09:10:11Z', closed_at='2007-08-09T10:11:12Z'
      WHERE id=$1`,
    [rewriteSession],
  );
  const [rewritten] = await rows(
    `SELECT status, channel,
            updated_at='2005-06-07T08:09:10Z'::timestamptz AS rewrote_updated,
            last_activity_at='2006-07-08T09:10:11Z'::timestamptz AS rewrote_activity,
            closed_at='2007-08-09T10:11:12Z'::timestamptz AS rewrote_closed
       FROM public.conversation_sessions WHERE id=$1`,
    [rewriteSession],
  );
  assert.equal(rewritten.status, 'EXPIRED', 'baseline: caller rewrote status');
  assert.equal(rewritten.channel, 'VOICE', 'baseline: caller rewrote channel');
  assert.equal(rewritten.rewrote_updated, true, 'baseline: caller rewrote updated_at');
  assert.equal(rewritten.rewrote_activity, true, 'baseline: caller rewrote last_activity_at');
  assert.equal(rewritten.rewrote_closed, true, 'baseline: caller rewrote closed_at');

  // Exploit 12.3: pre-0030 turn admission accepted CLOSED+TEXT and
  // ACTIVE+VOICE parents.
  await identity('postgres');
  const closedText = randomUUID(), activeVoice = randomUUID();
  await q(
    `INSERT INTO public.conversation_sessions(id,user_id,status,channel,closed_at)
     VALUES($1,$2,'CLOSED','TEXT',CURRENT_TIMESTAMP),($3,$2,'ACTIVE','VOICE',NULL)`,
    [closedText, owner, activeVoice],
  );
  await identity('authenticated', owner);
  for (const [sessionId, label] of [[closedText, 'CLOSED+TEXT'], [activeVoice, 'ACTIVE+VOICE']]) {
    const [turn] = await rows('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), sessionId, 'admitted pre-0030', null]);
    assert.equal(turn.role, 'USER', `baseline: ${label} admitted a USER turn`);
    assert.equal(turn.status, 'RECEIVED', `baseline: ${label} turn is RECEIVED`);
  }

  // Section 21 upgrade path: seed nontrivial historical sessions under the
  // permissive model and capture every column before applying migration 0030.
  stage = 'upgrade-path simulation';
  await identity('postgres');
  const historical = {
    activeText: randomUUID(), idleText: randomUUID(), closedTextHist: randomUUID(),
    expiredText: randomUUID(), activeVoiceHist: randomUUID(),
  };
  await q(
    `INSERT INTO public.conversation_sessions(id,user_id,status,channel,created_at,updated_at,last_activity_at,closed_at) VALUES
      ($1,$6,'ACTIVE','TEXT','2020-01-01T00:00:01Z','2020-01-02T00:00:02Z','2020-01-03T00:00:03Z',NULL),
      ($2,$6,'IDLE','TEXT','2020-02-01T00:00:01Z','2020-02-02T00:00:02Z','2020-02-03T00:00:03Z',NULL),
      ($3,$6,'CLOSED','TEXT','2020-03-01T00:00:01Z','2020-03-02T00:00:02Z','2020-03-03T00:00:03Z','2020-03-04T00:00:04Z'),
      ($4,$6,'EXPIRED','TEXT','2020-04-01T00:00:01Z','2020-04-02T00:00:02Z','2020-04-03T00:00:03Z',NULL),
      ($5,$6,'ACTIVE','VOICE','2020-05-01T00:00:01Z','2020-05-02T00:00:02Z','2020-05-03T00:00:03Z',NULL)`,
    [historical.activeText, historical.idleText, historical.closedTextHist, historical.expiredText, historical.activeVoiceHist, owner],
  );
  const preservedIds = [...Object.values(historical), forgedSession, rewriteSession, closedText, activeVoice];
  const before = await snapshotSessions(preservedIds);
  assert.equal(before.length, preservedIds.length, 'upgrade: all historical fixtures captured');
  const [{ n: beforeCount }] = await rows('SELECT count(*)::int n FROM public.conversation_sessions');

  // Apply the real forward-only migration file. The verifier already runs in a
  // transaction, so the file's own BEGIN/COMMIT wrapper is stripped; every
  // other statement executes verbatim.
  const migrationSql = await readFile(new URL('./migrations/0030_conversation_session_authority_hardening_v1.sql', import.meta.url), 'utf8');
  const body = migrationSql.replace(/^BEGIN;$/m, '').replace(/^COMMIT;\s*$/m, '');
  await q(body);

  stage = 'upgrade-path preservation';
  // Every historical row is byte-identical; nothing was deleted or rewritten.
  const after = await snapshotSessions(preservedIds);
  assert.deepEqual(after, before, 'upgrade: every historical session row is preserved byte-identically');
  const [{ n: afterCount }] = await rows('SELECT count(*)::int n FROM public.conversation_sessions');
  assert.equal(afterCount, beforeCount, 'upgrade: no session row deleted');

  // The permissive authority is gone and the hardened authority works.
  for (const p of ['INSERT', 'UPDATE', 'DELETE']) {
    const [{ allowed }] = await rows("SELECT has_table_privilege('authenticated','public.conversation_sessions',$1) allowed", [p]);
    assert.equal(allowed, false, `upgrade: authenticated ${p} removed`);
  }
  assert.equal((await rows(
    "SELECT count(*)::int n FROM pg_policies WHERE schemaname='public' AND tablename='conversation_sessions' AND policyname IN ('conversation_sessions_insert_own','conversation_sessions_update_own')",
  ))[0].n, 0, 'upgrade: permissive write policies dropped');

  await identity('authenticated', owner);
  const upgraded = randomUUID();
  const [upgradedRow] = await rows('SELECT * FROM create_conversation_session_v1($1)', [upgraded]);
  assert.equal(upgradedRow.status, 'ACTIVE', 'upgrade: narrow create works after migration');
  await rejected(() => q('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), closedText, 'post-upgrade', null]), ['55000']);
  await rejected(() => q('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), activeVoice, 'post-upgrade', null]), ['55000']);
  const [admitted] = await rows('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), historical.activeText, 'post-upgrade admissible', null]);
  assert.equal(admitted.status, 'RECEIVED', 'upgrade: historical ACTIVE/TEXT session still admits turns');

  await identity('postgres');
  await q('ROLLBACK TO SAVEPOINT baseline');
  await q('RELEASE SAVEPOINT baseline');
}

async function verifyDirectSessionDmlRejected(owner, session) {
  stage = 'authenticated direct session attacks';
  await identity('authenticated', owner);
  // Even a fully canonical own-tenant INSERT is denied: creation exists only
  // through the narrow command.
  await rejected(() => q(
    "INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')",
    [randomUUID(), owner],
  ));
  await rejected(() => q(
    `INSERT INTO public.conversation_sessions(id,user_id,status,channel,created_at,closed_at)
     VALUES($1,$2,'CLOSED','VOICE','2001-01-01T00:00:00Z','2001-01-02T00:00:00Z')`,
    [randomUUID(), owner],
  ));
  await rejected(() => q("UPDATE public.conversation_sessions SET status='CLOSED' WHERE id=$1", [session]));
  await rejected(() => q("UPDATE public.conversation_sessions SET channel='VOICE' WHERE id=$1", [session]));
  await rejected(() => q('UPDATE public.conversation_sessions SET updated_at=CURRENT_TIMESTAMP, last_activity_at=CURRENT_TIMESTAMP WHERE id=$1', [session]));
  await rejected(() => q('UPDATE public.conversation_sessions SET closed_at=CURRENT_TIMESTAMP WHERE id=$1', [session]));
  await rejected(() => q('DELETE FROM public.conversation_sessions WHERE id=$1', [session]));

  stage = 'service_role direct session DML';
  await identity('service_role');
  await rejected(() => q(
    "INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')",
    [randomUUID(), owner],
  ));
  await rejected(() => q("UPDATE public.conversation_sessions SET status='CLOSED' WHERE id=$1", [session]));
  await rejected(() => q('DELETE FROM public.conversation_sessions WHERE id=$1', [session]));

  stage = 'anon session authority';
  await identity('anon');
  await rejected(() => q('SELECT * FROM public.conversation_sessions'));
  await rejected(() => q(
    "INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')",
    [randomUUID(), owner],
  ));
  await rejected(() => q('SELECT * FROM create_conversation_session_v1($1)', [randomUUID()]));
}

async function verifyNarrowSessionCreation(owner, other) {
  stage = 'narrow session creation';
  await identity('authenticated', owner);
  const sessionId = randomUUID();
  const [created] = await rows('SELECT * FROM create_conversation_session_v1($1)', [sessionId]);
  assert.equal(created.id, sessionId, 'the exact supplied UUID is used');
  assert.equal(created.user_id, owner, 'owner is derived from auth.uid()');
  assert.equal(created.status, 'ACTIVE');
  assert.equal(created.channel, 'TEXT');
  assert.equal(created.closed_at, null);

  // The timestamps equal the database transaction clock — they are DB-derived,
  // and no parameter exists through which a caller could have supplied them.
  await identity('postgres');
  const [{ derived }] = await rows(
    'SELECT (created_at=now() AND updated_at=now() AND last_activity_at=now()) derived FROM public.conversation_sessions WHERE id=$1',
    [sessionId],
  );
  assert.equal(derived, true, 'created_at/updated_at/last_activity_at are database-derived');

  await identity('authenticated', owner);
  // Duplicate UUID fails atomically through the primary-key unique violation.
  await rejected(() => q('SELECT * FROM create_conversation_session_v1($1)', [sessionId]), ['23505']);
  // Null/malformed input fails closed.
  await rejected(() => q('SELECT * FROM create_conversation_session_v1($1)', [null]), ['22023']);
  await rejected(() => q("SELECT * FROM create_conversation_session_v1('not-a-uuid')"), ['22P02']);
  // A caller with no authenticated subject is rejected before any write.
  await identity('authenticated', null);
  await rejected(() => q('SELECT * FROM create_conversation_session_v1($1)', [randomUUID()]));
  // service_role has no execution path for foreground session creation.
  await identity('service_role');
  await rejected(() => q('SELECT * FROM create_conversation_session_v1($1)', [randomUUID()]));
  // Another tenant calling the command can only ever create its own session:
  // there is no owner parameter to aim at user A.
  await identity('authenticated', other);
  const [foreign] = await rows('SELECT * FROM create_conversation_session_v1($1)', [randomUUID()]);
  assert.equal(foreign.user_id, other, 'the command derives the caller, never a chosen owner');
  assert.notEqual(foreign.user_id, owner);
}

async function verifyAdmissionMatrix(owner, other, otherSession) {
  stage = 'turn admission matrix';
  await identity('postgres');
  const matrix = [
    ['ACTIVE', 'TEXT', true],
    ['IDLE', 'TEXT', false],
    ['CLOSED', 'TEXT', false],
    ['EXPIRED', 'TEXT', false],
    ['ACTIVE', 'VOICE', false],
    ['IDLE', 'VOICE', false],
    ['CLOSED', 'VOICE', false],
    ['EXPIRED', 'VOICE', false],
  ].map(([status, channel, admissible]) => ({ status, channel, admissible, id: randomUUID() }));
  for (const entry of matrix) {
    await q(
      'INSERT INTO public.conversation_sessions(id,user_id,status,channel,closed_at) VALUES($1,$2,$3,$4,$5)',
      [entry.id, owner, entry.status, entry.channel, entry.status === 'CLOSED' ? new Date('2020-06-01T00:00:00Z') : null],
    );
  }
  const beforeMatrix = await snapshotSessions(matrix.map((entry) => entry.id));

  await identity('authenticated', owner);
  let admittedTurn;
  for (const entry of matrix) {
    const label = `${entry.status}+${entry.channel}`;
    if (entry.admissible) {
      const [turn] = await rows('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), entry.id, `admit ${label}`, null]);
      assert.equal(turn.role, 'USER', `${label} admits a USER turn`);
      assert.equal(turn.status, 'RECEIVED', `${label} turn is RECEIVED`);
      admittedTurn = turn;
    } else {
      // Owned but non-admissible: one deterministic bounded error, never the
      // cross-tenant FORBIDDEN.
      await rejected(
        () => q('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), entry.id, `reject ${label}`, null]),
        ['55000'],
      );
    }
  }
  // Cross-user, nonexistent, and null parents keep failing closed as FORBIDDEN
  // (they are indistinguishable, so no tenant existence leaks).
  await rejected(() => q('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), otherSession, 'intrude', null]));
  await rejected(() => q('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), randomUUID(), 'ghost', null]));
  await rejected(() => q('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), null, 'null-session', null]));

  stage = 'admission side effects';
  await identity('postgres');
  // No rejection created a turn, and no session row (including the admitted
  // ACTIVE/TEXT parent) was mutated — no reactivation, channel change, or
  // last_activity_at bookkeeping.
  const afterMatrix = await snapshotSessions(matrix.map((entry) => entry.id));
  assert.deepEqual(afterMatrix, beforeMatrix, 'no session row was mutated by any admission attempt');
  for (const entry of matrix) {
    const [{ n }] = await rows('SELECT count(*)::int n FROM public.conversation_turns WHERE session_id=$1', [entry.id]);
    assert.equal(n, entry.admissible ? 1 : 0, `${entry.status}+${entry.channel} turn count`);
  }
  return admittedTurn;
}

async function verifyTurnRegression(owner, session) {
  stage = 'ACTIVE/TEXT turn regression';
  await identity('authenticated', owner);
  const id = randomUUID();
  const [created] = await rows('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [id, session, 'user says hi', 'idem-0030']);
  assert.equal(created.id, id);
  assert.equal(created.session_id, session);
  assert.equal(created.role, 'USER');
  assert.equal(created.status, 'RECEIVED');
  assert.equal(created.user_id, owner, 'turn identity derives from auth.uid()');
  assert.equal(created.content, 'user says hi');
  assert.equal(created.processing_path, null);
  assert.equal(created.routing_reason, null);
  assert.equal(created.source_turn_id, null);
  assert.equal(created.completed_at, null);
  assert.equal(created.idempotency_key, 'idem-0030');
  // Duplicate idempotency still surfaces the unique violation (PostgREST 409).
  await rejected(() => q('SELECT create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), session, 'again', 'idem-0030']), ['23505']);
  // Content and idempotency validation are unchanged.
  await rejected(() => q('SELECT create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), session, '   ', null]), ['22023']);
  await rejected(() => q('SELECT create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), session, 'x', 'k'.repeat(129)]), ['22023']);
}

async function verifyTurnAuthorityIntact(owner, session) {
  stage = 'migration 0025 turn authority regression';
  const fn = [
    ['authenticated', CREATE_TURN, true], ['service_role', CREATE_TURN, false],
    ['authenticated', CLAIM, false], ['service_role', CLAIM, true],
    ['authenticated', FINALIZE, false], ['service_role', FINALIZE, true], ['anon', FINALIZE, false],
    ['authenticated', FAIL, false], ['service_role', FAIL, true],
    ['authenticated', CANCEL, true], ['anon', CANCEL, false],
  ];
  for (const [role, signature, expected] of fn) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1,$2,$3) allowed', [role, signature, 'EXECUTE']);
    assert.equal(allowed, expected, `${role} EXECUTE ${signature}`);
  }
  const turnPriv = [
    ['authenticated', 'INSERT'], ['authenticated', 'UPDATE'], ['authenticated', 'DELETE'],
    ['service_role', 'INSERT'], ['service_role', 'UPDATE'], ['service_role', 'DELETE'],
  ];
  for (const [role, p] of turnPriv) {
    const [{ allowed }] = await rows("SELECT has_table_privilege($1,'public.conversation_turns',$2) allowed", [role, p]);
    assert.equal(allowed, false, `${role} ${p} on conversation_turns stays revoked`);
  }

  // Behavior spot-check: the server lifecycle still works only for the server
  // role against an admitted turn.
  await identity('authenticated', owner);
  const turnId = randomUUID();
  await rows('SELECT create_user_conversation_turn($1,$2,$3,$4)', [turnId, session, 'lifecycle regression', null]);
  await rejected(() => q('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, turnId, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT']));
  await rejected(() => q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content) VALUES($1,$2,$3,'ASSISTANT','COMPLETED','forged')", [randomUUID(), session, owner]));
  await rejected(() => q("UPDATE public.conversation_turns SET status='COMPLETED' WHERE id=$1", [turnId]));
  await rejected(() => q('DELETE FROM public.conversation_turns WHERE id=$1', [turnId]));
  await identity('service_role');
  const claimed = await rows('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, turnId, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT']);
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].status, 'GENERATING');
  const finalized = await rows('SELECT * FROM finalize_conversation_turn($1,$2,$3,$4,$5,$6,$7,$8,$9)', [session, owner, turnId, randomUUID(), 'server assistant', 'ALLOW', randomUUID(), null, null]);
  assert.equal(finalized.length, 1, 'service_role finalize still works');
}

async function verifyBackgroundSessionRead(owner, session) {
  stage = 'service-role background session read';
  // The background read path keeps its SELECT privilege and the query the
  // background data-api issues stays executable for the server role. Row
  // visibility in managed Supabase additionally comes from the platform's
  // BYPASSRLS attribute on service_role, which the ephemeral CI role does not
  // carry, so this proves the grant and the query path rather than RLS bypass.
  const [{ allowed }] = await rows("SELECT has_table_privilege('service_role','public.conversation_sessions','SELECT') allowed");
  assert.equal(allowed, true, 'service_role keeps SELECT for canonical background reads');
  await identity('service_role');
  const visible = await rows('SELECT id, status, channel FROM public.conversation_sessions WHERE id=$1 AND user_id=$2 LIMIT 1', [session, owner]);
  assert.ok(Array.isArray(visible), 'the background session query executes without a permission error');
}

async function verifyTenantIsolation(owner, other, session, otherSession) {
  stage = 'tenant isolation';
  await identity('authenticated', owner);
  const ownVisible = (await rows('SELECT id, user_id FROM public.conversation_sessions')).map((r) => r.user_id);
  assert.ok(ownVisible.length >= 1, 'owner still reads own sessions');
  assert.ok(ownVisible.every((u) => u === owner), 'owner sees only own sessions');
  assert.equal((await rows('SELECT id FROM public.conversation_sessions WHERE id=$1', [otherSession])).length, 0, 'cross-tenant session stays hidden');
  await identity('authenticated', other);
  const otherVisible = (await rows('SELECT user_id FROM public.conversation_sessions')).map((r) => r.user_id);
  assert.ok(otherVisible.every((u) => u === other), 'other tenant sees only its own sessions');
  assert.equal((await rows('SELECT id FROM public.conversation_sessions WHERE id=$1', [session])).length, 0, 'isolation is symmetric');
}

async function main() {
  try {
    await client.connect();
    await q('BEGIN');
    await identity('postgres');
    const owner = randomUUID(), other = randomUUID();
    const otherSession = randomUUID();
    await q('INSERT INTO auth.users(id) VALUES($1),($2)', [owner, other]);
    await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [otherSession, other]);

    await verifyEffectiveAcls();
    await reproduceBaselineAndUpgradePath(owner);

    // A canonical owned ACTIVE/TEXT session created through the narrow command
    // anchors the hardened-state checks.
    await identity('authenticated', owner);
    const session = randomUUID();
    await rows('SELECT * FROM create_conversation_session_v1($1)', [session]);

    await verifyDirectSessionDmlRejected(owner, session);
    await verifyNarrowSessionCreation(owner, other);
    await verifyAdmissionMatrix(owner, other, otherSession);
    await verifyTurnRegression(owner, session);
    await verifyTurnAuthorityIntact(owner, session);
    await verifyBackgroundSessionRead(owner, session);
    await verifyTenantIsolation(owner, other, session, otherSession);

    await identity('postgres');
    console.log('Verified migration 0030: reproduced the baseline Session forgery and admission gap, proved byte-identical historical preservation across the upgrade, then proved read-only Session tables, one narrow derive-everything creation command, the full ACTIVE/IDLE/CLOSED/EXPIRED x TEXT/VOICE admission matrix, intact Finding-02 turn authority, background read survival, and tenant isolation.');
  } finally {
    try { await q('ROLLBACK'); } catch { /* ignore */ }
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Conversation session authority verification failed at ${stage} (${code}). Connection details were suppressed.`);
  process.exitCode = 1;
});
