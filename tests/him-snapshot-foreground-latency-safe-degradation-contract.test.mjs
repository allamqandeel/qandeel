import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// QHIA-014A static anti-vacuity contract.
//
// QHIA-014 evaluated canonical main ae3a49a4 and correctly returned
// `FAIL - Human Intelligence activation is not latency-safe`, because the HSE
// Intelligence Snapshot was raw-awaited inside the one HIM Promise.all: it had
// no application-level foreground budget, ultimately inherited the shared
// 5000 ms Data API transport timeout, and failed the WHOLE TURN on a transport
// that simply could not answer.
//
// This contract freezes the remediation - the half no single Jest spec can
// freeze on its own, because a future edit could delete the spec and the
// architecture would silently regress:
//
//   * the Snapshot has an application-level foreground budget, it is the SAME
//     shared 300 ms Human Intelligence constant the QHIA-005 Reflection budget
//     uses, and there is exactly ONE such constant;
//   * the Snapshot is never raw-awaited again, and Snapshot and Reflection are
//     joined by the SAME single barrier - never serially, so the awaited hold is
//     max(300, 300) and never their 600 ms sum;
//   * budget expiry is classified by a typed private identity, never by
//     substring matching an arbitrary upstream error;
//   * UNAVAILABLE is OMISSION: the transform / adaptation / projection chain is
//     gated on an AVAILABLE Snapshot, so no EMPTY snapshot, UNKNOWN metric,
//     placeholder category, fabricated timestamp or stale previous value can be
//     invented, and QHIA-001 adaptation is never derived without one;
//   * exactly TWO failure classes degrade - a sanitized ServiceUnavailableException
//     and the frozen transient 408/429/502/503/504 infrastructure statuses - and
//     every other status, every unrecognized upstream error and every explicit
//     integrity failure stays fail-closed;
//   * the QHIA-011A opaque upstream identity accessor is NOT consulted by the
//     Snapshot classification;
//   * no retry, no fallback Snapshot, no per-metric read and no second provider
//     call are introduced;
//   * the independent Reflection, aggregate-v3 and Brain Context channels are
//     never suppressed merely because the Snapshot was unavailable;
//   * this task added no migration: 0061 remains the terminal Human
//     Intelligence Activation phase migration baseline, without freezing the
//     live repository's future migration numbering.
//
// Structure alone would be vacuous, so every structural rule is paired with the
// deterministic RUNTIME proof that must exist for it: the required fake-timer
// and classification cases are asserted to be present in the shipped specs. And
// the anti-vacuity fixtures drive this same real guard over deliberately
// drifted sources, so "this contract would catch regression X" is proven rather
// than assumed.
//
// Forward-safe: nothing here forbids a later migration, a later Human
// Intelligence channel, a later bounded budget owner, or a later consumption
// boundary. It freezes this task's own wiring only.
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
// Negatives run on EXECUTABLE source only: every file's own prose legitimately
// names the shapes it documents the absence of.
const executable = (source) => source
  .split('\n')
  .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*'))
  .join('\n');

const SOURCES = Object.freeze({
  orchestrator: 'apps/api/src/conversation/conversation-orchestrator.service.ts',
  snapshotService: 'apps/api/src/human-model/him-intelligence-snapshot.service.ts',
  snapshotProjector: 'apps/api/src/human-model/him-intelligence-snapshot.projector.ts',
  memoryDataApi: 'apps/api/src/memory/memory-data-api.service.ts',
  providerSemantics: 'apps/api/src/model-router/human-intelligence-provider-semantics.ts',
  snapshotServiceSpec: 'apps/api/src/human-model/him-intelligence-snapshot.service.spec.ts',
  orchestratorSpec: 'apps/api/src/conversation/conversation-orchestrator.service.spec.ts',
  remediationSpec: 'apps/api/src/conversation/conversation-orchestrator.him-snapshot-latency-safe-degradation.spec.ts',
});
// The world the guard runs over: the shipped sources PLUS the real database
// migration listing. Carrying the listing inside the world lets the D2
// anti-vacuity suite drive the SAME shipped migration-freeze logic over a
// deliberately mutated listing (a migration claiming this task's identity)
// without ever creating a real production migration.
const shipped = Object.freeze({
  ...Object.fromEntries(Object.entries(SOURCES).map(([key, path]) => [key, read(path)])),
  migrations: Object.freeze(readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql'))),
});

// The ONE shared budget. Snapshot and Reflection are the same class of bounded
// foreground wait, so they are the same constant - not two constants that
// happen to be equal, and never a serial 300 + 300.
const SHARED_BUDGET_DECLARATION = 'const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 300;';
const RETIRED_BUDGET_CONSTANT = 'SESSION_REFLECTION_FOREGROUND_WAIT_BUDGET_MS';
// The frozen transient infrastructure statuses - the ONLY MemoryDataApiError
// statuses the Snapshot may translate into transport unavailability.
const TRANSIENT_TRANSPORT_STATUSES = [408, 429, 502, 503, 504];
// Statuses that must NEVER become benign omission. 404 and unknown statuses are
// covered by the same default fail-closed branch.
const FAIL_CLOSED_STATUSES = [400, 401, 403, 404, 409, 500];

function violated(property) {
  throw new Error(`QHIA-014A Snapshot foreground latency-safe degradation contract violated: ${property}`);
}

function assertSnapshotLatencySafeDegradationContract(world) {
  const exe = Object.fromEntries(Object.entries(world)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, source]) => [key, executable(source)]));

  // 1. ONE shared Human Intelligence foreground budget, frozen at 300 ms.
  if (!exe.orchestrator.includes(SHARED_BUDGET_DECLARATION))
    violated('the ONE shared Human Intelligence foreground wait budget is declared at exactly 300 ms');
  if ((exe.orchestrator.match(/HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS/gu) ?? []).length !== 3)
    violated('the shared budget is declared once and consumed by exactly the two bounded budgets');
  if (exe.orchestrator.includes(RETIRED_BUDGET_CONSTANT + ' ='))
    violated('no second, independently drift-able foreground budget constant exists');
  if (/FOREGROUND_WAIT_BUDGET_MS = (?!300;)/u.test(exe.orchestrator))
    violated('the shared Human Intelligence foreground budget is never raised above 300 ms');

  // 2. The Snapshot really has an application-level budget, and Reflection still
  //    has its own - two bounded budgets, no third timer, no sleep/interval/retry.
  for (const required of [
    'private withSnapshotForegroundBudget(',
    'private withSessionReflectionForegroundBudget<T>(',
  ]) {
    if (!exe.orchestrator.includes(required)) violated(`the bounded foreground boundary exists: missing ${required}`);
  }
  const snapshotBudget = slice(exe.orchestrator, 'private withSnapshotForegroundBudget(', '\n  private ');
  if (!snapshotBudget) violated('the Snapshot foreground budget boundary is a bounded block');
  if (!new RegExp(`setTimeout\\([\\s\\S]*?${SHARED_BUDGET_DECLARATION.slice(6, -5)}`, 'u').test(snapshotBudget)
    && !snapshotBudget.includes('HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS'))
    violated('the Snapshot budget timer is driven by the shared 300 ms constant');
  if (!snapshotBudget.includes('clearTimeout(timer)'))
    violated('the Snapshot budget timer is cleared on the read\'s own settlement: no timer leak on a fast read');
  if ((exe.orchestrator.match(/setTimeout\(/gu) ?? []).length !== 2)
    violated('exactly two bounded Human Intelligence foreground timers exist');
  if (/setInterval\(|sleep\(|delay\(|retry\(/u.test(exe.orchestrator))
    violated('no sleep, interval, delay or retry is introduced into the foreground');

  // 3. The Snapshot is never raw-awaited again, and the join is CONCURRENT.
  if (!/const snapshotReadPromise = this\.withSnapshotForegroundBudget\(this\.himSnapshot\.getSnapshot\(/u.test(exe.orchestrator))
    violated('the Snapshot read is started once and handed straight to its foreground budget boundary');
  if (/await\s+this\.himSnapshot\.getSnapshot\(|const himSnapshot = await/u.test(exe.orchestrator))
    violated('the raw Snapshot read is never awaited again');
  if (!/await Promise\.all\(\[snapshotReadPromise, reflectionReadPromise\]\)/u.test(exe.orchestrator))
    violated('the ONE barrier joins the bounded Snapshot and the bounded Reflection concurrently');
  if ((exe.orchestrator.match(/Promise\.all\(/gu) ?? []).length !== 1)
    violated('exactly one foreground barrier exists: no serial Snapshot-then-Reflection stage');
  // A serial second stage would have to await one of them before the other.
  if (/await\s+snapshotReadPromise|await\s+reflectionReadPromise/u.test(exe.orchestrator))
    violated('neither bounded promise is awaited on its own: the two budgets can never sum to 600 ms');
  if ((exe.orchestrator.match(/this\.himSnapshot\.getSnapshot\(/gu) ?? []).length !== 1)
    violated('exactly one Snapshot request per turn: no retry, no fallback read, no per-metric read');
  if ((exe.orchestrator.match(/this\.router\.generate\(/gu) ?? []).length !== 1)
    violated('exactly one Model Router invocation exists: a budget expiry triggers no second provider call');

  // 4. Budget expiry has a typed private identity, never a substring match.
  if (!/class HimSnapshotForegroundWaitBudgetExceededError extends Error/u.test(exe.orchestrator))
    violated('budget expiry carries a typed private identity');
  if (/export class HimSnapshotForegroundWaitBudgetExceededError/u.test(exe.orchestrator))
    violated('the budget expiry identity never escapes the module');
  if (!/error instanceof HimSnapshotForegroundWaitBudgetExceededError/u.test(exe.orchestrator))
    violated('budget expiry is classified by constructor identity');
  if (/\.message\.includes\(|\.message\.match\(|\.message\.indexOf\(|includes\('BUDGET/u.test(exe.orchestrator))
    violated('no foreground failure is classified by substring matching an arbitrary error message');

  // 5. The foreground degrades on EXACTLY two classified outcomes and rethrows
  //    everything else. A catch-all would degrade authority failures too.
  if (!/if \(error instanceof HimSnapshotForegroundWaitBudgetExceededError \|\| error instanceof ServiceUnavailableException\) resolve\(\{ state: 'UNAVAILABLE' \}\);\s*else reject\(error\);/u.test(exe.orchestrator))
    violated('exactly budget expiry and classified transport unavailability degrade; everything else is rethrown');
  if (/catch \{\s*(return|resolve)[\s\S]{0,120}UNAVAILABLE/u.test(exe.orchestrator))
    violated('no catch-all turns every Snapshot failure into benign omission');

  // 6. UNAVAILABLE is OMISSION, not a fabricated measurement answer.
  if (!/if \(snapshotRead\.state === 'AVAILABLE'\) \{/u.test(exe.orchestrator))
    violated('the Snapshot-derived lane runs only on an AVAILABLE Snapshot');
  const snapshotLane = slice(exe.orchestrator, "if (snapshotRead.state === 'AVAILABLE') {", '\n      }');
  if (!snapshotLane) violated('the Snapshot-derived lane is a bounded block');
  for (const gated of [
    'this.himReasoningConsumption.transform(',
    'this.himInteractionAdaptation.derive(',
    'this.himFastDeepConsumption.project(',
  ]) {
    if (!snapshotLane.includes(gated))
      violated(`the Snapshot-derived lane is gated on an AVAILABLE Snapshot: ${gated} escaped the gate`);
    if ((exe.orchestrator.match(new RegExp(escapeRegExp(gated), 'gu')) ?? []).length !== 1)
      violated(`${gated} runs exactly once, only inside the AVAILABLE gate`);
  }
  // QHIA-001 adaptation has exactly one authority: the Snapshot reasoning
  // context. No other channel may stand in for it.
  if (!/adaptation = this\.himInteractionAdaptation\.derive\(himReasoningContext\);/u.test(snapshotLane))
    violated('the QHIA-001 adaptation is derived from the Snapshot reasoning context and from nothing else');
  for (const forbidden of [
    'himInteractionAdaptation.derive(reflection', 'himInteractionAdaptation.derive(crossContext',
    'himInteractionAdaptation.derive(brain', 'himInteractionAdaptation.derive(previous',
  ]) {
    if (exe.orchestrator.includes(forbidden))
      violated(`no second adaptation authority exists: found ${forbidden}`);
  }
  // No fabricated Snapshot of any kind.
  for (const fabricated of [
    "coverageState: 'EMPTY'", "coverageState:'EMPTY'", "valueState: 'UNASSESSED'", "knowledgeState: 'UNKNOWN'",
    "ordinalCategory: 'MODERATE'", 'generatedAt:', 'snapshotContractVersion:', 'eligibleMetricCount:',
    'lastSnapshot', 'previousSnapshot', 'cachedSnapshot', 'staleSnapshot',
  ]) {
    if (exe.orchestrator.includes(fabricated))
      violated(`an unavailable Snapshot is never replaced by a fabricated or remembered one: found ${fabricated}`);
  }
  if (!/himContext:snapshotModelContext,/u.test(exe.orchestrator))
    violated('the Snapshot-derived session context is simply absent when the Snapshot was unavailable');
  if (!/\.\.\.\(himContext \? \{ himContext \} : \{\}\),/u.test(exe.orchestrator))
    violated('the compiler receives the session lane only when it really exists');
  if (!/\.\.\.\(himInteractionAdaptation\?\.adaptationState === 'ACTIVE' \? \{ himInteractionAdaptation \} : \{\}\),/u.test(exe.orchestrator))
    violated('the adaptation lane is optional-safe and never fabricated');

  // 7. The independent channels are never suppressed by Snapshot omission: the
  //    compiler still receives them, and none of them is gated on the Snapshot.
  for (const independent of [
    '...(himSessionReflectionGuidance ? { himSessionReflectionGuidance } : {}),',
    '...(himSituationStressGuidance ? { himSituationStressGuidance } : {}),',
    '...(himDecisionAttentionGuidance ? { himDecisionAttentionGuidance } : {}),',
    '...(himGoalMotivationGuidance ? { himGoalMotivationGuidance } : {}),',
    '...(himRelationshipCommunicationGuidance ? { himRelationshipCommunicationGuidance } : {}),',
    '...(himBrainContext ? { himBrainContext } : {}),',
  ]) {
    if (!exe.orchestrator.includes(independent))
      violated(`the independent Human Intelligence channels survive Snapshot omission: missing ${independent}`);
    if (snapshotLane.includes(independent))
      violated(`no independent channel is gated on an AVAILABLE Snapshot: found ${independent} inside the gate`);
  }
  if (!/\.\.\.\(humanIntelligence \? \{ humanIntelligence \} : \{\}\),/u.test(exe.orchestrator))
    violated('the ONE provider envelope is still sent only when provider-ready Human Intelligence exists');
  // The QHIA-013 compiler still accepts an absent session lane on its own.
  if (!exe.providerSemantics.includes('himContext?: HimModelContext;'))
    violated('the QHIA-013 compiler still accepts an optional session lane');
  if (!exe.providerSemantics.includes('if (!behavioralInstructionIds.length && !sessionReasoningContext && !brainContext) return undefined;'))
    violated('the QHIA-013 compiler still returns undefined only when EVERY channel is absent');

  // 8. The Snapshot service classification: three-way, status-only, sanitized.
  if (!exe.snapshotService.includes('export const HIM_SNAPSHOT_TRANSIENT_TRANSPORT_STATUSES'))
    violated('the transient infrastructure statuses are a frozen, named set');
  const statusSet = slice(exe.snapshotService, 'HIM_SNAPSHOT_TRANSIENT_TRANSPORT_STATUSES', ');');
  for (const status of TRANSIENT_TRANSPORT_STATUSES) {
    if (!new RegExp(`\\b${status}\\b`, 'u').test(statusSet))
      violated(`the transient transport status ${status} is classified as unavailable`);
  }
  for (const status of FAIL_CLOSED_STATUSES) {
    if (new RegExp(`\\b${status}\\b`, 'u').test(statusSet))
      violated(`the status ${status} is NEVER downgraded into benign omission: found it on the transient set`);
  }
  if (!/if\(error instanceof ServiceUnavailableException\)throw error;/u.test(exe.snapshotService))
    violated('an existing ServiceUnavailableException from the Data API transport is preserved as transport unavailable');
  if (!/if\(error instanceof MemoryDataApiError&&HIM_SNAPSHOT_TRANSIENT_TRANSPORT_STATUSES\.has\(error\.status\)\)throw new ServiceUnavailableException\(/u.test(exe.snapshotService))
    violated('exactly the frozen transient statuses become a sanitized ServiceUnavailableException');
  if (!/if\(error instanceof Error&&error\.message\.includes\('active binding integrity failure'\)\)throw new Error\('INTEGRITY_FAILURE'\);/u.test(exe.snapshotService))
    violated('the explicit database active-binding integrity failure is still classified FIRST and still fails closed');
  if (!/throw new Error\('INVALID_OR_UNOWNED_CONTEXT'\);/u.test(exe.snapshotService))
    violated('every unclassified repository failure keeps the pre-existing fail-closed identity');
  if (!/throw new Error\('UNSUPPORTED_CONTEXT'\)/u.test(exe.snapshotService))
    violated('local validation is unchanged and still runs before any repository read');
  // The QHIA-011A opaque identity accessor stays single-purpose: the Snapshot
  // classification reads the HTTP status and nothing else.
  if (exe.snapshotService.includes('readMemoryDataApiUpstreamIdentity'))
    violated('the Snapshot classification never consults the QHIA-011A opaque upstream identity accessor');
  if (/error\.message\s*\)|upstreamCode|upstreamMessage/u.test(slice(exe.snapshotService, 'catch(error){', 'INVALID_OR_UNOWNED_CONTEXT') ?? ''))
    violated('no raw upstream database text reaches the Snapshot classification or its sanitized message');
  if (!exe.memoryDataApi.includes('export function readMemoryDataApiUpstreamIdentity('))
    violated('the QHIA-011A accessor itself is unchanged');
  // The global Data API transport timeout is NOT touched by this task.
  if (!exe.memoryDataApi.includes('AbortSignal.timeout(5000)'))
    violated('the shared 5000 ms Data API transport timeout is unchanged');
  // The projector keeps every integrity rule: omission never weakened it.
  for (const integrity of ['INTEGRITY_FAILURE', 'UNSUPPORTED_CONTEXT']) {
    if (!exe.snapshotProjector.includes(integrity))
      violated(`the projector integrity boundary is unchanged: missing ${integrity}`);
  }

  // 9. The deterministic RUNTIME proofs must exist. Structure without runtime
  //    proof is exactly the vacuity this contract is written to prevent.
  for (const proof of [
    'jest.useFakeTimers()',
    'advanceTimersByTimeAsync(299)',
    'advanceTimersByTimeAsync(300)',
    'jest.getTimerCount()',
    'QHIA-014A HSE Snapshot foreground latency-safe degradation',
  ]) {
    if (!world.orchestratorSpec.includes(proof))
      violated(`the Orchestrator spec proves the bound deterministically: missing ${proof}`);
  }
  for (const proof of [
    'BASELINE FAIL #1', 'BASELINE FAIL #2', 'BASELINE FAIL #3', 'BASELINE FAIL #4', 'BASELINE FAIL #5',
    'HimIntelligenceSnapshotService(himRepository',
  ]) {
    if (!world.remediationSpec.includes(proof))
      violated(`the permanent QHIA-014 remediation proof reproduces the original failure: missing ${proof}`);
  }
  for (const status of [...TRANSIENT_TRANSPORT_STATUSES, ...FAIL_CLOSED_STATUSES]) {
    if (!new RegExp(`\\b${status}\\b`, 'u').test(world.remediationSpec))
      violated(`the remediation proof covers the ${status} classification end to end`);
  }
  for (const proof of ['ServiceUnavailableException', 'MemoryDataApiError', 'INTEGRITY_FAILURE']) {
    if (!world.snapshotServiceSpec.includes(proof))
      violated(`the Snapshot service spec proves the classification: missing ${proof}`);
  }

  // 10. QHIA-014A adds NO database file. Driven by the world's migration
  //     listing so the D2 anti-vacuity suite can prove the guard rejects a
  //     migration claiming this task's own identity.
  //
  //     Forward-safe (QHIA-015 phase closure repair): what this rule freezes is
  //     (a) 0061_him_brain_context_bridge_v1.sql EXISTS as the terminal
  //     Human Intelligence Activation phase migration baseline, and (b) no
  //     migration ever claims QHIA-014A's own Snapshot latency/degradation
  //     identity - this task added no database file. It deliberately does NOT
  //     require the live repository's latest migration to remain 0061 forever,
  //     and a later, separately reviewed phase migration (0062 or beyond) is
  //     legal by number - proven in D3.
  if (!Array.isArray(world.migrations) || world.migrations.length === 0)
    violated('the world carries the database migration listing');
  if (!world.migrations.includes('0061_him_brain_context_bridge_v1.sql'))
    violated('the terminal Human Intelligence Activation phase migration 0061 exists');
  if (world.migrations.some((name) => /snapshot.*latenc|latenc.*snapshot|snapshot.*degradation|degradation.*snapshot/iu.test(name)))
    violated('no migration claims the QHIA-014A Snapshot latency/degradation identity: this task added no database file');
}

function slice(source, start, end) {
  const from = source.indexOf(start);
  if (from < 0) return '';
  const to = source.indexOf(end, from + start.length);
  return to < 0 ? source.slice(from) : source.slice(from, to);
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

test('D1 - the shipped sources satisfy the frozen QHIA-014A latency-safe degradation contract', () => {
  assert.doesNotThrow(() => assertSnapshotLatencySafeDegradationContract(shipped));
});

test('D2 - anti-vacuity: the real guard rejects every named regression', () => {
  const drifts = [
    ['the Snapshot application-level budget was removed', {
      orchestrator: shipped.orchestrator.replace(
        'const snapshotReadPromise = this.withSnapshotForegroundBudget(this.himSnapshot.getSnapshot(',
        'const snapshotReadPromise = (this.himSnapshot.getSnapshot(',
      ),
    }],
    ['the Snapshot became raw-awaited again', {
      orchestrator: shipped.orchestrator.replace(
        'const [snapshotRead, reflectionRead] = await Promise.all([snapshotReadPromise, reflectionReadPromise]);',
        'const himSnapshot = await this.himSnapshot.getSnapshot(accessToken, himSelection.contextKind, himSelection.contextId);\n      const [snapshotRead, reflectionRead] = await Promise.all([snapshotReadPromise, reflectionReadPromise]);',
      ),
    }],
    ['the shared Human Intelligence budget was raised above 300 ms', {
      orchestrator: shipped.orchestrator.replace(
        'const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 300;',
        'const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 1000;',
      ),
    }],
    ['the Snapshot budget drifted onto its own second constant', {
      orchestrator: shipped.orchestrator.replace(
        '        () => settle(new HimSnapshotForegroundWaitBudgetExceededError()),\n        HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS,',
        '        () => settle(new HimSnapshotForegroundWaitBudgetExceededError()),\n        500,',
      ),
    }],
    ['a serial Snapshot-then-Reflection wait was introduced', {
      orchestrator: shipped.orchestrator.replace(
        'const [snapshotRead, reflectionRead] = await Promise.all([snapshotReadPromise, reflectionReadPromise]);',
        'const snapshotRead = await snapshotReadPromise;\n      const reflectionRead = await reflectionReadPromise;',
      ),
    }],
    ['a third foreground timer was introduced', {
      orchestrator: shipped.orchestrator.replace(
        '      brainContextReadPromise.then(',
        '      setTimeout(() => undefined, 25);\n      brainContextReadPromise.then(',
      ),
    }],
    ['the budget timer stopped being cleared on early settlement', {
      orchestrator: shipped.orchestrator.replace(
        '        (value) => { clearTimeout(timer); resolve({ state: \'AVAILABLE\', value }); },\n        (error) => { clearTimeout(timer); settle(error); },',
        '        (value) => { resolve({ state: \'AVAILABLE\', value }); },\n        (error) => { settle(error); },',
      ),
    }],
    ['budget expiry became a substring match instead of a typed identity', {
      orchestrator: shipped.orchestrator.replace(
        "if (error instanceof HimSnapshotForegroundWaitBudgetExceededError || error instanceof ServiceUnavailableException) resolve({ state: 'UNAVAILABLE' });",
        "if ((error instanceof Error && error.message.includes('BUDGET')) || error instanceof ServiceUnavailableException) resolve({ state: 'UNAVAILABLE' });",
      ),
    }],
    ['every Snapshot failure was degraded indiscriminately', {
      orchestrator: shipped.orchestrator.replace(
        "if (error instanceof HimSnapshotForegroundWaitBudgetExceededError || error instanceof ServiceUnavailableException) resolve({ state: 'UNAVAILABLE' });\n        else reject(error);",
        "resolve({ state: 'UNAVAILABLE' });",
      ),
    }],
    ['ServiceUnavailableException stopped being transport unavailability', {
      orchestrator: shipped.orchestrator.replace(
        'error instanceof HimSnapshotForegroundWaitBudgetExceededError || error instanceof ServiceUnavailableException',
        'error instanceof HimSnapshotForegroundWaitBudgetExceededError',
      ),
    }],
    ['an unavailable Snapshot became a fabricated EMPTY answer', {
      orchestrator: shipped.orchestrator.replace(
        "      let snapshotModelContext: HimModelContext | undefined;",
        "      let snapshotModelContext: HimModelContext | undefined = { coverageState: 'EMPTY' } as never;",
      ),
    }],
    ['an unavailable Snapshot reused a remembered previous one', {
      orchestrator: shipped.orchestrator.replace(
        "      let snapshotModelContext: HimModelContext | undefined;",
        "      let snapshotModelContext: HimModelContext | undefined = previousSnapshot;",
      ),
    }],
    ['the adaptation was derived without an available Snapshot', {
      orchestrator: shipped.orchestrator.replace(
        "      if (snapshotRead.state === 'AVAILABLE') {\n        const himReasoningContext = this.himReasoningConsumption.transform(snapshotRead.value);\n        adaptation = this.himInteractionAdaptation.derive(himReasoningContext);",
        "      if (snapshotRead.state === 'AVAILABLE') {\n        const himReasoningContext = this.himReasoningConsumption.transform(snapshotRead.value);\n      }\n      {\n        adaptation = this.himInteractionAdaptation.derive(himReasoningContext);",
      ),
    }],
    ['a second Snapshot request (retry or fallback) was added', {
      orchestrator: shipped.orchestrator.replace(
        '      const reflectionReadPromise = this.engine(',
        '      void this.himSnapshot.getSnapshot(accessToken, himSelection.contextKind, himSelection.contextId);\n      const reflectionReadPromise = this.engine(',
      ),
    }],
    ['the independent Reflection channel was suppressed by Snapshot omission', {
      orchestrator: shipped.orchestrator.replace(
        '        ...(himSessionReflectionGuidance ? { himSessionReflectionGuidance } : {}),',
        '',
      ),
    }],
    ['the independent aggregate channel was made conditional on the Snapshot', {
      orchestrator: shipped.orchestrator.replace(
        '        ...(himSituationStressGuidance ? { himSituationStressGuidance } : {}),',
        '        ...(himContext && himSituationStressGuidance ? { himSituationStressGuidance } : {}),',
      ),
    }],
    ['the independent Brain channel was moved inside the available-Snapshot gate', {
      orchestrator: shipped.orchestrator.replace(
        '        snapshotModelContext = this.himFastDeepConsumption.project(selection.path, himReasoningContext);',
        '        snapshotModelContext = this.himFastDeepConsumption.project(selection.path, himReasoningContext);\n        void {\n        ...(himBrainContext ? { himBrainContext } : {}),\n        };',
      ),
    }],
    ['a fail-closed status was moved onto the transient set', {
      snapshotService: shipped.snapshotService.replace('new Set([408, 429, 502, 503, 504])', 'new Set([401, 403, 408, 429, 500, 502, 503, 504])'),
    }],
    ['a transient status was dropped from the frozen set', {
      snapshotService: shipped.snapshotService.replace('new Set([408, 429, 502, 503, 504])', 'new Set([408, 429, 502])'),
    }],
    ['the Snapshot service stopped preserving ServiceUnavailableException', {
      snapshotService: shipped.snapshotService.replace('if(error instanceof ServiceUnavailableException)throw error;', ''),
    }],
    ['the explicit database integrity failure lost its fail-closed classification', {
      snapshotService: shipped.snapshotService.replace(
        "if(error instanceof Error&&error.message.includes('active binding integrity failure'))throw new Error('INTEGRITY_FAILURE');",
        '',
      ),
    }],
    ['the Snapshot classification started reading the QHIA-011A opaque identity', {
      snapshotService: shipped.snapshotService.replace(
        'HIM_SNAPSHOT_TRANSIENT_TRANSPORT_STATUSES.has(error.status)',
        "readMemoryDataApiUpstreamIdentity(error).code === '57014'",
      ),
    }],
    ['the global Data API transport timeout was changed', {
      memoryDataApi: shipped.memoryDataApi.replace('AbortSignal.timeout(5000)', 'AbortSignal.timeout(300)'),
    }],
    ['the QHIA-013 compiler stopped accepting an absent session lane', {
      providerSemantics: shipped.providerSemantics.replace('  himContext?: HimModelContext;', '  himContext: HimModelContext;'),
    }],
    ['the deterministic fake-timer proof was deleted from the Orchestrator spec', {
      orchestratorSpec: shipped.orchestratorSpec.replaceAll('advanceTimersByTimeAsync(299)', 'advanceTimersByTimeAsync(0)'),
    }],
    ['the permanent QHIA-014 remediation proof was gutted', {
      remediationSpec: shipped.remediationSpec.replaceAll('BASELINE FAIL #3', 'skipped'),
    }],
    ['the remediation proof stopped exercising the real Snapshot service', {
      remediationSpec: shipped.remediationSpec.replace('new HimIntelligenceSnapshotService(himRepository', 'fakeSnapshotService((himRepository'),
    }],
    // QHIA-014 proof closure (Codex MEDIUM debt #2A): a mutated world in which
    // production dispatches a SECOND provider request - a real second
    // `this.router.generate(...)` call site on the live turn path, not a
    // comment and not a count constant - must be rejected by this same guard.
    ['a second production-like provider invocation was introduced', {
      orchestrator: shipped.orchestrator.replace(
        '      const finalized = await this.repository.finalizeTurn({',
        "      const secondCandidate = await this.engine('model_router',selection.path,()=>this.router.generate({\n"
        + "        task: 'CONVERSATIONAL_RESPONSE', path: selection.path, complexity: 'LOW',\n"
        + "        behavioralGuidance, context: assembledContext.messages,\n"
        + "        locale: 'und', modality: 'TEXT', latencyBudgetMs: 3000, costBudget: 'LOW', safetyLevel: 'STANDARD',\n"
        + '      }));\n'
        + '      void secondCandidate;\n'
        + '      const finalized = await this.repository.finalizeTurn({',
      ),
    }],
    // QHIA-014 proof closure (Codex MEDIUM debt #2B), re-anchored by the
    // QHIA-015 forward-compatibility repair: a mutated world whose migration
    // listing carries a migration claiming THIS task's own Snapshot
    // latency/degradation identity must be rejected by this same guard - by
    // identity, never by migration number. The fixture is a listing entry
    // only: no real production migration file is ever created.
    ['a migration claiming this task\'s own Snapshot latency identity was added', {
      migrations: Object.freeze([...shipped.migrations, '0062_him_snapshot_latency_cache_v1.sql']),
    }],
    ['the terminal phase migration 0061 disappeared from the listing', {
      migrations: Object.freeze(shipped.migrations.filter((name) => name !== '0061_him_brain_context_bridge_v1.sql')),
    }],
  ];

  for (const [label, overrides] of drifts) {
    const mutated = { ...shipped, ...overrides };
    for (const key of Object.keys(overrides)) {
      assert.notEqual(mutated[key], shipped[key], `the "${label}" mutation actually replaced its source text`);
    }
    assert.throws(
      () => assertSnapshotLatencySafeDegradationContract(mutated),
      /QHIA-014A Snapshot foreground latency-safe degradation contract violated/u,
      `the guard rejects: ${label}`,
    );
  }
});

test('D3 - a later, separately reviewed Human Intelligence surface stays legal', () => {
  // Forward-safety: this contract freezes QHIA-014A's own wiring, not the shape
  // of every future task. A brand-new consumption service changes nothing here.
  assert.doesNotThrow(() => assertSnapshotLatencySafeDegradationContract({
    ...shipped,
    providerSemantics: `${shipped.providerSemantics}\n// a later reviewed lane may be added here\n`,
  }));
  // QHIA-015 phase closure repair: a hypothetical LATER phase migration does
  // NOT fail this historical guard merely because of its number. The live
  // repository is not frozen to 0061 forever; only the 0061 terminal baseline
  // and this task's own zero-migration identity stay proven. The fixture is a
  // listing entry only: no real migration 0062 exists or is ever created here.
  assert.doesNotThrow(() => assertSnapshotLatencySafeDegradationContract({
    ...shipped,
    migrations: Object.freeze([...shipped.migrations, '0062_future_phase_change.sql']),
  }));
});

test('D4 - the contract is wired into package scripts and CI', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(
    packageJson.scripts['test:him-snapshot-foreground-latency-safe-degradation-contract'],
    'node --test tests/him-snapshot-foreground-latency-safe-degradation-contract.test.mjs',
  );
  const ci = read('.github/workflows/api-ci.yml');
  const staticStep = ci.indexOf('test:him-snapshot-foreground-latency-safe-degradation-contract');
  assert.ok(staticStep > 0, 'CI runs this static contract');
  assert.ok(staticStep < ci.indexOf('Apply all migrations to fresh PostgreSQL'),
    'it runs before the database bootstrap: a pure static guard needs no database');
});

test('D5 - QHIA-014A changes no database file', () => {
  // Absolute: the expected database diff for this task is ZERO. The migration
  // freeze itself (the 0061 terminal phase baseline exists; no migration claims
  // this task's identity) lives inside the real guard as rule 10, runs over the
  // shipped world in D1, and is anti-vacuity-proven against a task-identity
  // listing in D2 - while D3 proves a later phase migration stays legal by
  // number. Here, prove the listing the guard consumed IS the real migrations
  // directory, read independently.
  assert.deepEqual(
    [...shipped.migrations],
    readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql')),
    'the world migration listing is exactly the real database/migrations directory',
  );
  // The two production files this task owns perform no database work of their
  // own: the Snapshot service still reaches the database through the one
  // pre-existing repository call, and the Orchestrator through none.
  for (const forbidden of ['SELECT ', 'INSERT ', 'UPDATE ', 'GRANT ', 'CREATE POLICY', 'rpc/', 'supabase', 'SUPABASE_']) {
    assert.ok(!executable(shipped.orchestrator).includes(forbidden), `the Orchestrator performs no database work: found ${forbidden}`);
    assert.ok(!executable(shipped.snapshotService).includes(forbidden), `the Snapshot service performs no database work: found ${forbidden}`);
  }
  assert.equal(
    (executable(shipped.snapshotService).match(/this\.repository\.readIntelligenceSnapshot\(/gu) ?? []).length,
    1,
    'the Snapshot service still issues exactly the one pre-existing repository read',
  );
});
