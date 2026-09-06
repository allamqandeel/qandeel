/**
 * T-06 — the ephemeral temporal preview and the explicitly bounded projection it may present.
 * Nothing exported here can write canonical state, and nothing here can fetch.
 */
export type {
  ActiveTemporalPreview,
  CommittedTemporalOrigin,
  PreviewResult,
  PreviewSource,
  TemporalPreview,
  TemporalPreviewController,
} from './preview-state';
export { IDLE_PREVIEW, createTemporalPreviewController } from './preview-state';

export type { AuthorizedPreviewTarget, PreviewDisclosureLookup, PreviewProjection, PreviewTargetAuthorization } from './preview-projection';
export {
  authorizePreviewTarget,
  isAuthorizedPreviewTarget,
  previewProjection,
  previewProjectionRequest,
  projectAuthorizedPreviewTarget,
} from './preview-projection';
