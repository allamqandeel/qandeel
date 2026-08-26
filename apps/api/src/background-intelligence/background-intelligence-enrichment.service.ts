import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EVIDENCE_CANDIDATE_LIMIT, MAX_ELIGIBLE_EVIDENCE, projectEligibleEvidence } from '../memory/evidence.service';
import { MEMORY_WRITE_DUPLICATE_LOOKUP_LIMIT, MemoryWriteEvaluatorService, normalizeMemoryContent } from '../memory/memory-write-evaluator.service';
import type { MemoryWriteResult } from '../memory/memory-write.service';
import type { EvidenceItem } from '../memory/evidence.types';
import type { SafetyDisposition } from '../conversation/safety-response-gate.types';
import { HypothesisGenerationTriggerClassificationService } from '../hypothesis/hypothesis-generation-trigger-classification.service';
import type { HypothesisGenerationEligibilityAssessment } from '../hypothesis/hypothesis-generation-eligibility.types';
import { MAX_ACTIVE_HYPOTHESES, type HypothesisRecord } from '../hypothesis/hypothesis.types';
import { MAX_GENERATED_HYPOTHESIS_CANDIDATES, type HypothesisCandidateGenerator, type HypothesisGenerationInput, type HypothesisGenerationRequest } from '../hypothesis/hypothesis-generation.types';
import { hypothesisCollisionKey, normalizeGenerationInput, validateGenerationEvidenceIds, validateHypothesisCandidate } from '../hypothesis/hypothesis-generation.policy';
import type { DurableCandidateProviderResult, DurableGenerationCandidate } from '../post-response-intelligence/durable-generation-result';
import type { ConfidenceEvaluationRecord } from '../hypothesis/confidence.types';
import { validateHypothesisUpdateRequest } from '../hypothesis/hypothesis-update.policy';
import { HYPOTHESIS_UPDATE_SOURCE, type HypothesisMutationResult, type HypothesisUpdateRequest, type HypothesisUpdateResult } from '../hypothesis/hypothesis-update.types';
import { BackgroundIntelligenceExecutionContext, isBackgroundIntelligenceExecutionContext } from './background-intelligence-authority.service';
import { BACKGROUND_INTELLIGENCE_DATA_API } from './background-intelligence.types';
import { type BackgroundCanonicalSourceTurn, type BackgroundIntelligenceDataApiService } from './background-intelligence-data-api.service';

@Injectable()
export class BackgroundIntelligenceEnrichmentService {
 constructor(@Inject(BACKGROUND_INTELLIGENCE_DATA_API)private readonly data:BackgroundIntelligenceDataApiService,private readonly evaluator:MemoryWriteEvaluatorService,private readonly classifier:HypothesisGenerationTriggerClassificationService){}

 async readCanonicalSourceTurn(context:BackgroundIntelligenceExecutionContext):Promise<BackgroundCanonicalSourceTurn>{this.assert(context);const turn=await this.data.readCanonicalSourceTurn(context);if(!turn)throw new NotFoundException('Canonical source turn not found.');return turn;}

 async evaluateAndWriteMemory(context:BackgroundIntelligenceExecutionContext,currentUserContent:string):Promise<MemoryWriteResult>{
  this.assert(context);const decision=this.evaluator.evaluate(currentUserContent);if(decision.decision==='SKIP')return decision;
  const active=await this.data.listActiveMemories(context,MEMORY_WRITE_DUPLICATE_LOOKUP_LIMIT);if(active.some(memory=>memory.type===decision.candidate.type&&normalizeMemoryContent(memory.content)===normalizeMemoryContent(decision.candidate.content)))return{decision:'SKIP',reason:'EXACT_NORMALIZED_DUPLICATE',type:decision.candidate.type};
  const created=await this.data.createMemory(context,{id:randomUUID(),...decision.candidate,status:decision.candidate.status??'ACTIVE'});return{decision:'WRITE',type:decision.candidate.type,memoryId:created.id,evidenceId:`memory:${created.id}`};
 }

 async listEligibleEvidence(context:BackgroundIntelligenceExecutionContext,now=new Date()):Promise<ReadonlyArray<EvidenceItem>>{this.assert(context);return projectEligibleEvidence(context.userId,await this.data.listActiveMemories(context,EVIDENCE_CANDIDATE_LIMIT,now),now).slice(0,MAX_ELIGIBLE_EVIDENCE);}

 async listActiveHypotheses(context:BackgroundIntelligenceExecutionContext):Promise<ReadonlyArray<HypothesisRecord>>{this.assert(context);return this.data.listActiveHypotheses(context,MAX_ACTIVE_HYPOTHESES);}

 async evaluateGenerationEligibility(context:BackgroundIntelligenceExecutionContext,text:string,safetyDisposition:SafetyDisposition):Promise<HypothesisGenerationEligibilityAssessment>{
  this.assert(context);if(safetyDisposition!=='ALLOW')return{eligibility:{status:'NOT_ELIGIBLE',reason:'SAFETY_INELIGIBLE'}};
  try{const evidence=await this.listEligibleEvidence(context);if(!boundedEvidence(evidence))return{eligibility:{status:'NOT_ELIGIBLE',reason:'EVALUATION_FAILED'}};const classification=this.classifier.classify({text,safetyDisposition});if(classification.classification==='NO_TRIGGER')return{eligibility:{status:'NOT_ELIGIBLE',reason:'NO_TRIGGER'}};if(classification.classification==='AMBIGUOUS')return{eligibility:{status:'NOT_ELIGIBLE',reason:'AMBIGUOUS_TRIGGER'}};if(evidence.length===0)return{eligibility:{status:'NOT_ELIGIBLE',reason:'NO_ELIGIBLE_EVIDENCE'}};return{eligibility:{status:'ELIGIBLE',reason:'TRIGGER_AND_EVIDENCE_AVAILABLE'},triggerClassification:classification,eligibleEvidence:evidence};}catch{return{eligibility:{status:'NOT_ELIGIBLE',reason:'EVALUATION_FAILED'}};}
 }

 // Finding 08 provider stage. It preserves the exact pre-0033 generation
 // pipeline up to - and only up to - acceptance: input normalization, canonical
 // Evidence eligibility, one provider invocation, and the unchanged candidate
 // validation policy (bounds, duplicate-in-batch, active-collision,
 // Evidence-outside-request, role-conflict). The accepted proposals are then
 // canonicalized to their exact final stored form and given stable server
 // Hypothesis UUIDs, and the typed durable plan is returned WITHOUT writing a
 // single Hypothesis: all batch writes moved into the one atomic database
 // persistence command. Rejected proposals and their reasons never leave this
 // stage - only the accepted canonical plan may become durable.
 async generateHypothesisCandidatePlan(context:BackgroundIntelligenceExecutionContext,input:HypothesisGenerationInput,generator:HypothesisCandidateGenerator):Promise<DurableCandidateProviderResult>{
  this.assert(context);const {problem,domain,scope}=normalizeGenerationInput(input);validateGenerationEvidenceIds(input.evidenceIds);const eligible=await this.listEligibleEvidence(context),eligibleById=new Map(eligible.map(item=>[item.evidenceId,item])),requested=input.evidenceIds.map(id=>eligibleById.get(id));if(requested.some(item=>!item))throw new BadRequestException('Generation evidence is not currently eligible.');
  const request:HypothesisGenerationRequest={userId:context.userId,problem,domain,scope,eligibleEvidence:requested as EvidenceItem[],existingActiveHypotheses:await this.data.listActiveHypotheses(context,MAX_ACTIVE_HYPOTHESES),maxCandidateCount:MAX_GENERATED_HYPOTHESIS_CANDIDATES};const proposals=await generator.generate(request);if(!Array.isArray(proposals))throw new BadRequestException('Generator returned an invalid candidate batch.');
  const accepted:DurableGenerationCandidate[]=[],seen=new Set<string>(),active=new Set(request.existingActiveHypotheses.map(item=>hypothesisCollisionKey(item.statement,item.scope)));
  for(let index=0;index<proposals.length;index++){if(index>=request.maxCandidateCount)continue;const reason=validateHypothesisCandidate(proposals[index],request,seen,active);if(reason)continue;const proposal=proposals[index];
   accepted.push({hypothesisId:randomUUID(),statement:proposal.statement,type:proposal.type,domain:proposal.domain,scope:proposal.scope,supportingEvidenceIds:[...proposal.supportingEvidenceIds],contradictingEvidenceIds:[...proposal.contradictingEvidenceIds],assumptions:[...proposal.assumptions],disconfirmingConditions:[...proposal.disconfirmingConditions]});
   active.add(hypothesisCollisionKey(proposal.statement,proposal.scope));}
  return accepted.length===0?{code:'NO_ACCEPTED_CANDIDATES'}:{code:'VALIDATED_CANDIDATES',candidates:accepted};
 }

 async evaluateHypothesisConfidence(context:BackgroundIntelligenceExecutionContext,hypothesisId:string):Promise<ConfidenceEvaluationRecord>{this.assert(context);const hypothesis=await this.data.findHypothesis(context,hypothesisId);if(!hypothesis)throw new NotFoundException('Hypothesis not found.');return this.data.createConfidenceEvaluation(context,randomUUID(),hypothesis.id,hypothesis.version);}

 // A2.3b server-authorized Hypothesis Update invocation boundary. This is
 // capability only: the dispatcher never calls it, and nothing here consumes
 // the durable A2.3a command batch automatically - that wiring is A2.3c. The
 // request passes the SAME validator as the foreground HypothesisUpdateService,
 // the audit update UUID is generated here (never by a caller), the mutation
 // runs through the service-role background wrapper bound to the issued
 // context's user and conversation session, and the returned mutation tuple is
 // defensively re-verified before the canonical post-success Confidence
 // contract runs. A Confidence failure never replays the committed mutation:
 // the result degrades to PENDING_RETRY exactly like the foreground path.
 async applyAuthorizedHypothesisUpdate(context:BackgroundIntelligenceExecutionContext,request:HypothesisUpdateRequest):Promise<HypothesisUpdateResult>{
  this.assert(context);
  validateHypothesisUpdateRequest(request);
  const updateId=randomUUID();
  const mutation=await this.data.applyHypothesisUpdate(context,updateId,request);
  if(!mutation)throw new NotFoundException('Hypothesis update target not found.');
  if(!canonicalBackgroundMutation(mutation,context.userId,updateId,request))throw new Error('BACKGROUND_HYPOTHESIS_UPDATE_INTEGRITY');
  try{
   const confidenceEvaluation=await this.evaluateHypothesisConfidence(context,request.hypothesisId);
   return{...mutation,confidenceStatus:'EVALUATED',confidenceEvaluation};
  }catch{
   return{...mutation,confidenceStatus:'PENDING_RETRY',confidenceEvaluation:null};
  }
 }
 private assert(context:BackgroundIntelligenceExecutionContext):void{if(!isBackgroundIntelligenceExecutionContext(context))throw new Error('BACKGROUND_INTELLIGENCE_AUTHORITY_REQUIRED');}
}
function boundedEvidence(value:unknown):value is ReadonlyArray<{evidenceId:string}>{if(!Array.isArray(value)||value.length>MAX_ELIGIBLE_EVIDENCE)return false;const ids=value.map(item=>item?.evidenceId);return ids.every(id=>typeof id==='string'&&id.startsWith('memory:')&&id.length>7)&&new Set(ids).size===ids.length;}
// The returned mutation must be exactly the canonical tuple the invocation
// asked for: context owner, target Hypothesis, Evidence identity and role,
// before/after versions around the exact expected version, and the immutable
// audit source. Anything else fails closed - never a retry, never a repair.
function canonicalBackgroundMutation(mutation:HypothesisMutationResult,userId:string,updateId:string,request:HypothesisUpdateRequest):boolean{
 const{update,hypothesis}=mutation;
 return !!update&&!!hypothesis
  &&update.id===updateId
  &&update.user_id===userId&&hypothesis.user_id===userId
  &&update.hypothesis_id===request.hypothesisId&&hypothesis.id===request.hypothesisId
  &&update.evidence_id===request.evidenceId
  &&update.evidence_role===request.evidenceRole
  &&update.before_version===request.expectedVersion
  &&update.after_version===request.expectedVersion+1
  &&hypothesis.version===update.after_version
  &&update.source===HYPOTHESIS_UPDATE_SOURCE;
}
