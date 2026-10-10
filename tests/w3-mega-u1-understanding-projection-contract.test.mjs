import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

// W3-MEGA-U U1 — «فهم قنديل» / QANDEEL Understanding Projection Authority (E2E-D-14 server half). Static contract.
//
// Every guard below is a DETECTOR run twice: once on the shipped source (it must pass) and once on the same source
// with one planted defect (it must fail). A detector that cannot fail proves nothing.

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const DIR = 'apps/api/src/understanding';
const FILES = {
  types: `${DIR}/understanding.types.ts`,
  projection: `${DIR}/understanding-projection.ts`,
  service: `${DIR}/understanding.service.ts`,
  repository: `${DIR}/understanding.repository.ts`,
  controller: `${DIR}/understanding.controller.ts`,
  module: `${DIR}/understanding.module.ts`,
};
const src = Object.fromEntries(Object.entries(FILES).map(([key, path]) => [key, read(path)]));
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`])\/\/.*$/gmu, '$1');
const code = Object.fromEntries(Object.entries(src).map(([key, text]) => [key, stripComments(text)]));
const plant = (key, from, to) => {
  assert.ok(code[key].includes(from), `planting anchor missing in ${key}: ${from}`);
  return { ...code, [key]: code[key].replace(from, to) };
};

// The one exact Product shape of a summary and a detail. A new key needs a new Product decision. U3 added exactly one,
// `underReview` — P1 §11.4's own Contested / Under Review state, a boolean, never a score. INTEL-TM-01 added exactly one
// more under its Product decision (Controlled Change CC-2, Implementation Task Contract 2026-10-10): `evidenceChange`, a
// three-value state (NONE / REVIEW_PENDING / NO_REMAINING_SUPPORT) beside the four confidence states, never a fifth one.
const SUMMARY_FIELDS = ['confidence', 'evidenceChange', 'ref', 'revision', 'summary', 'theme', 'underReview'];
const DETAIL_FIELDS = [...SUMMARY_FIELDS, 'alternatives', 'contradictions', 'evidence', 'evolution', 'unresolved'].sort();
function interfaceFields(text, name) {
  const match = text.match(new RegExp(`export interface ${name}(?: extends (\\w+))? \\{([\\s\\S]*?)\\n\\}`, 'u'));
  if (!match) return null;
  const own = [...match[2].matchAll(/^\s*readonly (\w+)\??:/gmu)].map((entry) => entry[1]);
  return match[1] ? [...interfaceFields(text, match[1]), ...own].sort() : own.sort();
}

// ---------------------------------------------------------------------------------------------------------------
// Detectors. Each returns a list of violations (empty = compliant).

function outboundShapeViolations(world) {
  const out = [];
  const summary = interfaceFields(world.types, 'UnderstandingItemSummary');
  const detail = interfaceFields(world.types, 'UnderstandingItemDetail');
  if (JSON.stringify(summary) !== JSON.stringify(SUMMARY_FIELDS)) out.push(`summary fields ${summary}`);
  if (JSON.stringify(detail) !== JSON.stringify(DETAIL_FIELDS)) out.push(`detail fields ${detail}`);
  if (!/const SUMMARY_KEYS = \['confidence', 'evidenceChange', 'ref', 'revision', 'summary', 'theme', 'underReview'\];/u.test(world.projection)) out.push('the audit key list drifted');
  return out;
}

function numericConfidenceViolations(world) {
  const out = [];
  const all = [world.types, world.projection, world.service].join('\n');
  if (/\b(?:percent|percentage|probability|numericScore|confidenceScore|score|band|weight)\??\s*:/iu.test(world.types)) out.push('a numeric-confidence field in the Product types');
  // numeric_score / confidence_band may only ever be compared against null (fail-closed validation).
  for (const match of all.matchAll(/\.(numeric_score|confidence_band)\b(?!\s*!==\s*null)/gu)) out.push(`reads ${match[1]} as a value`);
  if (/:\s*number\b/u.test(world.types.replace(/export const [^;]+;/gu, ''))) out.push('a number-typed Product field');
  return out;
}

function rawHypothesisViolations(world) {
  const out = [];
  // Spreading a whole runtime object (not an array copy of one of its fields) would widen the Product shape.
  if (/\.\.\.\s*(?:hypothesis|value|candidate|evaluation|row)\b(?!\.)/u.test(world.service)) out.push('spreads a runtime object into the view');
  const summaryLiteral = world.service.match(/private summary\([\s\S]*?return \{([\s\S]*?)\n    \};/u);
  if (!summaryLiteral) out.push('summary literal not found');
  else {
    const keys = [...summaryLiteral[1].matchAll(/^\s{6}(\w+):/gmu)].map((entry) => entry[1]).sort();
    if (JSON.stringify(keys) !== JSON.stringify(SUMMARY_FIELDS)) out.push(`summary literal keys ${keys}`);
  }
  for (const internal of ['scope', 'origin', 'disconfirming_conditions', 'type:', 'status:', 'version:']) {
    const view = world.service.match(/const view: UnderstandingItemDetail = \{([\s\S]*?)\n      \};/u)?.[1] ?? '';
    if (view.includes(internal)) out.push(`detail view carries ${internal}`);
  }
  return out;
}

function internalIdViolations(world) {
  const out = [];
  if (!/ref: understandingItemRef\(userId, hypothesis\.id\)/u.test(world.service)) out.push('ref is not the opaque token');
  if (!/revision: understandingRevision\(userId, hypothesis\.id, hypothesis\.version\)/u.test(world.service)) out.push('revision is not the opaque token');
  if (/\b(?:id|hypothesisId|evidenceId|userId|user_id)\??\s*:/u.test(world.types.replace(/export class[\s\S]*$/u, ''))) out.push('an identifier field in the Product types');
  if (!/createHash\('sha256'\)/u.test(world.projection)) out.push('tokens are not one-way');
  return out;
}

function chainOfThoughtViolations(world) {
  const out = [];
  const all = Object.values(world).join('\n');
  if (/\b(?:rationale|reasoning|thought|chainOfThought|scratchpad|deliberation|prompt)\??\s*:/iu.test(all)) out.push('a reasoning field');
  if (/model-router|ModelRouter|providers\/|generateContent|anthropic|openai/iu.test(all)) out.push('a provider or Model Router dependency in a deterministic projection');
  return out;
}

function identityViolations(world) {
  const out = [];
  if (!/@Controller\('understanding'\)\n@UseGuards\(SupabaseAuthGuard\)/u.test(world.controller)) out.push('routes are not guarded at the class');
  if (/@(?:Query|Body|Param|Headers)\(\s*'(?:userId|user_id|owner|ownerId)'\s*\)/u.test(world.controller)) out.push('a client-supplied identity');
  // Every route handler takes its identity from the verified token, once. (U2 added the discussion routes.)
  const handlers = (world.controller.match(/@(?:Get|Post|Put|Patch|Delete)\(/gu) ?? []).length;
  if (handlers === 0 || (world.controller.match(/const \{ userId, accessToken \} = request\.authenticatedUser;/gu) ?? []).length !== handlers) out.push('identity does not come only from the verified token');
  if (!/key !== 'limit'/u.test(world.service)) out.push('unknown query keys (e.g. a user id) are not refused');
  return out;
}

function crossUserViolations(world) {
  const out = [];
  if (!/value\.user_id !== userId\) this\.reject\(\)/u.test(world.service)) out.push('no defensive owner check on Hypothesis rows');
  if (!/value\.user_id !== userId \|\| value\.target_type !== 'HYPOTHESIS'/u.test(world.service)) out.push('no owner check on Confidence rows');
  if (!/surfaced\.find\(\(value\) => understandingItemRef\(userId, value\.id\) === ref\)/u.test(world.service)) out.push('a detail is not resolved among the caller’s own items');
  // Every table read the repository builds is filtered by the caller (U3 added the contest read).
  const queries = world.repository.split('new URLSearchParams({').slice(1);
  if (queries.length === 0 || queries.some((query) => !/^[^}]*user_id: `eq\.\$\{userId\}`/u.test(query))) out.push('an evolution read is not filtered by the caller');
  if (/ServiceRole|SUPABASE_SERVICE_ROLE_KEY|serverAuthority/u.test(Object.values(world).join('\n'))) out.push('a service-role channel');
  return out;
}

function memoryConfidenceViolations(world) {
  const out = [];
  // EvidenceItem.confidence is Memory EXTRACTION confidence and .importance is utility metadata. Neither is truth.
  if (/\bitem\.(?:confidence|importance)\b|\.importance\b|evidenceKind|memoryType/u.test(world.service)) out.push('Memory extraction confidence / importance reaches the projection');
  if (!/new Map\(eligible\.map\(\(item\) => \[item\.evidenceId, item\.statement\]\)\)/u.test(world.service)) out.push('the Evidence map carries more than the statement');
  return out;
}

function himViolations(world) {
  const all = Object.values(world).join('\n');
  return /human-model|\bHim[A-Z]|\bhim_|himContext|metricKey/u.test(all) ? ['HIM reaches the Understanding projection'] : [];
}

function taxonomyViolations(world) {
  const out = [];
  if (/\b(?:tabs|categories|sections)\??\s*:/u.test(world.types + world.service)) out.push('a taxonomy container');
  if (!/theme: THEME_BY_DOMAIN\[hypothesis\.domain\] \?\? this\.reject\(\)/u.test(world.service)) out.push('a theme not derived from an existing item');
  if (/UNDERSTANDING_THEMES\.map|for \(const theme of UNDERSTANDING_THEMES/u.test(world.service)) out.push('iterates the theme taxonomy to build the view');
  return out;
}

function staleVersionViolations(world) {
  const out = [];
  if (!/this\.confidence\.listExactVersionsForTargets\(token, userId, surfaced\.map\(\(\{ id, version \}\) => \(\{ id, version \}\)\)\)/u.test(world.service)) out.push('Confidence is not read for the exact current versions');
  if (/listForTarget|listHistory/u.test(world.service)) out.push('reads Confidence history (an older version could be substituted)');
  if (!/value\.target_version !== target\.version/u.test(world.service)) out.push('an exact-version mismatch is not refused');
  if (!/context\.exactVersion\.get\(hypothesis\.id\) \?\? null/u.test(world.service)) out.push('absence of an exact-version record is not null');
  return out;
}

function inventedDefaultViolations(world) {
  const out = [];
  const body = world.projection.match(/export function projectUnderstandingConfidence[\s\S]*?\n\}/u)?.[0] ?? '';
  if (!/if \(record === null\) return 'NEEDS_MORE';/u.test(body)) out.push('an uncalibrated / unevaluated item is not NEEDS_MORE');
  if (!/return 'NEEDS_MORE';\n\}$/u.test(body)) out.push('the fall-through is not the most conservative state');
  if ((body.match(/return 'CLEAR'/gu) ?? []).length !== 1) out.push('more than one path to CLEAR');
  if (/\?\?\s*'(?:CLEAR|TAKING_SHAPE|MIXED)'|default:\s*return\s*'(?:CLEAR|TAKING_SHAPE)'/u.test(Object.values(world).join('\n'))) out.push('an invented default state');
  if (!/export const UNDERSTANDING_CONFIDENCE_STATES = \['CLEAR', 'TAKING_SHAPE', 'MIXED', 'NEEDS_MORE'\] as const;/u.test(world.types)) out.push('the four-state vocabulary drifted');
  return out;
}

const DETECTORS = {
  outboundShapeViolations, numericConfidenceViolations, rawHypothesisViolations, internalIdViolations,
  chainOfThoughtViolations, identityViolations, crossUserViolations, memoryConfidenceViolations, himViolations,
  taxonomyViolations, staleVersionViolations, inventedDefaultViolations,
};

test('every Understanding source exists and the module is composed by the application root, not the Conversation', () => {
  for (const path of Object.values(FILES)) assert.equal(existsSync(new URL(path, root)), true, path);
  assert.deepEqual(readdirSync(new URL(DIR, root)).filter((name) => !name.endsWith('.spec.ts')).sort(),
    Object.values(FILES).map((path) => path.split('/').pop()).sort(), 'no unreviewed production file in the module');
  assert.match(read('apps/api/src/app.module.ts'), /imports: \[[^\]]*, AccountModule, UnderstandingModule\]/u);
  assert.doesNotMatch(read('apps/api/src/conversation/conversation.module.ts'), /Understanding/u);
  // PROD-OPS-01 admits exactly the content-free telemetry module, for the Confidence re-evaluation's visibility.
  assert.match(code.module, /imports: \[MemoryModule, HypothesisModule, ObservabilityModule\]/u);
});

test('the shipped projection is clean under every detector', () => {
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(code), [], name);
});

// The planted defects the task names, one per required rejection, plus the neighbours they imply.
const PLANTED = [
  ['numeric confidence exposure', 'numericConfidenceViolations', () => plant('types', 'readonly confidence: UnderstandingConfidenceState;', 'readonly confidence: UnderstandingConfidenceState;\n  readonly numericScore: number;')],
  ['numeric score read as a value', 'numericConfidenceViolations', () => plant('service', 'confidence: projectUnderstandingConfidence({', 'score: evaluation.numeric_score, confidence: projectUnderstandingConfidence({')],
  ['raw hypothesis object exposure', 'rawHypothesisViolations', () => plant('service', 'const view: UnderstandingItemDetail = {', 'const view: UnderstandingItemDetail = {\n        ...hypothesis,')],
  ['raw internal status in the summary', 'rawHypothesisViolations', () => plant('service', "      theme: THEME_BY_DOMAIN", "      status: hypothesis.status,\n      theme: THEME_BY_DOMAIN")],
  ['raw internal id as the ref', 'internalIdViolations', () => plant('service', 'ref: understandingItemRef(userId, hypothesis.id)', 'ref: hypothesis.id')],
  ['an id field in the Product types', 'internalIdViolations', () => plant('types', 'readonly ref: string;', 'readonly ref: string;\n  readonly hypothesisId: string;')],
  ['hidden chain-of-thought field', 'chainOfThoughtViolations', () => plant('types', 'readonly unresolved: readonly string[];', 'readonly unresolved: readonly string[];\n  readonly reasoning: string;')],
  ['a provider-written explanation', 'chainOfThoughtViolations', () => plant('service', "import { EvidenceService } from '../memory/evidence.service';", "import { EvidenceService } from '../memory/evidence.service';\nimport { ModelRouterService } from '../model-router/model-router.service';")],
  ['cross-user read (owner check removed)', 'crossUserViolations', () => plant('service', 'if (!value || value.user_id !== userId) this.reject();', 'if (!value) this.reject();')],
  ['cross-user read (service role)', 'crossUserViolations', () => plant('repository', 'constructor(private readonly dataApi: MemoryDataApiService) {}', 'constructor(private readonly dataApi: MemoryDataApiService, private readonly serverAuthority: HypothesisServiceRoleApiService) {}')],
  ['client-supplied user id', 'identityViolations', () => plant('controller', "list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {", "list(@Req() request: AuthenticatedRequest, @Query('userId') query: unknown) {")],
  ['unknown query keys accepted', 'identityViolations', () => plant('service', "key !== 'limit'", "key === '__never__'")],
  ['Memory extraction confidence shown as truth confidence', 'memoryConfidenceViolations', () => plant('service', 'eligible.map((item) => [item.evidenceId, item.statement])', 'eligible.map((item) => [item.evidenceId, `${item.statement} (${item.confidence})`])')],
  ['unsupported HIM metric exposure', 'himViolations', () => plant('service', "import { EvidenceService } from '../memory/evidence.service';", "import { EvidenceService } from '../memory/evidence.service';\nimport { HimSnapshotService } from '../human-model/him-snapshot.service';")],
  ['empty taxonomy tabs', 'taxonomyViolations', () => plant('types', 'readonly items: readonly UnderstandingItemSummary[];', 'readonly items: readonly UnderstandingItemSummary[];\n  readonly tabs: readonly UnderstandingTheme[];')],
  ['stale-version Confidence silently substituted', 'staleVersionViolations', () => plant('service', 'value.target_version !== target.version ||', '')],
  ['Confidence history read instead of the exact version', 'staleVersionViolations', () => plant('service', 'this.confidence.listExactVersionsForTargets(token, userId, surfaced.map(({ id, version }) => ({ id, version })))', 'this.confidence.listForTarget(token, userId, surfaced[0].id)')],
  ['invented default for an unknown / uncalibrated state', 'inventedDefaultViolations', () => plant('projection', "if (record === null) return 'NEEDS_MORE';", "if (record === null) return 'TAKING_SHAPE';")],
  ['an invented optimistic fall-through', 'inventedDefaultViolations', () => plant('projection', "  return 'NEEDS_MORE';\n}", "  return 'TAKING_SHAPE';\n}")],
  ['a second path to Clear', 'inventedDefaultViolations', () => plant('projection', "if (facts.status === 'ACTIVE' || facts.status === 'SUPPORTED') return 'TAKING_SHAPE';", "if (facts.status === 'ACTIVE') return 'CLEAR';\n  if (facts.status === 'ACTIVE' || facts.status === 'SUPPORTED') return 'TAKING_SHAPE';")],
  ['a widened outbound shape', 'outboundShapeViolations', () => plant('types', 'readonly summary: string | null;', 'readonly summary: string | null;\n  readonly explanation: string;')],
];

for (const [name, detector, world] of PLANTED) {
  test(`planted defect is rejected: ${name}`, () => {
    assert.notDeepEqual(DETECTORS[detector](world()), [], `${detector} missed: ${name}`);
  });
}

test('the confidence vocabulary is the approved P4-C4 / P4-C3R set, and nothing numeric is ever named Confidence', () => {
  const registry = JSON.parse(read('docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/data/COPY_REGISTRY.json'));
  const row = (key) => registry.rows.find((entry) => entry.k === key);
  assert.deepEqual(['confClear', 'confForming', 'confMixed', 'confMore'].map((key) => [row(key).ar, row(key).en]),
    [['واضح', 'Clear'], ['يتشكّل', 'Taking shape'], ['يوجد تعارض', 'Mixed'], ['يحتاج سياقًا أكثر', 'Needs more to go on']]);
  assert.match(read('docs/canonical-authority/final-product-experience/p4/QANDEEL_P4C4_FINAL_COPY_PRODUCT_OWNER_APPROVALS_v1.0.md'),
    /- `confClear`\n- `confForming`\n- `confMore`\n- `confName`/u);
  // The runtime remains uncalibrated: both fields are database-constrained to NULL.
  assert.match(read('docs/confidence-runtime-v1.md'), /Both fields are database-constrained to `NULL`/u);
});

test('the contract is registered in package scripts and API CI', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:w3-mega-u1-understanding-projection-contract'], 'node --test tests/w3-mega-u1-understanding-projection-contract.test.mjs');
  assert.match(read('.github/workflows/api-ci.yml'), /run: npm run test:w3-mega-u1-understanding-projection-contract\}/u);
});
