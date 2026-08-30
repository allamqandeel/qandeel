import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// QIR-006 Question / Information-Gap Closed Loop v1 static contract.
//
// This guard freezes exactly the QIR-006-owned invariants: migration 0063 and
// its terminal position at this contract's baseline, the total durable
// Information Gap lifecycle with sync-owned closure/reopen, the exact
// SELECTED/BOUND/RELEASED binding lifecycle, the service-role-only atomic
// selection command with canonical same-session scope authority
// (cross-session selection forbidden), the frozen 300 ms foreground selection
// ceiling, the atomic 8 KiB QUESTION slice inside the unchanged 131072-byte
// global ceiling, the sanitized provider-safe QuestionContext (no internal
// IDs/codes), the versioned finalization authority with the retired
// service-role signature closed as a bypass, exactly ONE conversational
// provider call, the exact QIR-005 provider registry and cap of 3 with no
// Question provider, and the QIR-003 gatherer staying Memory + Hypothesis
// only.
//
// QIR-008 phase closure repair. This guard once required migration 0063 to be
// the HIGHEST migration in the live repository. That was correct while QIR-006
// was proving its own baseline, but after QIR v1 closed it would have meant
// "0063 is forever the highest migration / 0064 may never exist". A historical
// verifier cannot prove that an old task added no later migration by scanning
// the future, mutable migration listing. It now freezes only the durable
// historical fact: 0063 EXISTS and was the terminal migration of the CLOSED
// QIR v1 historical baseline. Later, separately reviewed migrations are legal
// by number and by name; they still need their own reviewed contract, but this
// historical guard no longer rejects them. See
// docs/integrated-intelligence-runtime-phase-freeze-v1.md.
//
// FORWARD-SAFETY NOTES. Beyond the historical facts above, this guard must
// never freeze: provider/model
// identifiers (final Provider/LLM selection stays deferred; no provider
// adapter or model-profile source enters this world), Question utility
// ranking or Expected Information Gain (deferred), routing thresholds, local
// Memory/Hypothesis caps, or any future reviewed telemetry recorder or
// guidance block.
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const CONTRACT_DOC = 'docs/question-information-gap-closed-loop-v1.md';
const SOURCES = Object.freeze({
  contractDoc: CONTRACT_DOC,
  docsReadme: 'docs/README.md',
  packageJson: 'package.json',
  ci: '.github/workflows/api-ci.yml',
  migration: 'database/migrations/0063_question_information_gap_closed_loop_v1.sql',
  migrationVerifier: 'database/verify-migration-0063.mjs',
  migrationStaticTest: 'database/tests/question-information-gap-closed-loop-v1.test.mjs',
  selectionTypes: 'apps/api/src/question/question-foreground-selection.types.ts',
  questionContextTypes: 'apps/api/src/question/question-context.types.ts',
  selectionService: 'apps/api/src/question/question-foreground-selection.service.ts',
  selectionSpec: 'apps/api/src/question/question-foreground-selection.service.spec.ts',
  questionService: 'apps/api/src/question/question.service.ts',
  orchestrator: 'apps/api/src/conversation/conversation-orchestrator.service.ts',
  orchestratorSpec: 'apps/api/src/conversation/conversation-orchestrator.service.spec.ts',
  conversationRepository: 'apps/api/src/conversation/conversation.repository.ts',
  budgetContract: 'apps/api/src/intelligence-runtime/integrated-context-budget-contract.ts',
  assembler: 'apps/api/src/intelligence-runtime/integrated-context-budget-assembler.service.ts',
  gatherer: 'apps/api/src/intelligence-runtime/bounded-foreground-intelligence-gatherer.service.ts',
  guidance: 'apps/api/src/model-router/model-router.types.ts',
  providerBudget: 'apps/api/src/post-response-intelligence/post-response-provider-budget.ts',
  postResponseRepository: 'apps/api/src/post-response-intelligence/post-response-intelligence.repository.ts',
  telemetry: 'apps/api/src/observability/telemetry.service.ts',
});
const shipped = Object.freeze({
  ...Object.fromEntries(Object.entries(SOURCES).map(([key, path]) => [key, read(path)])),
  migrations: Object.freeze(readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql'))),
});

const CONTRACT_SCRIPT = 'test:question-information-gap-closed-loop-v1-contract';
const CONTRACT_COMMAND = 'node --test tests/question-information-gap-closed-loop-v1-contract.test.mjs';
const VERIFIER_SCRIPT = 'verify:question-information-gap-closed-loop:integration';
const VERIFIER_COMMAND = 'node --env-file-if-exists=.env database/verify-migration-0063.mjs';
const TERMINAL_MIGRATION = '0063_question_information_gap_closed_loop_v1.sql';

// QIR-008 phase closure repair: hypothetical later migrations that must stay
// legal for this historical guard. Listing entries only - no real migration
// exists or is ever created here, and migration 0063 is never modified.
const FUTURE_MIGRATION_FIXTURES = Object.freeze([
  '0064_future_product_phase.sql',
  '0065_voice_runtime_v1.sql',
  '0066_subscription_runtime_v1.sql',
  '0064_question_information_gap_closed_loop_v2.sql',
]);

// Required statements of the normative document, checked against
// whitespace-flattened text so markdown line wrapping never splits a marker.
const REQUIRED_DOC_STATEMENTS = Object.freeze([
  '# QANDEEL — Question / Information-Gap Closed Loop v1',
  '**Status: ACTIVE / NORMATIVE**',
  '**Task:** QIR-006 — Question / Information-Gap Closed Loop v1',
  '1f4413422e0781622b03b5b412ee6e81adad7a2e',
  '125ae6522e7a67565679f9c27e1a4954462b66e0',
  '33314624686',
  '`database/migrations/0063_question_information_gap_closed_loop_v1.sql` — **migration 0063 is the new terminal migration of this contract\'s baseline.**',
  'A later, separately reviewed migration in any domain remains legal by number and by name: QIR-008 phase closure repaired this contract\'s static guard so it freezes only the durable historical fact that migration 0063 EXISTS and was the terminal migration of the CLOSED QIR v1 historical baseline.',
  // The implementation principle.
  '**QANDEEL may ask because canonical intelligence says one information need is still open; it may stop asking only because canonical intelligence says that need changed, resolved, or became obsolete — never merely because a user happened to send another message.**',
  // Lifecycle.
  '`MISSING_INFORMATION_CODE_ABSENT` for RESOLVED',
  '`HYPOTHESIS_VERSION_ADVANCED` or `HYPOTHESIS_LIFECYCLE_INELIGIBLE` for SUPERSEDED',
  '**A user turn by itself never resolves a gap: no "next user turn = answered" heuristic exists anywhere.**',
  'open_epoch + 1, closure metadata cleared — exactly once per recurrence',
  'The states are deliberately NOT named `ASKED`/`ANSWERED`',
  'no question text, no transcript, no provider payload, and no hidden reasoning',
  // Closure authority.
  'exactly ONE process-level materialization/closure implementation exists',
  'Repeated synchronization of identical durable sources is a lifecycle no-op: no duplicate gaps, no repeated epoch increments.',
  // Topology and ceiling.
  '**Safety GUIDED and BLOCK perform ZERO formal Question selection**',
  '`QUESTION_FOREGROUND_WAIT_BUDGET_MS = 300` is frozen in',
  'the late result is discarded for this turn, the assembled provider request is never mutated, no second provider call ever happens, and nothing is cached into a later turn',
  '`SELECTED`, `LEGITIMATE_EMPTY` (bounded reason `NO_ELIGIBLE_GAP` or `OUTSTANDING_OPEN_QUESTION`), `OPTIONAL_AVAILABILITY_FAILURE`, `FOREGROUND_BUDGET_EXPIRY`',
  'Only a Nest `ServiceUnavailableException` or a canonical service-role API status of 408, 429, or 500..599 may degrade',
  // Eligibility.
  '**cross-session questioning is forbidden**, and session relevance is the canonical Hypothesis scope authority, never similarity, embeddings, or an LLM',
  'oldest eligible gap by the canonical creation ordinal (`created_at`), stable UUID tie-break',
  'No utility ranking, no Expected Information Gain, no content heuristic, no source voting — all explicitly deferred.',
  // Budget.
  'The global ceiling remains exactly `131072` UTF-8 bytes; no other slice moved by a single byte; no borrowing.',
  '**Question is ATOMIC**: legal outcomes are exactly `NOT_PRESENT`, `INCLUDED_FULL`, `OMITTED_BUDGET`, and `PARTIALLY_RETAINED` is illegal for `QUESTION`.',
  // Provider safety.
  'It never carries an Information Gap id, Hypothesis id, Confidence evaluation id, missing-information code, Hypothesis statement, Confidence score/band, internal ranking, hidden reasoning, or any user/session/turn UUID.',
  '**The server chooses the opportunity; the model only phrases it.**',
  // Finalization.
  '**The previous service-role finalization RPC is retired**',
  '`RETIRED_CONVERSATION_FINALIZATION_AUTHORITY`',
  // One provider call / QIR-005.
  'QIR-006 adds no Question provider, no `QUESTION_PROVIDER` effect, no fourth background provider slot, no second conversational provider call',
  '`POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 3`, and the QIR-003 gatherer remains Memory + Hypothesis only.',
  // Telemetry.
  'qandeel.question.foreground_selection',
  // Deferred.
  '`generateValidated(...)` fails closed when the referenced Information Gap is no longer OPEN',
  // QIR-006-F02 — the two authorities inside one update receipt.
  '### 3.1 Two authorities inside one update receipt',
  '**Both `EVALUATED` and `PENDING_RETRY` receipts therefore contribute their Hypothesis to the bounded reconciliation target set**',
  '**No Confidence row is required**: a `PENDING_RETRY` attempt failed by definition, so none is guaranteed to exist.',
  '**never authorizes RESOLVED, never authorizes a reopen, and never states presence or absence of any missing-information code**',
  'no gap is ever materialized from a `PENDING_RETRY` receipt',
  '### 5.1 "Outstanding" is decided against canonical current state',
  '**This is defense in depth, not a second closure engine.**',
  'closure remains owned exclusively by the synchronization authority',
]);

const executable = (source) => source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const stripSql = (source) => source.replace(/^\s*--.*$/gmu, '');
const slice = (source, start, end) => {
  const from = source.indexOf(start);
  if (from < 0) return '';
  const to = source.indexOf(end, from + start.length);
  return to < 0 ? source.slice(from) : source.slice(from, to);
};
const count = (source, needle) => source.split(needle).length - 1;

function violated(property) {
  throw new Error(`QIR-006 Question closed-loop contract violated: ${property}`);
}

function assertQuestionClosedLoopContract(world) {
  const exe = Object.fromEntries(Object.entries(world)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, source]) => [key, executable(source)]));

  // 1. The normative document exists, is substantive, and records every frozen
  //    statement (whitespace-flattened, wrap-safe).
  if (typeof world.contractDoc !== 'string' || world.contractDoc.length < 12000)
    violated('the QIR-006 normative document exists and is substantive');
  const flattened = world.contractDoc.replace(/\s+/gu, ' ');
  for (const statement of REQUIRED_DOC_STATEMENTS) {
    if (!flattened.includes(statement)) violated(`the document records: ${statement}`);
  }
  if (!world.docsReadme.includes('question-information-gap-closed-loop-v1.md'))
    violated('docs/README.md links the QIR-006 normative document');

  // 2. Migration 0063 EXISTS. It was the terminal migration of the CLOSED QIR
  //    v1 historical baseline - a durable historical fact recorded in the
  //    phase freeze document, never a ceiling on the live repository's future
  //    migration numbering (QIR-008 phase closure repair).
  if (!Array.isArray(world.migrations) || !world.migrations.includes(TERMINAL_MIGRATION))
    violated('migration 0063 exists');

  // 3. The frozen 300 ms foreground ceiling lives in the Question module (the
  //    orchestrator gains no timer) and the policy version is exactly "1".
  if (!world.selectionTypes.includes('export const QUESTION_FOREGROUND_WAIT_BUDGET_MS = 300;'))
    violated('QUESTION_FOREGROUND_WAIT_BUDGET_MS is frozen at exactly 300');
  if (/QUESTION_FOREGROUND_WAIT_BUDGET_MS = (?!300;)/u.test(exe.selectionTypes + exe.selectionService))
    violated('the 300 ms Question foreground ceiling is never redefined');
  if (!world.selectionTypes.includes("export const QUESTION_FOREGROUND_SELECTION_POLICY_VERSION = '1';"))
    violated('the QIR-006 selection policy version is exactly "1"');
  if (world.orchestrator.includes('QUESTION_FOREGROUND_WAIT_BUDGET_MS'))
    violated('the orchestrator never names the Question ceiling: the timer lives in the Question module');

  // 4. Typed outcomes and the exact availability classifier: only
  //    ServiceUnavailableException and canonical 408/429/5xx may degrade;
  //    everything else stays hard fail-closed with the ORIGINAL error.
  for (const outcomeLiteral of ["'SELECTED'", "'LEGITIMATE_EMPTY'", "'OPTIONAL_AVAILABILITY_FAILURE'", "'FOREGROUND_BUDGET_EXPIRY'"]) {
    if (!world.selectionTypes.includes(outcomeLiteral)) violated(`the typed outcome vocabulary carries ${outcomeLiteral}`);
  }
  if (!world.selectionTypes.includes("export const QUESTION_LEGITIMATE_EMPTY_REASONS = ['NO_ELIGIBLE_GAP', 'OUTSTANDING_OPEN_QUESTION'] as const;"))
    violated('the legitimate-empty reasons are exactly the two bounded values');
  if (!world.selectionService.includes('return status === 408 || status === 429 || (Number.isInteger(status) && status >= 500 && status <= 599);'))
    violated('the availability classifier approves exactly 408, 429, and 500..599');
  if (!world.selectionService.includes('if (error instanceof ServiceUnavailableException) return OPTIONAL_AVAILABILITY_FAILURE_OUTCOME;'))
    violated('the sanitized transport/configuration identity may degrade');
  if (!world.selectionService.includes('throw error;'))
    violated('everything else rethrows the ORIGINAL error and fails the turn closed');
  if (/\.message\.includes\(|\.message\.match\(|\.message\.indexOf\(/u.test(exe.selectionService))
    violated('no error-message substring matching exists in the selection service');
  if (!world.selectionService.includes('throw new QuestionForegroundMalformedResultError();'))
    violated('a malformed successful selection result fails CLOSED through the typed identity');

  // 5. Exactly ONE selection RPC carrying ONLY the caller identity triple: the
  //    application supplies no gap/hypothesis/confidence identity, no code, no
  //    objective, no status, and no epoch as authority.
  if (count(world.selectionService, "this.serviceApi.rpc") !== 1)
    violated('the selection service issues exactly ONE service-role RPC');
  if (!world.selectionService.includes("this.serviceApi.rpc<unknown>('select_formal_question_opportunity_v1', {"))
    violated('the ONE selection RPC targets the canonical atomic selection command');
  if (!world.selectionService.includes('p_user_id: input.userId, p_session_id: input.sessionId, p_source_turn_id: input.sourceTurnId,'))
    violated('the selection RPC carries ONLY the caller identity triple');

  // 6. The provider-safe QuestionContext carries the sanitized objective ONLY.
  const contextShape = slice(world.questionContextTypes, 'export interface QuestionContextV1 {', '}');
  if (!contextShape) violated('the provider-safe QuestionContextV1 shape exists');
  for (const field of ['contractVersion', 'source', 'questionType', "answerFormat: 'FREE_TEXT'", 'informationObjective']) {
    if (!contextShape.includes(field)) violated(`QuestionContextV1 carries ${field}`);
  }
  for (const forbidden of ['Id;', 'Id:', 'uuid', 'missingInformationCode', 'statement', 'score', 'epoch', 'session', 'turn']) {
    if (contextShape.includes(forbidden)) violated(`QuestionContextV1 never carries an internal identity: found ${forbidden}`);
  }
  if (!world.questionContextTypes.includes("export const QUESTION_CONTEXT_SOURCE = 'QANDEEL_QUESTION_ENGINE';"))
    violated('the QuestionContext source identity is exactly QANDEEL_QUESTION_ENGINE');
  if (!world.questionContextTypes.includes("export const FORMAL_QUESTION_TYPES = ['FACT_FINDING', 'VALIDATION', 'DISCRIMINATING'] as const;"))
    violated('the formal question taxonomy is exactly the three server-owned types');
  // The three fixed server-owned objectives, and the literal internal source
  // codes never enter the provider-facing module.
  for (const objective of [
    'Ask for one concrete example, event, observation, or experience detail that could provide direct evidence relevant to the current topic.',
    'Ask the user to confirm, reject, or clarify one important unresolved assumption in the current topic.',
    'Ask for one detail that may help distinguish between plausible interpretations of the current situation.',
  ]) {
    if (!world.questionContextTypes.includes(objective)) violated(`the fixed server-owned objective exists: ${objective}`);
  }
  if (/NO_ELIGIBLE_EVIDENCE|UNVERIFIED_ASSUMPTIONS|COMPETING_HYPOTHESES_UNASSESSED/u.test(world.questionContextTypes))
    violated('the literal internal missing-information codes never enter the provider-facing Question module');
  // The SELECTED outcome builds the context exclusively from the derived
  // question type; the reservation identity never enters the context.
  if (!world.selectionService.includes('return { state: \'SELECTED\', bindingId: row.binding_id, questionContext: buildQuestionContext(row.question_type) };'))
    violated('the sanitized QuestionContext is built ONLY from the server-derived question type');

  // 7. Orchestrator topology: launched post-Safety on ALLOW only, as a sibling
  //    lane between the QIR-003 gather launch and the Human Intelligence join,
  //    joined by a sequential await, never a new barrier or timer.
  const launchLine = "      const questionSelectionPromise = safety.disposition === 'ALLOW'";
  const launchAt = world.orchestrator.indexOf(launchLine);
  const swallowAt = world.orchestrator.indexOf('foregroundGatherPromise.catch(() => undefined);');
  const questionSwallowAt = world.orchestrator.indexOf('questionSelectionPromise?.catch(() => undefined);');
  const himJoinAt = world.orchestrator.indexOf('await himForegroundLanePromise');
  const gatherJoinAt = world.orchestrator.indexOf('await foregroundGatherPromise');
  const questionJoinAt = world.orchestrator.indexOf('const questionForeground = questionSelectionPromise ? await questionSelectionPromise : undefined;');
  if (launchAt < 0) violated('the Question selection lane is launched on the exact Safety ALLOW gate');
  if (questionSwallowAt < 0) violated('the question swallow handler is attached immediately at launch');
  if (!(swallowAt > 0 && swallowAt < launchAt && launchAt < questionSwallowAt && questionSwallowAt < himJoinAt))
    violated('Question selection launches in the same post-Safety stage, before any lane is awaited');
  if (!(gatherJoinAt > 0 && gatherJoinAt < questionJoinAt))
    violated('the question join is a sequential await after the already-running gather join');
  if (!world.orchestrator.includes("? this.questionForegroundSelection.select({ userId, sessionId: userTurn.session_id, sourceTurnId: userTurn.id, path: selection.path })"))
    violated('the orchestrator supplies exactly the caller identity triple plus the path');
  if (count(world.orchestrator, 'this.questionForegroundSelection.select(') !== 1)
    violated('exactly one Question selection launch exists per provider-generating turn');
  if ((world.orchestrator.match(/Promise\.all\(/gu) ?? []).length !== 1)
    violated('QIR-006 adds no second foreground barrier');
  if ((world.orchestrator.match(/setTimeout\(/gu) ?? []).length !== 2)
    violated('QIR-006 adds no new orchestrator timer');
  // The offered QuestionContext and the binding authority are FINAL-REQUEST
  // authoritative, mirroring the QIR-004 Fix 01 `consumed` rule.
  if (!world.orchestrator.includes("...(questionForeground?.state === 'SELECTED' ? { questionContext: questionForeground.questionContext } : {}),"))
    violated('the sanitized QuestionContext is offered to assembly only on a SELECTED outcome');
  if (!world.orchestrator.includes("...(assembled.request.questionContext !== undefined && questionForeground?.state === 'SELECTED'"))
    violated('the binding identity travels to finalization only when the FINAL normalized request carries the QuestionContext');
  if (!world.orchestrator.includes('? { questionBindingId: questionForeground.bindingId } : {}),'))
    violated('a budget-omitted Question withholds the binding identity so the reservation is not consumed');

  // 8. Exactly ONE conversational provider invocation, and no Question
  //    provider anywhere: the QIR-005 registry and hard cap stay EXACT.
  if ((world.orchestrator.match(/this\.router\.generate\(/gu) ?? []).length !== 1)
    violated('exactly one conversational provider invocation exists on the turn path');
  if (!world.providerBudget.includes("export const POST_RESPONSE_PROVIDER_EFFECTS_V1 = [\n  'ASSOCIATION_PROVIDER',\n  'INTENT_PROVIDER',\n  'CANDIDATE_PROVIDER',\n] as const;"))
    violated('the QIR-005 provider-backed registry remains exactly the three frozen effects');
  if (!world.providerBudget.includes('export const POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 3;'))
    violated('the QIR-005 hard provider-call budget remains exactly 3');
  if (/QUESTION_PROVIDER/u.test(exe.providerBudget) || /QUESTION_PROVIDER/u.test(exe.selectionService) || /QUESTION_PROVIDER/u.test(stripSql(world.migration)))
    violated('no QUESTION_PROVIDER effect exists anywhere');
  if (/router\.generate|ModelRouter\b|withProvider\(/u.test(exe.selectionService))
    violated('the Question selection service makes no provider or LLM call of its own');

  // 9. QIR-003 stays Memory + Hypothesis only: the gatherer names exactly its
  //    two sources and no Question surface.
  if (!world.gatherer.includes("'MEMORY' | 'HYPOTHESIS'"))
    violated('the QIR-003 gatherer still owns exactly Memory and Hypothesis');
  if (/question/iu.test(exe.gatherer.replace(/not a Question engine \(QIR-006\)/u, '')))
    violated('no Question surface entered the QIR-003 gatherer');

  // 10. The atomic 8 KiB QUESTION slice inside the unchanged global ceiling.
  if (!world.budgetContract.includes('export const QUESTION_BUDGET_BYTES = 8192;'))
    violated('the Question slice is exactly 8192 bytes');
  if (!world.budgetContract.includes('export const GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES = 131072;'))
    violated('the global normalized model-input ceiling remains exactly 131072 bytes');
  if (world.budgetContract.includes('FUTURE_RESERVED_BUDGET_BYTES'))
    violated('the unused-future-reserve semantics are retired: the reserve became the Question slice');
  const questionRetention = slice(exe.assembler, 'private retainAtomicQuestion(', '\n  }');
  if (!questionRetention) violated('the atomic Question retention algorithm exists');
  if (!questionRetention.includes("if (offeredBytes > QUESTION_BUDGET_BYTES) return { outcome: 'OMITTED_BUDGET', retained: undefined, offeredBytes, retainedBytes: 0 };"))
    violated('an oversized Question package is omitted ATOMICALLY, never truncated');
  if (questionRetention.includes("'PARTIALLY_RETAINED'"))
    violated('PARTIALLY_RETAINED is illegal for QUESTION');
  if (!exe.assembler.includes('if (question.retainedBytes > QUESTION_BUDGET_BYTES) throw new IntegratedContextBudgetInvariantError();'))
    violated('the Question slice participates in the fail-closed accounting');
  if (!world.telemetry.includes("['QUESTION',new Set(['NOT_PRESENT','INCLUDED_FULL','OMITTED_BUDGET'])],"))
    violated('the QUESTION telemetry pair set is exactly the three atomic outcomes');

  // 11. Rendering: the question block renders LAST, only when present, and the
  //     serialized data travels through the canonical escaping.
  const questionBlock = slice(exe.guidance, 'if (request.questionContext) {', '\n  }');
  if (!questionBlock) violated('the provider-neutral question guidance block exists');
  if (!questionBlock.includes('<question_context>')) violated('the question data container exists');
  if (!questionBlock.includes('${escapeStructuredData(request.questionContext)}'))
    violated('the question data travels through the canonical structured-data escaping');
  const questionBlockAt = exe.guidance.indexOf('<question_context>');
  const recommendationBlockAt = exe.guidance.indexOf('<recommendation_grounding_context>');
  if (!(recommendationBlockAt > 0 && recommendationBlockAt < questionBlockAt))
    violated('the question block renders after every existing data block');
  for (const instruction of [
    "Answer the user's current request first",
    'phrase one concise natural follow-up question that serves the supplied information objective',
    'Never expose internal system terms or state to the user',
    'Do not present an inference as an established fact',
    'Do not invent additional formal question needs beyond this one objective',
    'Do not demand an answer',
    'may choose not to answer',
    'Never request credentials, secrets, passwords, or other forbidden sensitive information',
  ]) {
    if (!world.guidance.includes(instruction)) violated(`the provider guidance instructs: ${instruction}`);
  }

  // 12. Finalization: the repository calls ONLY the versioned authority, and
  //     migration 0063 retires the previous service-role signature as a
  //     writeless tombstone with zero EXECUTE.
  if (!world.conversationRepository.includes("this.serviceApi.rpc<Array<{ user_turn: ConversationTurn; assistant_turn: ConversationTurn }>>('finalize_conversation_turn_v2', {"))
    violated('canonical finalization runs through the versioned migration-0063 authority');
  if (!world.conversationRepository.includes('p_question_binding_id: input.questionBindingId ?? null,'))
    violated('the reservation identity travels through the ONE finalization call');
  if (/'finalize_conversation_turn'/u.test(exe.conversationRepository))
    violated('the retired finalization signature is unreachable from the application repository');
  const sql = stripSql(world.migration);
  if (!sql.includes('RETIRED_CONVERSATION_FINALIZATION_AUTHORITY'))
    violated('the retired finalization signature is a raising tombstone');
  if (!world.migration.includes('REVOKE ALL ON FUNCTION public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;'))
    violated('the retired finalization signature holds zero EXECUTE for every application role');

  // 13. The migration owns the exact lifecycle enums, the canonical
  //     same-session scope authority, and sync-owned closure/reopen.
  if (!sql.includes("status IN ('OPEN','RESOLVED','SUPERSEDED')"))
    violated('the durable gap lifecycle is exactly OPEN/RESOLVED/SUPERSEDED');
  if (!sql.includes("CHECK(state IN ('SELECTED','BOUND','RELEASED'))"))
    violated('the binding lifecycle is exactly SELECTED/BOUND/RELEASED');
  if (/'ASKED'|'ANSWERED'/u.test(sql))
    violated('no misleading ASKED/ANSWERED state exists');
  if (!sql.includes("h.scope='CONVERSATION_SESSION:'||p_session_id::text"))
    violated('cross-session selection is forbidden by the canonical Hypothesis session scope authority');
  if (!sql.includes('CREATE FUNCTION public.sync_post_response_information_gaps_v2(p_execution_id uuid)'))
    violated('the versioned synchronization authority owns closure/reopen');
  if (!sql.includes('RETURN public.sync_post_response_information_gaps_v2(p_execution_id);'))
    violated('the v1 synchronization entry point is a pure delegation: one closure implementation exists');
  if (!sql.includes('open_epoch=reconcile_gap.open_epoch+1'))
    violated('a legitimate recurrence increments the epoch exactly once');
  // QIR-006-F02: the two receipt authorities are separated. EVERY successful
  // mutation receipt reconciles (so a PENDING_RETRY version advance cannot
  // leave a stale gap OPEN); only EVALUATED contributes a fresh Confidence
  // source (so PENDING_RETRY can never fabricate RESOLVED, a reopen, or a new
  // gap). The reconciliation-target step must come BEFORE the EVALUATED gate.
  // Scoped to the synchronization function BODY: the migration's own
  // postconditions quote these needles as data, so an unscoped scan would pass
  // even if the live predicate were deleted.
  const syncBody = slice(sql, 'CREATE FUNCTION public.sync_post_response_information_gaps_v2(p_execution_id uuid)', 'ALTER FUNCTION public.sync_post_response_information_gaps_v2');
  if (!syncBody) violated('the versioned synchronization authority exists as a bounded block');
  if (!syncBody.includes('reconcile_hypothesis_ids := array_append(reconcile_hypothesis_ids,mutated_hypothesis_id)'))
    violated('every successful mutation receipt enters the reconciliation target set');
  if (!syncBody.includes('mutation_row.version<mutated_after_version'))
    violated('the reconciliation target authority proves the mutated version against canonical current state');
  if (!syncBody.includes('cardinality(reconcile_hypothesis_ids)>9'))
    violated('the reconciliation target set stays bounded and fails closed');
  const reconcileAppendAt = syncBody.indexOf('reconcile_hypothesis_ids := array_append(reconcile_hypothesis_ids,mutated_hypothesis_id)');
  const evaluatedGateAt = syncBody.indexOf("IF receipt->>'confidenceStatus'='EVALUATED' THEN");
  if (evaluatedGateAt < 0 || !(reconcileAppendAt < evaluatedGateAt))
    violated('the fresh Confidence authority stays EVALUATED-only and follows the reconciliation target step');
  // The outstanding-question check is canonical-current-state authoritative:
  // the same authority dimensions selection eligibility uses appear on BOTH
  // the eligibility query and the outstanding query. Scoped to the selection
  // function BODY for the same reason as above.
  const selectionBody = slice(sql, 'CREATE FUNCTION public.select_formal_question_opportunity_v1(', 'ALTER FUNCTION public.select_formal_question_opportunity_v1');
  if (!selectionBody) violated('the atomic selection command exists as a bounded block');
  for (const [needle, property] of [
    ['h.version=s.target_version', 'current Hypothesis version'],
    ['public.question_eligible_hypothesis_lifecycle_v1(h.status)', 'questioning-eligible lifecycle'],
    ["h.scope='CONVERSATION_SESSION:'||p_session_id::text", 'same-session scope'],
  ]) {
    if (count(selectionBody, needle) < 2)
      violated(`the outstanding-question check is authority-based on the ${property}, exactly like selection eligibility`);
  }
  if (!world.postResponseRepository.includes("'rpc/sync_post_response_information_gaps_v1'"))
    violated('the post-response repository still enters through the stable synchronization entry point');
  // Closure is canonical-state-owned: no answer heuristic anywhere on the
  // closed loop (the frozen 0007 user_answerability column is whitelisted).
  if (/answer(?!ability)|classif|keyword/iu.test(stripSql(world.migration)))
    violated('no answer-detection heuristic, classifier, or keyword rule exists in the closed loop');

  // 14. Foundation compatibility: candidate generation fails closed on a
  //     non-OPEN gap.
  if (!world.questionService.includes("if (gap.status !== 'OPEN') throw new BadRequestException('Information gap is not open.');"))
    violated('generateValidated fails closed when the referenced gap is no longer OPEN');

  // 15. Bounded fail-soft telemetry: the exact metric, the finite registries,
  //     and no identity/content dimension.
  if (!world.telemetry.includes("createCounter('qandeel.question.foreground_selection')"))
    violated('the QIR-006 selection metric exists');
  if (!world.telemetry.includes("const QUESTION_FOREGROUND_OUTCOMES:ReadonlySet<string>=new Set(['SELECTED','LEGITIMATE_EMPTY','OPTIONAL_AVAILABILITY_FAILURE','FOREGROUND_BUDGET_EXPIRY','HARD_FAILURE']);"))
    violated('the selection outcome registry is exactly the five frozen outcomes');
  if (!world.telemetry.includes("const QUESTION_FOREGROUND_EMPTY_REASONS:ReadonlySet<string>=new Set(['NO_ELIGIBLE_GAP','OUTSTANDING_OPEN_QUESTION']);"))
    violated('the empty-reason registry is exactly the two bounded reasons');
  const questionMetricGates = slice(world.telemetry, ' recordQuestionForegroundSelection(', 'this.questionForegroundSelections.add');
  for (const gate of ['QUESTION_FOREGROUND_OUTCOMES.has(outcome)', 'isRuntimeRoutingPath(path)', "outcome!=='LEGITIMATE_EMPTY'||!QUESTION_FOREGROUND_EMPTY_REASONS.has(emptyReason)"]) {
    if (!questionMetricGates.includes(gate))
      violated(`the selection metric drops anything outside its finite registries: missing ${gate}`);
  }

  // 16. The deterministic runtime proofs exist.
  for (const proof of [
    'freezes the QIR-006 foreground wait ceiling at exactly 300 ms',
    'issues exactly ONE selection RPC carrying only the caller identity triple',
    'returns SELECTED with the reservation identity and the exact sanitized provider-safe QuestionContext',
    'classifies FOREGROUND_BUDGET_EXPIRY at exactly the 300 ms boundary and discards the late fulfillment',
    'absorbs a late rejection after expiry with no unhandled rejection and no extra outcome',
    'degrades the approved transient status',
    'fails CLOSED on authority/integrity status',
    'treats %s as HARD_FAILURE - never reinterpreted as empty, never fabricated into omission',
    'keeps telemetry fail-soft: a throwing recorder never alters the selection outcome',
  ]) {
    if (!world.selectionSpec.includes(proof))
      violated(`the focused selection spec proves the bound deterministically: missing ${proof}`);
  }
  for (const proof of [
    'launches Question selection concurrently in the post-Safety stage',
    'performs ZERO formal Question selection on a Safety BLOCK',
    'performs ZERO formal Question selection on a Safety GUIDED turn while the ONE conversational provider call still happens',
    'sends the sanitized QuestionContext inside the ONE final normalized provider request and binds the reservation at finalization when it survived assembly',
    'omits an oversized Question ATOMICALLY at the 8 KiB slice and finalizes WITHOUT a binding identity so the reservation is not consumed',
    'continues the turn with no QuestionContext and exactly ONE provider call on %s',
    'fails the turn CLOSED with ZERO provider calls when Question selection hard-fails',
    'never selects on replay, recovery, or a lost claim: zero selection RPCs on every no-work path',
  ]) {
    if (!world.orchestratorSpec.includes(proof))
      violated(`the orchestrator spec proves the QIR-006 turn topology: missing ${proof}`);
  }
  // The database matrix is registered: the real-PostgreSQL verifier and the
  // frozen-migration static test both exist and stay substantive.
  if (typeof world.migrationVerifier !== 'string' || world.migrationVerifier.length < 10000)
    violated('the migration-0063 verifier exists and is substantive');
  for (const proof of [
    'OUTSTANDING_OPEN_QUESTION', 'reuses the same SELECTED reservation', 'released the unconsumed reservation',
    'reopens with epoch+1', 'RETIRED_CONVERSATION_FINALIZATION_AUTHORITY', 'blocks on the serialization key',
    // QIR-006-F02 regression proof, driven through the REAL managed batch.
    'execute_post_response_hypothesis_update_batch_v1',
    'the mutation batch commits despite the failed Confidence attempt',
    'a PENDING_RETRY version advance supersedes the old exact-version gap and never moves the epoch',
    'no version-2 gap is fabricated',
    'no RESOLVED closure is fabricated from a failed Confidence attempt',
    'a superseded bound question no longer holds the session hostage',
    'a receipt claiming a version canonical state never reached fails closed',
    'a stale BOUND row cannot block the session on a lagging OPEN gap alone',
  ]) {
    if (!world.migrationVerifier.includes(proof)) violated(`the migration verifier proves: ${proof}`);
  }
  if (typeof world.migrationStaticTest !== 'string' || !world.migrationStaticTest.includes('formal_question_one_active_reservation_per_gap_epoch'))
    violated('the frozen-migration static test pins the concurrency indexes');

  // 17. Registration: package scripts and CI steps in the canonical positions.
  const packageJson = JSON.parse(world.packageJson);
  if (packageJson.scripts?.[CONTRACT_SCRIPT] !== CONTRACT_COMMAND)
    violated(`the package script remains registered exactly: ${CONTRACT_SCRIPT}`);
  if (packageJson.scripts?.[VERIFIER_SCRIPT] !== VERIFIER_COMMAND)
    violated(`the verifier script remains registered exactly: ${VERIFIER_SCRIPT}`);
  const contractStep = world.ci.indexOf(CONTRACT_SCRIPT);
  const bootstrap = world.ci.indexOf('Apply all migrations to fresh PostgreSQL');
  if (contractStep < 0) violated('CI runs the QIR-006 static contract');
  if (!(contractStep < bootstrap))
    violated('the QIR-006 static contract runs in CI before the database bootstrap');
  const verifierStep = world.ci.indexOf(VERIFIER_SCRIPT);
  if (verifierStep < 0) violated('CI runs the migration-0063 verifier');
  if (!(verifierStep > bootstrap))
    violated('the migration-0063 verifier runs in CI after the fresh-PostgreSQL migration chain');
}

test('Q1 - the shipped repository satisfies the QIR-006 contract', () => {
  assert.doesNotThrow(() => assertQuestionClosedLoopContract(shipped));
});

test('Q2 - anti-vacuity: the real guard rejects every named regression', () => {
  const drifts = [
    ['the normative document was deleted', { contractDoc: '' }],
    ['the user-turn-never-resolves rule was withdrawn from the document', {
      contractDoc: shipped.contractDoc.replace('**A user turn by itself never resolves a', 'A user turn resolves a'),
    }],
    ['the cross-session prohibition was withdrawn from the document', {
      contractDoc: shipped.contractDoc.replace('**cross-session questioning is forbidden**', 'cross-session questioning is allowed'),
    }],
    ['the docs index lost the document link', {
      docsReadme: shipped.docsReadme.replaceAll('question-information-gap-closed-loop-v1.md', 'missing.md'),
    }],
    ['migration 0063 disappeared from the listing', {
      migrations: Object.freeze(shipped.migrations.filter((name) => name !== TERMINAL_MIGRATION)),
    }],
    ['the QIR-008 forward-safety statement was withdrawn from the document', {
      contractDoc: shipped.contractDoc.replace(
        'A later, separately reviewed migration in any domain remains legal by number and by name',
        'No later migration may ever land'),
    }],
    ['the 300 ms ceiling was raised', {
      selectionTypes: shipped.selectionTypes.replace('export const QUESTION_FOREGROUND_WAIT_BUDGET_MS = 300;', 'export const QUESTION_FOREGROUND_WAIT_BUDGET_MS = 5000;'),
    }],
    ['the orchestrator started owning the Question timer', {
      orchestrator: shipped.orchestrator.replace('questionSelectionPromise?.catch(() => undefined);', 'questionSelectionPromise?.catch(() => undefined); void QUESTION_FOREGROUND_WAIT_BUDGET_MS;'),
    }],
    ['a 400-class status became degradable', {
      selectionService: shipped.selectionService.replace(
        'return status === 408 || status === 429 || (Number.isInteger(status) && status >= 500 && status <= 599);',
        'return status === 401 || status === 408 || status === 429 || (Number.isInteger(status) && status >= 500 && status <= 599);',
      ),
    }],
    ['malformed success stopped failing closed', {
      selectionService: shipped.selectionService.replaceAll('throw new QuestionForegroundMalformedResultError();', "return { state: 'LEGITIMATE_EMPTY', reason: 'NO_ELIGIBLE_GAP' };"),
    }],
    ['substring matching entered the selection classifier', {
      selectionService: shipped.selectionService.replace(
        'if (error instanceof ServiceUnavailableException) return OPTIONAL_AVAILABILITY_FAILURE_OUTCOME;',
        "if (error instanceof ServiceUnavailableException || String(error?.message).includes('BUSY')) return OPTIONAL_AVAILABILITY_FAILURE_OUTCOME;",
      ).replace('function classifyQuestionSelectionFailure', 'function classifyQuestionSelectionFailure2').replace('(error) => classifyQuestionSelectionFailure2(error)', '(error) => { if (String(error?.message).includes(\'BUSY\')) return OPTIONAL_AVAILABILITY_FAILURE_OUTCOME; throw error; }'),
    }],
    ['a second selection RPC appeared', {
      selectionService: shipped.selectionService.replace(
        'const classified = selectionRead.then(',
        "void this.serviceApi.rpc<unknown>('select_formal_question_opportunity_v1', { p_user_id: input.userId, p_session_id: input.sessionId, p_source_turn_id: input.sourceTurnId });\n    const classified = selectionRead.then(",
      ),
    }],
    ['an internal identifier entered QuestionContextV1', {
      questionContextTypes: shipped.questionContextTypes.replace('readonly informationObjective: string;', 'readonly informationObjective: string;\n  readonly informationGapId: string;'),
    }],
    ['the literal internal code entered the provider-facing module', {
      questionContextTypes: shipped.questionContextTypes.replace("FACT_FINDING: 'Ask for one concrete example", "FACT_FINDING: 'NO_ELIGIBLE_EVIDENCE: Ask for one concrete example"),
    }],
    ['the Question launch stopped being gated on Safety ALLOW', {
      orchestrator: shipped.orchestrator.replace(
        "      const questionSelectionPromise = safety.disposition === 'ALLOW'\n        ? this.questionForegroundSelection.select({ userId, sessionId: userTurn.session_id, sourceTurnId: userTurn.id, path: selection.path })\n        : undefined;",
        '      const questionSelectionPromise = this.questionForegroundSelection.select({ userId, sessionId: userTurn.session_id, sourceTurnId: userTurn.id, path: selection.path });',
      ),
    }],
    ['the binding authority regressed to the pre-budget selection outcome', {
      orchestrator: shipped.orchestrator.replace(
        "...(assembled.request.questionContext !== undefined && questionForeground?.state === 'SELECTED'",
        "...(questionForeground?.state === 'SELECTED'",
      ),
    }],
    ['a second conversational provider invocation appeared', {
      orchestrator: `${shipped.orchestrator}\n// drift\nconst second = (o) => o.engine('model_router', 'FAST', () => this.router.generate({}));\n`,
    }],
    ['a fourth provider-backed background effect appeared', {
      providerBudget: shipped.providerBudget.replace(
        "export const POST_RESPONSE_PROVIDER_EFFECTS_V1 = [\n  'ASSOCIATION_PROVIDER',\n  'INTENT_PROVIDER',\n  'CANDIDATE_PROVIDER',\n] as const;",
        "export const POST_RESPONSE_PROVIDER_EFFECTS_V1 = [\n  'ASSOCIATION_PROVIDER',\n  'INTENT_PROVIDER',\n  'CANDIDATE_PROVIDER',\n  'QUESTION_PROVIDER',\n] as const;",
      ),
    }],
    ['the QIR-005 cap was raised', {
      providerBudget: shipped.providerBudget.replace('export const POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 3;', 'export const POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 4;'),
    }],
    ['the QIR-003 gatherer grew a Question source', {
      gatherer: shipped.gatherer.replace("'MEMORY' | 'HYPOTHESIS'", "'MEMORY' | 'HYPOTHESIS' | 'QUESTION'"),
    }],
    ['the Question slice was widened', {
      budgetContract: shipped.budgetContract.replace('export const QUESTION_BUDGET_BYTES = 8192;', 'export const QUESTION_BUDGET_BYTES = 16384;'),
    }],
    ['the global ceiling moved', {
      budgetContract: shipped.budgetContract.replace('export const GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES = 131072;', 'export const GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES = 139264;'),
    }],
    ['Question became partially retainable', {
      assembler: shipped.assembler.replace(
        "if (offeredBytes > QUESTION_BUDGET_BYTES) return { outcome: 'OMITTED_BUDGET', retained: undefined, offeredBytes, retainedBytes: 0 };",
        "if (offeredBytes > QUESTION_BUDGET_BYTES) return { outcome: 'PARTIALLY_RETAINED', retained: questionContext, offeredBytes, retainedBytes: 0 };",
      ),
    }],
    ['the question block stopped rendering last', {
      guidance: shipped.guidance
        .replace('  if (request.questionContext) {', '  if (request.questionContextRetired) {')
        .replace('  if (request.hypothesisContext) {', '  if (request.questionContext) {\n    serverGuidance += `\\n\\n<question_context>\\n${escapeStructuredData(request.questionContext)}\\n</question_context>`;\n  }\n  if (request.hypothesisContext) {'),
    }],
    ['the demand prohibition left the provider guidance', {
      guidance: shipped.guidance.replace('Do not demand an answer', 'Demand an answer'),
    }],
    ['the repository regressed to the retired finalization signature', {
      conversationRepository: shipped.conversationRepository.replace("'finalize_conversation_turn_v2'", "'finalize_conversation_turn'"),
    }],
    ['the tombstone revoke disappeared from the migration', {
      migration: shipped.migration.replace('REVOKE ALL ON FUNCTION public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;', ''),
    }],
    ['the gap lifecycle grew a fourth status', {
      migration: shipped.migration.replaceAll("status IN ('OPEN','RESOLVED','SUPERSEDED')", "status IN ('OPEN','RESOLVED','SUPERSEDED','ANSWERED')"),
    }],
    ['the binding lifecycle adopted a misleading name', {
      migration: shipped.migration.replace("CHECK(state IN ('SELECTED','BOUND','RELEASED'))", "CHECK(state IN ('SELECTED','ASKED','RELEASED'))"),
    }],
    // replaceAll, not replace: since QIR-006-F02 the scope authority appears on
    // BOTH the eligibility query and the outstanding-question query, so a
    // first-occurrence mutation would silently leave the needle present.
    ['the session scope authority left the selection command', {
      migration: shipped.migration.replaceAll("h.scope='CONVERSATION_SESSION:'||p_session_id::text", 'TRUE'),
    }],
    ['sync stopped owning reopen', {
      migration: shipped.migration.replace('open_epoch=reconcile_gap.open_epoch+1', 'open_epoch=reconcile_gap.open_epoch'),
    }],
    // QIR-006-F02 regressions: the exact defect and its neighbours.
    ['the reconciliation target set regressed to EVALUATED receipts only (the QIR-006-F02 defect)', {
      migration: shipped.migration.replace(
        '   IF NOT mutated_hypothesis_id=ANY(reconcile_hypothesis_ids) THEN reconcile_hypothesis_ids := array_append(reconcile_hypothesis_ids,mutated_hypothesis_id); END IF;\n',
        '',
      ),
    }],
    ['the reconciliation target authority stopped proving the version against canonical state', {
      migration: shipped.migration.replace('      OR mutation_row.version<mutated_after_version\n', ''),
    }],
    ['the reconciliation target set became unbounded', {
      migration: shipped.migration.replace(' IF cardinality(reconcile_hypothesis_ids)>9 THEN RETURN quarantined; END IF;', ''),
    }],
    ['a PENDING_RETRY receipt was allowed to contribute a fresh Confidence source', {
      migration: shipped.migration.replace(
        "   IF receipt->>'confidenceStatus'='EVALUATED' THEN\n    sources := sources || jsonb_build_object(",
        "   IF receipt->>'confidenceStatus' IS NOT NULL THEN\n    sources := sources || jsonb_build_object(",
      ),
    }],
    ['the outstanding check stopped being current-version authoritative', {
      migration: shipped.migration.replace(
        "     AND h.version=s.target_version\n     AND public.question_eligible_hypothesis_lifecycle_v1(h.status)\n     AND h.scope='CONVERSATION_SESSION:'||p_session_id::text\n",
        '',
      ),
    }],
    ['the PENDING_RETRY regression proof was gutted from the migration verifier', {
      migrationVerifier: shipped.migrationVerifier.replaceAll('a PENDING_RETRY version advance supersedes the old exact-version gap and never moves the epoch', 'skipped'),
    }],
    ['the lagging-gap defense-in-depth proof was gutted from the migration verifier', {
      migrationVerifier: shipped.migrationVerifier.replaceAll('a stale BOUND row cannot block the session on a lagging OPEN gap alone', 'skipped'),
    }],
    ['the two-authority separation was withdrawn from the document', {
      contractDoc: shipped.contractDoc.replace('### 3.1 Two authorities inside one update receipt', '### 3.1 Retired'),
    }],
    ['the no-fabrication rule was withdrawn from the document', {
      contractDoc: shipped.contractDoc.replace('**never authorizes RESOLVED, never authorizes\na reopen,', 'authorizes RESOLVED, authorizes a reopen,'),
    }],
    ['an answer-detection heuristic entered the migration', {
      migration: shipped.migration.replace('PERFORM pg_catalog.set_config(\'qandeel.information_gap_lifecycle_transition\',\'authorized\',true);', "PERFORM pg_catalog.set_config('qandeel.information_gap_lifecycle_transition','authorized',true); -- x\n IF position('answered' in 'x')>0 THEN NULL; END IF;"),
    }],
    ['generateValidated stopped failing closed on a closed gap', {
      questionService: shipped.questionService.replace("if (gap.status !== 'OPEN') throw new BadRequestException('Information gap is not open.');", ''),
    }],
    ['the selection metric was removed', {
      telemetry: shipped.telemetry.replaceAll("createCounter('qandeel.question.foreground_selection')", "createCounter('qandeel.question.freeform')"),
    }],
    ['the selection outcome registry was widened', {
      telemetry: shipped.telemetry.replace(
        "const QUESTION_FOREGROUND_OUTCOMES:ReadonlySet<string>=new Set(['SELECTED','LEGITIMATE_EMPTY','OPTIONAL_AVAILABILITY_FAILURE','FOREGROUND_BUDGET_EXPIRY','HARD_FAILURE']);",
        "const QUESTION_FOREGROUND_OUTCOMES:ReadonlySet<string>=new Set(['SELECTED','LEGITIMATE_EMPTY','OPTIONAL_AVAILABILITY_FAILURE','FOREGROUND_BUDGET_EXPIRY','HARD_FAILURE','ANSWERED']);",
      ),
    }],
    ['the 300 ms boundary proof was gutted from the selection spec', {
      selectionSpec: shipped.selectionSpec.replaceAll('classifies FOREGROUND_BUDGET_EXPIRY at exactly the 300 ms boundary and discards the late fulfillment', 'skipped'),
    }],
    ['the GUIDED zero-selection proof was gutted from the orchestrator spec', {
      orchestratorSpec: shipped.orchestratorSpec.replaceAll('performs ZERO formal Question selection on a Safety GUIDED turn while the ONE conversational provider call still happens', 'skipped'),
    }],
    ['the migration verifier was hollowed out', { migrationVerifier: 'retired' }],
    ['the static guard was deregistered from package scripts', {
      packageJson: shipped.packageJson.replace('"test:question-information-gap-closed-loop-v1-contract":', '"test:question-information-gap-closed-loop-v1-contract-retired":'),
    }],
    ['the verifier was deregistered from CI', {
      ci: shipped.ci.replaceAll(VERIFIER_SCRIPT, 'echo skipped'),
    }],
  ];

  for (const [label, overrides] of drifts) {
    const mutated = { ...shipped, ...overrides };
    for (const key of Object.keys(overrides)) {
      assert.notDeepEqual(mutated[key], shipped[key], `the "${label}" mutation actually replaced its source`);
    }
    assert.throws(
      () => assertQuestionClosedLoopContract(mutated),
      /QIR-006 Question closed-loop contract violated/u,
      `the guard rejects: ${label}`,
    );
  }
});

test('Q3 - forward safety: legitimate later evolution stays legal', () => {
  // QIR-008 phase closure repair: a later, separately reviewed migration is
  // legal by number AND when it revisits this same Question domain under its
  // own versioned contract. Fixtures are listing entries only; migration 0063
  // itself stays required.
  for (const fixture of FUTURE_MIGRATION_FIXTURES) {
    assert.doesNotThrow(() => assertQuestionClosedLoopContract({
      ...shipped, migrations: Object.freeze([...shipped.migrations, fixture]),
    }), `a future ${fixture} stays legal for the QIR-006 historical guard`);
  }
  assert.doesNotThrow(() => assertQuestionClosedLoopContract({
    ...shipped, migrations: Object.freeze([...shipped.migrations, ...FUTURE_MIGRATION_FIXTURES]),
  }), 'all future migration fixtures together stay legal for the QIR-006 historical guard');
  assert.throws(() => assertQuestionClosedLoopContract({
    ...shipped,
    migrations: Object.freeze([
      ...shipped.migrations.filter((name) => name !== TERMINAL_MIGRATION), ...FUTURE_MIGRATION_FIXTURES,
    ]),
  }), /QIR-006 Question closed-loop contract violated/u,
  'migration 0063 remains historically REQUIRED even when later migrations exist');
  // A later reviewed telemetry recorder may be appended.
  assert.doesNotThrow(() => assertQuestionClosedLoopContract({
    ...shipped, telemetry: `${shipped.telemetry}\n// QIR-00x recorder, separately reviewed.\n`,
  }), 'a later reviewed telemetry recorder stays legal');
  // A later reviewed guidance block may be appended after the question block.
  assert.doesNotThrow(() => assertQuestionClosedLoopContract({
    ...shipped,
    guidance: shipped.guidance.replace('  return serverGuidance;\n}', '  if (request.futureContext) { serverGuidance += `\\n\\nFuture context follows as structured DATA.`; }\n  return serverGuidance;\n}'),
  }), 'a later reviewed provider-neutral guidance block stays legal');
  // A later reviewed document amendment stays legal.
  assert.doesNotThrow(() => assertQuestionClosedLoopContract({
    ...shipped, contractDoc: `${shipped.contractDoc}\n\n## Amendment A1 (QIR-00x)\n\nRecorded under its own reviewed contract.\n`,
  }), 'a later reviewed document amendment stays legal');
  // A later QIR static-contract CI step stays legal.
  const ciStepLine = shipped.ci.match(/^.*test:question-information-gap-closed-loop-v1-contract.*$/mu)[0];
  assert.doesNotThrow(() => assertQuestionClosedLoopContract({
    ...shipped,
    ci: shipped.ci.replace(ciStepLine, `${ciStepLine}\n      - {name: Verify QIR-007 static contract, run: npm run test:qir-007-contract}`),
  }), 'a later QIR static-contract CI step stays legal');
  // A NON-provider background effect remains legitimate for QIR-005: the guard
  // freezes the PROVIDER registry and the cap, never the whole effect list.
  assert.doesNotThrow(() => assertQuestionClosedLoopContract({
    ...shipped,
    providerBudget: shipped.providerBudget.replace(
      "  HIM_BRAIN_CONTEXT_MATERIALIZATION: 'NON_PROVIDER',",
      "  HIM_BRAIN_CONTEXT_MATERIALIZATION: 'NON_PROVIDER',\n  FUTURE_LEDGER_EFFECT: 'NON_PROVIDER',",
    ),
  }), 'a later reviewed NON-provider effect classification stays legal');
});

test('Q4 - the contract guard is wired into package scripts and CI', () => {
  const packageJson = JSON.parse(shipped.packageJson);
  assert.equal(packageJson.scripts[CONTRACT_SCRIPT], CONTRACT_COMMAND);
  assert.equal(packageJson.scripts[VERIFIER_SCRIPT], VERIFIER_COMMAND);
  const step = shipped.ci.indexOf(CONTRACT_SCRIPT);
  assert.ok(step > 0, 'CI runs the QIR-006 static contract');
  assert.ok(step < shipped.ci.indexOf('Apply all migrations to fresh PostgreSQL'),
    'it runs before the database bootstrap: a pure static guard needs no database');
});

test('Q5 - the guard is structurally independent of every mutable census gap', () => {
  const worldPaths = Object.values(SOURCES);
  for (const excluded of [
    'apps/api/src/model-router/model-profile.registry.ts',
    'apps/api/src/memory/memory-retriever.service.ts',
    'apps/api/src/hypothesis/hypothesis-reasoning-context.types.ts',
    'apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts',
    'apps/api/src/intelligence-runtime/fast-deep-runtime-decision-policy-v2.ts',
  ]) {
    assert.ok(!worldPaths.includes(excluded), `the guard world never includes ${excluded}`);
  }
  assert.ok(worldPaths.every((path) => !path.includes('providers/')),
    'the guard world never includes a provider adapter source');
  // The guard function itself never names a mutable-gap literal: not a vendor
  // model identifier, not a routing threshold, and not a local cap VALUE.
  const guardSource = assertQuestionClosedLoopContract.toString();
  for (const forbidden of [
    'DEEP_INPUT_LENGTH',
    'MAX_SELECTED_MEMORIES',
    'MAX_MODEL_HYPOTHESES',
    ['claude', '-'].join(''),
    ['gpt', '-'].join(''),
    ['gem', 'ini'].join(''),
    ['ki', 'mi'].join(''),
  ]) {
    assert.ok(!guardSource.includes(forbidden), `the guard never depends on the mutable census literal ${forbidden}`);
  }
  // Deferred semantics stay deferred: the guard never freezes a utility
  // ranking or Expected Information Gain shape into existence.
  assert.ok(!guardSource.includes('expected_information_gain') && !guardSource.includes('question_utility'),
    'the guard never freezes the deferred ranking semantics');
});
