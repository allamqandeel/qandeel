// I-03C - Standing Context Consent Commands & Immutable Consent History v1:
// secret-free structural contract over migration 0078, the 0078 verifier, the
// narrowly authorized forward-safety correction of the 0077 verifier, the
// frozen upstream sources and the toolchain / CI / README wiring.
//
// Every "must not contain" assertion runs against executable SQL (comments
// stripped); the disclosure / scope vocabulary assertions run against the DDL
// and the command bodies alone, because the terminal self-assertion names those
// words precisely in order to refuse them at deploy time. Live semantics are
// proven by the real PostgreSQL verifier this file pins into the toolchain and
// CI. The migration checks are written as functions of the SQL text so the last
// test can prove they are not vacuous: each deliberate mutation of the migration
// must be refused by at least one of them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION_NAME = '0078_shared_standing_context_consent_commands_v1.sql';
const EVENTS = 'shared_world_standing_context_consent_events';
const GRANTS = 'shared_world_standing_context_grants';
const AUDIENCE = 'shared_world_standing_context_grant_audience';
const EPISODES = 'shared_world_membership_episodes';
const GRANT_FN = 'grant_shared_world_standing_context_v1';
const REVOKE_FN = 'revoke_shared_world_standing_context_v1';
const RESOLVER_FN = 'resolve_shared_world_standing_context_grant_v1';
const RESULT = 'RETURNS TABLE(consent_event_id uuid, event_type text, grant_id uuid, prior_grant_id uuid, grant_status text)';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0078.mjs');
const verifier0077 = read('../verify-migration-0077.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const stripSqlComments = (sql) => sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
// Identifier-aware token search: `_` is a separator, so `material_transfer`
// matches while `shared_world` never matches `share`.
const token = (words) => new RegExp(`(?<![A-Za-z0-9])(?:${words})(?![A-Za-z0-9])`, 'iu');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};
const columnsOf = (table) => [...table.matchAll(/^\s{4}(\w+) (uuid|text|timestamptz)\b([^,\n]*)/gmu)].map((m) => [m[1], m[2], m[3].trim()]);

// Parts of the migration, computed from any candidate text so the same checks
// run against the real file and against each anti-vacuity mutation.
function analyse(sql) {
  const executable = stripSqlComments(sql);
  const slice = (from, to) => {
    const start = executable.indexOf(from);
    assert.ok(start >= 0, `migration contains "${from}"`);
    const end = to === undefined ? executable.length : executable.indexOf(to, start);
    assert.ok(end > start, `migration contains "${to}" after "${from}"`);
    return executable.slice(start, end);
  };
  const body = (fn) => {
    const start = executable.indexOf(`CREATE FUNCTION public.${fn}`);
    const end = executable.indexOf('END$$;', start);
    assert.ok(start >= 0 && end > start, `${fn} body is present`);
    return executable.slice(start, end + 'END$$;'.length);
  };
  const selfAssertion = slice('DO $$\nDECLARE', 'COMMIT;');
  return {
    executable,
    // The self-assertion names forbidden words precisely in order to refuse
    // them at deploy time; the structural vocabulary checks run without it.
    deployed: executable.replace(selfAssertion, ''),
    ddl: slice('BEGIN;', `CREATE FUNCTION public.${GRANT_FN}`),
    grantBody: body(GRANT_FN),
    revokeBody: body(REVOKE_FN),
    acl: slice(`ALTER FUNCTION public.${GRANT_FN}`, 'DO $$\nDECLARE'),
    selfAssertion,
  };
}

const checks = {
  'exactly one consent-event table, exactly two command functions, nothing else': ({ executable, deployed }) => {
    assert.match(executable, /^BEGIN;/mu);
    assert.match(executable, /COMMIT;\s*$/u);
    assert.deepEqual([...executable.matchAll(/CREATE TABLE public\.(\w+)/gu)].map((m) => m[1]), [EVENTS]);
    assert.deepEqual([...executable.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map((m) => m[1]), [GRANT_FN, REVOKE_FN]);
    assert.doesNotMatch(executable, /CREATE (?:OR REPLACE )?(?:TRIGGER|POLICY|VIEW|MATERIALIZED VIEW|EXTENSION|TYPE|PROCEDURE|SEQUENCE|SCHEMA)|EXCLUDE USING|DROP /iu,
      'no trigger, policy, view, type, extension, procedure or drop');
    assert.doesNotMatch(deployed, /\bTRUNCATE\b|\bDELETE FROM\b/iu, 'nothing deployed truncates or deletes');
    assert.doesNotMatch(executable, new RegExp(`ALTER TABLE public\\.(?!${EVENTS}\\b)\\w+`, 'u'), 'no other table is altered');
    assert.doesNotMatch(executable, /public\.(?:consent_events?|consent_event_log|consent_requests?|authority_grants|generic_permissions|permission_grants|context_admissions?|grants|permissions?)\b/iu,
      'no generic consent, grant, permission or context-admission table');
  },
  'the event row carries exactly the required columns and no generic, JSON, TTL or client-timestamp column': ({ ddl }) => {
    const table = ddl.slice(ddl.indexOf(`CREATE TABLE public.${EVENTS}`), ddl.indexOf('CREATE UNIQUE INDEX'));
    assert.deepEqual(columnsOf(table), [
      ['id', 'uuid', 'PRIMARY KEY'],
      ['world_id', 'uuid', 'NOT NULL'],
      ['grantor_user_id', 'uuid', 'NOT NULL'],
      ['event_type', 'text', 'NOT NULL'],
      ['subject_grant_id', 'uuid', 'NOT NULL'],
      ['prior_grant_id', 'uuid', ''],
      ['occurred_at', 'timestamptz', 'NOT NULL DEFAULT CURRENT_TIMESTAMP'],
    ]);
    assert.doesNotMatch(ddl, /jsonb?\b|\btext\[\]|uuid\[\]|scope|purpose|action|source|permissions?|ttl|expir|valid_until/iu,
      'event semantics are fixed by table identity: no generic or widenable column');
    assert.doesNotMatch(table, /owner|admin|inviter|creator|initiator|privilege|system|qandeel/iu, 'no superior authority column and no system-actor column');
    assert.doesNotMatch(ddl, token('disclos\\w*|quote|copy|publish\\w*|share|export|provenance|material\\w*|transfer|attribution'),
      'REASON_FROM_PRIVATE_CONTEXT != DISCLOSE_PRIVATE_FACT: the row can imply no material permission');
    assert.doesNotMatch(ddl, token('matching\\w*|public_world|public_experience\\w*|replay\\w*|history_access\\w*|one_time\\w*|decline\\w*|request\\w*'),
      'no Matching, Public, Replay, history-grant, decline or consent-request state is persisted');
  },
  'event vocabulary is exactly GRANTED | RECONFIRMED | REVOKED': ({ executable, ddl }) => {
    const vocabulary = ddl.match(new RegExp(`CONSTRAINT ${EVENTS}_event_type_check\\s+CHECK \\(event_type IN \\(([^)]+)\\)\\)`, 'u'));
    assert.ok(vocabulary, 'the event-type check exists as an IN-list');
    assert.deepEqual([...vocabulary[1].matchAll(/'([A-Za-z_]+)'/gu)].map((m) => m[1]), ['GRANTED', 'RECONFIRMED', 'REVOKED']);
    assert.doesNotMatch(executable, /'(?:DECLINED|REQUESTED|EXTENDED|PAUSED|EXPIRED|SUPERSEDED|PENDING|DISCLOSED|PUBLISHED|MATCHING|PUBLIC)'/u, 'no decline / request / TTL / Matching / Public literal');
  },
  'event-type / prior-grant consistency is constrained exactly': ({ ddl }) => {
    const consistency = ddl.match(new RegExp(`CONSTRAINT ${EVENTS}_prior_grant_check\\s+CHECK \\(([\\s\\S]+?)\\)\\n\\);`, 'u'));
    assert.ok(consistency, 'the prior-grant consistency check exists');
    assert.equal(consistency[1].replace(/\s+/gu, ' '),
      "(event_type = 'GRANTED' AND prior_grant_id IS NULL) OR (event_type = 'RECONFIRMED' AND prior_grant_id IS NOT NULL AND prior_grant_id <> subject_grant_id) OR (event_type = 'REVOKED' AND prior_grant_id IS NULL)");
  },
  'all four references are restrictive foreign keys to the World, the human and the I-02B grant rows': ({ executable }) => {
    const restrictive = [...executable.matchAll(/FOREIGN KEY \((\w+)\) REFERENCES public\.(\w+) \(id\) ON DELETE RESTRICT/gu)].map((m) => [m[1], m[2]]);
    assert.deepEqual(restrictive, [['world_id', 'shared_worlds'], ['grantor_user_id', 'users'], ['subject_grant_id', GRANTS], ['prior_grant_id', GRANTS]]);
    assert.doesNotMatch(executable, /ON DELETE (?:CASCADE|SET NULL|SET DEFAULT)/iu, 'consent history never cascades away');
    assert.doesNotMatch(executable, new RegExp(`ALTER TABLE public\\.${GRANTS}|ALTER TABLE public\\.${AUDIENCE}|originating_consent_event`, 'u'), 'the frozen 0076 grant tables are not altered');
  },
  'a grant is born once, revoked at most once and replaced at most once; the only other index is the history lookup': ({ executable }) => {
    const indexes = [...executable.matchAll(/CREATE (UNIQUE )?INDEX (\w+)\s+ON public\.(\w+) \(([^)]+)\)(?:\s+WHERE ([^;]+))?;/gu)].map((m) => [Boolean(m[1]), m[2], m[3], m[4], m[5] ?? null]);
    assert.deepEqual(indexes, [
      [true, `${EVENTS}_birth_event_idx`, EVENTS, 'subject_grant_id', "event_type IN ('GRANTED', 'RECONFIRMED')"],
      [true, `${EVENTS}_revoke_event_idx`, EVENTS, 'subject_grant_id', "event_type = 'REVOKED'"],
      [true, `${EVENTS}_prior_grant_idx`, EVENTS, 'prior_grant_id', 'prior_grant_id IS NOT NULL'],
      [false, `${EVENTS}_world_grantor_idx`, EVENTS, 'world_id, grantor_user_id, occurred_at', null],
    ]);
    for (const identifier of [...executable.matchAll(/(?:CREATE TABLE public\.|CONSTRAINT |CREATE (?:UNIQUE )?INDEX )(\w+)/gu)].map((m) => m[1])) {
      assert.ok(Buffer.byteLength(identifier) <= 63, `${identifier} (${Buffer.byteLength(identifier)} bytes) would be truncated by PostgreSQL`);
    }
  },
  'the event table is RLS-enabled with zero policies and no application role holds a direct privilege': ({ executable, selfAssertion }) => {
    assert.match(executable, new RegExp(`ALTER TABLE public\\.${EVENTS} OWNER TO postgres;`, 'u'));
    assert.match(executable, new RegExp(`ALTER TABLE public\\.${EVENTS} ENABLE ROW LEVEL SECURITY;`, 'u'));
    assert.match(executable, new RegExp(`REVOKE ALL ON TABLE public\\.${EVENTS} FROM PUBLIC, anon, authenticated;`, 'u'));
    assert.match(executable, new RegExp(`EXECUTE 'REVOKE ALL ON TABLE public\\.${EVENTS} FROM service_role';`, 'u'));
    assert.doesNotMatch(executable, /GRANT (?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|REFERENCES|TRIGGER)\b|ON TABLE [\w.]+ TO|CREATE POLICY|DISABLE ROW LEVEL SECURITY|FORCE ROW LEVEL SECURITY/iu,
      'no table privilege, policy or RLS weakening of any kind');
    assert.match(selfAssertion, new RegExp(`FOREACH target_table IN ARRAY ARRAY\\['public\\.${EVENTS}',\\s+'public\\.${GRANTS}',\\s+'public\\.${AUDIENCE}'\\]`, 'u'));
    assert.match(selfAssertion, /FOREACH target_role IN ARRAY ARRAY\['anon','authenticated','service_role'\]/u);
    assert.match(selfAssertion, /FOREACH target_privilege IN ARRAY ARRAY\['SELECT','INSERT','UPDATE','DELETE'\]/u);
    assert.match(selfAssertion, /IF has_table_privilege\(target_role, target_table, target_privilege\) THEN\s+RAISE EXCEPTION 'I-03C: direct table access stays sealed/u);
    assert.match(selfAssertion, /IF EXISTS \(SELECT 1 FROM pg_policy pol WHERE pol\.polrelid = target_table::regclass\) THEN/u);
    assert.match(selfAssertion, /IF EXISTS \(SELECT 1 FROM pg_trigger t WHERE t\.tgrelid = target_table::regclass AND NOT t\.tgisinternal\) THEN/u);
    assert.match(selfAssertion, /privilege\.grantee = 0\) THEN\s+RAISE EXCEPTION 'I-03C: PUBLIC must hold no privilege/u);
    assert.match(selfAssertion, /IF NOT rls_enabled THEN RAISE EXCEPTION/u);
    assert.match(selfAssertion, new RegExp(`t\\.tgrelid = 'public\\.${EPISODES}'::regclass AND NOT t\\.tgisinternal`, 'u'), 'membership expansion has no trigger path into any ceiling');
    assert.match(selfAssertion, /c\.column_name ~\* '\(scope\|purpose\|action\|source\|permission\|disclos\|quote\|copy\|publish\|share\|export\|provenance\|transfer\|owner\|admin\|ttl\|expir\|material\|matching\|public\)'/u);
    assert.match(selfAssertion, /c\.data_type IN \('json','jsonb','ARRAY'\)/u);
  },
  'both commands are SECURITY DEFINER, VOLATILE, search_path-pinned, fully qualified, and derive the grantor from auth.uid()': ({ grantBody, revokeBody, selfAssertion }) => {
    for (const body of [grantBody, revokeBody]) {
      assert.match(body, /LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS \$\$/u);
      assert.doesNotMatch(body, /\bSTABLE\b|\bIMMUTABLE\b|PARALLEL SAFE/u, 'a consent command is a VOLATILE mutation');
      assert.match(body, /DECLARE\s+u uuid := auth\.uid\(\);/u);
      assert.match(body, /IF u IS NULL THEN RAISE EXCEPTION 'STANDING_CONTEXT_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;/u);
      for (const reference of [...body.matchAll(/(?<!DISTINCT )\b(?:FROM|JOIN|UPDATE|INSERT INTO)\s+([A-Za-z_][\w.]*)/gu)].map((m) => m[1])) {
        if (reference === 'unnest') continue;
        assert.match(reference, /^public\./u, `${reference} is fully qualified`);
      }
      assert.doesNotMatch(body, /request\.jwt|current_setting|conversation|memories|him_|hypothes|model|provider|prompt/iu, 'no client-claim parsing, Personal context or model path');
    }
    assert.match(grantBody, new RegExp(`CREATE FUNCTION public\\.${GRANT_FN}\\(\\n  p_command_id uuid, p_new_grant_id uuid, p_world_id uuid, p_audience_user_ids uuid\\[\\], p_expected_active_grant_id uuid DEFAULT NULL\\n\\) ${RESULT.replace(/[()]/gu, '\\$&')}`, 'u'));
    assert.match(revokeBody, new RegExp(`CREATE FUNCTION public\\.${REVOKE_FN}\\(\\n  p_command_id uuid, p_world_id uuid, p_expected_active_grant_id uuid\\n\\) ${RESULT.replace(/[()]/gu, '\\$&')}`, 'u'));
    for (const body of [grantBody, revokeBody]) {
      const parameters = body.slice(body.indexOf('('), body.indexOf(') RETURNS'));
      assert.doesNotMatch(parameters, /grantor|status|purpose|source|event_type|timestamp|_at\b|material|provenance|scope|action|p_user_id|p_actor/iu, 'no grantor, status, purpose, source, event-type, timestamp or material parameter');
    }
    const grantTables = [...new Set([...grantBody.matchAll(/\b(?:FROM|JOIN|UPDATE|INSERT INTO)\s+public\.(\w+)/gu)].map((m) => m[1]))].sort();
    assert.deepEqual(grantTables, [EPISODES, EVENTS, AUDIENCE, GRANTS, 'shared_worlds'], 'the grant command touches exactly the World, membership, grant, ceiling and event tables');
    const revokeTables = [...new Set([...revokeBody.matchAll(/\b(?:FROM|JOIN|UPDATE|INSERT INTO)\s+public\.(\w+)/gu)].map((m) => m[1]))].sort();
    assert.deepEqual(revokeTables, [EVENTS, GRANTS, 'shared_worlds'], 'the revoke command touches exactly the World, grant and event tables: no membership or lifecycle requirement');
    assert.match(selfAssertion, /IF p\.prosrc !~ 'auth\\\.uid\\\(\\\)' THEN RAISE EXCEPTION/u);
    assert.match(selfAssertion, /IF p\.args ~\* 'grantor' OR p\.args ~\* 'status' OR p\.args ~\* 'event_type'/u);
    assert.match(selfAssertion, /IF p\.provolatile <> 'v' THEN RAISE EXCEPTION/u);
    assert.match(selfAssertion, /IF NOT p\.prosecdef THEN RAISE EXCEPTION/u);
    assert.match(selfAssertion, /cfg IN \('search_path=', 'search_path=""'\)/u);
  },
  'EXECUTE is authenticated-only: PUBLIC, anon and service_role are revoked, and the I-03B resolver ACL is re-proven': ({ executable, acl, selfAssertion }) => {
    const grantSignature = `${GRANT_FN}\\(uuid, uuid, uuid, uuid\\[\\], uuid\\)`;
    const revokeSignature = `${REVOKE_FN}\\(uuid, uuid, uuid\\)`;
    for (const signature of [grantSignature, revokeSignature]) {
      assert.match(acl, new RegExp(`ALTER FUNCTION public\\.${signature} OWNER TO postgres;`, 'u'));
      assert.match(acl, new RegExp(`REVOKE ALL ON FUNCTION public\\.${signature} FROM PUBLIC, anon, authenticated;`, 'u'));
      assert.match(acl, new RegExp(`EXECUTE 'REVOKE ALL ON FUNCTION public\\.${signature} FROM service_role';`, 'u'));
      assert.match(acl, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${signature} TO authenticated;`, 'u'));
    }
    const grants = [...executable.matchAll(/^\s*GRANT\b.*$/gmu)].map((m) => m[0].trim());
    assert.deepEqual(grants, [
      `GRANT EXECUTE ON FUNCTION public.${GRANT_FN}(uuid, uuid, uuid, uuid[], uuid) TO authenticated;`,
      `GRANT EXECUTE ON FUNCTION public.${REVOKE_FN}(uuid, uuid, uuid) TO authenticated;`,
    ], 'the ONLY grants are EXECUTE on the two commands to authenticated');
    assert.doesNotMatch(executable, /TO service_role|TO anon|TO PUBLIC/u, 'nothing is ever granted to service_role, anon or PUBLIC');
    assert.match(selfAssertion, /IF has_function_privilege\('public', fn, 'EXECUTE'\) THEN RAISE EXCEPTION/u);
    assert.match(selfAssertion, /FOREACH target_role IN ARRAY ARRAY\['anon','service_role'\] LOOP\s+IF EXISTS \(SELECT 1 FROM pg_roles r WHERE r\.rolname = target_role\) AND has_function_privilege\(target_role, fn, 'EXECUTE'\) THEN/u);
    assert.match(selfAssertion, /IF NOT has_function_privilege\('authenticated', fn, 'EXECUTE'\) THEN/u);
    assert.match(selfAssertion, new RegExp(`resolver text := 'public\\.${RESOLVER_FN}\\(uuid,uuid\\)';`, 'u'));
    assert.match(selfAssertion, /has_function_privilege\('authenticated', resolver, 'EXECUTE'\) OR NOT has_function_privilege\('service_role', resolver, 'EXECUTE'\)/u, 'the I-03B resolver stays service_role-only');
    assert.match(selfAssertion, new RegExp(`pr\\.proname IN \\('${GRANT_FN}','${REVOKE_FN}'\\)\\) <> 2 THEN`, 'u'));
  },
  'grant requires an ACTIVE exact Shared World and one open grantor membership episode; every ceiling human must be a current member; the grantor is not required inside the ceiling': ({ grantBody }) => {
    assert.match(grantBody, /IF world_lifecycle <> 'ACTIVE' THEN RAISE EXCEPTION 'STANDING_CONTEXT_WORLD_NOT_ACTIVE' USING ERRCODE='55000'; END IF;/u);
    assert.doesNotMatch(grantBody, /phase|'STANDARD'|'INTRODUCTION'/u, 'an ACTIVE Introduction World is a Shared World: no phase requirement');
    assert.match(grantBody, new RegExp(`IF NOT EXISTS \\(SELECT 1 FROM public\\.${EPISODES} e\\s+WHERE e\\.world_id = p_world_id AND e\\.user_id = u AND e\\.ended_at IS NULL\\) THEN\\s+RAISE EXCEPTION 'STANDING_CONTEXT_GRANTOR_NOT_CURRENT_MEMBER' USING ERRCODE='42501';`, 'u'));
    assert.match(grantBody, new RegExp(`IF EXISTS \\(SELECT 1 FROM unnest\\(requested_ceiling\\) AS a\\(audience_user_id\\)\\s+WHERE NOT EXISTS \\(SELECT 1 FROM public\\.${EPISODES} e\\s+WHERE e\\.world_id = p_world_id AND e\\.user_id = a\\.audience_user_id AND e\\.ended_at IS NULL\\)\\) THEN\\s+RAISE EXCEPTION 'STANDING_CONTEXT_AUDIENCE_NOT_CURRENT_MEMBER' USING ERRCODE='42501';`, 'u'));
    assert.doesNotMatch(grantBody, /u = ANY\(|= ANY\(requested_ceiling\)|array_append\(requested_ceiling|array_prepend\(|\|\| u\b|\|\| ARRAY\[u\]/u, 'no grantor-in-ceiling condition and no ceiling auto-fill');
    assert.doesNotMatch(grantBody, new RegExp(`INSERT INTO public\\.${AUDIENCE}[^;]*${EPISODES}`, 'u'), 'the ceiling is never derived from membership');
  },
  'the ceiling is validated as a set: non-null, non-empty, no NULL element, duplicates rejected (never normalized), order without meaning': ({ grantBody }) => {
    assert.match(grantBody, /IF p_audience_user_ids IS NULL OR array_ndims\(p_audience_user_ids\) IS DISTINCT FROM 1\s+OR cardinality\(p_audience_user_ids\) = 0 OR array_position\(p_audience_user_ids, NULL::uuid\) IS NOT NULL THEN\s+RAISE EXCEPTION 'STANDING_CONTEXT_AUDIENCE_INVALID' USING ERRCODE='22023';/u);
    assert.match(grantBody, /requested_ceiling := \(SELECT array_agg\(DISTINCT a\.audience_user_id ORDER BY a\.audience_user_id\)\s+FROM unnest\(p_audience_user_ids\) AS a\(audience_user_id\)\);/u);
    assert.match(grantBody, /IF cardinality\(requested_ceiling\) <> cardinality\(p_audience_user_ids\) THEN\s+RAISE EXCEPTION 'STANDING_CONTEXT_AUDIENCE_DUPLICATE' USING ERRCODE='22023';/u);
    assert.match(grantBody, new RegExp(`INSERT INTO public\\.${AUDIENCE} \\(grant_id, audience_user_id\\)\\s+SELECT p_new_grant_id, a\\.audience_user_id FROM unnest\\(requested_ceiling\\) AS a\\(audience_user_id\\);`, 'u'));
  },
  'expected-active compare-and-swap: NULL requires no ACTIVE grant, a named grant must be the current ACTIVE grant, anything else is 40001': ({ grantBody }) => {
    assert.match(grantBody, new RegExp(`SELECT g\\.id INTO current_active_id FROM public\\.${GRANTS} g\\s+WHERE g\\.world_id = p_world_id AND g\\.grantor_user_id = u AND g\\.status = 'ACTIVE';\\s+IF current_active_id IS DISTINCT FROM p_expected_active_grant_id THEN\\s+RAISE EXCEPTION 'STANDING_CONTEXT_STALE_STATE' USING ERRCODE='40001';`, 'u'));
    assert.match(grantBody, /IF p_expected_active_grant_id IS NOT NULL AND p_expected_active_grant_id = p_new_grant_id THEN\s+RAISE EXCEPTION 'STANDING_CONTEXT_NEW_GRANT_ID_INVALID' USING ERRCODE='22023';/u);
    assert.match(grantBody, new RegExp(`IF EXISTS \\(SELECT 1 FROM public\\.${GRANTS} g WHERE g\\.id = p_new_grant_id\\) THEN\\s+RAISE EXCEPTION 'STANDING_CONTEXT_GRANT_ID_CONFLICT' USING ERRCODE='23505';`, 'u'));
    assert.doesNotMatch(grantBody, /ORDER BY g\.|LIMIT 1|granted_at DESC|COALESCE\(p_expected_active_grant_id, current_active_id\)/u, 'nothing is applied to "whatever is current"');
  },
  'reconfirm revokes the exact old grant and creates a new grant identity; history is never edited or deleted, a revoked grant is never reactivated': ({ deployed, grantBody, revokeBody }) => {
    assert.match(grantBody, /intended_event_type := CASE WHEN p_expected_active_grant_id IS NULL THEN 'GRANTED' ELSE 'RECONFIRMED' END;/u);
    assert.match(grantBody, new RegExp(`IF p_expected_active_grant_id IS NOT NULL THEN\\s+UPDATE public\\.${GRANTS} g SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP\\s+WHERE g\\.id = p_expected_active_grant_id AND g\\.status = 'ACTIVE';\\s+IF NOT FOUND THEN RAISE EXCEPTION 'STANDING_CONTEXT_STALE_STATE' USING ERRCODE='40001'; END IF;\\s+END IF;`, 'u'));
    assert.match(grantBody, new RegExp(`INSERT INTO public\\.${GRANTS} \\(id, world_id, grantor_user_id, status\\)\\s+VALUES \\(p_new_grant_id, p_world_id, u, 'ACTIVE'\\);`, 'u'));
    assert.match(grantBody, new RegExp(`INSERT INTO public\\.${EVENTS} \\(id, world_id, grantor_user_id, event_type, subject_grant_id, prior_grant_id\\)\\s+VALUES \\(p_command_id, p_world_id, u, intended_event_type, p_new_grant_id, p_expected_active_grant_id\\);`, 'u'));
    assert.match(grantBody, /RETURN QUERY SELECT p_command_id, intended_event_type, p_new_grant_id, p_expected_active_grant_id, 'ACTIVE'::text;/u);
    for (const body of [grantBody, revokeBody]) {
      assert.equal((body.match(/\bUPDATE public\./gu) ?? []).length, 1, 'exactly one UPDATE: the ACTIVE -> REVOKED transition of the exact expected grant');
      assert.match(body, new RegExp(`UPDATE public\\.${GRANTS} g SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP\\s+WHERE g\\.id = p_expected_active_grant_id AND g\\.status = 'ACTIVE';`, 'u'));
      assert.doesNotMatch(body, /\bDELETE\b|\bTRUNCATE\b|\bMERGE\b/u);
    }
    assert.doesNotMatch(deployed, new RegExp(`UPDATE public\\.${EVENTS}|UPDATE public\\.${AUDIENCE}|DELETE FROM|SET status = 'ACTIVE'|revoked_at = NULL|SET audience_user_id|SET grantor_user_id|SET world_id`, 'u'),
      'consent events and historical ceilings are append-only; no grant is reactivated or re-targeted');
  },
  'revoke targets the exact expected ACTIVE grant of this human in this World, without membership or lifecycle requirement, and never "whatever is current"': ({ revokeBody }) => {
    assert.match(revokeBody, new RegExp(`SELECT \\* INTO target FROM public\\.${GRANTS} g\\s+WHERE g\\.id = p_expected_active_grant_id AND g\\.world_id = p_world_id AND g\\.grantor_user_id = u\\s+FOR UPDATE;\\s+IF NOT FOUND THEN RAISE EXCEPTION 'STANDING_CONTEXT_GRANT_NOT_FOUND' USING ERRCODE='P0002'; END IF;`, 'u'));
    assert.match(revokeBody, /IF target\.status <> 'ACTIVE' THEN RAISE EXCEPTION 'STANDING_CONTEXT_STALE_STATE' USING ERRCODE='40001'; END IF;/u);
    assert.doesNotMatch(revokeBody, /membership_episodes|ended_at|lifecycle|'READ_ONLY_CLOSED'|closed_at/u, 'self-owned privacy withdrawal survives leaving and closure');
    assert.doesNotMatch(revokeBody, /ORDER BY|LIMIT|granted_at DESC|COALESCE\(p_expected_active_grant_id/u, 'no "latest grant" fallback');
    assert.match(revokeBody, new RegExp(`INSERT INTO public\\.${EVENTS} \\(id, world_id, grantor_user_id, event_type, subject_grant_id, prior_grant_id\\)\\s+VALUES \\(p_command_id, p_world_id, u, 'REVOKED', p_expected_active_grant_id, NULL\\);`, 'u'));
    assert.match(revokeBody, /RETURN QUERY SELECT p_command_id, 'REVOKED'::text, p_expected_active_grant_id, NULL::uuid, 'REVOKED'::text;/u);
  },
  'both commands serialize on the exact Shared World row before any state comparison or mutation': ({ grantBody, revokeBody, selfAssertion }) => {
    for (const body of [grantBody, revokeBody]) {
      const lock = body.search(/FROM public\.shared_worlds w WHERE w\.id = p_world_id FOR UPDATE;\s+IF NOT FOUND THEN RAISE EXCEPTION 'STANDING_CONTEXT_WORLD_NOT_FOUND' USING ERRCODE='P0002'; END IF;/u);
      assert.ok(lock >= 0, 'the World row is locked FOR UPDATE and a missing World is a bounded error');
      assert.ok(lock < body.indexOf('INTO committed'), 'the lock precedes the idempotency read');
      assert.ok(lock < body.indexOf("'ACTIVE'"), 'the lock precedes every ACTIVE-state comparison');
      assert.ok(lock < body.indexOf('INSERT INTO'), 'the lock precedes every write');
      assert.doesNotMatch(body, /pg_advisory|pg_try_advisory|LOCK TABLE|SKIP LOCKED|NOWAIT/iu, 'no advisory lock, no table lock, no skip');
    }
    assert.match(selfAssertion, /IF p\.prosrc !~ 'FROM public\\\.shared_worlds w WHERE w\\\.id = p_world_id FOR UPDATE' THEN/u);
  },
  'command-id idempotency uses the consent-event primary key with semantic retry equality; a mismatch is 23505': ({ executable, grantBody, revokeBody }) => {
    for (const body of [grantBody, revokeBody]) {
      assert.match(body, new RegExp(`SELECT \\* INTO committed FROM public\\.${EVENTS} e WHERE e\\.id = p_command_id;\\s+IF FOUND THEN`, 'u'));
      assert.match(body, /RAISE EXCEPTION 'STANDING_CONTEXT_COMMAND_ID_CONFLICT' USING ERRCODE='23505';/u);
      assert.ok(body.indexOf('INTO committed') < body.indexOf('INSERT INTO'), 'the idempotency read precedes every write');
    }
    assert.match(grantBody, new RegExp(`SELECT array_agg\\(a\\.audience_user_id ORDER BY a\\.audience_user_id\\) INTO committed_ceiling\\s+FROM public\\.${AUDIENCE} a WHERE a\\.grant_id = committed\\.subject_grant_id;`, 'u'));
    assert.match(grantBody, /IF committed\.grantor_user_id = u AND committed\.world_id = p_world_id AND committed\.event_type = intended_event_type\s+AND committed\.subject_grant_id = p_new_grant_id AND committed\.prior_grant_id IS NOT DISTINCT FROM p_expected_active_grant_id\s+AND committed_ceiling IS NOT DISTINCT FROM requested_ceiling THEN\s+RETURN QUERY SELECT committed\.id, committed\.event_type, committed\.subject_grant_id, committed\.prior_grant_id, 'ACTIVE'::text;\s+RETURN;/u);
    assert.match(revokeBody, /IF committed\.event_type = 'REVOKED' AND committed\.grantor_user_id = u AND committed\.world_id = p_world_id\s+AND committed\.subject_grant_id = p_expected_active_grant_id AND committed\.prior_grant_id IS NULL THEN\s+RETURN QUERY SELECT committed\.id, committed\.event_type, committed\.subject_grant_id, committed\.prior_grant_id, 'REVOKED'::text;\s+RETURN;/u);
    assert.ok(grantBody.indexOf('INTO committed') < grantBody.indexOf("IF world_lifecycle <> 'ACTIVE'"), 'a committed command stays answerable after the World state moved on');
    assert.equal((executable.match(/CREATE TABLE/gu) ?? []).length, 1, 'no second idempotency table');
    assert.doesNotMatch(executable, /idempotency_key|command_log|retry/iu);
  },
  'every timestamp is database-owned and there is no TTL': ({ executable, deployed, grantBody, revokeBody }) => {
    assert.match(executable, /occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP/u);
    for (const body of [grantBody, revokeBody]) {
      assert.doesNotMatch(body.slice(0, body.indexOf(') RETURNS')), /timestamp/iu, 'no timestamp parameter');
      assert.doesNotMatch(body, /granted_at|occurred_at/u, 'granted_at and occurred_at are never written explicitly: defaults own them');
      assert.match(body, /revoked_at = CURRENT_TIMESTAMP/u);
      assert.doesNotMatch(body, /now\(\)|clock_timestamp|statement_timestamp|p_\w*_at\b/u);
    }
    assert.doesNotMatch(deployed, /valid_until|expires_at|ttl|interval '/iu, 'no TTL');
  },
  'no material, provenance, Matching or Public vocabulary enters the DDL or the command bodies': ({ ddl, grantBody, revokeBody }) => {
    for (const text of [ddl, grantBody, revokeBody]) {
      assert.doesNotMatch(text, token('disclos\\w*|quote|copy|publish\\w*|export|provenance\\w*|material\\w*|transfer|attribution'));
      assert.doesNotMatch(text, token('matching\\w*|public_world|public_experience\\w*|replay\\w*|introduction\\w*|history_access\\w*|one_time\\w*|decline\\w*'));
      assert.doesNotMatch(text, /'(?:DISCLOSE|QUOTE|COPY|PUBLISH|EXPORT|PROVENANCE_DISCLOSURE|MATERIAL_TRANSFER|MATCHING|PUBLIC_WORLD|PUBLIC_EXPERIENCE|REPLAY)'/u);
    }
  },
  'the narrow result contract is exactly (consent_event_id, event_type, grant_id, prior_grant_id, grant_status)': ({ grantBody, revokeBody }) => {
    for (const body of [grantBody, revokeBody]) {
      assert.ok(body.includes(RESULT), 'exact result shape');
      assert.doesNotMatch(body, /RETURNS SETOF|RETURNS jsonb|to_jsonb|row_to_json|audience_user_ids?\b.*RETURN QUERY/u, 'no private context, hidden reasoning or ceiling echo in the result');
    }
  },
};

for (const [name, check] of Object.entries(checks)) {
  test(name, () => check(analyse(migration)));
}

test('0078 exists once, orders after 0077, and migrations 0001-0077 are byte-unchanged', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((name) => name.startsWith('0078_')).length, 1, 'exactly one migration carries the 0078 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0077_shared_standing_context_grant_resolution_boundary_v1.sql'));
  // The frozen chain is pinned as one digest over (name, git blob id) of every migration before 0078.
  const frozen = migrations.filter((name) => name < '0078_');
  assert.equal(frozen.length, 77, 'migrations 0001-0077 are all present');
  const manifest = createHash('sha256').update(frozen.map((name) => `${name} ${gitBlobId(read(`../migrations/${name}`))}`).join('\n')).digest('hex');
  assert.equal(manifest, '51e29fa762d6f0fed3099f6b2b3114fe9045308bf5401344908c21d1eb446f99', 'migrations 0001-0077 are byte-identical to their merged blobs');
});

test('the frozen kernel, I-03A evaluator and I-03B resolver sources are byte-unchanged and no API file invokes the consent commands', () => {
  for (const [path, blob] of [
    ['../../apps/api/src/connected-worlds/authority/standing-context-authority.types.ts', '7b6478480a5490ae52bae2316c2c0aa51a679cf5'],
    ['../../apps/api/src/connected-worlds/authority/standing-context-authority.ts', 'f08a3349994a6273ee9f4be4f6fa91bf50d0bc97'],
    ['../../apps/api/src/connected-worlds/authority/standing-context-authority.spec.ts', 'de2633d269552959bfa6666243e15be9ef80ae1c'],
    ['../../apps/api/src/connected-worlds/authority-resolution/standing-context-grant-resolver.service.ts', 'f72b2665e543c5259a9a682c53c721653c9779b7'],
    ['../../apps/api/src/connected-worlds/authority-resolution/standing-context-grant-resolver.service.spec.ts', '7593ff28c64b0346c71aa1ec13f3c21eb3fbc2e7'],
  ]) {
    assert.equal(gitBlobId(read(path)), blob, `${path} is byte-identical to its merged blob`);
  }
  // The kernel keeps its own directory-closure guard; app.module registers no Connected Worlds module.
  assert.match(read('../../apps/api/src/connected-worlds/kernel/connected-worlds-kernel.spec.ts'), /'authority\.types\.ts', 'material\.types\.ts', 'principal\.types\.ts', 'shared-world\.types\.ts', 'world-invariants\.ts', 'world\.types\.ts'/u);
  assert.doesNotMatch(read('../../apps/api/src/app.module.ts'), /connected-worlds|StandingContext/u);
  const apiSrc = new URL('../../apps/api/src/', import.meta.url);
  const sources = readdirSync(apiSrc, { recursive: true }).map(String).filter((name) => /\.(?:ts|js|mjs)$/u.test(name));
  const invokers = sources.filter((name) => new RegExp(`${GRANT_FN}|${REVOKE_FN}|standing_context_consent_events`, 'u').test(readFileSync(new URL(name, apiSrc), 'utf8')));
  assert.deepEqual(invokers, [], 'no API production or test file invokes the consent commands or reads consent events: the DB command is the boundary');
  const connectedWorlds = readdirSync(new URL('connected-worlds/', apiSrc), { recursive: true }).map(String);
  assert.deepEqual(connectedWorlds.filter((name) => /controller|module|gateway|\.dto\.|consent/u.test(name)), [], 'no controller, Nest module, gateway, DTO or consent service under connected-worlds');
});

test('the 0077 verifier correction removes only its future-global relation ceiling and keeps every I-03B proof', () => {
  assert.doesNotMatch(verifier0077, /standingContextRelations|relname ~\* 'standing_context'|added no table or view/u, 'the "Standing Context relations are exactly the two I-02B tables" ceiling is gone');
  assert.doesNotMatch(verifier0077, new RegExp(`${EVENTS}|consent|${GRANT_FN}|${REVOKE_FN}`, 'u'), 'the 0077 verifier is not made aware of the 0078 table or commands by name');
  for (const proof of [
    'pg_get_function_identity_arguments(pr.oid)',
    'pg_get_function_result(pr.oid)',
    "'p_world_id uuid, p_grantor_user_id uuid'",
    "'TABLE(grant_id uuid, world_id uuid, grantor_user_id uuid, status text, audience_user_id uuid)'",
    "assert.equal(fn.owner, 'postgres'",
    "assert.equal(fn.prosecdef, true",
    "assert.equal(fn.provolatile, 's'",
    "cfg === 'search_path=' || cfg === 'search_path=\"\"'",
    "has_function_privilege($1, $2, $3)",
    "for (const role of ['public', 'anon', 'authenticated'])",
    "['42501']",
    'has_table_privilege($1,$2,$3)',
    "await identity('service_role')",
    "SELECT * FROM ${table} LIMIT 1",
    "['P0002']",
    "['22023']",
    'an ACTIVE grant with an empty ceiling is one NULL-audience row',
    'a revoked grant is never chosen as the current grant',
    'only the new ACTIVE grant, never the revoked one',
    'resolution never depends on membership',
    "SELECT count(*)::int n FROM pg_trigger WHERE tgrelid=$1::regclass AND NOT tgisinternal",
    "for (const table of [...TABLES, WORLDS, EPISODES])",
    'no fixture row remains after completion',
    "await q('ROLLBACK')",
  ]) {
    assert.ok(verifier0077.includes(proof), `0077 verifier still proves: ${proof}`);
  }
  assert.doesNotMatch(verifier0077, /\bGRANT\b|CREATE POLICY|DISABLE ROW LEVEL SECURITY/u);
  // The I-03B static contract still proves that migration 0077 itself created no table / view / type / trigger / policy.
  const contract0077 = read('./shared-standing-context-grant-resolution-boundary-v1.test.mjs');
  assert.match(contract0077, /no table, view, trigger, policy, extension, type, index or alteration/u);
  assert.match(contract0077, /exactly one function/u);
});

test('the 0078 verifier proves schema, both ACLs, every command behaviour, the race and rolled-back or removed fixtures', () => {
  for (const proof of [
    'process.env.DATABASE_URL',
    "['id', 'uuid', 'NO', null]",
    "['occurred_at', 'timestamp with time zone', 'NO', 'CURRENT_TIMESTAMP']",
    "'shared_world_standing_context_consent_events_prior_grant_check'",
    'confdeltype',
    'ON DELETE RESTRICT',
    "'shared_world_standing_context_consent_events_birth_event_idx', true",
    'has_table_privilege($1,$2,$3)',
    'aclexplode(c.relacl)',
    'pg_policy WHERE polrelid',
    "SET LOCAL ROLE ${role}",
    "for (const role of ['public', 'anon', 'service_role'])",
    "assert.equal(allowed, true, `authenticated executes ${fn}`)",
    "for (const role of ['anon', 'service_role'])",
    '/STANDING_CONTEXT_AUTHENTICATION_REQUIRED/u',
    "assert.equal(fn.provolatile, 'v'",
    "u uuid := auth\\.uid\\(\\);",
    "['42501']", "['22023']", "['P0002']", "['40001']", "['23505']", "['55000']",
    "event_type: 'GRANTED', grant_id: grantA, prior_grant_id: null, grant_status: 'ACTIVE'",
    'the ceiling is a proper subset of membership, never auto-filled',
    '/STANDING_CONTEXT_AUDIENCE_NOT_CURRENT_MEMBER/u',
    '/STANDING_CONTEXT_GRANTOR_NOT_CURRENT_MEMBER/u',
    '/STANDING_CONTEXT_WORLD_NOT_ACTIVE/u',
    'an ACTIVE Introduction World accepts a grant and the grantor is not required inside the ceiling',
    '/STANDING_CONTEXT_AUDIENCE_DUPLICATE/u',
    "event_type: 'RECONFIRMED', grant_id: grantB, prior_grant_id: grantA, grant_status: 'ACTIVE'",
    'the old ceiling rows are unchanged',
    'the newer grant is untouched and no event is written',
    'the retry (audience in another order) returns the committed result',
    'the first-grant retry returns its committed result',
    '/STANDING_CONTEXT_COMMAND_ID_CONFLICT/u',
    '/STANDING_CONTEXT_GRANT_NOT_FOUND/u',
    "event_type: 'REVOKED', grant_id: grantB, prior_grant_id: null, grant_status: 'REVOKED'",
    'no grant or audience row is deleted; one REVOKED event is appended',
    'the resolver returns zero rows after revocation: history is not effective permission',
    'the revoke retry returns the committed result although the grant is already REVOKED',
    'the former member may still revoke their exact ACTIVE grant',
    'revocation survives World closure',
    'the event log itself is append-only under every application role',
    'the second first-grant command blocks on the locked World row instead of racing',
    "assert.equal(stale.code, '40001')",
    'never two ACTIVE grants, never an orphan event',
    'the resolver returns only the replacement ACTIVE grant',
    'no fixture row remains after completion',
    "await q('ROLLBACK')",
  ]) {
    assert.ok(verifier.includes(proof), `0078 verifier is missing ${proof}`);
  }
  assert.doesNotMatch(verifier, /supabase\.co|postgres(?:ql)?:\/\//iu, 'no connection detail is embedded');
  assert.doesNotMatch(verifier, /\bGRANT\b|CREATE POLICY|DISABLE ROW LEVEL SECURITY|session_replication_role/u, 'the verifier never widens an ACL or bypasses a rule to make a proof easy');
});

test('the verifier is wired into the toolchain, API CI after fresh migrations and the 0075 / 0076 / 0077 verifiers, and the database README', () => {
  assert.match(packageJson, /"verify:shared-standing-context-consent-commands:integration": "node --env-file-if-exists=\.env database\/verify-migration-0078\.mjs"/u);
  assert.equal((workflow.match(/verify:shared-standing-context-consent-commands:integration/gu) ?? []).length, 1, 'registered exactly once in API CI');
  const step = workflow.indexOf('run: npm run verify:shared-standing-context-consent-commands:integration');
  assert.ok(step > workflow.indexOf('name: Apply all migrations to fresh PostgreSQL'), 'the verifier runs after fresh migrations are applied');
  for (const predecessor of ['verify:connected-worlds-shared-persistence:integration', 'verify:shared-world-standing-context-grants:integration', 'verify:shared-standing-context-grant-resolution:integration']) {
    assert.ok(step > workflow.indexOf(`run: npm run ${predecessor}`), `the verifier runs after ${predecessor}`);
  }
  assert.match(workflow, /Verify Standing Context consent commands and immutable consent history against real PostgreSQL/u);
  assert.match(readme, /## Standing Context consent commands and immutable consent history \(migration 0078, I-03C\)/u);
  assert.match(readme, /npm run verify:shared-standing-context-consent-commands:integration/u);
  assert.match(readme, /CONSENT_EVENT_LOG != EFFECTIVE_GRANT_STATE/u);
  assert.match(readme, /`service_role` cannot execute them/u);
  assert.match(readme, /Reconfirm = revoke old \+ create\s+new/u);
  assert.match(readme, /allowed after membership loss and after the World closed/u);
});

test('anti-vacuity: every deliberate weakening of migration 0078 is refused by at least one structural check', () => {
  const mutations = [
    ['EXECUTE granted to service_role', (sql) => sql.replace(`GRANT EXECUTE ON FUNCTION public.${REVOKE_FN}(uuid, uuid, uuid) TO authenticated;`, `GRANT EXECUTE ON FUNCTION public.${REVOKE_FN}(uuid, uuid, uuid) TO authenticated, service_role;`)],
    ['service_role revoke dropped for the grant command', (sql) => sql.replace(`  EXECUTE 'REVOKE ALL ON FUNCTION public.${GRANT_FN}(uuid, uuid, uuid, uuid[], uuid) FROM service_role';\n`, '')],
    ['a grantor parameter', (sql) => sql.replace('p_command_id uuid, p_world_id uuid, p_expected_active_grant_id uuid\n)', 'p_command_id uuid, p_world_id uuid, p_expected_active_grant_id uuid, p_grantor_user_id uuid DEFAULT NULL\n)')],
    ['grantor taken from a parameter instead of auth.uid()', (sql) => sql.replace("DECLARE\n  u uuid := auth.uid();\n  locked_world_id uuid;", "DECLARE\n  u uuid := coalesce(p_expected_active_grant_id, auth.uid());\n  locked_world_id uuid;")],
    ['direct SELECT opened on consent events', (sql) => sql.replace(`REVOKE ALL ON TABLE public.${EVENTS} FROM PUBLIC, anon, authenticated;`, `REVOKE ALL ON TABLE public.${EVENTS} FROM PUBLIC, anon, authenticated;\nGRANT SELECT ON TABLE public.${EVENTS} TO authenticated;`)],
    ['an RLS policy', (sql) => sql.replace(`ALTER TABLE public.${EVENTS} ENABLE ROW LEVEL SECURITY;`, `ALTER TABLE public.${EVENTS} ENABLE ROW LEVEL SECURITY;\nCREATE POLICY consent_events_own ON public.${EVENTS} FOR SELECT TO authenticated USING (grantor_user_id = auth.uid());`)],
    ['a DECLINED event', (sql) => sql.replace("CHECK (event_type IN ('GRANTED', 'RECONFIRMED', 'REVOKED'))", "CHECK (event_type IN ('GRANTED', 'RECONFIRMED', 'REVOKED', 'DECLINED'))")],
    ['a cascading subject FK', (sql) => sql.replace(`FOREIGN KEY (subject_grant_id) REFERENCES public.${GRANTS} (id) ON DELETE RESTRICT`, `FOREIGN KEY (subject_grant_id) REFERENCES public.${GRANTS} (id) ON DELETE CASCADE`)],
    ['a generic scope column', (sql) => sql.replace('    prior_grant_id uuid,\n', '    prior_grant_id uuid,\n    scope jsonb,\n')],
    ['a client-supplied occurred_at', (sql) => sql.replace('p_command_id uuid, p_world_id uuid, p_expected_active_grant_id uuid\n)', 'p_command_id uuid, p_world_id uuid, p_expected_active_grant_id uuid, p_occurred_at timestamptz DEFAULT CURRENT_TIMESTAMP\n)')],
    ['membership no longer required for the grantor', (sql) => sql.replace("RAISE EXCEPTION 'STANDING_CONTEXT_GRANTOR_NOT_CURRENT_MEMBER' USING ERRCODE='42501';", "NULL;")],
    ['ceiling humans no longer required to be members', (sql) => sql.replace("RAISE EXCEPTION 'STANDING_CONTEXT_AUDIENCE_NOT_CURRENT_MEMBER' USING ERRCODE='42501';", "NULL;")],
    ['ceiling auto-filled from membership', (sql) => sql.replace(`  SELECT p_new_grant_id, a.audience_user_id FROM unnest(requested_ceiling) AS a(audience_user_id);`, `  SELECT p_new_grant_id, e.user_id FROM public.${EPISODES} e WHERE e.world_id = p_world_id AND e.ended_at IS NULL;`)],
    ['duplicates silently normalized', (sql) => sql.replace("    RAISE EXCEPTION 'STANDING_CONTEXT_AUDIENCE_DUPLICATE' USING ERRCODE='22023';\n", "    NULL;\n")],
    ['the grantor forced into the ceiling', (sql) => sql.replace('  intended_event_type := CASE', '  requested_ceiling := array_append(requested_ceiling, u);\n  intended_event_type := CASE')],
    ['compare-and-swap applies to whatever is current', (sql) => sql.replace("  IF current_active_id IS DISTINCT FROM p_expected_active_grant_id THEN\n    RAISE EXCEPTION 'STANDING_CONTEXT_STALE_STATE' USING ERRCODE='40001';\n  END IF;\n", '')],
    ['the historical ceiling edited in place', (sql) => sql.replace(`INSERT INTO public.${GRANTS} (id, world_id, grantor_user_id, status)\n  VALUES (p_new_grant_id, p_world_id, u, 'ACTIVE');`, `UPDATE public.${AUDIENCE} a SET audience_user_id = a.audience_user_id WHERE a.grant_id = p_expected_active_grant_id;\n  INSERT INTO public.${GRANTS} (id, world_id, grantor_user_id, status)\n  VALUES (p_new_grant_id, p_world_id, u, 'ACTIVE');`)],
    ['a revoked grant reactivated', (sql) => sql.replace(`INSERT INTO public.${GRANTS} (id, world_id, grantor_user_id, status)\n  VALUES (p_new_grant_id, p_world_id, u, 'ACTIVE');`, `UPDATE public.${GRANTS} g SET status = 'ACTIVE', revoked_at = NULL WHERE g.id = p_new_grant_id;`)],
    ['revoke falls back to the current grant', (sql) => sql.replace('   WHERE g.id = p_expected_active_grant_id AND g.world_id = p_world_id AND g.grantor_user_id = u\n   FOR UPDATE;', "   WHERE g.world_id = p_world_id AND g.grantor_user_id = u AND g.status = 'ACTIVE' ORDER BY g.granted_at DESC LIMIT 1\n   FOR UPDATE;")],
    ['revoke requires current membership', (sql) => sql.replace("  IF target.status <> 'ACTIVE' THEN RAISE EXCEPTION 'STANDING_CONTEXT_STALE_STATE' USING ERRCODE='40001'; END IF;", `  IF target.status <> 'ACTIVE' THEN RAISE EXCEPTION 'STANDING_CONTEXT_STALE_STATE' USING ERRCODE='40001'; END IF;\n  IF NOT EXISTS (SELECT 1 FROM public.${EPISODES} e WHERE e.world_id = p_world_id AND e.user_id = u AND e.ended_at IS NULL) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;`)],
    ['the World lock removed from the revoke command', (sql) => sql.replace("  SELECT w.id INTO locked_world_id FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;\n  IF NOT FOUND THEN RAISE EXCEPTION 'STANDING_CONTEXT_WORLD_NOT_FOUND' USING ERRCODE='P0002'; END IF;", "  SELECT w.id INTO locked_world_id FROM public.shared_worlds w WHERE w.id = p_world_id;\n  IF NOT FOUND THEN RAISE EXCEPTION 'STANDING_CONTEXT_WORLD_NOT_FOUND' USING ERRCODE='P0002'; END IF;")],
    ['the semantic retry check dropped (any reuse replays)', (sql) => sql.replace('       AND committed_ceiling IS NOT DISTINCT FROM requested_ceiling THEN', '       THEN')],
    ['the command-id conflict downgraded to a replay', (sql) => sql.replace("    RAISE EXCEPTION 'STANDING_CONTEXT_COMMAND_ID_CONFLICT' USING ERRCODE='23505';\n  END IF;\n\n  -- The exact expected grant", "    RETURN QUERY SELECT committed.id, committed.event_type, committed.subject_grant_id, committed.prior_grant_id, 'REVOKED'::text;\n    RETURN;\n  END IF;\n\n  -- The exact expected grant")],
    ['a second idempotency table', (sql) => sql.replace('-- 2. Deny-by-default posture', 'CREATE TABLE public.standing_context_command_log (id uuid PRIMARY KEY);\n-- 2. Deny-by-default posture')],
    ['a TTL', (sql) => sql.replace("    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,\n", "    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    valid_until timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP + interval '30 days',\n")],
    ['a material disclosure literal', (sql) => sql.replace("  RETURN QUERY SELECT p_command_id, 'REVOKED'::text, p_expected_active_grant_id, NULL::uuid, 'REVOKED'::text;", "  RETURN QUERY SELECT p_command_id, 'REVOKED'::text, p_expected_active_grant_id, NULL::uuid, 'DISCLOSE'::text;")],
    ['a membership trigger', (sql) => sql.replace('-- 5. Ownership and least-privilege execute ACL', `CREATE TRIGGER widen_ceiling AFTER INSERT ON public.${EPISODES} FOR EACH ROW EXECUTE FUNCTION public.${GRANT_FN}();\n-- 5. Ownership and least-privilege execute ACL`)],
    ['the World lifecycle check dropped', (sql) => sql.replace("  IF world_lifecycle <> 'ACTIVE' THEN RAISE EXCEPTION 'STANDING_CONTEXT_WORLD_NOT_ACTIVE' USING ERRCODE='55000'; END IF;\n", '')],
    ['the self-assertion no longer refuses service_role execution', (sql) => sql.replace("FOREACH target_role IN ARRAY ARRAY['anon','service_role'] LOOP\n      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) AND has_function_privilege(target_role, fn, 'EXECUTE') THEN", "FOREACH target_role IN ARRAY ARRAY['anon'] LOOP\n      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) AND has_function_privilege(target_role, fn, 'EXECUTE') THEN")],
  ];
  const survivors = [];
  for (const [label, mutate] of mutations) {
    const mutated = mutate(migration);
    assert.notEqual(mutated, migration, `mutation "${label}" applies to the current migration text`);
    let refused = false;
    try {
      const parts = analyse(mutated);
      for (const check of Object.values(checks)) check(parts);
    } catch {
      refused = true;
    }
    if (!refused) survivors.push(label);
  }
  assert.deepEqual(survivors, [], 'every mutation is refused by at least one check');
  assert.equal(mutations.length, 29);
});
