import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../migrations/0028_canonical_evidence_eligibility_v1.sql', import.meta.url), 'utf8');

const CONSUMERS = [
  'attach_hypothesis_evidence',
  'apply_hypothesis_evidence_update',
  'background_attach_hypothesis_evidence_v1',
  'background_create_confidence_evaluation_v1',
  'create_confidence_evaluation',
];

// The body of one CREATE OR REPLACE FUNCTION in the migration, by name.
function definition(name) {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.notEqual(start, -1, `${name} is replaced by migration 0028`);
  const end = migration.indexOf('END; $$;', start);
  assert.notEqual(end, -1, `${name} body terminates`);
  return migration.slice(start, end);
}

test('adds exactly the two internal canonical Evidence primitives', () => {
  const created = [...migration.matchAll(/CREATE FUNCTION public\.(\w+)/gu)].map((match) => match[1]);
  assert.deepEqual(created.sort(), [
    'canonical_eligible_memory_ids_v1',
    'canonical_evidence_content_key_v1',
  ]);
  const replaced = [...migration.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/gu)].map((match) => match[1]);
  assert.deepEqual(replaced.sort(), [...CONSUMERS].sort(), 'exactly the QAN-AUD-03 consumers are replaced');
});

test('bounds the candidate set to 64 before eligibility filtering and deduplication', () => {
  const helper = migration.slice(
    migration.indexOf('CREATE FUNCTION public.canonical_eligible_memory_ids_v1'),
    migration.indexOf('-- 3. Authenticated Hypothesis Evidence attachment'),
  );
  // Step A: owner + ACTIVE + unexpired, ordered updated_at DESC / id DESC, capped at 64.
  assert.match(helper, /memory\.user_id=p_user_id AND memory\.status='ACTIVE'/u);
  assert.match(helper, /memory\.expires_at IS NULL OR memory\.expires_at>p_now/u);
  assert.match(helper, /ORDER BY memory\.updated_at DESC, memory\.id DESC\s*\n\s*LIMIT 64/u);
  // The candidate LIMIT precedes the source/type filter and the dedup window,
  // which is the whole point of the contract.
  const candidateLimit = helper.indexOf('LIMIT 64');
  const eligibilityFilter = helper.indexOf("candidate.source IN ('USER_STATED','USER_CONFIRMED')");
  const dedup = helper.indexOf('duplicate_rank');
  assert.ok(candidateLimit > -1 && eligibilityFilter > candidateLimit, 'LIMIT 64 precedes eligibility filtering');
  assert.ok(dedup > candidateLimit, 'LIMIT 64 precedes deduplication');
  assert.match(helper, /AS MATERIALIZED/u, 'the candidate window is materialized, not folded into the outer query');
  // Step B/C/D/E/F.
  assert.match(helper, /candidate\.type<>'DERIVED_INSIGHT'/u);
  assert.match(helper, /PARTITION BY candidate\.type, candidate\.source,\s*\n\s*public\.canonical_evidence_content_key_v1\(candidate\.content\)/u);
  assert.match(helper, /ORDER BY candidate\.updated_at DESC, candidate\.id ASC/u);
  assert.match(helper, /WHERE eligible\.duplicate_rank=1/u);
  assert.match(helper, /ORDER BY eligible\.updated_at DESC, eligible\.id ASC\s*\n\s*LIMIT 64/u);
  // Identifiers only: the primitive is not a new Evidence read API.
  assert.match(helper, /RETURNS TABLE\(memory_id uuid, evidence_id text\)/u);
  // Content is read only to build the dedup key; the projected columns are the
  // two identifiers and nothing else.
  assert.match(helper, /SELECT eligible\.id, 'memory:'\|\|eligible\.id::text\s*\n\s*FROM eligible/u);
  assert.doesNotMatch(helper, /RETURNS TABLE\([^)]*(?:content|statement|confidence|importance)/u);
});

test('reproduces the JavaScript exact-normalization contract without a locale-dependent regex class', () => {
  const key = migration.slice(
    migration.indexOf('CREATE FUNCTION public.canonical_evidence_content_key_v1'),
    migration.indexOf('-- 2. The canonical Evidence-membership primitive'),
  );
  assert.match(key, /normalize\(p_content, NFKC\)/u, 'NFKC is applied first, exactly as in TypeScript');
  // Every ECMAScript WhiteSpace + LineTerminator code point is enumerated by
  // value; `\s` is deliberately not used because its multibyte membership is
  // ctype dependent in PostgreSQL and is not the JavaScript set.
  const points = [9, 10, 11, 12, 13, 32, 160, 5760,
    8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202,
    8232, 8233, 8239, 8287, 12288, 65279];
  for (const point of points) assert.match(key, new RegExp(`chr\\(${point}\\)`, 'u'), `code point ${point}`);
  assert.equal((key.match(/chr\(\d+\)/gu) ?? []).length, points.length, 'no extra or missing code point');
  assert.match(key, new RegExp(`repeat\\(' ', ${points.length}\\)`, 'u'), 'translate targets match the source length');
  assert.doesNotMatch(key, /\\s/u, 'no locale-dependent whitespace class');
  // Exact normalization only - no semantic, fuzzy, case or punctuation folding.
  assert.doesNotMatch(key, /lower\(|upper\(|unaccent|similarity|soundex|levenshtein/iu);
  assert.match(key, /IMMUTABLE STRICT PARALLEL SAFE SET search_path=''/u);
});

test('routes every QAN-AUD-03 SQL consumer through the one canonical primitive', () => {
  for (const name of CONSUMERS) {
    const body = definition(name);
    assert.match(body, /public\.canonical_eligible_memory_ids_v1\(/u, `${name} uses the canonical primitive`);
    // The weaker isolated single-row eligibility test is gone from every
    // replaced definition.
    assert.doesNotMatch(
      body,
      /FROM public\.memories[\s\S]*?source IN \('USER_STATED','USER_CONFIRMED'\)/u,
      `${name} no longer re-implements eligibility`,
    );
    assert.doesNotMatch(body, /DERIVED_INSIGHT/u, `${name} no longer re-implements the type exclusion`);
  }
  // The Update Loop's copied projection CTE is deleted outright, not kept
  // alongside the primitive.
  const updateLoop = definition('apply_hypothesis_evidence_update');
  assert.doesNotMatch(updateLoop, /WITH candidates AS MATERIALIZED/u);
  assert.doesNotMatch(updateLoop, /LIMIT 64/u);
  assert.doesNotMatch(updateLoop, /duplicate_rank/u);
  assert.doesNotMatch(updateLoop, /regexp_replace|normalize\(/u);
  // Exactly one place in the whole migration owns the 64-bound contract.
  assert.equal((migration.match(/LIMIT 64/gu) ?? []).length, 2, 'only the primitive carries the candidate and final bounds');
});

test('preserves everything about the consumers except the membership test', () => {
  const attach = definition('attach_hypothesis_evidence');
  assert.match(attach, /p_evidence_id !~ '\^memory:\[0-9a-fA-F-\]\{36\}\$'/u);
  assert.match(attach, /user_id=\(SELECT auth\.uid\(\)\) FOR UPDATE/u);
  assert.match(attach, /Evidence is already attached\./u);
  assert.match(attach, /version=version\+1,updated_at=CURRENT_TIMESTAMP/u);

  const updateLoop = definition('apply_hypothesis_evidence_update');
  assert.match(updateLoop, /Authentication required\.' USING ERRCODE='42501'/u);
  assert.match(updateLoop, /Stale hypothesis version\.' USING ERRCODE='40001'/u);
  assert.equal((updateLoop.match(/ERRCODE='40001'/gu) ?? []).length, 2, 'both stale-version guards survive');
  assert.match(updateLoop, /INSERT INTO public\.hypothesis_updates/u);
  assert.match(updateLoop, /'QANDEEL_HYPOTHESIS_UPDATE_LOOP'/u);
  // Membership is still checked after the expected-version guard, so the
  // 40001 contract keeps precedence over a 22023 eligibility rejection.
  assert.ok(
    updateLoop.indexOf("ERRCODE='40001'") < updateLoop.indexOf('canonical_eligible_memory_ids_v1'),
    'expected-version validation still precedes the membership test',
  );

  const background = definition('background_attach_hypothesis_evidence_v1');
  assert.match(background, /canonical_eligible_memory_ids_v1\(p_user_id, CURRENT_TIMESTAMP\)/u);
  assert.doesNotMatch(background, /auth\.uid\(\)/u, 'no JWT is reconstructed on the background path');

  for (const name of ['background_create_confidence_evaluation_v1', 'create_confidence_evaluation']) {
    const confidence = definition(name);
    // Membership comes from the primitive; ORDER still comes from the
    // Hypothesis array's own ordinality.
    assert.match(confidence, /array_agg\(link\.evidence_id ORDER BY link\.ordinality\)/u);
    assert.match(confidence, /link\.evidence_id=ANY\(canonical_evidence\)/u);
    assert.match(confidence, /Stale hypothesis version\.' USING ERRCODE='22023'/u);
    assert.match(confidence, /'NO_ELIGIBLE_EVIDENCE'/u);
    assert.match(confidence, /'CONFIDENCE_MODEL_UNCALIBRATED'/u);
    assert.match(confidence, /'confidence-foundation-v1','QANDEEL_CONFIDENCE_RUNTIME'/u);
  }
});

test('keeps every definer posture and widens no role authority', () => {
  for (const name of CONSUMERS) {
    assert.match(
      migration,
      new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?SECURITY DEFINER SET search_path`, 'u'),
      `${name} keeps its definer posture`,
    );
  }
  // CREATE OR REPLACE preserves owners and ACLs, so the migration issues no
  // GRANT at all and no REVOKE against a consumer.
  assert.doesNotMatch(migration, /\bGRANT\b/u, 'no privilege is granted to anybody');
  for (const name of CONSUMERS) {
    assert.doesNotMatch(migration, new RegExp(`REVOKE[^;]*public\\.${name}`, 'u'), `${name} ACL untouched`);
    assert.doesNotMatch(migration, new RegExp(`ALTER FUNCTION public\\.${name}`, 'u'), `${name} owner untouched`);
  }
  // The two new primitives are internal: postgres-owned, fixed search_path, and
  // executable by no application or Data API role.
  for (const signature of ['canonical_evidence_content_key_v1(text)', 'canonical_eligible_memory_ids_v1(uuid,timestamptz)']) {
    const escaped = signature.replace(/[()]/gu, '\\$&');
    assert.match(migration, new RegExp(`ALTER FUNCTION public\\.${escaped} OWNER TO postgres`, 'u'));
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${escaped} FROM PUBLIC,anon,authenticated,service_role`, 'u'));
  }
  assert.equal((migration.match(/SET search_path/gu) ?? []).length, 7, 'every function in the migration fixes its search_path');
});

test('rewrites no historical row, table, policy, or migration', () => {
  const outsideFunctionBodies = migration.replace(/\$\$[\s\S]*?\$\$/gu, '<<body>>');
  assert.doesNotMatch(outsideFunctionBodies, /\b(?:UPDATE|INSERT INTO|DELETE FROM)\s+public\./iu);
  assert.doesNotMatch(migration, /ALTER TABLE|CREATE TABLE|DROP TABLE|CREATE POLICY|DROP POLICY|DROP FUNCTION/iu);
  // No unrelated audit surface is touched: this migration names only Evidence
  // membership and its five consumers.
  for (const unrelated of [
    'conversation_turns', 'conversation_sessions', 'runtime_event_outbox', 'him_', 'question_',
    'server_create_memory_v1', 'server_create_hypothesis_v1', 'transition_hypothesis',
    'link_competing_hypotheses', 'background_create_system_hypothesis_v1',
    'background_link_competing_hypotheses_v1', 'association_',
  ]) assert.doesNotMatch(migration, new RegExp(unrelated, 'u'), `unrelated surface ${unrelated}`);
});

test('leaves migrations 0005, 0006, 0008 and 0021 as untouched historical text', async () => {
  const historical = Object.fromEntries(await Promise.all([
    ['0005', '0005_hypothesis_runtime.sql'],
    ['0006', '0006_confidence_runtime.sql'],
    ['0008', '0008_hypothesis_update_loop.sql'],
    ['0021', '0021_background_intelligence_repository_adapters_v1.sql'],
  ].map(async ([key, file]) => [key, await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8')])));
  // The weaker historical predicates stay recorded as history; migration 0028
  // establishes the corrected effective state instead of editing the past.
  assert.match(historical['0005'], /CREATE FUNCTION public\.attach_hypothesis_evidence/u);
  assert.match(historical['0005'], /source IN \('USER_STATED','USER_CONFIRMED'\) AND type<>'DERIVED_INSIGHT'/u);
  assert.match(historical['0006'], /CREATE FUNCTION public\.create_confidence_evaluation/u);
  assert.match(historical['0008'], /WITH candidates AS MATERIALIZED/u);
  assert.match(historical['0021'], /CREATE FUNCTION public\.background_attach_hypothesis_evidence_v1/u);
  for (const sql of Object.values(historical)) {
    assert.doesNotMatch(sql, /canonical_eligible_memory_ids_v1|canonical_evidence_content_key_v1/u);
  }
});

test('keeps the TypeScript Evidence contract and its constants unchanged', async () => {
  const service = await readFile(new URL('../../apps/api/src/memory/evidence.service.ts', import.meta.url), 'utf8');
  assert.match(service, /export const EVIDENCE_CANDIDATE_LIMIT = 64;/u);
  assert.match(service, /export const MAX_ELIGIBLE_EVIDENCE = 64;/u);
  assert.match(service, /value\.normalize\('NFKC'\)\.trim\(\)\.replace\(\/\\s\+\/gu, ' '\)/u);
  assert.match(service, /EVIDENCE_CANDIDATE_LIMIT,\s*\n\s*\);/u, 'candidates are still bounded before projection');
  assert.match(service, /\.slice\(0, MAX_ELIGIBLE_EVIDENCE\)/u);
  // Evidence stays a local projection: no RPC path is introduced.
  assert.doesNotMatch(service, /rpc\/|serviceRole|canonical_eligible_memory_ids_v1/u);
});

test('shares one golden normalization fixture between TypeScript and PostgreSQL', async () => {
  const raw = await readFile(new URL('../fixtures/canonical-evidence-normalization-v1.json', import.meta.url), 'utf8');
  // Pure ASCII: no checkout, editor or encoding step can silently rewrite a
  // whitespace character inside a parity fixture.
  assert.ok(/^[\x00-\x7e]*$/u.test(raw), 'the fixture file is ASCII-escaped');
  const fixtures = JSON.parse(raw);
  assert.equal(fixtures.contract, String.raw`value.normalize('NFKC').trim().replace(/\s+/gu, ' ')`);
  const normalizeExact = (value) => value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  for (const row of fixtures.normalization) {
    assert.equal(normalizeExact(row.raw), row.expected, `fixture ${row.name} matches the JavaScript contract`);
  }
  const covered = new Set(fixtures.normalization.map((row) => row.name));
  for (const required of [
    'ascii-leading-trailing', 'ascii-repeated-interior', 'tab', 'newline-crlf', 'nbsp-u00a0',
    'em-space-u2003', 'ideographic-space-u3000', 'ogham-space-u1680', 'line-paragraph-separator',
    'bom-zwnbsp-ufeff', 'fullwidth-nfkc', 'ligature-nfkc', 'nfd-combining-accent',
    'mixed-unicode-whitespace-nfkc',
  ]) assert.ok(covered.has(required), `fixture ${required}`);
  assert.ok(fixtures.duplicateGroups.length >= 2, 'the fixture file names duplicate groups');

  const parity = await readFile(new URL('../../apps/api/src/memory/evidence-normalization-parity.spec.ts', import.meta.url), 'utf8');
  assert.match(parity, /canonical-evidence-normalization-v1\.json/u);
  assert.match(parity, /normalizeExact/u);
});

test('provides a secret-free real PostgreSQL adversarial verifier', async () => {
  const verifier = await readFile(new URL('../verify-migration-0028.mjs', import.meta.url), 'utf8');
  assert.match(verifier, /process\.env\.DATABASE_URL/u);
  assert.match(verifier, /canonical-evidence-normalization-v1\.json/u);
  assert.match(verifier, /has_function_privilege/u);
  assert.match(verifier, /ROLLBACK/u);
  for (const name of CONSUMERS) assert.match(verifier, new RegExp(name, 'u'), `verifier drives ${name}`);
  assert.doesNotMatch(verifier, /supabase\.co|postgres(?:ql)?:\/\//iu);
});
