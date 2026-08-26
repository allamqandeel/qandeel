import { BackgroundIntelligenceAuthorityService,BackgroundIntelligenceExecutionContext } from'./background-intelligence-authority.service';import{BackgroundIntelligenceContextFactory}from'./background-intelligence-context.factory';import{BackgroundIntelligenceEnrichmentService}from'./background-intelligence-enrichment.service';import type{BackgroundIntelligenceDataApiService}from'./background-intelligence-data-api.service';import{MemoryWriteEvaluatorService}from'../memory/memory-write-evaluator.service';import{HypothesisGenerationTriggerClassificationService}from'../hypothesis/hypothesis-generation-trigger-classification.service';import type{RuntimeEventEnvelope}from'../runtime-events/runtime-event.types';
import{BackgroundIntelligenceModule}from'./background-intelligence.module';import{BackgroundIntelligenceDataApiService as RawDataApi}from'./background-intelligence-data-api.service';
const ids={event:'10000000-0000-4000-8000-000000000001',user:'10000000-0000-4000-8000-000000000002',session:'10000000-0000-4000-8000-000000000003',turn:'10000000-0000-4000-8000-000000000004'},event:RuntimeEventEnvelope={event_id:ids.event,event_type:'ConversationTurnCompleted',event_version:'2.0',occurred_at:'2026-01-01T00:00:00Z',producer:'conversation-service',subject_user_id:ids.user,subject_session_id:ids.session,subject_turn_id:ids.turn,correlation_id:null,causation_id:null,classification:'SENSITIVE',schema_ref:'qandeel.runtime.conversation-turn-completed.v2',payload:{user_id:ids.user,session_id:ids.session,source_turn_id:ids.turn,terminal_status:'COMPLETED',processing_path:'FAST',routing_reason:'FAST_DEFAULT',orchestration_id:null,safety_disposition:'ALLOW'},contains_content:false,retention_class:'OPERATIONAL_EVENT_V1'};
async function context(){const ownership={findSession:jest.fn().mockResolvedValue({id:ids.session,status:'ACTIVE',channel:'TEXT'}),findSourceTurn:jest.fn().mockResolvedValue({id:ids.turn,session_id:ids.session,role:'USER',status:'COMPLETED',source_turn_id:null}),findCompletedAssistant:jest.fn().mockResolvedValue({id:'a',session_id:ids.session,role:'ASSISTANT',status:'COMPLETED',source_turn_id:ids.turn})}as unknown as BackgroundIntelligenceDataApiService,result=await new BackgroundIntelligenceAuthorityService(new BackgroundIntelligenceContextFactory(),ownership).authorize(event);if(!result.context)throw new Error('authority failed');return result.context;}
const memory=(overrides:Record<string,unknown>={})=>({id:'20000000-0000-4000-8000-000000000001',user_id:ids.user,scope:'USER',type:'GOAL',content:'My goal is ship.',source:'USER_STATED',confidence:.95,importance:.85,status:'ACTIVE',version:1,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-02T00:00:00Z',expires_at:null,supersedes_memory_id:null,...overrides});
describe('BackgroundIntelligenceEnrichmentService',()=>{const setup=(overrides:Record<string,unknown>={})=>{const data={readCanonicalSourceTurn:jest.fn(),listActiveMemories:jest.fn().mockResolvedValue([]),createMemory:jest.fn().mockResolvedValue(memory()),listActiveHypotheses:jest.fn().mockResolvedValue([]),findHypothesis:jest.fn(),createSystemHypothesis:jest.fn(),attachHypothesisEvidence:jest.fn(),linkCompetingHypotheses:jest.fn(),createConfidenceEvaluation:jest.fn(),...overrides}as unknown as jest.Mocked<BackgroundIntelligenceDataApiService>;return{data,service:new BackgroundIntelligenceEnrichmentService(data,new MemoryWriteEvaluatorService(),new HypothesisGenerationTriggerClassificationService())};};
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
 });
 it('sends only authoritative minimal inputs to Confidence RPC',async()=>{const valid=await context(),hypothesis={id:'30000000-0000-4000-8000-000000000001',version:7},createConfidenceEvaluation=jest.fn().mockResolvedValue({id:'x'}),{service}=setup({findHypothesis:jest.fn().mockResolvedValue(hypothesis),createConfidenceEvaluation});await service.evaluateHypothesisConfidence(valid,hypothesis.id);expect(createConfidenceEvaluation).toHaveBeenCalledWith(valid,expect.any(String),hypothesis.id,7);});
 it('exports only authority and the narrow enrichment facade',()=>{const exports=Reflect.getMetadata('exports',BackgroundIntelligenceModule);expect(exports).toEqual([BackgroundIntelligenceAuthorityService,BackgroundIntelligenceEnrichmentService]);expect(exports).not.toContain(RawDataApi);});

 describe('applyAuthorizedHypothesisUpdate (A2.3b invocation boundary)',()=>{
  const updateRequest={hypothesisId:'30000000-0000-4000-8000-000000000001',expectedVersion:3,evidenceId:'memory:20000000-0000-4000-8000-000000000001',evidenceRole:'SUPPORTING' as const};
  const canonicalMutation=(updateId:string,overrides:{update?:Record<string,unknown>;hypothesis?:Record<string,unknown>}={})=>({
   update:{id:updateId,user_id:ids.user,hypothesis_id:updateRequest.hypothesisId,before_version:3,after_version:4,evidence_id:updateRequest.evidenceId,evidence_role:'SUPPORTING',source:'QANDEEL_HYPOTHESIS_UPDATE_LOOP',created_at:'now',...overrides.update},
   hypothesis:{id:updateRequest.hypothesisId,user_id:ids.user,version:4,...overrides.hypothesis},
  });
  const boundarySetup=(overrides:Record<string,unknown>={})=>setup({
   applyHypothesisUpdate:jest.fn().mockImplementation(async(_context:unknown,updateId:string)=>canonicalMutation(updateId)),
   findHypothesis:jest.fn().mockResolvedValue({id:updateRequest.hypothesisId,version:4}),
   createConfidenceEvaluation:jest.fn().mockResolvedValue({id:'evaluation-a'}),
   ...overrides,
  });
  it('applies a validated command through the context-bound mutation and evaluates Confidence afterwards',async()=>{
   const valid=await context(),{service,data}=boundarySetup();
   const result=await service.applyAuthorizedHypothesisUpdate(valid,updateRequest);
   expect(result.confidenceStatus).toBe('EVALUATED');
   expect(result.confidenceEvaluation).toEqual({id:'evaluation-a'});
   expect(data.applyHypothesisUpdate).toHaveBeenCalledTimes(1);
   const[calledContext,calledUpdateId,calledRequest]=(data.applyHypothesisUpdate as jest.Mock).mock.calls[0];
   expect(calledContext).toBe(valid);
   expect(calledUpdateId).toMatch(/^[0-9a-f-]{36}$/);
   expect(calledRequest).toBe(updateRequest);
   expect(result.update.id).toBe(calledUpdateId);
   // Confidence runs only AFTER the committed mutation.
   expect((data.applyHypothesisUpdate as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((data.createConfidenceEvaluation as jest.Mock).mock.invocationCallOrder[0]);
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
