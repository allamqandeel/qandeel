/**
 * W1A-01 — the Conversation owner layer: its ONE public surface.
 *
 * It owns the Conversation's presentation — the conversation-so-far as the server reports it, the
 * composer and the one unresolved submission — and the frozen visual language that presents it. It
 * owns no canonical state, no Session, no credential and no persistence: the integration owner
 * builds one controller per runtime generation over the T-12P transport and retires it with that
 * generation, and the Analysis world is reached only through the existing live catch-up seam.
 */

export type {
  ConversationController,
  ConversationControllerOptions,
  ConversationPresentationState,
  ConversationTransport,
  HistoryStatus,
  PendingSubmission,
  SubmissionPhase,
} from './conversation-controller';
export {
  ABANDONED_REPLY_RECHECKS,
  ABANDONED_REPLY_RECHECK_MS,
  MAX_SUBMISSION_LENGTH,
  SUBMISSION_CONFIRMATION_WINDOW_MS,
  createConversationController,
  mintSubmissionKey,
} from './conversation-controller';

export type { ConversationCopy } from './copy';
export { conversationCopy } from './copy';

export type { DirectedParagraph, ParagraphDirection, PhysicalSide } from './bidi';
export { directedParagraphs, paragraphDirection, readerDirection, readerSide, withDirectionMark } from './bidi';

export type { ConversationSurfaceProps, SurfaceInsets } from './ConversationSurface';
export { CONVERSATION_SURFACE_TEST_ID, ConversationSurface } from './ConversationSurface';
export type { AnalysisReturnBarProps } from './AnalysisReturnBar';
export { ANALYSIS_RETURN_BAR_MIN_HEIGHT, AnalysisReturnBar } from './AnalysisReturnBar';

export { DEPTH_CROSSFADE_MS, DEPTH_CROSSFADE_REDUCED_MOTION_MS } from './visual/motion';
