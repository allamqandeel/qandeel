import { Controller, Get,Res } from '@nestjs/common';
import { HealthService } from './health.service';
import type { LivenessResponse,ReadinessResponse } from './health.types';

@Controller('health')
export class HealthController {
  constructor(private readonly health:HealthService){}
  @Get()
  getHealth():LivenessResponse{return{status:'ok',service:'qandeel-api'};}
  @Get('live')getLive():LivenessResponse{return{status:'ok',service:'qandeel-api'};}
  @Get('ready')async getReady(@Res({passthrough:true})response:{status:(code:number)=>unknown}):Promise<ReadinessResponse>{const result=await this.health.readiness();response.status(result.status==='ready'?200:503);return result;}
}
