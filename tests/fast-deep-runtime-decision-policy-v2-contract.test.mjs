import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// QIR-002 FAST / DEEP Runtime Decision Policy v2 static contract.
//
// This guard freezes the routing DECISION LAW that QIR-002 establishes: the
// policy version, the exact five v2 reasons, the exact signals, the exact score
// thresholds and DEEP rule, the exact DEEP reason precedence, the pure no-I/O
// decision boundary, the decision-before-claim topology, the legal v2 pairs,
// legacy read/event compatibility together with the ban on legacy NEW claims,
// the exactly-one conversational provider call, provider/model neutrality, and
// the absence of any LLM classifier in routing.
//
// FORWARD SAFETY IS MANDATORY HERE. This guard must NEVER freeze:
//
//   * the Memory-before-Hypothesis serial foreground ordering (QIR-003 owns it);
//   * the current absence of a foreground Question channel (QIR-006 may add it);
//   * the global integrated context budget (QIR-004 owns it);
//   * the background provider-call cap (QIR-005 owns it);
//   * vendor/model identifiers or provider SLA values (selection is deferred);
//   * any other mutable QIR census gap.
//
// Structural independence is proven in P5: the guard's world may never contain
// the model-profile registry, a provider adapter, the Memory/Hypothesis cap
// sources, or the post-response dispatcher, so it is incapable of freezing them.
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const POLICY_DOC = 'docs/fast-deep-runtime-decision-policy-v2.md';
const SOURCES = Object.freeze({
  policyDoc: POLICY_DOC,
  docsReadme: 'docs/README.md',
  packageJson: 'package.json',
  ci: '.github/workflows/api-ci.yml',
  policy: 'apps/api/src/intelligence-runtime/fast-deep-runtime-decision-policy-v2.ts',
  routingContract: 'apps/api/src/intelligence-runtime/fast-deep-routing-contract.ts',
  orchestrator: 'apps/api/src/conversation/conversation-orchestrator.service.ts',
  repository: 'apps/api/src/conversation/conversation.repository.ts',
  runtimeEventTypes: 'apps/api/src/runtime-events/runtime-event.types.ts',
  telemetry: 'apps/api/src/observability/telemetry.service.ts',
  migration: 'database/migrations/0062_fast_deep_runtime_decision_policy_v2.sql',
  verifier: 'database/verify-migration-0062.mjs',
});
const shipped = Object.freeze(
  Object.fromEntries(Object.entries(SOURCES).map(([key, path]) => [key, read(path)])),
);

const CONTRACT_SCRIPT = 'test:fast-deep-runtime-decision-policy-v2-contract';
const CONTRACT_COMMAND = 'node --test tests/fast-deep-runtime-decision-policy-v2-contract.test.mjs';
const VERIFIER_SCRIPT = 'verify:fast-deep-runtime-decision-policy-v2:integration';
const VERIFIER_COMMAND = 'node --env-file-if-exists=.env database/verify-migration-0062.mjs';

const V2_REASONS = Object.freeze([
  'RUNTIME_ROUTING_V2_FAST_DEFAULT',
  'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE',
  'RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION',
  'RUNTIME_ROUTING_V2_DEEP_MULTI_PART',
  'RUNTIME_ROUTING_V2_DEEP_COMPOSITE',
]);
const LEGACY_REASONS = Object.freeze(['FAST_DEFAULT', 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT']);
const SIGNALS = Object.freeze(['codePointCount', 'questionCount', 'logicalUnitCount']);
// `FAST_DEFAULT` is a SUBSTRING of `RUNTIME_ROUTING_V2_FAST_DEFAULT`, so every
// "the retired reason is gone" check must be identifier-boundary aware or it
// would fire on the legal v2 reason that replaced it.
const retiredLiteral = (reason) => new RegExp(`(?<![A-Z0-9_])${reason}(?![A-Z0-9_])`, 'u');

// Required statements of the policy document, checked against
// whitespace-flattened text so ordinary markdown wrapping never splits a marker.
const REQUIRED_DOC_STATEMENTS = Object.freeze([
  // Identity and baseline.
  '# QANDEEL — FAST / DEEP Runtime Decision Policy v2',
  '**Task:** QIR-002 — FAST / DEEP Runtime Decision Policy v2',
  '**Status: ACTIVE / NORMATIVE**',
  'e687a803f056291011f33e0626f7eb07155ce801',
  'bde76210d51aed56c03a23883a561eafd389af6c',
  'PR #177',
  '33299102946',
  '0061_him_brain_context_bridge_v1.sql',
  // Authority boundary.
  'FAST/DEEP is **execution / routing authority only.**',
  '**no subsystem gains semantic authority from the routing decision.**',
  'explanatory execution metadata, never a diagnosis',
  // Policy version, normalization, signals.
  'The Runtime Decision Policy version is **2**.',
  'Unicode **NFC** normalize.',
  'Count Unicode **code points**, not UTF-16 code units.',
  'The canonical user content is never mutated.',
  'count of exactly `?` and Arabic `؟`',
  'structural breadth only, not linguistic',
  // Exact thresholds and the DEEP rule.
  '| `<300` | 0 |', '| `300–599` | 1 |', '| `600–999` | 2 |', '| `>=1000` | 3 |',
  '| `<2` | 0 |', '| `2` | 1 |', '| `>=3` | 2 |',
  '| `<4` | 0 |', '| `4–6` | 1 |', '| `>=7` | 2 |',
  '`complexityScore = inputScalePoints + questionPoints + logicalBreadthPoints`',
  'valid range `0..7`',
  'Return `DEEP` if either `codePointCount >= 1000` **or** `complexityScore >= 3`. Otherwise return `FAST`.',
  // The accurate invariant. v2 SUPERSEDES the retired UTF-16 `content.length`
  // threshold rather than reproducing it, so surrogate-pair input intentionally
  // diverges from the old rule. The document must never claim otherwise.
  '**Every input with `codePointCount >= 1000` is unconditionally DEEP**',
  '**The retired UTF-16 threshold is superseded, not reproduced.**',
  'Surrogate-pair input therefore diverges from the retired rule *intentionally*',
  'must not be "fixed" back to code-unit counting',
  // Reason precedence.
  '1. `codePointCount >= 1000` → `RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE`',
  '2. else `questionPoints >= 2` → `RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION`',
  '3. else `logicalBreadthPoints >= 2` → `RUNTIME_ROUTING_V2_DEEP_MULTI_PART`',
  '4. else → `RUNTIME_ROUTING_V2_DEEP_COMPOSITE`',
  'FAST always uses `RUNTIME_ROUTING_V2_FAST_DEFAULT`.',
  // Purity, topology, durable authority, events, telemetry.
  '**synchronous, deterministic, CPU-only and side-effect-free.**',
  '**No LLM classifier, embedding, or learned model participates in routing, and routing adds zero provider calls and zero intelligence-read latency.**',
  'RECEIVED → pure CPU routing → canonical claim → ContextBuilder → Safety → intelligence → exactly one conversational provider call when authorized',
  '**exactly once, before the canonical claim**',
  'record no canonical routing decision',
  'is **widened**',
  'is **narrowed**',
  'No historical migration is edited.',
  '**Historical durable and pending events remain valid and recoverable**',
  '`qandeel.routing.decisions`',
  // Deferrals that must stay deferrals.
  'QIR-002 does **not** select a final Provider or LLM',
  'Memory → Hypothesis foreground acquisition ordering (QIR-003)',
  'the global integrated context budget (QIR-004)',
  'background scheduling and provider-call budgeting (QIR-005)',
  'the Question / Information-Gap closed loop (QIR-006)',
  'Vendor/model identifiers and provider SLA values remain deferred.',
]);

function violated(property) {
  throw new Error(`QIR-002 FAST/DEEP Runtime Decision Policy v2 contract violated: ${property}`);
}

function assertFastDeepRuntimeDecisionPolicyV2Contract(world) {
  // 1. The policy document exists, is substantive, and records every statement.
  if (typeof world.policyDoc !== 'string' || world.policyDoc.length < 6000)
    violated('the policy document exists and is substantive');
  const flattened = world.policyDoc.replace(/\s+/gu, ' ');
  for (const statement of REQUIRED_DOC_STATEMENTS) {
    if (!flattened.includes(statement.replace(/\s+/gu, ' '))) violated(`the policy document records: ${statement}`);
  }
  if (!world.docsReadme.includes('fast-deep-runtime-decision-policy-v2.md'))
    violated('docs/README.md links the FAST/DEEP Runtime Decision Policy v2');

  // 2. Registration: the static guard and the migration-0062 verifier.
  const packageJson = JSON.parse(world.packageJson);
  if (packageJson.scripts?.[CONTRACT_SCRIPT] !== CONTRACT_COMMAND)
    violated(`the package script remains registered exactly: ${CONTRACT_SCRIPT}`);
  if (packageJson.scripts?.[VERIFIER_SCRIPT] !== VERIFIER_COMMAND)
    violated(`the package script remains registered exactly: ${VERIFIER_SCRIPT}`);
  const guardStep = world.ci.indexOf(CONTRACT_SCRIPT);
  const bootstrap = world.ci.indexOf('Apply all migrations to fresh PostgreSQL');
  if (guardStep < 0) violated('CI runs the QIR-002 static contract');
  if (!(guardStep < bootstrap))
    violated('the QIR-002 static contract runs in CI before the database bootstrap: a pure static guard needs no database');
  const verifierStep = world.ci.indexOf(VERIFIER_SCRIPT);
  if (verifierStep < 0) violated('CI runs the migration-0062 verifier');
  if (!(verifierStep > bootstrap))
    violated('the migration-0062 verifier runs in CI after the fresh-PostgreSQL migration chain');

  // 3. The frozen policy law, asserted on the live routing module.
  if (!world.routingContract.includes('export const RUNTIME_ROUTING_POLICY_VERSION = 2 as const;'))
    violated('the routing policy version stays 2');
  if (!world.routingContract.includes('export const RUNTIME_ROUTING_MAX_COMPLEXITY_SCORE = 7;'))
    violated('the complexity score stays bounded at 7');
  for (const reason of V2_REASONS) {
    if (!world.routingContract.includes(`'${reason}'`)) violated(`the v2 reason registry contains ${reason}`);
    if (!world.migration.includes(reason)) violated(`migration 0062 authorizes ${reason}`);
  }
  for (const signal of SIGNALS) {
    if (!world.routingContract.includes(`readonly ${signal}: number;`)) violated(`the decision exposes the ${signal} signal`);
    if (!world.policy.includes(signal)) violated(`the policy computes the ${signal} signal`);
  }
  for (const required of [
    ['const DEEP_INPUT_SCALE_CODE_POINTS = 1000;', 'the 1000 code-point unconditional DEEP threshold'],
    ['const INPUT_SCALE_BANDS = Object.freeze([300, 600, DEEP_INPUT_SCALE_CODE_POINTS] as const);', 'the exact 300/600/1000 input-scale bands'],
    ['const DEEP_COMPLEXITY_SCORE = 3;', 'the DEEP composite score threshold of 3'],
    ["const QUESTION_MARKS: ReadonlySet<string> = new Set(['?', '؟']);", 'exactly the Latin and Arabic question marks'],
    ['const LOGICAL_UNIT_SEPARATORS = /[.!?؟;؛…\\r\\n]+/u;', 'the exact logical-unit separator set'],
    ['if (questionCount >= 3) return 2;', 'the >=3 question band'],
    ['return questionCount === 2 ? 1 : 0;', 'the exactly-2 question band'],
    ['if (logicalUnitCount >= 7) return 2;', 'the >=7 logical-breadth band'],
    ['return logicalUnitCount >= 4 ? 1 : 0;', 'the 4-6 logical-breadth band'],
    ["return content.normalize('NFC').trim();", 'NFC normalization and Unicode trimming for analysis only'],
    ['const codePoints = Array.from(normalized);', 'code-point counting rather than UTF-16 code units'],
    ['signals.codePointCount >= DEEP_INPUT_SCALE_CODE_POINTS || complexityScore >= DEEP_COMPLEXITY_SCORE', 'the exact DEEP path rule'],
  ]) {
    if (!world.policy.includes(required[0])) violated(`${required[1]}: missing ${required[0]}`);
  }
  // The exact DEEP reason precedence, in this order and no other.
  const precedence = [
    "if (codePointCount >= DEEP_INPUT_SCALE_CODE_POINTS) return 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE';",
    "if (questions >= 2) return 'RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION';",
    "if (breadth >= 2) return 'RUNTIME_ROUTING_V2_DEEP_MULTI_PART';",
    "return 'RUNTIME_ROUTING_V2_DEEP_COMPOSITE';",
  ];
  let cursor = -1;
  for (const step of precedence) {
    const at = world.policy.indexOf(step);
    if (at < 0) violated(`the DEEP reason precedence keeps: ${step}`);
    if (!(at > cursor)) violated(`the DEEP reason precedence keeps its exact order at: ${step}`);
    cursor = at;
  }

  // 4. The pure decision boundary: no I/O, no intelligence, no provider edge.
  const executable = (source) => source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
  const policyCode = executable(world.policy);
  const contractCode = executable(world.routingContract);
  for (const forbidden of [
    'async ', 'await ', 'Promise', 'setTimeout', 'setInterval', 'process.env', 'fetch(', 'require(',
    'Math.random', 'Date.now', 'new Date', 'this.repository', 'telemetry', 'Memory', 'Him', 'HIM',
    'Hypothesis', 'Confidence', 'Recommendation', 'Question', 'Safety', 'embedding', 'classifier',
  ]) {
    if (policyCode.includes(forbidden)) violated(`the decision boundary stays pure: found ${forbidden}`);
  }
  const policyImports = [...policyCode.matchAll(/from '([^']+)'/gu)].map((match) => match[1]);
  if (policyImports.length !== 1 || policyImports[0] !== './fast-deep-routing-contract')
    violated('the routing policy imports nothing but its own sibling contract');
  if ([...contractCode.matchAll(/from '([^']+)'/gu)].length !== 0)
    violated('the routing contract imports nothing at all');

  // 5. Decision-before-claim topology and exactly one provider call.
  const decisions = world.orchestrator.match(/decideFastDeepRoute\(/gu) ?? [];
  if (decisions.length !== 1) violated('the v2 decision is computed exactly once on the turn path');
  const decisionAt = world.orchestrator.indexOf('decideFastDeepRoute(userTurn.content)');
  const claimAt = world.orchestrator.indexOf('this.repository.claimTurn');
  if (decisionAt < 0 || claimAt < 0) violated('the orchestrator routes through the v2 policy and the canonical claim');
  if (!(decisionAt < claimAt)) violated('the decision is taken BEFORE the canonical claim');
  for (const [marker, label] of [
    ['this.contextBuilder.build', 'ContextBuilder'],
    ['this.safetyGate.evaluate', 'Safety'],
    ['this.router.generate', 'the conversational provider call'],
  ]) {
    const at = world.orchestrator.indexOf(marker);
    if (at < 0) violated(`the orchestrator still reaches ${label}`);
    if (!(claimAt < at)) violated(`routing and the canonical claim precede ${label}`);
  }
  if ((world.orchestrator.match(/this\.router\.generate\(/gu) ?? []).length !== 1)
    violated('exactly one conversational provider invocation exists on the turn path');
  // The retired policy is gone from the orchestrator entirely.
  for (const retired of ['DEEP_INPUT_LENGTH', 'selectPath', ...LEGACY_REASONS]) {
    if (retiredLiteral(retired).test(world.orchestrator)) violated(`the retired routing policy is gone: found ${retired}`);
  }
  // The winner alone records a decision, after the lost-claim branch.
  const recordAt = world.orchestrator.indexOf('this.telemetry.recordRoutingDecision(selection)');
  if (recordAt < 0) violated('the claim winner records the routing decision');
  if (!(recordAt > world.orchestrator.indexOf('if (!claimed) {')))
    violated('a lost claim records no canonical routing decision');

  // 6. One shared route-pair contract, consumed instead of re-hard-coded.
  //
  // QIR-002-F01: both shared validators take `unknown` and MUST be total. A
  // failed registry lookup returns `undefined`, so comparing that lookup
  // directly against an unvalidated path made `(undefined, <unknown reason>)`
  // compare `undefined === undefined` and PASS — an unknown reason satisfied
  // the routing gate, and a malformed runtime-event envelope with a present
  // `processing_path` set to `undefined` passed validation. Freeze the
  // recognized-path + recognized-reason shape and ban the exact regression.
  if (!world.routingContract.includes("const ROUTING_PATHS: ReadonlySet<string> = new Set<string>(['FAST', 'DEEP']);"))
    violated('the routing contract owns the recognized-path registry');
  if (!world.routingContract.includes('export function isRuntimeRoutingPath(value: unknown): value is RuntimeRoutingPath {'))
    violated('the routing contract exports a total path recognizer');
  for (const helper of ['isLegalCurrentRoutePair', 'isLegalDurableRoutePair']) {
    const start = world.routingContract.indexOf(`export function ${helper}(path: unknown, reason: unknown): boolean {`);
    if (start < 0) violated(`${helper} keeps its total unknown-input signature`);
    const body = world.routingContract.slice(start, world.routingContract.indexOf('\n}', start));
    if (!body.includes("if (!isRuntimeRoutingPath(path) || typeof reason !== 'string') return false;"))
      violated(`${helper} proves a recognized path and a string reason before comparing them`);
    if (!body.includes('return expected !== undefined && expected === path;'))
      violated(`${helper} requires the looked-up expected path to be defined`);
    if (/PAIRS\.get\(reason\)\s*(?:\?\?[^;]*)?===\s*path/u.test(body))
      violated(`${helper} never compares a failed registry lookup directly against an unvalidated path`);
  }
  // null/null stays the ONE legitimate absent state, and only for durable reads.
  if (!world.routingContract.includes('  if (path === null && reason === null) return true;'))
    violated('durable authority keeps the pre-routing null/null state');
  if (world.routingContract.slice(
    world.routingContract.indexOf('export function isLegalCurrentRoutePair'),
    world.routingContract.indexOf('\n}', world.routingContract.indexOf('export function isLegalCurrentRoutePair')),
  ).includes('=== null')) violated('current claim authority never admits a null route state');

  if (!world.repository.includes('selection: RuntimeRoutePair'))
    violated('the claim boundary accepts only a legal current route pair');
  if (!world.runtimeEventTypes.includes('isLegalDurableRoutePair(payload.processing_path,payload.routing_reason)'))
    violated('runtime-event validation uses the shared route-pair contract');
  for (const reason of [...V2_REASONS, ...LEGACY_REASONS]) {
    if (world.runtimeEventTypes.includes(`'${reason}'`))
      violated(`runtime-event validation no longer hard-codes ${reason}`);
  }
  if (!world.telemetry.includes("createCounter('qandeel.routing.decisions')"))
    violated('the bounded routing-decision metric exists');
  if (!world.telemetry.includes('isLegalCurrentRoutePair(decision.path,decision.reason)'))
    violated('routing telemetry emits only legal current pairs');
  if (!world.telemetry.includes('policy_version:String(RUNTIME_ROUTING_POLICY_VERSION),complexity_score:String(score)'))
    violated('routing telemetry keeps its four finite dimensions');

  // 7. Durable authority: widened read compatibility, narrowed new claims.
  for (const reason of LEGACY_REASONS) {
    if (!world.migration.includes(`routing_reason = '${reason}'`))
      violated(`migration 0062 keeps historical ${reason} rows readable`);
    if (!world.verifier.includes(reason)) violated(`the 0062 verifier proves ${reason} compatibility`);
  }
  // Both durable predicates are TOTAL: SQL's third truth value can no longer
  // let a NULL claim through the gate or a half-null row through the CHECK.
  if (!world.migration.includes('(processing_path IS NULL AND routing_reason IS NULL) OR'))
    violated('the persisted check keeps the legitimate pre-routing state');
  if (!world.migration.includes('(processing_path IS NOT NULL AND routing_reason IS NOT NULL AND ('))
    violated('the persisted check is total: path-only and reason-only states are rejected');
  // Prose that explains WHY `NOT VALID` is not used is not `NOT VALID`, so only
  // executable SQL is scanned.
  const migrationSql = world.migration.replace(/^\s*--.*$/gmu, '');
  if (migrationSql.includes('NOT VALID'))
    violated('the widened check is validated against existing rows rather than deferred');
  const claimBody = world.migration.slice(world.migration.indexOf('CREATE OR REPLACE FUNCTION public.claim_conversation_turn'));
  for (const reason of LEGACY_REASONS) {
    if (retiredLiteral(reason).test(claimBody)) violated(`new claims reject the retired reason ${reason}`);
  }
  for (const required of [
    ["p_routing_reason='RUNTIME_ROUTING_V2_FAST_DEFAULT'", 'the v2 FAST claim pair'],
    ["RAISE EXCEPTION 'INVALID_ROUTING'", 'the fail-closed routing gate'],
    ['IF p_processing_path IS NULL OR p_routing_reason IS NULL', 'the total (three-valued-logic-safe) routing gate'],
    ["SECURITY DEFINER SET search_path=''", 'the hardened definer boundary'],
    ['FOR UPDATE', 'the one-claimant-wins row lock'],
    ["role='USER' AND status='RECEIVED'", 'the USER + RECEIVED requirement'],
    ["RAISE EXCEPTION 'FORBIDDEN'", 'the explicit ownership check'],
    ["RAISE EXCEPTION 'INVALID_USER'", 'the null-user guard'],
    ['generation_lease_expires_at=CURRENT_TIMESTAMP+public.foreground_generation_lease_interval_v1()', 'the server-owned generation lease'],
  ]) {
    if (!claimBody.includes(required[0])) violated(`${required[1]}: missing ${required[0]}`);
  }
  if (!world.migration.includes('REVOKE ALL ON FUNCTION public.claim_conversation_turn(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated'))
    violated('least privilege is re-asserted after CREATE OR REPLACE');
  if (!world.migration.includes('GRANT EXECUTE ON FUNCTION public.claim_conversation_turn(uuid,uuid,uuid,text,text) TO service_role'))
    violated('claim execution stays service-role-only');
  if (/GRANT[^\n]*claim_conversation_turn[^\n]*TO (?:authenticated|anon|PUBLIC)/u.test(world.migration))
    violated('no authenticated or anonymous claim path is opened');
  if (/CREATE TABLE|DROP TABLE|TRUNCATE|DELETE FROM|ALTER TABLE public\.conversation_turns\s+ADD COLUMN/iu.test(world.migration))
    violated('migration 0062 adds no table, column, or destructive statement');

  // 8. Provider/model neutrality across the whole QIR-002 routing surface.
  //    Vendor/model IDENTITY may not appear anywhere, not even in prose. The
  //    generic implementation techniques may be NAMED in prose as prohibitions
  //    (that is the point of the comments) but must never appear in executable
  //    code, so they are checked against comment-stripped source.
  const vendor = new RegExp([['clau', 'de'], ['gp', 't'], ['anthr', 'opic'], ['open', 'ai'], ['gem', 'ini'], ['ha', 'iku'], ['son', 'net'], ['ko', 'be'], ['lla', 'ma']].map((parts) => parts.join('')).join('|'), 'iu');
  const technique = new RegExp([['tokeniz'], ['embed', 'ding'], ['classifi', 'er']].map((parts) => parts.join('')).join('|'), 'iu');
  const stripComments = (source) => source
    .replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '').replace(/^\s*--.*$/gmu, '');
  for (const key of ['policy', 'routingContract', 'migration']) {
    if (vendor.test(world[key])) violated(`the routing surface names no vendor or model: ${key}`);
    if (technique.test(stripComments(world[key])))
      violated(`the routing surface runs no tokenizer, embedding or classifier: ${key}`);
  }
}

test('P1 - the shipped repository satisfies the QIR-002 contract', () => {
  assert.doesNotThrow(() => assertFastDeepRuntimeDecisionPolicyV2Contract(shipped));
});

test('P2 - anti-vacuity: the real guard rejects every named regression', () => {
  const guardStepLine = shipped.ci.match(/^.*test:fast-deep-runtime-decision-policy-v2-contract.*$/mu)?.[0];
  assert.ok(guardStepLine, 'the CI step line exists for the relocation fixture');
  const drifts = [
    ['the policy document was deleted', { policyDoc: '' }],
    ['the policy version was bumped without a superseding contract', {
      routingContract: shipped.routingContract.replace('RUNTIME_ROUTING_POLICY_VERSION = 2 as const;', 'RUNTIME_ROUTING_POLICY_VERSION = 3 as const;'),
    }],
    ['the 1000 code-point DEEP threshold moved', {
      policy: shipped.policy.replace('const DEEP_INPUT_SCALE_CODE_POINTS = 1000;', 'const DEEP_INPUT_SCALE_CODE_POINTS = 4000;'),
    }],
    ['an input-scale band moved', {
      policy: shipped.policy.replace('Object.freeze([300, 600, DEEP_INPUT_SCALE_CODE_POINTS] as const)', 'Object.freeze([250, 600, DEEP_INPUT_SCALE_CODE_POINTS] as const)'),
    }],
    ['the composite DEEP score threshold moved', {
      policy: shipped.policy.replace('const DEEP_COMPLEXITY_SCORE = 3;', 'const DEEP_COMPLEXITY_SCORE = 5;'),
    }],
    ['a question band moved', { policy: shipped.policy.replace('if (questionCount >= 3) return 2;', 'if (questionCount >= 4) return 2;') }],
    ['a logical-breadth band moved', { policy: shipped.policy.replace('if (logicalUnitCount >= 7) return 2;', 'if (logicalUnitCount >= 9) return 2;') }],
    ['the Arabic question mark was dropped', {
      policy: shipped.policy.replace("new Set(['?', '؟'])", "new Set(['?'])"),
    }],
    ['a logical-unit separator was dropped', {
      policy: shipped.policy.replace('/[.!?؟;؛…\\r\\n]+/u', '/[.!?]+/u'),
    }],
    ['NFC normalization was withdrawn', {
      policy: shipped.policy.replace("return content.normalize('NFC').trim();", 'return content.trim();'),
    }],
    ['code-point counting reverted to UTF-16 units', {
      policy: shipped.policy.replace('const codePoints = Array.from(normalized);', 'const codePoints = normalized.split("");'),
    }],
    ['the DEEP path rule changed', {
      policy: shipped.policy.replace('signals.codePointCount >= DEEP_INPUT_SCALE_CODE_POINTS || complexityScore >= DEEP_COMPLEXITY_SCORE', 'complexityScore >= DEEP_COMPLEXITY_SCORE'),
    }],
    ['the DEEP reason precedence was reordered', {
      policy: shipped.policy
        .replace("if (codePointCount >= DEEP_INPUT_SCALE_CODE_POINTS) return 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE';\n  if (questions >= 2) return 'RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION';",
        "if (questions >= 2) return 'RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION';\n  if (codePointCount >= DEEP_INPUT_SCALE_CODE_POINTS) return 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE';"),
    }],
    ['a v2 reason vanished from the registry', {
      routingContract: shipped.routingContract.replaceAll("'RUNTIME_ROUTING_V2_DEEP_MULTI_PART'", "'RUNTIME_ROUTING_V2_DEEP_SOMETHING'"),
    }],
    ['a signal vanished from the decision', {
      routingContract: shipped.routingContract.replace('readonly questionCount: number;', 'readonly questionScore: number;'),
    }],
    ['the decision boundary became asynchronous', {
      policy: `${shipped.policy}\nexport async function reroute(content: string) { return decideFastDeepRoute(content); }\n`,
    }],
    ['the decision boundary gained a network edge', {
      policy: shipped.policy.replace("import {", "import { readFileSync } from 'node:fs';\nimport {"),
    }],
    ['the routing policy gained an intelligence import', {
      policy: shipped.policy.replace("from './fast-deep-routing-contract';", "from './fast-deep-routing-contract';\nimport { HimBrainContextService } from '../human-model/him-brain-context.service';"),
    }],
    ['routing moved after the canonical claim', {
      orchestrator: shipped.orchestrator
        .replace('const selection = decideFastDeepRoute(userTurn.content);\n', '')
        .replace('    if (!claimed) {', '    const selection = decideFastDeepRoute(userTurn.content);\n    if (!claimed) {'),
    }],
    ['routing was computed twice', {
      orchestrator: `${shipped.orchestrator}\n// drift\nconst again = (t: string) => decideFastDeepRoute(t);\n`,
    }],
    ['the retired input-length constant came back', {
      orchestrator: `const DEEP_INPUT_LENGTH = 1000;\n${shipped.orchestrator}`,
    }],
    ['a legacy reason came back into the orchestrator', {
      orchestrator: shipped.orchestrator.replace("{ path: selection.path, reason: selection.reason }", "{ path: selection.path, reason: 'FAST_DEFAULT' }"),
    }],
    ['a second conversational provider invocation appeared', {
      orchestrator: `${shipped.orchestrator}\n// drift\nconst second = (o) => o.engine('model_router', 'FAST', () => this.router.generate({}));\n`,
    }],
    ['the lost claim started recording a canonical routing decision', {
      orchestrator: shipped.orchestrator.replace('    if (!claimed) {', '    this.telemetry.recordRoutingDecision(selection);\n    if (!claimed) {'),
    }],
    ['the claim boundary reopened to arbitrary reasons', {
      repository: shipped.repository.replace('selection: RuntimeRoutePair', 'selection: { path: string; reason: string }'),
    }],
    // QIR-002-F01 anti-vacuity: the exact historical regression, both halves.
    ['the current route-pair validator lost its totality guard', {
      routingContract: shipped.routingContract.replace(
        "  if (!isRuntimeRoutingPath(path) || typeof reason !== 'string') return false;\n  const expected = CURRENT_PAIRS.get(reason);\n  return expected !== undefined && expected === path;",
        "  return typeof reason === 'string' && CURRENT_PAIRS.get(reason) === path;"),
    }],
    ['the durable route-pair validator lost its totality guard', {
      routingContract: shipped.routingContract.replace(
        "  if (!isRuntimeRoutingPath(path) || typeof reason !== 'string') return false;\n  const expected = CURRENT_PAIRS.get(reason) ?? LEGACY_PAIRS.get(reason);\n  return expected !== undefined && expected === path;",
        "  if (typeof reason !== 'string') return false;\n  return (CURRENT_PAIRS.get(reason) ?? LEGACY_PAIRS.get(reason)) === path;"),
    }],
    ['the total path recognizer was withdrawn', {
      routingContract: shipped.routingContract.replace(
        'export function isRuntimeRoutingPath(value: unknown): value is RuntimeRoutingPath {',
        'function retiredRoutingPathCheck(value: unknown): boolean {'),
    }],
    ['the recognized-path registry was emptied', {
      routingContract: shipped.routingContract.replace(
        "const ROUTING_PATHS: ReadonlySet<string> = new Set<string>(['FAST', 'DEEP']);",
        'const ROUTING_PATHS: ReadonlySet<string> = new Set<string>([]);'),
    }],
    ['durable authority dropped the pre-routing null/null state', {
      routingContract: shipped.routingContract.replace('  if (path === null && reason === null) return true;\n', ''),
    }],
    ['the superseded-threshold correction was replaced by the old inaccurate claim', {
      policyDoc: shipped.policyDoc.replace(
        '**The retired UTF-16 threshold is superseded, not reproduced.**',
        'This preserves every pre-QIR-002 `>=1000` DEEP case exactly.'),
    }],
    ['the unconditional-DEEP invariant was withdrawn from the document', {
      policyDoc: shipped.policyDoc.replace(
        '**Every input with `codePointCount >= 1000` is unconditionally DEEP**',
        'Long inputs are usually DEEP'),
    }],
    ['runtime-event validation re-hard-coded a reason', {
      runtimeEventTypes: shipped.runtimeEventTypes.replace('if(!isLegalDurableRoutePair(payload.processing_path,payload.routing_reason))return false;', "if(payload.routing_reason!=='FAST_DEFAULT')return false;"),
    }],
    ['routing telemetry lost its bounded pair check', {
      telemetry: shipped.telemetry.replace('if(!isLegalCurrentRoutePair(decision.path,decision.reason))return;', ''),
    }],
    ['the routing metric was removed', {
      telemetry: shipped.telemetry.replaceAll("createCounter('qandeel.routing.decisions')", "createCounter('qandeel.routing.freeform')"),
    }],
    ['the persisted check stopped accepting historical rows', {
      migration: shipped.migration.replaceAll("routing_reason = 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT'", "routing_reason = 'RETIRED'"),
    }],
    ['new claims accepted a retired reason again', {
      migration: shipped.migration.replace("p_routing_reason='RUNTIME_ROUTING_V2_FAST_DEFAULT')", "p_routing_reason IN ('RUNTIME_ROUTING_V2_FAST_DEFAULT','FAST_DEFAULT'))"),
    }],
    ['the claim routing gate was removed', {
      migration: shipped.migration.replace("RAISE EXCEPTION 'INVALID_ROUTING'", "RAISE NOTICE 'INVALID_ROUTING'"),
    }],
    ['the routing gate lost its NULL guard and became three-valued again', {
      migration: shipped.migration.replace('  IF p_processing_path IS NULL OR p_routing_reason IS NULL\n    OR NOT(', '  IF NOT('),
    }],
    ['the persisted check lost its both-NOT-NULL guard and became three-valued again', {
      migration: shipped.migration.replace('(processing_path IS NOT NULL AND routing_reason IS NOT NULL AND (', '((('),
    }],
    ['the widened check was deferred instead of validated', {
      migration: shipped.migration.replace('ADD CONSTRAINT conversation_turns_routing_reason_check CHECK (', 'ADD CONSTRAINT conversation_turns_routing_reason_check NOT VALID CHECK ('),
    }],
    ['the claim row lock was dropped', { migration: shipped.migration.replace('    FOR UPDATE', '    ') }],
    ['the definer hardening was dropped', {
      migration: shipped.migration.replace("SECURITY DEFINER SET search_path=''", 'SECURITY DEFINER'),
    }],
    ['an authenticated claim path was opened', {
      migration: `${shipped.migration}\nGRANT EXECUTE ON FUNCTION public.claim_conversation_turn(uuid,uuid,uuid,text,text) TO authenticated;\n`,
    }],
    ['least privilege was no longer re-asserted', {
      migration: shipped.migration.replace('REVOKE ALL ON FUNCTION public.claim_conversation_turn(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;\n', ''),
    }],
    ['a vendor model name entered the routing surface', {
      policy: `${shipped.policy}\n// tuned for ${['cla', 'ude'].join('')}\n`,
    }],
    ['the docs index lost the policy link', {
      docsReadme: shipped.docsReadme.replaceAll('fast-deep-runtime-decision-policy-v2.md', 'missing.md'),
    }],
    ['the static guard was deregistered from package scripts', {
      packageJson: shipped.packageJson.replace('"test:fast-deep-runtime-decision-policy-v2-contract":', '"test:fast-deep-runtime-decision-policy-v2-contract-retired":'),
    }],
    ['the migration-0062 verifier was deregistered', {
      packageJson: shipped.packageJson.replace('"verify:fast-deep-runtime-decision-policy-v2:integration":', '"verify-retired:fast-deep-runtime-decision-policy-v2:integration":'),
    }],
    ['the static guard was deregistered from CI', {
      ci: shipped.ci.replaceAll('test:fast-deep-runtime-decision-policy-v2-contract', 'echo skipped'),
    }],
    ['the verifier was deregistered from CI', {
      ci: shipped.ci.replaceAll('verify:fast-deep-runtime-decision-policy-v2:integration', 'echo skipped'),
    }],
    ['the CI guard step was moved after the database bootstrap', {
      ci: `${shipped.ci.replace(guardStepLine, '      - {name: Placeholder, run: echo placeholder}')}\n${guardStepLine}\n`,
    }],
  ];

  for (const [label, overrides] of drifts) {
    const mutated = { ...shipped, ...overrides };
    for (const key of Object.keys(overrides)) {
      assert.notDeepEqual(mutated[key], shipped[key], `the "${label}" mutation actually replaced its source`);
    }
    assert.throws(
      () => assertFastDeepRuntimeDecisionPolicyV2Contract(mutated),
      (error) => error instanceof Error,
      `the guard rejects: ${label}`,
    );
  }
});

test('P3 - forward safety: every change a later QIR task is expected to make stays legal', () => {
  // Foreground acquisition: QIR-003 already exercised this freedom by
  // replacing the serial Memory-then-Hypothesis await stages with the bounded
  // concurrent gatherer, so the mutation fixture now points at the CURRENT
  // acquisition surface — a later reviewed revision may reshape it again, and
  // this guard must stay indifferent. (The QIR-003 guard, not this one, owns
  // the gatherer law.)
  const gatherLaunchLine = '      const foregroundGatherPromise = this.foregroundIntelligenceGatherer.gather({';
  assert.ok(shipped.orchestrator.includes(gatherLaunchLine), 'the bounded gather launch exists at the baseline to mutate');
  const regathered = shipped.orchestrator.replace(gatherLaunchLine,
    '      const foregroundGatherPromise = this.foregroundIntelligenceGathererV2.gather({');
  assert.notDeepEqual(regathered, shipped.orchestrator);
  assert.doesNotThrow(() => assertFastDeepRuntimeDecisionPolicyV2Contract({ ...shipped, orchestrator: regathered }),
    'a later reviewed task may revise the bounded foreground acquisition surface');

  // QIR-006: a foreground Question opportunity channel appears.
  const recommendationLine = '      const recommendationGrounding = hypothesisResult ? this.recommendationGrounding.ground(hypothesisResult) : undefined;';
  assert.ok(shipped.orchestrator.includes(recommendationLine), 'the recommendation stage exists at the baseline to extend');
  const questionChannel = shipped.orchestrator.replace(recommendationLine,
    `${recommendationLine}\n      const questionOpportunity = await this.engine('question_opportunity',selection.path,()=>this.questionOpportunityChannel.read(userId, accessToken, claimed.session_id));`);
  assert.notDeepEqual(questionChannel, shipped.orchestrator);
  assert.doesNotThrow(() => assertFastDeepRuntimeDecisionPolicyV2Contract({ ...shipped, orchestrator: questionChannel }),
    'QIR-006 may add a foreground Question opportunity channel');

  // Final provider-request assembly: QIR-004 already exercised this freedom by
  // retiring ContextBuilder.assemble(...) in favour of the ONE Integrated
  // Context Budget Assembler, so the mutation fixture now points at the CURRENT
  // assembly surface — a later reviewed revision may reshape it again, and this
  // guard must stay indifferent. (The QIR-004 guard, not this one, owns the
  // budget law.)
  const assemblyLine = '      const assembled = this.integratedContextBudget.assemble({';
  assert.ok(shipped.orchestrator.includes(assemblyLine), 'the final provider-request assembly exists at the baseline to mutate');
  const budgeted = shipped.orchestrator.replace(assemblyLine,
    '      const assembled = this.integratedContextBudgetV2.assemble({');
  assert.notDeepEqual(budgeted, shipped.orchestrator);
  assert.doesNotThrow(() => assertFastDeepRuntimeDecisionPolicyV2Contract({ ...shipped, orchestrator: budgeted }),
    'a later reviewed task may revise the integrated context budget assembly surface');

  // Provider latency budgets and the LOW/HIGH mapping stay QIR-002-neutral.
  const rebudgeted = shipped.orchestrator.replace('latencyBudgetMs: selection.path === \'DEEP\' ? 10000 : 3000,', 'latencyBudgetMs: selection.path === \'DEEP\' ? 12000 : 2500,');
  assert.notDeepEqual(rebudgeted, shipped.orchestrator);
  assert.doesNotThrow(() => assertFastDeepRuntimeDecisionPolicyV2Contract({ ...shipped, orchestrator: rebudgeted }),
    'a later reviewed task may retune the provider latency budget');

  // A later reviewed amendment may extend the policy document.
  assert.doesNotThrow(() => assertFastDeepRuntimeDecisionPolicyV2Contract({
    ...shipped,
    policyDoc: `${shipped.policyDoc}\n\n## Amendment A1 (QIR-00x)\n\nRecorded under its own reviewed contract.\n`,
  }), 'a later reviewed policy amendment stays legal');

  // A later QIR task may add its own static-contract and verifier CI steps.
  const guardStepLine = shipped.ci.match(/^.*test:fast-deep-runtime-decision-policy-v2-contract.*$/mu)[0];
  assert.doesNotThrow(() => assertFastDeepRuntimeDecisionPolicyV2Contract({
    ...shipped,
    ci: shipped.ci.replace(guardStepLine,
      `${guardStepLine}\n      - {name: Verify QIR-003 foreground gatherer static contract, run: npm run test:qir-003-contract}`),
  }), 'a later QIR static-contract CI step stays legal');

  // A later migration may extend the schema without touching QIR-002 law.
  assert.doesNotThrow(() => assertFastDeepRuntimeDecisionPolicyV2Contract({
    ...shipped,
    verifier: `${shipped.verifier}\n// a later reviewed proof may be appended here\n`,
  }), 'the verifier may be extended by a later reviewed change');
});

test('P4 - the contract guard and the migration verifier are wired into package scripts and CI', () => {
  const packageJson = JSON.parse(shipped.packageJson);
  assert.equal(packageJson.scripts[CONTRACT_SCRIPT], CONTRACT_COMMAND);
  assert.equal(packageJson.scripts[VERIFIER_SCRIPT], VERIFIER_COMMAND);
  const guardStep = shipped.ci.indexOf(CONTRACT_SCRIPT);
  const bootstrap = shipped.ci.indexOf('Apply all migrations to fresh PostgreSQL');
  assert.ok(guardStep > 0, 'CI runs the QIR-002 static contract');
  assert.ok(guardStep < bootstrap, 'it runs before the database bootstrap: a pure static guard needs no database');
  assert.ok(shipped.ci.indexOf(VERIFIER_SCRIPT) > bootstrap, 'the 0062 verifier runs after the fresh migration chain');
  assert.ok(shipped.ci.indexOf(VERIFIER_SCRIPT) > shipped.ci.indexOf('verify:conversation-authority:integration'),
    'the 0062 verifier runs after the conversation authority verifier it extends');
});

test('P5 - the guard is structurally independent of every mutable census gap', () => {
  const worldPaths = Object.values(SOURCES);
  for (const excluded of [
    'apps/api/src/model-router/model-profile.registry.ts',
    'apps/api/src/model-router/model-router.types.ts',
    'apps/api/src/memory/memory-retriever.service.ts',
    'apps/api/src/hypothesis/hypothesis-reasoning-context.types.ts',
    'apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts',
  ]) {
    assert.ok(!worldPaths.includes(excluded), `the guard world never includes ${excluded}`);
  }
  assert.ok(worldPaths.every((path) => !path.includes('providers/')),
    'the guard world never includes a provider adapter source');
  assert.ok(worldPaths.every((path) => !path.includes('human-model/')),
    'the guard world never includes a Human Intelligence source: QHIA semantics stay owned by the QHIA guards');

  // The guard function never names a mutable-gap literal.
  const guardSource = assertFastDeepRuntimeDecisionPolicyV2Contract.toString();
  for (const forbidden of [
    'HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS',
    'memoryRetriever',
    'hypothesisReasoningContext',
    'questionOpportunity',
    ['claude', '-'].join(''),
    ['gpt', '-'].join(''),
    ['ha', 'iku'].join(''),
    ['son', 'net'].join(''),
  ]) {
    assert.ok(!guardSource.includes(forbidden), `the guard never depends on the mutable census literal ${forbidden}`);
  }

  // The contract artifacts perform no database work and ship no runtime code.
  for (const forbidden of ['INSERT INTO', 'DROP TABLE', 'CREATE POLICY', 'GRANT ALL']) {
    assert.ok(!shipped.policyDoc.includes(forbidden), `the policy document performs no database work: found ${forbidden}`);
  }
});
