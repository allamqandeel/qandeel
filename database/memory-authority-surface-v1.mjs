// Memory authority - the permanent cross-version invariants migration 0026 owns.
//
// Migration 0026 closed every client path to Memory writes and moved them
// behind narrow server commands. Its verifier originally proved that with the
// exact set of functions returning public.memories, which failed the first
// legitimate later command (W3-MEGA-M's server_disable_memory_v1, 0128).
//
// Principle: a historical verifier proves the authority invariant it owns;
// later migrations prove their own behavioural contracts. This module is 0026's
// invariant, as a pure function over a catalog snapshot (testable without a
// database: database/tests/memory-authority-surface-v1.test.mjs). It holds for
// every function, in any schema, whenever it was added:
//
//   CLIENT_TABLE_WRITE   anon / authenticated hold no INSERT / UPDATE / DELETE on
//                        public.memories, and anon no SELECT.
//   SERVER_TABLE_WRITE   service_role holds no direct INSERT / UPDATE / DELETE.
//   LEGACY_RPC_REOPENED  only its owner may EXECUTE the legacy supersede_memory.
//   END_USER_WRITER      no Memory writer is executable by PUBLIC, anon or
//                        authenticated.
//   WRITER_SEARCH_PATH   a SECURITY DEFINER Memory writer pins an empty
//                        search_path, so its owner's authority cannot be hijacked.
//   GENERIC_MUTATION     no Memory writer is a generic mutation surface: no
//                        json / jsonb / hstore / record / polymorphic argument, no
//                        dynamic SQL, and no caller-chosen lifecycle status.
//   END_USER_BRIDGE      no end-user-executable SECURITY DEFINER calls a Memory
//                        writer or the legacy RPC, or runs dynamic SQL naming
//                        memories.
//   END_USER_DEFINER_READ no end-user-executable SECURITY DEFINER returns Memory
//                        rows past the owner read policy.
//   CATALOG_SHAPE        the snapshot decoded as expected (fails closed).
//
// What each command does - its owner binding, which columns it moves, lineage,
// atomicity, lifecycle semantics - is proved by the verifier of the migration
// that introduced it (0026 for its three commands, 0128 for
// server_disable_memory_v1). A new narrow server-only command is legal here
// whatever its name, as long as it reopens no client authority and no generic
// mutation surface.

export const MEMORY_WRITE = /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.memories\b/iu;
const DYNAMIC_SQL = /\bEXECUTE\b/iu;
const NAMES_MEMORIES = /\bmemories\b/iu;
const UPDATE_SET = /\bUPDATE\s+public\.memories\b(?:\s+(?:AS\s+)?(?!SET\b)[a-z_][a-z0-9_]*)?\s+SET\s+([\s\S]*?)(?=\bWHERE\b|\bRETURNING\b|\bFROM\b|;|\$[a-z_]*\$|$)/giu;
const GENERIC_ARGUMENT = /^(?:jsonb?|hstore|record|"any"|any(?:element|array|nonarray|enum|range|multirange|compatible\w*)?)(?:\[\])?$/iu;
const END_USERS = ['PUBLIC', 'anon', 'authenticated'];
const EMPTY_SEARCH_PATH = new Set(['search_path=""', 'search_path=']);
const TABLE_WRITES = ['INSERT', 'UPDATE', 'DELETE'];

// A status set from anything but a literal, or inside a multi-column target,
// is a caller-chosen lifecycle.
function callerChosenStatus(definition) {
  const found = [];
  for (const [, list] of definition.matchAll(UPDATE_SET)) {
    if (/\(\s*[^)]*\bstatus\b[^)]*\)\s*=/iu.test(list)) found.push('status is set inside a multi-column assignment');
    for (const [, value] of list.matchAll(/(?:^|,)\s*status\s*=\s*([^,]+)/giu)) {
      if (!/^'[A-Z_]+'$/u.test(value.trim())) found.push(`status is set from ${value.trim()}, not a literal`);
    }
  }
  return found;
}

function argumentTypes(identityArguments) {
  return identityArguments.split(',').map((arg) => arg.trim()).filter(Boolean).map((arg) => {
    const match = /^(?:(?:IN|OUT|INOUT|VARIADIC)\s+)?(?:([a-z_][a-z0-9_]*)\s+)?(.+)$/iu.exec(arg);
    return { text: arg, type: match ? match[2] : arg };
  });
}

/**
 * @typedef {{ signature: string, name: string, owner: string, legacy: boolean, definer: boolean,
 *   config: string[] | null, executors: string[], endUser: boolean, returnsMemory: boolean,
 *   arguments: string, definition: string }} CatalogFunction
 *   `executors`: EXECUTE grantees of the effective ACL ('PUBLIC' for grantee 0);
 *   `endUser`: has_function_privilege for anon or authenticated (covers role membership);
 *   `arguments`: pg_get_function_identity_arguments.
 * @param {{ tablePrivileges: { role: string, privilege: string, allowed: boolean }[], functions: CatalogFunction[] }} catalog
 * @returns {{ subject: string, invariant: string, detail: string }[]}
 */
export function memoryAuthorityViolations(catalog) {
  const violations = [];
  const violate = (subject, invariant, detail) => violations.push({ subject, invariant, detail });

  for (const { role, privilege, allowed } of catalog.tablePrivileges) {
    if (!allowed) continue;
    if (['anon', 'authenticated'].includes(role) && (TABLE_WRITES.includes(privilege) || role === 'anon')) {
      violate('public.memories', 'CLIENT_TABLE_WRITE', `${role} holds ${privilege}`);
    }
    if (role === 'service_role' && TABLE_WRITES.includes(privilege)) {
      violate('public.memories', 'SERVER_TABLE_WRITE', `service_role holds direct ${privilege}`);
    }
  }

  for (const fn of catalog.functions) {
    if (!Array.isArray(fn.executors) || !fn.executors.every((e) => typeof e === 'string')
        || !(fn.config === null || Array.isArray(fn.config)) || typeof fn.definition !== 'string') {
      violate(fn.signature, 'CATALOG_SHAPE', `undecoded catalog facts (executors ${JSON.stringify(fn.executors)}, config ${JSON.stringify(fn.config)})`);
    }
  }
  if (violations.some((v) => v.invariant === 'CATALOG_SHAPE')) return violations;

  const legacy = catalog.functions.filter((fn) => fn.legacy);
  if (legacy.length !== 1) violate('public.supersede_memory', 'CATALOG_SHAPE', `expected the legacy RPC once, found ${legacy.length}`);
  for (const fn of legacy) {
    const others = fn.executors.filter((executor) => executor !== fn.owner);
    if (others.length || fn.endUser) violate(fn.signature, 'LEGACY_RPC_REOPENED', `EXECUTE held by ${others.join(', ') || 'an end-user role'}`);
  }

  const writers = catalog.functions.filter((fn) => !fn.legacy && MEMORY_WRITE.test(fn.definition));
  for (const fn of writers) {
    const endUsers = fn.executors.filter((executor) => END_USERS.includes(executor));
    if (endUsers.length || fn.endUser) violate(fn.signature, 'END_USER_WRITER', `executable by ${endUsers.join(', ') || 'an end-user role'}`);
    if (fn.definer && !(fn.config?.length === 1 && EMPTY_SEARCH_PATH.has(fn.config[0]))) {
      violate(fn.signature, 'WRITER_SEARCH_PATH', `SECURITY DEFINER with search_path ${JSON.stringify(fn.config)}`);
    }
    for (const arg of argumentTypes(fn.arguments)) {
      if (GENERIC_ARGUMENT.test(arg.type)) violate(fn.signature, 'GENERIC_MUTATION', `generic argument ${arg.text}`);
    }
    if (DYNAMIC_SQL.test(fn.definition)) violate(fn.signature, 'GENERIC_MUTATION', 'dynamic SQL (EXECUTE)');
    for (const detail of callerChosenStatus(fn.definition)) violate(fn.signature, 'GENERIC_MUTATION', detail);
  }

  const writerCall = new RegExp(`\\b(?:${[...new Set([...writers.map((fn) => fn.name), 'supersede_memory'])].join('|')})\\s*\\(`, 'iu');
  const writerSet = new Set(writers);
  for (const fn of catalog.functions) {
    if (!fn.endUser || !fn.definer || writerSet.has(fn) || fn.legacy) continue;
    if (writerCall.test(fn.definition)) violate(fn.signature, 'END_USER_BRIDGE', 'calls a Memory writer with its owner\'s authority');
    else if (DYNAMIC_SQL.test(fn.definition) && NAMES_MEMORIES.test(fn.definition)) {
      violate(fn.signature, 'END_USER_BRIDGE', 'runs dynamic SQL naming memories with its owner\'s authority');
    }
    if (fn.returnsMemory) violate(fn.signature, 'END_USER_DEFINER_READ', 'returns Memory rows past the owner read policy');
  }
  return violations;
}

/** One line per violation: the function, the invariant it breaks, and why. */
export function describeViolations(violations) {
  return violations.length
    ? `Memory authority invariant violated:\n${violations.map((v) => `  - ${v.subject}: ${v.invariant} - ${v.detail}`).join('\n')}`
    : 'Memory authority invariants hold';
}
