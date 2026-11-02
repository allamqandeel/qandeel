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
//
// RE-ANCHORED by S8B-02 CP2 (Secure Media Lifecycle): migration 0185 is the next one (two service_role definers, no
// relation, no gate change, no voice_private function); CP2's media lifecycle is the only API code that names a voice
// recording command, its provider ports name a provider but carry no network code, and its media files log nothing,
// presign nothing and set no ACL. Its behaviour is proven by verify-migration-0185 (C0 – R1) and, through PostgREST and
// rclone, by prove-0185 (V01 – V14).

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATIONS = 'database/migrations';
const file = (prefix) => readdirSync(join(root, MIGRATIONS)).find((name) => name.startsWith(prefix));
const v0183 = read(`${MIGRATIONS}/${file('0183_')}`);
const v0184 = read(`${MIGRATIONS}/${file('0184_')}`);
const v0185 = read(`${MIGRATIONS}/${file('0185_')}`);
const sqlOnly = (text) => text.replace(/--[^\n]*/gu, '');
/** TypeScript with its comments removed: the privacy rules bind the code, not the prose that explains them. */
const codeOnly = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/[^\n]*/gu, '$1');
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

test('the three migrations are the next ones, forward-only, each one transaction, and every verifier runs in CI', () => {
  const names = readdirSync(join(root, MIGRATIONS)).filter((name) => /^\d{4}_/u.test(name)).sort();
  // RE-ANCHORED by S8B-02 CP2: 0185 follows 0184.
  // RE-ANCHORED by S8B-03 CP1 (2026-10-31): the three stay consecutive; 0186 (S8B-03 Personal Voice Notes) follows them.
  const at = names.indexOf('0183_s8b_02_voice_foundation_v1.sql');
  assert.deepEqual(names.slice(at, at + 4), ['0183_s8b_02_voice_foundation_v1.sql', '0184_s8b_02_ai_cost_voice_units_v1.sql',
    '0185_s8b_02_voice_media_lifecycle_v1.sql', '0186_s8b_03_personal_voice_notes_v1.sql']);
  for (const text of [v0183, v0184, v0185]) {
    const body = sqlOnly(text).trim();
    assert.match(body, /^BEGIN;/u);
    assert.match(body, /COMMIT;$/u);
    assert.doesNotMatch(body, /\bDROP\s+(?:TABLE|SCHEMA|FUNCTION)\b/iu, 'nothing is dropped');
  }
  const pkg = JSON.parse(read('package.json')).scripts;
  assert.equal(pkg['verify:voice-foundation:integration'], 'node --env-file-if-exists=.env database/verify-migration-0183.mjs');
  assert.equal(pkg['verify:voice-ai-cost:integration'], 'node --env-file-if-exists=.env database/verify-migration-0184.mjs');
  assert.equal(pkg['test:s8b-02-voice-foundation-contract'], 'node --test tests/s8b-02-voice-foundation-contract.test.mjs');
  assert.equal(pkg['verify:voice-media-lifecycle:integration'], 'node --env-file-if-exists=.env database/verify-migration-0185.mjs');
  assert.equal(pkg['prove:voice-media-lifecycle:postgrest'], 'node --env-file-if-exists=.env database/prove-0185-voice-media-lifecycle-postgrest.mjs');
  const ci = read('.github/workflows/api-ci.yml');
  for (const step of ['verify:voice-foundation:integration', 'verify:voice-ai-cost:integration', 'verify:voice-media-lifecycle:integration',
    'test:s8b-02-voice-foundation-contract', '--silent prove:voice-media-lifecycle:postgrest']) {
    assert.ok(ci.includes(`npm run ${step}`), `api-ci runs ${step}`);
  }
  assert.ok(ci.indexOf('npm run verify:public-discussion-threads:integration') < ci.indexOf('npm run verify:voice-foundation:integration'),
    'the voice verifiers run after the 0182 verifier, in migration order');
  assert.ok(ci.indexOf('npm run verify:voice-ai-cost:integration') < ci.indexOf('npm run verify:voice-media-lifecycle:integration'), '0185 after 0184');
  assert.ok(ci.indexOf('prove:export-bundle:postgrest') < ci.indexOf('prove:voice-media-lifecycle:postgrest'), 'the live voice proof runs in the PostgREST and rclone loop');
});

test('0185 is the smallest forward fix: two service_role definers, no relation, no gate, no voice_private function, no erasure coordinator', () => {
  const sql = sqlOnly(v0185);
  const created = [...sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([a-z_]+\.[a-z0-9_]+)\(/gu)].map((m) => m[1]);
  assert.deepEqual(created, ['public.server_list_voice_recordings_v1', 'public.server_enqueue_unknown_voice_media_v1']);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.server_enqueue_unknown_voice_media_v1\(/u, 'the reconciliation is forward-replaced, never dropped');
  assert.doesNotMatch(sql, /CREATE (?:TABLE|TRIGGER|POLICY|SCHEMA|TYPE)\b|ALTER TABLE/iu, 'no relation, trigger or policy');
  assert.doesNotMatch(sql, /set_voice_launch_capability_v1|install_consent_text_v1|INSERT INTO voice_private|UPDATE voice_private/iu, 'no gate, consent or voice row is written');
  assert.doesNotMatch(v0185, /qandeel\.account_erasure/u, 'the account erasure coordinator is untouched');
  assert.doesNotMatch(sql, /GRANT[^;]*\bTO\s+(?:PUBLIC|anon|authenticated)\b/iu);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION %s TO service_role/u);
  assert.doesNotMatch(/RETURNS TABLE \(([^)]*)\)/u.exec(sql)[1], /storage_key/u, 'the export listing returns no storage key');
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
  assert.equal(functions.length, 41, 'the 0183 ACL block names every function it creates');
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
  assert.match(evaluator, /export const MACHINE_ASR_MEMORY_CONFIDENCE_DEFAULTS = Object\.freeze\(\{ HIGH: 0\.90, MEDIUM: 0\.75 \} as const\);/u);
  assert.match(evaluator, /export const MACHINE_ASR_MEMORY_CONFIDENCE_CEILING = 0\.95;/u);
  assert.match(evaluator, /environment\.MACHINE_ASR_MEMORY_CONFIDENCE_HIGH/u, 'P-1 is tuned without a code change');
  assert.match(evaluator, /environment\.MACHINE_ASR_MEMORY_CONFIDENCE_MEDIUM/u);
  assert.match(read('.env.example'), /^MACHINE_ASR_MEMORY_CONFIDENCE_HIGH=0\.90$/mu);
  assert.match(read('.env.example'), /^MACHINE_ASR_MEMORY_CONFIDENCE_MEDIUM=0\.75$/mu);
  assert.match(evaluator, /confidence: rememberRequested \? 0\.98 : 0\.95,/u, 'the typed-text values are unchanged');
  assert.match(evaluator, /if \(band !== 'HIGH' && band !== 'MEDIUM'\) return \{ decision: 'SKIP', reason: 'LOW_CONFIDENCE_MACHINE_ASR' \};/u);
  const writer = SUBSTITUTIONS.find((s) => s.key === 'background-memory-writer');
  const body = extractStatement(substitutedStatement(writer), writer.header).body;
  assert.match(body, /IF p_confidence IS NULL OR NOT \(p_confidence < 0\.95\) THEN/u);
  assert.match(body, /RETURN QUERY SELECT 'LOW_CONFIDENCE_MACHINE_ASR'::text, NULL::uuid;/u);
  assert.match(body, /v_source := 'MACHINE_ASR';/u);
  const enrichment = read('apps/api/src/background-intelligence/background-intelligence-enrichment.service.ts');
  assert.match(enrichment, /const voice=await this\.data\.readTurnVoiceProvenance\(context\);/u);
  // RE-ANCHORED by S8B-03 CP1 (2026-10-31, the Product Owner's D1, E4): a HIGH / MEDIUM MACHINE_ASR Memory IS Fresh
  // Evidence now, so the SKIP line is removed; 0186 E13 makes the writer require the band's exact constant instead of
  // `< 0.95` (proven by verify-migration-0186 V-CS and tests/s8b-03-personal-voice-notes-contract.test.mjs).
  assert.doesNotMatch(enrichment, /MACHINE_ASR_RECORDED_NOT_EVIDENCE/u, 'E4: the SKIP line that kept voice out of Evidence is gone');
});

// RE-ANCHORED by S8B-02 CP2: CP1 had no adapter and no audio path. CP2 adds exactly the media lifecycle (voice-media/) and
// the provider PORTS with deterministic fakes (voice/); everything else in the API still names no provider and no
// recording command, the ports carry no network code, and nothing composes a fake.
test('CP2 boundary: the recording commands live in the media lifecycle alone, the ports reach no network, no client surface', () => {
  const files = walk(join(root, 'apps/api/src')).map((p) => relative(root, p).replaceAll('\\', '/'));
  // RE-ANCHORED by S8B-04 CP1 (2026-11-01): the CURRENT consent text VOICE_RECORDING_V2 names Speechmatics in its K-07,
  // APPROVED verbatim by the Product Owner (it is the user-facing disclosure, not a provider call).
  const allowed = new Set(['apps/api/src/ai-usage/ai-usage.types.ts', 'apps/api/src/observability/telemetry.service.ts', 'apps/api/src/voice-media/voice-consent-text.ts']);
  for (const path of files) {
    if (allowed.has(path) || path.endsWith('.spec.ts') || path.startsWith('apps/api/src/voice/')) continue;
    assert.doesNotMatch(read(path), /speechmatics|GEMINI_SPEECH_GENERATION/iu, `${path} names no voice provider`);
    if (!path.startsWith('apps/api/src/voice-media/')) {
      assert.doesNotMatch(read(path), /server_(?:begin_voice_note_upload|accept_voice_note|open_call_recording|add_call_segment|store_call_segment|read_voice_recording_objects|delete_voice_recording|list_voice_recordings|sweep_voice_recordings|recover_stale_call_recordings)/u,
        `${path} calls no voice recording command (the media lifecycle alone does)`);
    }
  }
  // RE-ANCHORED by S8B-03 CP1 (2026-10-31, contract §5.8): the ONE network path is the Speechmatics batch adapter in
  // voice/speechmatics/ (fetch, hand-streamed multipart, no SDK; its config reads the environment). Nothing outside that
  // folder imports it but voice.module.ts, and the worker reads a note's audio through VoiceMediaService alone.
  // RE-ANCHORED by S8B-04 CP1 (2026-11-01, contract v1.2 §9 / D): the SECOND network path is the Google Cloud TTS adapter
  // in voice/vertex-speech/ (fetch to aiplatform.googleapis.com, ADC through google-auth-library alone, no Gemini SDK; its
  // config reads the environment). Its fake Vertex server (testing/) is the one test-only node:http listener. Nothing
  // outside that folder imports it but voice.module.ts.
  // RE-ANCHORED by S8B-05 CP1 (2026-11-02, contract v1.2 Part A, Scope C): voice/call/ is the live call's SERVER socket. Its
  // gateway answers the HTTP server's upgrade (node:http types only, in gateway/live-call.gateway.ts alone) and speaks
  // RFC 6455 itself; it dials nothing, reads no environment, opens no client socket and carries no provider. Its e2e spec
  // alone runs a real WebSocket client against it, with a fake Supabase Auth listener.
  const VERTEX_DIR = 'apps/api/src/voice/vertex-speech/';
  const CALL_DIR = 'apps/api/src/voice/call/';
  for (const path of files.filter((p) => p.startsWith(CALL_DIR))) {
    const text = read(path);
    assert.doesNotMatch(text, /\bfetch\(|from 'node:https'|require\('https?'\)|from 'ws'|axios|@speechmatics|@google\/|google-auth-library/u, `${path} dials no network and carries no provider`);
    if (path.endsWith('.spec.ts')) continue;
    assert.doesNotMatch(text, /process\.env|new WebSocket\(/u, `${path} reads no environment and opens no client socket`);
    if (path !== `${CALL_DIR}gateway/live-call.gateway.ts`) assert.doesNotMatch(text, /from 'node:http'/u, `${path} touches no HTTP server`);
    else assert.match(text, /^import type \{ IncomingMessage, Server \} from 'node:http';$/mu, 'the gateway imports node:http types only');
  }
  for (const path of files.filter((p) => p.startsWith('apps/api/src/voice/') && !p.startsWith('apps/api/src/voice/speechmatics/') && !p.startsWith(VERTEX_DIR) && !p.startsWith(CALL_DIR))) {
    assert.doesNotMatch(read(path), /\bfetch\(|from 'node:https?'|require\('https?'\)|WebSocket|from 'ws'|axios|process\.env|@speechmatics|@google\/|google-auth-library/u, `${path} carries no network code and reads no credential`);
  }
  for (const path of files.filter((p) => p.startsWith(VERTEX_DIR) && !p.endsWith('.spec.ts'))) {
    const text = read(path);
    assert.doesNotMatch(text, /WebSocket|from 'ws'|axios|@google\/|@google-cloud\/|generativelanguage|require\('https?'\)/u, `${path} uses no Gemini SDK, no socket, no AI Studio`);
    if (path !== `${VERTEX_DIR}vertex-speech.auth.ts`) assert.doesNotMatch(text, /google-auth-library/u, `${path}: ADC lives in vertex-speech.auth.ts alone`);
    if (!path.startsWith(`${VERTEX_DIR}testing/`)) assert.doesNotMatch(text, /from 'node:https?'/u, `${path}: the adapter speaks through fetch alone`);
    if (path !== `${VERTEX_DIR}vertex-speech.config.ts`) assert.doesNotMatch(text, /process\.env/u, `${path}: only the config reads the environment`);
  }
  for (const path of files.filter((p) => !p.startsWith(VERTEX_DIR) && p !== 'apps/api/src/voice/voice.module.ts')) {
    assert.doesNotMatch(read(path), /from '[^']*\/vertex-speech\//u, `${path} does not import the Vertex speech adapter`);
  }
  // RE-ANCHORED by S8B-04 CP2 (2026-11-01, the Product Owner's D-S1 decision: realtime transcription during recording):
  // the realtime adapter speaks to Speechmatics over Node's own global WebSocket - no `ws` package, no SDK - and it is
  // the ONE file (with its spec) that may name a socket. Every other file in the folder still names none.
  const REALTIME = new Set(['apps/api/src/voice/speechmatics/speechmatics-realtime.adapter.ts', 'apps/api/src/voice/speechmatics/speechmatics-realtime.adapter.spec.ts']);
  for (const path of files.filter((p) => p.startsWith('apps/api/src/voice/speechmatics/'))) {
    assert.doesNotMatch(read(path), /from 'ws'|require\('ws'\)|axios|@speechmatics|@google\//u, `${path} uses no provider SDK and no socket package`);
    if (!REALTIME.has(path)) assert.doesNotMatch(read(path), /WebSocket/u, `${path} names no socket (the realtime adapter alone does)`);
  }
  for (const path of files.filter((p) => !p.startsWith('apps/api/src/voice/speechmatics/') && p !== 'apps/api/src/voice/voice.module.ts')) {
    assert.doesNotMatch(read(path), /from '[^']*\/speechmatics\//u, `${path} does not import the Speechmatics adapter`);
  }
  const worker = codeOnly(read('apps/api/src/voice/voice-note-transcription.worker.ts'));
  assert.doesNotMatch(worker, /PrivateAudioObjectStore|PRIVATE_AUDIO_OBJECT_STORE|S3Client/u, 'the worker never reads the private store directly');
  assert.match(worker, /VoiceMediaService/u, 'a note\'s audio comes through VoiceMediaService');
  for (const path of files.filter((p) => !p.endsWith('.spec.ts') && !p.startsWith('apps/api/src/voice/testing/') && !p.startsWith(`${VERTEX_DIR}testing/`))) {
    assert.doesNotMatch(read(path), /Fake(?:SpeechRecognition|SpeechSynthesis)Adapter|FakeBatchTranscriptionJobs|FakeVertexSpeechServer/u, `${path} composes no fake`);
  }
  assert.doesNotMatch(read('apps/api/package.json'), /speechmatics|@google\/genai|@google-cloud\//iu, 'no provider SDK dependency');
  assert.match(read('apps/api/package.json'), /"google-auth-library": "11\.3\.1"/u, 'S8B-04: ADC through google-auth-library, pinned exactly');
  // S8B-03 RE-ANCHOR (contract §5.7.4): the recorder and the saver now exist, and the allowed surface is a FOLDER — the
  // Voice Note client `apps/mobile/src/voice-note/` alone names a voice route. Elsewhere only a test may name one, in an
  // expectation of what that client calls; no other production module reaches a voice surface.
  const VOICE_NOTE_DIR = 'apps/mobile/src/voice-note/';
  const VOICE_SURFACE = /voice_private|server_[a-z_]*voice|turn_voice_source|\/voice\/notes|bundle\/voice/u;
  for (const path of walk(join(root, 'apps/mobile/src')).map((p) => relative(root, p).replaceAll('\\', '/'))) {
    if (path.startsWith(VOICE_NOTE_DIR) || /\/__tests__\//u.test(path)) continue;
    assert.doesNotMatch(read(path), VOICE_SURFACE, `${path} reaches no voice surface (only apps/mobile/src/voice-note/ does)`);
  }
  assert.match(read(`${VOICE_NOTE_DIR}voice-note-api.ts`), /\/voice\/notes/u, 'the Voice Note client is the one that names the routes');
  assert.match(read('apps/api/src/conversation-unit/conversation-unit-commitment.service.ts'), /throw new CommitmentRejectedError\('UNSUPPORTED_SOURCE_MODALITY'\);/u);
});

test('CP2 media privacy: nothing logged, nothing presigned or public, every voice answer no-store, private', () => {
  const media = walk(join(root, 'apps/api/src/voice-media')).map((p) => relative(root, p).replaceAll('\\', '/')).filter((p) => !p.endsWith('.spec.ts'));
  // S8B-04 CP1: QANDEEL's voice (the Vertex adapter, the admission guard, Listen, the failure line) logs nothing either.
  const qandeelVoice = walk(join(root, 'apps/api/src/voice')).map((p) => relative(root, p).replaceAll('\\', '/'))
    .filter((p) => !p.endsWith('.spec.ts') && /\/voice\/(?:vertex-speech|listen|failure-line)\/|speech-admission\.guard\.ts$/u.test(p));
  assert.ok(qandeelVoice.length >= 8, 'the S8B-04 voice files are walked');
  for (const path of [...media, ...qandeelVoice, 'apps/api/src/voice/speech-recognition.adapter.ts', 'apps/api/src/voice/speech-synthesis.adapter.ts']) {
    const text = codeOnly(read(path));
    assert.doesNotMatch(text, /\bLogger\b|console\.|captureException|Sentry/u, `${path} logs nothing`);
    assert.doesNotMatch(text, /getSignedUrl|presign|s3-request-presigner|\bACL\b|public-read/u, `${path} presigns nothing and sets no ACL`);
  }
  const controller = read('apps/api/src/voice-media/voice-media.controller.ts');
  assert.equal((controller.match(/@Header\('Cache-Control', PRIVATE_NO_STORE\)/gu) ?? []).length, 3, 'the JSON routes are no-store, private');
  assert.match(controller, /const PRIVATE_NO_STORE = 'no-store, private';/u);
  assert.match(controller, /response\.setHeader\('Cache-Control', PRIVATE_NO_STORE\);\n\s*await sendAudio/u, 'the byte route sets it before anything is sent');
  assert.match(read('apps/api/src/account/privacy-data.controller.ts'), /export\/download\/bundle\/voice\/:fileName/u);
  assert.doesNotMatch(codeOnly(read('apps/api/src/voice-media/voice-media.service.ts')), /base64/u, 'voice is never exported inline');
  // The S3 adapter itself (the in-memory test fake below it may gather bytes; the adapter never does).
  const store = codeOnly(read('apps/api/src/voice-media/private-audio-object.store.ts')).split('export class InMemoryPrivateAudioObjectStore')[0];
  assert.match(store, /VOICE_OBJECT_MAX_BYTES = 26_214_400/u, 'the object ceiling mirrors 0183');
  assert.doesNotMatch(store, /Buffer\.concat|\.toArray\(\)|arrayBuffer\(\)/u, 'the store never gathers a whole recording');
});
