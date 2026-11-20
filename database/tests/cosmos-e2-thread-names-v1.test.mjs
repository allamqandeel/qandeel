import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

// COSMOS E-2 corrections, Slice A — Personal topic identity (migration 0198), under the Product Owner's decisions D-3 and
// D-4 of 2026-11-20: the grounding wording as the default shown name, the person's own alias above it, the Thread's
// origin, delivered as the ADDITIVE Controlled Personal Projection V2 over a byte-identical V1, with the alias in a
// SEPARATE append-only ledger (never a label column on a canonical Thread table). This is the STATIC contract; the
// posture is proven against real PostgreSQL by database/verify-migration-0198.mjs in API CI (no PostgreSQL binary exists
// on the Windows development machine, so the verifier is NOT TESTED locally and is reported as such).

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION = '0198_cosmos_e2_thread_names_v1.sql';
const migration = read(`../migrations/${MIGRATION}`);
const verifier = read('../verify-migration-0198.mjs');
const packageJson = JSON.parse(read('../../package.json'));
const workflow = read('../../.github/workflows/api-ci.yml');
const stripSql = (text) => text.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const code = stripSql(migration);
const section = (from, to) => {
  const start = migration.indexOf(from);
  const end = migration.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `section ${from} was located`);
  return stripSql(migration.slice(start, end));
};
const setAlias = section('CREATE FUNCTION public.set_conversation_thread_alias_v1', '-- 3. Controlled Personal Projection V2');
const v2 = section('CREATE FUNCTION public.get_session_historical_projection_v2', '-- 4. Ownership and the ACL');

test('0198 is the last migration, forward-only, one transaction, and replaces nothing: V1 (0072) stays byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1), MIGRATION, 'exactly 0198 follows 0197');
  assert.equal(migrations.at(-2), '0197_cosmos_e2_conversation_catalog_v1.sql');
  assert.equal(migrations.filter((name) => name.startsWith('0198_')).length, 1);
  assert.equal((code.match(/^BEGIN;$/gmu) ?? []).length, 1);
  assert.equal((code.match(/^COMMIT;$/gmu) ?? []).length, 1);
  assert.doesNotMatch(code, /CREATE OR REPLACE FUNCTION/u, 'no earlier function is replaced: V1 is untouched');
  assert.doesNotMatch(code, /DROP (?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN)\b/u);
  assert.doesNotMatch(code, /ALTER TABLE public\.conversation_threads\b/u, 'the canonical Thread table gains no column: no mutable label, ever (0068)');
  assert.doesNotMatch(code, /ALTER TABLE public\.conversation_thread_homes\b|ALTER TABLE public\.conversation_emerging_focuses\b/u);
  assert.doesNotMatch(code, /^\s*(?:UPDATE\s+\S+\s+SET|DELETE FROM|TRUNCATE)\b/gmu, 'no backfill, no rewrite, no deletion');
  // The 0072 definition of V1 is the one and only definition in the repository.
  const definitions = migrations.filter((name) => /FUNCTION public\.get_session_historical_projection_v1\(/u.test(read(`../migrations/${name}`)));
  assert.deepEqual(definitions, ['0072_historical_coverage_projection_disclosure_v1.sql'], 'V1 is defined once, in 0072');
});

test('A — the alias ledger is owner-scoped, append-only, client-unreachable, and leaves with its Thread', () => {
  assert.match(code, /CREATE TABLE public\.conversation_thread_aliases \(\n\s*id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,/u);
  assert.match(code, /thread_id uuid NOT NULL REFERENCES public\.conversation_threads \(id\) ON DELETE CASCADE,/u);
  assert.match(code, /CHECK \(length\(alias\) BETWEEN 1 AND 60\)/u);
  assert.match(code, /CREATE INDEX conversation_thread_aliases_thread_newest ON public\.conversation_thread_aliases \(thread_id, id DESC\);/u);
  assert.match(code, /CREATE TRIGGER conversation_thread_aliases_append_only\n\s*BEFORE UPDATE ON public\.conversation_thread_aliases/u);
  assert.match(code, /RAISE EXCEPTION 'conversation_thread_aliases is append-only' USING ERRCODE='55000';/u);
  assert.match(code, /ALTER TABLE public\.conversation_thread_aliases ENABLE ROW LEVEL SECURITY;/u);
  assert.match(code, /REVOKE ALL ON TABLE public\.conversation_thread_aliases FROM PUBLIC, anon, authenticated, service_role;/u);
  assert.doesNotMatch(code, /GRANT [A-Z, ]+ ON TABLE public\.conversation_thread_aliases/u, 'no role holds a table privilege on the ledger');
  assert.doesNotMatch(code, /CREATE POLICY/u, 'no policy opens the ledger: every reach is through the definers');
});

test('B — the alias definer derives the owner from auth.uid(), normalises, bounds, and fails closed with no existence oracle', () => {
  assert.match(setAlias, /RETURNS TABLE \(thread_id uuid, alias text, created_at timestamptz\)/u);
  assert.match(setAlias, /LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''/u);
  assert.match(setAlias, /caller uuid := auth\.uid\(\);/u);
  assert.match(setAlias, /IF caller IS NULL THEN\n\s*RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';/u);
  assert.match(setAlias, /RAISE EXCEPTION 'INVALID_THREAD_ID' USING ERRCODE='22023';/u);
  assert.match(setAlias, /normalised := btrim\(regexp_replace\(coalesce\(p_alias, ''\), '\\s\+', ' ', 'g'\)\);/u);
  assert.match(setAlias, /IF length\(normalised\) < 1 OR length\(normalised\) > 60 THEN\n\s*RAISE EXCEPTION 'INVALID_ALIAS' USING ERRCODE='22023'/u);
  assert.match(setAlias, /IF NOT EXISTS \(SELECT 1 FROM public\.conversation_threads t WHERE t\.id = p_thread_id AND t\.user_id = caller\) THEN\n\s*RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';/u);
  assert.match(setAlias, /INSERT INTO public\.conversation_thread_aliases \(thread_id, user_id, alias\)\n\s*VALUES \(p_thread_id, caller, normalised\)/u);
  assert.doesNotMatch(setAlias, /UPDATE |DELETE /u, 'an alias is appended, never rewritten');
});

test('C — V2 is V1 plus name and origin per Thread: V1 decides, V2 re-derives nothing, the alias wins, the wording is bounded', () => {
  assert.match(v2, /LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''/u);
  assert.match(v2, /FROM public\.get_session_historical_projection_v1\(p_session_id, p_tc\) v;/u, 'V2 reads V1 and nothing else decides visibility');
  assert.match(v2, /caller uuid := auth\.uid\(\);/u);
  assert.match(v2, /JOIN public\.conversation_threads t ON t\.id = \(e\.value ->> 'id'\)::uuid AND t\.user_id = caller/u, 'only the caller\'s own Threads are enriched');
  assert.match(v2, /WHEN al\.alias IS NOT NULL THEN jsonb_build_object\('text', al\.alias, 'source', 'USER_ALIAS'\)/u);
  assert.match(v2, /WHEN gw\.wording IS NOT NULL THEN jsonb_build_object\('text', gw\.wording, 'source', 'GROUNDING_WORDING'\)/u);
  assert.match(v2, /ELSE jsonb_build_object\('text', NULL, 'source', 'NONE'\)/u, 'no name is an honest NONE, never an invented title');
  assert.match(v2, /'origin', jsonb_build_object\('sessionId', t\.established_session_id, 'sp', t\.established_sp\)/u);
  assert.match(v2, /ORDER BY a\.id DESC LIMIT 1/u, 'the newest alias row is the alias');
  assert.match(v2, /left\(btrim\(regexp_replace\(r\.anchor_text, '\\s\+', ' ', 'g'\)\), 80\) AS wording/u);
  assert.match(v2, /ON r\.resolved_handle_id = f\.grounding_handle_id AND r\.session_id = f\.session_id/u, 'the wording is the RESOLVED anchor of the grounding handle');
  assert.match(v2, /WHERE f\.id = t\.grounding_emerging_focus_id\n\s*AND r\.session_position <= t\.established_sp/u, 'bounded by the establishing Session Position: temporal honesty');
  assert.match(v2, /ORDER BY r\.session_position, r\.same_sp_event_sequence, r\.reference_index\n\s*LIMIT 1/u, 'the FIRST resolution, as 0072 derives subject_text');
  assert.match(v2, /ORDER BY e\.ordinality\), '\[\]'::jsonb\)/u, 'V1\'s Thread order is kept');
  for (const forbidden of [/similarity/iu, /embedding/iu, /hypotheses/u, /statement/u, /summary/u, /count\(\*\)/u]) {
    assert.doesNotMatch(v2, forbidden, `no name is derived from ${forbidden}: no AI title, no Reading, no count`);
  }
  // Grants: the person only; service_role refused (0030 posture), identical for both definers; the V2 row shape is V1's.
  assert.match(code, /'public\.set_conversation_thread_alias_v1\(uuid, text\)',\n\s*'public\.get_session_historical_projection_v2\(uuid, integer\)'/u);
  assert.match(code, /EXECUTE format\('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn\);/u);
  assert.match(code, /EXECUTE format\('REVOKE ALL ON FUNCTION %s FROM service_role', fn\);/u);
  assert.match(code, /RAISE EXCEPTION '0198: V2 must return V1''s row shape';/u);
});

test('the real-PostgreSQL verifier exists, covers T0–T3, states its Thread-seeding limit, is wired in package.json and API CI, and retains nothing', () => {
  assert.equal(existsSync(new URL('../verify-migration-0198.mjs', import.meta.url)), true);
  for (const stage of ["'T0 catalogue'", "'T1 the alias fails closed'", "'T2 V2 refuses as V1 refuses'", "'T3 append-only'"]) {
    assert.ok(verifier.includes(stage), `the verifier runs ${stage}`);
  }
  assert.match(verifier, /does NOT seed Threads/u, 'the verifier states what it cannot prove');
  assert.match(verifier, /NOT TESTED here/u);
  assert.match(verifier, /V2 answers exactly as V1 answers: V2 re-derives nothing/u);
  assert.match(verifier, /FORBIDDEN, never "not found"/u);
  assert.equal((verifier.match(/await q\('BEGIN'\)/gu) ?? []).length, 1);
  assert.match(verifier, /await q\('ROLLBACK'\);\n\s*console\.log\('migration 0198 verified'\);/u);
  assert.doesNotMatch(verifier, /COMMIT/u, 'nothing is retained');
  assert.equal(packageJson.scripts['verify:thread-names:integration'], 'node --env-file-if-exists=.env database/verify-migration-0198.mjs');
  assert.equal(packageJson.scripts['test:cosmos-e2-thread-names-contract'], 'node --test database/tests/cosmos-e2-thread-names-v1.test.mjs');
  const catalog = workflow.indexOf('run: npm run verify:conversation-catalog:integration');
  const names = workflow.indexOf('run: npm run verify:thread-names:integration');
  assert.ok(catalog >= 0 && names > catalog, 'API CI verifies 0198 against real PostgreSQL right after 0197');
});

test('the API reaches V2 and the alias through the two 0198 commands only, owner-scoped, additively over the frozen mapper', () => {
  const api = (path) => read(`../../apps/api/src/${path}`).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
  const projectionRepository = api('historical-projection/historical-projection.repository.ts');
  assert.match(projectionRepository, /'rpc\/get_session_historical_projection_v2'/u, 'ONE owner-scoped read: V2');
  assert.doesNotMatch(projectionRepository, /get_session_historical_projection_v1/u, 'the API no longer calls V1 directly (V2 wraps it)');
  assert.equal((projectionRepository.match(/'rpc\//gu) ?? []).length, 1, 'still exactly ONE RPC');
  const mapper = api('historical-projection/historical-projection-mapper.ts');
  assert.match(mapper, /const THREAD_KEYS = \['id', 'establishmentPath', 'establishedInSession', 'establishedSp', 'groundingEmergingFocusId', 'home', 'sessionLifecycle', 'name', 'origin'\] as const;/u);
  assert.match(mapper, /const THREAD_NAME_SOURCES = \['USER_ALIAS', 'GROUNDING_WORDING', 'NONE'\] as const;/u);
  const repository = api('conversation/conversation.repository.ts');
  assert.match(repository, /'rpc\/set_conversation_thread_alias_v1'/u);
  assert.match(repository, /p_thread_id: threadId, p_alias: alias/u);
  const controller = api('conversation/conversation.controller.ts');
  assert.match(controller, /@Patch\('threads\/:threadId\/alias'\)/u);
  const service = api('conversation/conversation.service.ts');
  assert.match(service, /THREAD_ALIAS_MAX = 60/u);
  assert.match(service, /renameThread\(/u);
  const census = api('http-security/route-rate-limit.census.ts');
  assert.match(census, /'PATCH \/conversation\/threads\/:threadId\/alias': 'CONVERSATION'/u);
});
