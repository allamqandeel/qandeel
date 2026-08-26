import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { projectHimIntelligenceSnapshot } from '../human-model/him-intelligence-snapshot.projector';
import { HimReasoningConsumptionService } from '../human-model/him-reasoning-consumption.service';
import { projectHimHypothesisGenerationContext, type HimHypothesisGenerationContext } from '../hypothesis/him-hypothesis-generation-context';
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
import { isCanonicalHypothesisUpdateMutation, validateHypothesisUpdateRequest } from '../hypothesis/hypothesis-update.policy';
import type { HypothesisUpdateRequest, HypothesisUpdateResult } from '../hypothesis/hypothesis-update.types';
import { BackgroundIntelligenceExecutionContext, isBackgroundIntelligenceExecutionContext } from './background-intelligence-authority.service';
import { BACKGROUND_INTELLIGENCE_DATA_API } from './background-intelligence.types';
import { type BackgroundCanonicalSourceTurn, type BackgroundIntelligenceDataApiService } from './background-intelligence-data-api.service';

@Injectable()
export class BackgroundIntelligenceEnrichmentService {
 constructor(@Inject(BACKGROUND_INTELLIGENCE_DATA_API)private readonly data:BackgroundIntelligenceDataApiService,private readonly evaluator:MemoryWriteEvaluatorService,private readonly classifier:HypothesisGenerationTriggerClassificationService,private readonly himReasoning:HimReasoningConsumptionService){}

 // HIM Runtime Consumption v1: the ONE high-level background HIM boundary. It
 // reads canonical CONVERSATION_SESSION source rows through the narrow
 // service-role data boundary, canonicalizes them with the SAME shared
 // snapshot projector the foreground uses, reuses the existing canonical HIM
 // reasoning semantics, and maps only the minimal provider-facing fields. Any
 // read/integrity failure throws - it is NEVER fabricated as EMPTY or as a
 // silently-omitted context - while a genuinely EMPTY canonical snapshot
 // proceeds as three explicit UNKNOWN metrics. Read/consume only: no HIM
 // mutation, no Evidence, no lifecycle, no Confidence.
 async readHimHypothesisGenerationContext(context:BackgroundIntelligenceExecutionContext):Promise<HimHypothesisGenerationContext>{
  this.assert(context);
  const rows=await this.data.readHimConversationSnapshot(context);
  const snapshot=projectHimIntelligenceSnapshot('CONVERSATION_SESSION',context.sessionId,rows);
  return projectHimHypothesisGenerationContext(this.himReasoning.transform(snapshot));
 }

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
 // HIM Runtime Consumption v1: the optional himContext is minimized advisory
 // structured state attached to the SAME single provider request - it adds no
 // provider call, no Evidence identity, no persistence field, and no change to
 // input normalization, Evidence eligibility, or the validation policy.
 async generateHypothesisCandidatePlan(context:BackgroundIntelligenceExecutionContext,input:HypothesisGenerationInput,generator:HypothesisCandidateGenerator,himContext?:HimHypothesisGenerationContext):Promise<DurableCandidateProviderResult>{
  this.assert(context);const {problem,domain,scope}=normalizeGenerationInput(input);validateGenerationEvidenceIds(input.evidenceIds);const eligible=await this.listEligibleEvidence(context),eligibleById=new Map(eligible.map(item=>[item.evidenceId,item])),requested=input.evidenceIds.map(id=>eligibleById.get(id));if(requested.some(item=>!item))throw new BadRequestException('Generation evidence is not currently eligible.');
  const request:HypothesisGenerationRequest={userId:context.userId,problem,domain,scope,eligibleEvidence:requested as EvidenceItem[],existingActiveHypotheses:await this.data.listActiveHypotheses(context,MAX_ACTIVE_HYPOTHESES),maxCandidateCount:MAX_GENERATED_HYPOTHESIS_CANDIDATES,...(himContext?{himContext}:{})};const proposals=await generator.generate(request);if(!Array.isArray(proposals))throw new BadRequestException('Generator returned an invalid candidate batch.');
  const accepted:DurableGenerationCandidate[]=[],seen=new Set<string>(),active=new Set(request.existingActiveHypotheses.map(item=>hypothesisCollisionKey(item.statement,item.scope)));
  for(let index=0;index<proposals.length;index++){if(index>=request.maxCandidateCount)continue;const reason=validateHypothesisCandidate(proposals[index],request,seen,active);if(reason)continue;const proposal=proposals[index];
   accepted.push({hypothesisId:randomUUID(),statement:proposal.statement,type:proposal.type,domain:proposal.domain,scope:proposal.scope,supportingEvidenceIds:[...proposal.supportingEvidenceIds],contradictingEvidenceIds:[...proposal.contradictingEvidenceIds],assumptions:[...proposal.assumptions],disconfirmingConditions:[...proposal.disconfirmingConditions]});
   active.add(hypothesisCollisionKey(proposal.statement,proposal.scope));}
  return accepted.length===0?{code:'NO_ACCEPTED_CANDIDATES'}:{code:'VALIDATED_CANDIDATES',candidates:accepted};
 }

 async evaluateHypothesisConfidence(context:BackgroundIntelligenceExecutionContext,hypothesisId:string):Promise<ConfidenceEvaluationRecord>{this.assert(context);const hypothesis=await this.data.findHypothesis(context,hypothesisId);if(!hypothesis)throw new NotFoundException('Hypothesis not found.');return this.data.createConfidenceEvaluation(context,randomUUID(),hypothesis.id,hypothesis.version);}

 // Exact-version post-update Confidence (Finding 09, QAN-AUD-07). The target
 // version is the caller's authoritative mutation.update.after_version: this
 // method never calls findHypothesis to rediscover a newer target, sends the
 // EXACT version to the canonical service-role Confidence command (whose
 // stale-version guard stays the final authority), fails closed when no
 // evaluation comes back, and defensively re-verifies the returned owner,
 // target, type, version and provenance before trusting it. The general
 // latest-version evaluateHypothesisConfidence above is preserved unchanged
 // for the generation Confidence Batch.
 async evaluateHypothesisConfidenceVersion(context:BackgroundIntelligenceExecutionContext,hypothesisId:string,targetVersion:number):Promise<ConfidenceEvaluationRecord>{
  this.assert(context);
  if(!Number.isSafeInteger(targetVersion)||targetVersion<1)throw new BadRequestException('Invalid confidence target version.');
  const evaluation=await this.data.createConfidenceEvaluation(context,randomUUID(),hypothesisId,targetVersion);
  if(!evaluation)throw new NotFoundException('Hypothesis not found.');
  if(evaluation.user_id!==context.userId||evaluation.target_id!==hypothesisId||evaluation.target_type!=='HYPOTHESIS'
   ||evaluation.target_version!==targetVersion||evaluation.provenance!=='QANDEEL_CONFIDENCE_RUNTIME')throw new Error('BACKGROUND_CONFIDENCE_INTEGRITY');
  return evaluation;
 }

 // A2.3b server-authorized Hypothesis Update invocation boundary. This is
 // capability only: the dispatcher never calls it, and nothing here consumes
 // the durable A2.3a command batch automatically - that wiring is A2.3c. The
 // request passes the SAME validator as the foreground HypothesisUpdateService,
 // the audit update UUID is generated here (never by a caller), the mutation
 // runs through the service-role background wrapper bound to the issued
 // context's user and conversation session, and the returned mutation tuple is
 // defensively re-verified through the shared canonical integrity policy
 // before the canonical post-success Confidence contract runs. Since Finding
 // 09, that Confidence targets EXACTLY mutation.update.after_version - never a
 // later ID-only re-read - so a racing later update can never be evaluated on
 // this mutation's behalf. A Confidence failure never replays the committed
 // mutation: the result degrades to PENDING_RETRY exactly like the foreground
 // path.
 async applyAuthorizedHypothesisUpdate(context:BackgroundIntelligenceExecutionContext,request:HypothesisUpdateRequest):Promise<HypothesisUpdateResult>{
  this.assert(context);
  validateHypothesisUpdateRequest(request);
  const updateId=randomUUID();
  const mutation=await this.data.applyHypothesisUpdate(context,updateId,request);
  if(!mutation)throw new NotFoundException('Hypothesis update target not found.');
  if(!isCanonicalHypothesisUpdateMutation(mutation,context.userId,updateId,request))throw new Error('BACKGROUND_HYPOTHESIS_UPDATE_INTEGRITY');
  try{
   const confidenceEvaluation=await this.evaluateHypothesisConfidenceVersion(context,request.hypothesisId,mutation.update.after_version);
   return{...mutation,confidenceStatus:'EVALUATED',confidenceEvaluation};
  }catch{
   return{...mutation,confidenceStatus:'PENDING_RETRY',confidenceEvaluation:null};
  }
 }
 private assert(context:BackgroundIntelligenceExecutionContext):void{if(!isBackgroundIntelligenceExecutionContext(context))throw new Error('BACKGROUND_INTELLIGENCE_AUTHORITY_REQUIRED');}
}
function boundedEvidence(value:unknown):value is ReadonlyArray<{evidenceId:string}>{if(!Array.isArray(value)||value.length>MAX_ELIGIBLE_EVIDENCE)return false;const ids=value.map(item=>item?.evidenceId);return ids.every(id=>typeof id==='string'&&id.startsWith('memory:')&&id.length>7)&&new Set(ids).size===ids.length;}
