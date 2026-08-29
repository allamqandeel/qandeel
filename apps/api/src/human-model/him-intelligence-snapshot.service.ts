import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MemoryDataApiError } from '../memory/memory-data-api.service';
import { HimRepository } from './him.repository';
import type { HimContextKind } from './him.types';
import type { HimIntelligenceSnapshot,HimSnapshotContextKind,HimSnapshotSourceRow } from './him-intelligence-snapshot.types';
import { HIM_SNAPSHOT_SLOTS,projectHimIntelligenceSnapshot } from './him-intelligence-snapshot.projector';

// The canonical source-row -> snapshot projection lives in the shared pure
// projector (HIM Runtime Consumption v1); this service keeps exactly its
// original authenticated read behavior and delegates the projection unchanged.
export { HIM_SNAPSHOT_SLOTS };
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// QHIA-014A: the EXACT transient infrastructure statuses that mean "the
// transport could not answer", never "the caller asked something the authority
// refused". They are the only MemoryDataApiError statuses this service is
// allowed to translate into a sanitized ServiceUnavailableException, and the
// set is frozen: every other status - 400, 401, 403, 404, 409, a generic 500,
// and anything unrecognized - keeps the pre-existing fail-closed answer.
//
// The upstream `code`/`message` are NOT consulted: the QHIA-011A opaque
// identity accessor stays restricted to its own activation boundary, so this
// classification reads the HTTP status and nothing else, and no raw database
// text can reach this decision or any message it produces.
export const HIM_SNAPSHOT_TRANSIENT_TRANSPORT_STATUSES: ReadonlySet<number> = Object.freeze(new Set([408, 429, 502, 503, 504]));

@Injectable()
export class HimIntelligenceSnapshotService {
  constructor(private readonly repository:HimRepository){}
  async getSnapshot(token:string,contextKind:HimContextKind,contextId:string):Promise<HimIntelligenceSnapshot>{
    if(!(contextKind in HIM_SNAPSHOT_SLOTS))throw new Error('UNSUPPORTED_CONTEXT');
    if(!UUID.test(contextId))throw new Error('INVALID_OR_UNOWNED_CONTEXT');
    // QHIA-014A: the repository failure classification is now THREE-WAY, not
    // two-way. The explicit database active-binding integrity failure and every
    // authority/ownership/programmer failure keep their exact existing
    // fail-closed identity; only a transport that could not answer at all is
    // preserved as ServiceUnavailableException, so the foreground can tell
    // "unavailable" apart from "refused" and omit Snapshot-derived Human
    // Intelligence for the turn instead of failing it. Unknown stays closed.
    let rows:HimSnapshotSourceRow[];try{rows=await this.repository.readIntelligenceSnapshot(token,{contextKind,contextId});}catch(error){
      if(error instanceof Error&&error.message.includes('active binding integrity failure'))throw new Error('INTEGRITY_FAILURE');
      if(error instanceof ServiceUnavailableException)throw error;
      if(error instanceof MemoryDataApiError&&HIM_SNAPSHOT_TRANSIENT_TRANSPORT_STATUSES.has(error.status))throw new ServiceUnavailableException('Human Intelligence Snapshot is unavailable.');
      throw new Error('INVALID_OR_UNOWNED_CONTEXT');
    }
    return projectHimIntelligenceSnapshot(contextKind as HimSnapshotContextKind,contextId,rows);
  }
}
