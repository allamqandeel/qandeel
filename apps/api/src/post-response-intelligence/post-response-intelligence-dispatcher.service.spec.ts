import { BackgroundIntelligenceAuthorityService } from '../background-intelligence/background-intelligence-authority.service';
import { BackgroundIntelligenceContextFactory } from '../background-intelligence/background-intelligence-context.factory';
import type { BackgroundIntelligenceDataApiService } from '../background-intelligence/background-intelligence-data-api.service';
import type { BackgroundIntelligenceEnrichmentService } from '../background-intelligence/background-intelligence-enrichment.service';
import type { HypothesisGenerationIntentExtractionService } from '../hypothesis/hypothesis-generation-intent-extraction.service';
import type { HypothesisGenerationRequestAssemblerService } from '../hypothesis/hypothesis-generation-request-assembler.service';
import type { BoundHypothesisCandidateGenerator } from '../hypothesis/hypothesis-candidate-generator-provider.types';
import type { RuntimeEventEnvelope } from '../runtime-events/runtime-event.types';
import { recoverDurableIntentProviderResult } from './durable-intent-provider-result';
import type { ModelAssistedHypothesisAssociationService } from './model-assisted-hypothesis-association.service';
import { PostResponseIntelligenceDispatcherService } from './post-response-intelligence-dispatcher.service';
import type { PostResponseIntelligenceRepository } from './post-response-intelligence.repository';

const id={event:'10000000-0000-4000-8000-000000000001',user:'10000000-0000-4000-8000-000000000002',session:'10000000-0000-4000-8000-000000000003',turn:'10000000-0000-4000-8000-000000000004',execution:'10000000-0000-4000-8000-000000000005',evidence:'10000000-0000-4000-8000-000000000006'};
const event=(version:'1.0'|'2.0'='2.0',safety:'ALLOW'|'GUIDED'|'BLOCK'='ALLOW'):RuntimeEventEnvelope=>({event_id:id.event,event_type:'ConversationTurnCompleted',event_version:version,occurred_at:'2026-01-01T00:00:00Z',producer:'conversation-service',subject_user_id:id.user,subject_session_id:id.session,subject_turn_id:id.turn,correlation_id:null,causation_id:null,classification:'SENSITIVE',schema_ref:`qandeel.runtime.conversation-turn-completed.v${version==='2.0'?'2':'1'}`,payload:{user_id:id.user,session_id:id.session,source_turn_id:id.turn,terminal_status:'COMPLETED',processing_path:'FAST',routing_reason:'FAST_DEFAULT',orchestration_id:null,...(version==='2.0'?{safety_disposition:safety}:{})},contains_content:false,retention_class:'OPERATIONAL_EVENT_V1'});

describe('PostResponseIntelligenceDispatcherService',()=>{
 // QAN-AUD-06: the managed Confidence-batch command is the ONLY generation
 // Confidence path. The ledger double models its durable side effect - a
 // successful command commits the typed CONFIDENCE_BATCH result the dispatcher
 // then rereads and validates - so no test can pass by trusting an HTTP status.
 const noConfidenceTargets=()=>({effect_key:'CONFIDENCE_BATCH',state:'COMPLETED',result_code:'NO_CONFIDENCE_TARGETS',result_reference:null,result_payload:null});
 // HIM Runtime Consumption v1: the minimized advisory session HIM state the
 // enrichment boundary returns for the fresh generation path.
 const himContext=()=>({contractVersion:1 as const,source:'HIM_STRUCTURED_STATE' as const,contextKind:'CONVERSATION_SESSION' as const,metrics:[{metricKey:'hse.stress' as const,knowledgeState:'KNOWN' as const,ordinalCategory:'HIGH' as const},{metricKey:'hse.energy' as const,knowledgeState:'UNKNOWN' as const,ordinalCategory:null},{metricKey:'hse.attention' as const,knowledgeState:'UNKNOWN' as const,ordinalCategory:null}]});
 const emptyHimContext=()=>({...himContext(),metrics:himContext().metrics.map(metric=>({...metric,knowledgeState:'UNKNOWN' as const,ordinalCategory:null}))});
 const setup=(overrides:{effects?:unknown[];state?:string;confidence?:unknown}={})=>{const rows:unknown[]=[...(overrides.effects??[])];const durableConfidence='confidence'in overrides?overrides.confidence:noConfidenceTargets();const ledger={acquire:jest.fn().mockResolvedValue({id:id.execution,event_id:id.event,user_id:id.user,session_id:id.session,source_turn_id:id.turn,event_version:'2.0',processing_path:'FAST',safety_disposition:'ALLOW',state:overrides.state??'RUNNING',attempt_count:1}),effects:jest.fn().mockImplementation(async()=>[...rows]),claim:jest.fn().mockResolvedValue(true),completeMemory:jest.fn().mockResolvedValue(true),completeIntent:jest.fn().mockResolvedValue(true),completeAssociation:jest.fn().mockResolvedValue(true),completeCandidateProvider:jest.fn().mockResolvedValue(true),persistHypothesisGeneration:jest.fn().mockResolvedValue(true),executeHypothesisUpdateBatch:jest.fn().mockResolvedValue(true),executeConfidenceBatch:jest.fn().mockImplementation(async()=>{if(durableConfidence!==null)rows.push(durableConfidence);return'COMPLETED';}),completeHimBrainContextMaterialization:jest.fn().mockResolvedValue('COMPLETED'),syncInformationGaps:jest.fn().mockResolvedValue({status:'NO_INFORMATION_GAPS',gaps:[]}),finish:jest.fn().mockResolvedValue(true)}as unknown as jest.Mocked<PostResponseIntelligenceRepository>;const ownership={findSession:jest.fn().mockResolvedValue({id:id.session,status:'ACTIVE',channel:'TEXT'}),findSourceTurn:jest.fn().mockResolvedValue({id:id.turn,session_id:id.session,role:'USER',status:'COMPLETED',source_turn_id:null}),findCompletedAssistant:jest.fn().mockResolvedValue({id:'assistant',session_id:id.session,role:'ASSISTANT',status:'COMPLETED',source_turn_id:id.turn})}as unknown as BackgroundIntelligenceDataApiService;const authority=new BackgroundIntelligenceAuthorityService(new BackgroundIntelligenceContextFactory(),ownership);const enrichment={readCanonicalSourceTurn:jest.fn().mockResolvedValue({id:id.turn,session_id:id.session,role:'USER',status:'COMPLETED',source_turn_id:null,content:'Why do I repeat this pattern?',processing_path:'FAST',routing_reason:'FAST_DEFAULT'}),readHimBrainContextMaterialization:jest.fn().mockResolvedValue({code:'NO_HIM_BRAIN_CONTEXT'}),evaluateAndWriteMemory:jest.fn().mockResolvedValue({decision:'SKIP',reason:'NO_SUPPORTED_EXPLICIT_PATTERN'}),evaluateGenerationEligibility:jest.fn().mockResolvedValue({eligibility:{status:'NOT_ELIGIBLE',reason:'NO_TRIGGER'}}),readHimHypothesisGenerationContext:jest.fn().mockResolvedValue(himContext()),generateHypothesisCandidatePlan:jest.fn(),evaluateHypothesisConfidence:jest.fn(),applyAuthorizedHypothesisUpdate:jest.fn()}as unknown as jest.Mocked<BackgroundIntelligenceEnrichmentService>;const extraction={extract:jest.fn()}as unknown as jest.Mocked<HypothesisGenerationIntentExtractionService>;const assembler={assemble:jest.fn()}as unknown as jest.Mocked<HypothesisGenerationRequestAssemblerService>;const generator={generate:jest.fn()}as BoundHypothesisCandidateGenerator;const association={prepare:jest.fn(),proposeAndAuthorize:jest.fn()}as unknown as jest.Mocked<ModelAssistedHypothesisAssociationService>;return{ledger,enrichment,association,extraction,assembler,service:new PostResponseIntelligenceDispatcherService(ledger,authority,enrichment,extraction,assembler,generator,association)};};
 const intent=()=>({problem:{text:'Why do I repeat this pattern?',source:'CURRENT_USER_TURN' as const,sourceTurnId:id.turn},domain:'GENERAL' as const,scope:{kind:'CONVERSATION_SESSION' as const,sessionId:id.session,serialized:`CONVERSATION_SESSION:${id.session}`},evidenceIds:[`memory:${id.evidence}`]});
 const eligible=()=>({eligibility:{status:'ELIGIBLE',reason:'TRIGGER_AND_EVIDENCE_AVAILABLE'},triggerClassification:{status:'TRIGGERED',reason:'RECURRING_PATTERN'},eligibleEvidence:[{evidenceId:`memory:${id.evidence}`,originatingMemoryId:id.evidence}]});
 const eligibleRun=(s:ReturnType<typeof setup>)=>{s.enrichment.evaluateGenerationEligibility.mockResolvedValue(eligible() as never);s.assembler.assemble.mockReturnValue({status:'READY',request:{problem:intent().problem.text,domain:'GENERAL',scope:intent().scope.serialized,evidenceIds:intent().evidenceIds}} as never);s.enrichment.generateHypothesisCandidatePlan.mockResolvedValue({code:'NO_ACCEPTED_CANDIDATES'} as never);return s;};
 const intentEffect=(overrides:Record<string,unknown>={})=>({effect_key:'INTENT_PROVIDER',state:'COMPLETED',result_code:'INTENT_AUTHORIZED',result_reference:null,result_payload:intent(),...overrides});
 const memorySkipEffect=()=>({effect_key:'MEMORY_WRITE',state:'COMPLETED',result_code:'NO_FRESH_EVIDENCE',result_reference:null,result_payload:null});
 const durableCandidate=(overrides:Record<string,unknown>={})=>({hypothesisId:'10000000-0000-4000-8000-00000000000a',statement:'I procrastinate when goals feel vague.',type:'CAUSAL' as const,domain:'GENERAL' as const,scope:`CONVERSATION_SESSION:${id.session}`,supportingEvidenceIds:[`memory:${id.evidence}`],contradictingEvidenceIds:[],assumptions:[],disconfirmingConditions:[],...overrides});
 const candidateEffect=(overrides:Record<string,unknown>={})=>({effect_key:'CANDIDATE_PROVIDER',state:'COMPLETED',result_code:'VALIDATED_CANDIDATES',result_reference:null,result_payload:[durableCandidate()],...overrides});
 const persistenceEffect=(overrides:Record<string,unknown>={})=>({effect_key:'HYPOTHESIS_PERSISTENCE',state:'COMPLETED',result_code:'HYPOTHESES_PERSISTED',result_reference:null,result_payload:['10000000-0000-4000-8000-00000000000a'],...overrides});
 const memoryWriteEffect=()=>({effect_key:'MEMORY_WRITE',state:'COMPLETED',result_code:'FRESH_EVIDENCE_CREATED',result_reference:`memory:${id.execution}`,result_payload:null});
 const updateCommand=(overrides:Record<string,unknown>={})=>({hypothesisId:id.user,expectedVersion:4,evidenceId:`memory:${id.execution}`,evidenceRole:'SUPPORTING' as const,...overrides});
 const associationEffect=(overrides:Record<string,unknown>={})=>({effect_key:'ASSOCIATION_PROVIDER',state:'COMPLETED',result_code:'AUTHORIZED_COMMANDS',result_reference:null,result_payload:[updateCommand()],...overrides});
 const updateReceipt=(overrides:Record<string,unknown>={})=>({commandOrdinal:1,updateId:'10000000-0000-4000-8000-00000000001a',confidenceEvaluationId:'10000000-0000-4000-8000-00000000001b',hypothesisId:id.user,expectedVersion:4,evidenceId:`memory:${id.execution}`,evidenceRole:'SUPPORTING',beforeVersion:4,afterVersion:5,confidenceStatus:'EVALUATED',...overrides});
 const updateBatchEffect=(overrides:Record<string,unknown>={})=>({effect_key:'HYPOTHESIS_UPDATE_BATCH',state:'COMPLETED',result_code:'UPDATES_APPLIED',result_reference:null,result_payload:[updateReceipt()],...overrides});
 const evaluationId={first:'10000000-0000-4000-8000-00000000002a',second:'10000000-0000-4000-8000-00000000002b'};
 const confidenceReceipt=(hypothesisId:string,ordinal:number,confidenceEvaluationId:string,overrides:Record<string,unknown>={})=>({ordinal,hypothesisId,targetVersion:1,confidenceEvaluationId,...overrides});
 const confidenceBatchEffect=(receipts:Record<string,unknown>[],overrides:Record<string,unknown>={})=>({effect_key:'CONFIDENCE_BATCH',state:'COMPLETED',result_code:'CONFIDENCE_BATCH_EVALUATED',result_reference:null,result_payload:receipts,...overrides});
 const singleTargetConfidence=(overrides:Record<string,unknown>={})=>confidenceBatchEffect([confidenceReceipt(durableCandidate().hypothesisId,1,evaluationId.first)],overrides);
 it('ACKs failed/cancelled and poison messages without background effects',async()=>{const s=setup(),failed={...event('1.0'),event_type:'ConversationTurnFailed',schema_ref:'qandeel.runtime.conversation-turn-failed.v1',payload:{...event('1.0').payload,terminal_status:'FAILED'}};await expect(s.service.dispatch(JSON.stringify(failed))).resolves.toBe(true);await expect(s.service.dispatch('{')).resolves.toBe(true);expect(s.ledger.acquire).not.toHaveBeenCalled();});
 it('terminalizes legacy Completed v1 without inferring Safety',async()=>{const s=setup();s.ledger.acquire.mockResolvedValueOnce({id:id.execution,event_id:id.event,user_id:id.user,session_id:id.session,source_turn_id:id.turn,event_version:'1.0',processing_path:'FAST',safety_disposition:null,state:'RUNNING',attempt_count:1});await s.service.dispatch(JSON.stringify(event('1.0')));expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','LEGACY_UNSUPPORTED','VALIDATION');expect(s.enrichment.readCanonicalSourceTurn).not.toHaveBeenCalled();});
 it.each(['GUIDED','BLOCK']as const)('skips %s before enrichment',async safety=>{const s=setup();s.ledger.acquire.mockResolvedValueOnce({id:id.execution,event_id:id.event,user_id:id.user,session_id:id.session,source_turn_id:id.turn,event_version:'2.0',processing_path:'FAST',safety_disposition:safety,state:'RUNNING',attempt_count:1});await s.service.dispatch(JSON.stringify(event('2.0',safety)));expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','SAFETY_SKIPPED','SAFETY');expect(s.enrichment.evaluateAndWriteMemory).not.toHaveBeenCalled();});
 it.each(['MEMORY_WRITE','INTENT_PROVIDER','ASSOCIATION_PROVIDER']as const)('quarantines a redelivery with an indeterminate claimed %s effect',async effectKey=>{const s=setup({effects:[{effect_key:effectKey,state:'CLAIMED'}]});await s.service.dispatch(JSON.stringify(event()));expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','EFFECT_RECOVERY');expect(s.enrichment.readCanonicalSourceTurn).not.toHaveBeenCalled();expect(s.ledger.claim).not.toHaveBeenCalled();expect(s.extraction.extract).not.toHaveBeenCalled();expect(s.association.proposeAndAuthorize).not.toHaveBeenCalled();});
 it('claims Memory once and durably records SKIP before continuing',async()=>{const s=setup();await s.service.dispatch(JSON.stringify(event()));expect(s.ledger.claim).toHaveBeenCalledWith(id.execution,'MEMORY_WRITE');expect(s.ledger.completeMemory).toHaveBeenCalledWith(id.execution,{decision:'SKIP',reason:'NO_SUPPORTED_EXPLICIT_PATTERN'});expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','NOT_ELIGIBLE','ELIGIBILITY');});
 it('completes a prepared fresh-Evidence association through the typed durable result and calls the provider once',async()=>{const s=setup(),snapshot={contractVersion:1,freshEvidence:{evidenceId:`memory:${id.execution}`,evidenceKind:'USER_STATED_FACT',statement:'fact',source:'USER_STATED'},candidateHypotheses:[{hypothesisId:id.event,hypothesisVersion:1,statement:'candidate',type:'CAUSAL',domain:'GENERAL',scope:`CONVERSATION_SESSION:${id.session}`,assumptions:[],disconfirmingConditions:[],alreadySupporting:false,alreadyContradicting:false}],maxAssociationCount:4}as const;s.enrichment.evaluateAndWriteMemory.mockResolvedValueOnce({decision:'WRITE',type:'GOAL',memoryId:id.execution,evidenceId:`memory:${id.execution}`});s.association.prepare.mockResolvedValueOnce({status:'PREPARED',snapshot}as never);s.association.proposeAndAuthorize.mockResolvedValueOnce({status:'NO_ASSOCIATION'}as never);await s.service.dispatch(JSON.stringify(event()));expect(s.ledger.claim).toHaveBeenCalledWith(id.execution,'ASSOCIATION_PROVIDER');expect(s.association.proposeAndAuthorize).toHaveBeenCalledTimes(1);expect(s.ledger.completeAssociation).toHaveBeenCalledWith(id.execution,{code:'NO_ASSOCIATION'});});
 it('persists the exact authorized command batch through the typed durable completion',async()=>{const s=setup(),commands=[{hypothesisId:id.user,expectedVersion:7,evidenceId:`memory:${id.execution}`,evidenceRole:'SUPPORTING' as const},{hypothesisId:id.turn,expectedVersion:2,evidenceId:`memory:${id.execution}`,evidenceRole:'CONTRADICTING' as const}];s.enrichment.evaluateAndWriteMemory.mockResolvedValueOnce({decision:'WRITE',type:'GOAL',memoryId:id.execution,evidenceId:`memory:${id.execution}`});s.association.prepare.mockResolvedValueOnce({status:'PREPARED',snapshot:{} as never});s.association.proposeAndAuthorize.mockResolvedValueOnce({status:'AUTHORIZED',commands}as never);await s.service.dispatch(JSON.stringify(event()));expect(s.association.proposeAndAuthorize).toHaveBeenCalledTimes(1);expect(s.ledger.completeAssociation).toHaveBeenCalledWith(id.execution,{code:'AUTHORIZED_COMMANDS',commands});expect(s.enrichment.applyAuthorizedHypothesisUpdate).not.toHaveBeenCalled();});
 it('does not claim or call the provider for EMPTY preparation',async()=>{const s=setup();s.enrichment.evaluateAndWriteMemory.mockResolvedValueOnce({decision:'WRITE',type:'GOAL',memoryId:id.execution,evidenceId:`memory:${id.execution}`});s.association.prepare.mockResolvedValueOnce({status:'EMPTY',reason:'NO_SAME_SESSION_HYPOTHESES'});await s.service.dispatch(JSON.stringify(event()));expect(s.ledger.claim).not.toHaveBeenCalledWith(id.execution,'ASSOCIATION_PROVIDER');expect(s.association.proposeAndAuthorize).not.toHaveBeenCalled();});
 it('recovers a completed valid durable association result on redelivery without a provider call',async()=>{for(const assoc of[{result_code:'NO_ASSOCIATION',result_reference:null,result_payload:null},{result_code:'AUTHORIZED_COMMANDS',result_reference:null,result_payload:[{hypothesisId:id.user,expectedVersion:4,evidenceId:`memory:${id.execution}`,evidenceRole:'SUPPORTING'}]}]){const s=setup({effects:[{effect_key:'MEMORY_WRITE',state:'COMPLETED',result_code:'FRESH_EVIDENCE_CREATED',result_reference:`memory:${id.execution}`,result_payload:null},{effect_key:'ASSOCIATION_PROVIDER',state:'COMPLETED',...assoc}as never]});await s.service.dispatch(JSON.stringify(event()));expect(s.enrichment.evaluateAndWriteMemory).not.toHaveBeenCalled();expect(s.association.prepare).not.toHaveBeenCalled();expect(s.association.proposeAndAuthorize).not.toHaveBeenCalled();
  // A2.3c consumes recovered AUTHORIZED_COMMANDS only through the ONE managed
  // database command - the process-level update boundary is never dispatched.
  expect(s.enrichment.applyAuthorizedHypothesisUpdate).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','NOT_ELIGIBLE','ELIGIBILITY');}});
 it('quarantines a legacy completed association effect that has no durable result instead of continuing',async()=>{const s=setup({effects:[{effect_key:'MEMORY_WRITE',state:'COMPLETED',result_code:'FRESH_EVIDENCE_CREATED',result_reference:`memory:${id.execution}`,result_payload:null},{effect_key:'ASSOCIATION_PROVIDER',state:'COMPLETED',result_code:null,result_reference:null,result_payload:null}]});await s.service.dispatch(JSON.stringify(event()));expect(s.enrichment.evaluateAndWriteMemory).not.toHaveBeenCalled();expect(s.association.prepare).not.toHaveBeenCalled();expect(s.association.proposeAndAuthorize).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','ASSOCIATION_RECOVERY');});
 it('quarantines a completed association effect when no durable fresh Memory evidence exists',async()=>{const s=setup({effects:[{effect_key:'MEMORY_WRITE',state:'COMPLETED',result_code:'NO_FRESH_EVIDENCE',result_reference:null,result_payload:null},{effect_key:'ASSOCIATION_PROVIDER',state:'COMPLETED',result_code:'NO_ASSOCIATION',result_reference:null,result_payload:null}]});await s.service.dispatch(JSON.stringify(event()));expect(s.association.prepare).not.toHaveBeenCalled();expect(s.association.proposeAndAuthorize).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','ASSOCIATION_RECOVERY');});
 it.each([{result_code:'AUTHORIZED_COMMANDS',result_reference:null,result_payload:[]},{result_code:'AUTHORIZED_COMMANDS',result_reference:null,result_payload:[{hypothesisId:id.user,expectedVersion:1,evidenceId:`memory:${id.session}`,evidenceRole:'SUPPORTING'}]},{result_code:'AUTHORIZED_COMMANDS',result_reference:null,result_payload:[{hypothesisId:'not-a-uuid',expectedVersion:1,evidenceId:`memory:${id.execution}`,evidenceRole:'SUPPORTING'}]},{result_code:'AUTHORIZED_COMMANDS',result_reference:`memory:${id.execution}`,result_payload:[{hypothesisId:id.user,expectedVersion:1,evidenceId:`memory:${id.execution}`,evidenceRole:'SUPPORTING'}]},{result_code:'NO_ASSOCIATION',result_reference:null,result_payload:[{hypothesisId:id.user,expectedVersion:1,evidenceId:`memory:${id.execution}`,evidenceRole:'SUPPORTING'}]}])('quarantines an invalid completed association durable result without provider replay: %o',async assoc=>{const s=setup({effects:[{effect_key:'MEMORY_WRITE',state:'COMPLETED',result_code:'FRESH_EVIDENCE_CREATED',result_reference:`memory:${id.execution}`,result_payload:null},{effect_key:'ASSOCIATION_PROVIDER',state:'COMPLETED',...assoc}as never]});await s.service.dispatch(JSON.stringify(event()));expect(s.association.proposeAndAuthorize).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','ASSOCIATION_RECOVERY');});
 it('recovers durable Memory SKIP after crash without false quarantine or provider call',async()=>{const s=setup();s.enrichment.evaluateGenerationEligibility.mockRejectedValueOnce(new Error('simulated crash'));await expect(s.service.dispatch(JSON.stringify(event()))).rejects.toThrow('simulated crash');expect(s.ledger.completeMemory).toHaveBeenCalledWith(id.execution,{decision:'SKIP',reason:'NO_SUPPORTED_EXPLICIT_PATTERN'});s.ledger.effects.mockResolvedValueOnce([{effect_key:'MEMORY_WRITE',state:'COMPLETED',result_code:'NO_FRESH_EVIDENCE',result_reference:null}] as never);s.enrichment.evaluateAndWriteMemory.mockClear();s.ledger.finish.mockClear();await s.service.dispatch(JSON.stringify(event()));expect(s.enrichment.evaluateAndWriteMemory).not.toHaveBeenCalled();expect(s.association.prepare).not.toHaveBeenCalled();expect(s.association.proposeAndAuthorize).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','NOT_ELIGIBLE','ELIGIBILITY');});
 it('recovers the exact durable Evidence reference after crash without replaying Memory',async()=>{const s=setup();s.enrichment.evaluateAndWriteMemory.mockResolvedValueOnce({decision:'WRITE',type:'GOAL',memoryId:id.execution,evidenceId:`memory:${id.execution}`});s.association.prepare.mockRejectedValueOnce(new Error('simulated crash before Association claim'));await expect(s.service.dispatch(JSON.stringify(event()))).rejects.toThrow('simulated crash before Association claim');expect(s.ledger.completeMemory).toHaveBeenCalledWith(id.execution,expect.objectContaining({evidenceId:`memory:${id.execution}`}));s.ledger.effects.mockResolvedValueOnce([{effect_key:'MEMORY_WRITE',state:'COMPLETED',result_code:'FRESH_EVIDENCE_CREATED',result_reference:`memory:${id.execution}`}] as never);s.enrichment.evaluateAndWriteMemory.mockClear();s.association.prepare.mockResolvedValueOnce({status:'PREPARED',snapshot:{} as never});s.association.proposeAndAuthorize.mockResolvedValueOnce({status:'AUTHORIZED',commands:[{hypothesisId:id.user,expectedVersion:3,evidenceId:`memory:${id.execution}`,evidenceRole:'SUPPORTING'}]}as never);await s.service.dispatch(JSON.stringify(event()));expect(s.enrichment.evaluateAndWriteMemory).not.toHaveBeenCalled();expect(s.association.prepare).toHaveBeenLastCalledWith(expect.anything(),`memory:${id.execution}`);expect(s.association.proposeAndAuthorize).toHaveBeenCalledTimes(1);expect(s.ledger.completeAssociation).toHaveBeenCalledWith(id.execution,{code:'AUTHORIZED_COMMANDS',commands:[{hypothesisId:id.user,expectedVersion:3,evidenceId:`memory:${id.execution}`,evidenceRole:'SUPPORTING'}]});});
 it('safely reruns EMPTY preparation after crash without calling the provider',async()=>{const s=setup();s.enrichment.evaluateAndWriteMemory.mockResolvedValueOnce({decision:'WRITE',type:'GOAL',memoryId:id.execution,evidenceId:`memory:${id.execution}`});s.association.prepare.mockResolvedValueOnce({status:'EMPTY',reason:'NO_SAME_SESSION_HYPOTHESES'});s.enrichment.evaluateGenerationEligibility.mockRejectedValueOnce(new Error('simulated crash'));await expect(s.service.dispatch(JSON.stringify(event()))).rejects.toThrow('simulated crash');s.ledger.effects.mockResolvedValueOnce([{effect_key:'MEMORY_WRITE',state:'COMPLETED',result_code:'FRESH_EVIDENCE_CREATED',result_reference:`memory:${id.execution}`}] as never);s.enrichment.evaluateAndWriteMemory.mockClear();s.association.prepare.mockResolvedValueOnce({status:'EMPTY',reason:'NO_SAME_SESSION_HYPOTHESES'});s.ledger.finish.mockClear();await s.service.dispatch(JSON.stringify(event()));expect(s.enrichment.evaluateAndWriteMemory).not.toHaveBeenCalled();expect(s.association.prepare).toHaveBeenCalledTimes(2);expect(s.association.proposeAndAuthorize).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','NOT_ELIGIBLE','ELIGIBILITY');});
 it.each([{result_code:null,result_reference:null},{result_code:'FRESH_EVIDENCE_CREATED',result_reference:null},{result_code:'NO_FRESH_EVIDENCE',result_reference:`memory:${id.execution}`},{result_code:'FRESH_EVIDENCE_CREATED',result_reference:'memory:invalid'}])('quarantines a legacy or invalid completed Memory result without inference: %o',async result=>{const s=setup({effects:[{effect_key:'MEMORY_WRITE',state:'COMPLETED',...result}]});await s.service.dispatch(JSON.stringify(event()));expect(s.enrichment.evaluateAndWriteMemory).not.toHaveBeenCalled();expect(s.association.prepare).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','ASSOCIATION_RECOVERY');});
 it('fails closed before provider when recovered Evidence is no longer eligible',async()=>{const s=setup({effects:[{effect_key:'MEMORY_WRITE',state:'COMPLETED',result_code:'FRESH_EVIDENCE_CREATED',result_reference:`memory:${id.execution}`}]});s.association.prepare.mockResolvedValueOnce({status:'NOT_AUTHORIZED',reason:'FRESH_EVIDENCE_NOT_ELIGIBLE'});await s.service.dispatch(JSON.stringify(event()));expect(s.association.proposeAndAuthorize).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','AUTHORITY_REJECTED','ASSOCIATION_PREPARATION');});
 it('quarantines provider failure before downstream generation or mutation',async()=>{const s=setup();s.enrichment.evaluateAndWriteMemory.mockResolvedValueOnce({decision:'WRITE',type:'GOAL',memoryId:id.execution,evidenceId:`memory:${id.execution}`});s.association.prepare.mockResolvedValueOnce({status:'PREPARED',snapshot:{} as never});s.association.proposeAndAuthorize.mockRejectedValueOnce(new Error('provider failed'));await s.service.dispatch(JSON.stringify(event()));expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','ASSOCIATION_PROVIDER');expect(s.ledger.completeAssociation).not.toHaveBeenCalled();expect(s.enrichment.evaluateGenerationEligibility).not.toHaveBeenCalled();expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();expect(s.enrichment.evaluateHypothesisConfidence).not.toHaveBeenCalled();});
 it('persists the exact canonical authorized intent atomically with completion and only then consumes it',async()=>{const s=eligibleRun(setup());s.extraction.extract.mockResolvedValue({status:'AUTHORIZED',intent:intent()} as never);await s.service.dispatch(JSON.stringify(event()));expect(s.extraction.extract).toHaveBeenCalledTimes(1);expect(s.ledger.claim).toHaveBeenCalledWith(id.execution,'INTENT_PROVIDER');expect(s.ledger.completeIntent).toHaveBeenCalledTimes(1);expect(s.ledger.completeIntent).toHaveBeenCalledWith(id.execution,{status:'AUTHORIZED',intent:intent()});expect(s.assembler.assemble).toHaveBeenCalledWith(intent());expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});
 it('persists a durable NOT_AUTHORIZED before skipping and carries no provider detail',async()=>{const s=eligibleRun(setup());s.extraction.extract.mockResolvedValue({status:'NOT_AUTHORIZED',reason:'PROVIDER_TIMEOUT'} as never);await s.service.dispatch(JSON.stringify(event()));expect(s.extraction.extract).toHaveBeenCalledTimes(1);expect(s.ledger.completeIntent).toHaveBeenCalledWith(id.execution,{status:'NOT_AUTHORIZED',reason:'PROVIDER_TIMEOUT'});expect(s.ledger.completeIntent.mock.invocationCallOrder[0]).toBeLessThan(s.ledger.finish.mock.invocationCallOrder[0]);expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','INTENT_NOT_AUTHORIZED','INTENT');expect(s.assembler.assemble).not.toHaveBeenCalled();});
 it('recovers a durably completed AUTHORIZED intent on redelivery without recalling the provider or false-skipping',async()=>{const s=eligibleRun(setup({effects:[{effect_key:'MEMORY_WRITE',state:'COMPLETED',result_code:'NO_FRESH_EVIDENCE',result_reference:null,result_payload:null},intentEffect()]}));await s.service.dispatch(JSON.stringify(event()));expect(s.extraction.extract).not.toHaveBeenCalled();expect(s.ledger.claim).not.toHaveBeenCalledWith(id.execution,'INTENT_PROVIDER');expect(s.ledger.completeIntent).not.toHaveBeenCalled();expect(s.assembler.assemble).toHaveBeenCalledWith(intent());expect(s.ledger.finish).not.toHaveBeenCalledWith(id.execution,'SKIPPED','INTENT_NOT_AUTHORIZED','INTENT');expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});
 it('replays a durably completed NOT_AUTHORIZED as a deterministic skip without recalling the provider',async()=>{const s=eligibleRun(setup({effects:[{effect_key:'MEMORY_WRITE',state:'COMPLETED',result_code:'NO_FRESH_EVIDENCE',result_reference:null,result_payload:null},intentEffect({result_code:'INTENT_NOT_AUTHORIZED',result_payload:null})]}));await s.service.dispatch(JSON.stringify(event()));expect(s.extraction.extract).not.toHaveBeenCalled();expect(s.assembler.assemble).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','INTENT_NOT_AUTHORIZED','INTENT');});
 it.each([['a legacy pre-0029 null result',{result_code:null,result_payload:null}],['a malformed authorized payload',{result_payload:{problem:'nope'}}],['a payload recorded for another turn',{result_payload:{...intent(),problem:{...intent().problem,sourceTurnId:'20000000-0000-4000-8000-000000000004'}}}],['an impossible code/payload pairing',{result_code:'INTENT_NOT_AUTHORIZED'}]])('quarantines %s as indeterminate instead of skipping',async(_label,overrides)=>{const s=eligibleRun(setup({effects:[{effect_key:'MEMORY_WRITE',state:'COMPLETED',result_code:'NO_FRESH_EVIDENCE',result_reference:null,result_payload:null},intentEffect(overrides as Record<string,unknown>)]}));await s.service.dispatch(JSON.stringify(event()));expect(s.extraction.extract).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','INTENT_RECOVERY');expect(s.ledger.finish).not.toHaveBeenCalledWith(id.execution,'SKIPPED','INTENT_NOT_AUTHORIZED','INTENT');});
 it('reproduces the pre-0029 false skip and refuses to repeat it',async()=>{const legacy={effect_key:'INTENT_PROVIDER' as const,state:'COMPLETED' as const,result_code:null,result_reference:null,result_payload:null};
  // Pre-0029 the generic result-less RPC completed INTENT_PROVIDER, so a redelivery saw a COMPLETED effect, correctly skipped the provider, and found its local intent gone - the exact durable state below yielded a false SKIPPED / INTENT_NOT_AUTHORIZED.
  const preFixOutcome=(localIntent:{status:string}|undefined)=>!localIntent||localIntent.status!=='AUTHORIZED'?'INTENT_NOT_AUTHORIZED':'COMPLETED';
  expect(preFixOutcome({status:'AUTHORIZED'})).toBe('COMPLETED');expect(preFixOutcome(undefined)).toBe('INTENT_NOT_AUTHORIZED');
  expect(recoverDurableIntentProviderResult(legacy,{session_id:id.session,source_turn_id:id.turn})).toEqual({status:'INDETERMINATE'});
  const s=eligibleRun(setup({effects:[{effect_key:'MEMORY_WRITE',state:'COMPLETED',result_code:'NO_FRESH_EVIDENCE',result_reference:null,result_payload:null},legacy]}));await s.service.dispatch(JSON.stringify(event()));
  expect(s.extraction.extract).not.toHaveBeenCalled();expect(s.ledger.finish).not.toHaveBeenCalledWith(id.execution,'SKIPPED','INTENT_NOT_AUTHORIZED','INTENT');expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','INTENT_RECOVERY');});
 it('quarantines an intent provider failure without a durable result',async()=>{const s=eligibleRun(setup());s.extraction.extract.mockRejectedValue(new Error('provider exploded'));await s.service.dispatch(JSON.stringify(event()));expect(s.ledger.completeIntent).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','INTENT_PROVIDER');});
 it('quarantines failed post-provider reauthorization before downstream generation or mutation',async()=>{const s=setup();s.enrichment.evaluateAndWriteMemory.mockResolvedValueOnce({decision:'WRITE',type:'GOAL',memoryId:id.execution,evidenceId:`memory:${id.execution}`});s.association.prepare.mockResolvedValueOnce({status:'PREPARED',snapshot:{} as never});s.association.proposeAndAuthorize.mockResolvedValueOnce({status:'NOT_AUTHORIZED',reason:'TARGET_OUT_OF_UNIVERSE'}as never);await s.service.dispatch(JSON.stringify(event()));expect(s.ledger.completeAssociation).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','ASSOCIATION_PROVIDER');expect(s.enrichment.evaluateGenerationEligibility).not.toHaveBeenCalled();expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();expect(s.enrichment.evaluateHypothesisConfidence).not.toHaveBeenCalled();});

 describe('Finding 08 - durable sequential generation',()=>{
  const secondId='10000000-0000-4000-8000-00000000000b';
  it('persists the exact typed candidate plan, runs the one atomic persistence command, and hands generation Confidence to the managed batch',async()=>{const s=eligibleRun(setup({confidence:confidenceBatchEffect([confidenceReceipt(durableCandidate().hypothesisId,1,evaluationId.first),confidenceReceipt(secondId,2,evaluationId.second)])}));s.extraction.extract.mockResolvedValue({status:'AUTHORIZED',intent:intent()} as never);const plan={code:'VALIDATED_CANDIDATES' as const,candidates:[durableCandidate(),durableCandidate({hypothesisId:secondId,statement:'A second distinct statement.'})]};s.enrichment.generateHypothesisCandidatePlan.mockResolvedValue(plan as never);await s.service.dispatch(JSON.stringify(event()));
   expect(s.enrichment.generateHypothesisCandidatePlan).toHaveBeenCalledTimes(1);expect(s.ledger.claim).toHaveBeenCalledWith(id.execution,'CANDIDATE_PROVIDER');expect(s.ledger.completeCandidateProvider).toHaveBeenCalledWith(id.execution,plan);expect(s.ledger.claim).toHaveBeenCalledWith(id.execution,'HYPOTHESIS_PERSISTENCE');expect(s.ledger.persistHypothesisGeneration).toHaveBeenCalledTimes(1);expect(s.ledger.persistHypothesisGeneration).toHaveBeenCalledWith(id.execution);
   // Generation Confidence is ONE managed database command carrying only the
   // execution identity: no application per-target loop, no generic claim and
   // no generic completion exist any more.
   expect(s.ledger.executeConfidenceBatch).toHaveBeenCalledTimes(1);expect(s.ledger.executeConfidenceBatch).toHaveBeenCalledWith(id.execution);expect(s.enrichment.evaluateHypothesisConfidence).not.toHaveBeenCalled();expect(s.ledger.claim).not.toHaveBeenCalledWith(id.execution,'CONFIDENCE_BATCH');expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});
  it('completes a NO_ACCEPTED_CANDIDATES plan through the typed command and still runs the durable no-op persistence',async()=>{const s=eligibleRun(setup());s.extraction.extract.mockResolvedValue({status:'AUTHORIZED',intent:intent()} as never);await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.completeCandidateProvider).toHaveBeenCalledWith(id.execution,{code:'NO_ACCEPTED_CANDIDATES'});expect(s.ledger.persistHypothesisGeneration).toHaveBeenCalledWith(id.execution);expect(s.enrichment.evaluateHypothesisConfidence).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});
  it('quarantines a candidate provider failure after claim without a fabricated result',async()=>{const s=eligibleRun(setup());s.extraction.extract.mockResolvedValue({status:'AUTHORIZED',intent:intent()} as never);s.enrichment.generateHypothesisCandidatePlan.mockRejectedValue(new Error('provider exploded'));await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.completeCandidateProvider).not.toHaveBeenCalled();expect(s.ledger.persistHypothesisGeneration).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','CANDIDATE_PROVIDER');});
  it('recovers a completed typed candidate plan and continues to atomic persistence with zero provider calls',async()=>{const s=eligibleRun(setup({effects:[memorySkipEffect(),intentEffect(),candidateEffect()],confidence:singleTargetConfidence()}));await s.service.dispatch(JSON.stringify(event()));
   expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();expect(s.ledger.completeCandidateProvider).not.toHaveBeenCalled();expect(s.ledger.claim).toHaveBeenCalledWith(id.execution,'HYPOTHESIS_PERSISTENCE');expect(s.ledger.persistHypothesisGeneration).toHaveBeenCalledWith(id.execution);expect(s.ledger.executeConfidenceBatch).toHaveBeenCalledWith(id.execution);expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});
  it('recovers a durable NO_ACCEPTED_CANDIDATES without a provider call or a Hypothesis write',async()=>{const s=eligibleRun(setup({effects:[memorySkipEffect(),intentEffect(),candidateEffect({result_code:'NO_ACCEPTED_CANDIDATES',result_payload:null})]}));await s.service.dispatch(JSON.stringify(event()));
   expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();expect(s.ledger.persistHypothesisGeneration).toHaveBeenCalledWith(id.execution);expect(s.enrichment.evaluateHypothesisConfidence).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});
  it.each([['a legacy pre-0033 null candidate result',{result_code:null,result_payload:null}],['a non-array payload',{result_payload:{}}],['a plan bound to another domain',{result_payload:[durableCandidate({domain:'WORK'})]}],['a plan bound to another scope',{result_payload:[durableCandidate({scope:'CONVERSATION_SESSION:20000000-0000-4000-8000-000000000003'})]}],['Evidence outside the durable Intent set',{result_payload:[durableCandidate({supportingEvidenceIds:[`memory:${id.user}`]})]}],['an impossible code/payload pairing',{result_code:'NO_ACCEPTED_CANDIDATES'}]])('quarantines %s as indeterminate without provider replay',async(_label,overrides)=>{const s=eligibleRun(setup({effects:[memorySkipEffect(),intentEffect(),candidateEffect(overrides as Record<string,unknown>)]}));await s.service.dispatch(JSON.stringify(event()));
   expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();expect(s.ledger.persistHypothesisGeneration).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','CANDIDATE_RECOVERY');});
  it('reproduces the pre-0033 lost accepted set and refuses to repeat it',async()=>{
   // Pre-0033 both generation effects completed generically with no result, so a redelivery saw them COMPLETED, correctly refused to replay, and found its local accepted IDs gone - Confidence silently received accepted=[].
   const preFixAccepted=(local:readonly{id:string}[]|undefined)=>local??[];
   expect(preFixAccepted(undefined)).toEqual([]);expect(preFixAccepted([{id:secondId}])).toEqual([{id:secondId}]);
   const s=eligibleRun(setup({effects:[memorySkipEffect(),intentEffect(),candidateEffect({result_code:null,result_payload:null}),persistenceEffect({result_code:null,result_payload:null})]}));await s.service.dispatch(JSON.stringify(event()));
   expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();expect(s.enrichment.evaluateHypothesisConfidence).not.toHaveBeenCalled();expect(s.ledger.finish).not.toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','CANDIDATE_RECOVERY');});
  it('recovers the exact persisted Hypothesis IDs on redelivery with zero writes and zero provider calls',async()=>{const s=eligibleRun(setup({effects:[memorySkipEffect(),intentEffect(),candidateEffect(),persistenceEffect()],confidence:singleTargetConfidence()}));await s.service.dispatch(JSON.stringify(event()));
   expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();expect(s.ledger.claim).not.toHaveBeenCalledWith(id.execution,'CANDIDATE_PROVIDER');expect(s.ledger.claim).not.toHaveBeenCalledWith(id.execution,'HYPOTHESIS_PERSISTENCE');expect(s.ledger.persistHypothesisGeneration).not.toHaveBeenCalled();
   // The recovered accepted set is the exact durable persisted-ID list, never an empty fallback, and the managed batch is what consumes it.
   expect(s.ledger.executeConfidenceBatch).toHaveBeenCalledWith(id.execution);expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});
  it.each([['a legacy null persistence result',candidateEffect(),{result_code:null,result_payload:null}],['an ID list from another plan',candidateEffect(),{result_payload:[secondId]}],['a reordered ID list',candidateEffect({result_payload:[durableCandidate(),durableCandidate({hypothesisId:secondId,statement:'A second distinct statement.'})]}),{result_payload:[secondId,durableCandidate().hypothesisId]}],['NO_HYPOTHESES_PERSISTED paired with a validated plan',candidateEffect(),{result_code:'NO_HYPOTHESES_PERSISTED',result_payload:null}],['HYPOTHESES_PERSISTED paired with an empty plan',candidateEffect({result_code:'NO_ACCEPTED_CANDIDATES',result_payload:null}),{}]])('quarantines %s as a candidate/persistence mismatch',async(_label,candidateRow,persistenceOverrides)=>{const s=eligibleRun(setup({effects:[memorySkipEffect(),intentEffect(),candidateRow as never,persistenceEffect(persistenceOverrides as Record<string,unknown>)]}));await s.service.dispatch(JSON.stringify(event()));
   expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();expect(s.enrichment.evaluateHypothesisConfidence).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_PERSISTENCE_RECOVERY');});
  it('quarantines a completed persistence whose candidate effect never completed',async()=>{const s=eligibleRun(setup({effects:[memorySkipEffect(),intentEffect(),persistenceEffect()]}));await s.service.dispatch(JSON.stringify(event()));
   expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();expect(s.ledger.persistHypothesisGeneration).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_PERSISTENCE_RECOVERY');});
  it('quarantines an atomic persistence failure and leaves the rollback to the database',async()=>{const s=eligibleRun(setup({effects:[memorySkipEffect(),intentEffect(),candidateEffect()]}));s.ledger.persistHypothesisGeneration.mockRejectedValue(new Error('POST_RESPONSE_DATABASE_UNAVAILABLE'));await s.service.dispatch(JSON.stringify(event()));
   expect(s.enrichment.evaluateHypothesisConfidence).not.toHaveBeenCalled();expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_PERSISTENCE');});
 });

 describe('HIM Runtime Consumption v1 - fresh-path HIM before Candidate claim',()=>{
  const claimOrder=(s:ReturnType<typeof setup>,key:string)=>{const index=(s.ledger.claim as jest.Mock).mock.calls.findIndex(call=>call[1]===key);return index===-1?undefined:(s.ledger.claim as jest.Mock).mock.invocationCallOrder[index];};
  it('reads canonical HIM BEFORE claiming CANDIDATE_PROVIDER and passes the minimized context into the one provider call',async()=>{
   const s=eligibleRun(setup());s.extraction.extract.mockResolvedValue({status:'AUTHORIZED',intent:intent()} as never);
   await s.service.dispatch(JSON.stringify(event()));
   expect(s.enrichment.readHimHypothesisGenerationContext).toHaveBeenCalledTimes(1);
   const himOrder=(s.enrichment.readHimHypothesisGenerationContext as jest.Mock).mock.invocationCallOrder[0];
   expect(himOrder).toBeLessThan(claimOrder(s,'CANDIDATE_PROVIDER')!);
   expect(himOrder).toBeLessThan((s.enrichment.generateHypothesisCandidatePlan as jest.Mock).mock.invocationCallOrder[0]);
   expect(s.enrichment.generateHypothesisCandidatePlan).toHaveBeenCalledTimes(1);
   expect(s.enrichment.generateHypothesisCandidatePlan).toHaveBeenCalledWith(expect.anything(),expect.anything(),expect.anything(),himContext());
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});
  it('returns non-terminal on HIM read failure with zero Candidate claim, zero provider call, and zero fabricated state',async()=>{
   const s=eligibleRun(setup());s.extraction.extract.mockResolvedValue({status:'AUTHORIZED',intent:intent()} as never);
   (s.enrichment.readHimHypothesisGenerationContext as jest.Mock).mockRejectedValue(new Error('BACKGROUND_INTELLIGENCE_DATABASE_UNAVAILABLE'));
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(false);
   expect(claimOrder(s,'CANDIDATE_PROVIDER')).toBeUndefined();
   expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();
   expect(s.ledger.completeCandidateProvider).not.toHaveBeenCalled();
   expect(s.ledger.finish).not.toHaveBeenCalled();});
  it('proceeds through a valid EMPTY HIM snapshot as three explicit UNKNOWN metrics with exactly one provider call',async()=>{
   const s=eligibleRun(setup());s.extraction.extract.mockResolvedValue({status:'AUTHORIZED',intent:intent()} as never);
   (s.enrichment.readHimHypothesisGenerationContext as jest.Mock).mockResolvedValue(emptyHimContext());
   await s.service.dispatch(JSON.stringify(event()));
   expect(s.enrichment.generateHypothesisCandidatePlan).toHaveBeenCalledTimes(1);
   const passed=(s.enrichment.generateHypothesisCandidatePlan as jest.Mock).mock.calls[0][3];
   expect(passed.metrics).toHaveLength(3);
   expect(passed.metrics.every((metric:{knowledgeState:string;ordinalCategory:null})=>metric.knowledgeState==='UNKNOWN'&&metric.ordinalCategory===null)).toBe(true);
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});
  it('recovers a durably completed Candidate with ZERO HIM read and ZERO provider replay',async()=>{
   const s=eligibleRun(setup({effects:[memorySkipEffect(),intentEffect(),candidateEffect()],confidence:singleTargetConfidence()}));
   await s.service.dispatch(JSON.stringify(event()));
   expect(s.enrichment.readHimHypothesisGenerationContext).not.toHaveBeenCalled();
   expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});
  it('performs ZERO HIM reads on the post-persistence Confidence resume',async()=>{
   const s=eligibleRun(setup({effects:[intentEffect(),candidateEffect(),persistenceEffect()],confidence:singleTargetConfidence()}));
   await s.service.dispatch(JSON.stringify(event()));
   expect(s.enrichment.readHimHypothesisGenerationContext).not.toHaveBeenCalled();
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});
  it('performs ZERO HIM reads on duplicate delivery of a terminal execution',async()=>{
   const s=setup({state:'COMPLETED',effects:[intentEffect(),candidateEffect(),persistenceEffect(),singleTargetConfidence()]});
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(s.enrichment.readHimHypothesisGenerationContext).not.toHaveBeenCalled();});
 });

 describe('A2.3c - automatic hypothesis update batch',()=>{
  it('consumes recovered AUTHORIZED_COMMANDS exactly once through the ONE managed command with generated identities only',async()=>{const s=setup({effects:[memoryWriteEffect(),associationEffect()]});await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.executeHypothesisUpdateBatch).toHaveBeenCalledTimes(1);
   const[executionId,invocationIds]=(s.ledger.executeHypothesisUpdateBatch as jest.Mock).mock.calls[0];
   expect(executionId).toBe(id.execution);
   expect(invocationIds).toHaveLength(1);
   expect(invocationIds[0].updateId).toMatch(/^[0-9a-f-]{36}$/);
   expect(invocationIds[0].confidenceEvaluationId).toMatch(/^[0-9a-f-]{36}$/);
   expect(invocationIds[0].updateId).not.toBe(invocationIds[0].confidenceEvaluationId);
   // The managed effect is never ordinary-claimed, no process-level update
   // boundary runs, no provider is replayed, and no token path exists.
   expect(s.ledger.claim).not.toHaveBeenCalledWith(id.execution,'HYPOTHESIS_UPDATE_BATCH');
   expect(s.enrichment.applyAuthorizedHypothesisUpdate).not.toHaveBeenCalled();
   expect(s.association.proposeAndAuthorize).not.toHaveBeenCalled();
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','NOT_ELIGIBLE','ELIGIBILITY');});
  it('runs the automatic update batch BEFORE the generation candidate provider',async()=>{const s=eligibleRun(setup({effects:[memoryWriteEffect(),associationEffect()]}));s.extraction.extract.mockResolvedValue({status:'AUTHORIZED',intent:intent()} as never);await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.executeHypothesisUpdateBatch).toHaveBeenCalledTimes(1);
   expect((s.ledger.executeHypothesisUpdateBatch as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((s.enrichment.generateHypothesisCandidatePlan as jest.Mock).mock.invocationCallOrder[0]);
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});
  it('recovers a completed valid UPDATES_APPLIED batch with zero mutation, Confidence or provider calls',async()=>{const s=setup({effects:[memoryWriteEffect(),associationEffect(),updateBatchEffect()]});await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.executeHypothesisUpdateBatch).not.toHaveBeenCalled();
   expect(s.enrichment.applyAuthorizedHypothesisUpdate).not.toHaveBeenCalled();
   expect(s.enrichment.evaluateHypothesisConfidence).not.toHaveBeenCalled();
   expect(s.association.proposeAndAuthorize).not.toHaveBeenCalled();
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','NOT_ELIGIBLE','ELIGIBILITY');});
  it('quarantines a completed UPDATES_REJECTED batch with zero replay',async()=>{const s=setup({effects:[memoryWriteEffect(),associationEffect(),updateBatchEffect({result_code:'UPDATES_REJECTED',result_payload:null})]});await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.executeHypothesisUpdateBatch).not.toHaveBeenCalled();expect(s.enrichment.applyAuthorizedHypothesisUpdate).not.toHaveBeenCalled();expect(s.association.proposeAndAuthorize).not.toHaveBeenCalled();
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_UPDATE_BATCH_RECOVERY');});
  it.each([['a legacy null result',{result_code:null,result_payload:null}],['a receipt for another command',{result_payload:[updateReceipt({hypothesisId:id.turn})]}],['a reordered/short receipt list',{result_payload:[]}],['a wrong after version',{result_payload:[updateReceipt({afterVersion:6})]}],['an invalid confidence status',{result_payload:[updateReceipt({confidenceStatus:'DONE'})]}]])('quarantines %s as an indeterminate batch without replay',async(_label,overrides)=>{const s=setup({effects:[memoryWriteEffect(),associationEffect(),updateBatchEffect(overrides as Record<string,unknown>)]});await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.executeHypothesisUpdateBatch).not.toHaveBeenCalled();expect(s.enrichment.applyAuthorizedHypothesisUpdate).not.toHaveBeenCalled();
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_UPDATE_BATCH_RECOVERY');});
  it('performs zero mutations for NO_ASSOCIATION and continues to generation',async()=>{const s=setup({effects:[memoryWriteEffect(),associationEffect({result_code:'NO_ASSOCIATION',result_payload:null})]});await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.executeHypothesisUpdateBatch).not.toHaveBeenCalled();expect(s.enrichment.applyAuthorizedHypothesisUpdate).not.toHaveBeenCalled();
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','NOT_ELIGIBLE','ELIGIBILITY');});
  it('quarantines a completed update batch that coexists with NO_ASSOCIATION',async()=>{const s=setup({effects:[memoryWriteEffect(),associationEffect({result_code:'NO_ASSOCIATION',result_payload:null}),updateBatchEffect()]});await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.executeHypothesisUpdateBatch).not.toHaveBeenCalled();
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_UPDATE_BATCH_RECOVERY');});
  it('reconciles an ambiguous managed-RPC outcome from durable state: committed UPDATES_APPLIED continues',async()=>{const s=setup({effects:[memoryWriteEffect(),associationEffect()]});s.ledger.executeHypothesisUpdateBatch.mockRejectedValue(new Error('POST_RESPONSE_DATABASE_UNAVAILABLE'));
   (s.ledger.effects as jest.Mock).mockResolvedValueOnce([memoryWriteEffect(),associationEffect()]).mockResolvedValueOnce([memoryWriteEffect(),associationEffect(),updateBatchEffect()]);
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(s.ledger.executeHypothesisUpdateBatch).toHaveBeenCalledTimes(1);
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','NOT_ELIGIBLE','ELIGIBILITY');});
  it('reconciles an ambiguous outcome into quarantine when the durable batch is UPDATES_REJECTED',async()=>{const s=setup({effects:[memoryWriteEffect(),associationEffect()]});s.ledger.executeHypothesisUpdateBatch.mockResolvedValue(false);
   (s.ledger.effects as jest.Mock).mockResolvedValueOnce([memoryWriteEffect(),associationEffect()]).mockResolvedValueOnce([memoryWriteEffect(),associationEffect(),updateBatchEffect({result_code:'UPDATES_REJECTED',result_payload:null})]);
   await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_UPDATE_BATCH_RECOVERY');});
  it('quarantines an impossible persisted CLAIMED managed effect found on reconciliation',async()=>{const s=setup({effects:[memoryWriteEffect(),associationEffect()]});s.ledger.executeHypothesisUpdateBatch.mockRejectedValue(new Error('POST_RESPONSE_DATABASE_UNAVAILABLE'));
   (s.ledger.effects as jest.Mock).mockResolvedValueOnce([memoryWriteEffect(),associationEffect()]).mockResolvedValueOnce([memoryWriteEffect(),associationEffect(),{effect_key:'HYPOTHESIS_UPDATE_BATCH',state:'CLAIMED',result_code:null,result_reference:null,result_payload:null}]);
   await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_UPDATE_BATCH');});
  it('returns false for an unresolved transport outcome with no durable batch, allowing redelivery',async()=>{const s=setup({effects:[memoryWriteEffect(),associationEffect()]});s.ledger.executeHypothesisUpdateBatch.mockRejectedValue(new Error('POST_RESPONSE_DATABASE_UNAVAILABLE'));
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(false);
   expect(s.ledger.finish).not.toHaveBeenCalled();});
  it('returns false when the ledger reread itself is unavailable',async()=>{const s=setup({effects:[memoryWriteEffect(),associationEffect()]});s.ledger.executeHypothesisUpdateBatch.mockRejectedValue(new Error('POST_RESPONSE_DATABASE_UNAVAILABLE'));
   (s.ledger.effects as jest.Mock).mockResolvedValueOnce([memoryWriteEffect(),associationEffect()]).mockRejectedValueOnce(new Error('POST_RESPONSE_DATABASE_UNAVAILABLE'));
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(false);
   expect(s.ledger.finish).not.toHaveBeenCalled();});
 });

 describe('QAN-AUD-06 - managed generation Confidence batch',()=>{
  const otherId='10000000-0000-4000-8000-00000000000b';
  const generatedId=durableCandidate().hypothesisId;
  // A still-RUNNING redelivery whose generation persistence is already durably
  // complete. There is deliberately NO Memory effect in this fixture: if the
  // resume path ever re-entered the upstream stages the Memory write would run.
  const resumed=()=>[intentEffect(),candidateEffect(),persistenceEffect()];
  const legacyConfidence=()=>({effect_key:'CONFIDENCE_BATCH',state:'COMPLETED',result_code:null,result_reference:null,result_payload:null});

  it('reproduces the pre-0035 swallowed per-target failure and refuses to repeat it',async()=>{
   // Pre-0035 the dispatcher looped the accepted IDs with an empty catch, so a
   // failed target still resolved the work callback, the generic effect became
   // COMPLETED and the execution terminalized COMPLETED - durable success for a
   // Hypothesis that never got its Confidence snapshot.
   const preFixBatchCompleted=async(targets:readonly string[],failing:string)=>{for(const target of targets){try{if(target===failing)throw new Error('confidence failed');}catch{/* swallowed */}}return true;};
   expect(await preFixBatchCompleted([generatedId,otherId],otherId)).toBe(true);
   const s=eligibleRun(setup({effects:resumed(),confidence:null}));s.ledger.executeConfidenceBatch.mockResolvedValue('RETRY_PENDING' as never);
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(false);
   expect(s.ledger.finish).not.toHaveBeenCalled();});

  it('terminalizes normally on a typed CONFIDENCE_BATCH_EVALUATED result',async()=>{const s=eligibleRun(setup({effects:resumed(),confidence:singleTargetConfidence()}));await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.executeConfidenceBatch).toHaveBeenCalledTimes(1);expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});

  it('terminalizes normally on a typed NO_CONFIDENCE_TARGETS result',async()=>{const s=eligibleRun(setup({effects:[intentEffect(),candidateEffect({result_code:'NO_ACCEPTED_CANDIDATES',result_payload:null}),persistenceEffect({result_code:'NO_HYPOTHESES_PERSISTED',result_payload:null})]}));await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.executeConfidenceBatch).toHaveBeenCalledWith(id.execution);expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});

  it('quarantines fail-closed on a QUARANTINED command status',async()=>{const s=eligibleRun(setup({effects:resumed(),confidence:null}));s.ledger.executeConfidenceBatch.mockResolvedValue('QUARANTINED' as never);
   await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','CONFIDENCE_BATCH');});

  it('recovers a durably completed typed batch with zero Confidence replay',async()=>{const s=eligibleRun(setup({effects:[...resumed(),singleTargetConfidence()]}));await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.executeConfidenceBatch).not.toHaveBeenCalled();expect(s.enrichment.evaluateHypothesisConfidence).not.toHaveBeenCalled();
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});

  it('quarantines a legacy pre-0035 completed Confidence result instead of inferring success',async()=>{const s=eligibleRun(setup({effects:[...resumed(),legacyConfidence()]}));await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.executeConfidenceBatch).not.toHaveBeenCalled();
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','CONFIDENCE_BATCH_RECOVERY');});

  it.each([
   ['a receipt for a Hypothesis outside the durable persistence list',confidenceBatchEffect([confidenceReceipt(otherId,1,evaluationId.first)])],
   ['a receipt count that does not match the persisted targets',confidenceBatchEffect([confidenceReceipt(generatedId,1,evaluationId.first),confidenceReceipt(otherId,2,evaluationId.second)])],
   ['a non-sequential ordinal',confidenceBatchEffect([confidenceReceipt(generatedId,2,evaluationId.first)])],
   ['a non-canonical evaluation identity',confidenceBatchEffect([confidenceReceipt(generatedId,1,'not-a-uuid')])],
   ['a non-positive target version',confidenceBatchEffect([confidenceReceipt(generatedId,1,evaluationId.first,{targetVersion:0})])],
   ['an extra receipt key',confidenceBatchEffect([{...confidenceReceipt(generatedId,1,evaluationId.first),extra:true}])],
   ['a reference-bearing result',singleTargetConfidence({result_reference:`memory:${id.evidence}`})],
   ['NO_CONFIDENCE_TARGETS paired with a persisted target',{effect_key:'CONFIDENCE_BATCH',state:'COMPLETED',result_code:'NO_CONFIDENCE_TARGETS',result_reference:null,result_payload:null}],
  ])('quarantines %s as an indeterminate durable batch',async(_label,confidenceRow)=>{const s=eligibleRun(setup({effects:[...resumed(),confidenceRow as never]}));await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.executeConfidenceBatch).not.toHaveBeenCalled();
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','CONFIDENCE_BATCH_RECOVERY');});

  it('reconciles a lost response from durable state: a committed typed result continues',async()=>{const s=eligibleRun(setup({effects:resumed(),confidence:null}));s.ledger.executeConfidenceBatch.mockRejectedValue(new Error('POST_RESPONSE_DATABASE_UNAVAILABLE'));
   (s.ledger.effects as jest.Mock).mockResolvedValueOnce(resumed()).mockResolvedValueOnce([...resumed(),singleTargetConfidence()]);
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});

  it('reconciles a lost response into quarantine when the committed result is malformed',async()=>{const s=eligibleRun(setup({effects:resumed(),confidence:null}));s.ledger.executeConfidenceBatch.mockRejectedValue(new Error('POST_RESPONSE_DATABASE_UNAVAILABLE'));
   (s.ledger.effects as jest.Mock).mockResolvedValueOnce(resumed()).mockResolvedValueOnce([...resumed(),legacyConfidence()]);
   await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','CONFIDENCE_BATCH_RECOVERY');});

  it('returns false for a lost response with no completed Confidence effect, leaving the Redis entry pending',async()=>{const s=eligibleRun(setup({effects:resumed(),confidence:null}));s.ledger.executeConfidenceBatch.mockRejectedValue(new Error('POST_RESPONSE_DATABASE_UNAVAILABLE'));
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(false);
   expect(s.ledger.finish).not.toHaveBeenCalled();});

  it('returns false when the ledger reread itself is unavailable',async()=>{const s=eligibleRun(setup({effects:resumed(),confidence:null}));s.ledger.executeConfidenceBatch.mockRejectedValue(new Error('POST_RESPONSE_DATABASE_UNAVAILABLE'));
   (s.ledger.effects as jest.Mock).mockResolvedValueOnce(resumed()).mockRejectedValueOnce(new Error('POST_RESPONSE_DATABASE_UNAVAILABLE'));
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(false);
   expect(s.ledger.finish).not.toHaveBeenCalled();});

  it('returns false for a NO_OP command status with no durable result rather than fabricating success',async()=>{const s=eligibleRun(setup({effects:resumed(),confidence:null}));s.ledger.executeConfidenceBatch.mockResolvedValue('NO_OP' as never);
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(false);
   expect(s.ledger.finish).not.toHaveBeenCalled();});

  it('resumes directly at Confidence after durable persistence, replaying no upstream stage',async()=>{const s=eligibleRun(setup({effects:resumed(),confidence:singleTargetConfidence()}));await s.service.dispatch(JSON.stringify(event()));
   // Envelope validation, execution acquisition, the CLAIMED check, the
   // max-attempt gate, authority, Safety and the canonical source-turn reread
   // still run; everything between them and Confidence does not.
   expect(s.enrichment.readCanonicalSourceTurn).toHaveBeenCalledTimes(1);
   expect(s.enrichment.evaluateAndWriteMemory).not.toHaveBeenCalled();expect(s.ledger.completeMemory).not.toHaveBeenCalled();
   expect(s.association.prepare).not.toHaveBeenCalled();expect(s.association.proposeAndAuthorize).not.toHaveBeenCalled();expect(s.ledger.completeAssociation).not.toHaveBeenCalled();
   expect(s.ledger.executeHypothesisUpdateBatch).not.toHaveBeenCalled();expect(s.enrichment.applyAuthorizedHypothesisUpdate).not.toHaveBeenCalled();
   expect(s.enrichment.evaluateGenerationEligibility).not.toHaveBeenCalled();expect(s.assembler.assemble).not.toHaveBeenCalled();
   expect(s.extraction.extract).not.toHaveBeenCalled();expect(s.ledger.completeIntent).not.toHaveBeenCalled();
   expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();expect(s.ledger.completeCandidateProvider).not.toHaveBeenCalled();
   expect(s.ledger.persistHypothesisGeneration).not.toHaveBeenCalled();expect(s.ledger.claim).not.toHaveBeenCalled();
   expect(s.ledger.executeConfidenceBatch).toHaveBeenCalledWith(id.execution);
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});

  it('resumes even when current-world eligibility would now skip the execution',async()=>{const s=setup({effects:resumed(),confidence:singleTargetConfidence()});
   s.enrichment.evaluateGenerationEligibility.mockResolvedValue({eligibility:{status:'NOT_ELIGIBLE',reason:'NO_TRIGGER'}} as never);
   await s.service.dispatch(JSON.stringify(event()));
   expect(s.enrichment.evaluateGenerationEligibility).not.toHaveBeenCalled();
   expect(s.ledger.finish).not.toHaveBeenCalledWith(id.execution,'SKIPPED','NOT_ELIGIBLE','ELIGIBILITY');
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});

  it.each([
   ['a missing durable Intent',[candidateEffect(),persistenceEffect()],'INTENT_RECOVERY'],
   ['a legacy null durable Intent',[intentEffect({result_code:null,result_payload:null}),candidateEffect(),persistenceEffect()],'INTENT_RECOVERY'],
   ['a durable NOT_AUTHORIZED Intent',[intentEffect({result_code:'INTENT_NOT_AUTHORIZED',result_payload:null}),candidateEffect(),persistenceEffect()],'INTENT_RECOVERY'],
   ['a malformed durable Candidate plan',[intentEffect(),candidateEffect({result_payload:{}}),persistenceEffect()],'CANDIDATE_RECOVERY'],
   ['a missing durable Candidate effect',[intentEffect(),persistenceEffect()],'HYPOTHESIS_PERSISTENCE_RECOVERY'],
   ['a reordered durable persistence list',[intentEffect(),candidateEffect({result_payload:[durableCandidate(),durableCandidate({hypothesisId:otherId,statement:'A second distinct statement.'})]}),persistenceEffect({result_payload:[otherId,generatedId]})],'HYPOTHESIS_PERSISTENCE_RECOVERY'],
  ])('quarantines %s instead of resuming, repairing or inferring',async(_label,effects,stage)=>{const s=eligibleRun(setup({effects:effects as never[],confidence:null}));await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.executeConfidenceBatch).not.toHaveBeenCalled();
   expect(s.enrichment.evaluateAndWriteMemory).not.toHaveBeenCalled();expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();expect(s.ledger.persistHypothesisGeneration).not.toHaveBeenCalled();
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT',stage);});

  it('keeps the fresh execution ordering Memory -> Association -> Update -> Eligibility -> Intent -> Candidate -> Persistence -> managed Confidence -> terminal',async()=>{
   const s=setup({confidence:singleTargetConfidence()});const commands=[updateCommand()];
   s.enrichment.evaluateAndWriteMemory.mockResolvedValue({decision:'WRITE',type:'GOAL',memoryId:id.execution,evidenceId:`memory:${id.execution}`} as never);
   s.association.prepare.mockResolvedValue({status:'PREPARED',snapshot:{} as never} as never);
   s.association.proposeAndAuthorize.mockResolvedValue({status:'AUTHORIZED',commands} as never);
   s.enrichment.evaluateGenerationEligibility.mockResolvedValue(eligible() as never);
   s.extraction.extract.mockResolvedValue({status:'AUTHORIZED',intent:intent()} as never);
   s.assembler.assemble.mockReturnValue({status:'READY',request:{problem:intent().problem.text,domain:'GENERAL',scope:intent().scope.serialized,evidenceIds:intent().evidenceIds}} as never);
   s.enrichment.generateHypothesisCandidatePlan.mockResolvedValue({code:'VALIDATED_CANDIDATES',candidates:[durableCandidate()]} as never);
   await s.service.dispatch(JSON.stringify(event()));
   const order=(mock:unknown)=>(mock as jest.Mock).mock.invocationCallOrder[0];
   const sequence=[order(s.enrichment.evaluateAndWriteMemory),order(s.association.proposeAndAuthorize),order(s.ledger.executeHypothesisUpdateBatch),order(s.enrichment.evaluateGenerationEligibility),order(s.extraction.extract),order(s.enrichment.generateHypothesisCandidatePlan),order(s.ledger.persistHypothesisGeneration),order(s.ledger.executeConfidenceBatch),order(s.ledger.finish)];
   expect(sequence).toEqual([...sequence].sort((a,b)=>a-b));
   expect(s.ledger.claim).not.toHaveBeenCalledWith(id.execution,'CONFIDENCE_BATCH');
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});

  it('treats duplicate delivery of a terminal execution as a no-op',async()=>{const s=setup({state:'COMPLETED',effects:[...resumed(),singleTargetConfidence()]});
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(s.ledger.effects).not.toHaveBeenCalled();expect(s.ledger.executeConfidenceBatch).not.toHaveBeenCalled();expect(s.ledger.finish).not.toHaveBeenCalled();});
 });

 describe('Information Gap / Question Integration v1 - idempotent gap sync',()=>{
  const resumed=()=>[intentEffect(),candidateEffect(),persistenceEffect()];
  const order=(mock:unknown)=>(mock as jest.Mock).mock.invocationCallOrder[0];
  const gapsAvailable=()=>({status:'INFORMATION_GAPS_AVAILABLE' as const,gaps:[{ordinal:1,informationGapId:'40000000-0000-4000-8000-000000000001',hypothesisId:id.user,targetVersion:5,missingInformationCode:'UNVERIFIED_ASSUMPTIONS' as const}]});
  it('syncs gaps with only the execution identity after a fresh UPDATES_APPLIED batch, BEFORE generation eligibility',async()=>{const s=setup({effects:[memoryWriteEffect(),associationEffect()]});await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.syncInformationGaps).toHaveBeenCalledTimes(1);
   expect(s.ledger.syncInformationGaps).toHaveBeenCalledWith(id.execution);
   expect(order(s.ledger.executeHypothesisUpdateBatch)).toBeLessThan(order(s.ledger.syncInformationGaps));
   expect(order(s.ledger.syncInformationGaps)).toBeLessThan(order(s.enrichment.evaluateGenerationEligibility));
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','NOT_ELIGIBLE','ELIGIBILITY');});
  it('syncs gaps after a recovered UPDATES_APPLIED batch with zero batch replay',async()=>{const s=setup({effects:[memoryWriteEffect(),associationEffect(),updateBatchEffect()]});await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.executeHypothesisUpdateBatch).not.toHaveBeenCalled();
   expect(s.ledger.syncInformationGaps).toHaveBeenCalledTimes(1);
   expect(s.ledger.syncInformationGaps).toHaveBeenCalledWith(id.execution);
   expect(order(s.ledger.syncInformationGaps)).toBeLessThan(order(s.enrichment.evaluateGenerationEligibility));});
  it('never fabricates a gap from a PENDING_RETRY receipt in app code: the sync call carries only the execution identity',async()=>{const s=setup({effects:[memoryWriteEffect(),associationEffect(),updateBatchEffect({result_payload:[updateReceipt({confidenceStatus:'PENDING_RETRY'})]})]});await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.syncInformationGaps).toHaveBeenCalledTimes(1);
   expect((s.ledger.syncInformationGaps as jest.Mock).mock.calls[0]).toEqual([id.execution]);});
  it('returns false on a post-update sync transport failure with ZERO downstream eligibility, Intent or Candidate provider work',async()=>{const s=eligibleRun(setup({effects:[memoryWriteEffect(),associationEffect()]}));(s.ledger.syncInformationGaps as jest.Mock).mockRejectedValue(new Error('POST_RESPONSE_DATABASE_UNAVAILABLE'));
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(false);
   expect(s.enrichment.evaluateGenerationEligibility).not.toHaveBeenCalled();
   expect(s.extraction.extract).not.toHaveBeenCalled();
   expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();
   expect(s.ledger.executeConfidenceBatch).not.toHaveBeenCalled();
   expect(s.ledger.finish).not.toHaveBeenCalled();});
  it('quarantines a post-update QUARANTINED sync result before any downstream provider work',async()=>{const s=eligibleRun(setup({effects:[memoryWriteEffect(),associationEffect()]}));(s.ledger.syncInformationGaps as jest.Mock).mockResolvedValue({status:'QUARANTINED',reason:'SOURCE_INTEGRITY_FAILURE'});
   await s.service.dispatch(JSON.stringify(event()));
   expect(s.enrichment.evaluateGenerationEligibility).not.toHaveBeenCalled();
   expect(s.extraction.extract).not.toHaveBeenCalled();
   expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','INFORMATION_GAP_SYNC');});
  it('continues normally on a successful no-gap post-update sync',async()=>{const s=setup({effects:[memoryWriteEffect(),associationEffect(),updateBatchEffect()]});
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','NOT_ELIGIBLE','ELIGIBILITY');});
  it('performs zero update-stage syncs when no authorized command batch exists',async()=>{const s=setup();await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.syncInformationGaps).not.toHaveBeenCalled();});
  it('orders generation Confidence -> sync -> terminal exactly, and gap availability does not change the terminal outcome',async()=>{const s=eligibleRun(setup({effects:resumed(),confidence:singleTargetConfidence()}));(s.ledger.syncInformationGaps as jest.Mock).mockResolvedValue(gapsAvailable());
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(s.ledger.syncInformationGaps).toHaveBeenCalledTimes(1);
   expect(s.ledger.syncInformationGaps).toHaveBeenCalledWith(id.execution);
   expect(order(s.ledger.executeConfidenceBatch)).toBeLessThan(order(s.ledger.syncInformationGaps));
   expect(order(s.ledger.syncInformationGaps)).toBeLessThan(order(s.ledger.finish));
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});
  it('returns false when the sync fails after durable generation Confidence: no terminal success, no ACK, zero Confidence replay on retry',async()=>{const s=eligibleRun(setup({effects:[...resumed(),singleTargetConfidence()]}));(s.ledger.syncInformationGaps as jest.Mock).mockRejectedValue(new Error('POST_RESPONSE_DATABASE_UNAVAILABLE'));
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(false);
   expect(s.ledger.executeConfidenceBatch).not.toHaveBeenCalled();
   expect(s.ledger.finish).not.toHaveBeenCalled();});
  it('quarantines a QUARANTINED sync result after generation Confidence instead of terminalizing',async()=>{const s=eligibleRun(setup({effects:resumed(),confidence:singleTargetConfidence()}));(s.ledger.syncInformationGaps as jest.Mock).mockResolvedValue({status:'QUARANTINED',reason:'SOURCE_INTEGRITY_FAILURE'});
   await s.service.dispatch(JSON.stringify(event()));
   expect(s.ledger.finish).not.toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','INFORMATION_GAP_SYNC');});
  it('redelivery with a durably completed Confidence batch runs ONLY the idempotent sync before terminal: zero upstream replay',async()=>{const s=eligibleRun(setup({effects:[...resumed(),singleTargetConfidence()]}));
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(s.ledger.executeConfidenceBatch).not.toHaveBeenCalled();
   expect(s.enrichment.evaluateAndWriteMemory).not.toHaveBeenCalled();
   expect(s.association.prepare).not.toHaveBeenCalled();expect(s.association.proposeAndAuthorize).not.toHaveBeenCalled();
   expect(s.ledger.executeHypothesisUpdateBatch).not.toHaveBeenCalled();
   expect(s.enrichment.evaluateGenerationEligibility).not.toHaveBeenCalled();
   expect(s.extraction.extract).not.toHaveBeenCalled();
   expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();
   expect(s.enrichment.readHimHypothesisGenerationContext).not.toHaveBeenCalled();
   expect(s.ledger.persistHypothesisGeneration).not.toHaveBeenCalled();
   expect(s.ledger.syncInformationGaps).toHaveBeenCalledTimes(1);
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});
  it('runs the sync exactly twice on the full fresh path: once post-update before eligibility, once post-Confidence before terminal',async()=>{const s=setup({confidence:singleTargetConfidence()});
   s.enrichment.evaluateAndWriteMemory.mockResolvedValue({decision:'WRITE',type:'GOAL',memoryId:id.execution,evidenceId:`memory:${id.execution}`} as never);
   s.association.prepare.mockResolvedValue({status:'PREPARED',snapshot:{} as never} as never);
   s.association.proposeAndAuthorize.mockResolvedValue({status:'AUTHORIZED',commands:[updateCommand()]} as never);
   s.enrichment.evaluateGenerationEligibility.mockResolvedValue(eligible() as never);
   s.extraction.extract.mockResolvedValue({status:'AUTHORIZED',intent:intent()} as never);
   s.assembler.assemble.mockReturnValue({status:'READY',request:{problem:intent().problem.text,domain:'GENERAL',scope:intent().scope.serialized,evidenceIds:intent().evidenceIds}} as never);
   s.enrichment.generateHypothesisCandidatePlan.mockResolvedValue({code:'VALIDATED_CANDIDATES',candidates:[durableCandidate()]} as never);
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(s.ledger.syncInformationGaps).toHaveBeenCalledTimes(2);
   const[firstSync,secondSync]=(s.ledger.syncInformationGaps as jest.Mock).mock.invocationCallOrder;
   expect(firstSync).toBeLessThan(order(s.enrichment.evaluateGenerationEligibility));
   expect(order(s.ledger.executeConfidenceBatch)).toBeLessThan(secondSync);
   expect(secondSync).toBeLessThan(order(s.ledger.finish));
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'COMPLETED','COMPLETED','DONE');});
  it('performs zero syncs on duplicate delivery of a terminal execution',async()=>{const s=setup({state:'COMPLETED',effects:[...resumed(),singleTargetConfidence()]});
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(s.ledger.syncInformationGaps).not.toHaveBeenCalled();expect(s.ledger.finish).not.toHaveBeenCalled();});
 });

 // QHIA-012 managed Brain Context materialization: ordering, recovery and
 // idempotency. It is the FIRST piece of work after the safety gate, so it can
 // never be lost to a later legitimate SKIP - and it is MANAGED, so it is never
 // claimed and can never strand a CLAIMED effect.
 describe('QHIA-012 Brain Context materialization',()=>{
  const order=(mock:unknown)=>(mock as jest.Mock).mock.invocationCallOrder[0];
  const resumed=()=>[intentEffect(),candidateEffect(),persistenceEffect()];
  const brainSignal=()=>({slotOrder:5,slot:'GOAL_CONSISTENCY',contextKind:'GOAL',contextId:'10000000-0000-4000-8000-0000000000c1',numericValue:2,semanticMappingStatus:'UNRESOLVED',semanticType:null,freshnessState:'UNASSESSED',confidenceState:'UNASSESSED'});
  const brainPayload=()=>({contractVersion:1,source:'QANDEEL_HIM_BRAIN_CONTEXT_MATERIALIZATION_V1',sourceTurnId:id.turn,signals:[brainSignal()]});
  const brainEffect=(overrides:Record<string,unknown>={})=>({effect_key:'HIM_BRAIN_CONTEXT_MATERIALIZATION',state:'COMPLETED',result_code:'HIM_BRAIN_CONTEXT_MATERIALIZED',result_reference:null,result_payload:brainPayload(),...overrides});
  const materialized=()=>({code:'HIM_BRAIN_CONTEXT_MATERIALIZED',payload:brainPayload()});

  it('materializes BEFORE every piece of work that can legitimately end the execution early',async()=>{
   const s=setup();
   s.enrichment.readHimBrainContextMaterialization.mockResolvedValue(materialized() as never);
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   // The turn is NOT eligible for generation, so the execution terminates
   // SKIPPED - and the Brain Context was still materialized first.
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','NOT_ELIGIBLE','ELIGIBILITY');
   expect(s.enrichment.readHimBrainContextMaterialization).toHaveBeenCalledTimes(1);
   expect(s.enrichment.readHimBrainContextMaterialization).toHaveBeenCalledWith(expect.anything(),id.execution);
   expect(s.ledger.completeHimBrainContextMaterialization).toHaveBeenCalledTimes(1);
   expect(s.ledger.completeHimBrainContextMaterialization).toHaveBeenCalledWith(id.execution,materialized());
   expect(order(s.ledger.completeHimBrainContextMaterialization)).toBeLessThan(order(s.enrichment.evaluateAndWriteMemory));
   expect(order(s.ledger.completeHimBrainContextMaterialization)).toBeLessThan(order(s.enrichment.evaluateGenerationEligibility));
   // It is MANAGED: the ordinary claim path is never used for it.
   expect((s.ledger.claim as jest.Mock).mock.calls.map(call=>call[1])).not.toContain('HIM_BRAIN_CONTEXT_MATERIALIZATION');
  });

  it('runs after event validation, execution authority, canonical source-turn verification and a confirmed ALLOW safety disposition',async()=>{
   for(const [label,envelope] of [['legacy v1',event('1.0')],['GUIDED',event('2.0','GUIDED')],['BLOCK',event('2.0','BLOCK')]] as const){
    const s=setup();
    if(label!=='legacy v1')(s.ledger.acquire as jest.Mock).mockResolvedValue({id:id.execution,event_id:id.event,user_id:id.user,session_id:id.session,source_turn_id:id.turn,event_version:'2.0',processing_path:'FAST',safety_disposition:label,state:'RUNNING',attempt_count:1});
    await expect(s.service.dispatch(JSON.stringify(envelope))).resolves.toBe(true);
    expect(s.enrichment.readHimBrainContextMaterialization).not.toHaveBeenCalled();
    expect(s.ledger.completeHimBrainContextMaterialization).not.toHaveBeenCalled();
   }
   // A canonical source-turn mismatch also stops before materialization.
   const drifted=setup();
   drifted.enrichment.readCanonicalSourceTurn.mockResolvedValue({id:id.turn,session_id:id.session,role:'USER',status:'COMPLETED',source_turn_id:null,content:'x',processing_path:'DEEP',routing_reason:'FAST_DEFAULT'} as never);
   await expect(drifted.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(drifted.enrichment.readHimBrainContextMaterialization).not.toHaveBeenCalled();
  });

  it('reuses an already-valid durable materialization with ZERO source rereads and never overwrites it',async()=>{
   const s=setup({effects:[brainEffect()]});
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(s.enrichment.readHimBrainContextMaterialization).not.toHaveBeenCalled();
   expect(s.ledger.completeHimBrainContextMaterialization).not.toHaveBeenCalled();
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','NOT_ELIGIBLE','ELIGIBILITY');
  });

  it('reuses an already-valid NO_HIM_BRAIN_CONTEXT result exactly as it reuses a materialized one',async()=>{
   const s=setup({effects:[brainEffect({result_code:'NO_HIM_BRAIN_CONTEXT',result_payload:null})]});
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(s.enrichment.readHimBrainContextMaterialization).not.toHaveBeenCalled();
   expect(s.ledger.completeHimBrainContextMaterialization).not.toHaveBeenCalled();
  });

  it('also materializes on the post-persistence Confidence resume path: a redelivery still owes the next turn its Brain Context',async()=>{
   const s=setup({effects:[...resumed(),brainEffect()],confidence:singleTargetConfidence()});
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   // The already-completed materialization is reused, and the resume still runs.
   expect(s.enrichment.readHimBrainContextMaterialization).not.toHaveBeenCalled();
   expect(s.ledger.executeConfidenceBatch).toHaveBeenCalledTimes(1);
   const fresh=setup({effects:resumed(),confidence:singleTargetConfidence()});
   fresh.enrichment.readHimBrainContextMaterialization.mockResolvedValue(materialized() as never);
   await expect(fresh.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(fresh.enrichment.readHimBrainContextMaterialization).toHaveBeenCalledTimes(1);
   expect(order(fresh.ledger.completeHimBrainContextMaterialization)).toBeLessThan(order(fresh.ledger.executeConfidenceBatch));
  });

  it('quarantines a malformed completed materialization instead of guessing or repairing it',async()=>{
   for(const malformed of [
    brainEffect({result_payload:{...brainPayload(),sourceTurnId:'10000000-0000-4000-8000-0000000000ff'}}),
    brainEffect({result_code:'HIM_BRAIN_CONTEXT_PARTIAL'}),
    brainEffect({result_payload:null}),
    brainEffect({result_code:'NO_HIM_BRAIN_CONTEXT'}),
    brainEffect({result_code:null,result_payload:null}),
   ]){
    const s=setup({effects:[malformed]});
    await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
    expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','HIM_BRAIN_CONTEXT_MATERIALIZATION');
    expect(s.enrichment.readHimBrainContextMaterialization).not.toHaveBeenCalled();
   }
  });

  it('leaves NO effect row and stays retryable when the source read fails before completion',async()=>{
   const s=setup();
   s.enrichment.readHimBrainContextMaterialization.mockRejectedValue(new Error('BACKGROUND_INTELLIGENCE_DATABASE_UNAVAILABLE'));
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(false);
   expect(s.ledger.completeHimBrainContextMaterialization).not.toHaveBeenCalled();
   expect(s.ledger.finish).not.toHaveBeenCalled();
   // Zero downstream work happened, so nothing is half-done for the retry.
   expect(s.enrichment.evaluateAndWriteMemory).not.toHaveBeenCalled();
   expect(s.ledger.claim).not.toHaveBeenCalled();
  });

  it('reconciles an AMBIGUOUS completion from durable state rather than fabricating success or failure',async()=>{
   // Committed but the response was lost: the durable reread finds the valid
   // typed result and the execution proceeds normally.
   const committed=setup();
   let effectReads=0;
   (committed.ledger.completeHimBrainContextMaterialization as jest.Mock).mockRejectedValue(new Error('POST_RESPONSE_DATABASE_UNAVAILABLE'));
   (committed.ledger.effects as jest.Mock).mockImplementation(async()=>{effectReads+=1;return effectReads===1?[]:[brainEffect()];});
   committed.enrichment.readHimBrainContextMaterialization.mockResolvedValue(materialized() as never);
   await expect(committed.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(committed.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','NOT_ELIGIBLE','ELIGIBILITY');
   // Nothing committed: no effect row exists, so the delivery stays pending for
   // the existing bounded redelivery path.
   const uncommitted=setup();
   (uncommitted.ledger.completeHimBrainContextMaterialization as jest.Mock).mockResolvedValue('NO_OP');
   uncommitted.enrichment.readHimBrainContextMaterialization.mockResolvedValue(materialized() as never);
   await expect(uncommitted.service.dispatch(JSON.stringify(event()))).resolves.toBe(false);
   expect(uncommitted.ledger.finish).not.toHaveBeenCalled();
  });

  it('quarantines a QUARANTINED command outcome and treats ALREADY_COMPLETED as materialized',async()=>{
   const quarantined=setup();
   (quarantined.ledger.completeHimBrainContextMaterialization as jest.Mock).mockResolvedValue('QUARANTINED');
   quarantined.enrichment.readHimBrainContextMaterialization.mockResolvedValue(materialized() as never);
   await expect(quarantined.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(quarantined.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','HIM_BRAIN_CONTEXT_MATERIALIZATION');
   const already=setup();
   (already.ledger.completeHimBrainContextMaterialization as jest.Mock).mockResolvedValue('ALREADY_COMPLETED');
   already.enrichment.readHimBrainContextMaterialization.mockResolvedValue(materialized() as never);
   await expect(already.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(already.ledger.finish).toHaveBeenCalledWith(id.execution,'SKIPPED','NOT_ELIGIBLE','ELIGIBILITY');
  });

  it('invokes no provider and parses no user text while materializing',async()=>{
   const s=setup();
   s.enrichment.readHimBrainContextMaterialization.mockResolvedValue(materialized() as never);
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(s.association.proposeAndAuthorize).not.toHaveBeenCalled();
   expect(s.extraction.extract).not.toHaveBeenCalled();
   expect(s.enrichment.generateHypothesisCandidatePlan).not.toHaveBeenCalled();
   expect(s.enrichment.readHimHypothesisGenerationContext).not.toHaveBeenCalled();
   // The materializer receives ONLY the issued execution context and the
   // execution identity: no turn content of any kind is passed to it.
   expect((s.enrichment.readHimBrainContextMaterialization as jest.Mock).mock.calls[0]).toHaveLength(2);
   expect((s.enrichment.readHimBrainContextMaterialization as jest.Mock).mock.calls[0][1]).toBe(id.execution);
  });

  it('a global CLAIMED effect still quarantines before any materialization work',async()=>{
   const s=setup({effects:[{effect_key:'MEMORY_WRITE',state:'CLAIMED',result_code:null,result_reference:null,result_payload:null}]});
   await expect(s.service.dispatch(JSON.stringify(event()))).resolves.toBe(true);
   expect(s.ledger.finish).toHaveBeenCalledWith(id.execution,'QUARANTINED','INDETERMINATE_EFFECT','EFFECT_RECOVERY');
   expect(s.enrichment.readHimBrainContextMaterialization).not.toHaveBeenCalled();
  });
 });
});
