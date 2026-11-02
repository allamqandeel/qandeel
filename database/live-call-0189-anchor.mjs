// S8B-05 CP1 (migration 0189): what the earlier voice verifiers (0183, 0184, 0185, 0186, prove-0185) re-anchor on once
// 0189 is applied.
//
// 0189 makes recordings.call_id the foreign key 0183 left to S8B-05 and hands a call recording's open to the call
// authority: a LIVE_CALL recording now belongs to a voice_private.calls row, and server_open_call_recording_v1 answers
// OPENED only for that row's ACTIVE call with its own session and started_at. Neither the stale-writer recovery nor the
// writer's own seal closes the recording of a call that has not ENDED. 0189 also adds ten voice_private internals (each
// named by its ACL block; no role executes them; verify-migration-0189 proves their shape).
//
// The earlier verifiers prove 0183's recording rules, not the call's: their fixture call is written straight into the
// table (INSERT as CONNECTING, then ACTIVE with the recording's started_at), and `endFixtureCall` marks it ENDED by a plain
// row update, without the authority's end (which seals). A recording whose call is ENDED is exactly the one 0183's rules
// still govern unchanged.
import { readFileSync } from 'node:fs';

export const MIGRATION_0189 = '0189_s8b_05_live_call_authority_v1.sql';

export async function liveCallApplied(rows) {
  const [{ applied }] = await rows("SELECT to_regclass('voice_private.calls') IS NOT NULL AS applied");
  return applied;
}

/** The voice_private functions 0189's ACL block names (ten). */
export function voiceInternals0189() {
  const text = readFileSync(new URL(`./migrations/${MIGRATION_0189}`, import.meta.url), 'utf8');
  const acl = text.indexOf('  FOREACH fn IN ARRAY ARRAY[');
  return [...text.slice(acl, text.indexOf('] LOOP', acl)).matchAll(/'(voice_private\.[a-z_0-9]+\([^']*\))'/gu)].map((m) => m[1]);
}

/**
 * Writes the call a fixture recording belongs to, as the table owner: CONNECTING, then ACTIVE with `startedAt` (a Date,
 * an ISO string or a SQL timestamptz value). `query(text, values)` runs on the fixture's connection. Returns the call id.
 * Before 0189 there is no call table and the id is returned unchanged.
 */
export async function fixtureCall(query, rows, { id, user, session, startedAt, client = id }) {
  if (!(await liveCallApplied(rows))) return id;
  await query(`INSERT INTO voice_private.calls (id, user_id, session_id, client_instance_id, state, connection_epoch, created_at,
                 connect_deadline, seat_lease_until)
               VALUES ($1, $2, $3, $4, 'CONNECTING', 1, least(clock_timestamp(), $5::timestamptz) - interval '1 second',
                 clock_timestamp() + interval '15 seconds', clock_timestamp() + interval '20 seconds')`,
  [id, user, session, client, startedAt]);
  await query("UPDATE voice_private.calls SET state = 'ACTIVE', started_at = $2::timestamptz WHERE id = $1", [id, startedAt]);
  return id;
}

/** Marks a fixture call ENDED by a plain row update: its recording is left exactly as it was (no seal). */
export async function endFixtureCall(query, rows, id, reason = 'USER_ENDED') {
  if (!(await liveCallApplied(rows))) return;
  await query(`UPDATE voice_private.calls SET state = 'ENDED', end_reason = $2, ended_at = clock_timestamp(), grace_until = NULL,
                 seat_lease_until = NULL WHERE id = $1 AND state <> 'ENDED'`, [id, reason]);
}
