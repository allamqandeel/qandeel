import { Injectable } from '@nestjs/common';
import type { DependencyStatus,HealthProbe } from './health.types';

@Injectable()
export class DatabaseHealthProbe implements HealthProbe{
 async check():Promise<DependencyStatus>{const base=process.env.SUPABASE_URL?.replace(/\/$/u,''),key=process.env.SUPABASE_PUBLISHABLE_KEY;if(!base||!key)return'not_configured';try{const response=await fetch(`${base}/rest/v1/`,{method:'HEAD',headers:{apikey:key},signal:AbortSignal.timeout(databaseHealthTimeoutMs(process.env))});return response.ok?'available':'unavailable';}catch(error){const name=error&&typeof error==='object'&&'name'in error?String(error.name):'';return name==='TimeoutError'||name==='AbortError'?'timeout':'unavailable';}}
}
export function databaseHealthTimeoutMs(environment:NodeJS.ProcessEnv):number{const configured=Number(environment.HEALTH_DATABASE_TIMEOUT_MS??1500);return Number.isFinite(configured)?Math.min(5000,Math.max(100,configured)):1500;}
