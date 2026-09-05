/**
 * T-03A2 / T-03D — the mobile temporal boundary: wire validation, transport,
 * and the two seams from the server domain events to the T-02 canonical
 * mirror events:
 *
 *   CONVERSATIONAL_UNITS_COMMITTED -> LIVE_HEAD_ADVANCED   (LH, T-03A2)
 *   LIVE_FOCUS_TRANSITION          -> LIVE_FOCUS_TRANSITION (LF, T-03D)
 *
 * Non-UI by construction. Nothing here renders, navigates, persists, moves the
 * camera or stores a credential, and nothing here is mounted in the app shell.
 * LF ingestion changes `LF` only - never `LH`, `TM`, `TC`, `IF_ref`, `MC` or
 * `RH` - and creates no persistent focus-follow; Return-to-Live-Focus and Go
 * Live + Locate belong to T-07.
 */
export type {
  ConversationLiveDelivery,
  ConversationalUnitsCommittedWireEvent,
  ConversationTemporalDelivery,
  LiveFocusTransitionWireEvent,
  LiveFocusWireValue,
  SessionTemporalSnapshot,
} from '@qandeel/runtime';

export type { CommittedUnitsResponse, LiveFocusEventsResponse, WireDecode, WireRejectionReason } from './temporal-wire';
export {
  CONVERSATIONAL_UNITS_COMMITTED,
  CONVERSATIONAL_UNITS_COMMITTED_VERSION,
  LIVE_FOCUS_TRANSITION,
  LIVE_FOCUS_TRANSITION_VERSION,
  decodeCommittedUnitsEvent,
  decodeCommittedUnitsPage,
  decodeCommittedUnitsResponse,
  decodeLiveFocusEventsPage,
  decodeLiveFocusEventsResponse,
  decodeLiveFocusTransitionEvent,
  decodeLiveFocusWireValue,
  decodeSessionTemporalSnapshot,
} from './temporal-wire';

export type { LiveHeadSyncOutcome, LiveHeadSyncRejection } from './live-head-sync';
export { applyCommittedUnitsEvent, applyCommittedUnitsPage, applyDecodedCommittedUnitsEvent } from './live-head-sync';

export type { LiveFocusSyncOutcome, LiveFocusSyncRejection } from './live-focus-sync';
export {
  applyDecodedLiveFocusTransitionEvent,
  applyLiveFocusEventsPage,
  applyLiveFocusTransitionEvent,
  liveTruthFromSnapshot,
  toMirrorLiveFocus,
} from './live-focus-sync';

export type { CommittedEventsPageRequest, FetchLike, TemporalApiConfig, TemporalTransportFailure } from './temporal-api';
export { MAX_TEMPORAL_EVENT_PAGE, TemporalApiClient, TemporalTransportError } from './temporal-api';
