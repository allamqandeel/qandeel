// I-07D - the frozen Introduction progressive-disclosure, terminal-lifecycle and
// post-Introduction reactivation vocabularies, as compile-time truth.
//
// This file fixes the VOCABULARY the I-07D database runtime already enforces in
// migrations 0115, 0116 and 0117, and performs no evaluation of any kind. It is
// a sibling of the I-07A `matching-setup.types.ts`, the I-07B
// `matching-proposal.types.ts` and the I-07C `matching-match.types.ts` rather
// than an extension of any of them: all three are frozen records of their own
// slices and none is edited here.
//
// What is NOT here, because it does not exist:
//
//   * a generic disclosure RESOURCE_KIND, a JSON payload or any resource type
//     outside the frozen five - the vocabulary is closed in both places;
//   * a counterpart, recipient or audience identifier on any command - the owner
//     is `auth.uid()` and the counterpart is DERIVED from the exact Introduction;
//   * a relationship, engagement, exclusivity, marriage or legal status of any
//     kind - a completed Introduction means both humans approved continuing in
//     the SAME Shared World as Standard, and nothing else;
//   * the exact progressive image cropping, blurring or derivative-rendering
//     algorithm, the final disclosure copy, cadence or Product field catalogue,
//     the pair cooldown policy, or any ranking or score model - all deferred
//     Product scope, in this file and in the database;
//   * a CW2-08 Safety, moderation, entitlement, feature-gate or Launch Gate
//     decision - I-07D creates fail-closed seams and implements none of them.

/**
 * The frozen CW2-02 / CW2-06 progressive-disclosure resource vocabulary.
 *
 * These five broad categories are the whole of what a v1 disclosure may
 * represent. There is deliberately no generic kind to extend and no free-form
 * payload to smuggle one through.
 */
export const INTRODUCTION_DISCLOSURE_RESOURCE_TYPES = [
  'PARTIAL_IMAGE',
  'FULL_IMAGE',
  'FULL_NAME',
  'CONTACT_METHOD',
  'DEEPER_PERSONAL_FIELD',
] as const;
export type IntroductionDisclosureResourceType = (typeof INTRODUCTION_DISCLOSURE_RESOURCE_TYPES)[number];

/**
 * The three text-backed types. `DEEPER_PERSONAL_FIELD` is the only one that
 * carries a bounded Product-configurable field key; the other two carry a value
 * and nothing else.
 */
export const INTRODUCTION_DISCLOSURE_TEXT_RESOURCE_TYPES = [
  'FULL_NAME',
  'CONTACT_METHOD',
  'DEEPER_PERSONAL_FIELD',
] as const;
export type IntroductionDisclosureTextResourceType = (typeof INTRODUCTION_DISCLOSURE_TEXT_RESOURCE_TYPES)[number];

/**
 * The two image-backed types, each carrying an OPAQUE server-side media object
 * reference and never a URL, a credential or an embedded authorization.
 *
 * A partial image and a full image are two INDEPENDENT resource versions. One
 * never authorizes the other, because no authority object spans them: each
 * delivery is its own version, its own material and its own grant.
 */
export const INTRODUCTION_DISCLOSURE_IMAGE_RESOURCE_TYPES = ['PARTIAL_IMAGE', 'FULL_IMAGE'] as const;
export type IntroductionDisclosureImageResourceType = (typeof INTRODUCTION_DISCLOSURE_IMAGE_RESOURCE_TYPES)[number];

/**
 * The exactly two terminal outcomes of one Introduction, and the whole of what
 * its one terminal winner may ever be.
 *
 * `COMPLETED` is the successful transition to `ACTIVE / STANDARD` in the SAME
 * Shared World; `CLOSED` is the unilateral end to `READ_ONLY_CLOSED /
 * INTRODUCTION`. Never both, never a hybrid, never twice: the database enforces
 * it with a unique key on the exact Introduction Record.
 */
export const INTRODUCTION_TERMINAL_OUTCOMES = ['COMPLETED', 'CLOSED'] as const;
export type IntroductionTerminalOutcome = (typeof INTRODUCTION_TERMINAL_OUTCOMES)[number];

/**
 * The two acts a matched human may perform on an exact success transition
 * version before it commits, and the two states they produce.
 *
 * Approval is revocable right up to the terminal commit, and a withdrawn
 * approval can never contribute to a completion: the commit reads the CURRENT
 * pointer, not the act history.
 */
export const INTRODUCTION_SUCCESS_APPROVAL_ACTS = ['APPROVE', 'WITHDRAW'] as const;
export type IntroductionSuccessApprovalAct = (typeof INTRODUCTION_SUCCESS_APPROVAL_ACTS)[number];

export const INTRODUCTION_SUCCESS_APPROVAL_STATES = ['APPROVED', 'WITHDRAWN'] as const;
export type IntroductionSuccessApprovalState = (typeof INTRODUCTION_SUCCESS_APPROVAL_STATES)[number];

/**
 * The two CW2-06 pause reasons a terminal Introduction produces, which I-07A
 * made representable and deliberately gave no producer.
 *
 * Neither is resumable by the generic I-07A resume, which stays USER_PAUSED-only.
 * Crossing one is the dedicated, fully revalidated I-07D reactivation boundary's
 * job and nothing else's.
 */
export const POST_TERMINAL_INTRODUCTION_PAUSE_REASONS = ['POST_INTRODUCTION', 'POST_SUCCESS'] as const;
export type PostTerminalIntroductionPauseReason = (typeof POST_TERMINAL_INTRODUCTION_PAUSE_REASONS)[number];

/**
 * The two participation acts an explicit post-Introduction reactivation may
 * produce, decided by the human's own current state rather than by the caller.
 *
 * A human still paused for a terminal Introduction RESUMEs; a human who
 * explicitly turned Matching off over that exact lineage ACTIVATEs, through one
 * of the two already frozen I-07A entry channels, because an activation is a
 * fresh entry and carries its provenance.
 */
export const POST_INTRODUCTION_REACTIVATION_ACTS = ['RESUME', 'ACTIVATE'] as const;
export type PostIntroductionReactivationAct = (typeof POST_INTRODUCTION_REACTIVATION_ACTS)[number];
