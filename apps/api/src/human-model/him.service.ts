import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { HIM_CONTEXT_KINDS,MAX_HIM_CONTEXT_ID_LENGTH,type HimContextKind } from './him.types';
import { HimRepository } from './him.repository';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// QHIM-013: this service is a HIM READ boundary. The Foundation-era generic
// writer observe(...) -> HimRepository.createObservation(...) -> the legacy
// generic snapshot RPC was retired here, because migration 0051 turned that
// database function into a fail-closed no-write tombstone with EXECUTE
// revoked from every application role. Canonical HIM v1 measurement
// state is created only through the metric-owned, first-class structured
// measurement contracts in the database, which derive ownership, instrument,
// scale, binding, calculation, and provenance server-side. No generic
// application measurement-write capability replaces it: no metric-key
// dispatcher, no generic submission DTO, and no direct him_metric_snapshots
// write. A future application-level measurement submission surface is a
// separately reviewed runtime contract, not a closure remediation.
@Injectable()
export class HimService {
  constructor(private readonly repository:HimRepository){}
  async getLatest(userId:string,token:string,key:string,definitionVersion:number,kind:HimContextKind,id:string){
    this.validateContext(kind,id);
    if(typeof key!=='string'||key.length===0||key.length>128||!Number.isSafeInteger(definitionVersion)||definitionVersion<1)throw new BadRequestException('Invalid definition identity.');
    const definition=await this.repository.getDefinition(token,key,definitionVersion);if(!definition)throw new NotFoundException('HIM metric definition not found.');
    if(!definition.validContextKinds.includes(kind))throw new BadRequestException('Metric definition does not support this exact context kind.');
    return this.repository.getLatest(token,userId,key,definitionVersion,kind,id);
  }
  listForContext(userId:string,token:string,kind:HimContextKind,id:string){this.validateContext(kind,id);return this.repository.listForContext(token,userId,kind,id);} history(userId:string,token:string,key:string,kind:HimContextKind,id:string){this.validateContext(kind,id);return this.repository.history(token,userId,key,kind,id);}
  private validateContext(kind:HimContextKind,id:string):void{if(!HIM_CONTEXT_KINDS.includes(kind)||typeof id!=='string'||id.trim()!==id||id.length===0||id.length>MAX_HIM_CONTEXT_ID_LENGTH)throw new BadRequestException('Invalid exact HIM context.');if(kind==='GLOBAL'?id!=='GLOBAL':id==='GLOBAL'||(!UUID.test(id)&&kind!=='SITUATION'))throw new BadRequestException('Context identity does not match its kind.');}
}

