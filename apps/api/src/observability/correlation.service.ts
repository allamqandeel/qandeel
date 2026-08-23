import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

export interface CorrelationSnapshot { request_id:string;session_id?:string;turn_id?:string;orchestration_id?:string;engine_call_id?:string;provider_call_id?:string; }

@Injectable()
export class CorrelationService {
  private readonly storage=new AsyncLocalStorage<CorrelationSnapshot>();
  runRequest<T>(work:()=>T):T{return this.storage.run({request_id:randomUUID()},work);}
  current():Readonly<CorrelationSnapshot>|undefined{const current=this.storage.getStore();return current?Object.freeze({...current}):undefined;}
  bindCanonical(sessionId:string,turnId?:string):void{const current=this.storage.getStore();if(!current)return;this.bind(current,'session_id',sessionId);if(turnId)this.bind(current,'turn_id',turnId);}
  withOrchestration<T>(work:()=>T):T{return this.nested({orchestration_id:randomUUID()},work);}
  withEngine<T>(work:()=>T):T{return this.nested({engine_call_id:randomUUID()},work);}
  withProvider<T>(work:()=>T):T{return this.nested({provider_call_id:randomUUID()},work);}
  private nested<T>(ids:Partial<CorrelationSnapshot>,work:()=>T):T{return this.storage.run({...this.required(),...ids},work);}
  private required():CorrelationSnapshot{const value=this.storage.getStore();if(!value)throw new Error('CORRELATION_SCOPE_REQUIRED');return value;}
  private bind(target:CorrelationSnapshot,key:'session_id'|'turn_id',value:string):void{if(target[key]&&target[key]!==value)throw new Error('CORRELATION_ID_CONFLICT');target[key]=value;}
}
