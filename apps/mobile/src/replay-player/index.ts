/**
 * S7-04 — the Personal Replay player and its navigation: its ONE public surface.
 *
 * One player per runtime generation, built and retired by the integration owner over the S7-02 reads, the S7-04
 * lifecycle commands and the S7-03 history reads. It is a passage over the Personal world, not a world, a tab, a route
 * stack or a library: the historical truth and the moment order are the Replay's (through the S7-03 composite), the
 * graphics are Living Analysis's, and nothing of it enters the live conversation.
 */
export type {
  ReplayPlayerAct,
  ReplayPlayerCommand,
  ReplayPlayerCommands,
  ReplayPlayerController,
  ReplayPlayerControllerOptions,
  ReplayPlayerOrigin,
  ReplayPlayerProblem,
  ReplayPlayerReads,
  ReplayPlayerScheduler,
  ReplayPlayerState,
  ReplayPlayerTransportView,
  ReplayPlayerView,
} from './player-controller';
export { REPLAY_READING_PACE, createReplayPlayerController, readingPaceMs } from './player-controller';
export type { ReplayPlayerCopy, ReplayPlayerCopyStatus } from './copy';
export { REPLAY_PLAYER_COPY_GATE, REPLAY_PLAYER_COPY_ROWS, replayPlayerCopy } from './copy';
export type { ReplayAnalysisEntryProps, ReplayPlayerProps, ReplayPreviewActionProps } from './ReplayPlayer';
export { REPLAY_PLAYER_TEST_ID, ReplayAnalysisEntry, ReplayPlayer, ReplayPreviewAction } from './ReplayPlayer';
