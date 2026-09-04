// T-03A1 activation-boundary static contract.
//
// Secret-free and CI-runnable. It proves that merging and deploying T-03A1
// ALONE cannot begin producing Product-authoritative committed CUs: the durable
// producer is granted to no role, nothing wires it into the running
// application, and no SP/LH/Moment/delivery artefact exists anywhere.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const UNIT_DIR = new URL('../apps/api/src/conversation-unit/', import.meta.url);
const API_SRC = new URL('../apps/api/src/', import.meta.url);

const migration = read('../database/migrations/0064_committed_conversational_unit_substrate_v1.sql');
const outboxMigration = read('../database/migrations/0019_runtime_event_outbox_publisher_v1.sql');
const dispatchMigration = read('../database/migrations/0022_post_response_intelligence_dispatch_v1.sql');
const appModule = read('../apps/api/src/app.module.ts');
const conversationModule = read('../apps/api/src/conversation/conversation.module.ts');
const orchestrator = read('../apps/api/src/conversation/conversation-orchestrator.service.ts');
const conversationRepository = read('../apps/api/src/conversation/conversation.repository.ts');
const dispatcher = read('../apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts');

const unitFiles = readdirSync(UNIT_DIR);
const productionUnitFiles = unitFiles.filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'));
// Prose explains WHY a construct is forbidden and therefore names it. Every
// "must not contain" assertion runs against executable code only.
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const stripSqlComments = (source) => source.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const executableMigration = stripSqlComments(migration);
// The terminal self-assertion block necessarily NAMES the forbidden column
// tokens inside its own guard pattern, so scans for those tokens run against
// the DDL and producer body that precede it.
const SELF_ASSERTION_MARKER = '-- 6. Terminal self-assertions.';
const migrationBody = stripSqlComments(migration.slice(0, migration.indexOf(SELF_ASSERTION_MARKER)));

function walk(directory, collected = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) walk(child, collected);
    else if (entry.name.endsWith('.ts')) collected.push({ path: child, name: entry.name, url: child.href });
  }
  return collected;
}

test('the T-03A1 API surface is exactly the authorized file set and contains no Nest module', () => {
  assert.ok(!unitFiles.includes('conversation-unit.module.ts'), 'no module file exists, so nothing can be imported into AppModule');
  assert.ok(!existsSync(new URL('conversation-unit.module.ts', UNIT_DIR)));
  assert.deepEqual(productionUnitFiles.sort(), [
    'conversation-unit-commitment.service.ts',
    'conversation-unit.repository.ts',
    'conversation-unit.types.ts',
    'cu-anchor-mapper.ts',
    'cu-segmentation-provider.config.ts',
    'cu-segmentation-provider.types.ts',
    'cu-span-validator.ts',
    'fake-cu-segmentation.provider.ts',
    'openai-cu-segmentation.provider.ts',
  ]);
});

test('nothing in the T-03A1 directory is a Nest provider (Gate B)', () => {
  for (const name of productionUnitFiles) {
    const source = stripComments(read(`../apps/api/src/conversation-unit/${name}`));
    assert.doesNotMatch(source, /@Injectable\(|@Module\(|@Controller\(|@Inject\(|@Global\(/u,
      `${name} must not be decorated as a Nest provider`);
  }
});

test('no running application code references the T-03A1 substrate (Gate B)', () => {
  const offenders = walk(API_SRC)
    .filter((file) => !file.url.includes('/conversation-unit/'))
    .filter((file) => /conversation-unit|commit_conversation_units_v1|ConversationUnitRepository|ConversationUnitCommitmentService|CuSegmentation/u.test(read(file.path)));
  assert.deepEqual(offenders.map((file) => file.name), [], 'no production file outside the T-03A1 directory may reference it');
  for (const [name, source] of [['AppModule', appModule], ['ConversationModule', conversationModule],
    ['the orchestrator', orchestrator], ['the conversation repository', conversationRepository], ['the dispatcher', dispatcher]]) {
    assert.doesNotMatch(source, /conversation-unit|conversation_unit|commit_conversation_units/u, `${name} is unchanged by T-03A1`);
  }
});

test('the durable producer is granted to no application role (Gate A, case 28)', () => {
  assert.doesNotMatch(executableMigration, /GRANT EXECUTE ON FUNCTION public\.commit_conversation_units_v1/u);
  assert.doesNotMatch(executableMigration, /GRANT [A-Z, ]*ON TABLE public\.conversation_unit/u);
  for (const role of ['PUBLIC', 'anon', 'authenticated', 'service_role']) {
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.commit_conversation_units_v1\\([^)]*\\)[\\s\\S]{0,80}${role}`, 'u'),
      `EXECUTE is revoked from ${role}`);
  }
});

test('T-03A1 produces no SP, LH, Moment, Timeline or client-delivery artefact (case 29)', () => {
  const forbidden = /session_position|live_head|LIVE_HEAD|ConversationalUnitsCommitted|SP_PENDING|PRE_MOMENT|PENDING_MOMENT|COMMITTED_WITHOUT_SP|SessionSemanticClock|session_semantic|timeline|knowledge_frontier|\bKF\b|\bVF\b|\bVT\b/u;
  assert.ok(migration.includes(SELF_ASSERTION_MARKER), 'the terminal self-assertion block exists');
  assert.match(migration, /RAISE EXCEPTION 'T-03A1 must introduce no SP\/LH\/Moment\/status column'/u,
    'the migration itself refuses to deploy a Moment-adjacent column');
  assert.doesNotMatch(migrationBody, forbidden, 'the migration introduces nothing temporal');
  for (const name of productionUnitFiles) {
    assert.doesNotMatch(stripComments(read(`../apps/api/src/conversation-unit/${name}`)), forbidden, `${name} introduces nothing temporal`);
  }
});

test('the existing outbox and dispatch identity contracts are untouched (case 29)', () => {
  const eventTypes = outboxMigration.match(/event_type text NOT NULL CHECK \(event_type IN \(([^)]*)\)\)/u);
  assert.ok(eventTypes, 'the outbox event_type CHECK was located');
  assert.deepEqual(eventTypes[1].split(',').map((value) => value.trim()),
    ["'ConversationTurnCompleted'", "'ConversationTurnFailed'", "'ConversationTurnCancelled'"],
    'the outbox still admits exactly the three existing event types');
  assert.match(outboxMigration, /UNIQUE \(event_type, subject_turn_id\)/u, 'the one-event-per-turn constraint is unchanged');
  const effectKeys = dispatchMigration.match(/effect_key text NOT NULL CHECK\(effect_key IN\(([^)]*)\)\)/u);
  assert.ok(effectKeys, 'the dispatch effect_key CHECK was located');
  assert.deepEqual(effectKeys[1].split(',').map((value) => value.trim()),
    ["'MEMORY_WRITE'", "'INTENT_PROVIDER'", "'CANDIDATE_PROVIDER'", "'HYPOTHESIS_PERSISTENCE'", "'CONFIDENCE_BATCH'"],
    'no CU effect key was added to the single-turn dispatch ledger');
  assert.doesNotMatch(executableMigration, /runtime_event_outbox|post_response_intelligence/u,
    'canonical CU idempotency depends on neither the outbox nor the dispatch ledger');
});

test('the application seam can carry no canonical source authority (REV03A1-03)', () => {
  const repository = stripComments(read('../apps/api/src/conversation-unit/conversation-unit.repository.ts'));
  const sent = repository.match(/rpc<CommittedConversationUnit\[\]>\('commit_conversation_units_v1', \{([\s\S]*?)\n    \}\)/u);
  assert.ok(sent, 'the RPC payload was located');
  for (const forbidden of ['committed_text', 'source_role', 'speaker_state', 'source_modality', 'sha256', 'digest', 'fingerprint', 'ordinal', 'p_sp']) {
    assert.ok(!sent[1].includes(forbidden), `the seam must not send ${forbidden}`);
  }
  assert.match(repository, /serviceApi\.rpc/u, 'commitment runs through the server-authority channel');
  assert.doesNotMatch(repository, /accessToken|dataApi/u, 'no caller access token reaches the producer');
});

test('offsets are computed from code points, never UTF-16 code units (REV03A1-04/05)', () => {
  const mapper = stripComments(read('../apps/api/src/conversation-unit/cu-anchor-mapper.ts'));
  assert.match(mapper, /Array\.from\(value\)/u, 'the mapper splits into code points');
  assert.doesNotMatch(mapper, /\.length\s*[-+]\s*1\s*\]|content\.length|value\.length|\.substring\(|\.substr\(|\.slice\(\s*\w+\s*,\s*\w+\s*\)\s*;\s*\/\/\s*utf16/u,
    'the mapper never indexes the raw string');
  assert.match(mapper, /codePointLength/u);
  // The provider proposes anchors, never coordinates.
  const provider = stripComments(read('../apps/api/src/conversation-unit/openai-cu-segmentation.provider.ts'));
  assert.match(provider, /required: \['text', 'occurrence'\]/u, 'the strict schema admits only extractive anchors');
  assert.match(provider, /additionalProperties: false/u);
  assert.doesNotMatch(provider, /span_start|span_end|spanStart|spanEnd/u, 'the provider never handles a coordinate');
});

test('replay and read paths never invoke a provider (case 30)', () => {
  const repository = stripComments(read('../apps/api/src/conversation-unit/conversation-unit.repository.ts'));
  // The seam records WHICH provider produced the boundaries as durable
  // provenance, but imports no provider, no adapter and no mapper: a read or a
  // replay can never re-run segmentation inference.
  assert.doesNotMatch(repository, /^import .*(?:provider|anchor|mapper|openai)/imu, 'the durable seam imports no provider or mapper');
  assert.doesNotMatch(repository, /CuSegmentationProvider|OpenAiCuSegmentationProvider|mapAnchorsToSpans|propose\(/u,
    'the durable seam invokes no segmentation');
  assert.doesNotMatch(executableMigration, /openai|anthropic|gemini|provider_call|http|fetch/iu, 'the database re-runs no inference');
});
