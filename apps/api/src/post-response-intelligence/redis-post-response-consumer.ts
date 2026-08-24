import{Injectable}from'@nestjs/common';import{createClient,type RedisClientType}from'redis';import type{PostResponseRedisConsumer,RedisRuntimeEventEntry}from'./post-response-intelligence.types';
@Injectable()
export class RedisPostResponseConsumer implements PostResponseRedisConsumer{
 readonly enabled=Boolean(process.env.REDIS_URL);private client:RedisClientType|undefined;private readonly stream=process.env.RUNTIME_EVENT_STREAM??'qandeel:runtime-events:v1';private readonly group=process.env.POST_RESPONSE_CONSUMER_GROUP??'qandeel-post-response-intelligence-v1';private readonly consumer=process.env.POST_RESPONSE_CONSUMER_NAME??`api-${process.pid}`;
 async connect():Promise<void>{if(!process.env.REDIS_URL)throw new Error('REDIS_DISABLED');this.client=createClient({url:process.env.REDIS_URL});this.client.on('error',()=>undefined);await this.client.connect();try{await this.command(['XGROUP','CREATE',this.stream,this.group,'0','MKSTREAM']);}catch(error){if(!String(error).includes('BUSYGROUP'))throw error;}}
 async read():Promise<readonly RedisRuntimeEventEntry[]>{return this.parse(await this.command(['XREADGROUP','GROUP',this.group,this.consumer,'COUNT','10','BLOCK','1000','STREAMS',this.stream,'>']));}
 async reclaim():Promise<readonly RedisRuntimeEventEntry[]>{const value=await this.command(['XAUTOCLAIM',this.stream,this.group,this.consumer,'30000','0-0','COUNT','10']);return this.parseClaim(value);}
 async ack(id:string):Promise<void>{await this.command(['XACK',this.stream,this.group,id]);}
 async close():Promise<void>{if(this.client?.isOpen)await this.client.quit();this.client=undefined;}
 private async command(args:string[]):Promise<unknown>{if(!this.client?.isReady)throw new Error('REDIS_UNAVAILABLE');return this.client.sendCommand(args);}
 private parse(value:unknown):RedisRuntimeEventEntry[]{if(!Array.isArray(value))return[];const rows=value.flatMap(stream=>Array.isArray(stream)&&Array.isArray(stream[1])?stream[1]:[]);return rows.flatMap(row=>this.row(row));}
 private parseClaim(value:unknown):RedisRuntimeEventEntry[]{return Array.isArray(value)&&Array.isArray(value[1])?value[1].flatMap(row=>this.row(row)):[];}
 private row(value:unknown):RedisRuntimeEventEntry[]{if(!Array.isArray(value)||typeof value[0]!=='string'||!Array.isArray(value[1]))return[];const id=value[0],fields=value[1]as unknown[],index=fields.findIndex(item=>item==='envelope'),envelope=fields[index+1];return index>=0&&typeof envelope==='string'?[{id,envelope}]:[];}
}
