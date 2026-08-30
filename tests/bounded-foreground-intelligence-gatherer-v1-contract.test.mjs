import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// QIR-003 Bounded Foreground Intelligence Gatherer v1 static contract.
//
// This guard freezes exactly the QIR-003-owned invariants: the post-Safety
// concurrent launch of the frozen Human Intelligence lane + Memory +
// Hypothesis, the ONE shared 5000 ms non-HI foreground ceiling, the typed
// non-interchangeable source outcomes, the exact optional-availability
// classifier with a hard-fail-closed default, the no-Recommendation-on-
// unavailable/expired rule, the late-settlement discard, the bounded
// fail-soft source-outcome telemetry, the exactly-one conversational provider
// call, and the no-migration fact of the QIR-003 baseline.
//
// FORWARD-SAFETY IS MANDATORY HERE. This guard must never freeze:
//   * the current absence of a foreground Question channel (QIR-006 owns it);
//   * current global provider-context behavior (QIR-004 owns the budget);
//   * the current background provider-call count (QIR-005 owns the cap; the
//     guard reads no dispatcher source);
//   * Provider/model identifiers (final Provider/LLM selection is deferred;
//     the guard reads no model-profile or provider-adapter source);
//   * current local Memory/Hypothesis cap values (the guard reads no cap
//     source);
//   * future migrations (a later, separately reviewed migration in ANY domain
//     stays legal; the guard bans no future migration number or filename).
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const CONTRACT_DOC = 'docs/bounded-foreground-intelligence-gatherer-v1.md';
// Deliberately narrow world: only the sources whose QIR-003-owned lines this
// guard asserts. No model-profile registry, no provider adapter, no
// memory/hypothesis cap source, and no post-response dispatcher source may
// ever enter this world (proven in G5).
const SOURCES = Object.freeze({
  contractDoc: CONTRACT_DOC,
  docsReadme: 'docs/README.md',
  packageJson: 'package.json',
  ci: '.github/workflows/api-ci.yml',
  gathererTypes: 'apps/api/src/intelligence-runtime/bounded-foreground-intelligence-gatherer.types.ts',
  gathererService: 'apps/api/src/intelligence-runtime/bounded-foreground-intelligence-gatherer.service.ts',
  gathererSpec: 'apps/api/src/intelligence-runtime/bounded-foreground-intelligence-gatherer.service.spec.ts',
  orchestrator: 'apps/api/src/conversation/conversation-orchestrator.service.ts',
  orchestratorSpec: 'apps/api/src/conversation/conversation-orchestrator.service.spec.ts',
  telemetry: 'apps/api/src/observability/telemetry.service.ts',
});
const shipped = Object.freeze({
  ...Object.fromEntries(Object.entries(SOURCES).map(([key, path]) => [key, read(path)])),
  migrations: Object.freeze(readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql'))),
});

const CONTRACT_SCRIPT = 'test:bounded-foreground-intelligence-gatherer-v1-contract';
const CONTRACT_COMMAND = 'node --test tests/bounded-foreground-intelligence-gatherer-v1-contract.test.mjs';

// Required statements of the normative document, checked against
// whitespace-flattened text so markdown line wrapping never splits a marker.
const REQUIRED_DOC_STATEMENTS = Object.freeze([
  // Identity.
  '# QANDEEL — Bounded Foreground Intelligence Gatherer v1',
  '**Task:** QIR-003 — Bounded Foreground Intelligence Gatherer v1',
  '**Status: ACTIVE / NORMATIVE**',
  'requires its own versioned, separately reviewed superseding contract',
  // Canonical entry baseline.
  '80532e671508708c0d496523cdb04f18da01f813',
  'f0501b644a87c16a2d25dd6269d91634b404efef',
  'PR #178',
  '33302907218',
  '0062_fast_deep_runtime_decision_policy_v2.sql',
  // The frozen no-migration fact, recorded here, banning nothing future.
  '**QIR-003 adds NO database migration.** The migration baseline remains 0062.',
  'it bans nothing about the future',
  'including migration 0063 and any later number, in any domain — is legal',
  // Concurrent post-Safety topology.
  '**After Safety returns ALLOW or GUIDED, the Conversation Orchestrator launches the frozen Human Intelligence lane, Memory retrieval, and Hypothesis reasoning in the same synchronous post-Safety stage, before awaiting any of them.**',
  'Memory and Hypothesis do not depend on Human Intelligence.',
  'Memory and Hypothesis do not depend on each other.',
  'Memory is never a serial stage after the Human Intelligence barrier.',
  'Hypothesis is never a serial stage after Memory.',
  'never their serial sum',
  '**Safety BLOCK short-circuits before any intelligence launch.**',
  // Ownership boundary and QHIA freeze.
  '**Memory + Hypothesis foreground acquisition and typed outcomes**',
  'NOT a whole-brain runtime planner',
  '**QIR-003 does not rewrite Human Intelligence.**',
  'the shared Snapshot + Reflection 300 ms foreground wait class',
  'the ONE existing QHIA barrier',
  'the consolidated ONE `humanIntelligence` provider field',
  // The one shared ceiling.
  'QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS = 5000',
  'The deadline starts ONCE, at Memory/Hypothesis gather launch.',
  '**The maximum QIR-003 non-HI foreground wait after launch is one 5000 ms ceiling.**',
  '**NOT** the QHIA 300 ms Human Intelligence budget, **NOT** a whole-turn budget, **NOT** a Provider SLA, and **NOT** a final product latency target.',
  // Typed outcomes.
  '`AVAILABLE`',
  '`LEGITIMATE_EMPTY`',
  '`OPTIONAL_AVAILABILITY_FAILURE`',
  '`FOREGROUND_BUDGET_EXPIRY`',
  'they fail closed rather than becoming ordinary degraded outcomes',
  '**Internal typed states and telemetry never collapse unavailable or expired into legitimate empty.**',
  'never a valid empty-memory assertion',
  "never converted into a fabricated `{ coverageState: 'EMPTY' }` result",
  // QIR-003 Fix 01: the total successful-result runtime boundary.
  '**The successful-result boundary is total over runtime values.**',
  'TypeScript erasure is never trusted at this boundary.',
  // Exact classifier.
  'Nest `ServiceUnavailableException` from the canonical read transport/configuration path',
  '`MemoryDataApiError` with HTTP status 408, 429, or 500–599.',
  'with any other 4xx status, including 401 and 403',
  '**The default is HARD FAIL CLOSED.**',
  'no error-message substring matching exists on this path',
  // Late settlement.
  'any late result is discarded for the current turn',
  'no second conversational provider call is triggered',
  'there is no retry, no fallback, no backup read, and no fan-out',
  // Recommendation dependency.
  '**Recommendation grounding is not called**',
  'There is no Recommendation fallback and no provider-generated replacement.',
  // Provider envelope and the one-call invariant.
  '**No extra LLM call may be introduced to interpret, reconcile, summarize, or recover missing intelligence. Exactly one normal conversational provider call per provider-generating turn remains mandatory.**',
  // Telemetry.
  '`qandeel.foreground.intelligence.source`',
  '`source = MEMORY | HYPOTHESIS`',
  '`outcome = AVAILABLE | LEGITIMATE_EMPTY | OPTIONAL_AVAILABILITY_FAILURE | FOREGROUND_BUDGET_EXPIRY | HARD_FAILURE`',
  '`processing_path = FAST | DEEP`',
  '`policy_version = "1"`',
  // Forward safety.
  'the current absence of future Question foreground consumption',
  'current global-context behavior',
  'the current background provider-call count',
  'Provider/model identifiers — final Provider/LLM selection is deferred',
  'any final product latency SLA',
  'future migrations',
  // Acceptance.
  'and exactly one conversational provider call remains the foreground',
]);

const executable = (source) => source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const slice = (source, start, end) => {
  const from = source.indexOf(start);
  if (from < 0) return '';
  const to = source.indexOf(end, from + start.length);
  return to < 0 ? source.slice(from) : source.slice(from, to);
};
const count = (source, needle) => source.split(needle).length - 1;

function violated(property) {
  throw new Error(`QIR-003 Bounded Foreground Intelligence Gatherer contract violated: ${property}`);
}

function assertBoundedForegroundIntelligenceGathererContract(world) {
  const exe = Object.fromEntries(Object.entries(world)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, source]) => [key, executable(source)]));

  // 1. The normative document exists, is substantive, and records every
  //    frozen statement (whitespace-flattened, wrap-safe).
  if (typeof world.contractDoc !== 'string' || world.contractDoc.length < 12000)
    violated('the QIR-003 normative document exists and is substantive');
  const flattened = world.contractDoc.replace(/\s+/gu, ' ');
  for (const statement of REQUIRED_DOC_STATEMENTS) {
    if (!flattened.includes(statement)) violated(`the document records: ${statement}`);
  }
  if (!world.docsReadme.includes('bounded-foreground-intelligence-gatherer-v1.md'))
    violated('docs/README.md links the QIR-003 normative document');

  // 2. The ONE shared non-HI ceiling: declared exactly once, at exactly
  //    5000 ms, in the gatherer types module - never in the orchestrator.
  if (!world.gathererTypes.includes('export const QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS = 5000;'))
    violated('the shared non-HI foreground ceiling is declared at exactly 5000 ms');
  if (/QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS = (?!5000;)/u.test(exe.gathererTypes + exe.gathererService))
    violated('the shared non-HI foreground ceiling is never redefined away from 5000 ms');
  if (world.orchestrator.includes('QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS'))
    violated('the 5000 ms ceiling stays behind the gatherer boundary: the orchestrator never touches it');

  // 3. Typed outcomes: the four states exist for both sources, degraded
  //    outcomes carry no value, and HARD_FAILURE is telemetry-only - never an
  //    outcome state a consumer could mistake for a typed answer.
  for (const state of ['AVAILABLE', 'LEGITIMATE_EMPTY', 'OPTIONAL_AVAILABILITY_FAILURE', 'FOREGROUND_BUDGET_EXPIRY']) {
    if (count(world.gathererTypes, `'${state}'`) < 2)
      violated(`both Memory and Hypothesis outcomes carry the typed state ${state}`);
  }
  if (world.gathererTypes.includes("state: 'HARD_FAILURE'"))
    violated('HARD_FAILURE is a telemetry outcome, never a typed source-outcome state');
  if (!world.gathererTypes.includes("{ readonly state: 'OPTIONAL_AVAILABILITY_FAILURE' }"))
    violated('the availability-failure outcome carries no value: unavailability is omission');
  if (!world.gathererTypes.includes("{ readonly state: 'FOREGROUND_BUDGET_EXPIRY' }"))
    violated('the budget-expiry outcome carries no value: expiry is omission');

  // 4. The gatherer launches BOTH sources synchronously and never awaits:
  //    with zero `await` in the module there is no construct that could
  //    serialize Hypothesis behind Memory or restart a window.
  if (/await\s/u.test(exe.gathererService))
    violated('the gatherer is fully synchronous up to its returned promise: no await exists to serialize the sources');
  if (count(exe.gathererService, 'this.memoryRetriever.retrieve(') !== 1)
    violated('exactly one Memory read per gather: no retry, no fallback, no second read');
  if (count(exe.gathererService, 'this.hypothesisReasoningContext.build(') !== 1)
    violated('exactly one Hypothesis read per gather: no retry, no fallback, no second read');
  for (const engine of ["'memory_retrieval'", "'hypothesis_context'"]) {
    if (!exe.gathererService.includes(engine))
      violated(`the pre-existing engine span ${engine} is preserved`);
  }

  // 5. ONE deadline: exactly one timer, driven by the shared constant, raced
  //    by BOTH sources, and cleared on settlement.
  if ((exe.gathererService.match(/setTimeout\(/gu) ?? []).length !== 1)
    violated('exactly ONE deadline timer exists in the gatherer: no per-source and no second window');
  if (!exe.gathererService.includes('setTimeout(resolve, QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS)'))
    violated('the one deadline timer is driven by the shared 5000 ms constant');
  if (!exe.gathererService.includes('clearTimeout(deadlineTimer)'))
    violated('the deadline timer is cleared once both outcomes settle: no timer leak');
  if (count(exe.gathererService, 'sharedDeadline,') !== 2)
    violated('BOTH sources race the SAME shared deadline promise');
  if (!exe.gathererService.includes('Promise.race([classified, sharedDeadline.then(() => expired)])'))
    violated('each source races its classified settlement against the one shared deadline');
  if (!exe.gathererService.includes('Promise.allSettled([memoryOutcome, hypothesisOutcome]).then(() => clearTimeout(deadlineTimer))'))
    violated('handlers stay attached to both outcomes and cleanup observes both settlements');
  if (!exe.gathererService.includes('Promise.all([memoryOutcome, hypothesisOutcome])'))
    violated('the gather joins the two bounded outcomes: slower-of, never serial sum');
  if (/setInterval\(|sleep\(|delay\(|AbortController|\.abort\(/u.test(exe.gathererService))
    violated('no interval, sleep, or broad cancellation architecture is introduced');

  // 6. The exact optional-availability classifier, hard-fail-closed default.
  const classifier = slice(exe.gathererService, 'function classifyForegroundSourceFailure', '\n}');
  if (!classifier) violated('the one failure classifier exists as a bounded block');
  if (!classifier.includes('if (error instanceof ServiceUnavailableException) return OPTIONAL_AVAILABILITY_FAILURE_OUTCOME;'))
    violated('a canonical-transport ServiceUnavailableException is the first approved availability failure');
  if (!classifier.includes('if (error instanceof MemoryDataApiError && isApprovedTransportAvailabilityStatus(error.status)) return OPTIONAL_AVAILABILITY_FAILURE_OUTCOME;'))
    violated('a MemoryDataApiError degrades only through the approved status registry');
  if (!classifier.includes('throw error;'))
    violated('the classifier default is HARD FAIL CLOSED: everything unrecognized rethrows the original error');
  if (!exe.gathererService.includes('return status === 408 || status === 429 || (Number.isInteger(status) && status >= 500 && status <= 599);'))
    violated('the approved availability statuses are exactly 408, 429, and 500-599');
  if (/\.message\.includes\(|\.message\.match\(|\.message\.indexOf\(|\.message\.startsWith\(/u.test(exe.gathererService))
    violated('no failure is ever classified by substring-matching an error message');
  if (exe.gathererService.includes('readMemoryDataApiUpstreamIdentity'))
    violated('the QHIA-011A opaque upstream database identity is never read for QIR-003 classification');
  // The ONLY legal coverage-discriminant literals in the gatherer are the two
  // TYPE-LEVEL Extract discriminators of the outcome predicates (Fix 01).
  // After stripping exactly those, any remaining coverage literal would be a
  // fabricated coverage VALUE - still banned.
  const fabricationScan = exe.gathererService
    .replaceAll("Extract<HypothesisReasoningContextResult, { coverageState: 'AVAILABLE' }>", '')
    .replaceAll("Extract<HypothesisReasoningContextResult, { coverageState: 'EMPTY' }>", '');
  if (/coverageState:\s*'/u.test(fabricationScan))
    violated('the gatherer never fabricates a coverage result: unavailable and expired stay omission');
  if (!exe.gathererService.includes("const OPTIONAL_AVAILABILITY_FAILURE_OUTCOME = Object.freeze({ state: 'OPTIONAL_AVAILABILITY_FAILURE' as const });"))
    violated('the availability-failure outcome is the frozen valueless singleton');
  if (!exe.gathererService.includes("const FOREGROUND_BUDGET_EXPIRY_OUTCOME = Object.freeze({ state: 'FOREGROUND_BUDGET_EXPIRY' as const });"))
    violated('the budget-expiry outcome is the frozen valueless singleton');
  if (!exe.gathererService.includes('throw new BoundedForegroundIntelligenceMalformedResultError();'))
    violated('a malformed source result fails closed by typed identity');
  if (/export class BoundedForegroundIntelligenceMalformedResultError/u.test(world.gathererService))
    violated('the malformed-result identity never escapes the module');

  // 6b. QIR-003 Fix 01 (QIR-003-F01): successful source values are validated
  //     TOTALLY over runtime `unknown` before AVAILABLE can be returned -
  //     TypeScript erasure is never trusted, "Array.isArray is enough" and
  //     "outer/inner AVAILABLE strings are enough" can never come back.
  if (!exe.gathererService.includes('function classifyMemoryResult(value: unknown): MemoryForegroundOutcome {'))
    violated('the successful Memory boundary is total over unknown runtime values');
  if (!exe.gathererService.includes('function classifyHypothesisResult(value: unknown): HypothesisForegroundOutcome {'))
    violated('the successful Hypothesis boundary is total over unknown runtime values');
  if (!exe.gathererService.includes('if (!isCanonicalMemoryContextList(value)) throw new BoundedForegroundIntelligenceMalformedResultError();'))
    violated('the Memory classifier actually consults the runtime list validator before classifying');
  if (!exe.gathererService.includes('return Array.isArray(value) && value.every((item) => isCanonicalMemoryContextItem(item));'))
    violated('AVAILABLE Memory requires EVERY item to pass the runtime item validator: Array.isArray alone is never enough');
  const memoryItemGuard = slice(exe.gathererService, 'function isCanonicalMemoryContextItem', '\n}');
  if (!memoryItemGuard) violated('the Memory item validator exists as a bounded block');
  for (const proof of [
    "typeof record.type === 'string'",
    "typeof record.content === 'string'",
    "(record.source === undefined || typeof record.source === 'string')",
  ]) {
    if (!memoryItemGuard.includes(proof))
      violated(`every Memory item field is positively proven at runtime: missing ${proof}`);
  }
  if (!exe.gathererService.includes("return record.coverageState === 'AVAILABLE' && isCanonicalAvailableHypothesisContext(record.context);"))
    violated('an AVAILABLE Hypothesis result actually consults the canonical envelope validator');
  const hypothesisEnvelopeGuard = slice(exe.gathererService, 'function isCanonicalAvailableHypothesisContext', '\n}');
  if (!hypothesisEnvelopeGuard) violated('the canonical AVAILABLE Hypothesis envelope validator exists as a bounded block');
  for (const proof of [
    'record.contractVersion === HYPOTHESIS_REASONING_CONTEXT_CONTRACT_VERSION',
    "record.source === 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT'",
    'hypotheses.length === 0 || hypotheses.length > MAX_MODEL_HYPOTHESES',
    "typeof record.truncated === 'boolean'",
    'record.includedHypothesisCount === hypotheses.length',
    'Number.isSafeInteger(candidateCount)',
    'candidateCount >= hypotheses.length',
    'record.truncated === (hypotheses.length < candidateCount)',
  ]) {
    if (!hypothesisEnvelopeGuard.includes(proof))
      violated(`AVAILABLE Hypothesis requires the canonical envelope invariant: missing ${proof}`);
  }

  // 7. Hard failures reject with the ORIGINAL error and are telemetry-visible:
  //    HARD_FAILURE plus the pre-existing hypothesis-context classification.
  if (!exe.gathererService.includes("this.recordSourceOutcome(source, 'HARD_FAILURE', path);"))
    violated('a hard source failure records the HARD_FAILURE outcome');
  if (!exe.gathererService.includes("this.telemetry.recordHypothesisContext(error instanceof HypothesisReasoningInvariantError ? 'rejected' : 'failed', input.path)"))
    violated('a hard Hypothesis failure keeps the pre-existing rejected/failed hypothesis-context outcome');
  if (!world.gathererService.includes('onHardFailure?.(error); } catch { /* fail-soft */ }\n        throw error;'))
    violated('the hard-failure continuation rethrows the ORIGINAL error after fail-soft telemetry: the turn fails closed upstream');

  // 8. Orchestrator topology: Safety short-circuit first, then the frozen
  //    Human Intelligence lane launch, then the gather launch, then the join -
  //    with the launches strictly before either await.
  const blockAt = world.orchestrator.indexOf("safety.disposition === 'BLOCK'");
  const himLaunchAt = world.orchestrator.indexOf("const himForegroundLanePromise = this.engine('him_context'");
  const gatherLaunchAt = world.orchestrator.indexOf('const foregroundGatherPromise = this.foregroundIntelligenceGatherer.gather({');
  const swallowAt = world.orchestrator.indexOf('foregroundGatherPromise.catch(() => undefined);');
  const himJoinAt = world.orchestrator.indexOf('await himForegroundLanePromise');
  const gatherJoinAt = world.orchestrator.indexOf('await foregroundGatherPromise');
  if (blockAt < 0 || himLaunchAt < 0 || gatherLaunchAt < 0 || swallowAt < 0 || himJoinAt < 0 || gatherJoinAt < 0)
    violated('the post-Safety launch/join topology exists: BLOCK short-circuit, two launches, swallow handler, two joins');
  if (!(blockAt < himLaunchAt && himLaunchAt < gatherLaunchAt && gatherLaunchAt < swallowAt && swallowAt < himJoinAt && himJoinAt < gatherJoinAt))
    violated('Safety precedes both launches, both launches precede both joins, and the swallow handler is attached before any await');
  if ((world.orchestrator.match(/this\.foregroundIntelligenceGatherer\.gather\(/gu) ?? []).length !== 1)
    violated('exactly one gather launch per turn: no backup gather and no second read path');
  for (const retired of ["this.engine('memory_retrieval'", "this.engine('hypothesis_context'", 'this.memoryRetriever', 'this.hypothesisReasoningContext']) {
    if (world.orchestrator.includes(retired))
      violated(`the serial foreground stage is gone from the orchestrator: found ${retired}`);
  }

  // 9. Join semantics: typed outcomes drive Memory omission, legitimate-only
  //    Hypothesis consumption, and legitimate-only Recommendation grounding.
  if (!world.orchestrator.includes("const memoryContext = memoryForeground.state === 'AVAILABLE' ? memoryForeground.value : [];"))
    violated('only AVAILABLE Memory reaches the provider request; every other outcome omits the field');
  if (!world.orchestrator.includes("if (hypothesisForeground.state === 'AVAILABLE' || hypothesisForeground.state === 'LEGITIMATE_EMPTY') hypothesisResult = hypothesisForeground.value;"))
    violated('Hypothesis is consumed only from a legitimate typed outcome');
  if (!world.orchestrator.includes('const recommendationGrounding = hypothesisResult ? this.recommendationGrounding.ground(hypothesisResult) : undefined;'))
    violated('Recommendation grounding runs ONLY on a legitimate Hypothesis result: never on unavailable or expired');
  if (!world.orchestrator.includes("...(hypothesisResult?.coverageState === 'AVAILABLE' ? { hypothesisContext: hypothesisResult.context } : {}),"))
    violated('the Hypothesis provider field exists only for an AVAILABLE legitimate result');
  if (!world.orchestrator.includes("...(recommendationGrounding?.coverageState === 'AVAILABLE' ? { recommendationContext: recommendationGrounding.context } : {}),"))
    violated('the Recommendation provider field exists only for an AVAILABLE grounding');
  for (const fabricated of ["coverageState: 'EMPTY'", "coverageState:'EMPTY'"]) {
    if (exe.orchestrator.includes(fabricated))
      violated(`an unavailable or expired source is never fabricated into a canonical EMPTY answer: found ${fabricated}`);
  }

  // 10. The frozen QHIA lane and the one-provider-call invariant, re-asserted
  //     exactly as the QHIA closure guards freeze them (no new ceiling).
  if (!world.orchestrator.includes('const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 300;'))
    violated('the QHIA 300 ms shared Human Intelligence budget is untouched');
  if (!world.orchestrator.includes('await Promise.all([snapshotReadPromise, reflectionReadPromise])'))
    violated('the ONE frozen Human Intelligence barrier is untouched');
  if ((world.orchestrator.match(/Promise\.all\(/gu) ?? []).length !== 1)
    violated('the orchestrator gains no second barrier construct: the frozen Human Intelligence Promise.all stays the only one');
  if ((world.orchestrator.match(/setTimeout\(/gu) ?? []).length !== 2)
    violated('the orchestrator gains no new timer: exactly the two frozen Human Intelligence budgets remain');
  if ((world.orchestrator.match(/this\.router\.generate\(/gu) ?? []).length !== 1)
    violated('exactly one conversational provider invocation exists on the turn path');
  if ((world.orchestrator.match(/buildHumanIntelligenceProviderSemantics\(/gu) ?? []).length !== 1)
    violated('the one Human Intelligence provider envelope is compiled exactly once');
  if (/FOREGROUND_WAIT_BUDGET_MS = (?!300;)/u.test(exe.orchestrator))
    violated('no foreground wait budget other than the frozen 300 ms constant is declared in the orchestrator');

  // 11. Bounded fail-soft source-outcome telemetry over finite registries.
  if (!world.telemetry.includes("createCounter('qandeel.foreground.intelligence.source')"))
    violated('the bounded foreground intelligence source-outcome metric exists');
  if (!world.telemetry.includes("const FOREGROUND_INTELLIGENCE_SOURCES:ReadonlySet<string>=new Set(['MEMORY','HYPOTHESIS']);"))
    violated('the source registry is exactly MEMORY | HYPOTHESIS');
  if (!world.telemetry.includes("const FOREGROUND_INTELLIGENCE_SOURCE_OUTCOMES:ReadonlySet<string>=new Set(['AVAILABLE','LEGITIMATE_EMPTY','OPTIONAL_AVAILABILITY_FAILURE','FOREGROUND_BUDGET_EXPIRY','HARD_FAILURE']);"))
    violated('the outcome registry is exactly the five frozen outcomes');
  if (!world.telemetry.includes("const FOREGROUND_INTELLIGENCE_POLICY_VERSION='1';"))
    violated('the QIR-003 telemetry policy version is exactly "1"');
  // The three drop-gates are asserted INSIDE the QIR-003 recorder's own guard
  // block, never merely somewhere in the telemetry file: later tasks add their
  // own bounded recorders that legitimately reuse the same shared path
  // validator, and a file-wide `includes` would let this recorder silently lose
  // a gate while another recorder still mentioned it.
  const foregroundSourceGates = slice(world.telemetry, ' recordForegroundIntelligenceSource(', 'this.foregroundIntelligenceSourceOutcomes.add');
  if (!foregroundSourceGates) violated('the bounded foreground source recorder exists as a bounded block');
  for (const gate of ['FOREGROUND_INTELLIGENCE_SOURCES.has(source)', 'FOREGROUND_INTELLIGENCE_SOURCE_OUTCOMES.has(outcome)', 'isRuntimeRoutingPath(path)']) {
    if (!foregroundSourceGates.includes(gate))
      violated(`telemetry drops rather than emits anything outside the finite registries: missing ${gate}`);
  }
  if (!world.telemetry.includes('this.foregroundIntelligenceSourceOutcomes.add?.(1,{source,outcome,processing_path:path,policy_version:FOREGROUND_INTELLIGENCE_POLICY_VERSION});'))
    violated('the metric carries exactly the four finite dimensions');
  for (const existing of ["createCounter('qandeel.routing.decisions')", "createCounter('qandeel.hypothesis_context.outcomes')", "createCounter('qandeel.engine.duration'", 'withEngine']) {
    if (!world.telemetry.includes(existing) && !world.telemetry.includes(existing.replace('createCounter', 'createHistogram')))
      violated(`existing engine telemetry remains: missing ${existing}`);
  }

  // 12. The deterministic runtime proofs exist: structure without runtime
  //     proof is exactly the vacuity this contract prevents.
  for (const proof of [
    'jest.useFakeTimers()',
    'QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS - 1',
    'jest.getTimerCount()',
    'never grants a second window',
    'discards a late fulfillment',
    'absorbs a late rejection after expiry',
    'fails fast on a hard failure while the other source is still pending',
    // QIR-003 Fix 01: the malformed-successful-value regression matrix and
    // the anti-collusion canonical-fixture control must stay non-vacuous.
    'fails CLOSED on a malformed successful Memory value',
    'an array containing null',
    'AVAILABLE with an empty hypotheses list',
    'includedHypothesisCount does not match the list length',
    'canonical Recommendation grounding validator genuinely accepts',
  ]) {
    if (!world.gathererSpec.includes(proof))
      violated(`the focused gatherer spec proves the bound deterministically: missing ${proof}`);
  }
  for (const proof of [
    'QIR-003 - Bounded Foreground Intelligence Gatherer orchestration',
    'before awaiting any of them',
    'never an additive 5s + 5s wait',
    'Recommendation is not grounded',
  ]) {
    if (!world.orchestratorSpec.includes(proof))
      violated(`the orchestrator spec proves the QIR-003 turn topology: missing ${proof}`);
  }

  // 13. Registration: package script and CI step, before database bootstrap.
  const packageJson = JSON.parse(world.packageJson);
  if (packageJson.scripts?.[CONTRACT_SCRIPT] !== CONTRACT_COMMAND)
    violated(`the package script remains registered exactly: ${CONTRACT_SCRIPT}`);
  const ciStep = world.ci.indexOf(CONTRACT_SCRIPT);
  if (ciStep < 0) violated('CI runs the QIR-003 static contract');
  if (!(ciStep < world.ci.indexOf('Apply all migrations to fresh PostgreSQL')))
    violated('the QIR-003 static contract runs in CI before the database bootstrap: a pure static guard needs no database');

  // 14. The durable historical fact this guard owns: the QIR-003 entry
  //     migration baseline 0062 EXISTS. "QIR-003 added no migration" is
  //     recorded in the normative document above; no future migration number,
  //     filename, or domain is ever banned by this guard (proven in G3).
  if (!Array.isArray(world.migrations) || world.migrations.length === 0)
    violated('the world carries the database migration listing');
  if (!world.migrations.includes('0062_fast_deep_runtime_decision_policy_v2.sql'))
    violated('the QIR-003 entry migration baseline 0062 exists');
}

test('G1 - the shipped repository satisfies the QIR-003 contract', () => {
  assert.doesNotThrow(() => assertBoundedForegroundIntelligenceGathererContract(shipped));
});

test('G2 - anti-vacuity: the real guard rejects every named regression', () => {
  const drifts = [
    ['the normative document was deleted', { contractDoc: '' }],
    ['the no-migration fact was withdrawn', {
      contractDoc: shipped.contractDoc.replace('**QIR-003 adds NO database migration.**', 'QIR-003 adds one migration.'),
    }],
    ['the hard-fail-closed default was withdrawn from the document', {
      contractDoc: shipped.contractDoc.replace('**The default is HARD FAIL CLOSED.**', 'The default is graceful degradation.'),
    }],
    ['the one-ceiling rule was withdrawn from the document', {
      contractDoc: shipped.contractDoc.replace('launch is one 5000 ms ceiling.**', 'launch is two additive 5000 ms ceilings.**'),
    }],
    ['the not-a-product-SLA statement was withdrawn', {
      contractDoc: shipped.contractDoc.replace('**NOT** a final product latency target.', 'the final product latency target.'),
    }],
    ['the exactly-one-provider-call statement was withdrawn', {
      contractDoc: shipped.contractDoc.replace('per provider-generating turn remains mandatory.**', 'per provider-generating turn is merely encouraged.**'),
    }],
    ['the docs index lost the document link', {
      docsReadme: shipped.docsReadme.replaceAll('bounded-foreground-intelligence-gatherer-v1.md', 'missing.md'),
    }],
    ['the shared ceiling was raised', {
      gathererTypes: shipped.gathererTypes.replace('export const QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS = 5000;', 'export const QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS = 15000;'),
    }],
    ['the ceiling constant leaked into the orchestrator', {
      orchestrator: `${shipped.orchestrator}\n// drift\nexport const orchestratorCeiling = { QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS: 1 };\n`,
    }],
    ['a second deadline timer appeared in the gatherer', {
      gathererService: shipped.gathererService.replace(
        'void Promise.allSettled([memoryOutcome, hypothesisOutcome]).then(() => clearTimeout(deadlineTimer));',
        'void Promise.allSettled([memoryOutcome, hypothesisOutcome]).then(() => clearTimeout(deadlineTimer));\n    setTimeout(() => undefined, 25);',
      ),
    }],
    ['the deadline stopped racing one shared promise per source', {
      gathererService: shipped.gathererService.replace(
        'Promise.race([classified, sharedDeadline.then(() => expired)])',
        'Promise.race([classified, new Promise((resolve) => setTimeout(() => resolve(expired), 5000))])',
      ),
    }],
    ['the deadline timer stopped being cleared', {
      gathererService: shipped.gathererService.replace(
        'void Promise.allSettled([memoryOutcome, hypothesisOutcome]).then(() => clearTimeout(deadlineTimer));',
        '',
      ),
    }],
    ['the gatherer serialized the sources behind an await', {
      gathererService: shipped.gathererService.replace(
        'const hypothesisRead = this.engine(',
        'const hypothesisRead = await this.engine(',
      ),
    }],
    ['a Memory retry appeared', {
      gathererService: shipped.gathererService.replace(
        'const memoryRead = this.engine(\'memory_retrieval\', input.path, () =>\n      this.memoryRetriever.retrieve(input.userId, input.accessToken, input.content));',
        'const memoryRead = this.engine(\'memory_retrieval\', input.path, () =>\n      this.memoryRetriever.retrieve(input.userId, input.accessToken, input.content).catch(() => this.memoryRetriever.retrieve(input.userId, input.accessToken, input.content)));',
      ),
    }],
    ['a fail-closed status was moved onto the approved availability set', {
      gathererService: shipped.gathererService.replace(
        'return status === 408 || status === 429 || (Number.isInteger(status) && status >= 500 && status <= 599);',
        'return status === 403 || status === 408 || status === 429 || (Number.isInteger(status) && status >= 500 && status <= 599);',
      ),
    }],
    ['the classifier default stopped failing closed', {
      gathererService: shipped.gathererService.replace(
        '  if (error instanceof MemoryDataApiError && isApprovedTransportAvailabilityStatus(error.status)) return OPTIONAL_AVAILABILITY_FAILURE_OUTCOME;\n  throw error;\n}',
        '  return OPTIONAL_AVAILABILITY_FAILURE_OUTCOME;\n}',
      ),
    }],
    ['classification became an error-message substring match', {
      gathererService: shipped.gathererService.replace(
        'if (error instanceof ServiceUnavailableException) return OPTIONAL_AVAILABILITY_FAILURE_OUTCOME;',
        "if (error instanceof Error && error.message.includes('unavailable')) return OPTIONAL_AVAILABILITY_FAILURE_OUTCOME;",
      ),
    }],
    ['the classifier started reading the opaque upstream database identity', {
      gathererService: shipped.gathererService.replace(
        'isApprovedTransportAvailabilityStatus(error.status)',
        "readMemoryDataApiUpstreamIdentity(error).code === '57014'",
      ),
    }],
    ['an expired Hypothesis became a fabricated EMPTY answer', {
      gathererService: shipped.gathererService.replace(
        "const FOREGROUND_BUDGET_EXPIRY_OUTCOME = Object.freeze({ state: 'FOREGROUND_BUDGET_EXPIRY' as const });",
        "const FOREGROUND_BUDGET_EXPIRY_OUTCOME = Object.freeze({ state: 'LEGITIMATE_EMPTY' as const });",
      ),
    }],
    ['Memory item validation regressed to Array.isArray alone (QIR-003-F01)', {
      gathererService: shipped.gathererService.replace(
        'return Array.isArray(value) && value.every((item) => isCanonicalMemoryContextItem(item));',
        'return Array.isArray(value);',
      ),
    }],
    ['a required Memory field proof was dropped', {
      gathererService: shipped.gathererService.replace("    && typeof record.content === 'string'\n", ''),
    }],
    ['the optional Memory field proof was dropped', {
      gathererService: shipped.gathererService.replace(
        "    && (record.source === undefined || typeof record.source === 'string');",
        '    ;',
      ),
    }],
    ['the Hypothesis result guard bypassed the canonical envelope validator (QIR-003-F01)', {
      gathererService: shipped.gathererService.replace(
        "return record.coverageState === 'AVAILABLE' && isCanonicalAvailableHypothesisContext(record.context);",
        "return record.coverageState === 'AVAILABLE' && record.context !== null && typeof record.context === 'object';",
      ),
    }],
    ['the empty-hypotheses-list rejection was dropped', {
      gathererService: shipped.gathererService.replace('hypotheses.length === 0 || ', ''),
    }],
    ['the included-count consistency invariant was dropped', {
      gathererService: shipped.gathererService.replace('    && record.includedHypothesisCount === hypotheses.length\n', ''),
    }],
    ['the truncation consistency invariant was dropped', {
      gathererService: shipped.gathererService.replace(
        '    && record.truncated === (hypotheses.length < candidateCount);',
        '    ;',
      ),
    }],
    ['a hard failure stopped rethrowing the original error', {
      gathererService: shipped.gathererService.replace(
        "try { this.recordSourceOutcome(source, 'HARD_FAILURE', path); onHardFailure?.(error); } catch { /* fail-soft */ }\n        throw error;",
        "try { this.recordSourceOutcome(source, 'HARD_FAILURE', path); onHardFailure?.(error); } catch { /* fail-soft */ }\n        return expired;",
      ),
    }],
    ['the hard Hypothesis failure lost its pre-existing rejected/failed outcome', {
      gathererService: shipped.gathererService.replace(
        "(error) => this.telemetry.recordHypothesisContext(error instanceof HypothesisReasoningInvariantError ? 'rejected' : 'failed', input.path)",
        '(error) => void error',
      ),
    }],
    ['the orchestrator awaited the gather at launch (serial again)', {
      orchestrator: shipped.orchestrator.replace(
        'const foregroundGatherPromise = this.foregroundIntelligenceGatherer.gather({',
        'const foregroundGatherPromise = await this.foregroundIntelligenceGatherer.gather({',
      ),
    }],
    ['the swallow handler was dropped: a fast hard failure could go unhandled', {
      orchestrator: shipped.orchestrator.replace('      foregroundGatherPromise.catch(() => undefined);\n', ''),
    }],
    ['a serial Memory stage reappeared in the orchestrator', {
      orchestrator: shipped.orchestrator.replace(
        'const assembled = this.integratedContextBudget.assemble({',
        "const memoryContextAgain = await this.engine('memory_retrieval',selection.path,()=>this.memoryRetriever.retrieve(userId, accessToken, userTurn.content));\n      void memoryContextAgain;\n      const assembled = this.integratedContextBudget.assemble({",
      ),
    }],
    ['a second gather launch appeared', {
      orchestrator: shipped.orchestrator.replace(
        '      foregroundGatherPromise.catch(() => undefined);',
        '      void this.foregroundIntelligenceGatherer.gather({ userId, accessToken, content: userTurn.content, path: selection.path });\n      foregroundGatherPromise.catch(() => undefined);',
      ),
    }],
    ['unavailable Memory reached the provider anyway', {
      orchestrator: shipped.orchestrator.replace(
        "const memoryContext = memoryForeground.state === 'AVAILABLE' ? memoryForeground.value : [];",
        "const memoryContext = memoryForeground.state === 'AVAILABLE' ? memoryForeground.value : previousMemoryContext;",
      ),
    }],
    ['Recommendation was grounded for an unavailable or expired Hypothesis', {
      orchestrator: shipped.orchestrator.replace(
        'const recommendationGrounding = hypothesisResult ? this.recommendationGrounding.ground(hypothesisResult) : undefined;',
        "const recommendationGrounding = this.recommendationGrounding.ground(hypothesisResult ?? { coverageState: 'EMPTY', candidateHypothesisCount: 0 });",
      ),
    }],
    ['a second foreground barrier appeared in the orchestrator', {
      orchestrator: shipped.orchestrator.replace(
        'const { memory: memoryForeground, hypothesis: hypothesisForeground } = await foregroundGatherPromise;',
        'const [{ memory: memoryForeground, hypothesis: hypothesisForeground }] = await Promise.all([foregroundGatherPromise]);',
      ),
    }],
    ['a third orchestrator timer appeared', {
      orchestrator: shipped.orchestrator.replace(
        '      foregroundGatherPromise.catch(() => undefined);',
        '      setTimeout(() => undefined, 25);\n      foregroundGatherPromise.catch(() => undefined);',
      ),
    }],
    ['the QHIA 300 ms budget was raised', {
      orchestrator: shipped.orchestrator.replace('const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 300;', 'const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 5000;'),
    }],
    ['a second conversational provider invocation appeared', {
      orchestrator: `${shipped.orchestrator}\n// drift\nconst second = (o) => o.engine('model_router', 'FAST', () => this.router.generate({}));\n`,
    }],
    ['the source-outcome metric was removed', {
      telemetry: shipped.telemetry.replaceAll("createCounter('qandeel.foreground.intelligence.source')", "createCounter('qandeel.foreground.freeform')"),
    }],
    ['the outcome registry was widened', {
      telemetry: shipped.telemetry.replace(
        "new Set(['AVAILABLE','LEGITIMATE_EMPTY','OPTIONAL_AVAILABILITY_FAILURE','FOREGROUND_BUDGET_EXPIRY','HARD_FAILURE'])",
        "new Set(['AVAILABLE','LEGITIMATE_EMPTY','OPTIONAL_AVAILABILITY_FAILURE','FOREGROUND_BUDGET_EXPIRY','HARD_FAILURE','PARTIAL'])",
      ),
    }],
    ['telemetry stopped validating the processing path', {
      telemetry: shipped.telemetry.replace('if(!isRuntimeRoutingPath(path))return;', 'void path;'),
    }],
    ['the deterministic deadline proof was gutted from the gatherer spec', {
      gathererSpec: shipped.gathererSpec.replaceAll('QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS - 1', '0'),
    }],
    ['the orchestrator concurrency proof was gutted', {
      orchestratorSpec: shipped.orchestratorSpec.replace('QIR-003 - Bounded Foreground Intelligence Gatherer orchestration', 'retired block'),
    }],
    ['the static guard was deregistered from package scripts', {
      packageJson: shipped.packageJson.replace('"test:bounded-foreground-intelligence-gatherer-v1-contract":', '"test:bounded-foreground-intelligence-gatherer-v1-contract-retired":'),
    }],
    ['the static guard was deregistered from CI', {
      ci: shipped.ci.replaceAll('test:bounded-foreground-intelligence-gatherer-v1-contract', 'echo skipped'),
    }],
    ['the entry migration baseline 0062 disappeared from the listing', {
      migrations: Object.freeze(shipped.migrations.filter((name) => name !== '0062_fast_deep_runtime_decision_policy_v2.sql')),
    }],
  ];

  for (const [label, overrides] of drifts) {
    const mutated = { ...shipped, ...overrides };
    for (const key of Object.keys(overrides)) {
      assert.notDeepEqual(mutated[key], shipped[key], `the "${label}" mutation actually replaced its source`);
    }
    assert.throws(
      () => assertBoundedForegroundIntelligenceGathererContract(mutated),
      /QIR-003 Bounded Foreground Intelligence Gatherer contract violated/u,
      `the guard rejects: ${label}`,
    );
  }
});

test('G3 - forward safety: every change a later QIR task is expected to make stays legal', () => {
  // QIR-004 already landed as the ONE final normalized provider-request
  // assembly boundary; a later reviewed QIR task may reshape that surface again
  // without touching QIR-003 law.
  const assembleLine = '      const assembled = this.integratedContextBudget.assemble({';
  assert.ok(shipped.orchestrator.includes(assembleLine), 'the provider-request assembly exists at the baseline to wrap');
  const budgeted = shipped.orchestrator.replace(assembleLine,
    '      const assembled = this.integratedContextBudgetV2.assemble({');
  assert.notDeepEqual(budgeted, shipped.orchestrator);
  assert.doesNotThrow(() => assertBoundedForegroundIntelligenceGathererContract({ ...shipped, orchestrator: budgeted }),
    'QIR-004 may add a global integrated context budget');

  // QIR-006: a foreground Question opportunity channel may appear.
  const recommendationLine = 'const recommendationGrounding = hypothesisResult ? this.recommendationGrounding.ground(hypothesisResult) : undefined;';
  assert.ok(shipped.orchestrator.includes(recommendationLine), 'the recommendation stage exists at the baseline to extend');
  const questionChannel = shipped.orchestrator.replace(recommendationLine,
    `${recommendationLine}\n      const questionOpportunity = await this.engine('question_opportunity',selection.path,()=>this.questionOpportunityChannel.read(userId, accessToken, claimed.session_id));`);
  assert.notDeepEqual(questionChannel, shipped.orchestrator);
  assert.doesNotThrow(() => assertBoundedForegroundIntelligenceGathererContract({ ...shipped, orchestrator: questionChannel }),
    'QIR-006 may add a foreground Question opportunity channel');

  // Both together: a plausible later-phase orchestrator stays legal.
  const combined = budgeted.replace(recommendationLine,
    `${recommendationLine}\n      const questionOpportunity = await this.engine('question_opportunity',selection.path,()=>this.questionOpportunityChannel.read(userId, accessToken, claimed.session_id));`);
  assert.doesNotThrow(() => assertBoundedForegroundIntelligenceGathererContract({ ...shipped, orchestrator: combined }),
    'the combined later-phase orchestrator stays legal');

  // Future migrations: a later, separately reviewed migration stays legal -
  // by number AND by domain, including a v2 of this very task's domain.
  for (const future of ['0063_integrated_context_budget_v1.sql', '0063_bounded_foreground_intelligence_gatherer_v2.sql', '0099_unrelated_future_authority.sql']) {
    assert.doesNotThrow(() => assertBoundedForegroundIntelligenceGathererContract({
      ...shipped,
      migrations: Object.freeze([...shipped.migrations, future]),
    }), `a later reviewed migration stays legal: ${future}`);
  }

  // A later reviewed amendment may extend the normative document.
  assert.doesNotThrow(() => assertBoundedForegroundIntelligenceGathererContract({
    ...shipped,
    contractDoc: `${shipped.contractDoc}\n\n## Amendment A1 (QIR-00x)\n\nRecorded under its own reviewed contract.\n`,
  }), 'a later reviewed document amendment stays legal');

  // A later QIR task may add its own static-contract CI step.
  const ciStepLine = shipped.ci.match(/^.*test:bounded-foreground-intelligence-gatherer-v1-contract.*$/mu)[0];
  assert.doesNotThrow(() => assertBoundedForegroundIntelligenceGathererContract({
    ...shipped,
    ci: shipped.ci.replace(ciStepLine,
      `${ciStepLine}\n      - {name: Verify QIR-004 context budget static contract, run: npm run test:qir-004-contract}`),
  }), 'a later QIR static-contract CI step stays legal');
});

test('G4 - the contract guard is wired into package scripts and CI', () => {
  const packageJson = JSON.parse(shipped.packageJson);
  assert.equal(packageJson.scripts[CONTRACT_SCRIPT], CONTRACT_COMMAND);
  const step = shipped.ci.indexOf(CONTRACT_SCRIPT);
  assert.ok(step > 0, 'CI runs the QIR-003 static contract');
  assert.ok(step < shipped.ci.indexOf('Apply all migrations to fresh PostgreSQL'),
    'it runs before the database bootstrap: a pure static guard needs no database');
});

test('G5 - the guard is structurally independent of every mutable census gap', () => {
  const worldPaths = Object.values(SOURCES);
  for (const excluded of [
    'apps/api/src/model-router/model-profile.registry.ts',
    'apps/api/src/memory/memory-retriever.service.ts',
    'apps/api/src/hypothesis/hypothesis-reasoning-context.types.ts',
    'apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts',
  ]) {
    assert.ok(!worldPaths.includes(excluded), `the guard world never includes ${excluded}`);
  }
  assert.ok(worldPaths.every((path) => !path.includes('providers/')),
    'the guard world never includes a provider adapter source');

  // The guard function itself never names a mutable-gap literal: not a vendor
  // model identifier, not a routing threshold, and not a cap VALUE. Fix 01
  // deliberately requires the envelope validator to reference the canonical
  // Hypothesis-owned MAX_MODEL_HYPOTHESES constant BY NAME - that reuse is
  // cap-value-neutral, so what stays banned is any VALUE freeze of a cap
  // (an `=`-assignment shape), never the canonical symbol reference.
  const guardSource = assertBoundedForegroundIntelligenceGathererContract.toString();
  for (const forbidden of [
    'DEEP_INPUT_LENGTH',
    'MAX_SELECTED_MEMORIES',
    'MAX_MODEL_HYPOTHESES =',
    'MAX_HYPOTHESIS_CONTEXT_STRING_CHARS',
    ['claude', '-'].join(''),
    ['gpt', '-'].join(''),
    ['gem', 'ini'].join(''),
    ['ha', 'iku'].join(''),
    ['son', 'net'].join(''),
  ]) {
    assert.ok(!guardSource.includes(forbidden), `the guard never depends on the mutable census literal ${forbidden}`);
  }

  // The guard never bans a future migration: its only migration rule is the
  // EXISTENCE of the frozen 0062 entry baseline.
  assert.ok(!/006[3-9]|00[7-9]\d/u.test(guardSource.replace('0062_fast_deep_runtime_decision_policy_v2', '')),
    'the guard names no future migration number');
});
