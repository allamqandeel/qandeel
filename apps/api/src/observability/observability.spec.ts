import { CorrelationService } from './correlation.service';
import { RequestCorrelationMiddleware } from './request-correlation.middleware';
import { TelemetryService } from './telemetry.service';
import { sanitizeSentryEvent,sentryOptions } from './sentry';
import { OpenAIModelRouter } from '../model-router/providers/openai/openai-model-router';
import { ClaudeModelRouter } from '../model-router/providers/anthropic/claude-model-router';
import { resolveOpenAIModel,resolveAnthropicModel } from '../model-router/model-profile.registry';
import type { ModelRouterRequest } from '../model-router/model-router.types';
import { hasExplicitMetricEndpoint,hasExplicitTraceEndpoint,initializeTelemetry,PrivacySafeSpanExporter,sanitizeAutomaticHttpSpan,sanitizeHttpSpanAttributes } from './instrumentation';
import { SpanKind,SpanStatusCode,type SpanContext } from '@opentelemetry/api';
import type { ReadableSpan,SpanExporter } from '@opentelemetry/sdk-trace-base';
import { decideFastDeepRoute } from '../intelligence-runtime/fast-deep-runtime-decision-policy-v2';
import { RUNTIME_ROUTING_V2_REASONS } from '../intelligence-runtime/fast-deep-routing-contract';
import { POST_RESPONSE_PROVIDER_BUDGET_DECISIONS, POST_RESPONSE_PROVIDER_EFFECTS_V1 } from '../post-response-intelligence/post-response-provider-budget';

const request:ModelRouterRequest={task:'CONVERSATIONAL_RESPONSE',path:'FAST',complexity:'LOW',behavioralGuidance:'secret prompt',context:[{role:'USER',content:'private message'}],locale:'und',modality:'TEXT',latencyBudgetMs:3000,costBudget:'LOW',safetyLevel:'STANDARD'};
// QIR-004 Fix 01 / QIR-006: the frozen LEGAL source/outcome relation, quoted
// here independently of the implementation so a silent widening fails these
// specs. 17 legal pairs: HISTORY 4 + MEMORY 4 + HUMAN_INTELLIGENCE 3 +
// HYPOTHESIS_RECOMMENDATION 3 + QUESTION 3. The three atomic sources have no
// PARTIALLY_RETAINED pair because they are whole-source-or-nothing.
const CONTEXT_BUDGET_LEGAL_PAIRS:ReadonlyArray<readonly [string,string]>=Object.freeze([
 ['HISTORY','NOT_PRESENT'],['HISTORY','INCLUDED_FULL'],['HISTORY','PARTIALLY_RETAINED'],['HISTORY','OMITTED_BUDGET'],
 ['MEMORY','NOT_PRESENT'],['MEMORY','INCLUDED_FULL'],['MEMORY','PARTIALLY_RETAINED'],['MEMORY','OMITTED_BUDGET'],
 ['HUMAN_INTELLIGENCE','NOT_PRESENT'],['HUMAN_INTELLIGENCE','INCLUDED_FULL'],['HUMAN_INTELLIGENCE','OMITTED_BUDGET'],
 ['HYPOTHESIS_RECOMMENDATION','NOT_PRESENT'],['HYPOTHESIS_RECOMMENDATION','INCLUDED_FULL'],['HYPOTHESIS_RECOMMENDATION','OMITTED_BUDGET'],
 ['QUESTION','NOT_PRESENT'],['QUESTION','INCLUDED_FULL'],['QUESTION','OMITTED_BUDGET'],
] as const);
describe('Correlation and telemetry foundation v1',()=>{
 it('generates a server request UUID, ignores inbound identity, and returns it',()=>{const c=new CorrelationService(),headers:Record<string,string>={};new RequestCorrelationMiddleware(c).use({headers:{'x-request-id':'attacker'}} as never,{setHeader:(k:string,v:string)=>headers[k]=v},()=>{expect(c.current()?.request_id).toMatch(/^[0-9a-f-]{36}$/);});expect(headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);expect(headers['x-request-id']).not.toBe('attacker');});
 it('isolates concurrent scopes and preserves context through await',async()=>{const c=new CorrelationService();const run=(delay:number)=>c.runRequest(async()=>{const id=c.current()!.request_id;await new Promise(r=>setTimeout(r,delay));expect(c.current()!.request_id).toBe(id);return id;});const ids=await Promise.all([run(5),run(1)]);expect(ids[0]).not.toBe(ids[1]);});
 it('binds canonical IDs once and nests orchestration, engine, and provider IDs',()=>{const c=new CorrelationService();c.runRequest(()=>{c.bindCanonical('session','turn');expect(()=>c.bindCanonical('other')).toThrow('CORRELATION_ID_CONFLICT');c.withOrchestration(()=>{const orchestration=c.current()!.orchestration_id;expect(orchestration).toBeTruthy();c.withEngine(()=>c.withProvider(()=>expect(c.current()).toMatchObject({session_id:'session',turn_id:'turn',orchestration_id:orchestration,engine_call_id:expect.any(String),provider_call_id:expect.any(String)})));});});});
 it('returns an immutable copy rather than the live correlation store',()=>{const c=new CorrelationService();c.runRequest(()=>{const snapshot=c.current()!;expect(Object.isFrozen(snapshot)).toBe(true);expect(()=>{(snapshot as any).session_id='attacker';}).toThrow();expect(c.current()?.session_id).toBeUndefined();});});
 it('sanitizes every Sentry raw payload surface, raw path, and stack runtime data',()=>{
  const sentinel='SENTINEL_SECRET_9f21';
  const event:any=sanitizeSentryEvent({
   message:sentinel,transaction:`GET /${sentinel}`,transaction_info:{source:sentinel},logentry:{message:sentinel},
   request:{method:'POST',data:{content:sentinel},query_string:`token=${sentinel}`,url:`/sessions/${sentinel}?token=${sentinel}`,cookies:sentinel,headers:{authorization:sentinel}},
   user:{id:sentinel},extra:{raw:sentinel},contexts:{provider:{body:sentinel}},breadcrumbs:[{data:{secret:sentinel}}],
   exception:{values:[{type:'ProviderError',value:sentinel,stacktrace:{frames:[{filename:'safe.ts',function:'handler',lineno:7,vars:{token:sentinel},pre_context:[sentinel],context_line:sentinel,post_context:[sentinel]}]}}]},
  });
  expect(JSON.stringify(event)).not.toContain(sentinel);expect(event.request).toEqual({method:'POST'});expect(event.exception.values[0].stacktrace.frames[0]).toEqual({filename:'safe.ts',function:'handler',lineno:7});expect(sentryOptions).toMatchObject({enabled:false,tracesSampleRate:0,skipOpenTelemetrySetup:true,sendDefaultPii:false});expect(sentryOptions.beforeBreadcrumb({category:'http',data:{secret:sentinel}})).toBeNull();
 });
 it('exports only method, normalized route template, and status from automatic HTTP metadata',()=>{const sentinel='SECRET_QUERY',raw=`/sessions/SECRET_SESSION/turns/SECRET_TURN?token=${sentinel}`;const attributes=sanitizeHttpSpanAttributes({'url.full':`https://host${raw}`,'url.path':raw,'url.query':`token=${sentinel}`,'http.target':raw,'http.request.header.authorization':sentinel,'client.address':'203.0.113.1','server.address':'host','user_agent.original':sentinel,'http.request.method':'GET','http.route':'/sessions/:sessionId/turns/:turnId','http.response.status_code':200});expect(attributes).toEqual({'http.request.method':'GET','http.route':'/sessions/:sessionId/turns/:turnId','http.response.status_code':200});expect(JSON.stringify(attributes)).not.toContain(sentinel);});
 it('preserves the complete ReadableSpan contract without mutating the original while sanitizing export',()=>{const secret='SECRET_SESSION',context:SpanContext={traceId:'1'.repeat(32),spanId:'2'.repeat(16),traceFlags:1};class PrototypeSpan{spanContext(){return context;}}const original=Object.assign(new PrototypeSpan(),{name:`GET /sessions/${secret}`,kind:SpanKind.SERVER,parentSpanContext:context,startTime:[1,2],endTime:[3,4],status:{code:SpanStatusCode.ERROR,description:secret},attributes:{'http.request.method':'GET','http.route':'/sessions/:sessionId','url.path':`/sessions/${secret}`},links:[{context,attributes:{safe:'yes'}}],events:[{name:'exception',time:[2,3],attributes:{'exception.message':secret}}],duration:[2,2],ended:true,resource:{attributes:{'service.name':'test'}},instrumentationScope:{name:'@opentelemetry/instrumentation-http',version:'1'},droppedAttributesCount:1,droppedEventsCount:2,droppedLinksCount:3})as unknown as ReadableSpan;let received:ReadableSpan|undefined;const delegate:SpanExporter={export:(spans,callback)=>{received=spans[0];expect(received.spanContext()).toBe(context);callback({code:0});},shutdown:async()=>undefined};new PrivacySafeSpanExporter(delegate).export([original],()=>undefined);expect(received).toMatchObject({name:'GET /sessions/:sessionId',parentSpanContext:context,startTime:[1,2],endTime:[3,4],status:{code:SpanStatusCode.ERROR},events:[],links:original.links,duration:[2,2],ended:true,resource:original.resource,instrumentationScope:original.instrumentationScope,droppedAttributesCount:1,droppedEventsCount:2,droppedLinksCount:3});expect(JSON.stringify(received)).not.toContain(secret);expect(original.name).toContain(secret);expect(original.events).toHaveLength(1);});
 it('normalizes unsafe automatic span names and strips events and status descriptions',()=>{const secret='SECRET_TURN';const span={name:`GET /turns/${secret}`,kind:SpanKind.SERVER,spanContext:()=>({traceId:'1'.repeat(32),spanId:'2'.repeat(16),traceFlags:1}),startTime:[0,0],endTime:[0,1],status:{code:SpanStatusCode.ERROR,description:secret},attributes:{'http.request.method':'GET','url.path':`/turns/${secret}`},links:[],events:[{name:'exception',time:[0,0],attributes:{'exception.stacktrace':secret}}],duration:[0,1],ended:true,resource:{},instrumentationScope:{name:'@opentelemetry/instrumentation-express'},droppedAttributesCount:0,droppedEventsCount:0,droppedLinksCount:0}as unknown as ReadableSpan;const safe=sanitizeAutomaticHttpSpan(span);expect(safe.name).toBe('GET request');expect(safe.events).toEqual([]);expect(safe.status).toEqual({code:SpanStatusCode.ERROR});expect(JSON.stringify(safe)).not.toContain(secret);});
 it('disables telemetry when exporter or SDK bootstrap factories throw instead of throwing at module load',()=>{const throwing=()=>{throw new Error('bootstrap failed');},factories={createTraceExporter:throwing,createMetricExporter:throwing,createMetricReader:throwing,createSdk:throwing}as never;expect(()=>initializeTelemetry({NODE_ENV:'production',OTEL_EXPORTER_OTLP_ENDPOINT:'http://unused'},factories)).not.toThrow();expect(initializeTelemetry({NODE_ENV:'production',OTEL_EXPORTER_OTLP_ENDPOINT:'http://unused'},factories)).toBeUndefined();expect(initializeTelemetry({NODE_ENV:'production'},factories)).toBeUndefined();});
 it('recognizes generic and signal-specific OTLP endpoints without constructing exporters in tests',()=>{expect(hasExplicitTraceEndpoint({OTEL_EXPORTER_OTLP_ENDPOINT:'http://collector:4318'})).toBe(true);expect(hasExplicitMetricEndpoint({OTEL_EXPORTER_OTLP_ENDPOINT:'http://collector:4318'})).toBe(true);expect(hasExplicitTraceEndpoint({OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:'http://collector/custom-traces'})).toBe(true);expect(hasExplicitMetricEndpoint({OTEL_EXPORTER_OTLP_METRICS_ENDPOINT:'http://collector/custom-metrics'})).toBe(true);expect(hasExplicitTraceEndpoint({})).toBe(false);expect(hasExplicitMetricEndpoint({})).toBe(false);});
 it('keeps successful and failing work authoritative when every telemetry primitive throws',async()=>{const c=new CorrelationService(),t=new TelemetryService(c),success=jest.fn().mockResolvedValue('ok'),original=new Error('original provider failure'),failure=jest.fn().mockRejectedValue(original);(t as any).tracer={startActiveSpan:(_n:string,_o:any,callback:any)=>callback({setAttribute:()=>{throw new Error('attribute');},setStatus:()=>{throw new Error('status');},end:()=>{throw new Error('end');}})};for(const key of ['providerCalls','providerErrors','providerDuration','inputTokens','outputTokens'])(t as any)[key]={add:()=>{throw new Error('metric');},record:()=>{throw new Error('metric');}};await expect(c.runRequest(()=>t.withProvider('openai','model','FAST',1,success,()=>{throw new Error('usage');}))).resolves.toBe('ok');await expect(c.runRequest(()=>t.withProvider('openai','model','FAST',1,failure))).rejects.toBe(original);expect(success).toHaveBeenCalledTimes(1);expect(failure).toHaveBeenCalledTimes(1);});
 it('executes work once when span creation itself fails',async()=>{const c=new CorrelationService(),t=new TelemetryService(c),work=jest.fn().mockResolvedValue(42);(t as any).tracer={startActiveSpan:()=>{throw new Error('tracer unavailable');}};await expect(c.runRequest(()=>t.withEngine('engine','FAST',work))).resolves.toBe(42);expect(work).toHaveBeenCalledTimes(1);});
 it('wraps OpenAI with a provider ID upstream but never sends correlation IDs in payload or headers',async()=>{const c=new CorrelationService(),t=new TelemetryService(c);let seen:any;const create=jest.fn().mockImplementation(async(body:any,options:any)=>{seen=c.current();expect(JSON.stringify({body,options})).not.toMatch(/request_id|provider_call_id|engine_call_id/);return{output_text:'ok',usage:{input_tokens:2,output_tokens:1}};});const router=new OpenAIModelRouter({apiKey:'x',resolveModel:resolveOpenAIModel,maxOutputTokens:10,timeoutMs:3000,maxRetries:0},{responses:{create}},t);await c.runRequest(()=>c.withOrchestration(()=>router.generate(request)));expect(seen.provider_call_id).toBeTruthy();expect(create).toHaveBeenCalledTimes(1);});
 it('wraps Anthropic consistently and uses only returned token usage',async()=>{const c=new CorrelationService(),t=new TelemetryService(c);let seen:any;const create=jest.fn().mockImplementation(async()=>{seen=c.current();return{content:[{type:'text',text:'ok'}],usage:{input_tokens:3,output_tokens:2}};});const router=new ClaudeModelRouter({apiKey:'x',resolveModel:resolveAnthropicModel,maxOutputTokens:10,timeoutMs:3000,maxRetries:0},{messages:{create}},t);await c.runRequest(()=>c.withOrchestration(()=>router.generate(request)));expect(seen.provider_call_id).toBeTruthy();expect(create).toHaveBeenCalledTimes(1);});
 it('keeps telemetry attributes bounded and never needs content payloads',async()=>{const c=new CorrelationService(),t=new TelemetryService(c);await expect(c.runRequest(()=>t.withEngine('context_builder','FAST',async()=>{expect(JSON.stringify(c.current())).not.toContain('private message');return 42;}))).resolves.toBe(42);});
 it('records eligibility with low-cardinality metadata only',()=>{const c=new CorrelationService(),t=new TelemetryService(c),add=jest.fn();(t as any).hypothesisEligibilityOutcomes={add};t.recordHypothesisGenerationEligibility('eligible','FAST');expect(add).toHaveBeenCalledWith(1,{outcome:'eligible',processing_path:'FAST',contract_version:'1'});expect(JSON.stringify(add.mock.calls)).not.toMatch(/user|content|evidence|memory|session|turn|provider/i);});
 it('records intent extraction with low-cardinality outcomes only',()=>{const c=new CorrelationService(),t=new TelemetryService(c),add=jest.fn();(t as any).hypothesisIntentExtractionOutcomes={add};t.recordHypothesisIntentExtraction('authority_rejected','DEEP');expect(add).toHaveBeenCalledWith(1,{outcome:'authority_rejected',processing_path:'DEEP',contract_version:'1'});expect(JSON.stringify(add.mock.calls)).not.toMatch(/user|content|evidence|memory|session|turn|provider_error/i);});
 it('records request assembly without request contents or identifiers',()=>{const c=new CorrelationService(),t=new TelemetryService(c),add=jest.fn();(t as any).hypothesisGenerationRequestAssemblyOutcomes={add};t.recordHypothesisGenerationRequestAssembly('ready','FAST');expect(add).toHaveBeenCalledWith(1,{outcome:'ready',processing_path:'FAST',contract_version:'1'});expect(JSON.stringify(add.mock.calls)).not.toMatch(/problem|evidence|scope|session|turn|user|request_json/i);});
 it('records Controlled Generation using bounded outcomes only',()=>{const c=new CorrelationService(),t=new TelemetryService(c),add=jest.fn();(t as any).controlledHypothesisGenerationOutcomes={add};t.recordControlledHypothesisGeneration('accepted_nonzero','FAST');expect(add).toHaveBeenCalledWith(1,{outcome:'accepted_nonzero',processing_path:'FAST',contract_version:'1'});expect(JSON.stringify(add.mock.calls)).not.toMatch(/problem|evidence|hypothesis|session|turn|user|provider_error|request_json/i);});
 it('records post-generation Confidence with bounded counts and no identifiers',()=>{const c=new CorrelationService(),t=new TelemetryService(c),add=jest.fn();(t as any).postGenerationConfidenceOutcomes={add};t.recordPostGenerationConfidence('evaluated_partial','DEEP',5,4);expect(add).toHaveBeenCalledWith(1,{outcome:'evaluated_partial',processing_path:'DEEP',contract_version:'1',accepted_count:5,evaluated_count:4});expect(JSON.stringify(add.mock.calls)).not.toMatch(/hypothesis_id|evaluation_id|statement|evidence|session|turn|user|raw_error/i);});
 it('records the QIR-002 routing decision with four finite dimensions and no content',()=>{const c=new CorrelationService(),t=new TelemetryService(c),add=jest.fn();(t as any).routingDecisions={add};t.recordRoutingDecision(decideFastDeepRoute('x'.repeat(1000)));expect(add).toHaveBeenCalledWith(1,{processing_path:'DEEP',routing_reason:'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE',policy_version:'2',complexity_score:'3'});t.recordRoutingDecision(decideFastDeepRoute('hello'));expect(add).toHaveBeenLastCalledWith(1,{processing_path:'FAST',routing_reason:'RUNTIME_ROUTING_V2_FAST_DEFAULT',policy_version:'2',complexity_score:'0'});expect(JSON.stringify(add.mock.calls)).not.toMatch(/hello|content|session|turn|user|memory|hypothesis|claude|gpt|anthropic|openai/i);});
 it('keeps the routing metric dimension set finite and drops anything outside it',()=>{const c=new CorrelationService(),t=new TelemetryService(c),add=jest.fn();(t as any).routingDecisions={add};const legal=new Set<string>();for(const content of['','hi','why? how? when? where?','a. b. c. d. e. f. g.','x'.repeat(300),'x'.repeat(600),'x'.repeat(1000),`${'a'.repeat(150)}? ${'b'.repeat(150)}? ${'c'.repeat(150)}? ${'d'.repeat(150)}. ${'e'.repeat(150)}. ${'f'.repeat(150)}. ${'g'.repeat(150)}.`])( t.recordRoutingDecision(decideFastDeepRoute(content)),legal.add(JSON.stringify(add.mock.calls.at(-1)![1])));for(const call of add.mock.calls){const labels=call[1] as Record<string,string>;expect(Object.keys(labels).sort()).toEqual(['complexity_score','policy_version','processing_path','routing_reason']);expect(['FAST','DEEP']).toContain(labels.processing_path);expect(RUNTIME_ROUTING_V2_REASONS as readonly string[]).toContain(labels.routing_reason);expect(labels.policy_version).toBe('2');expect(['0','1','2','3','4','5','6','7']).toContain(labels.complexity_score);}
  // Anything that is not an exact legal current pair, the exact policy version,
  // or an in-range integer score is DROPPED rather than emitted as a label.
  const before=add.mock.calls.length;for(const invalid of[{policyVersion:3,path:'FAST',reason:'RUNTIME_ROUTING_V2_FAST_DEFAULT',complexityScore:0,signals:{codePointCount:0,questionCount:0,logicalUnitCount:0}},{policyVersion:2,path:'FAST',reason:'FAST_DEFAULT',complexityScore:0,signals:{codePointCount:0,questionCount:0,logicalUnitCount:0}},{policyVersion:2,path:'FAST',reason:'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE',complexityScore:0,signals:{codePointCount:0,questionCount:0,logicalUnitCount:0}},{policyVersion:2,path:'FAST',reason:'RUNTIME_ROUTING_V2_FAST_DEFAULT',complexityScore:9,signals:{codePointCount:0,questionCount:0,logicalUnitCount:0}},{policyVersion:2,path:'FAST',reason:'RUNTIME_ROUTING_V2_FAST_DEFAULT',complexityScore:1.5,signals:{codePointCount:0,questionCount:0,logicalUnitCount:0}}])t.recordRoutingDecision(invalid as never);expect(add.mock.calls.length).toBe(before);});
 it('keeps the routing decision metric fail-soft',()=>{const c=new CorrelationService(),t=new TelemetryService(c);(t as any).routingDecisions={add:()=>{throw new Error('meter down');}};expect(()=>t.recordRoutingDecision(decideFastDeepRoute('hello'))).not.toThrow();(t as any).routingDecisions={};expect(()=>t.recordRoutingDecision(decideFastDeepRoute('hello'))).not.toThrow();});
 // QIR-004 integrated context budget telemetry: finite labels only, byte counts
 // as metric VALUES, and fail-soft under any meter failure.
 // QIR-004 Fix 01: the LEGAL source/outcome relation, restated here
 // independently of the implementation. History and Memory are prefix-
 // retainable; Human Intelligence and the Hypothesis+Recommendation package are
 // ATOMIC in v1, so PARTIALLY_RETAINED is impossible for them.
 it('records exactly the 17 legal QIR-004 source/outcome pairs per path and no content',()=>{const c=new CorrelationService(),t=new TelemetryService(c),add=jest.fn();(t as any).contextBudgetSourceDecisions={add};
  for(const [source,outcome] of CONTEXT_BUDGET_LEGAL_PAIRS)for(const path of['FAST','DEEP'])t.recordContextBudgetSourceDecision(source,outcome,path);
  expect(CONTEXT_BUDGET_LEGAL_PAIRS).toHaveLength(17);
  expect(add).toHaveBeenCalledTimes(34);
  for(const call of add.mock.calls){const labels=call[1] as Record<string,string>;expect(call[0]).toBe(1);expect(Object.keys(labels).sort()).toEqual(['outcome','policy_version','processing_path','source']);expect(CONTEXT_BUDGET_LEGAL_PAIRS.some(([source,outcome])=>source===labels.source&&outcome===labels.outcome)).toBe(true);expect(['FAST','DEEP']).toContain(labels.processing_path);expect(labels.policy_version).toBe('1');}
  expect(JSON.stringify(add.mock.calls)).not.toMatch(/hello|content|session|turn|user|bytes|\d{3,}|claude|gpt|anthropic|openai/i);});
 it('drops the three ILLEGAL atomic-source PARTIALLY_RETAINED pairs, whose labels are individually legal',()=>{const c=new CorrelationService(),t=new TelemetryService(c),add=jest.fn();(t as any).contextBudgetSourceDecisions={add};
  // Non-vacuity: both labels belong to their own finite registry, so only a
  // TOTAL pair gate can reject these; independent per-dimension checks cannot.
  for(const source of['HUMAN_INTELLIGENCE','HYPOTHESIS_RECOMMENDATION','QUESTION'])for(const path of['FAST','DEEP'])t.recordContextBudgetSourceDecision(source,'PARTIALLY_RETAINED',path);
  expect(add).not.toHaveBeenCalled();
  // Control: the SAME sources with a legal outcome, and the SAME outcome with a
  // prefix-retainable source, still emit - so the gate rejects the PAIR only.
  for(const source of['HUMAN_INTELLIGENCE','HYPOTHESIS_RECOMMENDATION','QUESTION'])t.recordContextBudgetSourceDecision(source,'OMITTED_BUDGET','FAST');
  for(const source of['HISTORY','MEMORY'])t.recordContextBudgetSourceDecision(source,'PARTIALLY_RETAINED','FAST');
  expect(add).toHaveBeenCalledTimes(5);});
 it('drops any QIR-004 source decision outside the finite registries',()=>{const c=new CorrelationService(),t=new TelemetryService(c),add=jest.fn();(t as any).contextBudgetSourceDecisions={add};
  for(const [source,outcome,path] of [['FUTURE_RESERVED','INCLUDED_FULL','FAST'],['HISTORY','TRUNCATED','FAST'],['HISTORY','INCLUDED_FULL','TURBO'],['','',''],['HISTORY','INCLUDED_FULL','fast']] as const)t.recordContextBudgetSourceDecision(source,outcome,path);
  expect(add).not.toHaveBeenCalled();});
 it('records QIR-004 byte counts as histogram VALUES and never as labels',()=>{const c=new CorrelationService(),t=new TelemetryService(c),record=jest.fn();(t as any).contextBudgetBytes={record};
  t.recordContextBudgetBytes('MANDATORY_CORE','RETAINED','FAST',65536);
  t.recordContextBudgetBytes('FINAL_TOTAL','FINAL','DEEP',131072);
  expect(record).toHaveBeenNthCalledWith(1,65536,{component:'MANDATORY_CORE',measurement:'RETAINED',processing_path:'FAST',policy_version:'1'});
  expect(record).toHaveBeenNthCalledWith(2,131072,{component:'FINAL_TOTAL',measurement:'FINAL',processing_path:'DEEP',policy_version:'1'});
  for(const call of record.mock.calls){expect(typeof call[0]).toBe('number');expect(JSON.stringify(call[1])).not.toMatch(/\d{3,}/);}});
 it('drops any QIR-004 byte measurement outside the finite registries or with an impossible value',()=>{const c=new CorrelationService(),t=new TelemetryService(c),record=jest.fn();(t as any).contextBudgetBytes={record};
  for(const [component,measurement,path,bytes] of [['FUTURE_RESERVED','RETAINED','FAST',1],['MANDATORY_CORE','ESTIMATED','FAST',1],['MANDATORY_CORE','RETAINED','TURBO',1],['MANDATORY_CORE','RETAINED','FAST',-1],['MANDATORY_CORE','RETAINED','FAST',1.5],['MANDATORY_CORE','RETAINED','FAST',Number.NaN],['MANDATORY_CORE','RETAINED','FAST',Number.POSITIVE_INFINITY]] as const)t.recordContextBudgetBytes(component,measurement,path,bytes);
  expect(record).not.toHaveBeenCalled();});
 it('keeps both QIR-004 budget metrics fail-soft',()=>{const c=new CorrelationService(),t=new TelemetryService(c);
  (t as any).contextBudgetSourceDecisions={add:()=>{throw new Error('meter down');}};(t as any).contextBudgetBytes={record:()=>{throw new Error('meter down');}};
  expect(()=>t.recordContextBudgetSourceDecision('MEMORY','INCLUDED_FULL','FAST')).not.toThrow();
  expect(()=>t.recordContextBudgetBytes('MEMORY','RETAINED','FAST',10)).not.toThrow();
  (t as any).contextBudgetSourceDecisions={};(t as any).contextBudgetBytes={};
  expect(()=>t.recordContextBudgetSourceDecision('MEMORY','INCLUDED_FULL','FAST')).not.toThrow();
  expect(()=>t.recordContextBudgetBytes('MEMORY','RETAINED','FAST',10)).not.toThrow();});
 // QIR-006 foreground formal Question selection telemetry: finite outcomes, a
 // bounded empty reason attached ONLY to the LEGITIMATE_EMPTY outcome, and
 // fail-soft under any meter failure.
 it('records exactly the bounded QIR-006 selection outcomes with the empty reason only on LEGITIMATE_EMPTY',()=>{const c=new CorrelationService(),t=new TelemetryService(c),add=jest.fn();(t as any).questionForegroundSelections={add};
  for(const outcome of['SELECTED','OPTIONAL_AVAILABILITY_FAILURE','FOREGROUND_BUDGET_EXPIRY','HARD_FAILURE'])for(const path of['FAST','DEEP'])t.recordQuestionForegroundSelection(outcome,path);
  for(const reason of['NO_ELIGIBLE_GAP','OUTSTANDING_OPEN_QUESTION'])for(const path of['FAST','DEEP'])t.recordQuestionForegroundSelection('LEGITIMATE_EMPTY',path,reason);
  expect(add).toHaveBeenCalledTimes(12);
  for(const call of add.mock.calls){const labels=call[1] as Record<string,string>;expect(call[0]).toBe(1);
   expect(['SELECTED','LEGITIMATE_EMPTY','OPTIONAL_AVAILABILITY_FAILURE','FOREGROUND_BUDGET_EXPIRY','HARD_FAILURE']).toContain(labels.outcome);
   expect(['FAST','DEEP']).toContain(labels.processing_path);expect(labels.policy_version).toBe('1');
   if(labels.outcome==='LEGITIMATE_EMPTY')expect(['NO_ELIGIBLE_GAP','OUTSTANDING_OPEN_QUESTION']).toContain(labels.empty_reason);
   else expect(labels).not.toHaveProperty('empty_reason');}
  expect(JSON.stringify(add.mock.calls)).not.toMatch(/hypothesis|confidence|informationObjective|Ask the user|session|turn|user_id|content|[0-9a-f]{8}-[0-9a-f]{4}|claude|gpt|anthropic|openai/i);});
 it('drops any QIR-006 selection emission outside the finite registries or with an impossible reason combination',()=>{const c=new CorrelationService(),t=new TelemetryService(c),add=jest.fn();(t as any).questionForegroundSelections={add};
  t.recordQuestionForegroundSelection('ANSWERED','FAST');
  t.recordQuestionForegroundSelection('SELECTED','TURBO');
  t.recordQuestionForegroundSelection('LEGITIMATE_EMPTY','FAST');
  t.recordQuestionForegroundSelection('LEGITIMATE_EMPTY','FAST','SOMETHING_ELSE');
  t.recordQuestionForegroundSelection('SELECTED','FAST','NO_ELIGIBLE_GAP');
  t.recordQuestionForegroundSelection('HARD_FAILURE','FAST','OUTSTANDING_OPEN_QUESTION');
  expect(add).not.toHaveBeenCalled();});
 it('keeps the QIR-006 selection metric fail-soft',()=>{const c=new CorrelationService(),t=new TelemetryService(c);
  (t as any).questionForegroundSelections={add:()=>{throw new Error('meter down');}};
  expect(()=>t.recordQuestionForegroundSelection('SELECTED','FAST')).not.toThrow();
  (t as any).questionForegroundSelections={};
  expect(()=>t.recordQuestionForegroundSelection('SELECTED','FAST')).not.toThrow();});
 // QIR-005 post-response provider-budget telemetry: the SAME frozen registries
 // the production gate uses, four finite dimensions, no identifier or payload,
 // and fail-soft under any meter failure.
 it('records exactly the 3 x 3 x 2 legal QIR-005 provider-budget dimensions and no content',()=>{const c=new CorrelationService(),t=new TelemetryService(c),add=jest.fn();(t as any).postResponseProviderBudgetDecisions={add};
  for(const effect of POST_RESPONSE_PROVIDER_EFFECTS_V1)for(const decision of POST_RESPONSE_PROVIDER_BUDGET_DECISIONS)for(const path of['FAST','DEEP'])t.recordPostResponseProviderBudget(effect,decision,path);
  expect(POST_RESPONSE_PROVIDER_EFFECTS_V1).toHaveLength(3);
  expect(POST_RESPONSE_PROVIDER_BUDGET_DECISIONS).toHaveLength(3);
  expect(add).toHaveBeenCalledTimes(18);
  for(const call of add.mock.calls){const labels=call[1] as Record<string,string>;expect(call[0]).toBe(1);
   expect(Object.keys(labels).sort()).toEqual(['decision','effect','policy_version','processing_path']);
   expect(POST_RESPONSE_PROVIDER_EFFECTS_V1 as readonly string[]).toContain(labels.effect);
   expect(POST_RESPONSE_PROVIDER_BUDGET_DECISIONS as readonly string[]).toContain(labels.decision);
   expect(['FAST','DEEP']).toContain(labels.processing_path);expect(labels.policy_version).toBe('1');}
  expect(JSON.stringify(add.mock.calls)).not.toMatch(/hello|content|session|turn|user|hypothesis|evidence|\d{3,}|claude|gpt|anthropic|openai/i);});
 it('drops any QIR-005 provider-budget decision outside the finite registries, including a fourth provider effect',()=>{const c=new CorrelationService(),t=new TelemetryService(c),add=jest.fn();(t as any).postResponseProviderBudgetDecisions={add};
  for(const [effect,decision,path] of [
   ['QUESTION_PROVIDER','AUTHORIZED','FAST'],['MEMORY_WRITE','AUTHORIZED','FAST'],['HIM_BRAIN_CONTEXT_MATERIALIZATION','AUTHORIZED','FAST'],
   ['INTENT_PROVIDER','GRANTED','FAST'],['INTENT_PROVIDER','AUTHORIZED','TURBO'],['INTENT_PROVIDER','AUTHORIZED','fast'],['','',''],
  ] as const)t.recordPostResponseProviderBudget(effect,decision,path);
  for(const decision of POST_RESPONSE_PROVIDER_BUDGET_DECISIONS)t.recordPostResponseProviderBudget('INTENT_PROVIDER',decision,null);
  expect(add).not.toHaveBeenCalled();
  // Control: the same call with every dimension legal still emits.
  t.recordPostResponseProviderBudget('INTENT_PROVIDER','AUTHORIZED','FAST');
  expect(add).toHaveBeenCalledTimes(1);});
 it('keeps the QIR-005 provider-budget metric fail-soft',()=>{const c=new CorrelationService(),t=new TelemetryService(c);
  (t as any).postResponseProviderBudgetDecisions={add:()=>{throw new Error('meter down');}};
  expect(()=>t.recordPostResponseProviderBudget('INTENT_PROVIDER','AUTHORIZED','FAST')).not.toThrow();
  (t as any).postResponseProviderBudgetDecisions={};
  expect(()=>t.recordPostResponseProviderBudget('INTENT_PROVIDER','AUTHORIZED','FAST')).not.toThrow();});
});