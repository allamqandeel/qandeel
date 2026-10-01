import { Injectable } from '@nestjs/common';
import { metrics,SpanStatusCode,trace,type Attributes,type Span,type Tracer } from '@opentelemetry/api';
import { CorrelationService } from './correlation.service';
import{RUNTIME_ROUTING_MAX_COMPLEXITY_SCORE,RUNTIME_ROUTING_MIN_COMPLEXITY_SCORE,RUNTIME_ROUTING_POLICY_VERSION,isLegalCurrentRoutePair,isRuntimeRoutingPath,type RuntimeRoutingDecision}from'../intelligence-runtime/fast-deep-routing-contract';
import{POST_RESPONSE_PROVIDER_BUDGET_DECISION_KEYS,POST_RESPONSE_PROVIDER_BUDGET_POLICY_VERSION,POST_RESPONSE_PROVIDER_EFFECT_KEYS}from'../post-response-intelligence/post-response-provider-budget';
import{AI_FEATURE_FAMILIES,AI_PROVIDERS,AI_USAGE_KINDS,type NormalizedAiUsage}from'../ai-usage/ai-usage.types';

type Usage={inputTokens:number;outputTokens:number};
type Instrument={add?:(value:number,attributes?:Attributes)=>void;record?:(value:number,attributes?:Attributes)=>void};

// QIR-003: the finite label registries for the bounded foreground intelligence
// source-outcome metric. Anything outside these exact sets is DROPPED rather
// than emitted, so cardinality is bounded by construction and no user content,
// memory/hypothesis content, identifier, token, exception text, database
// error identity, or vendor/model identity can ever become a label.
const FOREGROUND_INTELLIGENCE_SOURCES:ReadonlySet<string>=new Set(['MEMORY','HYPOTHESIS']);
const FOREGROUND_INTELLIGENCE_SOURCE_OUTCOMES:ReadonlySet<string>=new Set(['AVAILABLE','LEGITIMATE_EMPTY','OPTIONAL_AVAILABILITY_FAILURE','FOREGROUND_BUDGET_EXPIRY','HARD_FAILURE']);
const FOREGROUND_INTELLIGENCE_POLICY_VERSION='1';

// QIR-004: the finite label registries for the integrated context budget
// metrics. Anything outside these exact sets is DROPPED rather than emitted, so
// cardinality is bounded by construction and no user content, Memory content,
// Hypothesis text, Recommendation data, Human Intelligence value, identifier,
// exception text, provider/model identity, raw JSON or free-text source name
// can ever become a label. Numeric byte counts are metric VALUES only.
const CONTEXT_BUDGET_SOURCES:ReadonlySet<string>=new Set(['HISTORY','MEMORY','HUMAN_INTELLIGENCE','HYPOTHESIS_RECOMMENDATION','QUESTION']);
const CONTEXT_BUDGET_OUTCOMES:ReadonlySet<string>=new Set(['NOT_PRESENT','INCLUDED_FULL','PARTIALLY_RETAINED','OMITTED_BUDGET']);
const CONTEXT_BUDGET_COMPONENTS:ReadonlySet<string>=new Set(['MANDATORY_CORE','HISTORY','MEMORY','HUMAN_INTELLIGENCE','HYPOTHESIS_RECOMMENDATION','QUESTION','FINAL_TOTAL']);
const CONTEXT_BUDGET_MEASUREMENTS:ReadonlySet<string>=new Set(['OFFERED','RETAINED','FINAL']);
// QIR-004 Fix 01: the finite LEGAL SOURCE/OUTCOME RELATION.
//
// The two flat registries above bound the label VOCABULARY; this relation
// bounds which COMBINATIONS can exist at all. Validating source and outcome
// independently would let an impossible cross-product be emitted and thereby
// canonize a state QIR-004 v1 cannot produce.
//
// History and Memory are prefix-retainable, so PARTIALLY_RETAINED is legal for
// them. Human Intelligence, the Hypothesis+Recommendation package, and the
// QIR-006 Question package are ATOMIC - the whole source or none of it - so
// PARTIALLY_RETAINED is IMPOSSIBLE for them and is DROPPED rather than
// emitted. Exactly 17 legal pairs exist per processing path (4 + 4 + 3 + 3 + 3).
const CONTEXT_BUDGET_LEGAL_SOURCE_OUTCOMES:ReadonlyMap<string,ReadonlySet<string>>=new Map([
 ['HISTORY',new Set(['NOT_PRESENT','INCLUDED_FULL','PARTIALLY_RETAINED','OMITTED_BUDGET'])],
 ['MEMORY',new Set(['NOT_PRESENT','INCLUDED_FULL','PARTIALLY_RETAINED','OMITTED_BUDGET'])],
 ['HUMAN_INTELLIGENCE',new Set(['NOT_PRESENT','INCLUDED_FULL','OMITTED_BUDGET'])],
 ['HYPOTHESIS_RECOMMENDATION',new Set(['NOT_PRESENT','INCLUDED_FULL','OMITTED_BUDGET'])],
 ['QUESTION',new Set(['NOT_PRESENT','INCLUDED_FULL','OMITTED_BUDGET'])],
]);
const CONTEXT_BUDGET_POLICY_VERSION='1';

// QIR-006: the finite label registries for the bounded foreground formal
// Question selection metric. Anything outside these exact sets is DROPPED
// rather than emitted, so cardinality is bounded by construction and no gap
// id, hypothesis id, confidence id, missing-information code, question
// objective, user content, database error string, or provider/model identity
// can ever become a label.
const QUESTION_FOREGROUND_OUTCOMES:ReadonlySet<string>=new Set(['SELECTED','LEGITIMATE_EMPTY','OPTIONAL_AVAILABILITY_FAILURE','FOREGROUND_BUDGET_EXPIRY','HARD_FAILURE']);
const QUESTION_FOREGROUND_EMPTY_REASONS:ReadonlySet<string>=new Set(['NO_ELIGIBLE_GAP','OUTSTANDING_OPEN_QUESTION']);
const QUESTION_FOREGROUND_POLICY_VERSION='1';

// PROD-OPS-01: the finite LEGAL relation for background operational outcomes -
// domain -> operation -> outcome. A background pass that catches a failure and
// retries later must still be VISIBLE; these are the only combinations that can
// exist. Anything outside the relation is DROPPED rather than emitted, so no
// user, session, turn, deletion, export, hypothesis or evaluation identifier,
// exception text, SQL error, SQLSTATE, URL or body can ever become a label.
// Connected Worlds BLOCKED is `blocked_expected`, a legitimate answer and not an
// operational failure; a cancelled or not-yet-due request is `superseded_expected`.
const OPERATION_FAILURES=['transport_failure','integrity_failure'] as const;
const OPERATIONAL_OUTCOMES:ReadonlyMap<string,ReadonlyMap<string,ReadonlySet<string>>>=new Map([
 ['PRIVACY_EXPORT',new Map([['prepare',new Set(['success',...OPERATION_FAILURES])],['stuck_scan',new Set(['success',...OPERATION_FAILURES])]])],
 ['ACCOUNT_DELETION',new Map([['claim',new Set(['success',...OPERATION_FAILURES])],['erase',new Set(['success','blocked_expected','superseded_expected',...OPERATION_FAILURES])],['provider_remove',new Set(['success','provider_unavailable'])],['complete',new Set(['success',...OPERATION_FAILURES])],['stuck_scan',new Set(['success',...OPERATION_FAILURES])]])],
 ['UNDERSTANDING_CONFIDENCE',new Map([['confidence_reevaluate',new Set(['success','retry_pending'])]])],
 // AI-COST-01: the accounting ledger's own health scan (migration 0135 operations summary).
 ['AI_USAGE_ACCOUNTING',new Map([['operations_scan',new Set(['success',...OPERATION_FAILURES])]])],
]);
// The bounded class of a retry_pending outcome, attached to it and to nothing else.
const OPERATIONAL_FAILURE_CLASSES:ReadonlySet<string>=new Set(['TRANSPORT','INTEGRITY']);
// PROD-OPS-01 aggregate privacy / export state, from the service-role-only
// summary of migration 0132: domain -> state -> whether an oldest age exists.
// Counts and ages are metric VALUES, never labels.
const PRIVACY_OPERATION_STATES:ReadonlyMap<string,ReadonlyMap<string,boolean>>=new Map([
 ['PRIVACY_EXPORT',new Map([['preparing',false],['retrying',false],['stuck_preparing',true],['failed_total',false],['failed_recent',false]])],
 ['ACCOUNT_DELETION',new Map([['stuck_due',true],['stuck_provider_pending',true]])],
]);
const PRIVACY_EXPORT_FAILURE_CLASSES:ReadonlySet<string>=new Set(['TRANSIENT_DATABASE','CONSTRAINT_OR_INTEGRITY','RESOURCE_OR_CAPACITY','INTERNAL_OTHER']);
const OPERATIONS_POLICY_VERSION='1';
// AI-COST-01: the finite label registries of provider-call accounting. The DB ledger (migration 0135) is the
// accounting authority; these are observability only. Provider, feature family, outcome, completeness and usage kind
// are closed registries - never a user, session, turn or call id, a model string, a price, a payload or an error.
// Token quantities are metric VALUES, never labels.
const AI_USAGE_PROVIDERS:ReadonlySet<string>=new Set(AI_PROVIDERS);
const AI_USAGE_FEATURE_FAMILIES:ReadonlySet<string>=new Set(AI_FEATURE_FAMILIES);
const AI_USAGE_KIND_LABELS:ReadonlySet<string>=new Set(AI_USAGE_KINDS);
const AI_USAGE_OUTCOMES:ReadonlySet<string>=new Set(['SUCCEEDED','FAILED','CANCELLED_BEFORE_PROVIDER']);
const AI_USAGE_ACCOUNTING_OUTCOMES:ReadonlyMap<string,ReadonlySet<string>>=new Map([['begin',new Set(['success','failure','unattributed'])],['settle',new Set(['success','failure'])]]);
// The aggregate accounting state from migration 0135's service-role summary: state -> whether an oldest age exists.
const AI_USAGE_OPERATION_STATES:ReadonlyMap<string,boolean>=new Map([['pending',false],['stale_pending',true],['settled_24h',false],['failed_24h',false],['cancelled_24h',false],['usage_unknown_24h',false],['rated_24h',false],['unpriced_24h',false]]);
const AI_USAGE_POLICY_VERSION='1';

@Injectable()
export class TelemetryService{
 private readonly postResponseDispatchOperations:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createCounter('qandeel.post_response_dispatch.operations'),{});
 private readonly routingDecisions:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createCounter('qandeel.routing.decisions'),{});
 private readonly foregroundIntelligenceSourceOutcomes:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createCounter('qandeel.foreground.intelligence.source'),{});
 private readonly contextBudgetSourceDecisions:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createCounter('qandeel.context_budget.source_decisions'),{});
 private readonly questionForegroundSelections:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createCounter('qandeel.question.foreground_selection'),{});
 private readonly contextBudgetBytes:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createHistogram('qandeel.context_budget.bytes',{unit:'By'}),{});
 private readonly postResponseProviderBudgetDecisions:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createCounter('qandeel.post_response.provider_budget'),{});
 private readonly operationalOutcomes:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createCounter('qandeel.operations.outcomes'),{});
 private readonly privacyOperationStateCounts:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createGauge('qandeel.operations.privacy.state_count'),{});
 private readonly privacyOperationOldestAges:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createGauge('qandeel.operations.privacy.oldest_age',{unit:'s'}),{});
 private readonly privacyExportRecentFailures:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createGauge('qandeel.operations.privacy_export.recent_failures'),{});
 private readonly aiUsageAccounting:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createCounter('qandeel.ai_usage.accounting'),{});
 private readonly aiUsageProviderCalls:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createCounter('qandeel.ai_usage.provider_calls'),{});
 private readonly aiUsageTokens:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createCounter('qandeel.ai_usage.tokens',{unit:'{token}'}),{});
 private readonly aiUsageOperationStateCounts:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createGauge('qandeel.ai_usage.operations.state_count'),{});
 private readonly aiUsageOperationOldestAges:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createGauge('qandeel.ai_usage.operations.oldest_age',{unit:'s'}),{});
 private readonly tracer:Tracer;private readonly engineDuration:Instrument;private readonly providerDuration:Instrument;private readonly providerCalls:Instrument;private readonly providerErrors:Instrument;private readonly inputTokens:Instrument;private readonly outputTokens:Instrument;private readonly turnOutcomes:Instrument;private readonly publisherOperations:Instrument;private readonly hypothesisContextOutcomes:Instrument;private readonly hypothesisEligibilityOutcomes:Instrument;private readonly hypothesisIntentExtractionOutcomes:Instrument;private readonly hypothesisGenerationRequestAssemblyOutcomes:Instrument;private readonly controlledHypothesisGenerationOutcomes:Instrument;private readonly postGenerationConfidenceOutcomes:Instrument;
 constructor(private readonly correlation:CorrelationService){
  this.tracer=this.safe(()=>trace.getTracer('qandeel-api'),{startActiveSpan:(_name:string,_options:unknown,callback:(span:Span)=>unknown)=>callback(this.noopSpan())}as unknown as Tracer);
  const meter=this.safe(()=>metrics.getMeter('qandeel-api'),undefined);
  this.engineDuration=this.safe<Instrument|undefined>(()=>meter?.createHistogram('qandeel.engine.duration',{unit:'ms'}),undefined)??{};this.providerDuration=this.safe<Instrument|undefined>(()=>meter?.createHistogram('qandeel.provider.duration',{unit:'ms'}),undefined)??{};
  this.providerCalls=this.safe<Instrument|undefined>(()=>meter?.createCounter('qandeel.provider.calls'),undefined)??{};this.providerErrors=this.safe<Instrument|undefined>(()=>meter?.createCounter('qandeel.provider.errors'),undefined)??{};this.inputTokens=this.safe<Instrument|undefined>(()=>meter?.createCounter('qandeel.provider.input_tokens'),undefined)??{};this.outputTokens=this.safe<Instrument|undefined>(()=>meter?.createCounter('qandeel.provider.output_tokens'),undefined)??{};this.turnOutcomes=this.safe<Instrument|undefined>(()=>meter?.createCounter('qandeel.turn.outcomes'),undefined)??{};this.publisherOperations=this.safe<Instrument|undefined>(()=>meter?.createCounter('qandeel.runtime_event_publisher.operations'),undefined)??{};this.hypothesisContextOutcomes=this.safe<Instrument|undefined>(()=>meter?.createCounter('qandeel.hypothesis_context.outcomes'),undefined)??{};this.hypothesisEligibilityOutcomes=this.safe<Instrument|undefined>(()=>meter?.createCounter('qandeel.hypothesis_generation_eligibility.outcomes'),undefined)??{};this.hypothesisIntentExtractionOutcomes=this.safe<Instrument|undefined>(()=>meter?.createCounter('qandeel.hypothesis_intent_extraction.outcomes'),undefined)??{};this.hypothesisGenerationRequestAssemblyOutcomes=this.safe<Instrument|undefined>(()=>meter?.createCounter('qandeel.hypothesis_generation_request_assembly.outcomes'),undefined)??{};this.controlledHypothesisGenerationOutcomes=this.safe<Instrument|undefined>(()=>meter?.createCounter('qandeel.controlled_hypothesis_generation.outcomes'),undefined)??{};this.postGenerationConfidenceOutcomes=this.safe<Instrument|undefined>(()=>meter?.createCounter('qandeel.post_generation_confidence.outcomes'),undefined)??{};
 }
 withEngine<T>(engine:string,path:string|undefined,work:()=>Promise<T>|T):Promise<T>{return this.scoped(()=>this.correlation.withEngine(()=>this.span('qandeel.engine',{engine,processing_path:path},work)),work);}
 withProvider<T>(provider:string,model:string,path:string,timeout:number,work:()=>Promise<T>,usage?:(value:T)=>Usage|undefined):Promise<T>{return this.scoped(()=>this.correlation.withProvider(()=>this.providerSpan(provider,model,path,timeout,work,usage)),work);}
 recordTurnOutcome(outcome:string,path?:string):void{this.safeVoid(()=>this.turnOutcomes.add?.(1,{outcome,...(path?{processing_path:path}:{})}));}
 // QIR-002 routing decision. Four FINITE dimensions only - 2 paths x 5 reasons
 // x 1 policy version x 8 score values - so cardinality is bounded by
 // construction. No user content, normalized text, free text, identifier,
 // vendor/model name or unbounded count may ever become a label here: anything
 // that is not an exact legal current pair, the exact policy version, and an
 // integer score inside the bounded range is DROPPED rather than emitted. The
 // whole call is fail-soft and can never alter routing or the turn outcome.
 recordRoutingDecision(decision:RuntimeRoutingDecision):void{this.safeVoid(()=>{
  if(decision?.policyVersion!==RUNTIME_ROUTING_POLICY_VERSION)return;
  if(!isLegalCurrentRoutePair(decision.path,decision.reason))return;
  const score=decision.complexityScore;
  if(!Number.isInteger(score)||score<RUNTIME_ROUTING_MIN_COMPLEXITY_SCORE||score>RUNTIME_ROUTING_MAX_COMPLEXITY_SCORE)return;
  this.routingDecisions.add?.(1,{processing_path:decision.path,routing_reason:decision.reason,policy_version:String(RUNTIME_ROUTING_POLICY_VERSION),complexity_score:String(score)});
 });}
 // QIR-003 bounded foreground intelligence source outcome. Four FINITE
 // dimensions only - 2 sources x 5 outcomes x 2 paths x 1 policy version - so
 // cardinality is bounded by construction: any value outside the exact frozen
 // registries is DROPPED rather than emitted. The whole call is fail-soft and
 // can never alter a gather outcome or the turn.
 recordForegroundIntelligenceSource(source:'MEMORY'|'HYPOTHESIS',outcome:string,path:string):void{this.safeVoid(()=>{
  if(!FOREGROUND_INTELLIGENCE_SOURCES.has(source))return;
  if(!FOREGROUND_INTELLIGENCE_SOURCE_OUTCOMES.has(outcome))return;
  if(!isRuntimeRoutingPath(path))return;
  this.foregroundIntelligenceSourceOutcomes.add?.(1,{source,outcome,processing_path:path,policy_version:FOREGROUND_INTELLIGENCE_POLICY_VERSION});
 });}
 // QIR-004 integrated context budget source decision. Four FINITE dimensions
 // only, and validation is TOTAL over the source/outcome PAIR - 14 legal pairs
 // x 2 paths x 1 policy version - so cardinality is bounded by construction and
 // no impossible combination can ever be emitted. An unknown source, an unknown
 // outcome, an illegal source/outcome pair, or an unrecognized processing path
 // is DROPPED rather than emitted. The whole call is fail-soft and can never
 // alter a budget decision, the assembled request, or the turn.
 recordContextBudgetSourceDecision(source:string,outcome:string,path:string):void{this.safeVoid(()=>{
  if(!CONTEXT_BUDGET_SOURCES.has(source))return;
  if(!CONTEXT_BUDGET_OUTCOMES.has(outcome))return;
  if(!CONTEXT_BUDGET_LEGAL_SOURCE_OUTCOMES.get(source)?.has(outcome))return;
  if(!isRuntimeRoutingPath(path))return;
  this.contextBudgetSourceDecisions.add?.(1,{source,outcome,processing_path:path,policy_version:CONTEXT_BUDGET_POLICY_VERSION});
 });}
 // QIR-004 integrated context budget byte measurement. The numeric byte count
 // is the histogram VALUE and is never encoded as a label; the four label
 // dimensions are finite - 6 components x 3 measurements x 2 paths x 1 policy
 // version. A non-finite, negative or non-integer measurement is DROPPED.
 recordContextBudgetBytes(component:string,measurement:string,path:string,bytes:number):void{this.safeVoid(()=>{
  if(!CONTEXT_BUDGET_COMPONENTS.has(component))return;
  if(!CONTEXT_BUDGET_MEASUREMENTS.has(measurement))return;
  if(!isRuntimeRoutingPath(path))return;
  if(!Number.isSafeInteger(bytes)||bytes<0)return;
  this.contextBudgetBytes.record?.(bytes,{component,measurement,processing_path:path,policy_version:CONTEXT_BUDGET_POLICY_VERSION});
 });}
 // QIR-006 bounded foreground formal Question selection outcome. At most four
 // FINITE dimensions - 5 outcomes x 2 paths x 1 policy version, plus a bounded
 // empty reason attached ONLY to the LEGITIMATE_EMPTY outcome - so cardinality
 // is bounded by construction: any value outside the exact frozen registries
 // is DROPPED rather than emitted, and an empty reason supplied with any other
 // outcome drops the whole emission as an impossible combination. The whole
 // call is fail-soft and can never alter a selection outcome or the turn.
 recordQuestionForegroundSelection(outcome:string,path:string,emptyReason?:string):void{this.safeVoid(()=>{
  if(!QUESTION_FOREGROUND_OUTCOMES.has(outcome))return;
  if(!isRuntimeRoutingPath(path))return;
  if(emptyReason!==undefined&&(outcome!=='LEGITIMATE_EMPTY'||!QUESTION_FOREGROUND_EMPTY_REASONS.has(emptyReason)))return;
  if(outcome==='LEGITIMATE_EMPTY'&&emptyReason===undefined)return;
  this.questionForegroundSelections.add?.(1,{outcome,processing_path:path,policy_version:QUESTION_FOREGROUND_POLICY_VERSION,...(emptyReason!==undefined?{empty_reason:emptyReason}:{})});
 });}
 // QIR-005 post-response provider-budget decision. Four FINITE dimensions only
 // - 3 provider-backed effects x 3 decisions x 2 paths x 1 policy version - and
 // the effect and decision registries are the SAME frozen QIR-005 registries the
 // production gate uses, so a fourth provider-backed effect or an invented
 // decision cannot be emitted even by accident. No execution id, session id,
 // turn id, user id, Evidence/Hypothesis id, effect result payload, user text,
 // error text, provider/vendor/model name, token or secret can ever become a
 // label here, and no numeric slot count is encoded as one. AUTHORIZED is
 // emitted only after a slot was actually spent by a successful durable claim;
 // EXHAUSTED is emitted before any provider transport. The whole call is
 // fail-soft and can never alter a budget decision, a claim, or the execution.
 recordPostResponseProviderBudget(effect:string,decision:string,path:string|null):void{this.safeVoid(()=>{
  if(!POST_RESPONSE_PROVIDER_EFFECT_KEYS.has(effect))return;
  if(!POST_RESPONSE_PROVIDER_BUDGET_DECISION_KEYS.has(decision))return;
  if(typeof path!=='string'||!isRuntimeRoutingPath(path))return;
  this.postResponseProviderBudgetDecisions.add?.(1,{effect,decision,processing_path:path,policy_version:POST_RESPONSE_PROVIDER_BUDGET_POLICY_VERSION});
 });}
 // PROD-OPS-01 background operational outcome. At most four FINITE dimensions -
 // the legal domain/operation/outcome relation above, one policy version, and a
 // bounded failure class attached ONLY to retry_pending (and required there).
 // Anything else is DROPPED. The whole call is fail-soft: it never throws and
 // never alters a deletion, an export or an Understanding answer.
 recordOperationalOutcome(domain:string,operation:string,outcome:string,failureClass?:string):void{this.safeVoid(()=>{
  if(!OPERATIONAL_OUTCOMES.get(domain)?.get(operation)?.has(outcome))return;
  if(outcome==='retry_pending'?failureClass===undefined||!OPERATIONAL_FAILURE_CLASSES.has(failureClass):failureClass!==undefined)return;
  this.operationalOutcomes.add?.(1,{domain,operation,outcome,policy_version:OPERATIONS_POLICY_VERSION,...(failureClass!==undefined?{failure_class:failureClass}:{})});
 });}
 // PROD-OPS-01 aggregate privacy / export state. The count (and, for a stuck
 // state, the oldest age in whole seconds) are gauge VALUES; the labels are the
 // legal domain/state pair and the policy version. An illegal pair, a negative,
 // fractional or unsafe number, or an age offered for a state without one is
 // DROPPED. Fail-soft.
 recordPrivacyOperationState(domain:string,state:string,count:number,oldestAgeSeconds?:number):void{this.safeVoid(()=>{
  const hasAge=PRIVACY_OPERATION_STATES.get(domain)?.get(state);
  if(hasAge===undefined||!Number.isSafeInteger(count)||count<0)return;
  if(hasAge?!Number.isSafeInteger(oldestAgeSeconds)||(oldestAgeSeconds as number)<0:oldestAgeSeconds!==undefined)return;
  const labels={domain,state,policy_version:OPERATIONS_POLICY_VERSION};
  this.privacyOperationStateCounts.record?.(count,labels);
  if(hasAge)this.privacyOperationOldestAges.record?.(oldestAgeSeconds as number,labels);
 });}
 // PROD-OPS-01 recent export preparation failures by the closed class migration
 // 0132 records. The count is the VALUE; the class is one of four. Fail-soft.
 recordPrivacyExportRecentFailures(failureClass:string,count:number):void{this.safeVoid(()=>{
  if(!PRIVACY_EXPORT_FAILURE_CLASSES.has(failureClass)||!Number.isSafeInteger(count)||count<0)return;
  this.privacyExportRecentFailures.record?.(count,{failure_class:failureClass,policy_version:OPERATIONS_POLICY_VERSION});
 });}
 // AI-COST-01 accounting boundary outcome: begin (success | failure | unattributed) and settle (success | failure).
 // A settle failure leaves the call PENDING in the ledger, where the stale summary finds it. Fail-soft.
 recordAiProviderCallAccounting(stage:string,outcome:string):void{this.safeVoid(()=>{
  if(!AI_USAGE_ACCOUNTING_OUTCOMES.get(stage)?.has(outcome))return;
  this.aiUsageAccounting.add?.(1,{stage,outcome,policy_version:AI_USAGE_POLICY_VERSION});
 });}
 // AI-COST-01 one settled provider attempt: a call count by provider / feature / outcome / usage completeness, and the
 // reported quantity of each normalized kind as the VALUE of a token counter. An unreported kind emits nothing - never
 // a zero. Anything outside the registries is DROPPED. Fail-soft.
 recordAiProviderCallSettlement(provider:string,featureFamily:string,outcome:string,usage:NormalizedAiUsage):void{this.safeVoid(()=>{
  if(!AI_USAGE_PROVIDERS.has(provider)||!AI_USAGE_FEATURE_FAMILIES.has(featureFamily)||!AI_USAGE_OUTCOMES.has(outcome))return;
  if(usage?.completeness!=='COMPLETE'&&usage?.completeness!=='INCOMPLETE'&&usage?.completeness!=='ABSENT')return;
  this.aiUsageProviderCalls.add?.(1,{provider,feature_family:featureFamily,outcome,usage_completeness:usage.completeness,policy_version:AI_USAGE_POLICY_VERSION});
  if(usage.completeness==='ABSENT')return;
  for(const[kind,quantity]of Object.entries(usage.quantities)){
   if(!AI_USAGE_KIND_LABELS.has(kind)||!Number.isSafeInteger(quantity)||(quantity as number)<0)continue;
   this.aiUsageTokens.add?.(quantity as number,{provider,feature_family:featureFamily,usage_kind:kind,policy_version:AI_USAGE_POLICY_VERSION});
  }
 });}
 // AI-COST-01 aggregate accounting state (migration 0135 summary): the count, and for stale_pending the oldest age in
 // whole seconds, are gauge VALUES. An unknown state, a bad number or an age offered for a state without one is DROPPED.
 recordAiUsageOperationsState(state:string,count:number,oldestAgeSeconds?:number):void{this.safeVoid(()=>{
  const hasAge=AI_USAGE_OPERATION_STATES.get(state);
  if(hasAge===undefined||!Number.isSafeInteger(count)||count<0)return;
  if(hasAge?!Number.isSafeInteger(oldestAgeSeconds)||(oldestAgeSeconds as number)<0:oldestAgeSeconds!==undefined)return;
  const labels={state,policy_version:AI_USAGE_POLICY_VERSION};
  this.aiUsageOperationStateCounts.record?.(count,labels);
  if(hasAge)this.aiUsageOperationOldestAges.record?.(oldestAgeSeconds as number,labels);
 });}
 recordHypothesisContext(outcome:'available'|'consumed'|'empty'|'rejected'|'failed',path:string,contractVersion=1,_candidateCount?:number,_includedCount?:number):void{this.safeVoid(()=>this.hypothesisContextOutcomes.add?.(1,{outcome,processing_path:path,contract_version:String(contractVersion)}));}
 recordHypothesisGenerationEligibility(outcome:'eligible'|'not_eligible'|'ambiguous'|'safety_ineligible'|'no_evidence'|'replay_skipped'|'failed',path?:string):void{this.safeVoid(()=>this.hypothesisEligibilityOutcomes.add?.(1,{outcome,...(path?{processing_path:path}:{}),contract_version:'1'}));}
 recordHypothesisIntentExtraction(outcome:'authorized'|'authority_rejected'|'provider_unavailable'|'provider_timeout'|'invalid_provider_output'|'provider_failed'|'skipped_not_eligible'|'skipped_replay',path?:string):void{this.safeVoid(()=>this.hypothesisIntentExtractionOutcomes.add?.(1,{outcome,...(path?{processing_path:path}:{}),contract_version:'1'}));}
 recordHypothesisGenerationRequestAssembly(outcome:'ready'|'not_ready'|'invariant_rejected',path?:string):void{this.safeVoid(()=>this.hypothesisGenerationRequestAssemblyOutcomes.add?.(1,{outcome,...(path?{processing_path:path}:{}),contract_version:'1'}));}
 recordControlledHypothesisGeneration(outcome:'invoked'|'accepted_nonzero'|'accepted_zero'|'generator_unavailable'|'generator_timeout'|'invalid_generator_output'|'generation_failed',path?:string):void{this.safeVoid(()=>this.controlledHypothesisGenerationOutcomes.add?.(1,{outcome,...(path?{processing_path:path}:{}),contract_version:'1'}));}
 recordPostGenerationConfidence(outcome:'skipped_zero_accepted'|'evaluated_all'|'evaluated_partial'|'evaluated_none',path:string,acceptedCount:number,evaluatedCount:number):void{this.safeVoid(()=>this.postGenerationConfidenceOutcomes.add?.(1,{outcome,processing_path:path,contract_version:'1',accepted_count:acceptedCount,evaluated_count:evaluatedCount}));}
 recordPublisherOperation(operation:'connect'|'claim'|'publish'|'ack'|'retry'|'quarantine'|'close',outcome:'success'|'failure'|'conflict'):void{this.safeVoid(()=>this.publisherOperations.add?.(1,{operation,outcome,transport:'redis_streams'}));}
 recordPostResponseDispatch(operation:'connect'|'read'|'reclaim'|'ack'|'event'|'authority'|'execution'|'effect',outcome:string):void{this.safeVoid(()=>this.postResponseDispatchOperations.add?.(1,{operation,outcome,contract_version:'1'}));}
 private async span<T>(name:string,dimensions:Record<string,string|undefined>,work:()=>Promise<T>|T):Promise<T>{const start=this.now();return this.traceOnce(name,this.spanAttributes(dimensions),work,(span,outcome)=>{this.safeVoid(()=>span.setAttribute('qandeel.outcome',outcome));if(outcome==='error')this.safeVoid(()=>span.setStatus({code:SpanStatusCode.ERROR}));this.safeVoid(()=>this.engineDuration.record?.(this.now()-start,this.metricAttributes(dimensions)));});}
 private async providerSpan<T>(provider:string,model:string,path:string,timeout:number,work:()=>Promise<T>,readUsage?:(value:T)=>Usage|undefined):Promise<T>{const dimensions={provider,model,processing_path:path},start=this.now();this.safeVoid(()=>this.providerCalls.add?.(1,dimensions));try{return await this.traceOnce('qandeel.provider',this.spanAttributes({...dimensions,timeout:String(timeout)}),work,(span,outcome,value)=>{this.safeVoid(()=>span.setAttribute('qandeel.outcome',outcome));if(outcome==='error'){this.safeVoid(()=>span.setStatus({code:SpanStatusCode.ERROR}));this.safeVoid(()=>this.providerErrors.add?.(1,{...dimensions,outcome:'error'}));}else{const usage=this.safe(()=>readUsage?.(value as T),undefined);if(usage){this.safeVoid(()=>this.inputTokens.add?.(usage.inputTokens,dimensions));this.safeVoid(()=>this.outputTokens.add?.(usage.outputTokens,dimensions));}}});}finally{this.safeVoid(()=>this.providerDuration.record?.(this.now()-start,dimensions));}}
 private async traceOnce<T>(name:string,attributes:Attributes,work:()=>Promise<T>|T,finish:(span:Span,outcome:'success'|'error',value?:T)=>void):Promise<T>{let workPromise:Promise<T>|undefined;const runOnce=()=>workPromise??=Promise.resolve().then(work);try{return await this.tracer.startActiveSpan(name,{attributes},async span=>{try{const value=await runOnce();this.safeVoid(()=>finish(span,'success',value));return value;}catch(error){this.safeVoid(()=>finish(span,'error'));throw error;}finally{this.safeVoid(()=>span.end());}});}catch(error){if(workPromise)return workPromise;return runOnce();}}
 private scoped<T>(telemetryWork:()=>Promise<T>,work:()=>Promise<T>|T):Promise<T>{let workPromise:Promise<T>|undefined;const once=()=>workPromise??=Promise.resolve().then(work);try{const result=telemetryWork();return Promise.resolve(result).catch(error=>workPromise?workPromise:Promise.reject(error));}catch{return once();}}
 private spanAttributes(extra:Record<string,string|undefined>):Attributes{return this.safe(()=>{const current=this.correlation.current(),result:Attributes={};if(current)for(const[key,value]of Object.entries(current))if(value)result[`qandeel.${key}`]=value;for(const[key,value]of Object.entries(extra))if(value!==undefined)result[`qandeel.${key}`]=value;return result;},{});}
 private metricAttributes(values:Record<string,string|undefined>):Attributes{const allowed=new Set(['engine','provider','model','processing_path','outcome']),result:Attributes={};for(const[key,value]of Object.entries(values))if(allowed.has(key)&&value!==undefined)result[key]=value;return result;}
 private now():number{return this.safe(()=>performance.now(),0);}private safe<T>(operation:()=>T,fallback:T):T{try{return operation();}catch{return fallback;}}private safeVoid(operation:()=>void):void{try{operation();}catch{}}
 private noopSpan():Span{return{setAttribute:()=>this.noopSpan(),setStatus:()=>this.noopSpan(),end:()=>undefined}as unknown as Span;}
}
