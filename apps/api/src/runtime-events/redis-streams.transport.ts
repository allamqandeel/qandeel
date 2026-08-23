import { Injectable } from '@nestjs/common';
import { createClient,type RedisClientType } from 'redis';
import type { RuntimeEventTransport } from './runtime-event-transport';
import type { RuntimeEventEnvelope } from './runtime-event.types';

@Injectable()
export class RedisStreamsTransport implements RuntimeEventTransport{
 private client:RedisClientType|undefined;private state:'not_configured'|'available'|'degraded'=process.env.REDIS_URL?'degraded':'not_configured';readonly enabled=Boolean(process.env.REDIS_URL);private readonly stream=process.env.RUNTIME_EVENT_STREAM??'qandeel:runtime-events:v1';
 get readinessStatus():'not_configured'|'available'|'degraded'{return this.state;}
 async connect():Promise<void>{if(!process.env.REDIS_URL)throw new Error('REDIS_DISABLED');this.client=createClient({url:process.env.REDIS_URL});this.client.on('error',()=>{this.state='degraded';});await this.client.connect();this.state='available';}
 async publish(event:RuntimeEventEnvelope):Promise<string>{if(!this.client?.isReady)throw new Error('TRANSPORT_UNAVAILABLE');return this.client.xAdd(this.stream,'*',{event_id:event.event_id,envelope:JSON.stringify(event)});}
 async close():Promise<void>{if(this.client?.isOpen)await this.client.quit();this.client=undefined;this.state=this.enabled?'degraded':'not_configured';}
}

