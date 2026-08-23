import { Injectable } from '@nestjs/common';
import type { ClaimedRuntimeEvent,OutboxErrorCode } from './runtime-event.types';

@Injectable()
export class RuntimeEventAdminRepository{
 readonly enabled=Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
 async claim(batchSize:number,leaseSeconds:number,claimToken:string):Promise<ClaimedRuntimeEvent[]>{return this.rpc('claim_runtime_events',{p_batch_size:batchSize,p_lease_seconds:leaseSeconds,p_claim_token:claimToken});}
 async ack(eventId:string,claimToken:string,messageId:string):Promise<boolean>{return this.rpcBoolean('ack_runtime_event',{p_event_id:eventId,p_claim_token:claimToken,p_transport_message_id:messageId});}
 async retry(eventId:string,claimToken:string,code:OutboxErrorCode,nextAttemptAt:Date):Promise<boolean>{return this.rpcBoolean('retry_runtime_event',{p_event_id:eventId,p_claim_token:claimToken,p_error_code:code,p_next_attempt_at:nextAttemptAt.toISOString()});}
 async quarantine(eventId:string,claimToken:string,code:'INVALID_EVENT'|'MAX_ATTEMPTS_EXCEEDED'):Promise<boolean>{return this.rpcBoolean('quarantine_runtime_event',{p_event_id:eventId,p_claim_token:claimToken,p_error_code:code});}
 private async rpcBoolean(name:string,body:Record<string,unknown>):Promise<boolean>{const result=await this.rpc<boolean|boolean[]>(name,body);return Array.isArray(result)?Boolean(result[0]):Boolean(result);}
 private async rpc<T>(name:string,body:Record<string,unknown>):Promise<T>{const base=process.env.SUPABASE_URL?.replace(/\/$/u,''),key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!key)throw new Error('PUBLISHER_DATABASE_DISABLED');const response=await fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});if(!response.ok)throw new Error('PUBLISHER_DATABASE_UNAVAILABLE');return response.json() as Promise<T>;}
}

