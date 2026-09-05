/**
 * T-03C — the mobile historical projection boundary: wire validation of the
 * server disclosure `V = Disclose(K(TC), depth, inspection)`, the explicit
 * authenticated transport, and the Class-B holder that keeps NOT_FETCHED,
 * FETCHED (with UNKNOWN_AT_TC and DEPTH_WITHHELD inside it) and UNAVAILABLE
 * apart.
 *
 * Passive and typed by construction. Nothing here renders, navigates,
 * persists, moves the camera, stores a credential, dispatches a Product
 * action, appends RH, or writes `LH`, `LF`, `TM`, `TC`, `IF_ref` or `MC`;
 * nothing here is mounted in the app shell. The seam is a typed input for the
 * later Map / Timeline / inspection tasks (T-04 / T-07 / T-08).
 */
export type {
  ConfidenceResolutionAtTc,
  DisclosedAnalyticalObjectRung,
  DisclosedConfidence,
  DisclosedEmergingFocus,
  DisclosedEvidenceParticipation,
  DisclosedGap,
  DisclosedHome,
  DisclosedLiveFocusAtTc,
  DisclosedMaterial,
  DisclosedMaterialExpiry,
  DisclosedMoment,
  DisclosedQuestion,
  DisclosedQuestionAppearance,
  DisclosedReading,
  DisclosedReadingLineageStep,
  DisclosedReadingRelation,
  DisclosedSessionRung,
  DisclosedSourceProvenanceRung,
  DisclosedSubjectGrounding,
  DisclosedThread,
  DisclosedThreadReadingAppearance,
  DisclosedThreadRung,
  DisclosedWorldRung,
  HistoricalAppearanceKind,
  HistoricalDisclosure,
  HistoricalExpiryMapping,
  HistoricalFamily,
  HistoricalInspectionRequest,
  HistoricalInspectionResolution,
  HistoricalProjectionUnavailableBody,
  HistoricalProjectionUnavailableCode,
  HistoricalRevision,
  HistoricalRung,
  HistoricalSemanticDepth,
  ReadingLineageStepKind,
  ThreadStateAtTc,
} from '@qandeel/runtime';

export type { HistoricalWireDecode, HistoricalWireRejectionReason } from './historical-projection-wire';
export { decodeHistoricalDisclosure, decodeUnavailableBody } from './historical-projection-wire';

export type { HistoricalDisclosureRequest, HistoricalFetchLike, HistoricalProjectionApiConfig, HistoricalTransportFailure } from './historical-projection-api';
export { HistoricalProjectionApiClient, HistoricalTransportError } from './historical-projection-api';

export type { HistoricalDisclosureEntry } from './historical-projection-cache';
export { HistoricalDisclosureCache } from './historical-projection-cache';
