import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// QHIA-011A Explicit Session Context Activation Application Entry v1 -
// application static contract.
//
// It freezes the half of this task that no database verifier and no single
// Jest spec can freeze on its own: that ONE authenticated product entry exists,
// that it is the ONLY thing in QANDEEL able to change explicit relevance, and
// that it creates no new authority of its own.
//
//   * the authenticated production controller exists with its three exact
//     routes and the REAL SupabaseAuthGuard, and derives identity and token
//     ONLY from the authenticated request;
//   * the controller reaches the QHIA-006 authority exclusively through the
//     narrow facade, and the facade exclusively through the EXISTING
//     HimSessionContextBindingService;
//   * exactly ONE application module names the migration-0055 RPC paths, so a
//     second direct binding repository cannot appear;
//   * the set body is an exact context ID and nothing else - no free text,
//     label, reason, confidence, suggestion, or provider output;
//   * replacement is ONE set command and there is no read-before-write;
//   * NOTHING else in apps/api/src can reach the activation write - not the
//     Orchestrator, not createTurn, not the ContextBuilder, not the Model
//     Router or any provider, not Memory, Hypothesis, Recommendation, the
//     Question runtime, Background or Post-Response Intelligence, and not any
//     HIM foreground consumer;
//   * no service-role path, raw SQL, database secret, or binding-table route
//     exists anywhere on this surface;
//   * QHIA-011A introduced NO database migration and no second binding
//     authority; and
//   * Full Intelligence really performs ONE deliberate explicit activation
//     through the production application entry and really censuses it.
//
// Every rule below is executed by ONE guard function, and the anti-vacuity
// fixtures drive that same real guard over deliberately drifted sources - so
// "this contract would catch regression X" is proven, never assumed.
//
// Forward-safe by construction: nothing here freezes a migration ceiling, a
// repository census, a global count, or a zero-state of any shared inventory.
// A later migration, a later context kind, a later foreground channel, and a
// later product surface all stay legal. A dedicated forward-safety control
// below proves exactly that.
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
// Negatives run on EXECUTABLE source only: every file's own prose legitimately
// names the shapes it documents the absence of.
const executable = (source) => source
  .split('\n')
  .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*'))
  .join('\n');

const FILES = Object.freeze({
  activationController: 'apps/api/src/conversation/conversation-context-activation.controller.ts',
  activationService: 'apps/api/src/conversation/conversation-context-activation.service.ts',
  activationTypes: 'apps/api/src/conversation/conversation-context-activation.types.ts',
  conversationModule: 'apps/api/src/conversation/conversation.module.ts',
  conversationService: 'apps/api/src/conversation/conversation.service.ts',
  conversationController: 'apps/api/src/conversation/conversation.controller.ts',
  orchestrator: 'apps/api/src/conversation/conversation-orchestrator.service.ts',
  bindingService: 'apps/api/src/human-model/him-session-context-binding.service.ts',
  bindingRepository: 'apps/api/src/human-model/him-session-context-binding.repository.ts',
  bindingTypes: 'apps/api/src/human-model/him-session-context-binding.types.ts',
  activationVerifier: 'apps/api/scripts/verify-explicit-session-context-activation-runtime.ts',
  smokeRuntime: 'apps/api/scripts/verify-full-intelligence-end-to-end-runtime.ts',
  smokeAdapters: 'apps/api/scripts/full-intelligence-e2e-smoke/pg-foreground-intelligence.adapters.ts',
  // QHIA-011A Fix 01 surfaces.
  memoryDataApi: 'apps/api/src/memory/memory-data-api.service.ts',
  transportSpec: 'apps/api/src/memory/memory-data-api.service.spec.ts',
  activationServiceSpec: 'apps/api/src/conversation/conversation-context-activation.service.spec.ts',
  httpSpec: 'apps/api/src/conversation/conversation-context-activation.http.spec.ts',
});

// QHIA-011A Fix 01: the EXACT migration-0055 rejections the application is
// allowed to translate into a product answer, and the two sanitized public
// messages it answers with. Both halves are frozen here so a drifted allowlist,
// a widened allowlist, a status-only rule, or a leaked database message fails
// this contract rather than a reviewer's attention.
const AUTHORITY_DENIAL_SQLSTATE = '42501';
const AUTHORITY_INACTIVE_SQLSTATE = '55000';
const AUTHORITY_DENIAL_MESSAGES = Object.freeze([
  'Session context bindings are owner-exact',
  'Unknown or cross-user conversation session',
  'Unknown, cross-user, or wrong-kind measurement target',
]);
const AUTHORITY_INACTIVE_MESSAGE = 'Conversation session is not active';
const SANITIZED_FORBIDDEN_MESSAGE = 'The requested session or context is not available for this operation.';
const SANITIZED_CONFLICT_MESSAGE = 'The conversation session does not accept this context operation in its current state.';
// A sanitized product message may never carry database identity of any kind.
const PUBLIC_MESSAGE_LEAKS = Object.freeze([
  AUTHORITY_DENIAL_SQLSTATE, AUTHORITY_INACTIVE_SQLSTATE, 'SQLSTATE', 'owner-exact', 'cross-user',
  'wrong-kind', 'not active', 'binding', 'him_', 'PGRST', 'PostgREST', 'postgres',
]);
// Shapes that would make the mapping match on HTTP status, or match loosely.
const FORBIDDEN_MAPPING_SHAPES = Object.freeze([
  'error.status', '.status ===', 'status === 403', 'status === 409', 'status === 500',
  'message.includes(', 'message.startsWith(', 'message.endsWith(', 'message.match(',
  'message.toLowerCase(', 'message.indexOf(', 'code.startsWith(', 'code.includes(', 'RegExp',
]);
// Global error semantics must not change. These tokens may appear in EXACTLY
// one production file - the pre-existing application root - and its
// registration must stay byte-identical.
const FORBIDDEN_GLOBAL_ERROR_HANDLING = Object.freeze([
  'APP_FILTER', 'useGlobalFilters(', 'implements ExceptionFilter', '@Catch(',
  'SentryGlobalFilter', 'BaseExceptionFilter',
]);
const GLOBAL_ERROR_FILTER_OWNER = 'apps/api/src/app.module.ts';
const FROZEN_GLOBAL_ERROR_FILTER_WIRING = 'providers:[{provide:APP_FILTER,useClass:SentryGlobalFilter}],';

// The migration-0055 transport paths. The single application owner of these
// literals is the QHIA-006 repository; a second owner is a second direct
// binding authority.
const SET_RPC_PATH = 'rpc/set_him_session_context_binding_v1';
const CLEAR_RPC_PATH = 'rpc/clear_him_session_context_binding_v1';
const READ_RPC_PATH = 'rpc/read_him_session_context_bindings_v1';
const BINDING_RPC_PATHS = Object.freeze([SET_RPC_PATH, CLEAR_RPC_PATH, READ_RPC_PATH]);
const BINDING_RPC_OWNER = FILES.bindingRepository;

// Everything that can reach the explicit activation write, by name. Any
// production source outside the owner list that mentions one of these has
// gained a path to silently activate a context.
const ACTIVATION_REACH = Object.freeze([
  'ConversationContextActivationService',
  'ConversationContextActivationController',
  'activateContext(',
  'deactivateContext(',
  'readActiveContexts(',
  'setBinding(',
  'clearBinding(',
  'readActiveBindings(',
]);
const ACTIVATION_REACH_OWNERS = Object.freeze([
  FILES.activationController,
  FILES.activationService,
  FILES.conversationModule,
  FILES.bindingService,
  FILES.bindingRepository,
]);

// The whole point of QHIA-011A: an exact ID, never prose. These may not appear
// in the executable activation surface at all.
const FORBIDDEN_ACTIVATION_INPUT = Object.freeze([
  'displayText', 'display_text', 'targetLabel', 'target_label', 'freeText', 'free_text',
  'reason', 'confidence', 'suggestion', 'providerOutput', 'provider_output',
  'embedding', 'similarity', 'fuzzy', 'searchText', 'latestTarget', 'onlyTarget',
]);
// Nothing on this surface may carry privileged transport, raw SQL, or secrets.
const FORBIDDEN_PRIVILEGE = Object.freeze([
  'service_role', 'SERVICE_ROLE', 'ServiceRoleApi', 'serviceRole',
  'set_config', 'request.jwt', 'process.env',
  'him_session_context_bindings', 'SELECT ', 'INSERT ', 'UPDATE ', 'DELETE ',
]);

const MIGRATION_0055 = '0055_him_session_context_binding_relevance_v1.sql';
const BINDING_AUTHORITY_DEFINITIONS = Object.freeze([
  'CREATE TABLE public.him_session_context_bindings',
  'CREATE FUNCTION public.set_him_session_context_binding_v1',
  'CREATE FUNCTION public.clear_him_session_context_binding_v1',
  'CREATE FUNCTION public.read_him_session_context_bindings_v1',
]);
// A migration file whose NAME claims to be this task's. Deliberately narrow:
// it forbids a QHIA-011A migration, never a later unrelated one.
const QHIA_011A_MIGRATION_NAME = /context[_-]?activation|explicit[_-]?session[_-]?context|qhia[_-]?011a/iu;
const ACTIVATION_SOURCE_LITERAL = 'QANDEEL_EXPLICIT_SESSION_CONTEXT_ACTIVATION_V1';

function violated(property) {
  throw new Error(`QHIA-011A explicit session context activation contract violated: ${property}`);
}

function listProductionSources() {
  const base = fileURLToPath(new URL('apps/api/src/', root));
  return readdirSync(base, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'))
    .map((entry) => {
      const absolute = join(entry.parentPath ?? base, entry.name);
      return {
        path: `apps/api/src/${absolute.slice(base.length).split('\\').join('/')}`,
        source: readFileSync(absolute, 'utf8'),
      };
    });
}

function listMigrations() {
  const base = fileURLToPath(new URL('database/migrations/', root));
  return readdirSync(base)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, source: readFileSync(join(base, name), 'utf8') }));
}

const shipped = Object.freeze({
  files: Object.freeze(Object.fromEntries(Object.entries(FILES).map(([key, path]) => [key, read(path)]))),
  production: listProductionSources(),
  migrations: listMigrations(),
  packageJson: read('package.json'),
  ci: read('.github/workflows/api-ci.yml'),
});

/**
 * The single guard. It receives the whole world so a drift fixture can replace
 * exactly one file - or add exactly one synthetic file - and still be checked
 * against every cross-file rule.
 */
function assertExplicitSessionContextActivationContract(world) {
  const files = world.files;
  const exe = Object.fromEntries(Object.entries(files).map(([key, source]) => [key, executable(source)]));

  // 1. The authenticated production controller exists, on the conversation
  //    surface, with the REAL guard and the three exact routes.
  if (!/@Controller\('conversation'\)/u.test(exe.activationController))
    violated('the activation controller is mounted on the authenticated conversation surface');
  if (!/@UseGuards\(SupabaseAuthGuard\)/u.test(exe.activationController))
    violated('the activation controller is protected by the real SupabaseAuthGuard');
  if (!exe.activationController.includes("import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'"))
    violated('the activation controller imports the real production auth guard');
  if (!/export class ConversationContextActivationController/u.test(exe.activationController))
    violated('the activation controller class exists');
  for (const [decorator, path] of [
    ["@Put", "sessions/:sessionId/context-bindings/:contextKind"],
    ["@Delete", "sessions/:sessionId/context-bindings/:contextKind"],
    ["@Get", "sessions/:sessionId/context-bindings"],
  ]) {
    if (!exe.activationController.includes(`${decorator}('${path}')`))
      violated(`the production route ${decorator} ${path} exists`);
  }

  // 2. Identity comes ONLY from the authenticated request, once per route, and
  //    the controller holds no transport, privilege, or secret of its own.
  const identityReads = (exe.activationController.match(/const \{ userId, accessToken \} = request\.authenticatedUser;/gu) ?? []).length;
  if (identityReads !== 3)
    violated('every activation route derives userId and accessToken from the authenticated request exactly once');
  if ((exe.activationController.match(/request\.authenticatedUser/gu) ?? []).length !== 3)
    violated('the authenticated request is the only identity source, read exactly once per route');
  if (/(?:const|let|var)\s+(?:userId|accessToken)\s*=/u.test(exe.activationController))
    violated('neither the identity nor the token is ever derived from anything but the authenticated request');
  if (/@Body\(\)\s*(?:userId|accessToken)|@Param\('userId'\)|@Query\(|@Headers\(/u.test(exe.activationController))
    violated('no caller-supplied identity, token, header, or query selector is accepted by the activation controller');
  for (const forbidden of FORBIDDEN_PRIVILEGE) {
    if (exe.activationController.includes(forbidden))
      violated(`the activation controller carries no privileged or raw-SQL path: found ${forbidden}`);
  }

  // 3. The controller reaches the authority ONLY through the facade.
  const facadeCalls = (exe.activationController.match(/this\.activation\.[a-zA-Z]+\(/gu) ?? []).length;
  if (facadeCalls !== 3) violated('the controller delegates exactly once per route to the facade');
  if (exe.activationController.includes('HimSessionContextBindingService') ||
      exe.activationController.includes('HimSessionContextBindingRepository'))
    violated('the controller never bypasses the facade to reach the QHIA-006 authority directly');
  if (exe.activationController.includes('dataApi') || exe.activationController.includes('rpc/'))
    violated('the controller issues no Data API request of its own');

  // 4. The facade delegates to the EXISTING QHIA-006 service, exactly once per
  //    command, and owns no relevance rule, transport, or model of its own.
  if (!exe.activationService.includes("import { HimSessionContextBindingService } from '../human-model/him-session-context-binding.service'"))
    violated('the facade delegates to the existing QHIA-006 binding service');
  if (!/constructor\(private readonly bindings: HimSessionContextBindingService\)/u.test(exe.activationService))
    violated('the facade holds exactly one collaborator: the existing QHIA-006 binding service');
  for (const [command, expected] of [['setBinding', 1], ['clearBinding', 1], ['readActiveBindings', 1]]) {
    const calls = (exe.activationService.match(new RegExp(`this\\.bindings\\.${command}\\(`, 'gu')) ?? []).length;
    if (calls !== expected) violated(`the facade issues exactly ${expected} ${command} delegation`);
  }
  for (const forbidden of ['dataApi', 'rpc/', 'MemoryDataApiService', 'HimRepository', 'ModelRouter', 'him_measurement_targets']) {
    if (exe.activationService.includes(forbidden))
      violated(`the facade owns no transport, measurement, or model boundary: found ${forbidden}`);
  }
  for (const forbidden of FORBIDDEN_PRIVILEGE) {
    if (exe.activationService.includes(forbidden))
      violated(`the facade carries no privileged or raw-SQL path: found ${forbidden}`);
  }

  // 5. No read-before-write and no clear-then-set replacement: the whole set
  //    path contains exactly one authority call.
  const setSliceStart = exe.activationService.indexOf('async activateContext(');
  const setSliceEnd = exe.activationService.indexOf('async deactivateContext(');
  if (setSliceStart < 0 || setSliceEnd <= setSliceStart) violated('the facade exposes the activate command');
  const setSlice = exe.activationService.slice(setSliceStart, setSliceEnd);
  if (!setSlice.includes('this.bindings.setBinding('))
    violated('the activate command reaches the QHIA-006 set authority');
  if (setSlice.includes('this.bindings.readActiveBindings('))
    violated('the activate command performs no read before the write');
  if (setSlice.includes('this.bindings.clearBinding('))
    violated('replacement is one atomic set command, never clear then set');

  // 6. The set body is an exact context ID and nothing else.
  if (!/const ACTIVATION_REQUEST_FIELDS = Object\.freeze\(\['contextId'\]\)/u.test(exe.activationService))
    violated('the exact set-body field allowlist is exactly the context identifier');
  if (!/!ACTIVATION_REQUEST_FIELDS\.includes\(key\)/u.test(exe.activationService))
    violated('an unsupported extra field is rejected rather than ignored');
  if (!/!UUID\.test\(value\.contextId\)/u.test(exe.activationService))
    violated('the context identifier must be an exact identifier, never prose');
  const activationSurface = [exe.activationController, exe.activationService, exe.activationTypes].join('\n');
  for (const forbidden of FORBIDDEN_ACTIVATION_INPUT) {
    if (activationSurface.includes(forbidden))
      violated(`the activation request carries no relevance input of its own: found ${forbidden}`);
  }
  if (!/interface ConversationContextActivationRequest \{\n\s+contextId: string;\n\}/u.test(exe.activationTypes))
    violated('the request contract declares exactly one field');

  // 7. The four kinds stay the QHIA-006 authority's, never a local copy.
  if (!exe.activationTypes.includes("import { HIM_CROSS_CONTEXT_KINDS, type HimCrossContextKind } from '../human-model/him-session-context-binding.types'"))
    violated('the four cross-context kinds are reused from the QHIA-006 authority');
  if (/\[\s*'GOAL'\s*,/u.test(activationSurface))
    violated('the four cross-context kinds are never redeclared on the activation surface');
  if (!exe.activationService.includes('HIM_CROSS_CONTEXT_KINDS.includes(contextKind as HimCrossContextKind)'))
    violated('the route kind is validated against the QHIA-006 kind authority');
  if (!exe.bindingTypes.includes("'GOAL',") || !exe.bindingTypes.includes("'RELATIONSHIP',"))
    violated('the QHIA-006 kind authority still declares the four cross-context kinds');
  for (const never of ['GLOBAL', 'CONVERSATION_SESSION']) {
    if (new RegExp(`HIM_CROSS_CONTEXT_KINDS[^\\n]*'${never}'`, 'u').test(exe.bindingTypes))
      violated(`${never} is never a cross-context kind`);
  }

  // 8. The product response exposes no internal binding lifecycle metadata.
  for (const internal of ['bindingId', 'bindingVersion', 'binding_source', 'canonical_provenance', 'created_at', 'retired_at', 'retiredBinding']) {
    if (exe.activationTypes.includes(internal))
      violated(`the product contract exposes no internal binding lifecycle metadata: found ${internal}`);
  }
  if (!/private project\(binding: ConversationActiveContext\): ConversationActiveContext \{\n\s+return \{ contextKind: binding\.contextKind, contextId: binding\.contextId \};/u.test(exe.activationService))
    violated('the facade projects exactly the kind and the exact context id');
  if (!exe.activationTypes.includes(`CONVERSATION_CONTEXT_ACTIVATION_SOURCE = '${ACTIVATION_SOURCE_LITERAL}'`))
    violated('the product responses carry the explicit activation provenance');

  // 9. Exactly ONE application module names the migration-0055 RPC paths.
  for (const rpcPath of BINDING_RPC_PATHS) {
    const owners = world.production.filter(({ source }) => executable(source).includes(rpcPath)).map(({ path }) => path);
    if (owners.length !== 1 || owners[0] !== BINDING_RPC_OWNER)
      violated(`exactly one application repository requests ${rpcPath}; found [${owners.join(', ')}]`);
  }

  // 10. Nothing else in production can reach the activation write.
  for (const { path, source } of world.production) {
    if (ACTIVATION_REACH_OWNERS.includes(path)) continue;
    const code = executable(source);
    for (const reach of ACTIVATION_REACH) {
      if (code.includes(reach))
        violated(`${path} must not be able to activate a context: found ${reach}`);
    }
  }
  // Named explicitly so the highest-risk callers are checked even if the sweep
  // above is ever narrowed.
  for (const [label, key] of [['the Orchestrator', 'orchestrator'], ['ConversationService.createTurn', 'conversationService'], ['the conversation controller', 'conversationController']]) {
    for (const reach of ACTIVATION_REACH) {
      if (exe[key].includes(reach)) violated(`${label} never activates a context: found ${reach}`);
    }
  }

  // 11. QHIA-011A introduced no database migration and no second binding
  //     authority. Forward-safe: only a migration claiming to be THIS task's is
  //     forbidden, and no ceiling on the migration chain is asserted.
  const names = world.migrations.map(({ name }) => name);
  if (!names.includes(MIGRATION_0055)) violated('the QHIA-006 migration still owns the binding authority');
  for (const name of names) {
    if (QHIA_011A_MIGRATION_NAME.test(name)) violated(`QHIA-011A adds no database migration: found ${name}`);
  }
  for (const definition of BINDING_AUTHORITY_DEFINITIONS) {
    const owners = world.migrations.filter(({ source }) => source.includes(definition)).map(({ name }) => name);
    if (owners.length !== 1 || owners[0] !== MIGRATION_0055)
      violated(`migration 0055 remains the sole owner of "${definition}"; found [${owners.join(', ')}]`);
  }
  for (const { name, source } of world.migrations) {
    if (source.includes(ACTIVATION_SOURCE_LITERAL))
      violated(`the application activation provenance has no database twin: found in ${name}`);
  }

  // 12. Full Intelligence really performs and censuses ONE deliberate explicit
  //     activation through the production application entry.
  if (!exe.smokeRuntime.includes('new ConversationContextActivationService('))
    violated('the Full Intelligence smoke activates through the production application entry');
  if (!/contextActivationService\.activateContext\(/u.test(exe.smokeRuntime))
    violated('the Full Intelligence smoke issues the explicit activation command');
  if (!exe.smokeAdapters.includes("'set_him_session_context_binding_v1'"))
    violated('the smoke transport substitute recognises the activation command, so a refusal cannot pass as success');
  for (const absent of ["'clear_him_session_context_binding_v1'", "'read_him_session_context_bindings_v1'"]) {
    if (exe.smokeAdapters.includes(absent))
      violated(`the smoke accepts no other binding command: found ${absent}`);
  }
  if (!/census\.attempts\(EXPLICIT_ACTIVATION_SET_RPC\), 1/u.test(exe.smokeRuntime))
    violated('the smoke asserts exactly one explicit activation attempt');
  if (!/census\.completions\(EXPLICIT_ACTIVATION_SET_RPC\), 1/u.test(exe.smokeRuntime))
    violated('the smoke asserts the explicit activation really COMPLETED');
  if (!/census\.failures\(EXPLICIT_ACTIVATION_SET_RPC\), 0/u.test(exe.smokeRuntime))
    violated('the smoke asserts zero explicit activation failures');
  if (!/census\.attempts\(EXPLICIT_ACTIVATION_CLEAR_RPC\), 0/u.test(exe.smokeRuntime))
    violated('the smoke asserts no clear command is issued anywhere');
  if (!exe.smokeRuntime.includes("[3, 'GOAL_MOTIVATION', 'ACTIVE_GOAL_BOUND']"))
    violated('the smoke proves the activated Goal slot is authoritatively bound');
  if (!/himGoalMotivationService\.consumeSourceRows\(\[aggregateRows\[2\]\]\)/u.test(exe.smokeRuntime))
    violated('the smoke decodes the activated Goal row through the REAL QHIA-010 consumer');
  if (!exe.smokeRuntime.includes("goalMotivation: { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_GOAL_ACTION_BURDEN' }"))
    violated('the smoke proves the activated Goal decodes to its already-frozen ACTIVE guidance');
  // Foreground transport is unchanged: still exactly one aggregate request per
  // eligible turn and zero application binding reads.
  if (!/census\.attempts\(CROSS_CONTEXT_FOREGROUND_RPC\), expectedTurns/u.test(exe.smokeRuntime))
    violated('the foreground still issues exactly one aggregate request per eligible turn');
  if (!/census\.attempts\(RELEVANCE_AUTHORITY_RPC\), 0/u.test(exe.smokeRuntime))
    violated('the foreground still never reads the QHIA-006 relevance authority from the application');

  // 13. The focused real-PostgreSQL proof drives the WHOLE production chain and
  //     never writes a binding row behind the application's back.
  if (!exe.activationVerifier.includes('new ConversationContextActivationController('))
    violated('the focused real-PostgreSQL proof drives the production controller');
  if (!exe.activationVerifier.includes('new HimSessionContextBindingService(bindingRepository)'))
    violated('the focused real-PostgreSQL proof composes the existing QHIA-006 service');
  if (/INSERT\s+INTO\s+(?:public\.)?him_session_context_bindings/iu.test(exe.activationVerifier))
    violated('the focused proof never direct-INSERTs a binding row');
  if (/(?:SELECT|FROM)[^\n]*public\.(?:set|clear)_him_session_context_binding/u.test(exe.activationVerifier))
    violated('the focused proof never calls the QHIA-006 commands as raw SQL');
  for (const claim of [
    "'ACTIVE_GOAL_BOUND'", 'ACTIVE_GOAL_GUIDANCE', "'NO_ACTIVE_GOAL'",
    'a foreign conversation session', 'a foreign measurement target', 'a wrong-kind measurement target',
    'an unknown measurement target', 'an unknown conversation session', 'an inactive conversation session',
    'the same-target replay created no new binding version', 'replacement is ONE set command',
    'clearing an already-clear kind is idempotent', 'the two kinds coexist independently',
  ]) {
    if (!exe.activationVerifier.includes(claim))
      violated(`the focused real-PostgreSQL proof still proves: ${claim}`);
  }

  // ---------------------------------------------------------------------
  // QHIA-011A Fix 01 - HTTP authority-rejection mapping.
  // ---------------------------------------------------------------------

  // 15. The authenticated transport preserves the structured upstream failure
  //     identity - and preserves nothing else.
  for (const required of [
    'readonly upstreamCode?: string', 'readonly upstreamMessage?: string',
    'new MemoryDataApiError(response.status, upstreamCode, upstreamMessage)',
    'readUpstreamFailureIdentity(response)',
    'return [upstreamIdentity(record.code), upstreamIdentity(record.message)];',
  ]) {
    if (!exe.memoryDataApi.includes(required))
      violated(`the transport preserves the structured upstream failure identity: missing ${required}`);
  }
  if (!/catch \{\n\s+return \[undefined, undefined\];/u.test(exe.memoryDataApi))
    violated('a malformed or non-JSON upstream error body never replaces the original transport failure');
  const capturedFields = [...exe.memoryDataApi.matchAll(/record\.([a-zA-Z_]+)/gu)].map((match) => match[1]).sort();
  if (JSON.stringify(capturedFields) !== JSON.stringify(['code', 'message']))
    violated(`the transport captures exactly the upstream code and message; found [${capturedFields.join(', ')}]`);
  for (const forbidden of ['details', 'hint', '.text()', 'response.headers', 'rawBody', 'bodyText']) {
    if (exe.memoryDataApi.includes(forbidden))
      violated(`the transport captures no upstream detail, hint, header, or raw body: found ${forbidden}`);
  }
  if (!exe.memoryDataApi.includes('super(`Memory Data API request failed with status ${status}.`);'))
    violated('the generic transport Error message is unchanged, so nothing that logs it starts emitting database text');
  for (const unchanged of ['if (response.status === 204) return undefined as T;', 'return response.json() as Promise<T>;']) {
    if (!exe.memoryDataApi.includes(unchanged)) violated(`successful request behavior is unchanged: missing ${unchanged}`);
  }

  // 16. The mapping is exact code AND exact message, never HTTP status alone.
  for (const required of [
    `const AUTHORITY_OWNERSHIP_DENIAL_CODE = '${AUTHORITY_DENIAL_SQLSTATE}'`,
    `const AUTHORITY_INACTIVE_SESSION_CODE = '${AUTHORITY_INACTIVE_SQLSTATE}'`,
    `const AUTHORITY_INACTIVE_SESSION_MESSAGE = '${AUTHORITY_INACTIVE_MESSAGE}'`,
    'AUTHORITY_OWNERSHIP_DENIAL_MESSAGES.has(message)',
    'message === AUTHORITY_INACTIVE_SESSION_MESSAGE',
    "typeof code !== 'string' || typeof message !== 'string'",
    'error instanceof MemoryDataApiError',
    'new ForbiddenException(CONVERSATION_CONTEXT_ACTIVATION_FORBIDDEN_MESSAGE)',
    'new ConflictException(CONVERSATION_CONTEXT_ACTIVATION_CONFLICT_MESSAGE)',
  ]) {
    if (!exe.activationService.includes(required))
      violated(`the authority-rejection mapping is exact: missing ${required}`);
  }
  const denialSetStart = exe.activationService.indexOf('const AUTHORITY_OWNERSHIP_DENIAL_MESSAGES');
  if (denialSetStart < 0) violated('the exact ownership-denial message allowlist exists');
  const denialSet = exe.activationService.slice(denialSetStart, exe.activationService.indexOf(']);', denialSetStart));
  const denialMessages = [...denialSet.matchAll(/'([^']+)'/gu)].map((match) => match[1]);
  if (denialMessages.length !== AUTHORITY_DENIAL_MESSAGES.length ||
      AUTHORITY_DENIAL_MESSAGES.some((message) => !denialMessages.includes(message)))
    violated(`the ownership-denial allowlist is exactly the three frozen authority messages; found [${denialMessages.join(' | ')}]`);
  for (const forbidden of FORBIDDEN_MAPPING_SHAPES) {
    if (exe.activationService.includes(forbidden))
      violated(`the mapping never matches by HTTP status or loosely: found ${forbidden}`);
  }
  for (const leak of ['Exception(error.', 'Exception(message', 'Exception(code', 'Exception(error)']) {
    if (exe.activationService.includes(leak))
      violated(`the sanitized product failure never carries the upstream message: found ${leak}`);
  }
  const wrapped = (exe.activationService.match(/this\.delegate\(\(\) => this\.bindings\./gu) ?? []).length;
  if (wrapped !== 3) violated('all three commands - and only they - run through the boundary-local mapping');
  const fallThroughs = (exe.activationService.match(/return error;/gu) ?? []).length;
  if (fallThroughs !== 3)
    violated('an unrecognised failure is re-thrown untouched on every branch: expected three fall-throughs');

  // 17. The sanitized public messages disclose nothing.
  for (const [name, message] of [
    ['CONVERSATION_CONTEXT_ACTIVATION_FORBIDDEN_MESSAGE', SANITIZED_FORBIDDEN_MESSAGE],
    ['CONVERSATION_CONTEXT_ACTIVATION_CONFLICT_MESSAGE', SANITIZED_CONFLICT_MESSAGE],
  ]) {
    if (!exe.activationTypes.includes(`${name} =\n  '${message}' as const;`))
      violated(`the sanitized public message ${name} is frozen`);
    for (const leak of PUBLIC_MESSAGE_LEAKS) {
      if (message.toLowerCase().includes(leak.toLowerCase()))
        violated(`the sanitized public message ${name} discloses ${leak}`);
    }
  }

  // 18. Global error semantics are untouched. The application's ONE global
  //     filter registration stays exactly where it already was and exactly what
  //     it already was: QHIA-011A Fix 01 maps failures at its own narrow
  //     boundary and changes nothing globally.
  const globalErrorOwners = world.production
    .filter(({ source }) => FORBIDDEN_GLOBAL_ERROR_HANDLING.some((token) => executable(source).includes(token)))
    .map(({ path }) => path);
  if (globalErrorOwners.length !== 1 || globalErrorOwners[0] !== GLOBAL_ERROR_FILTER_OWNER)
    violated(`the only global error-handling registration stays in ${GLOBAL_ERROR_FILTER_OWNER}; found [${globalErrorOwners.join(', ')}]`);
  const appModule = world.production.find(({ path }) => path === GLOBAL_ERROR_FILTER_OWNER);
  if (!appModule || !executable(appModule.source).includes(FROZEN_GLOBAL_ERROR_FILTER_WIRING))
    violated('the existing global Sentry filter registration is unchanged');

  // 19. The application allowlist tracks the REAL migration-0055 authority: the
  //     application maps the authority, the authority is never rewritten to
  //     suit the application.
  const migration0055 = world.migrations.find(({ name }) => name === MIGRATION_0055);
  if (!migration0055) violated('migration 0055 is present');
  for (const literal of [...AUTHORITY_DENIAL_MESSAGES, AUTHORITY_INACTIVE_MESSAGE, AUTHORITY_DENIAL_SQLSTATE, AUTHORITY_INACTIVE_SQLSTATE]) {
    if (!migration0055.source.includes(literal))
      violated(`migration 0055 still raises the exact authority identity the application maps: missing ${literal}`);
  }

  // 20. Fix 01 keeps its own proofs.
  for (const required of [
    'upstreamCode', 'upstreamMessage', 'keeps the status but no structured identity',
    'preserves only the usable half of', 'successful and unconfigured behavior is unchanged',
  ]) {
    if (!exe.transportSpec.includes(required)) violated(`the transport contract still proves: ${required}`);
  }
  for (const required of [
    "from '@nestjs/core'", 'new BaseExceptionFilter(applicationRef).catch(error, host)',
    'new ConversationContextActivationController(', 'new HimSessionContextBindingService(',
    'new HimSessionContextBindingRepository(new MemoryDataApiService())',
    'expect(outcome.status).toBe(403)', 'expect(outcome.status).toBe(409)', 'expect(outcome.status).toBe(500)',
    'deactivateContext(request(), SESSION', 'readActiveContexts(request(), SESSION)',
    'reproduces the original defect shape',
  ]) {
    if (!exe.httpSpec.includes(required)) violated(`the real HTTP outcome contract still proves: ${required}`);
  }
  for (const required of [
    'UNMAPPED_FAILURES', 'never maps by HTTP status alone', 'authority-rejection mapping',
    'never lets the sanitized 403 disclose', 'clear-on-inactive-session behavior untouched',
  ]) {
    if (!exe.activationServiceSpec.includes(required)) violated(`the facade mapping contract still proves: ${required}`);
  }

  // 14. Both gates stay wired into package scripts and CI.
  const scripts = JSON.parse(world.packageJson).scripts;
  if (scripts['test:explicit-session-context-activation-entry-contract'] !==
      'node --test tests/explicit-session-context-activation-entry-contract.test.mjs')
    violated('the static contract is wired as its own package script');
  const runtimeScript = scripts['verify:explicit-session-context-activation:integration'];
  if (typeof runtimeScript !== 'string' || !runtimeScript.includes('--env-file-if-exists=.env') ||
      !runtimeScript.includes('ts-node') || !runtimeScript.includes('apps/api/scripts/verify-explicit-session-context-activation-runtime.ts'))
    violated('the focused real-PostgreSQL proof is wired as its own package script');
  const contractStep = world.ci.indexOf('run: npm run test:explicit-session-context-activation-entry-contract');
  const runtimeStep = world.ci.indexOf('run: npm run verify:explicit-session-context-activation:integration');
  const migrationStep = world.ci.indexOf('Apply all migrations to fresh PostgreSQL');
  if (contractStep < 0 || runtimeStep < 0) violated('CI runs both QHIA-011A gates');
  if (contractStep > migrationStep) violated('the pure static contract runs before the database bootstrap');
  if (runtimeStep < migrationStep) violated('the real-PostgreSQL proof runs after the database bootstrap');
}

test('A1 - the shipped application sources satisfy the frozen QHIA-011A activation contract', () => {
  assert.doesNotThrow(() => assertExplicitSessionContextActivationContract(shipped));
});

// The exact production set delegation, so a drift fixture edits real text.
const SET_DELEGATION =
  '    const result = await this.delegate(() => this.bindings.setBinding(userId, accessToken, session, kind, contextId));';

test('A2 - anti-vacuity: the real guard rejects every named regression', () => {
  const withFile = (key, source) => ({
    ...shipped,
    files: { ...shipped.files, [key]: source },
    // The repo-wide sweeps read the SAME text, so a drifted named file drifts
    // everywhere it is scanned.
    production: shipped.production.map((entry) => (entry.path === FILES[key] ? { ...entry, source } : entry)),
  });
  const drifts = [
    ['the authenticated controller disappeared', withFile('activationController', '')],
    ['the controller lost its auth guard', withFile('activationController',
      shipped.files.activationController.replace('@UseGuards(SupabaseAuthGuard)\n', ''))],
    ['the set route disappeared', withFile('activationController',
      shipped.files.activationController.replace("@Put('sessions/:sessionId/context-bindings/:contextKind')", "@Put('sessions/:sessionId/ignored')"))],
    ['the clear route disappeared', withFile('activationController',
      shipped.files.activationController.replace("@Delete('sessions/:sessionId/context-bindings/:contextKind')", "@Patch('sessions/:sessionId/ignored')"))],
    ['the read route disappeared', withFile('activationController',
      shipped.files.activationController.replace("@Get('sessions/:sessionId/context-bindings')", "@Get('sessions/:sessionId/ignored')"))],
    ['the controller took a caller-supplied identity', withFile('activationController',
      shipped.files.activationController.replace('const { userId, accessToken } = request.authenticatedUser;\n    return this.activation.activateContext(',
        'const { accessToken } = request.authenticatedUser;\n    const userId = (body as { userId: string }).userId;\n    return this.activation.activateContext('))],
    ['the controller gained a service-role path', withFile('activationController',
      shipped.files.activationController.replace('export class ConversationContextActivationController {',
        'export class ConversationContextActivationController {\n  private readonly key = process.env.SUPABASE_SERVICE_ROLE_KEY;'))],
    ['the controller bypassed the facade', withFile('activationController',
      shipped.files.activationController.replace('return this.activation.activateContext(userId, accessToken, sessionId, contextKind, body);',
        'return new HimSessionContextBindingService(undefined as never).setBinding(userId, accessToken, sessionId, contextKind as never, String(body));'))],
    ['the facade stopped using the QHIA-006 service', withFile('activationService',
      shipped.files.activationService.replace("import { HimSessionContextBindingService } from '../human-model/him-session-context-binding.service';",
        "import { HimSessionContextBindingRepository } from '../human-model/him-session-context-binding.repository';"))],
    ['the facade read before it wrote', withFile('activationService',
      shipped.files.activationService.replace(SET_DELEGATION,
        `    await this.bindings.readActiveBindings(userId, accessToken, session);\n${SET_DELEGATION}`))],
    ['replacement became clear then set', withFile('activationService',
      shipped.files.activationService.replace(SET_DELEGATION,
        `    await this.bindings.clearBinding(userId, accessToken, session, kind);\n${SET_DELEGATION}`))],
    ['the facade issued a second set command', withFile('activationService',
      shipped.files.activationService.replace(SET_DELEGATION,
        `    await this.bindings.setBinding(userId, accessToken, session, kind, contextId);\n${SET_DELEGATION}`))],
    ['the request gained a free-text field', withFile('activationService',
      shipped.files.activationService.replace("const ACTIVATION_REQUEST_FIELDS = Object.freeze(['contextId']);",
        "const ACTIVATION_REQUEST_FIELDS = Object.freeze(['contextId', 'displayText']);"))],
    ['the request gained a reason field', withFile('activationTypes',
      shipped.files.activationTypes.replace('export interface ConversationContextActivationRequest {\n  contextId: string;\n}',
        'export interface ConversationContextActivationRequest {\n  contextId: string;\n  reason: string;\n}'))],
    ['the request gained a provider-output field', withFile('activationTypes',
      shipped.files.activationTypes.replace('export interface ConversationContextActivationRequest {\n  contextId: string;\n}',
        'export interface ConversationContextActivationRequest {\n  contextId: string;\n  providerOutput: string;\n}'))],
    ['the exact-id check was dropped', withFile('activationService',
      shipped.files.activationService.replace("if (typeof value.contextId !== 'string' || !UUID.test(value.contextId)) {",
        "if (typeof value.contextId !== 'string') {"))],
    ['the four kinds were redeclared locally', withFile('activationService',
      shipped.files.activationService.replace("const ACTIVATION_REQUEST_FIELDS = Object.freeze(['contextId']);",
        "const ACTIVATION_REQUEST_FIELDS = Object.freeze(['contextId']);\nconst LOCAL_KINDS = ['GOAL', 'SITUATION', 'DECISION', 'RELATIONSHIP'];"))],
    ['the product response leaked the binding version', withFile('activationTypes',
      shipped.files.activationTypes.replace('export interface ConversationActiveContext {\n  contextKind: HimCrossContextKind;\n  contextId: string;\n}',
        'export interface ConversationActiveContext {\n  contextKind: HimCrossContextKind;\n  contextId: string;\n  bindingVersion: number;\n}'))],
    ['the projection stopped stripping internal metadata', withFile('activationService',
      shipped.files.activationService.replace('    return { contextKind: binding.contextKind, contextId: binding.contextId };', '    return binding;'))],
    ['the Orchestrator started activating contexts', withFile('orchestrator',
      shipped.files.orchestrator.replace('      let crossContextForegroundSettled: HimCrossContextForegroundGuidance | undefined;',
        '      void this.himCrossContextForeground.setBinding();\n      let crossContextForegroundSettled: HimCrossContextForegroundGuidance | undefined;'))],
    ['createTurn started activating contexts', withFile('conversationService',
      shipped.files.conversationService.replace('    const input = this.validateTurnInput(body);',
        '    const input = this.validateTurnInput(body);\n    void ConversationContextActivationService;'))],
    ['the normal conversation controller gained an activation route', withFile('conversationController',
      shipped.files.conversationController.replace('  @Post(\'sessions/:sessionId/turns\')',
        '  @Put(\'sessions/:sessionId/context-bindings/:contextKind\')\n  activateContext() { return undefined; }\n\n  @Post(\'sessions/:sessionId/turns\')'))],
    ['a background/provider module gained the activation service', {
      ...shipped,
      production: [...shipped.production, {
        path: 'apps/api/src/post-response-intelligence/silent-activation.service.ts',
        source: "import { ConversationContextActivationService } from '../conversation/conversation-context-activation.service';\nexport class Silent { constructor(private readonly a: ConversationContextActivationService) {} }\n",
      }],
    }],
    ['a second repository calls the QHIA-006 set RPC directly', {
      ...shipped,
      production: [...shipped.production, {
        path: 'apps/api/src/human-model/him-second-binding.repository.ts',
        source: "export class Second { go(t: string) { return this.dataApi.request(t, 'rpc/set_him_session_context_binding_v1', {}); } }\n",
      }],
    }],
    ['a second repository calls the QHIA-006 read RPC directly', {
      ...shipped,
      production: [...shipped.production, {
        path: 'apps/api/src/conversation/conversation-relevance.repository.ts',
        source: "export class Relevance { go(t: string) { return this.dataApi.request(t, 'rpc/read_him_session_context_bindings_v1', {}); } }\n",
      }],
    }],
    ['a QHIA-011A database migration was added', {
      ...shipped,
      migrations: [...shipped.migrations, {
        name: '0061_him_explicit_session_context_activation_v1.sql',
        source: '-- a migration for this task\n',
      }],
    }],
    ['a second migration redefined the binding authority', {
      ...shipped,
      migrations: [...shipped.migrations, {
        name: '0061_second_relevance_authority.sql',
        source: 'CREATE FUNCTION public.set_him_session_context_binding_v1(p_user_id uuid) RETURNS void AS $$$$;\n',
      }],
    }],
    ['a migration grew a database twin of the application provenance', {
      ...shipped,
      migrations: [...shipped.migrations, {
        name: '0061_activation_provenance.sql',
        source: `SELECT '${ACTIVATION_SOURCE_LITERAL}';\n`,
      }],
    }],
    ['Full Intelligence stopped activating a context', withFile('smokeRuntime',
      shipped.files.smokeRuntime.replace('contextActivationService.activateContext(', 'noopActivation('))],
    ['Full Intelligence stopped censusing the activation attempt', withFile('smokeRuntime',
      shipped.files.smokeRuntime.replace('census.attempts(EXPLICIT_ACTIVATION_SET_RPC), 1', 'census.attempts(EXPLICIT_ACTIVATION_SET_RPC), 0'))],
    ['Full Intelligence counted the attempt but not the completion', withFile('smokeRuntime',
      shipped.files.smokeRuntime.replace('census.completions(EXPLICIT_ACTIVATION_SET_RPC), 1',
        'census.completions(EXPLICIT_ACTIVATION_SET_RPC), census.completions(EXPLICIT_ACTIVATION_SET_RPC)'))],
    ['Full Intelligence stopped proving the activated Goal is bound', withFile('smokeRuntime',
      shipped.files.smokeRuntime.replace("[3, 'GOAL_MOTIVATION', 'ACTIVE_GOAL_BOUND']", "[3, 'GOAL_MOTIVATION', 'NO_ACTIVE_GOAL']"))],
    ['Full Intelligence stopped decoding the activated Goal through the real consumer', withFile('smokeRuntime',
      shipped.files.smokeRuntime.replace('himGoalMotivationService.consumeSourceRows([aggregateRows[2]])',
        "{ contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_GOAL_ACTION_BURDEN' }"))],
    ['the smoke transport substitute stopped recognising the activation command', withFile('smokeAdapters',
      shipped.files.smokeAdapters.replace("  'set_him_session_context_binding_v1',\n", ''))],
    ['the smoke transport substitute started accepting a foreground binding read', withFile('smokeAdapters',
      shipped.files.smokeAdapters.replace("  'set_him_session_context_binding_v1',", "  'set_him_session_context_binding_v1',\n  'read_him_session_context_bindings_v1',"))],
    ['the foreground gained a per-turn binding read', withFile('smokeRuntime',
      shipped.files.smokeRuntime.replace('census.attempts(RELEVANCE_AUTHORITY_RPC), 0', 'census.attempts(RELEVANCE_AUTHORITY_RPC), expectedTurns'))],
    ['the focused proof stopped driving the production controller', withFile('activationVerifier',
      shipped.files.activationVerifier.replace('new ConversationContextActivationController(activationService)', 'activationService'))],
    ['the focused proof stopped proving cross-user isolation', withFile('activationVerifier',
      shipped.files.activationVerifier.replace("'a foreign measurement target'", "'skipped'"))],
    ['the focused proof stopped proving same-target idempotency', withFile('activationVerifier',
      shipped.files.activationVerifier.replace("'the same-target replay created no new binding version'", "'skipped'"))],
    ['the focused proof direct-INSERTs a binding row', withFile('activationVerifier',
      shipped.files.activationVerifier.replace('    const activated = await activationController.activateContext(',
        "    await db.observer('INSERT INTO public.him_session_context_bindings(id) VALUES ($1)', [randomUUID()]);\n    const activated = await activationController.activateContext("))],
    // ---- QHIA-011A Fix 01: HTTP authority-rejection mapping ----
    ['the transport stopped preserving the upstream code', withFile('memoryDataApi',
      shipped.files.memoryDataApi.replace('    readonly upstreamCode?: string,\n', ''))],
    ['the transport stopped preserving the upstream message', withFile('memoryDataApi',
      shipped.files.memoryDataApi.replace('    readonly upstreamMessage?: string,\n', ''))],
    ['the transport reverted to status-only failures', withFile('memoryDataApi',
      shipped.files.memoryDataApi.replace(
        '      const [upstreamCode, upstreamMessage] = await readUpstreamFailureIdentity(response);\n      throw new MemoryDataApiError(response.status, upstreamCode, upstreamMessage);',
        '      throw new MemoryDataApiError(response.status);'))],
    ['the transport started capturing the upstream details', withFile('memoryDataApi',
      shipped.files.memoryDataApi.replace(
        'return [upstreamIdentity(record.code), upstreamIdentity(record.message)];',
        'return [upstreamIdentity(record.code), upstreamIdentity(record.details)];'))],
    ['a body-parsing failure can now escape and replace the transport failure', withFile('memoryDataApi',
      shipped.files.memoryDataApi.replace('  } catch {\n    return [undefined, undefined];\n  }\n', '  }\n'))],
    ['the generic transport error message started carrying database text', withFile('memoryDataApi',
      shipped.files.memoryDataApi.replace(
        'super(`Memory Data API request failed with status ${status}.`);',
        'super(upstreamMessage ?? `Memory Data API request failed with status ${status}.`);'))],
    ['successful 204 behavior changed', withFile('memoryDataApi',
      shipped.files.memoryDataApi.replace('    if (response.status === 204) return undefined as T;\n', ''))],
    ['the mapping started matching by HTTP status alone', withFile('activationService',
      shipped.files.activationService.replace(
        "    if (code === AUTHORITY_OWNERSHIP_DENIAL_CODE && AUTHORITY_OWNERSHIP_DENIAL_MESSAGES.has(message)) {",
        '    if (error.status === 403) {'))],
    ['the mapping started matching the message loosely', withFile('activationService',
      shipped.files.activationService.replace(
        'AUTHORITY_OWNERSHIP_DENIAL_MESSAGES.has(message)',
        "message.includes('cross-user')"))],
    ['the mapping stopped requiring BOTH an exact code and an exact message', withFile('activationService',
      shipped.files.activationService.replace(
        "    if (typeof code !== 'string' || typeof message !== 'string') return error;\n", ''))],
    ['the ownership-denial allowlist was widened', withFile('activationService',
      shipped.files.activationService.replace(
        "  'Unknown, cross-user, or wrong-kind measurement target',",
        "  'Unknown, cross-user, or wrong-kind measurement target',\n  'permission denied for table him_session_context_bindings',"))],
    ['an allowlisted message drifted away from the migration-0055 authority', withFile('activationService',
      shipped.files.activationService.replace(
        "  'Unknown or cross-user conversation session',",
        "  'Unknown or cross user conversation session',"))],
    ['the sanitized 403 started returning the raw upstream message', withFile('activationService',
      shipped.files.activationService.replace(
        'return new ForbiddenException(CONVERSATION_CONTEXT_ACTIVATION_FORBIDDEN_MESSAGE);',
        'return new ForbiddenException(message);'))],
    ['one command stopped going through the boundary-local mapping', withFile('activationService',
      shipped.files.activationService.replace(
        '    const result = await this.delegate(() => this.bindings.readActiveBindings(userId, accessToken, session));',
        '    const result = await this.bindings.readActiveBindings(userId, accessToken, session);'))],
    ['an unrecognised failure is no longer re-thrown untouched', withFile('activationService',
      shipped.files.activationService.replace(
        '    if (code === AUTHORITY_INACTIVE_SESSION_CODE && message === AUTHORITY_INACTIVE_SESSION_MESSAGE) {\n      return new ConflictException(CONVERSATION_CONTEXT_ACTIVATION_CONFLICT_MESSAGE);\n    }\n    return error;',
        '    return new ConflictException(CONVERSATION_CONTEXT_ACTIVATION_CONFLICT_MESSAGE);'))],
    ['the sanitized public message started disclosing the authority wording', withFile('activationTypes',
      shipped.files.activationTypes.replace(
        "  'The requested session or context is not available for this operation.' as const;",
        "  'Unknown, cross-user, or wrong-kind measurement target.' as const;"))],
    ['a global exception filter was introduced', {
      ...shipped,
      production: [...shipped.production, {
        path: 'apps/api/src/observability/global-error.filter.ts',
        source: "import { Catch } from '@nestjs/common';\n@Catch()\nexport class GlobalErrorFilter {}\n",
      }],
    }],
    ['migration 0055 was rewritten to suit the application', {
      ...shipped,
      migrations: shipped.migrations.map((migration) => (migration.name === MIGRATION_0055
        ? { ...migration, source: migration.source.replaceAll('Unknown or cross-user conversation session', 'Session not found') }
        : migration)),
    }],
    ['the real HTTP contract stopped proving the sanitized 403', withFile('httpSpec',
      shipped.files.httpSpec.replaceAll('expect(outcome.status).toBe(403);', 'expect(outcome.status).toBeGreaterThan(0);'))],
    ['the real HTTP contract stopped proving unknown errors stay 500', withFile('httpSpec',
      shipped.files.httpSpec.replaceAll('expect(outcome.status).toBe(500);', 'expect(outcome.status).toBeGreaterThan(0);'))],
    ['the real HTTP contract stopped reproducing the original defect shape', withFile('httpSpec',
      shipped.files.httpSpec.replace('reproduces the original defect shape', 'skipped'))],
    ['the real HTTP contract stopped using the real Nest exception filter', withFile('httpSpec',
      shipped.files.httpSpec.replace('new BaseExceptionFilter(applicationRef).catch(error, host)', 'replies.push({ status: 403, body: {} })'))],
    ['the transport contract stopped proving malformed-body safety', withFile('transportSpec',
      shipped.files.transportSpec.replace('keeps the status but no structured identity', 'skipped'))],
    ['the facade contract stopped proving unknown errors stay unmapped', withFile('activationServiceSpec',
      shipped.files.activationServiceSpec.replaceAll('UNMAPPED_FAILURES', 'SKIPPED_FAILURES'))],
    ['the facade contract stopped proving there is no status-only mapping', withFile('activationServiceSpec',
      shipped.files.activationServiceSpec.replace('never maps by HTTP status alone', 'skipped'))],
    ['the static contract was unwired from package scripts', {
      ...shipped,
      packageJson: shipped.packageJson.replace('"test:explicit-session-context-activation-entry-contract"', '"test:retired-contract"'),
    }],
    ['the real-PostgreSQL proof was unwired from CI', {
      ...shipped,
      ci: shipped.ci.replace('run: npm run verify:explicit-session-context-activation:integration', 'run: echo skipped'),
    }],
  ];

  for (const [label, world] of drifts) {
    assert.notDeepEqual(world, shipped, `the "${label}" mutation actually changed the world`);
    assert.throws(
      () => assertExplicitSessionContextActivationContract(world),
      /QHIA-011A explicit session context activation contract violated/u,
      `the guard rejects: ${label}`,
    );
  }

  // Positive control and formatting-insensitivity.
  assert.doesNotThrow(() => assertExplicitSessionContextActivationContract(shipped));
  const reformatted = {
    ...shipped,
    files: { ...shipped.files, activationService: `\n${shipped.files.activationService}` },
  };
  assert.notEqual(reformatted.files.activationService, shipped.files.activationService);
  assert.doesNotThrow(() => assertExplicitSessionContextActivationContract(reformatted),
    'formatting alone never fails the guard');
});

test('A3 - forward safety: this contract freezes QHIA-011A only, never the repository chain', () => {
  // The single most important control. A later, unrelated migration - exactly
  // what QHIA-012 will add - must stay legal. A guard that failed here would be
  // a future ceiling, which is the defect class this repository has removed
  // three times already.
  const laterMigration = {
    ...shipped,
    migrations: [...shipped.migrations, {
      name: '0061_a_later_unrelated_authority_v1.sql',
      source: 'CREATE FUNCTION public.some_later_authority_v1() RETURNS void LANGUAGE sql AS $$SELECT 1$$;\n',
    }],
  };
  assert.doesNotThrow(() => assertExplicitSessionContextActivationContract(laterMigration),
    'a later unrelated migration stays legal');

  // A later foreground channel, a later context kind, and a later product
  // surface must also stay legal.
  const laterProductionModule = {
    ...shipped,
    production: [...shipped.production, {
      path: 'apps/api/src/human-model/him-some-later-consumption.service.ts',
      source: 'export class Later { read() { return undefined; } }\n',
    }],
  };
  assert.doesNotThrow(() => assertExplicitSessionContextActivationContract(laterProductionModule),
    'a later production module stays legal');

  // No rule in this contract is a global count, size, or zero-state of a shared
  // inventory - the shapes that become future ceilings.
  // The self-check patterns are assembled at run time so this test's own text
  // can never satisfy the shapes it is looking for.
  const code = executable(read('tests/explicit-session-context-activation-entry-contract.test.mjs'));
  const ceilingShapes = [
    ['a migration-count ceiling', ['world', 'migrations', 'length'].join('.')],
    ['a production-source-count ceiling', ['world', 'production', 'length'].join('.')],
    ['a future-authority absence check', ['to', 'regprocedure'].join('_')],
    ['a latest-migration ceiling', ['names', 'at(-1)'].join('.')],
  ];
  for (const [label, shape] of ceilingShapes) {
    assert.ok(!code.includes(shape), `no ${label} is asserted: found ${shape}`);
  }
});

test('A4 - the activation surface carries no privileged transport, raw SQL, or secret', () => {
  // Stated separately from the guard so the security posture is legible on its
  // own, and extended to the two QHIA-006 files this task reuses unchanged.
  for (const key of ['activationController', 'activationService', 'activationTypes', 'bindingService', 'bindingRepository']) {
    const code = executable(shipped.files[key]);
    for (const forbidden of ['service_role', 'ServiceRoleApi', 'set_config', 'request.jwt', 'SUPABASE_SERVICE_ROLE_KEY']) {
      assert.ok(!code.includes(forbidden), `${FILES[key]} carries no privileged path: found ${forbidden}`);
    }
    assert.doesNotMatch(code, /\b(?:SELECT|INSERT|UPDATE|DELETE)\s+(?:\*|INTO|FROM)/u,
      `${FILES[key]} contains no raw SQL`);
  }
  // The QHIA-006 files this task reuses are UNCHANGED authorities: they still
  // hold their fail-closed validation and their single transport call sites.
  assert.match(shipped.files.bindingService, /export class HimSessionContextBindingService/u);
  assert.match(shipped.files.bindingRepository, /export class HimSessionContextBindingRepository/u);
  const repositoryCalls = (executable(shipped.files.bindingRepository).match(/this\.dataApi\.request/gu) ?? []).length;
  assert.equal(repositoryCalls, 3, 'the QHIA-006 repository still holds exactly one call site per command');
  // The activation entry is registered in the Conversation module and reuses
  // the HIM module's exported QHIA-006 service - no second provider is created.
  assert.match(shipped.files.conversationModule, /controllers: \[ConversationController, ConversationContextActivationController\]/u);
  assert.match(shipped.files.conversationModule, /ConversationContextActivationService,/u);
  assert.ok(!executable(shipped.files.conversationModule).includes('HimSessionContextBindingRepository'),
    'the Conversation module creates no second binding repository provider');
  assert.match(shipped.files.conversationModule, /imports: \[[^\]]*HimModule/u,
    'the Conversation module reaches the QHIA-006 service through the HIM module it already imports');
});
