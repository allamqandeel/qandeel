/**
 * S7-02 — the Personal Replay entry and conversation selection: its ONE public surface.
 *
 * An action on the current Personal conversation (MY_WORLD only), not a world, a tab or a library. It owns no canonical
 * state, no Session, no credential and no persistence: the integration owner builds one controller per runtime
 * generation and conversation over the S7-02 `ReplayApiClient` and retires it with that generation. It draws no
 * Analysis, map or graphic, and holds nothing a player would play: the S7-03 handoff is `ReplayDraftHandoff`.
 */
export type {
  ReplayCommandAttempt,
  ReplayConversationSource,
  ReplayDraftHandoff,
  ReplayEntryController,
  ReplayEntryControllerOptions,
  ReplayEntryState,
  ReplayEntryStatus,
  ReplayEntryTransport,
  ReplayNotice,
  ReplayScope,
  ReplaySelectionProblem,
  ReplaySelectionState,
  ReplayTarget,
} from './replay-entry-controller';
export { MAX_PROOF_PAGES, createReplayEntryController, mintReplayCommandId } from './replay-entry-controller';
export type { AnchorProof, ProvenRange } from './replay-anchors';
export type { ReplayCopyStatus, ReplayEntryCopy } from './copy';
export { REPLAY_ENTRY_COPY_GATE, REPLAY_ENTRY_COPY_ROWS, replayEntryCopy } from './copy';
export type { ReplayEntryControlProps, ReplayEntryMenuProps, ReplayNoticeLineProps, ReplaySelectionBarProps } from './ReplayEntry';
export { ReplayEntryControl, ReplayEntryMenu, ReplayNoticeLine, ReplaySelectionBar, useReplaySelection } from './ReplayEntry';
