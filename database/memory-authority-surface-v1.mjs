// Memory mutation authority - the permanent posture every Memory command must hold.
//
// Migration 0026 moved every Memory write behind narrow server commands. Its
// verifier originally proved that by asserting the exact set of functions
// returning public.memories, so the first later legitimate command (W3-MEGA-M's
// server_disable_memory_v1, migration 0128) failed it although it holds exactly
// the 0026 posture. That was a ceiling on future work, not a security invariant.
//
// This module states the invariant instead, as a pure function over catalog
// facts, so it is testable without a database (database/tests/
// memory-authority-surface-v1.test.mjs plants the dangerous shapes it must
// reject). The verifier discovers the subject universe from the catalog - every
// function whose body writes public.memories, or that returns Memory rows - and
// applies these rules to each of them, whatever its name and whenever it was
// added:
//
//   * a Memory writer is owned by postgres, SECURITY DEFINER with an empty
//     search_path, and executable by nobody but its owner and service_role;
//   * it is owner-bound (takes p_user_id uuid) and has no generic interface:
//     no json/jsonb/hstore/record/polymorphic argument and no dynamic SQL;
//   * it never physically deletes Memory, and an UPDATE may only move the
//     lifecycle: status to a literal status and updated_at to the clock - never
//     content, provenance, scoring, owner, version or lineage, and never a
//     caller-chosen status;
//   * a function that returns Memory rows without writing them, if an end-user
//     role can execute it, is SECURITY INVOKER so owner RLS still applies.
//
// Each command's behaviour (ownership, vocabulary, atomicity) stays proved by
// the verifier of the migration that introduced it; this module proves only the
// authority boundary they all share.

export const MEMORY_WRITE = /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.memories\b/iu;
const PHYSICAL_DELETE = /\bDELETE\s+FROM\s+public\.memories\b/iu;
const DYNAMIC_SQL = /\bEXECUTE\b/iu;
const UPDATE_STATEMENT = /\bUPDATE\s+public\.memories\b(?:\s+(?:AS\s+)?(?!SET\b)([a-z_][a-z0-9_]*))?\s+SET\s+([\s\S]*?)(?=\bWHERE\b|\bRETURNING\b|\bFROM\b|;|\$[a-z_]*\$|$)/giu;
const GENERIC_ARGUMENT = /^(?:jsonb?|hstore|record|"any"|any(?:element|array|nonarray|enum|range|multirange|compatible\w*)?)(?:\[\])?$/iu;
const LIFECYCLE_STATUS = new Set(['ACTIVE', 'SUPERSEDED', 'EXPIRED', 'DELETED', 'DISABLED', 'PENDING_CONFIRMATION']);
const CLOCK = /^(?:CURRENT_TIMESTAMP|now\(\))$/iu;
const EXECUTORS = new Set(['postgres', 'service_role']);
const EMPTY_SEARCH_PATH = new Set(['search_path=""', 'search_path=']);

// Splits a SET list on top-level commas (outside parentheses and quotes).
function assignments(list) {
  const parts = []; let depth = 0, quoted = false, start = 0;
  for (let i = 0; i < list.length; i += 1) {
    const c = list[i];
    if (c === "'") quoted = !quoted;
    else if (!quoted && c === '(') depth += 1;
    else if (!quoted && c === ')') depth -= 1;
    else if (!quoted && depth === 0 && c === ',') { parts.push(list.slice(start, i)); start = i + 1; }
  }
  parts.push(list.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function updateViolations(definition) {
  const found = [];
  const statements = [...definition.matchAll(UPDATE_STATEMENT)];
  // Fail closed on any Memory UPDATE this parser cannot read.
  if (statements.length !== (definition.match(/\bUPDATE\s+public\.memories\b/giu) ?? []).length) {
    found.push('unrecognised Memory UPDATE statement');
  }
  for (const [, alias, list] of statements) {
    for (const assignment of assignments(list)) {
      const match = /^(?:([a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)\s*=\s*([\s\S]+)$/iu.exec(assignment);
      if (!match || (match[1] && match[1] !== alias)) { found.push(`unrecognised Memory UPDATE assignment: ${assignment}`); continue; }
      const [, , column, value] = match;
      const literal = /^'([A-Z_]+)'$/u.exec(value.trim());
      if (column === 'status' && literal && LIFECYCLE_STATUS.has(literal[1])) continue;
      if (column === 'updated_at' && CLOCK.test(value.trim())) continue;
      found.push(`Memory UPDATE may only move the lifecycle, not ${column}=${value.trim()}`);
    }
  }
  return found;
}

/**
 * @param {{ name: string, owner: string, definer: boolean, config: string[] | null,
 *   executors: string[], arguments: string, definition: string }} fn
 *   `executors` are the EXECUTE grantees of the effective ACL ('PUBLIC' for grantee 0);
 *   `arguments` is pg_get_function_identity_arguments.
 * @returns {string[]} every violated rule; empty when the writer holds the posture.
 */
export function memoryWriterViolations(fn) {
  const found = [];
  if (fn.owner !== 'postgres') found.push(`owned by ${fn.owner}, not postgres`);
  if (fn.definer !== true) found.push('not SECURITY DEFINER');
  if (!Array.isArray(fn.config) || fn.config.length !== 1 || !EMPTY_SEARCH_PATH.has(fn.config[0])) {
    found.push(`search_path not pinned empty (${JSON.stringify(fn.config)})`);
  }
  for (const executor of fn.executors) if (!EXECUTORS.has(executor)) found.push(`EXECUTE held by ${executor}`);
  const args = fn.arguments.split(',').map((arg) => arg.trim()).filter(Boolean)
    .map((arg) => /^(?:(?:IN|OUT|INOUT|VARIADIC)\s+)?(?:([a-z_][a-z0-9_]*)\s+)?(.+?)(?:\s+DEFAULT\b.*)?$/iu.exec(arg));
  if (!args.some((arg) => arg?.[1] === 'p_user_id' && arg[2] === 'uuid')) found.push('not owner-bound: no p_user_id uuid argument');
  for (const arg of args) if (!arg || GENERIC_ARGUMENT.test(arg[2])) found.push(`generic argument ${arg?.[0] ?? '(unparsed)'}`);
  if (DYNAMIC_SQL.test(fn.definition)) found.push('dynamic SQL (EXECUTE)');
  if (PHYSICAL_DELETE.test(fn.definition)) found.push('physical DELETE of Memory');
  found.push(...updateViolations(fn.definition));
  return found;
}

/**
 * A function that returns Memory rows but does not write them. If an end-user
 * role can run it, it must run as that user so the owner read policy applies.
 * @param {{ definer: boolean, executors: string[] }} fn
 */
export function memoryReaderViolations(fn) {
  const endUser = fn.executors.some((executor) => ['PUBLIC', 'anon', 'authenticated'].includes(executor));
  return endUser && fn.definer ? ['end-user-executable SECURITY DEFINER returns Memory rows past owner RLS'] : [];
}
