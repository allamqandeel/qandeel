/**
 * S6-01 — the «التعارف مع قنديل» / Introductions with QANDEEL owner layer: its ONE public surface.
 *
 * A depth of Personal QANDEEL: the manual entry on the Personal row and the private preparation surface over the
 * Personal world. It owns no canonical state, no Session, no credential and no persistence: the integration owner
 * builds one controller per runtime generation over the T-12P transport and retires it with that generation.
 * Preparation is never enrollment (CW2-06A §2.2).
 */
export type {
  IntroductionsController,
  IntroductionsControllerOptions,
  IntroductionsNotice,
  IntroductionsState,
  IntroductionsTransport,
} from './introductions-controller';
export { createIntroductionsController, mintIntroductionsCommandId } from './introductions-controller';
export type { IntroductionsCopy } from './copy';
export { INTRODUCTIONS_COPY_GATE, INTRODUCTIONS_HISTORICAL_COPY, introductionsCopy } from './copy';
export type { IntroductionsEntryProps } from './IntroductionsEntry';
export { IntroductionsEntry } from './IntroductionsEntry';
export type { IntroductionsSurfaceProps } from './IntroductionsSurface';
export { INTRODUCTIONS_SURFACE_TEST_ID, IntroductionsSurface } from './IntroductionsSurface';
// S6-04 — a human's own private Introduction proposals, inside the same experience (never a feed, a search or a ranking).
export type { ProposalsController, ProposalsControllerOptions, ProposalsNotice, ProposalsState, ProposalsTransport } from './proposals-controller';
export { awaitsDecision, createProposalsController } from './proposals-controller';
export type { ProposalsCopy } from './proposals-copy';
export { PROPOSALS_COPY_GATE, PROPOSALS_COPY_ROWS, PROPOSALS_LANG01_APPROVED, proposalsCopy } from './proposals-copy';
export type { ProposalsSurfaceProps } from './ProposalsSurface';
export { PROPOSALS_SURFACE_TEST_ID, ProposalsCue, ProposalsSurface } from './ProposalsSurface';
// S6-05 — the Mutual Match's Introduction World: the two humans' words, END and the closed record (V-1).
export type {
  IntroductionDeletionTransport, IntroductionPending, IntroductionWorldNotice, IntroductionWorldView, IntroductionWorldsController,
  IntroductionWorldsControllerOptions, IntroductionWorldsState, IntroductionWorldsTransport,
} from './introduction-world-controller';
export { INTRODUCTION_MESSAGE_MAX_LENGTH, createIntroductionWorldsController, firstNameOf, worldOfProposal } from './introduction-world-controller';
export type { IntroductionWorldCopy, IntroductionWorldCopyKey } from './introduction-world-copy';
export { INTRODUCTION_WORLD_COPY_GATE, INTRODUCTION_WORLD_COPY_ROWS, introductionTitle, introductionWorldCopy } from './introduction-world-copy';
export type { IntroductionWorldSurfaceProps } from './IntroductionWorldSurface';
export { INTRODUCTION_WORLD_TEST_ID, IntroductionWorldSurface } from './IntroductionWorldSurface';
export { IntroductionWorldCards } from './IntroductionWorldCards';
export type { IntroductionAlertsController, IntroductionAlertsState, IntroductionAlertsTransport } from './introduction-alerts-controller';
export { createIntroductionAlertsController } from './introduction-alerts-controller';
// S6-07 (CP3) — the governed enrollment and the three independent consents (the closing step of the preparation).
export type { EnrollmentController, EnrollmentControllerOptions, EnrollmentNotice, EnrollmentOffer, EnrollmentState, EnrollmentTransport } from './enrollment-controller';
export { consentInForce, createEnrollmentController, enrollmentOffer, hasConsentControls } from './enrollment-controller';
export type { EnrollmentCopy, EnrollmentCopyKey } from './enrollment-copy';
export { ENROLLMENT_COPY_GATE, ENROLLMENT_COPY_ROWS, enrollmentCopy } from './enrollment-copy';
export { ConsentControls, EnrollmentAvailabilityLine, EnrollmentStep, enrollmentAvailabilityLine } from './IntroductionsEnrollment';
// S6-06 — progressive disclosure, the three-stage photo, the display-name consent, SUCCESS and resuming Introductions.
export type {
  IntroductionMediaState, IntroductionShareDeletionTransport, IntroductionSharingAct, IntroductionSharingController, IntroductionSharingControllerOptions,
  IntroductionSharingState, IntroductionSharingTransport, IntroductionSharingView, IntroductionSuccessTransport, IntroductionSuccessView, MyPhotoProgress,
  SharingOutcome,
} from './introduction-sharing-controller';
export { createIntroductionSharingController, handlesOf, myPhotoOf, theirPhotoOf } from './introduction-sharing-controller';
export type { IntroductionSharingCopy, IntroductionSharingCopyKey } from './introduction-sharing-copy';
export { INTRODUCTION_SHARING_COPY_GATE, INTRODUCTION_SHARING_COPY_ROWS, fillSharing, introductionSharingCopy } from './introduction-sharing-copy';
export type { IntroductionSharingPanelProps } from './IntroductionSharingPanel';
export { INTRODUCTION_SHARING_TEST_ID, IntroductionSharingPanel } from './IntroductionSharingPanel';
export type { PhotoChoice, PhotoSource } from './photo-source';
export { createDevicePhotoSource, photoTypeOf } from './photo-source';
export { releaseIntroductionRenditions } from './rendition-release';
export type {
  IntroductionParticipationTransport, ParticipationController, ParticipationControllerOptions, ParticipationLine, ParticipationState,
} from './participation-controller';
export { createParticipationController, participationLine } from './participation-controller';
