// Committed Conversational Unit activation-boundary static contract.
//
// T-03A1 froze this boundary as "merging T-03A1 ALONE cannot begin producing
// Product-authoritative committed CUs". T-03A2 is the ONE authorized crossing
// of it: migration 0065 grants the canonical producer to `service_role` in the
// same migration that makes SP allocation part of commitment, so commitment and
// temporal establishment become executable together and no committed CU can
// exist without a Session Position.
//
// This contract therefore now proves BOTH halves:
//   * every T-03A1 invariant that survives the crossing - migration 0064 is
//     unchanged, the producer exposes no caller-authoritative parameter,
//     offsets are code points, replay never re-runs inference, and the runtime
//     outbox and dispatch ledger identity contracts are untouched;
//   * that the crossing is EXACTLY the authorized one - the substrate is
//     reachable only through the named T-03A2 boundary, that boundary carries
//     no Nest decorator of its own, and it introduces LH and nothing later.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const UNIT_DIR = new URL('../apps/api/src/conversation-unit/', import.meta.url);
const API_SRC = new URL('../apps/api/src/', import.meta.url);

const migration = read('../database/migrations/0064_committed_conversational_unit_substrate_v1.sql');
const activation = read('../database/migrations/0065_session_semantic_clock_sp_lh_delivery_v1.sql');
const outboxMigration = read('../database/migrations/0019_runtime_event_outbox_publisher_v1.sql');
const dispatchMigration = read('../database/migrations/0022_post_response_intelligence_dispatch_v1.sql');
const appModule = read('../apps/api/src/app.module.ts');
const conversationModule = read('../apps/api/src/conversation/conversation.module.ts');
const orchestrator = read('../apps/api/src/conversation/conversation-orchestrator.service.ts');
const conversationRepository = read('../apps/api/src/conversation/conversation.repository.ts');
const dispatcher = read('../apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts');

const unitFiles = readdirSync(UNIT_DIR);
const productionUnitFiles = unitFiles.filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'));

/** The T-03A1 files, whose contents stay free of every temporal identity. */
const T03A1_FILES = [
  'conversation-unit-commitment.service.ts',
  'conversation-unit.repository.ts',
  'conversation-unit.types.ts',
  'cu-anchor-mapper.ts',
  'cu-segmentation-provider.config.ts',
  'cu-segmentation-provider.types.ts',
  'cu-span-validator.ts',
  'fake-cu-segmentation.provider.ts',
  'openai-cu-segmentation.provider.ts',
];
/** The T-03A2 boundary, and the ONLY authorized addition to this directory. */
const T03A2_FILES = [
  'conversation-temporal-establishment.service.ts',
  'deterministic-runtime-id.ts',
  'temporal-delivery.repository.ts',
];
/** The T-03A1 files that stay entirely free of Session Position identity. */
const T03A1_TEMPORAL_FREE_FILES = T03A1_FILES.filter(
  (name) => name !== 'conversation-unit.types.ts' && name !== 'conversation-unit.repository.ts',
);

// Prose explains WHY a construct is forbidden and therefore names it. Every
// "must not contain" assertion runs against executable code only.
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const stripSqlComments = (source) => source.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const executableMigration = stripSqlComments(migration);
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

test('the conversation-unit API surface is exactly T-03A1 plus the authorized T-03A2 boundary', () => {
  assert.ok(!unitFiles.includes('conversation-unit.module.ts'), 'no module file exists in this directory');
  assert.ok(!existsSync(new URL('conversation-unit.module.ts', UNIT_DIR)));
  assert.deepEqual(productionUnitFiles.sort(), [...T03A1_FILES, ...T03A2_FILES].sort());
  for (const name of T03A2_FILES) {
    assert.ok(existsSync(new URL(name, UNIT_DIR)), `missing ${name}`);
  }
});

test('nothing in the conversation-unit directory is a Nest provider (Gate B, preserved)', () => {
  // The directory stays framework-agnostic even after activation: the T-03A2
  // wiring registers these plain classes through explicit factories in
  // ConversationModule rather than decorating them here.
  for (const name of productionUnitFiles) {
    const source = stripComments(read(`../apps/api/src/conversation-unit/${name}`));
    assert.doesNotMatch(source, /@Injectable\(|@Module\(|@Controller\(|@Inject\(|@Global\(/u,
      `${name} must not be decorated as a Nest provider`);
  }
});

test('the substrate is reachable ONLY through the named T-03A2 boundary', () => {
  const referencing = walk(API_SRC)
    .filter((file) => !file.url.includes('/conversation-unit/'))
    // T-03B1a (conversational-focus) reuses the PURE code-point anchor helper
    // of T-03A1 and nothing else; it is pinned separately just below.
    .filter((file) => !file.url.includes('/conversational-focus/'))
    .filter((file) => /conversation-unit|commit_conversation_units_v1|ConversationUnitRepository|ConversationUnitCommitmentService|ConversationTemporalEstablishmentService|CuSegmentation/u.test(read(file.path)))
    .map((file) => file.name)
    .sort();
  assert.deepEqual(referencing, [
    'conversation-temporal.controller.spec.ts',
    'conversation-temporal.controller.ts',
    'conversation.module.ts',
    'conversation.service.spec.ts',
    'conversation.service.ts',
  ], 'only the authorized T-03A2 wiring may reach the committed-CU substrate');

  // The T-03B1a evaluator may import ONLY `cu-anchor-mapper` (pure, no I/O)
  // from this directory: never the repository, the producer RPC, the
  // commitment service, the temporal boundary or a segmentation provider.
  for (const file of walk(API_SRC).filter((entry) => entry.url.includes('/conversational-focus/'))) {
    const source = read(file.path);
    for (const match of source.matchAll(/from\s+'([^']*conversation-unit[^']*)'/gu)) {
      assert.equal(match[1], '../conversation-unit/cu-anchor-mapper', `${file.name} may reuse only the pure anchor helper`);
    }
    assert.doesNotMatch(source, /commit_conversation_units_v1|ConversationUnitRepository|ConversationUnitCommitmentService|ConversationTemporalEstablishmentService|CuSegmentation/u,
      `${file.name} does not reach the committed-CU substrate`);
  }

  // AppModule, the orchestrator, the conversation repository and the
  // post-response dispatcher are untouched by the activation. The orchestrator
  // in particular is the GENERATION/FINALIZATION phase: it holds no reference
  // to temporal establishment, so a post-finalization temporal failure has no
  // code path through which it could mark a COMPLETED turn FAILED, call
  // `fail_conversation_turn`, or regenerate an assistant response.
  for (const [name, source] of [['AppModule', appModule], ['the orchestrator', orchestrator],
    ['the conversation repository', conversationRepository], ['the dispatcher', dispatcher]]) {
    assert.doesNotMatch(source, /conversation-unit|conversation_unit|commit_conversation_units|temporal|session_position|LIVE_HEAD/iu,
      `${name} is not part of the temporal establishment boundary`);
  }
  assert.match(orchestrator, /await this\.repository\.failTurn\(/u, 'the orchestrator still owns generation-failure lifecycle');
  assert.match(conversationModule, /ConversationTemporalEstablishmentService/u, 'the boundary is wired exactly once, in ConversationModule');
});

test('T-03A1 itself still produces no SP, LH, Moment, Timeline or delivery artefact', () => {
  const forbidden = /session_position|live_head|LIVE_HEAD|ConversationalUnitsCommitted|SP_PENDING|PRE_MOMENT|PENDING_MOMENT|COMMITTED_WITHOUT_SP|SessionSemanticClock|session_semantic|timeline|knowledge_frontier|\bKF\b|\bVF\b|\bVT\b/u;
  assert.ok(migration.includes(SELF_ASSERTION_MARKER), 'the terminal self-assertion block exists');
  assert.match(migration, /RAISE EXCEPTION 'T-03A1 must introduce no SP\/LH\/Moment\/status column'/u,
    'migration 0064 itself refuses to deploy a Moment-adjacent column');
  assert.doesNotMatch(migrationBody, forbidden, 'migration 0064 introduces nothing temporal');
  for (const name of T03A1_TEMPORAL_FREE_FILES) {
    assert.doesNotMatch(stripComments(read(`../apps/api/src/conversation-unit/${name}`)), forbidden,
      `${name} introduces nothing temporal`);
  }
});

test('the T-03A2 crossing is exactly the authorized one: LH, and nothing later', () => {
  // The activation migration is the single place the grant happens, and it
  // grants the producer to service_role only.
  assert.match(activation, /GRANT EXECUTE ON FUNCTION public\.commit_conversation_units_v1\([^)]*\) TO service_role/u);
  for (const role of ['anon', 'authenticated']) {
    assert.match(activation, new RegExp(`the canonical producer must never be executable by`, 'u'));
    assert.doesNotMatch(stripSqlComments(activation),
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.commit_conversation_units_v1\\([^)]*\\) TO ${role}`, 'u'),
      `the producer is never granted to ${role}`);
  }
  assert.doesNotMatch(executableMigration, /GRANT EXECUTE ON FUNCTION public\.commit_conversation_units_v1/u,
    'migration 0064 still grants nothing: the activation is 0065 alone');

  // The T-03A2 boundary carries Session Position and Live Head, and stops
  // exactly there: no Live Focus, Thread, Reading, K/V, Timeline, projection or
  // realtime push infrastructure is pulled forward.
  const boundary = T03A2_FILES.map((name) => stripComments(read(`../apps/api/src/conversation-unit/${name}`))).join('\n');
  assert.match(boundary, /session_position|liveHead|live_head/u, 'the boundary does establish Session time');
  for (const forbidden of ['LIVE_FOCUS', 'liveFocus', 'EmergingFocus', 'emergingFocusId', 'threadId', 'Thread(',
    'knowledgeFrontier', 'timeline', 'projection', 'WebSocket', 'EventSource', 'same_sp_event_sequence']) {
    assert.ok(!boundary.includes(forbidden), `the T-03A2 boundary must not contain ${forbidden}`);
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
  assert.doesNotMatch(stripSqlComments(activation), /INSERT INTO public\.runtime_event_outbox|ALTER TABLE public\.runtime_event_outbox|post_response_intelligence/u,
    'the T-03A2 delivery surface is dedicated and reuses neither');
});

test('the application seam can carry no canonical source authority (REV03A1-03)', () => {
  const repository = stripComments(read('../apps/api/src/conversation-unit/conversation-unit.repository.ts'));
  const sent = repository.match(/rpc<CommittedConversationUnit\[\]>\('commit_conversation_units_v1', \{([\s\S]*?)\n    \}\)/u);
  assert.ok(sent, 'the RPC payload was located');
  for (const forbidden of ['committed_text', 'source_role', 'speaker_state', 'source_modality', 'sha256', 'digest', 'fingerprint', 'ordinal', 'p_sp', 'p_session_position']) {
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
  assert.doesNotMatch(stripSqlComments(activation), /openai|anthropic|gemini|provider_call|http|fetch/iu,
    'the activation migration re-runs no inference either');
});
