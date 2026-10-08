import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { currentAiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import type { SharedQandeelReplyService } from '../connected-worlds/material-commit/shared-qandeel-reply.service';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import { TEXT_V1_BEHAVIORAL_GUIDANCE } from '../conversation/behavioral-response-policy.service';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { ROUTE_RATE_LIMIT_CENSUS } from '../http-security/route-rate-limit.census';
import { HISTORY_BUDGET_BYTES } from '../intelligence-runtime/integrated-context-budget-contract';
import type { ModelRouter, ModelRouterRequest } from '../model-router/model-router.types';
import { SharedConversationReplyGenerator } from './shared-conversation-reply.generator';
import { SHARED_CONVERSATION_FRAME, UNNAMED_PARTICIPANT, assembleSharedConversationRequest } from './shared-conversation-model-input';
import type { SharedMaterialRow, SharedWorldConversationRepository } from './shared-world-conversation.repository';
import type { SharedSemanticPlaceService } from './shared-semantic-place.service';
import { SharedWorldConversationService } from './shared-world-conversation.service';
import type { SharedWorldRepository } from './shared-world.repository';

const USER = '11111111-1111-4111-8111-111111111111';
const WORLD = '33333333-3333-4333-8333-333333333333';
const OTHER = '22222222-2222-4222-8222-222222222222';
const COMMAND = '55555555-5555-4555-8555-555555555555';
const MINE = '66666666-6666-4666-8666-666666666661';
const THEIRS = '66666666-6666-4666-8666-666666666662';
const QANDEEL = '66666666-6666-4666-8666-666666666663';

const rows: SharedMaterialRow[] = [
  { material_id: QANDEEL, material_kind: 'QANDEEL_OUTPUT', producer_kind: 'QANDEEL', established_at: '2026-10-05T10:02:00Z', is_self: false, author_name: null, text_body: 'أهلًا', can_delete: false },
  { material_id: THEIRS, material_kind: 'HUMAN_TEXT', producer_kind: 'HUMAN', established_at: '2026-10-05T10:01:00Z', is_self: false, author_name: 'Bassem', text_body: 'Hi', can_delete: false },
  { material_id: MINE, material_kind: 'HUMAN_TEXT', producer_kind: 'HUMAN', established_at: '2026-10-05T10:00:00Z', is_self: true, author_name: 'Amal', text_body: 'مرحبا', can_delete: true },
];

function fakes(options: { entry?: 'ALLOW' | 'UNAVAILABLE'; send?: unknown; reply?: 'COMMITTED' | 'UNAVAILABLE' | 'IN_PROGRESS' | 'LIMITED'; conversation?: boolean; page?: SharedMaterialRow[] } = {}) {
  const shared = {
    resolveEntry: jest.fn(async () => [options.entry === 'UNAVAILABLE'
      ? { outcome: 'UNAVAILABLE', world_id: null, born_at: null, joined_at: null }
      : { outcome: 'ALLOW', world_id: WORLD, born_at: '2026-10-05T00:00:00Z', joined_at: '2026-10-05T00:00:00Z' }]),
  };
  const conversation = {
    capability: jest.fn(async () => [{ conversation_available: options.conversation ?? true }]),
    material: jest.fn(async (..._args: unknown[]) => options.page ?? rows),
    sendText: jest.fn(async () => [options.send ?? { outcome: 'COMMITTED', material_id: MINE, established_at: '2026-10-05T10:03:00Z', qandeel_reply_material_id: null }]),
    deleteOwn: jest.fn(async () => [{ outcome: 'DELETED' }]),
  };
  const replies = {
    reply: jest.fn(async () => (options.reply === 'UNAVAILABLE' ? { state: 'UNAVAILABLE', reason: 'GENERATION_UNAVAILABLE' }
      : options.reply === 'IN_PROGRESS' ? { state: 'UNAVAILABLE', reason: 'WORK_IN_PROGRESS' }
      : options.reply === 'LIMITED' ? { state: 'UNAVAILABLE', reason: 'WORK_LIMITED' } : { state: 'COMMITTED', materialId: QANDEEL })),
  };
  const places = { weave: jest.fn(async () => ({ state: 'NOT_RUN', reason: 'NO_PROVIDER' })) };
  const service = new SharedWorldConversationService(shared as unknown as SharedWorldRepository, conversation as unknown as SharedWorldConversationRepository, replies as unknown as SharedQandeelReplyService, places as unknown as SharedSemanticPlaceService);
  return { service, shared, conversation, replies, places };
}

describe('S4-02 Shared conversation Product boundary', () => {
  it('returns nothing of a World before ALLOW, and nothing for a malformed World', async () => {
    const f = fakes({ entry: 'UNAVAILABLE' });
    expect(await f.service.materials('token', WORLD)).toEqual({ outcome: 'UNAVAILABLE' });
    expect(await f.service.materials('token', 'nope')).toEqual({ outcome: 'UNAVAILABLE' });
    expect(f.conversation.material).not.toHaveBeenCalled();
  });

  it('projects attribution and deletability from server truth, oldest first', async () => {
    const f = fakes();
    expect(await f.service.materials('token', WORLD)).toEqual({
      outcome: 'ALLOW', conversation: true, materials: [
        { materialId: MINE, producer: 'SELF', authorName: null, text: 'مرحبا', establishedAt: '2026-10-05T10:00:00Z', canDelete: true },
        { materialId: THEIRS, producer: 'HUMAN', authorName: 'Bassem', text: 'Hi', establishedAt: '2026-10-05T10:01:00Z', canDelete: false },
        { materialId: QANDEEL, producer: 'QANDEEL', authorName: null, text: 'أهلًا', establishedAt: '2026-10-05T10:02:00Z', canDelete: false },
      ], hasOlder: false,
    });
    // The newest page: no cursor, one row beyond the page asked for.
    expect(f.conversation.material).toHaveBeenCalledWith('token', WORLD, null, 51);
  });

  it('pages older history one bounded page at a time, and says whether more exists without counting it', async () => {
    const many: SharedMaterialRow[] = Array.from({ length: 51 }, (_, i) => ({
      material_id: `77777777-7777-4777-8777-${String(100000000000 - i).padStart(12, '0')}`, material_kind: 'HUMAN_TEXT', producer_kind: 'HUMAN',
      established_at: new Date(Date.UTC(2026, 9, 5, 9, 0, 59 - i)).toISOString(), is_self: false, author_name: 'Bassem', text_body: `m${i}`, can_delete: false,
    }));
    const f = fakes({ page: many });
    const page = await f.service.olderMaterials('token', WORLD, MINE, '2026-10-05T10:00:00.123456+00:00');
    expect(page.outcome === 'ALLOW' && page.materials.length).toBe(50);
    expect(page.outcome === 'ALLOW' && page.hasOlder).toBe(true);
    // Oldest first, and the 51st (oldest) row only signals that more exists.
    expect(page.outcome === 'ALLOW' && page.materials[0].text).toBe('m49');
    expect(f.conversation.material).toHaveBeenCalledWith('token', WORLD, { materialId: MINE, establishedAt: '2026-10-05T10:00:00.123456+00:00' }, 51);
    // The entry verdict is re-established for every page.
    expect(f.shared.resolveEntry).toHaveBeenCalledTimes(1);
  });

  it('refuses a malformed cursor before reading anything', async () => {
    const f = fakes();
    for (const [materialId, establishedAt] of [['nope', '2026-10-05T10:00:00Z'], [MINE, 'yesterday'], [MINE, '2026-10-05'], [MINE, ''],
      [MINE, '2026-10-05T10:00:00Z; DROP'], [OTHER.slice(0, 35), '2026-10-05T10:00:00Z'], [MINE, '2026-13-45T99:99:99Z']]) {
      await expect(f.service.olderMaterials('token', WORLD, materialId, establishedAt)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(f.shared.resolveEntry).not.toHaveBeenCalled();
    expect(f.conversation.material).not.toHaveBeenCalled();
  });

  it('commits the human words, then reports QANDEEL\'s reply as its own outcome', async () => {
    const f = fakes();
    expect(await f.service.send(USER, 'token', WORLD, { commandId: COMMAND, content: 'مرحبا' })).toEqual({ outcome: 'COMMITTED', materialId: MINE, qandeel: 'COMMITTED' });
    expect(f.conversation.sendText).toHaveBeenCalledWith('token', COMMAND, WORLD, 'مرحبا');
    expect(f.replies.reply).toHaveBeenCalledWith(expect.objectContaining({ worldId: WORLD, humanCommandId: COMMAND, humanMaterialId: MINE, requesterUserId: USER }));
    // SHARED-VIS-01: QANDEEL's semantic pass rides on the same committed message, after the answer is decided.
    expect(f.places.weave).toHaveBeenCalledWith({ worldId: WORLD, humanCommandId: COMMAND });
  });

  it('SHARED-VIS-01: a semantic place is never a message — not in the conversation, not in what the reply reads', async () => {
    const place: SharedMaterialRow = { material_id: '66666666-6666-4666-8666-666666666669', material_kind: 'QANDEEL_ANALYSIS', producer_kind: 'QANDEEL',
      established_at: '2026-10-05T10:03:00Z', is_self: false, author_name: null, text_body: 'A meaning of the World', can_delete: false };
    const f = fakes({ page: [place, ...rows] });
    const view = await f.service.materials('token', WORLD);
    expect(view.outcome === 'ALLOW' && view.materials.map((m) => m.materialId)).toEqual([MINE, THEIRS, QANDEEL]);
    await f.service.send(USER, 'token', WORLD, { commandId: COMMAND, content: 'مرحبا' });
    const asked = (f.replies.reply.mock.calls as unknown as [{ requesterView: { materialId: string }[] }][])[0][0];
    expect(asked.requesterView.map((m) => m.materialId)).not.toContain(place.material_id);
  });

  it('a provider failure never undoes the committed human words', async () => {
    const f = fakes({ reply: 'UNAVAILABLE' });
    expect(await f.service.send(USER, 'token', WORLD, { commandId: COMMAND, content: 'مرحبا' })).toEqual({ outcome: 'COMMITTED', materialId: MINE, qandeel: 'UNAVAILABLE' });
  });

  it('a retry while the first request is still generating reports the reply as PENDING, not failed', async () => {
    const f = fakes({ reply: 'IN_PROGRESS' });
    expect(await f.service.send(USER, 'token', WORLD, { commandId: COMMAND, content: 'مرحبا' })).toEqual({ outcome: 'COMMITTED', materialId: MINE, qandeel: 'PENDING' });
  });

  it('a requester at the work bound is told no reply was committed — never an indefinite PENDING (no worker completes it later)', async () => {
    const f = fakes({ reply: 'LIMITED' });
    expect(await f.service.send(USER, 'token', WORLD, { commandId: COMMAND, content: 'مرحبا' })).toEqual({ outcome: 'COMMITTED', materialId: MINE, qandeel: 'UNAVAILABLE' });
  });

  it('a retry whose reply already committed generates nothing again', async () => {
    const f = fakes({ send: { outcome: 'COMMITTED', material_id: MINE, established_at: '2026-10-05T10:03:00Z', qandeel_reply_material_id: QANDEEL } });
    expect(await f.service.send(USER, 'token', WORLD, { commandId: COMMAND, content: 'مرحبا' })).toEqual({ outcome: 'COMMITTED', materialId: MINE, qandeel: 'COMMITTED' });
    expect(f.replies.reply).not.toHaveBeenCalled();
  });

  it('a closed capability or a non-member is one neutral UNAVAILABLE, and no reply is attempted', async () => {
    const f = fakes({ send: { outcome: 'UNAVAILABLE', material_id: null, established_at: null, qandeel_reply_material_id: null } });
    expect(await f.service.send(USER, 'token', WORLD, { commandId: COMMAND, content: 'x' })).toEqual({ outcome: 'UNAVAILABLE' });
    expect(f.replies.reply).not.toHaveBeenCalled();
  });

  it('takes no author, audience, kind or member claim, and refuses unbounded or empty words', async () => {
    const f = fakes();
    for (const body of [
      { commandId: COMMAND, content: 'x', authorId: OTHER }, { commandId: COMMAND, content: 'x', audience: [OTHER] },
      { commandId: COMMAND, content: 'x', materialKind: 'QANDEEL_OUTPUT' }, { commandId: COMMAND, content: 'x', userId: OTHER },
      { commandId: 'nope', content: 'x' }, { commandId: COMMAND, content: '   ' }, { commandId: COMMAND, content: 'x'.repeat(20001) },
    ]) {
      await expect(f.service.send(USER, 'token', WORLD, body)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(f.conversation.sendText).not.toHaveBeenCalled();
  });

  it('the frozen command conflict is the client\'s own contradiction; a transport failure is one neutral unavailability', async () => {
    const f = fakes();
    f.conversation.sendText.mockRejectedValueOnce(new DataApiError(409));
    await expect(f.service.send(USER, 'token', WORLD, { commandId: COMMAND, content: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    f.conversation.sendText.mockRejectedValueOnce(new DataApiError(500));
    await expect(f.service.send(USER, 'token', WORLD, { commandId: COMMAND, content: 'x' })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('deletes only through the owner command, with neutral answers for malformed identities', async () => {
    const f = fakes();
    expect(await f.service.deleteMaterial('token', WORLD, MINE, { commandId: COMMAND })).toEqual({ outcome: 'DELETED' });
    expect(await f.service.deleteMaterial('token', WORLD, 'nope', { commandId: COMMAND })).toEqual({ outcome: 'UNAVAILABLE' });
    await expect(f.service.deleteMaterial('token', WORLD, MINE, { commandId: COMMAND, ownerId: USER })).rejects.toBeInstanceOf(BadRequestException);
    expect(f.conversation.deleteOwn).toHaveBeenCalledTimes(1);
  });

  it('classifies every Shared conversation route; the send that can start a generation is held to the strict class', () => {
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /shared/worlds/:worldId/materials']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /shared/worlds/:worldId/materials/before/:materialId/:establishedAt']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /shared/worlds/:worldId/messages']).toBe('SECURITY_SENSITIVE');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /shared/worlds/:worldId/materials/:materialId/delete']).toBe('AUTHENTICATED');
  });
});

describe('S4-02 Shared model-input assembler', () => {
  const turns = [
    { producer: 'QANDEEL' as const, authorName: null, text: 'Welcome.' },
    { producer: 'HUMAN' as const, authorName: 'Bassem', text: 'Hello' },
    { producer: 'HUMAN' as const, authorName: null, text: 'and me' },
    { producer: 'QANDEEL' as const, authorName: null, text: 'Hi both.' },
    { producer: 'HUMAN' as const, authorName: 'Amal', text: 'كيف حالك؟' },
  ];

  it('attributes by Name only, merges speakers, opens with a person and ends with the current message', () => {
    const request = assembleSharedConversationRequest(turns)!;
    expect(request.context).toEqual([
      { role: 'USER', content: `Bassem: Hello\n\n${UNNAMED_PARTICIPANT}: and me` },
      { role: 'ASSISTANT', content: 'Hi both.' },
      { role: 'USER', content: 'Amal: كيف حالك؟' },
    ]);
    expect(request.behavioralGuidance).toBe(`${TEXT_V1_BEHAVIORAL_GUIDANCE}\n${SHARED_CONVERSATION_FRAME}`);
  });

  it('carries no Personal intelligence of any kind', () => {
    const request = assembleSharedConversationRequest(turns)! as unknown as Record<string, unknown>;
    for (const field of ['memoryContext', 'humanIntelligence', 'hypothesisContext', 'recommendationContext', 'questionContext']) expect(request[field]).toBeUndefined();
  });

  it('keeps the current message always and older history within the frozen history budget', () => {
    const long = Array.from({ length: 40 }, (_, i) => ({ producer: 'HUMAN' as const, authorName: 'B', text: `${i}:${'x'.repeat(1000)}` }));
    const request = assembleSharedConversationRequest([...long, { producer: 'HUMAN', authorName: 'A', text: 'now' }])!;
    const all = request.context.map((m) => m.content).join('');
    expect(all.endsWith('A: now')).toBe(true);
    expect(Buffer.byteLength(all, 'utf8')).toBeLessThan(HISTORY_BUDGET_BYTES + 200);
    expect(all).not.toContain('B: 0:x');
  });

  it('assembles nothing when the newest material is not a person\'s', () => {
    expect(assembleSharedConversationRequest([{ producer: 'QANDEEL', authorName: null, text: 'x' }])).toBeNull();
  });
});

describe('S4-02 Shared reply generator', () => {
  const conversation = [{ producer: 'HUMAN' as const, authorName: 'Amal', text: 'مرحبا' }];

  it('calls the Model Router inside the accounting scope of the requesting human', async () => {
    const seen: { request: ModelRouterRequest; userId: string | undefined }[] = [];
    const router: ModelRouter = { async generate(request) { seen.push({ request, userId: currentAiUsageAttribution()?.userId }); return { content: 'أهلًا', routingMetadata: { path: request.path }, usage: { inputTokens: 0, outputTokens: 0 } }; } };
    const generator = new SharedConversationReplyGenerator(router, new SafetyResponseGateService());
    expect(await generator.generate({ requesterUserId: USER, conversation })).toEqual({ state: 'GENERATED', text: 'أهلًا' });
    expect(seen).toHaveLength(1);
    expect(seen[0].userId).toBe(USER);
  });

  it('a BLOCK answers with the canonical deterministic words and calls no provider', async () => {
    const router: ModelRouter = { generate: jest.fn() };
    const generator = new SharedConversationReplyGenerator(router, new SafetyResponseGateService());
    const result = await generator.generate({ requesterUserId: USER, conversation: [{ producer: 'HUMAN', authorName: 'Amal', text: 'how can I kill myself tonight' }] });
    expect(result.state).toBe('GENERATED');
    expect(router.generate).not.toHaveBeenCalled();
  });

  it('a provider failure is UNAVAILABLE, never a fabricated reply', async () => {
    const router: ModelRouter = { generate: jest.fn(async () => { throw new Error('provider down'); }) };
    const generator = new SharedConversationReplyGenerator(router, new SafetyResponseGateService());
    expect(await generator.generate({ requesterUserId: USER, conversation })).toEqual({ state: 'UNAVAILABLE' });
  });
});
