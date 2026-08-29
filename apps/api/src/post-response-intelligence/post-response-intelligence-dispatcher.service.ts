import{randomUUID}from'node:crypto';import{Inject,Injectable}from'@nestjs/common';import{BackgroundIntelligenceAuthorityService}from'../background-intelligence/background-intelligence-authority.service';import type{BackgroundIntelligenceExecutionContext}from'../background-intelligence/background-intelligence-authority.service';import{BackgroundIntelligenceEnrichmentService}from'../background-intelligence/background-intelligence-enrichment.service';import{HypothesisGenerationIntentExtractionService}from'../hypothesis/hypothesis-generation-intent-extraction.service';import type{AuthorizedHypothesisGenerationIntent}from'../hypothesis/hypothesis-generation-intent-authority.types';import{HypothesisGenerationRequestAssemblerService}from'../hypothesis/hypothesis-generation-request-assembler.service';import{HYPOTHESIS_CANDIDATE_GENERATOR,type BoundHypothesisCandidateGenerator}from'../hypothesis/hypothesis-candidate-generator-provider.types';import type{HimHypothesisGenerationContext}from'../hypothesis/him-hypothesis-generation-context';import type{HypothesisEvidenceAssociationSnapshot}from'../hypothesis/hypothesis-evidence-association.types';import{isValidRuntimeEventEnvelope,type RuntimeEventEnvelope}from'../runtime-events/runtime-event.types';import{recoverAssociationResult,toDurableAssociationResult}from'./durable-association-result';import type{AssociationRecovery,DurableAssociationResult}from'./durable-association-result';import{recoverConfidenceBatchResult}from'./durable-confidence-batch-result';import{recoverCandidateProviderResult,recoverHypothesisPersistenceResult}from'./durable-generation-result';import type{CandidateProviderRecovery,DurableCandidateProviderResult}from'./durable-generation-result';import{recoverHimBrainContextResult}from'./durable-him-brain-context-result';import type{DurableHimBrainContextResult}from'./durable-him-brain-context-result';import{recoverHypothesisUpdateBatchResult}from'./durable-hypothesis-update-batch-result';import{recoverDurableIntentProviderResult}from'./durable-intent-provider-result';import{ModelAssistedHypothesisAssociationService}from'./model-assisted-hypothesis-association.service';import{PostResponseIntelligenceRepository}from'./post-response-intelligence.repository';import type{ConfidenceBatchCommandStatus,HimBrainContextCommandStatus,IntelligenceEffect,IntelligenceEffectState,IntelligenceExecution}from'./post-response-intelligence.types';

@Injectable()
export class PostResponseIntelligenceDispatcherService{
 constructor(private readonly ledger:PostResponseIntelligenceRepository,private readonly authority:BackgroundIntelligenceAuthorityService,private readonly enrichment:BackgroundIntelligenceEnrichmentService,private readonly extraction:HypothesisGenerationIntentExtractionService,private readonly assembler:HypothesisGenerationRequestAssemblerService,@Inject(HYPOTHESIS_CANDIDATE_GENERATOR)private readonly generator:BoundHypothesisCandidateGenerator,private readonly association:ModelAssistedHypothesisAssociationService){}
 async dispatch(raw:string):Promise<boolean>{let event:RuntimeEventEnvelope;try{event=JSON.parse(raw)as RuntimeEventEnvelope;}catch{return true;}if(!isValidRuntimeEventEnvelope(event))return true;if(event.event_type!=='ConversationTurnCompleted')return true;const v2=event.event_version==='2.0';const execution=await this.ledger.acquire({id:randomUUID(),eventId:event.event_id,userId:event.subject_user_id,sessionId:event.subject_session_id,sourceTurnId:event.subject_turn_id,eventVersion:event.event_version,processingPath:(event.payload.processing_path??null)as'FAST'|'DEEP'|null,safetyDisposition:v2?event.payload.safety_disposition as'ALLOW'|'GUIDED'|'BLOCK':null});if(execution.state!=='RUNNING')return true;const effects=await this.ledger.effects(execution.id);if(effects.some(effect=>effect.state==='CLAIMED'))return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','EFFECT_RECOVERY');if(execution.attempt_count>=5)return this.terminal(execution,'QUARANTINED','MAX_ATTEMPTS','DELIVERY');if(!v2)return this.terminal(execution,'SKIPPED','LEGACY_UNSUPPORTED','VALIDATION');const authorized=await this.authority.authorize(event);if(authorized.outcome!=='AUTHORIZED'||!authorized.context)return this.terminal(execution,'QUARANTINED',authorized.outcome==='NOT_AUTHORIZED_OWNER_MISMATCH'?'CANONICAL_MISMATCH':'AUTHORITY_REJECTED','AUTHORITY');if(execution.safety_disposition!=='ALLOW')return this.terminal(execution,'SKIPPED','SAFETY_SKIPPED','SAFETY');const context=authorized.context;const turn=await this.enrichment.readCanonicalSourceTurn(context);if(turn.processing_path!==execution.processing_path)return this.terminal(execution,'QUARANTINED','CANONICAL_MISMATCH','CANONICAL_REREAD');
  const completed=new Set(effects.filter(effect=>effect.state==='COMPLETED').map(effect=>effect.effect_key));
  // QHIA-012 Brain Context materialization runs HERE - after event validation,
  // execution acquisition, canonical execution authority, canonical source-turn
  // verification and a confirmed ALLOW safety disposition, and BEFORE every
  // piece of work that can legitimately end this execution early: the Memory
  // write, Association, the automatic Hypothesis Update batch, the Information
  // Gap sync, generation eligibility, the Intent and Candidate providers,
  // persistence and the Confidence batch.
  //
  // The ordering is the whole point. Brain Context is a background human
  // intelligence bridge for the NEXT turn, and it must not disappear merely
  // because this turn's Hypothesis generation is not eligible, its Intent is not
  // authorized, or its assembly is not ready - all of which are normal SKIPPED
  // outcomes that would otherwise return long before any materialization
  // happened. It also runs ahead of the post-persistence Confidence resume, so a
  // redelivered execution that already persisted its generated Hypotheses still
  // materializes the Brain Context it owes the next turn.
  const brainContext=await this.materializeHimBrainContext(execution,effects,context);
  if(brainContext==='FAILED')return false;
  if(brainContext==='QUARANTINED')return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','HIM_BRAIN_CONTEXT_MATERIALIZATION');
  if(brainContext==='MATERIALIZED')completed.add('HIM_BRAIN_CONTEXT_MATERIALIZATION');
  // QAN-AUD-06 post-persistence durable resume. Once generation persistence is
  // durably COMPLETED, the only work this execution can still owe is the
  // managed Confidence batch, so a redelivery rebuilds the generation result
  // from the durable Intent -> Candidate -> Persistence chain and resumes
  // directly at Confidence. It reruns NO Memory write, NO Association
  // preparation or provider, NO automatic Hypothesis Update, NO eligibility
  // recomputation, NO Intent or Candidate provider and NO persistence write -
  // otherwise a world change between the original persistence and the retry
  // could terminate the execution SKIPPED and strand a durable generated
  // Hypothesis without its required Confidence evaluation. Missing, legacy,
  // malformed, foreign, reordered or inconsistent durable generation state
  // quarantines: nothing is inferred or repaired from current Hypothesis rows.
  if(completed.has('HYPOTHESIS_PERSISTENCE'))return this.resumeGenerationConfidence(execution,effects);
  const persistedMemory=effects.find(effect=>effect.effect_key==='MEMORY_WRITE'&&effect.state==='COMPLETED');let freshEvidenceId:string|undefined;
  if(persistedMemory){if(persistedMemory.result_code==='NO_FRESH_EVIDENCE'&&persistedMemory.result_reference===null){}else if(persistedMemory.result_code==='FRESH_EVIDENCE_CREATED'&&validEvidenceReference(persistedMemory.result_reference))freshEvidenceId=persistedMemory.result_reference;else return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','ASSOCIATION_RECOVERY');}
  else{if(!await this.ledger.claim(execution.id,'MEMORY_WRITE'))return true;try{const result=await this.enrichment.evaluateAndWriteMemory(context,turn.content);if(!await this.ledger.completeMemory(execution.id,result))return true;completed.add('MEMORY_WRITE');if(result.decision==='WRITE')freshEvidenceId=result.evidenceId;}catch{return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','MEMORY_WRITE');}}
  // A durably COMPLETED ASSOCIATION_PROVIDER carries its own post-authority result, so a redelivery recovers the exact NO_ASSOCIATION or authorized command batch instead of losing it with the process. Recovery is deterministic: a legacy result-less completion, a malformed payload, or a payload bound to different Evidence is INDETERMINATE and quarantines - never a provider replay, never inference. Fresh and recovered Association converge on the same durable-equivalent value, which A2.3c consumes below.
  if(!freshEvidenceId&&completed.has('ASSOCIATION_PROVIDER'))return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','ASSOCIATION_RECOVERY');
  let association:Exclude<AssociationRecovery,{status:'INDETERMINATE'}>|undefined;
  if(freshEvidenceId){if(completed.has('ASSOCIATION_PROVIDER')){const recovered=recoverAssociationResult(effects.find(effect=>effect.effect_key==='ASSOCIATION_PROVIDER')!,freshEvidenceId);if(recovered.status==='INDETERMINATE')return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','ASSOCIATION_RECOVERY');association=recovered;}else{const preparation=await this.association.prepare(context,freshEvidenceId);if(preparation.status==='NOT_AUTHORIZED')return this.terminal(execution,'QUARANTINED','AUTHORITY_REJECTED','ASSOCIATION_PREPARATION');if(preparation.status==='PREPARED'){const durable=await this.completeAssociation(execution,completed,event,context,preparation.snapshot);if(!durable)return true;association=durable.code==='NO_ASSOCIATION'?{status:'NO_ASSOCIATION'}:{status:'AUTHORIZED_COMMANDS',commands:durable.commands};}}}
  // A2.3c: the durable authorized command batch is consumed automatically - and
  // exactly once - by the ONE managed database command, BEFORE the generation
  // provider reads active Hypotheses. The application never claims the managed
  // effect, never loops the process-level update boundary, and never sends the
  // command payload: it supplies only fresh audit/evaluation UUID identities,
  // and the database derives user/session from the execution and the commands
  // from the durable A2.3a result, committing claim + mutations + exact-version
  // Confidence + the immutable receipt in one transaction. A completed
  // UPDATES_APPLIED redelivery recovers the exact receipts with zero mutation,
  // zero Confidence and zero provider calls; UPDATES_REJECTED, a malformed
  // receipt, a batch coexisting with NO_ASSOCIATION, or an impossible CLAIMED
  // row quarantines - never a replay.
  const persistedUpdateBatch=effects.find(effect=>effect.effect_key==='HYPOTHESIS_UPDATE_BATCH'&&effect.state==='COMPLETED');
  if(!association||association.status==='NO_ASSOCIATION'){if(persistedUpdateBatch)return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_UPDATE_BATCH_RECOVERY');}
  else if(persistedUpdateBatch){if(recoverHypothesisUpdateBatchResult(persistedUpdateBatch,association.commands).status!=='UPDATES_APPLIED')return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_UPDATE_BATCH_RECOVERY');}
  else{const invocationIds=association.commands.map(()=>({updateId:randomUUID(),confidenceEvaluationId:randomUUID()}));
   let executed=false;try{executed=await this.ledger.executeHypothesisUpdateBatch(execution.id,invocationIds);}catch{executed=false;}
   if(!executed){
    // The managed command is atomic but HTTP transport is not: a lost response
    // may follow a committed transaction. Reconcile from durable state before
    // acting - never blindly replay, never blindly quarantine.
    let reread:readonly IntelligenceEffectState[];try{reread=await this.ledger.effects(execution.id);}catch{return false;}
    const durableBatch=reread.find(effect=>effect.effect_key==='HYPOTHESIS_UPDATE_BATCH');
    if(!durableBatch)return false;
    if(durableBatch.state!=='COMPLETED')return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_UPDATE_BATCH');
    if(recoverHypothesisUpdateBatchResult(durableBatch,association.commands).status!=='UPDATES_APPLIED')return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_UPDATE_BATCH_RECOVERY');
   }}
  // Information Gap / Question Integration v1: once a successful or recovered
  // UPDATES_APPLIED batch exists, its exact-version EVALUATED Confidence
  // receipts are synchronized into the frozen Information Gap Runtime BEFORE
  // any downstream Intent/Candidate provider activity. The command receives
  // ONLY the execution identity and derives/validates every source itself; a
  // PENDING_RETRY receipt is never fabricated into a gap. A transport failure
  // returns non-terminal (zero downstream provider work) so the existing
  // bounded redelivery recovers the completed batch and reruns the idempotent
  // sync - never replaying the mutation or its Confidence evaluations; a
  // QUARANTINED sync result fails closed.
  if(association&&association.status==='AUTHORIZED_COMMANDS'){
   const gapSync=await this.syncInformationGaps(execution);
   if(gapSync==='FAILED')return false;
   if(gapSync==='QUARANTINED')return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','INFORMATION_GAP_SYNC');
  }
  const assessment=await this.enrichment.evaluateGenerationEligibility(context,turn.content,'ALLOW');if(!('triggerClassification'in assessment))return this.terminal(execution,'SKIPPED','NOT_ELIGIBLE','ELIGIBILITY');
  // A durably COMPLETED INTENT_PROVIDER carries its own post-authority result, so a redelivery recovers the exact authorized intent instead of losing it with the process and false-skipping. A fresh run persists the typed result atomically with completion before consuming it.
  const persistedIntent=effects.find(effect=>effect.effect_key==='INTENT_PROVIDER'&&effect.state==='COMPLETED');let intent:AuthorizedHypothesisGenerationIntent;
  if(persistedIntent){const recovered=recoverDurableIntentProviderResult(persistedIntent,execution);if(recovered.status==='INDETERMINATE')return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','INTENT_RECOVERY');if(recovered.status==='NOT_AUTHORIZED')return this.terminal(execution,'SKIPPED','INTENT_NOT_AUTHORIZED','INTENT');intent=recovered.intent;}
  else{if(!await this.ledger.claim(execution.id,'INTENT_PROVIDER'))return true;let extracted:Awaited<ReturnType<HypothesisGenerationIntentExtractionService['extract']>>;try{extracted=await this.extraction.extract({currentTurn:{id:turn.id,sessionId:turn.session_id,role:'USER',status:'COMPLETED',text:turn.content},eligibility:assessment.eligibility,triggerReason:assessment.triggerClassification.reason,eligibleEvidence:assessment.eligibleEvidence});}catch{await this.ledger.finish(execution.id,'QUARANTINED','INDETERMINATE_EFFECT','INTENT_PROVIDER');return true;}
   if(!await this.ledger.completeIntent(execution.id,extracted))return true;completed.add('INTENT_PROVIDER');if(extracted.status!=='AUTHORIZED')return this.terminal(execution,'SKIPPED','INTENT_NOT_AUTHORIZED','INTENT');intent=extracted.intent;}
  const assembled=this.assembler.assemble(intent);if(assembled.status!=='READY')return this.terminal(execution,'SKIPPED','ASSEMBLY_NOT_READY','ASSEMBLY');
  // Finding 08: generation is sequential, typed and durable. The Candidate
  // stage persists the exact post-validation canonical plan (stable Hypothesis
  // UUIDs assigned before completion) atomically with CLAIMED -> COMPLETED, so
  // a redelivery recovers the exact plan with zero provider calls instead of
  // losing it with the process. A completed Candidate with no Persistence
  // effect is a VALID recoverable state and continues straight to persistence.
  // Legacy result-less, malformed or intent-mismatched durable results are
  // INDETERMINATE and quarantine - never a provider replay, never inference,
  // never replacement IDs.
  const persistedCandidate=effects.find(effect=>effect.effect_key==='CANDIDATE_PROVIDER'&&effect.state==='COMPLETED');let candidate:Exclude<CandidateProviderRecovery,{status:'INDETERMINATE'}>;
  if(persistedCandidate){const recovered=recoverCandidateProviderResult(persistedCandidate,intent);if(recovered.status==='INDETERMINATE')return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','CANDIDATE_RECOVERY');candidate=recovered;}
  else{if(completed.has('HYPOTHESIS_PERSISTENCE'))return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_PERSISTENCE_RECOVERY');
   // HIM Runtime Consumption v1: the canonical session HIM snapshot is read,
   // canonically projected and minimized BEFORE CANDIDATE_PROVIDER is claimed,
   // so a HIM read/integrity/database failure can never strand the effect
   // CLAIMED before the provider was even invoked. A failure here claims
   // nothing, calls no provider, fabricates no EMPTY/UNKNOWN state, and
   // returns non-terminal (non-ACK) so the existing bounded delivery-attempt
   // policy retries and, when exhausted, the existing MAX_ATTEMPTS handling
   // quarantines. A valid EMPTY snapshot is NOT a failure: it arrives as three
   // explicit UNKNOWN metrics and the single provider call proceeds. Durable
   // recovery paths above/below never reach this read.
   let himContext:HimHypothesisGenerationContext;try{himContext=await this.enrichment.readHimHypothesisGenerationContext(context);}catch{return false;}
   if(!await this.ledger.claim(execution.id,'CANDIDATE_PROVIDER'))return true;let plan:DurableCandidateProviderResult;try{plan=await this.enrichment.generateHypothesisCandidatePlan(context,assembled.request,this.generator,himContext);}catch{return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','CANDIDATE_PROVIDER');}
   if(!await this.ledger.completeCandidateProvider(execution.id,plan))return true;completed.add('CANDIDATE_PROVIDER');candidate=plan.code==='NO_ACCEPTED_CANDIDATES'?{status:'NO_ACCEPTED_CANDIDATES'}:{status:'VALIDATED_CANDIDATES',candidates:plan.candidates};}
  // Persistence is ONE atomic database command: every create/attach/link write
  // and the HYPOTHESIS_PERSISTENCE completion (with the exact ordered persisted
  // Hypothesis UUID list) commit in one transaction, so a mid-batch failure -
  // an Evidence turned ineligible included - rolls back the entire generated
  // graph and the effect stays CLAIMED for the fail-closed quarantine path.
  // The application performs no create/attach/link loop of its own, and the
  // downstream accepted set is the exact durable persisted-ID result on fresh
  // AND recovered executions: a completed generation retry can never silently
  // collapse to accepted=[].
  const persistedPersistence=effects.find(effect=>effect.effect_key==='HYPOTHESIS_PERSISTENCE'&&effect.state==='COMPLETED');let acceptedHypothesisIds:readonly string[];
  if(persistedPersistence){const recovered=recoverHypothesisPersistenceResult(persistedPersistence,candidate);if(recovered.status==='INDETERMINATE')return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_PERSISTENCE_RECOVERY');acceptedHypothesisIds=recovered.hypothesisIds;}
  else{if(!await this.ledger.claim(execution.id,'HYPOTHESIS_PERSISTENCE'))return true;try{if(!await this.ledger.persistHypothesisGeneration(execution.id))return true;}catch{return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_PERSISTENCE');}
   completed.add('HYPOTHESIS_PERSISTENCE');acceptedHypothesisIds=candidate.status==='VALIDATED_CANDIDATES'?candidate.candidates.map(item=>item.hypothesisId):[];}
  return this.confidenceBatch(execution,effects,acceptedHypothesisIds);}
 // The managed QHIA-012 Brain Context materialization stage.
 //
 // There is no application-level claim and no generic completion: the
 // application reads the ONE execution-bound source RPC, projects it through the
 // SHARED QHIA-004 projection, and issues ONE atomic typed completion command
 // that inserts the effect DIRECTLY as COMPLETED. Because nothing is ever
 // claimed, a crash anywhere between the source read and the completion simply
 // leaves no effect row - a fully recoverable state the next redelivery redoes -
 // rather than an irrecoverable stranded CLAIMED materialization.
 //
 // An already-valid durable result is REUSED with zero HIM rereads and zero
 // source requests, and is never overwritten: the first durable result is
 // immutable. A malformed or impossible completed materialization fails closed
 // as INDETERMINATE under the existing durable-effect integrity convention. A
 // source-read failure returns non-terminal with no effect row written, so the
 // existing bounded delivery-attempt policy retries and, when exhausted, the
 // existing MAX_ATTEMPTS handling quarantines. An ambiguous completion response
 // is reconciled from durable state - never fabricated from an HTTP outcome.
 //
 // No provider, model router, LLM, embedding or reranker is invoked here, and no
 // user text is parsed: slot and context selection are entirely server-derived
 // from the frozen registry and the exact ACTIVE QHIA-006 bindings.
 private async materializeHimBrainContext(execution:IntelligenceExecution,effects:readonly IntelligenceEffectState[],context:BackgroundIntelligenceExecutionContext):Promise<'MATERIALIZED'|'QUARANTINED'|'FAILED'>{
  const persisted=effects.find(effect=>effect.effect_key==='HIM_BRAIN_CONTEXT_MATERIALIZATION');
  if(persisted){
   // A CLAIMED Brain row is unrepresentable under the migration-0061 result
   // domain and is already caught by the global fail-closed rule above; this
   // branch is defence in depth, never a normal path.
   if(persisted.state!=='COMPLETED')return'QUARANTINED';
   return recoverHimBrainContextResult(persisted,execution.source_turn_id).status==='INDETERMINATE'?'QUARANTINED':'MATERIALIZED';
  }
  let result:DurableHimBrainContextResult;
  try{result=await this.enrichment.readHimBrainContextMaterialization(context,execution.id);}catch{return'FAILED';}
  let status:HimBrainContextCommandStatus;
  try{status=await this.ledger.completeHimBrainContextMaterialization(execution.id,result);}catch{status='NO_OP';}
  if(status==='COMPLETED'||status==='ALREADY_COMPLETED')return'MATERIALIZED';
  if(status==='QUARANTINED')return'QUARANTINED';
  // The managed command is atomic but HTTP transport is not: a lost response may
  // follow a committed transaction. Reconcile from durable state before acting -
  // never blindly replay, never blindly quarantine.
  let reread:readonly IntelligenceEffectState[];try{reread=await this.ledger.effects(execution.id);}catch{return'FAILED';}
  const durable=reread.find(effect=>effect.effect_key==='HIM_BRAIN_CONTEXT_MATERIALIZATION');
  if(!durable)return'FAILED';
  if(durable.state!=='COMPLETED')return'QUARANTINED';
  return recoverHimBrainContextResult(durable,execution.source_turn_id).status==='INDETERMINATE'?'QUARANTINED':'MATERIALIZED';}
 // QAN-AUD-06 post-persistence resume. It rebuilds the exact generation result
 // from durable state ONLY, using the same pure recovery functions the fresh
 // path uses, and never touches a provider, a Hypothesis row or an upstream
 // effect. Any gap in the durable chain is indeterminate and quarantines under
 // the existing stage vocabulary.
 private async resumeGenerationConfidence(execution:IntelligenceExecution,effects:readonly IntelligenceEffectState[]):Promise<boolean>{
  const persistedIntent=effects.find(effect=>effect.effect_key==='INTENT_PROVIDER'&&effect.state==='COMPLETED');
  if(!persistedIntent)return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','INTENT_RECOVERY');
  const intent=recoverDurableIntentProviderResult(persistedIntent,execution);
  if(intent.status!=='AUTHORIZED')return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','INTENT_RECOVERY');
  // A completed persistence with no completed Candidate effect is the same
  // broken generation chain the fresh path already quarantines under
  // HYPOTHESIS_PERSISTENCE_RECOVERY; the label is preserved exactly.
  const persistedCandidate=effects.find(effect=>effect.effect_key==='CANDIDATE_PROVIDER'&&effect.state==='COMPLETED');
  if(!persistedCandidate)return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_PERSISTENCE_RECOVERY');
  const candidate=recoverCandidateProviderResult(persistedCandidate,intent.intent);
  if(candidate.status==='INDETERMINATE')return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','CANDIDATE_RECOVERY');
  const persistence=recoverHypothesisPersistenceResult(effects.find(effect=>effect.effect_key==='HYPOTHESIS_PERSISTENCE'&&effect.state==='COMPLETED')!,candidate);
  if(persistence.status==='INDETERMINATE')return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','HYPOTHESIS_PERSISTENCE_RECOVERY');
  return this.confidenceBatch(execution,effects,persistence.hypothesisIds);}
 // The managed QAN-AUD-06 Confidence stage. There is no application-level
 // per-target loop and no generic claim/completion: the application supplies
 // only the execution identity, and the database freezes the exact target
 // versions, owns the stable evaluation identities, evaluates only unfinished
 // items through the canonical Confidence boundary and completes the typed
 // effect ONLY when every target has a valid result. A durably completed batch
 // is recovered with zero Confidence replay; RETRY_PENDING returns false so the
 // Redis entry stays pending for the existing bounded reclaim path and the
 // execution is NOT finished; QUARANTINED fails closed; and an ambiguous
 // transport outcome is reconciled from durable state - never fabricated from
 // an HTTP result.
 private async confidenceBatch(execution:IntelligenceExecution,effects:readonly IntelligenceEffectState[],hypothesisIds:readonly string[]):Promise<boolean>{
  const persisted=effects.find(effect=>effect.effect_key==='CONFIDENCE_BATCH'&&effect.state==='COMPLETED');
  if(persisted)return this.finishConfidence(execution,persisted,hypothesisIds);
  let status:ConfidenceBatchCommandStatus|undefined;try{status=await this.ledger.executeConfidenceBatch(execution.id);}catch{status=undefined;}
  if(status==='RETRY_PENDING')return false;
  if(status==='QUARANTINED')return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','CONFIDENCE_BATCH');
  let reread:readonly IntelligenceEffectState[];try{reread=await this.ledger.effects(execution.id);}catch{return false;}
  const durable=reread.find(effect=>effect.effect_key==='CONFIDENCE_BATCH');
  // No completed Confidence effect safely covers both "nothing committed" and a
  // committed RETRY_PENDING/QUARANTINED item state the managed command resolves
  // on the next attempt, and an impossible persisted CLAIMED row is caught by
  // the global fail-closed rule on redelivery.
  if(!durable||durable.state!=='COMPLETED')return false;
  return this.finishConfidence(execution,durable,hypothesisIds);}
 private async finishConfidence(execution:IntelligenceExecution,effect:IntelligenceEffectState,hypothesisIds:readonly string[]):Promise<boolean>{
  if(recoverConfidenceBatchResult(effect,hypothesisIds).status==='INDETERMINATE')
   return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','CONFIDENCE_BATCH_RECOVERY');
  // Information Gap / Question Integration v1: the idempotent gap sync must
  // succeed BEFORE terminal success. A transport failure returns non-terminal
  // (no ACK) so the existing bounded redelivery recovers the durable typed
  // Confidence result with zero upstream replay - zero Memory, Association,
  // Update, Eligibility, Intent, Candidate, Persistence, HIM or Confidence
  // work - and reruns only the sync; a QUARANTINED sync result fails closed.
  const gapSync=await this.syncInformationGaps(execution);
  if(gapSync==='FAILED')return false;
  if(gapSync==='QUARANTINED')return this.terminal(execution,'QUARANTINED','INDETERMINATE_EFFECT','INFORMATION_GAP_SYNC');
  return this.terminal(execution,'COMPLETED','COMPLETED','DONE');}
 // The migration-0038 sync command owns all source derivation, integrity
 // validation and materialization; the dispatcher only routes its bounded
 // outcomes. Transport/database failures are sanitized to FAILED - success is
 // never fabricated from an HTTP outcome.
 private async syncInformationGaps(execution:IntelligenceExecution):Promise<'SYNCED'|'QUARANTINED'|'FAILED'>{
  try{const result=await this.ledger.syncInformationGaps(execution.id);return result.status==='QUARANTINED'?'QUARANTINED':'SYNCED';}catch{return'FAILED';}}
 // Result-aware completion for a newly executed ASSOCIATION_PROVIDER effect. The
 // provider is invoked at most once; a successful post-authority outcome persists
 // its typed durable result atomically with completion, and any non-success
 // (including a NOT_AUTHORIZED reauthorization) fails closed as indeterminate -
 // no Hypothesis mutation, no provider replay.
 private async completeAssociation(execution:IntelligenceExecution,completed:Set<IntelligenceEffect>,event:RuntimeEventEnvelope,context:BackgroundIntelligenceExecutionContext,snapshot:HypothesisEvidenceAssociationSnapshot):Promise<DurableAssociationResult|undefined>{if(!await this.ledger.claim(execution.id,'ASSOCIATION_PROVIDER'))return undefined;let durable;try{durable=toDurableAssociationResult(await this.association.proposeAndAuthorize(event,context,snapshot));}catch{await this.ledger.finish(execution.id,'QUARANTINED','INDETERMINATE_EFFECT','ASSOCIATION_PROVIDER');return undefined;}if(!durable){await this.ledger.finish(execution.id,'QUARANTINED','INDETERMINATE_EFFECT','ASSOCIATION_PROVIDER');return undefined;}if(!await this.ledger.completeAssociation(execution.id,durable))return undefined;completed.add('ASSOCIATION_PROVIDER');return durable;}
 private async terminal(execution:IntelligenceExecution,state:'COMPLETED'|'SKIPPED'|'QUARANTINED',outcome:string,stage:string):Promise<true>{await this.ledger.finish(execution.id,state,outcome,stage);return true;}
}
function validEvidenceReference(value:string|null):value is `memory:${string}`{return typeof value==='string'&&/^memory:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);}
