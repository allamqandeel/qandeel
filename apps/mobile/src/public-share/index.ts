/**
 * S8A-05 CP2 — «شارك في العالم العام» / Share in Public World, from the current Personal conversation: its ONE public
 * surface. The integration owner builds one controller per runtime generation and conversation and retires it with that
 * generation; the draft it creates is private and opened by the composition in Public World.
 */
export type {
  PublicShareController, PublicShareControllerOptions, PublicShareConversation, PublicShareProblem, PublicShareState, PublicShareTransport,
} from './public-share-controller';
export { createPublicShareController, shareChoiceOf } from './public-share-controller';
export type { PublicShareBarProps, PublicShareEntryProps } from './PublicShareEntry';
export { PublicShareBar, PublicShareEntry, usePublicShareSelection } from './PublicShareEntry';
