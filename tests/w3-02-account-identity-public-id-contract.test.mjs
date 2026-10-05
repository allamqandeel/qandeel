import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// W3-02 — Account & Identity Foundation + Public ID v1 (E2E-D-09; E2E-D-02 advances only). Static contract.
//
// The behaviour is proven where it runs:
//   database/verify-migration-0125.mjs                                   (real PostgreSQL, API CI)
//   apps/api/src/account/public-id.spec.ts                               (the API boundary)
//   apps/mobile/src/settings/__tests__/public-id-controller.test.ts      (the one change is never guessed)
//   apps/mobile/src/settings/__tests__/public-id-settings.test.tsx       (AR / EN Product surface)
//   apps/mobile/src/integration/__tests__/w3-02-public-id.test.tsx       (the production phase surface)
// This gate guards what must be true BY CONSTRUCTION. Every predicate that carries a critical invariant is shown
// to reject a planted defect before it is trusted. No whole-file hash.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const readJson = (path) => JSON.parse(read(path));
/** Code only: a comment may name a forbidden thing in order to forbid it. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`])\/\/[^\n]*/gu, '$1');
/** SQL without its `--` comments. */
const sql = (text) => text.replace(/--[^\n]*/gu, '');

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(join(rootPath, dir)).sort()) {
    const full = `${dir}/${entry}`;
    if (statSync(join(rootPath, full)).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

/** `predicate(corpus)` must be true, and `predicate(corpus + defect)` must be false. */
function guards(name, corpus, predicate, defect) {
  assert.equal(predicate(corpus), true, `${name}: the real source must satisfy the invariant`);
  assert.equal(predicate(`${corpus}\n${defect}\n`), false, `${name}: the guard does not reject its own planted defect`);
}

/** The body of one SQL function, `AS $$ … $$`, the LAST definition by that schema-qualified name. */
function functionBody(text, qualified) {
  const at = text.lastIndexOf(`CREATE FUNCTION ${qualified}(`);
  assert.ok(at >= 0, `${qualified} is defined`);
  const open = text.indexOf('$$', at);
  const close = text.indexOf('$$;', open + 2);
  return text.slice(open + 2, close);
}

/** Every function definition: its schema, name and header (everything before `AS $$`). */
const definitions = (text) => [...text.matchAll(/CREATE FUNCTION (\w+)\.(\w+)\(([\s\S]*?)AS \$\$/gu)]
  .map((m) => ({ schema: m[1], name: m[2], header: m[3] }));

const PRIVATE = 'account_private';

const MIGRATION = 'database/migrations/0125_account_public_id_v1.sql';
const VERIFIER = 'database/verify-migration-0125.mjs';
const API = 'apps/api/src/account';
const SRC = 'apps/mobile/src';
const SETTINGS_DIR = `${SRC}/settings`;
const SETTINGS = `${SETTINGS_DIR}/SettingsSurface.tsx`;
const SECTION = `${SETTINGS_DIR}/PublicIdSection.tsx`;
const CONTROLLER = `${SETTINGS_DIR}/public-id-controller.ts`;
const GRAMMAR = `${SETTINGS_DIR}/public-id.ts`;
const COPY = `${SETTINGS_DIR}/copy.ts`;
const ACCOUNT_API = `${SRC}/runtime-entry/account/account-api.ts`;
const RECORD = 'docs/e2e/QANDEEL_W3_02_ACCOUNT_IDENTITY_PUBLIC_ID_IMPLEMENTATION_RECORD_v1.md';

const migration = read(MIGRATION);
const migrationSql = sql(migration);
const PRODUCTION = listFiles(SRC).filter((file) => /\.tsx?$/u.test(file) && !/__tests__|__fixtures__|__validation__/u.test(file));
const productionCode = Object.fromEntries(PRODUCTION.map((file) => [file, code(read(file))]));

// ---------------------------------------------------------------------------------------------------------
// The database is the authority
// ---------------------------------------------------------------------------------------------------------

test('0125 is the next migration, additive and forward-only, on the canonical account row', () => {
  const names = readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql')).sort();
  // Re-anchored by W3-MEGA-U U2: 0125 was the next migration when W3-02 landed; later ones (0126 onward) follow it.
  // The permanent claim is that 0125 directly follows 0124 and is W3-02's alone.
  assert.equal(names[names.indexOf('0124_login_id_sign_in_resolution_v1.sql') + 1], '0125_account_public_id_v1.sql');
  assert.equal(names.filter((name) => name.startsWith('0125_')).length, 1);
  assert.match(migrationSql, /ALTER TABLE public\.users\n\s*ADD COLUMN public_id text,\n\s*ADD COLUMN public_id_changed_at timestamptz,\n\s*ADD COLUMN public_id_change_command_id uuid;/u);
  assert.doesNotMatch(migrationSql, /DROP (?:TABLE|COLUMN|FUNCTION|TRIGGER|POLICY)|CREATE OR REPLACE|ALTER COLUMN (?!public_id SET NOT NULL)/u, 'nothing existing is dropped or replaced');
});

test('the Public ID is its OWN value: never user_id, Login ID, Name, Email or the internal Public ref', () => {
  const generator = functionBody(migrationSql, `${PRIVATE}.generate_public_id_v1`);
  const assign = functionBody(migrationSql, `${PRIVATE}.assign_public_id_v1`);
  const independent = (text) => {
    const gen = functionBody(text, `${PRIVATE}.generate_public_id_v1`);
    const asg = functionBody(text, `${PRIVATE}.assign_public_id_v1`);
    const grd = functionBody(text, `${PRIVATE}.guard_public_id_lifetime_change_v1`);
    // The ONE excluded value only ever REJECTS a candidate; nothing is built from it.
    const excludedUses = gen.match(/p_excluded/gu) ?? [];
    return /CREATE FUNCTION account_private\.generate_public_id_v1\(p_excluded text\)\n/u.test(text) &&
      excludedUses.length === 1 && /IF v_candidate IS DISTINCT FROM p_excluded\n/u.test(gen) &&
      !/\b(?:login_id|name|email|auth_subject|raw_user_meta_data|phone)\b|u\.id\b|NEW\.id|public_identit/u.test(gen) &&
      /NEW\.public_id := account_private\.generate_public_id_v1\(NEW\.login_id\);/u.test(asg) &&
      !/NEW\.public_id := (?!account_private\.generate_public_id_v1\(NEW\.login_id\))/u.test(asg + grd) &&
      !/public_identit/u.test(sql(text));
  };
  assert.ok(generator.length > 200 && assign.length > 20);
  guards('public-id-is-not-user-id', migrationSql, independent, 'CREATE FUNCTION account_private.assign_public_id_v1() RETURNS trigger AS $$ BEGIN NEW.public_id := NEW.id::text; RETURN NEW; END; $$;');
  guards('public-id-is-not-login-id', migrationSql, independent, 'CREATE FUNCTION account_private.generate_public_id_v1(p_excluded text)\nRETURNS text AS $$ SELECT u.login_id FROM public.users u; $$;');
  guards('public-id-built-from-the-excluded-login-id', migrationSql, independent,
    "CREATE FUNCTION account_private.generate_public_id_v1(p_excluded text)\nRETURNS text AS $$ BEGIN IF v_candidate IS DISTINCT FROM p_excluded\n THEN RETURN p_excluded || '1'; END IF; END; $$;");
  guards('public-id-is-not-the-internal-public-ref', migrationSql, independent, 'UPDATE public.users u SET public_id = i.public_identity_ref::text FROM public.public_identities i WHERE i.user_id = u.id;');
});

test('Public ID and the SAME account’s Login ID are never equal — a database rule, same-row only, never an oracle', () => {
  // 1. The row rule itself, validated, never withdrawn.
  const rowRule = (text) => /ADD CONSTRAINT users_public_id_not_own_login_id_check\n\s*CHECK \(login_id IS NULL OR public_id <> login_id\);/u.test(text) &&
    !/DROP CONSTRAINT[^;]*users_public_id_not_own_login_id_check|NOT VALID/u.test(text);
  guards('missing-own-login-id-inequality-invariant', migrationSql, rowRule, 'ALTER TABLE public.users DROP CONSTRAINT users_public_id_not_own_login_id_check;');
  guards('own-login-id-invariant-not-validated', migrationSql, rowRule, 'ALTER TABLE public.users ADD CONSTRAINT x CHECK (true) NOT VALID;');

  // 2. The manual change answers INVALID for the caller's own Login ID, before anything is consumed or written.
  const manual = (text) => {
    const body = functionBody(text, `${PRIVATE}.change_own_public_id_v1`);
    const own = body.indexOf("IF v_requested = v_account.login_id THEN\n        RETURN QUERY SELECT 'INVALID'::text, v_account.public_id, v_account.public_id_changed_at IS NULL;");
    return own > 0 && own > body.indexOf("'UNCHANGED'") && own < body.indexOf("'ALREADY_USED'") && own < body.indexOf('UPDATE public.users');
  };
  guards('manual-change-allows-own-login-id', migrationSql, manual,
    "CREATE FUNCTION account_private.change_own_public_id_v1(p_command_id uuid, p_public_id text)\nRETURNS TABLE (outcome text) AS $$ BEGIN IF v_requested = v_account.public_id THEN RETURN QUERY SELECT 'UNCHANGED'; END IF; UPDATE public.users SET public_id = v_requested; END; $$;");

  // 3. Every draw — backfill, new account, sign-up redraw — excludes the SAME row's Login ID.
  const everyDrawExcludesOwn = (text) => {
    // (The definition and the REVOKEs name the signature, not a draw.)
    const calls = [...text.matchAll(/generate_public_id_v1\(([^)]*)\)/gu)].map((m) => m[1]).filter((arg) => arg !== 'p_excluded text' && arg !== 'text');
    return calls.length === 3 && calls.every((arg) => /^(?:NEW|v_account)\.login_id$/u.test(arg)) &&
      /IF OLD\.login_id IS NULL AND NEW\.login_id IS NOT NULL\n\s*AND NEW\.login_id = OLD\.public_id\n/u.test(functionBody(text, `${PRIVATE}.guard_public_id_lifetime_change_v1`));
  };
  // The redraw is sign-up only: the row born in this transaction AND the write from inside a trigger.
  const redrawIsSignUpOnly = (text) => /AND OLD\.created_at = CURRENT_TIMESTAMP\n\s*AND pg_trigger_depth\(\) > 1 THEN\n\s*NEW\.public_id := account_private\.generate_public_id_v1\(NEW\.login_id\);/u
    .test(functionBody(text, `${PRIVATE}.guard_public_id_lifetime_change_v1`));
  guards('redraw-reachable-by-a-direct-write', migrationSql, redrawIsSignUpOnly,
    'CREATE FUNCTION account_private.guard_public_id_lifetime_change_v1()\nRETURNS trigger AS $$ BEGIN IF OLD.login_id IS NULL AND NEW.login_id = OLD.public_id THEN\n NEW.public_id := account_private.generate_public_id_v1(NEW.login_id); END IF; RETURN NEW; END; $$;');
  guards('initial-assignment-can-equal-own-login-id', migrationSql, everyDrawExcludesOwn,
    'CREATE FUNCTION account_private.assign_public_id_v1() RETURNS trigger AS $$ BEGIN NEW.public_id := account_private.generate_public_id_v1(NULL); RETURN NEW; END; $$;');
  guards('backfill-can-equal-own-login-id', migrationSql, everyDrawExcludesOwn,
    'UPDATE public.users SET public_id = account_private.generate_public_id_v1(NULL) WHERE id = v_account.id;');

  // 4 + 5. Login IDs are read ONLY from the row being written or the caller's own locked row — never searched,
  // never compared across accounts, never used to decide availability.
  const sameRowOnly = (text) => {
    const rest = text
      .replace('CHECK (login_id IS NULL OR public_id <> login_id);', '')
      .replace('SELECT u.id, u.login_id FROM public.users u WHERE u.public_id IS NULL ORDER BY u.id LOOP', '');
    return [...rest.matchAll(/(\w+\.)?login_id\b/gu)].every((m) => ['NEW.', 'OLD.', 'v_account.'].includes(m[1]));
  };
  guards('cross-account-login-id-lookup', migrationSql, sameRowOnly,
    'IF EXISTS (SELECT 1 FROM public.users o WHERE o.login_id = v_requested) THEN RETURN QUERY SELECT \'INVALID\'; END IF;');
  guards('another-users-login-id-decides-availability', migrationSql, sameRowOnly,
    "IF EXISTS (SELECT 1 FROM public.users u WHERE u.login_id = v_requested AND u.id <> v_user) THEN RETURN QUERY SELECT 'UNAVAILABLE'; END IF;");
  guards('login-id-namespace-scan', migrationSql, sameRowOnly, 'SELECT login_id FROM public.users;');
});

test('no W3-02 SECURITY DEFINER in an exposed schema; the Product RPCs are INVOKER; no broad private grant', () => {
  // 6. Exposed = `public` (and Supabase's `graphql_public`). Every W3-02 function there says INVOKER explicitly;
  // every DEFINER lives in the non-exposed schema this migration creates.
  const boundary = (text) => {
    const defs = definitions(text);
    return /CREATE SCHEMA account_private;\nREVOKE ALL ON SCHEMA account_private FROM PUBLIC;/u.test(text) &&
      defs.filter((d) => d.schema !== PRIVATE).every((d) => d.schema === 'public' && /SECURITY INVOKER/u.test(d.header) && !/SECURITY DEFINER/u.test(d.header)) &&
      defs.filter((d) => /SECURITY DEFINER/u.test(d.header)).every((d) => d.schema === PRIVATE) &&
      defs.filter((d) => d.schema === 'public').map((d) => d.name).sort().join(',') === 'change_own_public_id_v1,read_own_public_id_v1';
  };
  guards('definer-in-exposed-schema', migrationSql, boundary,
    "CREATE FUNCTION public.change_own_public_id_v1(p_command_id uuid, p_public_id text)\nRETURNS TABLE (outcome text)\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = ''\nAS $$ BEGIN END; $$;");
  guards('definer-helper-in-exposed-schema', migrationSql, boundary,
    "CREATE FUNCTION public.generate_public_id_v1(p_excluded text)\nRETURNS text\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = ''\nAS $$ BEGIN END; $$;");
  // Every definition, private included, pins an empty search_path.
  for (const d of definitions(migrationSql)) assert.match(d.header, /SET search_path = ''\n$/u, `${d.schema}.${d.name} pins search_path`);
  // The INVOKER Product change is ONLY a pass-through to the private implementation.
  assert.match(functionBody(migrationSql, 'public.change_own_public_id_v1'),
    /^\n\s*SELECT c\.outcome, c\.current_public_id, c\.change_available\n\s*FROM account_private\.change_own_public_id_v1\(p_command_id, p_public_id\) c;\n$/u);

  // 7. The grant set is EXACT: one schema USAGE, one private function, two Product functions — all to `authenticated`.
  const exactGrants = (text) => [...text.matchAll(/GRANT ([^;]+);/gu)].map((m) => m[1]).join(' | ') ===
    'USAGE ON SCHEMA account_private TO authenticated | EXECUTE ON FUNCTION account_private.change_own_public_id_v1(uuid, text) TO authenticated' +
    ' | EXECUTE ON FUNCTION public.read_own_public_id_v1() TO authenticated | EXECUTE ON FUNCTION public.change_own_public_id_v1(uuid, text) TO authenticated';
  guards('broad-private-function-grant', migrationSql, exactGrants, 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA account_private TO authenticated;');
  guards('private-schema-usage-for-anon', migrationSql, exactGrants, 'GRANT USAGE ON SCHEMA account_private TO anon;');
  guards('private-helper-granted-to-a-client', migrationSql, exactGrants, 'GRANT EXECUTE ON FUNCTION account_private.generate_public_id_v1(text) TO authenticated;');
  // Every private function is default-deny by name, and the server channel is refused the schema too.
  for (const d of definitions(migrationSql)) {
    assert.match(migrationSql, new RegExp(`REVOKE ALL ON FUNCTION ${d.schema}\\.${d.name}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`, 'u'), `${d.schema}.${d.name} revokes by name`);
  }
  assert.match(migrationSql, /EXECUTE 'REVOKE ALL ON SCHEMA account_private FROM service_role';/u);
  // Nothing in the repository configures the private schema as exposed, and the database record says so.
  const readme = read('database/README.md');
  assert.doesNotMatch(readme, /db_schemas[^\n]*account_private|Exposed schemas[^\n]*account_private/u);
  assert.match(readme, /That schema is created here and exposed nowhere\./u);
});

test('uniqueness and normalization are database rules', () => {
  const unique = (text) => /CREATE UNIQUE INDEX users_public_id_key ON public\.users \(public_id\);/u.test(text) && !/DROP INDEX[^;]*users_public_id_key/u.test(text);
  guards('missing-uniqueness', migrationSql, unique, 'DROP INDEX public.users_public_id_key;');
  assert.match(migrationSql, /ALTER TABLE public\.users ALTER COLUMN public_id SET NOT NULL;/u, 'every account has one');
  assert.match(migrationSql, /public_id ~ '\^\[a-z\]\[a-z0-9\]\*\(\[\._\]\[a-z0-9\]\+\)\*\$'/u, 'the canonical lowercase shape is a CHECK');
  assert.match(functionBody(migrationSql, `${PRIVATE}.normalize_public_id_v1`), /lower\(translate\(regexp_replace\(btrim\(p_value\), '\^@', ''\),/u);
  // The mobile mirror says exactly what the database says.
  const grammar = code(read(GRAMMAR));
  assert.match(grammar, /PUBLIC_ID_PATTERN = \/\^\[a-z\]\[a-z0-9\]\*\(\?:\[\._\]\[a-z0-9\]\+\)\*\$\/u;/u);
  assert.match(grammar, /PUBLIC_ID_MIN_LENGTH = 3;/u);
  assert.match(grammar, /PUBLIC_ID_MAX_LENGTH = 24;/u);
  assert.match(migrationSql, /char_length\(public_id\) BETWEEN 3 AND 24/u);
});

test('exactly ONE lifetime manual change, enforced by the database itself — not by the UI', () => {
  const guard = functionBody(migrationSql, `${PRIVATE}.guard_public_id_lifetime_change_v1`);
  const oneChange = (text) => {
    const body = functionBody(text, `${PRIVATE}.guard_public_id_lifetime_change_v1`);
    return /IF OLD\.public_id_changed_at IS NULL\n\s*AND NEW\.public_id_changed_at IS NOT NULL\n\s*AND NEW\.public_id_change_command_id IS NOT NULL\n\s*AND NEW\.public_id IS DISTINCT FROM OLD\.public_id THEN/u.test(body) &&
      /RAISE EXCEPTION 'PUBLIC_ID_LIFETIME_CHANGE_VIOLATION'/u.test(body) &&
      /CREATE TRIGGER guard_public_id_lifetime_change\n\s*BEFORE UPDATE ON public\.users/u.test(text) &&
      !/DROP TRIGGER[^;]*guard_public_id_lifetime_change|DISABLE TRIGGER/u.test(text);
  };
  assert.ok(guard.length > 100);
  guards('more-than-one-manual-change', migrationSql, oneChange,
    'CREATE FUNCTION account_private.guard_public_id_lifetime_change_v1()\nRETURNS trigger AS $$ BEGIN RETURN NEW; END; $$;');
  guards('ui-only-one-change-enforcement', migrationSql, oneChange, 'ALTER TABLE public.users DISABLE TRIGGER guard_public_id_lifetime_change;');
  // The command answers the used state from the row, before it would write.
  const change = functionBody(migrationSql, `${PRIVATE}.change_own_public_id_v1`);
  const used = change.indexOf("IF v_account.public_id_changed_at IS NOT NULL THEN\n        RETURN QUERY SELECT 'ALREADY_USED'");
  assert.ok(used > 0 && used < change.indexOf('UPDATE public.users'), 'ALREADY_USED is decided before any write');
  assert.ok(change.indexOf("'UNCHANGED'") < used, 'confirming the current ID is answered before the used check, and consumes nothing');
  assert.match(change, /SELECT \* INTO v_account FROM public\.users u WHERE u\.id = v_user FOR UPDATE;/u, 'the account row serializes attempts');
  assert.match(change, /IF v_account\.public_id_change_command_id = p_command_id THEN\n\s*IF v_account\.public_id = v_requested THEN\n\s*RETURN QUERY SELECT 'CHANGED'::text/u, 'same-command replay answers the committed truth');
  assert.match(change, /RAISE EXCEPTION 'PUBLIC_ID_COMMAND_CONFLICT' USING ERRCODE = '23505';/u);
  // Nothing on the client decides the one change: the controller consumes only on a server answer or a read.
  const controller = code(read(CONTROLLER));
  const serverDecides = (text) => {
    const body = text.replace(/const LOADING: PublicIdState = [^\n]*\n/u, '');
    return !/changeAvailable: (?:false|true)\b/u.test(body) && /state = \{ status: 'READY', publicId: view\.publicId, changeAvailable: view\.changeAvailable \};/u.test(body);
  };
  guards('client-consumes-the-change-optimistically', controller, serverDecides, "state = { ...state, changeAvailable: false };");
});

test('the application boundary: owner-only by token, no account parameter, no client table write, I-05 untouched', () => {
  const noClientUser = (text) => {
    const body = sql(text);
    return /CREATE FUNCTION public\.change_own_public_id_v1\(p_command_id uuid, p_public_id text\)/u.test(body) &&
      /CREATE FUNCTION account_private\.change_own_public_id_v1\(p_command_id uuid, p_public_id text\)/u.test(body) &&
      /v_user uuid := \(SELECT auth\.uid\(\)\);/u.test(body) &&
      !/CREATE FUNCTION \w+\.\w+\([^)]*\bp_(?:user|account|actor|owner)(?:_id)?\b/u.test(body);
  };
  guards('client-supplied-user-id', migration, noClientUser, 'CREATE FUNCTION public.change_public_id_for_v1(p_user_id uuid, p_public_id text)');
  guards('client-supplied-user-id-in-the-private-implementation', migration, noClientUser, 'CREATE FUNCTION account_private.change_public_id_for_v1(p_account_id uuid, p_public_id text)');
  const noTableWrite = (text) => !/GRANT[^;]*(?:UPDATE|INSERT|DELETE|ALL)[^;]*ON (?:TABLE )?public\.users[^;]*TO[^;]*(?:authenticated|anon)/iu.test(sql(text));
  guards('direct-authenticated-table-update', migration, noTableWrite, 'GRANT UPDATE (public_id) ON TABLE public.users TO authenticated;');
  // (The exact grant set and the by-name revokes are guarded in the privilege-boundary test.)
  assert.match(functionBody(migrationSql, 'public.read_own_public_id_v1'), /WHERE u\.id = \(SELECT auth\.uid\(\)\);/u);
  assert.match(migrationSql, /FUNCTION public\.read_own_public_id_v1\(\)\nRETURNS TABLE \(current_public_id text, change_available boolean\)\nLANGUAGE sql\nSTABLE\nSECURITY INVOKER/u);
  // The I-05 internal Public functions are not widened to the application role.
  assert.doesNotMatch(migrationSql, /ensure_public_identity_v1|update_public_display_label_v1/u);
  // API: guarded, the caller's token, and the body is exactly two fields.
  const controller = read(`${API}/account.controller.ts`);
  assert.match(controller, /@Get\('public-id'\)\n\s*@UseGuards\(SupabaseAuthGuard\)/u);
  assert.match(controller, /@Post\('public-id\/change'\)\n\s*@UseGuards\(SupabaseAuthGuard\)/u);
  const service = code(read(`${API}/account.service.ts`));
  const twoFields = (text) => /Object\.keys\(record\)\.some\(\(key\) => key !== 'commandId' && key !== 'publicId'\)/u.test(text) && !/record\.(?:userId|accountId|user_id)/u.test(text);
  guards('api-accepts-a-client-user-id', service, twoFields, 'const target = record.userId;');
  const repository = code(read(`${API}/account.repository.ts`));
  assert.match(repository, /this\.dataApi\.request<AccountPublicIdChangeRow\[\]>\(accessToken, 'rpc\/change_own_public_id_v1'/u, 'on the caller’s token');
  assert.equal((repository.match(/this\.serviceApi\./gu) ?? []).length, 1, 'the server channel is not used for the Public ID');
});

test('no Public-ID availability oracle and no enumeration endpoint', () => {
  const noOracle = (text) => (text.match(/@(?:Get|Post|Put|Patch|Delete)\('public-id[^']*'\)/gu) ?? []).sort().join(',') === "@Get('public-id'),@Post('public-id/change')";
  guards('api-public-id-availability-oracle', read(`${API}/account.controller.ts`), noOracle, "@Get('public-id/availability')");
  const noSqlOracle = (text) => {
    const fns = [...sql(text).matchAll(/CREATE FUNCTION (\w+\.\w+)\(/gu)].map((m) => m[1]).sort();
    return fns.join(',') === 'account_private.assign_public_id_v1,account_private.change_own_public_id_v1,account_private.generate_public_id_v1,' +
      'account_private.guard_public_id_lifetime_change_v1,account_private.is_well_formed_public_id_v1,account_private.normalize_public_id_v1,' +
      'public.change_own_public_id_v1,public.read_own_public_id_v1';
  };
  guards('sql-public-id-lookup', migration, noSqlOracle, 'CREATE FUNCTION public.public_id_is_available_v1(p text) RETURNS boolean AS $$ SELECT true $$;');
  guards('private-public-id-lookup', migration, noSqlOracle, 'CREATE FUNCTION account_private.public_id_holder_v1(p text) RETURNS uuid AS $$ SELECT NULL::uuid $$;');
  // The Public namespace is never compared with ANOTHER account's Login ID: guarded in the same-row test above.
  // The mobile client asks nothing before the reader confirms.
  const api = code(read(ACCOUNT_API));
  assert.equal((api.match(/\/account\/public-id/gu) ?? []).length, 2, 'one read and one change, no lookup');
});

test('the database verifier exists, is registered and runs in API CI', () => {
  assert.ok(existsSync(new URL(VERIFIER, root)));
  const verifier = read(VERIFIER);
  for (const proof of ['ALREADY_USED', 'UNCHANGED', 'UNAVAILABLE', "'23505'", 'waitUntilBlocked', 'setseed', 'is not in the Public namespace', 'the committed fixtures are gone',
    'the caller’s OWN Login ID is INVALID', 'users_public_id_not_own_login_id_check', 'gets a redraw', 'no W3-02 SECURITY DEFINER function in an exposed schema',
    'no broad grant on the private schema', 'no Data API configuration exposes account_private', 'a direct write cannot re-roll a Public ID']) {
    assert.ok(verifier.includes(proof), `the verifier proves ${proof}`);
  }
  assert.equal(readJson('package.json').scripts['verify:account-public-id:integration'], 'node --env-file-if-exists=.env database/verify-migration-0125.mjs');
  assert.equal((read('.github/workflows/api-ci.yml').match(/run: npm run verify:account-public-id:integration\b/gu) ?? []).length, 1);
  assert.match(read('database/README.md'), /## W3-02 - Account Public ID and its one lifetime manual change \(migration 0125\)/u);
});

// ---------------------------------------------------------------------------------------------------------
// The Product surface
// ---------------------------------------------------------------------------------------------------------

test('one General Settings destination: no second Public Settings destination, no route, no dialog', () => {
  const all = Object.values(productionCode).join('\n');
  const oneDestination = (text) =>
    (text.match(/<SettingsSurface\b/gu) ?? []).length === 1 &&
    !/PublicSettings|public-settings|PublicIdScreen|<Modal\b/u.test(text);
  guards('second-public-settings-destination', all, oneDestination, 'export function PublicSettingsSurface() { return null; }');
  assert.deepEqual(readdirSync(new URL(`${SRC}/app`, root)).sort(), ['_layout.tsx', 'index.tsx']);
  const section = code(read(SECTION)) + code(read(SETTINGS));
  assert.doesNotMatch(section, /expo-router|router\.(?:push|navigate|replace)|useRouter|<Stack\b|Alert\.alert/u);
  // S4-01 re-anchor: the same ONE destination also receives the Shared ID (E2E-D-08), after the Public ID.
  assert.match(code(read(`${SRC}/integration/composition/DepthComposition.tsx`)), /<SettingsSurface [^>]*publicId=\{runtime\.publicId\}(?: sharedId=\{runtime\.sharedId\})? \/>/u);
});

// Re-anchored by W3-MEGA-A: Account & Identity now also holds the REAL Name, Login ID and Email rows (E2E-D-03 / D-05 /
// D-04), each backed by a working change (`AccountSecuritySection.tsx`, migration 0129, `account-security.*`). The
// permanent claims are kept: no placeholder, disabled or "coming soon" row; no Account Photo row (media storage is not
// implemented); no Shared ID row before W6; the Public ID is still ONE row; and the W1B / W3-02 account service still
// carries none of the newer functions.
//
// Re-anchored by S4-01: Shared invitations are now usable (the W6 condition of W3-PDG-01 §4), and the Shared ID row is a
// REAL function — its page reads, copies and regenerates the reader's own Shared ID (`SharedIdSection.tsx`, migration
// 0138, `apps/api/src/shared-world`). The permanent claims stay: no placeholder, disabled or "coming soon" row, and no
// Account Photo row.
test('Account & Identity holds only REAL functions — no placeholder, no Photo, no Shared ID row', () => {
  const surfaces = code(read(SETTINGS)) + code(read(SECTION)) + code(read(`${SETTINGS_DIR}/AccountSecuritySection.tsx`)) + code(read(COPY));
  const futureRows = /\b(?:photo|avatar|PhotoRow)\b|'(?:Photo|Account photo)'|coming soon|قريبًا|placeholder|disabled: true/iu;
  const noPlaceholders = (text) => !futureRows.test(text);
  guards('placeholder-account-row', surfaces, noPlaceholders, "const loginIdRow = { label: 'Login ID', disabled: true };");
  guards('photo-row-before-media-storage', surfaces, noPlaceholders, "<IdentityRow term={copy.identity.photo} value='' />");
  // S4-01: the Shared ID row exists, and only as a real function backed by its page (Copy, confirmed Regenerate).
  const sharedIdSection = code(read(`${SETTINGS_DIR}/SharedIdSection.tsx`));
  assert.match(surfaces, /<SharedIdRow /u);
  assert.match(sharedIdSection, /Clipboard\.setStringAsync\(state\.sharedId\)/u);
  assert.match(sharedIdSection, /controller\.regenerate\(\)/u);
  assert.match(sharedIdSection, /copy\.regenerateWarning/u);
  const settings = code(read(SETTINGS));
  const group = settings.slice(settings.indexOf('testID="qandeel-settings-group-account"'), settings.indexOf('testID="qandeel-settings-group-security"'));
  assert.equal((group.match(/<PublicIdRow\b/gu) ?? []).length, 1);
  assert.deepEqual([...group.matchAll(/testID="(qandeel-[a-z-]+-row)"/gu)].map((m) => m[1]), ['qandeel-name-row', 'qandeel-login-id-row', 'qandeel-email-row'],
    'the group’s other rows are exactly Name, Login ID and Email');
  assert.equal((group.match(/<Pressable\b|<TextInput\b/gu) ?? []).length, 0, 'no field lives on the group itself; changes are states');
  // The W1B / W3-02 account service carries none of the newer functions: they live in their own files.
  const service = code(read(`${API}/account.service.ts`));
  assert.doesNotMatch(service, /changeName|changeLoginId|changeEmail|sharedId|uploadPhoto/u);
});

test('the copy is exactly the frozen and approved text; the surfaces write no words of their own', () => {
  const registry = readJson('docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/data/COPY_REGISTRY.json');
  const rows = Array.isArray(registry) ? registry : registry.rows ?? Object.values(registry).find(Array.isArray);
  const byKey = new Map(rows.map((row) => [row.k, row]));
  const copy = read(COPY);
  for (const key of ['gAccount', 'pidTerm', 'pidAvailable', 'pidUsed', 'pidTitle', 'pidBody', 'pidCurrent', 'pidNew', 'pidConfirm', 'pidKeep']) {
    const row = byKey.get(key);
    for (const text of [row.ar, row.en]) assert.ok(copy.includes(`'${text}'`) || copy.includes(`"${text}"`), `${key} is byte-for-byte the registry’s: ${text}`);
  }
  // The Product Owner's W3-02 Copy Gate.
  for (const text of ['أدخل معرّفًا عامًا صالحًا.', 'Enter a valid Public ID.', 'المعرّف العام هذا غير متاح. اختر معرّفًا آخر.', "This Public ID isn't available. Choose another one."]) {
    assert.ok(copy.includes(`'${text}'`) || copy.includes(`"${text}"`), `approved: ${text}`);
  }
  // T-14's frozen network sentence, reused verbatim.
  const t14 = read(`${SRC}/integration/auth-gateway/product-sign-in-copy.ts`);
  for (const text of ['تعذّر الاتصال. حاول مرة أخرى.', 'Couldn’t connect. Try again.']) {
    assert.ok(t14.includes(`'${text}'`) && copy.includes(`'${text}'`), `T-14’s network sentence: ${text}`);
  }
  const noWords = (text) => !/['"`][^'"`\n]*[؀-ۿ][^'"`\n]*['"`]/u.test(text) && !/['"`](?:Loading|Saving|Changed|Success|Failed|Error|Try again)[^'"`]*['"`]/u.test(text);
  guards('public-id-surfaces-write-no-words', code(read(SECTION)) + code(read(SETTINGS)) + code(read(CONTROLLER)), noWords, "const busy = 'جارٍ الحفظ';");
});

test('the handle is isolated LTR content, and the field is one LTR context; nothing is logged', () => {
  const section = code(read(SECTION));
  assert.match(section, /const LRI = String\.fromCodePoint\(0x2066\);/u);
  assert.match(section, /const PDI = String\.fromCodePoint\(0x2069\);/u);
  assert.equal((section.match(/\{isolatedHandle\(/gu) ?? []).length, 2, 'every drawn handle is isolated');
  assert.match(section, /<View style=\{\{ direction: 'ltr' \}\}>\s*<TextInput/u);
  assert.match(section, /textAlign: 'left',\s*writingDirection: 'ltr',/u);
  for (const file of [SECTION, SETTINGS, CONTROLLER, GRAMMAR, COPY, ACCOUNT_API, `${API}/account.service.ts`, `${API}/account.repository.ts`]) {
    assert.doesNotMatch(code(read(file)), /console\.|Logger|logger\./u, `${file} logs nothing`);
  }
});

test('a confirm is double-tap safe and never optimistic; an ambiguous failure is reconciled by reading', () => {
  const section = code(read(SECTION));
  assert.match(section, /if \(busyRef\.current\) return;\s*busyRef\.current = true;/u);
  const controller = code(read(CONTROLLER));
  assert.match(controller, /if \(!live\(\) \|\| committing \|\| state\.status !== 'READY'\) return null;/u);
  const reconciles = (text) => /if \(outcome\.kind !== 'ANSWERED'\) return reconcile\(\);/u.test(text) && /outcome = await transport\.readPublicId\(\);/u.test(text) && !/kind === 'NETWORK'\) return 'RETRY'/u.test(text);
  guards('guesses-after-a-lost-answer', controller, reconciles, "if (outcome.kind === 'NETWORK') return 'RETRY';");
  assert.match(controller, /if \(command === null \|\| command\.value !== value\) command = \{ value, id: newCommandId\(\) \};/u, 'one command identity per value');
});

test('the runtime generation owns the controller and retires it; the focused suites exist; this contract runs in mobile CI', () => {
  const runtime = code(read(`${SRC}/integration/runtime/integration-runtime.ts`));
  assert.match(runtime, /publicId: createPublicIdController\(\{ transport: entry\.accountFor\(bundle\), isCurrent \}\),/u);
  assert.match(runtime, /session\.publicId\.retire\(\);/u);
  for (const suite of [
    'apps/api/src/account/public-id.spec.ts',
    `${SETTINGS_DIR}/__tests__/public-id-controller.test.ts`,
    `${SETTINGS_DIR}/__tests__/public-id-settings.test.tsx`,
    `${SRC}/integration/__tests__/w3-02-public-id.test.tsx`,
  ]) assert.equal(existsSync(new URL(suite, root)), true, `${suite} is missing`);
  assert.equal(readJson('package.json').scripts['test:w3-02-account-identity-public-id-contract'], 'node --test tests/w3-02-account-identity-public-id-contract.test.mjs');
  const mobileCi = read('.github/workflows/mobile-ci.yml');
  assert.match(mobileCi, /run: npm run test:w3-02-account-identity-public-id-contract\}/u);
  assert.match(mobileCi, /'tests\/w3-02-account-identity-public-id-contract\.test\.mjs'/u);
});

// Re-anchored by W3-MEGA-U U0: W3-02 MERGED through PR #288, which closed D-09. The permanent claims stay: the
// baseline is W3-02's own, D-02 is advanced only, W3 is ACTIVE and Account & Identity is not complete.
test('the implementation record tells the lifecycle truth: D-09 only, D-02 advanced, W3 ACTIVE', () => {
  const record = read(RECORD);
  assert.match(record, /\*\*Baseline:\*\* `023cb9874376ac69db5848db099d06034d5deb54`/u);
  assert.match(record, /\*\*Status:\*\* MERGED \/ CLOSED — merged through PR #288 at `92444c3ab8c35f7d819888be76aa6395c93d94b8`/u);
  for (const moment of ['E2E-D-09', 'E2E-D-02', 'E2E-H-08']) assert.match(record, new RegExp(moment, 'u'));
  const overClaims = (text) => {
    const t = text.replace(/NOT (?:CLOSED|COMPLETE)|not closed|is not complete|does not claim[^.]*\./giu, '');
    return /E2E-D-02[^\n;.]*\b(?:CLOSED|COMPLETE)\b/u.test(t) || /W3 is (?:fully )?(?:closed|complete)/iu.test(t) || /Account & Identity (?:is )?(?:complete|finished|closed)/iu.test(t);
  };
  assert.equal(overClaims(record), false);
  assert.equal(overClaims(`${record}\n| E2E-D-02 | CLOSED |`), true, 'a planted D-02 over-claim is detected');
  assert.equal(overClaims(`${record}\nAccount & Identity is complete.`), true, 'a planted Account & Identity over-claim is detected');
});
