import { Injectable } from '@nestjs/common';
import type{IntelligenceEffect,IntelligenceEffectState,IntelligenceExecution}from'./post-response-intelligence.types';

@Injectable()
export class PostResponseIntelligenceRepository{
 async acquire(input:{id:string;eventId:string;userId:string;sessionId:string;sourceTurnId:string;eventVersion:'1.0'|'2.0';processingPath:'FAST'|'DEEP'|null;safetyDisposition:'ALLOW'|'GUIDED'|'BLOCK'|null}):Promise<IntelligenceExecution>{return(await this.request<IntelligenceExecution[]>('rpc/acquire_post_response_intelligence_execution_v1',{method:'POST',body:JSON.stringify({p_id:input.id,p_event_id:input.eventId,p_user_id:input.userId,p_session_id:input.sessionId,p_source_turn_id:input.sourceTurnId,p_event_version:input.eventVersion,p_processing_path:input.processingPath,p_safety_disposition:input.safetyDisposition})}))[0];}
 async effects(id:string):Promise<readonly IntelligenceEffectState[]>{return this.request<IntelligenceEffectState[]>('rpc/list_post_response_intelligence_effects_v1',{method:'POST',body:JSON.stringify({p_execution_id:id})});}
 async claim(id:string,effect:IntelligenceEffect):Promise<boolean>{return this.booleanRpc('claim_post_response_intelligence_effect_v1',{p_execution_id:id,p_effect_key:effect});}
 async complete(id:string,effect:IntelligenceEffect):Promise<boolean>{return this.booleanRpc('complete_post_response_intelligence_effect_v1',{p_execution_id:id,p_effect_key:effect});}
 async finish(id:string,state:'COMPLETED'|'SKIPPED'|'QUARANTINED'|'FAILED',outcome:string,stage:string):Promise<boolean>{return this.booleanRpc('finish_post_response_intelligence_execution_v1',{p_execution_id:id,p_state:state,p_outcome_code:outcome,p_stage:stage});}
 private async booleanRpc(name:string,body:Record<string,unknown>):Promise<boolean>{const value=await this.request<boolean>(`rpc/${name}`,{method:'POST',body:JSON.stringify(body)});return value===true;}
 private async request<T>(path:string,init:RequestInit):Promise<T>{const base=process.env.SUPABASE_URL?.replace(/\/$/u,''),key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!key)throw new Error('POST_RESPONSE_DATABASE_DISABLED');let response:Response;try{response=await fetch(`${base}/rest/v1/${path}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(5000)});}catch{throw new Error('POST_RESPONSE_DATABASE_UNAVAILABLE');}if(!response.ok)throw new Error('POST_RESPONSE_DATABASE_UNAVAILABLE');return response.status===204?undefined as T:response.json()as Promise<T>;}
}
