// S8B-07 RB-2 (migrations 0202 and later): what earlier verifiers that census voice_private count once RB-2 is applied.
//
// 0202 adds one voice_private internal (the certification seam `replay_call_certified_capture_ms_v1`, executable by no
// role), created there and named by its own ACL block; verify-migration-0202 proves its shape. Derived from the migration
// text, never copied, so an earlier census and RB-2 cannot drift.
import { readFileSync } from 'node:fs';

const MIGRATIONS = new URL('./migrations/', import.meta.url);

export const MIGRATION_0202 = '0202_s8b_07_replay_historical_availability_v1.sql';

/** The voice_private functions a migration CREATES (a CREATE OR REPLACE of an earlier one is not new). */
function created(file) {
  const text = readFileSync(new URL(file, MIGRATIONS), 'utf8');
  return [...text.matchAll(/^CREATE FUNCTION (voice_private\.[a-z_0-9]+)\(([^)]*)\)/gmu)].map((m) => m[1]);
}

/** The voice_private functions 0202 adds, as regprocedure text (named in its ACL block and created there). */
export function voiceInternals0202() {
  const text = readFileSync(new URL(MIGRATION_0202, MIGRATIONS), 'utf8');
  const names = created(MIGRATION_0202);
  const acl = text.indexOf('  FOREACH fn IN ARRAY ARRAY[');
  return [...text.slice(acl, text.indexOf('] LOOP', acl)).matchAll(/'(voice_private\.([a-z_0-9]+)\([^']*\))'/gu)]
    .filter((m) => names.includes(`voice_private.${m[2]}`)).map((m) => m[1]);
}

/** Whether migration 0202 is applied to the database `rows` reads. */
export async function historicalAvailabilityApplied(rows) {
  const [{ applied }] = await rows("SELECT to_regprocedure('public.server_read_replay_version_availability_v1(uuid,uuid,uuid)') IS NOT NULL AS applied");
  return applied;
}

// S8B-07 RB-2 / M-2 (migration 0203): three more voice_private internals (the held / visible prefixes and the
// compaction), created there and named by its function ACL block; 0203's CREATE OR REPLACE of 0202's seam is not new.
// verify-migration-0203 proves their shape.
export const MIGRATION_0203 = '0203_s8b_07_live_call_clock_marks_v1.sql';

/** The voice_private functions 0203 adds, as regprocedure text. */
export function voiceInternals0203() {
  const text = readFileSync(new URL(MIGRATION_0203, MIGRATIONS), 'utf8');
  const names = created(MIGRATION_0203);
  const acl = text.indexOf('  FOREACH fn IN ARRAY ARRAY[');
  return [...text.slice(acl, text.indexOf('] LOOP', acl)).matchAll(/'(voice_private\.([a-z_0-9]+)\([^']*\))'/gu)]
    .filter((m) => names.includes(`voice_private.${m[2]}`)).map((m) => m[1]);
}

/** Whether migration 0203 is applied to the database `rows` reads. */
export async function clockMarksApplied(rows) {
  const [{ applied }] = await rows("SELECT to_regprocedure('public.server_call_clock_slot_v1(uuid,uuid[],bigint[],integer[],bigint[],bigint[],uuid[])') IS NOT NULL AS applied");
  return applied;
}
