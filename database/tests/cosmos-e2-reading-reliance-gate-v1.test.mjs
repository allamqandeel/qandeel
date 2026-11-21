import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// COSMOS E-2 corrections — the Reading statement (migration 0200), under the Product Owner's directive "COMPLETE ALL
// CORRECTIONS BEFORE FINAL CI" of 2026-11-21 (contract §31.9.2 (a), §31.10): the Personal projection V2 discloses a
// Reading's own words exactly when QANDEEL may rely on it (PG-02 / INTEL-TM-01, 0151). This is the STATIC contract; the
// gate is proven against real PostgreSQL by database/verify-migration-0200.mjs in API CI (and was run locally on an
// embedded PostgreSQL 17).

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION = '0200_cosmos_e2_reading_reliance_gate_v1.sql';
const migration = read(`../migrations/${MIGRATION}`);
const verifier = read('../verify-migration-0200.mjs');
const packageJson = JSON.parse(read('../../package.json'));
const workflow = read('../../.github/workflows/api-ci.yml');
const code = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const api = (path) => read(`../../apps/api/src/${path}`);
const mobile = (path) => read(`../../apps/mobile/src/${path}`);

test('0200 follows 0199, forward-only, one transaction, and replaces exactly V2 — never V1, never a table', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  const at = migrations.indexOf(MIGRATION);
  assert.ok(at >= 0, '0200 exists');
  assert.equal(migrations[at - 1], '0199_cosmos_e2_current_personal_world_v1.sql', 'exactly 0200 follows 0199');
  assert.equal(migrations.filter((name) => name.startsWith('0200_')).length, 1);
  assert.equal((code.match(/^BEGIN;$/gmu) ?? []).length, 1);
  assert.equal((code.match(/^COMMIT;$/gmu) ?? []).length, 1);
  assert.deepEqual([...code.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (public\.\w+)/gu)].map((m) => m[0]),
    ['CREATE OR REPLACE FUNCTION public.get_session_historical_projection_v2'], 'exactly ONE definition: V2, replaced');
  assert.doesNotMatch(code, /get_session_historical_projection_v1\s*\(\s*p_session_id uuid/u, 'V1 is called, never redefined');
  assert.doesNotMatch(code, /(?:CREATE|ALTER|DROP)\s+(?:TABLE|INDEX|POLICY|TRIGGER|VIEW)\b/u, 'no table, index, policy, trigger or view');
  assert.doesNotMatch(code, /^\s*(?:INSERT INTO|UPDATE\s+\S+\s+SET|DELETE FROM|TRUNCATE)\b/gmu, 'no write of any kind');
});

test('A — V2 keeps its signature, its row shape, V1 as the only source, and the 0198 Thread enrichment', () => {
  assert.match(code, /CREATE OR REPLACE FUNCTION public\.get_session_historical_projection_v2\(p_session_id uuid, p_tc integer\)/u);
  assert.match(code, /LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS \$\$/u);
  assert.match(code, /caller uuid := auth\.uid\(\);/u);
  assert.match(code, /FROM public\.get_session_historical_projection_v1\(p_session_id, p_tc\) v/u, 'V1 decides every rung');
  assert.match(code, /'USER_ALIAS'[\s\S]*'GROUNDING_WORDING'[\s\S]*'NONE'/u, 'the 0198 name law is kept');
  assert.match(code, /RAISE EXCEPTION '0200: V2 must return the V1 row shape'/u);
});

test('B — each Reading is gated through the ONE 0151 reliance core, on the caller\'s own Hypothesis row, failing closed', () => {
  assert.equal((code.match(/public\.hypothesis_evidence_change_core_v1\(/gu) ?? []).length, 1, 'the core is called once, and nothing else decides');
  assert.match(code, /FROM public\.hypotheses h\s+WHERE h\.id = \(e\.value ->> 'id'\)::uuid AND h\.user_id = caller\), 'REVIEW_PENDING'\) AS change/u,
    'the caller\'s own row; a row that cannot be found is withheld');
  assert.match(code, /CASE WHEN r\.change = 'NONE'\s+THEN e\.value \|\| jsonb_build_object\('evidenceChange', 'NONE'\)/u, 'a relied-on Reading is V1\'s plus NONE');
  assert.match(code, /'statement', NULL, 'assumptions', '\[\]'::jsonb, 'disconfirmingConditions', '\[\]'::jsonb,\s+'evidenceChange', r\.change\)/u,
    'a withheld Reading carries none of its own words');
  assert.match(code, /ELSE c\.value \|\| jsonb_build_object\('assumptions', '\[\]'::jsonb\)/u, 'its Confidence carries no assumptions');
  assert.doesNotMatch(code, /'confidence'|recompute|score/iu, 'no confidence is computed');
});

test('C — the posture: postgres-owned definer, authenticated only, self-asserted', () => {
  assert.match(code, /ALTER FUNCTION public\.get_session_historical_projection_v2\(uuid, integer\) OWNER TO postgres;/u);
  assert.match(code, /REVOKE ALL ON FUNCTION public\.get_session_historical_projection_v2\(uuid, integer\) FROM PUBLIC, anon, authenticated;/u);
  assert.match(code, /GRANT EXECUTE ON FUNCTION public\.get_session_historical_projection_v2\(uuid, integer\) TO authenticated;/u);
  assert.doesNotMatch(code, /GRANT [^;]*TO (?:anon|service_role)/u);
  assert.match(code, /RAISE EXCEPTION '0200: V2 must gate each Reading through the 0151 reliance core'/u);
});

test('D — the verifier proves the gate on real rows, and the wire proof that a withheld word never crosses', () => {
  for (const stage of ['T0 catalogue', 'T1 fails closed as V1 does', 'T2 positive: every Reading relied on', 'T3 negative: evidence changed', 'T4 the wire proof']) {
    assert.ok(verifier.includes(`stage = '${stage}'`), `the verifier runs ${stage}`);
  }
  assert.match(verifier, /assert\.equal\(wire\.includes\(word\), false/u);
  assert.match(verifier, /await q\('ROLLBACK'\);/u, 'nothing is retained');
  assert.equal(packageJson.scripts['verify:reading-reliance:integration'], 'node --env-file-if-exists=.env database/verify-migration-0200.mjs');
  assert.equal(packageJson.scripts['test:cosmos-e2-reading-reliance-contract'], 'node --test database/tests/cosmos-e2-reading-reliance-gate-v1.test.mjs');
  const at0199 = workflow.indexOf('run: npm run verify:current-personal-world:integration');
  const at0200 = workflow.indexOf('run: npm run verify:reading-reliance:integration');
  assert.ok(at0199 > 0 && at0200 > at0199, 'API CI runs verify-0200 against real PostgreSQL after verify-0199');
});

test('E — the API and the client refuse a withheld Reading that carries words, and Replay keeps the frozen V1 shape', () => {
  const mapper = api('historical-projection/historical-projection-mapper.ts');
  assert.match(mapper, /const READING_KEYS = \[\.\.\.READING_KEYS_V1, 'evidenceChange'\] as const;/u);
  assert.match(mapper, /a withheld Reading carries words of its own/u);
  assert.match(mapper, /the Confidence of a withheld Reading carries its assumptions/u);
  const replay = api('replay/replay.service.ts');
  assert.match(replay, /if \(evidenceChange !== null \|\| reading\.statement === null\) return unavailable\(\);/u, 'a Replay Reading carries no reliance key');
  const wire = mobile('projection/historical-projection-wire.ts');
  assert.match(wire, /a withheld Reading carries words of its own/u);
  const peek = mobile('integration/composition/LivingAnalysisMap.tsx');
  assert.match(peek, /disclosedReading\.evidenceChange === 'NONE' && disclosedReading\.statement !== null/u, 'the PEEK shows a statement only when relied on');
  assert.match(peek, /understandingCopy\(language\)\.evidenceChange\[disclosedReading\.evidenceChange\]/u, 'a withheld Reading shows the approved INTEL-TM-01 line');
});
