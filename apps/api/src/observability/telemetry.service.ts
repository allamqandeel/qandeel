import { Injectable } from '@nestjs/common';
import { metrics,SpanStatusCode,trace,type Attributes,type Span,type Tracer } from '@opentelemetry/api';
import { CorrelationService } from './correlation.service';
import{RUNTIME_ROUTING_MAX_COMPLEXITY_SCORE,RUNTIME_ROUTING_MIN_COMPLEXITY_SCORE,RUNTIME_ROUTING_POLICY_VERSION,isLegalCurrentRoutePair,isRuntimeRoutingPath,type RuntimeRoutingDecision}from'../intelligence-runtime/fast-deep-routing-contract';

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
const CONTEXT_BUDGET_SOURCES:ReadonlySet<string>=new Set(['HISTORY','MEMORY','HUMAN_INTELLIGENCE','HYPOTHESIS_RECOMMENDATION']);
const CONTEXT_BUDGET_OUTCOMES:ReadonlySet<string>=new Set(['NOT_PRESENT','INCLUDED_FULL','PARTIALLY_RETAINED','OMITTED_BUDGET']);
const CONTEXT_BUDGET_COMPONENTS:ReadonlySet<string>=new Set(['MANDATORY_CORE','HISTORY','MEMORY','HUMAN_INTELLIGENCE','HYPOTHESIS_RECOMMENDATION','FINAL_TOTAL']);
const CONTEXT_BUDGET_MEASUREMENTS:ReadonlySet<string>=new Set(['OFFERED','RETAINED','FINAL']);
// QIR-004 Fix 01: the finite LEGAL SOURCE/OUTCOME RELATION.
//
// The two flat registries above bound the label VOCABULARY; this relation
// bounds which COMBINATIONS can exist at all. Validating source and outcome
// independently would let an impossible cross-product be emitted and thereby
// canonize a state QIR-004 v1 cannot produce.
//
// History and Memory are prefix-retainable, so PARTIALLY_RETAINED is legal for
// them. Human Intelligence and the Hypothesis+Recommendation package are ATOMIC
// in v1 - the whole source or none of it - so PARTIALLY_RETAINED is IMPOSSIBLE
// for them and is DROPPED rather than emitted. Exactly 14 legal pairs exist per
// processing path (4 + 4 + 3 + 3).
const CONTEXT_BUDGET_LEGAL_SOURCE_OUTCOMES:ReadonlyMap<string,ReadonlySet<string>>=new Map([
 ['HISTORY',new Set(['NOT_PRESENT','INCLUDED_FULL','PARTIALLY_RETAINED','OMITTED_BUDGET'])],
 ['MEMORY',new Set(['NOT_PRESENT','INCLUDED_FULL','PARTIALLY_RETAINED','OMITTED_BUDGET'])],
 ['HUMAN_INTELLIGENCE',new Set(['NOT_PRESENT','INCLUDED_FULL','OMITTED_BUDGET'])],
 ['HYPOTHESIS_RECOMMENDATION',new Set(['NOT_PRESENT','INCLUDED_FULL','OMITTED_BUDGET'])],
]);
const CONTEXT_BUDGET_POLICY_VERSION='1';

@Injectable()
export class TelemetryService{
 private readonly postResponseDispatchOperations:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createCounter('qandeel.post_response_dispatch.operations'),{});
 private readonly routingDecisions:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createCounter('qandeel.routing.decisions'),{});
 private readonly foregroundIntelligenceSourceOutcomes:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createCounter('qandeel.foreground.intelligence.source'),{});
 private readonly contextBudgetSourceDecisions:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createCounter('qandeel.context_budget.source_decisions'),{});
 private readonly contextBudgetBytes:Instrument=this.safe<Instrument>(()=>metrics.getMeter('qandeel-api').createHistogram('qandeel.context_budget.bytes',{unit:'By'}),{});
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
