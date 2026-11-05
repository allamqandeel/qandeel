import { ServiceUnavailableException } from '@nestjs/common';
import { ReplayRepository } from './replay.repository';
import { ReplayService } from './replay.service';

// S8B-07 CP1-A (migration 0195; the Product Owner's S-2 option (a), 2026-11-05): the version decoder admits exactly the two
// approved render contracts, value for value: V1 as 0102's CHECKs, V2 as 0195's (D-04). Any other schema, any mix of the
// two, and any single policy changed is refused whole. The wire keeps its shape: no binding, key, plan or new field
// leaves the API. The mobile composite refuses a V2 version whole (RENDER_CONTRACT_NOT_HONOURED) until CP1-B.

const REPLAY = '33333333-3333-4333-8333-333333333333';
const VERSION = '44444444-4444-4444-8444-444444444444';
const AT = '2026-11-05T09:40:19.123456+00:00';

const SHARED = {
  original_medium_policy: 'PRESERVE_ORIGINAL_MEDIUM_ONLY', semantic_cut_policy: 'WHOLE_ITEM_ONLY_PROVEN_SAFE',
  temporal_discontinuity_policy: 'PERCEPTIBLE_DISCONTINUITY_REQUIRED', analytical_projection_policy: 'BOUND_HISTORICAL_PROJECTION_DIGEST',
  camera_emphasis_policy: 'EMPHASIS_WITHOUT_MEANING_CREATION', motion_policy: 'EXPLANATORY_MOTION_ONLY',
  caption_provenance_policy: 'DERIVED_CAPTION_DISTINCT_FROM_SOURCE', accessibility_parity_policy: 'EQUIVALENT_TRUTH_REQUIRED',
  reduced_motion_parity_policy: 'EQUIVALENT_TRUTH_REQUIRED', editorial_annotation_policy: 'NO_EDITORIAL_ANNOTATION',
};
const V1 = {
  render_contract_schema: 'QANDEEL_REPLAY_RENDER_CONTRACT_V1', source_medium_class: 'ORIGINAL_TEXT_ONLY', ...SHARED,
  source_text_policy: 'EXACT_SOURCE_TEXT', timing_integrity_policy: 'PRESENTATION_PACING_DECLARED',
};
const V2 = {
  render_contract_schema: 'QANDEEL_REPLAY_RENDER_CONTRACT_V2', source_medium_class: 'ORIGINAL_MEDIA_PRESERVED', ...SHARED,
  source_text_policy: 'EXACT_SOURCE_TEXT_AUDIO_TRANSCRIPT_DERIVED', timing_integrity_policy: 'ORIGINAL_SOURCE_CLOCK_WITH_DECLARED_TEXT_PACING',
};
const POLICY_COLUMNS = Object.keys(V1).filter((column) => column.endsWith('_policy'));
const versionRow = (contract: Record<string, unknown>, overrides: Record<string, unknown> = {}) => ({
  replay_id: REPLAY, replay_version_id: VERSION, replay_version_revision: 1, version_created_at: AT, is_current: true, finalized: true,
  coverage_class: 'SELECTED_EXCERPT', moment_count: 4, temporal_discontinuity_count: 0, first_tc: 1, last_tc: 4, render_contract_revision: 1,
  ...contract, source_layer: 'DEREFERENCEABLE', analytical_layer: 'SEALED_HISTORICAL_EVIDENCE', viewing_state: 'VIEWABLE', not_viewable_class: null,
  ...overrides,
});
const VIEW_KEYS = ['outcome', 'replayId', 'versionId', 'revision', 'createdAt', 'isCurrent', 'finalized', 'coverageClass', 'momentCount',
  'temporalDiscontinuityCount', 'firstTc', 'lastTc', 'renderContract', 'viewing'];
const POLICY_KEYS = ['originalMedium', 'sourceText', 'semanticCut', 'temporalDiscontinuity', 'timingIntegrity', 'analyticalProjection',
  'cameraEmphasis', 'motion', 'captionProvenance', 'accessibilityParity', 'reducedMotionParity', 'editorialAnnotation'];

describe('S8B-07 CP1-A - the version decoder admits exactly the approved render contracts', () => {
  let version: jest.Mock;
  let service: ReplayService;
  const read = () => service.version('token', REPLAY, VERSION);
  const refused = async (row: Record<string, unknown>) => {
    version.mockResolvedValue([row]);
    await expect(read()).rejects.toBeInstanceOf(ServiceUnavailableException);
  };

  beforeEach(() => {
    version = jest.fn();
    service = new ReplayService({ version } as unknown as ReplayRepository);
  });

  it('decodes the exact V1 contract as before, with the same wire shape', async () => {
    version.mockResolvedValue([versionRow(V1)]);
    const view = await read();
    expect(Object.keys(view)).toEqual(VIEW_KEYS);
    expect(view).toMatchObject({ outcome: 'FOUND', renderContract: {
      revision: 1, schema: 'QANDEEL_REPLAY_RENDER_CONTRACT_V1', sourceMediumClass: 'ORIGINAL_TEXT_ONLY',
      policies: { originalMedium: 'PRESERVE_ORIGINAL_MEDIUM_ONLY', sourceText: 'EXACT_SOURCE_TEXT', timingIntegrity: 'PRESENTATION_PACING_DECLARED',
        editorialAnnotation: 'NO_EDITORIAL_ANNOTATION' },
    } });
    if (view.outcome !== 'FOUND') throw new Error('not found');
    expect(Object.keys(view.renderContract)).toEqual(['revision', 'schema', 'sourceMediumClass', 'policies']);
    expect(Object.keys(view.renderContract.policies)).toEqual(POLICY_KEYS);
  });

  it('decodes the exact V2 contract (D-04) with the same wire shape and no new field', async () => {
    version.mockResolvedValue([versionRow(V2)]);
    const view = await read();
    expect(Object.keys(view)).toEqual(VIEW_KEYS);
    expect(view).toMatchObject({ outcome: 'FOUND', renderContract: {
      revision: 1, schema: 'QANDEEL_REPLAY_RENDER_CONTRACT_V2', sourceMediumClass: 'ORIGINAL_MEDIA_PRESERVED',
      policies: { originalMedium: 'PRESERVE_ORIGINAL_MEDIUM_ONLY', sourceText: 'EXACT_SOURCE_TEXT_AUDIO_TRANSCRIPT_DERIVED',
        timingIntegrity: 'ORIGINAL_SOURCE_CLOCK_WITH_DECLARED_TEXT_PACING', semanticCut: 'WHOLE_ITEM_ONLY_PROVEN_SAFE' },
    } });
    if (view.outcome !== 'FOUND') throw new Error('not found');
    expect(Object.keys(view.renderContract)).toEqual(['revision', 'schema', 'sourceMediumClass', 'policies']);
    expect(Object.keys(view.renderContract.policies)).toEqual(POLICY_KEYS);
  });

  it('refuses an unknown, empty, absent or inherited schema', async () => {
    for (const schema of ['QANDEEL_REPLAY_RENDER_CONTRACT_V3', 'qandeel.replay.render-contract.v1', 'QANDEEL_REPLAY_RENDER_CONTRACT_V1 ', '', null,
      'constructor', '__proto__', 'toString', 1]) {
      await refused(versionRow(V1, { render_contract_schema: schema }));
      await refused(versionRow(V2, { render_contract_schema: schema }));
    }
  });

  it('refuses a mix of the two contracts: each schema only with its own medium and policies', async () => {
    await refused(versionRow(V1, { render_contract_schema: V2.render_contract_schema }));
    await refused(versionRow(V2, { render_contract_schema: V1.render_contract_schema }));
    await refused(versionRow(V1, { source_medium_class: V2.source_medium_class }));
    await refused(versionRow(V2, { source_medium_class: V1.source_medium_class }));
    await refused(versionRow(V1, { source_text_policy: V2.source_text_policy }));
    await refused(versionRow(V1, { timing_integrity_policy: V2.timing_integrity_policy }));
    await refused(versionRow(V2, { source_text_policy: V1.source_text_policy }));
    await refused(versionRow(V2, { timing_integrity_policy: V1.timing_integrity_policy }));
  });

  it('refuses any unapproved medium, and any single policy changed, in either contract', async () => {
    for (const contract of [V1, V2]) {
      for (const medium of ['TEXT_ONLY', 'ORIGINAL_AUDIO', 'MIXED', '', null]) await refused(versionRow(contract, { source_medium_class: medium }));
      for (const column of POLICY_COLUMNS) {
        for (const value of [`${(contract as Record<string, string>)[column]}_X`, (contract as Record<string, string>)[column].toLowerCase(), '', null, 7]) {
          await refused(versionRow(contract, { [column]: value }));
        }
      }
    }
  });

  it('admits no new wire key: a binding, a key or a plan in the row is refused whole', async () => {
    for (const contract of [V1, V2]) {
      for (const extra of [{ source_window_binding_digest: `sha256:${'a'.repeat(64)}` }, { storage_key: 'voice-note/x' }, { audio_plan: [] }]) {
        await refused(versionRow(contract, extra));
      }
    }
  });
});
