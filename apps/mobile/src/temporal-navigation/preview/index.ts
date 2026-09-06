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

// R3-02: the authorization token and the low-level projector are module-private on purpose. The
// public surface is exactly these two functions, each of which authorizes against the CURRENT
// canonical state and projects in the same call, so no reusable — and therefore staleable —
// projection capability exists to be held or replayed.
export type { PreviewDisclosureLookup, PreviewProjection } from './preview-projection';
export { previewProjection, previewProjectionRequest } from './preview-projection';
