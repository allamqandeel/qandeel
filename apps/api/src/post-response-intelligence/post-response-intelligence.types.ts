export const INTELLIGENCE_EFFECTS=['MEMORY_WRITE','INTENT_PROVIDER','CANDIDATE_PROVIDER','ASSOCIATION_PROVIDER','HYPOTHESIS_PERSISTENCE','CONFIDENCE_BATCH']as const;
export type IntelligenceEffect=typeof INTELLIGENCE_EFFECTS[number];
export type NonMemoryIntelligenceEffect=Exclude<IntelligenceEffect,'MEMORY_WRITE'>;
export type MemoryWriteEffectResultCode='NO_FRESH_EVIDENCE'|'FRESH_EVIDENCE_CREATED';
export interface IntelligenceExecution{readonly id:string;readonly event_id:string;readonly user_id:string;readonly session_id:string;readonly source_turn_id:string;readonly event_version:'1.0'|'2.0';readonly processing_path:'FAST'|'DEEP'|null;readonly safety_disposition:'ALLOW'|'GUIDED'|'BLOCK'|null;readonly state:'RUNNING'|'COMPLETED'|'SKIPPED'|'QUARANTINED'|'FAILED';readonly attempt_count:number;}
export interface IntelligenceEffectState{readonly effect_key:IntelligenceEffect;readonly state:'CLAIMED'|'COMPLETED';readonly result_code:MemoryWriteEffectResultCode|null;readonly result_reference:string|null;}
export interface RedisRuntimeEventEntry{readonly id:string;readonly envelope:string;}
export const POST_RESPONSE_REDIS_CONSUMER=Symbol('POST_RESPONSE_REDIS_CONSUMER');
export interface PostResponseRedisConsumer{readonly enabled:boolean;connect():Promise<void>;read():Promise<readonly RedisRuntimeEventEntry[]>;reclaim():Promise<readonly RedisRuntimeEventEntry[]>;ack(id:string):Promise<void>;close():Promise<void>;}
