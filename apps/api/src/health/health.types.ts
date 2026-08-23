export type DependencyRequirement='required'|'optional';
export type DependencyStatus='available'|'configured'|'not_configured'|'unavailable'|'degraded'|'timeout';
export type DependencyName='database'|'model_provider'|'runtime_events'|'observability';
export interface DependencyHealth{requirement:DependencyRequirement;status:DependencyStatus;}
export interface ReadinessResponse{status:'ready'|'not_ready';service:'qandeel-api';dependencies:Record<DependencyName,DependencyHealth>;}
export interface LivenessResponse{status:'ok';service:'qandeel-api';}
export interface HealthProbe{check():Promise<DependencyStatus>|DependencyStatus;}

