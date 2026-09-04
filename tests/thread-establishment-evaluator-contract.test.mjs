// T-03B2a - Thread Establishment Evaluator + Prepared Promotion Evidence: the
// static anti-scope contract.
//
// Secret-free and CI-runnable. Semantic behaviour is proven by the Jest suites
// under apps/api/src/thread-establishment (fake provider, no live call). This
// contract guards the SHAPE of the slice: what exists, that nothing reaches it,
// that it reaches nothing durable, geographic or later (no migration, no Thread
// id allocator, no Home/spatial output, no LF, no lifecycle), the exact frozen
// TE-01/02/03 vocabulary, the strictness of the provider schema, the one-CU
// no-hindsight input boundary, the structural minimum of each evidence path,
// and the absence of every shortcut the frozen grammar forbids (score,
// threshold, frequency, similarity, timer).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const readJson = (path) => JSON.parse(read(path));

/** Executable code only: prose may name a forbidden construct in order to forbid it. */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');

const THREAD_DIR = 'apps/api/src/thread-establishment';
const FOCUS_DIR = 'apps/api/src/conversational-focus';
const PRODUCTION_FILES = [
  'fake-thread-establishment.provider.ts',
  'index.ts',
  'openai-thread-establishment.provider.ts',
  'thread-establishment-evaluator.service.ts',
  'thread-establishment-provider.config.ts',
  'thread-establishment-provider.types.ts',
  'thread-establishment-validator.ts',
  'thread-establishment.types.ts',
];
const SPEC_FILES = [
  'openai-thread-establishment.provider.spec.ts',
  'thread-establishment-evaluator.service.spec.ts',
  'thread-establishment-validator.spec.ts',
];
/** Everything but the OpenAI adapter: the pure semantic surface. */
const SEMANTIC_FILES = PRODUCTION_FILES.filter((name) => name !== 'openai-thread-establishment.provider.ts');

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

const sources = Object.fromEntries(PRODUCTION_FILES.map((name) => [name, read(`${THREAD_DIR}/${name}`)]));
const code = Object.fromEntries(Object.entries(sources).map(([name, text]) => [name, stripComments(text)]));
const allCode = Object.values(code).join('\n');
const semanticCode = SEMANTIC_FILES.map((name) => code[name]).join('\n');
const types = code['thread-establishment.types.ts'];
const providerTypes = code['thread-establishment-provider.types.ts'];
const config = code['thread-establishment-provider.config.ts'];
const validator = code['thread-establishment-validator.ts'];
const evaluator = code['thread-establishment-evaluator.service.ts'];
const openai = code['openai-thread-establishment.provider.ts'];
const evaluatorSpec = read(`${THREAD_DIR}/thread-establishment-evaluator.service.spec.ts`);

const rootPackage = readJson('package.json');
const apiPackage = readJson('apps/api/package.json');
const apiCi = read('.github/workflows/api-ci.yml');
const mobileCi = read('.github/workflows/mobile-ci.yml');
const conversationModule = read('apps/api/src/conversation/conversation.module.ts');
const conversationService = read('apps/api/src/conversation/conversation.service.ts');
const appModule = read('apps/api/src/app.module.ts');
const establishment = read('apps/api/src/conversation-unit/conversation-temporal-establishment.service.ts');
const focusEstablishment = read(`${FOCUS_DIR}/conversation-focus-establishment.service.ts`);
const doc = read('docs/thread-establishment-evaluator-v1.md');
const docsIndex = read('docs/README.md');

/** Extracts a frozen `Object.freeze([...] as const)` string vocabulary from the types module. */
function vocabulary(name) {
  const match = types.match(new RegExp(`export const ${name} = Object\\.freeze\\(\\[([\\s\\S]*?)\\] as const\\);`, 'u'));
  assert.ok(match, `${name} is a frozen as-const vocabulary`);
  return [...match[1].matchAll(/'([A-Z0-9_-]+)'/gu)].map((m) => m[1]);
}

test('the T-03B2a directory exists, exactly, separate from T-03B1, and is framework-agnostic', () => {
  assert.equal(existsSync(new URL(`${THREAD_DIR}/`, root)), true);
  // T-03B2b1 nests the pure Canonical Home Placement Engine in its own
  // subdirectory, guarded by tests/canonical-home-placement-engine-contract.test.mjs.
  // The T-03B2a files themselves stay exactly these, and this index still
  // exports none of the nested slice.
  const entries = readdirSync(join(rootPath, THREAD_DIR), { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.deepEqual(files, [...PRODUCTION_FILES, ...SPEC_FILES].sort(), 'the directory holds exactly the T-03B2a production files and their suites');
  assert.deepEqual(directories, ['home-placement'], 'the only nested slice is T-03B2b1 (canonical Home placement), pinned by its own static contract');
  assert.doesNotMatch(code['index.ts'], /home-placement/u, 'the T-03B2a index does not re-export the nested slice');
  assert.ok(!files.some((name) => /\.module\.|controller|repository|migration|binding|\.sql$/u.test(name)), 'no module, controller, repository, binding or migration file exists here');
  for (const [name, text] of Object.entries(code)) {
    assert.doesNotMatch(text, /@Injectable\(|@Module\(|@Controller\(|@Inject\(|@Global\(|@Get\(|@Post\(|@UseGuards\(/u, `${name} carries no Nest decorator`);
    assert.doesNotMatch(text, /from '@nestjs\//u, `${name} imports nothing from Nest`);
  }
  // The B1 directory is untouched by this slice: T-03B1 stays frozen authority.
  const b1Files = listFiles(join(rootPath, FOCUS_DIR)).map((file) => relative(file, join(rootPath, FOCUS_DIR)));
  assert.ok(!b1Files.some((name) => /thread/iu.test(name)), 'no Thread file was added to the B1 directory');
  for (const file of b1Files) {
    assert.doesNotMatch(stripComments(read(`${FOCUS_DIR}/${file}`)), /thread-establishment|ThreadEstablishment|TE-0[1-3]/u, `${file} knows nothing of T-03B2a`);
  }
});

test('the frozen promotion vocabulary is exactly TE-01 / TE-02 / TE-03, two decisions, three engineering reasons', () => {
  assert.deepEqual(vocabulary('THREAD_ESTABLISHMENT_PATHS'), ['TE-01', 'TE-02', 'TE-03']);
  assert.deepEqual(vocabulary('THREAD_ESTABLISHMENT_DECISIONS'), ['NO_ESTABLISHMENT', 'ESTABLISH_THREAD']);
  assert.deepEqual(vocabulary('NO_ESTABLISHMENT_REASONS'), ['NO_INDEPENDENT_FOCUS', 'ALREADY_ESTABLISHED', 'NO_PROMOTION_PATH_PROVEN']);
  assert.deepEqual(vocabulary('FOCUS_BEARING_ATTENTION_KINDS'), ['START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS']);
  assert.deepEqual(vocabulary('ATTRIBUTED_CLAIM_FRAMES'), ['REPORTED_SPEECH', 'DIRECT_QUOTATION']);
  // No fourth path, no wider Product taxonomy, anywhere in executable code.
  assert.doesNotMatch(allCode, /TE-0[4-9]|TE-[1-9]\d|'TE-0[1-3][a-z]'/u, 'no path beyond the three frozen ones');
  assert.doesNotMatch(allCode, /PARTIAL_ESTABLISHMENT|PROVISIONAL|CANDIDATE_THREAD|WEAK_|STRONG_|LIKELY|MAYBE/u, 'no graded or provisional decision');
  // The provider schema uses those same vocabularies as enums, and nothing wider.
  assert.match(openai, /enum: \[\.\.\.THREAD_ESTABLISHMENT_DECISIONS\]/u);
  assert.match(openai, /enum: \[\.\.\.THREAD_ESTABLISHMENT_PATHS\]/u);
  assert.doesNotMatch(openai, /enum: \[\s*'/u, 'no ad-hoc enum literal exists in the schema');
  // The B1 attention vocabulary is consumed, never re-declared.
  assert.doesNotMatch(allCode, /export const ATTENTION_KINDS|export const ATTENTION_REASONS|export const CLAIM_FRAMES/u);
  assert.match(evaluator, /ATTENTION_REASONS_BY_KIND\[/u, 'history reasons are checked against the frozen per-kind vocabulary');
});

test('no score, probability, threshold, frequency, similarity or timer channel exists (THR-07/THR-22)', () => {
  assert.doesNotMatch(semanticCode, /score|probab|confidence|weight|importance|\brank|similarity|embedding|cosine|vector|keyword|frequency|threshold|levenshtein|normalize|toLowerCase|setTimeout|setInterval|Date\.now|new Date|elapsed|duration/iu);
  // The only numeric comparisons on evidence are the semantic minima "multiple"
  // (two distinct CUs, one prior CU) - never a higher fixed count.
  assert.match(validator, /if \(orderedEvidence\.length < 2 \|\| priorEvidence\.length < 1\) return reject\('INSUFFICIENT_SUSTAINED_EVIDENCE'\);/u);
  assert.match(validator, /if \(priorEvidence\.length < 1\) return reject\('RECURRENCE_NOT_PROVEN'\);/u);
  assert.doesNotMatch(validator, /(?:length|size)\s*(?:>=|>|<|<=)\s*[3-9]\b/u, 'no count threshold above the semantic minimum');
  assert.doesNotMatch(validator, /(?:length|size)\s*(?:>=|>)\s*2\b/u, 'the minimum is expressed as a rejection below two, never as a promotion at or above a count');
  assert.doesNotMatch(allCode, /MIN_[A-Z_]*(?:COUNT|MENTIONS|REPETITIONS|EVIDENCE)|MAX_[A-Z_]*(?:SCORE|WEIGHT)/u);
  // The result and request types carry no score-like or analytical field.
  assert.doesNotMatch(types, /score|confidence|rank|importance|weight|readingCount|unknownCount|evidenceCount|questionCount|hypothesis|timestamp|createdAt|elapsed/iu);
  assert.doesNotMatch(providerTypes, /score|confidence|rank|importance|weight|readingCount|unknownCount|evidenceCount|questionCount|hypothesis|timestamp|createdAt|elapsed|similarity|embedding/iu);
});

test('no Thread id allocator, UUID namespace, Home / spatial output, SP, LF, lifecycle or Reading binding exists (task §0/§3)', () => {
  for (const forbidden of ['randomUUID', 'uuidV5', 'uuid-v5', 'createHash', 'node:crypto', 'NAMESPACE', 'threadId', 'thread_id', 'ThreadId', 'ThreadEstablished', 'THREAD_ESTABLISHED',
    'homeAnchor', 'home_anchor', 'HomeAnchor', 'canonicalSpatial', 'canonical_spatial', 'spatial', 'territory', 'neighborhood', 'placement', 'parentThread', 'originHierarchy',
    'angle', 'distance', 'region', 'coordinate',
    'sessionPosition', 'session_position', 'sameSpEventSequence', 'same_sp_event_sequence', 'liveHead', 'live_head',
    'LIVE_FOCUS', 'liveFocus', 'LiveFocus', 'effectiveLF', 'lifecycle', 'Lifecycle', 'Dormant', 'DORMANT', 'Reopen', 'REOPEN', 'Reading', 'reading_id', 'readingId',
    'knowledgeFrontier', 'timeline', 'Timeline', 'projection', 'WORLD_ANCHOR', 'camera', 'MapState', 'WebSocket', 'EventSource', 'Sse']) {
    assert.equal(allCode.includes(forbidden), false, `the T-03B2a boundary must not contain ${forbidden}`);
  }
  assert.doesNotMatch(allCode, /\bx:\s|\by:\s/u, 'no coordinate literal is authored');
  // The prepared result names the B1 focus identity and nothing durable of its own.
  assert.match(types, /readonly emergingFocusId: string \| null;\s*readonly decision: ThreadEstablishmentDecision;\s*readonly path: ThreadEstablishmentPath \| null;\s*readonly noEstablishmentReason: NoEstablishmentReason \| null;\s*readonly evidenceCuIds: readonly string\[\];\s*readonly explicitSelectionGrounding: MappedAnchor \| null;\s*readonly provenance: ThreadEstablishmentProvenance;\s*\}/u);
  // Prior canonical Thread truth reaches this slice as focus-id MEMBERSHIP only.
  assert.match(types, /readonly priorCus: readonly PriorCuContext\[\];\s*readonly focusAttentionHistory: readonly FocusAttentionHistoryEntry\[\];\s*readonly establishedFocusIds: readonly string\[\];\s*\}/u);
  // Stable identity is recognized by SHAPE only; the pattern derives nothing.
  assert.match(types, /export const STABLE_FOCUS_ID_PATTERN = \/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[1-5\]\[0-9a-f\]\{3\}-\[89ab\]\[0-9a-f\]\{3\}-\[0-9a-f\]\{12\}\$\/u;/u);
  assert.doesNotMatch(allCode, /prepared:|PREPARED_ID_PREFIX/u, 'no prepared identity is minted or accepted as a target');
});

test('no database, Supabase, Nest, runtime, mobile or B1 runtime import; only the pure B1 types and the T-03A1 anchor helper', () => {
  for (const forbidden of ['serviceApi', 'dataApi', 'SupabaseClient', '.rpc(', '.rpc<', "from 'pg'", 'INSERT INTO', 'UPDATE ', 'CREATE TABLE', 'fs.', 'writeFile', 'readFile',
    '@qandeel/runtime', 'apps/mobile', 'react-native', 'expo-router', 'ConversationService', 'ConversationModule', 'ConversationFocusEstablishmentService', 'ConversationFocusRuntimeRepository',
    'ConversationalFocusEvaluatorService', 'FocusResolutionProvider', 'validateFocusResolutionProposal', 'canonicalizePreparedFocusSequence', 'mapFocusAnchor', 'Repository', 'accessToken', 'process.env.']) {
    assert.equal(allCode.includes(forbidden), false, `the T-03B2a boundary must not contain ${forbidden}`);
  }
  for (const [name, text] of Object.entries(code)) {
    for (const match of text.matchAll(/from\s+'([^']+)'/gu)) {
      const specifier = match[1];
      if (specifier.startsWith('./')) continue;
      assert.ok(
        specifier === 'openai' ||
          specifier === '../conversation-unit/cu-anchor-mapper' ||
          specifier === '../conversational-focus/conversational-focus.types' ||
          specifier === '../conversational-focus/durable-focus-payload.types',
        `${name} imports ${specifier}; only ./*, openai, the pure T-03A1 anchor helper and the two B1 type modules are allowed`,
      );
      if (specifier === 'openai') assert.equal(name, 'openai-thread-establishment.provider.ts', 'only the adapter reaches the SDK');
    }
    assert.doesNotMatch(text, /require\(/u, `${name} uses no require()`);
    assert.doesNotMatch(text, /\bimport\(/u, `${name} uses no dynamic import()`);
  }
  // The anchor helper is used for exact mapping and code-point length only.
  assert.match(validator, /import \{ mapAnchorsToSpans \} from '\.\.\/conversation-unit\/cu-anchor-mapper';/u);
  assert.match(validator, /mapAnchorsToSpans\(text, \[anchor\], 0\)/u, 'the selection anchor maps through the T-03A1 exact code-point mapper, alone, frontier 0');
  assert.doesNotMatch(validator, /\.indexOf\(|\.search\(|new RegExp|\.match\(/u, 'no string-index or pattern shortcut beside the code-point mapper');
});

test('nothing reaches the slice: not ConversationModule, ConversationService, AppModule, the T-03A2 or B1 runtime, scripts, database or mobile', () => {
  const referencing = listFiles(join(rootPath, 'apps/api/src'))
    .map((file) => relative(file))
    .filter((file) => !file.startsWith(`${THREAD_DIR}/`))
    .filter((file) => /thread-establishment|ThreadEstablishment|validateThreadEstablishmentProposal|THREAD_ESTABLISHMENT/u.test(stripComments(read(file))));
  assert.deepEqual(referencing, [], 'T-03B2a is production-inert: no runtime path reaches it');
  for (const [name, text] of [['ConversationModule', conversationModule], ['ConversationService', conversationService], ['AppModule', appModule],
    ['the T-03A2 establishment service', establishment], ['the T-03B1b2 focus establishment service', focusEstablishment]]) {
    assert.doesNotMatch(stripComments(text), /thread-establishment|ThreadEstablishment|THREAD_ESTABLISHMENT|TE-0[1-3]/u, `${name} is untouched by T-03B2a`);
  }
  for (const file of [...listFiles(join(rootPath, 'apps/api/scripts')), ...listFiles(join(rootPath, 'apps/mobile/src')), ...listFiles(join(rootPath, 'database'))].map((f) => relative(f))) {
    assert.doesNotMatch(read(file), /thread-establishment|ThreadEstablishment|THREAD_ESTABLISHMENT/u, `${file} does not reach the evaluator`);
  }
});

test('no migration, no Thread row, no service_role grant, no verifier: the durable substrate is untouched by this slice', () => {
  const migrations = readdirSync(join(rootPath, 'database/migrations')).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(!migrations.some((name) => /thread|home|te0|establishment/iu.test(name)), 'no Thread / Home / establishment migration exists');
  for (const name of migrations) {
    assert.doesNotMatch(read(`database/migrations/${name}`), /thread_id|thread_establish|home_anchor|canonical_spatial|ThreadEstablished|conversation_threads|thread_home/iu, `${name} carries no Thread / Home substrate`);
  }
  assert.ok(!existsSync(new URL('database/verify-thread-establishment.mjs', root)));
  assert.doesNotMatch(apiCi, /verify:thread|thread.*:integration/u, 'no database verifier step exists for the evaluator slice');
  assert.doesNotMatch(rootPackage.scripts['verify:foundation-integration-gate'] ?? '', /thread/u);
  assert.ok(!Object.keys(rootPackage.scripts).some((name) => /verify:.*thread/u.test(name)), 'no Thread verifier script');
});

test('the provider request is the one-CU input and nothing wider: no analytical object, count, rank, similarity, Thread, Home, SP or LF channel (task §7)', () => {
  assert.match(providerTypes, /readonly schemaVersion: typeof THREAD_ESTABLISHMENT_SCHEMA_VERSION;\s*readonly currentCu: CurrentCuInput;\s*readonly currentFocusSemantics: CanonicalCuFocusSemanticPayload;\s*readonly priorCus: readonly PriorCuContext\[\];\s*readonly focusAttentionHistory: readonly FocusAttentionHistoryEntry\[\];\s*\}/u,
    'the request interface has exactly five fields');
  assert.doesNotMatch(providerTypes, /establishedFocusIds|currentCus|batch|laterCus|nextCu|followingCus|readings|unknowns|questions|evidence(?:Count|s\b)/u);
  // The evaluator builds the request from exactly those fields.
  assert.match(evaluator, /schemaVersion: THREAD_ESTABLISHMENT_SCHEMA_VERSION,\s*currentCu: input\.currentCu,\s*currentFocusSemantics: input\.currentFocusSemantics,\s*priorCus: input\.priorContext\.priorCus,\s*focusAttentionHistory: input\.priorContext\.focusAttentionHistory,\s*\}\);/u);
  // One history entry is exactly attention kind, reason and stable focus id: no timestamp, no score, no count.
  assert.match(types, /export interface FocusAttentionHistoryEntry \{\s*readonly cuId: string;\s*readonly attentionKind: AttentionKind;\s*readonly attentionReason: AttentionReason;\s*readonly emergingFocusId: string \| null;\s*\}/u);
  // The adapter forwards exactly the request fields inside the untrusted envelope.
  assert.match(openai, /<thread_establishment_source>\$\{escapeData\(\{\s*schemaVersion: request\.schemaVersion,\s*currentCu: request\.currentCu,\s*currentFocusSemantics: request\.currentFocusSemantics,\s*priorCus: request\.priorCus,\s*focusAttentionHistory: request\.focusAttentionHistory,\s*\}\)\}<\/thread_establishment_source>/u);
});

test('the provider schema is strict, closed and structurally incapable of an offset, score, rationale, Thread id, Home or LF (task §8)', () => {
  assert.match(openai, /type: 'json_schema',\s*name: 'thread_establishment_evidence_path_v1',\s*strict: true/u);
  const opened = (openai.match(/type: 'object'/gu) ?? []).length;
  const closed = (openai.match(/additionalProperties: false/gu) ?? []).length;
  assert.ok(opened >= 2 && opened === closed, `every schema object (${opened}) is closed (${closed})`);
  assert.match(openai, /required: \['decision', 'path', 'evidenceCuIds', 'explicitSelectionAnchor'\]/u, 'exactly the four proposal keys');
  assert.match(openai, /required: \['text', 'occurrence'\]/u, 'an anchor is text + occurrence, nothing else');
  assert.doesNotMatch(openai, /\b(?:start|end|offset|spanStart|spanEnd|score|confidence|probability|weight|rank|importance|similarity|rationale|reason|explanation|speaker|sourceRole|threadId|thread_id|homeAnchorId|home_anchor_id|canonicalSpatialAddress|x|y|liveFocus|emergingFocusId):/u,
    'no such key can be authored');
  assert.match(openai, /maximum: maxOccurrenceFor\(request\)/u, 'the occurrence domain is the current CU source');
  assert.match(openai, /return codePointLength\(request\.currentCu\.committedText\);/u);
  assert.match(openai, /maxItems: maxEvidenceFor\(request\)/u, 'the evidence list is bounded by the supplied committed CUs');
  assert.match(openai, /return request\.priorCus\.length \+ 1;/u);
  assert.match(openai, /store: false/u);
  assert.match(openai, /maxRetries: 0/u);
  assert.match(openai, /new AbortController\(\)/u);
  assert.match(openai, /catch \{\s*throw new ThreadEstablishmentProviderError\('INVALID_STRUCTURED_OUTPUT'\);\s*\}/u, 'the parser fails closed');
  assert.doesNotMatch(openai, /retry|backoff|fallback|default(?:Proposal|Decision)/iu, 'no hidden retry or guessing fallback');
  assert.match(openai, /export function parseThreadEstablishmentOutput\(/u);
  assert.match(read(`${THREAD_DIR}/openai-thread-establishment.provider.spec.ts`), /parseThreadEstablishmentOutput\(/u, 'the parser is tested apart from API invocation');
  // Config is never read at bootstrap: only the explicit environment loader
  // reads the credential, and only `fromEnvironment()` calls the loader.
  const outsideLoader = Object.entries(code).filter(([name]) => name !== 'thread-establishment-provider.config.ts').map(([, text]) => text).join('\n');
  assert.doesNotMatch(outsideLoader, /process\.env\.|OPENAI_API_KEY|THREAD_ESTABLISHMENT_PROVIDER\b|THREAD_ESTABLISHMENT_MODEL\b|THREAD_ESTABLISHMENT_TIMEOUT_MS/u, 'no ambient credential or environment read outside the explicit loader');
  assert.equal((allCode.match(/loadThreadEstablishmentOpenAIConfig\(/gu) ?? []).length, 2, 'declared once, called once (fromEnvironment)');
  assert.match(config, /environment\.THREAD_ESTABLISHMENT_PROVIDER/u);
  assert.match(config, /environment\.OPENAI_API_KEY/u);
  assert.match(config, /environment\.THREAD_ESTABLISHMENT_MODEL/u);
  assert.match(config, /environment\.THREAD_ESTABLISHMENT_TIMEOUT_MS/u);
  assert.match(config, /export const DEFAULT_THREAD_ESTABLISHMENT_MODEL = 'gpt-5-mini';/u);
  assert.match(config, /export const THREAD_ESTABLISHMENT_PROMPT_VERSION = 'thread-establishment-evidence-path-v1';/u);
  assert.match(types, /export const THREAD_ESTABLISHMENT_EVALUATOR_VERSION = 'thread-establishment-evaluator-v1';/u);
  assert.match(types, /export const THREAD_ESTABLISHMENT_POLICY_VERSION = 'stage-1.3-thread-establishment-v1';/u);
  assert.match(providerTypes, /export const THREAD_ESTABLISHMENT_SCHEMA_VERSION = 1 as const;/u);
  // Provenance carries evaluator, policy, provider, model, prompt and schema identity only.
  assert.match(types, /export interface ThreadEstablishmentProvenance \{\s*readonly evaluatorVersion: string;\s*readonly policyVersion: string;\s*readonly provider: string;\s*readonly model: string;\s*readonly promptVersion: string;\s*readonly schemaVersion: number;\s*\}/u);
});

test('TE-01 is USER-only, exactly the current CU, extractively grounded, and never inside quoted or reported speech (task §11.3, THR-08/THR-12)', () => {
  assert.match(validator, /if \(input\.currentCu\.sourceRole !== 'USER'\) return reject\('EXPLICIT_SELECTION_ROLE_FORBIDDEN'\);/u);
  assert.match(validator, /if \(evidence\.length !== 1\) return reject\('INVALID_PROMOTION_PATH'\);/u, 'TE-01 evidence is exactly the current CU');
  assert.match(validator, /if \(anchor === null\) return reject\('EXPLICIT_SELECTION_REQUIRED'\);/u);
  assert.match(validator, /const mapped = mapSelectionAnchor\(input\.currentCu\.committedText, anchor\);\s*if \(mapped\.outcome === 'REJECTED'\) return reject\(mapped\.reason\);/u);
  assert.match(validator, /if \(isWhollyAttributed\(mapped\.mapped\.span, input\.currentFocusSemantics\.claim_attributions\)\) return reject\('ATTRIBUTED_SELECTION_FORBIDDEN'\);/u);
  assert.match(validator, /isMember\(ATTRIBUTED_CLAIM_FRAMES, claim\.claim_frame\) && claim\.span_start <= span\.start && span\.end <= claim\.span_end/u,
    'containment is exact code-point containment in a REPORTED_SPEECH / DIRECT_QUOTATION span');
  assert.match(validator, /case 'NON_EXTRACTIVE_ANCHOR':\s*return \{ outcome: 'REJECTED', reason: 'NON_EXTRACTIVE_SELECTION' \};/u);
  assert.match(validator, /case 'AMBIGUOUS_ANCHOR':\s*case 'OCCURRENCE_OUT_OF_RANGE':\s*return \{ outcome: 'REJECTED', reason: 'OCCURRENCE_OUT_OF_RANGE' \};/u);
  // No repetition requirement anywhere on the TE-01 path.
  const te01 = validator.slice(validator.indexOf('function validateExplicitSelection('), validator.indexOf('function validateSustainedEngagement('));
  assert.doesNotMatch(te01, /priorEvidence|focusAttentionHistory|repeat|count/u, 'TE-01 consults no prior repetition');
});

test('TE-02 needs multiple committed CUs bound to the same focus, TE-03 needs prior focus evidence plus intervening committed material and an independent return (task §11.4/§11.5)', () => {
  // Common: the current CU is included, evidence ids are known, distinct and bound to the SAME stable focus.
  assert.match(validator, /if \(!evidence\.includes\(currentCuId\)\) return reject\('CURRENT_CU_EVIDENCE_REQUIRED'\);/u);
  assert.match(validator, /if \(seen\.has\(id\)\) return reject\('DUPLICATE_EVIDENCE_CU', index\);/u);
  assert.match(validator, /if \(!priorPosition\.has\(id\)\) return reject\('UNKNOWN_EVIDENCE_CU', index\);/u, 'a future or invented CU is unknown to the request');
  assert.match(validator, /entry === undefined \|\| !isMember\(FOCUS_BEARING_ATTENTION_KINDS, entry\.attentionKind\) \|\| entry\.emergingFocusId !== target/u,
    'prior evidence must be START/ATTEND of the same target focus');
  assert.match(validator, /return reject\('EVIDENCE_NOT_FOCUS_BOUND', index\);/u);
  assert.match(validator, /if \(target === null\) return reject\('ESTABLISHMENT_WITHOUT_FOCUS'\);/u);
  assert.match(validator, /if \(input\.priorContext\.establishedFocusIds\.includes\(target\)\) return reject\('FOCUS_ALREADY_ESTABLISHED'\);/u);
  // Continuity follows the resolved focus identity, never wording: committed
  // text is read ONLY on the TE-01 path (to map the selection anchor) - never
  // by the common evidence rules, TE-02 or TE-03.
  const common = validator.slice(validator.indexOf('export function validateThreadEstablishmentProposal('), validator.indexOf('switch (path)'));
  const te02 = validator.slice(validator.indexOf('function validateSustainedEngagement('), validator.indexOf('function validateRecurrentAttention('));
  const te03 = validator.slice(validator.indexOf('function validateRecurrentAttention('), validator.indexOf('function hasUserEvidence('));
  const recurrence = validator.slice(validator.indexOf('function hasUserEvidence('), validator.indexOf('function isWhollyAttributed('));
  assert.ok(common.length > 0 && te02.length > 0 && te03.length > 0 && recurrence.length > 0);
  assert.doesNotMatch(common + te02 + te03 + recurrence, /committedText|anchor_text|exactSurface/u, 'no evidence rule outside TE-01 reads committed wording');
  assert.doesNotMatch(te02 + te03 + recurrence, /\.text\b|occurrence/u, 'TE-02 / TE-03 consult no anchor text at all');
  // TE-02 / TE-03 need a USER CU among the evidence (THR-06/THR-13).
  assert.equal((validator.match(/if \(!hasUserEvidence\(input, orderedEvidence\)\) return reject\('USER_EVIDENCE_REQUIRED'\);/gu) ?? []).length, 2);
  // TE-03: recurrence = the LATEST prior same-focus CU (over the FULL supplied
  // history, never the earliest cited evidence) + a departure strictly after it
  // + a current CU that is not a local clarification (FIX-T03B2A-02).
  assert.match(validator, /if \(input\.currentFocusSemantics\.attention\.reason === 'LOCAL_CLARIFICATION_OR_CORRECTION'\) return reject\('RECURRENCE_NOT_PROVEN'\);/u);
  assert.match(validator, /const latest = latestTargetAttention\(priorPosition, historyByCu, target\);\s*if \(latest === null\) return reject\('RECURRENCE_NOT_PROVEN'\);\s*if \(!priorEvidence\.includes\(latest\.cuId\)\) return reject\('RECURRENCE_NOT_PROVEN'\);\s*if \(!hasInterveningCommittedMaterial\(latest\.position, priorPosition, historyByCu, target\)\) return reject\('RECURRENCE_NOT_PROVEN'\);/u,
    'the latest prior target-focus CU must exist, be cited, and be followed by a departure');
  assert.match(validator, /if \(entry === undefined \|\| !isMember\(FOCUS_BEARING_ATTENTION_KINDS, entry\.attentionKind\) \|\| entry\.emergingFocusId !== target\) continue;\s*if \(latest === null \|\| position > latest\.position\) latest = \{ cuId, position \};/u,
    'the boundary is the maximum position over the full history of same-focus attention');
  assert.match(validator, /if \(position <= afterPosition\) continue;\s*const entry = historyByCu\.get\(cuId\);\s*if \(entry === undefined \|\| entry\.emergingFocusId === target\) continue;\s*if \(entry\.attentionReason === 'LOCAL_CLARIFICATION_OR_CORRECTION'\) continue;\s*return true;/u,
    'intervening material is a later committed CU whose KNOWN attention lay elsewhere and was not a local clarification');
  assert.doesNotMatch(validator, /Math\.min\(|Math\.max\(|earliest/u, 'FIX-T03B2A-02: the earliest cited evidence is never recurrence authority');
  assert.doesNotMatch(validator, /hasInterveningCommittedMaterial\(priorEvidence/u, 'the departure search never starts from provider-cited evidence');
  // TE-02 anchors are refused; TE-01 anchors are required.
  assert.equal((validator.match(/if \(anchor !== null\) return reject\('INVALID_PROMOTION_PATH'\);/gu) ?? []).length, 2);
  // NO_ESTABLISHMENT is exactly empty.
  assert.match(validator, /if \(path !== null \|\| evidence\.length !== 0 \|\| anchor !== null\) return reject\('INVALID_PROMOTION_PATH'\);/u);
});

test('the one-CU gates run before the provider; NO_INDEPENDENT_FOCUS and ALREADY_ESTABLISHED short-circuit with zero provider; failures never become NO_ESTABLISHMENT (task §9/§10)', () => {
  const gate = evaluator.indexOf('assertEvaluationInput(input);');
  const noFocus = evaluator.indexOf("if (target === null) return this.noEstablishment(input, null, 'NO_INDEPENDENT_FOCUS');");
  const already = evaluator.indexOf("if (input.priorContext.establishedFocusIds.includes(target)) return this.noEstablishment(input, target, 'ALREADY_ESTABLISHED');");
  const provider = evaluator.indexOf('await this.provider.propose(');
  assert.ok(gate > 0 && noFocus > gate && already > noFocus && provider > already, 'gates -> deterministic NO -> ALREADY_ESTABLISHED -> provider, in that order');
  assert.equal((evaluator.match(/this\.noEstablishment\(/gu) ?? []).length, 2, 'exactly the two deterministic pre-provider outcomes construct NO_ESTABLISHMENT');
  assert.equal(evaluator.indexOf("noEstablishmentReason: 'NO_PROMOTION_PATH_PROVEN'"), -1, 'the evaluator never invents the provider\'s truthful NO');
  assert.match(validator, /noEstablishmentReason: 'NO_PROMOTION_PATH_PROVEN'/u, 'the provider\'s NO is validated, not synthesized');
  // Technical failure is a typed rejection, never a decision.
  assert.match(evaluator, /error\.code === 'INVALID_STRUCTURED_OUTPUT' \? 'INVALID_PROVIDER_PAYLOAD' : 'THREAD_PROVIDER_UNAVAILABLE'/u);
  assert.match(evaluator, /if \(validated\.outcome === 'REJECTED'\) throw new ThreadEstablishmentRejectedError\(validated\.reason, validated\.index\);/u);
  // The input gates (task §10 items 1-7).
  assert.match(evaluator, /if \(semantics\.unit_id !== currentCu\.cuId\) throw new ThreadEstablishmentRejectedError\('FOCUS_SEMANTICS_MISMATCH'\);/u);
  assert.match(evaluator, /if \(prior\.cuId === currentCu\.cuId\) throw future\(\);/u);
  // FIX-T03B2A-01/03: within the current source turn an EARLIER committed CU is
  // legitimate; the current ordinal or a later one is hindsight; a different
  // source role in the same turn is malformed source truth.
  assert.match(evaluator, /if \(prior\.sourceTurnId === currentCu\.sourceTurnId\) \{\s*if \(prior\.ordinalWithinTurn >= currentCu\.ordinalWithinTurn\) throw future\(\);\s*if \(prior\.sourceRole !== currentCu\.sourceRole\) throw invalid\(\);\s*\}/u);
  assert.match(evaluator, /currentTurnRole = prior\.sourceRole;\s*lastOrdinal = -1;\s*\} else if \(prior\.sourceRole !== currentTurnRole\) \{\s*throw invalid\(\);\s*\}/u, 'one prior source turn, one canonical source role');
  assert.match(evaluator, /if \(entry\.cuId === currentCu\.cuId\) throw future\(\);\s*if \(!priorCuIds\.has\(entry\.cuId\)\) throw unavailable\(\);/u, 'every history CU is closed over priorCus');
  assert.match(evaluator, /const unavailable = \(\) => new ThreadEstablishmentRejectedError\('PRIOR_EVIDENCE_NOT_AVAILABLE'\);/u);
  assert.match(evaluator, /if \(prior\.ordinalWithinTurn <= lastOrdinal\) throw invalid\(\);/u, 'prior CUs are ordered');
  assert.match(evaluator, /if \(!isMember\(ATTENTION_KINDS, entry\.attentionKind\) \|\| !isMember\(ATTENTION_REASONS_BY_KIND\[entry\.attentionKind\], entry\.attentionReason\)\)/u, 'exact frozen B1 attention vocabulary');
  assert.match(evaluator, /\} else if \(!isStableFocusId\(entry\.emergingFocusId\)\) \{\s*throw invalidHistory\(\);/u, 'every focus-bearing history id is a stable identity');
  assert.match(evaluator, /if \(!isStableFocusId\(focusId\) \|\| established\.has\(focusId\)\) throw invalid\(\);/u);
  assert.doesNotMatch(evaluator, /\.filter\(\(entry|focusAttentionHistory\.filter\(|priorCus\.filter\(/u, 'malformed context is never silently filtered away');
  // The evaluator manufactures no identity: the target is B1's, by shape only.
  assert.match(validator, /export function establishmentTarget\(semantics: CanonicalCuFocusSemanticPayload\): string \| null \{\s*const \{ attention \} = semantics;\s*if \(!isMember\(FOCUS_BEARING_ATTENTION_KINDS, attention\.kind\)\) return null;\s*const id = attention\.emerging_focus_id;\s*return typeof id === 'string' && STABLE_FOCUS_ID_PATTERN\.test\(id\) \? id : null;/u);
  assert.doesNotMatch(evaluator, /committedText\.includes|committedText\.match|committedText\.indexOf/u, 'no lexical inspection overrides B1');
  // The canonical speaker is copied from the committed CU, never from the proposal.
  assert.match(evaluator, /sourceRole: input\.currentCu\.sourceRole,/u);
  assert.doesNotMatch(providerTypes.slice(providerTypes.indexOf('export interface ThreadEstablishmentProposal')), /sourceRole|speaker|emergingFocusId|focusId/u, 'the proposal carries no speaker and no focus identity');
});

test('the sequential helper is no-hindsight: prior context grows only AFTER each CU, USER before ASSISTANT, no concurrency (task §12)', () => {
  const loop = evaluator.indexOf('for (const { cu: currentCu, focusSemantics } of sequence) {');
  const evaluate = evaluator.indexOf('const result = await this.evaluateOne({ sessionId, currentCu, currentFocusSemantics: focusSemantics, priorContext: context });');
  const append = evaluator.indexOf('context = {');
  const grow = evaluator.indexOf('priorCus: [...context.priorCus, priorCu],');
  assert.ok(loop > 0 && evaluate > loop && append > evaluate && grow > append, 'each CU is evaluated with the context as it stood BEFORE it, then appended');
  assert.match(evaluator, /focusAttentionHistory: \[\.\.\.context\.focusAttentionHistory, attention\],\s*establishedFocusIds,\s*\};/u);
  assert.match(evaluator, /if \(result\.decision === 'ESTABLISH_THREAD' && result\.emergingFocusId !== null\) \{\s*establishedInSequence\.push\(result\.emergingFocusId\);\s*establishedFocusIds = \[\.\.\.establishedFocusIds, result\.emergingFocusId\];/u,
    'an establishing CU adds its focus to the in-memory set so later same-focus CUs short-circuit');
  assert.match(evaluator, /if \(cu\.sourceRole === 'ASSISTANT'\) assistantSeen = true;\s*else if \(assistantSeen\) throw new ThreadEstablishmentRejectedError\('FUTURE_CONTEXT_FORBIDDEN'\);/u, 'no assistant CU precedes a USER CU');
  // FIX-T03B2A-03: one sequence source turn, one canonical source role.
  assert.match(evaluator, /currentTurnRole = cu\.sourceRole;\s*lastOrdinal = -1;\s*\} else if \(cu\.sourceRole !== currentTurnRole\) \{/u, 'a mixed-role sequence turn is refused');
  // FIX-T03B2A-01: ordinal-aware same-turn history. An earlier committed CU of
  // a sequence turn is legitimate prior context; the first sequence ordinal or
  // a later one is hindsight; a same-turn role mismatch is malformed; and no
  // blanket same-turn rejection exists any more.
  assert.doesNotMatch(evaluator, /turnIds\.has\(/u, 'no blanket rejection of every prior CU sharing a sequence turn');
  assert.match(evaluator, /turnBoundaries\.set\(cu\.sourceTurnId, \{ firstOrdinal: cu\.ordinalWithinTurn, sourceRole: cu\.sourceRole \}\);/u);
  assert.match(evaluator, /if \(cuIds\.has\(prior\.cuId\)\) throw new ThreadEstablishmentRejectedError\('FUTURE_CONTEXT_FORBIDDEN'\);\s*const boundary = turnBoundaries\.get\(prior\.sourceTurnId\);\s*if \(boundary === undefined\) continue;\s*if \(prior\.ordinalWithinTurn >= boundary\.firstOrdinal\) throw new ThreadEstablishmentRejectedError\('FUTURE_CONTEXT_FORBIDDEN'\);\s*if \(prior\.sourceRole !== boundary\.sourceRole\) throw new ThreadEstablishmentRejectedError\('INVALID_EVALUATION_INPUT'\);/u,
    'same-turn prior CUs are judged by ordinal and role; different turns are left to the T-03B2b SP-native order');
  assert.doesNotMatch(evaluator, /sessionPosition|session_position|\bsp\b/u, 'no SP was added to the boundary to fake global chronology');
  assert.doesNotMatch(evaluator, /Promise\.all/u, 'CUs of one sequence are never evaluated concurrently');
  assert.doesNotMatch(evaluator, /sequence\[[^\]]*\+\s*1\]|sequence\.slice\(/u, 'no look-ahead into later CUs');
  // The fixtures exercise the frozen example and the short-circuit with the fake provider.
  assert.match(evaluatorSpec, /عايز نتكلم عن أحمد تحديدًا/u, 'the frozen THR-08 example is a fixture');
  assert.match(evaluatorSpec, /ALREADY_ESTABLISHED/u);
  assert.match(evaluatorSpec, /ATTRIBUTED_SELECTION_FORBIDDEN/u);
  assert.match(evaluatorSpec, /USER_EVIDENCE_REQUIRED/u);
  assert.match(evaluatorSpec, /RECURRENCE_NOT_PROVEN/u);
  assert.match(evaluatorSpec, /expect\(provider\.requests\)\.toHaveLength\(0\)/u, 'zero-provider short-circuits are proven from what the provider saw');
  assert.match(evaluatorSpec, /FIX-01 \(1\/2\/7\)[\s\S]*FIX-01 \(3\/4\/5\)[\s\S]*FIX-01 \(6\)[\s\S]*FIX-02: TE-03 recurrence[\s\S]*FIX-03: one source turn/u, 'the Targeted Fix R1 proofs exist');
  assert.match(doc, /T-03B2b\s+MUST construct:/u, 'the global-chronology handoff is documented exactly');
  assert.doesNotMatch(evaluatorSpec, /OPENAI_API_KEY|fromEnvironment\(|new OpenAI/u, 'no live provider in the evaluator suite');
});

test('the gate is registered at the root and in API CI after the B1 contracts, MOB-CI-01 is untouched, no new dependency, docs indexed', () => {
  assert.equal(rootPackage.scripts['test:thread-establishment-evaluator-contract'], 'node --test tests/thread-establishment-evaluator-contract.test.mjs');
  assert.match(apiCi, /run: npm run test:thread-establishment-evaluator-contract/u);
  assert.equal((apiCi.match(/test:thread-establishment-evaluator-contract/gu) ?? []).length, 1);
  assert.ok(apiCi.indexOf('test:thread-establishment-evaluator-contract') > apiCi.indexOf('test:conversation-focus-runtime-integration-readiness-contract'), 'runs after the T-03B1b2 static contract');
  assert.ok(apiCi.indexOf('test:thread-establishment-evaluator-contract') < apiCi.indexOf('Apply all migrations to fresh PostgreSQL'), 'runs before the database bootstrap');
  assert.doesNotMatch(mobileCi, /thread/u);
  assert.equal((mobileCi.match(/runs-on: /gu) ?? []).length, 3);
  assert.equal((mobileCi.match(/if: needs\.verify-mobile-contracts\.outputs\.native_impact == 'true'/gu) ?? []).length, 2);
  assert.ok('openai' in apiPackage.dependencies);
  for (const name of ['zod', 'ajv', 'uuid', 'nanoid', 'natural', 'compromise', 'franc', 'p-retry', 'retry']) {
    assert.equal(name in (apiPackage.dependencies ?? {}) || name in (apiPackage.devDependencies ?? {}), false, `${name} must not be introduced`);
  }
  assert.deepEqual(Object.keys(rootPackage.devDependencies), ['pg']);
  // Documentation.
  assert.match(doc, /production-inert/u);
  assert.match(doc, /TE-01[\s\S]*TE-02[\s\S]*TE-03/u);
  assert.match(doc, /T-03B2b/u);
  assert.match(doc, /no Thread id/iu);
  assert.match(docsIndex, /\(thread-establishment-evaluator-v1\.md\)/u);
});
