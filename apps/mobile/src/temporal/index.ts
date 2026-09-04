/**
 * T-03A2 — the mobile temporal boundary: wire validation, transport, and the
 * one seam from `CONVERSATIONAL_UNITS_COMMITTED` to the T-02 canonical mirror
 * event `LIVE_HEAD_ADVANCED`.
 *
 * Non-UI by construction. Nothing here renders, navigates, persists or stores a
 * credential, and nothing here is mounted in the app shell: T-03A2 delivers
 * authoritative `LH` only, and `LF` stays with T-03D. No `LF = null` conclusion
 * is invented merely because T-03D has not landed, and the T-02 meaning of
 * `live = { LH, LF }` is unchanged.
 */
export type {
  ConversationalUnitsCommittedWireEvent,
  ConversationTemporalDelivery,
  SessionTemporalSnapshot,
} from '@qandeel/runtime';

export type { CommittedUnitsResponse, WireDecode, WireRejectionReason } from './temporal-wire';
export {
  CONVERSATIONAL_UNITS_COMMITTED,
  CONVERSATIONAL_UNITS_COMMITTED_VERSION,
  decodeCommittedUnitsEvent,
  decodeCommittedUnitsPage,
  decodeCommittedUnitsResponse,
  decodeSessionTemporalSnapshot,
} from './temporal-wire';

export type { LiveHeadSyncOutcome, LiveHeadSyncRejection } from './live-head-sync';
export { applyCommittedUnitsEvent, applyCommittedUnitsPage, applyDecodedCommittedUnitsEvent } from './live-head-sync';

export type { CommittedEventsPageRequest, FetchLike, TemporalApiConfig, TemporalTransportFailure } from './temporal-api';
export { MAX_TEMPORAL_EVENT_PAGE, TemporalApiClient, TemporalTransportError } from './temporal-api';
