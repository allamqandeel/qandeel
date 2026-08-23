import { Injectable } from '@nestjs/common';
import { DatabaseHealthProbe } from './database-health.probe';
import { ModelProviderHealthProbe } from './model-provider-health.probe';
import { RuntimeEventsHealthProbe } from './runtime-events-health.probe';
import { ObservabilityHealthProbe } from './observability-health.probe';
import type { DependencyStatus,HealthProbe,ReadinessResponse } from './health.types';

@Injectable()
export class HealthService{
 constructor(private readonly database:DatabaseHealthProbe,private readonly modelProvider:ModelProviderHealthProbe,private readonly runtimeEvents:RuntimeEventsHealthProbe,private readonly observability:ObservabilityHealthProbe){}
 async readiness():Promise<ReadinessResponse>{const[database,modelProvider,runtimeEvents,observability]=await Promise.all([this.safe(this.database,'unavailable'),this.safe(this.modelProvider,'not_configured'),this.safe(this.runtimeEvents,'degraded'),this.safe(this.observability,'degraded')]);const requiredReady=database==='available'&&modelProvider==='configured';return{status:requiredReady?'ready':'not_ready',service:'qandeel-api',dependencies:{database:{requirement:'required',status:database},model_provider:{requirement:'required',status:modelProvider},runtime_events:{requirement:'optional',status:runtimeEvents},observability:{requirement:'optional',status:observability}}};}
 private async safe(probe:HealthProbe,fallback:DependencyStatus):Promise<DependencyStatus>{try{return await probe.check();}catch{return fallback;}}
}
