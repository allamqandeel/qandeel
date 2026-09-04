import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { ConversationUnitRepository } from './conversation-unit.repository';
import type { CommitConversationUnitsRequest } from './conversation-unit.types';

const REQUEST: CommitConversationUnitsRequest = {
  sessionId: '33333333-3333-4333-8333-333333333333',
  userId: '44444444-4444-4444-8444-444444444444',
  sourceTurnId: '55555555-5555-4555-8555-555555555555',
  batchId: '66666666-6666-4666-8666-666666666666',
  units: [
    { unitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', spanStart: 0, spanEnd: 21 },
    { unitId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', spanStart: 22, spanEnd: 44 },
  ],
  evaluatorVersion: 'cu-anchor-mapper-v1',
  policyVersion: 'stage-1.2-cu-commitment-v1',
  segmentationProvider: 'OPENAI',
  segmentationModel: 'gpt-5-mini',
  segmentationPromptVersion: 'cu-segmentation-anchored-v1',
};

const serviceApi = () => {
  const rpc = jest.fn().mockResolvedValue([]);
  return { rpc, api: { rpc } as unknown as SupabaseServiceRoleApiService };
};

describe('the durable commitment seam', () => {
  it('calls only the canonical producer through the server-authority channel', async () => {
    const { rpc, api } = serviceApi();
    await new ConversationUnitRepository(api).commitUnits(REQUEST);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe('commit_conversation_units_v1');
  });

  it('sends exactly identity, ordered coordinates and provenance', async () => {
    const { rpc, api } = serviceApi();
    await new ConversationUnitRepository(api).commitUnits(REQUEST);
    const body = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'p_batch_id',
      'p_evaluator_version',
      'p_policy_version',
      'p_segmentation_model',
      'p_segmentation_prompt_version',
      'p_segmentation_provider',
      'p_session_id',
      'p_source_turn_id',
      'p_units',
      'p_user_id',
    ]);
    expect(body.p_units).toEqual([
      { unit_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', span_start: 0, span_end: 21 },
      { unit_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', span_start: 22, span_end: 44 },
    ]);
  });

  it('offers the caller no channel to forge canonical source truth', async () => {
    const { rpc, api } = serviceApi();
    await new ConversationUnitRepository(api).commitUnits(REQUEST);
    const serialized = JSON.stringify(rpc.mock.calls[0][1]);
    for (const forbidden of [
      'committed_text',
      'source_role',
      'speaker_state',
      'source_modality',
      'sha256',
      'digest',
      'fingerprint',
      'ordinal',
      'session_position',
      'live_head',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('never accepts a caller access token: commitment is server authority only', () => {
    const source = ConversationUnitRepository.prototype.commitUnits.toString();
    expect(source).not.toMatch(/accessToken|dataApi/u);
    expect(source).toMatch(/serviceApi\.rpc/u);
  });

  it('preserves the ordered unit sequence exactly as prepared', async () => {
    const { rpc, api } = serviceApi();
    await new ConversationUnitRepository(api).commitUnits(REQUEST);
    const units = (rpc.mock.calls[0][1] as { p_units: Array<{ span_start: number }> }).p_units;
    expect(units.map((unit) => unit.span_start)).toEqual([0, 22]);
  });
});
