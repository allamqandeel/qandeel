import { Injectable } from '@nestjs/common';
import { HimRepository } from './him.repository';
import type { HimContextKind } from './him.types';
import type { HimIntelligenceSnapshot,HimSnapshotContextKind,HimSnapshotSourceRow } from './him-intelligence-snapshot.types';
import { HIM_SNAPSHOT_SLOTS,projectHimIntelligenceSnapshot } from './him-intelligence-snapshot.projector';

// The canonical source-row -> snapshot projection lives in the shared pure
// projector (HIM Runtime Consumption v1); this service keeps exactly its
// original authenticated read behavior and delegates the projection unchanged.
export { HIM_SNAPSHOT_SLOTS };
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class HimIntelligenceSnapshotService {
  constructor(private readonly repository:HimRepository){}
  async getSnapshot(token:string,contextKind:HimContextKind,contextId:string):Promise<HimIntelligenceSnapshot>{
    if(!(contextKind in HIM_SNAPSHOT_SLOTS))throw new Error('UNSUPPORTED_CONTEXT');
    if(!UUID.test(contextId))throw new Error('INVALID_OR_UNOWNED_CONTEXT');
    let rows:HimSnapshotSourceRow[];try{rows=await this.repository.readIntelligenceSnapshot(token,{contextKind,contextId});}catch(error){if(error instanceof Error&&error.message.includes('active binding integrity failure'))throw new Error('INTEGRITY_FAILURE');throw new Error('INVALID_OR_UNOWNED_CONTEXT');}
    return projectHimIntelligenceSnapshot(contextKind as HimSnapshotContextKind,contextId,rows);
  }
}
