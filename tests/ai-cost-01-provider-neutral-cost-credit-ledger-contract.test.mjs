import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

// AI-COST-01 - Provider-Neutral AI Usage & Cost Ledger + Credit Accounting Foundation. Static contract.
//
// It pins what a refactor could silently erode, and it is adversarial: every detector passes on the shipped tree and
// fails on each planted defect of the task's §21 list (28 of them). It also holds the provider-call census (§20): every
// production provider transport in apps/api/src is listed here, and each listed one is composed through the ONE
// accounting boundary. Real database behaviour is proven by database/verify-migration-0135.mjs on real PostgreSQL.

const rootUrl = new URL('../', import.meta.url);
const rootPath = decodeURIComponent(rootUrl.pathname).replace(/^\/([A-Za-z]:)/u, '$1');
const read = (path) => readFileSync(new URL(path, rootUrl), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
/** Code without comments, so a rule about code is never tripped by prose that explains the rule. */
const ts = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/gu, '$1');
const sql = (text) => text.replace(/--[^\n]*/gu, '');
const fnBody = (text, name) => {
  const start = text.search(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION ${name.replace(/\./gu, '\\.')}\\(`, 'u'));
  return start < 0 ? '' : text.slice(start, text.indexOf('$$;', start));
};
const tableBody = (text, name) => {
  const start = text.indexOf(`CREATE TABLE ${name} (`);
  return start < 0 ? '' : text.slice(start, text.indexOf('\n);', start));
};
const between = (text, from, to) => {
  const start = text.indexOf(from);
  if (start < 0) return '';
  const end = text.indexOf(to, start + from.length);
  return end < 0 ? text.slice(start) : text.slice(start, end);
};

const MIGRATION = 'database/migrations/0135_ai_usage_cost_credit_ledger_v1.sql';
const FILES = {
  migration: MIGRATION,
  migration0131: 'database/migrations/0131_turn_admission_concurrency_cost_bound_v1.sql',
  types: 'apps/api/src/ai-usage/ai-usage.types.ts',
  decimal: 'apps/api/src/ai-usage/exact-decimal.ts',
  normalization: 'apps/api/src/ai-usage/ai-usage-normalization.ts',
  attribution: 'apps/api/src/ai-usage/ai-usage-attribution.ts',
  accounting: 'apps/api/src/ai-usage/ai-provider-call-accounting.ts',
  clients: 'apps/api/src/ai-usage/accounted-provider-clients.ts',
  ledger: 'apps/api/src/ai-usage/ai-provider-call-ledger.repository.ts',
  production: 'apps/api/src/ai-usage/production-ai-provider-call-accounting.ts',
  simulation: 'apps/api/src/ai-usage/ai-cost-simulation.ts',
  worker: 'apps/api/src/ai-usage/ai-usage-operations.worker.ts',
  telemetry: 'apps/api/src/observability/telemetry.service.ts',
  openaiRouter: 'apps/api/src/model-router/providers/openai/openai-model-router.ts',
  claudeRouter: 'apps/api/src/model-router/providers/anthropic/claude-model-router.ts',
  routerTypes: 'apps/api/src/model-router/model-router.types.ts',
  routerModule: 'apps/api/src/model-router/model-router.module.ts',
  conversationModule: 'apps/api/src/conversation/conversation.module.ts',
  conversationService: 'apps/api/src/conversation/conversation.service.ts',
  foreground: 'apps/api/src/conversation/foreground-turn-work.ts',
  focusBinding: 'apps/api/src/conversational-focus/focus-resolution-binding.ts',
  threadBinding: 'apps/api/src/thread-establishment/thread-establishment-binding.ts',
  continuityBinding: 'apps/api/src/thread-lifecycle/thread-continuity-binding.ts',
  intentModule: 'apps/api/src/hypothesis/hypothesis-intent-extraction-provider.module.ts',
  associationModule: 'apps/api/src/hypothesis/hypothesis-evidence-association-provider.module.ts',
  candidateModule: 'apps/api/src/hypothesis/hypothesis-candidate-generator-provider.module.ts',
  consumer: 'apps/api/src/post-response-intelligence/post-response-intelligence-consumer.service.ts',
  brainEvalPricing: 'apps/api/src/brain-eval/brain-eval.pricing.ts',
};
const src = Object.fromEntries(Object.entries(FILES).map(([key, path]) => [key, read(path)]));
const plant = (key, from, to) => {
  assert.ok(src[key].includes(from), `planting anchor missing in ${key}: ${from}`);
  return { ...src, [key]: src[key].replace(from, to) };
};

const AI_TABLES = ['public.ai_provider_calls', 'public.ai_provider_call_usage', 'public.ai_price_cards', 'public.ai_cost_ratings',
  'public.ai_cost_rating_components', 'public.ai_credit_policies', 'public.ai_credit_ratings'];
const SERVICE_GRANTS = [
  'public.begin_ai_provider_call_v1(uuid, uuid, uuid, uuid, text, text, text, text, text)',
  'public.settle_ai_provider_call_v1(uuid, uuid, text, text, jsonb)',
  'public.server_read_ai_usage_operations_summary_v1()',
  'public.server_read_ai_cost_aggregates_v1(timestamptz, timestamptz)',
  'public.server_read_ai_credit_policy_state_v1()',
];

// ---------------------------------------------------------------------------------------------------------------
// The provider-call census (§20). Each production transport, the adapter that owns it, and how it is accounted.
// ---------------------------------------------------------------------------------------------------------------
const CENSUS = [
  { transport: 'apps/api/src/model-router/providers/openai/openai-model-router.ts', family: 'CONVERSATION_REPLY' },
  { transport: 'apps/api/src/model-router/providers/anthropic/claude-model-router.ts', family: 'CONVERSATION_REPLY' },
  { transport: 'apps/api/src/conversation-unit/openai-cu-segmentation.provider.ts', family: 'CU_SEGMENTATION', frozen: 'c792f7a5abdf5dc0129db9db4c8fdfcd45d5e95e' },
  { transport: 'apps/api/src/conversational-focus/openai-focus-resolution.provider.ts', family: 'FOCUS_RESOLUTION', frozen: 'ee832a66075509261d6e23f813d496c6c48f8e60' },
  { transport: 'apps/api/src/thread-establishment/openai-thread-establishment.provider.ts', family: 'THREAD_FORMATION', frozen: '5135e056beb4ca5facb761422703f4b69d922a81' },
  { transport: 'apps/api/src/thread-lifecycle/openai-thread-continuity.provider.ts', family: 'THREAD_CONTINUITY', frozen: '5eacb7942a8696237562dcc974d6d40b3af97aad' },
  { transport: 'apps/api/src/hypothesis/openai-hypothesis-intent-extraction.provider.ts', family: 'HYPOTHESIS_INTENT_EXTRACTION', frozen: 'bf5b82737583e17e0defbd8a260ac63fb8e451e6' },
  { transport: 'apps/api/src/hypothesis/gemini-hypothesis-evidence-association.provider.ts', family: 'HYPOTHESIS_EVIDENCE_ASSOCIATION', frozen: '9b8b2f00fc6811b7aa03974fe08671a9083936d2' },
  { transport: 'apps/api/src/hypothesis/gemini-hypothesis-candidate.generator.ts', family: 'HYPOTHESIS_CANDIDATE_GENERATION', frozen: '3e4791757f58f95ad7288f27caa82d24136ed0c5' },
];
const PROVIDER_TRANSPORT = /\.responses\.create\(|\.messages\.create\(|generativelanguage\.googleapis\.com|new OpenAI\(|new Anthropic\(/u;

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

/** Every production provider transport is in the census, and each census entry is composed through accounting. */
function censusViolations(world) {
  const out = [];
  // Composition: the one place each production adapter is built passes its client through the boundary.
  if (!/case 'anthropic':\s*return ClaudeModelRouter\.fromEnvironment\(telemetry, productionAiProviderCallAccounting\(\)\);/u.test(ts(world.routerModule))
    || !/case 'openai':\s*return OpenAIModelRouter\.fromEnvironment\(telemetry, productionAiProviderCallAccounting\(\)\);/u.test(ts(world.routerModule))) {
    out.push('the production Model Router is not composed with the accounting boundary');
  }
  if (!ts(world.openaiRouter).includes("accounting ? accountedOpenAIResponsesClient(client, 'CONVERSATION_REPLY', accounting) : client")) out.push('the OpenAI reply client is not accounted');
  if (!ts(world.claudeRouter).includes("accounting ? accountedAnthropicMessagesClient(client, 'CONVERSATION_REPLY', accounting) : client")) out.push('the Anthropic reply client is not accounted');
  const module = ts(world.conversationModule);
  if (!module.includes("costLedgerDecorator('CU_SEGMENTATION')(createOpenAiSegmentationClient(config))")) out.push('CU segmentation is not accounted');
  for (const [factory, family] of [['openAiFocusResolutionBinding', 'FOCUS_RESOLUTION'], ['openAiThreadEstablishmentBinding', 'THREAD_FORMATION'], ['openAiThreadContinuityBinding', 'THREAD_CONTINUITY']]) {
    if (!module.includes(`guardForegroundBinding(${factory}(process.env, costLedgerDecorator('${family}')))`)) out.push(`${factory} is not accounted`);
  }
  for (const [key, create] of [['focusBinding', 'decorateClient(createOpenAiFocusClient(config))'], ['threadBinding', 'decorateClient(createOpenAiThreadClient(config))'], ['continuityBinding', 'decorateClient(createOpenAiThreadContinuityClient(config))']]) {
    if (!ts(world[key]).includes(create)) out.push(`${key} does not apply its client decorator`);
  }
  if (!/accountedOpenAIResponsesClient\(\s*createOpenAIExtractionClient\(config\), 'HYPOTHESIS_INTENT_EXTRACTION', productionAiProviderCallAccounting\(\)\)/u.test(ts(world.intentModule))) out.push('intent extraction is not accounted');
  if (!/accountedGeminiTransport\(\s*\(url, init\) => fetch\(url, init\), config\.model, 'HYPOTHESIS_EVIDENCE_ASSOCIATION', productionAiProviderCallAccounting\(\)\)/u.test(ts(world.associationModule))) out.push('evidence association is not accounted');
  if (!/accountedGeminiTransport\(\s*\(url, init\) => fetch\(url, init\), config\.model, 'HYPOTHESIS_CANDIDATE_GENERATION', productionAiProviderCallAccounting\(\)\)/u.test(ts(world.candidateModule))) out.push('candidate generation is not accounted');
  for (const key of ['intentModule', 'associationModule', 'candidateModule']) {
    if (/\.fromEnvironment\(environment\)/u.test(ts(world[key]))) out.push(`${key} composes the unaccounted fromEnvironment adapter in production`);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Detectors - one rule each, named for the §21 defect it catches.
// ---------------------------------------------------------------------------------------------------------------
/** A line that computes or carries a Credit AMOUNT (`credits`), as opposed to naming the Credit state. */
const CREDIT_LINE = /credits/iu;
const productionTs = (world) => ['types', 'decimal', 'normalization', 'attribution', 'accounting', 'clients', 'ledger', 'production', 'simulation', 'worker']
  .map((key) => ts(world[key])).join('\n');

function creditViolations(world) {
  const out = [];
  const lines = [...productionTs(world).split('\n'), ...sql(world.migration).split('\n')].filter((line) => CREDIT_LINE.test(line));
  if (lines.some((line) => /quantit|_TOKEN\b|\btokens?\b|usage_kind|usageKind/iu.test(line))) out.push('(1) a Credit is derived from provider tokens');
  if (/\b(?:USD|EGP|EUR|dollars?)\b/u.test(productionTs(world)) || /\b(?:USD|EGP|EUR)\b/u.test(sql(world.migration))) out.push('(2) a currency is written into production accounting code (Credits equated to money)');
  const formula = sql(fnBody(world.migration, 'public.ai_credits_for_rated_cost_v1'));
  if (!/v_raw := p_rated_amount \* p_credits_per_cost_unit;/u.test(formula)) out.push('(1) the Credit formula is not a function of rated cost only');
  if (!/export function creditsForRatedCost\(ratedCost: string, policy: SimulationCreditPolicy\): string/u.test(ts(world.simulation))) out.push('(1) the simulator\'s Credit formula is not a function of rated cost only');
  if (!/CONSTRAINT ai_credit_policies_activation_gate_check CHECK \(lifecycle IN \('DRAFT'\)\)/u.test(sql(world.migration))) out.push('(20) a Credit Policy can be activated without a reviewed, Product-authorized migration');
  if (/INSERT INTO public\.ai_credit_policies/u.test(sql(world.migration))) out.push('(20) the migration seeds a Credit Policy');
  const state = sql(fnBody(world.migration, 'public.server_read_ai_credit_policy_state_v1'));
  if (!/ELSE 'CREDIT_POLICY_NOT_ACTIVATED' END/u.test(state)) out.push('(22) the no-policy state is not CREDIT_POLICY_NOT_ACTIVATED');
  if (!/!policy\s*\?\s*\{ state: 'CREDIT_POLICY_NOT_SUPPLIED' \}/u.test(ts(world.simulation)) || /credits: '0'|credits: 0\b/u.test(ts(world.simulation))) out.push('(22) no Credit Policy turns into zero Credits');
  const gate = sql(fnBody(world.migration, 'public.require_active_ai_credit_policy_v1'));
  if (!/p\.lifecycle = 'ACTIVE'\) THEN\s+RAISE EXCEPTION 'CREDIT_POLICY_NOT_ACTIVATED'/u.test(gate)) out.push('(22) a Credit rating can be written without an active policy');
  if (!/CREATE TRIGGER reject_ai_credit_rating_mutation_v1 BEFORE UPDATE OR DELETE ON public\.ai_credit_ratings/u.test(sql(world.migration))
    || !/CREATE TRIGGER reject_ai_credit_policy_mutation_v1 BEFORE UPDATE OR DELETE ON public\.ai_credit_policies/u.test(sql(world.migration))) {
    out.push('(27) historical Credit ratings or policy versions can be rewritten');
  }
  if (/balance|allowance|top_?up|wallet|debit/iu.test(sql(world.migration).replace(/'[^']*'/gu, ''))) out.push('(D) a balance / allowance / debit object exists');
  return out;
}

function pricingViolations(world) {
  const out = [];
  const migration = sql(world.migration);
  // Outside function bodies: the registration function's own INSERT is how an operator adds a price, not a price.
  const topLevel = migration.split('$$').filter((_, index) => index % 2 === 0).join(' ');
  if (/INSERT INTO public\.ai_price_cards|register_ai_price_card_v1\(\s*'/u.test(topLevel)) out.push('(3) the migration hard-codes a price');
  const code = productionTs(world);
  if (/(?:unitPrice|unit_price|PerMillion\w*|price)\s*[:=]\s*['"]?\d/iu.test(code)) out.push('(3) production code hard-codes a price');
  if (/PerMillionTokens:\s*\d/u.test(ts(world.brainEvalPricing))) out.push('(3) the evaluation harness hard-codes a provider price');
  if (!/CONSTRAINT ai_price_cards_test_isolation_check CHECK \(\(card_class = 'TEST_ONLY'\) = \(provider = 'TEST_PROVIDER'\)\)/u.test(migration)) out.push('(21) a TEST_ONLY price can rate production usage');
  const begin = sql(fnBody(world.migration, 'public.begin_ai_provider_call_v1'));
  if (!/IF p_provider NOT IN \('OPENAI', 'ANTHROPIC', 'GEMINI'\) THEN/u.test(begin)) out.push('(21) the begin command admits the TEST_PROVIDER');
  const guard = sql(fnBody(world.migration, 'public.guard_ai_price_card_v1'));
  if (!/IF OLD\.effective_to IS NOT NULL OR NEW\.effective_to IS NULL\s+OR \(to_jsonb\(NEW\) - 'effective_to'\) IS DISTINCT FROM \(to_jsonb\(OLD\) - 'effective_to'\) THEN\s+RAISE EXCEPTION 'AI_PRICE_CARD_IMMUTABLE'/u.test(guard)
    || !/r\.event_at >= NEW\.effective_to\) THEN\s+RAISE EXCEPTION 'AI_PRICE_CARD_WINDOW_IN_USE'/u.test(guard)) {
    out.push('(4) a provider price update can rewrite an already-rated cost');
  }
  if (!/price_card_id uuid NOT NULL REFERENCES public\.ai_price_cards \(id\) ON DELETE RESTRICT/u.test(migration)) out.push('(4) a referenced price card can be deleted');
  if (!/pg_advisory_xact_lock/u.test(guard) || !/tstzrange\(p\.effective_from, p\.effective_to, '\[\)'\) && tstzrange\(NEW\.effective_from, NEW\.effective_to, '\[\)'\)\) THEN\s+RAISE EXCEPTION 'AI_PRICE_CARD_OVERLAP' USING ERRCODE = '23P01'/u.test(guard)) {
    out.push('(16) price-card intervals can overlap');
  }
  const rate = sql(fnBody(world.migration, 'public.ai_rate_provider_call_v1'));
  if ((rate.match(/q\.effective_from <= c\.started_at\s+AND \(q\.effective_to IS NULL OR c\.started_at < q\.effective_to\)/gu) ?? []).length !== 2
    || /now\(\)|clock_timestamp\(\)|CURRENT_TIMESTAMP/u.test(rate)) {
    out.push('(4) a call is rated by a price other than the one effective at its own start');
  }
  if (!/UPDATE public\.ai_cost_ratings r SET is_canonical = false WHERE r\.provider_call_id = c\.id AND r\.is_canonical;/u.test(rate)) out.push('(4) re-rating does not keep the previous version');
  const ratingGuard = sql(fnBody(world.migration, 'public.guard_ai_cost_rating_mutation_v1'));
  if (!/IF NOT \(OLD\.is_canonical AND NOT NEW\.is_canonical\)\s+OR \(to_jsonb\(NEW\) - 'is_canonical'\) IS DISTINCT FROM \(to_jsonb\(OLD\) - 'is_canonical'\) THEN/u.test(ratingGuard)) out.push('(4) a stored rating can be rewritten');
  return out;
}

function arithmeticViolations(world) {
  const out = [];
  const money = ['decimal', 'simulation'].map((key) => ts(world[key])).join('\n');
  if (/parseFloat|toFixed|Number\(|Math\.(?:round|ceil|floor|pow)|\*\s*1e-?\d|\/\s*1_?000/u.test(money)) out.push('(5) money or Credits pass through a JavaScript number');
  if (!/readonly units: bigint;/u.test(ts(world.decimal))) out.push('(5) the exact decimal is not BigInt-backed');
  const amount = sql(fnBody(world.migration, 'public.ai_rated_component_amount_v1'));
  if (!/p_quantity::numeric \* p_unit_price \* CASE p_basis WHEN 1 THEN 1::numeric WHEN 1000 THEN 0\.001 WHEN 1000000 THEN 0\.000001 END/u.test(amount)) out.push('(5) the database amount is not exact numeric multiplication');
  if (/\b(?:real|double precision|float\d?)\b/iu.test(sql(world.migration))) out.push('(5) the migration stores money in a floating type');
  return out;
}

function unknownViolations(world) {
  const out = [];
  for (const key of ['normalization', 'accounting', 'clients', 'openaiRouter', 'claudeRouter']) {
    if (/\?\?\s*0\b|\|\|\s*0\b/u.test(ts(world[key]))) out.push(`(6) ${key} turns missing usage into zero`);
  }
  if (!/inputTokens: number \| null;\s*outputTokens: number \| null;/u.test(ts(world.routerTypes))) out.push('(6) the router result cannot express unknown usage');
  const norm = ts(world.normalization);
  if (!/if \(!usage\) return ABSENT_AI_USAGE;/u.test(norm) || (norm.match(/if \(!usage\) return ABSENT_AI_USAGE;/gu) ?? []).length !== 3) out.push('(6) a missing usage object is not ABSENT');
  if (!/const cacheRead = count\(details\?\.cached_tokens\);\s*const cacheWrite = count\(details\?\.cache_write_tokens\);\s*if \(input === undefined \|\| cacheRead === undefined \|\| cacheWrite === undefined/u.test(norm)) out.push('(missing cache fields) an absent cache field is assumed uncached');
  if (!/INPUT_TOKEN: count\(usage\.input_tokens\),\s*CACHE_READ_INPUT_TOKEN: count\(usage\.cache_read_input_tokens\),\s*CACHE_WRITE_INPUT_TOKEN: count\(usage\.cache_creation_input_tokens\),/u.test(norm)) out.push('(missing cache fields) the Anthropic cache fields are not kept as reported');
  const rate = sql(fnBody(world.migration, 'public.ai_rate_provider_call_v1'));
  if (!/IF c\.usage_completeness <> 'COMPLETE' THEN\s+v_state := 'USAGE_UNKNOWN';/u.test(rate)) out.push('(6) partial or absent usage is rated');
  if (!/IF v_unpriced > 0 THEN\s+v_state := 'UNPRICED'; v_reason := 'NO_EFFECTIVE_PRICE_CARD';/u.test(rate) || /COALESCE\([pq]\.unit_price|COALESCE\(sum/u.test(rate)) out.push('(7) a missing rate is treated as zero');
  const accounting = ts(world.accounting);
  if (!/try \{\s*usage = readUsage\(value\);\s*\} catch \{\s*usage = ABSENT_AI_USAGE;\s*\}/u.test(accounting)) out.push('(8) a success without readable usage is treated as free');
  if (!/catch \(error\) \{\s*await settle\('FAILED', ABSENT_AI_USAGE\);\s*throw error;\s*\}/u.test(accounting)) out.push('(9) a provider failure is treated as free');
  const settle = sql(fnBody(world.migration, 'public.settle_ai_provider_call_v1'));
  if (!/WHEN p_usage_completeness = 'ABSENT' THEN p_outcome \|\| '_USAGE_UNKNOWN'/u.test(settle)) out.push('(8/9) an attempt with no usage is not *_USAGE_UNKNOWN');
  const summary = sql(fnBody(world.migration, 'public.server_read_ai_usage_operations_summary_v1'));
  if (!/c\.call_state = 'PENDING' AND c\.started_at < clock_timestamp\(\) - interval '5 minutes'/u.test(summary)) out.push('(stale) a stale PENDING call is ignored');
  return out;
}

function boundaryViolations(world) {
  const out = [];
  const accounting = ts(world.accounting);
  const track = between(accounting, 'async track<T>(', 'private async settle(');
  const beginAt = track.indexOf('await this.ledger.begin(');
  const invokeAt = track.indexOf('value = await invoke();');
  if (beginAt < 0 || invokeAt < 0 || beginAt > invokeAt) out.push('(10) a provider call can start before its durable accounting intent');
  if ((track.match(/invoke\(\)/gu) ?? []).length !== 1) out.push('(25) a second, unaccounted provider path exists in the boundary');
  if (!/\} catch \{\s*this\.signal\('begin', 'failure'\);\s*throw new AiProviderCallAccountingUnavailableError\(\);\s*\}/u.test(track)) out.push('(25) an accounting failure lets the provider call proceed');
  if (!/if \(!attribution\) \{\s*this\.signal\('begin', 'unattributed'\);\s*throw new AiProviderCallAccountingUnavailableError\(\);\s*\}/u.test(track)) out.push('(25) an unattributed provider call is allowed');
  if (!/const callId = this\.newCallId\(\);/u.test(track) || /private (?:readonly )?callId|this\.callId\b/u.test(accounting)) out.push('(11) one call id is shared by several provider attempts');
  for (const [key, fn] of [['clients', 'accountedOpenAIResponsesClient'], ['clients', 'accountedAnthropicMessagesClient'], ['clients', 'accountedGeminiTransport']]) {
    const body = between(ts(world[key]), `export function ${fn}`, 'export ');
    if (!/accounting\.track\(/u.test(body)) out.push(`(25) ${fn} reaches the provider outside the boundary`);
  }
  const settle = sql(fnBody(world.migration, 'public.settle_ai_provider_call_v1'));
  if (!/IF c\.call_state <> 'PENDING' THEN\s+IF c\.settlement_digest = v_digest THEN/u.test(settle) || !/RAISE EXCEPTION 'AI_PROVIDER_CALL_SETTLEMENT_CONFLICT' USING ERRCODE = 'PT409';/u.test(settle)
    || !/FOR UPDATE;/u.test(settle)) {
    out.push('(12) a replayed or concurrent settlement can create a second charge');
  }
  const begin = sql(fnBody(world.migration, 'public.begin_ai_provider_call_v1'));
  if (!/RETURN QUERY SELECT 'ALREADY_BEGUN'::text, existing\.attempt_number; RETURN;/u.test(begin) || !/count\(\*\)::integer \+ 1 END INTO v_attempt/u.test(begin)) out.push('(11/12) begin is not idempotent per attempt, or retries are folded into one row');
  return out;
}

function privacyViolations(world) {
  const out = [];
  const migration = sql(world.migration);
  for (const table of AI_TABLES) {
    const body = tableBody(migration, table);
    if (!body) { out.push(`${table} is missing`); continue; }
    const columns = body.split('\n').map((line) => line.trim()).filter((line) => /^[a-z_]+ [a-z]/u.test(line) && !line.startsWith('CONSTRAINT') && !line.startsWith('PRIMARY'));
    for (const column of columns) {
      if (/^(?:\w*(?:prompt|response|content|transcript|message|statement|body|email|login|public_id|error|exception|raw|payload)\w*) /iu.test(column)) out.push(`(13/28) ${table} carries a content column: ${column}`);
      if (/\bjsonb?\b/u.test(column)) out.push(`(14) ${table} stores raw JSON: ${column}`);
    }
  }
  const ledger = ts(world.ledger);
  const keys = [...ledger.matchAll(/\b(p_\w+):/gu)].map((m) => m[1]).sort();
  const allowed = ['p_call_id', 'p_call_id', 'p_feature_family', 'p_operation', 'p_outcome', 'p_processing_path', 'p_provider', 'p_requested_model', 'p_session_id', 'p_source_turn_id', 'p_usage', 'p_usage_completeness', 'p_user_id', 'p_user_id'].sort();
  if (JSON.stringify(keys) !== JSON.stringify(allowed)) out.push(`(13/14/28) the ledger sends more than identities and normalized numbers: ${keys.join(',')}`);
  if (!/p_usage: record\.usage\.completeness === 'ABSENT' \? \{\} : \{ \.\.\.record\.usage\.quantities \},/u.test(ledger)) out.push('(14) the ledger sends something other than the normalized quantities');
  if (!/settle_ai_provider_call_v1\(\s*p_call_id uuid, p_user_id uuid, p_outcome text, p_usage_completeness text, p_usage jsonb\s*\)/u.test(migration)) out.push('(28) the settlement command accepts more than outcome and normalized usage');
  if (!/begin_ai_provider_call_v1\(\s*p_call_id uuid, p_user_id uuid, p_session_id uuid, p_source_turn_id uuid, p_provider text, p_requested_model text,\s*p_operation text, p_feature_family text, p_processing_path text\s*\)/u.test(migration)) out.push('(28) the begin command accepts more than identities');
  const accountingSource = ts(world.accounting);
  if (/output_text|\.content\b|messages|instructions|prompt/u.test(between(accountingSource, 'async track<T>(', 'private signal('))) out.push('(13) the boundary reads provider request or response content');
  return out;
}

function telemetryViolations(world) {
  const out = [];
  const telemetry = ts(world.telemetry);
  const methods = ['recordAiProviderCallAccounting(', 'recordAiProviderCallSettlement(', 'recordAiUsageOperationsState('].map((name) => between(telemetry, ` ${name}`, '});}'));
  for (const body of methods) {
    if (!body) { out.push('an AI usage telemetry method is missing'); continue; }
    const labels = [...body.matchAll(/\{([a-z_:,A-Z.?\s]+policy_version:AI_USAGE_POLICY_VERSION[^}]*)\}/gu)].map((m) => m[1]).join(',');
    if (/user|session|turn|call_?id|model|price|cost|amount/iu.test(labels)) out.push(`(15) a high-cardinality or private value is a telemetry label: ${labels}`);
  }
  return out;
}

// Independent review correction: the ledger's own health scan is fail-soft but never silent (PROD-OPS-01 posture).
function operationsScanViolations(world) {
  const out = [];
  const worker = ts(world.worker);
  const scan = between(worker, 'async runOnce(): Promise<void> {', 'private signal(');
  const signal = between(worker, 'private signal(', 'private quietly(');
  if (!scan || !signal) return ['the operations scan or its signal is missing'];
  for (const [, body] of scan.matchAll(/catch\b[^{]*\{([\s\S]*?)\n\s*\}/gu)) {
    if (!body.includes('this.signal(')) out.push('a failure of the operations scan is caught silently');
  }
  if (!/\} catch \(error\) \{\s*this\.signal\(classifyOperationalFailure\(error\) === 'TRANSPORT' \? 'transport_failure' : 'integrity_failure'\);\s*return;/u.test(scan)) out.push('a failed read / parse is not classified into transport_failure | integrity_failure');
  const read = scan.indexOf("rpc<unknown>('server_read_ai_usage_operations_summary_v1'");
  const parse = scan.indexOf('parseAiUsageOperationsSummary(');
  const judged = scan.indexOf('} catch (error) {');
  if (read < 0 || parse < 0 || judged < 0 || read > judged || parse > judged) out.push('the summary read + parse is not inside the classified judgement');
  const success = scan.indexOf("this.signal('success');");
  const gauges = scan.indexOf('recordAiUsageOperationsState(');
  if (success < 0 || success < judged || gauges < success) out.push('a successful scan does not emit success before its gauges');
  if (!/this\.quietly\(\(\) => \{\s*const t = this\.telemetry;/u.test(scan) || (scan.match(/this\.telemetry/gu) ?? []).length !== 1) out.push('the gauges reach telemetry outside the fail-soft wrapper');
  if (!/\): void \{\s*this\.quietly\(\(\) => this\.telemetry\.recordOperationalOutcome\('AI_USAGE_ACCOUNTING', 'operations_scan', outcome\)\);\s*\}\s*$/u.test(signal)) out.push('the operations outcome is not a fail-soft, closed AI_USAGE_ACCOUNTING / operations_scan signal');
  if (!/^private signal\(outcome: 'success' \| 'transport_failure' \| 'integrity_failure'\): void/u.test(signal)) out.push('the operations outcome is not a closed union');
  if (/this\.signal\([^;]*(?:\.message|String\(|error\.name|\.status|\.code|userId|sessionId|callId|model)/u.test(scan)) out.push('error text or an identifier reaches the operations signal');
  if (!ts(world.telemetry).includes("['AI_USAGE_ACCOUNTING',new Map([['operations_scan',new Set(['success',...OPERATION_FAILURES])]])],")) out.push('the finite operational registry does not admit exactly AI_USAGE_ACCOUNTING / operations_scan');
  return out;
}

function authorityViolations(world) {
  const out = [];
  const migration = sql(world.migration);
  const grants = [...migration.matchAll(/GRANT ([^;]+);/gu)].map((m) => m[1].replace(/\s+/gu, ' ').trim());
  const expected = `EXECUTE ON FUNCTION ${SERVICE_GRANTS.join(', ')} TO service_role`;
  if (grants.length !== 1 || grants[0] !== expected) out.push(`(18/19) the grant surface is not exactly the five service-role functions: ${grants.join(' | ')}`);
  if (!/REVOKE ALL ON TABLE public\.ai_provider_calls, public\.ai_provider_call_usage, public\.ai_price_cards,\s*public\.ai_cost_ratings, public\.ai_cost_rating_components, public\.ai_credit_policies, public\.ai_credit_ratings\s*FROM PUBLIC, anon, authenticated, service_role;/u.test(migration)) out.push('(18/19) an application role can read or write an accounting table');
  for (const table of AI_TABLES) if (!migration.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`)) out.push(`${table} has no row-level security`);
  if (/CREATE POLICY/u.test(migration)) out.push('(18/19) a row-level policy opens an accounting table');
  const register = sql(fnBody(world.migration, 'public.register_ai_price_card_v1'));
  if (/SECURITY DEFINER/u.test(register)) out.push('(18) price-card registration runs with elevated rights for its caller');
  // (17) Identity from server authority only: each wrapper fixes its provider; the turn body carries content only.
  const clients = ts(world.clients);
  for (const provider of ["{ provider: 'OPENAI', requestedModel: modelOf(body), featureFamily }", "{ provider: 'ANTHROPIC', requestedModel: modelOf(body), featureFamily }", "{ provider: 'GEMINI', requestedModel, featureFamily }"]) {
    if (!clients.includes(provider)) out.push('(17) the provider identity is not fixed by the server-side wrapper');
  }
  if (/body\.provider|\bprovider:\s*\(?body/u.test(clients)) out.push('(17) the provider identity is read from a request body');
  if (!ts(world.conversationService).includes("const allowed = new Set(['content', 'idempotencyKey']);")) out.push('(17) a client turn body can carry provider or model identity');
  return out;
}

function deletionViolations(world) {
  const out = [];
  const migration = sql(world.migration);
  if (!/user_id uuid NOT NULL REFERENCES public\.users \(id\) ON DELETE CASCADE,/u.test(tableBody(migration, 'public.ai_provider_calls'))) out.push('(24) account deletion leaves cost rows linked to the account');
  for (const [table, ref] of [['public.ai_provider_call_usage', 'REFERENCES public.ai_provider_calls (id) ON DELETE CASCADE'], ['public.ai_cost_ratings', 'REFERENCES public.ai_provider_calls (id) ON DELETE CASCADE'],
    ['public.ai_cost_rating_components', 'REFERENCES public.ai_cost_ratings (id) ON DELETE CASCADE'], ['public.ai_credit_ratings', 'REFERENCES public.ai_cost_ratings (id) ON DELETE CASCADE']]) {
    if (!tableBody(migration, table).includes(ref)) out.push(`(24) ${table} can be orphaned by an erasure`);
  }
  for (const guard of ['public.guard_ai_provider_call_mutation_v1', 'public.reject_ai_accounting_fact_mutation_v1', 'public.guard_ai_cost_rating_mutation_v1']) {
    if (!/pg_catalog\.pg_trigger_depth\(\) > 1/u.test(fnBody(migration, guard))) out.push(`(24) ${guard} blocks the erasure's cascade`);
  }
  if (/session_id uuid REFERENCES|source_turn_id uuid REFERENCES/u.test(tableBody(migration, 'public.ai_provider_calls'))) out.push('(24) correlation identities hold the account\'s conversation rows');
  return out;
}

function prodSec02Violations(world) {
  const out = [];
  if (gitBlobId(world.migration0131) !== 'e5da1036c62487fd3aae6529f84de9c203c32d6e') out.push('(23) migration 0131 changed');
  if (gitBlobId(world.foreground) !== '22873e1b58963ca5fff41df13ceed6698041239f') out.push('(23) the foreground deadline / work-lease scope changed');
  for (const key of ['openaiRouter', 'claudeRouter']) {
    const code = world[key];
    const guardAt = code.indexOf('assertForegroundProviderBudget();');
    const callAt = code.search(/this\.client\.(?:responses|messages)\.create\(/u);
    if (guardAt < 0 || callAt < 0 || guardAt > callAt) out.push(`(23) ${key} no longer checks the deadline before its provider call`);
  }
  for (const token of ['CU_SEGMENTATION_BINDING_FACTORY', 'FOCUS_RESOLUTION_BINDING_FACTORY', 'THREAD_ESTABLISHMENT_BINDING_FACTORY', 'THREAD_CONTINUITY_BINDING_FACTORY']) {
    if (!new RegExp(`provide: ${token}, useValue: guardForegroundBinding\\(`, 'u').test(ts(world.conversationModule))) out.push(`(23) ${token} lost its deadline guard`);
  }
  if (/conversation_turn_|begin_conversation_turn_work|TURN_ADMISSION/u.test(sql(world.migration))) out.push('(23) the accounting migration touches the PROD-SEC-02 admission or work bound');
  return out;
}

function simulatorViolations(world) {
  const out = [];
  const simulation = ts(world.simulation);
  const imports = [...simulation.matchAll(/from '([^']+)'/gu)].map((m) => m[1]).sort();
  if (JSON.stringify(imports) !== JSON.stringify(['./ai-usage.types', './exact-decimal'])) out.push(`(26) the simulator reaches beyond its pure inputs: ${imports.join(', ')}`);
  if (/fetch\(|\.rpc\(|process\.env|writeFile|balance|debit/iu.test(simulation)) out.push('(26) the simulator can touch a live balance, a database or the web');
  return out;
}

function attributionViolations(world) {
  const out = [];
  if (!/return runWithAiUsageAttribution\(\{ userId \}, \(\) =>\s*runForegroundTurnWork\(/u.test(ts(world.conversationService))) out.push('the foreground request does not attribute its provider calls to the authenticated reader');
  if (!/withPostResponseAiUsageAttribution\(entry\.envelope, \(\) => this\.dispatcher\.dispatch\(entry\.envelope\)\)/u.test(ts(world.consumer))) out.push('post-response provider calls are not attributed');
  if (!/return valid \? attributions\.run\(Object\.freeze\(\{ \.\.\.attribution \}\), work\) : attributions\.exit\(work\);/u.test(ts(world.attribution))) out.push('an invalid attribution is not fail-closed');
  return out;
}

const DETECTORS = { censusViolations, creditViolations, pricingViolations, arithmeticViolations, unknownViolations, boundaryViolations, privacyViolations, telemetryViolations, operationsScanViolations, authorityViolations, deletionViolations, prodSec02Violations, simulatorViolations, attributionViolations };

// ---------------------------------------------------------------------------------------------------------------
// The shipped tree.
// ---------------------------------------------------------------------------------------------------------------
test('0135 directly follows 0134, is the only 0135, and is forward-only', () => {
  const names = readdirSync(new URL('database/migrations/', rootUrl)).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(names[names.indexOf('0134_understanding_integrity_v1.sql') + 1], '0135_ai_usage_cost_credit_ledger_v1.sql');
  assert.equal(names.filter((name) => name.startsWith('0135_')).length, 1);
  assert.match(src.migration, /^-- AI-COST-01/u);
  assert.match(src.migration, /^BEGIN;$/mu);
  assert.match(src.migration, /COMMIT;\s*$/u);
  assert.doesNotMatch(sql(src.migration), /CREATE OR REPLACE|ALTER TABLE public\.(?!ai_)|DROP /u, 'nothing earlier is redefined or dropped');
});

test('the provider-call census is complete: every production provider transport is listed, and the frozen adapters are byte-identical', () => {
  const production = listFiles(join(rootPath, 'apps/api/src'))
    .map((file) => file.slice(rootPath.length).replace(/\\/gu, '/').replace(/^\//u, ''))
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .filter((file) => PROVIDER_TRANSPORT.test(ts(read(file))));
  assert.deepEqual(production.sort(), CENSUS.map((entry) => entry.transport).sort(), 'no production provider transport exists outside the census');
  for (const entry of CENSUS.filter((e) => e.frozen)) assert.equal(gitBlobId(read(entry.transport)), entry.frozen, `${entry.transport} is unchanged`);
  // Health probes reach no provider; the operator-only evaluation harness is not production and is not imported by it.
  for (const file of listFiles(join(rootPath, 'apps/api/src/health'))) assert.doesNotMatch(read(file.slice(rootPath.length).replace(/\\/gu, '/').replace(/^\//u, '')), PROVIDER_TRANSPORT);
  const importsBrainEval = listFiles(join(rootPath, 'apps/api/src')).map((file) => file.slice(rootPath.length).replace(/\\/gu, '/').replace(/^\//u, ''))
    .filter((file) => !file.includes('/brain-eval/') && /from '[^']*brain-eval/u.test(read(file)));
  assert.deepEqual(importsBrainEval, [], 'nothing in production imports the evaluation harness');
  assert.deepEqual(censusViolations(src), []);
});

test('the shipped tree is clean under every detector', () => {
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(src), [], name);
});

// ---------------------------------------------------------------------------------------------------------------
// The planted defects of §21. Each must be caught by its named detector.
// ---------------------------------------------------------------------------------------------------------------
const PLANTED = [
  ['1 Credits equated to tokens', 'creditViolations', () => plant('simulation', "credits: creditsForRatedCost(ratedCost, policy) }", "credits: String(breakdown.reduce((total, item) => total + item.quantity, 0)) }")],
  ['1b the Credit formula is not a function of rated cost', 'creditViolations', () => plant('migration', 'v_raw := p_rated_amount * p_credits_per_cost_unit;', 'v_raw := p_credits_per_cost_unit;')],
  ['2 Credits equated directly to USD', 'creditViolations', () => plant('types', "export const CREDIT_POLICY_NOT_ACTIVATED = 'CREDIT_POLICY_NOT_ACTIVATED';", "export const CREDIT_POLICY_NOT_ACTIVATED = 'CREDIT_POLICY_NOT_ACTIVATED';\nexport const CREDITS_PER_USD = 'USD';")],
  ['3 hard-coded provider pricing (migration)', 'pricingViolations', () => plant('migration', '-- 6. Integrity triggers.', "INSERT INTO public.ai_price_cards (card_class) VALUES ('PRODUCTION');\n-- 6. Integrity triggers.")],
  ['3b hard-coded provider pricing (code)', 'pricingViolations', () => plant('simulation', 'const BASIS_EXPONENT', "const DEFAULT_PRICE = { unitPrice: '0.15' };\nconst BASIS_EXPONENT")],
  ['4 a price update rewrites old cost', 'pricingViolations', () => plant('migration', "RAISE EXCEPTION 'AI_PRICE_CARD_WINDOW_IN_USE' USING ERRCODE = '55000';", 'NULL;')],
  ['4b price-card mismatch uses today\'s price', 'pricingViolations', () => plant('migration', 'AND q.usage_kind = u.usage_kind AND q.effective_from <= c.started_at\n           AND (q.effective_to IS NULL OR c.started_at < q.effective_to)) p ON true', 'AND q.usage_kind = u.usage_kind AND q.effective_from <= clock_timestamp()\n           AND (q.effective_to IS NULL OR clock_timestamp() < q.effective_to)) p ON true')],
  ['5 JS float used for money', 'arithmeticViolations', () => plant('simulation', 'return shiftExact(multiplyExact(exactInteger(quantity), parseExactDecimal(unitPrice)), exponent);', 'return parseExactDecimal(String(quantity * Number(unitPrice) / 1_000_000));')],
  ['6 missing usage treated as zero', 'unknownViolations', () => plant('normalization', 'const input = count(usage.input_tokens);', 'const input = count(usage.input_tokens) ?? 0;')],
  ['6b missing cache fields assumed uncached', 'unknownViolations', () => plant('normalization', 'const cacheWrite = count(details?.cache_write_tokens);', 'const cacheWrite = count(details?.cache_write_tokens) ?? 0;')],
  ['6c the router fabricates zero tokens', 'unknownViolations', () => plant('openaiRouter', 'inputTokens: response.usage?.input_tokens ?? null,', 'inputTokens: response.usage?.input_tokens ?? 0,')],
  ['7 missing rate treated as zero', 'unknownViolations', () => plant('migration', "IF v_unpriced > 0 THEN\n      v_state := 'UNPRICED'; v_reason := 'NO_EFFECTIVE_PRICE_CARD';", "IF false THEN\n      v_state := 'UNPRICED'; v_reason := 'NO_EFFECTIVE_PRICE_CARD';")],
  ['8 success without usage treated as free', 'unknownViolations', () => plant('accounting', '} catch {\n      usage = ABSENT_AI_USAGE;\n    }', "} catch {\n      usage = { completeness: 'COMPLETE', quantities: {} };\n    }")],
  ['9 failure treated as free without evidence', 'unknownViolations', () => plant('accounting', "await settle('FAILED', ABSENT_AI_USAGE);\n      throw error;", "await settle('FAILED', { completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 0, OUTPUT_TOKEN: 0 } });\n      throw error;")],
  ['10 provider call starts before durable intent', 'boundaryViolations', () => plant('accounting', 'const correlation = safely(this.correlation);', 'const early = await invoke();\n    void early;\n    const correlation = safely(this.correlation);')],
  ['11 a retry shares one call id', 'boundaryViolations', () => plant('accounting', 'const callId = this.newCallId();', 'const callId = this.callId;')],
  ['12 a replay creates a duplicate charge', 'boundaryViolations', () => plant('migration', "RAISE EXCEPTION 'AI_PROVIDER_CALL_SETTLEMENT_CONFLICT' USING ERRCODE = 'PT409';", 'NULL;')],
  ['13 user content stored in the cost ledger', 'privacyViolations', () => plant('migration', '  source_turn_id uuid,\n  provider text NOT NULL,', '  source_turn_id uuid,\n  prompt_text text,\n  provider text NOT NULL,')],
  ['14 raw provider JSON stored as accounting authority', 'privacyViolations', () => plant('migration', '  quantity bigint NOT NULL,\n  PRIMARY KEY (provider_call_id, usage_kind),', '  quantity bigint NOT NULL,\n  provider_usage jsonb,\n  PRIMARY KEY (provider_call_id, usage_kind),')],
  ['14b the ledger sends the raw response', 'privacyViolations', () => plant('ledger', 'p_outcome: record.outcome,', 'p_outcome: record.outcome,\n      p_raw_response: record,')],
  ['15 user id emitted as a telemetry label', 'telemetryViolations', () => plant('telemetry', "this.aiUsageAccounting.add?.(1,{stage,outcome,policy_version:AI_USAGE_POLICY_VERSION});", "this.aiUsageAccounting.add?.(1,{stage,outcome,user_id:stage,policy_version:AI_USAGE_POLICY_VERSION});")],
  ['16 price-card intervals overlap', 'pricingViolations', () => plant('migration', "RAISE EXCEPTION 'AI_PRICE_CARD_OVERLAP' USING ERRCODE = '23P01';", 'NULL;')],
  ['17 provider identity supplied by a client body', 'authorityViolations', () => plant('clients', "{ provider: 'OPENAI', requestedModel: modelOf(body), featureFamily }", "{ provider: (body as { provider: 'OPENAI' }).provider, requestedModel: modelOf(body), featureFamily }")],
  ['17b the turn body may carry a model', 'authorityViolations', () => plant('conversationService', "const allowed = new Set(['content', 'idempotencyKey']);", "const allowed = new Set(['content', 'idempotencyKey', 'model']);")],
  ['18 an authenticated client can modify price cards', 'authorityViolations', () => plant('migration', '\nCOMMIT;', '\nGRANT EXECUTE ON FUNCTION public.register_ai_price_card_v1(text, text, text, text, text, numeric, bigint, text, timestamptz, text) TO authenticated;\nCOMMIT;')],
  ['19 an authenticated client can write provider usage', 'authorityViolations', () => plant('migration', '\nCOMMIT;', '\nGRANT EXECUTE ON FUNCTION public.settle_ai_provider_call_v1(uuid, uuid, text, text, jsonb) TO authenticated;\nCOMMIT;')],
  ['20 a Credit Policy can be activated without a Product-authorized path', 'creditViolations', () => plant('migration', "CHECK (lifecycle IN ('DRAFT'))", "CHECK (lifecycle IN ('DRAFT', 'ACTIVE'))")],
  ['21 a production fake / test price card is active', 'pricingViolations', () => plant('migration', "  CONSTRAINT ai_price_cards_test_isolation_check CHECK ((card_class = 'TEST_ONLY') = (provider = 'TEST_PROVIDER')),\n", '')],
  ['22 no policy turns into zero Credits', 'creditViolations', () => plant('simulation', "!policy\n    ? { state: 'CREDIT_POLICY_NOT_SUPPLIED' }", "!policy\n    ? { state: 'SIMULATED', policyKey: '', policyVersion: 0, credits: '0' }")],
  ['23 PROD-SEC-02 limits weakened', 'prodSec02Violations', () => plant('migration0131', 'SELECT 1, 2, interval', 'SELECT 9, 9, interval')],
  ['23b a reply router loses its deadline guard', 'prodSec02Violations', () => plant('openaiRouter', '    assertForegroundProviderBudget();\n', '\n')],
  ['24 account deletion leaves directly linked orphan cost rows', 'deletionViolations', () => plant('migration', 'user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,', 'user_id uuid NOT NULL,')],
  ['24b an accounting guard blocks the erasure cascade', 'deletionViolations', () => plant('migration', "  IF TG_OP = 'DELETE' AND pg_catalog.pg_trigger_depth() > 1 THEN RETURN OLD; END IF;\n", '')],
  ['25 an accounting failure silently allows untracked provider calls', 'boundaryViolations', () => plant('accounting', "      this.signal('begin', 'failure');\n      throw new AiProviderCallAccountingUnavailableError();", "      this.signal('begin', 'failure');\n      return invoke();")],
  ['25b an unattributed call proceeds', 'boundaryViolations', () => plant('accounting', "      this.signal('begin', 'unattributed');\n      throw new AiProviderCallAccountingUnavailableError();", "      this.signal('begin', 'unattributed');\n      return invoke();")],
  ['26 the simulator mutates a live balance', 'simulatorViolations', () => plant('simulation', "} from './exact-decimal';", "} from './exact-decimal';\nimport { SupabaseAiProviderCallLedger } from './ai-provider-call-ledger.repository';")],
  ['27 historical Credit ratings rewritten after a policy change', 'creditViolations', () => plant('migration', 'CREATE TRIGGER reject_ai_credit_rating_mutation_v1 BEFORE UPDATE OR DELETE ON public.ai_credit_ratings', 'CREATE TRIGGER reject_ai_credit_rating_mutation_v1 BEFORE DELETE ON public.ai_credit_ratings')],
  ['28 the cost ledger accepts prompt / response text', 'privacyViolations', () => plant('migration', 'p_call_id uuid, p_user_id uuid, p_outcome text, p_usage_completeness text, p_usage jsonb\n)', 'p_call_id uuid, p_user_id uuid, p_outcome text, p_usage_completeness text, p_usage jsonb, p_response_text text\n)')],
  ['census: a new production provider path bypasses the boundary', 'censusViolations', () => plant('associationModule', "accountedGeminiTransport(\n    (url, init) => fetch(url, init), config.model, 'HYPOTHESIS_EVIDENCE_ASSOCIATION', productionAiProviderCallAccounting())", '(url, init) => fetch(url, init)')],
  ['census: a semantic binding is composed unaccounted', 'censusViolations', () => plant('conversationModule', "openAiFocusResolutionBinding(process.env, costLedgerDecorator('FOCUS_RESOLUTION'))", 'openAiFocusResolutionBinding()')],
  ['ops: a failed operations scan is swallowed by a silent catch', 'operationsScanViolations', () => plant('worker', "} catch (error) {\n        this.signal(classifyOperationalFailure(error) === 'TRANSPORT' ? 'transport_failure' : 'integrity_failure');\n        return;\n      }", '} catch {\n        return;\n      }')],
  ['ops: a silent outer catch {} returns around the scan', 'operationsScanViolations', () => plant('worker', '    } finally {\n      this.running = false;', '    } catch {\n      // retried on the next cycle\n    } finally {\n      this.running = false;')],
  ['ops: error text reaches the operations signal', 'operationsScanViolations', () => plant('worker', "this.signal(classifyOperationalFailure(error) === 'TRANSPORT' ? 'transport_failure' : 'integrity_failure');", 'this.signal((error as Error).message as never);')],
  ['ops: a successful scan emits no success outcome', 'operationsScanViolations', () => plant('worker', "      this.signal('success');\n", '')],
  ['ops: the gauges escape the fail-soft wrapper', 'operationsScanViolations', () => plant('worker', 'this.quietly(() => {\n        const t = this.telemetry;', '(() => {\n        const t = this.telemetry;')],
  ['ops: the operations signal is not fail-soft', 'operationsScanViolations', () => plant('worker', 'this.quietly(() => this.telemetry.recordOperationalOutcome(', '(() => this.telemetry.recordOperationalOutcome(')],
  ['ops: the registry drops the operations scan', 'operationsScanViolations', () => plant('telemetry', " ['AI_USAGE_ACCOUNTING',new Map([['operations_scan',new Set(['success',...OPERATION_FAILURES])]])],\n", '')],
  ['attribution: the foreground request is unattributed', 'attributionViolations', () => plant('conversationService', 'return runWithAiUsageAttribution({ userId }, () =>\n      runForegroundTurnWork(', 'return (() =>\n      runForegroundTurnWork(')],
];

for (const [name, detector, world] of PLANTED) {
  test(`planted defect is rejected: ${name}`, () => {
    assert.ok(DETECTORS[detector], `${detector} exists`);
    assert.notDeepEqual(DETECTORS[detector](world()), [], `${detector} must reject: ${name}`);
  });
}

test('the contract, the verifier and the simulator are registered', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['verify:ai-usage-cost-ledger:integration'], 'node --env-file-if-exists=.env database/verify-migration-0135.mjs');
  assert.equal(pkg.scripts['test:ai-cost-01-provider-neutral-cost-credit-ledger-contract'], 'node --test tests/ai-cost-01-provider-neutral-cost-credit-ledger-contract.test.mjs');
  assert.equal(pkg.scripts['simulate:ai-cost'], 'node scripts/ai-cost-simulate.mjs');
  const ci = read('.github/workflows/api-ci.yml');
  assert.ok(ci.indexOf('npm run verify:understanding-integrity:integration') < ci.indexOf('npm run verify:ai-usage-cost-ledger:integration'), 'the 0135 verifier runs after the 0134 one');
  assert.ok(ci.includes('npm run test:ai-cost-01-provider-neutral-cost-credit-ledger-contract'));
  assert.match(read('database/verify-migration-0135.mjs'), /apps\/api\/dist\/ai-usage\/ai-cost-simulation\.js/u, 'the verifier proves the simulator against the database');
  assert.ok(PLANTED.length >= 28);
});
