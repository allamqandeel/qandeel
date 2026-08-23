export type RuntimeEventType='ConversationTurnCompleted'|'ConversationTurnFailed'|'ConversationTurnCancelled';
export type OutboxStatus='PENDING'|'IN_FLIGHT'|'RETRY'|'PUBLISHED'|'QUARANTINED';
export type OutboxErrorCode='TRANSPORT_UNAVAILABLE'|'TRANSPORT_TIMEOUT'|'INVALID_EVENT'|'MAX_ATTEMPTS_EXCEEDED'|'CLAIM_CONFLICT';
export interface RuntimeEventEnvelope{event_id:string;event_type:RuntimeEventType;event_version:'1.0';occurred_at:string;producer:'conversation-service';subject_user_id:string;subject_session_id:string;subject_turn_id:string;correlation_id:string|null;causation_id:string|null;classification:'SENSITIVE';schema_ref:string;payload:Record<string,unknown>;contains_content:false;retention_class:'OPERATIONAL_EVENT_V1';}
export interface ClaimedRuntimeEvent extends RuntimeEventEnvelope{status:'IN_FLIGHT';attempt_count:number;claim_token:string;claimed_at:string;lease_expires_at:string;}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PAYLOAD_KEYS=['orchestration_id','processing_path','routing_reason','session_id','source_turn_id','terminal_status','user_id']as const;
const CONTRACT:Record<RuntimeEventType,{status:string;schema:string}>={
 ConversationTurnCompleted:{status:'COMPLETED',schema:'qandeel.runtime.conversation-turn-completed.v1'},
 ConversationTurnFailed:{status:'FAILED',schema:'qandeel.runtime.conversation-turn-failed.v1'},
 ConversationTurnCancelled:{status:'CANCELLED',schema:'qandeel.runtime.conversation-turn-cancelled.v1'},
};
const uuid=(value:unknown):value is string=>typeof value==='string'&&UUID.test(value);
const nullableUuid=(value:unknown):boolean=>value===null||uuid(value);

export function isValidRuntimeEvent(value:ClaimedRuntimeEvent):boolean{
 if(!value||typeof value!=='object'||!Object.prototype.hasOwnProperty.call(CONTRACT,value.event_type))return false;
 const contract=CONTRACT[value.event_type];
 if(value.event_version!=='1.0'||value.schema_ref!==contract.schema||value.producer!=='conversation-service'||value.classification!=='SENSITIVE'||value.contains_content!==false||value.retention_class!=='OPERATIONAL_EVENT_V1')return false;
 if(!uuid(value.event_id)||!uuid(value.subject_user_id)||!uuid(value.subject_session_id)||!uuid(value.subject_turn_id)||!nullableUuid(value.correlation_id)||!nullableUuid(value.causation_id)||value.causation_id===value.event_id||!uuid(value.claim_token))return false;
 if(typeof value.occurred_at!=='string'||!Number.isFinite(Date.parse(value.occurred_at))||value.payload===null||Array.isArray(value.payload)||typeof value.payload!=='object')return false;
 const keys=Object.keys(value.payload).sort();if(keys.length!==PAYLOAD_KEYS.length||keys.some((key,index)=>key!==PAYLOAD_KEYS[index]))return false;
 const payload=value.payload;
 if(payload.user_id!==value.subject_user_id||payload.session_id!==value.subject_session_id||payload.source_turn_id!==value.subject_turn_id||payload.terminal_status!==contract.status)return false;
 if(!uuid(payload.user_id)||!uuid(payload.session_id)||!uuid(payload.source_turn_id)||!nullableUuid(payload.orchestration_id))return false;
 if(payload.processing_path!==null&&payload.processing_path!=='FAST'&&payload.processing_path!=='DEEP')return false;
 if(payload.routing_reason!==null&&payload.routing_reason!=='FAST_DEFAULT'&&payload.routing_reason!=='INPUT_LENGTH_REQUIRES_DEEP_CONTEXT')return false;
 if((payload.processing_path==='FAST'&&payload.routing_reason!=='FAST_DEFAULT')||(payload.processing_path==='DEEP'&&payload.routing_reason!=='INPUT_LENGTH_REQUIRES_DEEP_CONTEXT')||(payload.processing_path===null&&payload.routing_reason!==null))return false;
 return true;
}
