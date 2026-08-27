import { Inject,Injectable,OnModuleDestroy,OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RuntimeEventAdminRepository } from './runtime-event-admin.repository';
import { RUNTIME_EVENT_TRANSPORT,type RuntimeEventTransport } from './runtime-event-transport';
import { isValidRuntimeEvent,type ClaimedRuntimeEvent,type RuntimeEventEnvelope } from './runtime-event.types';
import { TelemetryService } from '../observability/telemetry.service';

const MAX_ATTEMPTS=5;
@Injectable()
export class RuntimeEventPublisher implements OnModuleInit,OnModuleDestroy{
 private timer:NodeJS.Timeout|undefined;private running=false;private stopped=false;
 constructor(private readonly repository:RuntimeEventAdminRepository,@Inject(RUNTIME_EVENT_TRANSPORT)private readonly transport:RuntimeEventTransport,private readonly telemetry:TelemetryService){}
 get enabled():boolean{return this.repository.enabled&&Boolean(process.env.REDIS_URL)&&process.env.NODE_ENV!=='test';}
 get readinessStatus():'not_configured'|'available'|'degraded'{if(!this.repository.enabled||!process.env.REDIS_URL)return'not_configured';return this.transport instanceof Object&&'readinessStatus'in this.transport?((this.transport as RuntimeEventTransport&{readinessStatus:'not_configured'|'available'|'degraded'}).readinessStatus):'degraded';}
 // Startup Recovery v1: a failed initial Redis connection no longer kills
 // delivery liveness. The single supervision timer is armed regardless of the
 // startup connect outcome, so the SAME publisher instance keeps bounded
 // reconnect opportunities on the existing RUNTIME_EVENT_POLL_MS cadence and
 // resumes publishing automatically when Redis returns. API boot stays
 // fail-soft: the durable outbox remains the source of truth meanwhile.
 async onModuleInit():Promise<void>{if(!this.enabled)return;try{await this.transport.connect();this.observe('connect','success');}catch{this.observe('connect','failure');/* durable outbox remains available; API boot is authoritative */}if(this.stopped)return;this.timer=setInterval(()=>void this.superviseOnce(),Number(process.env.RUNTIME_EVENT_POLL_MS??1000));this.timer.unref();}
 async onModuleDestroy():Promise<void>{this.stopped=true;if(this.timer){clearInterval(this.timer);this.timer=undefined;}try{await this.transport.close();this.observe('close','success');}catch{this.observe('close','failure');}}
 // One single-flight supervision cycle. Transport readiness is checked BEFORE
 // any outbox claim: while the transport is unavailable the cycle makes at
 // most one bounded connection attempt and, on failure, ends WITHOUT calling
 // repository.claim — transport unavailability must never consume outbox
 // delivery attempts. A successful reconnect resumes the normal batch path in
 // the same cycle. The next scheduled cycle is the next retry opportunity.
 async superviseOnce():Promise<void>{if(this.running||this.stopped)return;this.running=true;try{if(!this.transportAvailable()){try{await this.transport.connect();this.observe('connect','success');}catch{this.observe('connect','failure');return;}if(!this.transportAvailable())return;}await this.processBatch();}finally{this.running=false;}}
 async processOnce():Promise<void>{if(this.running)return;this.running=true;try{await this.processBatch();}finally{this.running=false;}}
 private transportAvailable():boolean{const status=this.transport.readinessStatus;return status===undefined||status==='available';}
 private async processBatch():Promise<void>{const token=randomUUID();try{const events=await this.repository.claim(20,30,token);this.observe('claim','success');for(const event of events)await this.dispatch(event);}catch{this.observe('claim','failure');}}
 private async dispatch(event:ClaimedRuntimeEvent):Promise<void>{if(!isValidRuntimeEvent(event)){await this.quarantine(event,'INVALID_EVENT');return;}if(event.attempt_count>MAX_ATTEMPTS){await this.quarantine(event,'MAX_ATTEMPTS_EXCEEDED');return;}let messageId:string;try{messageId=await this.transport.publish(this.envelope(event));this.observe('publish','success');}catch{this.observe('publish','failure');await this.retryOrQuarantine(event);return;}try{const acked=await this.repository.ack(event.event_id,event.claim_token,messageId);this.observe('ack',acked?'success':'conflict');}catch{this.observe('ack','failure');await this.retryOrQuarantine(event);}}
 private async retryOrQuarantine(event:ClaimedRuntimeEvent):Promise<void>{if(event.attempt_count>=MAX_ATTEMPTS){await this.quarantine(event,'MAX_ATTEMPTS_EXCEEDED');return;}try{const retried=await this.repository.retry(event.event_id,event.claim_token,'TRANSPORT_UNAVAILABLE',new Date(Date.now()+this.backoff(event.attempt_count)));this.observe('retry',retried?'success':'conflict');}catch{this.observe('retry','failure');}}
 private async quarantine(event:ClaimedRuntimeEvent,code:'INVALID_EVENT'|'MAX_ATTEMPTS_EXCEEDED'):Promise<void>{try{const quarantined=await this.repository.quarantine(event.event_id,event.claim_token,code);this.observe('quarantine',quarantined?'success':'conflict');}catch{this.observe('quarantine','failure');}}
 private backoff(attempt:number):number{return Math.min(300_000,1000*2**Math.max(0,attempt-1));}
 private envelope(event:ClaimedRuntimeEvent):RuntimeEventEnvelope{const{status:_,attempt_count:__,claim_token:___,claimed_at:____,lease_expires_at:_____,...envelope}=event;return envelope;}
 private observe(operation:'connect'|'claim'|'publish'|'ack'|'retry'|'quarantine'|'close',outcome:'success'|'failure'|'conflict'):void{try{this.telemetry.recordPublisherOperation(operation,outcome);}catch{}}
}
