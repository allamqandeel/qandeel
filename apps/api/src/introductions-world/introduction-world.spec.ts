import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { DataApiError, type SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { IntroductionWorldRepository } from './introduction-world.repository';
import { IntroductionWorldService } from './introduction-world.service';
import { IntroductionsWorldModule } from './introductions-world.module';

// S6-05 (CP3) - the API boundary of the Introduction World's human conversation (migration 0160): the exact request
// shapes, strict decoding of every row, ENDED only on the server's own answer, one call per request and never a retry,
// no identity from the client, nothing of the database's answer passed on, and no AI, Activity or notification anywhere.
// CP4 adds the closed history after END (migration 0161): the same strict decoding, ENDED rows only, one answer otherwise.

const WORLD = '11111111-1111-4111-8111-111111111111';
const PROPOSAL = '22222222-2222-4222-8222-222222222222';
const COMMAND = '33333333-3333-4333-8333-333333333333';
const MATERIAL = '44444444-4444-4444-8444-444444444444';
const OTHER = '55555555-5555-4555-8555-555555555555';
const AT = '2026-10-16T09:40:19.123456+00:00';
const EARLIER = '2026-10-16T09:40:18.000001+00:00';
const worldRow = (overrides: Record<string, unknown> = {}) => ({
  world_id: WORLD, matching_proposal_id: PROPOSAL, introduction_state: 'ACTIVE', other_first_name: 'Omar', ...overrides,
});
const messageRow = (overrides: Record<string, unknown> = {}) => ({
  introduction_state: 'ACTIVE', material_id: MATERIAL, established_at: AT, is_self: true, text_body: 'hello', ...overrides,
});
const emptyRow = (state: string) => ({ introduction_state: state, material_id: null, established_at: null, is_self: null, text_body: null });
const send = (overrides: Record<string, unknown> = {}) => ({ outcome: 'COMMITTED', material_id: MATERIAL, established_at: AT, ...overrides });

describe('S6-05 - IntroductionWorldService', () => {
  let worlds: jest.Mock;
  let messages: jest.Mock;
  let history: jest.Mock;
  let sendText: jest.Mock;
  let service: IntroductionWorldService;

  beforeEach(() => {
    worlds = jest.fn().mockResolvedValue([worldRow()]);
    messages = jest.fn().mockResolvedValue([messageRow()]);
    history = jest.fn().mockResolvedValue([messageRow({ introduction_state: 'ENDED' })]);
    sendText = jest.fn().mockResolvedValue([send()]);
    service = new IntroductionWorldService({ worlds, messages, history, send: sendText } as unknown as IntroductionWorldRepository);
  });

  describe('discovery', () => {
    it('lists the caller\'s own Introduction Worlds, exactly the four columns', async () => {
      worlds.mockResolvedValue([worldRow(), worldRow({ world_id: OTHER, introduction_state: 'ENDED', other_first_name: null })]);
      await expect(service.worlds('token')).resolves.toEqual({ worlds: [
        { worldId: WORLD, proposalId: PROPOSAL, state: 'ACTIVE', otherFirstName: 'Omar' },
        { worldId: OTHER, proposalId: PROPOSAL, state: 'ENDED', otherFirstName: null },
      ] });
      expect(worlds).toHaveBeenCalledWith('token');
    });

    it.each([
      ['an account name column', worldRow({ account_name: 'Omar Fullname' })],
      ['a counterpart identity', worldRow({ other_user_id: OTHER })],
      ['an unknown state', worldRow({ introduction_state: 'COMPLETED' })],
      ['a malformed World', worldRow({ world_id: 'w1' })],
      ['a non-text name', worldRow({ other_first_name: 7 })],
      ['a missing column', { world_id: WORLD, matching_proposal_id: PROPOSAL, introduction_state: 'ACTIVE' }],
    ])('fails closed on %s, never passing it on', async (_label, bad) => {
      worlds.mockResolvedValue([bad]);
      await expect(service.worlds('token')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('reading', () => {
    it('reads one page, newest first from the database, oldest first to the reader', async () => {
      messages.mockResolvedValue([messageRow(), messageRow({ material_id: OTHER, established_at: EARLIER, is_self: false, text_body: 'hi' })]);
      await expect(service.messages('token', WORLD)).resolves.toEqual({
        outcome: 'ACTIVE', hasOlder: false, messages: [
          { materialId: OTHER, producer: 'HUMAN', text: 'hi', establishedAt: EARLIER, canDelete: false },
          { materialId: MATERIAL, producer: 'SELF', text: 'hello', establishedAt: AT, canDelete: true },
        ],
      });
      expect(messages).toHaveBeenCalledWith('token', WORLD, null, 51);
    });

    it('one row beyond the page says older messages exist, and is not shown', async () => {
      messages.mockResolvedValue(Array.from({ length: 51 }, () => messageRow()));
      const page = await service.messages('token', WORLD);
      expect(page).toMatchObject({ outcome: 'ACTIVE', hasOlder: true });
      expect((page as unknown as { messages: unknown[] }).messages).toHaveLength(50);
    });

    it('reads the page strictly older than a cursor', async () => {
      await service.olderMessages('token', WORLD, MATERIAL, AT);
      expect(messages).toHaveBeenCalledWith('token', WORLD, { materialId: MATERIAL, establishedAt: AT }, 51);
    });

    it('an empty Introduction is ACTIVE with no message; no row is UNAVAILABLE', async () => {
      messages.mockResolvedValue([emptyRow('ACTIVE')]);
      await expect(service.messages('token', WORLD)).resolves.toEqual({ outcome: 'ACTIVE', messages: [], hasOlder: false });
      messages.mockResolvedValue([]);
      await expect(service.messages('token', WORLD)).resolves.toEqual({ outcome: 'UNAVAILABLE' });
    });

    it('ENDED only on the server\'s own one empty ENDED row', async () => {
      messages.mockResolvedValue([emptyRow('ENDED')]);
      await expect(service.messages('token', WORLD)).resolves.toEqual({ outcome: 'ENDED' });
    });

    it('a World that is not an identifier is UNAVAILABLE without a database call', async () => {
      await expect(service.messages('token', 'nope')).resolves.toEqual({ outcome: 'UNAVAILABLE' });
      expect(messages).not.toHaveBeenCalled();
    });

    it.each([['a malformed message identity', 'x', AT], ['a free-form instant', MATERIAL, 'yesterday'], ['an instant without offset', MATERIAL, '2026-10-16T09:40:19'], ['an impossible calendar day', MATERIAL, '2026-02-30T09:40:19Z']])(
      'refuses %s as a cursor before any database call', async (_label, material, at) => {
        await expect(service.olderMessages('token', WORLD, material, at)).rejects.toBeInstanceOf(BadRequestException);
        expect(messages).not.toHaveBeenCalled();
      });

    it.each([
      ['an ENDED row that carries a message', [messageRow({ introduction_state: 'ENDED' })]],
      ['two ENDED rows', [emptyRow('ENDED'), emptyRow('ENDED')]],
      ['mixed states', [messageRow(), messageRow({ introduction_state: 'ENDED' })]],
      ['an unknown state', [messageRow({ introduction_state: 'CLOSED' })]],
      ['an empty ACTIVE row among messages', [messageRow(), emptyRow('ACTIVE')]],
      ['an author column', [messageRow({ author_user_id: OTHER })]],
      ['a non-boolean self', [messageRow({ is_self: 'true' })]],
      ['a malformed instant', [messageRow({ established_at: 'now' })]],
      ['more rows than asked for', Array.from({ length: 52 }, () => messageRow())],
    ])('fails closed on %s', async (_label, rows) => {
      messages.mockResolvedValue(rows);
      await expect(service.messages('token', WORLD)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('the closed history after END (CP4)', () => {
    it('reads one page of the reader\'s own entitlement, oldest first to the reader; their own words stay deletable (R-5)', async () => {
      history.mockResolvedValue([
        messageRow({ introduction_state: 'ENDED' }),
        messageRow({ introduction_state: 'ENDED', material_id: OTHER, established_at: EARLIER, is_self: false, text_body: 'hi' }),
      ]);
      await expect(service.history('token', WORLD)).resolves.toEqual({
        outcome: 'ENDED', hasOlder: false, messages: [
          { materialId: OTHER, producer: 'HUMAN', text: 'hi', establishedAt: EARLIER, canDelete: false },
          { materialId: MATERIAL, producer: 'SELF', text: 'hello', establishedAt: AT, canDelete: true },
        ],
      });
      expect(history).toHaveBeenCalledWith('token', WORLD, null, 51);
      expect(messages).not.toHaveBeenCalled();
    });

    it('one row beyond the page says older messages exist; the older page is strictly older than a cursor', async () => {
      history.mockResolvedValue(Array.from({ length: 51 }, () => messageRow({ introduction_state: 'ENDED' })));
      const page = await service.history('token', WORLD);
      expect(page).toMatchObject({ outcome: 'ENDED', hasOlder: true });
      expect((page as unknown as { messages: unknown[] }).messages).toHaveLength(50);
      await service.olderHistory('token', WORLD, MATERIAL, AT);
      expect(history).toHaveBeenLastCalledWith('token', WORLD, { materialId: MATERIAL, establishedAt: AT }, 51);
    });

    it('an entitled reader with nothing left is ENDED with no message; no row is UNAVAILABLE', async () => {
      history.mockResolvedValue([emptyRow('ENDED')]);
      await expect(service.history('token', WORLD)).resolves.toEqual({ outcome: 'ENDED', messages: [], hasOlder: false });
      history.mockResolvedValue([]);
      await expect(service.history('token', WORLD)).resolves.toEqual({ outcome: 'UNAVAILABLE' });
    });

    it('a World that is not an identifier is UNAVAILABLE, and a malformed cursor the client\'s error, without a database call', async () => {
      await expect(service.history('token', 'nope')).resolves.toEqual({ outcome: 'UNAVAILABLE' });
      await expect(service.olderHistory('token', WORLD, MATERIAL, '2026-02-30T09:40:19Z')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.olderHistory('token', WORLD, 'x', AT)).rejects.toBeInstanceOf(BadRequestException);
      expect(history).not.toHaveBeenCalled();
    });

    it.each([
      ['an ACTIVE row', [messageRow()]],
      ['an empty ACTIVE row', [emptyRow('ACTIVE')]],
      ['mixed states', [messageRow({ introduction_state: 'ENDED' }), messageRow()]],
      ['an empty ENDED row among messages', [messageRow({ introduction_state: 'ENDED' }), emptyRow('ENDED')]],
      ['an author column', [messageRow({ introduction_state: 'ENDED', author_user_id: OTHER })]],
      ['a non-boolean self', [messageRow({ introduction_state: 'ENDED', is_self: 'true' })]],
      ['a malformed instant', [messageRow({ introduction_state: 'ENDED', established_at: 'now' })]],
      ['more rows than asked for', Array.from({ length: 52 }, () => messageRow({ introduction_state: 'ENDED' }))],
    ])('fails closed on %s', async (_label, rows) => {
      history.mockResolvedValue(rows);
      await expect(service.history('token', WORLD)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('only a database 22023 is the client\'s invalid request; every other failure is unavailable, said once, never retried', async () => {
      history.mockRejectedValue(new DataApiError(400, { databaseCode: '22023', databaseMessage: 'INTRODUCTION_HISTORY_READ_INVALID' }));
      await expect(service.history('token', WORLD)).rejects.toBeInstanceOf(BadRequestException);
      history.mockReset().mockRejectedValue(new Error('network'));
      await expect(service.history('token', WORLD)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(history).toHaveBeenCalledTimes(1);
    });
  });

  describe('sending', () => {
    it('sends exactly the command and the words, once, and answers the committed message', async () => {
      await expect(service.send('token', WORLD, { commandId: COMMAND, content: 'Hello Mona' }))
        .resolves.toEqual({ outcome: 'COMMITTED', materialId: MATERIAL, establishedAt: AT });
      expect(sendText).toHaveBeenCalledTimes(1);
      expect(sendText).toHaveBeenCalledWith('token', COMMAND, WORLD, 'Hello Mona');
    });

    it.each(['ENDED', 'UNAVAILABLE', 'COMMAND_CONFLICT'])('answers %s exactly as the database does, with no message', async (outcome) => {
      sendText.mockResolvedValue([send({ outcome, material_id: null, established_at: null })]);
      await expect(service.send('token', WORLD, { commandId: COMMAND, content: 'x' })).resolves.toEqual({ outcome });
    });

    it.each([
      ['no body', undefined], ['an array', [COMMAND]], ['no command', { content: 'x' }], ['a malformed command', { commandId: 'c1', content: 'x' }],
      ['no words', { commandId: COMMAND }], ['blank words', { commandId: COMMAND, content: '  \n ' }], ['non-text words', { commandId: COMMAND, content: 7 }],
      ['words beyond the bound', { commandId: COMMAND, content: 'x'.repeat(20001) }],
      ['a counterpart', { commandId: COMMAND, content: 'x', recipientId: OTHER }], ['an author', { commandId: COMMAND, content: 'x', userId: OTHER }],
      ['a kind', { commandId: COMMAND, content: 'x', kind: 'QANDEEL_OUTPUT' }],
    ])('refuses %s as an invalid request before any database call', async (_label, body) => {
      await expect(service.send('token', WORLD, body)).rejects.toBeInstanceOf(BadRequestException);
      expect(sendText).not.toHaveBeenCalled();
    });

    it('the bound itself is a message', async () => {
      await expect(service.send('token', WORLD, { commandId: COMMAND, content: 'x'.repeat(20000) })).resolves.toMatchObject({ outcome: 'COMMITTED' });
    });

    it('a World that is not an identifier is UNAVAILABLE without a database call', async () => {
      await expect(service.send('token', 'nope', { commandId: COMMAND, content: 'x' })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
      expect(sendText).not.toHaveBeenCalled();
    });

    it('an unknown, malformed or leaking answer fails closed, never as a success', async () => {
      for (const rows of [[], null, [{}], [send({ material_id: null })], [send({ established_at: 'now' })], [send({ outcome: 'ENDED' })],
        [send({ outcome: 'PENDING', material_id: null, established_at: null })], [send({ qandeel_reply_material_id: OTHER })], [send(), send()]]) {
        sendText.mockResolvedValue(rows);
        await expect(service.send('token', WORLD, { commandId: COMMAND, content: 'x' })).rejects.toBeInstanceOf(ServiceUnavailableException);
      }
    });

    it('only a database 22023 is the client\'s invalid request; every other failure is unavailable, said once, never retried', async () => {
      sendText.mockRejectedValue(new DataApiError(400, { databaseCode: '22023', databaseMessage: 'INTRODUCTION_MESSAGE_COMMAND_INVALID' }));
      await expect(service.send('token', WORLD, { commandId: COMMAND, content: 'x' })).rejects.toBeInstanceOf(BadRequestException);
      for (const error of [new DataApiError(400, { databaseCode: 'P0001', databaseMessage: 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' }),
        new DataApiError(401), new DataApiError(403), new DataApiError(409), new DataApiError(503)]) {
        sendText.mockReset().mockRejectedValue(error);
        const refusal = await service.send('token', WORLD, { commandId: COMMAND, content: 'x' }).catch((e: unknown) => e);
        expect(refusal).toBeInstanceOf(ServiceUnavailableException);
        expect(JSON.stringify((refusal as ServiceUnavailableException).getResponse())).not.toMatch(/SHARED|INTRODUCTION|P0001|22023/u);
        expect(sendText).toHaveBeenCalledTimes(1);
      }
    });
  });
});

describe('S6-05 - IntroductionWorldRepository', () => {
  it('calls only the three migration 0160 boundaries and the one 0161 reader, with the caller token and exactly their parameters', async () => {
    const request = jest.fn().mockResolvedValue([]);
    const repository = new IntroductionWorldRepository({ request } as unknown as SupabaseDataApiService);
    await repository.worlds('caller-token');
    await repository.messages('caller-token', WORLD, null, 51);
    await repository.messages('caller-token', WORLD, { materialId: MATERIAL, establishedAt: AT }, 51);
    await repository.send('caller-token', COMMAND, WORLD, 'Hello');
    await repository.history('caller-token', WORLD, null, 51);
    await repository.history('caller-token', WORLD, { materialId: MATERIAL, establishedAt: AT }, 51);
    expect(request.mock.calls).toEqual([
      ['caller-token', 'rpc/list_my_introduction_worlds_v1', { method: 'POST', body: JSON.stringify({}) }],
      ['caller-token', 'rpc/read_my_introduction_messages_v1', { method: 'POST', body: JSON.stringify({ p_world_id: WORLD, p_before_established_at: null, p_before_material_id: null, p_limit: 51 }) }],
      ['caller-token', 'rpc/read_my_introduction_messages_v1', { method: 'POST', body: JSON.stringify({ p_world_id: WORLD, p_before_established_at: AT, p_before_material_id: MATERIAL, p_limit: 51 }) }],
      ['caller-token', 'rpc/send_my_introduction_text_v1', { method: 'POST', body: JSON.stringify({ p_command_id: COMMAND, p_world_id: WORLD, p_content: 'Hello' }) }],
      ['caller-token', 'rpc/read_my_introduction_history_v1', { method: 'POST', body: JSON.stringify({ p_world_id: WORLD, p_before_established_at: null, p_before_material_id: null, p_limit: 51 }) }],
      ['caller-token', 'rpc/read_my_introduction_history_v1', { method: 'POST', body: JSON.stringify({ p_world_id: WORLD, p_before_established_at: AT, p_before_material_id: MATERIAL, p_limit: 51 }) }],
    ]);
  });
});

describe('S6-05 - the Introduction World module is isolated and runs no AI', () => {
  const dir = __dirname;
  const own = readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts')).sort();

  it('is exactly its four files', () => {
    // RE-ANCHORED by S6-07 (CP3): the per-Introduction alerts (0167) are the fifth file, under the same isolation rules.
    expect(own).toEqual(['introduction-world-alerts.controller.ts', 'introduction-world.controller.ts', 'introduction-world.repository.ts', 'introduction-world.service.ts', 'introductions-world.module.ts']);
  });

  it.each(own)('%s imports only its own files, auth and the Data API transport, names no AI or Activity path and logs nothing', (name) => {
    const text = readFileSync(join(dir, name), 'utf8');
    for (const target of [...text.matchAll(/from '([^']+)'/gu)].map((m) => m[1])) {
      expect(target.startsWith('./') || ['@nestjs/common', '../auth/authenticated-request', '../auth/supabase-auth.guard',
        '../auth/supabase-auth.service', '../conversation/supabase-data-api.service'].includes(target)).toBe(true);
    }
    const code = text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
    expect(code).not.toMatch(/router|qandeel|reply|semantic|weave|analysis|activity|push|notification|memory|personal|grant|_core_v1|commit_shared|service[-_]role|shared-world/iu);
    expect(code).not.toMatch(/console\.|Logger|captureException|Sentry|retry|setTimeout/iu);
  });

  it('provides only the auth guard, the Data API transport and its own repository and service', () => {
    const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, IntroductionsWorldModule) as Array<{ name: string }>).map((p) => p.name).sort();
    expect(providers).toEqual(['IntroductionWorldAlertsRepository', 'IntroductionWorldAlertsService', 'IntroductionWorldRepository', 'IntroductionWorldService', 'SupabaseAuthGuard', 'SupabaseAuthService', 'SupabaseDataApiService']);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, IntroductionsWorldModule) ?? []).toEqual([]);
  });

  it('has exactly the six routes (four CP3, two CP4) and takes no identity from the client', () => {
    const controller = readFileSync(join(dir, 'introduction-world.controller.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '');
    expect([...controller.matchAll(/@(Get|Post|Put|Patch|Delete)\('([^']+)'\)/gu)].map((m) => `${m[1]} ${m[2]}`)).toEqual([
      'Get worlds', 'Get worlds/:worldId/messages', 'Get worlds/:worldId/messages/before/:materialId/:establishedAt', 'Post worlds/:worldId/messages',
      'Get worlds/:worldId/history', 'Get worlds/:worldId/history/before/:materialId/:establishedAt',
    ]);
    expect([...controller.matchAll(/@Param\('([^']+)'\)/gu)].map((m) => m[1])).toEqual(
      ['worldId', 'worldId', 'materialId', 'establishedAt', 'worldId', 'worldId', 'worldId', 'materialId', 'establishedAt']);
    expect(controller).not.toMatch(/@Query|userId|recipient|author|role/iu);
    expect(controller).toMatch(/@UseGuards\(SupabaseAuthGuard\)/u);
  });
});
