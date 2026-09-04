// T-03B1a - Reference / Attention Resolution Evaluator + Prepared Focus
// Semantics: the static anti-scope contract.
//
// Secret-free and CI-runnable. Semantic behaviour is proven by the Jest suites
// under apps/api/src/conversational-focus (fake provider, no live call). This
// contract guards the SHAPE of the slice: what exists, that nothing reaches it,
// that it reaches nothing durable, the frozen vocabularies it consumes, the
// strictness of the provider schema, the one-CU no-hindsight input boundary,
// and the absence of every shortcut the frozen grammar forbids.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = async (path) => (await readFile(new URL(path, root), 'utf8')).replace(/\r\n/gu, '\n');
const readJson = async (path) => JSON.parse(await read(path));

/** Executable code only: prose may name a forbidden construct in order to forbid it. */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');

const FOCUS_DIR = 'apps/api/src/conversational-focus';
/** The T-03B1a evaluator slice. */
const EVALUATOR_FILES = [
  'conversational-focus-evaluator.service.ts',
  'conversational-focus.types.ts',
  'fake-focus-resolution.provider.ts',
  'focus-anchor-mapper.ts',
  'focus-resolution-provider.config.ts',
  'focus-resolution-provider.types.ts',
  'focus-resolution-validator.ts',
  'index.ts',
  'openai-focus-resolution.provider.ts',
];
/** The T-03B1b1 pure canonicalization boundary: prepared results -> the durable payload. */
const CANONICALIZER_FILES = ['durable-focus-canonicalizer.ts', 'durable-focus-payload.types.ts'];
const PRODUCTION_FILES = [...EVALUATOR_FILES, ...CANONICALIZER_FILES];
const SPEC_FILES = [
  'conversational-focus-evaluator.service.spec.ts',
  'durable-focus-canonicalizer.spec.ts',
  'focus-anchor-mapper.spec.ts',
  'focus-resolution-validator.spec.ts',
  'openai-focus-resolution.provider.spec.ts',
];

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}
const relative = (file, base = rootPath) => file.slice(base.length).replace(/^[\\/]/u, '').replace(/\\/gu, '/');

const sources = Object.fromEntries(await Promise.all(PRODUCTION_FILES.map(async (name) => [name, await read(`${FOCUS_DIR}/${name}`)])));
const code = Object.fromEntries(Object.entries(sources).map(([name, text]) => [name, stripComments(text)]));
const allCode = Object.values(code).join('\n');
/** The T-03B1a evaluator alone, which still allocates no durable identity of any kind. */
const evaluatorCode = EVALUATOR_FILES.map((name) => code[name]).join('\n');
const evaluator = code['conversational-focus-evaluator.service.ts'];
const validator = code['focus-resolution-validator.ts'];
const mapper = code['focus-anchor-mapper.ts'];
const types = code['conversational-focus.types.ts'];
const providerTypes = code['focus-resolution-provider.types.ts'];
const openai = code['openai-focus-resolution.provider.ts'];

const rootPackage = await readJson('package.json');
const apiPackage = await readJson('apps/api/package.json');
const apiCi = await read('.github/workflows/api-ci.yml');
const mobileCi = await read('.github/workflows/mobile-ci.yml');
const conversationModule = await read('apps/api/src/conversation/conversation.module.ts');
const conversationService = await read('apps/api/src/conversation/conversation.service.ts');
const appModule = await read('apps/api/src/app.module.ts');
const establishment = await read('apps/api/src/conversation-unit/conversation-temporal-establishment.service.ts');

/** Extracts a frozen `Object.freeze([...] as const)` string vocabulary from the types module. */
function vocabulary(name) {
  const match = types.match(new RegExp(`export const ${name} = Object\\.freeze\\(\\[([\\s\\S]*?)\\] as const\\);`, 'u'));
  assert.ok(match, `${name} is a frozen as-const vocabulary`);
  return [...match[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]);
}

test('the T-03B1a boundary exists, exactly, and is framework-agnostic', () => {
  assert.equal(existsSync(new URL(`${FOCUS_DIR}/`, root)), true);
  const files = listFiles(join(rootPath, FOCUS_DIR)).map((file) => relative(file, join(rootPath, FOCUS_DIR))).sort();
  assert.deepEqual(files, [...PRODUCTION_FILES, ...SPEC_FILES].sort(), 'the directory holds exactly the T-03B1a production files and their suites');
  assert.ok(!files.some((name) => /module|controller|repository|migration|\.sql$/u.test(name)), 'no module, controller, repository or migration file exists here');
  for (const [name, text] of Object.entries(code)) {
    assert.doesNotMatch(text, /@Injectable\(|@Module\(|@Controller\(|@Inject\(|@Global\(|@Get\(|@Post\(|@UseGuards\(/u, `${name} carries no Nest decorator`);
    assert.doesNotMatch(text, /from '@nestjs\//u, `${name} imports nothing from Nest`);
  }
});

test('nothing outside the directory imports it: no ConversationModule, ConversationService, T-03A2 path, app bootstrap', () => {
  const referencing = listFiles(join(rootPath, 'apps/api/src'))
    .map((file) => relative(file))
    .filter((file) => !file.startsWith(`${FOCUS_DIR}/`))
    .filter((file) => /conversational-focus|ConversationalFocusEvaluatorService|FocusResolutionProvider|OpenAiFocusResolutionProvider|validateFocusResolutionProposal/u.test(stripComments(readFileSyncUtf8(file))));
  assert.deepEqual(referencing, [], 'T-03B1a is production-inert: no runtime path reaches it');
  for (const [name, text] of [['ConversationModule', conversationModule], ['ConversationService', conversationService], ['AppModule', appModule], ['the T-03A2 establishment service', establishment]]) {
    assert.doesNotMatch(stripComments(text), /conversational-focus|Focus|focus/u, `${name} is untouched by T-03B1a`);
  }
  // No scripts entry point either.
  const scripts = listFiles(join(rootPath, 'apps/api/scripts')).map((file) => relative(file));
  for (const file of scripts) {
    assert.doesNotMatch(readFileSyncUtf8(file), /conversational-focus/u, `${file} does not invoke the evaluator`);
  }
});

test('the evaluator adds no SQL, no durable write, no durable identity; the durable substrate is migration 0066 alone', () => {
  const migrations = readdirSync(join(rootPath, 'database/migrations')).filter((name) => name.endsWith('.sql')).sort();
  // T-03B1a shipped no migration; T-03B1b1 added exactly 0066 as the durable
  // substrate, and nothing before it carries a T-03B1 token.
  assert.equal(migrations.at(-1), '0066_durable_reference_emerging_focus_sp_substrate_v1.sql', 'the newest migration is the T-03B1b1 substrate');
  for (const name of migrations.filter((candidate) => !candidate.startsWith('0066_'))) {
    assert.doesNotMatch(readFileSyncUtf8(`database/migrations/${name}`), /emerging_focus|reference_handle|conversational_focus|claim_attribution/iu, `${name} carries no T-03B1 substrate`);
  }
  assert.ok(existsSync(new URL('database/verify-migration-0066.mjs', root)), 'the 0066 real-PostgreSQL verifier exists');
  for (const forbidden of ['serviceApi', 'dataApi', 'SupabaseClient', '.rpc(', 'from \'pg\'', 'INSERT INTO', 'UPDATE ', 'CREATE TABLE', 'randomUUID', 'uuidv5', 'crypto', 'fs.', 'writeFile', 'readFile']) {
    assert.equal(allCode.includes(forbidden), false, `the directory must not contain ${forbidden}`);
  }
  // The evaluator allocates no durable identity: the only ids it mints are
  // prepared, batch-local, and visibly prefixed. Durable identity is derived
  // ONLY by the T-03B1b1 canonicalizer, deterministically, from the prepared
  // result - never by the evaluator, never by the provider.
  assert.match(evaluator, /export const PREPARED_ID_PREFIX = 'prepared:';/u);
  assert.doesNotMatch(evaluatorCode, /emergingFocusId|emerging_focus_id|handleId: randomUUID|sessionPosition|session_position|live_head|liveHead|uuidV5/u);
  const canonicalizer = code['durable-focus-canonicalizer.ts'];
  assert.match(canonicalizer, /export function durableReferenceHandleId\(/u);
  assert.match(canonicalizer, /export function durableEmergingFocusId\(/u);
  assert.match(canonicalizer, /if \(JSON\.stringify\(units\)\.includes\(PREPARED_ID_PREFIX\)\) \{\s*throw new FocusCanonicalizationError\('PREPARED_IDENTITY_LEAKED'\);/u,
    'no prepared identity survives into the durable payload');
  assert.doesNotMatch(allCode, /session_position|sessionPosition|same_sp_event_sequence|live_head|liveHead/u,
    'no file in the directory authors SP or the same-SP sequence: those are database allocation results');
});

test('the slice reaches nothing later: no Thread, Home, lifecycle, LF, mobile, Map, Timeline, K/V', () => {
  for (const forbidden of ['ThreadEstablished', 'THREAD_ESTABLISHED', 'threadId', 'Thread(', 'ThreadHome', 'homeSp', 'HOME_SP', 'lifecycle',
    'LIVE_FOCUS', 'liveFocus', 'LiveFocus', 'LIVE_FOCUS_TRANSITION', 'effectiveLF', 'apps/mobile', 'react-native', 'expo-router', '@qandeel/runtime',
    'WORLD_ANCHOR', 'worldAnchor', 'SCALE_INTENT', 'camera', 'MapState', 'timeline', 'Timeline', 'knowledgeFrontier', 'projection', 'sameSpEventSequence',
    'WebSocket', 'EventSource', 'Sse', 'Reading', 'TE-01', 'TE01']) {
    assert.equal(allCode.includes(forbidden), false, `the T-03B1a boundary must not contain ${forbidden}`);
  }
  // Its only non-relative import is the already-installed OpenAI SDK, and its
  // only cross-directory import is the T-03A1 code-point/anchor helper - the
  // pure mapper, never the repository, the commitment service or the provider.
  for (const [name, text] of Object.entries(code)) {
    for (const match of text.matchAll(/from\s+'([^']+)'/gu)) {
      const specifier = match[1];
      if (specifier.startsWith('./')) continue;
      assert.ok(specifier === 'openai' || specifier === '../conversation-unit/cu-anchor-mapper' || specifier === '../runtime-identity/uuid-v5',
        `${name} imports ${specifier}; only ./*, openai, ../conversation-unit/cu-anchor-mapper and the neutral ../runtime-identity/uuid-v5 helper are allowed`);
      if (specifier === '../runtime-identity/uuid-v5') {
        assert.ok(CANONICALIZER_FILES.includes(name), `only the T-03B1b1 canonicalizer derives durable identity; ${name} may not`);
      }
    }
    assert.doesNotMatch(text, /require\(/u, `${name} uses no require()`);
    assert.doesNotMatch(text, /\bimport\(/u, `${name} uses no dynamic import()`);
  }
  assert.doesNotMatch(allCode, /ConversationUnitRepository|ConversationUnitCommitmentService|CuSegmentationProvider|OpenAiCuSegmentationProvider|conversation-unit\.repository|conversation-unit-commitment/u);
  // No mobile file knows this boundary.
  for (const file of listFiles(join(rootPath, 'apps/mobile/src')).map((f) => relative(f))) {
    assert.doesNotMatch(readFileSyncUtf8(file), /conversational-focus|FocusResolution/u, `${file} must not reach the evaluator`);
  }
});

test('the frozen vocabularies are consumed exactly (CU-04/05/06, CU-10, THR-01/02)', () => {
  assert.deepEqual(vocabulary('CONVERSATIONAL_FUNCTIONS'), [
    'INFORM_REPORT', 'ASK', 'REQUEST', 'ACKNOWLEDGE', 'AGREE', 'DISAGREE_CHALLENGE', 'ELABORATE', 'CLARIFY', 'CORRECT', 'RECALL', 'FOCUS_SHIFT', 'FUNCTION_UNRESOLVED',
  ]);
  assert.deepEqual(vocabulary('SEQUENCE_POSITIONS'), ['UNMARKED', 'INITIATING', 'RESPONSIVE', 'FOLLOW_UP']);
  assert.deepEqual(vocabulary('REFERENCE_RESOLUTION_STATES'), ['RESOLVED', 'AMBIGUOUS', 'UNRESOLVED']);
  assert.deepEqual(vocabulary('ATTENTION_KINDS'), ['NO_INDEPENDENT_FOCUS', 'ATTEND_EXISTING_FOCUS', 'START_NEW_FOCUS']);
  assert.deepEqual(vocabulary('CLAIMANT_KINDS'), ['CURRENT_CONVERSATIONAL_SPEAKER', 'REFERENCE_HANDLE', 'NEW_CURRENT_CU_REFERENCE', 'UNRESOLVED']);
  // The provider schema uses those same vocabularies as enums, and nothing wider.
  for (const name of ['CONVERSATIONAL_FUNCTIONS', 'SEQUENCE_POSITIONS', 'REFERENCE_RESOLUTION_STATES', 'CLAIMANT_KINDS', 'CLAIM_FRAMES', 'ATTENTION_KINDS', 'ATTENTION_REASONS']) {
    assert.match(openai, new RegExp(`enum: \\[\\.\\.\\.${name}\\]`, 'u'), `the schema enumerates ${name} verbatim`);
  }
  assert.doesNotMatch(openai, /enum: \[\s*'/u, 'no ad-hoc enum literal exists in the schema');
  // The validator judges cardinality by the three states and never picks a candidate.
  assert.match(validator, /case 'RESOLVED':[\s\S]*case 'AMBIGUOUS':[\s\S]*case 'UNRESOLVED':/u);
  assert.match(validator, /distinct >= 2/u, 'AMBIGUOUS needs at least two distinct allowlisted handles');
  assert.doesNotMatch(validator, /candidateHandleIds\[0\]|candidates\[0\]|\.find\(\(candidate|resolvedHandleId = candidates/u, 'no candidate is ever picked');
  assert.doesNotMatch(allCode, /resolvedHandleId: candidates\[|\.at\(0\)/u);
});

test('the provider schema is strict, closed and structurally incapable of an offset, score, speaker, Thread or LF', async () => {
  assert.match(openai, /type: 'json_schema',\s*name: 'conversational_focus_resolution_v1',\s*strict: true/u);
  const opened = (openai.match(/type: 'object'/gu) ?? []).length;
  const closed = (openai.match(/additionalProperties: false/gu) ?? []).length;
  assert.ok(opened >= 6 && opened === closed, `every schema object (${opened}) is closed (${closed})`);
  assert.match(openai, /required: \['functions', 'sequencePosition', 'targetCuId', 'references', 'claimAttributions', 'attention'\]/u);
  assert.match(openai, /required: \['text', 'occurrence'\]/u, 'an anchor is text + occurrence, nothing else');
  assert.doesNotMatch(openai, /\b(?:start|end|offset|spanStart|spanEnd|score|confidence|probability|weight|speaker|sourceRole|threadId|liveFocus|emergingFocusId):/u,
    'no such key can be authored');
  assert.match(openai, /maximum: maxOccurrenceFor\(request\)/u, 'the occurrence domain is the current CU source');
  assert.match(openai, /return codePointLength\(request\.currentCu\.committedText\);/u);
  assert.match(openai, /store: false/u);
  assert.match(openai, /maxRetries: 0/u);
  assert.match(openai, /new AbortController\(\)/u);
  assert.match(openai, /<conversational_focus_source>/u, 'the request is an untrusted-data envelope');
  assert.match(openai, /catch \{\s*throw new FocusResolutionProviderError\('INVALID_STRUCTURED_OUTPUT'\);\s*\}/u, 'the parser fails closed');
  assert.doesNotMatch(openai, /retry|backoff|fallback|default(?:Proposal|Attention)/iu, 'no hidden retry or guessing fallback');
  // The parser is exported and tested apart from API invocation.
  assert.match(openai, /export function parseFocusResolutionOutput\(/u);
  assert.match(await read(`${FOCUS_DIR}/openai-focus-resolution.provider.spec.ts`), /parseFocusResolutionOutput\(/u);
  // Config is never read at bootstrap: only the explicit environment loader
  // reads the credential, and only `fromEnvironment()` calls the loader.
  const outsideLoader = Object.entries(code).filter(([name]) => name !== 'focus-resolution-provider.config.ts').map(([, text]) => text).join('\n');
  assert.doesNotMatch(outsideLoader, /process\.env\.|OPENAI_API_KEY/u, 'no ambient credential read outside the explicit environment loader');
  assert.equal((allCode.match(/loadFocusResolutionOpenAIConfig\(/gu) ?? []).length, 2, 'declared once, called once (fromEnvironment)');
});

test('the one-CU provider input holds no later CU (§6/§16)', () => {
  // The request type carries exactly ONE current CU, never a batch.
  assert.match(providerTypes, /readonly currentCu: CurrentCuInput;/u);
  assert.doesNotMatch(providerTypes, /currentCus|batch|laterCus|nextCu|followingCus/u);
  assert.match(types, /readonly currentCu: CurrentCuInput;\s*readonly priorContext: PriorContext;/u);
  // The evaluator builds the request from the current CU and the PRIOR context only.
  assert.match(evaluator, /currentCu: input\.currentCu,\s*priorCus: input\.priorContext\.priorCus,\s*referenceHandles: input\.priorContext\.referenceHandles,\s*focusCandidates: input\.priorContext\.focusCandidates,\s*currentFocusCandidateId: input\.priorContext\.currentFocusCandidateId,/u);
  // And refuses hindsight structurally: the current CU or a later CU of its turn in "prior" context.
  assert.match(evaluator, /if \(prior\.cuId === currentCu\.cuId\) throw future\(\);/u);
  assert.match(evaluator, /prior\.sourceTurnId === currentCu\.sourceTurnId && prior\.ordinalWithinTurn >= currentCu\.ordinalWithinTurn\) throw future\(\);/u);
  assert.match(evaluator, /'FUTURE_CONTEXT_FORBIDDEN'/u);
  // FIX-T03B1A-01: prior-grounding CLOSURE. Every handle grounding CU and every
  // focus grounding CU must be in the supplied priorCus, checked before the
  // provider is invoked, and unknown grounding is rejected - never dropped.
  assert.match(evaluator, /const unavailable = \(\) => new FocusEvaluationRejectedError\('PRIOR_GROUNDING_NOT_AVAILABLE'\);/u);
  assert.match(evaluator, /if \(grounding\.cuId === currentCu\.cuId\) throw future\(\);\s*if \(!priorCuIds\.has\(grounding\.cuId\)\) throw unavailable\(\);/u,
    'every reference-handle grounding CU is closed over priorCus');
  assert.match(evaluator, /if \(cuId === currentCu\.cuId\) throw future\(\);\s*if \(!priorCuIds\.has\(cuId\)\) throw unavailable\(\);/u,
    'every focus-candidate grounding CU is closed over priorCus');
  assert.ok(evaluator.indexOf('assertEvaluationInput(input);') < evaluator.indexOf('await this.provider.propose('), 'the boundary gate precedes the provider call');
  assert.doesNotMatch(evaluator, /\.filter\(\(grounding|grounding\.filter\(|priorGroundingCuIds\.filter\(/u, 'unknown grounding is never silently filtered away');
  // The sequential helper calls the one-CU evaluator per CU, in order, threading a transient context.
  assert.match(evaluator, /for \(const currentCu of sequence\) \{\s*const result = await this\.evaluateOne\(\{ sessionId, currentCu, priorContext: context \}\);/u);
  assert.match(evaluator, /export function orderFinalizedExchange\(/u);
  assert.match(evaluator, /return \[\.\.\.\[\.\.\.userCus\]\.sort\(bySource\), \.\.\.\[\.\.\.assistantCus\]\.sort\(bySource\)\];/u, 'USER CUs first, then ASSISTANT CUs');
  assert.doesNotMatch(evaluator, /Promise\.all/u, 'CUs of one sequence are never evaluated concurrently');
});

test('no score, embedding, keyword, frequency or timer shortcut, and no failure-to-no-focus fallback', () => {
  const semantic = [evaluator, validator, mapper, types, providerTypes].join('\n');
  assert.doesNotMatch(semantic, /score|embedding|similarity|cosine|vector|keyword|levenshtein|normalize|toLowerCase|setTimeout|setInterval|Date\.now|new Date/iu);
  assert.doesNotMatch(semantic, /\.length\s*>=?\s*\d+\s*(?:&&|\?|\))[^\n]*(?:START_NEW_FOCUS|ATTEND_EXISTING_FOCUS)/u, 'no mention-count establishes attention');
  assert.match(mapper, /mapAnchorsToSpans\(committedText, \[anchor\], 0\)/u, 'anchors map through the T-03A1 exact code-point mapper');
  assert.doesNotMatch(mapper, /\.indexOf\(|\.includes\(|\.search\(|new RegExp/u, 'no string-index shortcut beside the code-point mapper');
  // A technical failure NEVER becomes an attention value: the evaluator throws
  // a typed rejection and constructs no NO_INDEPENDENT_FOCUS anywhere.
  assert.match(evaluator, /error\.code === 'INVALID_STRUCTURED_OUTPUT' \? 'INVALID_PROVIDER_PAYLOAD' : 'FOCUS_PROVIDER_UNAVAILABLE'/u);
  assert.doesNotMatch(evaluator, /NO_INDEPENDENT_FOCUS|UNRESOLVED_ATTENTION/u, 'the evaluator invents no attention value');
  assert.doesNotMatch(validator, /kind: 'NO_INDEPENDENT_FOCUS'/u, 'the validator invents no attention value');
  assert.match(types, /\| 'PRIOR_GROUNDING_NOT_AVAILABLE'\s*\| 'FOCUS_PROVIDER_UNAVAILABLE'\s*\| 'INVALID_PROVIDER_PAYLOAD'\s*\| 'NON_EXTRACTIVE_REFERENCE'\s*\| 'OCCURRENCE_OUT_OF_RANGE'\s*\| 'UNKNOWN_REFERENCE_HANDLE'\s*\| 'INVALID_REFERENCE_CARDINALITY'\s*\| 'UNKNOWN_FOCUS_CANDIDATE'\s*\| 'UNKNOWN_TARGET_CU'\s*\| 'INVALID_CLAIM_ATTRIBUTION'\s*\| 'FOCUS_GROUNDING_REQUIRED'\s*\| 'UNGROUNDED_FOCUS_CONTINUITY'\s*\| 'EXISTING_FOCUS_CONTINUITY_REQUIRED'/u,
    'the fail-closed taxonomy is explicit');
  // FIX-T03B1A-02: a RESOLVED grounding handle that already grounds a supplied
  // focus candidate cannot start a second focus; a NEW current-CU reference
  // (resolvedHandleId null) is exempt by construction.
  assert.match(validator, /if \(groundedBy\.resolvedHandleId !== null\) \{\s*const represented = groundedBy\.resolvedHandleId;\s*if \(input\.priorContext\.focusCandidates\.some\(\(focus\) => focus\.groundingHandleIds\.includes\(represented\)\)\) \{\s*return reject\('EXISTING_FOCUS_CONTINUITY_REQUIRED'\);/u,
    'START_NEW_FOCUS on an already represented identity is refused');
  assert.doesNotMatch(validator, /referenceHandles\.some\(|handleIds\.has\(represented\)/u, 'handle existence alone is never equated with a focus');
  // The canonical speaker is copied from the committed CU, never from the proposal.
  assert.match(evaluator, /sourceRole: input\.currentCu\.sourceRole,/u);
  assert.doesNotMatch(providerTypes.slice(providerTypes.indexOf('export interface ReferenceResolutionProposal')), /sourceRole|speaker/u,
    'no proposal type carries a speaker');
});

test('the gate is registered at the root and in API CI, and MOB-CI-01 is untouched', () => {
  assert.equal(rootPackage.scripts['test:reference-attention-focus-evaluator-contract'],
    'node --test tests/reference-attention-focus-evaluator-contract.test.mjs');
  assert.match(apiCi, /run: npm run test:reference-attention-focus-evaluator-contract/u);
  assert.equal((apiCi.match(/test:reference-attention-focus-evaluator-contract/gu) ?? []).length, 1);
  assert.ok(apiCi.indexOf('test:reference-attention-focus-evaluator-contract') > apiCi.indexOf('test:session-semantic-clock-sp-lh-delivery-contract'),
    'the contract runs after the T-03A2 static contract');
  assert.ok(apiCi.indexOf('test:reference-attention-focus-evaluator-contract') < apiCi.indexOf('Apply all migrations to fresh PostgreSQL'),
    'the static contract runs before the database bootstrap');
  // The evaluator slice itself has no database verifier; the only focus
  // verifier in CI is the T-03B1b1 substrate verifier for migration 0066.
  assert.doesNotMatch(apiCi, /verify:reference-attention/u, 'no database verifier exists for the evaluator slice');
  assert.equal((apiCi.match(/focus[^\n]*:integration/gu) ?? []).length, 1, 'exactly one focus verifier: the 0066 substrate');
  assert.match(apiCi, /verify:durable-reference-emerging-focus-sp-substrate:integration/u);
  // Mobile CI is not edited: no new step, still the fast gate plus two conditional native jobs.
  assert.doesNotMatch(mobileCi, /reference-attention-focus/u);
  assert.equal((mobileCi.match(/runs-on: /gu) ?? []).length, 3);
  assert.equal((mobileCi.match(/if: needs\.verify-mobile-contracts\.outputs\.native_impact == 'true'/gu) ?? []).length, 2);
  // No new dependency: the adapter reuses the installed OpenAI SDK.
  assert.ok('openai' in apiPackage.dependencies);
  for (const name of ['zod', 'ajv', 'uuid', 'nanoid', '@anthropic-ai/sdk-focus', 'natural', 'compromise', 'franc']) {
    assert.equal(name in (apiPackage.dependencies ?? {}) || name in (apiPackage.devDependencies ?? {}), false, `${name} must not be introduced`);
  }
  assert.deepEqual(Object.keys(rootPackage.devDependencies), ['pg']);
});

function readFileSyncUtf8(path) {
  return readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
}
