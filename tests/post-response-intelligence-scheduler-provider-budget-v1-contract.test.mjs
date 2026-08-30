import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// QIR-005 Post-Response Intelligence Scheduler & Provider Budget v1 static
// contract.
//
// This guard freezes exactly the QIR-005-owned invariants: the hard
// durable-execution provider budget of 3, the exact three provider-backed
// effect identities, the impossibility of a silent fourth provider-backed
// effect, the ONE centralized provider-budget gate every fresh provider effect
// must pass, the authorize -> durable claim -> spend -> single transport
// ordering, the reconstruction of spent slots from durable CLAIMED/COMPLETED
// effect state alone, the absence of any per-delivery/per-reclaim budget reset
// or refund, zero-provider-replay durable recovery, the frozen zero-retry
// integration requirement of the three canonical provider boundaries, the
// bounded fail-soft provider-budget telemetry, the deterministic terminal
// exhaustion identity, and the no-migration fact of the QIR-005 baseline.
//
// It is NOT a documentation-prose check: every rule above is asserted against
// the production sources that implement it, and B2 proves the guard rejects
// each named production regression.
//
// FORWARD-SAFETY IS MANDATORY HERE. This guard must never freeze:
//   * Provider/model identifiers, provider adapters or the model-profile
//     registry (final Provider/LLM selection stays deferred; the guard reads no
//     adapter and asserts no model name);
//   * QIR-002 routing thresholds/reasons, QIR-003 gatherer semantics or QIR-004
//     budget partition values (the guard reads none of those sources);
//   * global cross-execution worker concurrency or the Redis consumer topology;
//   * a foreground Question channel or any other QIR-006 surface OUTSIDE the
//     frozen post-response provider registry;
//   * future migrations (a later, separately reviewed migration in ANY domain
//     stays legal; the guard bans no future migration number or filename).
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');

const CONTRACT_DOC = 'docs/post-response-intelligence-scheduler-provider-budget-v1.md';
// Deliberately narrow world: only the sources whose QIR-005-owned lines this
// guard asserts. No model-profile registry, no provider adapter, no routing
// policy source and no QIR-003/QIR-004 source may ever enter it (proven in B5).
// The three provider CONFIG modules are in the world for exactly ONE reason -
// the frozen zero-retry integration requirement - and nothing else is read from
// them (proven in B5).
const SOURCES = Object.freeze({
  contractDoc: CONTRACT_DOC,
  docsReadme: 'docs/README.md',
  packageJson: 'package.json',
  ci: '.github/workflows/api-ci.yml',
  budgetContract: 'apps/api/src/post-response-intelligence/post-response-provider-budget.ts',
  budgetService: 'apps/api/src/post-response-intelligence/post-response-provider-budget.service.ts',
  budgetSpec: 'apps/api/src/post-response-intelligence/post-response-provider-budget.spec.ts',
  dispatcher: 'apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts',
  dispatcherSpec: 'apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.spec.ts',
  postResponseModule: 'apps/api/src/post-response-intelligence/post-response-intelligence.module.ts',
  effectTypes: 'apps/api/src/post-response-intelligence/post-response-intelligence.types.ts',
  telemetry: 'apps/api/src/observability/telemetry.service.ts',
  associationProviderConfig: 'apps/api/src/hypothesis/hypothesis-evidence-association-provider.config.ts',
  intentProviderConfig: 'apps/api/src/hypothesis/hypothesis-intent-extraction-provider.config.ts',
  candidateProviderConfig: 'apps/api/src/hypothesis/hypothesis-candidate-generator-provider.config.ts',
  a2Smoke: 'apps/api/scripts/verify-a2-end-to-end-runtime-smoke.ts',
  fullIntelligenceSmoke: 'apps/api/scripts/verify-full-intelligence-end-to-end-runtime.ts',
});
const shipped = Object.freeze({
  ...Object.fromEntries(Object.entries(SOURCES).map(([key, path]) => [key, read(path)])),
  migrations: Object.freeze(readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql'))),
});

const CONTRACT_SCRIPT = 'test:post-response-intelligence-scheduler-provider-budget-v1-contract';
const CONTRACT_COMMAND = 'node --test tests/post-response-intelligence-scheduler-provider-budget-v1-contract.test.mjs';

// The EXACT frozen v1 provider-backed registry and cap, quoted here
// independently of the implementation so a silent widening fails this guard.
const PROVIDER_EFFECTS = Object.freeze(['ASSOCIATION_PROVIDER', 'INTENT_PROVIDER', 'CANDIDATE_PROVIDER']);
const PROVIDER_BUDGET = 3;
// The canonical durable effects that cross NO provider boundary and must never
// consume a slot.
const NON_PROVIDER_EFFECTS = Object.freeze([
  'MEMORY_WRITE', 'HYPOTHESIS_UPDATE_BATCH', 'HYPOTHESIS_PERSISTENCE', 'CONFIDENCE_BATCH', 'HIM_BRAIN_CONTEXT_MATERIALIZATION',
]);
// The ONE provider transport call site per provider-backed effect, which must
// sit AFTER that effect's slot was spent by a successful durable claim.
const PROVIDER_TRANSPORTS = Object.freeze({
  ASSOCIATION_PROVIDER: 'this.association.proposeAndAuthorize(',
  INTENT_PROVIDER: 'this.extraction.extract(',
  CANDIDATE_PROVIDER: 'this.enrichment.generateHypothesisCandidatePlan(',
});
// The frozen zero-retry constant of each canonical v1 provider boundary. Only
// the retry constant is read from these modules: no model, vendor, timeout or
// token value ever enters this guard.
const ZERO_RETRY_CONSTANTS = Object.freeze({
  associationProviderConfig: 'HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_RETRIES',
  intentProviderConfig: 'HYPOTHESIS_INTENT_EXTRACTION_MAX_RETRIES',
  candidateProviderConfig: 'HYPOTHESIS_CANDIDATE_GENERATION_MAX_RETRIES',
});

// Required statements of the normative document, checked against
// whitespace-flattened text so markdown line wrapping never splits a marker.
const REQUIRED_DOC_STATEMENTS = Object.freeze([
  // Identity.
  '# QANDEEL — Post-Response Intelligence Scheduler & Provider Budget v1',
  '**Task:** QIR-005 — Post-Response Intelligence Scheduler & Provider Budget v1',
  '**Status: ACTIVE / NORMATIVE**',
  'requires its own versioned, separately reviewed superseding contract',
  // Canonical entry baseline.
  'a6aa99e91c9c2817308b5c016ebe0ba9e3fcf7e8',
  '51005e4189bfd3ee23892c196c5f300dbd7d0df8',
  'PR #180',
  '33310126117',
  '0062_fast_deep_runtime_decision_policy_v2.sql',
  // The frozen no-migration fact, recorded here, banning nothing future.
  '**QIR-005 adds NO database migration.** The migration baseline remains 0062.',
  'it bans nothing about the future',
  'including migration 0063 and any later number — is legal',
  // The frozen registry and cap.
  'POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 3',
  'ASSOCIATION_PROVIDER = maximum 1 provider slot',
  'INTENT_PROVIDER      = maximum 1 provider slot',
  'CANDIDATE_PROVIDER   = maximum 1 provider slot',
  'The cap equals the size of the frozen v1 provider-backed registry',
  '**Provider-backed membership is explicit and centralized, never inferred.**',
  'never computed from an effect-name substring',
  '**A fourth provider-backed post-response effect cannot be introduced silently.**',
  // QIR-005 Fix 01 - the exhaustive classification law.
  '**The classification is EXHAUSTIVE over the current `IntelligenceEffect` union, and the `satisfies Record<IntelligenceEffect, PostResponseProviderClassification>` clause is what makes it total.**',
  'Adding a member to `INTELLIGENCE_EFFECTS` without adding its entry here is a COMPILE ERROR',
  '**Classification is a keyed lookup, never a name pattern.**',
  'The two relations are deliberately **not derived from each other** in either direction.',
  '**Classifying a fourth effect `PROVIDER` therefore FAILS the QIR-005 v1 contract**',
  '**A future NON-provider durable effect is legitimate and requires no QIR-005 v2.**',
  '**not a runtime workflow planner**',
  '**It is never configurable through an environment variable**',
  'never raised dynamically at runtime',
  // Lifecycle scope and no reset.
  '**Process restart, Redis reclaim, duplicate delivery, redispatch or execution reacquisition must not reset the budget.**',
  'The durable effect ledger is the authoritative source of already-spent provider slots, and it is the ONLY input to the reconstruction.',
  // What spends a slot.
  'only after the provider-backed effect has been durably claimed successfully',
  '**A mere intention to invoke a provider does not spend a slot.**',
  '**A failed durable claim spends no new local slot and must issue zero provider calls.**',
  // No refunds.
  '**its slot is permanently spent for that execution and is never refunded**',
  'the runtime cannot safely prove that an external provider request was never emitted',
  // Recovery accounting.
  '**Both `CLAIMED` and `COMPLETED` provider-backed effects count as spent.**',
  '**It is never replayed and its slot is never refunded.**',
  'issues **zero provider calls**',
  // The narrow abstraction.
  '**It is not a generic workflow engine.**',
  '**The dispatcher remains the composition and execution engine.**',
  'the dispatcher — not the budget — issues the durable effect claim',
  // Dependency graph.
  '**QIR-005 parallelizes nothing.**',
  'These are real semantic dependencies, not an accident of implementation order.',
  '**The existing HIM Hypothesis-Generation Context read remains BEFORE the Candidate claim**',
  // Exhaustion.
  '**Provider budget exhaustion is therefore an integrity/contract violation, not ordinary optional degradation.**',
  'provider transport calls = 0',
  '**it never fabricates an intelligence result, it never substitutes stale data for a missing result, and it never increases the cap dynamically.**',
  'closed `CHECK` domain frozen by migration 0022',
  '**The provider-budget identity is carried by the dedicated `PROVIDER_BUDGET` stage, which no other dispatcher path writes**',
  // At-most-once transport.
  '**No post-response provider-backed effect may perform a retry, an SDK retry, a fallback model, a fallback vendor, a speculative fan-out, a provider race, a second call after timeout, or a second call after invalid output.**',
  'HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_RETRIES = 0',
  'HYPOTHESIS_INTENT_EXTRACTION_MAX_RETRIES = 0',
  'HYPOTHESIS_CANDIDATE_GENERATION_MAX_RETRIES = 0',
  '**not** the final QANDEEL product/provider selection, which stays explicitly deferred',
  // Frozen recovery semantics.
  '**QIR-005 weakens none of these in order to simplify the scheduler.**',
  // Brain Context / Information Gap / QIR-006.
  '**consumes zero provider budget**',
  '**is not moved behind Hypothesis-generation eligibility**',
  '**QIR-005 creates no Question provider call, no foreground Question consumption, and moves no formal-question authority into another subsystem. That work belongs to QIR-006 and is not implemented here.**',
  // Telemetry.
  'qandeel.post_response.provider_budget',
  '**`AUTHORIZED` is recorded only after a successful durable claim, when the new provider slot is actually spent — never for a mere intention to call a provider.**',
  '**`RECOVERED` is recorded when a valid durable completed provider effect is consumed with zero provider call.**',
  '**`EXHAUSTED` is recorded before any provider transport**',
  '**Telemetry failure remains fail-soft and can never change a budget decision, a durable claim, or the execution.**',
  // The frozen invariant.
  'Association provider attempts <= 1',
  'Intent provider attempts      <= 1',
  'Candidate provider attempts   <= 1',
  'total provider slots          <= 3',
  'remains OUTSIDE this post-response budget',
]);

const executable = (source) => source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const count = (source, needle) => source.split(needle).length - 1;
const sorted = (values) => [...values].sort().join(',');
const slice = (source, start, end) => {
  const from = source.indexOf(start);
  if (from < 0) return '';
  const to = source.indexOf(end, from + start.length);
  return to < 0 ? source.slice(from) : source.slice(from, to);
};

function violated(property) {
  throw new Error(`QIR-005 Post-Response Provider Budget contract violated: ${property}`);
}

function assertPostResponseProviderBudgetContract(world) {
  const exe = Object.fromEntries(Object.entries(world)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, source]) => [key, executable(source)]));

  // 1. The normative document exists, is substantive, and records every frozen
  //    statement (whitespace-flattened, wrap-safe).
  if (typeof world.contractDoc !== 'string' || world.contractDoc.length < 12000)
    violated('the QIR-005 normative document exists and is substantive');
  const flattened = world.contractDoc.replace(/\s+/gu, ' ');
  for (const statement of REQUIRED_DOC_STATEMENTS) {
    if (!flattened.includes(statement.replace(/\s+/gu, ' '))) violated(`the document records: ${statement}`);
  }
  if (!world.docsReadme.includes('post-response-intelligence-scheduler-provider-budget-v1.md'))
    violated('docs/README.md links the QIR-005 normative document');

  // 2. The hard cap is declared exactly once, centrally, and is never redefined
  //    away from 3 anywhere in the QIR-005 production surface.
  if (!world.budgetContract.includes(`export const POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = ${PROVIDER_BUDGET};`))
    violated(`the hard provider budget is declared exactly: POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = ${PROVIDER_BUDGET}`);
  if (new RegExp(`POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = (?!${PROVIDER_BUDGET};)`, 'u')
    .test(exe.budgetContract + exe.budgetService + exe.dispatcher + exe.telemetry))
    violated(`the hard provider budget is never redefined away from ${PROVIDER_BUDGET}`);
  // The cap is a compile-time constant: never an environment variable, never a
  // per-deployment or per-path value.
  if (/process\.env/u.test(exe.budgetContract + exe.budgetService))
    violated('the provider budget is never configurable through an environment variable');

  // 3. The EXACT provider-backed registry, parsed from the literal so a fourth
  //    member cannot be added silently and a member cannot be renamed away.
  const registry = /export const POST_RESPONSE_PROVIDER_EFFECTS_V1 = \[([\s\S]*?)\] as const;/u.exec(world.budgetContract);
  if (!registry) violated('the frozen provider-backed effect registry is declared as one explicit literal');
  const members = [...registry[1].matchAll(/'([A-Z_]+)'/gu)].map((match) => match[1]);
  if (members.length !== PROVIDER_EFFECTS.length || PROVIDER_EFFECTS.some((effect, index) => members[index] !== effect))
    violated(`the frozen provider-backed registry is exactly ${PROVIDER_EFFECTS.join(', ')}`);
  if (registry[1].replace(/'[A-Z_]+',?/gu, '').replace(/\/\/.*$/gmu, '').trim().length !== 0)
    violated('the frozen provider-backed registry carries nothing but its exact literal members');
  if (PROVIDER_BUDGET !== members.length)
    violated('the hard cap equals the size of the frozen provider-backed registry');
  for (const effect of NON_PROVIDER_EFFECTS) {
    if (members.includes(effect)) violated(`a non-provider effect is not in the provider registry: ${effect}`);
    if (!world.effectTypes.includes(`'${effect}'`))
      violated(`the canonical durable effect still exists outside the provider registry: ${effect}`);
  }
  // Membership is a set lookup, never inferred from the effect NAME.
  if (/endsWith\(|startsWith\(|\.match\(|includes\('_PROVIDER'\)|\/PROVIDER\//u.test(exe.budgetContract))
    violated('provider-backed membership is never inferred by effect-name matching');
  if (!exe.budgetContract.includes('POST_RESPONSE_PROVIDER_EFFECT_KEYS.has(value)'))
    violated('provider-backed membership is an exact registry lookup');
  if (/INTELLIGENCE_EFFECTS/u.test(exe.budgetContract))
    violated('the provider registry is never derived from the full canonical effect list');

  // 3b. QIR-005 Fix 01 - the provider/non-provider classification is EXHAUSTIVE
  //     over the CURRENT canonical effect union, and its PROVIDER half is
  //     exactly the frozen registry.
  //
  //     This is the rule that makes a silent fourth provider effect impossible
  //     even when the drift happens in INTELLIGENCE_EFFECTS rather than in the
  //     protected registry: a new canonical effect with no classification entry
  //     fails here, and a new effect classified PROVIDER fails the equality
  //     below. Both sets are read from the shipped literals, so the relation is
  //     compared dynamically rather than restated.
  const canonical = /export const INTELLIGENCE_EFFECTS\s*=\s*\[([\s\S]*?)\]\s*as const;/u.exec(world.effectTypes);
  if (!canonical) violated('the canonical durable effect union is declared as one explicit literal');
  const canonicalEffects = [...canonical[1].matchAll(/'([A-Z_]+)'/gu)].map((match) => match[1]);
  if (canonicalEffects.length < PROVIDER_EFFECTS.length)
    violated('the canonical durable effect union is substantive');
  for (const effect of PROVIDER_EFFECTS) {
    if (!canonicalEffects.includes(effect))
      violated(`the frozen provider-backed effect is still a canonical durable effect: ${effect}`);
  }
  if (!world.budgetContract.includes("export type PostResponseProviderClassification = 'PROVIDER' | 'NON_PROVIDER';"))
    violated('the classification domain is exactly PROVIDER | NON_PROVIDER');
  const classificationBlock = /export const POST_RESPONSE_EFFECT_PROVIDER_CLASSIFICATION_V1 = \{([\s\S]*?)\} as const satisfies Record<IntelligenceEffect, PostResponseProviderClassification>;/u
    .exec(world.budgetContract);
  if (!classificationBlock)
    violated('the exhaustive provider classification is declared with its compile-time totality clause');
  const classified = [...classificationBlock[1].matchAll(/([A-Z_]+):\s*'(PROVIDER|NON_PROVIDER)'/gu)]
    .map((match) => ({ effect: match[1], classification: match[2] }));
  if (classificationBlock[1].replace(/[A-Z_]+:\s*'(?:NON_)?PROVIDER',?/gu, '').replace(/^\s*\/\/.*$/gmu, '').trim().length !== 0)
    violated('the exhaustive classification carries nothing but its exact literal entries');
  const classifiedKeys = classified.map((entry) => entry.effect);
  if (new Set(classifiedKeys).size !== classifiedKeys.length)
    violated('every canonical durable effect is classified exactly once');
  if (sorted(classifiedKeys) !== sorted(canonicalEffects))
    violated('the classification key set equals the CURRENT canonical INTELLIGENCE_EFFECTS set exactly');
  const providerClassified = classified.filter((entry) => entry.classification === 'PROVIDER').map((entry) => entry.effect);
  if (sorted(providerClassified) !== sorted(PROVIDER_EFFECTS))
    violated('the effects classified PROVIDER are exactly the frozen three provider-backed effects');
  if (sorted(providerClassified) !== sorted(members))
    violated('the classification PROVIDER half and the frozen v1 registry literal agree exactly');
  if (providerClassified.length !== PROVIDER_BUDGET)
    violated('the number of effects classified PROVIDER equals the hard provider budget');
  const nonProviderClassified = classified.filter((entry) => entry.classification === 'NON_PROVIDER').map((entry) => entry.effect);
  for (const effect of NON_PROVIDER_EFFECTS) {
    if (!nonProviderClassified.includes(effect))
      violated(`the canonical non-provider durable effect is explicitly classified NON_PROVIDER: ${effect}`);
  }

  // 4. Spent-slot reconstruction reads durable effect state ONLY, and counts
  //    BOTH CLAIMED and COMPLETED.
  if (!exe.budgetContract.includes("if (effect.state !== 'CLAIMED' && effect.state !== 'COMPLETED') continue;"))
    violated('spent-slot reconstruction counts BOTH a CLAIMED and a COMPLETED provider effect');
  if (!exe.budgetService.includes('reconstructSpentProviderSlots(effects)'))
    violated('the opened budget is reconstructed from the durable effect ledger');
  // Nothing about the DELIVERY may influence the reconstruction, or the budget
  // would reset per delivery/reclaim/process.
  if (/attempt_count|Date\.|Math\.random|redis|reclaim|delivery/iu.test(exe.budgetService + exe.budgetContract))
    violated('the provider budget never depends on the delivery, reclaim, attempt count, clock or process');

  // 5. A spent slot is NEVER refunded and the cap is never raised at runtime.
  if (/spentSlots\.(delete|clear)\(|refund/u.test(exe.budgetContract))
    violated('a durably spent provider slot is never refunded');
  if (!exe.budgetContract.includes('  recover(effect: PostResponseProviderEffect): void {\n    this.record(effect, \'RECOVERED\');\n  }'))
    violated('durable recovery records telemetry only and never frees or spends a slot');
  if (!exe.budgetContract.includes('if (this.spentSlots.has(effect) || this.spentSlots.size >= POST_RESPONSE_PROVIDER_CALL_BUDGET_V1) {'))
    violated('authorization is refused for an already spent effect and once the hard cap is reached');
  if (!exe.budgetContract.includes("      this.record(effect, 'EXHAUSTED');\n      return 'EXHAUSTED';"))
    violated('the exhaustion decision is recorded BEFORE the refusal returns, ahead of any transport');
  // authorize() must not spend: a mere intention, or a failed durable claim,
  // consumes nothing.
  const authorizeBody = /  authorize\(effect: PostResponseProviderEffect\): PostResponseProviderBudgetAuthorization \{([\s\S]*?)\n  \}/u.exec(exe.budgetContract);
  if (!authorizeBody) violated('the authorization gate is one explicit method');
  if (/spentSlots\.add\(/u.test(authorizeBody[1]))
    violated('authorization alone never spends a provider slot');

  // 6. The dispatcher opens the budget EXACTLY ONCE per durable execution, from
  //    the durable ledger snapshot - never once per stage or per delivery.
  if (count(exe.dispatcher, 'this.providerBudget.open(') !== 1)
    violated('the dispatcher opens the provider budget exactly once per durable execution');
  if (!exe.dispatcher.includes('const budget=this.providerBudget.open(effects,execution.processing_path);'))
    violated('the provider budget is opened from the durable effect ledger snapshot');

  // 7. THE CENTRAL LAW. Every fresh provider-backed effect passes the gate
  //    BEFORE its durable claim, spends its slot ONLY after the claim
  //    succeeded, and issues its single provider transport only after that.
  for (const effect of PROVIDER_EFFECTS) {
    const authorize = `budget.authorize('${effect}')==='EXHAUSTED'`;
    const claim = `this.ledger.claim(execution.id,'${effect}')`;
    const spend = `budget.spend('${effect}')`;
    const transport = PROVIDER_TRANSPORTS[effect];
    if (count(exe.dispatcher, authorize) !== 1) violated(`exactly one centralized budget gate exists for ${effect}`);
    if (count(exe.dispatcher, claim) !== 1) violated(`exactly one durable claim exists for ${effect}`);
    if (count(exe.dispatcher, spend) !== 1) violated(`exactly one slot spend exists for ${effect}`);
    if (count(exe.dispatcher, transport) !== 1)
      violated(`exactly one provider transport call site exists for ${effect}`);
    const gateIndex = exe.dispatcher.indexOf(authorize);
    const claimIndex = exe.dispatcher.indexOf(claim);
    const spendIndex = exe.dispatcher.indexOf(spend);
    const transportIndex = exe.dispatcher.indexOf(transport);
    if (!(gateIndex < claimIndex)) violated(`the budget gate runs BEFORE the durable claim for ${effect}`);
    if (!(claimIndex < spendIndex)) violated(`the slot is spent only AFTER the durable claim for ${effect}`);
    if (!(spendIndex < transportIndex)) violated(`the provider transport runs only AFTER the slot is spent for ${effect}`);
    // A durably completed effect is recovered, never replayed.
    if (count(exe.dispatcher, `budget.recover('${effect}')`) < 1)
      violated(`a durably completed ${effect} is recovered with zero provider replay`);
  }
  // The claim is issued by the DISPATCHER, so the budget abstraction can never
  // become a generic workflow engine that runs the work itself.
  if (/ledger|repository|claim\(|fetch\(/iu.test(exe.budgetContract + exe.budgetService))
    violated('the narrow budget abstraction never performs the durable claim or any I/O');

  // 8. Candidate keeps the HIM generation-context read BEFORE its claim, so a
  //    HIM failure can never strand CANDIDATE_PROVIDER in CLAIMED.
  const himRead = exe.dispatcher.indexOf('this.enrichment.readHimHypothesisGenerationContext(context)');
  if (himRead < 0) violated('the HIM Hypothesis-Generation context read still exists on the fresh Candidate path');
  if (!(himRead < exe.dispatcher.indexOf("this.ledger.claim(execution.id,'CANDIDATE_PROVIDER')")))
    violated('the HIM generation-context read stays BEFORE the Candidate claim');

  // 9. The true dependency ordering, read from the ONE dispatch composition
  //    body rather than from source-file layout, and no speculative parallelism.
  const dispatchBody = slice(exe.dispatcher, ' async dispatch(raw:string)', ' private async materializeHimBrainContext(');
  if (dispatchBody.length === 0) violated('the dispatch composition body is identifiable');
  const stageOrder = [
    ['Association provider', 'this.completeAssociation(execution,budget,'],
    ['Intent provider', "budget.authorize('INTENT_PROVIDER')"],
    ['Candidate provider', "budget.authorize('CANDIDATE_PROVIDER')"],
    ['Hypothesis persistence', "this.ledger.claim(execution.id,'HYPOTHESIS_PERSISTENCE')"],
    ['Confidence batch', 'return this.confidenceBatch(execution,effects,acceptedHypothesisIds);'],
  ];
  let previous = -1;
  for (const [label, needle] of stageOrder) {
    const index = dispatchBody.indexOf(needle);
    if (index < 0) violated(`the dispatch composition still runs the stage: ${label}`);
    if (index < previous) violated(`the frozen sequential dependency order is preserved at: ${label}`);
    previous = index;
  }
  // Association preparation and the Information Gap sync stay upstream of the
  // Intent provider, and the generation-eligibility gate stays ahead of it too.
  for (const upstream of ['this.association.prepare(context,freshEvidenceId)', 'const gapSync=await this.syncInformationGaps(execution);', 'this.enrichment.evaluateGenerationEligibility(']) {
    const index = dispatchBody.indexOf(upstream);
    if (index < 0 || index > dispatchBody.indexOf("budget.authorize('INTENT_PROVIDER')"))
      violated(`the upstream stage stays BEFORE fresh Intent provider work: ${upstream}`);
  }
  if (/Promise\.(race|any|allSettled)\s*\(/u.test(exe.dispatcher))
    violated('no provider racing or speculative fan-out exists on the post-response path');

  // 10. Deterministic terminal exhaustion: zero transport, terminal quarantine,
  //     one centralized identity, and a stage no other path writes.
  if (!world.budgetContract.includes("export const POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_STAGE = 'PROVIDER_BUDGET';"))
    violated('the provider-budget exhaustion stage is exactly PROVIDER_BUDGET');
  if (!/export const POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_OUTCOME = '[A-Z_]+';/u.test(world.budgetContract))
    violated('the provider-budget exhaustion outcome is one centralized frozen literal');
  if (!exe.dispatcher.includes("return this.terminal(execution,'QUARANTINED',POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_OUTCOME,POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_STAGE);"))
    violated('provider-budget exhaustion is a TERMINAL QUARANTINE carrying the centralized frozen identity');
  if (count(exe.dispatcher, 'this.providerBudgetExhausted(execution)') < PROVIDER_EFFECTS.length - 1)
    violated('every fresh provider gate routes exhaustion through the one terminal helper');
  if (count(exe.dispatcher, "'PROVIDER_BUDGET'") !== 0)
    violated('the exhaustion stage literal is never inlined outside the frozen contract module');

  // 11. Zero retries at the three canonical provider boundaries: the frozen
  //     integration requirement of at-most-once external transport.
  for (const [source, constant] of Object.entries(ZERO_RETRY_CONSTANTS)) {
    if (!world[source].includes(`export const ${constant} = 0 as const;`))
      violated(`the canonical provider boundary is frozen at zero retries: ${constant} = 0`);
    if (new RegExp(`${constant} = (?!0 as const;)`, 'u').test(exe[source]))
      violated(`the zero-retry constant is never redefined away from 0: ${constant}`);
    if (new RegExp(`maxRetries: (?!${constant}\\b|typeof ${constant}\\b|0\\b)`, 'u').test(exe[source]))
      violated(`the provider client is wired to the frozen zero-retry constant: ${constant}`);
  }
  if (/fallbackModel|fallbackProvider|secondAttempt|retryProvider|providerRace/iu.test(exe.dispatcher + exe.budgetContract + exe.budgetService))
    violated('no provider fallback, retry or race is introduced on the post-response provider path');

  // 12. Bounded, fail-soft telemetry that reuses the SAME frozen registries.
  if (!world.telemetry.includes("createCounter('qandeel.post_response.provider_budget')"))
    violated('the bounded provider-budget telemetry surface is qandeel.post_response.provider_budget');
  if (!exe.telemetry.includes("from'../post-response-intelligence/post-response-provider-budget'"))
    violated('telemetry reuses the frozen QIR-005 registries rather than redeclaring them');
  for (const guard of [
    'if(!POST_RESPONSE_PROVIDER_EFFECT_KEYS.has(effect))return;',
    'if(!POST_RESPONSE_PROVIDER_BUDGET_DECISION_KEYS.has(decision))return;',
    "if(typeof path!=='string'||!isRuntimeRoutingPath(path))return;",
  ]) {
    if (!exe.telemetry.includes(guard)) violated(`the provider-budget metric drops anything outside its finite registry: ${guard}`);
  }
  if (!exe.telemetry.includes('this.postResponseProviderBudgetDecisions.add?.(1,{effect,decision,processing_path:path,policy_version:POST_RESPONSE_PROVIDER_BUDGET_POLICY_VERSION});'))
    violated('the provider-budget metric emits exactly four bounded label dimensions');
  if (!exe.telemetry.includes('recordPostResponseProviderBudget(effect:string,decision:string,path:string|null):void{this.safeVoid('))
    violated('the provider-budget metric is fail-soft');
  if (!world.budgetContract.includes('try { this.recorder(effect, decision); } catch { /* fail-soft */ }'))
    violated('a throwing telemetry recorder can never change a budget decision');

  // 13. Wiring: the narrow service is a real injected provider, and the
  //     behavioural + E2E proofs actually exercise the frozen budget.
  if (!world.postResponseModule.includes('PostResponseProviderBudgetService'))
    violated('the narrow provider-budget service is wired into the post-response module');
  if (!exe.dispatcher.includes('private readonly providerBudget:PostResponseProviderBudgetService'))
    violated('the dispatcher consumes the narrow provider-budget service by injection');
  for (const source of ['budgetSpec', 'dispatcherSpec', 'a2Smoke', 'fullIntelligenceSmoke']) {
    if (!world[source].includes('POST_RESPONSE_PROVIDER_CALL_BUDGET_V1'))
      violated(`the frozen cap is proven, not restated, in: ${SOURCES[source]}`);
  }
  for (const source of ['a2Smoke', 'fullIntelligenceSmoke']) {
    if (!world[source].includes('reconstructSpentProviderSlots'))
      violated(`the real E2E proof reconstructs spent slots with the production function: ${SOURCES[source]}`);
  }

  // 14. QIR-005 adds NO migration. The ONLY migration rule is the EXISTENCE of
  //     the frozen 0062 entry baseline: no future migration is banned.
  if (!Array.isArray(world.migrations)) violated('the world carries the database migration listing');
  if (!world.migrations.includes('0062_fast_deep_runtime_decision_policy_v2.sql'))
    violated('the QIR-005 entry migration baseline 0062 exists');
}

test('B1 - the shipped repository satisfies the QIR-005 contract', () => {
  assert.doesNotThrow(() => assertPostResponseProviderBudgetContract(shipped));
});

// Rewrites one normative statement in the shipped document, wrap-insensitively,
// and FAILS LOUDLY if the fixture ever goes stale - so a B2 drift can never
// silently degrade into a no-op that proves nothing.
// QIR-005 Fix 01 drift helpers. Both FAIL LOUDLY if their fixture goes stale, so
// a classification drift can never degrade into a no-op that proves nothing.
const addCanonicalEffect = (effect) => {
  const anchor = "'HIM_BRAIN_CONTEXT_MATERIALIZATION']as const;";
  if (!shipped.effectTypes.includes(anchor)) throw new Error('B2 canonical-effect fixture is stale');
  return shipped.effectTypes.replace(anchor, `'HIM_BRAIN_CONTEXT_MATERIALIZATION','${effect}']as const;`);
};
const classifyEffect = (effect, classification) => {
  const anchor = "  MEMORY_WRITE: 'NON_PROVIDER',";
  if (!shipped.budgetContract.includes(anchor)) throw new Error('B2 classification fixture is stale');
  return shipped.budgetContract.replace(anchor, `${anchor}\n  ${effect}: '${classification}',`);
};

const rewriteDoc = (find, replacement) => {
  const pattern = new RegExp(find.trim().split(/\s+/u)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('\\s+'), 'u');
  if (!pattern.test(shipped.contractDoc)) throw new Error(`B2 document fixture is stale: ${find}`);
  return shipped.contractDoc.replace(pattern, replacement);
};

test('B2 - anti-vacuity: the real guard rejects every named regression', () => {
  const drifts = [
    ['the normative document was deleted', { contractDoc: '' }],
    ['the no-migration fact was withdrawn', {
      contractDoc: rewriteDoc('**QIR-005 adds NO database migration.**', 'QIR-005 adds one migration.'),
    }],
    ['the no-refund rule was withdrawn from the document', {
      contractDoc: rewriteDoc('**its slot is permanently spent for that execution and is never refunded**', 'its slot may be refunded'),
    }],
    ['the no-reset rule was withdrawn from the document', {
      contractDoc: rewriteDoc('**Process restart, Redis reclaim, duplicate delivery, redispatch or execution reacquisition must not reset the budget.**', 'A redelivery may reset the budget.'),
    }],
    ['the durable-ledger authority was withdrawn from the document', {
      contractDoc: rewriteDoc('The durable effect ledger is the authoritative source of already-spent provider slots, and it is the ONLY input to the reconstruction.', 'The budget is rebuilt per delivery.'),
    }],
    ['the never-inferred membership rule was withdrawn', {
      contractDoc: rewriteDoc('**Provider-backed membership is explicit and centralized, never inferred.**', 'Provider-backed membership may be inferred.'),
    }],
    ['the no-silent-fourth-effect rule was withdrawn', {
      contractDoc: rewriteDoc('**A fourth provider-backed post-response effect cannot be introduced silently.**', 'A fourth provider-backed effect may be added at any time.'),
    }],
    ['the workflow-engine prohibition was withdrawn', {
      contractDoc: rewriteDoc('**It is not a generic workflow engine.**', 'It may become a generic workflow engine.'),
    }],
    ['the zero-retry prohibition was withdrawn from the document', {
      contractDoc: rewriteDoc('**No post-response provider-backed effect may perform a retry, an SDK retry, a fallback model, a fallback vendor, a speculative fan-out, a provider race, a second call after timeout, or a second call after invalid output.**', 'Retries are allowed.'),
    }],
    ['the zero-provider-replay recovery rule was withdrawn', {
      contractDoc: rewriteDoc('**Both `CLAIMED` and `COMPLETED` provider-backed effects count as spent.**', 'Only COMPLETED effects count as spent.'),
    }],
    ['the AUTHORIZED telemetry semantics were withdrawn', {
      contractDoc: rewriteDoc('**`AUTHORIZED` is recorded only after a successful durable claim, when the new provider slot is actually spent — never for a mere intention to call a provider.**', 'AUTHORIZED is recorded on intent.'),
    }],
    ['the QIR-006 exclusion was withdrawn', {
      contractDoc: rewriteDoc('That work belongs to QIR-006 and is not implemented here.', 'That work is implemented here.'),
    }],
    ['the docs index lost the document link', {
      docsReadme: shipped.docsReadme.replaceAll('post-response-intelligence-scheduler-provider-budget-v1.md', 'missing.md'),
    }],
    ['the hard cap was raised', {
      budgetContract: shipped.budgetContract.replace('export const POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 3;', 'export const POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 4;'),
    }],
    ['the hard cap became environment-configurable', {
      budgetContract: shipped.budgetContract.replace('export const POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 3;',
        'export const POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = Number(process.env.POST_RESPONSE_PROVIDER_CALL_BUDGET ?? 3);'),
    }],
    ['a fourth provider-backed effect was added silently', {
      budgetContract: shipped.budgetContract.replace("  'CANDIDATE_PROVIDER',\n] as const;", "  'CANDIDATE_PROVIDER',\n  'QUESTION_PROVIDER',\n] as const;"),
    }],
    // QIR-005 Fix 01 - the drift cases that live OUTSIDE the protected registry.
    // A..E are the real silent-drift shapes: the previous matrix only edited the
    // registry itself, which is the case a reviewer would already notice.
    ['A - a new canonical effect entered INTELLIGENCE_EFFECTS with no classification entry', {
      effectTypes: addCanonicalEffect('QUESTION_GAP_SYNC'),
    }],
    ['B - a new canonical effect was classified PROVIDER while the frozen v1 registry stayed at three', {
      effectTypes: addCanonicalEffect('QUESTION_GAP_SYNC'),
      budgetContract: classifyEffect('QUESTION_GAP_SYNC', 'PROVIDER'),
    }],
    ['C - an existing provider effect was reclassified NON_PROVIDER', {
      budgetContract: shipped.budgetContract.replace("  INTENT_PROVIDER: 'PROVIDER',", "  INTENT_PROVIDER: 'NON_PROVIDER',"),
    }],
    ['C - a second existing provider effect was reclassified NON_PROVIDER', {
      budgetContract: shipped.budgetContract.replace("  ASSOCIATION_PROVIDER: 'PROVIDER',", "  ASSOCIATION_PROVIDER: 'NON_PROVIDER',"),
    }],
    ['D - a current non-provider effect was reclassified PROVIDER', {
      budgetContract: shipped.budgetContract.replace("  MEMORY_WRITE: 'NON_PROVIDER',", "  MEMORY_WRITE: 'PROVIDER',"),
    }],
    ['D - the managed Brain Context effect was reclassified PROVIDER', {
      budgetContract: shipped.budgetContract.replace("  HIM_BRAIN_CONTEXT_MATERIALIZATION: 'NON_PROVIDER',", "  HIM_BRAIN_CONTEXT_MATERIALIZATION: 'PROVIDER',"),
    }],
    ['E - the provider registry was widened to a fourth member with a matching classification', {
      effectTypes: addCanonicalEffect('QUESTION_GAP_SYNC'),
      budgetContract: classifyEffect('QUESTION_GAP_SYNC', 'PROVIDER')
        .replace("  'CANDIDATE_PROVIDER',\n] as const;", "  'CANDIDATE_PROVIDER',\n  'QUESTION_GAP_SYNC',\n] as const;"),
    }],
    ['F - the compile-time totality clause was removed from the classification', {
      budgetContract: shipped.budgetContract.replace(
        '} as const satisfies Record<IntelligenceEffect, PostResponseProviderClassification>;', '} as const;'),
    }],
    ['F - the classification was widened past its two-value domain', {
      budgetContract: shipped.budgetContract.replace(
        "export type PostResponseProviderClassification = 'PROVIDER' | 'NON_PROVIDER';",
        "export type PostResponseProviderClassification = 'PROVIDER' | 'NON_PROVIDER' | 'UNKNOWN';"),
    }],
    ['G - classification became effect-name inference', {
      budgetContract: shipped.budgetContract.replace("  MEMORY_WRITE: 'NON_PROVIDER',", "  MEMORY_WRITE: effect.endsWith('_PROVIDER') ? 'PROVIDER' : 'NON_PROVIDER',"),
    }],
    ['G - a classification entry was dropped, leaving a canonical effect unclassified', {
      budgetContract: shipped.budgetContract.replace("  CONFIDENCE_BATCH: 'NON_PROVIDER',\n", ''),
    }],
    ['G - the canonical effect union literal was hidden from the guard', {
      effectTypes: shipped.effectTypes.replace('export const INTELLIGENCE_EFFECTS=', 'export const INTELLIGENCE_EFFECTS:readonly string[]=derive();\nconst _unused='),
    }],
    ['a provider-backed effect was dropped from the registry', {
      budgetContract: shipped.budgetContract.replace("  'INTENT_PROVIDER',\n", ''),
    }],
    ['a non-provider effect was pulled into the provider registry', {
      budgetContract: shipped.budgetContract.replace("  'ASSOCIATION_PROVIDER',", "  'MEMORY_WRITE',\n  'ASSOCIATION_PROVIDER',"),
    }],
    ['membership became effect-name inference', {
      budgetContract: shipped.budgetContract.replace('  return POST_RESPONSE_PROVIDER_EFFECT_KEYS.has(value);', "  return value.endsWith('_PROVIDER');"),
    }],
    ['a CLAIMED provider effect stopped counting as spent', {
      budgetContract: shipped.budgetContract.replace("if (effect.state !== 'CLAIMED' && effect.state !== 'COMPLETED') continue;", "if (effect.state !== 'COMPLETED') continue;"),
    }],
    ['a spent slot became refundable', {
      budgetContract: shipped.budgetContract.replace('  isSpent(effect: PostResponseProviderEffect): boolean { return this.spentSlots.has(effect); }',
        '  refund(effect: PostResponseProviderEffect): void { this.spentSlots.delete(effect); }'),
    }],
    ['durable recovery started freeing the slot it recovered', {
      budgetContract: shipped.budgetContract.replace("  recover(effect: PostResponseProviderEffect): void {\n    this.record(effect, 'RECOVERED');\n  }",
        "  recover(effect: PostResponseProviderEffect): void {\n    this.spentSlots.delete(effect);\n    this.record(effect, 'RECOVERED');\n  }"),
    }],
    ['authorization started spending the slot before the durable claim', {
      budgetContract: shipped.budgetContract.replace('      return \'EXHAUSTED\';\n    }\n    return \'AUTHORIZED\';',
        '      return \'EXHAUSTED\';\n    }\n    this.spentSlots.add(effect);\n    return \'AUTHORIZED\';'),
    }],
    ['the exhaustion decision stopped being recorded before the refusal', {
      budgetContract: shipped.budgetContract.replace("      this.record(effect, 'EXHAUSTED');\n      return 'EXHAUSTED';", "      return 'EXHAUSTED';"),
    }],
    ['the local duplicate-consumption guard was removed', {
      budgetContract: shipped.budgetContract.replace('if (this.spentSlots.has(effect) || this.spentSlots.size >= POST_RESPONSE_PROVIDER_CALL_BUDGET_V1) {',
        'if (this.spentSlots.size >= POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 + 1) {'),
    }],
    ['telemetry stopped being fail-soft inside the budget', {
      budgetContract: shipped.budgetContract.replace('try { this.recorder(effect, decision); } catch { /* fail-soft */ }', 'this.recorder(effect, decision);'),
    }],
    ['the budget started reading the delivery attempt count', {
      budgetService: shipped.budgetService.replace('reconstructSpentProviderSlots(effects),', 'attempt_count > 1 ? new Set() : reconstructSpentProviderSlots(effects),'),
    }],
    ['the budget stopped reconstructing from the durable ledger', {
      budgetService: shipped.budgetService.replace('reconstructSpentProviderSlots(effects),', 'new Set(),'),
    }],
    ['the narrow abstraction started performing the durable claim itself', {
      budgetService: `${shipped.budgetService}\n// drift\nexport class Drift { constructor(private readonly ledger: unknown) {} }\n`,
    }],
    ...PROVIDER_EFFECTS.flatMap((effect) => [
      [`the centralized budget gate was removed for ${effect}`, {
        dispatcher: shipped.dispatcher.replace(`budget.authorize('${effect}')==='EXHAUSTED'`, 'false'),
      }],
      [`the slot spend was removed for ${effect}`, {
        dispatcher: shipped.dispatcher.replace(`budget.spend('${effect}');`, ''),
      }],
      [`the durable recovery signal was removed for ${effect}`, {
        dispatcher: shipped.dispatcher.replaceAll(`budget.recover('${effect}');`, ''),
      }],
      [`the slot was spent BEFORE the durable claim succeeded for ${effect}`, {
        dispatcher: shipped.dispatcher
          .replace(`this.ledger.claim(execution.id,'${effect}')`, `__CLAIM_${effect}__`)
          .replace(`budget.spend('${effect}');`, '')
          .replace(`budget.authorize('${effect}')==='EXHAUSTED'`, `budget.authorize('${effect}')==='EXHAUSTED'||!budget.spend('${effect}')`)
          .replace(`__CLAIM_${effect}__`, `this.ledger.claim(execution.id,'${effect}')`),
      }],
    ]),
    ['the provider budget was reopened per stage instead of per execution', {
      dispatcher: shipped.dispatcher.replace("if(budget.authorize('INTENT_PROVIDER')==='EXHAUSTED')",
        "const budget2=this.providerBudget.open([],execution.processing_path);if(budget2.authorize('INTENT_PROVIDER')==='EXHAUSTED')"),
    }],
    ['exhaustion stopped being a terminal quarantine', {
      dispatcher: shipped.dispatcher.replace("return this.terminal(execution,'QUARANTINED',POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_OUTCOME,POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_STAGE);",
        "return this.terminal(execution,'SKIPPED',POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_OUTCOME,POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_STAGE);"),
    }],
    ['the exhaustion stage was inlined away from the frozen contract module', {
      dispatcher: shipped.dispatcher.replace('POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_STAGE);', "'PROVIDER_BUDGET');"),
    }],
    ['the exhaustion stage literal was renamed', {
      budgetContract: shipped.budgetContract.replace("export const POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_STAGE = 'PROVIDER_BUDGET';",
        "export const POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_STAGE = 'INTENT';"),
    }],
    ['the HIM generation-context read moved after the Candidate claim', {
      dispatcher: shipped.dispatcher
        .replace("let himContext:HimHypothesisGenerationContext;try{himContext=await this.enrichment.readHimHypothesisGenerationContext(context);}catch{return false;}\n", '')
        .replace("budget.spend('CANDIDATE_PROVIDER');", "budget.spend('CANDIDATE_PROVIDER');let himContext:HimHypothesisGenerationContext;try{himContext=await this.enrichment.readHimHypothesisGenerationContext(context);}catch{return false;}"),
    }],
    ['provider racing / speculative fan-out was introduced', {
      dispatcher: shipped.dispatcher.replace('const budget=this.providerBudget.open(effects,execution.processing_path);',
        'const budget=this.providerBudget.open(effects,execution.processing_path);await Promise.race([Promise.resolve(),Promise.resolve()]);'),
    }],
    ['a provider fallback was introduced', {
      dispatcher: shipped.dispatcher.replace("budget.spend('INTENT_PROVIDER');", "budget.spend('INTENT_PROVIDER');const fallbackModel=true;void fallbackModel;"),
    }],
    ...Object.entries(ZERO_RETRY_CONSTANTS).flatMap(([source, constant]) => [
      [`hidden SDK retries were enabled at ${constant}`, {
        [source]: shipped[source].replace(`export const ${constant} = 0 as const;`, `export const ${constant} = 2 as const;`),
      }],
      [`the provider client stopped using the frozen zero-retry constant: ${constant}`, {
        [source]: shipped[source].replace(new RegExp(`maxRetries: ${constant},`, 'u'), 'maxRetries: 3,'),
      }],
    ]),
    ['the provider-budget metric name was changed', {
      telemetry: shipped.telemetry.replace("createCounter('qandeel.post_response.provider_budget')", "createCounter('qandeel.post_response.budget')"),
    }],
    ['the provider-budget metric stopped validating the effect registry', {
      telemetry: shipped.telemetry.replace('if(!POST_RESPONSE_PROVIDER_EFFECT_KEYS.has(effect))return;', ''),
    }],
    ['the provider-budget metric stopped validating the decision registry', {
      telemetry: shipped.telemetry.replace('if(!POST_RESPONSE_PROVIDER_BUDGET_DECISION_KEYS.has(decision))return;', ''),
    }],
    ['the provider-budget metric started carrying an unbounded label', {
      telemetry: shipped.telemetry.replace('this.postResponseProviderBudgetDecisions.add?.(1,{effect,decision,processing_path:path,policy_version:POST_RESPONSE_PROVIDER_BUDGET_POLICY_VERSION});',
        'this.postResponseProviderBudgetDecisions.add?.(1,{effect,decision,processing_path:path,execution_id:String(path),policy_version:POST_RESPONSE_PROVIDER_BUDGET_POLICY_VERSION});'),
    }],
    ['the narrow service was unwired from the post-response module', {
      postResponseModule: shipped.postResponseModule.replaceAll('PostResponseProviderBudgetService', 'Unwired'),
    }],
    ['the dispatcher stopped injecting the narrow service', {
      dispatcher: shipped.dispatcher.replace('private readonly providerBudget:PostResponseProviderBudgetService', 'private readonly providerBudget:unknown'),
    }],
    ['the E2E proof stopped reconstructing spent slots with the production function', {
      fullIntelligenceSmoke: shipped.fullIntelligenceSmoke.replaceAll('reconstructSpentProviderSlots', 'localCount'),
    }],
    ['the A2 E2E proof stopped asserting the frozen cap', {
      a2Smoke: shipped.a2Smoke.replaceAll('POST_RESPONSE_PROVIDER_CALL_BUDGET_V1', '3'),
    }],
    ['the behavioural proof stopped asserting the frozen cap', {
      dispatcherSpec: shipped.dispatcherSpec.replaceAll('POST_RESPONSE_PROVIDER_CALL_BUDGET_V1', '3'),
    }],
    ['the entry migration baseline vanished', { migrations: Object.freeze([]) }],
  ];
  for (const [label, drift] of drifts) {
    assert.throws(
      () => assertPostResponseProviderBudgetContract({ ...shipped, ...drift }),
      /QIR-005 Post-Response Provider Budget contract violated/u,
      `the guard rejects: ${label}`,
    );
  }
});

test('B3 - forward safety: every change a later QIR task is expected to make stays legal', () => {
  // QIR-006: a foreground Question opportunity channel, a Question engine
  // surface, or any other Question work OUTSIDE the frozen post-response
  // provider registry may appear anywhere this guard does not read (proven in
  // B5). Adding a fourth POST-RESPONSE PROVIDER effect deliberately does NOT
  // stay legal - that is the versioned freeze this task owns, and it must be
  // reviewed rather than slipped in.
  const questionStage = shipped.dispatcher.replace(
    'return this.terminal(execution,\'COMPLETED\',\'COMPLETED\',\'DONE\');',
    'await this.syncInformationGaps(execution);return this.terminal(execution,\'COMPLETED\',\'COMPLETED\',\'DONE\');',
  );
  assert.notDeepEqual(questionStage, shipped.dispatcher);
  assert.doesNotThrow(() => assertPostResponseProviderBudgetContract({ ...shipped, dispatcher: questionStage }),
    'a later reviewed non-provider post-response stage stays legal');

  // QIR-005 Fix 01 forward safety. The exhaustive classification must NOT freeze
  // the current NUMBER of canonical durable effects. A later reviewed task may
  // add a new IntelligenceEffect and classify it NON_PROVIDER; the provider
  // budget of three is untouched and no QIR-005 v2 is required.
  for (const future of ['QUESTION_GAP_SYNC', 'RECOMMENDATION_MATERIALIZATION', 'FUTURE_MANAGED_EFFECT']) {
    const futureEffectTypes = addCanonicalEffect(future);
    const futureClassification = classifyEffect(future, 'NON_PROVIDER');
    assert.notDeepEqual(futureEffectTypes, shipped.effectTypes);
    assert.notDeepEqual(futureClassification, shipped.budgetContract);
    assert.doesNotThrow(() => assertPostResponseProviderBudgetContract({
      ...shipped, effectTypes: futureEffectTypes, budgetContract: futureClassification,
    }), `a future reviewed NON-provider durable effect stays legal: ${future}`);
  }
  // Several at once stays legal too: the guard freezes the PROVIDER half only.
  const manyEffects = shipped.effectTypes.replace("'HIM_BRAIN_CONTEXT_MATERIALIZATION']as const;",
    "'HIM_BRAIN_CONTEXT_MATERIALIZATION','FUTURE_ONE','FUTURE_TWO']as const;");
  const manyClassified = shipped.budgetContract.replace("  MEMORY_WRITE: 'NON_PROVIDER',",
    "  MEMORY_WRITE: 'NON_PROVIDER',\n  FUTURE_ONE: 'NON_PROVIDER',\n  FUTURE_TWO: 'NON_PROVIDER',");
  assert.doesNotThrow(() => assertPostResponseProviderBudgetContract({
    ...shipped, effectTypes: manyEffects, budgetContract: manyClassified,
  }), 'several future reviewed NON-provider durable effects stay legal at once');

  // A later reviewed, explicitly versioned contract may add its OWN separate
  // budget constant next to this one.
  const extended = `${shipped.budgetContract}\n// QIR-00x, separately reviewed.\nexport const POST_RESPONSE_QUESTION_BUDGET_V2 = 1;\n`;
  assert.doesNotThrow(() => assertPostResponseProviderBudgetContract({ ...shipped, budgetContract: extended }),
    'a later reviewed contract may add its own budget constant');

  // A later reviewed contract may add another bounded telemetry recorder.
  assert.doesNotThrow(() => assertPostResponseProviderBudgetContract({
    ...shipped,
    telemetry: `${shipped.telemetry}\n// QIR-00x recorder, separately reviewed.\n`,
  }), 'a later reviewed contract may append its own bounded recorder');

  // Future migrations: a later, separately reviewed migration stays legal - by
  // number AND by domain, including a v2 of this very task's domain.
  for (const future of ['0063_post_response_provider_budget_v2.sql', '0063_question_closed_loop_v1.sql', '0099_unrelated_future_authority.sql']) {
    assert.doesNotThrow(() => assertPostResponseProviderBudgetContract({
      ...shipped,
      migrations: Object.freeze([...shipped.migrations, future]),
    }), `a later reviewed migration stays legal: ${future}`);
  }
  // A later reviewed migration may extend the frozen outcome_code domain and
  // give this path its own literal code: the guard freezes the STAGE and the
  // centralized declaration, never one particular outcome literal.
  assert.doesNotThrow(() => assertPostResponseProviderBudgetContract({
    ...shipped,
    budgetContract: shipped.budgetContract.replace(
      /export const POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_OUTCOME = '[A-Z_]+';/u,
      "export const POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_OUTCOME = 'PROVIDER_BUDGET_EXHAUSTED';"),
  }), 'a later reviewed migration may give the exhaustion path its own outcome literal');

  // A later reviewed amendment may extend the normative document.
  assert.doesNotThrow(() => assertPostResponseProviderBudgetContract({
    ...shipped,
    contractDoc: `${shipped.contractDoc}\n\n## Amendment A1 (QIR-00x)\n\nRecorded under its own reviewed contract.\n`,
  }), 'a later reviewed document amendment stays legal');

  // A later QIR task may add its own static-contract CI step.
  const ciStepLine = shipped.ci.match(new RegExp(`^.*${CONTRACT_SCRIPT}.*$`, 'mu'))[0];
  assert.doesNotThrow(() => assertPostResponseProviderBudgetContract({
    ...shipped,
    ci: shipped.ci.replace(ciStepLine, `${ciStepLine}\n      - {name: Verify QIR-006 Question closed loop static contract, run: npm run test:qir-006-contract}`),
  }), 'a later QIR static-contract CI step stays legal');

  // Provider/model selection stays deferred: changing a model identifier,
  // timeout or token ceiling at a provider boundary must NOT fail this guard.
  const rebrandedModels = shipped.associationProviderConfig
    .replace(/DEFAULT_HYPOTHESIS_EVIDENCE_ASSOCIATION_MODEL = '[^']+'/u, "DEFAULT_HYPOTHESIS_EVIDENCE_ASSOCIATION_MODEL = 'qandeel-final-selection-v1'")
    .replace('DEFAULT_HYPOTHESIS_EVIDENCE_ASSOCIATION_TIMEOUT_MS = 5_000', 'DEFAULT_HYPOTHESIS_EVIDENCE_ASSOCIATION_TIMEOUT_MS = 7_000');
  assert.notDeepEqual(rebrandedModels, shipped.associationProviderConfig);
  assert.doesNotThrow(() => assertPostResponseProviderBudgetContract({ ...shipped, associationProviderConfig: rebrandedModels }),
    'final Provider/LLM selection stays deferred: model and timeout changes are legal');
});

test('B4 - the contract guard is wired into package scripts and CI', () => {
  const packageJson = JSON.parse(shipped.packageJson);
  assert.equal(packageJson.scripts[CONTRACT_SCRIPT], CONTRACT_COMMAND);
  assert.ok(!CONTRACT_COMMAND.includes('npx'), 'the guard is registered through the npm-only toolchain convention');
  const step = shipped.ci.indexOf(CONTRACT_SCRIPT);
  assert.ok(step > 0, 'CI runs the QIR-005 static contract');
  assert.ok(step < shipped.ci.indexOf('Apply all migrations to fresh PostgreSQL'),
    'it runs before the database bootstrap: a pure static guard needs no database');
});

test('B5 - the guard is structurally independent of every mutable census gap', () => {
  const worldPaths = Object.values(SOURCES);
  for (const excluded of [
    'apps/api/src/model-router/model-profile.registry.ts',
    'apps/api/src/intelligence-runtime/fast-deep-runtime-decision-policy-v2.ts',
    'apps/api/src/intelligence-runtime/integrated-context-budget-assembler.service.ts',
    'apps/api/src/conversation/conversation-orchestrator.service.ts',
    'apps/api/src/post-response-intelligence/redis-post-response-consumer.ts',
    'apps/api/src/post-response-intelligence/post-response-intelligence-consumer.service.ts',
    'apps/api/src/question/question.service.ts',
  ]) {
    assert.ok(!worldPaths.includes(excluded), `the guard world never includes ${excluded}`);
  }
  assert.ok(worldPaths.every((path) => !path.includes('providers/')),
    'the guard world never includes a provider adapter source');

  // The guard function itself never names a mutable-gap literal: not a vendor
  // model identifier, not a routing threshold, not a QIR-004 budget value, and
  // not a Redis/consumer topology value.
  const guardSource = assertPostResponseProviderBudgetContract.toString();
  for (const forbidden of [
    'DEEP_INPUT_LENGTH',
    'GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES',
    'FOREGROUND_INTELLIGENCE_BUDGET_MS',
    'POST_RESPONSE_REDIS_RETRY_MS',
    'xAutoClaim',
    ['claude', '-'].join(''),
    ['gpt', '-'].join(''),
    ['gem', 'ini'].join(''),
    ['ha', 'iku'].join(''),
    ['son', 'net'].join(''),
    ['flash', '-lite'].join(''),
  ]) {
    assert.ok(!guardSource.includes(forbidden), `the guard never depends on the mutable census literal ${forbidden}`);
  }

  // The guard never bans a future migration: its only migration rule is the
  // EXISTENCE of the frozen 0062 entry baseline.
  assert.ok(!/006[3-9]|00[7-9]\d/u.test(guardSource.replace('0062_fast_deep_runtime_decision_policy_v2', '')),
    'the guard names no future migration number');

  // The guard freezes the post-response PROVIDER registry only. It must never
  // freeze the absence of a foreground Question channel, which QIR-006 owns.
  assert.ok(!guardSource.includes('questionOpportunity') && !guardSource.includes('QuestionEngine'),
    'the guard never freezes the current absence of a foreground Question channel');
});
