// S4-02 — Shared Conversation & Material Production Integration: the cross-layer static contract.
//
// It pins what must stay true across the database, the API, the mobile client and the device proof: the human's words go
// through migration 0139's owner commands on the human's own token; QANDEEL's reply is the server's act, composed over the
// frozen I-03 / I-04G chain and the commit binder, never a client's; no Personal intelligence enters a Shared model call;
// the provider is reached only through the provider-neutral Model Router inside the AI-COST-01 attribution scope; the
// mobile World reads material only after ALLOW and draws no voice control; the S4-02 copy lives in one gated module; and
// the device proof adds its two legs to the existing S4 suite. Live behaviour is proven by database/verify-migration-0139.mjs,
// the API specs and the mobile Jest suites; this file proves structure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const RECORD = 'docs/e2e/QANDEEL_S4_02_SHARED_CONVERSATION_MATERIAL_IMPLEMENTATION_RECORD_v1.md';
const MIGRATION = 'database/migrations/0139_shared_world_conversation_material_v1.sql';
const API = 'apps/api/src/shared-world';
const CW = 'apps/api/src/connected-worlds/material-commit';
const MOBILE = 'apps/mobile/src';

test('1 — the contract registers itself in the toolchain and both CI workflows', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['test:s4-02-shared-conversation-material-contract'], 'node --test tests/s4-02-shared-conversation-material-contract.test.mjs');
  for (const workflow of ['.github/workflows/api-ci.yml', '.github/workflows/mobile-ci.yml']) {
    assert.match(read(workflow), /run: npm run test:s4-02-shared-conversation-material-contract\b/u, `${workflow} runs it`);
  }
  assert.match(read('.github/workflows/mobile-ci.yml'), /'tests\/s4-02-shared-conversation-material-contract\.test\.mjs'/u);
});

test('2 — the human\'s commands are 0139\'s owner wrappers on the caller\'s own token; no identity, audience or kind travels', () => {
  const repository = code(`${API}/shared-world-conversation.repository.ts`);
  const migration = read(MIGRATION);
  const calls = [...repository.matchAll(/'([a-z_]+_v1)'/gu)].map((m) => m[1]);
  assert.deepEqual(calls.sort(), ['delete_own_shared_world_material_v1', 'list_own_shared_world_material_v1', 'read_shared_conversation_capability_v1', 'send_shared_world_human_text_v1']);
  for (const name of calls) assert.match(migration, new RegExp(`CREATE FUNCTION public\\.${name}\\(`, 'u'), `${name} is a 0139 owner wrapper`);
  assert.doesNotMatch(repository, /ServiceRole|service_role|p_user_id|p_author|p_audience|p_material_kind|p_viewer|p_member/u);
  const controller = code(`${API}/shared-world.controller.ts`);
  assert.doesNotMatch(controller, /@Param\('(?:userId|authorId|memberId|audience|viewerId)'\)|@Query\(/u);
  // Older history: one route whose only parameters are the World and the keyset cursor, validated exactly by the service.
  assert.match(controller, /@Get\('worlds\/:worldId\/materials\/before\/:materialId\/:establishedAt'\)/u);
  const conversationService = code(`${API}/shared-world-conversation.service.ts`);
  assert.match(conversationService, /if \(!UUID\.test\(materialId\) \|\| !INSTANT\.test\(establishedAt\)/u, 'a malformed cursor is refused');
  assert.match(conversationService, /this\.conversation\.material\(token, worldId, before, SHARED_MATERIAL_PAGE \+ 1\)/u, 'one page and one row: never unbounded history');
  assert.match(repository, /p_limit: Math\.min\(Math\.max\(limit, 1\), SHARED_MATERIAL_PAGE \+ 1\)/u);
  const census = read('apps/api/src/http-security/route-rate-limit.census.ts');
  assert.match(census, /'GET \/shared\/worlds\/:worldId\/materials': 'AUTHENTICATED'/u);
  assert.match(census, /'GET \/shared\/worlds\/:worldId\/materials\/before\/:materialId\/:establishedAt': 'AUTHENTICATED'/u);
  assert.match(census, /'POST \/shared\/worlds\/:worldId\/messages': 'SECURITY_SENSITIVE'/u);
  assert.match(census, /'POST \/shared\/worlds\/:worldId\/materials\/:materialId\/delete': 'AUTHENTICATED'/u);
  for (const file of readdirSync(new URL(`${API}/`, root)).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))) {
    assert.doesNotMatch(code(`${API}/${file}`), /commit_shared_world_human_text_v1|commit_shared_world_qandeel_material_v1|delete_shared_world_owned_material_v1/u,
      `${file} reaches no frozen 0090 primitive`);
  }
});

test('3 — QANDEEL\'s reply is the server\'s act over the frozen chain: one composition, the binder, QANDEEL_OUTPUT only', () => {
  const service = code(`${CW}/shared-qandeel-reply.service.ts`);
  assert.match(service, /this\.effectiveContext\.resolve\(worldId, \[\]\)/u, 'no private Personal candidate is ever offered');
  assert.match(service, /bindSharedQandeelMaterialCommit\(\{/u, 'the frozen commit binder assembles the commit inputs');
  assert.match(service, /materialKind: 'QANDEEL_OUTPUT'/u);
  assert.doesNotMatch(service, /QANDEEL_ANALYSIS/u);
  assert.match(service, /'begin_shared_qandeel_reply_work_v1'/u);
  assert.match(service, /'complete_shared_world_qandeel_reply_v1'/u);
  assert.match(service, /'end_shared_qandeel_reply_work_v1'/u);
  assert.doesNotMatch(service, /'commit_shared_world_qandeel_reply_v1'/u);
  assert.match(service, /'resolve_shared_world_material_v1'/u, 'the model context is what every recipient may see, through the frozen resolver');
  const order = ['this.server.rpc<unknown>(SHARED_QANDEEL_REPLY_WORK_BEGIN_RPC', 'this.effectiveContext.resolve(', 'this.generator.generate(', 'this.readiness.evaluate(',
    'this.revalidator.revalidate(', 'bindSharedQandeelMaterialCommit(', 'this.server.rpc<unknown>(SHARED_QANDEEL_REPLY_COMMIT_RPC'];
  const positions = order.map((step) => service.indexOf(step));
  assert.ok(positions.every((p) => p > 0), 'every frozen step is present');
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'the order: the work lease, then context, generation, readiness, revalidation, binding, commit');
  // The provider-work bound is the database's (PROD-SEC-02 principle): no lease, no provider work; the lease is always returned.
  assert.match(service, /if \(work\.work_outcome !== 'GRANTED'/u);
  assert.match(service, /\} finally \{\n[^}]*this\.server\.rpc<unknown>\(SHARED_QANDEEL_REPLY_WORK_END_RPC/u);
  assert.match(service, /p_lease_id: leaseId,/u, 'the commit is made under the granted lease');
  assert.doesNotMatch(service, /new Mutex|Semaphore|inFlight = new (?:Set|Map)/u, 'no process-local mutex is the authority');
  const providers = code(`${CW}/shared-qandeel-reply.providers.ts`);
  assert.match(providers, /provide: SHARED_SOURCE_DISCLOSURE_DETECTOR, useClass: UnimplementedSourceDisclosureDetector/u);
  assert.match(providers, /provide: SHARED_PRIVATE_SOURCE_STATE_RESOLVER, useClass: UnimplementedPrivateSourceState/u);
  const boundaries = code(`${CW}/shared-unavailable-private-context-boundaries.ts`);
  assert.doesNotMatch(boundaries, /'CLEAR'|'AVAILABLE'/u, 'the unimplemented boundaries never clear and never answer AVAILABLE');
});

test('4 — no Personal intelligence enters a Shared model call; the provider is reached only through the Model Router, attributed', () => {
  // S8A-02 CP2 (CA-S3): the Shared attribution layer and its two modules are part of the Shared model input, under the same rules.
  const files = [`${API}/shared-conversation-model-input.ts`, `${API}/shared-conversation-reply.generator.ts`, `${API}/shared-world-conversation.service.ts`, `${CW}/shared-qandeel-reply.service.ts`,
    `${API}/shared-attribution-layer.ts`, `${API}/shared-attribution-notes.ts`, `${API}/shared-attribution-reading.ts`,
    // S8A-04 CP2 (2026-10-24, re-anchored): the World's knowledge and its recall are part of the Shared model input too.
    `${API}/shared-world-knowledge.ts`, `${API}/shared-knowledge-recall.ts`, `${API}/deepseek-shared-knowledge-recall.ts`];
  for (const file of files) {
    const text = code(file);
    assert.doesNotMatch(text, /from '\.\.\/(?:\.\.\/)?(?:memory|human-model|hypothesis|recommendation|question|background-intelligence|post-response-intelligence)\//u, `${file} reads no Personal intelligence`);
    assert.doesNotMatch(text, /\bConversationRepository\b|ContextBuilderService|ConversationOrchestrator|\bsessionId\b|memoryContext:|humanIntelligence:|hypothesisContext:|recommendationContext:|questionContext:/u, `${file} uses no Personal session or intelligence`);
    assert.doesNotMatch(text, /@anthropic-ai|openai|new Anthropic|new OpenAI|\.messages\.create\(|\.responses\.create\(/u, `${file} names no provider`);
    assert.doesNotMatch(text, /console\.|logger\.|Logger\b/u, `${file} logs nothing`);
  }
  const generator = code(`${API}/shared-conversation-reply.generator.ts`);
  assert.match(generator, /@Inject\(MODEL_ROUTER\)/u);
  // S8A-02 CP2 (CA-S3): the attribution reading and the reply are both made inside the ONE requester-attributed scope.
  // S8A-04 CP2 (2026-10-24, re-anchored): the same ONE scope, correlated with the World and its message (AI-COST-01 as
  // narrowed, amendment §5), now also holds the knowledge recall; the reply sends `budgeted` (the request with M3 appended).
  assert.match(generator, /const attribution = input\.source === undefined\s*\? \{ userId: input\.requesterUserId \}\s*: \{ userId: input\.requesterUserId, sourceWorldId: input\.source\.worldId, sourceSharedMaterialId: input\.source\.materialId \};/u, 'the scope is the requester');
  const scope = generator.slice(generator.indexOf('runWithAiUsageAttribution(attribution, async () => {'));
  assert.ok(generator.split('runWithAiUsageAttribution(').length === 2 && scope.length < generator.length, 'one attributed scope');
  const inside = scope.slice(0, scope.indexOf('\n      });'));
  for (const call of ['chooseSharedKnowledge(', 'withSharedAttribution(input.conversation, request, this.reader)', 'this.router.generate(budgeted)']) {
    assert.ok(inside.includes(call), `every provider call is attributed (AI-COST-01): ${call}`);
  }
  assert.equal(generator.split('chooseSharedKnowledge(').length - 1, 2, 'recall is chosen once, inside the attributed scope (plus its definition)');
  assert.equal(generator.split('withSharedAttribution(').length - 1, 1, 'the attribution layer is reached once, only inside the attributed scope');
  assert.equal(generator.split('this.router.generate(').length - 1, 1, 'one reply call');
  const reading = code(`${API}/shared-attribution-reading.ts`);
  assert.equal(reading.split('this.router.generate(').length - 1, 1, 'the reading reaches the provider only through the Model Router, once');
  assert.match(generator, /this\.safety\.evaluate\(/u, 'the canonical Safety Response Gate runs first');
  const assembler = code(`${API}/shared-conversation-model-input.ts`);
  assert.match(assembler, /TEXT_V1_BEHAVIORAL_GUIDANCE/u, 'the frozen Behavioral Response Policy, unchanged');
  assert.match(assembler, /HISTORY_BUDGET_BYTES/u, 'the frozen history budget');
});

test('5 — the mobile World reads material only after ALLOW, belongs to one World, and draws no voice control', () => {
  const controller = code(`${MOBILE}/shared-world/shared-world-controller.ts`);
  assert.match(controller, /if \(result\.kind === 'ALLOW'\) await readThread\(worldId\);/u, 'the conversation is read only after ALLOW');
  assert.match(controller, /if \(state\.thread\.worldId !== worldId\) return;/u, 'an answer for another World is dropped');
  assert.doesNotMatch(controller, /setInterval|setTimeout|WebSocket|EventSource/u, 'no timer and no realtime channel');
  for (const file of ['SharedWorldThread.tsx', 'SharedWorldArea.tsx', 'shared-world-controller.ts', 'conversation-copy.ts']) {
    assert.doesNotMatch(code(`${MOBILE}/shared-world/${file}`), /expo-av|expo-audio|Audio\.|microphone|Microphone|VoiceNote|voice_note|recordAsync|\bmic\b/u, `${file} carries no voice control (QAN-BL-VOICE-01)`);
  }
  for (const file of ['SharedWorldThread.tsx', 'SharedWorldArea.tsx']) {
    assert.doesNotMatch(code(`${MOBILE}/shared-world/${file}`), /['"`][^'"`\n]*[؀-ۿ][^'"`\n]*['"`]/u, `${file} carries no Arabic literal`);
  }
  assert.match(code(`${MOBILE}/shared-world/SharedWorldArea.tsx`), /<KeyboardAvoidingView style=\{\{ flex: 1 \}\} behavior="padding">/u,
    'the Shared composer and Send stay above the keyboard on both platforms (Android 15+ edge-to-edge does not resize)');
  const api = code(`${MOBILE}/runtime-entry/shared-world-api.ts`);
  assert.doesNotMatch(api, /authorId|userId|audience|materialKind|viewer/u, 'the client sends no identity, audience or kind');
});

test('6 — the S4-02 words live in one copy module under one gate; approved rows are reused, never copied', () => {
  const copy = read(`${MOBILE}/shared-world/conversation-copy.ts`);
  assert.match(copy, /export const SHARED_CONVERSATION_COPY_GATE = \{/u);
  assert.match(copy, /conversationCopy\(language\); \/\/ REUSED — W1A-01/u);
  assert.match(copy, /sharedCopy\(language\); \/\/ REUSED — S4-01/u);
  const approved = [...copy.matchAll(/^\s+(\w+): ['"][^\n]*\/\/ APPROVED — S4-02 Product Copy Gate/gmu)].map((m) => m[1]);
  assert.equal(approved.length, 16, 'eight S4-02 rows in each language, each APPROVED under the gate');
  assert.doesNotMatch(copy, /PROPOSED/u, 'the S4-02 Product Copy Gate is CLOSED: no PROPOSED row remains');
  assert.match(copy, /status: 'S4-02 PRODUCT COPY GATE — CLOSED/u);
});

test('7 — the device proof adds exactly its two S4-02 legs to the existing S4 suite, deterministic and validation-only', () => {
  const runner = read('scripts/phase-m/run-s401-proof-leg.sh');
  assert.match(runner, /ar-s402-journey-a\) maestro_flow s4-02-journey-a\.yaml leg/u);
  assert.match(runner, /en-s402-journey-b\) maestro_flow s4-02-journey-b\.yaml leg/u);
  for (const flow of ['s4-02-journey-a.yaml', 's4-02-journey-b.yaml']) {
    const text = read(`apps/mobile/.maestro/${flow}`);
    assert.doesNotMatch(text, /- wait:|sleep|waitForAnimationToEnd/u, `${flow} synchronizes on state, never on time`);
  }
  assert.match(read('.github/workflows/s4-proof.yml'), /'feat\/s4-02-shared-conversation-material'/u);
  const world = code(`${MOBILE}/integration/__validation__/s401-proof-world.ts`);
  assert.match(world, /VALIDATION-ONLY deterministic provider seam|S402_PROOF_LINES\.reply\[language\]/u);
  for (const file of readdirSync(new URL(`${MOBILE}/shared-world/`, root)).filter((f) => /\.(ts|tsx)$/u.test(f))) {
    assert.doesNotMatch(code(`${MOBILE}/shared-world/${file}`), /__validation__|S401ProofRoot|S402_PROOF/u, `${file} reaches no proof code`);
  }
});

test('8 — the implementation record exists and states its lifecycle without claiming a merge', () => {
  assert.ok(existsSync(new URL(RECORD, root)));
  const record = read(RECORD);
  assert.match(record, /^# QANDEEL — S4-02 Shared Conversation & Material Production Integration — Implementation Record v1/u);
  assert.match(record, /^\*\*Status:\*\* \*\*`S4-02 IMPLEMENTED/mu);
  assert.doesNotMatch(record, /^\*\*Status:\*\*[^\n]*MERGED \/ CLOSED/mu, 'the record never claims a merge it has not had');
  assert.match(record, /\*\*Orphan gaps:\*\* none silently dropped/u);
  // The one S4-02-owned obligation it could not satisfy is reported with its census, never silently deferred.
  assert.match(record, /### 7\.1 Personal Standing Context — census and blocking gap \(reported, not deferred\)/u);
  assert.match(record, /QAN-BL-VOICE-01/u);
});
