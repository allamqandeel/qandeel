import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { SUBSTITUTIONS, extractStatement, substitutedStatement } from '../database/voice-foundation-0183-substitutions.mjs';
import { VOICE_FAMILIES } from '../database/voice-cost-families-0184.mjs';

// S8B-02 CP1 — Voice Foundation (migrations 0183 / 0184). This static contract proves, with no database and nothing sent
// off the machine, what the two real-PostgreSQL verifiers cannot see from inside one database: that the migrations are
// forward-only and wired into CI, that every voice gate is seeded closed and its setter is no role's, that the server
// surface is service_role's alone, that the TypeScript mirrors equal the 0184 CHECKs while the text registries keep their
// values, that the P-1 values are the Product Owner's and the database refuses the typed-text confidence on a voice turn,
// that the Replay distribution (0104, I-06C) is untouched, and that CP1 adds no provider adapter, no client surface and no
// Price Card or Credit. The behaviour itself is proven by verify-migration-0183 (S0 – A11) and -0184 (A12).

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATIONS = 'database/migrations';
const file = (prefix) => readdirSync(join(root, MIGRATIONS)).find((name) => name.startsWith(prefix));
const v0183 = read(`${MIGRATIONS}/${file('0183_')}`);
const v0184 = read(`${MIGRATIONS}/${file('0184_')}`);
const sqlOnly = (text) => text.replace(/--[^\n]*/gu, '');
const list = (text) => [...text.matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]);
const tsArray = (text, name) => {
  const match = new RegExp(`export const ${name}[^=]*= \\[([^\\]]*)\\]`, 'u').exec(text);
  assert.ok(match, `${name} is declared`);
  return list(match[1]);
};
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist') return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

test('the two migrations are the next ones, forward-only, each one transaction, and both verifiers run in CI', () => {
  const names = readdirSync(join(root, MIGRATIONS)).filter((name) => /^\d{4}_/u.test(name)).sort();
  assert.deepEqual(names.slice(-2), ['0183_s8b_02_voice_foundation_v1.sql', '0184_s8b_02_ai_cost_voice_units_v1.sql']);
  for (const text of [v0183, v0184]) {
    const body = sqlOnly(text).trim();
    assert.match(body, /^BEGIN;/u);
    assert.match(body, /COMMIT;$/u);
    assert.doesNotMatch(body, /\bDROP\s+(?:TABLE|SCHEMA|FUNCTION)\b/iu, 'nothing is dropped');
  }
  const pkg = JSON.parse(read('package.json')).scripts;
  assert.equal(pkg['verify:voice-foundation:integration'], 'node --env-file-if-exists=.env database/verify-migration-0183.mjs');
  assert.equal(pkg['verify:voice-ai-cost:integration'], 'node --env-file-if-exists=.env database/verify-migration-0184.mjs');
  assert.equal(pkg['test:s8b-02-voice-foundation-contract'], 'node --test tests/s8b-02-voice-foundation-contract.test.mjs');
  const ci = read('.github/workflows/api-ci.yml');
  for (const step of ['verify:voice-foundation:integration', 'verify:voice-ai-cost:integration', 'test:s8b-02-voice-foundation-contract']) {
    assert.ok(ci.includes(`npm run ${step}`), `api-ci runs ${step}`);
  }
  assert.ok(ci.indexOf('npm run verify:public-discussion-threads:integration') < ci.indexOf('npm run verify:voice-foundation:integration'),
    'the voice verifiers run after the 0182 verifier, in migration order');
});

test('the voice channel stays closed: no session channel, no VOICE turn, every capability gate seeded DISABLED, the setter no role\'s', () => {
  const sql = sqlOnly(v0183);
  assert.doesNotMatch(sql, /conversation_sessions_channel_check/u, '0183 does not touch the session channel CHECK');
  assert.match(sql, /SELECT s, 'DISABLED', 'UNSATISFIED', 1, 'S8B-02 CP1 \(migration 0183\)'/u);
  assert.deepEqual(list(/FROM unnest\(ARRAY\[([^\]]*)\]\) AS s;/u.exec(sql)[1]),
    ['PERSONAL_VOICE_NOTE', 'PERSONAL_LIVE_CALL', 'SHARED_VOICE_NOTE', 'REPLAY_AUDIO_DISTRIBUTION']);
  assert.doesNotMatch(sql, /'ENABLED',\s*'SATISFIED'/u, 'no seed opens a scope');
  assert.match(sql, /CREATE FUNCTION voice_private\.set_voice_launch_capability_v1\(/u, 'the setter lives in the private schema');
  assert.doesNotMatch(sql, /GRANT[^;]*set_voice_launch_capability_v1/u, 'the setter is granted to no role');
});

test('least privilege: only the server_* commands are opened, to service_role alone; nothing to anon or authenticated', () => {
  const block = /FOREACH fn IN ARRAY ARRAY\[([\s\S]*?)\] LOOP/u.exec(v0183);
  assert.ok(block, 'the 0183 ACL block');
  const functions = [...block[1].matchAll(/'([^']+)'/gu)].map((m) => m[1]);
  assert.equal(functions.length, 40, 'the 0183 ACL block names every function it creates');
  assert.equal(new Set(functions).size, functions.length);
  const created = [...sqlOnly(v0183).matchAll(/CREATE FUNCTION ((?:public|voice_private|account_erasure_private)\.[a-z0-9_]+)\(/gu)].map((m) => m[1]);
  for (const name of created) assert.ok(functions.some((fn) => fn.startsWith(`${name}(`)), `${name} is in the ACL block`);
  assert.match(v0183, /IF fn LIKE 'public\.server\\_%' AND EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = 'service_role'\) THEN\n\s*EXECUTE format\('GRANT EXECUTE ON FUNCTION %s TO service_role', fn\);/u);
  for (const text of [v0183, v0184]) assert.doesNotMatch(sqlOnly(text), /GRANT[^;]*\bTO\s+(?:PUBLIC|anon|authenticated)\b/iu);
  assert.match(sqlOnly(v0183), /ALTER TABLE public\.conversation_turn_voice_sources ENABLE ROW LEVEL SECURITY|ENABLE ROW LEVEL SECURITY/u);
  assert.doesNotMatch(sqlOnly(v0183), /CREATE POLICY/u, 'RLS on, zero policies');
});

test('every re-created statement is its origin plus the declared edits; the Replay distribution (0104, I-06C) is untouched', () => {
  for (const substitution of SUBSTITUTIONS) {
    const statement = substitutedStatement(substitution);
    assert.ok(v0183.includes(statement), `0183 carries the re-creation ${substitution.key} verbatim`);
    assert.ok(extractStatement(statement, substitution.header).body.length > 0);
  }
  const defined = (text) => new Set([...sqlOnly(text).matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([a-z_]+\.[a-z0-9_]+)\(/gu)].map((m) => m[1]));
  const voice = defined(v0183);
  for (const name of defined(read(`${MIGRATIONS}/${file('0104_')}`))) assert.ok(!voice.has(name), `0183 does not re-create the 0104 function ${name}`);
  assert.ok(!SUBSTITUTIONS.some((s) => /distribution/iu.test(s.header)), 'no distribution function is substituted');
});

test('0184: the TypeScript mirrors equal the CHECKs, the text registries keep their values, no Price Card and no Credit', () => {
  const types = read('apps/api/src/ai-usage/ai-usage.types.ts');
  const kindCheck = /ai_provider_call_usage_kind_check CHECK \(usage_kind IN \(([^)]*)\)\)/u.exec(v0184);
  assert.deepEqual(list(kindCheck[1]), [...tsArray(types, 'AI_USAGE_KINDS'), ...tsArray(types, 'AI_VOICE_USAGE_KINDS')]);
  const familyCheck = /ai_provider_calls_feature_family_check CHECK \(feature_family IN \(([^)]*)\)\)/u.exec(v0184);
  assert.deepEqual(list(familyCheck[1]), [...tsArray(types, 'AI_FEATURE_FAMILIES'), ...tsArray(types, 'AI_VOICE_FEATURE_FAMILIES')]);
  assert.deepEqual(tsArray(types, 'AI_VOICE_FEATURE_FAMILIES'), [...VOICE_FAMILIES]);
  assert.deepEqual(tsArray(types, 'AI_PROVIDERS'), ['OPENAI', 'ANTHROPIC', 'GEMINI', 'DEEPSEEK'], 'the text providers are unchanged');
  assert.deepEqual(tsArray(types, 'AI_USAGE_KINDS'), ['INPUT_TOKEN', 'OUTPUT_TOKEN', 'CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN']);
  assert.deepEqual(tsArray(types, 'AI_USAGE_SOURCES'), ['PROVIDER_REPORTED', 'GATEWAY_MEASURED']);
  assert.deepEqual(list(/ai_provider_calls_usage_source_check CHECK \(usage_source IN \(([^)]*)\)\)/u.exec(v0184)[1]), ['PROVIDER_REPORTED', 'GATEWAY_MEASURED']);
  const sql = sqlOnly(v0184);
  assert.doesNotMatch(sql, /INSERT INTO public\.ai_price_cards|register_ai_price_card_v1\(/u, 'no Price Card is registered');
  assert.doesNotMatch(sql, /INSERT INTO public\.ai_credit|ALTER TABLE public\.ai_credit/u, 'Credits are untouched');
  assert.doesNotMatch(sql, /SYNTHESIS_CHARACTERS|AUDIO_OUTPUT_MS/u, 'D-1: the speech units are tokens, not characters or milliseconds');
  for (const unchanged of ['begin_ai_provider_call_v1', 'begin_ai_provider_call_v2', 'settle_ai_provider_call_v1', 'ai_complete_usage_kinds_v1',
    'server_read_ai_usage_operations_summary_v1', 'server_read_ai_cost_aggregates_v1', 'ai_rate_provider_call_v1']) {
    assert.doesNotMatch(sql, new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${unchanged}\\(`, 'u'), `0184 does not re-create ${unchanged}`);
  }
});

test('P-1: the Product Owner\'s band values, below the typed-text confidence the database refuses on a voice turn', () => {
  const evaluator = read('apps/api/src/memory/memory-write-evaluator.service.ts');
  assert.match(evaluator, /export const MACHINE_ASR_MEMORY_CONFIDENCE = Object\.freeze\(\{ HIGH: 0\.90, MEDIUM: 0\.75 \} as const\);/u);
  assert.match(evaluator, /confidence: rememberRequested \? 0\.98 : 0\.95,/u, 'the typed-text values are unchanged');
  assert.match(evaluator, /if \(band !== 'HIGH' && band !== 'MEDIUM'\) return \{ decision: 'SKIP', reason: 'LOW_CONFIDENCE_MACHINE_ASR' \};/u);
  const writer = SUBSTITUTIONS.find((s) => s.key === 'background-memory-writer');
  const body = extractStatement(substitutedStatement(writer), writer.header).body;
  assert.match(body, /IF p_confidence IS NULL OR NOT \(p_confidence < 0\.95\) THEN/u);
  assert.match(body, /RETURN QUERY SELECT 'LOW_CONFIDENCE_MACHINE_ASR'::text, NULL::uuid;/u);
  assert.match(body, /v_source := 'MACHINE_ASR';/u);
  const enrichment = read('apps/api/src/background-intelligence/background-intelligence-enrichment.service.ts');
  assert.match(enrichment, /const voice=await this\.data\.readTurnVoiceProvenance\(context\);/u);
  assert.match(enrichment, /if\(candidate\.source==='MACHINE_ASR'\)return\{decision:'SKIP',reason:'MACHINE_ASR_RECORDED_NOT_EVIDENCE',type:candidate\.type\};/u,
    'a MACHINE_ASR Memory is never fresh Evidence');
});

test('CP1 adds no provider adapter, no client surface and no audio path; the commitment gate stays channel-based', () => {
  const allowed = new Set(['apps/api/src/ai-usage/ai-usage.types.ts', 'apps/api/src/observability/telemetry.service.ts']);
  for (const path of walk(join(root, 'apps/api/src')).map((p) => relative(root, p).replaceAll('\\', '/'))) {
    if (allowed.has(path) || path.endsWith('.spec.ts')) continue;
    assert.doesNotMatch(read(path), /speechmatics|GEMINI_SPEECH_GENERATION|server_begin_voice_note_upload|server_open_call_recording/iu, `${path} names no voice provider or recording command`);
  }
  for (const path of walk(join(root, 'apps/mobile/src')).map((p) => relative(root, p).replaceAll('\\', '/'))) {
    assert.doesNotMatch(read(path), /voice_private|server_[a-z_]*voice|turn_voice_source/u, `${path} reaches no voice server surface`);
  }
  assert.match(read('apps/api/src/conversation-unit/conversation-unit-commitment.service.ts'), /throw new CommitmentRejectedError\('UNSUPPORTED_SOURCE_MODALITY'\);/u);
});
