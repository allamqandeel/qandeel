// S8B-07 CP1-B (migration 0196): what earlier verifiers that census voice_private count once 0196 is applied.
//
// 0196 adds nine voice_private internals (the transient media guards and helpers), each named by its own ACL block and
// proven by verify-migration-0196; it forward-replaces no earlier function. Derived from the migration text, never copied,
// so an earlier census and 0196 cannot drift.
import { readFileSync } from 'node:fs';

const MIGRATIONS = new URL('./migrations/', import.meta.url);

export const MIGRATION_0196 = '0196_s8b_07_transient_media_v1.sql';

// The voice_private functions 0196 adds (named in its function ACL block and created there).
export function voiceInternals0196() {
  const text = readFileSync(new URL(MIGRATION_0196, MIGRATIONS), 'utf8');
  const acl = text.indexOf('  FOREACH fn IN ARRAY ARRAY[');
  return [...text.slice(acl, text.indexOf('] LOOP', acl)).matchAll(/'(voice_private\.([a-z_0-9]+)\([^']*\))'/gu)]
    .filter((m) => text.includes(`CREATE FUNCTION voice_private.${m[2]}(`)).map((m) => m[1]);
}

// Whether migration 0196 is applied to the database `rows` reads (the probe every re-anchored verifier uses).
export async function transientMediaApplied(rows) {
  const [{ applied }] = await rows("SELECT to_regprocedure('public.server_request_transient_media_v1(uuid,text,uuid,uuid)') IS NOT NULL AS applied");
  return applied;
}
