import { ServiceUnavailableException } from '@nestjs/common';
import { ReplayRepository } from './replay.repository';
import { ReplayService } from './replay.service';

// S8B-07 CP1-A (migration 0195): a version built under Render Contract V2 reaches the API through the unchanged 0169
// version read, and the unchanged decoder (replay.service.ts, pinned by the S7-03 / S7-04 contracts) passes its D-04
// values through verbatim. No new wire key exists: the window binding never leaves the database, and no audio, key or
// plan is on this wire. The mobile composite refuses a V2 version whole (RENDER_CONTRACT_NOT_HONOURED) until CP1-B.

const REPLAY = '33333333-3333-4333-8333-333333333333';
const VERSION = '44444444-4444-4444-8444-444444444444';
const AT = '2026-11-05T09:40:19.123456+00:00';

const V2 = {
  render_contract_schema: 'QANDEEL_REPLAY_RENDER_CONTRACT_V2', source_medium_class: 'ORIGINAL_MEDIA_PRESERVED',
  original_medium_policy: 'PRESERVE_ORIGINAL_MEDIUM_ONLY', source_text_policy: 'EXACT_SOURCE_TEXT_AUDIO_TRANSCRIPT_DERIVED',
  semantic_cut_policy: 'WHOLE_ITEM_ONLY_PROVEN_SAFE', temporal_discontinuity_policy: 'PERCEPTIBLE_DISCONTINUITY_REQUIRED',
  timing_integrity_policy: 'ORIGINAL_SOURCE_CLOCK_WITH_DECLARED_TEXT_PACING', analytical_projection_policy: 'BOUND_HISTORICAL_PROJECTION_DIGEST',
  camera_emphasis_policy: 'EMPHASIS_WITHOUT_MEANING_CREATION', motion_policy: 'EXPLANATORY_MOTION_ONLY',
  caption_provenance_policy: 'DERIVED_CAPTION_DISTINCT_FROM_SOURCE', accessibility_parity_policy: 'EQUIVALENT_TRUTH_REQUIRED',
  reduced_motion_parity_policy: 'EQUIVALENT_TRUTH_REQUIRED', editorial_annotation_policy: 'NO_EDITORIAL_ANNOTATION',
};
const versionRow = (overrides: Record<string, unknown> = {}) => ({
  replay_id: REPLAY, replay_version_id: VERSION, replay_version_revision: 1, version_created_at: AT, is_current: true, finalized: true,
  coverage_class: 'SELECTED_EXCERPT', moment_count: 4, temporal_discontinuity_count: 0, first_tc: 1, last_tc: 4, render_contract_revision: 1,
  ...V2, source_layer: 'DEREFERENCEABLE', analytical_layer: 'SEALED_HISTORICAL_EVIDENCE', viewing_state: 'VIEWABLE', not_viewable_class: null,
  ...overrides,
});

describe('S8B-07 CP1-A - a Render Contract V2 version through the unchanged decoder', () => {
  let version: jest.Mock;
  let service: ReplayService;

  beforeEach(() => {
    version = jest.fn().mockResolvedValue([versionRow()]);
    service = new ReplayService({ version } as unknown as ReplayRepository);
  });

  it('passes the D-04 values through verbatim', async () => {
    await expect(service.version('token', REPLAY, VERSION)).resolves.toMatchObject({
      outcome: 'FOUND',
      renderContract: {
        revision: 1, schema: 'QANDEEL_REPLAY_RENDER_CONTRACT_V2', sourceMediumClass: 'ORIGINAL_MEDIA_PRESERVED',
        policies: {
          originalMedium: 'PRESERVE_ORIGINAL_MEDIUM_ONLY', sourceText: 'EXACT_SOURCE_TEXT_AUDIO_TRANSCRIPT_DERIVED',
          timingIntegrity: 'ORIGINAL_SOURCE_CLOCK_WITH_DECLARED_TEXT_PACING', semanticCut: 'WHOLE_ITEM_ONLY_PROVEN_SAFE',
        },
      },
    });
  });

  it('admits no new wire key: a binding, a key or a plan in the row is refused whole', async () => {
    for (const extra of [{ source_window_binding_digest: `sha256:${'a'.repeat(64)}` }, { storage_key: 'voice-note/x' }, { audio_plan: [] }]) {
      version.mockResolvedValue([versionRow(extra)]);
      await expect(service.version('token', REPLAY, VERSION)).rejects.toBeInstanceOf(ServiceUnavailableException);
    }
  });
});
