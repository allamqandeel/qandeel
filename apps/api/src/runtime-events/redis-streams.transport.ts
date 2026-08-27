import { Injectable } from '@nestjs/common';
import { createClient,type RedisClientType } from 'redis';
import type { RuntimeEventTransport } from './runtime-event-transport';
import type { RuntimeEventEnvelope } from './runtime-event.types';

// Startup Recovery v1: this transport is safe for repeated publisher-owned
// connection attempts on the SAME instance. connect() is a no-op success when
// the client is already ready; after a failed attempt the failed client is
// disposed so a later connect() starts fresh. `reconnectStrategy:false` keeps
// every connection attempt bounded and single-shot: the redis library never
// runs its own retry loop, so the publisher supervision cadence
// (RUNTIME_EVENT_POLL_MS) remains the one owner of reconnect timing.
@Injectable()
export class RedisStreamsTransport implements RuntimeEventTransport{
 private client:RedisClientType|undefined;private state:'not_configured'|'available'|'degraded'=process.env.REDIS_URL?'degraded':'not_configured';readonly enabled=Boolean(process.env.REDIS_URL);private readonly stream=process.env.RUNTIME_EVENT_STREAM??'qandeel:runtime-events:v1';
 get readinessStatus():'not_configured'|'available'|'degraded'{return this.state;}
 async connect():Promise<void>{
  if(!process.env.REDIS_URL)throw new Error('REDIS_DISABLED');
  if(this.client?.isReady)return;
  this.dispose();
  const client=createClient({url:process.env.REDIS_URL,socket:{reconnectStrategy:false}}) as RedisClientType;
  client.on('error',()=>{this.state='degraded';});
  this.client=client;
  try{await client.connect();this.state='available';}
  catch(error){this.state='degraded';this.dispose();throw error;}
 }
 async publish(event:RuntimeEventEnvelope):Promise<string>{if(!this.client?.isReady)throw new Error('TRANSPORT_UNAVAILABLE');return this.client.xAdd(this.stream,'*',{event_id:event.event_id,envelope:JSON.stringify(event)});}
 async close():Promise<void>{const client=this.client;this.client=undefined;if(client){try{if(client.isOpen)await client.quit();else client.destroy();}catch{try{client.destroy();}catch{/* already destroyed */}}}this.state=this.enabled?'degraded':'not_configured';}
 // Drop any stale/failed client so it can never stay authoritative or leak.
 private dispose():void{const stale=this.client;this.client=undefined;if(!stale)return;try{stale.destroy();}catch{/* already closed */}}
}
