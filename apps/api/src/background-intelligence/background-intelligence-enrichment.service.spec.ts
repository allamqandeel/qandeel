import { BackgroundIntelligenceAuthorityService,BackgroundIntelligenceExecutionContext } from'./background-intelligence-authority.service';import{BackgroundIntelligenceContextFactory}from'./background-intelligence-context.factory';import{BackgroundIntelligenceEnrichmentService}from'./background-intelligence-enrichment.service';import type{BackgroundIntelligenceDataApiService}from'./background-intelligence-data-api.service';import{MemoryWriteEvaluatorService}from'../memory/memory-write-evaluator.service';import{HimReasoningConsumptionService}from'../human-model/him-reasoning-consumption.service';import type{HimSnapshotSourceRow}from'../human-model/him-intelligence-snapshot.types';import{HypothesisGenerationTriggerClassificationService}from'../hypothesis/hypothesis-generation-trigger-classification.service';import type{RuntimeEventEnvelope}from'../runtime-events/runtime-event.types';
import{BackgroundIntelligenceModule}from'./background-intelligence.module';import{BackgroundIntelligenceDataApiService as RawDataApi}from'./background-intelligence-data-api.service';
const ids={event:'10000000-0000-4000-8000-000000000001',user:'10000000-0000-4000-8000-000000000002',session:'10000000-0000-4000-8000-000000000003',turn:'10000000-0000-4000-8000-000000000004'},event:RuntimeEventEnvelope={event_id:ids.event,event_type:'ConversationTurnCompleted',event_version:'2.0',occurred_at:'2026-01-01T00:00:00Z',producer:'conversation-service',subject_user_id:ids.user,subject_session_id:ids.session,subject_turn_id:ids.turn,correlation_id:null,causation_id:null,classification:'SENSITIVE',schema_ref:'qandeel.runtime.conversation-turn-completed.v2',payload:{user_id:ids.user,session_id:ids.session,source_turn_id:ids.turn,terminal_status:'COMPLETED',processing_path:'FAST',routing_reason:'FAST_DEFAULT',orchestration_id:null,safety_disposition:'ALLOW'},contains_content:false,retention_class:'OPERATIONAL_EVENT_V1'};
async function context(){const ownership={findSession:jest.fn().mockResolvedValue({id:ids.session,status:'ACTIVE',channel:'TEXT'}),findSourceTurn:jest.fn().mockResolvedValue({id:ids.turn,session_id:ids.session,role:'USER',status:'COMPLETED',source_turn_id:null}),findCompletedAssistant:jest.fn().mockResolvedValue({id:'a',session_id:ids.session,role:'ASSISTANT',status:'COMPLETED',source_turn_id:ids.turn})}as unknown as BackgroundIntelligenceDataApiService,result=await new BackgroundIntelligenceAuthorityService(new BackgroundIntelligenceContextFactory(),ownership).authorize(event);if(!result.context)throw new Error('authority failed');return result.context;}
const memory=(overrides:Record<string,unknown>={})=>({id:'20000000-0000-4000-8000-000000000001',user_id:ids.user,scope:'USER',type:'GOAL',content:'My goal is ship.',source:'USER_STATED',confidence:.95,importance:.85,status:'ACTIVE',version:1,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-02T00:00:00Z',expires_at:null,supersedes_memory_id:null,...overrides});
describe('BackgroundIntelligenceEnrichmentService',()=>{const setup=(overrides:Record<string,unknown>={})=>{const data={readCanonicalSourceTurn:jest.fn(),listActiveMemories:jest.fn().mockResolvedValue([]),createMemory:jest.fn().mockResolvedValue(memory()),listActiveHypotheses:jest.fn().mockResolvedValue([]),findHypothesis:jest.fn(),createSystemHypothesis:jest.fn(),attachHypothesisEvidence:jest.fn(),linkCompetingHypotheses:jest.fn(),createConfidenceEvaluation:jest.fn(),readHimConversationSnapshot:jest.fn().mockResolvedValue([]),...overrides}as unknown as jest.Mocked<BackgroundIntelligenceDataApiService>;return{data,service:new BackgroundIntelligenceEnrichmentService(data,new MemoryWriteEvaluatorService(),new HypothesisGenerationTriggerClassificationService(),new HimReasoningConsumptionService())};};
 it('rejects pre-authorization, spread, and prototype-forged contexts before repository use',async()=>{const{service,data}=setup(),valid=await context(),pre=new BackgroundIntelligenceContextFactory().create(event);for(const forged of[pre,{...valid},Object.create(BackgroundIntelligenceExecutionContext.prototype)])await expect(service.listEligibleEvidence(forged as never)).rejects.toThrow('BACKGROUND_INTELLIGENCE_AUTHORITY_REQUIRED');expect(data.listActiveMemories).not.toHaveBeenCalled();});
 it('shares Memory evaluator and normalized duplicate behavior',async()=>{const valid=await context(),skip=setup();await expect(skip.service.evaluateAndWriteMemory(valid,'hello')).resolves.toEqual({decision:'SKIP',reason:'NO_SUPPORTED_EXPLICIT_PATTERN'});const duplicate=setup({listActiveMemories:jest.fn().mockResolvedValue([memory({content:'my GOAL is ship!'})])});await expect(duplicate.service.evaluateAndWriteMemory(valid,'My goal is ship.')).resolves.toMatchObject({decision:'SKIP',reason:'EXACT_NORMALIZED_DUPLICATE'});expect(duplicate.data.createMemory).not.toHaveBeenCalled();});
 it('projects Evidence with the canonical pure projection',async()=>{const valid=await context(),{service}=setup({listActiveMemories:jest.fn().mockResolvedValue([memory()])});await expect(service.listEligibleEvidence(valid,new Date('2026-02-01T00:00:00Z'))).resolves.toEqual([expect.objectContaining({evidenceId:`memory:${memory().id}`,statement:'My goal is ship.'})]);});
 it('uses the shared trigger classifier without a provider',async()=>{const valid=await context(),{service}=setup({listActiveMemories:jest.fn().mockResolvedValue([memory()])});const result=await service.evaluateGenerationEligibility(valid,'Why do I always give up?','ALLOW');expect(result.eligibility.status).toBe('ELIGIBLE');});
 describe('generateHypothesisCandidatePlan (Finding 08 provider stage)',()=>{
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const generationInput=()=>({problem:'Why do I always give up?',domain:'GENERAL' as const,scope:`CONVERSATION_SESSION:${ids.session}`,evidenceIds:[`memory:${memory().id}`]});
  const proposal=(overrides:Record<string,unknown>={})=>({statement:'I give up when goals feel vague.',type:'CAUSAL' as const,domain:'GENERAL' as const,scope:`CONVERSATION_SESSION:${ids.session}`,supportingEvidenceIds:[`memory:${memory().id}`],contradictingEvidenceIds:[],assumptions:['Assumes vague goals recur'],disconfirmingConditions:['A vague goal is finished on time'],...overrides});
  const planSetup=()=>setup({listActiveMemories:jest.fn().mockResolvedValue([memory()])});
  it('invokes the provider once, assigns stable server UUIDs before completion, and performs zero Hypothesis writes',async()=>{
   const valid=await context(),{service,data}=planSetup(),generate=jest.fn().mockResolvedValue([proposal(),proposal({statement:'I recover focus after small wins.'})]);
   const plan=await service.generateHypothesisCandidatePlan(valid,generationInput(),{generate});
   expect(generate).toHaveBeenCalledTimes(1);
   if(plan.code!=='VALIDATED_CANDIDATES')throw new Error('expected a validated plan');
   expect(plan.candidates).toHaveLength(2);
   for(const candidate of plan.candidates)expect(candidate.hypothesisId).toMatch(UUID);
   expect(new Set(plan.candidates.map(candidate=>candidate.hypothesisId)).size).toBe(2);
   // The durable candidate is the exact final stored form of the accepted proposal.
   expect(plan.candidates[0]).toEqual({hypothesisId:plan.candidates[0].hypothesisId,...proposal()});
   // Provider stage writes nothing: no create, no attach, no link.
   expect(data.createSystemHypothesis).not.toHaveBeenCalled();expect(data.attachHypothesisEvidence).not.toHaveBeenCalled();expect(data.linkCompetingHypotheses).not.toHaveBeenCalled();
  });
  it('preserves the existing validation policy and returns NO_ACCEPTED_CANDIDATES when nothing survives',async()=>{
   const valid=await context(),{service,data}=planSetup();
   const rejectedAll=await service.generateHypothesisCandidatePlan(valid,generationInput(),{generate:jest.fn().mockResolvedValue([proposal({domain:'WORK'}),proposal({supportingEvidenceIds:['memory:20000000-0000-4000-8000-00000000ffff']}),proposal({supportingEvidenceIds:[`memory:${memory().id}`],contradictingEvidenceIds:[`memory:${memory().id}`]})])});
   expect(rejectedAll).toEqual({code:'NO_ACCEPTED_CANDIDATES'});
   const partial=await service.generateHypothesisCandidatePlan(valid,generationInput(),{generate:jest.fn().mockResolvedValue([proposal(),proposal()])});
   if(partial.code!=='VALIDATED_CANDIDATES')throw new Error('expected a validated plan');
   expect(partial.candidates).toHaveLength(1);
   expect(data.createSystemHypothesis).not.toHaveBeenCalled();
  });
  it('rejects generation evidence that is not currently eligible before calling the provider',async()=>{
   const valid=await context(),{service}=planSetup(),generate=jest.fn();
   await expect(service.generateHypothesisCandidatePlan(valid,{...generationInput(),evidenceIds:['memory:20000000-0000-4000-8000-00000000ffff']},{generate})).rejects.toThrow('Generation evidence is not currently eligible.');
   expect(generate).not.toHaveBeenCalled();
  });
  it('attaches the supplied minimized HIM context to the one provider request and omits it when absent',async()=>{
   const valid=await context(),himContext={contractVersion:1 as const,source:'HIM_STRUCTURED_STATE' as const,contextKind:'CONVERSATION_SESSION' as const,metrics:[{metricKey:'hse.stress' as const,knowledgeState:'KNOWN' as const,ordinalCategory:'HIGH' as const},{metricKey:'hse.energy' as const,knowledgeState:'UNKNOWN' as const,ordinalCategory:null},{metricKey:'hse.attention' as const,knowledgeState:'UNKNOWN' as const,ordinalCategory:null}]};
   const withHim=planSetup(),generateWith=jest.fn().mockResolvedValue([]);
   await withHim.service.generateHypothesisCandidatePlan(valid,generationInput(),{generate:generateWith},himContext);
   expect(generateWith).toHaveBeenCalledTimes(1);
   expect(generateWith.mock.calls[0][0].himContext).toEqual(himContext);
   const withoutHim=planSetup(),generateWithout=jest.fn().mockResolvedValue([]);
   await withoutHim.service.generateHypothesisCandidatePlan(valid,generationInput(),{generate:generateWithout});
   expect('himContext'in generateWithout.mock.calls[0][0]).toBe(false);
  });
 });

 describe('readHimHypothesisGenerationContext (HIM Runtime Consumption v1)',()=>{
  const generated='2026-08-25T00:00:00.000Z';
  const sessionRow=(metric:string,order:number):HimSnapshotSourceRow=>({generated_at:generated,slot_order:order,metric_key:metric,definition_version:1,semantic_type:'STATE',context_kind:'CONVERSATION_SESSION',context_id:ids.session,active_binding_id:`active-${metric}`,active_instrument_id:`instrument-${metric}`,active_instrument_version:1,active_scale_reference:`scale-${metric}`,active_scale_version:1,active_model_id:`model-${metric}`,active_model_version:1,measurement_event_id:null,event_observed_at:null,measurement_observation_id:null,response_code:null,observation_instrument_id:null,observation_instrument_version:null,observation_scale_reference:null,observation_scale_version:null,snapshot_id:null,value_state:null,numeric_value:null,validity_status:null,snapshot_provenance:null,calculation_result_id:null,canonical_binding_id:null,snapshot_scale_reference:null,snapshot_scale_version:null,result_state:null,result_numeric_value:null,result_model_id:null,result_model_version:null,result_provenance:null,result_confidence_state:null,result_confidence_reference:null,source_binding_status:null,source_instrument_id:null,source_instrument_version:null,source_scale_reference:null,source_scale_version:null,source_model_id:null,source_model_version:null});
  const assessedRow=(metric:string,order:number,n:number):HimSnapshotSourceRow=>{const r=sessionRow(metric,order);return{...r,measurement_event_id:`event-${metric}`,event_observed_at:'2026-08-24T00:00:00.000Z',measurement_observation_id:`observation-${metric}`,response_code:['','VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH'][n],observation_instrument_id:r.active_instrument_id,observation_instrument_version:1,observation_scale_reference:r.active_scale_reference,observation_scale_version:1,snapshot_id:`snapshot-${metric}`,value_state:'ASSESSED',numeric_value:n,validity_status:'VALID',snapshot_provenance:'QANDEEL_HIM_RUNTIME_FOUNDATION_V1',calculation_result_id:`result-${metric}`,canonical_binding_id:r.active_binding_id,snapshot_scale_reference:r.active_scale_reference,snapshot_scale_version:1,result_state:'ASSESSED',result_numeric_value:n,result_model_id:r.active_model_id,result_model_version:1,result_provenance:'QANDEEL_HIM_CALCULATION_RUNTIME_V1',result_confidence_state:'UNASSESSED',result_confidence_reference:null,source_binding_status:'ACTIVE',source_instrument_id:r.active_instrument_id,source_instrument_version:1,source_scale_reference:r.active_scale_reference,source_scale_version:1,source_model_id:r.active_model_id,source_model_version:1};};
  const emptyRows=()=>[sessionRow('hse.stress',1),sessionRow('hse.energy',2),sessionRow('hse.attention',5)];
  const partialRows=()=>[assessedRow('hse.stress',1,4),sessionRow('hse.energy',2),sessionRow('hse.attention',5)];
  it('reads through the narrow background boundary, projects with the shared canonicalizer, and returns only minimized state',async()=>{
   const valid=await context(),{service,data}=setup({readHimConversationSnapshot:jest.fn().mockResolvedValue(partialRows())});
   const result=await service.readHimHypothesisGenerationContext(valid);
   expect(data.readHimConversationSnapshot).toHaveBeenCalledTimes(1);
   expect(data.readHimConversationSnapshot).toHaveBeenCalledWith(valid);
   expect(result).toEqual({contractVersion:1,source:'HIM_STRUCTURED_STATE',contextKind:'CONVERSATION_SESSION',metrics:[{metricKey:'hse.stress',knowledgeState:'KNOWN',ordinalCategory:'HIGH'},{metricKey:'hse.energy',knowledgeState:'UNKNOWN',ordinalCategory:null},{metricKey:'hse.attention',knowledgeState:'UNKNOWN',ordinalCategory:null}]});
   // Nothing sensitive/internal leaks: no user/session UUID, timestamp, numeric storage value, provenance, or model identity.
   const serialized=JSON.stringify(result);
   expect(serialized).not.toContain(ids.user);expect(serialized).not.toContain(ids.session);
   expect(serialized).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/iu);
   expect(serialized).not.toMatch(/observedAt|generatedAt|freshness|confidence|numeric|instrument|scale|model|binding|calculation|provenance|event|observation|trend|average|composite|readiness|diagnosis/iu);
  });
  it('returns three explicit UNKNOWN metrics for a valid EMPTY canonical snapshot',async()=>{
   const valid=await context(),{service}=setup({readHimConversationSnapshot:jest.fn().mockResolvedValue(emptyRows())});
   const result=await service.readHimHypothesisGenerationContext(valid);
   expect(result.metrics.map(m=>m.metricKey)).toEqual(['hse.stress','hse.energy','hse.attention']);
   expect(result.metrics.every(m=>m.knowledgeState==='UNKNOWN'&&m.ordinalCategory===null)).toBe(true);
  });
  it('propagates a background read failure instead of fabricating EMPTY/UNKNOWN state',async()=>{
   const valid=await context(),{service}=setup({readHimConversationSnapshot:jest.fn().mockRejectedValue(new Error('BACKGROUND_INTELLIGENCE_DATABASE_UNAVAILABLE'))});
   await expect(service.readHimHypothesisGenerationContext(valid)).rejects.toThrow('BACKGROUND_INTELLIGENCE_DATABASE_UNAVAILABLE');
  });
  it.each([['a missing slot',()=>emptyRows().slice(1)],['a reordered slot set',()=>[sessionRow('hse.energy',2),sessionRow('hse.stress',1),sessionRow('hse.attention',5)]],['rows bound to another context',()=>emptyRows().map(r=>({...r,context_id:'40000000-0000-4000-8000-000000000009'}))],['an inconsistent read time',()=>emptyRows().map((r,i)=>i?{...r,generated_at:'later'}:r)]])('fails closed on %s through the shared canonicalizer',async(_label,rows)=>{
   const valid=await context(),{service}=setup({readHimConversationSnapshot:jest.fn().mockResolvedValue(rows())});
   await expect(service.readHimHypothesisGenerationContext(valid)).rejects.toThrow('INTEGRITY_FAILURE');
  });
  it('rejects pre-authorization, spread, and prototype-forged contexts before any HIM read',async()=>{
   const valid=await context(),{service,data}=setup(),pre=new BackgroundIntelligenceContextFactory().create(event);
   for(const forged of[pre,{...valid},Object.create(BackgroundIntelligenceExecutionContext.prototype)])
    await expect(service.readHimHypothesisGenerationContext(forged as never)).rejects.toThrow('BACKGROUND_INTELLIGENCE_AUTHORITY_REQUIRED');
   expect(data.readHimConversationSnapshot).not.toHaveBeenCalled();
  });
 });
 it('sends only authoritative minimal inputs to Confidence RPC',async()=>{const valid=await context(),hypothesis={id:'30000000-0000-4000-8000-000000000001',version:7},createConfidenceEvaluation=jest.fn().mockResolvedValue({id:'x'}),{service}=setup({findHypothesis:jest.fn().mockResolvedValue(hypothesis),createConfidenceEvaluation});await service.evaluateHypothesisConfidence(valid,hypothesis.id);expect(createConfidenceEvaluation).toHaveBeenCalledWith(valid,expect.any(String),hypothesis.id,7);});

 describe('evaluateHypothesisConfidenceVersion (Finding 09 exact-version post-update Confidence)',()=>{
  const hypothesisId='30000000-0000-4000-8000-000000000001';
  const record=(overrides:Record<string,unknown>={})=>({id:'evaluation-v',user_id:ids.user,target_id:hypothesisId,target_type:'HYPOTHESIS',target_version:4,provenance:'QANDEEL_CONFIDENCE_RUNTIME',...overrides});
  const versionSetup=(overrides:Record<string,unknown>={})=>setup({createConfidenceEvaluation:jest.fn().mockResolvedValue(record()),...overrides});
  it('sends the exact caller version and never rediscovers the target through findHypothesis',async()=>{
   const valid=await context(),{service,data}=versionSetup();
   const result=await service.evaluateHypothesisConfidenceVersion(valid,hypothesisId,4);
   expect(data.createConfidenceEvaluation).toHaveBeenCalledWith(valid,expect.any(String),hypothesisId,4);
   expect(data.findHypothesis).not.toHaveBeenCalled();
   expect(result).toEqual(record());
  });
  it.each([[0],[-1],[2.5],[Number.MAX_SAFE_INTEGER+2]])('rejects the invalid target version %p before any database call',async invalid=>{
   const valid=await context(),{service,data}=versionSetup();
   await expect(service.evaluateHypothesisConfidenceVersion(valid,hypothesisId,invalid)).rejects.toThrow('Invalid confidence target version.');
   expect(data.createConfidenceEvaluation).not.toHaveBeenCalled();
  });
  it('fails closed when no evaluation comes back',async()=>{
   const valid=await context(),{service}=versionSetup({createConfidenceEvaluation:jest.fn().mockResolvedValue(undefined)});
   await expect(service.evaluateHypothesisConfidenceVersion(valid,hypothesisId,4)).rejects.toThrow('Hypothesis not found.');
  });
  it.each([
   ['a foreign owner',{user_id:'40000000-0000-4000-8000-000000000009'}],
   ['a different target',{target_id:'40000000-0000-4000-8000-000000000008'}],
   ['a foreign target type',{target_type:'FORGED'}],
   ['a substituted later version',{target_version:5}],
   ['a foreign provenance',{provenance:'FORGED'}],
  ])('fails closed on a returned evaluation carrying %s',async(_label,overrides)=>{
   const valid=await context(),{service}=versionSetup({createConfidenceEvaluation:jest.fn().mockResolvedValue(record(overrides as Record<string,unknown>))});
   await expect(service.evaluateHypothesisConfidenceVersion(valid,hypothesisId,4)).rejects.toThrow('BACKGROUND_CONFIDENCE_INTEGRITY');
  });
  it('rejects pre-authorization, spread, and prototype-forged contexts before any database call',async()=>{
   const valid=await context(),{service,data}=versionSetup(),pre=new BackgroundIntelligenceContextFactory().create(event);
   for(const forged of[pre,{...valid},Object.create(BackgroundIntelligenceExecutionContext.prototype)])
    await expect(service.evaluateHypothesisConfidenceVersion(forged as never,hypothesisId,4)).rejects.toThrow('BACKGROUND_INTELLIGENCE_AUTHORITY_REQUIRED');
   expect(data.createConfidenceEvaluation).not.toHaveBeenCalled();
  });
 });
 it('exports only authority and the narrow enrichment facade',()=>{const exports=Reflect.getMetadata('exports',BackgroundIntelligenceModule);expect(exports).toEqual([BackgroundIntelligenceAuthorityService,BackgroundIntelligenceEnrichmentService]);expect(exports).not.toContain(RawDataApi);});

 describe('applyAuthorizedHypothesisUpdate (A2.3b invocation boundary)',()=>{
  const updateRequest={hypothesisId:'30000000-0000-4000-8000-000000000001',expectedVersion:3,evidenceId:'memory:20000000-0000-4000-8000-000000000001',evidenceRole:'SUPPORTING' as const};
  const canonicalMutation=(updateId:string,overrides:{update?:Record<string,unknown>;hypothesis?:Record<string,unknown>}={})=>({
   update:{id:updateId,user_id:ids.user,hypothesis_id:updateRequest.hypothesisId,before_version:3,after_version:4,evidence_id:updateRequest.evidenceId,evidence_role:'SUPPORTING',source:'QANDEEL_HYPOTHESIS_UPDATE_LOOP',created_at:'now',...overrides.update},
   hypothesis:{id:updateRequest.hypothesisId,user_id:ids.user,version:4,...overrides.hypothesis},
  });
  const confidenceRecord=(overrides:Record<string,unknown>={})=>({id:'evaluation-a',user_id:ids.user,target_id:updateRequest.hypothesisId,target_type:'HYPOTHESIS',target_version:4,provenance:'QANDEEL_CONFIDENCE_RUNTIME',...overrides});
  const boundarySetup=(overrides:Record<string,unknown>={})=>setup({
   applyHypothesisUpdate:jest.fn().mockImplementation(async(_context:unknown,updateId:string)=>canonicalMutation(updateId)),
   findHypothesis:jest.fn().mockResolvedValue({id:updateRequest.hypothesisId,version:4}),
   createConfidenceEvaluation:jest.fn().mockResolvedValue(confidenceRecord()),
   ...overrides,
  });
  it('applies a validated command through the context-bound mutation and evaluates exact-version Confidence afterwards',async()=>{
   const valid=await context(),{service,data}=boundarySetup();
   const result=await service.applyAuthorizedHypothesisUpdate(valid,updateRequest);
   expect(result.confidenceStatus).toBe('EVALUATED');
   expect(result.confidenceEvaluation).toEqual(confidenceRecord());
   expect(data.applyHypothesisUpdate).toHaveBeenCalledTimes(1);
   const[calledContext,calledUpdateId,calledRequest]=(data.applyHypothesisUpdate as jest.Mock).mock.calls[0];
   expect(calledContext).toBe(valid);
   expect(calledUpdateId).toMatch(/^[0-9a-f-]{36}$/);
   expect(calledRequest).toBe(updateRequest);
   expect(result.update.id).toBe(calledUpdateId);
   // Finding 09: the Confidence target is EXACTLY mutation.update.after_version
   // - the exact-version command receives 4 and no findHypothesis re-read ever
   // discovers the target.
   expect(data.createConfidenceEvaluation).toHaveBeenCalledWith(valid,expect.any(String),updateRequest.hypothesisId,4);
   expect(data.findHypothesis).not.toHaveBeenCalled();
   // Confidence runs only AFTER the committed mutation.
   expect((data.applyHypothesisUpdate as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((data.createConfidenceEvaluation as jest.Mock).mock.invocationCallOrder[0]);
  });
  it('reproduces the QAN-AUD-07 race: a later version is never evaluated on this mutation\'s behalf',async()=>{
   // Update A commits 3 -> 4; a racing update advances the Hypothesis to 5
   // before A's Confidence commits, so the exact-version service-role command
   // rejects as stale instead of evaluating version 5.
   const valid=await context(),{service,data}=boundarySetup({createConfidenceEvaluation:jest.fn().mockRejectedValue(new Error('Stale hypothesis version.'))});
   const result=await service.applyAuthorizedHypothesisUpdate(valid,updateRequest);
   expect(data.createConfidenceEvaluation).toHaveBeenCalledTimes(1);
   expect(data.createConfidenceEvaluation).toHaveBeenCalledWith(valid,expect.any(String),updateRequest.hypothesisId,4);
   // No latest-version rediscovery and no version-5 substitution.
   expect(data.findHypothesis).not.toHaveBeenCalled();
   expect(result.confidenceStatus).toBe('PENDING_RETRY');
   expect(result.confidenceEvaluation).toBeNull();
   // The committed mutation stands and is never replayed.
   expect(result.update.after_version).toBe(4);
   expect(data.applyHypothesisUpdate).toHaveBeenCalledTimes(1);
  });
  it('degrades a substituted later-version Confidence row to PENDING_RETRY instead of trusting it',async()=>{
   const valid=await context(),{service,data}=boundarySetup({createConfidenceEvaluation:jest.fn().mockResolvedValue(confidenceRecord({target_version:5}))});
   const result=await service.applyAuthorizedHypothesisUpdate(valid,updateRequest);
   expect(result.confidenceStatus).toBe('PENDING_RETRY');
   expect(result.confidenceEvaluation).toBeNull();
   expect(data.applyHypothesisUpdate).toHaveBeenCalledTimes(1);
  });
  it('returns PENDING_RETRY on Confidence failure with the mutation performed exactly once',async()=>{
   const valid=await context(),{service,data}=boundarySetup({createConfidenceEvaluation:jest.fn().mockRejectedValue(new Error('confidence down'))});
   const result=await service.applyAuthorizedHypothesisUpdate(valid,updateRequest);
   expect(result.confidenceStatus).toBe('PENDING_RETRY');
   expect(result.confidenceEvaluation).toBeNull();
   expect(result.hypothesis.version).toBe(4);
   expect(data.applyHypothesisUpdate).toHaveBeenCalledTimes(1);
  });
  it('fails closed when no canonical mutation is returned',async()=>{
   const valid=await context(),{service,data}=boundarySetup({applyHypothesisUpdate:jest.fn().mockResolvedValue(undefined)});
   await expect(service.applyAuthorizedHypothesisUpdate(valid,updateRequest)).rejects.toThrow('Hypothesis update target not found.');
   expect(data.createConfidenceEvaluation).not.toHaveBeenCalled();
  });
  it.each([
   ['a foreign owner',{update:{user_id:'40000000-0000-4000-8000-000000000009'}}],
   ['a different hypothesis',{update:{hypothesis_id:'40000000-0000-4000-8000-000000000008'}}],
   ['a different evidence identity',{update:{evidence_id:'memory:40000000-0000-4000-8000-000000000007'}}],
   ['a flipped evidence role',{update:{evidence_role:'CONTRADICTING'}}],
   ['a wrong before version',{update:{before_version:2}}],
   ['a wrong after version',{update:{after_version:5}}],
   ['a hypothesis/audit version mismatch',{hypothesis:{version:5}}],
   ['a foreign audit source',{update:{source:'FORGED_SOURCE'}}],
  ] as const)('fails closed on a returned mutation carrying %s',async(_label,overrides)=>{
   const valid=await context(),{service,data}=boundarySetup({applyHypothesisUpdate:jest.fn().mockImplementation(async(_context:unknown,updateId:string)=>canonicalMutation(updateId,overrides as never))});
   await expect(service.applyAuthorizedHypothesisUpdate(valid,updateRequest)).rejects.toThrow('BACKGROUND_HYPOTHESIS_UPDATE_INTEGRITY');
   expect(data.createConfidenceEvaluation).not.toHaveBeenCalled();
  });
  it('rejects malformed requests through the shared validator before any database call',async()=>{
   const valid=await context(),{service,data}=boundarySetup();
   for(const malformed of[
    {...updateRequest,hypothesisId:'not-a-uuid'},
    {...updateRequest,evidenceId:'evidence-1'},
    {...updateRequest,expectedVersion:0},
    {...updateRequest,expectedVersion:1.5},
    {...updateRequest,evidenceRole:'NEUTRAL' as never},
   ])await expect(service.applyAuthorizedHypothesisUpdate(valid,malformed)).rejects.toThrow(/Malformed hypothesis update identifiers|Expected version must be a positive integer|Invalid evidence role/);
   expect(data.applyHypothesisUpdate).not.toHaveBeenCalled();
  });
  it('rejects pre-authorization, spread, and prototype-forged contexts before any database call',async()=>{
   const valid=await context(),{service,data}=boundarySetup(),pre=new BackgroundIntelligenceContextFactory().create(event);
   for(const forged of[pre,{...valid},Object.create(BackgroundIntelligenceExecutionContext.prototype)])
    await expect(service.applyAuthorizedHypothesisUpdate(forged as never,updateRequest)).rejects.toThrow('BACKGROUND_INTELLIGENCE_AUTHORITY_REQUIRED');
   expect(data.applyHypothesisUpdate).not.toHaveBeenCalled();
  });
 });
});
