import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

// COSMOS E-2 corrections, Slice B — the Personal conversation catalog (migration 0197), under the Product Owner's
// decision D-2 of 2026-11-20 (the controlled T-13 / T-12P amendment: a SERVER-AUTHORITATIVE catalog, "New Chat" as the
// approved fresh-start action, idempotent Session creation, a durable manual title, correct activity ordering, and a new
// conversation that never erases or replaces an existing one). This is the STATIC contract; live semantics are proven
// against real PostgreSQL by database/verify-migration-0197.mjs, which runs in API CI (no PostgreSQL binary exists on the
// Windows development machine, so the verifier is NOT TESTED locally and is reported as such).

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION = '0197_cosmos_e2_conversation_catalog_v1.sql';
const migration = read(`../migrations/${MIGRATION}`);
const verifier = read('../verify-migration-0197.mjs');
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
const createV2 = section('CREATE FUNCTION public.create_conversation_session_v2', '-- 4. THE CATALOG READ');
const list = section('CREATE FUNCTION public.list_conversation_sessions_v1', '-- 5. THE MANUAL TITLE');
const setTitle = section('CREATE FUNCTION public.set_conversation_session_title_v1', '-- 6. OWNERSHIP AND ACL');

test('0197 is the last migration, forward-only, one transaction, and touches no earlier command', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  // RE-ANCHORED by COSMOS E-2 corrections, Slice A (0198 follows; the last-migration pin lives in its own contract).
  const at = migrations.indexOf(MIGRATION);
  assert.ok(at >= 0, '0197 exists');
  assert.equal(migrations[at - 1], '0196_s8b_07_transient_media_v1.sql', 'exactly 0197 follows 0196');
  assert.equal(migrations.filter((name) => name.startsWith('0197_')).length, 1);
  assert.equal((code.match(/^BEGIN;$/gmu) ?? []).length, 1);
  assert.equal((code.match(/^COMMIT;$/gmu) ?? []).length, 1);
  assert.doesNotMatch(code, /CREATE OR REPLACE FUNCTION/u, 'no earlier function is replaced: 0030 and the turn commands are untouched');
  assert.doesNotMatch(code, /DROP (?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN)\b/u);
  assert.doesNotMatch(code, /ALTER TABLE public\.conversation_turns/u, 'the turn table is not changed');
  assert.doesNotMatch(code, /last_activity_at\s*=/u, 'last_activity_at is not rewritten: recency is a QUERY over the newest turn');
  assert.doesNotMatch(code, /^\s*(?:UPDATE\s+\S+\s+SET|DELETE FROM|TRUNCATE)\b/gmu, 'no backfill, no rewrite, no deletion');
});

test('A — the client request identity is additive, bounded and unique per person', () => {
  assert.match(code, /ALTER TABLE public\.conversation_sessions ADD COLUMN client_request_id text;/u);
  assert.match(code, /CHECK \(client_request_id IS NULL OR length\(client_request_id\) BETWEEN 1 AND 128\)/u);
  assert.match(code, /CREATE UNIQUE INDEX conversation_sessions_user_client_request_unique\n\s*ON public\.conversation_sessions \(user_id, client_request_id\) WHERE client_request_id IS NOT NULL;/u);
});

test('B — the title ledger is owner-scoped, append-only, client-unreachable, and leaves only with its Session', () => {
  assert.match(code, /CREATE TABLE public\.conversation_session_titles \(\n\s*id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,/u);
  assert.match(code, /FOREIGN KEY \(session_id, user_id\) REFERENCES public\.conversation_sessions \(id, user_id\) ON DELETE CASCADE/u);
  assert.match(code, /CHECK \(length\(title\) BETWEEN 1 AND 80\)/u);
  assert.match(code, /CREATE TRIGGER conversation_session_titles_append_only\n\s*BEFORE UPDATE ON public\.conversation_session_titles FOR EACH ROW/u);
  assert.match(code, /ALTER TABLE public\.conversation_session_titles ENABLE ROW LEVEL SECURITY;/u);
  assert.match(code, /REVOKE ALL ON TABLE public\.conversation_session_titles FROM PUBLIC;/u);
  assert.match(code, /REVOKE ALL ON TABLE public\.conversation_session_titles FROM %I/u);
  assert.doesNotMatch(code, /GRANT [A-Z, ]+ ON TABLE public\.conversation_session_titles/u, 'no role holds a table privilege on the ledger');
  assert.doesNotMatch(code, /CREATE POLICY/u, 'no policy opens the ledger: every reach is through the definers');
  // No mutable label column on any canonical table: the title lives in its own ledger (the D-4 principle, applied here).
  assert.doesNotMatch(code, /ALTER TABLE public\.conversation_sessions ADD COLUMN title/u);
});

test('C — the three definers derive the owner from auth.uid(), fail closed, and are reachable by the person only', () => {
  for (const [fn, body] of [['create_conversation_session_v2', createV2], ['list_conversation_sessions_v1', list], ['set_conversation_session_title_v1', setTitle]]) {
    assert.match(body, /SECURITY DEFINER SET search_path = ''/u, `${fn} is a search_path-pinned definer`);
    assert.match(body, /u uuid := auth\.uid\(\)/u, `${fn} derives the caller`);
    assert.match(body, /IF u IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;/u, `${fn} refuses no identity`);
    assert.doesNotMatch(body, /p_user_id|p_owner/u, `${fn} takes no caller-supplied owner`);
  }
  // v2: the 0030 shape, plus the request identity; ON CONFLICT answers the EARLIER Session, never a second one.
  assert.match(createV2, /VALUES \(p_id, u, 'ACTIVE', 'TEXT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, p_client_request_id\)/u);
  assert.match(createV2, /ON CONFLICT \(user_id, client_request_id\) WHERE client_request_id IS NOT NULL DO NOTHING/u);
  assert.match(createV2, /SELECT \* INTO earlier FROM public\.conversation_sessions s WHERE s\.user_id = u AND s\.client_request_id = p_client_request_id;/u);
  assert.match(createV2, /RAISE EXCEPTION 'INVALID_CLIENT_REQUEST_ID' USING ERRCODE = '22023'/u);
  // list: owned rows, newest ACTIVITY first, the opening is the first USER message excerpt, bounded.
  assert.match(list, /LANGUAGE plpgsql STABLE SECURITY DEFINER/u, 'the catalog read writes nothing');
  assert.match(list, /WHERE s\.user_id = u\n/u);
  assert.match(list, /ORDER BY coalesce\(a\.last_turn_at, s\.created_at\) DESC, s\.id DESC/u);
  assert.match(list, /c\.role = 'USER'\n\s*ORDER BY c\.created_at ASC, c\.id ASC LIMIT 1/u, 'the opening is the person’s own first message');
  assert.match(list, /left\(btrim\(regexp_replace\(c\.content, '\\s\+', ' ', 'g'\)\), 120\)/u);
  assert.match(list, /LIMIT least\(greatest\(coalesce\(p_limit, 50\), 1\), 100\)/u);
  assert.match(list, /ORDER BY l\.id DESC LIMIT 1\) t ON true/u, 'the newest ledger row is the title');
  // set title: whitespace-normalised, 1..80, an unowned Session is FORBIDDEN (never "not found"), an INSERT only.
  assert.match(setTitle, /normalized := btrim\(regexp_replace\(coalesce\(p_title, ''\), '\\s\+', ' ', 'g'\)\);/u);
  assert.match(setTitle, /IF length\(normalized\) < 1 OR length\(normalized\) > 80 THEN RAISE EXCEPTION 'INVALID_TITLE' USING ERRCODE = '22023'; END IF;/u);
  assert.match(setTitle, /WHERE s\.id = p_session_id AND s\.user_id = u\) THEN\n\s*RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;/u);
  assert.match(setTitle, /RETURN QUERY INSERT INTO public\.conversation_session_titles \(session_id, user_id, title\)/u);
  assert.doesNotMatch(setTitle, /UPDATE|DELETE/u, 'a rename appends');
  // ACL: EXECUTE to authenticated only; anon and service_role revoked; the self-assertions refuse anything else.
  assert.match(code, /FOREACH fn IN ARRAY fns LOOP EXECUTE format\('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn\); END LOOP;/u);
  assert.match(code, /RAISE EXCEPTION 'COSMOS E-2 Slice B: % is reachable by anon or service_role', fn;/u);
  assert.match(code, /RAISE EXCEPTION 'COSMOS E-2 Slice B: the title ledger is not append-only';/u);
  assert.match(code, /RAISE EXCEPTION 'COSMOS E-2 Slice B: a client role holds a privilege on the title ledger';/u);
});

test('the real-PostgreSQL verifier exists, covers T0–T5, is wired in package.json and API CI, and retains nothing', () => {
  assert.ok(existsSync(new URL('../verify-migration-0197.mjs', import.meta.url)));
  for (const stage of ['T0 catalogue', 'T1 idempotent creation', 'T2 isolation', 'T3 the catalog', 'T4 the title', 'T5 deletion']) {
    assert.ok(verifier.includes(`stage = '${stage}'`), `the verifier runs ${stage}`);
  }
  assert.match(verifier, /await q\('BEGIN'\);[\s\S]*await q\('ROLLBACK'\);/u, 'every fixture is rolled back');
  assert.match(verifier, /assert\.equal\(again\.id, firstId, 'the same request identity answers the EARLIER Session'\);/u);
  assert.match(verifier, /a new conversation never erased or replaced an existing one/u);
  assert.match(verifier, /the newest ACTIVITY first: a turn outranks a later creation/u);
  assert.match(verifier, /\['55000'\], \/append-only\/u\)/u);
  assert.doesNotMatch(verifier, /readFile|client\.query\(migration\)|CREATE FUNCTION|GRANT EXECUTE/u, 'the verifier proves the applied database, it never re-applies the migration');
  assert.equal(packageJson.scripts['verify:conversation-catalog:integration'], 'node --env-file-if-exists=.env database/verify-migration-0197.mjs');
  assert.equal(packageJson.scripts['test:cosmos-e2-conversation-catalog-contract'], 'node --test database/tests/cosmos-e2-conversation-catalog-v1.test.mjs');
  assert.match(workflow, /- name: Verify COSMOS E-2 Slice B conversation catalog \(0197\) against real PostgreSQL\n\s*run: npm run verify:conversation-catalog:integration/u);
  const after0196 = workflow.indexOf('run: npm run verify:s8b-07-transient-media:integration');
  assert.ok(after0196 >= 0 && workflow.indexOf('run: npm run verify:conversation-catalog:integration') > after0196, '0197 is verified after 0196');
});

test('the API reaches the catalog through the three 0197 commands only, owner-scoped, with the 0030 creation unchanged', () => {
  const repository = read('../../apps/api/src/conversation/conversation.repository.ts');
  const service = read('../../apps/api/src/conversation/conversation.service.ts');
  const controller = read('../../apps/api/src/conversation/conversation.controller.ts');
  assert.match(repository, /'rpc\/create_conversation_session_v1', \{\n\s*method: 'POST',\n\s*body: JSON\.stringify\(\{ p_id: id \}\),/u, 'the 0030 creation is unchanged');
  assert.match(repository, /'rpc\/create_conversation_session_v2', \{\n\s*method: 'POST',\n\s*body: JSON\.stringify\(\{ p_id: id, p_client_request_id: clientRequestId \}\),/u);
  assert.match(repository, /'rpc\/list_conversation_sessions_v1', \{\n\s*method: 'POST',\n\s*body: JSON\.stringify\(\{ p_limit: limit \}\),/u);
  assert.match(repository, /'rpc\/set_conversation_session_title_v1', \{\n\s*method: 'POST',\n\s*body: JSON\.stringify\(\{ p_session_id: sessionId, p_title: title \}\),/u);
  assert.doesNotMatch(repository, /conversation_session_titles\?/u, 'never a direct table read of the ledger');
  assert.match(controller, /@Post\('sessions'\)\n\s*createSession\(@Req\(\) request: AuthenticatedRequest, @Body\(\) body: unknown\)/u);
  assert.match(controller, /@Get\('sessions'\)\n\s*listSessions\(/u);
  assert.match(controller, /@Patch\('sessions\/:sessionId\/title'\)\n\s*renameSession\(/u);
  assert.match(service, /const clientRequestId = this\.validateClientRequestId\(body\);/u);
  assert.match(service, /clientRequestId === null\n\s*\? await this\.repository\.createSession\(accessToken, randomUUID\(\)\)\n\s*: await this\.repository\.createSessionForRequest\(accessToken, randomUUID\(\), clientRequestId\);/u,
    'without a request identity the creation is exactly the 0030 path');
  assert.match(service, /const CLIENT_REQUEST_ID_MAX = 128;\nconst SESSION_TITLE_MAX = 80;\nconst CATALOG_DEFAULT_LIMIT = 50;\nconst CATALOG_MAX_LIMIT = 100;/u);
  assert.match(service, /error instanceof DataApiError && \(error\.status === 403 \|\| error\.status === 401\)[\s\S]{0,80}NotFoundException/u, 'an unowned Session is not found, never leaked');
});
