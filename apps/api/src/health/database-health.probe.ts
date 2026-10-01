import { Injectable } from '@nestjs/common';
import type { DependencyStatus,HealthProbe } from './health.types';

// PROD-OPS-01: the database readiness RPC of migration 0132. Zero parameters, read-only, reads no row, answers exactly
// `true`, and is executable by the server role alone. The Data API root (`/rest/v1/`) is no readiness target: Supabase
// refuses it to the publishable key since 11 March 2026.
export const DATABASE_READINESS_RPC='server_database_ready_v1';
// The exact successful answer is the JSON literal `true`; any other status, shape or length is unavailable. The body is
// never returned, logged or parsed as anything else, and its read is bounded by the same timeout.
const MAX_READINESS_ANSWER_LENGTH=16;

@Injectable()
export class DatabaseHealthProbe implements HealthProbe{
 async check():Promise<DependencyStatus>{const base=process.env.SUPABASE_URL?.replace(/\/$/u,''),key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!key)return'not_configured';try{const response=await fetch(`${base}/rest/v1/rpc/${DATABASE_READINESS_RPC}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Accept:'application/json'},body:'{}',signal:AbortSignal.timeout(databaseHealthTimeoutMs(process.env))});if(response.status!==200)return'unavailable';const answer=await response.text();return answer.length<=MAX_READINESS_ANSWER_LENGTH&&answer.trim()==='true'?'available':'unavailable';}catch(error){const name=error&&typeof error==='object'&&'name'in error?String(error.name):'';return name==='TimeoutError'||name==='AbortError'?'timeout':'unavailable';}}
}
export function databaseHealthTimeoutMs(environment:NodeJS.ProcessEnv):number{const configured=Number(environment.HEALTH_DATABASE_TIMEOUT_MS??1500);return Number.isFinite(configured)?Math.min(5000,Math.max(100,configured)):1500;}
