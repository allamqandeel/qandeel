import type{AuthorizedHypothesisGenerationIntent}from'../hypothesis/hypothesis-generation-intent-authority.types';
import type{AssociationEffectResultCode}from'./durable-association-result';
import type{ConfidenceBatchEffectResultCode}from'./durable-confidence-batch-result';
import type{CandidateProviderEffectResultCode,HypothesisPersistenceEffectResultCode}from'./durable-generation-result';
import type{HypothesisUpdateBatchEffectResultCode}from'./durable-hypothesis-update-batch-result';
export const INTELLIGENCE_EFFECTS=['MEMORY_WRITE','INTENT_PROVIDER','CANDIDATE_PROVIDER','ASSOCIATION_PROVIDER','HYPOTHESIS_UPDATE_BATCH','HYPOTHESIS_PERSISTENCE','CONFIDENCE_BATCH']as const;
export type IntelligenceEffect=typeof INTELLIGENCE_EFFECTS[number];
/** The managed effects. Each one's claim, work and typed completion happen inside ONE database transaction driven by its specialized execute command, so the ordinary claim path can never touch either: A2.3c HYPOTHESIS_UPDATE_BATCH (migration 0034) and QAN-AUD-06 CONFIDENCE_BATCH (migration 0035, which additionally owns the durable per-target item plan). */
export type ManagedIntelligenceEffect='HYPOTHESIS_UPDATE_BATCH'|'CONFIDENCE_BATCH';
/** Effects the ordinary claim-then-work pattern may claim. The managed effects are excluded: claiming one outside its one-transaction execute command would create an unrecoverable CLAIMED state. */
export type ClaimableIntelligenceEffect=Exclude<IntelligenceEffect,ManagedIntelligenceEffect>;
export type MemoryWriteEffectResultCode='NO_FRESH_EVIDENCE'|'FRESH_EVIDENCE_CREATED';
export type IntentProviderEffectResultCode='INTENT_AUTHORIZED'|'INTENT_NOT_AUTHORIZED';
export type IntelligenceEffectResultCode=MemoryWriteEffectResultCode|IntentProviderEffectResultCode|AssociationEffectResultCode|CandidateProviderEffectResultCode|HypothesisPersistenceEffectResultCode|HypothesisUpdateBatchEffectResultCode|ConfidenceBatchEffectResultCode;
/** Typed outcome of the managed QAN-AUD-06 Confidence-batch command. COMPLETED means the typed effect is durably complete; RETRY_PENDING means at least one item still needs retry and the execution stays RUNNING; QUARANTINED means an irrecoverable item/work mismatch; NO_OP is a race/missing/terminal condition that requires a durable reread before deciding. */
export const CONFIDENCE_BATCH_COMMAND_STATUSES=['COMPLETED','RETRY_PENDING','QUARANTINED','NO_OP']as const;
export type ConfidenceBatchCommandStatus=typeof CONFIDENCE_BATCH_COMMAND_STATUSES[number];
/** Durable post-authority outcome of a completed INTENT_PROVIDER effect. A durable NOT_AUTHORIZED carries no reason because none was persisted. */
export type DurableIntentProviderResult={readonly status:'AUTHORIZED';readonly intent:AuthorizedHypothesisGenerationIntent}|{readonly status:'NOT_AUTHORIZED'};
/** INDETERMINATE covers a legacy null result, a malformed persisted result, mismatched provenance, and any impossible code/payload pairing. It is never NOT_AUTHORIZED. */
export type IntentProviderRecovery=DurableIntentProviderResult|{readonly status:'INDETERMINATE'};
export interface IntelligenceExecution{readonly id:string;readonly event_id:string;readonly user_id:string;readonly session_id:string;readonly source_turn_id:string;readonly event_version:'1.0'|'2.0';readonly processing_path:'FAST'|'DEEP'|null;readonly safety_disposition:'ALLOW'|'GUIDED'|'BLOCK'|null;readonly state:'RUNNING'|'COMPLETED'|'SKIPPED'|'QUARANTINED'|'FAILED';readonly attempt_count:number;}
export interface IntelligenceEffectState{readonly effect_key:IntelligenceEffect;readonly state:'CLAIMED'|'COMPLETED';readonly result_code:IntelligenceEffectResultCode|null;readonly result_reference:string|null;readonly result_payload:unknown;}
export interface RedisRuntimeEventEntry{readonly id:string;readonly envelope:string;}
export const POST_RESPONSE_REDIS_CONSUMER=Symbol('POST_RESPONSE_REDIS_CONSUMER');
export interface PostResponseRedisConsumer{readonly enabled:boolean;connect():Promise<void>;read():Promise<readonly RedisRuntimeEventEntry[]>;reclaim():Promise<readonly RedisRuntimeEventEntry[]>;ack(id:string):Promise<void>;close():Promise<void>;}
