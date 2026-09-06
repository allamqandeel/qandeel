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

export type { PreviewDisclosureLookup, PreviewProjection } from './preview-projection';
export { previewProjection, previewProjectionRequest } from './preview-projection';
