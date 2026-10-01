import { Injectable } from '@nestjs/common';
import type { DependencyStatus,HealthProbe } from './health.types';

// PROD-OPS-01: the database readiness RPC of migration 0132. Zero parameters, read-only, reads no row, answers exactly
// `true`, and is executable by the server role alone. The Data API root (`/rest/v1/`) is no readiness target: Supabase
// refuses it to the publishable key since 11 March 2026.
export const DATABASE_READINESS_RPC='server_database_ready_v1';
// The exact successful answer is the JSON literal `true`; any other status, shape or length is unavailable. The body is
// read only up to this many bytes, and is never returned, logged or parsed as anything else.
const MAX_READINESS_ANSWER_BYTES=16;
// `/health/ready` is unauthenticated, and each real check takes a pooled database connection. Concurrent checks share
// one request, and a result is reused for this long, so no request rate can turn into more than about one database
// round trip per second per API instance. Far below any load balancer's useful probe interval.
export const DATABASE_READINESS_REUSE_MS=1000;

@Injectable()
export class DatabaseHealthProbe implements HealthProbe{
 private inflight:Promise<DependencyStatus>|undefined;private last:{status:DependencyStatus;at:number}|undefined;
 check():Promise<DependencyStatus>{
  if(this.last&&Date.now()-this.last.at<DATABASE_READINESS_REUSE_MS)return Promise.resolve(this.last.status);
  return this.inflight??=this.probe().then(status=>{this.last={status,at:Date.now()};return status;}).finally(()=>{this.inflight=undefined;});
 }
 private async probe():Promise<DependencyStatus>{const base=process.env.SUPABASE_URL?.replace(/\/$/u,''),key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!key)return'not_configured';try{const response=await fetch(`${base}/rest/v1/rpc/${DATABASE_READINESS_RPC}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Accept:'application/json'},body:'{}',signal:AbortSignal.timeout(databaseHealthTimeoutMs(process.env))});if(response.status!==200)return'unavailable';const answer=await readBounded(response,MAX_READINESS_ANSWER_BYTES);return answer!==null&&answer.trim()==='true'?'available':'unavailable';}catch(error){const name=error&&typeof error==='object'&&'name'in error?String(error.name):'';return name==='TimeoutError'||name==='AbortError'?'timeout':'unavailable';}}
}
/** The body as text, or null once it exceeds `limit` bytes — the rest is never buffered. */
async function readBounded(response:Response,limit:number):Promise<string|null>{const reader=response.body?.getReader();if(!reader){const text=await response.text();return Buffer.byteLength(text)<=limit?text:null;}const chunks:Uint8Array[]=[];let total=0;for(;;){const{done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit){await reader.cancel().catch(()=>undefined);return null;}chunks.push(value);}return Buffer.concat(chunks).toString('utf8');}
export function databaseHealthTimeoutMs(environment:NodeJS.ProcessEnv):number{const configured=Number(environment.HEALTH_DATABASE_TIMEOUT_MS??1500);return Number.isFinite(configured)?Math.min(5000,Math.max(100,configured)):1500;}
