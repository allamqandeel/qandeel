import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { DataApiError, type SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { projectionRow, READING, SESSION as PROJECTION_SESSION, THREAD } from '../historical-projection/historical-projection.fixture.spec';
import { ReplayController } from './replay.controller';
import { ReplayModule } from './replay.module';
import { ReplayRepository } from './replay.repository';
import { ReplayService } from './replay.service';

// S7-01 - the API boundary of the Personal Replay (migration 0169): the exact request shapes, strict decoding of every
// row, the bounded refusal words passed on exactly and nothing else of the database's answer, no identity from the
// client, the moment analysis mapped and disclosed by the ONE T-03C mapper and depth law, and a module that imports no
// mobile, graphics, AI or distribution code.

const COMMAND = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const REPLAY = '33333333-3333-4333-8333-333333333333';
const VERSION = '44444444-4444-4444-8444-444444444444';
const AT = '2026-10-19T09:40:19.123456+00:00';

const draftRow = (overrides: Record<string, unknown> = {}) => ({
  outcome: 'CREATED', replay_id: REPLAY, replay_lifecycle: 'DRAFT', draft_revision: 1, coverage_class: 'SELECTED_EXCERPT', selected_item_count: 2, ...overrides,
});
const refusal = (keys: readonly string[], outcome: string) => Object.fromEntries(keys.map((key) => [key, key === 'outcome' ? outcome : null]));
const DRAFT_KEYS = ['outcome', 'replay_id', 'replay_lifecycle', 'draft_revision', 'coverage_class', 'selected_item_count'];
const PREVIEW_KEYS = ['outcome', 'replay_id', 'replay_version_id', 'replay_version_revision', 'moment_count', 'temporal_discontinuity_count'];
const replayRow = (overrides: Record<string, unknown> = {}) => ({
  replay_id: REPLAY, replay_lifecycle: 'PREVIEW_READY', created_at: AT, draft_revision: 2, draft_coverage_class: 'SELECTED_EXCERPT', draft_selected_item_count: 2,
  draft_first_tc: 1, draft_last_tc: 2, draft_source_state: 'CURRENT', draft_updated_at: AT, current_replay_version_id: VERSION, current_replay_version_revision: 1,
  current_version_finalized: false, ...overrides,
});
const POLICIES = {
  original_medium_policy: 'ORIGINAL_MEDIUM_TRUTH_V1', source_text_policy: 'EXACT_COMMITTED_TEXT_V1', semantic_cut_policy: 'WHOLE_ITEM_ONLY_V1',
  temporal_discontinuity_policy: 'EXPLICIT_GAP_V1', timing_integrity_policy: 'NO_SYNTHETIC_TIMING_V1', analytical_projection_policy: 'SEALED_TC_ONLY_V1',
  camera_emphasis_policy: 'NONE_V1', motion_policy: 'NONE_V1', caption_provenance_policy: 'SOURCE_TEXT_V1', accessibility_parity_policy: 'PARITY_V1',
  reduced_motion_parity_policy: 'PARITY_V1', editorial_annotation_policy: 'NONE_V1',
};
const versionRow = (overrides: Record<string, unknown> = {}) => ({
  replay_id: REPLAY, replay_version_id: VERSION, replay_version_revision: 1, version_created_at: AT, is_current: true, finalized: false,
  coverage_class: 'SELECTED_EXCERPT', moment_count: 2, temporal_discontinuity_count: 0, first_tc: 1, last_tc: 2, render_contract_revision: 1,
  render_contract_schema: 'qandeel.replay.render-contract.v1', source_medium_class: 'TEXT_ONLY', ...POLICIES,
  source_layer: 'DEREFERENCEABLE', analytical_layer: 'SEALED_HISTORICAL_EVIDENCE', viewing_state: 'VIEWABLE', not_viewable_class: null, ...overrides,
});
const momentRow = (ordinal: number, overrides: Record<string, unknown> = {}) => ({
  selected_ordinal: ordinal, tc: ordinal, source_role: ordinal % 2 ? 'USER' : 'ASSISTANT', original_medium: 'ORIGINAL_TEXT', omitted_before: 0,
  source_text: `message ${ordinal}`, ...overrides,
});
/** The 0169 analysis object: the canonical families at TC 2, without the header, the Moments or a Material's expiry. */
function analysisOf(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const { session_id: _s, live_head: _l, tc: _t, sealed: _x, revision: _r, moments: _m, ...families } = projectionRow();
  const materials = (families.materials as Record<string, unknown>[]).map(({ expiry: _e, ...material }) => material);
  return { ...families, materials, ...overrides };
}

describe('S7-01 - ReplayService', () => {
  let repository: Record<keyof ReplayRepository, jest.Mock>;
  let service: ReplayService;

  beforeEach(() => {
    repository = {
      capability: jest.fn().mockResolvedValue([{ creation_available: false }]),
      conversationReplays: jest.fn().mockResolvedValue([]),
      createDraft: jest.fn().mockResolvedValue([draftRow()]),
      reviseDraft: jest.fn().mockResolvedValue([draftRow({ outcome: 'REVISED', draft_revision: 2 })]),
      preparePreview: jest.fn().mockResolvedValue([{ outcome: 'PREVIEW_READY', replay_id: REPLAY, replay_version_id: VERSION, replay_version_revision: 1,
        moment_count: 2, temporal_discontinuity_count: 0 }]),
      finalize: jest.fn().mockResolvedValue([{ outcome: 'FINALIZED', replay_id: REPLAY, replay_version_id: VERSION, replay_version_revision: 1 }]),
      reopen: jest.fn().mockResolvedValue([{ outcome: 'REOPENED', replay_id: REPLAY, replay_lifecycle: 'DRAFT', reopened_from_replay_version_id: VERSION }]),
      replay: jest.fn().mockResolvedValue([replayRow()]),
      version: jest.fn().mockResolvedValue([versionRow()]),
      moments: jest.fn().mockResolvedValue([momentRow(1), momentRow(2)]),
      momentAnalysis: jest.fn().mockResolvedValue([{ outcome: 'AVAILABLE', selected_ordinal: 2, tc: 2, analysis: analysisOf() }]),
    } as unknown as Record<keyof ReplayRepository, jest.Mock>;
    service = new ReplayService(repository as unknown as ReplayRepository);
  });

  describe('capability', () => {
    it('answers the closed-by-default capability exactly', async () => {
      await expect(service.capability('token')).resolves.toEqual({ creationAvailable: false });
      expect(repository.capability).toHaveBeenCalledWith('token');
    });
    it.each([[[]], [[{ creation_available: 'yes' }]], [[{ creation_available: true, restriction_version: 3 }]]])('fails closed on %j', async (rows) => {
      repository.capability.mockResolvedValue(rows);
      await expect(service.capability('token')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('commands', () => {
    it('creates a draft over one range of whole messages, sending only the command, the conversation and the range', async () => {
      await expect(service.createDraft('token', { commandId: COMMAND.toUpperCase(), sessionId: SESSION, firstTc: 1, lastTc: 2 })).resolves.toEqual({
        outcome: 'CREATED', replayId: REPLAY, lifecycle: 'DRAFT', draftRevision: 1, coverageClass: 'SELECTED_EXCERPT', selectedMomentCount: 2,
      });
      expect(repository.createDraft).toHaveBeenCalledWith('token', COMMAND, SESSION, 1, 2);
    });

    it.each([
      ['a user id', { commandId: COMMAND, sessionId: SESSION, firstTc: 1, lastTc: 2, userId: SESSION }],
      ['an owner', { commandId: COMMAND, sessionId: SESSION, firstTc: 1, lastTc: 2, owner: 'me' }],
      ['a source class', { commandId: COMMAND, sessionId: SESSION, firstTc: 1, lastTc: 2, sourceClass: 'SHARED_WORLD' }],
      ['conversation units', { commandId: COMMAND, sessionId: SESSION, firstTc: 1, lastTc: 2, unitIds: [SESSION] }],
      ['a malformed command', { commandId: 'c1', sessionId: SESSION, firstTc: 1, lastTc: 2 }],
      ['a reversed range', { commandId: COMMAND, sessionId: SESSION, firstTc: 3, lastTc: 2 }],
      ['a position below 1', { commandId: COMMAND, sessionId: SESSION, firstTc: 0, lastTc: 2 }],
      ['a fractional position', { commandId: COMMAND, sessionId: SESSION, firstTc: 1.5, lastTc: 2 }],
      ['a position as text', { commandId: COMMAND, sessionId: SESSION, firstTc: '1', lastTc: 2 }],
      ['a missing field', { commandId: COMMAND, sessionId: SESSION, firstTc: 1 }],
      ['no body', null],
    ])('refuses %s as the client\'s own error, without calling the database', async (_label, body) => {
      await expect(service.createDraft('token', body)).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.createDraft).not.toHaveBeenCalled();
    });

    it.each(['NOT_AVAILABLE_NOW', 'UNAVAILABLE', 'NOT_WHOLE_MESSAGES', 'CHANGED', 'SOURCE_CHANGED', 'SELECTION_NOT_SUPPORTED', 'LIFECYCLE_NOT_ELIGIBLE', 'COMMAND_CONFLICT'])(
      'passes on the bounded draft refusal %s exactly', async (word) => {
        repository.createDraft.mockResolvedValue([refusal(DRAFT_KEYS, word)]);
        await expect(service.createDraft('token', { commandId: COMMAND, sessionId: SESSION, firstTc: 1, lastTc: 2 })).resolves.toEqual({ outcome: word });
      });

    it.each([
      ['a word the command cannot answer', refusal(DRAFT_KEYS, 'MOMENT_NOT_SEALED')],
      ['a refusal that carries an identity', { ...refusal(DRAFT_KEYS, 'UNAVAILABLE'), replay_id: REPLAY }],
      ['an unknown column', { ...draftRow(), owner_user_id: SESSION }],
      ['an unknown lifecycle', draftRow({ replay_lifecycle: 'PUBLISHED' })],
      ['a malformed identity', draftRow({ replay_id: 'r1' })],
      ['two rows', [draftRow(), draftRow()]],
    ])('fails closed on %s', async (_label, row) => {
      repository.createDraft.mockResolvedValue(Array.isArray(row) ? row : [row]);
      await expect(service.createDraft('token', { commandId: COMMAND, sessionId: SESSION, firstTc: 1, lastTc: 2 })).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('revises against the revision the caller composed on', async () => {
      await expect(service.reviseDraft('token', REPLAY, { commandId: COMMAND, expectedDraftRevision: 1, firstTc: 2, lastTc: 3 })).resolves.toMatchObject({ outcome: 'REVISED', draftRevision: 2 });
      expect(repository.reviseDraft).toHaveBeenCalledWith('token', COMMAND, REPLAY, 1, 2, 3);
    });

    it('answers a malformed Replay identity in the path as UNAVAILABLE, without calling the database', async () => {
      await expect(service.reviseDraft('token', 'r1', { commandId: COMMAND, expectedDraftRevision: 1, firstTc: 2, lastTc: 3 })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
      await expect(service.preparePreview('token', 'r1', { commandId: COMMAND, expectedDraftRevision: 1 })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
      await expect(service.finalize('token', 'r1', { commandId: COMMAND, expectedVersionId: VERSION })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
      await expect(service.reopen('token', 'r1', { commandId: COMMAND, expectedVersionId: VERSION })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
      expect(repository.reviseDraft).not.toHaveBeenCalled();
      expect(repository.preparePreview).not.toHaveBeenCalled();
      expect(repository.finalize).not.toHaveBeenCalled();
      expect(repository.reopen).not.toHaveBeenCalled();
    });

    it('prepares a real preview, and passes on MOMENT_NOT_SEALED and ANALYSIS_UNAVAILABLE exactly', async () => {
      await expect(service.preparePreview('token', REPLAY, { commandId: COMMAND, expectedDraftRevision: 2 })).resolves.toEqual({
        outcome: 'PREVIEW_READY', replayId: REPLAY, versionId: VERSION, versionRevision: 1, momentCount: 2, temporalDiscontinuityCount: 0,
      });
      expect(repository.preparePreview).toHaveBeenCalledWith('token', COMMAND, REPLAY, 2);
      for (const word of ['MOMENT_NOT_SEALED', 'ANALYSIS_UNAVAILABLE']) {
        repository.preparePreview.mockResolvedValue([refusal(PREVIEW_KEYS, word)]);
        await expect(service.preparePreview('token', REPLAY, { commandId: COMMAND, expectedDraftRevision: 2 })).resolves.toEqual({ outcome: word });
      }
      repository.preparePreview.mockResolvedValue([refusal(PREVIEW_KEYS, 'NOT_WHOLE_MESSAGES')]);
      await expect(service.preparePreview('token', REPLAY, { commandId: COMMAND, expectedDraftRevision: 2 })).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('finalizes exactly the version the caller previewed; creating a private version is all it does', async () => {
      await expect(service.finalize('token', REPLAY, { commandId: COMMAND, expectedVersionId: VERSION })).resolves.toEqual({
        outcome: 'FINALIZED', replayId: REPLAY, versionId: VERSION, versionRevision: 1,
      });
      expect(repository.finalize).toHaveBeenCalledWith('token', COMMAND, REPLAY, VERSION);
      await expect(service.finalize('token', REPLAY, { commandId: COMMAND, expectedVersionId: VERSION, audience: 'PUBLIC' })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.finalize('token', REPLAY, { commandId: COMMAND, expectedVersionId: VERSION, publish: true })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reopens a finalized version for revision', async () => {
      await expect(service.reopen('token', REPLAY, { commandId: COMMAND, expectedVersionId: VERSION })).resolves.toEqual({
        outcome: 'REOPENED', replayId: REPLAY, lifecycle: 'DRAFT', reopenedFromVersionId: VERSION,
      });
    });

    it('maps a malformed-request refusal (22023) to INVALID_REQUEST and every other database refusal to UNAVAILABLE, passing nothing on', async () => {
      repository.createDraft.mockRejectedValue(new DataApiError(400, { databaseCode: '22023', databaseMessage: 'REPLAY_REQUEST_INVALID' }));
      await expect(service.createDraft('token', { commandId: COMMAND, sessionId: SESSION, firstTc: 1, lastTc: 2 })).rejects.toBeInstanceOf(BadRequestException);
      repository.createDraft.mockRejectedValue(new DataApiError(409, { databaseCode: '40001', databaseMessage: 'REPLAY_SOURCE_STALE' }));
      const failure = service.createDraft('token', { commandId: COMMAND, sessionId: SESSION, firstTc: 1, lastTc: 2 });
      await expect(failure).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(failure).rejects.toMatchObject({ response: { outcome: 'UNAVAILABLE' } });
    });
  });

  describe('reads', () => {
    it('lists the caller\'s Replays of one conversation', async () => {
      repository.conversationReplays.mockResolvedValue([{ replay_id: REPLAY, replay_lifecycle: 'FINALIZED', created_at: AT, current_replay_version_id: VERSION, current_version_finalized: true }]);
      await expect(service.conversationReplays('token', SESSION)).resolves.toEqual({ replays: [
        { replayId: REPLAY, lifecycle: 'FINALIZED', createdAt: AT, currentVersionId: VERSION, currentVersionFinalized: true },
      ] });
      await expect(service.conversationReplays('token', 'not-a-session')).resolves.toEqual({ replays: [] });
      expect(repository.conversationReplays).toHaveBeenCalledTimes(1);
    });

    // S7-04 G-1: 0169's list answers the finalization with an EXISTS, so a fresh draft (no version) reads `false` there.
    it('S7-04 G-1: lists a fresh draft with no version, and still refuses a contradictory answer', async () => {
      const summary = (lifecycle: string, version: string | null, finalized: unknown) =>
        ({ replay_id: REPLAY, replay_lifecycle: lifecycle, created_at: AT, current_replay_version_id: version, current_version_finalized: finalized });
      repository.conversationReplays.mockResolvedValue([summary('DRAFT', null, false), summary('PREVIEW_READY', VERSION, false),
        summary('FINALIZED', VERSION, true), summary('DRAFT', VERSION, true)]);
      await expect(service.conversationReplays('token', SESSION)).resolves.toEqual({ replays: [
        { replayId: REPLAY, lifecycle: 'DRAFT', createdAt: AT, currentVersionId: null, currentVersionFinalized: null },
        { replayId: REPLAY, lifecycle: 'PREVIEW_READY', createdAt: AT, currentVersionId: VERSION, currentVersionFinalized: false },
        { replayId: REPLAY, lifecycle: 'FINALIZED', createdAt: AT, currentVersionId: VERSION, currentVersionFinalized: true },
        { replayId: REPLAY, lifecycle: 'DRAFT', createdAt: AT, currentVersionId: VERSION, currentVersionFinalized: true },
      ] });
      for (const wrong of [summary('DRAFT', null, true), summary('DRAFT', null, null), summary('DRAFT', null, 'false'),
        summary('PREVIEW_READY', VERSION, null), summary('DRAFT', 'not-a-version', false)]) {
        repository.conversationReplays.mockResolvedValue([summary('DRAFT', null, false), wrong]);
        await expect(service.conversationReplays('token', SESSION)).rejects.toMatchObject({ response: { outcome: 'UNAVAILABLE' } });
      }
    });

    it('reads one Replay, with no current version before the first preview', async () => {
      await expect(service.replay('token', REPLAY)).resolves.toMatchObject({ outcome: 'FOUND', lifecycle: 'PREVIEW_READY',
        draft: { revision: 2, firstTc: 1, lastTc: 2, sourceState: 'CURRENT' }, currentVersion: { versionId: VERSION, revision: 1, finalized: false } });
      repository.replay.mockResolvedValue([replayRow({ replay_lifecycle: 'DRAFT', current_replay_version_id: null, current_replay_version_revision: null, current_version_finalized: null })]);
      await expect(service.replay('token', REPLAY)).resolves.toMatchObject({ outcome: 'FOUND', currentVersion: null });
      repository.replay.mockResolvedValue([]);
      await expect(service.replay('token', REPLAY)).resolves.toEqual({ outcome: 'UNAVAILABLE' });
      repository.replay.mockResolvedValue([replayRow({ replay_id: VERSION })]);
      await expect(service.replay('token', REPLAY)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('reads one version with its render truth contract and both layers', async () => {
      const view = await service.version('token', REPLAY, VERSION);
      expect(view).toMatchObject({ outcome: 'FOUND', isCurrent: true, finalized: false, momentCount: 2,
        renderContract: { revision: 1, sourceMediumClass: 'TEXT_ONLY', policies: { originalMedium: 'ORIGINAL_MEDIUM_TRUTH_V1', editorialAnnotation: 'NONE_V1' } },
        viewing: { state: 'VIEWABLE', notViewableClass: null, sourceLayer: 'DEREFERENCEABLE', analyticalLayer: 'SEALED_HISTORICAL_EVIDENCE' } });
      repository.version.mockResolvedValue([versionRow({ viewing_state: 'NOT_VIEWABLE', not_viewable_class: 'SOURCE_NOT_CURRENTLY_AVAILABLE', source_layer: 'NOT_DEREFERENCEABLE' })]);
      await expect(service.version('token', REPLAY, VERSION)).resolves.toMatchObject({ viewing: { state: 'NOT_VIEWABLE', notViewableClass: 'SOURCE_NOT_CURRENTLY_AVAILABLE' } });
      for (const bad of [versionRow({ viewing_state: 'NOT_VIEWABLE', not_viewable_class: null }), versionRow({ not_viewable_class: 'VERSION_SUPERSEDED' }),
        versionRow({ motion_policy: '' }), { ...versionRow(), colour: '#ff0000' }]) {
        repository.version.mockResolvedValue([bad]);
        await expect(service.version('token', REPLAY, VERSION)).rejects.toBeInstanceOf(ServiceUnavailableException);
      }
    });

    it('reads the moments in canonical chronology, the text of every moment or of none', async () => {
      await expect(service.moments('token', REPLAY, VERSION)).resolves.toEqual({ outcome: 'FOUND', moments: [
        { ordinal: 1, tc: 1, sourceRole: 'USER', originalMedium: 'ORIGINAL_TEXT', omittedBefore: 0, text: 'message 1' },
        { ordinal: 2, tc: 2, sourceRole: 'ASSISTANT', originalMedium: 'ORIGINAL_TEXT', omittedBefore: 0, text: 'message 2' },
      ] });
      repository.moments.mockResolvedValue([momentRow(1, { source_text: null }), momentRow(2, { source_text: null })]);
      await expect(service.moments('token', REPLAY, VERSION)).resolves.toMatchObject({ moments: [{ text: null }, { text: null }] });
      for (const bad of [[momentRow(1), momentRow(2, { source_text: null })], [momentRow(2)], [momentRow(1, { tc: 4 }), momentRow(2, { tc: 3 })],
        [momentRow(1, { omitted_before: 2 })], [{ ...momentRow(1), conversation_unit_id: SESSION }]]) {
        repository.moments.mockResolvedValue(bad);
        await expect(service.moments('token', REPLAY, VERSION)).rejects.toBeInstanceOf(ServiceUnavailableException);
      }
    });

    it('discloses a moment\'s analysis through the T-03C depth law, with no Session identity, Live Head, revision or Moments', async () => {
      const world = await service.momentAnalysis('token', REPLAY, VERSION, '2', undefined);
      expect(world).toMatchObject({ outcome: 'AVAILABLE', ordinal: 2, tc: 2, depth: 'WORLD', thread: { status: 'DEPTH_WITHHELD' }, session: { status: 'DEPTH_WITHHELD' },
        analyticalObject: { status: 'DEPTH_WITHHELD' }, sourceProvenance: { status: 'DEPTH_WITHHELD' } });
      expect((world as unknown as { world: { threads: { id: string }[] } }).world.threads.map((thread) => thread.id)).toEqual([THREAD]);
      const deep = await service.momentAnalysis('token', REPLAY, VERSION, '2', 'SOURCE_PROVENANCE');
      expect(deep).toMatchObject({ analyticalObject: { status: 'DISCLOSED', value: { readings: [{ id: READING }] } }, sourceProvenance: { status: 'DISCLOSED' } });
      const wire = JSON.stringify(deep);
      for (const forbidden of ['sessionId', 'liveHead', 'revision', 'moments', 'expiry', 'committedText', 'sourceTurnId', 'assistantTurnId']) expect(wire).not.toContain(forbidden);
      expect(repository.momentAnalysis).toHaveBeenCalledWith('token', REPLAY, VERSION, 2);
    });

    it('S7-05 F-2: a Reading\'s scope leaves as its class alone, for this Session\'s Readings and an earlier Session\'s, and nothing else moves', async () => {
      const EARLIER = '55555555-5555-4555-8555-555555555555';
      const families = analysisOf();
      const [reading] = families.readings as Record<string, unknown>[];
      const earlier = { ...reading, id: '66666666-6666-4666-8666-666666666666', scope: `CONVERSATION_SESSION:${EARLIER}` };
      repository.momentAnalysis.mockResolvedValue([{ outcome: 'AVAILABLE', selected_ordinal: 2, tc: 2, analysis: { ...families, readings: [reading, earlier] } }]);
      const deep = await service.momentAnalysis('token', REPLAY, VERSION, '2', 'SOURCE_PROVENANCE');
      if (deep.outcome !== 'AVAILABLE' || deep.analyticalObject.status !== 'DISCLOSED') throw new Error('expected a disclosed analysis');
      expect(deep.analyticalObject.value.readings.map((item) => item.scope)).toEqual(['CONVERSATION_SESSION', 'CONVERSATION_SESSION']);
      const wire = JSON.stringify(deep);
      for (const session of [PROJECTION_SESSION, EARLIER]) expect(wire).not.toContain(session);
      expect(wire).not.toContain('CONVERSATION_SESSION:');
      // Everything else is exactly what the T-03C mapper and depth law disclose: each Reading differs in its scope alone,
      // and every other rung and family is untouched.
      repository.momentAnalysis.mockResolvedValue([{ outcome: 'AVAILABLE', selected_ordinal: 2, tc: 2, analysis: { ...families, readings: [reading, earlier] } }]);
      const again = await service.momentAnalysis('token', REPLAY, VERSION, '2', 'SOURCE_PROVENANCE');
      expect(again).toEqual(deep);
      const unscoped = (items: readonly Record<string, unknown>[]) => items.map(({ scope: _scope, ...rest }) => rest);
      expect(unscoped(deep.analyticalObject.value.readings)).toEqual(unscoped([reading, earlier]));
      expect(deep.analyticalObject.value.readingRelations).toEqual(families.reading_relations);
    });

    it.each([
      ['a free-text scope (the table admits one; no live writer produces it)', 'USER'],
      ['the class without its Session', 'CONVERSATION_SESSION'],
      ['an empty Session', 'CONVERSATION_SESSION:'],
      ['an upper-case Session (not the canonical uuid::text)', 'CONVERSATION_SESSION:5555555A-5555-4555-8555-555555555555'],
      ['a padded scope', `CONVERSATION_SESSION:${SESSION} `],
      ['another scope class', `GOAL:${SESSION}`],
      ['two Sessions', `CONVERSATION_SESSION:${SESSION}:${SESSION}`],
    ])('S7-05 F-2: refuses %s whole — never repaired, never passed on', async (_label, scope) => {
      const families = analysisOf();
      const [reading] = families.readings as Record<string, unknown>[];
      repository.momentAnalysis.mockResolvedValue([{ outcome: 'AVAILABLE', selected_ordinal: 2, tc: 2, analysis: { ...families, readings: [{ ...reading, scope }] } }]);
      await expect(service.momentAnalysis('token', REPLAY, VERSION, '2', 'SOURCE_PROVENANCE')).rejects.toBeInstanceOf(ServiceUnavailableException);
      // Below the rung that carries Readings nothing of them is disclosed, so nothing about their scope is answered.
      await expect(service.momentAnalysis('token', REPLAY, VERSION, '2', 'WORLD')).resolves.toMatchObject({ outcome: 'AVAILABLE', analyticalObject: { status: 'DEPTH_WITHHELD' } });
    });

    it('never lets the analysis stand in for a version that is not viewable', async () => {
      repository.momentAnalysis.mockResolvedValue([{ outcome: 'NOT_VIEWABLE', selected_ordinal: 2, tc: 2, analysis: null }]);
      await expect(service.momentAnalysis('token', REPLAY, VERSION, '2', 'SESSION')).resolves.toEqual({ outcome: 'NOT_VIEWABLE', ordinal: 2, tc: 2 });
      repository.momentAnalysis.mockResolvedValue([{ outcome: 'NOT_VIEWABLE', selected_ordinal: 2, tc: 2, analysis: analysisOf() }]);
      await expect(service.momentAnalysis('token', REPLAY, VERSION, '2', 'SESSION')).rejects.toBeInstanceOf(ServiceUnavailableException);
      repository.momentAnalysis.mockResolvedValue([{ outcome: 'ANALYSIS_NOT_CURRENTLY_AVAILABLE', selected_ordinal: 2, tc: 2, analysis: null }]);
      await expect(service.momentAnalysis('token', REPLAY, VERSION, '2', 'SESSION')).resolves.toEqual({ outcome: 'ANALYSIS_NOT_CURRENTLY_AVAILABLE', ordinal: 2, tc: 2 });
    });

    it.each([
      ['a Material that still carries its expiry', analysisOf({ materials: projectionRow().materials })],
      ['the Moments', analysisOf({ moments: [] })],
      ['a missing family', (() => { const { gaps: _g, ...rest } = analysisOf(); return rest; })()],
      ['an attention beyond TC', analysisOf({ emerging_focuses: [{ id: 'f', startedSp: 3, lastAttentionSp: null, promotedThreadId: null }] })],
    ])('fails closed on an analysis with %s, never an empty understanding', async (_label, analysis) => {
      repository.momentAnalysis.mockResolvedValue([{ outcome: 'AVAILABLE', selected_ordinal: 2, tc: 2, analysis }]);
      await expect(service.momentAnalysis('token', REPLAY, VERSION, '2', 'SOURCE_PROVENANCE')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('refuses an unknown depth as the client\'s error and answers a malformed ordinal as UNAVAILABLE', async () => {
      await expect(service.momentAnalysis('token', REPLAY, VERSION, '2', 'EVERYTHING')).rejects.toBeInstanceOf(BadRequestException);
      for (const ordinal of ['0', '-1', '1.5', 'x', '99999999999']) {
        await expect(service.momentAnalysis('token', REPLAY, VERSION, ordinal, undefined)).resolves.toEqual({ outcome: 'UNAVAILABLE' });
      }
      expect(repository.momentAnalysis).not.toHaveBeenCalled();
    });
  });
});

describe('S7-01 - ReplayRepository', () => {
  it('calls exactly the migration 0169 product wrappers on the caller\'s token, never a frozen I-06 core or a private function', async () => {
    const request = jest.fn().mockResolvedValue([]);
    const repository = new ReplayRepository({ request } as unknown as SupabaseDataApiService);
    await repository.capability('t');
    await repository.conversationReplays('t', SESSION);
    await repository.createDraft('t', COMMAND, SESSION, 1, 2);
    await repository.reviseDraft('t', COMMAND, REPLAY, 1, 1, 3);
    await repository.preparePreview('t', COMMAND, REPLAY, 2);
    await repository.finalize('t', COMMAND, REPLAY, VERSION);
    await repository.reopen('t', COMMAND, REPLAY, VERSION);
    await repository.replay('t', REPLAY);
    await repository.version('t', REPLAY, VERSION);
    await repository.moments('t', REPLAY, VERSION);
    await repository.momentAnalysis('t', REPLAY, VERSION, 2);
    expect(request.mock.calls.map(([token, path]) => [token, path])).toEqual([
      ['t', 'rpc/read_my_replay_capability_v1'], ['t', 'rpc/list_my_conversation_replays_v1'], ['t', 'rpc/create_my_replay_draft_v1'],
      ['t', 'rpc/revise_my_replay_draft_v1'], ['t', 'rpc/prepare_my_replay_preview_v1'], ['t', 'rpc/finalize_my_replay_version_v1'],
      ['t', 'rpc/reopen_my_replay_for_revision_v1'], ['t', 'rpc/read_my_replay_v1'], ['t', 'rpc/read_my_replay_version_v1'],
      ['t', 'rpc/read_my_replay_moments_v1'], ['t', 'rpc/read_my_replay_moment_analysis_v1'],
    ]);
    expect(JSON.parse(request.mock.calls[2][2].body)).toEqual({ p_command_id: COMMAND, p_session_id: SESSION, p_first_tc: 1, p_last_tc: 2 });
    for (const [, , init] of request.mock.calls) expect(Object.keys(JSON.parse(init.body)).some((key) => /user|owner|actor|source_class|unit/u.test(key))).toBe(false);
  });
});

describe('S7-01 - the Replay module is graphics-independent and isolated', () => {
  const SRC = join(__dirname, '..');
  const sources = (dir: string): string[] => readdirSync(join(SRC, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(SRC, path)).isDirectory()) return sources(path);
    return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [path] : [];
  });
  const own = sources('replay');

  it('is exactly the expected files', () => {
    expect(own.map((path) => path.replace(/\\/gu, '/')).sort()).toEqual([
      'replay/replay.controller.ts', 'replay/replay.module.ts', 'replay/replay.repository.ts', 'replay/replay.service.ts', 'replay/replay.types.ts',
    ]);
  });

  it.each(own)('%s imports only its own files, auth, the Data API transport and the T-03C historical-projection functions', (path) => {
    const text = readFileSync(join(SRC, path), 'utf8');
    for (const target of [...text.matchAll(/from '([^']+)'/gu)].map((match) => match[1])) {
      expect(target.startsWith('./') || ['@nestjs/common', '@qandeel/runtime', '../auth/authenticated-request', '../auth/supabase-auth.guard',
        '../auth/supabase-auth.service', '../conversation/supabase-data-api.service', '../historical-projection/historical-disclosure',
        '../historical-projection/historical-projection-mapper'].includes(target)).toBe(true);
    }
    const code = text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
    expect(code).not.toMatch(/apps\/mobile|react|skia|reanimated|LivingAnalysis|MapSurface|temporal-navigation|bridge|model-router|service[-_]role/iu);
    expect(code).not.toMatch(/console\.|Logger|captureException|Sentry/u);
    expect(code).not.toMatch(/colou?r|#[0-9a-f]{6}|hsl\(|rgb\(|easing|keyframe/iu);
    expect(code).not.toMatch(/export_|publish_|distribut|replay_packages|public_bridge|download/iu);
  });

  it('only the Account module composes it, and the module declares exactly its own controller and providers', () => {
    const importers = sources('.').filter((path) => !path.replace(/\\/gu, '/').startsWith('replay/')
      && readFileSync(join(SRC, path), 'utf8').includes("'../replay/"));
    expect(importers.map((path) => path.replace(/\\/gu, '/'))).toEqual(['account/account.module.ts']);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ReplayModule)).toEqual([ReplayController]);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, ReplayModule) ?? []).toEqual([]);
  });
});
